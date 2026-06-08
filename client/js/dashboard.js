let spendingChart = null;
let categoryChart = null;
let comparisonChart = null;

// Premium Numeric Count-Up Animation
function animateValue(id, targetValue, duration = 800) {
  const el = document.getElementById(id);
  if (!el) return;
  
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const start = 0;
  const end = parseFloat(targetValue) || 0;
  if (end === 0) {
    el.textContent = formatter.format(0);
    return;
  }
  
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    // Easing outQuad: f(t) = t*(2-t)
    const easedProgress = progress * (2 - progress);
    const current = easedProgress * (end - start) + start;
    el.textContent = formatter.format(current);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

// Global Keyboard Shortcuts for Dashboard
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('add-transaction-modal');
    
    // Alt + N: Open Quick Add Modal
    if (e.altKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      const openBtn = document.getElementById('open-add-transaction-modal');
      if (openBtn) openBtn.click();
    }
    
    // Esc: Close Modal
    if (e.key === 'Escape') {
      if (modal && modal.classList.contains('show')) {
        const closeBtn = document.getElementById('close-add-transaction-modal') || document.getElementById('cancel-add-transaction');
        if (closeBtn) closeBtn.click();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize general app shell utilities (auth check, theme toggle, logoutBtn, etc)
  initAppShell();

  // Configure premium defaults for Chart.js
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#94A3B8';
    Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
    Chart.defaults.font.size = 11;
  }

  // Set header date
  const dateEl = document.getElementById('dashboard-date');
  if (dateEl) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('en-US', options);
  }

  // Populate user name in welcome heading with dynamic time-of-day greeting
  const welcomeEl = document.getElementById('welcome-message');
  const user = getUser();
  if (welcomeEl && user) {
    const hour = new Date().getHours();
    let greeting = 'Hello';
    if (hour >= 5 && hour < 12) greeting = 'Good morning';
    else if (hour >= 12 && hour < 18) greeting = 'Good afternoon';
    else if (hour >= 18 && hour < 22) greeting = 'Good evening';
    else greeting = 'Good night';
    
    welcomeEl.textContent = `${greeting}, ${user.name}`;
  }

  // Setup Keyboard Shortcuts
  setupKeyboardShortcuts();

  // Setup interval selector change listener
  const intervalSelect = document.getElementById('spending-interval-select');
  if (intervalSelect) {
    intervalSelect.addEventListener('change', async (e) => {
      await renderSpendingDistribution(e.target.value);
    });
  }

  // Load dashboard data
  await refreshDashboard();

  // Setup Add Transaction Modal events
  setupModal();
});

// Show skeleton shimmers for metrics, lists, and charts
function showSkeletons() {
  const metricValues = ['total-balance', 'total-income', 'total-expenses', 'monthly-budget'];
  metricValues.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = `<span class="skeleton" style="display: inline-block; width: 80px; height: 1.75rem;"></span>`;
    }
  });

  const recentList = document.getElementById('recent-transactions-list');
  if (recentList) {
    recentList.innerHTML = Array(3).fill(0).map(() => `
      <div class="transaction-row-item skeleton" style="height: 58px; border: none;"></div>
    `).join('');
  }

  const trendCanvas = document.getElementById('spendingTrendChart');
  const catCanvas = document.getElementById('categoryBreakdownChart');
  const compCanvas = document.getElementById('monthlyComparisonChart');

  [trendCanvas, catCanvas, compCanvas].forEach(canvas => {
    if (canvas) {
      canvas.style.display = 'none';
      let skeleton = canvas.parentElement.querySelector('.skeleton-chart');
      if (!skeleton) {
        skeleton = document.createElement('div');
        skeleton.className = 'skeleton skeleton-chart';
        canvas.parentElement.appendChild(skeleton);
      } else {
        skeleton.style.display = 'block';
      }
      // Hide any existing empty states
      const empty = canvas.parentElement.querySelector('.empty-state');
      if (empty) empty.style.display = 'none';
    }
  });
}

