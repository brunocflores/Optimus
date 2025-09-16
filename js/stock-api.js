class StockAPI {
  constructor() {
    this.updateInterval = null;
    this.updateFrequency = 30000; // 30 seconds
    this.cache = new Map();
    this.cacheExpiry = 60000; // 1 minute
  }

  async getStockPrice(symbol) {
    const cacheKey = symbol.toUpperCase();
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const price = await this.fetchFromYahooFinance(symbol);
      
      if (price) {
        this.cache.set(cacheKey, {
          data: price,
          timestamp: Date.now()
        });
        return price;
      }
    } catch (error) {
      console.warn(`Yahoo Finance failed for ${symbol}:`, error);
    }

    try {
      const price = await this.fetchFromAlphaVantage(symbol);
      
      if (price) {
        this.cache.set(cacheKey, {
          data: price,
          timestamp: Date.now()
        });
        return price;
      }
    } catch (error) {
      console.warn(`Alpha Vantage failed for ${symbol}:`, error);
    }

    const mockPrice = this.generateMockPrice(symbol);
    this.cache.set(cacheKey, {
      data: mockPrice,
      timestamp: Date.now()
    });
    
    return mockPrice;
  }

  async fetchFromYahooFinance(symbol) {
    const yahooSymbol = symbol.endsWith('.SA') ? symbol : `${symbol}.SA`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.chart && data.chart.result && data.chart.result[0]) {
        const result = data.chart.result[0];
        const meta = result.meta;
        const currentPrice = meta.regularMarketPrice || meta.previousClose;
        const previousClose = meta.previousClose;
        const change = currentPrice - previousClose;
        const changePercent = (change / previousClose) * 100;
        
        return {
          symbol: symbol,
          price: currentPrice,
          change: change,
          changePercent: changePercent,
          currency: meta.currency || 'BRL',
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.error(`Yahoo Finance API error for ${symbol}:`, error);
    }
    
    return null;
  }

  async fetchFromAlphaVantage(symbol) {
    const API_KEY = 'demo'; // Replace with actual Alpha Vantage API key
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}.SAO&apikey=${API_KEY}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data['Global Quote']) {
        const quote = data['Global Quote'];
        const currentPrice = parseFloat(quote['05. price']);
        const previousClose = parseFloat(quote['08. previous close']);
        const change = currentPrice - previousClose;
        const changePercent = (change / previousClose) * 100;
        
        return {
          symbol: symbol,
          price: currentPrice,
          change: change,
          changePercent: changePercent,
          currency: 'BRL',
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.error(`Alpha Vantage API error for ${symbol}:`, error);
    }
    
    return null;
  }

  generateMockPrice(symbol) {
    const basePrice = this.getMockBasePrice(symbol);
    const randomFactor = 0.98 + Math.random() * 0.04; // ±2% variation
    const currentPrice = basePrice * randomFactor;
    const change = currentPrice - basePrice;
    const changePercent = (change / basePrice) * 100;
    
    return {
      symbol: symbol,
      price: currentPrice,
      change: change,
      changePercent: changePercent,
      currency: 'BRL',
      timestamp: Date.now(),
      isMocked: true
    };
  }

  getMockBasePrice(symbol) {
    const mockPrices = {
      'PETR4': 35.50,
      'VALE3': 65.20,
      'ITUB4': 25.80,
      'BBDC4': 15.90,
      'ABEV3': 12.40,
      'B3SA3': 10.25,
      'WEGE3': 38.90,
      'MGLU3': 8.75,
      'RENT3': 45.60,
      'LREN3': 18.30
    };
    
    return mockPrices[symbol.toUpperCase()] || 20.00 + Math.random() * 80.00;
  }

  async getMultipleStockPrices(symbols) {
    const promises = symbols.map(symbol => this.getStockPrice(symbol));
    const results = await Promise.all(promises);
    
    return results.reduce((acc, result, index) => {
      if (result) {
        acc[symbols[index]] = result;
      }
      return acc;
    }, {});
  }

  startRealTimeUpdates(callback) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      if (typeof callback === 'function') {
        callback();
      }
    }, this.updateFrequency);
  }

  stopRealTimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  formatPrice(price, currency = 'BRL') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(price);
  }

  formatChange(change, isPercentage = false) {
    const prefix = change >= 0 ? '+' : '';
    
    if (isPercentage) {
      return `${prefix}${change.toFixed(2)}%`;
    }
    
    return `${prefix}${new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(change)}`;
  }

  isMarketOpen() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Brazilian stock market hours: Monday to Friday, 10:00 to 17:00 (UTC-3)
    return day >= 1 && day <= 5 && hour >= 10 && hour < 17;
  }

  getMarketStatus() {
    if (this.isMarketOpen()) {
      return {
        isOpen: true,
        status: 'Mercado Aberto',
        statusClass: 'positive'
      };
    }
    
    return {
      isOpen: false,
      status: 'Mercado Fechado',
      statusClass: 'negative'
    };
  }
}

export default new StockAPI();