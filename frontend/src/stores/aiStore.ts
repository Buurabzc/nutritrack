import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/api/client'

export interface ChatMessage {
  id?: number
  role: 'user' | 'assistant'
  content: string
  provider?: string
  tool_calls?: any[]
}

export interface ChatSession {
  id: number
  title: string | null
  provider: string
  created_at: string
  updated_at: string
  message_count: number
  preview: string
}

interface AIStore {
  selectedProvider: string
  selectedModel: string
  currentSessionId: number | null
  chatHistory: ChatMessage[]
  isLoading: boolean

  selectProvider: (id: string) => void
  selectModel: (model: string) => void
  setLoading: (v: boolean) => void

  // session yönetimi
  startNewSession: (provider: string) => Promise<number>
  loadSession: (sessionId: number) => Promise<void>
  addMessage: (msg: ChatMessage) => Promise<void>
  clearHistory: () => void
}

export const useAIStore = create<AIStore>()(
  persist(
    (set, get) => ({
      selectedProvider: 'claude',
      selectedModel: 'claude-sonnet-4-6',
      currentSessionId: null,
      chatHistory: [],
      isLoading: false,

      selectProvider: (id) => set({ selectedProvider: id }),
      selectModel: (model) => set({ selectedModel: model }),
      setLoading: (v) => set({ isLoading: v }),

      startNewSession: async (provider: string) => {
        const r = await api.post('/chat/sessions', { provider })
        const sessionId: number = r.data.id
        set({ currentSessionId: sessionId })
        return sessionId
      },

      loadSession: async (sessionId: number) => {
        const r = await api.get(`/chat/sessions/${sessionId}/messages`)
        set({ currentSessionId: sessionId, chatHistory: r.data })
      },

      addMessage: async (msg: ChatMessage) => {
        // Önce UI'a ekle
        set(s => ({ chatHistory: [...s.chatHistory, msg] }))

        // Session yoksa oluştur
        let sessionId = get().currentSessionId
        if (!sessionId) {
          sessionId = await get().startNewSession(get().selectedProvider)
        }

        // DB'ye kaydet
        try {
          await api.post(`/chat/sessions/${sessionId}/messages`, {
            role: msg.role,
            content: msg.content,
            provider: msg.provider ?? null,
            tool_calls: msg.tool_calls ?? null,
          })
        } catch {
          // kayıt başarısız olursa UI'da kalır, sessizce geç
        }
      },

      clearHistory: () => {
        set({ currentSessionId: null, chatHistory: [] })
      },
    }),
    {
      name: 'nutritrack-ai',
      partialize: (s) => ({
        selectedProvider: s.selectedProvider,
        selectedModel: s.selectedModel,
        currentSessionId: s.currentSessionId,
      }),
    }
  )
)
