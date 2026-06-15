// Renders scripts/og-image.svg -> public/og-image.png at 1200x630 using the
// project's self-hosted brand fonts (Archivo Black + Plus Jakarta Sans) so the
// share card matches the in-app type. Run: `pnpm --filter client og:image`.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { decompress } from 'wawoff2'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))

// resvg-js can't decode woff2, so decompress the @fontsource files to TTF first.
const tmp = mkdtempSync(join(tmpdir(), 'og-fonts-'))
const fontFiles = await Promise.all(
  [
    '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2',
    '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2',
    '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2',
  ].map(async (pkg, i) => {
    const ttf = await decompress(readFileSync(require.resolve(pkg)))
    const out = join(tmp, `font-${i}.ttf`)
    writeFileSync(out, ttf)
    return out
  }),
)

const svg = readFileSync(resolve(here, 'og-image.svg'))
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  font: { fontFiles, loadSystemFonts: false },
})
writeFileSync(resolve(here, '../public/og-image.png'), resvg.render().asPng())
