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
  where
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class PortfolioManager {
  constructor() {
    this.portfolio = [];
    this.stockPrices = {};
    this.isLoading = false;

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
    } else {
      this.setupEventListeners();
    }
  }

  setupEventListeners() {
    const addStockBtn = document.getElementById('add-stock-btn');
    const addStockForm = document.getElementById('add-stock-form');
    const closeModal = document.getElementById('close-modal');
    const cancelAdd = document.getElementById('cancel-add');
    const modal = document.getElementById('add-stock-modal');

    // Sell modal elements
    const sellStockForm = document.getElementById('sell-stock-form');
    const closeSellModal = document.getElementById('close-sell-modal');
    const cancelSell = document.getElementById('cancel-sell');
    const sellModal = document.getElementById('sell-stock-modal');

    addStockBtn?.addEventListener('click', () => this.showAddStockModal());
    addStockForm?.addEventListener('submit', (e) => this.handleAddStock(e));
    closeModal?.addEventListener('click', () => this.hideAddStockModal());
    cancelAdd?.addEventListener('click', () => this.hideAddStockModal());

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideAddStockModal();
      }
    });

    // Sell modal listeners
    sellStockForm?.addEventListener('submit', (e) => this.handleSellStock(e));
    closeSellModal?.addEventListener('click', () => this.hideSellStockModal());
    cancelSell?.addEventListener('click', () => this.hideSellStockModal());

    sellModal?.addEventListener('click', (e) => {
      if (e.target === sellModal) {
        this.hideSellStockModal();
      }
    });

    // Set default dates to today
    const dateInput = document.getElementById('stock-date');
    if (dateInput) {
      dateInput.valueAsDate = new Date();
    }

    const sellDateInput = document.getElementById('sell-date');
    if (sellDateInput) {
      sellDateInput.valueAsDate = new Date();
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

  showSellStockModal(symbol, availableQuantity, avgPrice) {
    const modal = document.getElementById('sell-stock-modal');
    document.getElementById('sell-stock-symbol').value = symbol;
    document.getElementById('available-quantity').textContent = availableQuantity;
    document.getElementById('avg-purchase-price').textContent = stockAPI.formatPrice(avgPrice);
    document.getElementById('sell-quantity').max = availableQuantity;

    modal.classList.remove('hidden');
    document.getElementById('sell-quantity').focus();
  }

  hideSellStockModal() {
    const modal = document.getElementById('sell-stock-modal');
    modal.classList.add('hidden');
    document.getElementById('sell-stock-form').reset();

    const sellDateInput = document.getElementById('sell-date');
    if (sellDateInput) {
      sellDateInput.valueAsDate = new Date();
    }
  }

  async handleAddStock(e) {
    e.preventDefault();
    console.log('➕ Adding stock to portfolio...');

    const symbol = document.getElementById('stock-symbol').value.toUpperCase();
    const quantity = parseInt(document.getElementById('stock-quantity').value);
    const price = parseFloat(document.getElementById('stock-price').value);
    const date = document.getElementById('stock-date').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    console.log('📊 Stock data:', { symbol, quantity, price, date });

    try {
      this.setButtonLoading(submitBtn, true);

      const user = authManager.getCurrentUser();
      console.log('👤 Current user:', user?.uid);

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

      console.log('💾 Saving stock data to Firestore:', stockData);
      const docRef = await addDoc(collection(db, 'portfolio'), stockData);
      console.log('✅ Stock added successfully with ID:', docRef.id);

      this.hideAddStockModal();
      this.showMessage('Ação adicionada com sucesso!', 'success');
      await this.loadPortfolio();

    } catch (error) {
      console.error('❌ Error adding stock:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);

      if (error.code === 'permission-denied') {
        this.showMessage('Erro: Permissões do Firestore não configuradas', 'error');
      } else {
        this.showMessage('Erro ao adicionar ação: ' + error.message, 'error');
      }
    } finally {
      this.setButtonLoading(submitBtn, false);
    }
  }

  async loadPortfolio() {
    const user = authManager.getCurrentUser();
    console.log('📊 Loading portfolio for user:', user?.uid);

    if (!user) {
      console.warn('❌ No user found, cannot load portfolio');
      return;
    }

    try {
      this.setLoading(true);
      console.log('🔄 Starting portfolio query...');

      // Removendo orderBy temporariamente para debug
      const q = query(
        collection(db, 'portfolio'),
        where('userId', '==', user.uid)
      );

      console.log('📋 Executing Firestore query...');
      const querySnapshot = await getDocs(q);
      console.log('📋 Query result - docs count:', querySnapshot.size);

      this.portfolio = [];

      querySnapshot.forEach((doc) => {
        console.log('📄 Document found:', doc.id, doc.data());
        this.portfolio.push({
          id: doc.id,
          ...doc.data()
        });
      });

      console.log('✅ Portfolio loaded:', this.portfolio.length, 'items');
      await this.updateStockPrices();
      this.renderPortfolio();
      this.updateStats();
      await this.updateRealizedPnL();

    } catch (error) {
      console.error('❌ Error loading portfolio:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);

      if (error.code === 'permission-denied') {
        this.showMessage('Erro: Permissões do Firestore não configuradas', 'error');
      } else if (error.code === 'failed-precondition') {
        this.showMessage('Erro: Índice do Firestore necessário', 'error');
      } else {
        this.showMessage('Erro ao carregar carteira: ' + error.message, 'error');
      }
    } finally {
      this.setLoading(false);
    }
  }

  async updateStockPrices(forceRefresh = false) {
    if (this.portfolio.length === 0) return;

    const symbols = [...new Set(this.portfolio.map(stock => stock.symbol))];
    console.log(`🎯 Buscando cotações apenas para ações da carteira: ${symbols.join(', ')} (${symbols.length} símbolos)`);

    try {
      if (forceRefresh) {
        stockAPI.clearCache();
        console.log('🔄 Forçando atualização de cotações...');
      }

      this.stockPrices = await stockAPI.getMultipleStockPrices(symbols);
      stockAPI.startRealTimeUpdates(() => this.handlePriceUpdate());
    } catch (error) {
      console.error('Error updating stock prices:', error);
    }
  }

  async forceRefreshPrices() {
    await this.updateStockPrices(true);
    this.renderPortfolio();
    this.updateStats();
    console.log('✅ Cotações atualizadas com valores exatos');
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
            <button class="btn-primary btn-small" onclick="portfolioManager.sellStock('${symbol}', ${totalQuantity}, ${avgPrice})">
              Vender
            </button>
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

  sellStock(symbol, availableQuantity, avgPrice) {
    this.showSellStockModal(symbol, availableQuantity, avgPrice);
  }

  async handleSellStock(e) {
    e.preventDefault();
    console.log('💰 Selling stock...');

    const symbol = document.getElementById('sell-stock-symbol').value;
    const quantityToSell = parseInt(document.getElementById('sell-quantity').value);
    const sellPrice = parseFloat(document.getElementById('sell-price').value);
    const sellDate = document.getElementById('sell-date').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    console.log('📊 Sell data:', { symbol, quantityToSell, sellPrice, sellDate });

    try {
      this.setSellButtonLoading(submitBtn, true);

      const user = authManager.getCurrentUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Get current stocks for this symbol
      const symbolStocks = this.portfolio.filter(stock => stock.symbol === symbol);
      let remainingToSell = quantityToSell;
      let totalCostBasis = 0;

      // Calculate average purchase price for sold quantity using FIFO
      symbolStocks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      for (const stock of symbolStocks) {
        if (remainingToSell <= 0) break;

        const sellFromThis = Math.min(remainingToSell, stock.quantity);
        totalCostBasis += sellFromThis * stock.purchasePrice;

        if (sellFromThis === stock.quantity) {
          // Remove entire position
          await deleteDoc(doc(db, 'portfolio', stock.id));
        } else {
          // Update remaining quantity
          await updateDoc(doc(db, 'portfolio', stock.id), {
            quantity: stock.quantity - sellFromThis
          });
        }

        remainingToSell -= sellFromThis;
      }

      // Calculate realized P&L
      const avgPurchasePrice = totalCostBasis / quantityToSell;
      const realizedPnL = (sellPrice - avgPurchasePrice) * quantityToSell;

      // Save sale record
      const saleData = {
        userId: user.uid,
        symbol: symbol,
        quantity: quantityToSell,
        purchasePrice: avgPurchasePrice,
        sellPrice: sellPrice,
        sellDate: sellDate,
        realizedPnL: realizedPnL,
        createdAt: new Date().toISOString(),
        type: 'sale'
      };

      console.log('💾 Saving sale data to Firestore:', saleData);
      await addDoc(collection(db, 'transactions'), saleData);

      this.hideSellStockModal();
      this.showMessage(`${quantityToSell} ações de ${symbol} vendidas com sucesso!`, 'success');
      await this.loadPortfolio();
      await this.updateRealizedPnL();

    } catch (error) {
      console.error('❌ Error selling stock:', error);
      this.showMessage('Erro ao vender ação: ' + error.message, 'error');
    } finally {
      this.setSellButtonLoading(submitBtn, false);
    }
  }

  async updateRealizedPnL() {
    const user = authManager.getCurrentUser();
    if (!user) return;

    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        where('type', '==', 'sale')
      );

      const querySnapshot = await getDocs(q);
      let totalRealizedPnL = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        totalRealizedPnL += data.realizedPnL || 0;
      });

      document.getElementById('realized-pnl').textContent = stockAPI.formatPrice(totalRealizedPnL);

      // Update card styling based on positive/negative
      const realizedCard = document.getElementById('realized-pnl').closest('.stat-card');
      if (realizedCard) {
        realizedCard.className = `stat-card ${totalRealizedPnL >= 0 ? 'positive' : 'negative'}`;
      }

    } catch (error) {
      console.error('Error updating realized P&L:', error);
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

  setSellButtonLoading(button, loading) {
    if (loading) {
      button.disabled = true;
      button.textContent = 'Vendendo...';
      button.classList.add('loading');
    } else {
      button.disabled = false;
      button.textContent = 'Vender';
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