import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TrendingDown, TrendingUp, Trash2, Check, Target, Calendar, Activity } from 'lucide-react'
import { api } from '@/api/client'
import { PageHeader, Chip } from '@/components/layout/PageHeader'
import { useIsMobile } from '@/hooks/useIsMobile'

// ── Types ──────────────────────────────────────────────────────────────────
interface BodyEntry {
  id: number
  date: string
  weight_kg: number | null
  body_fat_pct: number | null
  waist_cm: number | null
  hip_cm: number | null
  chest_cm: number | null
  bmi: number | null
  note: string | null
}
interface GoalProfile {
  height_cm: number | null
  target_weight_kg: number | null
  goal_mode: string | null
  tdee: number | null
  weekly_change_kg: number | null
  current_weight_kg: number | null
  bmr: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────
function bmiCategory(bmi: number) {
  if (bmi < 18.5) return { label: 'Zayıf',        color: '#5B9FE0' }
  if (bmi < 25)   return { label: 'Normal',        color: '#C8F076' }
  if (bmi < 30)   return { label: 'Fazla kilolu',  color: '#D48B44' }
  return              { label: 'Obez',             color: '#C96B4A' }
}
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}
function splitWeight(w: number | null): [string, string] {
  if (w == null) return ['—', '']
  const s = w.toFixed(1)
  const [whole, dec] = s.split('.')
  return [whole, dec]
}

// ── WeightChart ─────────────────────────────────────────────────────────────
const RANGE_TABS = [
  { label: '1A', days: 30 },
  { label: '3A', days: 90 },
  { label: '6A', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'Tümü', days: 3650 },
]

const CW = 600, CH = 240
const PL = 40, PR = 590, PT = 20, PB = 220

