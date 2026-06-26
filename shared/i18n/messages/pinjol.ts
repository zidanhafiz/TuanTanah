import type { MessageMap } from '../params.js'

export const log: MessageMap = {
  en: {
    'pinjol.tookLoanFromBank': '{{name}} took a {{amount}} pinjol from the bank',
    'pinjol.tookLoanFromRentenir': '{{name}} took a {{amount}} pinjol from {{lender}}',
    'pinjol.forcedLoan': '{{rentenir}} forced a {{amount}} pinjol on {{target}}',
    'pinjol.paidInterest': '{{name}} paid {{amount}} pinjol interest',
  },
  id: {
    'pinjol.tookLoanFromBank': '{{name}} meminjam {{amount}} pinjol dari bank',
    'pinjol.tookLoanFromRentenir': '{{name}} meminjam {{amount}} pinjol dari {{lender}}',
    'pinjol.forcedLoan': '{{rentenir}} memaksa {{target}} mengambil pinjol {{amount}}',
    'pinjol.paidInterest': '{{name}} membayar bunga pinjol {{amount}}',
  },
}

export const error: MessageMap = {
  en: {
    'pinjol.invalidLoanSize': 'Invalid loan size',
    'pinjol.maxLoansReached': 'You already have {{count}} active loans',
    'pinjol.borrowLimitExceeded':
      "Borrow limit is {{amount}} (3× your property value); you can't borrow this much",
    'pinjol.cannotBorrowFromSelf': 'You cannot borrow from yourself',
    'pinjol.lenderNotFound': 'Lender not found',
    'pinjol.onlyRentenirCanLend': 'Only a Rentenir can lend pinjol',
    'pinjol.lenderEliminated': 'That lender is eliminated',
    'pinjol.lenderInsufficientCash': 'Lender does not have enough cash',
    'pinjol.onlyRentenirCanForce': 'Only a Rentenir can force a loan',
    'pinjol.forceOncePerRound': 'You can only force one loan per round',
    'pinjol.cannotForceOnSelf': 'You cannot force a loan on yourself',
    'pinjol.targetNotFound': 'Target not found',
    'pinjol.targetEliminated': 'That player is eliminated',
    'pinjol.targetMaxLoansReached': '{{name}} already has {{count}} active loans',
    'pinjol.targetBorrowLimitExceeded':
      "{{name}} can't be forced past their {{amount}} borrow limit",
    'pinjol.rentenirInsufficientCash': 'You do not have enough cash to fund the loan',
  },
  id: {
    'pinjol.invalidLoanSize': 'Ukuran pinjaman tidak valid',
    'pinjol.maxLoansReached': 'Kamu sudah memiliki {{count}} pinjaman aktif',
    'pinjol.borrowLimitExceeded':
      'Batas pinjaman adalah {{amount}} (3× nilai propertimu); kamu tidak dapat meminjam sebanyak ini',
    'pinjol.cannotBorrowFromSelf': 'Kamu tidak bisa meminjam dari dirimu sendiri',
    'pinjol.lenderNotFound': 'Pemberi pinjaman tidak ditemukan',
    'pinjol.onlyRentenirCanLend': 'Hanya Rentenir yang bisa meminjamkan pinjol',
    'pinjol.lenderEliminated': 'Pemberi pinjaman itu sudah tereliminasi',
    'pinjol.lenderInsufficientCash': 'Pemberi pinjaman tidak memiliki uang yang cukup',
    'pinjol.onlyRentenirCanForce': 'Hanya Rentenir yang bisa memaksa pinjaman',
    'pinjol.forceOncePerRound': 'Kamu hanya bisa memaksa satu pinjaman per putaran',
    'pinjol.cannotForceOnSelf': 'Kamu tidak bisa memaksa pinjaman pada dirimu sendiri',
    'pinjol.targetNotFound': 'Pemain target tidak ditemukan',
    'pinjol.targetEliminated': 'Pemain itu sudah tereliminasi',
    'pinjol.targetMaxLoansReached': '{{name}} sudah memiliki {{count}} pinjaman aktif',
    'pinjol.targetBorrowLimitExceeded':
      '{{name}} tidak bisa dipaksa melebihi batas pinjaman {{amount}}',
    'pinjol.rentenirInsufficientCash':
      'Kamu tidak memiliki uang yang cukup untuk mendanai pinjaman',
  },
}
