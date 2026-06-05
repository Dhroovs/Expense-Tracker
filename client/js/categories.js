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
      return `
        <div class="category-card glass-panel">
          <div class="category-info">
            <span class="category-dot" style="background-color: ${color};"></span>
            <span class="category-card-name">${c.name}</span>
          </div>
          <div class="actions-cell">
            <button class="btn btn-secondary btn-icon-only" style="padding: 0.2rem; font-size: 0.75rem; width: 30px; height: 30px;" onclick="openCategoryEdit(${c.id}, '${c.name.replace(/'/g, "\\'")}')" title="Edit">
              ✏
            </button>
            <button class="btn btn-secondary btn-icon-only" style="padding: 0.2rem; font-size: 0.75rem; width: 30px; height: 30px; color: var(--error);" onclick="confirmDeleteCategory(${c.id})" title="Delete">
              🗑
            </button>
          </div>
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
    const input = document.getElementById('new-category-name');
    const name = input.value;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Create';

    if (submitBtn) {
      submitBtn.classList.add('btn-loading');
      submitBtn.innerHTML = `<span>Creating...</span><span class="btn-spinner"></span>`;
    }

    try {
      await API.createCategory(name);
      showToast('Category created successfully!', 'success');
      input.value = '';
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

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Save';

    if (submitBtn) {
      submitBtn.classList.add('btn-loading');
      submitBtn.innerHTML = `<span>Saving...</span><span class="btn-spinner"></span>`;
    }

    try {
      await API.updateCategory(id, name);
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
function openCategoryEdit(id, name) {
  const modal = document.getElementById('edit-category-modal');
  if (!modal) return;

  document.getElementById('edit-category-id').value = id;
  document.getElementById('edit-category-name').value = name;
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
