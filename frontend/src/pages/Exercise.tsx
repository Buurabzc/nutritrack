import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Dumbbell, Flame } from 'lucide-react'
import { api } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { useIsMobile } from '@/hooks/useIsMobile'

const CATEGORIES = [
  { id: 'cardio',   label: 'Kardio',   color: '#5B9FE0', emoji: '🏃' },
  { id: 'strength', label: 'Güç',      color: '#C96B4A', emoji: '🏋️' },
  { id: 'sport',    label: 'Spor',     color: '#9B82D8', emoji: '⚽' },
  { id: 'other',    label: 'Diğer',    color: '#8A9488', emoji: '🤸' },
]

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

interface ExerciseEntry {
  id: number
  exercise_name: string
  category: string
  duration_min: number
  calories_burned: number
  date: string
}

interface WeekDay {
  date: string
  calories_burned: number
  total_duration_min: number
  entry_count: number
}

export default function Exercise() {
  const qc = useQueryClient()

  const [name, setName] = useState('')
  const [category, setCategory] = useState('cardio')
  const [duration, setDuration] = useState('')
  const [calories, setCalories] = useState('')

  const { data: entries = [] } = useQuery<ExerciseEntry[]>({
    queryKey: ['exercise-today'],
    queryFn: () => api.get('/exercise').then(r => r.data ?? []),
    refetchInterval: 30_000,
  })

  const { data: weekData = [] } = useQuery<WeekDay[]>({
    queryKey: ['exercise-weekly'],
    queryFn: () => api.get('/exercise/summary/weekly').then(r => r.data ?? []),
    refetchInterval: 60_000,
  })

  const addExercise = useMutation({
    mutationFn: (body: any) => api.post('/exercise', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercise-today'] })
      qc.invalidateQueries({ queryKey: ['exercise-weekly'] })
      qc.invalidateQueries({ queryKey: ['today'] })
      setName(''); setDuration(''); setCalories('')
    },
  })

  const deleteExercise = useMutation({
    mutationFn: (id: number) => api.delete(`/exercise/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercise-today'] })
      qc.invalidateQueries({ queryKey: ['exercise-weekly'] })
      qc.invalidateQueries({ queryKey: ['today'] })
    },
  })

  const handleAdd = () => {
    if (!name.trim() || !duration) return
    addExercise.mutate({
      exercise_name: name.trim(),
      category,
      duration_min: parseFloat(duration) || 0,
      calories_burned: parseFloat(calories) || 0,
    })
  }

  const totalBurned = entries.reduce((s, e) => s + e.calories_burned, 0)
  const totalDuration = entries.reduce((s, e) => s + e.duration_min, 0)
  const isMobile = useIsMobile()

  const maxBurned = Math.max(...weekData.map(d => d.calories_burned), 1)
  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1

  const numInput: React.CSSProperties = {
    background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8,
    color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
    padding: '8px 12px', width: '100%',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="Egzersiz"
        description={new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
      />

      <div style={isMobile
        ? { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }
        : { display: 'grid', gridTemplateColumns: '300px 1fr', flex: 1, overflow: 'hidden' }
      }>

        {/* ── Sol: Bugün ── */}
        <aside style={isMobile
          ? { background: 'var(--surface-1)', display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border)' }
          : { background: 'var(--surface-1)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
        }>

          {/* Özet */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>Yakılan</div>
                <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: '#C96B4A', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {totalBurned.toFixed(0)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>kcal</div>
              </div>
              <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>Süre</div>
                <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: 'var(--lime)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {totalDuration.toFixed(0)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>dakika</div>
              </div>
            </div>
          </div>

          {/* Liste */}
          <div style={{ flex: isMobile ? undefined : 1, overflowY: isMobile ? undefined : 'auto', padding: '8px 0' }}>
            {entries.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                <Dumbbell size={28} style={{ marginBottom: 10, opacity: 0.3 }} />
                <div>Bugün egzersiz yok</div>
              </div>
            ) : (
              entries.map(e => {
                const cat = CATEGORIES.find(c => c.id === e.category)
                return (
                  <div
                    key={e.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', transition: 'background 0.1s' }}
                    onMouseEnter={el => el.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={el => el.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{cat?.emoji ?? '🤸'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.exercise_name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                        {e.duration_min} dk · {cat?.label}
                      </div>
                    </div>
                    {e.calories_burned > 0 && (
                      <span style={{ fontSize: 12, color: '#C96B4A', fontWeight: 500, flexShrink: 0 }}>
                        -{e.calories_burned.toFixed(0)} kcal
                      </span>
                    )}
                    <button
                      onClick={() => deleteExercise.mutate(e.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 2, display: 'flex', opacity: 0, transition: 'opacity 0.1s' }}
                      onMouseEnter={el => { el.currentTarget.style.opacity = '1'; el.currentTarget.style.color = '#f87171' }}
                      onMouseLeave={el => { el.currentTarget.style.opacity = '0'; el.currentTarget.style.color = 'var(--text-3)' }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </aside>

        {/* ── Sağ: Ekle + Haftalık ── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: isMobile ? undefined : 'hidden' }}>

          {/* Egzersiz ekle */}
          <div style={{ padding: isMobile ? 16 : 24, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 16 }}>
              Egzersiz Ekle
            </div>

            {/* Kategori */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  style={{
                    flex: 1, padding: '7px 4px', borderRadius: 8, fontFamily: 'inherit', cursor: 'pointer',
                    border: `1px solid ${category === c.id ? c.color + '88' : 'var(--border)'}`,
                    background: category === c.id ? c.color + '18' : 'transparent',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    transition: 'all 0.12s',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{c.emoji}</span>
                  <span style={{ fontSize: 10, color: category === c.id ? c.color : 'var(--text-3)' }}>{c.label}</span>
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 100px 100px', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Egzersiz adı</label>
                <input
                  type="text"
                  placeholder="Koşu, bisiklet, yürüyüş…"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                  style={numInput}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Süre (dk)</label>
                <input type="number" placeholder="30" value={duration} onChange={e => setDuration(e.target.value)} style={numInput} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Kalori</label>
                <input type="number" placeholder="250" value={calories} onChange={e => setCalories(e.target.value)} style={numInput} />
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={!name.trim() || !duration || addExercise.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', borderRadius: 9, border: 'none',
                background: name.trim() && duration ? 'var(--lime)' : 'var(--surface-2)',
                color: name.trim() && duration ? '#080C0A' : 'var(--text-3)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                opacity: addExercise.isPending ? 0.6 : 1,
              }}
            >
              <Plus size={14} />
              {addExercise.isPending ? 'Ekleniyor…' : 'Egzersiz Ekle'}
            </button>
          </div>

          {/* Haftalık özet */}
          <div style={{ flex: isMobile ? undefined : 1, padding: isMobile ? 16 : 24, overflowY: isMobile ? undefined : 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 16 }}>
              Bu Hafta
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100, marginBottom: 8 }}>
              {weekData.map((d, i) => {
                const isT = i === todayIdx
                const pct = maxBurned > 0 ? Math.max(d.calories_burned / maxBurned * 100, d.calories_burned > 0 ? 6 : 0) : 0
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                    <div style={{ width: '100%', height: 80, display: 'flex', alignItems: 'flex-end' }}>
                      <div
                        title={`${d.calories_burned} kcal · ${d.total_duration_min} dk`}
                        style={{
                          width: '100%', borderRadius: '4px 4px 0 0',
                          height: `${pct}%`, minHeight: d.calories_burned > 0 ? 4 : 0,
                          background: isT ? '#C96B4A' : 'var(--surface-3)',
                          position: 'relative', overflow: 'hidden', transition: 'height 0.6s ease',
                        }}
                      >
                        {isT && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'rgba(255,255,255,0.08)' }} />}
                      </div>
                    </div>
                    <span style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: isT ? '#C96B4A' : 'var(--text-3)', fontWeight: isT ? 600 : 400 }}>
                      {DAY_LABELS[i]}
                    </span>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
              {(() => {
                const activeDays = weekData.filter(d => d.calories_burned > 0)
                const totalWeekBurned = weekData.reduce((s, d) => s + d.calories_burned, 0)
                const totalWeekDuration = weekData.reduce((s, d) => s + d.total_duration_min, 0)
                return (
                  <>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{activeDays.length}</span> antrenman günü
                    </span>
                    {totalWeekBurned > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        <span style={{ color: '#C96B4A', fontWeight: 500 }}>{totalWeekBurned.toFixed(0)} kcal</span> yakıldı
                      </span>
                    )}
                    {totalWeekDuration > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{totalWeekDuration.toFixed(0)} dk</span> toplam
                      </span>
                    )}
                  </>
                )
              })()}
            </div>

            {/* Kcal ipucu */}
            <div style={{ marginTop: 20, padding: 14, background: 'var(--surface-1)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Flame size={13} style={{ color: '#C96B4A' }} />
                <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>Kalori tahmini</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
                Referans değerler: Yürüyüş <span style={{ color: 'var(--text-2)' }}>~200 kcal/sa</span>, Koşu <span style={{ color: 'var(--text-2)' }}>~500 kcal/sa</span>, Bisiklet <span style={{ color: 'var(--text-2)' }}>~400 kcal/sa</span>, Ağırlık <span style={{ color: 'var(--text-2)' }}>~300 kcal/sa</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
