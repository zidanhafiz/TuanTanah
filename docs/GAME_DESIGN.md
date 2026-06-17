## 📄 Tuan Tanah — Complete Game Design Document

---

### 🎯 Overview

A multiplayer web-based Monopoly game with Indonesian theme, supporting 2-8 players, with expanded mechanics beyond classic Monopoly including two property tracks, role-based abilities, pinjol system, meta actions, and Indonesian-themed cards and board.

---

### 🏆 Win Conditions

Room master chooses one or both:

| Mode          | Rule                                                                |
| ------------- | ------------------------------------------------------------------- |
| Time Limit    | 30 / 60 / 90 / 120 minutes — richest player wins when time runs out |
| Target Wealth | First player to reach target amount wins                            |
| Both          | First condition met ends the game                                   |

Richest = total cash + all property values at current tier

---

### 💰 Starting Setup

- Starting money: room master sets **Rp 5 juta – Rp 50 juta** (same for all players)
- Players pick roles in lobby first come first served
- Room master can enable/disable any role before game starts

---

### 🗺️ The Board — 40 Tiles

| Pos | Tile                    | Type       |
| --- | ----------------------- | ---------- |
| 0   | GO                      | Special    |
| 1   | Sentani                 | Papua      |
| 2   | Timika                  | Papua      |
| 3   | Jayapura                | Papua      |
| 4   | Pajak Penghasilan       | Pajak      |
| 5   | Bandara Soekarno-Hatta  | Transport  |
| 6   | Balikpapan              | Kalimantan |
| 7   | Samarinda               | Kalimantan |
| 8   | Bontang                 | Kalimantan |
| 9   | Hustle                  | Special    |
| 10  | Visiting Penjara        | Special    |
| 11  | Merdeka Walk            | Medan      |
| 12  | Kesawan                 | Medan      |
| 13  | Deli                    | Medan      |
| 14  | Pelabuhan Belawan       | Transport  |
| 15  | Malioboro               | Yogyakarta |
| 16  | Kejadian Nasional       | Special    |
| 17  | Prambanan               | Yogyakarta |
| 18  | Kotagede                | Yogyakarta |
| 19  | Parkir Bebas            | Special    |
| 20  | Masuk Penjara           | Special    |
| 21  | Senggigi                | Lombok     |
| 22  | Kuta Mandalika          | Lombok     |
| 23  | Sembalun                | Lombok     |
| 24  | Hustle                  | Special    |
| 25  | Darmo                   | Surabaya   |
| 26  | Gubeng                  | Surabaya   |
| 27  | Pakuwon                 | Surabaya   |
| 28  | Pelabuhan Tanjung Priok | Transport  |
| 29  | Kejadian Nasional       | Special    |
| 30  | Pajak Kemewahan         | Pajak      |
| 31  | Kuta                    | Bali       |
| 32  | Kintamani               | Bali       |
| 33  | Stasiun Gambir          | Transport  |
| 34  | Hustle                  | Special    |
| 35  | Sudirman                | Jakarta    |
| 36  | Thamrin                 | Jakarta    |
| 37  | Kejadian Nasional       | Special    |
| 38  | Parkir Bebas            | Special    |
| 39  | Pajak Hadiah            | Pajak      |

---

### 🏘️ Region Pricing

| Region     | Color      | Buy Price   | House Rent Base | Property Passive Base |
| ---------- | ---------- | ----------- | --------------- | --------------------- |
| Papua      | Brown      | Rp 600rb    | Rp 140rb        | Rp 100rb              |
| Kalimantan | Dark Green | Rp 1 juta   | Rp 245rb        | Rp 175rb              |
| Medan      | Yellow     | Rp 1.5 juta | Rp 350rb        | Rp 250rb              |
| Yogyakarta | Light Blue | Rp 2 juta   | Rp 490rb        | Rp 350rb              |
| Lombok     | Pink       | Rp 2.5 juta | Rp 630rb        | Rp 450rb              |
| Surabaya   | Red        | Rp 3.5 juta | Rp 840rb        | Rp 600rb              |
| Bali       | Orange     | Rp 4.5 juta | Rp 1.4 juta     | Rp 1 juta             |
| Jakarta    | Dark Grey  | Rp 6 juta   | Rp 2.8 juta     | Rp 2 juta             |

Region bonus when full set owned: **rent ×2, passive ×2**

---

### 🚇 Transport Tiles

| Owned | Rent When Landed |
| ----- | ---------------- |
| 1     | Rp 1 juta        |
| 2     | Rp 2 juta        |
| 3     | Rp 4 juta        |
| 4     | Rp 8 juta        |

During **Mudik Season** card: all transport tiles earn 2x

---

### 🏠 House Track (4 Tiers)

