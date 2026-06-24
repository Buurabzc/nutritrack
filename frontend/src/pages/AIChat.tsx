import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Send, Plus, CheckCircle, Database, Info,
  Cpu, Sparkles, MessageCircle, Gem, Brain, ChevronDown, Trash2, History, X, Paperclip
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '@/api/client'
import { useAIStore, type ChatSession } from '@/stores/aiStore'
import { PageHeader, Chip } from '@/components/layout/PageHeader'
import { useIsMobile } from '@/hooks/useIsMobile'

const SUGGESTIONS = [
  'Öğle yemeğinde 150g tavuk göğsü ve bulgur pilavı yedim',
  'Bugün nasıl gitti?',
  '2 bardak su içtim',
  'Bu akşam ne önerirsin?',
  '100g mercimek kaç kalori?',
  'Sabah tartıldım 78.5 kg',
]

const PROVIDER_ICONS: Record<string, any> = {
  claude:   Sparkles,
  openai:   MessageCircle,
  gemini:   Gem,
  deepseek: Brain,
  ollama:   Cpu,
}

// ── Markdown rendering for AI replies (tables, bold, lists) ──────────────
const markdownComponents = {
  p: ({ children }: any) => <p style={{ margin: '0 0 8px' }}>{children}</p>,
  strong: ({ children }: any) => <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{children}</strong>,
  ul: ({ children }: any) => <ul style={{ margin: '2px 0 8px', paddingLeft: 18 }}>{children}</ul>,
  ol: ({ children }: any) => <ol style={{ margin: '2px 0 8px', paddingLeft: 18 }}>{children}</ol>,
  li: ({ children }: any) => <li style={{ marginBottom: 3 }}>{children}</li>,
  code: ({ children }: any) => <code style={{ background: 'var(--surface-3)', padding: '1px 5px', borderRadius: 4, fontSize: '0.9em' }}>{children}</code>,
  a: ({ href, children }: any) => <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--lime)' }}>{children}</a>,
  table: ({ children }: any) => (
    <div style={{ overflowX: 'auto', margin: '4px 0 10px', borderRadius: 8, border: '1px solid var(--border-2)' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-3)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{children}</th>
  ),
  td: ({ children }: any) => (
    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{children}</td>
  ),
}

function AIMessageContent({ content }: { content: string }) {
  return (
    <div style={{ lineHeight: 1.7 }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{content}</ReactMarkdown>
    </div>
  )
}

function ToolCallBadge({ calls }: { calls: any[] }) {
  if (!calls?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
      {calls.map((c, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 10, padding: '3px 8px',
          background: 'var(--surface-3)', borderRadius: 99,
          color: 'var(--lime-dim)',
        }}>
          <Database size={10} />
          {c.tool} {c.result?.success ? <CheckCircle size={10} style={{ color: 'var(--lime)' }} /> : null}
        </div>
      ))}
    </div>
  )
}

// ── Tool result cards ─────────────────────────────────────────────────────
function LoggedMealCard({ result }: { result: any }) {
  if (!result?.success) return null
  return (
    <div style={{
      marginTop: 8, padding: '10px 12px', borderRadius: 10, maxWidth: 320,
      background: 'var(--surface-2)', border: '1px solid var(--border-2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{result.food_name}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--lime)', flexShrink: 0 }}>
          <CheckCircle size={11} /> kaydedildi
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{result.amount_g}g · {result.meal_type}</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 11, color: 'var(--text-2)' }}>
        <span><b style={{ color: 'var(--lime-dim)' }}>{result.calories}</b> kcal</span>
        <span>P {result.protein}g</span>
        <span>K {result.carbs}g</span>
        <span>Y {result.fat}g</span>
      </div>
    </div>
  )
}

