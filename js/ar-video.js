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

AFRAME.registerComponent("smooth-anchor", {
  schema: {
    factor: { type: "number", default: 0.2 },
  },
  init: function () {
    this.rawPosition = new AFRAME.THREE.Vector3();
    this.rawQuaternion = new AFRAME.THREE.Quaternion();
    this.smoothedPosition = new AFRAME.THREE.Vector3().copy(this.el.object3D.position);
    this.smoothedQuaternion = new AFRAME.THREE.Quaternion().copy(this.el.object3D.quaternion);
  },
  tick: function () {
    this.rawPosition.copy(this.el.object3D.position);
    this.rawQuaternion.copy(this.el.object3D.quaternion);

    this.smoothedPosition.lerp(this.rawPosition, this.data.factor);
    this.smoothedQuaternion.slerp(this.rawQuaternion, this.data.factor);

    this.el.object3D.position.copy(this.smoothedPosition);
    this.el.object3D.quaternion.copy(this.smoothedQuaternion);
    this.el.object3D.matrixNeedsUpdate = true;
  },
});