| Tier | Name          | Build Cost       | Rent Multiplier |
| ---- | ------------- | ---------------- | --------------- |
| 1    | Rumah Kecil   | Base price × 0.5 | Base × 1        |
| 2    | Rumah Sedang  | Base price × 1   | Base × 2.5      |
| 3    | Rumah Besar   | Base price × 2   | Base × 5        |
| 4    | Villa / Hotel | Base price × 4   | Base × 10       |

- High one-time rent when opponent lands
- No passive income
- First buyer locks this track for that tile

---

### 🏗️ Property Track (5 Tiers)

| Tier | Name        | Build Cost       | Rent Multiplier | Passive Multiplier |
| ---- | ----------- | ---------------- | --------------- | ------------------ |
| 1    | Warung      | Base price × 0.3 | Base × 0.5      | Base × 1           |
| 2    | Toko        | Base price × 0.7 | Base × 1        | Base × 2           |
| 3    | Minimarket  | Base price × 1.5 | Base × 2        | Base × 4           |
| 4    | Mall        | Base price × 3   | Base × 4        | Base × 7           |
| 5    | Konglomerat | Base price × 6   | Base × 7        | Base × 12          |

- Lower rent than House when opponent lands
- Passive income collected at start of owner's turn every round
- Passive income still collected in jail
- First buyer locks this track for that tile

---

### 🎲 Turn Structure

```
1. Collect passive income from all your Property track tiles
2. Pay pinjol interest if any active loans
3. Roll dice → move
4. Land on tile → trigger effect
5. Choose 1 meta action (optional)
6. End turn
```

---

### 🏦 Tile Effects

| Tile                | Effect                                        |
| ------------------- | --------------------------------------------- |
| Unowned property    | Buy at listed price or pass (returns to bank) |
| Your own property   | Option to upgrade tier                        |
| Opponent's property | Pay rent based on track + tier                |
| GO                  | Collect role salary                           |
| Visiting Penjara    | Nothing — just visiting                       |
| Masuk Penjara       | Go to jail immediately                        |
| Parkir Bebas        | Nothing happens                               |
| Pajak               | Pay fixed tax to bank                         |
| Kejadian Nasional   | Draw top card from Kejadian deck              |
| Hustle              | Draw top card from Hustle deck                |
| Transport           | Pay rent based on how many owner has          |

---

### ⚡ Meta Actions

| Action    | Cost           | Effect                                                                      |
| --------- | -------------- | --------------------------------------------------------------------------- |
| Invest    | Property price | Buy unowned tile or upgrade your tile                                       |
| Work      | Free           | Skip movement this turn, collect salary                                     |
| Hustle    | Free           | Draw one Hustle card                                                        |
| Lobby     | Rp 2 juta      | Negatively affect another player (block upgrade, delay turn)                |
| Sabotage  | Rp 3 juta      | Trigger a kejadian effect on one specific tile                              |
| Korupsi   | Risk           | Steal Rp 7 juta from bank — 30% success, 70% caught = jail + Rp 2 juta fine |
| Negotiate | Free           | Propose structured deal to any player                                       |

---

### 🤝 Negotiation — Structured Deals

| Deal              | Description                                    |
| ----------------- | ---------------------------------------------- |
| Property swap     | Trade your tile ↔ opponent's tile              |
| Cash for property | Buy opponent's tile at agreed price            |
| Rent immunity     | Pay Rp X for immunity on one tile for N rounds |
| Revenue share     | Split passive income % for N rounds            |

Both players must accept — server enforces automatically

---

### 💸 Pinjol System

| Rule               | Detail                                              |
| ------------------ | --------------------------------------------------- |
| Loan sizes         | Rp 2 juta / Rp 5 juta / Rp 10 juta                  |
| Interest           | 10% per round, deducted at start of your turn       |
| Max loans          | 3 active at once                                    |
| Borrow limit       | Can't borrow more than 3× your total property value |
| Can't pay interest | Must sell a property or get eliminated              |
| Rentenir role      | Can lend pinjol instead of bank, earns the interest |

---

### 🎴 Kejadian Nasional Cards (15 cards)

