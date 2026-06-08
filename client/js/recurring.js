document.addEventListener('DOMContentLoaded', () => {
  // Initialize standard app shell (auth, theme, user badge)
  initAppShell();

  // Load categories and recurring list
  loadCategories();
  fetchRecurrings();

  // Setup form submission
  setupForm();

  // Cancel edit button
  const cancelBtn = document.getElementById('cancel-edit-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', clearEditState);
  }
});

let categoriesMap = {};

// Load categories to populate select inputs and translate ids to names
async function loadCategories() {
  const select = document.getElementById('category-input');
  if (!select) return;

  try {
    const res = await API.getCategories();
    const categories = res.categories;

    categories.forEach(c => {
      categoriesMap[c.id] = c.name;
    });

    if (categories.length === 0) {
      select.innerHTML = `<option value="" disabled selected>Please create a category first</option>`;
    } else {
      select.innerHTML = categories.map(c => 
        `<option value="${c.id}">${c.name}</option>`
      ).join('');
    }
  } catch (err) {
    showToast(err.message || 'Failed to load categories.', 'error');
  }
}

// Fetch schedules and render them in the table
async function fetchRecurrings() {
  const tbody = document.getElementById('recurring-table-body');
  if (!tbody) return;

  try {
    const res = await API.getRecurrings();
    const schedules = res.recurringTransactions;

    if (schedules.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 4.5rem 0;">
            No recurring schedules configured yet. Create one on the left!
          </td>
        </tr>
      `;
      return;
    }

    const formatCurrency = (val) => {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    };

    tbody.innerHTML = schedules.map(rt => {
      const nextDue = rt.next_due_date 
        ? new Date(rt.next_due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'N/A';

      const isExpense = rt.type === 'expense';
      const amountClass = isExpense ? 'expense' : 'income';
      const amountPrefix = isExpense ? '-' : '+';

      const freqBadge = `<span style="text-transform: capitalize; padding: 0.2rem 0.4rem; border-radius: var(--r-sm); font-size: 0.72rem; font-weight: 600; background: var(--bg-elevated); border: 1px solid var(--border);">${rt.frequency}</span>`;

      const statusBadge = rt.is_active
        ? `<span class="badge" style="background: var(--success-subtle); color: var(--success); padding: 0.25rem 0.5rem; border-radius: var(--r-sm); font-size: 0.72rem; font-weight: 700; border: 1px solid var(--success-glow);">Active</span>`
        : `<span class="badge" style="background: var(--danger-subtle); color: var(--danger); padding: 0.25rem 0.5rem; border-radius: var(--r-sm); font-size: 0.72rem; font-weight: 700; border: 1px solid var(--danger-glow);">Paused</span>`;

      const toggleBtn = rt.is_active 
        ? `<button class="btn btn-secondary btn-icon-only" style="padding: 0.2rem; font-size: 0.75rem; width: 28px; height: 28px; color: var(--warning);" onclick="toggleRecurringStatus(${rt.id}, false)" title="Pause Schedule">⏸</button>`
        : `<button class="btn btn-secondary btn-icon-only" style="padding: 0.2rem; font-size: 0.75rem; width: 28px; height: 28px; color: var(--success);" onclick="toggleRecurringStatus(${rt.id}, true)" title="Resume Schedule">▶</button>`;

      // Escape string representation for edit trigger safely
      const escapedTitle = rt.title.replace(/'/g, "\\'");
      const escapedNotes = (rt.notes || '').replace(/'/g, "\\'").replace(/\n/g, "\\n");

      return `
        <tr class="transaction-row-item-static" style="border-bottom: 1px solid var(--border); vertical-align: middle;">
          <td style="padding: 1rem 0.75rem; font-weight: 600; font-size: 0.875rem;">${rt.title}</td>
          <td style="padding: 1rem 0.75rem; font-size: 0.85rem; color: var(--text-secondary);">${rt.category_name || 'Uncategorized'}</td>
          <td style="padding: 1rem 0.75rem;">${freqBadge}</td>
          <td style="padding: 1rem 0.75rem; font-family: var(--font-mono); font-weight: 700;" class="${amountClass}">${amountPrefix}${formatCurrency(rt.amount)}</td>
          <td style="padding: 1rem 0.75rem; font-size: 0.85rem; color: var(--text-secondary);">${nextDue}</td>
          <td style="padding: 1rem 0.75rem; text-align: center;">${statusBadge}</td>
          <td style="padding: 1rem 0.75rem; text-align: right;">
            <div style="display: flex; gap: 0.25rem; justify-content: flex-end;">
              ${toggleBtn}
              <button class="btn btn-secondary btn-icon-only" style="padding: 0.2rem; font-size: 0.75rem; width: 28px; height: 28px;" onclick="startEditRecurring(${rt.id}, '${escapedTitle}', ${rt.amount}, '${rt.type}', ${rt.category_id || 'null'}, '${rt.frequency}', '${rt.start_date.split('T')[0]}', '${rt.next_due_date.split('T')[0]}', '${escapedNotes}')" title="Edit Schedule">✏</button>
              <button class="btn btn-secondary btn-icon-only" style="padding: 0.2rem; font-size: 0.75rem; width: 28px; height: 28px; color: var(--danger);" onclick="deleteRecurringSchedule(${rt.id})" title="Delete Schedule">🗑</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast(err.message || 'Failed to fetch recurring schedules.', 'error');
  }
}

// Setup Create / Edit submit action
function setupForm() {
  const form = document.getElementById('recurring-form');
  const startDateInput = document.getElementById('start-date-input');

  if (!form) return;

  // Set default start_date to today
  if (startDateInput) {
    startDateInput.value = new Date().toISOString().split('T')[0];
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('edit-recurring-id').value;
    const title = document.getElementById('title-input').value;
    const amount = document.getElementById('amount-input').value;
    const type = document.getElementById('type-input').value;
    const category_id = document.getElementById('category-input').value;
    const frequency = document.getElementById('frequency-input').value;
    const start_date = document.getElementById('start-date-input').value;
    const notes = document.getElementById('notes-input').value;

    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Save Schedule';

    if (submitBtn) {
      submitBtn.classList.add('btn-loading');
      submitBtn.innerHTML = `<span>Saving...</span><span class="btn-spinner"></span>`;
    }

    try {
      if (id) {
        // Edit mode
        const next_due_date = document.getElementById('next-due-date-input').value;
        await API.updateRecurring(id, { title, amount, type, category_id, frequency, start_date, next_due_date, notes });
        showToast('Recurring schedule updated successfully!', 'success');
      } else {
        // Create mode
        await API.createRecurring({ title, amount, type, category_id, frequency, start_date, notes });
        showToast('Recurring schedule created successfully!', 'success');
      }

      clearEditState();
      fetchRecurrings();
    } catch (err) {
      showToast(err.message || 'Failed to save recurring schedule.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = originalText;
      }
    }
  });
}

