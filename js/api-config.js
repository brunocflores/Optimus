// API Configuration for Optimus Trading
class APIConfig {
  constructor() {
    // Development vs Production API URLs
    this.isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // API Base URLs
    this.API_URLS = {
      // Production: Railway deployed API (updated)
      production: 'https://optimus-production-8490.up.railway.app',

      // Development: Local FastAPI server
      development: 'http://localhost:5001',

      // Backup: Can be updated with actual deployed URL
      backup: 'https://your-backup-api.herokuapp.com'
    };
    
    // Current API URL
    this.baseURL = this.isDevelopment ? this.API_URLS.development : this.API_URLS.production;
    
    console.log(`🔧 API Mode: ${this.isDevelopment ? 'Development' : 'Production'}`);
    console.log(`📡 API Base URL: ${this.baseURL}`);
  }
  
  // Get the appropriate API URL for the environment
  getAPIUrl(endpoint = '') {
    return `${this.baseURL}${endpoint}`;
  }
  
  // Update production API URL (call this after Railway deployment)
  updateProductionURL(newURL) {
    this.API_URLS.production = newURL;
    if (!this.isDevelopment) {
      this.baseURL = newURL;
      console.log(`📡 Production API URL updated: ${newURL}`);
    }
  }
  
  // Test API connectivity
  async testConnectivity() {
    try {
      const response = await fetch(this.getAPIUrl('/api/health'), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API connectivity test successful:', data);
        return { success: true, data };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ API connectivity test failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export singleton instance
const apiConfig = new APIConfig();
export default apiConfig;