import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, CheckCircle, XCircle, Loader2, Save, RefreshCw, Trash2, AlertTriangle, Download, Upload } from 'lucide-react'
import { api } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { useIsMobile } from '@/hooks/useIsMobile'

interface SettingMeta {
  masked: string
  has_value: boolean
  source: 'db' | 'env' | 'none'
}

type TestStatus = 'idle' | 'loading' | 'ok' | 'error'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'var(--text-3)',
      marginBottom: 16, paddingBottom: 8,
      borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </div>
  )
}

function StatusIcon({ status }: { status: TestStatus }) {
  if (status === 'idle') return null
  if (status === 'loading') return <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-3)' }} />
  if (status === 'ok') return <CheckCircle size={14} style={{ color: 'var(--lime)' }} />
  return <XCircle size={14} style={{ color: '#f87171' }} />
}

function SourceBadge({ source }: { source: 'db' | 'env' | 'none' }) {
  if (source === 'none') return null
  const label = source === 'db' ? 'DB' : 'ENV'
  const color = source === 'db' ? 'var(--lime)' : 'var(--amber)'
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', padding: '2px 5px',
      borderRadius: 4, background: color + '22', color, border: `1px solid ${color}44`,
    }}>
      {label}
    </span>
  )
}

interface ApiKeyRowProps {
  label: string
  settingKey: string
  meta?: SettingMeta
  testProvider?: string
  onSave: (key: string, value: string) => Promise<void>
}

function ApiKeyRow({ label, settingKey, meta, testProvider, onSave }: ApiKeyRowProps) {
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!value.trim()) return
    setSaving(true)
    await onSave(settingKey, value.trim())
    setSaving(false)
    setValue('')
  }

  const handleTest = async () => {
    if (!testProvider) return
    setTestStatus('loading')
    setTestError('')
    try {
      const r = await api.post(`/settings/test/${testProvider}`)
      setTestStatus(r.data.ok ? 'ok' : 'error')
      if (!r.data.ok) setTestError(r.data.error || 'Bağlantı başarısız')
    } catch {
      setTestStatus('error')
      setTestError('İstek başarısız')
    }
    setTimeout(() => setTestStatus('idle'), 5000)
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>{label}</span>
        {meta && <SourceBadge source={meta.source} />}
        {meta?.has_value && testProvider && (
          <button
            onClick={handleTest}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, padding: '3px 8px', borderRadius: 6,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <StatusIcon status={testStatus} />
            {testStatus === 'idle' && <RefreshCw size={11} />}
            Test
          </button>
        )}
      </div>

      {meta?.has_value && (
        <div style={{
          fontSize: 12, color: 'var(--text-3)', fontFamily: 'monospace',
          background: 'var(--surface-2)', padding: '6px 10px',
          borderRadius: 6, marginBottom: 6, border: '1px solid var(--border)',
        }}>
          {meta.masked}
        </div>
      )}

      {testStatus === 'error' && testError && (
        <div style={{ fontSize: 11, color: '#f87171', marginBottom: 4 }}>{testError}</div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type={show ? 'text' : 'password'}
            placeholder={meta?.has_value ? 'Yeni key gir (güncellemek için)' : 'API key gir…'}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            style={{
              width: '100%', padding: '8px 36px 8px 10px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-1)', fontSize: 13,
              fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <button
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text-3)',
              cursor: 'pointer', padding: 0, display: 'flex',
            }}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={!value.trim() || saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: value.trim() ? 'var(--lime)' : 'var(--surface-2)',
            color: value.trim() ? '#080C0A' : 'var(--text-3)',
            border: 'none', cursor: value.trim() ? 'pointer' : 'default',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
        >
          {saving
            ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
            : <Save size={13} />}
          Kaydet
        </button>
      </div>
    </div>
  )
}

function NumInput({ label, value, onChange, unit }: { label: string; value: number; onChange: (v: number) => void; unit: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            width: 90, padding: '7px 10px',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-1)', fontSize: 13,
            outline: 'none', fontFamily: 'inherit',
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{unit}</span>
      </div>
    </div>
  )
}

