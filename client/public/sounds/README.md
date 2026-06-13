# Sound effects

Drop your audio clips here. Vite serves `client/public/` at the web root, so a
file `client/public/sounds/dice-roll.mp3` is fetched at `/sounds/dice-roll.mp3`.

The filenames below are wired in `client/src/sound/manifest.ts` — either name your
files to match, or edit the manifest to point at whatever you have.

| Logical name | Expected file       | Fires when…                                  |
| ------------ | ------------------- | -------------------------------------------- |
| `dice`       | `dice-roll.mp3`     | the roll cinematic starts (dice tumble)      |
| `land`       | `token-land.mp3`    | the token settles on its destination tile    |
| `buy`        | `buy-property.mp3`  | a tile gains an owner                        |
| `sell`       | `sell-property.mp3` | a tile is sold back (owner cleared)          |
| `rent`       | `rent.mp3`          | rent charged after landing on an owned tile  |
| `card`       | `card-flip.mp3`     | a Kejadian / Hustle card is drawn            |
| `yourTurn`   | `your-turn.mp3`     | the turn passes to the local player          |
| `click`      | `click.mp3`         | a button action (end turn, upgrade, vote, …) |
| `eliminated` | `eliminated.mp3`    | a player is knocked out                      |
| `gameOver`   | `game-over.mp3`     | the game ends                                |
| `error`      | `error.mp3`         | the server rejects an action                 |

## Tips

- Keep clips short (< 2s) and not too loud — per-play volume is scaled by the
  user's master volume (default 70%), and `click` is further halved.
- `.mp3` is the safe cross-browser choice. `.ogg` / `.wav` also work in modern
  browsers; if you switch formats, update the extension in `manifest.ts`.
- Missing files fail silently (no crash) — the game just plays nothing for that
  effect, so you can add clips incrementally.
- Audio stays muted until the player's first click/keypress (browser autoplay
  policy); the AudioManager unlocks it automatically on that first gesture.

Free sources: <https://freesound.org>, <https://kenney.nl/assets?q=audio>,
<https://mixkit.co/free-sound-effects/game/>.
