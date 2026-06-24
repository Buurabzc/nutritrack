import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, UtensilsCrossed, CalendarDays,
  MessageSquare, Settings, Activity, Dumbbell, Timer, Plus
} from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'

const mobileNavLeft = [
  { icon: LayoutDashboard, to: '/',     label: 'Ana' },
  { icon: CalendarDays,    to: '/plan', label: 'Plan' },
]

const mobileNavRight = [
  { icon: Activity,      to: '/body', label: 'Vücut' },
  { icon: MessageSquare, to: '/ai',   label: 'AI' },
]

const desktopBottom = [
  { icon: Activity,  to: '/body',     label: 'Vücut Takibi' },
  { icon: Settings,  to: '/settings', label: 'Ayarlar' },
]

const desktopTop = [
  { icon: LayoutDashboard, to: '/',          label: 'Dashboard' },
  { icon: UtensilsCrossed, to: '/meals',     label: 'Öğünler' },
  { icon: CalendarDays,    to: '/plan',      label: 'Haftalık Plan' },
  { icon: MessageSquare,   to: '/ai',        label: 'AI Asistan' },
  { icon: Dumbbell,        to: '/exercise',  label: 'Egzersiz' },
  { icon: Timer,           to: '/fasting',   label: 'Oruç' },
]

function MobileNavItem({ icon: Icon, to, label }: { icon: typeof LayoutDashboard; to: string; label: string }) {
  return (
    <NavLink key={to} to={to} end={to === '/'} style={{ textDecoration: 'none', flex: 1 }}>
      {({ isActive }) => (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          padding: '6px 4px',
          color: isActive ? 'var(--lime)' : 'var(--text-3)',
        }}>
          <Icon size={20} />
          <span style={{ fontSize: 9, fontWeight: isActive ? 600 : 400, letterSpacing: '0.01em' }}>
            {label}
          </span>
        </div>
      )}
    </NavLink>
  )
}

export function Sidebar() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()

  if (isMobile) {
    return (
      <nav style={{
        flexShrink: 0,
        height: 'calc(60px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--surface-1)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        zIndex: 100,
      }}>
        {mobileNavLeft.map(item => <MobileNavItem key={item.to} {...item} />)}

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/meals', { state: { autoOpenAdd: true } })}
            aria-label="Öğün ekle"
            style={{
              width: 50, height: 50, borderRadius: '50%',
              background: 'var(--lime)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--bg)', cursor: 'pointer',
              marginTop: -22,
              boxShadow: '0 4px 14px rgba(200,240,118,0.35)',
            }}
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        </div>

        {mobileNavRight.map(item => <MobileNavItem key={item.to} {...item} />)}
      </nav>
    )
  }

  return (
    <nav
      style={{
        width: 60,
        background: 'var(--surface-1)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 0',
        gap: 4,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 34, height: 34,
          background: 'var(--lime)',
          borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 14,
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M10 2C6.5 2 4 5 4 8.5c0 4 3 7 6 9.5 3-2.5 6-5.5 6-9.5C16 5 13.5 2 10 2z" fill="#080C0A"/>
          <path d="M10 6v8M7 9l3-3 3 3" stroke="#080C0A" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>

      {desktopTop.map(({ icon: Icon, to, label }) => (
        <NavLink key={to} to={to} end={to === '/'} title={label} style={{ textDecoration: 'none' }}>
          {({ isActive }) => (
            <div
              style={{
                width: 38, height: 38,
                borderRadius: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isActive ? 'var(--lime)' : 'var(--text-3)',
                background: isActive ? 'var(--lime-bg)' : 'transparent',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.15s',
              }}
            >
              {isActive && (
                <span style={{
                  position: 'absolute', left: -1, top: '50%',
                  transform: 'translateY(-50%)',
                  width: 3, height: 16,
                  background: 'var(--lime)',
                  borderRadius: '0 3px 3px 0',
                }} />
              )}
              <Icon size={18} />
            </div>
          )}
        </NavLink>
      ))}

      <div style={{ flex: 1 }} />

      {desktopBottom.map(({ icon: Icon, to, label }) => (
        <NavLink key={to} to={to} title={label} style={{ textDecoration: 'none' }}>
          {({ isActive }) => (
            <div
              style={{
                width: 38, height: 38,
                borderRadius: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isActive ? 'var(--lime)' : 'var(--text-3)',
                background: isActive ? 'var(--lime-bg)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={18} />
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
