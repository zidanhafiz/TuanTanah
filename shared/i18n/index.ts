// Shared i18n surface: structured message params + the bilingual log/error
// message tables. Both server (English fallback rendering) and client (per-player
// localization) consume these so message codes have a single source of truth.
export * from './params.js'
export { LOG_MESSAGES, ERROR_MESSAGES } from './messages/index.js'
