const form = document.querySelector('#authForm');
const errorElement = document.querySelector('#authError');
const tabs = document.querySelectorAll('.auth-tab');
const registerFields = document.querySelectorAll('.register-only');
let mode = 'login';

function setMode(nextMode) {
  mode = nextMode;
  const register = mode === 'register';
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === mode));
  registerFields.forEach((field) => field.classList.toggle('visible', register));
  document.querySelector('#authEyebrow').textContent = register ? 'NEW WORKSPACE' : 'WELCOME BACK';
  document.querySelector('#authTitle').textContent = register ? 'Create your account' : 'Sign in to your workspace';
  document.querySelector('#authDescription').textContent = register ? 'Start managing releases with a new local account.' : 'Use your account to continue to the deployment console.';
  document.querySelector('#authSubmit').innerHTML = register ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
  document.querySelector('[name="password"]').setAttribute('autocomplete', register ? 'new-password' : 'current-password');
  errorElement.textContent = '';
}

async function submitAuth(payload) {
  const response = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to continue');
  localStorage.setItem('duan2_token', data.token);
  localStorage.setItem('duan2_user', JSON.stringify(data.user));
  window.location.href = data.user.role === 'admin' ? '/admin' : '/';
}

tabs.forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorElement.textContent = '';
  const formData = Object.fromEntries(new FormData(form));
  if (mode === 'register' && formData.password !== formData.confirmPassword) {
    errorElement.textContent = 'Passwords do not match.';
    return;
  }
  try { await submitAuth(formData); } catch (error) { errorElement.textContent = error.message; }
});
setMode('login');
