let currentPage = 1;
let totalPages = 1;
let categoriesList = [];

const filters = {
  search: '',
  type: '',
  category_id: '',
  startDate: '',
  endDate: '',
  sortBy: 'transaction_date',
  sortOrder: 'DESC',
  page: 1,
  limit: 10
};

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize standard app shell (auth, theme, user badge)
  initAppShell();

  // Load categories list first (needed for filters and modal)
  await loadCategories();

  // Load transactions list
  await fetchTransactions();

  // Set up filter change listeners
  setupFilters();

  // Set up pagination buttons
  setupPagination();

  // Set up modal behaviors
  setupModal();

  // CSV Export trigger
  const exportBtn = document.getElementById('export-csv-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportCSV);
  }
});

// Fetch categories from database and populate select filters
async function loadCategories() {
  try {
    const res = await API.getCategories();
    categoriesList = res.categories;

    const filterSelect = document.getElementById('category-filter');
    const modalSelect = document.getElementById('category-input');

    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">All Categories</option>' + 
        categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    if (modalSelect) {
      updateModalCategoryOptions();
    }
  } catch (err) {
    showToast('Failed to load categories.', 'error');
  }
}

function updateModalCategoryOptions() {
  const modalSelect = document.getElementById('category-input');
  if (!modalSelect) return;
  
  if (categoriesList.length === 0) {
    modalSelect.innerHTML = `<option value="" disabled selected>Please create a category first</option>`;
  } else {
    modalSelect.innerHTML = categoriesList.map(c => 
      `<option value="${c.id}">${c.name}</option>`
    ).join('');
  }
}

// Fetch transactions from API with filter parameters
async function fetchTransactions() {
  try {
    filters.page = currentPage;
    const res = await API.getTransactions(filters);
    
    renderTable(res.transactions);
    
    if (res.pagination) {
      totalPages = res.pagination.totalPages;
      updatePaginationControls(res.pagination);
    }
  } catch (err) {
    showToast(err.message || 'Failed to fetch transactions.', 'error');
  }
}

// Render data rows in transactions table
function renderTable(transactions) {
  const tbody = document.getElementById('transactions-table-body');
  if (!tbody) return;

  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          No transactions found matching the selected filters.
        </td>
      </tr>
    `;
    return;
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  tbody.innerHTML = transactions.map(t => {
    const isIncome = t.type === 'income';
    const amountClass = isIncome ? 'income' : 'expense';
    const amountPrefix = isIncome ? '+' : '-';
    
    // Format date nicely
    const dateFormatted = new Date(t.transaction_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const notesSnippet = t.notes 
      ? (t.notes.length > 35 ? `<span title="${t.notes}">${t.notes.substring(0, 32)}...</span>` : t.notes) 
      : '<span style="color: var(--text-muted); font-style: italic;">No notes</span>';

    return `
      <tr>
        <td style="font-weight: 600;">${t.title}</td>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 0.5rem;">
            <span class="category-dot" style="background-color: ${getColorHash(t.category_name || '')}; width: 8px; height: 8px;"></span>
            ${t.category_name || 'Uncategorized'}
          </span>
        </td>
        <td>
          <span style="font-weight: 700; font-size: 0.75rem; text-transform: uppercase; color: ${isIncome ? 'var(--success)' : 'var(--error)'}; background: ${isIncome ? 'var(--success-glow)' : 'var(--error-glow)'}; padding: 0.25rem 0.5rem; border-radius: 6px;">
            ${t.type}
          </span>
        </td>
        <td class="row-item-amount ${amountClass}" style="font-weight: 700;">
          ${amountPrefix}${formatCurrency(t.amount)}
        </td>
        <td>${dateFormatted}</td>
        <td style="color: var(--text-secondary); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${notesSnippet}
        </td>
        <td style="text-align: right;">
          <div class="actions-cell">
            <button class="btn btn-secondary btn-icon-only" style="padding: 0.25rem; font-size: 0.8rem;" onclick="openEditModal(${t.id})" title="Edit">
              ✏
            </button>
            <button class="btn btn-secondary btn-icon-only" style="padding: 0.25rem; font-size: 0.8rem; color: var(--error);" onclick="confirmDeleteTransaction(${t.id})" title="Delete">
              🗑
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
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

// Handle pagination updates
function updatePaginationControls(meta) {
  const infoEl = document.getElementById('pagination-info');
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');

  if (infoEl) {
    const start = meta.totalItems === 0 ? 0 : (meta.currentPage - 1) * meta.limit + 1;
    const end = Math.min(meta.currentPage * meta.limit, meta.totalItems);
    infoEl.textContent = `Showing ${start} to ${end} of ${meta.totalItems} entries`;
  }

  if (prevBtn) prevBtn.disabled = meta.currentPage <= 1;
  if (nextBtn) nextBtn.disabled = meta.currentPage >= meta.totalPages;
}

function setupPagination() {
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        fetchTransactions();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        fetchTransactions();
      }
    });
  }
}

