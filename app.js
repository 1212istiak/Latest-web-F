const API_BASE = (window.TVR_API_BASE && window.TVR_API_BASE.trim())
  ? window.TVR_API_BASE.trim().replace(/\/$/, '')
  : (window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api');

const cursor = document.getElementById('cursor');
let currentEpisodeId = null;
let commentInterval = null;

// Visitor ID
function getVisitorId() {
  let id = localStorage.getItem('tvr_visitor_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('tvr_visitor_id', id);
  }
  return id;
}

// Custom cursor
document.addEventListener('mousemove', (e) => {
  if (cursor) {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  }
});

document.querySelectorAll('a, button, .episode-card, .trailer-card, .server-tab, .reaction-btn').forEach(el => {
  el.addEventListener('mouseenter', () => cursor && cursor.classList.add('hover'));
  el.addEventListener('mouseleave', () => cursor && cursor.classList.remove('hover'));
});

// Tap burst
document.addEventListener('click', (e) => {
  const burst = document.createElement('div');
  burst.className = 'tap-burst';
  burst.style.left = e.clientX + 'px';
  burst.style.top = e.clientY + 'px';
  for (let i = 0; i < 8; i++) {
    const dot = document.createElement('span');
    const angle = (i / 8) * Math.PI * 2;
    const dist = 30 + Math.random() * 20;
    dot.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
    dot.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
    dot.style.background = `hsl(${Math.random() * 360}, 80%, 60%)`;
    burst.appendChild(dot);
  }
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 600);
});

// Particles
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const particleCount = Math.min(60, (navigator.hardwareConcurrency || 4) * 12);

class Particle {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2 + 1;
    this.speedX = (Math.random() - 0.5) * 0.5;
    this.speedY = (Math.random() - 0.5) * 0.5;
    this.color = `hsla(${Math.random() * 60 + 320}, 80%, 60%, ${Math.random() * 0.4 + 0.2})`;
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

for (let i = 0; i < particleCount; i++) particles.push(new Particle());

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => { p.update(); p.draw(); });
  requestAnimationFrame(animateParticles);
}
animateParticles();

// 5-tap hidden admin entry
let tapCount = 0;
let tapTimer = null;
document.getElementById('logo').addEventListener('click', () => {
  tapCount++;
  if (tapTimer) clearTimeout(tapTimer);
  tapTimer = setTimeout(() => tapCount = 0, 2000);
  if (tapCount >= 5) {
    tapCount = 0;
    window.location.href = 'admin.html';
  }
});

// Helpers
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function normalizeUrl(raw) {
  if (!raw) return '';
  const url = raw.trim();
  const dm = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9_]+)/) || url.match(/dai\.ly\/([a-zA-Z0-9_]+)/);
  if (dm) return `https://www.dailymotion.com/embed/video/${dm[1]}`;
  const rumble = url.match(/rumble\.com\/embed\/([a-zA-Z0-9_-]+)/) || url.match(/rumble\.com\/v([a-zA-Z0-9_-]+)/);
  if (rumble) return `https://rumble.com/embed/${rumble[1]}`;
  return url;
}

function getResume(id) {
  return localStorage.getItem(`tvr_resume_${id}`);
}

function setResume(id) {
  localStorage.setItem(`tvr_resume_${id}`, Date.now());
}

// Render trailer
async function loadTrailer() {
  try {
    const trailer = await api('/trailer');
    if (!trailer) return;
    document.getElementById('trailer-empty').style.display = 'none';
    const card = document.getElementById('trailer-card');
    const thumb = document.getElementById('trailer-thumb');
    card.style.display = 'block';
    thumb.src = trailer.thumbnail || `https://img.youtube.com/vi/placeholder/maxresdefault.jpg`;
    thumb.alt = trailer.title;
    card.addEventListener('click', () => openPlayer({
      id: 'trailer',
      title: trailer.title,
      server_1: trailer.video_url
    }));
  } catch (e) {
    console.error('Trailer load failed', e);
  }
}

