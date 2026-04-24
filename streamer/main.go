package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// Struktur Data Binance
type AggTrade struct {
	EventTime int64  `json:"E"`
	Symbol    string `json:"s"`
	Price     string `json:"p"`
	Amount    string `json:"q"`
	Side      bool   `json:"m"` // true = sell, false = buy
}

type Liquidation struct {
	Order struct {
		Symbol string `json:"s"`
		Side   string `json:"S"`
		Price  string `json:"p"`
		Amount string `json:"q"`
		Time   int64  `json:"t"`
	} `json:"o"`
}

func main() {
	godotenv.Load()
	dbURL := os.Getenv("SUPABASE_DB_URL")
	if dbURL == "" {
		log.Fatal("SUPABASE_DB_URL not found")
	}

	// 1. Koneksi Database (Supabase)
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// 2. Loop Utama dengan Auto-Reconnect
	for {
		fmt.Println("[🌩️] Connecting to Binance WebSocket...")
		runStream(db)
		fmt.Println("[!] Connection lost. Reconnecting in 5 seconds...")
		time.Sleep(5 * time.Second)
	}
}

func runStream(db *sql.DB) {
	// Endpoint Binance Futures (AggTrade + ForceOrder)
	url := "wss://fstream.binance.com/stream?streams=btcusdt@aggTrade/btcusdt@forceOrder"

	c, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		fmt.Println("Dial error:", err)
		return
	}
	defer c.Close()

	for {
		_, message, err := c.ReadMessage()
		if err != nil {
			fmt.Println("Read error:", err)
			return
		}

		var raw map[string]interface{}
		json.Unmarshal(message, &raw)
		stream := raw["stream"].(string)
		data, _ := json.Marshal(raw["data"])

		if strings.Contains(stream, "aggTrade") {
			var t AggTrade
			json.Unmarshal(data, &t)
			processTrade(db, t)
		} else if strings.Contains(stream, "forceOrder") {
			var l Liquidation
			json.Unmarshal(data, &l)
			processLiquidation(db, l)
		}
	}
}

func processTrade(db *sql.DB, t AggTrade) {
	price := 0.0
	amount := 0.0
	fmt.Sscanf(t.Price, "%f", &price)
	fmt.Sscanf(t.Amount, "%f", &amount)
	notional := price * amount

	// Filter Whale > $50,000
	if notional >= 50000 {
		side := "buy"
		if t.Side {
			side = "sell"
		}

		_, err := db.Exec(`
             INSERT INTO whale_trades (symbol, side, price, amount, notional, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6)`,
			t.Symbol, side, price, amount, notional, time.Unix(0, t.EventTime*1e6))

		if err == nil {
			fmt.Printf("[🐳] WHALE %s: $%.2f\n", strings.ToUpper(side), notional)
		}
	}
}

func processLiquidation(db *sql.DB, l Liquidation) {
	price := 0.0
	amount := 0.0
	fmt.Sscanf(l.Order.Price, "%f", &price)
	fmt.Sscanf(l.Order.Amount, "%f", &amount)

	side := "buy" // Default: Short Liquidation
	if l.Order.Side == "BUY" {
		side = "sell"
	}

	_, err := db.Exec(`
         INSERT INTO liquidations (symbol, side, price, amount, timestamp)
         VALUES ($1, $2, $3, $4, $5)`,
		l.Order.Symbol, side, price, amount, time.Unix(0, l.Order.Time*1e6))

	if err == nil {
		fmt.Printf("[💀] REKT %s: $%.2f\n", strings.ToUpper(side), price*amount)
	}
}
