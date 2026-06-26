import type { MessageMap } from '../params.js'

export const log: MessageMap = {
  en: {
    'actions.judolJackpot': '{{name}} hit the Judol JACKPOT (+{{amount}})',
    'actions.judolWin': '{{name}} won Judol x{{mult}} (+{{amount}})',
    'actions.judolLose': '{{name}} lost {{amount}} on Judol',
    'actions.work': '{{name}} worked instead of moving (+{{amount}})',
    'actions.lobby':
      '{{name}} lobbied against {{target}} ({{amount}}) — their next turn is skipped',
    'actions.sabotage': '{{name}} sabotaged {{tile}} ({{amount}})',
    'actions.korupsiSuccess': '{{name}} pulled off korupsi (+{{amount}})',
    'actions.korupsiJailed': '{{name}} was caught for korupsi — jailed',
    'actions.negotiate': '{{name}} wants to negotiate with {{target}}',
    'actions.pemiluResult':
      'Pemilu result: {{name}} got the most votes — their next turn is skipped',
    'actions.voteCast': '{{name}} cast their vote',
  },
  id: {
    'actions.judolJackpot': '{{name}} memenangkan JACKPOT Judol (+{{amount}})',
    'actions.judolWin': '{{name}} menang Judol x{{mult}} (+{{amount}})',
    'actions.judolLose': '{{name}} kalah {{amount}} di Judol',
    'actions.work': '{{name}} bekerja alih-alih berjalan (+{{amount}})',
    'actions.lobby':
      '{{name}} melobi terhadap {{target}} ({{amount}}) — giliran berikutnya dilewati',
    'actions.sabotage': '{{name}} menyabotase {{tile}} ({{amount}})',
    'actions.korupsiSuccess': '{{name}} berhasil melakukan korupsi (+{{amount}})',
    'actions.korupsiJailed': '{{name}} tertangkap korupsi — dijebloskan penjara',
    'actions.negotiate': '{{name}} ingin bernegosiasi dengan {{target}}',
    'actions.pemiluResult':
      'Hasil Pemilu: {{name}} mendapat suara terbanyak — giliran berikutnya dilewati',
    'actions.voteCast': '{{name}} telah memberikan suara',
  },
}

export const error: MessageMap = {
  en: {
    'actions.targetRequired': 'Select a target player',
    'actions.targetSelf': 'You cannot target yourself',
    'actions.targetNotFound': 'Target player not found',
    'actions.targetEliminated': 'Target player is eliminated',
    'actions.notEnoughCash': 'Not enough cash',
    'actions.metaCapReached': 'Already used {{count}} meta actions this lap',
    'actions.metaAlreadyUsed': 'You already used that action this lap',
    'actions.judolNoDeposit': 'Enter a deposit amount',
    'actions.judolInsufficientFunds': 'Not enough cash to deposit',
    'actions.workAfterRoll': 'Work must be chosen before rolling (it skips your move)',
    'actions.sabotageNoTile': 'Select a tile to sabotage',
    'actions.sabotageUnowned': 'That tile is not owned',
    'actions.sabotageSelf': 'You cannot sabotage your own tile',
    'actions.unknownMetaAction': 'Unknown meta action "{{name}}"',
    'actions.noActiveVote': 'There is no active vote',
    'actions.cannotVote': 'You cannot vote',
    'actions.voteSelf': 'You cannot vote for yourself',
    'actions.invalidVoteTarget': 'Invalid vote target',
  },
  id: {
    'actions.targetRequired': 'Pilih pemain yang menjadi target',
    'actions.targetSelf': 'Anda tidak bisa menargetkan diri sendiri',
    'actions.targetNotFound': 'Pemain target tidak ditemukan',
    'actions.targetEliminated': 'Pemain target sudah tereliminasi',
    'actions.notEnoughCash': 'Uang tidak cukup',
    'actions.metaCapReached': 'Sudah menggunakan {{count}} meta aksi di lap ini',
    'actions.metaAlreadyUsed': 'Anda sudah menggunakan aksi tersebut di lap ini',
    'actions.judolNoDeposit': 'Masukkan jumlah deposit',
    'actions.judolInsufficientFunds': 'Uang tidak cukup untuk deposit',
    'actions.workAfterRoll': 'Kerja harus dipilih sebelum melempar dadu (melewati langkah Anda)',
    'actions.sabotageNoTile': 'Pilih properti yang ingin disabotase',
    'actions.sabotageUnowned': 'Properti tersebut belum dimiliki siapapun',
    'actions.sabotageSelf': 'Anda tidak bisa menyabotase properti sendiri',
    'actions.unknownMetaAction': 'Meta aksi tidak dikenal "{{name}}"',
    'actions.noActiveVote': 'Tidak ada pemungutan suara yang aktif',
    'actions.cannotVote': 'Anda tidak bisa memilih',
    'actions.voteSelf': 'Anda tidak bisa memilih diri sendiri',
    'actions.invalidVoteTarget': 'Target pemungutan suara tidak valid',
  },
}
