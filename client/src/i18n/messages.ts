import {
  ERROR_MESSAGES,
  formatRupiah,
  interpolate,
  LOG_MESSAGES,
  type Lang,
  type LogEntry,
  type LogParam,
  type LogParams,
  type MessageMap,
} from '@tuan-tanah/shared'
import type { TFunction } from 'i18next'
import i18n from './index.js'
import {
  hustleName,
  kejadianEffect,
  kejadianName,
  landBusinessName,
  landTierName,
  passTypeName,
  roleName,
  tierName,
  tileName,
} from './gameData.js'

function currentLang(): Lang {
  return i18n.language?.startsWith('en') ? 'en' : 'id'
}

/** Resolve a structured param to a localized string for the viewer's language. */
function resolveParam(t: TFunction, v: LogParam): string | number {
  if (typeof v !== 'object') return v
  switch (v.kind) {
    case 'tile':
      return tileName(t, v.id)
    case 'rupiah':
      return formatRupiah(v.amount)
    case 'role':
      return roleName(t, v.role)
    case 'tier':
      return tierName(t, v.track, v.tier)
    case 'landBusiness':
      return landBusinessName(t, v.business)
    case 'landTier':
      return landTierName(t, v.business, v.tier)
    case 'kejadian':
      return kejadianName(t, v.id)
    case 'kejadianEffect':
      return kejadianEffect(t, v.id)
    case 'hustle':
      return hustleName(t, v.id)
    case 'pass':
      return passTypeName(t, v.passType)
    case 'dealType':
      return t(`negotiation.dealTypes.${v.dealType}`)
  }
}

function resolveParams(t: TFunction, params?: LogParams): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(params ?? {})) out[k] = resolveParam(t, v)
  return out
}

function render(
  table: MessageMap,
  t: TFunction,
  code: string | undefined,
  params: LogParams | undefined,
  fallback: string,
): string {
  if (!code) return fallback
  const template = table[currentLang()][code]
  if (!template) return fallback
  return interpolate(template, resolveParams(t, params))
}

/** Localize a server log entry; falls back to its English `message`. */
export function renderLogEntry(t: TFunction, entry: LogEntry): string {
  return render(LOG_MESSAGES, t, entry.code, entry.params, entry.message)
}

/** Localize a server error payload; falls back to its English `message`. */
export function renderErrorMessage(
  t: TFunction,
  payload: { message: string; code?: string; params?: LogParams },
): string {
  return render(ERROR_MESSAGES, t, payload.code, payload.params, payload.message)
}
