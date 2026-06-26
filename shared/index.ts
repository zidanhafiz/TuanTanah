// Barrel export for the shared package.
export * from './types/game.js'
export * from './types/events.js'
// Game data — split into content modules under data/ (see docs/REFACTORING_PLAN.md).
// Re-exported flat here so `@tuan-tanah/shared` keeps a single import surface.
export * from './data/economy.js'
export * from './data/regions.js'
export * from './data/tiers.js'
export * from './data/roles.js'
export * from './data/boards/classic.js'
export * from './data/cards/kejadian.js'
export * from './data/cards/hustle.js'
export * from './rulesets/classic.js'
export * from './i18n/index.js'