| Card              | Effect                                                 |
| ----------------- | ------------------------------------------------------ |
| Lebaran           | Everyone receives THR bonus (Rp 2 juta)                |
| Kenaikan BBM      | Everyone pays Rp 500rb travel tax                      |
| Banjir Jakarta    | All Jakarta tiles drop 1 tier for 3 rounds             |
| Mudik Season      | All transport tiles earn 2× for 3 rounds               |
| Viral di Medsos   | One random property earns 3× for 3 rounds              |
| Reshuffle Kabinet | All lobby effects immediately reset                    |
| Inspeksi Pajak    | Richest player pays 10% of their cash as fine          |
| Gempa Bumi        | One random region's tiles lose rent bonus for 2 rounds |
| Demo Buruh        | Property track passive income halved for 2 rounds      |
| Festival Budaya   | Yogyakarta tiles earn 2× for 3 rounds                  |
| Boom Tambang      | Kalimantan + Papua tiles earn 2× for 3 rounds          |
| Musim Liburan     | Bali + Lombok tiles earn 2× for 3 rounds               |
| Korupsi Terungkap | Player with most pinjol loans pays Rp 3 juta fine      |
| Investasi Asing   | All property track owners earn Rp 1 juta bonus         |
| Pemilu            | All players vote — most voted player skips next turn   |

---

### 🃏 Hustle Cards (15 cards)

| Card                | Earn        |
| ------------------- | ----------- |
| GoFood Driver       | Rp 500rb    |
| Dropshipper         | Rp 1 juta   |
| Jual Online         | Rp 750rb    |
| Freelance Design    | Rp 1.5 juta |
| Endorse Produk      | Rp 2 juta   |
| Ojek Wisata         | Rp 600rb    |
| Rental Motor Bali   | Rp 800rb    |
| Jual Pulsa          | Rp 400rb    |
| Warung Dadakan      | Rp 700rb    |
| Content Creator     | Rp 1.2 juta |
| Reseller Thrift     | Rp 900rb    |
| Joki Tugas          | Rp 1.1 juta |
| Ngamen Online       | Rp 500rb    |
| Affiliate Marketing | Rp 1.3 juta |
| Jualan Snack Viral  | Rp 600rb    |

---

### 🔒 Jail Rules

| Rule           | Detail                                                |
| -------------- | ----------------------------------------------------- |
| Duration       | Skip 2 turns                                          |
| Pay to exit    | Rp 1 juta                                             |
| Doubles = free | Roll doubles on either stuck turn to exit immediately |
| Passive income | Still collected even in jail                          |

---

### 💀 Elimination

```
Can't pay → take pinjol (up to 3 loans)
         → still can't pay → sell property
         → no properties left → eliminated
```

- Eliminated player's properties return to bank
- Eliminated player becomes spectator

---

### 🎭 All 10 Roles

| #   | Role        | Salary (GO) | Passive Ability                                                   |
| --- | ----------- | ----------- | ----------------------------------------------------------------- |
| 1   | Pengusaha   | Rp 3 juta   | Upgrade 2 tiers per turn                                          |
| 2   | Politisi    | Rp 4 juta   | Lobby costs 50% less                                              |
| 3   | Freelancer  | Rp 3 juta   | Salary 1.5× when passing GO                                       |
| 4   | Investor    | Rp 2.5 juta | Earn 5% from every rent paid to others                            |
| 5   | Kontraktor  | Rp 3 juta   | Build on others' property for 30% cut                             |
| 6   | Ojol Driver | Rp 1.5 juta | Never pay travel/movement tax                                     |
| 7   | Influencer  | Rp 2 juta   | Once per game: viral boost 3× for 3 turns                         |
| 8   | Pejabat     | Rp 5 juta   | Once per game: block any kejadian card                            |
| 9   | Rentenir    | Rp 3.5 juta | Force one player per round to take pinjol, earns the interest     |
| 10  | Sales       | Rp 2.5 juta | Buy property 25% cheaper + earn 15% bank bonus on initiated deals |

Room master can enable/disable any role before game starts. Players pick first come first served in lobby. No duplicate roles.

---

### 🏦 Bank Rules

- Holds all unowned properties
- Receives all taxes and fines
- Source of pinjol loans (unless Rentenir lends directly)
- Passed tiles return to bank (no auction for now)

---

## 🎉 Game Design 100% Locked

Everything is finalized:

```
✅ Board          40 tiles, 8 regions, 4 transport, special tiles
✅ Regions        Papua → Jakarta, price scaling
✅ Tracks         House (4 tier) + Property (5 tier), both with region bonus
✅ Transport      4 tiles, scaling rent
✅ Roles          10 roles, salary based, room master controls
✅ Turn structure Passive → Pinjol interest → Roll → Land → Action → End
✅ Meta actions   7 types
✅ Negotiation    4 structured deal types
✅ Pinjol         3 sizes, 10% interest, max 3 loans
✅ Cards          15 Kejadian + 15 Hustle
✅ Jail           2 turns, Rp 1 juta exit, doubles = free
✅ Win condition  Time limit + Target wealth (room master sets)
✅ Elimination    Bankrupt → spectator
✅ Bank           Holds properties, source of loans
```

---

Ready to move to the next phase — want to start planning the actual build, or do you want to visualize the board layout first?