// Render episodes
async function loadEpisodes() {
  try {
    const episodes = await api('/episodes');
    const grid = document.getElementById('episodes-grid');
    if (!episodes.length) {
      document.getElementById('episodes-empty').style.display = 'block';
      return;
    }
    grid.innerHTML = episodes.map(ep => `
      <div class="episode-card glass" data-id="${ep.id}">
        <div class="episode-thumb">
          <img src="${ep.thumbnail || 'https://via.placeholder.com/480x270/1a1a2e/ffffff?text=Episode+' + ep.number}" alt="${ep.title}">
          <span class="episode-badge">EP ${ep.number}</span>
          ${getResume(ep.id) ? '<span class="episode-resume">RESUME</span>' : ''}
        </div>
        <div class="episode-info">
          <h3>${ep.title}</h3>
          <p>${ep.description || ''}</p>
        </div>
      </div>
    `).join('');
    document.querySelectorAll('.episode-card').forEach(card => {
      card.addEventListener('click', async () => {
        const id = card.dataset.id;
        const ep = await api(`/episodes/${id}`);
        openPlayer(ep);
      });
    });
  } catch (e) {
    console.error('Episodes load failed', e);
  }
}

// Render artists
async function loadArtists() {
  try {
    const artists = await api('/voice-artists');
    const grid = document.getElementById('artists-grid');
    if (!artists.length) {
      document.getElementById('artists-empty').style.display = 'block';
      return;
    }
    grid.innerHTML = artists.map(a => `
      <div class="artist-card glass">
        <img class="artist-avatar" src="${a.avatar || 'https://via.placeholder.com/150/1a1a2e/ffffff?text=' + a.name.charAt(0)}" alt="${a.name}">
        <h4>${a.name}</h4>
        <span>${a.role || 'Voice Artist'}</span>
      </div>
    `).join('');
  } catch (e) {
    console.error('Artists load failed', e);
  }
}

// Modal player
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modal-close');
const playerWrapper = document.getElementById('player-wrapper');
const modalTitle = document.getElementById('modal-title');
const serverTabs = document.getElementById('server-tabs');
const reactionsEl = document.getElementById('reactions');
const commentsList = document.getElementById('comments-list');
const commentForm = document.getElementById('comment-form');
const adjacentEl = document.getElementById('adjacent-episodes');

function openPlayer(ep) {
  currentEpisodeId = ep.id;
  modalTitle.textContent = ep.title;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  const servers = [ep.server_1, ep.server_2, ep.server_3].filter(Boolean);
  serverTabs.innerHTML = servers.map((url, i) => `
    <button class="server-tab ${i === 0 ? 'active' : ''}" data-url="${normalizeUrl(url)}">Server ${i + 1}</button>
  `).join('');
  loadServer(normalizeUrl(servers[0]));

  serverTabs.querySelectorAll('.server-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      serverTabs.querySelectorAll('.server-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadServer(btn.dataset.url);
    });
  });

  loadReactions();
  loadComments();
  if (ep.id !== 'trailer') loadAdjacent();
  else adjacentEl.innerHTML = '';

  if (ep.id !== 'trailer') setResume(ep.id);
}

function loadServer(url) {
  playerWrapper.innerHTML = `<iframe src="${url}" allowfullscreen allow="autoplay; fullscreen"></iframe>`;
}

function closeModal() {
  modal.classList.remove('active');
  playerWrapper.innerHTML = '';
  document.body.style.overflow = '';
  currentEpisodeId = null;
  if (commentInterval) clearInterval(commentInterval);
}

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// Reactions
const reactionTypes = [
  { key: 'like', emoji: '👍' },
  { key: 'fire', emoji: '🔥' },
  { key: 'love', emoji: '❤️' },
  { key: 'sad', emoji: '😢' },
  { key: 'angry', emoji: '😡' },
];

