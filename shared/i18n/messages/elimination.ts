import type { MessageMap } from '../params.js'

export const log: MessageMap = {
  en: {
    'elimination.investorCut': '{{name}} earned {{amount}} investor cut on rent',
    'elimination.builderCut': '{{name}} earned {{amount}} builder cut on rent',
    'elimination.paid': '{{name}} paid {{amount}} — {{reason}}',
    'elimination.owesDebt':
      '{{name}} owes {{amount}} ({{reason}}) and must sell property or take a pinjol',
    'elimination.settled': '{{name}} settled their {{amount}} debt ({{reason}})',
    'elimination.bankrupt': '💀 {{name}} went bankrupt and was eliminated',
    'elimination.forfeit': '🏳️ {{name}} left the game',
    'elimination.afkKicked': '⏱️ {{name}} was kicked for repeated inactivity',
    'elimination.afkFined': '⏱️ {{name}} was AFK — turn skipped and fined {{amount}}',
    'elimination.winsTime': '🏆 {{name}} wins — time ran out!',
    'elimination.winsWealth': '🏆 {{name}} wins — reached the target wealth!',
    'elimination.winsLastStanding': '🏆 {{name}} wins — is the last player standing!',
  },
  id: {
    'elimination.investorCut': '{{name}} mendapat {{amount}} komisi investor dari sewa',
    'elimination.builderCut': '{{name}} mendapat {{amount}} komisi kontraktor dari sewa',
    'elimination.paid': '{{name}} membayar {{amount}} — {{reason}}',
    'elimination.owesDebt':
      '{{name}} berutang {{amount}} ({{reason}}) dan harus menjual properti atau mengambil pinjol',
    'elimination.settled': '{{name}} melunasi hutang {{amount}} ({{reason}})',
    'elimination.bankrupt': '💀 {{name}} bangkrut dan tersingkir',
    'elimination.forfeit': '🏳️ {{name}} keluar dari permainan',
    'elimination.afkKicked': '⏱️ {{name}} dikeluarkan karena tidak aktif berulang kali',
    'elimination.afkFined': '⏱️ {{name}} tidak aktif — giliran dilewati dan didenda {{amount}}',
    'elimination.winsTime': '🏆 {{name}} menang — waktu habis!',
    'elimination.winsWealth': '🏆 {{name}} menang — mencapai target kekayaan!',
    'elimination.winsLastStanding': '🏆 {{name}} menang — satu-satunya yang tersisa!',
  },
}

export const error: MessageMap = {
  en: {
    'elimination.noDebt': 'You have no outstanding debt',
    'elimination.playerNotFound': 'Player not found',
    'elimination.stillOwes':
      'You still owe {{amount}} — sell or downgrade property, or take a pinjol',
  },
  id: {
    'elimination.noDebt': 'Kamu tidak memiliki hutang yang belum diselesaikan',
    'elimination.playerNotFound': 'Pemain tidak ditemukan',
    'elimination.stillOwes':
      'Kamu masih berutang {{amount}} — jual atau turunkan properti, atau ambil pinjol',
  },
}
