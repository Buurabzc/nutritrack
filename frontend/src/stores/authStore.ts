import { create } from 'zustand'

interface AppStore {
  ready: boolean
  setReady: (v: boolean) => void
}

export const useAuthStore = create<AppStore>((set) => ({
  ready: true,
  setReady: (ready) => set({ ready }),
}))
