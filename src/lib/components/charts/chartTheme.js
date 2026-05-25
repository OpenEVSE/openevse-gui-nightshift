function v(name, fallback) {
  if (typeof document === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return raw || fallback
}

export function readChartTheme() {
  return {
    accent:   v('--accent',   '#0f9b98'),
    charging: v('--charging', '#0f9b98'),
    warning:  v('--warning',  '#d98a2b'),
    axisText: v('--text-dim', '#5b6b72'),
    grid:     v('--border',   '#e4eae9'),
  }
}
