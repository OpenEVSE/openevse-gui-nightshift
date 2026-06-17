// src/lib/charts/lazy.js
// False only in the charts-stripped (JuiceBox) build (`VITE_CHARTS=false`).
// Used for nav/route gating. NOTE: the dynamic import() guards in the lazy
// wrappers inline `import.meta.env.VITE_CHARTS !== 'false'` directly rather than
// importing this const, so esbuild can constant-fold and drop the import in the
// stripped build.
export const CHARTS_ENABLED = import.meta.env.VITE_CHARTS !== 'false'
