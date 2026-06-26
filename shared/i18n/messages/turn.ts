import type { MessageMap } from '../params.js'

export const log: MessageMap = {
  en: {
    'turn.passiveIncome': '{{name}} collected {{amount}} passive income',
    'turn.revenueShare': '{{name}} shared {{amount}} of passive income with {{beneficiary}}',
    'turn.turnSkipped': "{{name}}'s turn was skipped",
    'turn.turnStart': "{{name}}'s turn",
  },
  id: {
    'turn.passiveIncome': '{{name}} mendapat {{amount}} pendapatan pasif',
    'turn.revenueShare': '{{name}} membagi {{amount}} pendapatan pasif dengan {{beneficiary}}',
    'turn.turnSkipped': 'Giliran {{name}} dilewati',
    'turn.turnStart': 'Giliran {{name}}',
  },
}

export const error: MessageMap = { en: {}, id: {} }
