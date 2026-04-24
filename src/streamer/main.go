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
	// 1. Load .env
	godotenv.Load()
	dbURL := os.Getenv("SUPABASE_DB_URL")
	if dbURL == "" {
		log.Fatal("[❌] ERROR: SUPABASE_DB_URL not found in .env")
	}

	// 2. Koneksi Database (Supabase)
	fmt.Println("[⏳] Tahap 1: Mencoba koneksi ke Database Supabase...")
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("[❌] DB Setup Error:", err)
	}
	defer db.Close()

	// Tes Ping: Ini akan membuktikan apakah password dengan simbol Anda berhasil atau tidak
	err = db.Ping()
	if err != nil {
		fmt.Printf("[❌] GAGAL: Database tidak merespon. Pesan Error: %v\n", err)
		fmt.Println("[!] Tips: Gunakan format 'host=... password=...' di .env Anda.")
		return
	}
	fmt.Println("[✅] TAHAP 1 BERHASIL: Database Terkoneksi!")

	// 3. Loop Utama dengan Auto-Reconnect ke Binance
	for {
		fmt.Println("[🛰️ ] Tahap 2: Mencoba menyambungkan ke Binance WebSocket...")
		runStream(db)
		fmt.Println("[!] Koneksi terputus. Mencoba lagi dalam 5 detik...")
		time.Sleep(5 * time.Second)
	}
}

func runStream(db *sql.DB) {
	// Endpoint Binance Futures (AggTrade + ForceOrder)
	url := "wss://fstream.binance.com/stream?streams=btcusdt@aggTrade/btcusdt@forceOrder"

	c, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		fmt.Printf("[❌] GAGAL DIAL WEBSOCKET: %v\n", err)
		return
	}
	defer c.Close()

	fmt.Println("[🚀] TAHAP 2 BERHASIL: Bot Live & Sedang Mengintai Whale BTC!")

	for {
		_, message, err := c.ReadMessage()
		if err != nil {
			fmt.Printf("[!] Read Error: %v\n", err)
			return
		}

		var raw map[string]interface{}
		json.Unmarshal(message, &raw)
		
		streamVal, ok := raw["stream"]
		if !ok { continue }
		stream := streamVal.(string)
		
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
	var price, amount float64
	fmt.Sscanf(t.Price, "%f", &price)
	fmt.Sscanf(t.Amount, "%f", &amount)
	notional := price * amount

	// Filter Whale > $50,000 (Ganti ke angka kecil untuk testing jika perlu)
	if notional >= 50000 {
		side := "buy"; if t.Side { side = "sell" }

		_, err := db.Exec(`
             INSERT INTO whale_trades (symbol, side, price, amount, notional, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6)`,
			t.Symbol, side, price, amount, notional, time.Unix(0, t.EventTime*1e6))

		if err == nil {
			fmt.Printf("[🐳] WHALE %s: $%.0f (Saved to Cloud)\n", strings.ToUpper(side), notional)
		} else {
			fmt.Printf("[❌] DB Save Error: %v\n", err)
		}
	}
}

func processLiquidation(db *sql.DB, l Liquidation) {
	var price, amount float64
	fmt.Sscanf(l.Order.Price, "%f", &price)
	fmt.Sscanf(l.Order.Amount, "%f", &amount)

	side := "buy"; if l.Order.Side == "BUY" { side = "sell" }

	_, err := db.Exec(`
         INSERT INTO liquidations (symbol, side, price, amount, timestamp)
         VALUES ($1, $2, $3, $4, $5)`,
		l.Order.Symbol, side, price, amount, time.Unix(0, l.Order.Time*1e6))

	if err == nil {
		fmt.Printf("[💀] REKT %s: $%.0f (Saved to Cloud)\n", strings.ToUpper(side), price*amount)
	} else {
		fmt.Printf("[❌] DB Save Rekt Error: %v\n", err)
	}
}
