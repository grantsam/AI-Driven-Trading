FROM node:22-alpine

WORKDIR /app

# Install dependencies yang mungkin dibutuhkan oleh CCXT atau library lain
RUN apk add --no-cache python3 make g++

# Kita tidak menyalin package.json sekarang karena akan di-init dari dalam
# Namun kita siapkan user node agar aman
USER node

CMD ["tail", "-f", "/dev/null"]