function hideChartSkeletons() {
  const trendCanvas = document.getElementById('spendingTrendChart');
  const catCanvas = document.getElementById('categoryBreakdownChart');
  const compCanvas = document.getElementById('monthlyComparisonChart');

  [trendCanvas, catCanvas, compCanvas].forEach(canvas => {
    if (canvas) {
      const skeleton = canvas.parentElement.querySelector('.skeleton-chart');
      if (skeleton) {
        skeleton.style.display = 'none';
      }
    }
  });
}

// Refresh all dashboard metrics, recent transactions and charts
async function refreshDashboard() {
  showSkeletons();
  try {
    // Small artificial delay for shimmer visual effectiveness
    await new Promise(resolve => setTimeout(resolve, 400));

    // 1. Get Summary metrics and Recent Transactions
    const summaryData = await API.getSummary();
    updateMetrics(summaryData.summary);
    renderRecentTransactions(summaryData.recentTransactions);

    // 2. Render category budgets status list
    await renderCategoryBudgets();

    // 3. Load and render charts
    const intervalSelect = document.getElementById('spending-interval-select');
    const interval = intervalSelect ? intervalSelect.value : 'day';
    await renderSpendingDistribution(interval);
    await renderCategoryBreakdown();
    await renderMonthlyComparison();

  } catch (err) {
    showToast(err.message || 'Failed to load dashboard metrics.', 'error');
  } finally {
    hideChartSkeletons();
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
  const budgetCard = document.querySelector('.metric-card.budget');

  if (balanceEl) animateValue('total-balance', metrics.totalBalance);
  if (incomeEl) animateValue('total-income', metrics.totalIncome);
  if (expenseEl) animateValue('total-expenses', metrics.totalExpenses);
  if (budgetValEl) animateValue('monthly-budget', metrics.monthlyBudget);

  if (progressBarEl && budgetFooterEl) {
    if (metrics.monthlyBudget > 0) {
      const progressPercent = Math.min(metrics.budgetProgress, 100);
      progressBarEl.style.width = `${progressPercent}%`;
      
      // Visual indicators based on budget consumption
      if (metrics.budgetProgress >= 100) {
        progressBarEl.style.background = 'linear-gradient(90deg, var(--danger), #e11d48)';
        budgetFooterEl.innerHTML = `<span style="color: var(--danger); font-weight: 700;">⚠ Budget exceeded by ${formatCurrency(metrics.monthlyExpenses - metrics.monthlyBudget)}!</span>`;
        if (budgetCard) budgetCard.classList.add('warning-pulse');
        // Alert trigger
        showToast('Spending limit reached! You have exceeded your monthly budget.', 'error');
      } else if (metrics.budgetProgress >= 80) {
        progressBarEl.style.background = 'linear-gradient(90deg, var(--warning), #d97706)';
        budgetFooterEl.innerHTML = `<span style="color: var(--warning); font-weight: 600;">⚠ Alert: Used ${metrics.budgetProgress.toFixed(0)}% of budget</span>`;
        if (budgetCard) budgetCard.classList.add('warning-pulse');
      } else {
        progressBarEl.style.background = 'linear-gradient(90deg, var(--success), #059669)';
        budgetFooterEl.textContent = `${metrics.budgetProgress.toFixed(0)}% of monthly budget consumed`;
        if (budgetCard) budgetCard.classList.remove('warning-pulse');
      }
    } else {
      progressBarEl.style.width = '0%';
      budgetFooterEl.textContent = 'No budget limit set';
      if (budgetCard) budgetCard.classList.remove('warning-pulse');
    }
  }
}

// Render the 5 most recent transactions rows
function renderRecentTransactions(transactions) {
  const container = document.getElementById('recent-transactions-list');
  if (!container) return;

  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2.5rem 1rem;">
        <div class="empty-state-icon">💸</div>
        <div class="empty-state-title">No transactions yet</div>
        <div class="empty-state-subtitle">Your recent cash flows will show up here.</div>
      </div>
    `;
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

// Render Spending Distribution Chart (Bar Chart with multiple intervals)
async function renderSpendingDistribution(interval = 'day') {
  const canvas = document.getElementById('spendingTrendChart');
  if (!canvas) return;

  try {
    const data = await API.getSpendingDistribution(interval);
    const distribution = data.distribution || [];
    
    // Check if empty
    if (distribution.length === 0) {
      canvas.style.display = 'none';
      let empty = canvas.parentElement.querySelector('.empty-state');
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-title">No spending data</div>
          <div class="empty-state-subtitle">Expenses logged during this interval will show up here.</div>
        `;
        canvas.parentElement.appendChild(empty);
      } else {
        empty.innerHTML = `
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-title">No spending data</div>
          <div class="empty-state-subtitle">Expenses logged during this interval will show up here.</div>
        `;
        empty.style.display = 'flex';
      }
      return;
    } else {
      canvas.style.display = 'block';
      const empty = canvas.parentElement.querySelector('.empty-state');
      if (empty) empty.style.display = 'none';
    }

    const labels = distribution.map(d => {
      const parts = d.label.split('-');
      if (parts.length === 3) {
        // YYYY-MM-DD (Day-wise or Week-wise start date)
        const date = new Date(d.label);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); // e.g., "Jun 8"
      } else if (parts.length === 2) {
        // YYYY-MM (Month-wise / 6 months)
        const date = new Date(parts[0], parseInt(parts[1]) - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); // e.g., "Jun 26"
      } else {
        // YYYY (Annual)
        return d.label; // e.g., "2026"
      }
    });

    const amounts = distribution.map(d => d.amount);

    if (spendingChart) {
      spendingChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    
    // Premium Bar gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, '#7C3AED'); // Violet
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0.4)'); // Cyan with opacity

    spendingChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Spending',
          data: amounts,
          backgroundColor: gradient,
          hoverBackgroundColor: '#8B5CF6',
          borderRadius: 6,
          borderWidth: 0,
          maxBarThickness: 32
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: "'Syne', sans-serif", weight: 'bold' },
            bodyFont: { family: "'Inter', sans-serif" },
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              label: function(context) {
                return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.raw);
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
            ticks: {
              callback: function(value) {
                return '$' + value;
              }
            }
          },
          x: {
            grid: { display: false, drawBorder: false }
          }
        }
      }
    });
  } catch (err) {
    console.error('Spending distribution chart rendering error:', err);
  }
}

