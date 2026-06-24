import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 16px',
        height: 52,
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      <span style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: 16,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {title}
      </span>
      {description && (
        <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          — {description}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }} />
      {action && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {action}
        </div>
      )}
    </header>
  )
}

interface ChipProps {
  onClick?: () => void
  primary?: boolean
  children: ReactNode
}

export function Chip({ onClick, primary, children }: ChipProps) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11, fontWeight: primary ? 600 : 500,
        padding: '5px 10px',
        borderRadius: 99,
        border: `1px solid ${primary ? 'var(--lime)' : 'var(--border-2)'}`,
        background: primary ? 'var(--lime)' : 'transparent',
        color: primary ? '#080C0A' : 'var(--text-2)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 5,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}