const DATA_CATEGORIES = [
  { key: 'meals', label: 'Yemek kayıtları', desc: 'Tüm öğün ve kalori verileri' },
  { key: 'water', label: 'Su kayıtları',    desc: 'Günlük su takibi verileri' },
  { key: 'body',  label: 'Vücut ölçüleri',  desc: 'Kilo, bel, kalça ölçümleri' },
  { key: 'chat',  label: 'Sohbet geçmişi',  desc: 'AI sohbet mesajları' },
]

function DataExportImportCard({ card }: { card: React.CSSProperties }) {
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    const res = await fetch((import.meta.env.VITE_API_URL as string || '/api') + '/export')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nutritrack-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg('')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await api.post('/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      const counts = Object.entries(res.data.imported || {})
        .map(([t, n]) => `${t}: ${n}`)
        .join(', ')
      setImportMsg(`İçe aktarıldı — ${counts}`)
    } catch {
      setImportMsg('İçe aktarma başarısız')
    }
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
    setTimeout(() => setImportMsg(''), 5000)
  }

  return (
    <div style={card}>
      <SectionTitle>Veri Yönetimi</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.6 }}>
        Tüm verileri JSON olarak dışa aktar veya daha önce alınan yedeği içe aktar.
        Syncthing ile senkronize etmek için export dosyasını paylaşılan klasöre kopyalayabilirsin.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={handleExport}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: 'var(--lime)', color: '#080C0A', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Download size={14} /> Dışa Aktar (JSON)
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: 'var(--surface-2)', color: 'var(--text-1)',
            border: '1px solid var(--border)', cursor: importing ? 'default' : 'pointer',
            fontFamily: 'inherit', opacity: importing ? 0.6 : 1,
          }}
        >
          {importing
            ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            : <Upload size={14} />}
          İçe Aktar
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
      </div>
      {importMsg && (
        <div style={{
          marginTop: 12, fontSize: 12, padding: '8px 12px', borderRadius: 8,
          background: importMsg.includes('başarısız') ? 'rgba(248,113,113,0.1)' : 'rgba(200,240,118,0.08)',
          color: importMsg.includes('başarısız') ? '#f87171' : 'var(--lime)',
          border: `1px solid ${importMsg.includes('başarısız') ? 'rgba(248,113,113,0.3)' : 'rgba(200,240,118,0.2)'}`,
        }}>
          {importMsg}
        </div>
      )}
    </div>
  )
}