function SearchFoodCard({ result, qc }: { result: any; qc: ReturnType<typeof useQueryClient> }) {
  const [amount, setAmount] = useState(100)
  const [added, setAdded] = useState(false)
  const food = result?.results?.[0]

  const addMeal = useMutation({
    mutationFn: () => {
      const f = amount / 100
      return api.post('/meals', {
        meal_type: 'atistirma',
        food_name: food.name,
        food_id: food.id,
        amount_g: amount,
        calories: Math.round(food.per_100g.calories * f),
        protein: Math.round(food.per_100g.protein * f * 10) / 10,
        carbs: Math.round(food.per_100g.carbs * f * 10) / 10,
        fat: Math.round(food.per_100g.fat * f * 10) / 10,
        fiber: Math.round((food.per_100g.fiber ?? 0) * f * 10) / 10,
      })
    },
    onSuccess: () => {
      setAdded(true)
      qc.invalidateQueries({ queryKey: ['today'] })
    },
  })

  if (!result?.found || !food) {
    return (
      <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border-2)', fontSize: 11, color: 'var(--text-3)' }}>
        "{result?.query}" veritabanında bulunamadı
      </div>
    )
  }

  const f = amount / 100
  const cal = Math.round(food.per_100g.calories * f)

  return (
    <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border-2)', maxWidth: 320 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{food.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(Math.max(1, Number(e.target.value) || 0))}
          style={{ width: 56, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border-2)', background: 'var(--surface-1)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>g · <b style={{ color: 'var(--lime-dim)' }}>{cal}</b> kcal</span>
      </div>
      <button
        onClick={() => addMeal.mutate()}
        disabled={added || addMeal.isPending}
        style={{
          marginTop: 8, width: '100%', padding: '7px 0', borderRadius: 8, border: 'none',
          background: added ? 'var(--surface-3)' : 'var(--lime)',
          color: added ? 'var(--lime)' : '#080C0A',
          fontSize: 11, fontWeight: 600, cursor: added ? 'default' : 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}
      >
        {added ? <><CheckCircle size={12} /> Öğüne eklendi</> : addMeal.isPending ? 'Ekleniyor…' : 'Öğüne ekle'}
      </button>
    </div>
  )
}

