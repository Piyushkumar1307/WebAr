// Keeps the video texture in sync with the playing frame (fixes black/invisible plane)
AFRAME.registerComponent("ar-video-texture", {
  init: function () {
    const src = this.el.getAttribute("material")?.src;
    this.video =
      typeof src === "string"
        ? document.querySelector(src)
        : src?.tagName === "VIDEO"
          ? src
          : null;
  },
  tick: function () {
    if (!this.video || this.video.paused || this.video.readyState < 2) return;
    const mesh = this.el.getObject3D("mesh");
    if (mesh?.material?.map) {
      mesh.material.map.needsUpdate = true;
    }
  },
});