// Render Expense Breakdown Chart (Doughnut Chart)
async function renderCategoryBreakdown() {
  const canvas = document.getElementById('categoryBreakdownChart');
  if (!canvas) return;

  try {
    const data = await API.getCategoryBreakdown();
    
    // Check if empty
    if (!data.breakdown || data.breakdown.length === 0) {
      canvas.style.display = 'none';
      let empty = canvas.parentElement.querySelector('.empty-state');
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `
          <div class="empty-state-icon">🏷️</div>
          <div class="empty-state-title">No expenses logged</div>
          <div class="empty-state-subtitle">Create transactions of type "expense" to see category breakdown.</div>
        `;
        canvas.parentElement.appendChild(empty);
      } else {
        empty.style.display = 'flex';
      }
      return;
    } else {
      canvas.style.display = 'block';
      const empty = canvas.parentElement.querySelector('.empty-state');
      if (empty) empty.style.display = 'none';
    }

    const categories = data.breakdown.map(d => d.category);
    const amounts = data.breakdown.map(d => d.amount);

    if (categoryChart) {
      categoryChart.destroy();
    }

    const colors = [
      '#7C3AED', // Violet
      '#06B6D4', // Cyan
      '#10B981', // Success (Emerald green)
      '#F43F5E', // Danger (Rose red)
      '#F59E0B', // Amber
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#3B82F6', // Blue
      '#64748B'  // Slate
    ];

    categoryChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: categories,
        datasets: [{
          data: amounts,
          backgroundColor: colors.slice(0, categories.length),
          borderWidth: 2,
          borderColor: 'var(--bg-secondary)', // blend with card background
          hoverBorderColor: 'var(--bg-secondary)',
          spacing: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              padding: 15,
              font: { family: "'Inter', sans-serif" },
              color: 'var(--text-secondary)'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: "'Syne', sans-serif", weight: 'bold' },
            bodyFont: { family: "'Inter', sans-serif" },
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function(context) {
                const value = context.raw;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return ` ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)} (${percentage}%)`;
              }
            }
          }
        },
        cutout: '72%'
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
    
    // Check if empty
    if (!data.comparison || data.comparison.length === 0) {
      canvas.style.display = 'none';
      let empty = canvas.parentElement.querySelector('.empty-state');
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-title">No comparative statistics</div>
          <div class="empty-state-subtitle">Monthly comparisons will be generated once records are logged.</div>
        `;
        canvas.parentElement.appendChild(empty);
      } else {
        empty.style.display = 'flex';
      }
      return;
    } else {
      canvas.style.display = 'block';
      const empty = canvas.parentElement.querySelector('.empty-state');
      if (empty) empty.style.display = 'none';
    }

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
        labels: months,
        datasets: [
          {
            label: 'Income',
            data: income,
            backgroundColor: '#10B981', // --success
            borderRadius: 4,
            maxBarThickness: 20
          },
          {
            label: 'Expense',
            data: expense,
            backgroundColor: '#F43F5E', // --danger
            borderRadius: 4,
            maxBarThickness: 20
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              padding: 15,
              font: { family: "'Inter', sans-serif" },
              color: 'var(--text-secondary)'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: "'Syne', sans-serif", weight: 'bold' },
            bodyFont: { family: "'Inter', sans-serif" },
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function(context) {
                return ` ${context.dataset.label}: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.raw)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
            ticks: {
              callback: function(value) {
                return '$' + value;
              }
            }
          },
          x: {
            grid: { display: false, drawBorder: false }
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

    const submitBtn = document.getElementById('modal-submit-btn') || form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Save Transaction';

    if (submitBtn) {
      submitBtn.classList.add('btn-loading');
      submitBtn.innerHTML = `<span>Saving...</span><span class="btn-spinner"></span>`;
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
    } finally {
      if (submitBtn) {
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = originalBtnText;
      }
    }
  });
}

