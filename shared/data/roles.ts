// Roles — the ten playable archetypes, their GO salaries, and ability tuning.
import type { Role, RupiahAmount } from '../types/game.js'
import { jt } from './units.js'

export interface RoleDef {
  id: Role
  name: string
  salary: RupiahAmount // collected at GO
  ability: string
}
export const ROLES: Record<Role, RoleDef> = {
  pengusaha: {
    id: 'pengusaha',
    name: 'Pengusaha',
    salary: jt(3),
    ability: 'Build & upgrade tiles 20% cheaper',
  },
  politisi: { id: 'politisi', name: 'Politisi', salary: jt(4.5), ability: 'Lobby costs 50% less' },
  freelancer: {
    id: 'freelancer',
    name: 'Freelancer',
    salary: jt(3),
    ability: 'Salary 1.5× when passing GO',
  },
  investor: {
    id: 'investor',
    name: 'Investor',
    salary: jt(3),
    ability: 'Earn 5% from every rent paid to others',
  },
  kontraktor: {
    id: 'kontraktor',
    name: 'Kontraktor',
    salary: jt(3),
    ability: "Build on others' property for 30% cut",
  },
  ojol_driver: {
    id: 'ojol_driver',
    name: 'Ojol Driver',
    salary: jt(3),
    ability: 'Pays 50% less tax (travel, income & luxury)',
  },
  influencer: {
    id: 'influencer',
    name: 'Influencer',
    salary: jt(3),
    ability: 'Once per game: viral boost 3× for 3 turns',
  },
  pejabat: {
    id: 'pejabat',
    name: 'Pejabat',
    salary: jt(5),
    ability: 'Once per game: block any kejadian card',
  },
  rentenir: {
    id: 'rentenir',
    name: 'Rentenir',
    salary: jt(4),
    ability: 'Force one player per round to take pinjol, earns the interest',
  },
  sales: {
    id: 'sales',
    name: 'Sales',
    salary: jt(3),
    ability: 'Buy property 25% cheaper + earn 15% bank bonus on initiated deals',
  },
}

export const ALL_ROLES: Role[] = Object.keys(ROLES) as Role[]

// Token colors assigned to players in join order.
export const PLAYER_COLORS = [
  '#EF4444', // red
  '#3B82F6', // blue
  '#22C55E', // green
  '#EAB308', // yellow
  '#A855F7', // purple
  '#EC4899', // pink
  '#F97316', // orange
  '#14B8A6', // teal
]

// ---- Role abilities ----
export const INVESTOR_RENT_CUT_RATE = 0.05 // Investor skims 5% of rent paid between others
export const KONTRAKTOR_CUT_RATE = 0.3 // Kontraktor earns 30% of rent on tiles it built on others' land
export const SALES_DEAL_BONUS_RATE = 0.15 // Sales earns 15% bank bonus on deals it initiates
export const INFLUENCER_BOOST_MULTIPLIER = 3 // viral boost passive multiplier
export const INFLUENCER_BOOST_ROUNDS = 3 // viral boost duration
