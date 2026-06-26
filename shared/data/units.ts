// Internal rupiah unit helpers shared across the data modules. NOT re-exported
// from the package barrel — game data is authored in juta/ribu for readability.
import type { RupiahAmount } from '../types/game.js'

/** juta — millions of rupiah. */
export const jt = (n: number): RupiahAmount => n * 1_000_000
/** ribu — thousands of rupiah. */
export const rb = (n: number): RupiahAmount => n * 1_000
