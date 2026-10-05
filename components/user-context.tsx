'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from 'next-themes'

interface UserProfile {
  username: string; fullName: string; email: string; avatar: string | null
  level: number; currentXP: number; requiredXP: number; rank: string; streakDays: number
  timezone?: string
}
interface UserContextType {
  user: UserProfile | null; loading: boolean; error: string | null
  refreshUser: () => Promise<void>; updateUser: (data: Partial<UserProfile>) => void
}
const UserContext = createContext<UserContextType | undefined>(undefined)
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const { setTheme } = useTheme()
  const refreshUser = useCallback(async () => {
    const run = ++generation.current
    try {
      const response = await fetch('/api/user-profile', { cache: 'no-store' })
      if (run !== generation.current) return
      if (response.status === 401) { setUser(null); setError(null); return }
      if (!response.ok) throw new Error('Could not load your profile. Please retry.')
      const data = await response.json()
      if (run === generation.current) { setUser(data); setError(null) }
    } catch (e) {
      if (run === generation.current) setError(e instanceof Error ? e.message : 'Unable to load profile')
    } finally { if (run === generation.current) setLoading(false) }
  }, [])
  useEffect(() => {
    // Remove the previous account-independent cache; personal data stays in memory.
    localStorage.removeItem('ayoub-user-data')
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setLoading(false); return
    }
    const supabase = createClient()
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) { generation.current++; setUser(null); setLoading(false); return }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        generation.current++; setUser(null); setLoading(true)
        const timer = setTimeout(() => { timers.delete(timer); void refreshUser() }, 0)
        timers.add(timer)
      }
    })
    const refresh = () => { void refreshUser() }
    window.addEventListener('discipline:updated', refresh)
    const loadSettings = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      const res = await fetch('/api/user-settings')
      if (res.ok) {
        const settings = await res.json()
        setTheme(settings.theme || 'dark')
        localStorage.setItem('discipline:sounds', String(settings.sounds_enabled === true))
        localStorage.setItem('discipline:effects', String(settings.effects_enabled !== false))
      }
    }
    void loadSettings().catch(() => {})
    return () => { generation.current++; subscription.unsubscribe(); timers.forEach(clearTimeout); window.removeEventListener('discipline:updated', refresh) }
  }, [refreshUser, setTheme])
  return <UserContext.Provider value={{ user, loading, error, refreshUser, updateUser: data => setUser(previous => previous ? { ...previous, ...data } : previous) }}>{children}</UserContext.Provider>
}
export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within UserProvider')
  return context
}
