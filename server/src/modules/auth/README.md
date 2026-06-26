# auth (feature seam — not yet implemented)

Home for the planned **custom auth** (not Supabase Auth). Nothing here runs yet;
this folder exists so the auth work lands without restructuring.

When implemented, expect:

- A Kysely `users` table (new migration under `../../persistence/migrations/`).
- Password hashing (e.g. argon2/bcrypt) + a session or JWT strategy (chosen at
  implementation time).
- A realtime/HTTP surface that issues and validates credentials, integrated with
  the existing `sessions.ts` socket-session mapping in `../../rooms/`.

Keep the engine pure — auth is I/O and lives outside `engine/`.
