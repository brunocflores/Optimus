import apiConfig from './api-config.js';

class StockAPI {
  constructor() {
    this.apiKey = '';
    this.updateInterval = null;
    this.updateFrequency = 3600000; // 60 minutes
    this.cache = new Map();
    this.cacheExpiry = 300000; // 5 minutes
    this.rateLimitDelay = 5000; // 5 seconds (WARNING: May exceed API rate limits)
  }

  setApiKey(key) {
    this.apiKey = key;
    if (this.apiKey && this.apiKey !== 'YOUR_API_KEY') {
      console.log('✅ [DEBUG] Alpha Vantage API key configured.');
    } else {
      console.error('❌ [DEBUG] Alpha Vantage API key is missing. Price updates will fail.');
    }
  }

  _formatSymbolForAPI(symbol) {
    // Alpha Vantage also uses .SA for Brazilian stocks
    return `${symbol.toUpperCase()}.SA`;
  }

  async getStockPrice(symbol) {
    const cacheKey = symbol.toUpperCase();
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log(`📦 [DEBUG] Using cached data for ${symbol}`);
      return cached.data;
    }

    if (!this.apiKey || this.apiKey === 'YOUR_API_KEY') {
      console.error(`❌ [DEBUG] Alpha Vantage API key not available for ${symbol}.`);
      return this.generateMockPrice(symbol);
    }

    const apiSymbol = this._formatSymbolForAPI(symbol);
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${apiSymbol}&apikey=${this.apiKey}`;
    console.log(`📞 [DEBUG] Fetching URL: ${url}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Handle API responses that are not valid quotes (e.g., rate limit notes)
      if (!data || !data['Global Quote'] || Object.keys(data['Global Quote']).length === 0) {
        if (data.Note) {
          throw new Error(`API Note: ${data.Note}`); // Likely a rate limit error
        }
        throw new Error('Invalid data structure from Alpha Vantage API.');
      }

      const quote = data['Global Quote'];
      const price = parseFloat(quote['05. price']);
      const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));

      if (isNaN(price)) {
        throw new Error(`Could not parse price from API response: ${quote['05. price']}`);
      }

      const stockData = {
        symbol: symbol,
        price: price,
        change: parseFloat(quote['09. change']),
        changePercent: changePercent,
        currency: 'BRL', // Assuming BRL for .SA stocks
        timestamp: Date.now(),
        isMocked: false,
        source: 'Alpha Vantage'
      };

      this.cache.set(cacheKey, { data: stockData, timestamp: Date.now() });
      console.log(`✅ [DEBUG] Alpha Vantage success for ${symbol}: Price R$ ${stockData.price.toFixed(2)}`);
      return stockData;

    } catch (error) {
      console.error(`❌ [DEBUG] Alpha Vantage API call failed for ${symbol}. Error:`, error.message);
      console.log(`🔄 [DEBUG] Falling back to mock data for ${symbol}.`);
      return this.generateMockPrice(symbol);
    }
  }

  async getMultipleStockPrices(symbols) {
    console.log(`🎯 [DEBUG] Fetching ${symbols.length} symbols from Alpha Vantage with rate limiting...`);
    const results = {};

    for (const symbol of symbols) {
      // Check cache before making a call
      const cacheKey = symbol.toUpperCase();
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        console.log(`📦 [DEBUG] Using cached data for ${symbol} in batch request.`);
        results[symbol] = cached.data;
        continue;
      }

      // If not in cache, fetch and then wait
      results[symbol] = await this.getStockPrice(symbol);
      
      // Wait to avoid hitting rate limit. Don't wait after the last symbol.
      if (symbols.indexOf(symbol) < symbols.length - 1) {
        console.log(`⏳ [DEBUG] Waiting ${this.rateLimitDelay / 1000}s before next API call...`);
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      }
    }

    console.log(`✅ [DEBUG] Finished fetching all symbols from Alpha Vantage.`);
    return results;
  }

  startRealTimeUpdates(callback) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.updateInterval = setInterval(() => {
      if (typeof callback === 'function') {
        console.log('🔄 [DEBUG] Automatic price refresh triggered.');
        callback();
      }
    }, this.updateFrequency);
    console.log(`⏰ [DEBUG] Automatic price updates scheduled every ${this.updateFrequency / 60000} minutes.`);
  }

  stopRealTimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('🛑 [DEBUG] Automatic price updates stopped.');
    }
  }

  clearCache() {
    this.cache.clear();
    console.log('📊 [DEBUG] Cache de cotações limpo.');
  }

  formatPrice(price, currency = 'BRL') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(price || 0);
  }

  formatChange(change, isPercentage = false) {
    const value = change || 0;
    const prefix = value >= 0 ? '+' : '';
    if (isPercentage) {
      return `${prefix}${value.toFixed(2)}%`;
    }
    return `${prefix}${this.formatPrice(value)}`;
  }
  
  generateMockPrice(symbol) {
    console.warn(`⚠️ [DEBUG] Using fallback MOCK DATA for ${symbol}`);
    const basePrice = 30 + Math.random() * 100;
    const price = basePrice * (1 + (Math.random() - 0.5) * 0.1);
    return {
      symbol: symbol,
      price: parseFloat(price.toFixed(2)),
      change: (price - basePrice),
      changePercent: ((price - basePrice) / basePrice) * 100,
      currency: 'BRL',
      timestamp: Date.now(),
      isMocked: true,
      source: 'Mock Data'
    };
  }

  getMarketStatus() {
    return {
        isOpen: true,
        status: 'Mercado (Info Limitada)',
        statusClass: 'positive'
      };
  }
}

export default new StockAPI();