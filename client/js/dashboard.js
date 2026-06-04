let spendingChart = null;
let categoryChart = null;
let comparisonChart = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize general app shell utilities (auth check, theme toggle, logoutBtn, etc)
  initAppShell();

  // Set header date
  const dateEl = document.getElementById('dashboard-date');
  if (dateEl) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('en-US', options);
  }

  // Populate user name in welcome heading
  const welcomeEl = document.getElementById('welcome-message');
  const user = getUser();
  if (welcomeEl && user) {
    welcomeEl.textContent = `Hello, ${user.name}`;
  }

  // Load dashboard data
  await refreshDashboard();

  // Setup Add Transaction Modal events
  setupModal();
});

// Refresh all dashboard metrics, recent transactions and charts
async function refreshDashboard() {
  try {
    // 1. Get Summary metrics and Recent Transactions
    const summaryData = await API.getSummary();
    updateMetrics(summaryData.summary);
    renderRecentTransactions(summaryData.recentTransactions);

    // 2. Load and render charts
    await renderSpendingTrend();
    await renderCategoryBreakdown();
    await renderMonthlyComparison();

  } catch (err) {
    showToast(err.message || 'Failed to load dashboard metrics.', 'error');
  }
}

// Update Dashboard numeric cards
function updateMetrics(metrics) {
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const balanceEl = document.getElementById('total-balance');
  const incomeEl = document.getElementById('total-income');
  const expenseEl = document.getElementById('total-expenses');
  const budgetValEl = document.getElementById('monthly-budget');
  const progressBarEl = document.getElementById('budget-progress-bar');
  const budgetFooterEl = document.getElementById('budget-footer-text');

  if (balanceEl) balanceEl.textContent = formatCurrency(metrics.totalBalance);
  if (incomeEl) incomeEl.textContent = formatCurrency(metrics.totalIncome);
  if (expenseEl) expenseEl.textContent = formatCurrency(metrics.totalExpenses);
  
  if (budgetValEl) {
    budgetValEl.textContent = formatCurrency(metrics.monthlyBudget);
  }

  if (progressBarEl && budgetFooterEl) {
    if (metrics.monthlyBudget > 0) {
      const progressPercent = Math.min(metrics.budgetProgress, 100);
      progressBarEl.style.width = `${progressPercent}%`;
      
      // Visual indicators based on budget consumption
      if (metrics.budgetProgress >= 100) {
        progressBarEl.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
        budgetFooterEl.innerHTML = `<span style="color: var(--error); font-weight: 700;">⚠ Budget exceeded by ${formatCurrency(metrics.monthlyExpenses - metrics.monthlyBudget)}!</span>`;
        // Alert trigger
        showToast('Spending limit reached! You have exceeded your monthly budget.', 'error');
      } else if (metrics.budgetProgress >= 80) {
        progressBarEl.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
        budgetFooterEl.innerHTML = `<span style="color: var(--warning); font-weight: 600;">⚠ Alert: Used ${metrics.budgetProgress.toFixed(0)}% of budget</span>`;
      } else {
        progressBarEl.style.background = 'linear-gradient(90deg, var(--success), #059669)';
        budgetFooterEl.textContent = `${metrics.budgetProgress.toFixed(0)}% of monthly budget consumed`;
      }
    } else {
      progressBarEl.style.width = '0%';
      budgetFooterEl.textContent = 'No budget limit set';
    }
  }
}

