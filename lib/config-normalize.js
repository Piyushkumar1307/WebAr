/** Normalize legacy single-target config into multi-target format. */
function normalizeConfig(raw) {
  if (raw.targets && Array.isArray(raw.targets)) {
    return {
      mindFile: raw.mindFile || "",
      targets: raw.targets.map((t, i) => ({
        id: t.id || `legacy-${i}`,
        name: t.name || `Target ${i + 1}`,
        targetImage: t.targetImage,
        video: t.video,
        planeWidth: t.planeWidth ?? 1,
        planeHeight: t.planeHeight ?? 1,
        targetIndex: t.targetIndex ?? i,
        createdAt: t.createdAt || raw.updatedAt || new Date().toISOString(),
      })),
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
  }

  if (raw.targetImage && raw.video) {
    return {
      mindFile: raw.mindFile || "",
      targets: [
        {
          id: "legacy-0",
          name: "Target 1",
          targetImage: raw.targetImage,
          video: raw.video,
          planeWidth: raw.planeWidth ?? 1,
          planeHeight: raw.planeHeight ?? 1,
          targetIndex: 0,
          createdAt: raw.updatedAt || new Date().toISOString(),
        },
      ],
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
  }

  return { mindFile: "", targets: [], updatedAt: new Date().toISOString() };
}

module.exports = { normalizeConfig };