function DataDeleteCard({ card, onDeleted }: { card: React.CSSProperties; onDeleted: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmed, setConfirmed] = useState(false)
  const [done, setDone] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: (targets: string[]) =>
      api.delete('/settings/data', { data: { targets } }),
    onSuccess: () => {
      setDone(true)
      setSelected(new Set())
      setConfirmed(false)
      onDeleted()
      setTimeout(() => setDone(false), 3000)
    },
  })

  const toggle = (key: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  return (
    <div style={{ ...card, border: '1px solid rgba(201,107,74,0.3)' }}>
      <SectionTitle>Veriyi Sil</SectionTitle>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {DATA_CATEGORIES.map(({ key, label, desc }) => {
          const active = selected.has(key)
          return (
            <button key={key} onClick={() => { toggle(key); setConfirmed(false) }} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
              background: active ? 'rgba(201,107,74,0.1)' : 'var(--surface-2)',
              border: `1px solid ${active ? 'rgba(201,107,74,0.5)' : 'var(--border)'}`,
              textAlign: 'left', transition: 'all 0.15s',
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                border: `1.5px solid ${active ? '#C96B4A' : 'var(--border-2)'}`,
                background: active ? '#C96B4A' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {active && <CheckCircle size={11} color="#fff" />}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: active ? '#E88B6A' : 'var(--text-2)' }}>{label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{desc}</div>
              </div>
            </button>
          )
        })}
      </div>

      {selected.size > 0 && !confirmed && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 9, marginBottom: 12,
          background: 'rgba(201,107,74,0.08)', border: '1px solid rgba(201,107,74,0.25)',
        }}>
          <AlertTriangle size={14} color="#C96B4A" />
          <span style={{ fontSize: 12, color: '#E88B6A', flex: 1 }}>
            {selected.size} kategori seçildi. Bu işlem geri alınamaz.
          </span>
          <button onClick={() => setConfirmed(true)} style={{
            padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
            background: '#C96B4A', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Evet, sil
          </button>
        </div>
      )}

      {confirmed && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 9, marginBottom: 12,
          background: 'rgba(201,107,74,0.12)', border: '1px solid rgba(201,107,74,0.4)',
        }}>
          <AlertTriangle size={14} color="#C96B4A" />
          <span style={{ fontSize: 12, color: '#E88B6A', flex: 1 }}>
            Emin misin? Silinen veriler kurtarılamaz.
          </span>
          <button onClick={() => setConfirmed(false)} style={{
            padding: '5px 10px', borderRadius: 7, fontSize: 11,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            İptal
          </button>
          <button
            onClick={() => deleteMutation.mutate([...selected])}
            disabled={deleteMutation.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
              background: '#C96B4A', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              opacity: deleteMutation.isPending ? 0.6 : 1,
            }}
          >
            {deleteMutation.isPending
              ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              : <Trash2 size={12} />}
            Kalıcı olarak sil
          </button>
        </div>
      )}

      {done && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 9,
          background: 'rgba(200,240,118,0.08)', border: '1px solid rgba(200,240,118,0.2)',
          fontSize: 12, color: 'var(--lime)',
        }}>
          <CheckCircle size={14} /> Seçili veriler silindi.
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const queryClient = useQueryClient()

  const { data: settingsMeta = {} as Record<string, SettingMeta> } = useQuery<Record<string, SettingMeta>>({
    queryKey: ['settings-meta'],
    queryFn: () => api.get('/settings').then(r => r.data),
  })

  const { data: goals } = useQuery<any>({
    queryKey: ['goals'],
    queryFn: () => api.get('/goals').then(r => r.data),
  })

  const { data: profileData } = useQuery<any>({
    queryKey: ['goal-profile'],
    queryFn: () => api.get('/goals/profile').then(r => r.data),
  })

  const [profileForm, setProfileForm] = useState({
    age: 0, gender: 'erkek', height_cm: 0, current_weight_kg: 0,
    target_weight_kg: 0, goal_mode: 'maintain', activity_level: 'moderate', weekly_change_kg: 0.5,
  })
  const [profileSaved, setProfileSaved] = useState(false)

  useEffect(() => {
    if (profileData) {
      setProfileForm({
        age:               profileData.age               ?? 0,
        gender:            profileData.gender            ?? 'erkek',
        height_cm:         profileData.height_cm         ?? 0,
        current_weight_kg: profileData.current_weight_kg ?? 0,
        target_weight_kg:  profileData.target_weight_kg  ?? 0,
        goal_mode:         profileData.goal_mode         ?? 'maintain',
        activity_level:    profileData.activity_level    ?? 'moderate',
        weekly_change_kg:  profileData.weekly_change_kg  ?? 0.5,
      })
    }
  }, [profileData])

  const saveProfileMutation = useMutation({
    mutationFn: (data: typeof profileForm) => api.put('/goals/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goal-profile'] })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2500)
    },
  })

  const [goalForm, setGoalForm] = useState({
    daily_calories: 2100, protein_g: 120, carbs_g: 240,
    fat_g: 70, fiber_g: 30, water_ml: 2500,
  })
  const [goalSaved, setGoalSaved] = useState(false)

  useEffect(() => {
    if (goals) {
      setGoalForm({
        daily_calories: goals.daily_calories ?? 2100,
        protein_g: goals.protein_g ?? 120,
        carbs_g: goals.carbs_g ?? 240,
        fat_g: goals.fat_g ?? 70,
        fiber_g: goals.fiber_g ?? 30,
        water_ml: goals.water_ml ?? 2500,
      })
    }
  }, [goals])

  const saveGoalMutation = useMutation({
    mutationFn: (data: typeof goalForm) => api.put('/goals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      queryClient.invalidateQueries({ queryKey: ['today'] })
      setGoalSaved(true)
      setTimeout(() => setGoalSaved(false), 2500)
    },
  })

  const { data: personasData } = useQuery<{ current: string; personas: Record<string, { label: string; description: string }> }>({
    queryKey: ['personas'],
    queryFn: () => api.get('/settings/personas').then(r => r.data),
  })

  const savePersonaMutation = useMutation({
    mutationFn: (personaKey: string) => api.put('/settings', { key: 'AI_PERSONA', value: personaKey }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personas'] }),
  })

  const handleSaveSetting = async (key: string, value: string) => {
    await api.put('/settings', { key, value })
    queryClient.invalidateQueries({ queryKey: ['settings-meta'] })
    queryClient.invalidateQueries({ queryKey: ['ai-providers'] })
  }

  // Syncthing
  const [syncUrl, setSyncUrl] = useState('')
  const [syncKey, setSyncKey] = useState('')
  const [syncTestStatus, setSyncTestStatus] = useState<TestStatus>('idle')
  const [syncTestError, setSyncTestError] = useState('')

  const handleSyncTest = async () => {
    setSyncTestStatus('loading')
    setSyncTestError('')
    try {
      const r = await api.post('/settings/test/syncthing')
      setSyncTestStatus(r.data.ok ? 'ok' : 'error')
      if (!r.data.ok) setSyncTestError(r.data.error || 'Bağlantı başarısız')
    } catch {
      setSyncTestStatus('error')
      setSyncTestError('İstek başarısız')
    }
    setTimeout(() => setSyncTestStatus('idle'), 5000)
  }

  const handleSaveSyncBulk = async () => {
    const payload: Record<string, string> = {}
    if (syncUrl.trim()) payload['SYNCTHING_URL'] = syncUrl.trim()
    if (syncKey.trim()) payload['SYNCTHING_API_KEY'] = syncKey.trim()
    if (!Object.keys(payload).length) return
    await api.put('/settings/bulk', { settings: payload })
    queryClient.invalidateQueries({ queryKey: ['settings-meta'] })
    setSyncUrl('')
    setSyncKey('')
  }

  // Ollama
  const [ollamaUrl, setOllamaUrl] = useState('')
  const [ollamaModel, setOllamaModel] = useState('')
  const [ollamaTestStatus, setOllamaTestStatus] = useState<TestStatus>('idle')
  const [ollamaModels, setOllamaModels] = useState<string[]>([])

  const handleOllamaTest = async () => {
    setOllamaTestStatus('loading')
    try {
      const r = await api.post('/settings/test/ollama')
      setOllamaTestStatus(r.data.ok ? 'ok' : 'error')
      if (r.data.models) setOllamaModels(r.data.models)
    } catch {
      setOllamaTestStatus('error')
    }
    setTimeout(() => setOllamaTestStatus('idle'), 5000)
  }

  const handleSaveOllama = async () => {
    const payload: Record<string, string> = {}
    if (ollamaUrl.trim()) payload['OLLAMA_URL'] = ollamaUrl.trim()
    if (ollamaModel.trim()) payload['OLLAMA_MODEL'] = ollamaModel.trim()
    if (!Object.keys(payload).length) return
    await api.put('/settings/bulk', { settings: payload })
    queryClient.invalidateQueries({ queryKey: ['settings-meta'] })
    setOllamaUrl('')
    setOllamaModel('')
  }

  const card: React.CSSProperties = {
    background: 'var(--surface-1)', border: '1px solid var(--border)',
    borderRadius: 16, padding: 24, marginBottom: 16,
  }

  const textInput: React.CSSProperties = {
    width: '100%', padding: '8px 10px', boxSizing: 'border-box',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--text-1)', fontSize: 13,
    outline: 'none', fontFamily: 'inherit',
  }

  const isMobile = useIsMobile()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader title="Ayarlar" description={isMobile ? undefined : 'API anahtarları, senkronizasyon ve hedefler'} />

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '20px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>

          {/* AI Persona */}
          <div style={card}>
            <SectionTitle>AI Kişiliği</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 8 }}>
              {personasData && Object.entries(personasData.personas).map(([key, persona]) => {
                const active = personasData.current === key
                return (
                  <button
                    key={key}
                    onClick={() => savePersonaMutation.mutate(key)}
                    style={{
                      padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
                      fontFamily: 'inherit', textAlign: 'left',
                      background: active ? 'var(--lime-bg)' : 'var(--surface-2)',
                      border: `1px solid ${active ? 'var(--lime)' : 'var(--border)'}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--lime)' : 'var(--text-1)', marginBottom: 4 }}>
                      {persona.label}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', lineHeight: 1.4 }}>
                      {persona.description}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* AI Providers */}
          <div style={card}>
            <SectionTitle>AI Sağlayıcılar</SectionTitle>

            <ApiKeyRow label="Claude (Anthropic)" settingKey="ANTHROPIC_API_KEY"
              meta={settingsMeta['ANTHROPIC_API_KEY']} testProvider="claude" onSave={handleSaveSetting} />
            <ApiKeyRow label="OpenAI (GPT-4o, o1…)" settingKey="OPENAI_API_KEY"
              meta={settingsMeta['OPENAI_API_KEY']} testProvider="openai" onSave={handleSaveSetting} />
            <ApiKeyRow label="Google Gemini" settingKey="GOOGLE_API_KEY"
              meta={settingsMeta['GOOGLE_API_KEY']} testProvider="gemini" onSave={handleSaveSetting} />
            <div style={{ marginBottom: 0 }}>
              <ApiKeyRow label="DeepSeek" settingKey="DEEPSEEK_API_KEY"
                meta={settingsMeta['DEEPSEEK_API_KEY']} testProvider="deepseek" onSave={handleSaveSetting} />
            </div>
          </div>

          {/* Ollama */}
          <div style={card}>
            <SectionTitle>Ollama — Yerel AI</SectionTitle>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 5 }}>
                  URL {settingsMeta['OLLAMA_URL']?.has_value && (
                    <> · <SourceBadge source={settingsMeta['OLLAMA_URL'].source} />
                      <span style={{ fontFamily: 'monospace', fontSize: 11 }}> {settingsMeta['OLLAMA_URL'].masked}</span>
                    </>
                  )}
                </div>
                <input type="text" placeholder="http://localhost:11434" value={ollamaUrl}
                  onChange={e => setOllamaUrl(e.target.value)} style={textInput} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 5 }}>
                  Varsayılan model {settingsMeta['OLLAMA_MODEL']?.has_value && (
                    <span style={{ fontFamily: 'monospace', fontSize: 11 }}> · {settingsMeta['OLLAMA_MODEL'].masked}</span>
                  )}
                </div>
                {ollamaModels.length > 0 ? (
                  <select value={ollamaModel} onChange={e => setOllamaModel(e.target.value)}
                    style={{ ...textInput, cursor: 'pointer' }}>
                    <option value="">Seç…</option>
                    {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="llama3.2, mistral…" value={ollamaModel}
                    onChange={e => setOllamaModel(e.target.value)} style={textInput} />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={handleOllamaTest} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 12px', borderRadius: 8, fontSize: 12,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <StatusIcon status={ollamaTestStatus} />
                {ollamaTestStatus === 'idle' && <RefreshCw size={11} />}
                Test et
              </button>
              <button onClick={handleSaveOllama}
                disabled={!ollamaUrl.trim() && !ollamaModel.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: (ollamaUrl.trim() || ollamaModel.trim()) ? 'var(--lime)' : 'var(--surface-2)',
                  color: (ollamaUrl.trim() || ollamaModel.trim()) ? '#080C0A' : 'var(--text-3)',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                <Save size={12} /> Kaydet
              </button>
              {ollamaModels.length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--lime)' }}>
                  {ollamaModels.length} model: {ollamaModels.slice(0, 3).join(', ')}{ollamaModels.length > 3 ? '…' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Syncthing */}
          <div style={card}>
            <SectionTitle>Syncthing Senkronizasyon</SectionTitle>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
              padding: '8px 12px', background: 'var(--surface-2)',
              borderRadius: 8, fontSize: 12, color: 'var(--text-3)',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: settingsMeta['SYNCTHING_URL']?.has_value ? 'var(--lime)' : 'var(--border)',
              }} />
              {settingsMeta['SYNCTHING_URL']?.has_value
                ? `Yapılandırıldı · ${settingsMeta['SYNCTHING_URL'].masked}`
                : 'Henüz yapılandırılmadı'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 5 }}>Syncthing URL</div>
                <input type="text" placeholder="http://127.0.0.1:8384" value={syncUrl}
                  onChange={e => setSyncUrl(e.target.value)} style={textInput} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 5 }}>API Key</div>
                <input type="password" placeholder="Syncthing GUI API anahtarı" value={syncKey}
                  onChange={e => setSyncKey(e.target.value)} style={textInput} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={handleSyncTest} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 12px', borderRadius: 8, fontSize: 12,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <StatusIcon status={syncTestStatus} />
                {syncTestStatus === 'idle' && <RefreshCw size={11} />}
                Bağlantıyı test et
              </button>
              <button onClick={handleSaveSyncBulk}
                disabled={!syncUrl.trim() && !syncKey.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: (syncUrl.trim() || syncKey.trim()) ? 'var(--lime)' : 'var(--surface-2)',
                  color: (syncUrl.trim() || syncKey.trim()) ? '#080C0A' : 'var(--text-3)',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                <Save size={12} /> Kaydet
              </button>
              {syncTestStatus === 'ok' && <span style={{ fontSize: 11, color: 'var(--lime)' }}>Bağlantı başarılı</span>}
              {syncTestStatus === 'error' && syncTestError && <span style={{ fontSize: 11, color: '#f87171' }}>{syncTestError}</span>}
            </div>
          </div>

          {/* Kişisel Profil */}
          <div style={card}>
            <SectionTitle>Kişisel Profil & Hedef Kilo</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Yaş</label>
                <input type="number" value={profileForm.age || ''} onChange={e => setProfileForm(p => ({ ...p, age: Number(e.target.value) }))}
                  placeholder="28" style={{ ...textInput, width: 90 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Cinsiyet</label>
                <select value={profileForm.gender} onChange={e => setProfileForm(p => ({ ...p, gender: e.target.value }))}
                  style={{ ...textInput, width: 110, cursor: 'pointer' }}>
                  <option value="erkek">Erkek</option>
                  <option value="kadin">Kadın</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Boy</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" value={profileForm.height_cm || ''} onChange={e => setProfileForm(p => ({ ...p, height_cm: Number(e.target.value) }))}
                    placeholder="175" style={{ ...textInput, width: 70 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>cm</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Mevcut kilo</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" step="0.1" value={profileForm.current_weight_kg || ''} onChange={e => setProfileForm(p => ({ ...p, current_weight_kg: Number(e.target.value) }))}
                    placeholder="78.5" style={{ ...textInput, width: 70 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>kg</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Hedef kilo</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" step="0.1" value={profileForm.target_weight_kg || ''} onChange={e => setProfileForm(p => ({ ...p, target_weight_kg: Number(e.target.value) }))}
                    placeholder="74" style={{ ...textInput, width: 70 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>kg</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 5 }}>Haftalık değişim</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" step="0.1" value={profileForm.weekly_change_kg || ''} onChange={e => setProfileForm(p => ({ ...p, weekly_change_kg: Number(e.target.value) }))}
                    placeholder="0.5" style={{ ...textInput, width: 70 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>kg/hafta</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 8 }}>Hedef</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ v: 'lose', l: 'Kilo ver' }, { v: 'maintain', l: 'Koru' }, { v: 'gain', l: 'Kilo al' }].map(({ v, l }) => (
                    <button key={v} onClick={() => setProfileForm(p => ({ ...p, goal_mode: v }))} style={{
                      flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
                      border: `1px solid ${profileForm.goal_mode === v ? 'var(--lime)' : 'var(--border)'}`,
                      background: profileForm.goal_mode === v ? 'rgba(200,240,118,0.12)' : 'transparent',
                      color: profileForm.goal_mode === v ? 'var(--lime)' : 'var(--text-3)',
                    }}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 8 }}>Aktivite</label>
                <select value={profileForm.activity_level} onChange={e => setProfileForm(p => ({ ...p, activity_level: e.target.value }))}
                  style={{ ...textInput, cursor: 'pointer' }}>
                  <option value="sedanter">Sedanter (masa başı)</option>
                  <option value="hafif">Hafif (1-2x/hafta)</option>
                  <option value="moderate">Orta (3-5x/hafta)</option>
                  <option value="aktif">Aktif (6-7x/hafta)</option>
                  <option value="cok_aktif">Çok aktif (2x/gün)</option>
                </select>
              </div>
            </div>

            {/* TDEE önizleme */}
            {profileData?.tdee && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {[
                  { l: 'BMR', v: profileData.bmr ? `${Math.round(profileData.bmr)} kcal` : null },
                  { l: 'TDEE', v: `${Math.round(profileData.tdee)} kcal` },
                  { l: 'Hedef kalori', v: profileData.target_calories ? `${profileData.target_calories} kcal` : null },
                ].filter(x => x.v).map(({ l, v }) => (
                  <div key={l} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lime)', marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => saveProfileMutation.mutate(profileForm)}
              disabled={saveProfileMutation.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: 'var(--lime)', color: '#080C0A', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
                opacity: saveProfileMutation.isPending ? 0.6 : 1,
              }}
            >
              {saveProfileMutation.isPending
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : profileSaved ? <CheckCircle size={14} /> : <Save size={14} />}
              {profileSaved ? 'Kaydedildi! (TDEE hesaplandı)' : 'Profili kaydet & TDEE hesapla'}
            </button>
          </div>

          {/* Hedefler */}
          <div style={card}>
            <SectionTitle>Günlük Hedefler</SectionTitle>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              <NumInput label="Kalori" value={goalForm.daily_calories}
                onChange={v => setGoalForm(g => ({ ...g, daily_calories: v }))} unit="kcal" />
              <NumInput label="Protein" value={goalForm.protein_g}
                onChange={v => setGoalForm(g => ({ ...g, protein_g: v }))} unit="g" />
              <NumInput label="Karbonhidrat" value={goalForm.carbs_g}
                onChange={v => setGoalForm(g => ({ ...g, carbs_g: v }))} unit="g" />
              <NumInput label="Yağ" value={goalForm.fat_g}
                onChange={v => setGoalForm(g => ({ ...g, fat_g: v }))} unit="g" />
              <NumInput label="Lif" value={goalForm.fiber_g}
                onChange={v => setGoalForm(g => ({ ...g, fiber_g: v }))} unit="g" />
              <NumInput label="Su" value={Math.round(goalForm.water_ml / 100) / 10}
                onChange={v => setGoalForm(g => ({ ...g, water_ml: Math.round(v * 1000) }))} unit="lt" />
            </div>

            <button
              onClick={() => saveGoalMutation.mutate(goalForm)}
              disabled={saveGoalMutation.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: 'var(--lime)', color: '#080C0A', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
                opacity: saveGoalMutation.isPending ? 0.6 : 1,
              }}
            >
              {saveGoalMutation.isPending
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : goalSaved ? <CheckCircle size={14} /> : <Save size={14} />}
              {goalSaved ? 'Kaydedildi!' : 'Hedefleri kaydet'}
            </button>
          </div>

          {/* Veri Yönetimi */}
          <DataExportImportCard card={card} />

          {/* Veriyi Sil */}
          <DataDeleteCard card={card} onDeleted={() => {
            queryClient.invalidateQueries()
          }} />

          {/* Hakkında */}
          <div style={{ ...card, marginBottom: 0 }}>
            <SectionTitle>Hakkında</SectionTitle>
            <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.8 }}>
              NutriTrack Community Edition · Tamamen yerel, veri paylaşmaz<br />
              Backend: FastAPI + SQLite (WAL) · Frontend: React + Vite + Tailwind<br />
              AI: Claude tool calling (agentic) + OpenAI / Gemini / DeepSeek / Ollama
            </div>
          </div>

        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
