// API Configuration for Optimus Trading
class APIConfig {
  constructor() {
    // Alpha Vantage API Key
    this.alphaVantageApiKey = 'ECWTME2OGYYT5D1A';

    console.log('✅ [DEBUG] APIConfig loaded.');

    if (this.alphaVantageApiKey && this.alphaVantageApiKey !== 'YOUR_API_KEY') {
      console.log('✅ [DEBUG] Alpha Vantage API key is present.');
    } else {
      console.error('❌ [DEBUG] Alpha Vantage API key is MISSING in api-config.js.');
    }
  }

  // Get the Alpha Vantage API Key
  getAlphaVantageApiKey() {
    console.log('✅ [DEBUG] getAlphaVantageApiKey() called.');
    return this.alphaVantageApiKey;
  }
}

// Create and export singleton instance
const apiConfig = new APIConfig();
export default apiConfig;