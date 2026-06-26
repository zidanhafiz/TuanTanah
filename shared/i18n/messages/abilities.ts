import type { MessageMap } from '../params.js'

export const log: MessageMap = {
  en: {
    'abilities.viralBoost':
      '{{name}} went viral — {{multiplier}}× passive income for {{rounds}} rounds',
    'abilities.blockKejadian': '{{name}} armed a block on the next Kejadian card',
  },
  id: {
    'abilities.viralBoost':
      '{{name}} menjadi viral — penghasilan pasif {{multiplier}}× selama {{rounds}} ronde',
    'abilities.blockKejadian': '{{name}} mengaktifkan blokir untuk kartu Kejadian berikutnya',
  },
}

export const error: MessageMap = {
  en: {
    'abilities.alreadyUsed': 'You have already used your ability this game',
    'abilities.onlyInfluencer': 'Only the Influencer can do that',
    'abilities.onlyPejabat': 'Only the Pejabat can do that',
    'abilities.unknownAbility': 'Unknown ability "{{name}}"',
  },
  id: {
    'abilities.alreadyUsed': 'Kamu sudah menggunakan kemampuan ini di game ini',
    'abilities.onlyInfluencer': 'Hanya Influencer yang bisa melakukan itu',
    'abilities.onlyPejabat': 'Hanya Pejabat yang bisa melakukan itu',
    'abilities.unknownAbility': 'Kemampuan tidak dikenal "{{name}}"',
  },
}