function SummaryCard({ tool, result }: { tool: string; result: any }) {
  let rows: { label: string; value: string; highlight?: boolean }[] = []
  if (tool === 'get_today_summary' && result?.totals) {
    rows = [
      { label: 'Kalori', value: `${result.totals.calories} / ${result.goals.calories} kcal`, highlight: true },
      { label: 'Protein', value: `${result.totals.protein} / ${result.goals.protein_g} g` },
      { label: 'Karbonhidrat', value: `${result.totals.carbs} / ${result.goals.carbs_g} g` },
      { label: 'Yağ', value: `${result.totals.fat} / ${result.goals.fat_g} g` },
      { label: 'Su', value: `${result.water_ml} / ${result.goals.water_ml} ml` },
      { label: 'Kalan', value: `${result.remaining_calories} kcal` },
    ]
  } else if (tool === 'get_weekly_summary' && result?.days) {
    rows = result.days.map((d: any) => ({
      label: new Date(d.date).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric' }),
      value: `${d.calories} kcal · ${d.meal_count} öğün`,
    }))
  } else {
    return null
  }

  return (
    <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border-2)', maxWidth: 320 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.label}</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: r.highlight ? 'var(--lime)' : 'var(--text-2)' }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

function ToolResultCards({ calls, qc }: { calls: any[]; qc: ReturnType<typeof useQueryClient> }) {
  if (!calls?.length) return null
  const handled = new Set(['log_meal', 'search_food', 'get_today_summary', 'get_weekly_summary'])
  const fallback = calls.filter(c => !handled.has(c.tool))
  return (
    <>
      {calls.map((c, i) => {
        if (c.tool === 'log_meal') return <LoggedMealCard key={i} result={c.result} />
        if (c.tool === 'search_food') return <SearchFoodCard key={i} result={c.result} qc={qc} />
        if (c.tool === 'get_today_summary' || c.tool === 'get_weekly_summary') return <SummaryCard key={i} tool={c.tool} result={c.result} />
        return null
      })}
      {fallback.length > 0 && <ToolCallBadge calls={fallback} />}
    </>
  )
}

function getSuggestions(toolCalls?: any[]): string[] {
  const names = (toolCalls ?? []).map((t: any) => t.tool)
  if (names.includes('log_meal')) return ['Başka bir şey ekledim', 'Bugün durumum nasıl?']
  if (names.includes('search_food')) return ['Başka besin ara', 'Bugün durumum nasıl?']
  if (names.includes('get_today_summary')) return ['Bu akşam ne önerirsin?', 'Bu hafta nasıl gitti?']
  if (names.includes('get_weekly_summary')) return ['Bugün durumum nasıl?']
  if (names.includes('log_water')) return ['Bugün durumum nasıl?']
  if (names.includes('log_exercise')) return ['Kaç kalori yaktım?']
  if (names.includes('log_body_measurement')) return ['Kilom nasıl gidiyor?']
  return []
}

function SuggestButtons({ toolCalls, onPick }: { toolCalls?: any[]; onPick: (s: string) => void }) {
  const suggestions = getSuggestions(toolCalls)
  if (!suggestions.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {suggestions.map(s => (
        <button
          key={s}
          onClick={() => onPick(s)}
          style={{
            fontSize: 11, padding: '5px 11px', borderRadius: 99,
            border: '1px solid var(--border-2)', color: 'var(--lime-dim)',
            background: 'rgba(200,240,118,0.06)', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

// ── Dismissible daily-summary banner ──────────────────────────────────────
function ContextBar({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  const { data: today } = useQuery({
    queryKey: ['today'],
    queryFn: () => api.get('/meals/summary/today').then(r => r.data),
  })
  if (!today) return null
  const remaining = Math.round(today.goals.calories - today.totals.calories)

  if (isMobile) {
    return (
      <div style={{ padding: '8px 14px 0', flexShrink: 0 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 99,
          background: 'rgba(200,240,118,0.08)', border: '1px solid rgba(200,240,118,0.15)',
        }}>
          <Info size={11} style={{ color: 'rgba(200,240,118,0.6)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
            <b style={{ color: 'var(--lime-dim)' }}>{remaining}</b> kcal kaldı
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 22px',
      borderBottom: '1px solid var(--border)',
      background: 'rgba(200,240,118,0.04)', flexShrink: 0,
    }}>
      <Info size={12} style={{ color: 'rgba(200,240,118,0.5)', flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: 'var(--text-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Bugün <b style={{ color: 'var(--lime-dim)' }}>{Math.round(today.totals.calories)} kcal</b>
        {' · '}protein <b style={{ color: 'var(--lime-dim)' }}>{Math.round(today.totals.protein)}/{today.goals.protein_g}g</b>
        {' · '}<b style={{ color: remaining >= 0 ? 'var(--lime-dim)' : '#f87171' }}>{remaining}</b> kcal kaldı
      </span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', padding: 2, flexShrink: 0 }}>
        <X size={12} />
      </button>
    </div>
  )
}

function ModelDropdown({ providers, selectedProvider, selectedModel, onSelect }: {
  providers: any[]
  selectedProvider: string
  selectedModel: string
  onSelect: (provider: string, model: string) => void
}) {
  const [open, setOpen] = useState(false)
  const current = providers.find((p: any) => p.id === selectedProvider)
  const Icon = PROVIDER_ICONS[selectedProvider] ?? Cpu
  const modelLabel = current?.models?.[selectedModel] ?? selectedModel

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', borderRadius: 8,
          border: '1px solid var(--border-2)', background: 'var(--surface-2)',
          color: 'var(--text-2)', fontSize: 11, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <Icon size={13} style={{ color: current?.available ? 'var(--lime)' : 'var(--text-3)' }} />
        {current?.label ?? selectedProvider}
        <span style={{ color: 'var(--text-3)' }}>·</span>
        <span style={{ color: 'var(--text-3)' }}>{modelLabel}</span>
        {current?.supports_tools && (
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, background: 'rgba(200,240,118,0.12)', color: 'var(--lime-dim)' }}>
            tools
          </span>
        )}
        <ChevronDown size={12} style={{ opacity: 0.5 }} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 10,
            background: 'var(--surface-2)', border: '1px solid var(--border-2)',
            borderRadius: 10, minWidth: 240,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            maxHeight: 400, overflowY: 'auto',
          }}>
            {providers.map((p: any) => {
              const PIcon = PROVIDER_ICONS[p.id] ?? Cpu
              return (
                <div key={p.id}>
                  <div style={{
                    padding: '6px 12px 4px',
                    fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--text-3)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <PIcon size={11} />
                    {p.label}
                    <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: p.available ? 'var(--lime)' : 'var(--red)', marginLeft: 'auto' }} />
                    {p.offline && <span style={{ fontSize: 8, color: 'var(--text-3)', border: '1px solid var(--border-2)', borderRadius: 3, padding: '0 3px' }}>yerel</span>}
                    {p.supports_tools && <span style={{ fontSize: 8, color: 'var(--lime-dim)', border: '1px solid rgba(200,240,118,0.2)', borderRadius: 3, padding: '0 3px' }}>tools</span>}
                  </div>
                  {Object.entries(p.models ?? {}).map(([modelId, modelName]: [string, any]) => {
                    const isSelected = selectedProvider === p.id && selectedModel === modelId
                    return (
                      <button
                        key={modelId}
                        onClick={() => { onSelect(p.id, modelId); setOpen(false) }}
                        style={{
                          width: '100%', padding: '7px 12px 7px 28px',
                          background: isSelected ? 'var(--surface-3)' : 'transparent',
                          border: 'none', textAlign: 'left', fontSize: 12,
                          color: isSelected ? 'var(--lime)' : p.available ? 'var(--text-2)' : 'var(--text-3)',
                          cursor: 'pointer', fontFamily: 'inherit', opacity: p.available ? 1 : 0.6,
                        }}
                      >
                        {modelName}
                        {!p.available && <span style={{ float: 'right', fontSize: 9, color: 'var(--text-3)' }}>key yok</span>}
                        {isSelected && p.available && <span style={{ float: 'right', color: 'var(--lime)', fontSize: 11 }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              )
            })}
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', fontSize: 9, color: 'var(--text-3)' }}>
              API key'ler Ayarlar sayfasından eklenir
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Mobile bottom sheet for sessions ──────────────────────────────────────
function SessionsSheet({ sessions, currentSessionId, onSelect, onDelete, onClose }: {
  sessions: ChatSession[]
  currentSessionId: number | null
  onSelect: (id: number) => void
  onDelete: (id: number, e: React.MouseEvent) => void
  onClose: () => void
}) {
  const today = new Date().toDateString()
  const weekAgo = new Date(Date.now() - 7 * 86_400_000)
  const groups: { label: string; items: typeof sessions }[] = [
    { label: 'Bugün', items: [] },
    { label: 'Bu hafta', items: [] },
    { label: 'Daha önce', items: [] },
  ]
  sessions.forEach(s => {
    const d = new Date(s.updated_at)
    if (d.toDateString() === today) groups[0].items.push(s)
    else if (d >= weekAgo) groups[1].items.push(s)
    else groups[2].items.push(s)
  })

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}
      />
      {/* Sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        height: '75dvh',
        background: 'var(--surface-1)',
        borderRadius: '16px 16px 0 0',
        borderTop: '1px solid var(--border-2)',
        zIndex: 201,
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.25s ease',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 16, letterSpacing: '-0.02em' }}>Sohbetler</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Sessions */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 24px' }}>
          {sessions.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '32px 20px', textAlign: 'center' }}>
              Henüz sohbet yok.
            </div>
          ) : groups.filter(g => g.items.length > 0).map(group => (
            <div key={group.label}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '12px 16px 4px' }}>
                {group.label}
              </div>
              {group.items.map(s => {
                const active = currentSessionId === s.id
                return (
                  <div
                    key={s.id}
                    onClick={() => { onSelect(s.id); onClose() }}
                    style={{
                      padding: '12px 16px',
                      background: active ? 'var(--surface-2)' : 'transparent',
                      borderLeft: `3px solid ${active ? 'var(--lime)' : 'transparent'}`,
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: active ? 500 : 400, color: active ? 'var(--text)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.title || 'Yeni sohbet'}
                      </div>
                      {s.preview && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.preview}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
                        {s.message_count} mesaj · {new Date(s.updated_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(s.id, e) }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 6, display: 'flex', flexShrink: 0, marginTop: 2 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Mobile bottom sheet for provider selection ────────────────────────────
function ProviderSheet({ providers, selectedProvider, selectedModel, onSelect, onClose }: {
  providers: any[]
  selectedProvider: string
  selectedModel: string
  onSelect: (provider: string, model: string) => void
  onClose: () => void
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        maxHeight: '70dvh',
        background: 'var(--surface-1)',
        borderRadius: '16px 16px 0 0',
        borderTop: '1px solid var(--border-2)',
        zIndex: 201,
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.25s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 16, letterSpacing: '-0.02em' }}>AI Modeli Seç</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 24px' }}>
          {providers.map((p: any) => {
            const PIcon = PROVIDER_ICONS[p.id] ?? Cpu
            return (
              <div key={p.id}>
                <div style={{ padding: '10px 16px 4px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PIcon size={12} />
                  {p.label}
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.available ? 'var(--lime)' : 'var(--red)', marginLeft: 'auto' }} />
                  {p.supports_tools && <span style={{ fontSize: 9, color: 'var(--lime-dim)', border: '1px solid rgba(200,240,118,0.2)', borderRadius: 3, padding: '0 4px' }}>tools</span>}
                  {!p.available && <span style={{ fontSize: 9, color: 'var(--text-3)' }}>key yok</span>}
                </div>
                {Object.entries(p.models ?? {}).map(([modelId, modelName]: [string, any]) => {
                  const isSelected = selectedProvider === p.id && selectedModel === modelId
                  return (
                    <button
                      key={modelId}
                      onClick={() => { onSelect(p.id, modelId); onClose() }}
                      style={{
                        width: '100%', padding: '13px 16px 13px 36px',
                        background: isSelected ? 'var(--surface-2)' : 'transparent',
                        border: 'none', textAlign: 'left', fontSize: 14,
                        color: isSelected ? 'var(--lime)' : p.available ? 'var(--text-2)' : 'var(--text-3)',
                        cursor: 'pointer', fontFamily: 'inherit', opacity: p.available ? 1 : 0.5,
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <span style={{ flex: 1 }}>{modelName as string}</span>
                      {isSelected && <span style={{ color: 'var(--lime)', fontSize: 16 }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            )
          })}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-3)' }}>
            API key'ler Ayarlar sayfasından eklenir
          </div>
        </div>
      </div>
    </>
  )
}

export default function AIChat() {
  const [input, setInput] = useState('')
  const [showSessions, setShowSessions] = useState(false)
  const [showProviders, setShowProviders] = useState(false)
  const [showContext, setShowContext] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const isMobile = useIsMobile()

  const {
    chatHistory, addMessage, clearHistory, loadSession,
    selectedProvider, selectedModel, currentSessionId,
    isLoading, setLoading,
    selectProvider, selectModel,
  } = useAIStore()

  const { data: sessions = [], refetch: refetchSessions } = useQuery<ChatSession[]>({
    queryKey: ['chat-sessions'],
    queryFn: () => api.get('/chat/sessions').then(r => r.data),
  })

  const deleteSession = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    await api.delete(`/chat/sessions/${id}`)
    if (currentSessionId === id) clearHistory()
    refetchSessions()
  }

  const { data: providers = [] } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: () => api.get('/ai/providers').then(r => r.data),
    refetchInterval: 30_000,
  })

  // Visual viewport takibi useViewport() hook'u tarafından App.tsx'te
  // global olarak yapılıyor; burada ayrıca bir effect'e gerek yok.

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const resp = await api.post('/ai/chat', {
        message,
        history: chatHistory.map(m => ({ role: m.role, content: m.content })),
        provider: selectedProvider,
        model: selectedModel,
        include_context: true,
      })
      return resp.data
    },
    onSuccess: (data) => {
      addMessage({ role: 'assistant', content: data.reply, provider: data.provider, tool_calls: data.tool_calls })
      setLoading(false)
      refetchSessions()
      if (data.tool_calls?.length) {
        qc.invalidateQueries({ queryKey: ['today'] })
        qc.invalidateQueries({ queryKey: ['weekly'] })
        qc.invalidateQueries({ queryKey: ['body-latest'] })
      }
    },
    onError: (err: any) => {
      addMessage({ role: 'assistant', content: `Hata: ${err.message}` })
      setLoading(false)
    },
  })

  const handleSend = (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || isLoading) return
    setInput('')
    addMessage({ role: 'user', content: msg })
    setLoading(true)
    sendMutation.mutate(msg)
  }

  useEffect(() => {
    if (currentSessionId && chatHistory.length === 0) {
      loadSession(currentSessionId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, isLoading])

  const currentProvider = providers.find((p: any) => p.id === selectedProvider)
  const Icon = PROVIDER_ICONS[selectedProvider] ?? Cpu

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="AI Asistan"
        description={isMobile ? undefined : 'Beslenme danışmanın'}
        action={
          isMobile ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* Sohbet geçmişi */}
              <button
                onClick={() => setShowSessions(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 10px', borderRadius: 8,
                  border: '1px solid var(--border-2)', background: 'var(--surface-2)',
                  color: 'var(--text-2)', fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <History size={13} />
                {sessions.length > 0 ? sessions.length : ''}
              </button>
              {/* Model seçici */}
              <button
                onClick={() => setShowProviders(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 10px', borderRadius: 8,
                  border: `1px solid ${currentProvider?.available ? 'var(--border-2)' : 'rgba(248,113,113,0.3)'}`,
                  background: 'var(--surface-2)',
                  color: currentProvider?.available ? 'var(--text-2)' : '#f87171',
                  fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <Icon size={13} style={{ color: currentProvider?.available ? 'var(--lime)' : '#f87171' }} />
                {currentProvider?.label ?? selectedProvider}
                <ChevronDown size={11} style={{ opacity: 0.5 }} />
              </button>
              <Chip onClick={clearHistory}><Plus size={12} /></Chip>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <ModelDropdown
                providers={providers}
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onSelect={(pid, mid) => { selectProvider(pid); selectModel(mid) }}
              />
              <Chip onClick={clearHistory}><Plus size={12} /> Yeni</Chip>
            </div>
          )
        }
      />

      {showContext && <ContextBar isMobile={isMobile} onClose={() => setShowContext(false)} />}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Desktop: session sidebar */}
        {!isMobile && (
          <div style={{ width: 232, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '10px 10px 8px' }}>
              <button
                onClick={clearHistory}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 8,
                  border: '1px solid var(--border-2)', background: 'transparent',
                  fontSize: 11, fontWeight: 500, color: 'var(--text-2)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: 'inherit', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' }}
              >
                <Plus size={13} /> Yeni sohbet
              </button>
            </div>
            <div style={{ padding: '6px 12px 8px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: currentProvider?.available ? 'var(--text-3)' : '#f87171' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: currentProvider?.available ? 'var(--lime)' : '#f87171', animation: currentProvider?.available ? 'pulse 2s ease infinite' : 'none' }} />
                {currentProvider?.available
                  ? currentProvider.supports_tools ? `${currentProvider.label} · araç` : currentProvider.offline ? `${currentProvider.label} · yerel` : currentProvider.label
                  : 'API key gerekli — Ayarlar'}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 8px' }}>
              {sessions.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '16px 14px', textAlign: 'center', lineHeight: 1.6 }}>Henüz sohbet yok.<br />Yukarıdan başla.</div>
              ) : (() => {
                const today = new Date().toDateString()
                const weekAgo = new Date(Date.now() - 7 * 86_400_000)
                const groups: { label: string; items: typeof sessions }[] = [
                  { label: 'Bugün', items: [] }, { label: 'Bu hafta', items: [] }, { label: 'Daha önce', items: [] },
                ]
                sessions.forEach(s => {
                  const d = new Date(s.updated_at)
                  if (d.toDateString() === today) groups[0].items.push(s)
                  else if (d >= weekAgo) groups[1].items.push(s)
                  else groups[2].items.push(s)
                })
                return groups.filter(g => g.items.length > 0).map(group => (
                  <div key={group.label}>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '8px 14px 3px' }}>{group.label}</div>
                    {group.items.map(s => {
                      const active = currentSessionId === s.id
                      return (
                        <div key={s.id} onClick={() => loadSession(s.id)} style={{ padding: '8px 12px 8px 14px', cursor: 'pointer', background: active ? 'var(--surface-2)' : 'transparent', borderLeft: `2px solid ${active ? 'var(--lime)' : 'transparent'}`, display: 'flex', alignItems: 'flex-start', gap: 8, transition: 'background 0.15s' }}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-1)' }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: active ? 500 : 400, color: active ? 'var(--text)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || 'Yeni sohbet'}</div>
                            {s.preview && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.preview}</div>}
                            <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2, display: 'flex', gap: 4 }}><span>{s.message_count} mesaj</span><span>·</span><span>{new Date(s.updated_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span></div>
                          </div>
                          <button onClick={(e) => deleteSession(s.id, e)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: '2px', display: 'flex', flexShrink: 0, opacity: 0, transition: 'opacity 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#f87171' }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.color = 'var(--text-3)' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ))
              })()}
            </div>
          </div>
        )}

        {/* Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {/* Messages */}
          <div
            style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 14px 10px' : '20px 22px 12px', display: 'flex', flexDirection: 'column', gap: 18, animation: 'fadeIn 0.2s ease', overscrollBehavior: 'contain' }}
            key={currentSessionId ?? 'empty'}
          >
            {chatHistory.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: '0 8px' }}>
                <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>
                  {currentProvider?.supports_tools
                    ? 'Ne yediğini söyle — veritabanına otomatik kaydedeyim'
                    : 'Beslenme hakkında bir şey sor'
                  }
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 480 }}>
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      style={{
                        fontSize: 12, padding: '7px 13px', borderRadius: 99,
                        border: '1px solid var(--border-2)', color: 'var(--text-2)',
                        background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 680, width: '100%', margin: '0 auto' }}>
                {chatHistory.map((msg, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: isMobile ? 8 : 11,
                    flexDirection: isMobile && msg.role === 'user' ? 'row-reverse' : 'row',
                    animation: 'msgIn 0.22s ease both', animationDelay: `${Math.min(i * 30, 180)}ms`,
                  }}>
                    <div style={{
                      width: isMobile ? 26 : 30, height: isMobile ? 26 : 30, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                      background: msg.role === 'user' ? 'var(--surface-3)' : 'var(--lime-bg)',
                      border: msg.role === 'assistant' ? '1px solid rgba(200,240,118,0.2)' : 'none',
                      color: msg.role === 'user' ? 'var(--text-2)' : 'var(--lime)',
                    }}>
                      {msg.role === 'user'
                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        : <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M10 2C6.5 2 4 5 4 8.5c0 4 3 7 6 9.5 3-2.5 6-5.5 6-9.5C16 5 13.5 2 10 2z" fill="currentColor" opacity=".7"/></svg>
                      }
                    </div>
                    <div style={{
                      flex: 1, minWidth: 0,
                      ...(isMobile ? { display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' } : {}),
                    }}>
                      {!isMobile && (
                        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5 }}>
                          {msg.role === 'user' ? 'Sen' : `NutriTrack AI · ${msg.provider ?? ''}`}
                        </div>
                      )}
                      <div style={{
                        fontSize: isMobile ? 14 : 13, color: msg.role === 'user' ? 'var(--text)' : 'var(--text-2)', wordBreak: 'break-word',
                        ...(isMobile ? {
                          background: msg.role === 'user' ? 'rgba(200,240,118,0.08)' : 'var(--surface-2)',
                          padding: '9px 13px',
                          borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                          maxWidth: '88%',
                        } : {}),
                      }}>
                        {msg.role === 'user'
                          ? <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{msg.content}</div>
                          : <AIMessageContent content={msg.content} />
                        }
                      </div>
                      {msg.tool_calls && <ToolResultCards calls={msg.tool_calls} qc={qc} />}
                      {msg.role === 'assistant' && i === chatHistory.length - 1 && !isLoading && (
                        <SuggestButtons toolCalls={msg.tool_calls} onPick={handleSend} />
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div style={{ display: 'flex', gap: isMobile ? 8 : 11 }}>
                    <div style={{ width: isMobile ? 26 : 30, height: isMobile ? 26 : 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--lime-bg)', border: '1px solid rgba(200,240,118,0.2)', color: 'var(--lime)' }}>
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M10 2C6.5 2 4 5 4 8.5c0 4 3 7 6 9.5 3-2.5 6-5.5 6-9.5C16 5 13.5 2 10 2z" fill="currentColor" opacity=".7"/></svg>
                    </div>
                    <div style={{
                      display: 'flex', gap: 4, alignItems: 'center',
                      ...(isMobile
                        ? { background: 'var(--surface-2)', borderRadius: '4px 14px 14px 14px', padding: '11px 14px' }
                        : { paddingTop: 8 }),
                    }}>
                      {[0, 150, 300].map(delay => (
                        <span key={delay} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-3)', display: 'inline-block', animation: 'bounce-dot 1s ease infinite', animationDelay: `${delay}ms` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
            background: 'var(--bg)',
          }}>
            <div style={{ padding: isMobile ? '10px 12px' : '12px 22px 16px' }}>
              <div style={{
                background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8,
                padding: isMobile ? '10px 12px' : '10px 14px',
                maxWidth: 680, margin: '0 auto',
              }}>
                {isMobile && (
                  <Paperclip
                    size={17}
                    aria-hidden="true"
                    style={{ color: 'var(--text-3)', flexShrink: 0 }}
                  />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}

                  placeholder={isMobile
                    ? 'Mesaj yaz…'
                    : currentProvider?.supports_tools
                      ? '"Öğle yemeğinde tavuk yedim"'
                      : '"100g nohut kaç kalori?"'
                  }
                  disabled={isLoading}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontSize: isMobile ? 16 : 13, color: 'var(--text)', fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  style={{
                    width: isMobile ? 36 : 32, height: isMobile ? 36 : 32, borderRadius: 9,
                    background: 'var(--lime)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                    opacity: input.trim() && !isLoading ? 1 : 0.4,
                    flexShrink: 0,
                  }}
                >
                  <Send size={isMobile ? 15 : 14} style={{ color: '#080C0A' }} />
                </button>
              </div>
              {!isMobile && (
                <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-3)', marginTop: 8 }}>
                  {currentProvider?.supports_tools
                    ? 'Claude · söylediğin öğünleri otomatik kaydeder'
                    : currentProvider?.offline
                      ? 'Yerel model · internet bağlantısı gerekmez'
                      : `${currentProvider?.label ?? 'AI'} · sohbet modu`
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile drawers */}
      {isMobile && showSessions && (
        <SessionsSheet
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelect={(id) => loadSession(id)}
          onDelete={deleteSession}
          onClose={() => setShowSessions(false)}
        />
      )}
      {isMobile && showProviders && (
        <ProviderSheet
          providers={providers}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          onSelect={(pid, mid) => { selectProvider(pid); selectModel(mid) }}
          onClose={() => setShowProviders(false)}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  )
}
