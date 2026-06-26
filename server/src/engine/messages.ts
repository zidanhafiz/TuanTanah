// Server-side rendering of structured log / error messages into their English
// fallback string. The client re-localizes from the same `code` + `params`, but
// every LogEntry still carries a ready-to-read English `message` (used by the
// event log when no localization is available, by tests, and by server logs).

import {
  BOARD,
  ERROR_MESSAGES,
  formatRupiah,
  HOUSE_TIERS,
  HUSTLE_CARDS,
  interpolate,
  KEJADIAN_CARDS,
  LAND_BUSINESS_TIERS,
  LOG_MESSAGES,
  PROPERTY_TIERS,
  ROLES,
  type LogParam,
  type LogParams,
  type NegotiationDealType,
  type PassType,
} from '@tuan-tanah/shared'

/** Resolve a single tagged param to its English display string. */
function resolveEn(v: LogParam): string | number {
  if (typeof v !== 'object') return v
  switch (v.kind) {
    case 'tile':
      return BOARD[v.id]?.name ?? String(v.id)
    case 'rupiah':
      return formatRupiah(v.amount)
    case 'role':
      return ROLES[v.role].name
    case 'tier': {
      const tiers = v.track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
      return tiers[v.tier - 1]?.name ?? `Tier ${v.tier}`
    }
    case 'landBusiness':
      return v.business === 'dapur_mbg' ? 'Dapur MBG' : 'Warkop-Cafe'
    case 'landTier':
      return LAND_BUSINESS_TIERS[v.business][v.tier - 1]?.name ?? `Tier ${v.tier}`
    case 'kejadian':
      return KEJADIAN_CARDS.find((c) => c.id === v.id)?.name ?? v.id
    case 'kejadianEffect':
      return KEJADIAN_CARDS.find((c) => c.id === v.id)?.effect ?? v.id
    case 'hustle':
      return HUSTLE_CARDS.find((c) => c.id === v.id)?.name ?? v.id
    case 'pass':
      return PASS_LABELS_EN[v.passType]
    case 'dealType':
      return DEAL_TYPE_LABELS_EN[v.dealType]
  }
}

// English labels for small enums surfaced in logs/errors. The client localizes the
// same values via its locale tables (data.passes.* / negotiation.dealTypes.*).
const PASS_LABELS_EN: Record<PassType, string> = {
  rent_free: 'rent-free',
  tax_free: 'tax-free',
  jail_free: 'jail-free',
}
const DEAL_TYPE_LABELS_EN: Record<NegotiationDealType, string> = {
  property_swap: 'property swap',
  cash_for_property: 'cash-for-property deal',
  sell_property: 'property sale',
  rent_immunity: 'rent-immunity deal',
  revenue_share: 'revenue-share deal',
  player_loan: 'loan deal',
  cash_gift: 'cash transfer',
}

function resolveParams(params?: LogParams): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(params ?? {})) out[k] = resolveEn(v)
  return out
}

/** Render a log message code to English; unknown codes render as the code itself. */
export function renderLogEn(code: string, params?: LogParams): string {
  const template = LOG_MESSAGES.en[code]
  if (!template) return code
  return interpolate(template, resolveParams(params))
}

/** Render an error message code to English; unknown codes render as the code itself. */
export function renderErrorEn(code: string, params?: LogParams): string {
  const template = ERROR_MESSAGES.en[code]
  if (!template) return code
  return interpolate(template, resolveParams(params))
}
