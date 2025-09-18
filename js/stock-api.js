import apiConfig from './api-config.js';

class StockAPI {
  constructor() {
    this.updateInterval = null;
    this.updateFrequency = 600000; // 10 minutes (600 seconds) - Updated per request
    this.cache = new Map();
    this.cacheExpiry = 600000; // 10 minutes (local cache - aligned with backend)
    this.apiConfig = apiConfig;
    
    // Test API connectivity on initialization
    this.testAPIConnection();
  }

  async getStockPrice(symbol) {
    const cacheKey = symbol.toUpperCase();
    const cached = this.cache.get(cacheKey);
    
    // Check local cache first (10 minute cache)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      const ageMinutes = Math.floor((Date.now() - cached.timestamp) / 60000);
      console.log(`📦 Using cached data for ${symbol} (age: ${ageMinutes}min)`);
      return cached.data;
    }

    // Fetch from our Python API
    try {
      const stockData = await this.fetchFromPythonAPI(symbol);
      
      if (stockData) {
        // Cache the successful result
        this.cache.set(cacheKey, {
          data: stockData,
          timestamp: Date.now()
        });
        return stockData;
      }
    } catch (error) {
      console.warn(`Python API failed for ${symbol}:`, error);
    }

    // Fallback to mock data only if API completely fails
    const mockPrice = this.generateMockPrice(symbol);
    this.cache.set(cacheKey, {
      data: mockPrice,
      timestamp: Date.now()
    });
    
