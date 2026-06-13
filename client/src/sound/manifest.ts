// Sound-effect catalogue. Each entry maps a logical sound name (used throughout
// the client) to a file under `client/public/sounds/`, served at `/sounds/...`.
//
// To add a real clip: drop the file in `client/public/sounds/` with the filename
// below (or change the filename here). Keep clips short (<2s) and quiet-ish —
// per-play volume is scaled by the user's global volume in the AudioManager.
//
// Supported formats: whatever the browser's <audio> can decode. `.mp3` is the
// safe cross-browser default; `.ogg`/`.wav` also work in modern browsers.
export const SOUND_FILES = {
  dice: 'dice-roll.mp3', // dice tumble — played as the roll cinematic starts
  land: 'token-land.mp3', // token settles on its destination tile
  buy: 'buy-property.mp3', // a tile gains an owner
  money: 'money.mp3', // local player's cash changes — rent, sell, tax, income, card payouts

  card: 'card-flip.mp3', // a Kejadian / Hustle card is drawn
  yourTurn: 'your-turn.mp3', // turn passes to the local player
  click: 'click.mp3', // generic button / action feedback
  eliminated: 'eliminated.mp3', // a player is knocked out
  gameOver: 'game-over.mp3', // the game ends
  error: 'error.mp3', // server rejected an action
} as const

export type SoundName = keyof typeof SOUND_FILES

/** Public URL for a given sound (Vite serves `client/public/*` at the web root). */
export const BASE_PATH = '/sounds/'
