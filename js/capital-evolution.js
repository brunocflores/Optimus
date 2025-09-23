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

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
    } else {
      this.setupEventListeners();
    }
  }

  setupEventListeners() {
    const capitalTab = document.getElementById('capital-evolution-tab');
    const periodSelect = document.getElementById('period-select');

    if (capitalTab) {
      capitalTab.addEventListener('click', () => this.switchToCapitalTab());
      if (capitalTab.classList.contains('active')) {
        setTimeout(() => this.loadCapitalEvolution(), 500);
      }
    }

    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => this.changePeriod(e.target.value));
    }
  }

  switchToCapitalTab() {
    document.getElementById('swing-trade-content').classList.add('hidden');
    document.getElementById('day-trade-content').classList.add('hidden');
    document.getElementById('capital-evolution-content').classList.remove('hidden');

    document.getElementById('swing-trade-tab').classList.remove('active');
    document.getElementById('day-trade-tab').classList.remove('active');
    document.getElementById('capital-evolution-tab').classList.add('active');

    setTimeout(() => this.loadCapitalEvolution(), 100);
  }

  changePeriod(period) {
    this.periodMonths = period === 'all' ? null : parseInt(period);
    this.loadCapitalEvolution();
  }

  async loadCapitalEvolution() {
    const user = authManager.getCurrentUser();
    if (!user) return;

    try {
      this.showLoading(true);
      const swingData = await this.getSwingTradeData(user.uid);
      const dayTradeData = await this.getDayTradeData(user.uid);

      // Use the new weekly processing function
      this.capitalData = this.processWeeklyData(swingData, dayTradeData);

      if (this.capitalData.length === 0) {
        this.capitalData = this.createSampleData(); // Keep sample data for empty state
      }

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
    const q = query(collection(db, 'transactions'), where('userId', '==', userId), where('type', '==', 'sale'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ date: doc.data().sellDate, pnl: doc.data().realizedPnL || 0 }));
  }

  async getDayTradeData(userId) {
    const q = query(collection(db, 'day-trades'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ date: doc.data().tradeDate, pnl: doc.data().result || 0 }));
  }

  processWeeklyData(swingData, dayTradeData) {
    if (typeof window.dateFns === 'undefined') {
        console.error('❌ date-fns library is not loaded. Cannot process weekly data.');
        this.showMessage('Erro: A biblioteca de datas não carregou. Tente recarregar a página.', 'error');
        return []; // Return empty array to prevent crash
    }
    console.log('🔄 Processing weekly data...');
    const allData = [...swingData, ...dayTradeData];
    if (allData.length === 0) return [];

    allData.sort((a, b) => new Date(a.date) - new Date(b.date));

    const weeklyData = {};

    allData.forEach(item => {
      const itemDate = new Date(item.date);
      // Use date-fns to get the start of the week (Sunday as start)
      const weekStart = window.dateFns.startOfWeek(itemDate).toISOString().split('T')[0];

      if (!weeklyData[weekStart]) {
        weeklyData[weekStart] = { week: weekStart, weeklyPnL: 0 };
      }
      weeklyData[weekStart].weeklyPnL += item.pnl;
    });

    const weeksArray = Object.values(weeklyData).sort((a, b) => a.week.localeCompare(b.week));

    let filteredWeeks = weeksArray;
    if (this.periodMonths) {
        const cutoffDate = window.dateFns.subMonths(new Date(), this.periodMonths);
        filteredWeeks = weeksArray.filter(item => new Date(item.week) >= cutoffDate);
    }

    let accumulatedPnL = 0;
    filteredWeeks.forEach(week => {
        accumulatedPnL += week.weeklyPnL;
        week.accumulatedPnL = accumulatedPnL;
    });

    console.log('✅ Weekly data processed:', filteredWeeks.length, 'weeks');
    return filteredWeeks;
  }

  createSampleData() {
    // This can be simplified or removed if not needed, but good for demo
    const sampleData = [];
    let accumulatedPnL = 0;
    for (let i = 24; i >= 0; i--) {
        const weekStart = window.dateFns.format(window.dateFns.subWeeks(new Date(), i), 'yyyy-MM-dd');
        const weeklyPnL = Math.random() * 1500 - 700;
        accumulatedPnL += weeklyPnL;
        sampleData.push({
            week: weekStart,
            weeklyPnL: weeklyPnL,
            accumulatedPnL: accumulatedPnL
        });
    }
    return sampleData;
  }

  isReadyForChart() {
    const capitalContent = document.getElementById('capital-evolution-content');
    const isVisible = capitalContent && !capitalContent.classList.contains('hidden');
    const hasCanvas = !!document.getElementById('capital-chart');
    const hasChartJs = typeof Chart !== 'undefined';
    return isVisible && hasCanvas && hasChartJs;
  }

  updateChart() {
    if (!this.isReadyForChart()) {
      console.log('⏭️ Not ready for chart creation, skipping...');
      return;
    }

    const ctx = document.getElementById('capital-chart').getContext('2d');
    if (this.chart) {
      this.chart.destroy();
    }

    const labels = this.capitalData.map(item => {
        return window.dateFns.format(new Date(item.week), 'dd/MMM/yy');
    });
    const cumulativePnLData = this.capitalData.map(item => item.accumulatedPnL);

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'P&L Acumulado',
            data: cumulativePnLData,
            borderColor: '#00ffff',
            backgroundColor: 'rgba(0, 255, 255, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true, // Can display legend now as it's simpler
            labels: { color: '#cccccc' }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            callbacks: {
              label: (context) => `P&L Acumulado: ${stockAPI.formatPrice(context.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: '#cccccc' }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: {
              color: '#cccccc',
              callback: (value) => stockAPI.formatPrice(value)
            }
          }
        },
        interaction: {
          mode: 'index',
          intersect: false,
        }
      }
    });
    console.log('✅ Chart updated with weekly data.');
  }

  updateStats() {
    const initialCapitalEl = document.getElementById('initial-capital');
    const currentCapitalEl = document.getElementById('current-capital');
    const capitalGrowthEl = document.getElementById('capital-growth');

    const lastPnL = this.capitalData.length > 0 ? this.capitalData[this.capitalData.length - 1].accumulatedPnL : 0;
    const currentCapital = this.initialCapital + lastPnL;
    const growth = this.initialCapital !== 0 ? (lastPnL / this.initialCapital) * 100 : 0;

    if (initialCapitalEl) initialCapitalEl.textContent = stockAPI.formatPrice(this.initialCapital);
    if (currentCapitalEl) {
      currentCapitalEl.textContent = stockAPI.formatPrice(currentCapital);
      currentCapitalEl.className = `stat-value ${currentCapital >= this.initialCapital ? 'trade-positive' : 'trade-negative'}`;
    }
    if (capitalGrowthEl) {
      capitalGrowthEl.textContent = `${growth >= 0 ? '+' : ''}${growth.toFixed(2)}%`;
      capitalGrowthEl.className = `stat-value ${growth >= 0 ? 'trade-positive' : 'trade-negative'}`;
    }
  }

  showLoading(loading) {
    const chartContainer = document.querySelector('.chart-container');
    if (!chartContainer) return;
    const canvas = document.getElementById('capital-chart');
    if (loading) {
        if(canvas) canvas.style.display = 'none';
        chartContainer.innerHTML = '<div class="loading-message">Carregando evolução do capital...</div>' + chartContainer.innerHTML;
    } else {
        const loader = chartContainer.querySelector('.loading-message');
        if(loader) loader.remove();
        if(canvas) canvas.style.display = 'block';
    }
  }

  showMessage(message, type) {
    // ... (UI code for messages)
  }
}

window.capitalEvolutionManager = new CapitalEvolutionManager();
export default window.capitalEvolutionManager;
