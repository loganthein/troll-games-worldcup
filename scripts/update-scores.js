/**
 * update-scores.js — Auto-advance teams in the Gist based on real match results.
 *
 * Runs on a GitHub Actions schedule (see .github/workflows/update-scores.yml).
 * Pulls finished World Cup matches from ESPN, and for any drafted team that
 * won, bumps their stage one round forward (r32 -> r16 -> qf -> sf -> champion).
 *
 * Losers are left untouched — their stage already reflects the furthest
 * milestone they reached, and that's what their points are based on. Setting
 * a knockout loser to "eliminated" would wrongly zero out points they already
 * earned, since STAGE_PTS.eliminated is 0 (that value is reserved for teams
 * that never escaped the group stage).
 *
 * Each ESPN event id is recorded in data.processedMatchIds so a match is only
 * ever applied once, no matter how many times the lookback window covers it.
 */

const GIST_ID = '6c8e7f60b0148c6b41c2b9510f791578';
const GIST_FILENAME = 'troll-games-data.json';
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const LOOKBACK_DAYS = 4;

const PAT = process.env.GIST_PAT;

// ESPN display name -> canonical team name (mirrors app.js ESPN_NAME_MAP)
const ESPN_NAME_MAP = {
  'United States':      'USA',
  "Côte d'Ivoire":      'Ivory Coast',
  'Korea Republic':     'South Korea',
  'Republic of Korea':  'South Korea',
  'Czechia':            'Czech Republic',
};

const NEXT_STAGE = { group: 'r32', r32: 'r16', r16: 'qf', qf: 'sf', sf: 'champion' };

function espnCanonical(name) {
  return ESPN_NAME_MAP[name] || name;
}

function dateStr(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function matchWinnerIndex(competitors) {
  const explicit = competitors.findIndex(c => c.winner === true);
  if (explicit !== -1) return explicit;
  const scores = competitors.map(c => Number(c.score));
  if (scores.every(s => Number.isFinite(s)) && scores[0] !== scores[1]) {
    return scores[0] > scores[1] ? 0 : 1;
  }
  return -1; // can't determine a winner yet
}

async function fetchGist() {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: { Authorization: 'token ' + PAT, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`Gist GET failed: ${res.status} ${await res.text()}`);
  const gist = await res.json();
  const file = gist.files[GIST_FILENAME];
  if (!file) throw new Error('Gist file not found');
  return JSON.parse(file.content);
}

async function patchGist(data) {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'token ' + PAT,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files: { [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) } } }),
  });
  if (!res.ok) throw new Error(`Gist PATCH failed: ${res.status} ${await res.text()}`);
}

async function fetchFinishedMatches() {
  const now = new Date();
  const start = new Date(now); start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS);
  const end = new Date(now); end.setUTCDate(end.getUTCDate() + 1);
  const url = `${ESPN_SCOREBOARD}?dates=${dateStr(start)}-${dateStr(end)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status}`);
  const json = await res.json();
  return (json.events || []).filter(e => e.status?.type?.state === 'post');
}

async function main() {
  if (!PAT) throw new Error('Missing GIST_PAT env var');

  const data = await fetchGist();
  if (!Array.isArray(data.processedMatchIds)) data.processedMatchIds = [];
  const processed = new Set(data.processedMatchIds);

  const events = await fetchFinishedMatches();
  const log = [];
  let dirty = false;

  for (const event of events) {
    if (processed.has(event.id)) continue;

    const comp = event.competitions?.[0];
    const competitors = comp?.competitors || [];
    if (competitors.length !== 2) continue;

    const winnerIdx = matchWinnerIndex(competitors);
    if (winnerIdx === -1) continue; // result not final/clear yet — retry next run

    const winnerName = espnCanonical(competitors[winnerIdx].team?.displayName || '');
    const winnerTeam = data.teams[winnerName];
    if (winnerTeam) {
      const next = NEXT_STAGE[winnerTeam.stage];
      if (next) {
        winnerTeam.stage = next;
        log.push(`${winnerName}: -> ${next}`);
        dirty = true;
      }
    }

    processed.add(event.id);
    dirty = true;
  }

  if (!dirty) {
    console.log('No new finished matches to apply.');
    return;
  }

  data.processedMatchIds = [...processed];
  data.lastUpdated = new Date().toISOString().slice(0, 10);
  await patchGist(data);
  console.log(log.length ? log.join('\n') : 'Recorded processed matches; no drafted team advanced.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
