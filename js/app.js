(function () {
  const loadingScreen = document.getElementById("loading-screen");
  const startScreen = document.getElementById("start-screen");
  const startBtn = document.getElementById("start-btn");
  const arContainer = document.getElementById("ar-container");
  const scannerUi = document.getElementById("scanner-ui");
  const scannerStatus = document.getElementById("scanner-status");
  const foundBadge = document.getElementById("found-badge");
  const unmuteBtn = document.getElementById("unmute-btn");
  const toast = document.getElementById("toast");

  let arScene = null;
  let config = null;
  let arStarted = false;
  let arSystem = null;
  let toastTimer = null;
  let activeTargetIndex = null;
  const videoEls = [];
  const videoPlanes = [];

  function cacheBust(url) {
    const v = config?.updatedAt || Date.now();
    return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(v)}`;
  }

  function setAppHeight() {
    const vh = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${vh}px`);
  }

  setAppHeight();
  window.addEventListener("resize", setAppHeight);
  window.visualViewport?.addEventListener("resize", setAppHeight);
  window.addEventListener("orientationchange", () => setTimeout(setAppHeight, 150));

  document.body.addEventListener(
    "touchmove",
    (e) => {
      if (e.target === document.body) e.preventDefault();
    },
    { passive: false }
  );

  function showToast(message, duration = 4000) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), duration);
  }

  function getArSystem() {
    if (!arSystem && arScene?.systems["mindar-image-system"]) {
      arSystem = arScene.systems["mindar-image-system"];
    }
    return arSystem;
  }

  function ensureCameraVisible() {
    const camVideo = arContainer.querySelector(":scope > video");
    if (!camVideo) return;
    camVideo.style.zIndex = "0";
    camVideo.style.objectFit = "cover";
    camVideo.setAttribute("playsinline", "");
    camVideo.setAttribute("webkit-playsinline", "");
    camVideo.play().catch(() => {});
  }

  async function unlockAllVideos() {
    for (const video of videoEls) {
      video.muted = false;
      video.volume = 1;
      try {
        await video.play();
        video.pause();
        video.currentTime = 0;
      } catch (_) {
        video.muted = true;
      }
    }
  }

  function pauseAllVideos() {
    videoEls.forEach((v) => {
      v.pause();
      v.currentTime = 0;
    });
    videoPlanes.forEach((p) => p.setAttribute("visible", false));
    unmuteBtn.classList.add("hidden");
    activeTargetIndex = null;
  }

  async function playVideoAt(index) {
    const video = videoEls[index];
    const plane = videoPlanes[index];
    if (!video || !plane) return;

    pauseAllVideos();
    activeTargetIndex = index;
    plane.setAttribute("visible", true);
    video.muted = false;
    video.volume = 1;

    try {
      await video.play();
      unmuteBtn.classList.add("hidden");
    } catch (_) {
      video.muted = true;
      try {
        await video.play();
        unmuteBtn.classList.remove("hidden");
      } catch (err) {
        console.error("Video play failed:", err);
      }
    }
  }

  function buildScene(cfg) {
    const targets = cfg.targets || [];
    if (!targets.length || !cfg.mindFile) {
      throw new Error("No AR targets configured");
    }

    const mindUrl = cacheBust(cfg.mindFile);
    const assetsVideos = targets
      .map(
        (t, i) =>
          `<video id="ar-video-${i}" src="${cacheBust(t.video)}" preload="auto" loop playsinline webkit-playsinline crossorigin="anonymous"></video>`
      )
      .join("");

    const targetEntities = targets
      .map(
        (t, i) => `
        <a-entity id="image-target-${i}" mindar-image-target="targetIndex: ${i}">
          <a-plane
            id="video-plane-${i}"
            width="${t.planeWidth}"
            height="${t.planeHeight}"
            position="0 0 0.01"
            rotation="0 0 0"
            visible="false"
            material="shader: flat; src: #ar-video-${i}; transparent: false"
            ar-video-texture
          ></a-plane>
        </a-entity>`
      )
      .join("");

    arContainer.innerHTML = `
      <a-scene
        id="ar-scene"
        mindar-image="imageTargetSrc: ${mindUrl}; autoStart: false; filterMinCF: 0.001; filterBeta: 10; warmupTolerance: 5; missTolerance: 10; uiLoading: no; uiScanning: no; uiError: no; maxTrack: ${targets.length};"
        embedded
        color-space="sRGB"
        renderer="alpha: true; antialias: true; premultipliedAlpha: false"
        background="transparent: true"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
      >
        <a-assets timeout="10000">${assetsVideos}</a-assets>
        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
        ${targetEntities}
      </a-scene>
    `;

    arScene = document.getElementById("ar-scene");
    videoEls.length = 0;
    videoPlanes.length = 0;

    targets.forEach((_, i) => {
      videoEls.push(document.getElementById(`ar-video-${i}`));
      videoPlanes.push(document.getElementById(`video-plane-${i}`));
      bindTargetEvents(i);
    });

    arScene.addEventListener("arReady", () => {
      ensureCameraVisible();
      if (arStarted) scannerStatus.textContent = "Scanning for target…";
    });

    arScene.addEventListener("arError", (event) => {
      scannerStatus.textContent = "Camera error — reload and allow access.";
      showToast("Camera failed. Reload and allow camera access.");
      startBtn.disabled = false;
      startBtn.textContent = "Start Scanner";
      console.error("MindAR error:", event.detail);
    });
  }

  function bindTargetEvents(index) {
    const entity = document.getElementById(`image-target-${index}`);
    entity.addEventListener("targetFound", () => {
      if (!arStarted) return;
      scannerUi.classList.add("hidden");
      foundBadge.classList.remove("hidden");
      playVideoAt(index);
    });
    entity.addEventListener("targetLost", () => {
      if (activeTargetIndex !== index) return;
      scannerUi.classList.remove("hidden");
      foundBadge.classList.add("hidden");
      scannerStatus.textContent = "Target lost — scan again…";
      pauseAllVideos();
    });
  }

  async function startScanner() {
    if (startBtn.disabled) return;
    startBtn.disabled = true;
    startBtn.textContent = "Starting camera…";

    startScreen.classList.add("hidden");
    scannerUi.classList.remove("hidden");
    arStarted = true;
    setAppHeight();

    await unlockAllVideos();

    const startMindAR = () => getArSystem()?.start();
    if (arScene.hasLoaded) {
      startMindAR();
    } else {
      arScene.addEventListener("loaded", startMindAR, { once: true });
    }
  }

  unmuteBtn.addEventListener("click", async () => {
    if (activeTargetIndex === null) return;
    const video = videoEls[activeTargetIndex];
    video.muted = false;
    video.volume = 1;
    try {
      await video.play();
      unmuteBtn.classList.add("hidden");
    } catch (_) {
      showToast("Tap again to enable sound.");
    }
  });

  startBtn.addEventListener("click", startScanner);

  async function init() {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Config unavailable");
      config = await res.json();
      if (!config.targets?.length) throw new Error("No targets configured");
      buildScene(config);
      loadingScreen.classList.add("hidden");
      startScreen.classList.remove("hidden");
    } catch (err) {
      console.error(err);
      loadingScreen.querySelector(".start-desc").textContent =
        "Failed to load AR content. Check admin panel has targets.";
      showToast("Could not load AR config.");
    }
  }

  init();
})();
