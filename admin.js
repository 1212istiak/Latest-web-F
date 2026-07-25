const API_BASE = (window.TVR_API_BASE && window.TVR_API_BASE.trim())
  ? window.TVR_API_BASE.trim().replace(/\/$/, '')
  : (window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api');

let token = localStorage.getItem('tvr_admin_token') || '';

function api(path, options = {}) {
  if (token) {
    options.headers = options.headers || {};
    options.headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${path}`, options).then(async res => {
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}

// Cursor
document.addEventListener('mousemove', (e) => {
  const cursor = document.getElementById('cursor');
  if (cursor) {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  }
});

// Login
const loginPanel = document.getElementById('login-panel');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

if (token) {
  showAdmin();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  try {
    const data = await api('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    token = data.token;
    localStorage.setItem('tvr_admin_token', token);
    showAdmin();
  } catch {
    loginError.style.display = 'block';
  }
});

function showAdmin() {
  loginPanel.style.display = 'none';
  adminPanel.style.display = 'block';
  loadEpisodes();
  loadArtists();
  loadPendingComments();
  loadSettings();
}

// Logout
document.getElementById('logout').addEventListener('click', () => {
  token = '';
  localStorage.removeItem('tvr_admin_token');
  location.reload();
});

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// Episodes
const episodeForm = document.getElementById('episode-form');
const episodesList = document.getElementById('episodes-list');

async function loadEpisodes() {
  try {
    const episodes = await api('/episodes');
    episodesList.innerHTML = episodes.map(ep => `
      <div class="admin-item">
        <strong>EP ${ep.number}</strong>
        <p>${ep.title}</p>
        <button class="btn btn-secondary" style="margin-top:0.5rem; padding:0.4rem 0.8rem; font-size:0.8rem" data-edit='${JSON.stringify(ep).replace(/'/g, "&#39;")}'>Edit</button>
        <button class="btn danger" style="margin-top:0.5rem; margin-left:0.5rem; padding:0.4rem 0.8rem; font-size:0.8rem" data-id="${ep.id}">Delete</button>
      </div>
    `).join('');

    episodesList.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ep = JSON.parse(btn.dataset.edit);
        document.getElementById('ep-id').value = ep.id;
        document.getElementById('ep-title').value = ep.title;
        document.getElementById('ep-number').value = ep.number;
        document.getElementById('ep-thumb').value = ep.thumbnail || '';
        document.getElementById('ep-server1').value = ep.server_1 || '';
        document.getElementById('ep-server2').value = ep.server_2 || '';
        document.getElementById('ep-server3').value = ep.server_3 || '';
        document.getElementById('ep-desc').value = ep.description || '';
      });
    });

    episodesList.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this episode?')) return;
        await api(`/admin/episodes/${btn.dataset.id}`, { method: 'DELETE' });
        loadEpisodes();
      });
    });
  } catch (e) {
    console.error(e);
  }
}

episodeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    title: document.getElementById('ep-title').value,
    number: parseInt(document.getElementById('ep-number').value),
    thumbnail: document.getElementById('ep-thumb').value,
    server_1: document.getElementById('ep-server1').value,
    server_2: document.getElementById('ep-server2').value,
    server_3: document.getElementById('ep-server3').value,
    description: document.getElementById('ep-desc').value
  };
  try {
    await api('/admin/episodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    episodeForm.reset();
    document.getElementById('ep-id').value = '';
    loadEpisodes();
    alert('Episode saved');
  } catch (e) {
    alert('Failed to save episode');
  }
});

// Trailer
document.getElementById('trailer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    title: document.getElementById('trailer-title').value,
    video_url: document.getElementById('trailer-url').value,
    thumbnail: document.getElementById('trailer-thumb').value
  };
  try {
    await api('/admin/trailer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    alert('Trailer saved');
  } catch {
    alert('Failed to save trailer');
  }
});

// Artists
const artistForm = document.getElementById('artist-form');
const artistsList = document.getElementById('artists-list');

async function loadArtists() {
  try {
    const artists = await api('/voice-artists');
    artistsList.innerHTML = artists.map(a => `
      <div class="admin-item">
        <p><strong>${a.name}</strong></p>
        <p style="color:var(--muted); font-size:0.85rem">${a.role || ''}</p>
        <button class="btn danger" style="margin-top:0.5rem; padding:0.4rem 0.8rem; font-size:0.8rem" data-id="${a.id}">Delete</button>
      </div>
    `).join('');
    artistsList.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this artist?')) return;
        await api(`/admin/voice-artists/${btn.dataset.id}`, { method: 'DELETE' });
        loadArtists();
      });
    });
  } catch (e) {
    console.error(e);
  }
}

artistForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    name: document.getElementById('artist-name').value,
    role: document.getElementById('artist-role').value,
    avatar: document.getElementById('artist-avatar').value
  };
  try {
    await api('/admin/voice-artists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    artistForm.reset();
    loadArtists();
  } catch {
    alert('Failed to add artist');
  }
});

// Settings
async function loadSettings() {
  try {
    const settings = await api('/settings');
    document.getElementById('site-name').value = settings.site_name || '';
    document.getElementById('site-url').value = settings.site_url || '';
  } catch (e) {
    console.error(e);
  }
}

document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'site_name', value: document.getElementById('site-name').value })
    });
    await api('/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'site_url', value: document.getElementById('site-url').value })
    });
    alert('Settings saved');
  } catch {
    alert('Failed to save settings');
  }
});

// Pending comments
const pendingComments = document.getElementById('pending-comments');

async function loadPendingComments() {
  try {
    const comments = await api('/admin/comments/pending');
    pendingComments.innerHTML = comments.length
      ? comments.map(c => `
        <div class="comment pending-comment">
          <strong>${c.name}</strong> on Episode #${c.episode_id}
          <p>${c.text}</p>
          <button class="btn btn-primary" style="padding:0.4rem 0.8rem; font-size:0.8rem" data-approve="${c.id}">Approve</button>
          <button class="btn danger" style="padding:0.4rem 0.8rem; font-size:0.8rem" data-delete="${c.id}">Delete</button>
        </div>
      `).join('')
      : '<p style="color:var(--muted)">No pending comments.</p>';

    pendingComments.querySelectorAll('[data-approve]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api(`/admin/comments/${btn.dataset.approve}/approve`, { method: 'POST' });
        loadPendingComments();
      });
    });
    pendingComments.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api(`/admin/comments/${btn.dataset.delete}`, { method: 'DELETE' });
        loadPendingComments();
      });
    });
  } catch (e) {
    console.error(e);
  }
}
