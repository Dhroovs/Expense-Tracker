let currentPage = 1;
let totalPages = 1;

const filters = {
  action: '',
  page: 1,
  limit: 10
};

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize standard app shell components (auth check, theme toggle, profile badges, logout)
  initAppShell();

  // Load initial logs list
  await fetchLogs();

  // Set up action filter change listener
  setupFilters();

  // Set up pagination
  setupPagination();
});

// Fetch paginated logs from API
async function fetchLogs() {
  const container = document.getElementById('audit-timeline-container');
  if (container) {
    // Show pulsing skeleton loader items
    container.innerHTML = Array(3).fill(0).map(() => `
      <div class="audit-item skeleton" style="height: 90px; border: none; margin-bottom: 1rem;"></div>
    `).join('');
  }

  try {
    filters.page = currentPage;
    const res = await API.getAuditLogs(filters);
    
    // Simulate minor delay for smooth skeletons transition
    await new Promise(resolve => setTimeout(resolve, 300));
    
    renderTimeline(res.auditLogs);
    
    if (res.pagination) {
      totalPages = res.pagination.totalPages;
      updatePaginationControls(res.pagination);
    }
  } catch (err) {
    showToast(err.message || 'Failed to fetch activity history.', 'error');
  }
}

// Render list of logs
function renderTimeline(logs) {
  const container = document.getElementById('audit-timeline-container');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 4rem 1rem; border: 1px dashed var(--border-color); border-radius: 16px;">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">No activity logs found</div>
        <div class="empty-state-subtitle">Actions performed on transactions will be recorded here.</div>
      </div>
    `;
    return;
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const formatTimestamp = (isoString) => {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  container.innerHTML = logs.map(log => {
    const isIncome = log.type === 'income';
    const amountStr = `${isIncome ? '+' : '-'}${formatCurrency(log.amount)}`;
    const textClass = isIncome ? 'success' : 'error';
    const badgeClass = log.action.toLowerCase();
    
    // Action symbol/label
    let actionLabel = log.action;
    if (log.action === 'CREATE') actionLabel = 'Created';
    else if (log.action === 'UPDATE') actionLabel = 'Updated';
    else if (log.action === 'DELETE') actionLabel = 'Deleted';

    return `
      <div class="audit-item glass-panel">
        <div class="audit-badge ${badgeClass}">${actionLabel}</div>
        <div style="flex: 1; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <span style="font-weight: 700; font-size: 1rem;">${log.title}</span>
            <span style="font-size: 0.85rem; color: var(--text-muted);">${formatTimestamp(log.performed_at)}</span>
          </div>
          
          <div style="display: flex; gap: 1rem; margin-top: 0.25rem; font-size: 0.85rem;">
            <span style="font-weight: 600; color: var(--text-${textClass});">${amountStr}</span>
            <span style="color: var(--text-secondary); text-transform: capitalize;">• Type: ${log.type}</span>
            <span style="color: var(--text-secondary);">• By: ${log.performed_by}</span>
          </div>

          <p class="audit-details-text">${log.details || ''}</p>
        </div>
      </div>
    `;
  }).join('');
}

// Pagination Controls update
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

// Wire change listeners for filters
function setupFilters() {
  const actionFilter = document.getElementById('action-filter');
  const clearBtn = document.getElementById('clear-history-filters-btn');

  if (actionFilter) {
    actionFilter.addEventListener('change', (e) => {
      filters.action = e.target.value;
      currentPage = 1;
      fetchLogs();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (actionFilter) actionFilter.value = '';
      filters.action = '';
      currentPage = 1;
      fetchLogs();
    });
  }
}

// Wire pagination click listeners
function setupPagination() {
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        fetchLogs();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        fetchLogs();
      }
    });
  }
}
