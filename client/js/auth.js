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
      }
    });
  }
});
