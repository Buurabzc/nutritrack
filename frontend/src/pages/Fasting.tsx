import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'

const PROTOCOLS = [
  { id: '16:8',  label: '16:8',  targetHours: 16, desc: 'Klasik · 16 sa oruç, 8 sa yeme' },
  { id: '18:6',  label: '18:6',  targetHours: 18, desc: 'Orta · 18 sa oruç, 6 sa yeme' },
  { id: '20:4',  label: '20:4',  targetHours: 20, desc: 'Sıkı · 20 sa oruç, 4 sa yeme' },
  { id: '24h',   label: '24s',   targetHours: 24, desc: 'Tam gün · OMAD olarak da bilinir' },
]

interface FastingSession {
  id: number
  protocol: string
  target_hours: number
  started_at: string
  ended_at: string | null
  status: 'active' | 'completed' | 'broken'
  elapsed_hours: number
}

function pad(n: number) { return String(Math.floor(n)).padStart(2, '0') }

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function TimerRing({ pct, elapsed, target }: { pct: number; elapsed: number; target: number }) {
  const R = 85
  const C = 2 * Math.PI * R
  const offset = C * (1 - Math.min(pct, 1))

  return (
    <div style={{ position: 'relative', width: 220, height: 220, flexShrink: 0 }}>
      <svg width="220" height="220" viewBox="0 0 220 220" style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle cx="110" cy="110" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
        <circle
          cx="110" cy="110" r={R}
          fill="none"
          stroke={pct >= 1 ? 'var(--lime)' : '#C96B4A'}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '110px 110px', transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 36, lineHeight: 1, letterSpacing: '-0.03em', color: pct >= 1 ? 'var(--lime)' : 'var(--text)' }}>
          {formatElapsed(elapsed)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
          / {pad(target)}:00:00
        </div>
        <div style={{ marginTop: 8, fontSize: 11, fontWeight: 500, color: pct >= 1 ? 'var(--lime)' : 'var(--text-3)' }}>
          {pct >= 1 ? '✓ Tamamlandı!' : `%${Math.round(pct * 100)}`}
        </div>
      </div>
    </div>
  )
}

