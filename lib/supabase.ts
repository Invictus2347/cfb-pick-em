import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Types for our database schema
export type League = {
  id: string
  name: string
  invite_code: string
  created_by: string
  pick_limit: number
  push_points: number
  created_at: string
}

export type LeagueMember = {
  league_id: string
  user_id: string
  role: 'commish' | 'player'
  joined_at: string
}

export type Game = {
  id: string
  season: number
  week: number
  home: string
  away: string
  kickoff: string
  status: string
  created_at: string
}

export type LeagueSlateLine = {
  league_id: string
  season: number
  week: number
  game_id: string
  spread_home: number
  spread_away: number
  source: string
  snapped_at: string
  lines_available?: boolean
  publish_window?: 'EARLY' | 'MAIN' | 'LABORDAY'
  lines_published_at?: string
}

export type Pick = {
  league_id: string
  user_id: string
  season: number
  week: number
  game_id: string
  side: 'HOME' | 'AWAY'
  line_value: number
  locked: boolean
  unlock_at?: string  // When picks become visible to other members (default: Saturday 12:00 PM ET)
  result?: 'WIN' | 'LOSS' | 'PUSH'
  points?: number
  created_at: string
  updated_at: string
}

export type LeaguePublishWindow = {
  id: string
  league_id: string
  season: number
  week: number
  window: 'EARLY' | 'MAIN' | 'LABORDAY'
  include_days: string[]
  publish_at: string
  ran: boolean
  created_at: string
}

export type WeeklyStanding = {
  league_id: string
  user_id: string
  season: number
  week: number
  wins: number
  losses: number
  pushes: number
  points: number
  user_email?: string
} 