import {
  BOARD,
  HOUSE_TIERS,
  HUSTLE_CARDS,
  KEJADIAN_CARDS,
  PROPERTY_TIERS,
  ROLES,
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
