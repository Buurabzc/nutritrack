import type { ReactNode } from 'react'

interface CalorieRingProps {
  pct: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  centerTop: ReactNode
  centerBottom?: ReactNode
}

export function CalorieRing({
  pct,
  size = 90,
  strokeWidth = 8,
  color = 'var(--lime)',
  trackColor = 'var(--surface-3)',
  centerTop,
  centerBottom,
}: CalorieRingProps) {
  const R = size / 2 - strokeWidth / 2
  const C = 2 * Math.PI * R
  const offset = C * (1 - Math.min(Math.max(pct, 0), 1))
  const cxy = size / 2

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle cx={cxy} cy={cxy} r={R} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={cxy} cy={cxy} r={R}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${cxy}px ${cxy}px`, transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: size * 0.2, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          {centerTop}
        </div>
        {centerBottom != null && (
          <div style={{ fontSize: size * 0.1, color: 'var(--text-3)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {centerBottom}
          </div>
        )}
      </div>
    </div>
  )
}
