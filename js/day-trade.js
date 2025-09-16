import { db } from './firebase-config.js';
import authManager from './auth.js';
import stockAPI from './stock-api.js';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class DayTradeManager {
  constructor() {
    this.trades = [];
    this.currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    this.isLoading = false;

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
    } else {
      this.setupEventListeners();
    }
  }

  setupEventListeners() {
    console.log('🎯 Setting up day trade event listeners...');

    // Tab navigation
    const swingTradeTab = document.getElementById('swing-trade-tab');
    const dayTradeTab = document.getElementById('day-trade-tab');

    // Trade modal elements
    const addTradeBtn = document.getElementById('add-trade-btn');
    const addTradeForm = document.getElementById('add-trade-form');
    const closeTradeModal = document.getElementById('close-trade-modal');
    const cancelTrade = document.getElementById('cancel-trade');
    const tradeModal = document.getElementById('add-trade-modal');

    // Month filter
    const monthSelect = document.getElementById('month-select');

    if (swingTradeTab) {
      swingTradeTab.addEventListener('click', () => this.switchTab('swing-trade'));
      console.log('✅ Swing trade tab listener added');
    }

    if (dayTradeTab) {
      dayTradeTab.addEventListener('click', () => this.switchTab('day-trade'));
      console.log('✅ Day trade tab listener added');
    }

    if (addTradeBtn) {
      addTradeBtn.addEventListener('click', () => this.showAddTradeModal());
      console.log('✅ Add trade button listener added');
    }

    if (addTradeForm) {
      console.log('🔗 Adding submit listener to form:', addTradeForm);
      addTradeForm.addEventListener('submit', (e) => {
        console.log('🚀 Form submitted, calling handleAddTrade');
        this.handleAddTrade(e);
      });
      console.log('✅ Add trade form listener added');
    } else {
      console.error('❌ Add trade form not found!');
    }

    if (closeTradeModal) {
      closeTradeModal.addEventListener('click', () => this.hideAddTradeModal());
      console.log('✅ Close trade modal listener added');
    }

    if (cancelTrade) {
      cancelTrade.addEventListener('click', () => this.hideAddTradeModal());
      console.log('✅ Cancel trade listener added');
    }

    if (tradeModal) {
      tradeModal.addEventListener('click', (e) => {
        if (e.target === tradeModal) {
          this.hideAddTradeModal();
        }
      });
      console.log('✅ Trade modal click listener added');
    }

    if (monthSelect) {
      monthSelect.value = this.currentMonth;
      monthSelect.addEventListener('change', (e) => this.filterByMonth(e.target.value));
      console.log('✅ Month select listener added');
    }

    // Set default date to today
    const tradeDateInput = document.getElementById('trade-date');
    if (tradeDateInput) {
      tradeDateInput.valueAsDate = new Date();
    }

    // Load trades automatically if day trade tab is already active
    setTimeout(() => {
      const dayTradeTab = document.getElementById('day-trade-tab');
      if (dayTradeTab && dayTradeTab.classList.contains('active')) {
        console.log('🔄 Day trade tab is active, loading trades automatically...');
        this.loadDayTrades();
      }
    }, 1000);
  }

  switchTab(tab) {
    console.log(`🔄 Switching to ${tab} tab`);

    const swingTradeTab = document.getElementById('swing-trade-tab');
    const dayTradeTab = document.getElementById('day-trade-tab');
    const swingTradeContent = document.getElementById('swing-trade-content');
    const dayTradeContent = document.getElementById('day-trade-content');

    if (tab === 'swing-trade') {
      swingTradeTab.classList.add('active');
      dayTradeTab.classList.remove('active');
      swingTradeContent.classList.remove('hidden');
      dayTradeContent.classList.add('hidden');
    } else if (tab === 'day-trade') {
      dayTradeTab.classList.add('active');
      swingTradeTab.classList.remove('active');
      dayTradeContent.classList.remove('hidden');
      swingTradeContent.classList.add('hidden');

      // Load day trades when switching to day trade tab
      console.log('🔄 Switching to day trade tab, loading trades...');
      this.loadDayTrades();
    }
  }

  showAddTradeModal() {
    const modal = document.getElementById('add-trade-modal');
    modal.classList.remove('hidden');
    document.getElementById('trade-symbol').focus();
  }

  hideAddTradeModal() {
    const modal = document.getElementById('add-trade-modal');
    modal.classList.add('hidden');
    document.getElementById('add-trade-form').reset();

    const tradeDateInput = document.getElementById('trade-date');
    if (tradeDateInput) {
      tradeDateInput.valueAsDate = new Date();
    }
  }

  async handleAddTrade(e) {
    e.preventDefault();
    console.log('📈 Adding day trade...');

    const tradeDateEl = document.getElementById('trade-date');
    const symbolEl = document.getElementById('trade-symbol');
    const operationEl = document.getElementById('trade-operation');
    const resultEl = document.getElementById('trade-result');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    console.log('📋 Form elements found:', { tradeDateEl, symbolEl, operationEl, resultEl });

    if (!tradeDateEl || !symbolEl || !operationEl || !resultEl) {
      console.error('❌ Missing form elements!');
      this.showMessage('Erro: Formulário incompleto', 'error');
      return;
    }

    const tradeDate = tradeDateEl.value;
    const symbol = symbolEl.value.toUpperCase();
    const operation = operationEl.value;
    const result = parseFloat(resultEl.value);

    console.log('📊 Trade data:', { tradeDate, symbol, operation, result });

    if (!tradeDate || !symbol || !operation || isNaN(result)) {
      console.error('❌ Invalid form data:', { tradeDate, symbol, operation, result });
      this.showMessage('Por favor, preencha todos os campos corretamente', 'error');
      return;
    }

    try {
      this.setTradeButtonLoading(submitBtn, true);

      const user = authManager.getCurrentUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const tradeData = {
        userId: user.uid,
        tradeDate: tradeDate,
        symbol: symbol,
        operation: operation,
        result: result,
        createdAt: new Date().toISOString(),
        type: 'day-trade'
      };

      console.log('💾 Saving trade data to Firestore:', tradeData);
      console.log('🔗 Database connection:', db);

      const docRef = await addDoc(collection(db, 'day-trades'), tradeData);
      console.log('✅ Trade saved successfully with ID:', docRef.id);

      this.hideAddTradeModal();
      this.showMessage(`Trade de ${symbol} adicionado com sucesso!`, 'success');
      await this.loadDayTrades();

    } catch (error) {
      console.error('❌ Error adding trade:', error);
      this.showMessage('Erro ao adicionar trade: ' + error.message, 'error');
    } finally {
      this.setTradeButtonLoading(submitBtn, false);
    }
  }

  async loadDayTrades() {
    const user = authManager.getCurrentUser();
    console.log('📊 Loading day trades for user:', user?.uid, 'month:', this.currentMonth);

    if (!user) return;

    try {
      this.setLoading(true);

      // Se não há mês selecionado, use o mês atual
      if (!this.currentMonth) {
        this.currentMonth = new Date().toISOString().slice(0, 7);
        const monthSelect = document.getElementById('month-select');
        if (monthSelect) {
          monthSelect.value = this.currentMonth;
        }
      }

      const startDate = this.currentMonth + '-01';
      const endDate = this.getEndOfMonth(this.currentMonth);

      console.log('📅 Date range:', { startDate, endDate });

      // Primeira tentativa: query com filtros de data
      let q = query(
        collection(db, 'day-trades'),
        where('userId', '==', user.uid)
      );

      console.log('🔍 Executing query...');
      const querySnapshot = await getDocs(q);
      this.trades = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('📄 Trade found:', doc.id, data);

        // Extrair ano e mês da data do trade para comparação
        const tradeYear = data.tradeDate.slice(0, 4);
        const tradeMonth = data.tradeDate.slice(5, 7);
        const tradeYearMonth = `${tradeYear}-${tradeMonth}`;

        const currentYearMonth = this.currentMonth;

        console.log('📅 Date comparison:', {
          tradeDate: data.tradeDate,
          tradeYearMonth,
          currentYearMonth,
          matches: tradeYearMonth === currentYearMonth
        });

        // Comparar apenas ano e mês
        if (tradeYearMonth === currentYearMonth) {
          this.trades.push({
            id: doc.id,
            ...data
          });
          console.log('✅ Trade included (same month)');
        } else {
          console.log('⏭️ Trade skipped (different month):', tradeYearMonth, 'vs', currentYearMonth);
        }
      });

      console.log('✅ Day trades loaded:', this.trades.length, 'trades for month', this.currentMonth);
      this.renderTrades();
      this.updateDayTradeStats();

    } catch (error) {
      console.error('❌ Error loading day trades:', error);
      console.error('Error details:', error.code, error.message);

      // Se houver erro na query com data, tente sem filtro de data
      try {
        console.log('🔄 Retrying without date filter...');
        const simpleQuery = query(
          collection(db, 'day-trades'),
          where('userId', '==', user.uid)
        );

        const snapshot = await getDocs(simpleQuery);
        this.trades = [];

        snapshot.forEach((doc) => {
          this.trades.push({
            id: doc.id,
            ...doc.data()
          });
        });

        console.log('✅ Fallback query successful:', this.trades.length, 'trades');
        this.renderTrades();
        this.updateDayTradeStats();

      } catch (fallbackError) {
        console.error('❌ Fallback query failed:', fallbackError);
        this.showMessage('Erro ao carregar trades: ' + fallbackError.message, 'error');
      }
    } finally {
      this.setLoading(false);
    }
  }

  getEndOfMonth(monthString) {
    const date = new Date(monthString + '-01');
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return nextMonth.toISOString().slice(0, 10);
  }

  filterByMonth(month) {
    this.currentMonth = month;
    console.log('📅 Filtering by month:', month);
    this.loadDayTrades();
  }

  renderTrades() {
    console.log('🎨 Rendering trades table...', this.trades.length, 'trades');
    const tableBody = document.getElementById('trades-table-body');

    if (!tableBody) {
      console.error('❌ Table body not found!');
      return;
    }

    if (this.trades.length === 0) {
      console.log('📭 No trades to display');
      tableBody.innerHTML = '<tr><td colspan="5" class="loading-message">Nenhum trade encontrado para este período</td></tr>';
      return;
    }

    // Sort trades by date (newest first)
    const sortedTrades = this.trades.sort((a, b) => new Date(b.tradeDate) - new Date(a.tradeDate));
    console.log('📊 Sorted trades:', sortedTrades);

    tableBody.innerHTML = sortedTrades.map(trade => {
      const resultClass = trade.result >= 0 ? 'trade-positive' : 'trade-negative';
      const resultPrefix = trade.result >= 0 ? '+' : '';

      console.log('🏷️ Rendering trade:', trade.symbol, trade.result);

      return `
        <tr>
          <td>${this.formatDate(trade.tradeDate)}</td>
          <td>${trade.symbol}</td>
          <td><span class="trade-operation ${trade.operation}">${trade.operation}</span></td>
          <td class="${resultClass}">${resultPrefix}${stockAPI.formatPrice(trade.result)}</td>
          <td>
            <button class="btn-secondary btn-small" onclick="dayTradeManager.removeTrade('${trade.id}')">
              Remover
            </button>
          </td>
        </tr>
      `;
    }).join('');

    console.log('✅ Table rendered successfully');
  }

  updateDayTradeStats() {
    console.log('📈 Updating day trade statistics...', this.trades.length, 'trades');
    let totalPnL = 0;
    let totalTrades = this.trades.length;
    let winningTrades = 0;

    this.trades.forEach(trade => {
      totalPnL += trade.result;
      if (trade.result > 0) {
        winningTrades++;
      }
      console.log('💰 Processing trade result:', trade.result);
    });

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    console.log('📊 Calculated stats:', { totalPnL, totalTrades, winningTrades, winRate });

    // Update stat cards
    const pnlElement = document.getElementById('day-trade-pnl');
    const opsElement = document.getElementById('day-trade-ops');
    const winrateElement = document.getElementById('day-trade-winrate');
    const monthElement = document.getElementById('month-result');

    if (pnlElement) pnlElement.textContent = stockAPI.formatPrice(totalPnL);
    if (opsElement) opsElement.textContent = totalTrades.toString();
    if (winrateElement) winrateElement.textContent = winRate.toFixed(1) + '%';
    if (monthElement) monthElement.textContent = stockAPI.formatPrice(totalPnL);

    console.log('✅ Stats cards updated');

    // Update card styling based on positive/negative
    const pnlCard = document.getElementById('day-trade-pnl').closest('.stat-card');
    const monthCard = document.getElementById('month-result').closest('.stat-card');

    if (pnlCard) {
      pnlCard.className = `stat-card ${totalPnL >= 0 ? 'positive' : 'negative'}`;
    }

    if (monthCard) {
      monthCard.className = `stat-card ${totalPnL >= 0 ? 'positive' : 'negative'}`;
    }

    // Update win rate card
    const winRateCard = document.getElementById('day-trade-winrate').closest('.stat-card');
    if (winRateCard) {
      winRateCard.className = `stat-card ${winRate >= 50 ? 'positive' : 'negative'}`;
    }
  }

  async removeTrade(tradeId) {
    if (!confirm('Deseja remover este trade?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'day-trades', tradeId));
      this.showMessage('Trade removido com sucesso!', 'success');
      await this.loadDayTrades();
    } catch (error) {
      console.error('Error removing trade:', error);
      this.showMessage('Erro ao remover trade', 'error');
    }
  }

  formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  }

  setLoading(loading) {
    this.isLoading = loading;
    const tableBody = document.getElementById('trades-table-body');

    if (loading) {
      tableBody.innerHTML = '<tr><td colspan="5" class="loading-message">Carregando trades...</td></tr>';
    }
  }

  setTradeButtonLoading(button, loading) {
    if (loading) {
      button.disabled = true;
      button.textContent = 'Adicionando...';
      button.classList.add('loading');
    } else {
      button.disabled = false;
      button.textContent = 'Adicionar Trade';
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
}

// Make it globally available
window.dayTradeManager = new DayTradeManager();
export default window.dayTradeManager;