// Render the 5 most recent transactions rows
function renderRecentTransactions(transactions) {
  const container = document.getElementById('recent-transactions-list');
  if (!container) return;

  if (transactions.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 2rem 0;">No recent transactions found.</p>`;
    return;
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  container.innerHTML = transactions.map(t => {
    const dateFormatted = new Date(t.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const isIncome = t.type === 'income';
    const classIcon = isIncome ? 'income-icon' : 'expense-icon';
    const symbolIcon = isIncome ? '↑' : '↓';
    const amountClass = isIncome ? 'income' : 'expense';
    const amountPrefix = isIncome ? '+' : '-';

    return `
      <div class="transaction-row-item">
        <div class="row-item-left">
          <div class="row-item-icon ${classIcon}">
            ${symbolIcon}
          </div>
          <div class="row-item-details">
            <span class="row-item-title">${t.title}</span>
            <span class="row-item-meta">${t.category_name || 'Uncategorized'} • ${dateFormatted}</span>
          </div>
        </div>
        <div class="row-item-right">
          <span class="row-item-amount ${amountClass}">${amountPrefix}${formatCurrency(t.amount)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Render Daily Spending Trend Chart (Line Chart)
async function renderSpendingTrend() {
  const canvas = document.getElementById('spendingTrendChart');
  if (!canvas) return;

  try {
    const data = await API.getSpendingTrend();
    const dates = data.trend.map(d => {
      const parts = d.date.split('-');
      return `${parts[1]}/${parts[2]}`; // MM/DD
    });
    const amounts = data.trend.map(d => d.amount);

    if (spendingChart) {
      spendingChart.destroy();
    }

    spendingChart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: dates.length > 0 ? dates : ['No Data'],
        datasets: [{
          label: 'Daily Spending',
          data: amounts.length > 0 ? amounts : [0],
          borderColor: '#8a333d',
          backgroundColor: 'rgba(138, 51, 61, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#8a333d'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  } catch (err) {
    console.error('Trend chart error:', err);
  }
}

// Render Expense Breakdown Chart (Doughnut Chart)
async function renderCategoryBreakdown() {
  const canvas = document.getElementById('categoryBreakdownChart');
  if (!canvas) return;

  try {
    const data = await API.getCategoryBreakdown();
    const categories = data.breakdown.map(d => d.category);
    const amounts = data.breakdown.map(d => d.amount);

    if (categoryChart) {
      categoryChart.destroy();
    }

    // Set colors for the breakdown slices
    const colors = [
      '#8a333d', '#c85a49', '#e07a5f', '#d4a373', '#b56576', 
      '#e07a8b', '#6d597a', '#5c3d2e', '#64748b'
    ];

    categoryChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: categories.length > 0 ? categories : ['No Expenses'],
        datasets: [{
          data: amounts.length > 0 ? amounts : [100],
          backgroundColor: amounts.length > 0 ? colors.slice(0, categories.length) : ['rgba(255,255,255,0.05)'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 15 }
          }
        },
        cutout: '70%'
      }
    });
  } catch (err) {
    console.error('Category breakdown chart error:', err);
  }
}

// Render Income vs Expense (Bar Chart)
async function renderMonthlyComparison() {
  const canvas = document.getElementById('monthlyComparisonChart');
  if (!canvas) return;

  try {
    const data = await API.getMonthlyComparison();
    const months = data.comparison.map(d => {
      const parts = d.month.split('-');
      const date = new Date(parts[0], parseInt(parts[1]) - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });
    const income = data.comparison.map(d => d.income);
    const expense = data.comparison.map(d => d.expense);

    if (comparisonChart) {
      comparisonChart.destroy();
    }

    comparisonChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: months.length > 0 ? months : ['No Data'],
        datasets: [
          {
            label: 'Income',
            data: income.length > 0 ? income : [0],
            backgroundColor: '#10b981',
            borderRadius: 6
          },
          {
            label: 'Expense',
            data: expense.length > 0 ? expense : [0],
            backgroundColor: '#ef4444',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  } catch (err) {
    console.error('Monthly comparison chart error:', err);
  }
}

// Modal management for Quick Add Transaction
function setupModal() {
  const modal = document.getElementById('add-transaction-modal');
  const openBtn = document.getElementById('open-add-transaction-modal');
  const closeBtn = document.getElementById('close-add-transaction-modal');
  const cancelBtn = document.getElementById('cancel-add-transaction');
  const form = document.getElementById('add-transaction-form');
  const categorySelect = document.getElementById('modal-category-input');

  if (!modal || !openBtn || !form) return;

  const showModal = async () => {
    // Populate categories select
    try {
      const categoriesResult = await API.getCategories();
      if (categorySelect) {
        if (categoriesResult.categories.length === 0) {
          categorySelect.innerHTML = `<option value="" disabled selected>Please create a category first</option>`;
        } else {
          categorySelect.innerHTML = categoriesResult.categories.map(c => 
            `<option value="${c.id}">${c.name}</option>`
          ).join('');
        }
      }
    } catch (e) {
      showToast('Failed to load categories.', 'error');
    }

    // Set default date to today
    const dateInput = document.getElementById('modal-date-input');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('show');
  };

  const hideModal = () => {
    form.reset();
    modal.classList.remove('show');
  };

  openBtn.addEventListener('click', showModal);
  if (closeBtn) closeBtn.addEventListener('click', hideModal);
  if (cancelBtn) cancelBtn.addEventListener('click', hideModal);

  // Submit Handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('modal-title-input').value;
    const amount = document.getElementById('modal-amount-input').value;
    const type = document.getElementById('modal-type-input').value;
    const category_id = document.getElementById('modal-category-input').value;
    const transaction_date = document.getElementById('modal-date-input').value;
    const notes = document.getElementById('modal-notes-input').value;

    if (!category_id) {
      showToast('Please select a valid category.', 'error');
      return;
    }

    try {
      await API.createTransaction({
        title,
        amount,
        type,
        category_id,
        transaction_date,
        notes
      });

      showToast('Transaction saved successfully!', 'success');
      hideModal();
      // Reload dashboard
      await refreshDashboard();
    } catch (err) {
      showToast(err.message || 'Failed to save transaction.', 'error');
    }
  });
}
