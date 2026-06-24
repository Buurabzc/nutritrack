import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Trash2, MessageSquare, X, ChevronRight, ChevronLeft, Minus, BookMarked, Sun, Clock, Moon, Apple, Check } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '@/api/client'
import { PageHeader, Chip } from '@/components/layout/PageHeader'
import { useIsMobile } from '@/hooks/useIsMobile'

// ── Constants ──────────────────────────────────────────────────────────────
const MEAL_TYPES = [
  { id: 'kahvalti', label: 'Kahvaltı',   color: 'var(--amber)' },
  { id: 'ogle',     label: 'Öğle',       color: 'var(--lime)' },
  { id: 'aksam',    label: 'Akşam',      color: 'var(--blue)' },
  { id: 'atistirma',label: 'Atıştırma',  color: 'var(--purple)' },
]

const MEAL_TYPE_ICONS: Record<string, typeof Sun> = {
  kahvalti: Sun, ogle: Clock, aksam: Moon, atistirma: Apple,
}

const CAT_LABELS: Record<string, string> = {
  protein: 'Protein', sut: 'Süt', tahil: 'Tahıl', baklagil: 'Baklagil',
  sebze: 'Sebze', meyve: 'Meyve', kuruyemis: 'Kuruyemiş', yag: 'Yağ',
  corba: 'Çorba', hazir: 'Hazır', icecek: 'İçecek', diger: 'Diğer',
  atistirma: 'Atıştırmalık',
}

const CAT_EMOJI: Record<string, string> = {
  protein: '🥩', sut: '🥛', tahil: '🌾', baklagil: '🫘',
  sebze: '🥦', meyve: '🍎', kuruyemis: '🥜', yag: '🫙',
  corba: '🍜', hazir: '📦', icecek: '☕', diger: '🍽️',
  atistirma: '🍿',
}

// ── Types ──────────────────────────────────────────────────────────────────
interface Food {
  id: string
  name: string
  category: string
  per_100g: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
}

interface Meal {
  id: number
  food_name: string
  food_id?: string
  amount_g: number
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  meal_type: string
}

type PanelMode = 'browse' | 'add' | 'custom'

// ── Macro pill ─────────────────────────────────────────────────────────────
function MacroPill({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color }}>
        {value % 1 === 0 ? value : value.toFixed(1)}{unit}
      </span>
      <span style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    </div>
  )
}

