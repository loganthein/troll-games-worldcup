# Troll Games – Alex's World Cup Competition

Live leaderboard for Alex's 4-player World Cup draft competition. Each player owns 8 teams; points accumulate as teams advance.

**Live site:** https://loganthein.github.io/troll-games-worldcup/

---

## Scoring

| Milestone | Pts | Cumulative |
|---|---|---|
| Advance from Group Stage | +1 | 1 |
| Reach Round of 16 | +2 | 3 |
| Reach Quarterfinals | +4 | 7 |
| Reach Semifinals | +8 | 15 |
| Win the Championship | +16 | 31 |

---

## Players

| Player | Teams |
|---|---|
| Logan | Spain, Germany, Belgium, Morocco, Ecuador, Ivory Coast, Austria, Czech Republic |
| Jazz | France, Netherlands, Colombia, Switzerland, Uruguay, Canada, Sweden, Ghana |
| Garrett | Argentina, Brazil, USA, Croatia, Senegal, South Korea, Scotland, Egypt |
| Luke | Portugal, England, Norway, Japan, Mexico, Turkey, Australia, Paraguay |

---

## Automatic Score Updates

From the Round of 32 onward, scores update themselves. A GitHub Actions workflow
(`.github/workflows/update-scores.yml`) runs every 15 minutes, checks ESPN for
newly-finished World Cup matches, and bumps any drafted team that won one round
forward (`r32` → `r16` → `qf` → `sf` → `champion`).

Losers are left alone — their stage already reflects the furthest round they
reached, which is what their points are based on. Don't set a knockout loser to
`"eliminated"`; that stage is reserved for teams that never got out of the group
stage, and flipping a knockout loser to it would zero out points they already
earned (`STAGE_PTS.eliminated` is 0).

**One-time setup:** add a repository secret named `GIST_PAT` (Settings →
Secrets and variables → Actions → New repository secret) containing a personal
access token with `gist` scope — the same kind of token used below for manual
updates.

You can trigger a run manually from the Actions tab (`Update World Cup Scores`
→ Run workflow) instead of waiting for the schedule.

---

## Updating Scores (Admin Console)

The console is the manual fallback — useful for the group stage (already
complete) or for correcting a mistake. Knockout-round results are now handled
automatically (see above). No server required either way.

### Step 1 — Set your PAT (once per browser session)

```js
tg.setPAT("ghp_yourPersonalAccessToken")
```

Your PAT needs `gist` scope only. Generate one at https://github.com/settings/tokens

### Step 2 — Update a team

```js
tg.updateTeam("Spain", "r16")
```

### Update multiple teams at once

```js
tg.updateMany([
  ["Spain",     "r16"],
  ["Germany",   "qf"],
  ["Argentina", "eliminated"]
])
```

### Valid stage values

| Stage | Meaning | Points |
|---|---|---|
| `"group"` | Group stage (not yet advanced) | 0 |
| `"r32"` | Advanced from group stage (Round of 32) | 1 |
| `"r16"` | Reached Round of 16 | 3 |
| `"qf"` | Reached Quarterfinals | 7 |
| `"sf"` | Reached Semifinals | 15 |
| `"champion"` | Won the championship | 31 |
| `"eliminated"` | Eliminated | 0 |

### Other helpers

```js
tg.showData()   // print current state as a table
tg.resetAll()   // reset all teams to "group" (with confirm prompt)
```

---

## Data Storage

All game state lives in a single GitHub Gist:
- **Gist ID:** `6c8e7f60b0148c6b41c2b9510f791578`
- **Filename:** `troll-games-data.json`

The page fetches fresh data on every load (no caching).

### Initial Gist seed

If the Gist file doesn't exist yet, run this in the console after setting your PAT:

```js
tg.resetAll()
```

---

## Setup

1. Push to `main` branch of `loganthein/troll-games-worldcup`
2. GitHub Settings → Pages → Branch: `main` / folder: `/(root)` → Save
3. Site is live at `https://loganthein.github.io/troll-games-worldcup/`
