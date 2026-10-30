const form = document.querySelector('#authForm');
const errorElement = document.querySelector('#authError');
const tabs = document.querySelectorAll('.auth-tab');
const registerFields = document.querySelectorAll('.register-only');
let mode = 'login';

function getReturnUrl() {
  const next = new URLSearchParams(window.location.search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  const destination = new URL(next, window.location.origin);
  return destination.origin === window.location.origin ? destination.href : null;
}

function setMode(nextMode) {
  mode = nextMode;
  const register = mode === 'register';
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === mode));
  registerFields.forEach((field) => field.classList.toggle('visible', register));
  document.querySelector('#authEyebrow').textContent = register ? 'TÀI KHOẢN MỚI' : 'CHÀO MỪNG TRỞ LẠI';
  document.querySelector('#authTitle').textContent = register ? 'Tạo tài khoản Bếp Xanh' : 'Đăng nhập Bếp Xanh';
  document.querySelector('#authDescription').textContent = register ? 'Tạo tài khoản để dễ dàng theo dõi đơn hàng.' : 'Sử dụng tài khoản của bạn để tiếp tục.';
  document.querySelector('#authSubmit').innerHTML = register ? 'Tạo tài khoản <span>→</span>' : 'Đăng nhập <span>→</span>';
  document.querySelector('[name="password"]').setAttribute('autocomplete', register ? 'new-password' : 'current-password');
  errorElement.textContent = '';
}

async function submitAuth(payload) {
  const response = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to continue');
  localStorage.setItem('testdemo_token', data.token);
  localStorage.setItem('testdemo_user', JSON.stringify(data.user));
  window.location.href = getReturnUrl() ?? (data.user.role === 'admin' ? '/admin' : '/');
}

tabs.forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorElement.textContent = '';
  const formData = Object.fromEntries(new FormData(form));
  if (mode === 'register' && formData.password !== formData.confirmPassword) {
    errorElement.textContent = 'Mật khẩu xác nhận chưa khớp.';
    return;
  }
  try { await submitAuth(formData); } catch (error) { errorElement.textContent = error.message; }
});
setMode('login');
