(function () {
  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const logoutBtn = document.getElementById("logout-btn");

  const targetPreview = document.getElementById("target-preview");
  const videoPreview = document.getElementById("video-preview");
  const configDisplay = document.getElementById("config-display");
  const updatedAt = document.getElementById("updated-at");

  const targetInput = document.getElementById("target-input");
  const targetPick = document.getElementById("target-pick");
  const targetForm = document.getElementById("target-form");
  const targetSubmit = document.getElementById("target-submit");
  const targetStatus = document.getElementById("target-status");

  const videoInput = document.getElementById("video-input");
  const videoPick = document.getElementById("video-pick");
  const videoForm = document.getElementById("video-form");
  const videoSubmit = document.getElementById("video-submit");
  const videoStatus = document.getElementById("video-status");

  let pendingTarget = null;
  let pendingVideo = null;

  function cacheBust(url, version) {
    const v = version || Date.now();
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${encodeURIComponent(v)}`;
  }

  function setStatus(el, message, type) {
    el.textContent = message;
    el.className = "status" + (type ? " " + type : "");
  }

  async function api(url, options = {}) {
    const res = await fetch(url, {
      credentials: "same-origin",
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  function renderConfig(config) {
    targetPreview.src = cacheBust(config.targetImage, config.updatedAt);
    videoPreview.src = cacheBust(config.video, config.updatedAt);
    configDisplay.textContent = JSON.stringify(config, null, 2);
    updatedAt.textContent = new Date(config.updatedAt).toLocaleString();
  }

  async function checkAuth() {
    try {
      const data = await api("/api/admin/status");
      if (data.authenticated) {
        loginView.classList.add("hidden");
        dashboardView.classList.remove("hidden");
        renderConfig(data.config);
        if (!data.cloudinary) {
          setStatus(
            targetStatus,
            "Cloudinary not configured — add credentials to .env and restart server",
            "err"
          );
        }
      }
    } catch (_) {}
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
      await checkAuth();
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

  targetPick.addEventListener("click", () => targetInput.click());
  targetInput.addEventListener("change", () => {
    pendingTarget = targetInput.files[0] || null;
    targetSubmit.disabled = !pendingTarget;
    if (pendingTarget) {
      targetPreview.src = URL.createObjectURL(pendingTarget);
      setStatus(targetStatus, `Selected: ${pendingTarget.name}`, "");
    }
  });

  targetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pendingTarget) return;
    targetSubmit.disabled = true;
    setStatus(targetStatus, "Uploading and compiling (may take ~30s)…", "");

    const form = new FormData();
    form.append("target", pendingTarget);

    try {
      const data = await api("/api/admin/upload-target", { method: "POST", body: form });
      pendingTarget = null;
      targetInput.value = "";
      renderConfig(data.config);
      setStatus(targetStatus, data.message, "ok");
    } catch (err) {
      setStatus(targetStatus, err.message, "err");
    } finally {
      targetSubmit.disabled = !pendingTarget;
    }
  });

  videoPick.addEventListener("click", () => videoInput.click());
  videoInput.addEventListener("change", () => {
    pendingVideo = videoInput.files[0] || null;
    videoSubmit.disabled = !pendingVideo;
    if (pendingVideo) {
      videoPreview.src = URL.createObjectURL(pendingVideo);
      setStatus(videoStatus, `Selected: ${pendingVideo.name}`, "");
    }
  });

  videoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pendingVideo) return;
    videoSubmit.disabled = true;
    setStatus(videoStatus, "Uploading video…", "");

    const form = new FormData();
    form.append("video", pendingVideo);

    try {
      const data = await api("/api/admin/upload-video", { method: "POST", body: form });
      pendingVideo = null;
      videoInput.value = "";
      renderConfig(data.config);
      setStatus(videoStatus, data.message, "ok");
    } catch (err) {
      setStatus(videoStatus, err.message, "err");
    } finally {
      videoSubmit.disabled = !pendingVideo;
    }
  });

  checkAuth();
})();
