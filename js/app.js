import authManager from './auth.js';
import portfolioManager from './portfolio.js';
import stockAPI from './stock-api.js';
import dayTradeManager from './day-trade.js';
import capitalEvolutionManager from './capital-evolution.js';

class App {
  constructor() {
    this.init();
  }

  async init() {
    console.log('🚀 Optimus Trading PWA iniciando...');
    
    this.setupGlobalErrorHandling();
    this.setupOfflineDetection();
    this.displayMarketStatus();
    
    // Wait for auth state to be determined
    setTimeout(() => {
      this.checkInstallPrompt();
    }, 2000);
  }

  setupGlobalErrorHandling() {
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

    // Add CSS for market status
    const style = document.createElement('style');
    style.textContent = `
      .market-status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
        font-weight: 500;
        font-family: 'Orbitron', monospace;
      }
      
      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
        animation: pulse 2s infinite;
      }
      
      .market-status.positive {
        color: var(--neon-green);
      }
      
      .market-status.negative {
        color: var(--neon-red);
      }
      
      @media (max-width: 768px) {
        .market-status {
          font-size: 0.8rem;
        }
      }
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
    const installBanner = document.createElement('div');
    installBanner.className = 'install-banner';
    installBanner.innerHTML = `
      <div class="install-content">
        <span>📱 Instalar Optimus Trading para acesso rápido?</span>
        <div class="install-actions">
          <button id="install-yes" class="btn-primary btn-small">Instalar</button>
          <button id="install-no" class="btn-secondary btn-small">Depois</button>
        </div>
      </div>
    `;

    document.body.appendChild(installBanner);

    // Add CSS for install banner
    const style = document.createElement('style');
    style.textContent = `
      .install-banner {
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        background: var(--bg-secondary);
        border: 2px solid var(--neon-yellow);
        border-radius: var(--border-radius);
        padding: 1rem;
        box-shadow: var(--shadow-glow) var(--neon-yellow);
        z-index: 1001;
        animation: slideIn 0.5s ease-out;
      }
      
      .install-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
      }
      
      .install-actions {
        display: flex;
        gap: 0.5rem;
      }
      
      @media (max-width: 768px) {
        .install-content {
          flex-direction: column;
          gap: 1rem;
        }
        
        .install-banner {
          left: 10px;
          right: 10px;
        }
      }
    `;
    document.head.appendChild(style);

    document.getElementById('install-yes').addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response: ${outcome}`);
        deferredPrompt = null;
      }
      installBanner.remove();
    });

    document.getElementById('install-no').addEventListener('click', () => {
      installBanner.remove();
    });

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (document.body.contains(installBanner)) {
        installBanner.remove();
      }
    }, 10000);
  }

  showGlobalMessage(message, type, duration = 3000) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `global-message ${type}`;
    messageDiv.textContent = message;

    document.body.appendChild(messageDiv);

    // Add CSS for global messages if not exists
    if (!document.getElementById('global-message-styles')) {
      const style = document.createElement('style');
      style.id = 'global-message-styles';
      style.textContent = `
        .global-message {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 1rem 1.5rem;
          border-radius: var(--border-radius);
          color: var(--text-primary);
          font-weight: 500;
          z-index: 1002;
          animation: slideIn 0.3s ease-out;
          max-width: 300px;
        }
        
        .global-message.success {
          background: var(--bg-secondary);
          border: 2px solid var(--neon-green);
          box-shadow: var(--shadow-neon) var(--neon-green);
        }
        
        .global-message.error {
          background: var(--bg-secondary);
          border: 2px solid var(--neon-red);
          box-shadow: var(--shadow-neon) var(--neon-red);
        }
        
        @media (max-width: 768px) {
          .global-message {
            top: 10px;
            right: 10px;
            left: 10px;
            max-width: none;
          }
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(() => {
      messageDiv.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        if (document.body.contains(messageDiv)) {
          messageDiv.remove();
        }
      }, 300);
    }, duration);
  }

  formatCurrency(value) {
    return stockAPI.formatPrice(value);
  }

  formatPercentage(value) {
    return stockAPI.formatChange(value, true);
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});

// Add fade out animation
const fadeOutStyle = document.createElement('style');
fadeOutStyle.textContent = `
  @keyframes fadeOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-10px); }
  }
`;
document.head.appendChild(fadeOutStyle);

export default App;