async function loadReactions() {
  try {
    const counts = await api(`/episodes/${currentEpisodeId}/reactions`);
    const voted = JSON.parse(localStorage.getItem(`tvr_voted_${currentEpisodeId}`) || '[]');
    reactionsEl.innerHTML = reactionTypes.map(r => `
      <button class="reaction-btn ${voted.includes(r.key) ? 'voted' : ''}" data-type="${r.key}">
        <span>${r.emoji}</span>
        <span>${counts[r.key] || 0}</span>
      </button>
    `).join('');
    reactionsEl.querySelectorAll('.reaction-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const type = btn.dataset.type;
        const rect = btn.getBoundingClientRect();
        const fly = document.createElement('div');
        fly.className = 'fly-up';
        fly.textContent = btn.querySelector('span').textContent;
        fly.style.left = rect.left + rect.width / 2 + 'px';
        fly.style.top = rect.top + 'px';
        document.body.appendChild(fly);
        setTimeout(() => fly.remove(), 1000);

        const counts = await api(`/episodes/${currentEpisodeId}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, visitor_id: getVisitorId() })
        });
        let voted = JSON.parse(localStorage.getItem(`tvr_voted_${currentEpisodeId}`) || '[]');
        if (!voted.includes(type)) voted.push(type);
        localStorage.setItem(`tvr_voted_${currentEpisodeId}`, JSON.stringify(voted));
        loadReactions();
      });
    });
  } catch (e) {
    console.error('Reactions load failed', e);
  }
}

// Comments
async function loadComments() {
  try {
    const comments = await api(`/episodes/${currentEpisodeId}/comments`);
    commentsList.innerHTML = comments.length
      ? comments.map(c => `
        <div class="comment">
          <strong>${c.name}</strong>
          <p>${c.text}</p>
          <small>${new Date(c.created_at).toLocaleString()}</small>
        </div>
      `).join('')
      : '<p style="color:var(--muted)">No comments yet. Be the first!</p>';
  } catch (e) {
    console.error('Comments load failed', e);
  }
}

commentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('comment-name').value;
  const text = document.getElementById('comment-text').value;
  try {
    await api(`/episodes/${currentEpisodeId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, text })
    });
    commentForm.reset();
    alert('Comment submitted for moderation.');
  } catch (err) {
    alert('Failed to post comment.');
  }
});

// Poll comments
function startCommentPolling() {
  if (commentInterval) clearInterval(commentInterval);
  commentInterval = setInterval(() => {
    if (currentEpisodeId) loadComments();
  }, 12000);
}

// Adjacent episodes
async function loadAdjacent() {
  try {
    const { prev, next } = await api(`/episodes/${currentEpisodeId}/adjacent`);
    const items = [prev, next].filter(Boolean);
    adjacentEl.innerHTML = items.map(ep => `
      <div class="episode-card glass" data-id="${ep.id}" style="cursor:pointer">
        <div class="episode-thumb">
          <img src="${ep.thumbnail || 'https://via.placeholder.com/480x270/1a1a2e/ffffff?text=EP+' + ep.number}" alt="${ep.title}">
          <span class="episode-badge">EP ${ep.number}</span>
        </div>
        <div class="episode-info"><h3>${ep.title}</h3></div>
      </div>
    `).join('');
    adjacentEl.querySelectorAll('.episode-card').forEach(card => {
      card.addEventListener('click', async () => {
        const id = card.dataset.id;
        const ep = await api(`/episodes/${id}`);
        openPlayer(ep);
      });
    });
  } catch (e) {
    console.error('Adjacent load failed', e);
  }
}

// Init
document.getElementById('year').textContent = new Date().getFullYear();
loadTrailer();
loadEpisodes();
loadArtists();
startCommentPolling();

// Deep link episode
const params = new URLSearchParams(window.location.search);
const episodeId = params.get('episode');
if (episodeId) {
  api(`/episodes/${episodeId}`).then(openPlayer).catch(() => {});
}