function WeightChart({ entries, targetWeight, profile }: {
  entries: BodyEntry[]
  targetWeight: number | null
  profile: GoalProfile | undefined
}) {
  const [range, setRange] = useState(90)
  const [tooltip, setTooltip] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const isMobile = useIsMobile()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - range)
  const filtered = entries.filter(e => e.weight_kg != null && new Date(e.date + 'T00:00:00') >= cutoff)

  const weights = filtered.map(e => e.weight_kg!)
  const dataMin = weights.length ? Math.min(...weights) : 70
  const dataMax = weights.length ? Math.max(...weights) : 85
  const pad = Math.max(2, (dataMax - dataMin) * 0.2)
  const minW = Math.floor(dataMin - pad)
  const maxW = Math.ceil(dataMax + pad)
  const rng = maxW - minW || 1

  const xScale = (i: number) => filtered.length > 1
    ? PL + (i / (filtered.length - 1)) * (PR - PL)
    : (PL + PR) / 2
  const yScale = (w: number) => PT + (PB - PT) * (1 - (w - minW) / rng)

  const points = filtered.map((e, i) => ({ x: xScale(i), y: yScale(e.weight_kg!), e }))

  const movingAvg = filtered.map((_, i) => {
    const win = filtered.slice(Math.max(0, i - 6), i + 1)
    const avg = win.reduce((s, x) => s + x.weight_kg!, 0) / win.length
    return { x: xScale(i), y: yScale(avg) }
  })

  const yGrids = Array.from({ length: 6 }, (_, i) => {
    const val = maxW - (i / 5) * rng
    return { val: Math.round(val), y: yScale(val) }
  })

  const labelCount = Math.min(5, Math.max(2, filtered.length))
  const xLabelIdxs = filtered.length > 1
    ? [...new Set(Array.from({ length: labelCount }, (_, i) =>
        Math.round(i * (filtered.length - 1) / (labelCount - 1))
      ))]
    : filtered.length === 1 ? [0] : []

  const handleMouseMove = useCallback((ev: React.MouseEvent<SVGSVGElement>) => {
    if (!points.length) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const svgX = (ev.clientX - rect.left) / rect.width * CW
    const idx = points.reduce((best, p, i) =>
      Math.abs(p.x - svgX) < Math.abs(points[best].x - svgX) ? i : best, 0)
    setTooltip(idx)
  }, [points])

  // Stats from all entries
  const oldestE = entries.find(e => e.weight_kg != null)
  const currentE = [...entries].reverse().find(e => e.weight_kg != null)
  const lowestE = entries.reduce<BodyEntry | null>((min, e) =>
    e.weight_kg != null && (min == null || e.weight_kg < (min.weight_kg ?? Infinity)) ? e : min, null)
  const currentW = currentE?.weight_kg ?? null
  const startW = oldestE?.weight_kg ?? null

  const elapsedDays = oldestE
    ? Math.max(1, Math.round((Date.now() - new Date(oldestE.date + 'T00:00:00').getTime()) / 86_400_000))
    : 0
  const totalChange = currentW != null && startW != null ? currentW - startW : null
  const actualRate = elapsedDays > 7 && totalChange != null
    ? Math.abs(totalChange) / (elapsedDays / 7)
    : Math.abs(profile?.weekly_change_kg ?? 0.5)
  const goalMode = profile?.goal_mode ?? 'lose'
  const targetRate = profile?.weekly_change_kg ?? null
  const remaining = currentW != null && targetWeight != null ? Math.abs(currentW - targetWeight) : null
  const weeksNeeded = remaining != null && actualRate > 0 ? remaining / actualRate : null
  const etaDate = weeksNeeded != null ? new Date(Date.now() + weeksNeeded * 7 * 86_400_000) : null

  // Delta within selected range
  const firstFiltered = filtered[0]?.weight_kg
  const lastFiltered = filtered[filtered.length - 1]?.weight_kg
  const deltaRange = firstFiltered != null && lastFiltered != null && filtered.length > 1
    ? lastFiltered - firstFiltered : null

  const last = points.length ? points[points.length - 1] : null
  const polyStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const avgStr = movingAvg.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const tY = targetWeight != null ? yScale(targetWeight) : null
  const tBandTop = targetWeight != null ? yScale(targetWeight + 0.5) : null
  const tBandBot = targetWeight != null ? yScale(targetWeight - 0.5) : null
  const showTarget = tY != null && tY >= PT - 20 && tY <= PB + 20

  const lowestDate = lowestE?.date === currentE?.date ? 'Bugün'
    : lowestE ? fmtDate(lowestE.date) : '—'
  const rateSign = goalMode === 'gain' ? '+' : '−'

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 20px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Kilo takibi</span>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
            {filtered.length > 0
              ? `${fmtDate(filtered[0].date)} – ${fmtDate(filtered[filtered.length - 1].date)} · ${filtered.length} ölçüm`
              : 'Kayıt yok'}
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 40, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {currentW != null ? currentW.toFixed(1) : '—'}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>kg</span>
            {deltaRange != null && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
                padding: '3px 9px', borderRadius: 99,
                background: 'rgba(200,240,118,0.1)', border: '1px solid rgba(200,240,118,0.2)',
                color: 'var(--lime)',
              }}>
                {deltaRange < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                {deltaRange > 0 ? '+' : ''}{deltaRange.toFixed(1)} kg
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGE_TABS.map(t => (
            <button key={t.days} onClick={() => setRange(t.days)} style={{
              fontSize: 10, fontWeight: 500, padding: '4px 11px', borderRadius: 99,
              cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${range === t.days ? '#8FB84D' : 'var(--border-2)'}`,
              background: range === t.days ? 'var(--surface-3)' : 'transparent',
              color: range === t.days ? 'var(--lime)' : 'var(--text-3)',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {filtered.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-3)', fontSize: 13 }}>
          Bu aralıkta kayıt yok
        </div>
      ) : (
        <div style={{ padding: '20px 20px 0', position: 'relative' }}>
          {tooltip !== null && points[tooltip] && (() => {
            const p = points[tooltip]
            const leftPct = (p.x / CW) * 100
            const prevE = tooltip > 0 ? points[tooltip - 1].e.weight_kg : null
            const delta = prevE != null ? p.e.weight_kg! - prevE : null
            return (
              <div style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: 40,
                transform: leftPct > 65 ? 'translate(-110%, 0)' : 'translate(10px, 0)',
                background: 'var(--surface-3)', border: '1px solid var(--border-2)',
                borderRadius: 9, padding: '8px 12px', zIndex: 5, pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}>
                <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3 }}>
                  {new Date(p.e.date + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}
                </div>
                <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 17, color: 'var(--lime)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {p.e.weight_kg?.toFixed(1)} kg
                </div>
                {delta != null && (
                  <div style={{ fontSize: 9, color: 'var(--lime-dim)', marginTop: 3 }}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)} kg öncekinden
                  </div>
                )}
              </div>
            )
          })()}

          <svg
            ref={svgRef}
            viewBox={`0 0 ${CW} ${CH}`}
            width="100%"
            style={{ display: 'block' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Y grid + labels */}
            {yGrids.map(({ val, y }) => (
              <g key={val}>
                <line x1={PL} y1={y} x2={PR} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <text x={PL - 8} y={y + 4} fill="#4A5449" fontSize="10" fontFamily="Inter,sans-serif" textAnchor="end">{val}</text>
              </g>
            ))}

            {/* Hedef bandı */}
            {showTarget && tBandTop != null && tBandBot != null && (
              <rect x={PL} y={Math.min(tBandTop, tBandBot)} width={PR - PL}
                height={Math.abs(tBandBot - tBandTop)} fill="rgba(200,240,118,0.05)" />
            )}

            {/* Hedef kesikli çizgi */}
            {showTarget && tY != null && (
              <>
                <line x1={PL} y1={tY} x2={PR} y2={tY} stroke="#8FB84D" strokeWidth="1.2" strokeDasharray="5 4" />
                <text x={PR - 2} y={tY - 5} fill="#8FB84D" fontSize="9" fontFamily="Inter,sans-serif" textAnchor="end">
                  Hedef {targetWeight} kg
                </text>
              </>
            )}

            {/* 7 günlük hareketli ortalama */}
            {movingAvg.length > 1 && (
              <polyline points={avgStr} fill="none" stroke="rgba(200,240,118,0.25)"
                strokeWidth="1.5" strokeLinecap="round" />
            )}

            {/* Ana çizgi */}
            {points.length > 1 && (
              <polyline points={polyStr} fill="none" stroke="#C8F076"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Veri noktaları */}
            {points.map((p, i) => {
              const isHovered = i === tooltip
              const isLast = i === points.length - 1
              if (isHovered || isLast) return null
              return (
                <circle key={i} cx={p.x} cy={p.y} r="3.2"
                  fill="var(--surface-1)" stroke="#C8F076" strokeWidth="1.6" />
              )
            })}

            {/* Son nokta */}
            {last && tooltip !== points.length - 1 && (
              <>
                <circle cx={last.x} cy={last.y} r="8.5" fill="none" stroke="rgba(200,240,118,0.35)" strokeWidth="1.5" />
                <circle cx={last.x} cy={last.y} r="4.5" fill="#C8F076" />
              </>
            )}

            {/* Hover noktası */}
            {tooltip !== null && points[tooltip] && (() => {
              const hp = points[tooltip]
              const isLast = tooltip === points.length - 1
              return (
                <>
                  <line x1={hp.x} y1={PT} x2={hp.x} y2={PB} stroke="rgba(200,240,118,0.2)" strokeWidth="1" />
                  <circle cx={hp.x} cy={hp.y} r={isLast ? 8.5 : 9} fill="none"
                    stroke="rgba(200,240,118,0.35)" strokeWidth="1.5" />
                  <circle cx={hp.x} cy={hp.y} r={isLast ? 4.5 : 5} fill="#C8F076" />
                </>
              )
            })()}

            {/* X etiketleri */}
            {xLabelIdxs.map((i, li) => {
              const isLast = li === xLabelIdxs.length - 1
              return (
                <text key={i} x={points[i]?.x ?? 0} y={CH - 3}
                  fill={isLast ? '#C8F076' : '#4A5449'}
                  fontSize="10" fontFamily="Inter,sans-serif" textAnchor="middle">
                  {isLast ? 'Bugün' : fmtDate(filtered[i].date)}
                </text>
              )
            })}
          </svg>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px 14px', flexWrap: 'wrap' }}>
        {[
          { el: <div style={{ width: 16, height: 2, borderRadius: 2, background: 'var(--lime)' }} />, label: 'Günlük ölçüm' },
          { el: <div style={{ width: 16, height: 2, borderRadius: 2, background: 'rgba(200,240,118,0.25)' }} />, label: '7 günlük ortalama' },
          ...(targetWeight ? [
            { el: <div style={{ width: 16, height: 0, borderTop: '2px dashed #8FB84D' }} />, label: 'Hedef çizgisi' },
            { el: <div style={{ width: 16, height: 8, borderRadius: 2, background: 'rgba(200,240,118,0.07)', border: '1px solid rgba(200,240,118,0.12)' }} />, label: 'Hedef bandı (±0.5 kg)' },
          ] : []),
        ].map(({ el, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-2)' }}>
            {el} {label}
          </div>
        ))}
      </div>

      {/* Stats şeridi */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 1, background: 'var(--border)', borderTop: '1px solid var(--border)' }}>
        {[
          {
            label: 'Başlangıç',
            val: startW != null ? startW.toFixed(1) : '—',
            unit: startW != null ? ' kg' : '',
            sub: oldestE ? fmtDate(oldestE.date) : '—',
            good: false,
          },
          {
            label: 'Haftalık hız',
            val: `${rateSign}${actualRate.toFixed(2)}`,
            unit: ' kg/hf',
            sub: targetRate ? `Hedef: ${rateSign}${Math.abs(targetRate).toFixed(1)} kg/hf` : '',
            good: true,
          },
          {
            label: 'En düşük',
            val: lowestE?.weight_kg != null ? lowestE.weight_kg.toFixed(1) : '—',
            unit: lowestE?.weight_kg != null ? ' kg' : '',
            sub: lowestDate,
            good: false,
          },
          {
            label: 'Tahmini varış',
            val: etaDate ? `~${etaDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}` : '—',
            unit: '',
            sub: weeksNeeded != null ? `${Math.round(weeksNeeded)} hafta kaldı` : '',
            good: etaDate != null,
          },
        ].map(({ label, val, unit, sub, good }) => (
          <div key={label} style={{ background: 'var(--surface-1)', padding: '12px 16px' }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5 }}>
              {label}
            </div>
            <div>
              <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: good ? 'var(--lime)' : 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {val}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{unit}</span>
            </div>
            {sub && <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 3 }}>{sub}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function BodyTracker() {
  const qc = useQueryClient()

  const [fDate,   setFDate]   = useState(new Date().toISOString().slice(0, 10))
  const [fWeight, setFWeight] = useState('')
  const [fFat,    setFFat]    = useState('')
  const [fWaist,  setFWaist]  = useState('')
  const [fHip,    setFHip]    = useState('')
  const [fChest,  setFChest]  = useState('')
  const [fNote,   setFNote]   = useState('')
  const [saved,   setSaved]   = useState(false)

  // ── Queries ──
  const { data: entries = [] } = useQuery<BodyEntry[]>({
    queryKey: ['body-entries'],
    queryFn: () => api.get('/body?limit=365').then(r => r.data ?? []),
    refetchInterval: 30_000,
  })
  const { data: profile } = useQuery<GoalProfile>({
    queryKey: ['goal-profile'],
    queryFn: () => api.get('/goals/profile').then(r => r.data),
  })

  // ── Mutations ──
  const addEntry = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/body', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['body-entries'] })
      qc.invalidateQueries({ queryKey: ['body-latest'] })
      setFWeight(''); setFFat(''); setFWaist(''); setFHip(''); setFChest(''); setFNote('')
      setFDate(new Date().toISOString().slice(0, 10))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })
  const deleteEntry = useMutation({
    mutationFn: (id: number) => api.delete(`/body/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['body-entries'] })
      qc.invalidateQueries({ queryKey: ['body-latest'] })
    },
  })

  const handleSave = () => {
    if (!fWeight && !fFat && !fWaist) return
    addEntry.mutate({
      date: fDate,
      weight_kg:    fWeight ? parseFloat(fWeight) : null,
      body_fat_pct: fFat    ? parseFloat(fFat)    : null,
      waist_cm:     fWaist  ? parseFloat(fWaist)  : null,
      hip_cm:       fHip    ? parseFloat(fHip)    : null,
      chest_cm:     fChest  ? parseFloat(fChest)  : null,
      note:         fNote   || null,
    })
  }

  // ── Derived ──
  const sortedDesc = [...entries].sort((a, b) => b.date.localeCompare(a.date))
  const sortedAsc  = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const latest  = sortedDesc[0] ?? null
  const prev    = sortedDesc[1] ?? null
  const oldest  = sortedAsc[0]  ?? null

  const heightCm     = profile?.height_cm ?? null
  const targetWeight = profile?.target_weight_kg ?? null
  const weeklyRate   = profile?.weekly_change_kg ?? 0.5

  const currentW = latest?.weight_kg ?? null
  const startW   = oldest?.weight_kg ?? null

  const totalChange = currentW != null && startW != null ? currentW - startW : null
  const deltaFromPrev = currentW != null && prev?.weight_kg != null ? currentW - prev.weight_kg : null

  const remaining = currentW != null && targetWeight != null ? Math.abs(currentW - targetWeight) : null
  const totalNeeded = startW != null && targetWeight != null ? Math.abs(startW - targetWeight) : null
  const goalPct = totalNeeded && totalNeeded > 0 && totalChange != null
    ? Math.max(0, Math.min(100, Math.round(Math.abs(totalChange) / totalNeeded * 100)))
    : 0

  const elapsedDays = oldest
    ? Math.max(0, Math.round((Date.now() - new Date(oldest.date + 'T00:00:00').getTime()) / 86_400_000))
    : 0
  const actualWeeklyRate = elapsedDays > 7 && totalChange != null
    ? Math.abs(totalChange) / (elapsedDays / 7)
    : weeklyRate

  const weeksNeeded = remaining && weeklyRate > 0 ? remaining / weeklyRate : null
  const etaDate = weeksNeeded
    ? new Date(Date.now() + weeksNeeded * 7 * 86_400_000)
    : null

  const previewBmi = fWeight && heightCm
    ? parseFloat(fWeight) / ((heightCm / 100) ** 2)
    : null

  const isMobile = useIsMobile()

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface-1)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 16,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, letterSpacing: '0.09em',
    textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8,
  }
  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '7px 10px', fontSize: 13,
    color: 'var(--text-1)', fontFamily: 'inherit', width: '100%', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="Vücut Takibi"
        description={isMobile ? undefined : `— Son güncelleme: ${latest ? fmtDate(latest.date) : 'kayıt yok'}`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip primary onClick={() => {
              document.getElementById('bt-form-weight')?.focus()
            }}>
              <span style={{ fontSize: 14 }}>+</span> Ölçüm ekle
            </Chip>
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 20, display: 'flex', flexDirection: 'column', gap: 16, scrollbarWidth: 'none' }}>

        {/* ── 4 Metrik kart ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}>
          {/* Şu anki ağırlık */}
          <div style={cardStyle}>
            <div style={labelStyle}>Şu anki ağırlık</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              {(() => { const [w, d] = splitWeight(currentW); return (
                <>
                  <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, lineHeight: 1, letterSpacing: '-0.02em' }}>{w}</span>
                  {d && <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 16, color: 'var(--text-2)' }}>.{d}</span>}
                  <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 3 }}>kg</span>
                </>
              )})()}
            </div>
            {deltaFromPrev != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginTop: 6, color: deltaFromPrev < 0 ? '#C8F076' : '#C96B4A' }}>
                {deltaFromPrev < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                {deltaFromPrev > 0 ? '+' : ''}{deltaFromPrev.toFixed(1)} kg son ölçümden
              </div>
            )}
          </div>

          {/* Hedef ağırlık */}
          <div style={cardStyle}>
            <div style={labelStyle}>Hedef ağırlık</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              {(() => { const [w, d] = splitWeight(targetWeight); return (
                <>
                  <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, lineHeight: 1, letterSpacing: '-0.02em' }}>{w}</span>
                  {d && <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 16, color: 'var(--text-2)' }}>.{d}</span>}
                  <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 3 }}>kg</span>
                </>
              )})()}
            </div>
            {remaining != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginTop: 6, color: 'var(--text-3)' }}>
                <Target size={12} /> {remaining.toFixed(1)} kg kaldı
              </div>
            )}
            {remaining != null && totalNeeded != null && totalNeeded > 0 && (
              <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
                <div style={{ height: '100%', borderRadius: 99, background: 'var(--lime)', width: `${goalPct}%`, transition: 'width 0.8s' }} />
              </div>
            )}
          </div>

          {/* BMI */}
          <div style={cardStyle}>
            <div style={labelStyle}>Vücut kitle indeksi</div>
            {latest?.bmi != null ? (() => {
              const cat = bmiCategory(latest.bmi!)
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    {(() => { const [w, d] = splitWeight(latest.bmi); return (
                      <>
                        <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, lineHeight: 1, letterSpacing: '-0.02em' }}>{w}</span>
                        {d && <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 16, color: 'var(--text-2)' }}>.{d}</span>}
                      </>
                    )})()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginTop: 6, color: cat.color }}>
                    <Check size={12} /> {cat.label}
                  </div>
                </>
              )
            })() : (
              <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--text-3)' }}>—</div>
            )}
          </div>

          {/* Toplam değişim */}
          <div style={cardStyle}>
            <div style={labelStyle}>Toplam değişim</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, lineHeight: 1, letterSpacing: '-0.02em', color: totalChange != null && totalChange < 0 ? 'var(--lime)' : totalChange != null && totalChange > 0 ? '#C96B4A' : 'var(--text-1)' }}>
                {totalChange != null ? `${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)}` : '—'}
              </span>
              {totalChange != null && <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 3 }}>kg</span>}
            </div>
            {elapsedDays > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginTop: 6, color: 'var(--text-3)' }}>
                <Calendar size={12} /> {elapsedDays} günde
              </div>
            )}
          </div>
        </div>

        {/* ── Orta: grafik + form ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: 16 }}>

          <WeightChart entries={sortedAsc} targetWeight={targetWeight} profile={profile} />

          {/* Ölçüm formu */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>Yeni ölçüm</div>

            <div>
              <div style={labelStyle}>Tarih</div>
              <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <div style={labelStyle}>Ağırlık</div>
              <div style={{ position: 'relative' }}>
                <input id="bt-form-weight" type="number" step="0.1" value={fWeight}
                  onChange={e => setFWeight(e.target.value)}
                  placeholder="78.4" style={{ ...inputStyle, paddingRight: 36 }} />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)' }}>kg</span>
              </div>
              {previewBmi && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '4px 10px', borderRadius: 99, background: 'rgba(200,240,118,0.1)', border: '1px solid rgba(200,240,118,0.2)', color: 'var(--lime)', marginTop: 6 }}>
                  <Activity size={12} />
                  BMI: {previewBmi.toFixed(1)} — {bmiCategory(previewBmi).label}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={labelStyle}>Bel</div>
                <div style={{ position: 'relative' }}>
                  <input type="number" step="0.1" value={fWaist} onChange={e => setFWaist(e.target.value)}
                    placeholder="84" style={{ ...inputStyle, paddingRight: 30 }} />
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)' }}>cm</span>
                </div>
              </div>
              <div>
                <div style={labelStyle}>Kalça</div>
                <div style={{ position: 'relative' }}>
                  <input type="number" step="0.1" value={fHip} onChange={e => setFHip(e.target.value)}
                    placeholder="98" style={{ ...inputStyle, paddingRight: 30 }} />
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)' }}>cm</span>
                </div>
              </div>
            </div>

            <div>
              <div style={labelStyle}>Vücut yağ %</div>
              <div style={{ position: 'relative' }}>
                <input type="number" step="0.1" value={fFat} onChange={e => setFFat(e.target.value)}
                  placeholder="İsteğe bağlı" style={{ ...inputStyle, paddingRight: 24 }} />
                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)' }}>%</span>
              </div>
            </div>

            {heightCm && (
              <div style={{ fontSize: 10, color: 'var(--text-3)', lineHeight: 1.5 }}>
                Boy bilgisi ayarlardan alınıyor: {heightCm} cm
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={(!fWeight && !fFat && !fWaist) || addEntry.isPending}
              style={{
                width: '100%', padding: 9, borderRadius: 9, border: 'none',
                background: fWeight || fFat || fWaist ? 'var(--lime)' : 'var(--surface-3)',
                color: fWeight || fFat || fWaist ? '#080C0A' : 'var(--text-3)',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                cursor: fWeight || fFat || fWaist ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: addEntry.isPending ? 0.6 : 1,
              }}
            >
              <Check size={14} />
              {saved ? 'Kaydedildi!' : addEntry.isPending ? 'Kaydediliyor…' : 'Ölçümü kaydet'}
            </button>
          </div>
        </div>

        {/* ── Alt satır ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 16, paddingBottom: 20 }}>

          {/* Ölçüm geçmişi */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>Ölçüm geçmişi</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {sortedDesc.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>Kayıt yok</div>
              )}
              {sortedDesc.slice(0, 8).map((e, i) => {
                const nextE = sortedDesc[i + 1]
                const delta = e.weight_kg != null && nextE?.weight_kg != null
                  ? e.weight_kg - nextE.weight_kg : null
                const isToday = e.date === new Date().toISOString().slice(0, 10)
                return (
                  <div key={e.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 8, cursor: 'default', transition: 'background 0.12s' }}
                    onMouseEnter={ev => ev.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: isToday ? 'var(--lime)' : 'var(--text-3)' }} />
                    <div style={{ fontSize: 11, color: 'var(--text-3)', minWidth: 54 }}>
                      {isToday ? 'Bugün' : fmtDate(e.date)}
                    </div>
                    <div style={{ flex: 1, fontFamily: "'DM Serif Display',serif", fontSize: 16, letterSpacing: '-0.02em' }}>
                      {e.weight_kg != null ? (
                        <>
                          {Math.floor(e.weight_kg)}
                          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>.{(e.weight_kg % 1).toFixed(1).slice(2)} kg</span>
                        </>
                      ) : '—'}
                    </div>
                    {delta != null && (
                      <div style={{ fontSize: 10, color: delta < 0 ? '#C8F076' : delta > 0 ? '#C96B4A' : 'var(--text-3)' }}>
                        {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                      </div>
                    )}
                    {i === 0 && (
                      <button onClick={() => deleteEntry.mutate(e.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2, display: 'flex', opacity: 0, transition: 'opacity 0.1s' }}
                        onMouseEnter={ev => { ev.currentTarget.style.opacity = '1'; ev.currentTarget.style.color = '#f87171' }}
                        onMouseLeave={ev => { ev.currentTarget.style.opacity = '0'; ev.currentTarget.style.color = 'var(--text-3)' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Vücut ölçüleri */}
          <div style={cardStyle}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)', marginBottom: 12 }}>Vücut ölçüleri</div>
            {(() => {
              const measures = [
                { label: 'Bel', icon: '📏', val: latest?.waist_cm, unit: 'cm', prev: prev?.waist_cm },
                { label: 'Kalça', icon: '📐', val: latest?.hip_cm, unit: 'cm', prev: prev?.hip_cm },
                { label: 'Vücut yağı', icon: '⚡', val: latest?.body_fat_pct, unit: '%', prev: prev?.body_fat_pct },
                {
                  label: 'Bel/Kalça',
                  icon: '⚖️',
                  val: latest?.waist_cm && latest?.hip_cm ? parseFloat((latest.waist_cm / latest.hip_cm).toFixed(2)) : null,
                  unit: '',
                  prev: prev?.waist_cm && prev?.hip_cm ? prev.waist_cm / prev.hip_cm : null,
                },
                { label: 'BMI', icon: '📊', val: latest?.bmi, unit: '', prev: prev?.bmi },
              ]
              return measures.map(({ label, icon, val, unit, prev: pv }) => {
                const change = val != null && pv != null ? val - pv : null
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
                      {icon}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', flex: 1 }}>{label}</div>
                    <div style={{ textAlign: 'right' }}>
                      <div>
                        <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 16, letterSpacing: '-0.02em' }}>
                          {val != null ? val : '—'}
                        </span>
                        {val != null && unit && <span style={{ fontSize: 10, color: 'var(--text-3)' }}> {unit}</span>}
                      </div>
                      {change != null && (
                        <div style={{ fontSize: 10, color: change < 0 ? '#C8F076' : change > 0 ? '#C96B4A' : 'var(--text-3)', marginTop: 1 }}>
                          {change > 0 ? '+' : ''}{change.toFixed(1)} {unit}
                        </div>
                      )}
                      {label === 'BMI' && val != null && (
                        <div style={{ fontSize: 10, color: bmiCategory(val as number).color, marginTop: 1 }}>
                          {bmiCategory(val as number).label}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            })()}
          </div>

          {/* Hedefe ilerleme */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>Hedefe ilerleme</div>

            {currentW && targetWeight && startW ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, background: 'var(--lime)', width: `${goalPct}%`, transition: 'width 0.8s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)' }}>
                      <span>Başlangıç {startW.toFixed(1)} kg</span>
                      <span>Hedef {targetWeight} kg</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: 'var(--lime)', letterSpacing: '-0.02em', lineHeight: 1 }}>{goalPct}%</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>tamamlandı</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Kaybedilen', val: totalChange != null ? `${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)} kg` : '—', accent: totalChange != null && totalChange < 0 },
                    { label: 'Kalan', val: remaining != null ? `${remaining.toFixed(1)} kg` : '—', accent: false },
                    { label: 'Haftalık hız', val: `${actualWeeklyRate.toFixed(2)} kg`, accent: true },
                    { label: 'Geçen süre', val: `${elapsedDays} gün`, accent: false },
                  ].map(({ label, val, accent }) => (
                    <div key={label} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: accent ? 'var(--lime)' : 'var(--text-1)' }}>{val}</div>
                    </div>
                  ))}
                </div>

                {etaDate && remaining != null && remaining > 0.5 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid rgba(200,240,118,0.1)' }}>
                    <Calendar size={14} style={{ color: '#8FB84D', flexShrink: 0 }} />
                    <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4 }}>
                      Bu hızla hedefe{' '}
                      <span style={{ color: 'var(--lime)', fontWeight: 500 }}>
                        ~{etaDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>'de ulaşırsın
                    </div>
                  </div>
                )}

                {remaining != null && remaining < 0.5 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(200,240,118,0.08)', borderRadius: 8, border: '1px solid rgba(200,240,118,0.2)' }}>
                    <span style={{ fontSize: 16 }}>🎯</span>
                    <span style={{ fontSize: 12, color: 'var(--lime)', fontWeight: 500 }}>Hedefe ulaştın!</span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
                Hedef kilo ve boy bilgilerini{' '}
                <span style={{ color: 'var(--lime)', cursor: 'pointer' }}
                  onClick={() => window.location.hash = '/settings'}>Ayarlar</span>'dan gir.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