    return mockPrice;
  }

  async fetchFromPythonAPI(symbol) {
    try {
      console.log(`🐍 Fetching ${symbol} from Python API...`);
      
      // Use our Python backend API
      const apiUrl = this.apiConfig.getAPIUrl(`/api/stock/${symbol.toUpperCase()}`);
      
      // Timeout of 10 seconds for API call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check if we got an error response
      if (data.error) {
        throw new Error(data.message || 'API returned error');
      }
      
      // Validate the data structure
      if (!data.price || typeof data.price !== 'number') {
        throw new Error('Invalid price data from API');
      }
      
      console.log(`✅ Python API success: ${symbol} = R$ ${data.price.toFixed(2)} (${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%) - yfinance 0.2.66`);
      
      return {
        symbol: data.symbol,
        price: data.price,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
        currency: data.currency || 'BRL',
        timestamp: Date.now(),
        isMocked: false,
        source: data.source || 'Python API + yfinance 0.2.66'
      };
      
    } catch (error) {
      console.error(`❌ Python API failed for ${symbol}:`, error.message);
      
      // If it's a timeout error, provide specific message
      if (error.name === 'AbortError') {
        console.error(`⏰ API timeout for ${symbol} after 10 seconds`);
      }
      
      return null;
    }
  }

  async testAPIConnection() {
    try {
      console.log('🧪 Testing Python API connectivity...');
      const result = await this.apiConfig.testConnectivity();
      
      if (result.success) {
        console.log('✅ Python API is online and responding');
        return true;
      } else {
        console.error('❌ Python API connectivity test failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to test API connectivity:', error);
      return false;
    }
  }

  generateMockPrice(symbol) {
    console.error(`❌ ALL APIS FAILED for ${symbol} - This should not happen in production!`);
    console.log(`🔄 Using emergency fallback data for ${symbol}`);
    
    const currentPrice = this.getMockBasePrice(symbol);
    // Pequena variação realística para simular mercado
    const variation = (Math.random() - 0.5) * 0.04; // ±2% máximo
    const adjustedPrice = currentPrice * (1 + variation);
    const change = adjustedPrice - currentPrice;
    const changePercent = (change / currentPrice) * 100;

    console.warn(`⚠️ FALLBACK: ${symbol} = R$ ${adjustedPrice.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%) - Consider deploying to production`);

    return {
      symbol: symbol,
      price: parseFloat(adjustedPrice.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      currency: 'BRL',
      timestamp: Date.now(),
      isMocked: true,
      source: '⚠️ Emergency Fallback'
    };
  }

  getMockBasePrice(symbol) {
    // Preços do mercado brasileiro - Setembro 2025 (base atualizada)
    const realPrices = {
      // Top stocks Ibovespa
      'PETR4': 38.45,   // Petrobras PN
      'PETR3': 40.18,   // Petrobras ON
      'VALE3': 58.82,   // Vale ON
      'ITUB4': 32.25,   // Itaú Unibanco PN
      'ITUB3': 33.30,   // Itaú Unibanco ON
      'BBDC4': 13.12,   // Bradesco PN
      'BBDC3': 14.28,   // Bradesco ON
      'ABEV3': 11.94,   // Ambev ON
      'B3SA3': 12.52,   // B3 ON
      'WEGE3': 51.95,   // WEG ON
      
      // Mid/Small caps populares
      'MGLU3': 4.72,    // Magazine Luiza ON
      'RENT3': 59.48,   // Localiza ON
      'LREN3': 15.18,   // Lojas Renner ON
      'VIVT3': 41.95,   // Telefônica Brasil ON
      'JBSS3': 28.64,   // JBS ON
      'SUZB3': 47.35,   // Suzano SA ON
      'CIEL3': 6.22,    // Cielo ON
      'RADL3': 23.52,   // Raia Drogasil ON
      'EMBR3': 39.28,   // Embraer ON
      'CSNA3': 12.85,   // CSN ON
      
      // Utilities e Energia
      'ELETB4': 37.05,  // Eletrobras PN
      'CMIG4': 10.92,   // Cemig PN
      'TAEE11': 35.32,  // Taesa Units
      'EGIE3': 40.76,   // Engie Brasil ON
      'CPFE3': 32.18,   // CPFL Energia ON
      
      // Telecom e Tech
      'TIMS3': 12.41,   // TIM ON
      'TOTS3': 28.95,   // TOTVS ON
      'LWSA3': 7.83,    // Locaweb ON
      
      // Bancos e Financeiro
      'BPAC11': 23.85,  // BTG Pactual Units
      'SANB11': 36.72,  // Santander Units
      'BBSE3': 26.45,   // BB Seguridade ON
      
      // Varejo e Consumo
      'HYPE3': 22.98,   // Hypera Pharma
      'NTCO3': 14.74,   // Natura ON
      'SOMA3': 8.67,    // Grupo SBF ON
      'AMAR3': 18.92,   // Marisa ON
      
      // Commodities e Mineração
      'USIM5': 7.28,    // Usiminas PNA
      'GOAU4': 4.68,    // Gerdau PN
      'KLBN11': 3.98,   // Klabin Units
      
      // Saúde
      'HAPV3': 3.89,    // Hapvida ON
      'FLRY3': 13.63,   // Fleury ON
      'QUAL3': 18.97,   // Qualicorp ON
      'DASA3': 12.45,   // Dasa ON
      
      // Logística e Transporte
      'RAIL3': 18.52,   // Rumo ON
      'CCRO3': 14.30,   // CCR ON
      'UGPA3': 15.74,   // Ultrapar ON
      
      // Petróleo e Gás
      'PRIO3': 41.35,   // PetroRio ON
      'RECV3': 28.67,   // Recrusul ON
      
      // Educação
      'YDUQ3': 12.96,   // YDUQS ON
      'COGN3': 1.89,    // Cogna ON
      
      // Papel e Celulose
      'SUZB3': 47.35,   // Suzano ON (duplicado removido acima)
      
      // Outros setores
      'BEEF3': 16.23,   // Minerva ON
      'MRFG3': 7.45,    // Marfrig ON
      'ARZZ3': 52.18    // Arezzo ON
    };

    return realPrices[symbol.toUpperCase()] || this.estimateUnknownPrice(symbol);
  }

  estimateUnknownPrice(symbol) {
    // Para símbolos não cadastrados, gera preço baseado no hash do símbolo
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = ((hash << 5) - hash + symbol.charCodeAt(i)) & 0xffffffff;
    }
    
    // Preço entre R$ 5,00 e R$ 80,00 baseado no hash
    const price = 5 + Math.abs(hash % 7500) / 100;
    console.log(`❓ Unknown symbol ${symbol} - estimated price: R$ ${price.toFixed(2)}`);
    return price;
  }

  async getMultipleStockPrices(symbols) {
    console.log(`🎯 Fetching data for ${symbols.length} portfolio symbols only`);

    // Option 1: Use our Python API's batch endpoint (more efficient for portfolio)
    if (symbols.length > 3) {
      try {
        console.log(`🐍 Fetching ${symbols.length} symbols via batch API...`);
        
        const symbolsParam = symbols.map(s => s.toUpperCase()).join(',');
        console.log(`📊 Batch request for portfolio symbols: ${symbolsParam}`);
        const apiUrl = this.apiConfig.getAPIUrl(`/api/stocks?symbols=${symbolsParam}`);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.results) {
            console.log(`✅ Batch API success: ${data.total_successful}/${data.total_requested} symbols`);
            
            // Cache all results
            Object.entries(data.results).forEach(([symbol, stockData]) => {
              this.cache.set(symbol, {
                data: {
                  ...stockData,
                  timestamp: Date.now(),
                  isMocked: false,
                  source: stockData.source || 'Python API Batch'
                },
                timestamp: Date.now()
              });
            });
            
            return data.results;
          }
        }
      } catch (error) {
        console.warn('Batch API failed, falling back to individual requests:', error);
      }
    }
    
    // Option 2: Individual requests (fallback or for smaller batches)
    console.log(`🔄 Fetching ${symbols.length} symbols individually...`);
    
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

  clearCache() {
    this.cache.clear();
    console.log('📊 Cache de cotações limpo - próximas consultas buscarão dados atualizados');
  }

  async forceRefresh(symbol) {
    const cacheKey = symbol.toUpperCase();
    this.cache.delete(cacheKey);
    return await this.getStockPrice(symbol);
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

  // Comprehensive API testing method
  async testAPIs() {
    console.log('🧪 Testing Python API and stock data retrieval...');
    
    const testSymbol = 'PETR4';
    const results = {
      api_health: null,
      stock_data: null,
      performance: {}
    };
    
    // Test 1: API Health Check
    try {
      const start = Date.now();
      const healthResult = await this.apiConfig.testConnectivity();
      const time = Date.now() - start;
      
      results.api_health = {
        status: healthResult.success ? 'success' : 'error',
        time: time + 'ms',
        data: healthResult.data || healthResult.error
      };
      
      console.log(`${healthResult.success ? '✅' : '❌'} API Health: ${time}ms`);
    } catch (error) {
      results.api_health = { status: 'error', message: error.message };
      console.log(`❌ API Health: ${error.message}`);
    }
    
    // Test 2: Real Stock Data
    try {
      const start = Date.now();
      const stockData = await this.getStockPrice(testSymbol);
      const time = Date.now() - start;
      
      if (stockData && !stockData.isMocked) {
        results.stock_data = {
          status: 'success',
          time: time + 'ms',
          symbol: stockData.symbol,
          price: stockData.price,
          source: stockData.source,
          is_real: !stockData.isMocked
        };
        console.log(`✅ Stock Data (${testSymbol}): R$ ${stockData.price} in ${time}ms`);
      } else {
        results.stock_data = {
          status: 'fallback',
          time: time + 'ms',
          message: 'Using mock data',
          is_real: false
        };
        console.log(`⚠️ Stock Data (${testSymbol}): Using fallback data`);
      }
    } catch (error) {
      results.stock_data = { status: 'error', message: error.message };
      console.log(`❌ Stock Data: ${error.message}`);
    }
    
    // Test 3: Batch Request (if API is working)
    if (results.api_health?.status === 'success') {
      try {
        const start = Date.now();
        const batchData = await this.getMultipleStockPrices(['PETR4', 'VALE3', 'ITUB4']);
        const time = Date.now() - start;
        
        const successCount = Object.keys(batchData).length;
        results.batch_request = {
          status: successCount > 0 ? 'success' : 'error',
          time: time + 'ms',
          symbols_requested: 3,
          symbols_received: successCount
        };
        
        console.log(`✅ Batch Request: ${successCount}/3 symbols in ${time}ms`);
      } catch (error) {
        results.batch_request = { status: 'error', message: error.message };
        console.log(`❌ Batch Request: ${error.message}`);
      }
    }
    
    console.log('🧪 Complete API Test Results:', results);
    return results;
  }

  // Quick test method for debugging
  async quickTest() {
    console.log('⚡ Quick API test...');
    
    try {
      const result = await this.getStockPrice('PETR4');
      if (result && !result.isMocked) {
        console.log(`✅ Quick test success: PETR4 = R$ ${result.price} (${result.source})`);
        return true;
      } else {
        console.log(`⚠️ Quick test: using fallback data`);
        return false;
      }
    } catch (error) {
      console.log(`❌ Quick test failed: ${error.message}`);
      return false;
    }
  }
}

export default new StockAPI();