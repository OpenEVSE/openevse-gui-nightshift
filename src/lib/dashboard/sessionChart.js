// Pure transforms turning /energy/raw samples into chart-ready data.
// Sample shape: { ts:<unix s>, a:<amps>, t:<°C>, e:<energy>, s:<soc %, -1 = none> }

/** Keep only samples within `sessionElapsed` seconds of the newest sample.
 *  Falls back to all samples when elapsed is absent/0 (e.g. flaky firmware). */
export function clipToSession(samples, sessionElapsed) {
  if (!Array.isArray(samples) || samples.length === 0) return []
  if (!Number.isFinite(sessionElapsed) || sessionElapsed <= 0) return samples
  // /energy/raw returns samples in chronological order, so the last is newest.
  const start = samples[samples.length - 1].ts - sessionElapsed
  return samples.filter((s) => s.ts >= start)
}

/** kW for one sample = amps * volts / 1000. Null when voltage/amps unusable. */
export function sampleKw(sample, voltage) {
  if (!Number.isFinite(voltage) || voltage <= 0) return null
  if (!Number.isFinite(sample?.a)) return null
  return (sample.a * voltage) / 1000
}

/** SOC percent, or null for the -1 "no vehicle source" sentinel. */
export function socOrNull(sample) {
  return Number.isFinite(sample?.s) && sample.s >= 0 ? sample.s : null
}

/** [relativeSeconds[], soc[], kw[]] for uPlot, x measured from the first sample. */
export function toChartData(samples, voltage) {
  const x0 = samples.length ? samples[0].ts : 0
  const x = samples.map((s) => s.ts - x0)
  const soc = samples.map(socOrNull)
  const kw = samples.map((s) => sampleKw(s, voltage))
  return [x, soc, kw]
}

/** Right-axis ceiling for the kW line: peak + 1 headroom, floored at 8. */
export function kwAxisMax(kwValues) {
  const finite = (kwValues || []).filter((v) => Number.isFinite(v))
  const peak = finite.length ? Math.max(...finite) : 0
  return Math.max(8, Math.ceil(peak + 1))
}

/** Format x-axis tick (relative seconds) as "0", "25m", or "1h05". */
export function fmtSessionTime(sec) {
  let m = Math.round(sec / 60)
  if (m === 0) return '0'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h${String(m % 60).padStart(2, '0')}`
}
