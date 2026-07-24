// TVR Dubbers — frontend logic
(() => {
  const API = (window.TVR_CONFIG && window.TVR_CONFIG.API_BASE) || "";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const state = {
    episodes: [],
    trailer: null,
    settings: {},
    artists: [],
    filter: "All",
    currentEpisode: null,
    currentServer: "primary",
    commentsPollTimer: null,
    visitorId: getVisitorId(),
  };

  function getVisitorId() {
    let v = localStorage.getItem("tvr_visitor");
    if (!v) {
      v = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("tvr_visitor", v);
    }
    return v;
  }

  function toast(msg, ms = 2200) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), ms);
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  async function api(path, opts = {}) {
    const r = await fetch(API + path, { headers: { "Content-Type": "application/json" }, ...opts });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  // ---------- theme ----------
  function applyInitialTheme() {
    const saved = localStorage.getItem("tvr_theme");
    const prefLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    document.body.classList.toggle("light", saved ? saved === "light" : prefLight);
    document.body.classList.toggle("dark", !document.body.classList.contains("light"));
  }
  $("#theme-toggle").addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light");
    document.body.classList.toggle("dark", !isLight);
    localStorage.setItem("tvr_theme", isLight ? "light" : "dark");
  });

  // ---------- cursor / tap FX ----------
  (function cursor() {
    const dot = $("#cursor-dot"), ring = $("#cursor-ring");
    let mx = 0, my = 0, rx = 0, ry = 0;
    document.addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    function tick() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      dot.style.transform = `translate3d(${mx - 4}px, ${my - 4}px, 0)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(tick);
    }
    if (matchMedia("(hover: hover)").matches) requestAnimationFrame(tick);
    document.addEventListener("touchstart", (e) => {
      const t = e.touches[0]; if (!t) return;
      const b = document.createElement("div");
      b.className = "tap-burst";
      b.style.left = t.clientX + "px"; b.style.top = t.clientY + "px";
      document.body.appendChild(b);
      setTimeout(() => b.remove(), 750);
    }, { passive: true });
  })();

  // ---------- particles ----------
  (function particles() {
    const c = $("#particles"), ctx = c.getContext("2d");
    let w = 0, h = 0, particles = [], running = true;
    const density = Math.max(0.3, Math.min(1, (navigator.hardwareConcurrency || 4) / 8));
    function resize() {
      w = c.width = innerWidth * devicePixelRatio;
      h = c.height = innerHeight * devicePixelRatio;
      c.style.width = innerWidth + "px";
      c.style.height = innerHeight + "px";
      const target = Math.round(innerWidth * innerHeight * 0.00006 * density);
      particles = Array.from({ length: target }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.15 * devicePixelRatio,
        vy: (Math.random() - 0.5) * 0.15 * devicePixelRatio,
        r: (Math.random() * 1.4 + 0.4) * devicePixelRatio,
        a: Math.random() * 0.5 + 0.2,
      }));
    }
    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.fillStyle = document.body.classList.contains("light")
          ? `rgba(20,20,30,${p.a * 0.6})` : `rgba(255,255,255,${p.a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running) draw();
    });
    addEventListener("resize", resize, { passive: true });
    resize(); draw();
  })();

  // ---------- data ----------
  async function loadAll() {
    try {
      const [settings, episodes, artists, trailer] = await Promise.all([
        api("/api/settings"), api("/api/episodes"),
        api("/api/voice-artists"), api("/api/trailer"),
      ]);
      state.settings = settings; state.episodes = episodes;
      state.artists = artists; state.trailer = trailer;
      renderAll();
    } catch (e) {
      console.error(e);
      $("#episode-grid").innerHTML = `<p class="no-match">Could not load episodes. Check API_BASE.</p>`;
    }
  }

  function renderAll() {
    applySettings();
    renderCountdown();
    renderSpecial();
    renderGrid();
    renderArtists();
    renderSocials();
  }

  function applySettings() {
    const title = state.settings.website_title || "TVR Dubbers";
    const motto = state.settings.motto || "We Believe in Quality";
    $("#site-title").textContent = title;
    $("#site-motto").textContent = motto;
    $("#footer-title").textContent = title;
    document.title = `${title} — Bangla Donghua`;
    $("#footer-year").textContent = new Date().getFullYear();

    const thumb = state.settings.special_folder_thumbnail;
    const img = $("#special-thumb-img");
    if (thumb) { img.src = thumb; img.alt = "Special Episode"; }
    $("#special-label").textContent = state.settings.special_folder_label || "Season 1, 18 Episodes 4K";
  }

  function renderCountdown() {
    const target = state.settings.countdown_target_date;
    if (!target) { $("#countdown-section").hidden = true; return; }
    const t = new Date(target).getTime();
    if (isNaN(t)) { $("#countdown-section").hidden = true; return; }
    $("#countdown-section").hidden = false;
    function tick() {
      const diff = Math.max(0, t - Date.now());
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff / 3600000) % 24);
      const m = Math.floor((diff / 60000) % 60);
      const s = Math.floor((diff / 1000) % 60);
      $("#cd-days").textContent = String(d).padStart(2, "0");
      $("#cd-hours").textContent = String(h).padStart(2, "0");
      $("#cd-mins").textContent = String(m).padStart(2, "0");
      $("#cd-secs").textContent = String(s).padStart(2, "0");
    }
    tick(); clearInterval(renderCountdown._i);
    renderCountdown._i = setInterval(tick, 1000);
  }

  function renderSpecial() {
    const specials = state.episodes.filter((e) => e.is_special);
    const strip = $("#special-strip");
    strip.innerHTML = "";
    specials.slice(0, 6).forEach((ep) => strip.appendChild(tileEl(ep)));
    $("#special-section").hidden = specials.length === 0;
  }

  function renderGrid() {
    const grid = $("#episode-grid");
    grid.innerHTML = "";
    const genres = ["All", ...new Set(state.episodes.map((e) => e.genre).filter(Boolean))];
    const chips = $("#genre-chips");
    chips.innerHTML = "";
    genres.forEach((g) => {
      const b = document.createElement("button");
      b.className = "chip" + (state.filter === g ? " active" : "");
      b.textContent = g;
      b.onclick = () => { state.filter = g; renderGrid(); };
      chips.appendChild(b);
    });
    const list = state.filter === "All"
      ? state.episodes
      : state.episodes.filter((e) => e.genre === state.filter);
    if (!list.length) grid.innerHTML = `<p class="no-match">No episodes yet.</p>`;
    list.forEach((ep) => grid.appendChild(tileEl(ep)));
  }

  function tileEl(ep) {
    const d = document.createElement("div");
    d.className = "tile";
    const isNew = ep.created_at && (Date.now() - new Date(ep.created_at + "Z").getTime()) < 48 * 3600 * 1000;
    const lastWatched = localStorage.getItem("tvr_last") === String(ep.id);
    d.innerHTML = `
      <div class="thumb">
        ${ep.genre ? `<span class="genre">${esc(ep.genre)}</span>` : ""}
        ${lastWatched ? `<span class="resume-badge">Resume</span>` : isNew ? `<span class="new-badge">New</span>` : ""}
        <img loading="lazy" src="${esc(ep.thumbnail_url)}" alt="${esc(ep.title)}" width="640" height="360" />
      </div>
      <div class="meta">
        <h4>${esc(ep.title)}</h4>
        <small>S${ep.season || 1} · Ep ${ep.episode_number}</small>
      </div>`;
    d.addEventListener("click", () => openPlayer(ep));
    return d;
  }

  function renderArtists() {
    const ul = $("#artists-list");
    ul.innerHTML = state.artists.map((a) => `<li>${esc(a.name)}</li>`).join("");
  }

  function renderSocials() {
    const s = state.settings;
    const items = [
      { key: "facebook", icon: "f", label: "Facebook" },
      { key: "youtube", icon: "▶", label: "YouTube" },
      { key: "telegram", icon: "✈", label: "Telegram" },
      { key: "whatsapp", icon: "W", label: "WhatsApp" },
      { key: "instagram", icon: "◎", label: "Instagram" },
      { key: "dailymotion", icon: "D", label: "Dailymotion" },
      { key: "rumble", icon: "R", label: "Rumble" },
    ];
    const wrap = $("#socials");
    wrap.innerHTML = "";
    items.forEach((it) => {
      const url = s[it.key];
      const a = document.createElement("a");
      a.title = it.label;
      a.textContent = it.icon;
      a.href = "#";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (!url) { toast("Coming Soon"); return; }
        if (it.key === "whatsapp") {
          const num = url.replace(/[^0-9+]/g, "");
          window.open(`https://wa.me/${num}`, "_blank");
        } else {
          window.open(url, "_blank");
        }
      });
      wrap.appendChild(a);
    });
    const ct = $("#contact-telegram");
    ct.href = s.telegram || "#";
    ct.addEventListener("click", (e) => { if (!s.telegram) { e.preventDefault(); toast("Coming Soon"); } });
  }

  // ---------- player ----------
  function openPlayer(ep) {
    state.currentEpisode = ep;
    state.currentServer = "primary";
    localStorage.setItem("tvr_last", String(ep.id));
    $("#player-title").textContent = `${ep.title} — Ep ${ep.episode_number}`;
    $$(".server-tabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.server === "primary"));
    setIframe(ep.primary_server_url);
    $("#player-modal").hidden = false;
    document.body.style.overflow = "hidden";
    renderReactions();
    renderComments();
    startCommentsPoll();
    renderNextButton();
  }
  function setIframe(url) { $("#player-iframe").src = url || "about:blank"; }
  function closePlayer() {
    $("#player-modal").hidden = true;
    setIframe("");
    document.body.style.overflow = "";
    clearInterval(state.commentsPollTimer);
  }
  $("#player-close").addEventListener("click", closePlayer);
  $$(".server-tabs .tab").forEach((t) => t.addEventListener("click", () => {
    $$(".server-tabs .tab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    state.currentServer = t.dataset.server;
    const ep = state.currentEpisode;
    setIframe(t.dataset.server === "primary" ? ep.primary_server_url : ep.backup_server_url);
  }));

  function renderNextButton() {
    const idx = state.episodes.findIndex((e) => e.id === state.currentEpisode.id);
    const next = state.episodes[idx - 1] || state.episodes[state.episodes.length - 1];
    const btn = $("#next-episode");
    btn.hidden = !next || next.id === state.currentEpisode.id;
    if (!btn.hidden) {
      btn.textContent = `Next: ${next.title} ▸`;
      btn.onclick = () => openPlayer(next);
    }
  }

  // ---------- comments ----------
  async function renderComments() {
    try {
      const list = await api(`/api/episodes/${state.currentEpisode.id}/comments`);
      $("#comment-list").innerHTML = list.map((c) => `
        <li><strong>${esc(c.nickname)}</strong>${esc(c.body)}</li>`).join("") || `<li><small>Be the first to comment.</small></li>`;
    } catch (e) {}
  }
  function startCommentsPoll() {
    clearInterval(state.commentsPollTimer);
    state.commentsPollTimer = setInterval(renderComments, 12000);
  }
  $("#comment-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api(`/api/episodes/${state.currentEpisode.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ nickname: fd.get("nickname"), body: fd.get("body") }),
      });
      e.target.reset(); renderComments();
    } catch (err) { toast("Slow down — try again in a minute"); }
  });

  // ---------- reactions ----------
  const REACTIONS = [
    ["thumbs_up", "👍"], ["heart", "❤"], ["thumbs_down", "👎"],
    ["fire", "🔥"], ["cry", "😥"], ["joy", "😹"], ["skull", "💀"],
  ];
  async function renderReactions() {
    const bar = $("#reaction-bar"), counts = $("#reaction-counts");
    bar.innerHTML = ""; counts.innerHTML = "";
    const my = localStorage.getItem(`tvr_react_${state.currentEpisode.id}`);
    REACTIONS.forEach(([k, e]) => {
      const b = document.createElement("button");
      b.textContent = e; b.dataset.k = k;
      if (my === k) b.classList.add("active");
      b.addEventListener("click", (ev) => sendReaction(k, e, ev.currentTarget));
      bar.appendChild(b);
    });
    try {
      const data = await api(`/api/episodes/${state.currentEpisode.id}/reactions`);
      REACTIONS.forEach(([k, e]) => {
        const n = data[k] || 0;
        if (n > 0) counts.insertAdjacentHTML("beforeend", `<span>${e} ${n}</span>`);
      });
    } catch (_) {}
  }
  async function sendReaction(k, emoji, btn) {
    const rect = btn.getBoundingClientRect();
    const fly = document.createElement("div");
    fly.className = "reaction-fly";
    fly.textContent = emoji;
    fly.style.left = (rect.left + rect.width / 2) + "px";
    fly.style.top = rect.top + "px";
    document.body.appendChild(fly);
    setTimeout(() => fly.remove(), 950);
    try {
      await api(`/api/episodes/${state.currentEpisode.id}/reactions`, {
        method: "POST",
        body: JSON.stringify({ visitor_id: state.visitorId, reaction_type: k }),
      });
      localStorage.setItem(`tvr_react_${state.currentEpisode.id}`, k);
      renderReactions();
    } catch (e) {}
  }

  // ---------- hero buttons ----------
  $("#watch-now").addEventListener("click", () => {
    if (!state.episodes.length) return toast("No episodes yet");
    openPlayer(state.episodes[0]);
  });
  $("#watch-trailer").addEventListener("click", () => {
    if (!state.trailer || !state.trailer.primary_server_url) return toast("Coming Soon");
    openPlayer({
      id: "trailer",
      title: state.trailer.title || "Upcoming",
      episode_number: "Trailer",
      primary_server_url: state.trailer.primary_server_url,
      backup_server_url: state.trailer.backup_server_url,
    });
  });

  // ---------- special expand ----------
  $("#special-tile").addEventListener("click", () => {
    const specials = state.episodes.filter((e) => e.is_special);
    const grid = $("#special-full-grid");
    grid.innerHTML = "";
    specials.forEach((ep) => grid.appendChild(tileEl(ep)));
    $("#special-full").hidden = false;
    document.body.style.overflow = "hidden";
  });
  $("#special-close").addEventListener("click", () => {
    $("#special-full").hidden = true;
    document.body.style.overflow = "";
  });

  // ---------- search ----------
  const searchInput = $("#search"), searchResults = $("#search-results");
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { searchResults.hidden = true; searchResults.innerHTML = ""; return; }
    const hits = state.episodes.filter((e) => e.title.toLowerCase().includes(q)).slice(0, 8);
    searchResults.hidden = false;
    if (!hits.length) {
      searchResults.innerHTML = `<div class="no-match">Coming Soon</div>`;
      return;
    }
    searchResults.innerHTML = hits.map((e) => `
      <div class="search-result" data-id="${e.id}">
        <img src="${esc(e.thumbnail_url)}" alt="">
        <span>${esc(e.title)} — Ep ${e.episode_number}</span>
      </div>`).join("");
    $$(".search-result", searchResults).forEach((el) => el.addEventListener("click", () => {
      const ep = state.episodes.find((x) => String(x.id) === el.dataset.id);
      if (ep) { openPlayer(ep); searchResults.hidden = true; searchInput.value = ""; }
    }));
  });
  document.addEventListener("click", (e) => {
    if (!$(".search-wrap").contains(e.target)) searchResults.hidden = true;
  });

  // ---------- admin 5-tap ----------
  let tapCount = 0, tapTimer = null;
  $("#site-title").addEventListener("click", () => {
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => (tapCount = 0), 1500);
    if (tapCount >= 5) {
      tapCount = 0;
      $("#admin-modal").hidden = false;
    }
  });
  $("#admin-close").addEventListener("click", () => { $("#admin-modal").hidden = true; });
  $("#admin-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pwd = new FormData(e.target).get("password");
    try {
      const r = await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: pwd }) });
      localStorage.setItem("tvr_admin_token", r.token);
      window.location.href = "/admin";
    } catch {
      $("#admin-login-error").hidden = false;
    }
  });

  // ---------- deep-link (?ep=id) ----------
  applyInitialTheme();
  loadAll().then(() => {
    const q = new URLSearchParams(location.search).get("ep");
    if (q) {
      const ep = state.episodes.find((x) => String(x.id) === q);
      if (ep) openPlayer(ep);
    }
  });
})();
