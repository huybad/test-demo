const toast = document.querySelector('#toast');
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const labels = { deployment: 'New deployment panel is ready.', pipeline: 'Pipeline queued successfully.', rollback: 'Rollback requires confirmation.' };
    showToast(labels[button.dataset.action]);
  });
});

document.querySelector('#viewLogs').addEventListener('click', () => showToast('Opening live logs for production release #1842.'));
document.querySelector('#filterButton').addEventListener('click', () => showToast('Filters: Production, Staging, Failed'));
document.querySelector('#loadMore').addEventListener('click', (event) => {
  event.currentTarget.innerHTML = 'All activity loaded <span>✓</span>';
  showToast('You are up to date.');
});