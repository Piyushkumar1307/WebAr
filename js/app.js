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
  let imageTarget = null;
  let videoPlane = null;
  let videoEl = null;
  let config = null;
  let arStarted = false;
  let arSystem = null;
  let toastTimer = null;
  let audioUnlocked = false;

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

  async function unlockAudio() {
    if (!videoEl) return;
    videoEl.muted = false;
    videoEl.volume = 1;
    try {
      await videoEl.play();
      videoEl.pause();
      videoEl.currentTime = 0;
      audioUnlocked = true;
      unmuteBtn.classList.add("hidden");
    } catch (_) {
      audioUnlocked = false;
    }
  }

  async function playVideoWithSound() {
    if (!videoEl) return;
    videoEl.muted = false;
    videoEl.volume = 1;
    videoPlane.setAttribute("visible", true);

    try {
      await videoEl.play();
      unmuteBtn.classList.add("hidden");
    } catch (_) {
      videoEl.muted = true;
      try {
        await videoEl.play();
        unmuteBtn.classList.remove("hidden");
      } catch (err) {
        console.error("Video play failed:", err);
      }
    }
  }

  function pauseVideo() {
    if (!videoEl) return;
    videoPlane.setAttribute("visible", false);
    videoEl.pause();
    videoEl.currentTime = 0;
    unmuteBtn.classList.add("hidden");
  }

  function buildScene(cfg) {
    const mindUrl = cacheBust(cfg.mindFile);
    const videoUrl = cacheBust(cfg.video);

    arContainer.innerHTML = `
      <a-scene
        id="ar-scene"
        mindar-image="imageTargetSrc: ${mindUrl}; autoStart: false; filterMinCF: 0.001; filterBeta: 10; warmupTolerance: 5; missTolerance: 10; uiLoading: no; uiScanning: no; uiError: no;"
        embedded
        color-space="sRGB"
        renderer="alpha: true; antialias: true; premultipliedAlpha: false"
        background="transparent: true"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
      >
        <a-assets timeout="10000">
          <video
            id="ar-video"
            src="${videoUrl}"
            preload="auto"
            loop
            playsinline
            webkit-playsinline
            crossorigin="anonymous"
          ></video>
        </a-assets>
        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
        <a-entity id="image-target" mindar-image-target="targetIndex: 0">
          <a-plane
            id="video-plane"
            width="${cfg.planeWidth}"
            height="${cfg.planeHeight}"
            position="0 0 0.01"
            rotation="0 0 0"
            visible="false"
            material="shader: flat; src: #ar-video; transparent: false"
            ar-video-texture
          ></a-plane>
        </a-entity>
      </a-scene>
    `;

    arScene = document.getElementById("ar-scene");
    imageTarget = document.getElementById("image-target");
    videoPlane = document.getElementById("video-plane");
    videoEl = document.getElementById("ar-video");

    bindSceneEvents();
  }

  function bindSceneEvents() {
    imageTarget.addEventListener("targetFound", () => {
      if (!arStarted) return;
      scannerUi.classList.add("hidden");
      foundBadge.classList.remove("hidden");
      playVideoWithSound();
    });

    imageTarget.addEventListener("targetLost", () => {
      scannerUi.classList.remove("hidden");
      foundBadge.classList.add("hidden");
      scannerStatus.textContent = "Target lost — scan again…";
      pauseVideo();
    });

    arScene.addEventListener("arReady", () => {
      ensureCameraVisible();
      if (arStarted) {
        scannerStatus.textContent = "Scanning for target…";
      }
    });

    arScene.addEventListener("arError", (event) => {
      scannerStatus.textContent = "Camera error — reload and allow access.";
      showToast("Camera failed. Reload and allow camera access.");
      startBtn.disabled = false;
      startBtn.textContent = "Start Scanner";
      console.error("MindAR error:", event.detail);
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

    await unlockAudio();
    videoPlane.setAttribute("material", "shader: flat; src: #ar-video; transparent: false");

    const startMindAR = () => getArSystem()?.start();
    if (arScene.hasLoaded) {
      startMindAR();
    } else {
      arScene.addEventListener("loaded", startMindAR, { once: true });
    }
  }

  unmuteBtn.addEventListener("click", async () => {
    videoEl.muted = false;
    videoEl.volume = 1;
    try {
      await videoEl.play();
      audioUnlocked = true;
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
      buildScene(config);
      loadingScreen.classList.add("hidden");
      startScreen.classList.remove("hidden");
    } catch (err) {
      console.error(err);
      loadingScreen.querySelector(".start-desc").textContent =
        "Failed to load. Run npm start and open http://localhost:3000";
      showToast("Could not load AR config. Use npm start to run the server.");
    }
  }

  init();
})();
