import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Send, RefreshCw, WifiOff, User, UtensilsCrossed, Dumbbell, Timer, Settings } from 'lucide-react'
import { api } from '@/api/client'
import { PageHeader, Chip } from '@/components/layout/PageHeader'
import { useAIStore } from '@/stores/aiStore'
import { useIsMobile } from '@/hooks/useIsMobile'
import { CalorieRing } from '@/components/dashboard/CalorieRing'

const QUICK_ACCESS = [
  { icon: UtensilsCrossed, label: 'Öğünler',  to: '/meals' },
  { icon: Dumbbell,        label: 'Egzersiz', to: '/exercise' },
  { icon: Timer,           label: 'Oruç',     to: '/fasting' },
  { icon: Settings,        label: 'Ayarlar',  to: '/settings' },
]

// ── Constants ────────────────────────────────────────────────────────────
const MEAL_TYPES = [
  { id: 'kahvalti',  label: 'Kahvaltı',  color: '#D4A843' },
  { id: 'ogle',      label: 'Öğle',      color: '#C8F076' },
  { id: 'aksam',     label: 'Akşam',     color: '#5B9FE0' },
  { id: 'atistirma', label: 'Atıştırma', color: '#9B82D8' },
]

const MACRO_CONFIG = [
  { key: 'protein', label: 'Protein',     goalKey: 'protein_g', color: '#C8F076' },
  { key: 'carbs',   label: 'Karbonhidrat',goalKey: 'carbs_g',   color: '#5B9FE0' },
  { key: 'fat',     label: 'Yağ',         goalKey: 'fat_g',     color: '#D48B44' },
  { key: 'fiber',   label: 'Lif',         goalKey: 'fiber_g',   color: '#9B82D8' },
]

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

interface BodyEntry {
  id: number
  date: string
  weight_kg: number | null
  waist_cm?: number | null
  hip_cm?: number | null
}

const RANGE_TABS_DASH = [
  { label: '1A', days: 30 },
  { label: '3A', days: 90 },
  { label: '6A', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'Tümü', days: 3650 },
]

// ── Water drop component ─────────────────────────────────────────────────
function WaterDrop({ state, onClick }: { state: 'filled' | 'next' | 'empty'; onClick: () => void }) {
  const DROP = "M16 2 C16 2 3 16 3 24 a13 13 0 0 0 26 0 C29 16 16 2 16 2Z"
  return (
    <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
      <svg viewBox="0 0 32 38" fill="none" style={{ width: 28, height: 34 }}>
        {state === 'filled' && (
          <>
            <path d={DROP} fill="#5B9FE0" />
            <path d={DROP} fill="rgba(255,255,255,0.10)" />
          </>
        )}
        {state === 'next' && (
          <>
            <path d={DROP} fill="none" stroke="rgba(91,159,224,0.5)" strokeWidth="1.5" />
            <clipPath id="hc">
              <rect x="0" y="20" width="32" height="18" />
            </clipPath>
            <path d={DROP} fill="rgba(91,159,224,0.3)" clipPath="url(#hc)" />
          </>
        )}
        {state === 'empty' && (
          <path d={DROP} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
        )}
      </svg>
      <span style={{ fontSize: 9, color: state === 'filled' ? '#5B9FE0' : state === 'next' ? 'rgba(91,159,224,0.5)' : 'var(--text-3)' }}>
        250
      </span>
    </div>
  )
}

// ── Wave circle component ─────────────────────────────────────────────────
function WaveCircle({ pct }: { pct: number }) {
  const fillH = `${Math.min(100, pct)}%`
  return (
    <div style={{ position: 'relative', width: 72, height: 72, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: fillH, background: '#5B9FE0', transition: 'height 0.8s ease' }} />
      <svg
        viewBox="0 0 100 16"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          bottom: fillH,
          left: -4,
          width: 'calc(100% + 8px)',
          height: 16,
          animation: 'waterwave 3s linear infinite',
        }}
      >
        <path d="M0 8 Q12.5 0 25 8 Q37.5 16 50 8 Q62.5 0 75 8 Q87.5 16 100 8 Q112.5 0 125 8 Q137.5 16 150 8 Q162.5 0 175 8 Q187.5 16 200 8 L200 16 L0 16Z"
          fill="rgba(91,159,224,0.35)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
        <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, color: 'var(--text-1)', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {Math.round(pct)}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 1 }}>%</span>
      </div>
    </div>
  )
}