// Render budgeted categories list and progress bars on the dashboard
async function renderCategoryBudgets() {
  const container = document.getElementById('category-budgets-list');
  if (!container) return;

  try {
    const res = await API.getCategories();
    // Only display categories that have an active budget limit set (> 0)
    const budgetedCategories = res.categories.filter(c => parseFloat(c.budget) > 0);

    if (budgetedCategories.length === 0) {
      container.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 3rem 1rem;">
          No category budgets set.
        </div>
      `;
      return;
    }

    container.innerHTML = budgetedCategories.map(c => {
      const budget = parseFloat(c.budget);
      const spent = parseFloat(c.spent);
      const percent = Math.min((spent / budget) * 100, 100).toFixed(0);
      const isOverspent = spent > budget;
      
      const barColor = isOverspent 
        ? 'linear-gradient(90deg, var(--danger), #e11d48)' 
        : (percent >= 80 ? 'linear-gradient(90deg, var(--warning), #d97706)' : 'linear-gradient(90deg, var(--success), #059669)');

      const color = getColorHash(c.name);

      const statusLabel = isOverspent
        ? `<span style="color: var(--danger); font-weight: bold; font-size: 0.72rem;">⚠ Over limit</span>`
        : `<span style="color: var(--text-muted); font-size: 0.72rem;">${percent}% used</span>`;

      return `
        <div style="display: flex; flex-direction: column; gap: 0.35rem; padding: 0.65rem 0.85rem; border-radius: var(--r-md); background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.4rem; min-width: 0;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${color}; flex-shrink: 0;"></span>
              <span style="font-size: 0.8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary);">${c.name}</span>
            </div>
            ${statusLabel}
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-secondary);">
            <span>$${spent.toFixed(2)} spent</span>
            <span>$${budget.toFixed(2)} budget</span>
          </div>
          <div class="progress-bar-container" style="height: 4px; margin-top: 0.15rem;">
            <div class="progress-bar-fill" style="width: ${percent}%; background: ${barColor}; height: 100%;"></div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load category budgets on dashboard:', err);
    container.innerHTML = `<p style="color: var(--danger); font-size: 0.8rem; text-align: center; padding: 1rem 0;">Error loading budgets.</p>`;
  }
}

// Generate simple hash color based on category name string
function getColorHash(str) {
  if (!str) return 'var(--text-muted)';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}