// Populates form to edit a schedule
function startEditRecurring(id, title, amount, type, category_id, frequency, start_date, next_due_date, notes) {
  document.getElementById('edit-recurring-id').value = id;
  document.getElementById('title-input').value = title;
  document.getElementById('amount-input').value = amount;
  document.getElementById('type-input').value = type;
  document.getElementById('category-input').value = category_id || '';
  document.getElementById('frequency-input').value = frequency;
  document.getElementById('start-date-input').value = start_date;
  document.getElementById('notes-input').value = notes;

  // Show and populate next due date input
  const nextDueGroup = document.getElementById('next-due-date-group');
  const nextDueInput = document.getElementById('next-due-date-input');
  if (nextDueGroup && nextDueInput) {
    nextDueGroup.style.display = 'block';
    nextDueInput.value = next_due_date;
  }

  // Update layout button labels
  document.getElementById('form-panel-title').textContent = 'Edit Recurring Schedule';
  document.getElementById('cancel-edit-btn').style.display = 'inline-flex';

  // Scroll to form panel
  document.getElementById('recurring-form').scrollIntoView({ behavior: 'smooth' });
}

// Clears edit variables and returns form to add mode
function clearEditState() {
  const form = document.getElementById('recurring-form');
  if (!form) return;

  form.reset();
  document.getElementById('edit-recurring-id').value = '';

  // Hide next due date
  const nextDueGroup = document.getElementById('next-due-date-group');
  if (nextDueGroup) {
    nextDueGroup.style.display = 'none';
  }

  // Load default dates
  document.getElementById('start-date-input').value = new Date().toISOString().split('T')[0];

  document.getElementById('form-panel-title').textContent = 'Add Recurring Schedule';
  document.getElementById('cancel-edit-btn').style.display = 'none';
}

// Deletes a schedule
async function deleteRecurringSchedule(id) {
  if (confirm('Are you sure you want to delete this recurring schedule? This stops future transactions from auto-generating but keeps already generated transactions in your history.')) {
    try {
      await API.deleteRecurring(id);
      showToast('Recurring schedule deleted successfully.', 'success');
      fetchRecurrings();
    } catch (err) {
      showToast(err.message || 'Failed to delete schedule.', 'error');
    }
  }
}

// Pauses or resumes a schedule
async function toggleRecurringStatus(id, resume) {
  try {
    await API.toggleRecurring(id, resume);
    showToast(resume ? 'Schedule resumed successfully.' : 'Schedule paused successfully.', 'success');
    fetchRecurrings();
  } catch (err) {
    showToast(err.message || 'Failed to toggle status.', 'error');
  }
}

// Make globally accessible
window.toggleRecurringStatus = toggleRecurringStatus;
window.startEditRecurring = startEditRecurring;
window.deleteRecurringSchedule = deleteRecurringSchedule;
window.getColorHash = (str) => {
  if (!str) return 'var(--text-muted)';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};