// Bind filter change inputs
function setupFilters() {
  const searchInput = document.getElementById('search-input');
  const typeFilter = document.getElementById('type-filter');
  const catFilter = document.getElementById('category-filter');
  const startDate = document.getElementById('start-date');
  const endDate = document.getElementById('end-date');
  const sortBy = document.getElementById('sort-by');
  const sortOrder = document.getElementById('sort-order');

  // Debouncing helper for search input
  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        filters.search = e.target.value;
        currentPage = 1;
        fetchTransactions();
      }, 400);
    });
  }

  if (typeFilter) {
    typeFilter.addEventListener('change', (e) => {
      filters.type = e.target.value;
      currentPage = 1;
      fetchTransactions();
    });
  }

  if (catFilter) {
    catFilter.addEventListener('change', (e) => {
      filters.category_id = e.target.value;
      currentPage = 1;
      fetchTransactions();
    });
  }

  if (startDate) {
    startDate.addEventListener('change', (e) => {
      filters.startDate = e.target.value;
      currentPage = 1;
      fetchTransactions();
    });
  }

  if (endDate) {
    endDate.addEventListener('change', (e) => {
      filters.endDate = e.target.value;
      currentPage = 1;
      fetchTransactions();
    });
  }

  if (sortBy) {
    sortBy.addEventListener('change', (e) => {
      filters.sortBy = e.target.value;
      currentPage = 1;
      fetchTransactions();
    });
  }

  if (sortOrder) {
    sortOrder.addEventListener('change', (e) => {
      filters.sortOrder = e.target.value;
      currentPage = 1;
      fetchTransactions();
    });
  }
}

// Modal management for adding/editing transaction
function setupModal() {
  const modal = document.getElementById('transaction-modal');
  const openBtn = document.getElementById('open-transaction-modal-btn');
  const closeBtn = document.getElementById('close-transaction-modal');
  const cancelBtn = document.getElementById('cancel-transaction');
  const form = document.getElementById('transaction-form');

  if (!modal || !form) return;

  const showAddModal = () => {
    document.getElementById('modal-title').textContent = 'Add Transaction';
    document.getElementById('edit-transaction-id').value = '';
    
    // Reset form fields
    form.reset();
    updateModalCategoryOptions();

    // Default date to today
    document.getElementById('date-input').value = new Date().toISOString().split('T')[0];

    modal.classList.add('show');
  };

  const hideModal = () => {
    form.reset();
    modal.classList.remove('show');
  };

  if (openBtn) openBtn.addEventListener('click', showAddModal);
  if (closeBtn) closeBtn.addEventListener('click', hideModal);
  if (cancelBtn) cancelBtn.addEventListener('click', hideModal);

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('edit-transaction-id').value;
    const title = document.getElementById('title-input').value;
    const amount = document.getElementById('amount-input').value;
    const type = document.getElementById('type-input').value;
    const category_id = document.getElementById('category-input').value;
    const transaction_date = document.getElementById('date-input').value;
    const notes = document.getElementById('notes-input').value;

    if (!category_id) {
      showToast('Please select a valid category.', 'error');
      return;
    }

    const payload = {
      title,
      amount,
      type,
      category_id,
      transaction_date,
      notes
    };

    try {
      if (id) {
        // Edit mode
        await API.updateTransaction(id, payload);
        showToast('Transaction updated successfully!', 'success');
      } else {
        // Add mode
        await API.createTransaction(payload);
        showToast('Transaction added successfully!', 'success');
      }
      
      hideModal();
      fetchTransactions();
    } catch (err) {
      showToast(err.message || 'Failed to save transaction.', 'error');
    }
  });
}

// Global scope triggers for Row action clicks
async function openEditModal(id) {
  const modal = document.getElementById('transaction-modal');
  const form = document.getElementById('transaction-form');
  
  if (!modal || !form) return;

  try {
    const data = await API.getTransactionById(id);
    const t = data.transaction;

    document.getElementById('modal-title').textContent = 'Edit Transaction';
    document.getElementById('edit-transaction-id').value = t.id;
    document.getElementById('title-input').value = t.title;
    document.getElementById('amount-input').value = t.amount;
    document.getElementById('type-input').value = t.type;
    
    // Wait for categories load, then select
    updateModalCategoryOptions();
    document.getElementById('category-input').value = t.category_id;
    
    // Format ISO date to YYYY-MM-DD
    const dateFormatted = new Date(t.transaction_date).toISOString().split('T')[0];
    document.getElementById('date-input').value = dateFormatted;
    document.getElementById('notes-input').value = t.notes || '';

    modal.classList.add('show');
  } catch (err) {
    showToast(err.message || 'Failed to fetch transaction details.', 'error');
  }
}

async function confirmDeleteTransaction(id) {
  if (confirm('Are you sure you want to delete this transaction?')) {
    try {
      await API.deleteTransaction(id);
      showToast('Transaction deleted successfully.', 'success');
      fetchTransactions();
    } catch (err) {
      showToast(err.message || 'Failed to delete transaction.', 'error');
    }
  }
}

// Compile and Download CSV logic
async function exportCSV() {
  try {
    showToast('Preparing CSV file...', 'info');
    // Fetch all transactions without pagination
    const allFilters = { ...filters, limit: 'all' };
    const res = await API.getTransactions(allFilters);
    const txs = res.transactions;

    if (txs.length === 0) {
      showToast('No transaction data to export.', 'warning');
      return;
    }

    // Define CSV Headers
    const headers = ['ID', 'Title', 'Amount', 'Type', 'Category', 'Date', 'Notes', 'Created At'];
    
    // Construct rows
    const rows = txs.map(t => [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      t.amount,
      t.type,
      `"${(t.category_name || 'Uncategorized').replace(/"/g, '""')}"`,
      new Date(t.transaction_date).toISOString().split('T')[0],
      `"${(t.notes || '').replace(/"/g, '""')}"`,
      new Date(t.created_at).toISOString()
    ]);

    // Build file content
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    // Create download blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('CSV downloaded successfully!', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to export CSV.', 'error');
  }
}

// Bind to window to allow button onclick inline triggers to resolve
window.openEditModal = openEditModal;
window.confirmDeleteTransaction = confirmDeleteTransaction;
