document.addEventListener('DOMContentLoaded', () => {
  // Initialize standard app shell (auth, theme, user badge)
  initAppShell();

  // Load categories
  fetchCategories();

  // Setup form submission for adding a category
  setupAddCategory();

  // Setup edit modal listeners
  setupEditModal();
});

// Fetch categories from backend and render the cards grid
async function fetchCategories() {
  const grid = document.getElementById('category-cards-grid');
  if (!grid) return;

  try {
    const res = await API.getCategories();
    const categories = res.categories;

    if (categories.length === 0) {
      grid.innerHTML = `
        <p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 3rem 0; grid-column: 1 / -1;">
          You don't have any categories yet. Create one on the left!
        </p>
      `;
      return;
    }

    grid.innerHTML = categories.map(c => {
      const color = getColorHash(c.name);
      const budget = parseFloat(c.budget) || 0;
      const spent = parseFloat(c.spent) || 0;
      
      let progressHTML = '';
      let borderGlow = '';
      let warningPulse = '';
      
      if (budget > 0) {
        const percent = Math.min((spent / budget) * 100, 100).toFixed(0);
        const isOverspent = spent > budget;
        const barColor = isOverspent 
          ? 'linear-gradient(90deg, var(--danger), #e11d48)' 
          : (percent >= 80 ? 'linear-gradient(90deg, var(--warning), #d97706)' : 'linear-gradient(90deg, var(--success), #059669)');
        
        const warningLabel = isOverspent 
          ? `<span style="color: var(--danger); font-weight: bold; font-size: 0.72rem; display: flex; align-items: center; gap: 0.15rem; margin-top: 0.35rem;">⚠ Over budget by $${(spent - budget).toFixed(2)}</span>` 
          : `<span style="font-size: 0.72rem; color: var(--text-muted); display: block; margin-top: 0.35rem;">${percent}% consumed</span>`;

        progressHTML = `
          <div class="category-budget-sec" style="margin-top: 0.85rem; width: 100%;">
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 0.35rem;">
              <span style="color: var(--text-secondary); font-weight: 500;">$${spent.toFixed(2)} spent</span>
              <span style="color: var(--text-muted);">Limit: $${budget.toFixed(2)}</span>
            </div>
            <div class="progress-bar-container" style="height: 5px;">
              <div class="progress-bar-fill" style="width: ${percent}%; background: ${barColor}; height: 100%;"></div>
            </div>
            ${warningLabel}
          </div>
        `;
        
        if (isOverspent) {
          borderGlow = 'border-color: rgba(244, 63, 94, 0.4); box-shadow: 0 0 12px rgba(244, 63, 94, 0.15);';
          warningPulse = 'overspent-pulse';
        }
      } else {
        progressHTML = `
          <div class="category-budget-sec" style="margin-top: 0.85rem; width: 100%; font-size: 0.75rem; color: var(--text-muted);">
            No budget limit set
          </div>
        `;
      }

      return `
        <div class="category-card glass-panel ${warningPulse}" style="display: flex; flex-direction: column; align-items: flex-start; padding: 1.25rem; ${borderGlow}">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div class="category-info">
              <span class="category-dot" style="background-color: ${color};"></span>
              <span class="category-card-name" style="font-weight: 600; font-size: 0.95rem;">${c.name}</span>
            </div>
            <div class="actions-cell" style="display: flex; gap: 0.25rem;">
              <button class="btn btn-secondary btn-icon-only" style="padding: 0.2rem; font-size: 0.75rem; width: 28px; height: 28px;" onclick="openCategoryEdit(${c.id}, '${c.name.replace(/'/g, "\\'")}', ${budget})" title="Edit">
                ✏
              </button>
              <button class="btn btn-secondary btn-icon-only" style="padding: 0.2rem; font-size: 0.75rem; width: 28px; height: 28px; color: var(--danger);" onclick="confirmDeleteCategory(${c.id})" title="Delete">
                🗑
              </button>
            </div>
          </div>
          ${progressHTML}
        </div>
      `;
    }).join('');

  } catch (err) {
    showToast(err.message || 'Failed to load categories.', 'error');
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

// Add new category
function setupAddCategory() {
  const form = document.getElementById('create-category-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('new-category-name');
    const budgetInput = document.getElementById('new-category-budget');
    const name = nameInput.value;
    const budget = budgetInput.value || 0;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Create';

    if (submitBtn) {
      submitBtn.classList.add('btn-loading');
      submitBtn.innerHTML = `<span>Creating...</span><span class="btn-spinner"></span>`;
    }

    try {
      await API.createCategory(name, budget);
      showToast('Category created successfully!', 'success');
      nameInput.value = '';
      budgetInput.value = '';
      fetchCategories();
    } catch (err) {
      showToast(err.message || 'Failed to create category.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = originalText;
      }
    }
  });
}

// Modal bindings for category editing
function setupEditModal() {
  const modal = document.getElementById('edit-category-modal');
  const closeBtn = document.getElementById('close-edit-category-modal');
  const cancelBtn = document.getElementById('cancel-edit-category');
  const form = document.getElementById('edit-category-form');

  if (!modal || !form) return;

  const hideModal = () => {
    form.reset();
    modal.classList.remove('show');
  };

  if (closeBtn) closeBtn.addEventListener('click', hideModal);
  if (cancelBtn) cancelBtn.addEventListener('click', hideModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-category-id').value;
    const name = document.getElementById('edit-category-name').value;
    const budget = document.getElementById('edit-category-budget').value || 0;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Save';

    if (submitBtn) {
      submitBtn.classList.add('btn-loading');
      submitBtn.innerHTML = `<span>Saving...</span><span class="btn-spinner"></span>`;
    }

    try {
      await API.updateCategory(id, name, budget);
      showToast('Category updated successfully!', 'success');
      hideModal();
      fetchCategories();
    } catch (err) {
      showToast(err.message || 'Failed to update category.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = originalText;
      }
    }
  });
}

// Row edit click helper (attached globally)
function openCategoryEdit(id, name, budget) {
  const modal = document.getElementById('edit-category-modal');
  if (!modal) return;

  document.getElementById('edit-category-id').value = id;
  document.getElementById('edit-category-name').value = name;
  document.getElementById('edit-category-budget').value = budget || 0;
  modal.classList.add('show');
}

// Deletion confirmation helper (attached globally)
async function confirmDeleteCategory(id) {
  if (confirm('Are you sure you want to delete this category? Any transactions currently using it will be untagged (set to uncategorized).')) {
    try {
      await API.deleteCategory(id);
      showToast('Category deleted successfully.', 'success');
      fetchCategories();
    } catch (err) {
      showToast(err.message || 'Failed to delete category.', 'error');
    }
  }
}

// Bind methods to window to allow button onclick inline triggers to resolve
window.openCategoryEdit = openCategoryEdit;
window.confirmDeleteCategory = confirmDeleteCategory;