export default function Fasting() {
  const qc = useQueryClient()
  const [selectedProtocol, setSelectedProtocol] = useState('16:8')
  const [elapsed, setElapsed] = useState(0)

  const { data: active, isLoading } = useQuery<FastingSession | null>({
    queryKey: ['fasting-active'],
    queryFn: () => api.get('/fasting/active').then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data: history = [] } = useQuery<FastingSession[]>({
    queryKey: ['fasting-history'],
    queryFn: () => api.get('/fasting/history?limit=7').then(r => r.data ?? []),
  })

  useEffect(() => {
    if (!active) { setElapsed(0); return }
    const update = () => {
      const diff = (Date.now() - new Date(active.started_at + 'Z').getTime()) / 1000
      setElapsed(Math.max(0, diff))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [active])

  const startFasting = useMutation({
    mutationFn: (body: any) => api.post('/fasting', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fasting-active'] })
      qc.invalidateQueries({ queryKey: ['fasting-history'] })
    },
  })

  const endFasting = useMutation({
    mutationFn: (status: string) => api.put('/fasting/active', { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fasting-active'] })
      qc.invalidateQueries({ queryKey: ['fasting-history'] })
    },
  })

  const targetSeconds = active ? active.target_hours * 3600 : 0
  const pct = targetSeconds > 0 ? elapsed / targetSeconds : 0

  const proto = PROTOCOLS.find(p => p.id === selectedProtocol) ?? PROTOCOLS[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader title="Aralıklı Oruç" description="— İntermittent Fasting" />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Aktif oruç kartı ── */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>
            {isLoading ? (
              <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 20 }}>Yükleniyor…</div>
            ) : active ? (
              /* Aktif oruç görünümü */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>
                    Aktif oruç
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: '#C96B4A', background: 'rgba(201,107,74,0.12)', border: '1px solid rgba(201,107,74,0.25)', padding: '3px 10px', borderRadius: 99 }}>
                    {active.protocol} · {active.target_hours} saat hedef
                  </div>
                </div>

                <TimerRing pct={pct} elapsed={elapsed} target={active.target_hours * 3600} />

                <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center', flex: 1, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Başlangıç</div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {new Date(active.started_at + 'Z').toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', flex: 1, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Hedef bitiş</div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {new Date(new Date(active.started_at + 'Z').getTime() + active.target_hours * 3600_000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', flex: 1, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 8px', border: `1px solid ${pct >= 1 ? 'rgba(200,240,118,0.3)' : 'var(--border)'}` }}>
                    <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Kalan</div>
                    <div style={{ fontSize: 13, color: pct >= 1 ? 'var(--lime)' : 'var(--text-2)' }}>
                      {pct >= 1 ? '00:00' : formatElapsed(Math.max(0, targetSeconds - elapsed)).slice(0, 5)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                  <button
                    onClick={() => endFasting.mutate('completed')}
                    disabled={endFasting.isPending}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'var(--lime)', color: '#080C0A', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {endFasting.isPending ? '…' : '✓ Orucumu Tamamladım'}
                  </button>
                  <button
                    onClick={() => endFasting.mutate('broken')}
                    disabled={endFasting.isPending}
                    style={{ padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(201,107,74,0.35)', background: 'transparent', color: '#C96B4A', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Kır
                  </button>
                </div>
              </div>
            ) : (
              /* Oruç başlatma görünümü */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 }}>
                    Protokol Seç
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {PROTOCOLS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProtocol(p.id)}
                        style={{
                          padding: '12px 14px', borderRadius: 10, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                          border: `1px solid ${selectedProtocol === p.id ? 'rgba(201,107,74,0.5)' : 'var(--border)'}`,
                          background: selectedProtocol === p.id ? 'rgba(201,107,74,0.08)' : 'var(--surface-2)',
                          transition: 'all 0.12s',
                        }}
                      >
                        <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: selectedProtocol === p.id ? '#C96B4A' : 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4 }}>
                          {p.label}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', lineHeight: 1.4 }}>{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => startFasting.mutate({ protocol: proto.id, target_hours: proto.targetHours })}
                  disabled={startFasting.isPending}
                  style={{
                    padding: '13px', borderRadius: 10, border: 'none',
                    background: '#C96B4A', color: '#fff',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    opacity: startFasting.isPending ? 0.6 : 1,
                  }}
                >
                  {startFasting.isPending ? 'Başlatılıyor…' : `${proto.label} Orucunu Başlat`}
                </button>
              </div>
            )}
          </div>

          {/* ── Geçmiş ── */}
          {history.length > 0 && (
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 14 }}>
                Son Oruçlar
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {history.map(s => {
                  const achieved = s.elapsed_hours ?? 0
                  const achPct = s.target_hours > 0 ? Math.min(1, achieved / s.target_hours) : 0
                  const isCompleted = s.status === 'completed'
                  return (
                    <div
                      key={s.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                        background: isCompleted ? 'rgba(200,240,118,0.1)' : 'rgba(201,107,74,0.1)',
                        border: `1px solid ${isCompleted ? 'rgba(200,240,118,0.2)' : 'rgba(201,107,74,0.2)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14,
                      }}>
                        {isCompleted ? '✓' : '✗'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{s.protocol}</span>
                          <span style={{ fontSize: 11, color: isCompleted ? 'var(--lime)' : '#C96B4A' }}>
                            {isCompleted ? 'Tamamlandı' : 'Kırıldı'}
                          </span>
                        </div>
                        <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 99,
                            width: `${achPct * 100}%`,
                            background: isCompleted ? 'var(--lime)' : '#C96B4A',
                          }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                          {achieved.toFixed(1)} / {s.target_hours}sa
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                          {new Date(s.started_at + 'Z').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
