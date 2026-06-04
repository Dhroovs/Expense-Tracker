const API_URL = '/api';

// Authentication token helpers
function getToken() {
  return localStorage.getItem('authToken');
}

function setToken(token) {
  localStorage.setItem('authToken', token);
}

function removeToken() {
  localStorage.removeItem('authToken');
}

function getUser() {
  const user = localStorage.getItem('authUser');
  return user ? JSON.parse(user) : null;
}

function setUser(user) {
  localStorage.setItem('authUser', JSON.stringify(user));
}

function removeUser() {
  localStorage.removeItem('authUser');
}

// Redirect helpers
function redirectToLogin() {
  const currentPath = window.location.pathname;
  if (!currentPath.includes('login.html') && !currentPath.includes('register.html')) {
    window.location.href = '/pages/login.html';
  }
}

function checkAuthOnPage() {
  const token = getToken();
  const currentPath = window.location.pathname;
  const isAuthPage = currentPath.includes('login.html') || currentPath.includes('register.html') || currentPath === '/' || currentPath === '/index.html';

  if (!token && !isAuthPage) {
    redirectToLogin();
  } else if (token && isAuthPage) {
    window.location.href = '/pages/dashboard.html';
  }
}

// Generic Fetch Wrapper
async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        removeToken();
        removeUser();
        redirectToLogin();
      }
      throw new Error(data.error || 'Something went wrong.');
    }

    return data;
  } catch (error) {
    console.error(`API Request Error [${endpoint}]:`, error);
    throw error;
  }
}

// Toast Notifications Helper
function createToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type = 'success') {
  const container = createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '';
  if (type === 'success') {
    icon = '✓';
  } else if (type === 'error') {
    icon = '✗';
  } else {
    icon = 'ℹ';
  }
  
  toast.innerHTML = `
    <span style="font-weight: bold; margin-right: 0.25rem;">${icon}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" style="border: none; background: transparent; color: white; cursor: pointer; font-weight: bold; font-size: 1.1rem; padding: 0 0.25rem;">&times;</button>
  `;
  
  container.appendChild(toast);
  
  // Close handler
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });
  
  // Auto dismiss
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Theme Toggle Helper
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    updateThemeButtonLabel(themeToggle, savedTheme);
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeButtonLabel(themeToggle, newTheme);
    });
  }
}

function updateThemeButtonLabel(btn, theme) {
  if (theme === 'dark') {
    btn.innerHTML = `
      <svg style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24">
        <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 7a5 5 0 100 10 5 5 0 000-10z"></path>
      </svg>
      <span>Light Mode</span>
    `;
  } else {
    btn.innerHTML = `
      <svg style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path>
      </svg>
      <span>Dark Mode</span>
    `;
  }
}

// API Methods Object
const API = {
  // Auth
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getProfile: () => request('/auth/profile'),
  updateProfile: (profileData) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(profileData) }),

  // Categories
  getCategories: () => request('/categories'),
  createCategory: (name) => request('/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  updateCategory: (id, name) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),

  // Transactions
  getTransactions: (filters = {}) => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });
    return request(`/transactions?${params.toString()}`);
  },
  getTransactionById: (id) => request(`/transactions/${id}`),
  createTransaction: (data) => request('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id, data) => request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),

  // Analytics
  getSummary: () => request('/analytics/summary'),
  getCategoryBreakdown: () => request('/analytics/category-breakdown'),
  getMonthlyComparison: () => request('/analytics/monthly-comparison'),
  getSpendingTrend: () => request('/analytics/spending-trend')
};

// Sidebar active link indicator & profile info loader
function initAppShell() {
  checkAuthOnPage();
  initTheme();
  
  // Set user badge details
  const user = getUser();
  if (user) {
    const avatarEl = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-name');
    const emailEl = document.getElementById('user-email');
    
    if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
    if (nameEl) nameEl.textContent = user.name;
    if (emailEl) emailEl.textContent = user.email;
  }

  // Logout handler
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      removeToken();
      removeUser();
      showToast('Logged out successfully.', 'success');
      setTimeout(() => {
        window.location.href = '/pages/login.html';
      }, 500);
    });
  }
}

// Auto check auth on script load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', checkAuthOnPage);
}
