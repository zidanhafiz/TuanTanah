// The classic Tuan Tanah ruleset — the only game mode today. It bundles the
// board, regions, roles, and card decks into one descriptor.
//
// The engine does NOT yet take a ruleset param — it still reads the data modules
// directly via the package barrel. This bundle is the seam for the 2nd mode: when
// one exists, add a sibling ruleset and thread a selected ruleset through the
// engine instead of the hardcoded globals (see docs/REFACTORING_PLAN.md §Deferred).
import { BOARD } from '../data/boards/classic.js'
import { HUSTLE_CARDS } from '../data/cards/hustle.js'
import { KEJADIAN_CARDS } from '../data/cards/kejadian.js'
import { REGIONS } from '../data/regions.js'
import { ROLES } from '../data/roles.js'
import { HOUSE_TIERS, PROPERTY_TIERS } from '../data/tiers.js'

export const CLASSIC_RULESET = {
  id: 'classic',
  board: BOARD,
  regions: REGIONS,
  roles: ROLES,
  houseTiers: HOUSE_TIERS,
  propertyTiers: PROPERTY_TIERS,
  kejadianCards: KEJADIAN_CARDS,
  hustleCards: HUSTLE_CARDS,
} as const

export type Ruleset = typeof CLASSIC_RULESET
