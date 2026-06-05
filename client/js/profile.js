document.addEventListener('DOMContentLoaded', () => {
  // Initialize standard app shell (auth, theme, user badge)
  initAppShell();

  // Load user profile details
  loadUserProfile();

  // Bind forms
  setupProfileUpdate();
  setupPasswordChange();
});

// Load user details from API and populate inputs
async function loadUserProfile() {
  try {
    const data = await API.getProfile();
    const u = data.user;

    // Left card labels
    const avatarLarge = document.getElementById('profile-avatar-large');
    const nameTitle = document.getElementById('profile-name-title');
    const emailSubtitle = document.getElementById('profile-email-subtitle');
    const joinedDate = document.getElementById('profile-joined-date');

    if (avatarLarge) avatarLarge.textContent = u.name.charAt(0).toUpperCase();
    if (nameTitle) nameTitle.textContent = u.name;
    if (emailSubtitle) emailSubtitle.textContent = u.email;
    
    if (joinedDate) {
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      joinedDate.textContent = new Date(u.created_at).toLocaleDateString('en-US', options);
    }

    // Forms fields
    const nameInput = document.getElementById('profile-name');
    const emailInput = document.getElementById('profile-email');
    const budgetInput = document.getElementById('profile-budget');

    if (nameInput) nameInput.value = u.name;
    if (emailInput) emailInput.value = u.email;
    if (budgetInput) budgetInput.value = u.monthly_budget || '';

  } catch (err) {
    showToast(err.message || 'Failed to load profile details.', 'error');
  }
}

// Handle Profile Form Submit
function setupProfileUpdate() {
  const form = document.getElementById('update-profile-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('profile-name').value;
    const email = document.getElementById('profile-email').value;
    const monthly_budget = document.getElementById('profile-budget').value || 0;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Save Changes';

    if (submitBtn) {
      submitBtn.classList.add('btn-loading');
      submitBtn.innerHTML = `<span>Saving...</span><span class="btn-spinner"></span>`;
    }

    try {
      const data = await API.updateProfile({
        name,
        email,
        monthly_budget
      });

      // Update storage
      setToken(data.token);
      setUser(data.user);

      // Re-trigger top navbar update labels
      const userBadgeName = document.getElementById('user-name');
      const userBadgeEmail = document.getElementById('user-email');
      const userBadgeAvatar = document.getElementById('user-avatar');
      
      if (userBadgeName) userBadgeName.textContent = data.user.name;
      if (userBadgeEmail) userBadgeEmail.textContent = data.user.email;
      if (userBadgeAvatar) userBadgeAvatar.textContent = data.user.name.charAt(0).toUpperCase();

      // Refresh left side card labels
      const avatarLarge = document.getElementById('profile-avatar-large');
      const nameTitle = document.getElementById('profile-name-title');
      const emailSubtitle = document.getElementById('profile-email-subtitle');

      if (avatarLarge) avatarLarge.textContent = data.user.name.charAt(0).toUpperCase();
      if (nameTitle) nameTitle.textContent = data.user.name;
      if (emailSubtitle) emailSubtitle.textContent = data.user.email;

      showToast('Profile updated successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = originalText;
      }
    }
  });
}

// Handle Password Form Submit
function setupPasswordChange() {
  const form = document.getElementById('change-password-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;

    if (newPassword !== confirmNewPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }

    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters long.', 'error');
      return;
    }

    const name = document.getElementById('profile-name').value;
    const email = document.getElementById('profile-email').value;
    const monthly_budget = document.getElementById('profile-budget').value || 0;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Update Password';

    if (submitBtn) {
      submitBtn.classList.add('btn-loading');
      submitBtn.innerHTML = `<span>Updating...</span><span class="btn-spinner"></span>`;
    }

    try {
      const data = await API.updateProfile({
        name,
        email,
        monthly_budget,
        currentPassword,
        newPassword
      });

      // Update storage
      setToken(data.token);
      setUser(data.user);

      showToast('Password changed successfully!', 'success');
      form.reset();
    } catch (err) {
      showToast(err.message || 'Failed to change password.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = originalText;
      }
    }
  });
}
