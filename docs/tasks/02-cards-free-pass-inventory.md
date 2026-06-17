# Task 2 — Cards & free-pass inventory: player card inventory + hustle/kejadian deck overhaul

- **Type:** 💬 Feature request
- **Effort:** Large
- **Priority:** High
- **Status:** Not started
- **Notion:** https://app.notion.com/p/38201c5ad04981ca9402ed78b9a246a5

## Goal

Introduce player-held "free-pass" cards and overhaul both card decks.

## Scope

### Free-pass card inventory (new)

- Add `Player.ownedCards` (tax-free / rent-free / jail-free). No inventory exists today (only `loans`).
- Initialize in create/add player.
- Consumption logic in rent / tax / jail resolution — model on the existing `rent_immunity` EffectType.
- Obtainable from hustle cards (below) and Kantor Hukum (Task 3).

### Hustle deck overhaul

- **Remove 5**: ojek_wisata, rental_motor_bali, warung_dadakan, reseller_thrift, ngamen_online.
- **Add 8**: Profit Kripto, Giveaway Komentar Terlucu, Teman Lama Bayar Utang, Undangan Kondangan, Joki Mobile Legend, Top Up Diamond, Ulang Tahun, Donate Dramok.
- Plain cash-earn cards are trivial; any that grant a free-pass card depend on the inventory above.

### Kejadian deck changes

- `reshuffle_kabinet`: today only clears `meta_lobby` effects → expand to wipe **ALL** kejadian + hustle active effects **and** owned free-pass cards.
- `viral_medsos` → **"Dollar Naik"**: replace rent-multiplier with immediate **−10% cash to all players**.
- `investasi_asing`: change bonus to **Rp 2 juta**.
- Buff / tile-effect cards: add a visible **marker + impact info** on affected tiles (client UI).

## Affected files

- `shared/types/game.ts` (Player, Card/inventory types, possibly EffectType)
- `shared/types/constants.ts` (deck data)
- `server/src/engine/cards.ts` (effect logic), `server/src/engine/effects.ts`
- Board/tile rendering (client) for markers
- i18n `en.json` / `id.json` + game-data overlay (`client/src/i18n/gameData.ts`)
- Engine tests (`server/test/cards.test.ts`, `effects.test.ts`)

## Notes

- Prerequisite for the "buy free-pass card" option in Task 3.
- Gate: `pnpm check` + `pnpm test` must pass.