// ── Mobile: grouped food list row ───────────────────────────────────────────
function FoodListSection({ title, foods, selectedFoodId, onSelect }: {
  title: string
  foods: Food[]
  selectedFoodId?: string
  onSelect: (food: Food) => void
}) {
  if (foods.length === 0) return null
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {foods.map(food => {
          const isSelected = selectedFoodId === food.id
          return (
            <button
              key={food.id}
              onClick={() => onSelect(food)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '10px 12px', borderRadius: 12, textAlign: 'left',
                border: `1px solid ${isSelected ? 'var(--lime)' : 'var(--border)'}`,
                background: isSelected ? 'rgba(200,240,118,0.07)' : 'var(--surface-1)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>
                {CAT_EMOJI[food.category]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {food.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                  P:{food.per_100g.protein}g · K:{food.per_100g.carbs}g · Y:{food.per_100g.fat}g
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontFamily: "'DM Serif Display',serif", color: isSelected ? 'var(--lime)' : 'var(--text-1)' }}>
                  {food.per_100g.calories}
                </div>
                <div style={{ fontSize: 8, color: 'var(--text-3)' }}>kcal/100g</div>
              </div>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isSelected ? 'var(--lime)' : 'var(--surface-2)',
                color: isSelected ? '#080C0A' : 'var(--text-2)',
              }}>
                {isSelected ? <Check size={14} /> : <Plus size={14} />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Meals() {
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const searchRef = useRef<HTMLInputElement>(null)

  // Panel state
  const [mode, setMode] = useState<PanelMode>('browse')
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [targetMealType, setTargetMealType] = useState('kahvalti')
  const [amountG, setAmountG] = useState(100)

  // Custom entry state
  const [customName, setCustomName] = useState('')
  const [customCal, setCustomCal] = useState('')
  const [customProt, setCustomProt] = useState('')
  const [customCarbs, setCustomCarbs] = useState('')
  const [customFat, setCustomFat] = useState('')
  const [customMealType, setCustomMealType] = useState('kahvalti')

  // Search + filter
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('')

  // Templates
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateTab, setTemplateTab] = useState<'apply' | 'save'>('apply')
  const [templateName, setTemplateName] = useState('')

  const isMobile = useIsMobile()
  const [mobileTab, setMobileTab] = useState<'log' | 'browse'>('log')

  // FAB'tan ('/meals', { state: { autoOpenAdd, mealType } }) gelen yönlendirmeyi tüket
  useEffect(() => {
    const state = location.state as { autoOpenAdd?: boolean; mealType?: string } | null
    if (state?.autoOpenAdd) {
      if (state.mealType) setTargetMealType(state.mealType)
      setMode('browse')
      setSelectedFood(null)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state])

  // ── Queries ──
  const { data: today } = useQuery({
    queryKey: ['today'],
    queryFn: () => api.get('/meals/summary/today').then(r => r.data),
    refetchInterval: 15_000,
  })

  const { data: foods = [] } = useQuery<Food[]>({
    queryKey: ['foods', query, activeCategory],
    queryFn: () =>
      api.get('/foods', { params: { q: query, category: activeCategory, limit: 40 } })
        .then(r => r.data ?? []),
    staleTime: 60_000,
  })

  const { data: categories = [] } = useQuery<{ id: string; label: string }[]>({
    queryKey: ['food-categories'],
    queryFn: () => api.get('/foods/categories').then(r => r.data),
    staleTime: Infinity,
  })

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then(r => r.data ?? []),
  })

  // ── Mutations ──
  const addMeal = useMutation({
    mutationFn: (body: any) => api.post('/meals', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today'] })
      qc.invalidateQueries({ queryKey: ['weekly'] })
      setMode('browse')
      setSelectedFood(null)
      setAmountG(100)
    },
  })

  const deleteMeal = useMutation({
    mutationFn: (id: number) => api.delete(`/meals/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today'] })
      qc.invalidateQueries({ queryKey: ['weekly'] })
    },
  })

  const createTemplate = useMutation({
    mutationFn: (body: any) => api.post('/templates', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      setTemplateName('')
      setTemplateTab('apply')
    },
  })

  const deleteTemplate = useMutation({
    mutationFn: (id: number) => api.delete(`/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  })

  const applyTemplate = useMutation({
    mutationFn: (id: number) => api.post(`/templates/${id}/apply`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today'] })
      qc.invalidateQueries({ queryKey: ['weekly'] })
      setShowTemplates(false)
    },
  })

  const handleSelectFood = (food: Food, mealType?: string) => {
    setSelectedFood(food)
    if (mealType) setTargetMealType(mealType)
    setAmountG(100)
    setMode('add')
  }

  const handleAddMeal = () => {
    if (!selectedFood) return
    const ratio = amountG / 100
    addMeal.mutate({
      meal_type: targetMealType,
      food_name: selectedFood.name,
      food_id: selectedFood.id,
      amount_g: amountG,
      calories: selectedFood.per_100g.calories * ratio,
      protein: selectedFood.per_100g.protein * ratio,
      carbs: selectedFood.per_100g.carbs * ratio,
      fat: selectedFood.per_100g.fat * ratio,
      fiber: selectedFood.per_100g.fiber * ratio,
    })
  }

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return
    const items: any[] = []
    Object.entries(mealsByType).forEach(([mealType, meals]) => {
      ;(meals as Meal[]).forEach(m => {
        items.push({ food_name: m.food_name, amount_g: m.amount_g, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat, fiber: m.fiber, meal_type: mealType })
      })
    })
    if (items.length === 0) return
    createTemplate.mutate({ name: templateName.trim(), items })
  }

  const handleAddCustom = () => {
    if (!customName.trim() || !customCal) return
    addMeal.mutate({
      meal_type: customMealType,
      food_name: customName.trim(),
      amount_g: 100,
      calories: parseFloat(customCal) || 0,
      protein: parseFloat(customProt) || 0,
      carbs: parseFloat(customCarbs) || 0,
      fat: parseFloat(customFat) || 0,
      fiber: 0,
    })
    setCustomName(''); setCustomCal(''); setCustomProt(''); setCustomCarbs(''); setCustomFat('')
  }

  useEffect(() => {
    if (mode === 'browse') searchRef.current?.focus()
  }, [mode])

  const totals = today?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  const goals  = today?.goals  ?? { calories: 2100, protein_g: 120, carbs_g: 240, fat_g: 70, fiber_g: 30 }
  const mealsByType: Record<string, Meal[]> = today?.meals_by_type ?? {}

  // ── Son kullanılanlar (mobile): bugünün food_id'li öğünlerinden ters-kronolojik distinct ──
  const recentFoodIds = Object.values(mealsByType).flat()
    .slice()
    .sort((a, b) => b.id - a.id)
    .reduce<string[]>((ids, m) => {
      if (m.food_id && !ids.includes(m.food_id)) ids.push(m.food_id)
      return ids
    }, [])
    .slice(0, 6)

  const { data: recentFoods = [] } = useQuery<Food[]>({
    queryKey: ['recent-foods', recentFoodIds.join(',')],
    queryFn: () => Promise.all(recentFoodIds.map(id => api.get(`/foods/${id}`).then(r => r.data))),
    enabled: recentFoodIds.length > 0,
  })

  const calcNutrition = (food: Food, g: number) => {
    const r = g / 100
    return {
      cal:  food.per_100g.calories * r,
      prot: food.per_100g.protein  * r,
      carb: food.per_100g.carbs    * r,
      fat:  food.per_100g.fat      * r,
    }
  }

  const preview = selectedFood ? calcNutrition(selectedFood, amountG) : null

  // ── Styles ──
  const surface: React.CSSProperties = {
    background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 12,
  }

  const numInput: React.CSSProperties = {
    background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8,
    color: 'var(--text-1)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
    padding: '7px 10px', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {!isMobile && <>
      <PageHeader
        title="Öğünler"
        description={isMobile ? undefined : new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
        action={
          isMobile ? (
            <Chip primary onClick={() => navigate('/ai')}>
              <MessageSquare size={13} /> AI
            </Chip>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Chip onClick={() => { setShowTemplates(true); setTemplateTab('apply') }}>
                <BookMarked size={13} /> Şablonlar
              </Chip>
              <Chip onClick={() => { setMode('custom') }}>
                <Plus size={13} /> Manuel ekle
              </Chip>
              <Chip primary onClick={() => navigate('/ai')}>
                <MessageSquare size={13} /> AI ile ekle
              </Chip>
            </div>
          )
        }
      />

      {/* Mobile tab bar */}
      {isMobile && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {[
            { key: 'log', label: 'Bugün' },
            { key: 'browse', label: 'Ekle' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setMobileTab(key as 'log' | 'browse'); if (key === 'browse') setMode('browse') }}
              style={{
                flex: 1, padding: '10px 0', background: 'none', border: 'none',
                borderBottom: `2px solid ${mobileTab === key ? 'var(--lime)' : 'transparent'}`,
                color: mobileTab === key ? 'var(--lime)' : 'var(--text-3)',
                fontSize: 13, fontWeight: mobileTab === key ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div style={isMobile
        ? { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
        : { display: 'grid', gridTemplateColumns: '300px 1fr', flex: 1, overflow: 'hidden' }
      }>

        {/* ── Sol: Bugünün logu ─────────────────────────────────────── */}
        {(!isMobile || mobileTab === 'log') && <aside style={{
          borderRight: isMobile ? 'none' : '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: 'var(--surface-1)',
          flex: isMobile ? 1 : undefined,
        }}>
          {/* Makro özet */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {totals.calories.toFixed(0)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>/ {goals.calories} kcal</span>
            </div>
            {/* kalori bar */}
            <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 99, marginBottom: 12, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${Math.min(totals.calories / goals.calories * 100, 100)}%`,
                background: totals.calories > goals.calories ? '#f87171' : 'var(--lime)',
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <MacroPill label="Protein" value={Math.round(totals.protein)} unit="g" color="var(--blue)" />
              <MacroPill label="Karb"    value={Math.round(totals.carbs)}   unit="g" color="var(--amber)" />
              <MacroPill label="Yağ"     value={Math.round(totals.fat)}     unit="g" color="var(--purple)" />
              <MacroPill label="Lif"     value={Math.round(totals.fiber)}   unit="g" color="var(--lime)" />
            </div>
          </div>

          {/* Öğün listesi */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {isMobile && (
              <div style={{ display: 'flex', gap: 8, padding: '8px 16px 0' }}>
                <button onClick={() => { setShowTemplates(true); setTemplateTab('apply') }}
                  style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <BookMarked size={13} /> Şablonlar
                </button>
                <button onClick={() => { setMode('custom'); setMobileTab('browse') }}
                  style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Plus size={13} /> Manuel
                </button>
              </div>
            )}
            {MEAL_TYPES.map(({ id, label, color }) => {
              const meals = mealsByType[id] ?? []
              const typeTotal = meals.reduce((s, m) => s + m.calories, 0)
              return (
                <div key={id} style={{ marginBottom: 4 }}>
                  {/* Tip başlığı */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 16px',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', flex: 1 }}>
                      {label}
                    </span>
                    {typeTotal > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                        {typeTotal.toFixed(0)} kcal
                      </span>
                    )}
                    <button
                      onClick={() => { setTargetMealType(id); setMode('browse'); setSelectedFood(null) }}
                      style={{
                        width: 20, height: 20, borderRadius: 5, border: '1px solid var(--border)',
                        background: 'transparent', color: 'var(--text-3)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = color + '22'; e.currentTarget.style.color = color }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' }}
                    >
                      <Plus size={11} />
                    </button>
                  </div>

                  {/* Yemekler */}
                  {meals.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 16px 6px 30px',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.food_name}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                          {m.amount_g}g · P:{m.protein.toFixed(0)}g K:{m.carbs.toFixed(0)}g Y:{m.fat.toFixed(0)}g
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {m.calories.toFixed(0)}
                      </span>
                      <button
                        onClick={() => deleteMeal.mutate(m.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 2, display: 'flex', opacity: 0, transition: 'opacity 0.1s' }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#f87171' }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.color = 'var(--text-3)' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}

                  {meals.length === 0 && (
                    <div style={{ padding: '4px 30px 8px', fontSize: 11, color: 'var(--text-3)' }}>—</div>
                  )}
                </div>
              )
            })}
          </div>
        </aside>}

        {/* ── Sağ: Food browser / Add panel ──────────────────────────── */}
        {(!isMobile || mobileTab === 'browse') && <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: isMobile ? 1 : undefined }}>

          {/* ── BROWSE MODE ── */}
          {(mode === 'browse' || mode === 'add') && (
            <>
              {/* Search bar */}
              <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '9px 14px',
                }}>
                  <Search size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Besin ara… (tavuk, yoğurt, elma)"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setMode('browse'); setSelectedFood(null) }}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 16, color: 'var(--text-1)', fontFamily: 'inherit' }}
                  />
                  {query && (
                    <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', padding: 0 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Kategori chips */}
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setActiveCategory('')}
                    style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 99,
                      border: `1px solid ${activeCategory === '' ? 'var(--lime)' : 'var(--border)'}`,
                      background: activeCategory === '' ? 'rgba(200,240,118,0.12)' : 'transparent',
                      color: activeCategory === '' ? 'var(--lime)' : 'var(--text-3)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Tümü
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(c => c === cat.id ? '' : cat.id)}
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 99,
                        border: `1px solid ${activeCategory === cat.id ? 'var(--lime)' : 'var(--border)'}`,
                        background: activeCategory === cat.id ? 'rgba(200,240,118,0.12)' : 'transparent',
                        color: activeCategory === cat.id ? 'var(--lime)' : 'var(--text-3)',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {CAT_EMOJI[cat.id]} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                {/* Food grid */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                  {foods.length === 0 && (
                    <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
                      Sonuç bulunamadı
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                    {foods.map(food => {
                      const isSelected = selectedFood?.id === food.id
                      return (
                        <button
                          key={food.id}
                          onClick={() => handleSelectFood(food, targetMealType)}
                          style={{
                            ...surface,
                            padding: 12, textAlign: 'left', cursor: 'pointer',
                            border: `1px solid ${isSelected ? 'var(--lime)' : 'var(--border)'}`,
                            background: isSelected ? 'rgba(200,240,118,0.07)' : 'var(--surface-1)',
                            transition: 'all 0.12s', fontFamily: 'inherit',
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-2)' }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)' }}
                        >
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
                            {CAT_EMOJI[food.category]} {CAT_LABELS[food.category] ?? food.category}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 8, lineHeight: 1.3 }}>
                            {food.name}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: 16, fontFamily: "'DM Serif Display',serif", letterSpacing: '-0.01em', color: isSelected ? 'var(--lime)' : 'var(--text-1)' }}>
                              {food.per_100g.calories}
                            </span>
                            <span style={{ fontSize: 9, color: 'var(--text-3)' }}>kcal/100g</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            {[
                              { l: 'P', v: food.per_100g.protein,  c: 'var(--blue)' },
                              { l: 'K', v: food.per_100g.carbs,    c: 'var(--amber)' },
                              { l: 'Y', v: food.per_100g.fat,      c: 'var(--purple)' },
                            ].map(({ l, v, c }) => (
                              <span key={l} style={{ fontSize: 10, color: 'var(--text-3)' }}>
                                <span style={{ color: c, fontWeight: 600 }}>{l}</span>{v}
                              </span>
                            ))}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* ── ADD PANEL (slide-in from right) ── */}
                {mode === 'add' && selectedFood && (
                  <div style={isMobile ? {
                    position: 'absolute', inset: 0, zIndex: 20,
                    display: 'flex', flexDirection: 'column',
                    background: 'var(--bg)',
                  } : {
                    width: 260, borderLeft: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', flexShrink: 0,
                    background: 'var(--bg)',
                  }}>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.3 }}>
                        {selectedFood.name}
                      </span>
                      <button onClick={() => { setMode('browse'); setSelectedFood(null) }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', padding: 2 }}>
                        <X size={14} />
                      </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Miktar */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
                          Miktar (gram)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            onClick={() => setAmountG(a => Math.max(5, a - 10))}
                            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Minus size={13} />
                          </button>
                          <input
                            type="number"
                            value={amountG}
                            min={1}
                            onChange={e => setAmountG(Math.max(1, parseInt(e.target.value) || 1))}
                            style={{ ...numInput, textAlign: 'center', width: 70, flexShrink: 0 }}
                          />
                          <button
                            onClick={() => setAmountG(a => a + 10)}
                            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        {/* Hızlı miktarlar */}
                        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                          {[50, 100, 150, 200, 250].map(g => (
                            <button
                              key={g}
                              onClick={() => setAmountG(g)}
                              style={{
                                fontSize: 10, padding: '3px 7px', borderRadius: 6,
                                border: `1px solid ${amountG === g ? 'var(--lime)' : 'var(--border)'}`,
                                background: amountG === g ? 'rgba(200,240,118,0.12)' : 'transparent',
                                color: amountG === g ? 'var(--lime)' : 'var(--text-3)',
                                cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              {g}g
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Öğün tipi */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
                          Öğün
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {MEAL_TYPES.map(({ id, label, color }) => (
                            <button
                              key={id}
                              onClick={() => setTargetMealType(id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '7px 10px', borderRadius: 8,
                                border: `1px solid ${targetMealType === id ? color + '66' : 'var(--border)'}`,
                                background: targetMealType === id ? color + '11' : 'transparent',
                                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: targetMealType === id ? 'var(--text-1)' : 'var(--text-3)' }}>{label}</span>
                              {targetMealType === id && <ChevronRight size={12} style={{ marginLeft: 'auto', color }} />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Besin değerleri preview */}
                      {preview && (
                        <div style={{ ...surface, padding: 12 }}>
                          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
                            {amountG}g için değerler
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {[
                              { l: 'Kalori', v: preview.cal,  u: 'kcal', c: 'var(--lime)' },
                              { l: 'Protein', v: preview.prot, u: 'g', c: 'var(--blue)' },
                              { l: 'Karb',    v: preview.carb, u: 'g', c: 'var(--amber)' },
                              { l: 'Yağ',     v: preview.fat,  u: 'g', c: 'var(--purple)' },
                            ].map(({ l, v, u, c }) => (
                              <div key={l}>
                                <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{l}</div>
                                <div style={{ fontSize: 15, fontFamily: "'DM Serif Display',serif", color: c, letterSpacing: '-0.01em' }}>
                                  {v.toFixed(1)}<span style={{ fontSize: 10, fontFamily: 'Inter,sans-serif', color: 'var(--text-3)' }}> {u}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Ekle butonu */}
                    <div style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
                      <button
                        onClick={handleAddMeal}
                        disabled={addMeal.isPending}
                        style={{
                          width: '100%', padding: '10px', borderRadius: 10,
                          background: 'var(--lime)', border: 'none',
                          color: '#080C0A', fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                          opacity: addMeal.isPending ? 0.6 : 1,
                        }}
                      >
                        {addMeal.isPending ? 'Ekleniyor…' : `Ekle → ${MEAL_TYPES.find(t => t.id === targetMealType)?.label}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── CUSTOM MODE ── */}
          {mode === 'custom' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <div style={{ maxWidth: 480, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, letterSpacing: '-0.02em' }}>Manuel Giriş</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Listede olmayan besinler için</div>
                  </div>
                  <button
                    onClick={() => setMode('browse')}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Besin adı *</label>
                    <input type="text" placeholder="Örn: Ev yapımı börek" value={customName}
                      onChange={e => setCustomName(e.target.value)} style={numInput} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Kalori (kcal) *</label>
                      <input type="number" placeholder="0" value={customCal}
                        onChange={e => setCustomCal(e.target.value)} style={numInput} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Protein (g)</label>
                      <input type="number" placeholder="0" value={customProt}
                        onChange={e => setCustomProt(e.target.value)} style={numInput} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Karbonhidrat (g)</label>
                      <input type="number" placeholder="0" value={customCarbs}
                        onChange={e => setCustomCarbs(e.target.value)} style={numInput} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Yağ (g)</label>
                      <input type="number" placeholder="0" value={customFat}
                        onChange={e => setCustomFat(e.target.value)} style={numInput} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 8 }}>Öğün</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {MEAL_TYPES.map(({ id, label, color }) => (
                        <button
                          key={id}
                          onClick={() => setCustomMealType(id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                            borderRadius: 8, border: `1px solid ${customMealType === id ? color + '66' : 'var(--border)'}`,
                            background: customMealType === id ? color + '11' : 'transparent',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                          <span style={{ fontSize: 12, color: customMealType === id ? 'var(--text-1)' : 'var(--text-3)' }}>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleAddCustom}
                    disabled={!customName.trim() || !customCal || addMeal.isPending}
                    style={{
                      marginTop: 4, padding: '11px', borderRadius: 10,
                      background: customName.trim() && customCal ? 'var(--lime)' : 'var(--surface-2)',
                      border: 'none', color: customName.trim() && customCal ? '#080C0A' : 'var(--text-3)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {addMeal.isPending ? 'Ekleniyor…' : 'Öğüne Ekle'}
                  </button>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>
                      Besin değerlerini bilmiyorsan AI asistana sor:
                    </div>
                    <button
                      onClick={() => navigate('/ai')}
                      style={{
                        width: '100%', padding: 9, borderRadius: 9,
                        border: '1px solid var(--border)', background: 'transparent',
                        color: 'var(--text-2)', fontSize: 12, cursor: 'pointer',
                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      }}
                    >
                      <MessageSquare size={13} /> AI Asistana sor
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>}
      </div>
      </>}

      {/* ── Mobile: Öğün Ekle ekranı ──────────────────────────────────── */}
      {isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Nav bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <button
              onClick={() => mode === 'custom' ? setMode('browse') : navigate('/')}
              style={{
                width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)',
                background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <ChevronLeft size={17} />
            </button>
            <span style={{ flex: 1, fontFamily: "'DM Serif Display',serif", fontSize: 17, letterSpacing: '-0.02em', textAlign: 'center' }}>
              {mode === 'custom' ? 'Manuel Giriş' : 'Öğün Ekle'}
            </span>
            <button
              onClick={() => navigate('/')}
              style={{ background: 'none', border: 'none', color: 'var(--lime)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
            >
              Bitti
            </button>
          </div>

          {mode === 'custom' ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Besin adı *</label>
                  <input type="text" placeholder="Örn: Ev yapımı börek" value={customName}
                    onChange={e => setCustomName(e.target.value)} style={numInput} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Kalori (kcal) *</label>
                    <input type="number" placeholder="0" value={customCal}
                      onChange={e => setCustomCal(e.target.value)} style={numInput} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Protein (g)</label>
                    <input type="number" placeholder="0" value={customProt}
                      onChange={e => setCustomProt(e.target.value)} style={numInput} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Karbonhidrat (g)</label>
                    <input type="number" placeholder="0" value={customCarbs}
                      onChange={e => setCustomCarbs(e.target.value)} style={numInput} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Yağ (g)</label>
                    <input type="number" placeholder="0" value={customFat}
                      onChange={e => setCustomFat(e.target.value)} style={numInput} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 8 }}>Öğün</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {MEAL_TYPES.map(({ id, label, color }) => (
                      <button
                        key={id}
                        onClick={() => setCustomMealType(id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                          borderRadius: 8, border: `1px solid ${customMealType === id ? color + '66' : 'var(--border)'}`,
                          background: customMealType === id ? color + '11' : 'transparent',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                        <span style={{ fontSize: 12, color: customMealType === id ? 'var(--text-1)' : 'var(--text-3)' }}>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleAddCustom}
                  disabled={!customName.trim() || !customCal || addMeal.isPending}
                  style={{
                    marginTop: 4, padding: '11px', borderRadius: 10,
                    background: customName.trim() && customCal ? 'var(--lime)' : 'var(--surface-2)',
                    border: 'none', color: customName.trim() && customCal ? '#080C0A' : 'var(--text-3)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {addMeal.isPending ? 'Ekleniyor…' : 'Öğüne Ekle'}
                </button>
                <button
                  onClick={() => navigate('/ai')}
                  style={{
                    padding: 9, borderRadius: 9,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text-2)', fontSize: 12, cursor: 'pointer',
                    fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  }}
                >
                  <MessageSquare size={13} /> AI Asistana sor
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Öğün tipi pill-tab'lar */}
              <div style={{ display: 'flex', gap: 8, padding: '12px 16px', overflowX: 'auto', flexShrink: 0 }}>
                {MEAL_TYPES.map(({ id, label }) => {
                  const Icon = MEAL_TYPE_ICONS[id]
                  const active = targetMealType === id
                  return (
                    <button
                      key={id}
                      onClick={() => setTargetMealType(id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                        padding: '7px 12px', borderRadius: 99,
                        border: `1px solid ${active ? 'var(--lime)' : 'var(--border)'}`,
                        background: active ? 'rgba(200,240,118,0.12)' : 'transparent',
                        color: active ? 'var(--lime)' : 'var(--text-3)',
                        fontSize: 12, fontWeight: active ? 600 : 400,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  )
                })}
              </div>

              {/* Arama + kategori chip'leri */}
              <div style={{ padding: '0 16px 10px', flexShrink: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '9px 14px',
                }}>
                  <Search size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Besin ara… (tavuk, yoğurt, elma)"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 16, color: 'var(--text-1)', fontFamily: 'inherit' }}
                  />
                  {query && (
                    <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', padding: 0 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setActiveCategory('')}
                    style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 99,
                      border: `1px solid ${activeCategory === '' ? 'var(--lime)' : 'var(--border)'}`,
                      background: activeCategory === '' ? 'rgba(200,240,118,0.12)' : 'transparent',
                      color: activeCategory === '' ? 'var(--lime)' : 'var(--text-3)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Tümü
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(c => c === cat.id ? '' : cat.id)}
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 99,
                        border: `1px solid ${activeCategory === cat.id ? 'var(--lime)' : 'var(--border)'}`,
                        background: activeCategory === cat.id ? 'rgba(200,240,118,0.12)' : 'transparent',
                        color: activeCategory === cat.id ? 'var(--lime)' : 'var(--text-3)',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {CAT_EMOJI[cat.id]} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Besin listesi */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 24px' }}>
                {!query && (
                  <FoodListSection
                    title="Son kullanılanlar"
                    foods={recentFoods}
                    selectedFoodId={selectedFood?.id}
                    onSelect={f => handleSelectFood(f, targetMealType)}
                  />
                )}

                <FoodListSection
                  title="Tüm besinler"
                  foods={foods}
                  selectedFoodId={selectedFood?.id}
                  onSelect={f => handleSelectFood(f, targetMealType)}
                />

                {foods.length === 0 && (
                  <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                    Sonuç bulunamadı
                  </div>
                )}

                <button
                  onClick={() => setMode('custom')}
                  style={{
                    width: '100%', marginTop: 8, padding: '10px', borderRadius: 9,
                    border: '1px dashed var(--border-2)', background: 'transparent',
                    color: 'var(--text-3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Bulamadım, manuel ekle
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Mobile: porsiyon bottom-sheet ─────────────────────────────── */}
      {isMobile && mode === 'add' && selectedFood && (
        <>
          <div
            onClick={() => { setMode('browse'); setSelectedFood(null) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}
          />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
            background: 'var(--surface-1)', borderRadius: '16px 16px 0 0',
            borderTop: '1px solid var(--border-2)',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            animation: 'slideUp 0.25s ease',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', flexShrink: 0 }}>
              <span style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-2)' }} />
            </div>

            <div style={{ padding: '4px 20px 16px', textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, letterSpacing: '-0.02em' }}>
                {selectedFood.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                {CAT_EMOJI[selectedFood.category]} {CAT_LABELS[selectedFood.category] ?? selectedFood.category}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Porsiyon stepper */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <button
                  onClick={() => setAmountG(a => Math.max(5, a - 10))}
                  style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Minus size={16} />
                </button>
                <div style={{ textAlign: 'center', minWidth: 90 }}>
                  <input
                    type="number"
                    value={amountG}
                    min={1}
                    onChange={e => setAmountG(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{
                      background: 'transparent', border: 'none', outline: 'none',
                      fontFamily: "'DM Serif Display',serif", fontSize: 30, letterSpacing: '-0.02em',
                      color: 'var(--text-1)', textAlign: 'center', width: '100%',
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>gram</div>
                </div>
                <button
                  onClick={() => setAmountG(a => a + 10)}
                  style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Plus size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[50, 100, 150, 200, 250].map(g => (
                  <button
                    key={g}
                    onClick={() => setAmountG(g)}
                    style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 99,
                      border: `1px solid ${amountG === g ? 'var(--lime)' : 'var(--border)'}`,
                      background: amountG === g ? 'rgba(200,240,118,0.12)' : 'transparent',
                      color: amountG === g ? 'var(--lime)' : 'var(--text-3)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {g}g
                  </button>
                ))}
              </div>

              {/* Makro grid */}
              {preview && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[
                    { l: 'Kalori', v: preview.cal,  u: 'kcal', c: 'var(--lime)' },
                    { l: 'Protein', v: preview.prot, u: 'g', c: 'var(--blue)' },
                    { l: 'Karb',    v: preview.carb, u: 'g', c: 'var(--amber)' },
                    { l: 'Yağ',     v: preview.fat,  u: 'g', c: 'var(--purple)' },
                  ].map(({ l, v, u, c }) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>{l}</div>
                      <div style={{ fontSize: 14, fontFamily: "'DM Serif Display',serif", color: c, letterSpacing: '-0.01em' }}>
                        {v.toFixed(1)}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{u}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <button
                onClick={handleAddMeal}
                disabled={addMeal.isPending}
                style={{
                  width: '100%', padding: '13px', borderRadius: 12,
                  background: 'var(--lime)', border: 'none',
                  color: '#080C0A', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  opacity: addMeal.isPending ? 0.6 : 1,
                }}
              >
                {addMeal.isPending ? 'Ekleniyor…' : `Ekle → ${MEAL_TYPES.find(t => t.id === targetMealType)?.label}`}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Şablon Modal ── */}
      {showTemplates && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowTemplates(false) }}
        >
          <div style={{ width: isMobile ? '95vw' : 460, maxHeight: '85vh', background: 'var(--surface-1)', border: '1px solid var(--border-2)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <BookMarked size={15} style={{ color: 'var(--lime)', marginRight: 8 }} />
              <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 16, letterSpacing: '-0.02em' }}>Öğün Şablonları</span>
              <button onClick={() => setShowTemplates(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', padding: 2 }}>
                <X size={15} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 1, padding: '10px 16px 0', borderBottom: '1px solid var(--border)' }}>
              {([['apply', 'Uygula'], ['save', 'Yeni Şablon Kaydet']] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setTemplateTab(tab)}
                  style={{
                    padding: '7px 14px', borderRadius: '8px 8px 0 0', fontFamily: 'inherit', cursor: 'pointer',
                    border: `1px solid ${templateTab === tab ? 'var(--border)' : 'transparent'}`,
                    borderBottom: templateTab === tab ? '1px solid var(--surface-1)' : '1px solid transparent',
                    background: templateTab === tab ? 'var(--surface-1)' : 'transparent',
                    fontSize: 12, color: templateTab === tab ? 'var(--text)' : 'var(--text-3)',
                    marginBottom: templateTab === tab ? -1 : 0,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {templateTab === 'apply' ? (
                templates.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, padding: '32px 0' }}>
                    Henüz kayıtlı şablon yok.<br />
                    <span style={{ fontSize: 12 }}>Bugünkü öğünlerini kaydetmek için "Yeni Şablon" sekmesini kullan.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {templates.map((t: any) => (
                      <div key={t.id} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 3 }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {t.items.length} öğün · {t.items.reduce((s: number, i: any) => s + i.calories, 0).toFixed(0)} kcal
                          </div>
                        </div>
                        <button
                          onClick={() => applyTemplate.mutate(t.id)}
                          disabled={applyTemplate.isPending}
                          style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(200,240,118,0.3)', background: 'rgba(200,240,118,0.08)', color: 'var(--lime)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                        >
                          {applyTemplate.isPending ? '…' : 'Uygula'}
                        </button>
                        <button
                          onClick={() => deleteTemplate.mutate(t.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', padding: 2, flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
                    Bugün kaydedilen <strong style={{ color: 'var(--text-2)' }}>{Object.values(mealsByType).flat().length} öğün</strong> şablon olarak kaydedilecek.
                  </div>
                  {Object.values(mealsByType).flat().length === 0 ? (
                    <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Bugün henüz öğün eklenmedi.</div>
                  ) : (
                    <>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Şablon adı</label>
                        <input
                          type="text"
                          placeholder="Örn: Tipik salı, Düşük karbonhidrat…"
                          value={templateName}
                          onChange={e => setTemplateName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveTemplate() }}
                          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', padding: '9px 12px', width: '100%' }}
                        />
                      </div>
                      <button
                        onClick={handleSaveTemplate}
                        disabled={!templateName.trim() || createTemplate.isPending}
                        style={{
                          padding: '10px', borderRadius: 9, border: 'none', fontFamily: 'inherit',
                          background: templateName.trim() ? 'var(--lime)' : 'var(--surface-2)',
                          color: templateName.trim() ? '#080C0A' : 'var(--text-3)',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {createTemplate.isPending ? 'Kaydediliyor…' : 'Şablon Olarak Kaydet'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