// ── DashboardWeightChart ─────────────────────────────────────────────────
function DashboardWeightChart({
  entries,
  targetWeight,
}: {
  entries: BodyEntry[]
  targetWeight: number | null
}) {
  const [days, setDays] = useState(90)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const isMobile = useIsMobile()

  const allSorted = [...entries]
    .filter((e): e is BodyEntry & { weight_kg: number } => e.weight_kg != null)
    .sort((a, b) => a.date.localeCompare(b.date))

  const cutoff = new Date(Date.now() - days * 86_400_000)
  const pts = days >= 3650 ? allSorted : allSorted.filter(e => new Date(e.date) >= cutoff)

  if (pts.length === 0) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 16 }}>
          Vücut takibi
        </div>
        <div style={{ color: 'var(--text-3)', fontSize: 13, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
          <span>Kilo kaydı yok.</span>
        </div>
      </div>
    )
  }

  const PL = 40, PR = 590, PT = 20, PB = 220
  const weights    = pts.map(e => e.weight_kg)
  const allWeights = allSorted.map(e => e.weight_kg)
  const minCand    = targetWeight != null ? Math.min(...weights, targetWeight) : Math.min(...weights)
  const maxCand    = targetWeight != null ? Math.max(...weights, targetWeight) : Math.max(...weights)
  const pad  = Math.max((maxCand - minCand) * 0.18, 0.8)
  const yMin = Math.floor((minCand - pad) * 2) / 2
  const yMax = Math.ceil((maxCand  + pad) * 2) / 2
  const yRange = yMax - yMin

  const toY = (w: number) => PB - ((w - yMin) / yRange) * (PB - PT)
  const toX = (i: number) =>
    pts.length === 1 ? (PL + PR) / 2 : PL + (i / (pts.length - 1)) * (PR - PL)

  const yStep = yRange <= 4 ? 0.5 : yRange <= 10 ? 1 : 2
  const yTicks: number[] = []
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax + 0.01; v = +(v + yStep).toFixed(10))
    yTicks.push(+v.toFixed(2))

  const movAvg = pts.map((_, i) => {
    const w = pts.slice(Math.max(0, i - 6), i + 1)
    return w.reduce((s, e) => s + e.weight_kg, 0) / w.length
  })

  const linePoints = pts.map((e, i) => `${toX(i)},${toY(e.weight_kg)}`).join(' ')
  const avgPoints  = pts.map((_, i) => `${toX(i)},${toY(movAvg[i])}`).join(' ')
  const areaPath   = `M ${pts.map((e, i) => `${toX(i)},${toY(e.weight_kg)}`).join(' L ')} L ${toX(pts.length - 1)},${PB} L ${toX(0)},${PB} Z`

  const xCount = Math.min(5, pts.length)
  const xIdxs  = Array.from({ length: xCount }, (_, i) =>
    xCount === 1 ? 0 : Math.round(i * (pts.length - 1) / (xCount - 1))
  )

  const hovered = hoverIdx !== null ? pts[hoverIdx] : null
  const hovPrev = hoverIdx !== null && hoverIdx > 0 ? pts[hoverIdx - 1] : null
  const tooltipRight = hoverIdx !== null && toX(hoverIdx) > (PL + PR) / 2

  const first    = allSorted[0]
  const last     = allSorted[allSorted.length - 1]
  const minW     = Math.min(...allWeights)
  const minEntry = allSorted.find(e => e.weight_kg === minW)

  const rangeDelta = pts.length >= 2 ? pts[pts.length - 1].weight_kg - pts[0].weight_kg : null
  const firstD = new Date(pts[0].date), lastD = new Date(pts[pts.length - 1].date)
  const weeksDiff  = (lastD.getTime() - firstD.getTime()) / (7 * 86_400_000)
  const weeklyRate = weeksDiff > 0.5 ? (pts[pts.length - 1].weight_kg - pts[0].weight_kg) / weeksDiff : 0

  let etaStr: string | null = null, etaWeeks: number | null = null
  if (targetWeight != null && last?.weight_kg && weeklyRate < -0.01) {
    const rem = last.weight_kg - targetWeight
    if (rem > 0) {
      etaWeeks = Math.ceil(rem / Math.abs(weeklyRate))
      const eta = new Date(); eta.setDate(eta.getDate() + etaWeeks * 7)
      etaStr = eta.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })
    }
  }

  const subLine = pts.length >= 2
    ? `${firstD.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} – ${lastD.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} · ${pts.length} ölçüm`
    : `${lastD.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} · ${pts.length} ölçüm`

  const stats = [
    { label: 'Başlangıç',      val: first ? first.weight_kg.toFixed(1) : '—',   unit: first ? 'kg' : '',         sub: first ? new Date(first.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '',                         good: false },
    { label: 'Haftalık hız',   val: weeksDiff > 0.5 ? `${weeklyRate > 0 ? '+' : ''}${weeklyRate.toFixed(2)}` : '—', unit: weeksDiff > 0.5 ? 'kg/hf' : '', sub: targetWeight != null ? 'Hedef: −0.5 kg/hf' : '',                                   good: weeklyRate < -0.01 },
    { label: 'En düşük',       val: `${minW.toFixed(1)}`,                         unit: 'kg',                      sub: minEntry ? new Date(minEntry.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '',                   good: false },
    { label: 'Tahmini varış',  val: etaStr ?? '—',                                unit: '',                        sub: etaWeeks ? `${etaWeeks} hafta kaldı` : (targetWeight != null && last.weight_kg <= targetWeight ? 'Hedefe ulaşıldı!' : ''), good: etaStr !== null },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
            Vücut takibi
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{subLine}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 36, color: 'var(--text)', lineHeight: 1, letterSpacing: '-0.03em' }}>
              {last.weight_kg.toFixed(1)}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>kg</span>
            {rangeDelta !== null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 99, background: 'rgba(200,240,118,0.10)', border: '1px solid rgba(200,240,118,0.2)', color: 'var(--lime)' }}>
                {rangeDelta > 0 ? '↑' : '↓'} {Math.abs(rangeDelta).toFixed(1)} kg
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {RANGE_TABS_DASH.map(t => (
            <button key={t.label} onClick={() => setDays(t.days)} style={{
              fontSize: 10, fontWeight: 500, padding: '4px 10px', borderRadius: 99,
              border: `1px solid ${days === t.days ? '#8FB84D' : 'rgba(255,255,255,0.12)'}`,
              color: days === t.days ? 'var(--lime)' : 'var(--text-3)',
              background: days === t.days ? 'var(--surface-3)' : 'transparent',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div
        style={{ padding: '6px 20px 0', position: 'relative', flex: 1 }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {hovered && hoverIdx !== null && (
          <div style={{
            position: 'absolute',
            left: tooltipRight
              ? `calc(${(toX(hoverIdx) / 600) * 100}% - 18px)`
              : `calc(${(toX(hoverIdx) / 600) * 100}% + 26px)`,
            top: 40,
            transform: tooltipRight ? 'translateX(-100%)' : 'none',
            background: 'var(--surface-3)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 9, padding: '8px 12px', zIndex: 5, pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3 }}>
              {new Date(hovered.date).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17, color: 'var(--lime)', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {hovered.weight_kg.toFixed(1)} kg
            </div>
            {hovPrev && (
              <div style={{ fontSize: 9, color: '#8FB84D', marginTop: 3 }}>
                {(hovered.weight_kg - hovPrev.weight_kg) > 0 ? '+' : ''}
                {(hovered.weight_kg - hovPrev.weight_kg).toFixed(1)} kg önceki ölçümden
              </div>
            )}
          </div>
        )}

        <svg
          width="100%"
          viewBox="0 0 600 240"
          style={{ display: 'block', cursor: 'crosshair', overflow: 'visible' }}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const svgX = ((e.clientX - rect.left) / rect.width) * 600
            let closest = 0, minDist = Infinity
            pts.forEach((_, i) => { const d = Math.abs(toX(i) - svgX); if (d < minDist) { minDist = d; closest = i } })
            setHoverIdx(closest)
          }}
        >
          <defs>
            <linearGradient id="wg-dash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C8F076" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#C8F076" stopOpacity="0" />
            </linearGradient>
          </defs>

          <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
            {yTicks.map(v => <line key={v} x1={PL} y1={toY(v)} x2={PR} y2={toY(v)} />)}
          </g>

          <g fill="#4A5449" fontSize="10" fontFamily="Inter,sans-serif" textAnchor="end">
            {yTicks.map(v => (
              <text key={v} x={PL - 8} y={toY(v) + 4}>{v % 1 === 0 ? v : v.toFixed(1)}</text>
            ))}
          </g>

          {targetWeight != null && (
            <>
              <rect x={PL} y={toY(targetWeight + 0.5)} width={PR - PL}
                height={Math.abs(toY(targetWeight - 0.5) - toY(targetWeight + 0.5))} fill="rgba(200,240,118,0.05)" />
              <line x1={PL} y1={toY(targetWeight)} x2={PR} y2={toY(targetWeight)}
                stroke="#8FB84D" strokeWidth="1.2" strokeDasharray="5 4" />
              <text x={PR - 4} y={toY(targetWeight) - 4} fill="#8FB84D" fontSize="9"
                fontFamily="Inter,sans-serif" textAnchor="end">Hedef {targetWeight} kg</text>
            </>
          )}

          {pts.length >= 3 && (
            <polyline points={avgPoints} fill="none" stroke="rgba(200,240,118,0.25)"
              strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}

          {pts.length >= 2 && <path d={areaPath} fill="url(#wg-dash)" />}

          {pts.length >= 2 && (
            <polyline points={linePoints} fill="none" stroke="#C8F076"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          )}

          <g fill="var(--surface-1)" stroke="#C8F076" strokeWidth="1.6">
            {pts.map((e, i) => {
              if (i === pts.length - 1 || i === hoverIdx) return null
              return <circle key={i} cx={toX(i)} cy={toY(e.weight_kg)} r="3.2" vectorEffect="non-scaling-stroke" />
            })}
          </g>

          {hoverIdx !== pts.length - 1 && (
            <>
              <circle cx={toX(pts.length - 1)} cy={toY(pts[pts.length - 1].weight_kg)}
                r="8.5" fill="none" stroke="rgba(200,240,118,0.35)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <circle cx={toX(pts.length - 1)} cy={toY(pts[pts.length - 1].weight_kg)} r="4.5" fill="#C8F076" />
            </>
          )}

          {hoverIdx !== null && pts[hoverIdx] && (
            <>
              <line x1={toX(hoverIdx)} y1={PT} x2={toX(hoverIdx)} y2={PB} stroke="rgba(200,240,118,0.2)" strokeWidth="1" />
              <circle cx={toX(hoverIdx)} cy={toY(pts[hoverIdx].weight_kg)} r="9" fill="none" stroke="rgba(200,240,118,0.3)" strokeWidth="1.5" />
              <circle cx={toX(hoverIdx)} cy={toY(pts[hoverIdx].weight_kg)} r="5" fill="#C8F076" />
            </>
          )}

          <g fill="#4A5449" fontSize="10" fontFamily="Inter,sans-serif" textAnchor="middle">
            {xIdxs.map(i => (
              <text key={i} x={toX(i)} y={PB + 17} fill={i === pts.length - 1 ? '#C8F076' : '#4A5449'}>
                {i === pts.length - 1
                  ? 'Bugün'
                  : new Date(pts[i].date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
              </text>
            ))}
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 20px 8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-2)' }}>
          <div style={{ width: 16, height: 2, borderRadius: 2, background: 'var(--lime)', flexShrink: 0 }} /> Günlük ölçüm
        </div>
        {pts.length >= 3 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-2)' }}>
            <div style={{ width: 16, height: 2, borderRadius: 2, background: 'rgba(200,240,118,0.25)', flexShrink: 0 }} /> 7 günlük ort.
          </div>
        )}
        {targetWeight != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-2)' }}>
            <div style={{ width: 16, height: 0, borderTop: '2px dashed #8FB84D', flexShrink: 0 }} /> Hedef
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 1, background: 'var(--border)', borderTop: '1px solid var(--border)' }}>
        {stats.map(({ label, val, unit, sub, good }) => (
          <div key={label} style={{ background: 'var(--surface-1)', padding: '10px 14px' }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>
              {label}
            </div>
            <div>
              <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: good ? 'var(--lime)' : 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {val}
              </span>
              {unit && <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'Inter,sans-serif' }}> {unit}</span>}
            </div>
            {sub && <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [aiInput, setAiInput] = useState('')
  const [aiReply, setAiReply] = useState<string | null>(null)
  const [aiSending, setAiSending] = useState(false)
  const { selectedProvider, selectedModel, addMessage } = useAIStore()

  // ── Queries ──
  const { data: today } = useQuery({
    queryKey: ['today'],
    queryFn: () => api.get('/meals/summary/today').then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: week = [] } = useQuery({
    queryKey: ['weekly'],
    queryFn: () => api.get('/meals/summary/weekly').then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data: bodyEntries = [] } = useQuery<BodyEntry[]>({
    queryKey: ['body-entries'],
    queryFn: () => api.get('/body?limit=500').then(r => r.data ?? []),
  })

  const { data: goalProfile } = useQuery({
    queryKey: ['goal-profile'],
    queryFn: () => api.get('/goals/profile').then(r => r.data),
  })

  const { data: syncStatus } = useQuery({
    queryKey: ['syncthing'],
    queryFn: () => api.get('/ai/syncthing/status').then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: streakData } = useQuery({
    queryKey: ['streak'],
    queryFn: () => api.get('/meals/streak').then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data: providers = [] } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: () => api.get('/ai/providers').then(r => r.data),
    refetchInterval: 60_000,
  })

  const addWater = useMutation({
    mutationFn: (ml: number) => api.post('/meals/water', { amount_ml: ml }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today'] })
      qc.invalidateQueries({ queryKey: ['water-entries'] })
    },
  })

  const { data: waterEntries = [] } = useQuery<{ id: number; amount_ml: number; logged_at: string }[]>({
    queryKey: ['water-entries'],
    queryFn: () => api.get('/meals/water/today').then(r => r.data?.entries ?? []),
    refetchInterval: 30_000,
  })

  const { data: activeFasting } = useQuery({
    queryKey: ['fasting-active'],
    queryFn: () => api.get('/fasting/active').then(r => r.data),
    refetchInterval: 60_000,
  })

  // ── Derived data ──
  const totals  = today?.totals     ?? { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  const goals   = today?.goals      ?? { calories: 2100, protein_g: 120, carbs_g: 240, fat_g: 70, fiber_g: 30, water_ml: 2500 }
  const byType: Record<string, any[]> = today?.meals_by_type ?? {}
  const mealTimes: Record<string, string> = today?.meal_times ?? {}
  const waterMl = today?.water_ml ?? 0
  const streak  = streakData?.streak ?? 0

  const calBurned = today?.calories_burned ?? 0
  const calNet  = totals.calories - calBurned
  const calPct  = Math.min(calNet / goals.calories * 100, 100)
  const calLeft = Math.max(goals.calories - calNet, 0)

  const activeDays = (week as any[]).filter(d => d.calories > 0)
  const avgCal = activeDays.length
    ? Math.round(activeDays.reduce((s: number, d: any) => s + d.calories, 0) / activeDays.length)
    : 0
  const overDay = (week as any[]).find((d: any) => d.calories > goals.calories)
  const overLabel = overDay
    ? DAY_LABELS[new Date(overDay.date).getDay() === 0 ? 6 : new Date(overDay.date).getDay() - 1]
    : null
  const maxCal = Math.max(...(week as any[]).map((d: any) => d.calories), goals.calories)

  const waterCups = Math.round(goals.water_ml / 250)
  const filledCups = Math.round(waterMl / 250)

  const currentProvider = (providers as any[]).find((p: any) => p.id === selectedProvider)

  const dateStr = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
  const isMobile = useIsMobile()

  // ── AI quick send ──
  const handleAiSend = async () => {
    if (!aiInput.trim() || aiSending) return
    const msg = aiInput.trim()
    setAiInput('')
    setAiSending(true)
    setAiReply(null)
    try {
      addMessage({ role: 'user', content: msg })
      const r = await api.post('/ai/chat', {
        message: msg,
        history: [],
        provider: selectedProvider,
        model: selectedModel,
        include_context: true,
      })
      setAiReply(r.data.reply)
      addMessage({ role: 'assistant', content: r.data.reply, provider: r.data.provider, tool_calls: r.data.tool_calls })
      if (r.data.tool_calls?.length) {
        qc.invalidateQueries({ queryKey: ['today'] })
        qc.invalidateQueries({ queryKey: ['weekly'] })
      }
    } catch {
      setAiReply('Bağlantı hatası.')
    }
    setAiSending(false)
  }

  // ── AI insight ──
  const aiInsight = (() => {
    if (totals.calories === 0) return 'Bugün henüz öğün eklenmedi. Ne yediğini söyle, kaydedeyim.'
    if (totals.calories >= goals.calories) return `Günlük hedefe ulaştın! ${totals.calories.toFixed(0)} kcal. Harika bir gün.`
    const pct = Math.round(totals.calories / goals.calories * 100)
    const remaining = (goals.calories - totals.calories).toFixed(0)
    if (pct < 50) return `Gün henüz erken, %${pct} hedefte. ${remaining} kcal kaldı — öğle yemeği zamanı.`
    return `%${pct} hedefte, ${remaining} kcal kaldı. Proteine dikkat et — henüz ${totals.protein.toFixed(0)}g / ${goals.protein_g}g.`
  })()

  // ── Goal info ──
  const goalModeLabel: Record<string, string> = { lose: 'Kilo ver', gain: 'Kilo al', maintain: 'Koru' }
  const goalMode = goalProfile?.goal_mode ? (goalModeLabel[goalProfile.goal_mode] ?? goalProfile.goal_mode) : null
  const tdee = goalProfile?.tdee ? Math.round(goalProfile.tdee) : null

  // ── Mobile-only derived data ──
  const greetHour = new Date().getHours()
  const greeting = greetHour < 12 ? 'Günaydın' : greetHour < 18 ? 'İyi günler' : 'İyi akşamlar'
  const dateStrShort = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  const allMealsFlat = MEAL_TYPES.flatMap(({ id, label, color }) =>
    (byType[id] ?? []).map((m: any) => ({ ...m, typeLabel: label, typeColor: color, typeTime: mealTimes[id] }))
  )
  const nextEmptyType = MEAL_TYPES.find(t => (byType[t.id] ?? []).length === 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {isMobile && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{greeting} 👋</div>
              <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, color: 'var(--text)', letterSpacing: '-0.02em', marginTop: 2 }}>
                Bugün nasılsın?
              </div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--lime-bg)', border: '1px solid rgba(200,240,118,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
            }}>
              <User size={17} style={{ color: 'var(--lime)' }} />
            </div>
          </div>

          {/* Hızlı erişim */}
          <div style={{ display: 'flex', gap: 4 }}>
            {QUICK_ACCESS.map(({ icon: Icon, label, to }) => (
              <div key={to} onClick={() => navigate(to)} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 2px', cursor: 'pointer',
              }}>
                <Icon size={17} style={{ color: 'var(--text-3)' }} />
                <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Kalori kartı */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                Günlük özet
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{dateStrShort}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <CalorieRing
                pct={calPct / 100}
                color={calNet > goals.calories ? '#D4784A' : 'var(--lime)'}
                centerTop={`%${Math.round(calPct)}`}
                centerBottom={`${calNet.toFixed(0)}/${goals.calories}`}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Tüketilen', val: `${totals.calories.toFixed(0)} kcal` },
                  { label: 'Kalan', val: `${calLeft.toFixed(0)} kcal` },
                  { label: 'Hedef', val: `${goals.calories.toLocaleString('tr-TR')} kcal` },
                  { label: 'Su', val: `${(waterMl / 1000).toFixed(1)} lt` },
                ].map(({ label, val }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-3)' }}>{label}</span>
                    <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 18 }}>
              {MACRO_CONFIG.slice(0, 3).map(({ key, label, goalKey, color }) => {
                const val = (totals as any)[key] ?? 0
                const goal = (goals as any)[goalKey] ?? 1
                const pct = Math.min(val / goal * 100, 100)
                return (
                  <div key={key}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                      {val.toFixed(0)}<span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400 }}>g</span>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 1, marginBottom: 5 }}>{label}</div>
                    <div style={{ height: 2, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Öğünler */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Öğünler</span>
              <span onClick={() => navigate('/meals')} style={{ fontSize: 11, color: 'var(--lime)', cursor: 'pointer' }}>Tümünü gör</span>
            </div>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              {allMealsFlat.length === 0 && (
                <div style={{ padding: 16, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                  Bugün henüz öğün eklenmedi.
                </div>
              )}
              {allMealsFlat.map((m: any, i: number) => (
                <div key={m.id} onClick={() => navigate('/meals')} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: m.typeColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.food_name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                      {m.typeLabel}{m.typeTime ? ` · ${m.typeTime}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                    {m.calories.toFixed(0)} kcal
                  </span>
                </div>
              ))}
            </div>
            {nextEmptyType && (
              <div
                onClick={() => navigate('/meals', { state: { autoOpenAdd: true, mealType: nextEmptyType.id } })}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  marginTop: 8, padding: '10px', borderRadius: 12,
                  border: '1.5px dashed var(--border)', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer',
                }}
              >
                <Plus size={13} /> {nextEmptyType.label} ekle
              </div>
            )}
          </div>

          {/* Su mini kart */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Su</span>
              <span onClick={() => addWater.mutate(250)} style={{ fontSize: 11, color: '#5B9FE0', cursor: 'pointer' }}>+250 ml</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <svg key={i} viewBox="0 0 32 38" fill="none" style={{ width: 16, height: 19, flexShrink: 0 }}>
                    <path
                      d="M16 2 C16 2 3 16 3 24 a13 13 0 0 0 26 0 C29 16 16 2 16 2Z"
                      fill={i < filledCups ? '#5B9FE0' : 'none'}
                      stroke={i < filledCups ? 'none' : 'rgba(91,159,224,0.3)'}
                      strokeWidth="1.5"
                    />
                  </svg>
                ))}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {(waterMl / 1000).toFixed(1)} / {(goals.water_ml / 1000).toFixed(1)} lt
              </span>
            </div>
          </div>

          {/* Bu hafta mini kart */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 }}>
              Bu hafta
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 70 }}>
              {(week as any[]).map((d: any, i: number) => {
                const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
                const isT = i === todayIdx
                const isOver = d.calories > goals.calories
                const pct = maxCal > 0 ? Math.max(d.calories / maxCal * 100, d.calories > 0 ? 4 : 0) : 0
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1, height: '100%' }}>
                    <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%', borderRadius: '3px 3px 0 0', minHeight: d.calories > 0 ? 3 : 0,
                        height: `${pct}%`,
                        background: isT ? '#C8F076' : isOver ? '#B85C38' : 'var(--surface-3)',
                      }} />
                    </div>
                    <span style={{ fontSize: 8, color: isT ? 'var(--lime)' : 'var(--text-3)', fontWeight: isT ? 600 : 400 }}>
                      {DAY_LABELS[i]}
                    </span>
                  </div>
                )
              })}
            </div>
            {(avgCal > 0 || overLabel) && (
              <div style={{ marginTop: 10, display: 'flex', gap: 12 }}>
                {avgCal > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                    Ort. <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{avgCal.toLocaleString('tr-TR')} kcal</span>
                  </span>
                )}
                {overLabel && <span style={{ fontSize: 10, color: '#B85C38' }}>▲ {overLabel} fazla</span>}
              </div>
            )}
          </div>

        </div>
      )}
      {!isMobile && (
      <>
      <PageHeader
        title="Dashboard"
        description={isMobile ? undefined : `— ${dateStr}`}
        action={
          <div style={{ display: 'flex', gap: 6 }}>
            {!isMobile && (
              <Chip onClick={() => navigate('/meals')}>
                <Search size={13} /> Besin ara
              </Chip>
            )}
            <Chip primary onClick={() => navigate('/meals')}>
              <Plus size={13} /> {isMobile ? 'Ekle' : 'Öğün ekle'}
            </Chip>
          </div>
        }
      />

      <div style={isMobile
        ? { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }
        : { display: 'grid', gridTemplateColumns: '300px 1fr', gridTemplateRows: '1fr auto', flex: 1, overflow: 'hidden' }
      }>

        {/* ── Left panel ─────────────────────────────────────────────── */}
        <aside style={isMobile
          ? { background: 'var(--surface-1)', display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border)' }
          : { background: 'var(--surface-1)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', gridRow: '1' }
        }>

          {/* Kalori */}
          <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 16 }}>
              Bugünkü kalori
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
              {/* Tube */}
              <div style={{
                width: 28, height: 110, background: 'var(--surface-2)', borderRadius: 14,
                overflow: 'hidden', position: 'relative', border: '1px solid var(--border)', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: `${calPct}%`,
                  background: totals.calories > goals.calories
                    ? 'linear-gradient(to top, #B85C38, #D4784A)'
                    : 'linear-gradient(to top, #C8F076, #8FD44A)',
                  borderRadius: 14,
                  transition: 'height 1s cubic-bezier(0.34,1.56,0.64,1)',
                }} />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: `${calPct}%`,
                  background: 'radial-gradient(ellipse at 50% 30%, rgba(200,240,118,0.3) 0%, transparent 70%)',
                  borderRadius: 14, pointerEvents: 'none',
                }} />
              </div>
              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 40, lineHeight: 1, color: totals.calories > goals.calories ? '#D4784A' : 'var(--lime)', letterSpacing: '-0.03em' }}>
                  {totals.calories.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>kcal tüketildi</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.6 }}>
                  {calLeft > 0
                    ? <><span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{calLeft.toLocaleString('tr-TR')} kcal</span> kaldı<br /></>
                    : <><span style={{ color: '#D4784A', fontWeight: 500 }}>Hedef aşıldı</span><br /></>
                  }
                  Hedef: <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{goals.calories.toLocaleString('tr-TR')} kcal</span>
                </div>
                {calBurned > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span>Yakılan: <span style={{ color: '#C96B4A', fontWeight: 500 }}>-{calBurned.toFixed(0)} kcal</span></span>
                    <span>Net: <span style={{ color: calNet > goals.calories ? '#D4784A' : 'var(--lime)', fontWeight: 500 }}>{calNet.toFixed(0)} kcal</span></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Makrolar */}
          <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 16 }}>
              Makrolar
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {MACRO_CONFIG.map(({ key, label, goalKey, color }) => {
                const val  = (totals as any)[key] ?? 0
                const goal = (goals as any)[goalKey] ?? 1
                const pct  = Math.min(val / goal * 100, 100)
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                        {val.toFixed(0)} <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>/ {goal}g</span>
                      </span>
                    </div>
                    <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: color, transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Öğün listesi */}
          <div style={{ flex: isMobile ? undefined : 1, overflowY: isMobile ? undefined : 'auto', padding: '12px 20px', scrollbarWidth: 'none' }}>
            {MEAL_TYPES.map(({ id, label, color }) => {
              const meals = byType[id] ?? []
              const time  = mealTimes[id]
              return (
                <div key={id}>
                  {/* Grup başlığı */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: meals.length ? 'var(--text-3)' : 'rgba(74,84,73,0.5)' }}>
                      {label}{time ? ` · ${time}` : ''}
                    </span>
                    {meals.length > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                        {meals.reduce((s: number, m: any) => s + m.calories, 0).toFixed(0)} kcal
                      </span>
                    )}
                  </div>

                  {meals.map((m: any) => (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 10, cursor: 'pointer', marginBottom: 2, transition: 'background 0.12s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.food_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.amount_g}g</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', minWidth: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {m.calories.toFixed(0)} kcal
                      </span>
                    </div>
                  ))}

                  {meals.length === 0 && (
                    <div
                      onClick={() => navigate('/meals')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', borderRadius: 10, marginBottom: 2,
                        border: '1px dashed var(--border)', fontSize: 12, color: 'var(--text-3)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-3)'; e.currentTarget.style.color = 'var(--text-2)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)' }}
                    >
                      <Plus size={12} /> {label} ekle
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </aside>

        {/* ── Right 2×2 ──────────────────────────────────────────────── */}
        <div style={isMobile
          ? { display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)' }
          : { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 1, background: 'var(--border)', overflow: 'hidden' }
        }>

          {/* Q1: Haftalık */}
          <div style={{ background: 'var(--bg)', padding: isMobile ? 16 : 24, display: 'flex', flexDirection: 'column', minHeight: isMobile ? 180 : undefined }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 16 }}>Bu hafta</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flex: 1, paddingBottom: 4 }}>
              {(week as any[]).map((d: any, i: number) => {
                const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
                const isT = i === todayIdx
                const isOver = d.calories > goals.calories
                const pct  = maxCal > 0 ? Math.max(d.calories / maxCal * 100, d.calories > 0 ? 4 : 0) : 0
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                    <div style={{ width: '100%', height: 90, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%', borderRadius: '4px 4px 0 0', minHeight: d.calories > 0 ? 4 : 0,
                        height: `${pct}%`,
                        background: isT ? '#C8F076' : isOver ? '#B85C38' : 'var(--surface-3)',
                        position: 'relative', overflow: 'hidden', transition: 'height 0.6s ease',
                      }}>
                        {(isT || isOver) && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'rgba(255,255,255,0.08)' }} />}
                      </div>
                    </div>
                    <span style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: isT ? 'var(--lime)' : 'var(--text-3)', fontWeight: isT ? 600 : 400 }}>
                      {DAY_LABELS[i]}
                    </span>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {avgCal > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Ort. <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{avgCal.toLocaleString('tr-TR')} kcal</span>
                </span>
              )}
              {overLabel && (
                <span style={{ fontSize: 11, color: '#B85C38' }}>▲ {overLabel} fazla</span>
              )}
            </div>
          </div>

          {/* Q2: AI */}
          <div style={{ background: 'var(--bg)', padding: isMobile ? 16 : 24, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>AI Asistan</div>

            {/* Model badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 500, color: 'var(--lime-dim)', background: 'rgba(200,240,118,0.08)', border: '1px solid rgba(200,240,118,0.15)', padding: '3px 8px', borderRadius: 99, marginBottom: 10, alignSelf: 'flex-start' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: currentProvider?.available ? 'var(--lime)' : '#f87171', animation: currentProvider?.available ? 'pulse 2s ease infinite' : 'none', flexShrink: 0 }} />
              {currentProvider?.label ?? selectedProvider}
              {currentProvider?.offline && ' — yerel'}
              {currentProvider?.supports_tools && ' — araç'}
            </div>

            {/* Bubble */}
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, fontSize: 12.5, lineHeight: 1.65, color: 'var(--text-2)', flex: 1 }}>
              {aiReply ?? aiInsight}
            </div>

            {/* Mini input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <input
                type="text"
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAiSend() }}
                placeholder='"100g nohut kaç protein?"'
                disabled={aiSending}
                style={{
                  flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '7px 12px', fontSize: 12, color: 'var(--text-2)',
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button
                onClick={handleAiSend}
                disabled={!aiInput.trim() || aiSending}
                style={{
                  width: 30, height: 30, background: 'var(--lime)', border: 'none', borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  opacity: aiInput.trim() && !aiSending ? 1 : 0.4, flexShrink: 0,
                }}
              >
                <Send size={13} style={{ color: '#0A0F0D' }} />
              </button>
            </div>
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <span onClick={() => navigate('/ai')} style={{ fontSize: 10, color: 'var(--text-3)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                Tam sohbete geç →
              </span>
            </div>
          </div>

          {/* Q3: Vücut */}
          <div style={{ background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: isMobile ? undefined : 'hidden', minHeight: isMobile ? 300 : undefined }}>
            <DashboardWeightChart entries={bodyEntries} targetWeight={goalProfile?.target_weight_kg ?? null} />
          </div>

          {/* Q4: Su */}
          <div style={{ background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: isMobile ? undefined : 'hidden' }}>
            {/* Topbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(91,159,224,0.12)', border: '1px solid rgba(91,159,224,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#5B9FE0" strokeWidth="2" strokeLinecap="round" style={{ width: 15, height: 15 }}>
                    <path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0C19 10 12 2 12 2Z" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>Su takibi</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>Günlük hedef: {(goals.water_ml / 1000).toFixed(1)} lt</div>
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 99, background: 'rgba(91,159,224,0.12)', border: '1px solid rgba(91,159,224,0.2)', color: '#5B9FE0' }}>
                %{Math.min(100, Math.round(waterMl / goals.water_ml * 100))} tamamlandı
              </div>
            </div>

            <div style={{ flex: isMobile ? undefined : 1, overflowY: isMobile ? undefined : 'auto', padding: '14px 16px', scrollbarWidth: 'none' }}>

              {/* Hero: dalga dairesi + büyük rakam */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 18 }}>
                <WaveCircle pct={Math.min(100, waterMl / goals.water_ml * 100)} />
                <div>
                  <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 36, color: '#5B9FE0', lineHeight: 1, letterSpacing: '-0.03em' }}>
                    {waterMl >= 1000 ? `${(waterMl / 1000).toFixed(1)}` : waterMl}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    {waterMl >= 1000 ? 'lt içildi' : 'ml içildi'}
                  </div>
                  {waterMl < goals.water_ml && (
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12, color: 'var(--text-3)' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {goals.water_ml - waterMl} ml daha — hedefe ulaşmak için
                    </div>
                  )}
                  {waterMl >= goals.water_ml && (
                    <div style={{ fontSize: 10, color: '#5B9FE0', marginTop: 5, fontWeight: 600 }}>🎯 Hedefe ulaşıldı!</div>
                  )}
                </div>
              </div>

              {/* Damlalar grid */}
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
                Bardaklar (her biri 250 ml)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 10 : 8}, 1fr)`, gap: '6px 4px', marginBottom: 16 }}>
                {Array.from({ length: waterCups }).map((_, i) => {
                  const state = i < filledCups ? 'filled' : i === filledCups ? 'next' : 'empty'
                  return (
                    <WaterDrop
                      key={i}
                      state={state}
                      onClick={() => { if (state !== 'filled') addWater.mutate(250) }}
                    />
                  )
                })}
              </div>

              {/* Hızlı ekle */}
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
                Hızlı ekle
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {[
                  { ml: 150, icon: '🥛' },
                  { ml: 250, icon: '🥤' },
                  { ml: 500, icon: '🍶' },
                  { ml: 750, icon: '🧴' },
                ].map(({ ml, icon }) => (
                  <button
                    key={ml}
                    onClick={() => addWater.mutate(ml)}
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      padding: '8px 4px', borderRadius: 9,
                      border: '1px solid var(--border)', background: 'var(--surface-2)',
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(91,159,224,0.3)'; e.currentTarget.style.background = 'var(--surface-3)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface-2)' }}
                  >
                    <span style={{ fontSize: 14 }}>{icon}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{ml} ml</span>
                  </button>
                ))}
              </div>

              {/* Günlük dağılım timeline */}
              {(() => {
                const now = new Date()
                const curHour = now.getHours()
                const HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22]
                const buckets: Record<number, number> = {}
                waterEntries.forEach(e => {
                  if (!e.logged_at) return
                  const h = new Date(e.logged_at).getHours()
                  const slot = HOURS.findIndex((hh, i) => h >= hh && h < (HOURS[i + 1] ?? 24))
                  if (slot >= 0) buckets[slot] = (buckets[slot] ?? 0) + e.amount_ml
                })
                const maxBucket = Math.max(...HOURS.map((_, i) => buckets[i] ?? 0), 1)
                return (
                  <>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 7 }}>
                      Bugünkü dağılım
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36, marginBottom: 4 }}>
                      {HOURS.map((h, i) => {
                        const amt = buckets[i] ?? 0
                        const heightPct = amt > 0 ? Math.max(15, (amt / maxBucket) * 100) : 0
                        const isCur = curHour >= h && curHour < (HOURS[i + 1] ?? 24)
                        return (
                          <div key={h} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                            <div style={{
                              width: '100%', borderRadius: '2px 2px 0 0', minHeight: 3,
                              height: amt > 0 ? `${heightPct}%` : '6%',
                              background: isCur ? '#5B9FE0' : amt > 0 ? 'rgba(91,159,224,0.45)' : 'var(--surface-3)',
                              transition: 'height 0.4s ease',
                            }} />
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      {HOURS.map((h, i) => {
                        const isCur = curHour >= h && curHour < (HOURS[i + 1] ?? 24)
                        return (
                          <span key={h} style={{ fontSize: 9, color: isCur ? '#5B9FE0' : 'var(--text-3)', minWidth: 0, textAlign: 'center', flex: 1 }}>
                            {String(h).padStart(2, '0')}
                          </span>
                        )
                      })}
                    </div>
                  </>
                )
              })()}

              {/* İlerleme çubuğu */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                <div style={{ flex: 1, height: 5, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99, background: '#5B9FE0',
                    width: `${Math.min(100, waterMl / goals.water_ml * 100)}%`,
                    transition: 'width 0.8s ease',
                  }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {waterMl} / {goals.water_ml} ml
                </span>
              </div>

            </div>
          </div>
        </div>

        {/* ── Bottom bar ─────────────────────────────────────────────── */}
        {!isMobile && <div style={{
          gridColumn: '1 / -1', borderTop: '1px solid var(--border)',
          padding: '11px 24px', display: 'flex', alignItems: 'center', gap: 16,
          background: 'var(--surface-1)', flexShrink: 0,
        }}>
          {/* Streak */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: 'var(--lime)', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {streak}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.3 }}>gün<br />seri</span>
            {streak > 0 && <span style={{ marginLeft: 2 }}>🔥</span>}
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

          {goalMode && (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Hedef modu: <span style={{ color: 'var(--text-2)' }}>{goalMode}</span>
              </span>
              <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
            </>
          )}

          {tdee && (
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              TDEE <span style={{ color: 'var(--text-2)' }}>{tdee.toLocaleString('tr-TR')} kcal</span>
            </span>
          )}

          {activeFasting && (
            <>
              <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#C96B4A' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C96B4A', animation: 'pulse 2s ease infinite', flexShrink: 0 }} />
                Oruç · {activeFasting.protocol} · {activeFasting.elapsed_hours?.toFixed(1)}sa
              </div>
            </>
          )}

          <div style={{ flex: 1 }} />

          {/* Syncthing */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
            {syncStatus?.running ? (
              <>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: syncStatus.connected ? 'var(--lime)' : 'var(--amber)', flexShrink: 0 }} />
                <RefreshCw size={11} />
                Syncthing · {syncStatus.connected ? 'eşitlendi' : 'bekleniyor'}
              </>
            ) : (
              <>
                <WifiOff size={11} style={{ opacity: 0.4 }} />
                <span style={{ opacity: 0.4 }}>Syncthing çalışmıyor</span>
              </>
            )}
          </div>
        </div>}
      </div>
      </>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  )
}
