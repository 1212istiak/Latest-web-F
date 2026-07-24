// TVR Dubbers admin panel
(() => {
  const API = (window.TVR_CONFIG && window.TVR_CONFIG.API_BASE) || "";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const GENRES = ["Action", "Romance", "Comedy", "Tragedy", "Mystery", "Thriller", "R rated Action"];
  let token = localStorage.getItem("tvr_admin_token") || "";

  function toast(msg, ms = 2000) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
  }
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }
  async function api(path, opts = {}, auth = true) {
    const headers = { "Content-Type": "application/json" };
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    const r = await fetch(API + path, { headers, ...opts });
    if (r.status === 401) { logout(); throw new Error("unauthorized"); }
    if (!r.ok) throw new Error("HTTP " + r.status);
    if (r.status === 204) return null;
    return r.json();
  }

  function logout() {
    localStorage.removeItem("tvr_admin_token");
    token = ""; showLogin();
  }
  function showLogin() { $("#admin-login").hidden = false; $("#admin-panel").hidden = true; }
  function showPanel() { $("#admin-login").hidden = true; $("#admin-panel").hidden = false; buildForms(); loadAll(); }

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pwd = new FormData(e.target).get("password");
    try {
      const r = await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: pwd }) }, false);
      token = r.token; localStorage.setItem("tvr_admin_token", token);
      showPanel();
    } catch { toast("Invalid password"); }
  });
  $("#logout").addEventListener("click", logout);

  $$(".admin-tabs button").forEach((b) => b.addEventListener("click", () => {
    $$(".admin-tabs button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    const tab = b.dataset.tab;
    $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== tab));
    if (tab === "episodes") loadEpisodes();
    if (tab === "artists") loadArtists();
    if (tab === "comments") loadCommentsMod();
    if (tab === "settings" || tab === "links") loadSettings();
    if (tab === "trailer") loadTrailer();
  }));

  function episodeFormHtml(prefix = "") {
    return `
      <label>Title<input name="title" required maxlength="200"></label>
      <label>Episode Number<input name="episode_number" type="number" min="0" required></label>
      <label>Season<input name="season" type="number" min="1" value="1"></label>
      <label>Genre
        <select name="genre">${GENRES.map((g) => `<option>${g}</option>`).join("")}</select>
      </label>
      <label>Thumbnail URL (16:9)<input name="thumbnail_url" type="url" required></label>
      <label>Primary Server URL / Embed / iframe HTML (Dailymotion)
        <textarea name="primary_server_url" required></textarea></label>
      <label>Backup Server URL / Embed / iframe HTML (Rumble)
        <textarea name="backup_server_url"></textarea></label>
      <label><input type="checkbox" name="is_special"> Add to Special Episode section</label>
      <button class="btn btn-primary" type="submit">Save ${prefix ? "changes" : "Episode"}</button>`;
  }

  function buildForms() {
    $("#upload-form").innerHTML = episodeFormHtml();
    $("#upload-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd);
      body.is_special = fd.get("is_special") ? 1 : 0;
      try {
        await api("/api/admin/episodes", { method: "POST", body: JSON.stringify(body) });
        toast("Saved successfully ✓"); e.target.reset();
      } catch (err) { toast("Failed: " + err.message); }
    });

    $("#trailer-form").innerHTML = `
      <label>Title<input name="title"></label>
      <label>Genre<select name="genre">${GENRES.map((g) => `<option>${g}</option>`).join("")}</select></label>
      <label>Thumbnail URL<input name="thumbnail_url" type="url"></label>
      <label>Dailymotion embed URL / iframe<textarea name="primary_server_url"></textarea></label>
      <label>Rumble embed URL / iframe<textarea name="backup_server_url"></textarea></label>
      <button class="btn btn-primary" type="submit">Save Trailer</button>`;
    $("#trailer-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target));
      try { await api("/api/admin/trailer", { method: "PUT", body: JSON.stringify(body) }); toast("Saved ✓"); }
      catch (err) { toast("Failed"); }
    });

    $("#settings-form").innerHTML = `
      <label>Website Title<input name="website_title"></label>
      <label>Motto<input name="motto"></label>
      <label>Special Folder Thumbnail URL<input name="special_folder_thumbnail" type="url"></label>
      <label>Special Folder Label<input name="special_folder_label"></label>
      <label>Countdown Target (YYYY-MM-DDTHH:MM)<input name="countdown_target_date" type="datetime-local"></label>
      <button class="btn btn-primary" type="submit">Save Settings</button>`;
    $("#settings-form").addEventListener("submit", saveSettingsForm);

    $("#links-form").innerHTML = `
      <label>Facebook URL<input name="facebook" type="url"></label>
      <label>YouTube URL<input name="youtube" type="url"></label>
      <label>Telegram URL<input name="telegram" type="url"></label>
      <label>WhatsApp Number<input name="whatsapp"></label>
      <label>Instagram URL<input name="instagram" type="url"></label>
      <label>Dailymotion Channel URL<input name="dailymotion" type="url"></label>
      <label>Rumble Channel URL<input name="rumble" type="url"></label>
      <button class="btn btn-primary" type="submit">Save Links</button>`;
    $("#links-form").addEventListener("submit", saveSettingsForm);

    $("#artist-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = new FormData(e.target).get("name");
      await api("/api/admin/voice-artists", { method: "POST", body: JSON.stringify({ name }) });
      e.target.reset(); loadArtists();
    });

    $("#password-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      if (fd.get("next") !== fd.get("confirm")) return toast("New passwords do not match");
      try {
        await api("/api/admin/change-password", {
          method: "POST",
          body: JSON.stringify({ current: fd.get("current"), next: fd.get("next") }),
        });
        toast("Password updated"); e.target.reset();
      } catch { toast("Failed — check current password"); }
    });
  }

  async function saveSettingsForm(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try { await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(body) }); toast("Saved ✓"); }
    catch { toast("Failed"); }
  }

  async function loadAll() {}

  async function loadEpisodes() {
    const list = await api("/api/episodes", {}, false);
    const ul = $("#episodes-list");
    ul.innerHTML = list.map((e) => `
      <li data-id="${e.id}">
        <div><strong>Ep ${e.episode_number}</strong> — ${esc(e.title)} <small style="color:var(--muted)">${esc(e.genre || "")}${e.is_special ? " · Special" : ""}</small></div>
        <div>
          <button data-act="edit">Edit</button>
          <button data-act="del" class="danger">Delete</button>
        </div>
      </li>`).join("");
    ul.addEventListener("click", async (ev) => {
      const btn = ev.target.closest("button"); if (!btn) return;
      const li = btn.closest("li"); const id = Number(li.dataset.id);
      const ep = list.find((x) => x.id === id);
      if (btn.dataset.act === "del") {
        if (!confirm("Delete episode?")) return;
        await api(`/api/admin/episodes/${id}`, { method: "DELETE" });
        loadEpisodes();
      } else {
        openEditor(ep);
      }
    }, { once: true });
  }

  function openEditor(ep) {
    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.innerHTML = `<div class="modal-panel glass"><button class="close">✕</button>
      <h3>Edit Episode</h3><form class="grid-form">${episodeFormHtml("edit")}</form></div>`;
    document.body.appendChild(wrap);
    const form = wrap.querySelector("form");
    form.title.value = ep.title;
    form.episode_number.value = ep.episode_number;
    form.season.value = ep.season || 1;
    form.genre.value = ep.genre || "Action";
    form.thumbnail_url.value = ep.thumbnail_url || "";
    form.primary_server_url.value = ep.primary_server_url || "";
    form.backup_server_url.value = ep.backup_server_url || "";
    form.is_special.checked = !!ep.is_special;
    wrap.querySelector(".close").onclick = () => wrap.remove();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(form));
      body.is_special = form.is_special.checked ? 1 : 0;
      try {
        await api(`/api/admin/episodes/${ep.id}`, { method: "PUT", body: JSON.stringify(body) });
        toast("Updated ✓"); wrap.remove(); loadEpisodes();
      } catch (err) { toast("Failed"); }
    });
  }

  async function loadArtists() {
    const list = await api("/api/voice-artists", {}, false);
    $("#artists-admin-list").innerHTML = list.map((a) => `
      <li data-id="${a.id}"><span>${esc(a.name)}</span><button class="danger" data-act="del">Delete</button></li>`).join("");
    $("#artists-admin-list").onclick = async (ev) => {
      const btn = ev.target.closest("button"); if (!btn) return;
      const id = btn.closest("li").dataset.id;
      await api(`/api/admin/voice-artists/${id}`, { method: "DELETE" });
      loadArtists();
    };
  }

  async function loadCommentsMod() {
    const list = await api("/api/admin/comments");
    $("#comments-mod-list").innerHTML = list.map((c) => `
      <li data-id="${c.id}">
        <div><small style="color:var(--muted)">Ep ${c.episode_number || "?"} — ${esc(c.episode_title || "")}</small>
        <div><strong>${esc(c.nickname)}:</strong> ${esc(c.body)}</div></div>
        <button class="danger" data-act="del">Delete</button>
      </li>`).join("");
    $("#comments-mod-list").onclick = async (ev) => {
      const btn = ev.target.closest("button"); if (!btn) return;
      const id = btn.closest("li").dataset.id;
      await api(`/api/admin/comments/${id}`, { method: "DELETE" });
      loadCommentsMod();
    };
  }

  async function loadSettings() {
    const s = await api("/api/settings", {}, false);
    for (const form of [$("#settings-form"), $("#links-form")]) {
      $$("input, textarea", form).forEach((el) => {
        if (s[el.name] != null) {
          if (el.type === "datetime-local" && s[el.name]) {
            const d = new Date(s[el.name]);
            if (!isNaN(d)) el.value = d.toISOString().slice(0, 16);
          } else el.value = s[el.name];
        }
      });
    }
  }

  async function loadTrailer() {
    const t = await api("/api/trailer", {}, false);
    if (!t) return;
    const f = $("#trailer-form");
    for (const [k, v] of Object.entries(t)) if (f[k]) f[k].value = v || "";
  }

  if (token) showPanel(); else showLogin();
})();
