import { describe, expect, it } from 'vitest'
import { ERROR_MESSAGES, interpolate, LOG_MESSAGES } from '@tuan-tanah/shared'

// Guards the localized server message tables: every code must exist in both
// languages, and every placeholder present in English must also be present in
// Indonesian (so no param silently goes unrendered in one language).

function placeholders(template: string): Set<string> {
  return new Set([...template.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!))
}

describe.each([
  ['LOG_MESSAGES', LOG_MESSAGES],
  ['ERROR_MESSAGES', ERROR_MESSAGES],
])('%s', (_name, table) => {
  it('has identical code sets in en and id', () => {
    const en = Object.keys(table.en).sort()
    const id = Object.keys(table.id).sort()
    expect(id).toEqual(en)
  })

  it('uses the same placeholders in both languages for each code', () => {
    for (const code of Object.keys(table.en)) {
      expect(placeholders(table.id[code] ?? ''), `placeholders for ${code}`).toEqual(
        placeholders(table.en[code]!),
      )
    }
  })

  it('has no empty templates', () => {
    for (const [code, template] of Object.entries(table.en)) {
      expect(template.length, `en template for ${code}`).toBeGreaterThan(0)
    }
  })
})

describe('interpolate', () => {
  it('substitutes known params and leaves unknown placeholders intact', () => {
    expect(interpolate('{{a}} and {{ b }}', { a: 'x', b: 2 })).toBe('x and 2')
    expect(interpolate('{{missing}}', {})).toBe('{{missing}}')
  })
})
