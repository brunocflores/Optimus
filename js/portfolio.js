import { db } from './firebase-config.js';
import authManager from './auth.js';
import stockAPI from './stock-api.js';
import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class PortfolioManager {
  constructor() {
    this.portfolio = [];
    this.stockPrices = {};
    this.isLoading = false;
    this.setupEventListeners();
  }

  setupEventListeners() {
    const addStockBtn = document.getElementById('add-stock-btn');
    const addStockForm = document.getElementById('add-stock-form');
    const closeModal = document.getElementById('close-modal');
    const cancelAdd = document.getElementById('cancel-add');
    const modal = document.getElementById('add-stock-modal');

    addStockBtn?.addEventListener('click', () => this.showAddStockModal());
    addStockForm?.addEventListener('submit', (e) => this.handleAddStock(e));
    closeModal?.addEventListener('click', () => this.hideAddStockModal());
    cancelAdd?.addEventListener('click', () => this.hideAddStockModal());
    
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideAddStockModal();
      }
    });

    // Set default date to today
    const dateInput = document.getElementById('stock-date');
    if (dateInput) {
      dateInput.valueAsDate = new Date();
    }
  }

  showAddStockModal() {
    const modal = document.getElementById('add-stock-modal');
    modal.classList.remove('hidden');
    document.getElementById('stock-symbol').focus();
  }

  hideAddStockModal() {
    const modal = document.getElementById('add-stock-modal');
    modal.classList.add('hidden');
    document.getElementById('add-stock-form').reset();
    
    const dateInput = document.getElementById('stock-date');
    if (dateInput) {
      dateInput.valueAsDate = new Date();
    }
  }

  async handleAddStock(e) {
    e.preventDefault();
    
    const symbol = document.getElementById('stock-symbol').value.toUpperCase();
    const quantity = parseInt(document.getElementById('stock-quantity').value);
    const price = parseFloat(document.getElementById('stock-price').value);
    const date = document.getElementById('stock-date').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    try {
      this.setButtonLoading(submitBtn, true);
      
      const user = authManager.getCurrentUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const stockData = {
        userId: user.uid,
        symbol: symbol,
        quantity: quantity,
        purchasePrice: price,
        purchaseDate: date,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'portfolio'), stockData);
      
      this.hideAddStockModal();
      this.showMessage('Ação adicionada com sucesso!', 'success');
      await this.loadPortfolio();
      
    } catch (error) {
      console.error('Error adding stock:', error);
      this.showMessage('Erro ao adicionar ação', 'error');
    } finally {
      this.setButtonLoading(submitBtn, false);
    }
  }

  async loadPortfolio() {
    const user = authManager.getCurrentUser();
    if (!user) return;

    try {
      this.setLoading(true);
      
      const q = query(
        collection(db, 'portfolio'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      this.portfolio = [];
      
      querySnapshot.forEach((doc) => {
        this.portfolio.push({
          id: doc.id,
          ...doc.data()
        });
      });

      await this.updateStockPrices();
      this.renderPortfolio();
      this.updateStats();
      
    } catch (error) {
      console.error('Error loading portfolio:', error);
      this.showMessage('Erro ao carregar carteira', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  async updateStockPrices() {
    if (this.portfolio.length === 0) return;

    const symbols = [...new Set(this.portfolio.map(stock => stock.symbol))];
    
    try {
      this.stockPrices = await stockAPI.getMultipleStockPrices(symbols);
      stockAPI.startRealTimeUpdates(() => this.handlePriceUpdate());
    } catch (error) {
      console.error('Error updating stock prices:', error);
    }
  }

  async handlePriceUpdate() {
    if (this.portfolio.length === 0) return;

    const symbols = [...new Set(this.portfolio.map(stock => stock.symbol))];
    
    try {
      this.stockPrices = await stockAPI.getMultipleStockPrices(symbols);
      this.renderPortfolio();
      this.updateStats();
    } catch (error) {
      console.error('Error updating prices:', error);
    }
  }

  renderPortfolio() {
    const portfolioList = document.getElementById('portfolio-list');
    
    if (this.portfolio.length === 0) {
      portfolioList.innerHTML = `
        <div class="loading-message">
          Sua carteira está vazia. Adicione algumas ações para começar!
        </div>
      `;
      return;
    }

    const groupedStocks = this.groupStocksBySymbol();
    
    portfolioList.innerHTML = Object.entries(groupedStocks).map(([symbol, stocks]) => {
      const totalQuantity = stocks.reduce((sum, stock) => sum + stock.quantity, 0);
      const avgPrice = stocks.reduce((sum, stock) => sum + (stock.purchasePrice * stock.quantity), 0) / totalQuantity;
      const currentPrice = this.stockPrices[symbol]?.price || 0;
      const totalInvested = totalQuantity * avgPrice;
      const currentValue = totalQuantity * currentPrice;
      const pnl = currentValue - totalInvested;
      const pnlPercent = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
      const priceChange = this.stockPrices[symbol]?.changePercent || 0;
      
      return `
        <div class="stock-item fade-in" data-symbol="${symbol}">
          <div class="stock-info">
            <h3>${symbol}</h3>
            <p>${totalQuantity} ações • Preço médio: ${stockAPI.formatPrice(avgPrice)}</p>
          </div>
          
          <div class="stock-price">
            <div class="current">${stockAPI.formatPrice(currentPrice)}</div>
            <div class="change ${priceChange >= 0 ? 'positive' : 'negative'}">
              ${stockAPI.formatChange(priceChange, true)}
            </div>
          </div>
          
          <div class="stock-pnl">
            <div class="value ${pnl >= 0 ? 'positive' : 'negative'}">
              ${stockAPI.formatPrice(Math.abs(pnl))}
            </div>
            <div class="percentage ${pnl >= 0 ? 'positive' : 'negative'}">
              ${stockAPI.formatChange(pnlPercent, true)}
            </div>
          </div>
          
          <div class="stock-actions">
            <button class="btn-secondary btn-small" onclick="portfolioManager.removeStock('${symbol}')">
              Remover
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  groupStocksBySymbol() {
    return this.portfolio.reduce((grouped, stock) => {
      if (!grouped[stock.symbol]) {
        grouped[stock.symbol] = [];
      }
      grouped[stock.symbol].push(stock);
      return grouped;
    }, {});
  }

  updateStats() {
    const groupedStocks = this.groupStocksBySymbol();
    let totalInvested = 0;
    let currentValue = 0;
    let totalStocks = Object.keys(groupedStocks).length;

    Object.entries(groupedStocks).forEach(([symbol, stocks]) => {
      const totalQuantity = stocks.reduce((sum, stock) => sum + stock.quantity, 0);
      const avgPrice = stocks.reduce((sum, stock) => sum + (stock.purchasePrice * stock.quantity), 0) / totalQuantity;
      const currentPrice = this.stockPrices[symbol]?.price || avgPrice;
      
      totalInvested += totalQuantity * avgPrice;
      currentValue += totalQuantity * currentPrice;
    });

    const totalPnL = currentValue - totalInvested;
    const pnlPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    // Update stat cards
    document.getElementById('total-pnl').textContent = stockAPI.formatPrice(totalPnL);
    document.getElementById('pnl-change').textContent = stockAPI.formatChange(pnlPercent, true);
    document.getElementById('total-invested').textContent = stockAPI.formatPrice(totalInvested);
    document.getElementById('total-stocks').textContent = totalStocks.toString();
    document.getElementById('current-value').textContent = stockAPI.formatPrice(currentValue);

    // Update P&L card styling
    const pnlCard = document.querySelector('.stat-card.positive, .stat-card.negative');
    if (pnlCard) {
      pnlCard.className = `stat-card ${totalPnL >= 0 ? 'positive' : 'negative'}`;
    }

    // Update change styling
    const changeElement = document.getElementById('pnl-change');
    if (changeElement) {
      changeElement.className = `stat-change ${totalPnL >= 0 ? 'positive' : 'negative'}`;
    }
  }

  async removeStock(symbol) {
    if (!confirm(`Deseja remover todas as posições de ${symbol}?`)) {
      return;
    }

    try {
      const user = authManager.getCurrentUser();
      if (!user) return;

      const stocksToRemove = this.portfolio.filter(stock => stock.symbol === symbol);
      
      for (const stock of stocksToRemove) {
        await deleteDoc(doc(db, 'portfolio', stock.id));
      }

      this.showMessage('Ações removidas com sucesso!', 'success');
      await this.loadPortfolio();
      
    } catch (error) {
      console.error('Error removing stock:', error);
      this.showMessage('Erro ao remover ações', 'error');
    }
  }

  setLoading(loading) {
    this.isLoading = loading;
    const portfolioList = document.getElementById('portfolio-list');
    
    if (loading) {
      portfolioList.innerHTML = '<div class="loading-message loading">Carregando carteira...</div>';
    }
  }

  setButtonLoading(button, loading) {
    if (loading) {
      button.disabled = true;
      button.textContent = 'Adicionando...';
      button.classList.add('loading');
    } else {
      button.disabled = false;
      button.textContent = 'Adicionar';
      button.classList.remove('loading');
    }
  }

  showMessage(message, type) {
    const existingMessage = document.querySelector('.error-message, .success-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
    messageDiv.textContent = message;

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.insertBefore(messageDiv, mainContent.firstChild);
    }

    setTimeout(() => {
      messageDiv.remove();
    }, 5000);
  }

  destroy() {
    stockAPI.stopRealTimeUpdates();
  }
}

// Make it globally available
window.portfolioManager = new PortfolioManager();
export default window.portfolioManager;