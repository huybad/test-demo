const toast = document.querySelector('#toast');
const deploymentsElement = document.querySelector('#adminDeployments');
const logsElement = document.querySelector('#systemLogs');
let currentDeployments = [];
let currentLogs = [];
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

async function request(url, options) {
  const requestOptions = options ?? {};
  requestOptions.headers = { ...(requestOptions.headers ?? {}), Authorization: `Bearer ${localStorage.getItem('duan2_token') ?? ''}` };
  const response = await fetch(url, requestOptions);
  const data = await response.json();
  if (response.status === 401 || response.status === 403) {
    window.location.href = '/auth';
    throw new Error('Please sign in as an admin.');
  }
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function renderDeployments() {
  deploymentsElement.innerHTML = currentDeployments.map((deployment) => `<tr><td><strong>${deployment.release}</strong><small>${deployment.createdAt}</small></td><td><span class="env ${deployment.environment}">●</span> ${deployment.environment}</td><td><code>${deployment.commit}</code></td><td>${deployment.author}</td><td><span class="badge ${deployment.status === 'failed' ? 'failed' : 'success'}">● ${deployment.status}</span></td><td><button class="outline-button rollback-button" data-id="${deployment.id}">Rollback</button></td></tr>`).join('');
  document.querySelectorAll('.rollback-button').forEach((button) => button.addEventListener('click', async () => {
    try { await request(`/api/admin/deployments/${button.dataset.id}/rollback`, { method: 'POST' }); showToast('Rollback queued.'); await loadAdminData(); } catch (error) { showToast(error.message); }
  }));
}

async function loadAdminData() {
  const [overview, deploymentData, logData] = await Promise.all([request('/api/admin/overview'), request('/api/admin/deployments'), request('/api/admin/logs')]);
  currentDeployments = deploymentData.items;
  currentLogs = logData.items;
  document.querySelector('#serviceUptime').textContent = `Uptime ${overview.uptime}`;
  document.querySelector('#deploymentCount').textContent = overview.deployments;
  document.querySelector('#successRate').textContent = overview.successRate;
  document.querySelector('#lastRelease').textContent = overview.lastRelease.release;
  document.querySelector('#lastReleaseTime').textContent = overview.lastRelease.createdAt;
  logsElement.textContent = currentLogs.join('\n');
  renderDeployments();
}

document.querySelector('#deploymentForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try { await request('/api/admin/deployments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); showToast('Deployment queued successfully.'); event.currentTarget.reset(); await loadAdminData(); } catch (error) { showToast(error.message); }
});
document.querySelector('#refreshAdmin').addEventListener('click', () => loadAdminData().then(() => showToast('Admin data refreshed.')));
document.querySelector('#healthCheck').addEventListener('click', async () => { const data = await request('/health'); showToast(`Service is ${data.status}.`); });
document.querySelector('#runPipeline').addEventListener('click', () => showToast('Pipeline queued in debug mode.'));
document.querySelector('#clearLogs').addEventListener('click', () => { logsElement.textContent = 'Logs cleared from view.\n'; showToast('Only the admin view was cleared.'); });
document.querySelector('#copyLogs').addEventListener('click', async () => { await navigator.clipboard.writeText(currentLogs.join('\n')); showToast('Logs copied to clipboard.'); });
document.querySelector('#exportData').addEventListener('click', () => { const blob = new Blob([JSON.stringify({ deployments: currentDeployments, logs: currentLogs }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'duan2-admin-snapshot.json'; link.click(); URL.revokeObjectURL(link.href); showToast('Snapshot downloaded.'); });
document.querySelector('#logoutButton').addEventListener('click', async () => { await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('duan2_token') ?? ''}` } }); localStorage.removeItem('duan2_token'); localStorage.removeItem('duan2_user'); window.location.href = '/auth'; });
const adminUser = JSON.parse(localStorage.getItem('duan2_user') ?? 'null');
if (adminUser) document.querySelector('.profile strong').textContent = adminUser.name;
loadAdminData().catch((error) => showToast(error.message));