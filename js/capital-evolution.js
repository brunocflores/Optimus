import { db } from './firebase-config.js';
import authManager from './auth.js';
import stockAPI from './stock-api.js';
import {
  collection,
  getDocs,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class CapitalEvolutionManager {
  constructor() {
    this.chart = null;
    this.capitalData = [];
    this.periodMonths = 12; // Default: último ano
    this.initialCapital = 10000; // Capital inicial padrão

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
    } else {
      this.setupEventListeners();
    }
  }

  setupEventListeners() {
    console.log('📈 Setting up capital evolution event listeners...');

    // Tab navigation (will be handled by day-trade.js, but we need to handle our tab)
    const capitalTab = document.getElementById('capital-evolution-tab');
    const periodSelect = document.getElementById('period-select');

    if (capitalTab) {
      capitalTab.addEventListener('click', () => this.switchToCapitalTab());
      console.log('✅ Capital evolution tab listener added');
    }

    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => this.changePeriod(e.target.value));
      console.log('✅ Period select listener added');
    }
  }

  switchToCapitalTab() {
    console.log('🔄 Switching to capital evolution tab');

    // Hide other tabs content
    const swingContent = document.getElementById('swing-trade-content');
    const dayContent = document.getElementById('day-trade-content');
    const capitalContent = document.getElementById('capital-evolution-content');

    // Update tab states
    const swingTab = document.getElementById('swing-trade-tab');
    const dayTab = document.getElementById('day-trade-tab');
    const capitalTab = document.getElementById('capital-evolution-tab');

    if (swingContent) swingContent.classList.add('hidden');
    if (dayContent) dayContent.classList.add('hidden');
    if (capitalContent) capitalContent.classList.remove('hidden');

    if (swingTab) swingTab.classList.remove('active');
    if (dayTab) dayTab.classList.remove('active');
    if (capitalTab) capitalTab.classList.add('active');

    // Load capital evolution data
    this.loadCapitalEvolution();
  }

  changePeriod(period) {
    console.log('📅 Changing period to:', period);

    if (period === 'all') {
      this.periodMonths = null; // Todo período
    } else {
      this.periodMonths = parseInt(period);
    }

    this.loadCapitalEvolution();
  }

  async loadCapitalEvolution() {
    const user = authManager.getCurrentUser();
    console.log('📊 Loading capital evolution for user:', user?.uid);

    if (!user) return;

    try {
      this.showLoading(true);

      // Buscar dados de swing trade (vendas realizadas)
      const swingData = await this.getSwingTradeData(user.uid);

      // Buscar dados de day trade
      const dayTradeData = await this.getDayTradeData(user.uid);

      // Processar dados mensalmente
      this.capitalData = this.processMonthlyData(swingData, dayTradeData);

      console.log('📈 Capital evolution data processed:', this.capitalData);

      // Atualizar gráfico e estatísticas
      this.updateChart();
      this.updateStats();

    } catch (error) {
      console.error('❌ Error loading capital evolution:', error);
      this.showMessage('Erro ao carregar evolução do capital: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async getSwingTradeData(userId) {
    console.log('📊 Loading swing trade data...');

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      where('type', '==', 'sale')
    );

    const querySnapshot = await getDocs(q);
    const data = [];

    querySnapshot.forEach((doc) => {
      const docData = doc.data();
      data.push({
        date: docData.sellDate,
        pnl: docData.realizedPnL || 0,
        type: 'swing'
      });
    });

    console.log('✅ Swing trade data loaded:', data.length, 'transactions');
    return data;
  }

  async getDayTradeData(userId) {
    console.log('📊 Loading day trade data...');

    const q = query(
      collection(db, 'day-trades'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const data = [];

    querySnapshot.forEach((doc) => {
      const docData = doc.data();
      data.push({
        date: docData.tradeDate,
        pnl: docData.result || 0,
        type: 'day'
      });
    });

    console.log('✅ Day trade data loaded:', data.length, 'trades');
    return data;
  }

  processMonthlyData(swingData, dayTradeData) {
    console.log('🔄 Processing monthly data...');

    // Combinar todos os dados
    const allData = [...swingData, ...dayTradeData];

    // Ordenar por data
    allData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Agrupar por mês
    const monthlyData = {};

    allData.forEach(item => {
      const date = new Date(item.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          swingPnL: 0,
          dayPnL: 0,
          totalPnL: 0
        };
      }

      if (item.type === 'swing') {
        monthlyData[monthKey].swingPnL += item.pnl;
      } else {
        monthlyData[monthKey].dayPnL += item.pnl;
      }

      monthlyData[monthKey].totalPnL += item.pnl;
    });

    // Converter para array e calcular capital acumulado
    const monthsArray = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

    // Aplicar filtro de período se especificado
    let filteredMonths = monthsArray;
    if (this.periodMonths) {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - this.periodMonths);
      const cutoffMonth = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}`;

      filteredMonths = monthsArray.filter(item => item.month >= cutoffMonth);
    }

    // Calcular capital acumulado
    let accumulatedCapital = this.initialCapital;

    filteredMonths.forEach((month, index) => {
      accumulatedCapital += month.totalPnL;
      month.accumulatedCapital = accumulatedCapital;
      month.monthlyGrowth = index === 0 ? 0 : ((accumulatedCapital - filteredMonths[index - 1].accumulatedCapital) / filteredMonths[index - 1].accumulatedCapital) * 100;
    });

    console.log('✅ Monthly data processed:', filteredMonths.length, 'months');
    return filteredMonths;
  }

  updateChart() {
    console.log('📊 Updating capital evolution chart...');

    const ctx = document.getElementById('capital-chart');
    if (!ctx) {
      console.error('❌ Chart canvas not found!');
      return;
    }

    // Destruir gráfico existente se houver
    if (this.chart) {
      this.chart.destroy();
    }

    const labels = this.capitalData.map(item => {
      const [year, month] = item.month.split('-');
      return new Date(year, month - 1).toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit'
      });
    });

    const swingData = this.capitalData.map(item => item.swingPnL);
    const dayData = this.capitalData.map(item => item.dayPnL);
    const totalCapitalData = this.capitalData.map(item => item.accumulatedCapital);

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Swing Trade P&L',
            data: swingData,
            borderColor: '#ff007f',
            backgroundColor: 'rgba(255, 0, 127, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.4
          },
          {
            label: 'Day Trade P&L',
            data: dayData,
            borderColor: '#00ffff',
            backgroundColor: 'rgba(0, 255, 255, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.4
          },
          {
            label: 'Capital Total',
            data: totalCapitalData,
            borderColor: '#ffff00',
            backgroundColor: 'rgba(255, 255, 0, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false // Usando nossa própria legenda
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#00ffff',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                const value = context.parsed.y;
                const formatted = new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(value);
                return `${context.dataset.label}: ${formatted}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#cccccc'
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#cccccc',
              callback: function(value) {
                return new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(value);
              }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: {
              drawOnChartArea: false,
            },
            ticks: {
              color: '#ffff00',
              callback: function(value) {
                return new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(value);
              }
            }
          }
        },
        interaction: {
          mode: 'index',
          intersect: false,
        }
      }
    });

    console.log('✅ Chart updated successfully');
  }

  updateStats() {
    console.log('📈 Updating capital evolution stats...');

    const initialCapitalEl = document.getElementById('initial-capital');
    const currentCapitalEl = document.getElementById('current-capital');
    const capitalGrowthEl = document.getElementById('capital-growth');

    if (!this.capitalData.length) {
      if (initialCapitalEl) initialCapitalEl.textContent = stockAPI.formatPrice(this.initialCapital);
      if (currentCapitalEl) currentCapitalEl.textContent = stockAPI.formatPrice(this.initialCapital);
      if (capitalGrowthEl) capitalGrowthEl.textContent = '0%';
      return;
    }

    const currentCapital = this.capitalData[this.capitalData.length - 1]?.accumulatedCapital || this.initialCapital;
    const growth = ((currentCapital - this.initialCapital) / this.initialCapital) * 100;

    if (initialCapitalEl) initialCapitalEl.textContent = stockAPI.formatPrice(this.initialCapital);
    if (currentCapitalEl) {
      currentCapitalEl.textContent = stockAPI.formatPrice(currentCapital);
      currentCapitalEl.className = `stat-value ${currentCapital >= this.initialCapital ? 'trade-positive' : 'trade-negative'}`;
    }
    if (capitalGrowthEl) {
      const growthText = `${growth >= 0 ? '+' : ''}${growth.toFixed(2)}%`;
      capitalGrowthEl.textContent = growthText;
      capitalGrowthEl.className = `stat-value ${growth >= 0 ? 'trade-positive' : 'trade-negative'}`;
    }

    console.log('✅ Stats updated:', { initial: this.initialCapital, current: currentCapital, growth: growth.toFixed(2) + '%' });
  }

  showLoading(loading) {
    const chartContainer = document.querySelector('.chart-container');
    if (!chartContainer) return;

    if (loading) {
      chartContainer.innerHTML = '<div class="loading-message" style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">Carregando evolução do capital...</div>';
    } else {
      chartContainer.innerHTML = '<canvas id="capital-chart"></canvas>';
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
window.capitalEvolutionManager = new CapitalEvolutionManager();
export default window.capitalEvolutionManager;