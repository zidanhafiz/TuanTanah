// Structured-message parameters shared by the server (log/error fallback
// rendering) and the client (per-player localization). A log entry / engine
// error carries a message `code` plus these params; plain string|number values
// interpolate verbatim (player names, dice, counts, percents), while the tagged
// variants carry a raw id that each side resolves on its own — the server to
// English for the log fallback, the client to the viewer's language.

import type {
  LandBusiness,
  NegotiationDealType,
  PassType,
  PropertyTrack,
  Role,
  RupiahAmount,
  TileId,
} from '../types/game.js'

export type Lang = 'en' | 'id'

/** A code → template lookup for both languages. */
export type MessageMap = Record<Lang, Record<string, string>>

export type LogParam =
  | string
  | number
  | { kind: 'tile'; id: TileId }
  | { kind: 'rupiah'; amount: RupiahAmount }
  | { kind: 'role'; role: Role }
  | { kind: 'tier'; track: PropertyTrack; tier: number }
  | { kind: 'landBusiness'; business: LandBusiness }
  | { kind: 'landTier'; business: LandBusiness; tier: number }
  | { kind: 'kejadian'; id: string }
  | { kind: 'kejadianEffect'; id: string }
  | { kind: 'hustle'; id: string }
  | { kind: 'pass'; passType: PassType }
  | { kind: 'dealType'; dealType: NegotiationDealType }

export type LogParams = Record<string, LogParam>

// Concise constructors so engine call sites stay readable.
export const tileP = (id: TileId): LogParam => ({ kind: 'tile', id })
export const rpP = (amount: RupiahAmount): LogParam => ({ kind: 'rupiah', amount })
export const roleP = (role: Role): LogParam => ({ kind: 'role', role })
export const tierP = (track: PropertyTrack, tier: number): LogParam => ({
  kind: 'tier',
  track,
  tier,
})
export const landBizP = (business: LandBusiness): LogParam => ({
  kind: 'landBusiness',
  business,
})
export const landTierP = (business: LandBusiness, tier: number): LogParam => ({
  kind: 'landTier',
  business,
  tier,
})
export const kejadianP = (id: string): LogParam => ({ kind: 'kejadian', id })
export const kejadianEffectP = (id: string): LogParam => ({ kind: 'kejadianEffect', id })
export const hustleP = (id: string): LogParam => ({ kind: 'hustle', id })
export const passP = (passType: PassType): LogParam => ({ kind: 'pass', passType })
export const dealTypeP = (dealType: NegotiationDealType): LogParam => ({
  kind: 'dealType',
  dealType,
})

/** Rupiah formatting is language-independent (always id-ID grouping). */
export const formatRupiah = (n: number): string => `Rp ${Math.round(n).toLocaleString('id-ID')}`

/**
 * Replace `{{ name }}` placeholders with already-resolved primitive params.
 * Unknown placeholders are left intact so a missing param is visible, not blank.
 */
export function interpolate(
  template: string,
  params: Record<string, string | number> = {},
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{{${key}}}`,
  )
}
