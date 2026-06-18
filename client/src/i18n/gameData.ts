import {
  BOARD,
  HOUSE_TIERS,
  HUSTLE_CARDS,
  KEJADIAN_CARDS,
  LAND_BUSINESS_TIERS,
  PROPERTY_TIERS,
  ROLES,
  type ActiveEffect,
  type LandBusiness,
  type PassType,
  type PropertyTrack,
  type Role,
  type TileId,
} from '@tuan-tanah/shared'
import type { TFunction } from 'i18next'

// Localized accessors for game data that lives in shared/constants.ts. The
// constants stay the canonical source (ids, balance, fallback text); these
// overlay per-player translations keyed by id. Any id missing from a locale
// falls back to the constant's own string, so proper nouns (place names) need
// no translation entry at all. Keys we DO translate are defined in BOTH locales
// to avoid fallbackLng bleed (see i18n/index.ts).

export function tileName(t: TFunction, id: TileId): string {
  return t(`data.tiles.${id}`, { defaultValue: BOARD[id]?.name ?? String(id) })
}

export function roleName(t: TFunction, role: Role): string {
  return t(`data.roles.${role}.name`, { defaultValue: ROLES[role].name })
}

export function roleAbility(t: TFunction, role: Role): string {
  return t(`data.roles.${role}.ability`, { defaultValue: ROLES[role].ability })
}

export function tierName(t: TFunction, track: PropertyTrack, tier: number): string {
  const tiers = track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
  return t(`data.tiers.${track}.${tier}`, {
    defaultValue: tiers[tier - 1]?.name ?? `Tier ${tier}`,
  })
}

export function landBusinessName(t: TFunction, business: LandBusiness): string {
  return t(`data.landBusiness.${business}`, {
    defaultValue: business === 'dapur_mbg' ? 'Dapur MBG' : 'Warkop-Cafe',
  })
}

export function landTierName(t: TFunction, business: LandBusiness, tier: number): string {
  return t(`data.landTiers.${business}.${tier}`, {
    defaultValue: LAND_BUSINESS_TIERS[business][tier - 1]?.name ?? `Tier ${tier}`,
  })
}

export function kejadianName(t: TFunction, id: string): string {
  return t(`data.kejadian.${id}.name`, {
    defaultValue: KEJADIAN_CARDS.find((c) => c.id === id)?.name ?? id,
  })
}

export function kejadianEffect(t: TFunction, id: string): string {
  return t(`data.kejadian.${id}.effect`, {
    defaultValue: KEJADIAN_CARDS.find((c) => c.id === id)?.effect ?? '',
  })
}

export function hustleName(t: TFunction, id: string): string {
  return t(`data.hustle.${id}`, {
    defaultValue: HUSTLE_CARDS.find((c) => c.id === id)?.name ?? id,
  })
}

export function passTypeName(t: TFunction, type: PassType): string {
  return t(`data.passes.${type}`, { defaultValue: type })
}

/**
 * Short label for a tile-targeted active effect (rent/transport multiplier, tier
 * drop) plus its rounds-remaining, for the on-board marker. Returns null for
 * effects that don't target tiles. Returns null for effects we don't surface.
 */
export function tileEffectLabel(t: TFunction, effect: ActiveEffect): string | null {
  let impact: string | null = null
  if (effect.type === 'rent_multiplier' || effect.type === 'transport_multiplier') {
    impact = t(`data.effects.${effect.type}`, { multiplier: effect.multiplier ?? 1 })
  } else if (effect.type === 'tier_drop') {
    impact = t('data.effects.tier_drop', { multiplier: effect.multiplier ?? 1 })
  }
  if (impact === null) return null
  const rounds = t('data.effects.rounds', { count: effect.roundsRemaining })
  return `${impact} · ${rounds}`
}

/**
 * Human name for what caused an active effect, for the modal/tooltip ("why is
 * this here?"). Kejadian cards resolve to their localized name; sabotage gets its
 * own label. Returns null for sources we don't surface (deals, abilities).
 */
export function effectSourceName(t: TFunction, sourceCard: string): string | null {
  if (KEJADIAN_CARDS.some((c) => c.id === sourceCard)) return kejadianName(t, sourceCard)
  if (sourceCard === 'meta_sabotage') return t('data.effects.sabotageSource')
  return null
}
