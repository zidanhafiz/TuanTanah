// Central registry of every server-emitted log / error message, keyed by a stable
// `code` and provided in both languages. Each engine file owns a sibling module
// here (e.g. `turn.ts` for `engine/turn.ts`); this index merges them into the two
// flat lookup tables the render helpers use. Codes are namespaced by file
// (`turn.passGo`, `actions.invest`, …) so modules never collide.

import type { MessageMap } from '../params.js'
import * as abilities from './abilities.js'
import * as actions from './actions.js'
import * as cards from './cards.js'
import * as core from './core.js'
import * as elimination from './elimination.js'
import * as negotiation from './negotiation.js'
import * as pinjol from './pinjol.js'
import * as turn from './turn.js'

const MODULES = [abilities, actions, cards, core, elimination, negotiation, pinjol, turn]

function merge(pick: (m: { log: MessageMap; error: MessageMap }) => MessageMap): MessageMap {
  const out: MessageMap = { en: {}, id: {} }
  for (const m of MODULES) {
    Object.assign(out.en, pick(m).en)
    Object.assign(out.id, pick(m).id)
  }
  return out
}

export const LOG_MESSAGES: MessageMap = merge((m) => m.log)
export const ERROR_MESSAGES: MessageMap = merge((m) => m.error)
