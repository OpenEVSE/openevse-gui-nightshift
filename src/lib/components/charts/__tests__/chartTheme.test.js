import { describe, it, expect, beforeEach } from 'vitest'
import { readChartTheme } from '../chartTheme.js'

function setVar(name, value) {
  document.documentElement.style.setProperty(name, value)
}

describe('readChartTheme', () => {
  beforeEach(() => {
    setVar('--accent',   '#0f9b98')
    setVar('--charging', '#0f9b98')
    setVar('--warning',  '#d98a2b')
    setVar('--text-dim', '#5b6b72')
    setVar('--border',   '#e4eae9')
  })

  it('resolves the documented CSS vars', () => {
    const t = readChartTheme()
    expect(t.accent).toBe('#0f9b98')
    expect(t.charging).toBe('#0f9b98')
    expect(t.warning).toBe('#d98a2b')
    expect(t.axisText).toBe('#5b6b72')
    expect(t.grid).toBe('#e4eae9')
  })

  it('falls back to safe defaults when a var is missing', () => {
    setVar('--accent', '')
    const t = readChartTheme()
    expect(t.accent).toMatch(/^#/)
  })
})
