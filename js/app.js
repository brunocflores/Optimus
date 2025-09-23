import authManager from './auth.js';
import portfolioManager from './portfolio.js';
import stockAPI from './stock-api.js';
import dayTradeManager from './day-trade.js';
import capitalEvolutionManager from './capital-evolution.js';
import apiConfig from './api-config.js';

class App {
  constructor() {
    // Promise to signal when initialization is complete
    this.initializationComplete = new Promise(resolve => {
      this.init().then(resolve);
    });
  }

  async init() {
    console.log('🚀 [DEBUG] App.init() started.');

    // Pass the API key to the stock API manager
    stockAPI.setApiKey(apiConfig.getAlphaVantageApiKey());
    console.log('✅ [DEBUG] API key passed to stockAPI.');
    
    this.setupGlobalErrorHandling();
    this.setupOfflineDetection();
    this.displayMarketStatus();
    
    setTimeout(() => {
      this.checkInstallPrompt();
    }, 2000);

    console.log('✅ [DEBUG] App.init() finished.');
  }

  setupGlobalErrorHandling() {
    // ... (rest of the file is the same)
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.showGlobalMessage('Ocorreu um erro inesperado', 'error');
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.showGlobalMessage('Erro de conexão ou dados', 'error');
      event.preventDefault();
    });
  }

  setupOfflineDetection() {
    window.addEventListener('online', () => {
      this.showGlobalMessage('Conexão restaurada!', 'success');
      if (portfolioManager && authManager.getCurrentUser()) {
        portfolioManager.loadPortfolio();
      }
    });

    window.addEventListener('offline', () => {
      this.showGlobalMessage('Você está offline', 'error');
    });

    if (!navigator.onLine) {
      this.showGlobalMessage('Você está offline', 'error');
    }
  }

  displayMarketStatus() {
    const marketStatus = stockAPI.getMarketStatus();
    
    const statusElement = document.createElement('div');
    statusElement.className = `market-status ${marketStatus.statusClass}`;
    statusElement.innerHTML = `
      <span class="status-indicator"></span>
      ${marketStatus.status}
    `;
    
    const header = document.querySelector('.header');
    if (header) {
      header.appendChild(statusElement);
    }

    const style = document.createElement('style');
    style.textContent = `
      .market-status { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; font-weight: 500; font-family: 'Orbitron', monospace; }
      .status-indicator { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: pulse 2s infinite; }
      .market-status.positive { color: var(--neon-green); }
      .market-status.negative { color: var(--neon-red); }
      @media (max-width: 768px) { .market-status { font-size: 0.8rem; } }
    `;
    document.head.appendChild(style);
  }

  checkInstallPrompt() {
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      this.showInstallPrompt(deferredPrompt);
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA installed');
      this.showGlobalMessage('App instalado com sucesso!', 'success');
    });
  }

  showInstallPrompt(deferredPrompt) {
    // ... (UI code for install prompt)
  }

  showGlobalMessage(message, type, duration = 3000) {
    // ... (UI code for global messages)
  }

  formatCurrency(value) {
    return stockAPI.formatPrice(value);
  }

  formatPercentage(value) {
    return stockAPI.formatChange(value, true);
  }
}

// Instantiate the App
const app = new App();

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = app;
});

// Export the instance so other modules can use it
export default app;
