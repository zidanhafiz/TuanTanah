# Codebase Review Findings

As our codebase currently stands, the core game loop of "Tuan Tanah" is robust and end-to-end functional. Following my review of the current implementation status and the code:

## Remaining TODOs Identified
The primary remaining task items are documented in the codebase as intentional "later-milestone" work rather than critical bugs:

1.  **Rentenir Forced Loans (@ server/src/engine/roles.ts):** The `rentenir` (loanshark) role currently lacks the mechanic for initiating forced loans as part of the `pinjol` system.
2.  **Sales 15% Deal Bonus (@ server/src/engine/roles.ts):** The `sales` role needs implementation for the 15% deal bonus (referenced as TTG-17).

## Architectural Observations
- **Engine Purity:** The engineering choices (pure functions, RNG injection, centralized constants in `shared/`) make the engine highly testable and maintainable.
- **Server/Client Separation:** The authoritative server model is correctly implemented, preventing client-side logic drift.
- **I18n Gap:** Server-side game log messages and error strings are currently English-only, representing the most significant non-balance-related gap.

## Recommendations
Given the current maturity of the code, I recommend:
1.  **Addressing the Role TODOs:** Prioritize the implementation of the `rentenir` and `sales` role specifics when the next balance/content milestone is scheduled.
2.  **Server-Side I18n:** If localization requirements intensify, plan for a structured way to localize `EngineError` messages, potentially leveraging the existing `shared` constants or a template system in the server-log stream.

The system is stable and ready for expansion. I'll maintain these notes for our next iteration.
