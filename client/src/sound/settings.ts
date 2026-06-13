import { create } from 'zustand'

/**
 * Per-player sound preferences (mute + master volume), persisted to localStorage
 * so they stick across sessions. This is the single source of truth the
 * AudioManager reads at play time and the SoundToggle drives from the UI.
 */
const STORAGE_KEY = 'tuan-tanah:sound'
const DEFAULT_VOLUME = 0.7

interface PersistedSettings {
  muted: boolean
  volume: number
}

interface SoundSettings extends PersistedSettings {
  toggleMuted: () => void
  setVolume: (volume: number) => void
}

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>
      return {
        muted: typeof parsed.muted === 'boolean' ? parsed.muted : false,
        volume: typeof parsed.volume === 'number' ? clampVolume(parsed.volume) : DEFAULT_VOLUME,
      }
    }
  } catch {
    // storage unavailable / malformed — fall through to defaults
  }
  return { muted: false, volume: DEFAULT_VOLUME }
}

function persist(settings: PersistedSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // storage unavailable (private mode) — degrade silently
  }
}

function clampVolume(v: number): number {
  return Math.max(0, Math.min(1, v))
}

export const useSoundSettings = create<SoundSettings>((set, get) => ({
  ...loadSettings(),
  toggleMuted: () => {
    const muted = !get().muted
    set({ muted })
    persist({ muted, volume: get().volume })
  },
  setVolume: (volume) => {
    const clamped = clampVolume(volume)
    set({ volume: clamped })
    persist({ muted: get().muted, volume: clamped })
  },
}))
