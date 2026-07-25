(function () {
  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const logoutBtn = document.getElementById("logout-btn");

  const sidebar = document.getElementById("sidebar");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebarAddBtn = document.getElementById("sidebar-add-btn");
  const targetList = document.getElementById("target-list");
  const panelTitle = document.getElementById("panel-title");

  const addPanel = document.getElementById("add-panel");
  const detailPanel = document.getElementById("detail-panel");
  const addForm = document.getElementById("add-form");
  const addStatus = document.getElementById("add-status");
  const addSubmit = document.getElementById("add-submit");

  const targetNameInput = document.getElementById("target-name");
  const addTargetInput = document.getElementById("add-target-input");
  const addVideoInput = document.getElementById("add-video-input");
  const addTargetPick = document.getElementById("add-target-pick");
  const addVideoPick = document.getElementById("add-video-pick");
  const addTargetLabel = document.getElementById("add-target-label");
  const addVideoLabel = document.getElementById("add-video-label");
  const addTargetPreview = document.getElementById("add-target-preview");
  const addVideoPreview = document.getElementById("add-video-preview");

  const detailName = document.getElementById("detail-name");
  const detailMeta = document.getElementById("detail-meta");
  const detailTargetImg = document.getElementById("detail-target-img");
  const detailVideo = document.getElementById("detail-video");
  const detailStatus = document.getElementById("detail-status");
  const deleteBtn = document.getElementById("delete-btn");

  let config = { targets: [] };
  let selectedId = null;
  let pendingTarget = null;
  let pendingVideo = null;

  function cacheBust(url, version) {
    const v = version || Date.now();
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${encodeURIComponent(v)}`;
  }

  function setStatus(el, msg, type) {
    el.textContent = msg;
    el.className = "status" + (type ? " " + type : "");
  }

  async function api(url, options = {}) {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 300000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        credentials: "same-origin",
        signal: controller.signal,
        ...options,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      return data;
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("Request timed out — compilation can take up to 3 minutes. Check server logs.");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  function openSidebar() {
    sidebar.classList.add("open");
    sidebarBackdrop.classList.remove("hidden");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarBackdrop.classList.add("hidden");
  }

  function showAddPanel() {
    selectedId = null;
    panelTitle.textContent = "Add new target";
    addPanel.classList.remove("hidden");
    detailPanel.classList.add("hidden");
    renderTargetList();
    closeSidebar();
  }

  function showDetailPanel(target) {
    selectedId = target.id;
    panelTitle.textContent = target.name;
    addPanel.classList.add("hidden");
    detailPanel.classList.remove("hidden");
    detailName.textContent = target.name;
    detailMeta.textContent = `Index ${target.targetIndex} · Added ${new Date(target.createdAt).toLocaleString()}`;
    detailTargetImg.src = cacheBust(target.targetImage, config.updatedAt);
    detailVideo.src = cacheBust(target.video, config.updatedAt);
    setStatus(detailStatus, "");
    renderTargetList();
    closeSidebar();
  }

  function renderTargetList() {
    if (!config.targets.length) {
      targetList.innerHTML = '<p class="empty-list">No targets yet.<br>Tap "+ Add target" to create one.</p>';
      return;
    }

    targetList.innerHTML = config.targets
      .map(
        (t) => `
      <button type="button" class="target-item ${t.id === selectedId ? "active" : ""}" data-id="${t.id}">
        <img src="${cacheBust(t.targetImage, config.updatedAt)}" alt="" />
        <div class="target-item-info">
          <div class="target-item-name">${escapeHtml(t.name)}</div>
          <div class="target-item-date">${new Date(t.createdAt).toLocaleDateString()}</div>
        </div>
      </button>`
      )
      .join("");

    targetList.querySelectorAll(".target-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = config.targets.find((x) => x.id === btn.dataset.id);
        if (t) showDetailPanel(t);
      });
    });
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function updateAddSubmitState() {
    addSubmit.disabled = !(pendingTarget && pendingVideo);
  }

  function resetAddForm() {
    addForm.reset();
    pendingTarget = null;
    pendingVideo = null;
    addTargetLabel.textContent = "No file chosen";
    addVideoLabel.textContent = "No file chosen";
    addTargetPreview.classList.add("hidden");
    addVideoPreview.classList.add("hidden");
    updateAddSubmitState();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.add("hidden");
    try {
      await api("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: document.getElementById("password").value }),
      });
      await loadDashboard();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.classList.remove("hidden");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await api("/api/admin/logout", { method: "POST" });
    dashboardView.classList.add("hidden");
    loginView.classList.remove("hidden");
    document.getElementById("password").value = "";
  });

  sidebarToggle.addEventListener("click", openSidebar);
  sidebarBackdrop.addEventListener("click", closeSidebar);
  sidebarAddBtn.addEventListener("click", showAddPanel);

  addTargetPick.addEventListener("click", () => addTargetInput.click());
  addVideoPick.addEventListener("click", () => addVideoInput.click());

  addTargetInput.addEventListener("change", () => {
    pendingTarget = addTargetInput.files[0] || null;
    addTargetLabel.textContent = pendingTarget ? pendingTarget.name : "No file chosen";
    if (pendingTarget) {
      addTargetPreview.src = URL.createObjectURL(pendingTarget);
      addTargetPreview.classList.remove("hidden");
    }
    updateAddSubmitState();
  });

  addVideoInput.addEventListener("change", () => {
    pendingVideo = addVideoInput.files[0] || null;
    addVideoLabel.textContent = pendingVideo ? pendingVideo.name : "No file chosen";
    if (pendingVideo) {
      addVideoPreview.src = URL.createObjectURL(pendingVideo);
      addVideoPreview.classList.remove("hidden");
    }
    updateAddSubmitState();
  });

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pendingTarget || !pendingVideo) return;

    addSubmit.disabled = true;
    setStatus(addStatus, "Uploading & compiling (may take 1–3 min)…", "");

    const form = new FormData();
    form.append("name", targetNameInput.value.trim());
    form.append("target", pendingTarget);
    form.append("video", pendingVideo);

    try {
      const data = await api("/api/admin/targets", { method: "POST", body: form, timeoutMs: 300000 });
      config = data.config;
      resetAddForm();
      setStatus(addStatus, data.message, "ok");
      showDetailPanel(config.targets[config.targets.length - 1]);
    } catch (err) {
      setStatus(addStatus, err.message, "err");
    } finally {
      updateAddSubmitState();
    }
  });

  deleteBtn.addEventListener("click", async () => {
    if (!selectedId) return;
    const target = config.targets.find((t) => t.id === selectedId);
    if (!target || !confirm(`Delete "${target.name}"?`)) return;

    deleteBtn.disabled = true;
    setStatus(detailStatus, "Deleting…", "");

    try {
      const data = await api(`/api/admin/targets/${selectedId}`, { method: "DELETE" });
      config = data.config;
      setStatus(detailStatus, data.message, "ok");
      showAddPanel();
    } catch (err) {
      setStatus(detailStatus, err.message, "err");
    } finally {
      deleteBtn.disabled = false;
    }
  });

  async function loadDashboard() {
    const data = await api("/api/admin/status");
    if (!data.authenticated) return;

    if (!data.cloudinary) {
      loginError.textContent = "Cloudinary not configured on server.";
      loginError.classList.remove("hidden");
      return;
    }

    config = data.config;
    loginView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
    showAddPanel();
  }

  async function checkAuth() {
    try {
      await loadDashboard();
    } catch (_) {}
  }

  checkAuth();
})();
