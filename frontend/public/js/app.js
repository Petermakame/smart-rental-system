// ─── Smart Rental System - Frontend JS ────────────────────────────────────────

// ─── Modal Controls ───────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
  document.body.style.overflow = '';
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal').forEach(m => {
      m.style.display = 'none';
    });
    document.body.style.overflow = '';
  }
});

// ─── Sidebar Toggle (Mobile) ──────────────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// ─── Token Helper ─────────────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}

// ─── Door Control (Admin) ─────────────────────────────────────────────────────
async function controlDoor(deviceName, action) {
  try {
    const res = await fetch('/api/door/control', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ deviceName, action })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Hitilafu ya mtandao', 'error');
  }
}

// ─── Toast Notifications ──────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;

  // Add styles
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '14px 20px',
    borderRadius: '10px',
    background: type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#0891b2',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '0.9rem',
    fontWeight: '600',
    zIndex: '9999',
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
    animation: 'slideIn 0.3s ease',
    maxWidth: '350px'
  });

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ─── Format Currency (TZS) ────────────────────────────────────────────────────
function formatTZS(amount) {
  return `TZS ${Number(amount).toLocaleString('sw-TZ')}`;
}

// ─── Format Date Swahili ──────────────────────────────────────────────────────
function formatDateSW(date) {
  return new Date(date).toLocaleDateString('sw-TZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// ─── Auto-redirect if not logged in ──────────────────────────────────────────
function checkAuth() {
  const token = getToken();
  if (!token && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
    // Session-based auth handles this server-side, but good to have client check too
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  console.log('🏠 Smart Rental System - Ready');
});
