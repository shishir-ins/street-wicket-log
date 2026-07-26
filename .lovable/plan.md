
## Why you're seeing "row violates row-level security policy"

The app currently has two mismatched admin systems:

- **Database (Supabase):** only allows writes to `players` / `matches` / `balls` if `has_role(auth.uid(), 'admin')` — i.e. a **real signed-in user** with an `admin` row in `user_roles`.
- **App (your PIN 2580):** just flips a `localStorage` flag. There is **no actual login**, so `auth.uid()` is `null`, so every write is denied.

That's why adding a player, scoring a ball, uploading a photo etc. all throw the same error the moment RLS gets touched. This has to be fixed at the root, not patched per-screen.

### Fix: real auth for you, view-only for everyone else

1. Add a `/auth` page (email + password, Lovable Cloud auth).
2. First time you sign in, we assign your user the `admin` role in `user_roles` (one-off SQL).
3. Replace the PIN lock with `useAdmin()` = "is the signed-in user an admin". Viewers stay viewers (no login required, RLS `SELECT` is already public).
4. All mutations go through the real signed-in session → RLS passes → no more red errors.

After this, sharing the URL still works for view-only (no login), and only your account can score/edit.

---

## Everything else you asked for, grouped

### A. Match-flow fixes
- Add player mid-match: "+ Add player" button in striker/non-striker/bowler/new-batsman/fielder pickers. Creates the player in DB and slots them into the match's team arrays.
- JOKER (common player) bug: dedupe so JOKER only appears once per team list, and their batting/bowling lines aren't double-counted in scorecards.
- Rename "Common player" → **JOKER** everywhere, with a shimmer/gradient magic effect on the tag and their name/avatar in team lists and scoring.
- Hat-trick tracking: detect 3 wickets in 3 consecutive legal balls by the same bowler (across overs), show a "HAT-TRICK!" burst + persistent badge on bowler line; mark the 3 balls in the timeline as "hat-trick balls".

### B. Awards tab
- New route `/awards` in the bottom nav (Pitch / Squad / **Awards**).
- Move the leaderboards + period tabs (Today / Week / Month / All-time) off the homepage into this tab.
- Add categories: Most Runs, Most Wickets, Best SR, Best Economy, Most Sixes, Most Catches, Most Hat-tricks, Man of the Series (period).

### C. Photos everywhere in the match
- Wherever a player name renders in scoring, scorecard, commentary, partnerships, over timeline — show their squad photo (small circular avatar) next to the name. Fallback = initials chip.

### D. UI overhaul (glass + matte, wavy, sticker accents)
- New design tokens in `src/styles.css`: glass surface (backdrop-blur + translucent), matte surface (soft grain), gradient JOKER accent, wavy dividers.
- Card shapes: replace rectangles with **squircle** (large asymmetric radius), **blob**, **ticket** (notched), **wave-top** — used consistently per section (e.g. all stat cards = squircle, all player cards = blob-with-notch).
- Bat/ball SVG stickers as decorative corner accents on tab headers and section cards (non-interactive, low opacity, slightly rotated).
- Smooth micro-interactions: card hover-lift, tab underline morph, number roll-up on score change.
- Keep the existing chalk/scoreboard vibe — layer glass on top, don't throw it away.

### E. General
- Fix any red-text runtime errors surfaced in console (I'll sweep after the auth fix, since most of them cascade from RLS).

---

## What I need from you before I start

Two decisions that change the shape of the work:

1. **Auth**: OK with email + password sign-in for you (one account, you're the only admin)? Or do you want Google sign-in instead? (Email/password is fastest — one screen, no OAuth setup.)
2. **Scope of this turn**: this is genuinely 6–8 hours of work if I do it all at once, and long turns are where regressions creep in. I'd rather ship in 3 waves:
   - **Wave 1 (this turn):** Auth + RLS fix, mid-match add player, JOKER rename + dedupe bug, hat-tricks, Awards tab. → unblocks you and kills the errors.
   - **Wave 2:** Photos everywhere in scoring/scorecard/commentary, JOKER magic effect.
   - **Wave 3:** Full UI overhaul (glass/matte, wavy shapes, bat/ball stickers, micro-interactions).

   Say "wave 1 only" or "do it all in one go" and I'll proceed.

## On auto-commit / auto-push
Lovable already auto-commits every change I make to the project's git history — you don't need to do anything. Publishing to a live URL is one click via the Publish button (or I can prompt it after Wave 3). There's no separate "make it a functional web app" step; it already is one, hosted on Lovable.
