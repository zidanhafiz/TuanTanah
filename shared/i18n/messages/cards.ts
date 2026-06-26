import type { MessageMap } from '../params.js'

export const log: MessageMap = {
  en: {
    'cards.hustleEarn': '{{name}} hustled "{{card}}" (+{{amount}})',
    'cards.hustlePass': '{{name}} hustled "{{card}}" — gained a {{pass}} pass',
    'cards.hustleMove': '{{name}} hustled "{{card}}" — advancing to {{tile}}',
    'cards.kejadianDraw': 'Kejadian Nasional: {{card}} — {{effect}}',
    'cards.kejadianBlocked': '{{card}} was blocked by Pejabat — no effect',
    'cards.korupsiNoEffect': 'Korupsi Terungkap — nobody has outstanding pinjol; no effect',
    'cards.reshuffleKabinet':
      'Reshuffle Kabinet — {{cleared}} effect(s) and {{passes}} free-pass card(s) wiped',
    'cards.gempaBumi': 'Gempa Bumi struck {{region}} — rent halved for {{rounds}} rounds',
    'cards.pemiluNoEffect': 'Pemilu — not enough players to hold a vote; no effect',
    'cards.pemiluStart': 'Pemilu! Everyone votes for who skips their next turn',
  },
  id: {
    'cards.hustleEarn': '{{name}} berhasil hustle "{{card}}" (+{{amount}})',
    'cards.hustlePass': '{{name}} berhasil hustle "{{card}}" — mendapat kartu {{pass}}',
    'cards.hustleMove': '{{name}} berhasil hustle "{{card}}" — bergerak ke {{tile}}',
    'cards.kejadianDraw': 'Kejadian Nasional: {{card}} — {{effect}}',
    'cards.kejadianBlocked': '{{card}} diblokir oleh Pejabat — tidak berdampak',
    'cards.korupsiNoEffect':
      'Korupsi Terungkap — tidak ada pemain yang memiliki pinjol; tidak berdampak',
    'cards.reshuffleKabinet':
      'Reshuffle Kabinet — {{cleared}} efek dan {{passes}} kartu bebas dihapus',
    'cards.gempaBumi':
      'Gempa Bumi mengguncang {{region}} — sewa berkurang separuh selama {{rounds}} putaran',
    'cards.pemiluNoEffect':
      'Pemilu — pemain tidak cukup untuk melakukan pemilihan; tidak berdampak',
    'cards.pemiluStart':
      'Pemilu! Semua orang memilih siapa yang akan melewatkan giliran berikutnya',
  },
}

export const error: MessageMap = { en: {}, id: {} }
