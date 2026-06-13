import { BASE_PATH, SOUND_FILES, type SoundName } from './manifest.js'
import { useSoundSettings } from './settings.js'

/**
 * One-shot sound playback over native HTMLAudioElement — no dependencies.
 *
 * Design notes:
 * - We keep one "base" element per sound for preloading, and `cloneNode` it on
 *   each play so the same effect can overlap itself (rapid clicks, two coins).
 * - Browsers block audio until the first user gesture. `installUnlock` primes
 *   every clip inside the first pointer/key event so later *programmatic* plays
 *   (e.g. a dice sound triggered by an incoming socket event) are permitted.
 * - Mute/volume are read from `useSoundSettings` at play time, so the toggle
 *   takes effect immediately without the manager subscribing to the store.
 */
class AudioManager {
  private bases = new Map<SoundName, HTMLAudioElement>()
  private unlocked = false

  /** Build + start preloading every clip. Safe to call more than once. */
  preload(): void {
    if (this.bases.size > 0 || typeof Audio === 'undefined') return
    for (const name of Object.keys(SOUND_FILES) as SoundName[]) {
      const el = new Audio(BASE_PATH + SOUND_FILES[name])
      el.preload = 'auto'
      this.bases.set(name, el)
    }
    this.installUnlock()
  }

  private installUnlock(): void {
    if (typeof window === 'undefined' || this.unlocked) return
    const unlock = (): void => {
      if (this.unlocked) return
      this.unlocked = true
      // Play+immediately-pause each base inside the gesture to satisfy autoplay.
      this.bases.forEach((el) => {
        const p = el.play()
        if (p) {
          p.then(() => {
            el.pause()
            el.currentTime = 0
          }).catch(() => {
            /* user may have files missing — ignore, real plays still try */
          })
        }
      })
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    window.addEventListener('touchstart', unlock)
  }

  /** Play a sound once. `volume` (0–1) scales it relative to the master volume. */
  play(name: SoundName, opts?: { volume?: number }): void {
    const { muted, volume } = useSoundSettings.getState()
    if (muted) return
    const base = this.bases.get(name)
    if (!base) return
    const node = base.cloneNode(true) as HTMLAudioElement
    node.volume = Math.max(0, Math.min(1, volume * (opts?.volume ?? 1)))
    // A play() can reject (missing file, not-yet-unlocked) — never let it throw.
    node.play().catch(() => {})
  }
}

export const audio = new AudioManager()

/** Convenience: fire a one-shot sound from anywhere. */
export const playSound = (name: SoundName, opts?: { volume?: number }): void =>
  audio.play(name, opts)
