import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { PageHeader, Chip } from '@/components/layout/PageHeader'
import { useIsMobile } from '@/hooks/useIsMobile'

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MEAL_TYPES = [
  { key: 'kahvalti', label: 'Kahvaltı' },
  { key: 'ogle',     label: 'Öğle' },
  { key: 'aksam',    label: 'Akşam' },
  { key: 'atistirma', label: 'Atıştırma' },
]
const MEAL_COLORS: Record<string, { bg: string; text: string }> = {
  kahvalti:  { bg: 'rgba(212,168,67,.18)',  text: '#D4A843' },
  ogle:      { bg: 'rgba(200,240,118,.14)', text: '#8FB84D' },
  aksam:     { bg: 'rgba(91,159,224,.18)',  text: '#5B9FE0' },
  atistirma: { bg: 'rgba(155,130,216,.18)', text: '#9B82D8' },
}

function getMonday(offset: number): Date {
  const today = new Date()
  const day = today.getDay()
  const diff = (day === 0 ? -6 : 1 - day) + offset * 7
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

export default function WeeklyPlan() {
  const [weekOffset, setWeekOffset] = useState(0)
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const monday = getMonday(weekOffset)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const weekLabel = `${days[0].getDate()}–${days[6].getDate()} ${days[0].toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}`

  const queries = days.map(d => {
    const iso = d.toISOString().split('T')[0]
    return useQuery({
      queryKey: ['meals-day', iso],
      queryFn: () => api.get('/meals', { params: { target_date: iso } }).then(r => r.data),
    })
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Haftalık Plan"
        action={
          isMobile ? (
            <Chip primary onClick={() => navigate('/ai')}><Plus size={13} /> Ekle</Chip>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Chip onClick={() => navigate('/ai')}><MessageSquare size={13} /> AI ile plan oluştur</Chip>
              <Chip primary onClick={() => navigate('/ai')}><Plus size={13} /> Öğün ekle</Chip>
            </div>
          )
        }
      />

      {/* Hafta navigasyonu */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft size={15} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{weekLabel}</span>
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronRight size={15} />
        </button>
        <div style={{ flex: 1 }} />
        {weekOffset === 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Bu hafta</span>
        )}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '68px repeat(7, 1fr)',
          gap: 1,
          background: 'var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
          minWidth: 640,
        }}>
          {/* Header */}
          <div style={{ background: 'var(--surface-1)', padding: '12px 8px' }} />
          {days.map((d, i) => {
            const isToday = d.getTime() === today.getTime()
            const meals = queries[i].data ?? []
            const total = meals.reduce((s: number, m: any) => s + m.calories, 0)
            return (
              <div key={i} style={{
                background: 'var(--surface-1)',
                padding: '12px 10px 10px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: isToday ? 'var(--lime)' : 'var(--text-3)' }}>
                  {DAYS[i]}
                </span>
                <span style={{ fontSize: 20, fontFamily: "'DM Serif Display', serif", color: isToday ? 'var(--lime)' : 'var(--text)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {d.getDate()}
                </span>
                {total > 0 && (
                  <span style={{ fontSize: 9, color: 'var(--text-3)' }}>
                    {total.toFixed(0)}
                  </span>
                )}
              </div>
            )
          })}

          {/* Öğün satırları */}
          {MEAL_TYPES.map(({ key, label }) => (
            <>
              {/* Satır etiketi */}
              <div key={`label-${key}`} style={{
                background: 'var(--surface-1)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 4, padding: '10px 6px',
              }}>
                <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.3 }}>
                  {label}
                </span>
              </div>

              {/* Hücreler */}
              {days.map((d, i) => {
                const isToday = d.getTime() === today.getTime()
                const meals = (queries[i].data ?? []).filter((m: any) => m.meal_type === key)

                return (
                  <div
                    key={`${key}-${i}`}
                    onClick={() => navigate('/ai')}
                    style={{
                      background: isToday ? 'rgba(200,240,118,.04)' : 'var(--surface-2)',
                      padding: 6, minHeight: 70, cursor: 'pointer',
                      transition: 'background 0.12s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = isToday ? 'rgba(200,240,118,.04)' : 'var(--surface-2)')}
                  >
                    {meals.length > 0 ? meals.map((m: any) => (
                      <div key={m.id} style={{
                        borderRadius: 6, padding: '5px 7px', marginBottom: 3,
                        background: MEAL_COLORS[key]?.bg,
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: MEAL_COLORS[key]?.text }}>
                          {m.food_name}
                        </div>
                        <div style={{ fontSize: 9, opacity: 0.65, marginTop: 1, color: MEAL_COLORS[key]?.text }}>
                          {m.calories.toFixed(0)} kcal
                        </div>
                      </div>
                    )) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)', opacity: 0, transition: 'opacity 0.15s' }}
                        className="gc-empty">
                        <Plus size={14} />
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  )
}
