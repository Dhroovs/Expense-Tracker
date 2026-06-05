document.addEventListener('DOMContentLoaded', () => {
  // Check if user is already authenticated
  checkAuthOnPage();

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  // Handle Login Form Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerHTML : 'Log In';

      if (submitBtn) {
        submitBtn.classList.add('btn-loading');
        submitBtn.innerHTML = `<span>Logging In...</span><span class="btn-spinner"></span>`;
      }

      try {
        const data = await API.login(email, password);
        setToken(data.token);
        setUser(data.user);
        
        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = '/pages/dashboard.html';
        }, 1000);
      } catch (err) {
        showToast(err.message || 'Login failed. Please try again.', 'error');
      } finally {
        // Only remove loading if we aren't redirecting (or keeping it clean)
        if (submitBtn) {
          setTimeout(() => {
            submitBtn.classList.remove('btn-loading');
            submitBtn.innerHTML = originalText;
          }, 1000);
        }
      }
    });
  }

  // Handle Registration Form Submission
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      const submitBtn = registerForm.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerHTML : 'Register';

      if (submitBtn) {
        submitBtn.classList.add('btn-loading');
        submitBtn.innerHTML = `<span>Creating Account...</span><span class="btn-spinner"></span>`;
      }

      try {
        const data = await API.register(name, email, password);
        setToken(data.token);
        setUser(data.user);
        
        showToast('Registration successful! Seeding categories...', 'success');
        setTimeout(() => {
          window.location.href = '/pages/dashboard.html';
        }, 1000);
      } catch (err) {
        showToast(err.message || 'Registration failed. Please try again.', 'error');
      } finally {
        if (submitBtn) {
          setTimeout(() => {
            submitBtn.classList.remove('btn-loading');
            submitBtn.innerHTML = originalText;
          }, 1000);
        }
      }
    });
  }
});
