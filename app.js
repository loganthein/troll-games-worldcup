/**
 * app.js — Troll Games: Alex's World Cup Competition
 *
 * Data flow:
 *   1. Fetch Gist on every page load (no caching)
 *   2. Fall back to DEFAULT_DATA if Gist is empty or unavailable
 *   3. Render leaderboard + teams grid
 *
 * Admin console API:
 *   tg.setPAT("ghp_yourtoken")       — store PAT for this session
 *   tg.updateTeam("Spain", "r16")    — patch Gist + re-render
 *   tg.showData()                    — print current state to console
 *   tg.resetAll()                    — set all teams back to "group"
 *
 * Valid stages: "group" | "r16" | "qf" | "sf" | "champion" | "eliminated"
 */

// ── Constants ──────────────────────────────────────────────────────────────────

const GIST_ID       = '6c8e7f60b0148c6b41c2b9510f791578';
const GIST_FILENAME = 'troll-games-data.json';

// Points earned at each stage (cumulative)
const STAGE_PTS = {
  group:      0,
  eliminated: 0,
  r16:        3,   // +1 advance + +2 reach R16
  qf:         7,   // +4 reach QF
  sf:         15,  // +8 reach SF
  champion:   31,  // +16 win championship
};

const STAGE_LABELS = {
  group:      'Group Stage',
  eliminated: 'Eliminated',
  r16:        'Round of 16',
  qf:         'Quarterfinals',
  sf:         'Semifinals',
  champion:   '🏆 Champion',
};

const PLAYER_COLORS = {
  Logan:   '#3b82f6',
  Jazz:    '#a855f7',
  Garrett: '#f43f5e',
  Luke:    '#10b981',
};

// flagcdn.com ISO codes for all 32 teams
const FLAG_URLS = {
  'Spain':          'https://flagcdn.com/w40/es.png',
  'Germany':        'https://flagcdn.com/w40/de.png',
  'Belgium':        'https://flagcdn.com/w40/be.png',
  'Morocco':        'https://flagcdn.com/w40/ma.png',
  'Ecuador':        'https://flagcdn.com/w40/ec.png',
  'Ivory Coast':    'https://flagcdn.com/w40/ci.png',
  'Austria':        'https://flagcdn.com/w40/at.png',
  'Czech Republic': 'https://flagcdn.com/w40/cz.png',
  'France':         'https://flagcdn.com/w40/fr.png',
  'Netherlands':    'https://flagcdn.com/w40/nl.png',
  'Colombia':       'https://flagcdn.com/w40/co.png',
  'Switzerland':    'https://flagcdn.com/w40/ch.png',
  'Uruguay':        'https://flagcdn.com/w40/uy.png',
  'Canada':         'https://flagcdn.com/w40/ca.png',
  'Sweden':         'https://flagcdn.com/w40/se.png',
  'Ghana':          'https://flagcdn.com/w40/gh.png',
  'Argentina':      'https://flagcdn.com/w40/ar.png',
  'Brazil':         'https://flagcdn.com/w40/br.png',
  'USA':            'https://flagcdn.com/w40/us.png',
  'Croatia':        'https://flagcdn.com/w40/hr.png',
  'Senegal':        'https://flagcdn.com/w40/sn.png',
  'South Korea':    'https://flagcdn.com/w40/kr.png',
  'Scotland':       'https://flagcdn.com/w40/gb-sct.png',
  'Egypt':          'https://flagcdn.com/w40/eg.png',
  'Portugal':       'https://flagcdn.com/w40/pt.png',
  'England':        'https://flagcdn.com/w40/gb-eng.png',
  'Norway':         'https://flagcdn.com/w40/no.png',
  'Japan':          'https://flagcdn.com/w40/jp.png',
  'Mexico':         'https://flagcdn.com/w40/mx.png',
  'Turkey':         'https://flagcdn.com/w40/tr.png',
  'Australia':      'https://flagcdn.com/w40/au.png',
  'Paraguay':       'https://flagcdn.com/w40/py.png',
};

// Default state — all teams in group stage
const DEFAULT_DATA = {
  teams: {
    'Spain':          { owner: 'Logan',   stage: 'group' },
    'Germany':        { owner: 'Logan',   stage: 'group' },
    'Belgium':        { owner: 'Logan',   stage: 'group' },
    'Morocco':        { owner: 'Logan',   stage: 'group' },
    'Ecuador':        { owner: 'Logan',   stage: 'group' },
    'Ivory Coast':    { owner: 'Logan',   stage: 'group' },
    'Austria':        { owner: 'Logan',   stage: 'group' },
    'Czech Republic': { owner: 'Logan',   stage: 'group' },
    'France':         { owner: 'Jazz',    stage: 'group' },
    'Netherlands':    { owner: 'Jazz',    stage: 'group' },
    'Colombia':       { owner: 'Jazz',    stage: 'group' },
    'Switzerland':    { owner: 'Jazz',    stage: 'group' },
    'Uruguay':        { owner: 'Jazz',    stage: 'group' },
    'Canada':         { owner: 'Jazz',    stage: 'group' },
    'Sweden':         { owner: 'Jazz',    stage: 'group' },
    'Ghana':          { owner: 'Jazz',    stage: 'group' },
    'Argentina':      { owner: 'Garrett', stage: 'group' },
    'Brazil':         { owner: 'Garrett', stage: 'group' },
    'USA':            { owner: 'Garrett', stage: 'group' },
    'Croatia':        { owner: 'Garrett', stage: 'group' },
    'Senegal':        { owner: 'Garrett', stage: 'group' },
    'South Korea':    { owner: 'Garrett', stage: 'group' },
    'Scotland':       { owner: 'Garrett', stage: 'group' },
    'Egypt':          { owner: 'Garrett', stage: 'group' },
    'Portugal':       { owner: 'Luke',    stage: 'group' },
    'England':        { owner: 'Luke',    stage: 'group' },
    'Norway':         { owner: 'Luke',    stage: 'group' },
    'Japan':          { owner: 'Luke',    stage: 'group' },
    'Mexico':         { owner: 'Luke',    stage: 'group' },
    'Turkey':         { owner: 'Luke',    stage: 'group' },
    'Australia':      { owner: 'Luke',    stage: 'group' },
    'Paraguay':       { owner: 'Luke',    stage: 'group' },
  },
  lastUpdated: '2026-06-08',
};

// ── Module state ───────────────────────────────────────────────────────────────

let _currentData = null;
let _activeFilter = 'all';

// ── Gist API ───────────────────────────────────────────────────────────────────

async function fetchGistData() {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Gist fetch failed: ${res.status}`);
    const gist = await res.json();
    const file = gist.files[GIST_FILENAME];
    if (!file || !file.content) throw new Error('Gist file not found');
    const data = JSON.parse(file.content);
    // Merge: keep DEFAULT_DATA owners as fallback for any missing teams
    for (const [team, defaults] of Object.entries(DEFAULT_DATA.teams)) {
      if (!data.teams[team]) data.teams[team] = { ...defaults };
    }
    return data;
  } catch (err) {
    console.warn('[TrollGames] Gist unavailable, using default data:', err.message);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

async function patchGist(data, pat) {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `token ${pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gist PATCH failed: ${res.status} ${res.statusText}`);
  return res;
}

// ── Scoring ────────────────────────────────────────────────────────────────────

function calcPlayerScore(playerName, teams) {
  let total = 0;
  let alive = 0;
  for (const [, t] of Object.entries(teams)) {
    if (t.owner !== playerName) continue;
    total += STAGE_PTS[t.stage] ?? 0;
    if (t.stage !== 'eliminated') alive++;
  }
  return { total, alive };
}

function calcLeaderboard(data) {
  return Object.keys(PLAYER_COLORS)
    .map(name => ({ name, ...calcPlayerScore(name, data.teams) }))
    .sort((a, b) => b.total - a.total || b.alive - a.alive);
}

// ── Rendering helpers ──────────────────────────────────────────────────────────

function flagImg(team, size = 14) {
  const url = FLAG_URLS[team];
  if (!url) return '';
  return `<img src="${url}" alt="${team}" class="chip-flag" width="${size}" loading="lazy">`;
}

function stageClass(stage) {
  if (stage === 'champion')   return 'champion';
  if (stage === 'eliminated') return 'elim';
  if (stage === 'group')      return '';
  return 'alive';
}

// ── Leaderboard ────────────────────────────────────────────────────────────────

function renderLeaderboard(data) {
  const board = calcLeaderboard(data);
  const container = document.getElementById('leaderboard-container');

  const items = board.map((player, i) => {
    const rank = i + 1;
    const rankClass = rank <= 3 ? `lb-rank-${rank}` : '';

    // Team chips for this player
    const playerTeams = Object.entries(data.teams)
      .filter(([, t]) => t.owner === player.name)
      .sort(([, a], [, b]) => (STAGE_PTS[b.stage] ?? 0) - (STAGE_PTS[a.stage] ?? 0));

    const chips = playerTeams.map(([teamName, t]) => {
      const cls = t.stage === 'champion' ? 'is-champion'
                : t.stage === 'eliminated' ? 'is-eliminated'
                : t.stage !== 'group' ? 'is-alive'
                : '';
      const stageShort = t.stage === 'champion' ? '🏆'
                       : t.stage === 'eliminated' ? 'out'
                       : t.stage === 'group' ? ''
                       : t.stage.toUpperCase();
      const pts = STAGE_PTS[t.stage] ?? 0;
      return `
        <span class="lb-team-chip ${cls}">
          ${flagImg(teamName, 14)}
          ${teamName}
          ${stageShort ? `<span class="chip-stage">${stageShort}</span>` : ''}
          ${pts > 0 ? `<span class="chip-stage">${pts}pt</span>` : ''}
        </span>`;
    }).join('');

    return `
      <div class="lb-card" data-owner="${player.name}">
        <div class="lb-card-top">
          <div class="lb-rank ${rankClass}">${rank}</div>
          <div class="lb-player-info">
            <div class="lb-player-name">${player.name}</div>
            <div class="lb-alive-count">${player.alive} of 8 teams still alive</div>
          </div>
          <div>
            <div class="lb-score">${player.total}</div>
            <span class="lb-score-label">points</span>
          </div>
        </div>
        <div class="lb-teams-row">${chips}</div>
      </div>`;
  }).join('');

  container.innerHTML = `<div class="lb-list">${items}</div>`;
}

// ── Teams grid ─────────────────────────────────────────────────────────────────

function renderTeams(data) {
  const container = document.getElementById('teams-container');

  const cards = Object.entries(data.teams).map(([teamName, t]) => {
    const pts      = STAGE_PTS[t.stage] ?? 0;
    const sCls     = stageClass(t.stage);
    const cardCls  = t.stage === 'eliminated' ? 'is-eliminated'
                   : t.stage === 'champion'   ? 'is-champion'
                   : '';
    const filterCls = (_activeFilter !== 'all' && _activeFilter !== t.owner) ? 'is-filtered-out' : '';

    return `
      <div class="team-card ${cardCls} ${filterCls}" data-owner="${t.owner}" data-team="${teamName}">
        <div class="tc-flag-wrap">
          <img src="${FLAG_URLS[teamName] || ''}" alt="${teamName}" class="tc-flag" loading="lazy">
          <span class="tc-name">${teamName}</span>
        </div>
        <div class="tc-owner" data-owner="${t.owner}">${t.owner}</div>
        <div class="tc-bottom">
          <span class="tc-stage-badge ${sCls}">${STAGE_LABELS[t.stage] ?? t.stage}</span>
          <span class="tc-pts ${pts === 0 ? 'tc-pts-zero' : ''}">${pts}</span>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `<div class="teams-grid">${cards}</div>`;
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', String(b === btn));
      });
      document.querySelectorAll('.panel').forEach(p => {
        p.classList.toggle('hidden', p.id !== `panel-${target}`);
      });
    });
  });
}

// ── Teams filter ───────────────────────────────────────────────────────────────

function initTeamsFilter() {
  document.getElementById('teams-filter').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    _activeFilter = btn.dataset.owner;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
    // Update filter in place without full re-render
    document.querySelectorAll('.team-card').forEach(card => {
      const out = _activeFilter !== 'all' && card.dataset.owner !== _activeFilter;
      card.classList.toggle('is-filtered-out', out);
    });
  });
}

// ── Full render ────────────────────────────────────────────────────────────────

function renderApp(data) {
  _currentData = data;

  renderLeaderboard(data);
  renderTeams(data);

  const el = document.getElementById('last-updated');
  if (el && data.lastUpdated) {
    el.textContent = `Updated ${data.lastUpdated}`;
  }
}

// ── Admin console API ──────────────────────────────────────────────────────────

const VALID_STAGES = ['group', 'r16', 'qf', 'sf', 'champion', 'eliminated'];

window.tg = {
  _pat: sessionStorage.getItem('tg_pat') || null,

  setPAT(token) {
    this._pat = token;
    sessionStorage.setItem('tg_pat', token);
    console.log('%c✓ PAT saved for this session', 'color:#10b981;font-weight:bold');
  },

  async updateTeam(teamName, stage) {
    if (!this._pat) {
      console.error('No PAT set. Run: tg.setPAT("ghp_yourtoken")');
      return;
    }
    if (!VALID_STAGES.includes(stage)) {
      console.error(`Invalid stage "${stage}". Valid: ${VALID_STAGES.join(' | ')}`);
      return;
    }
    if (!_currentData.teams[teamName]) {
      console.error(`Unknown team "${teamName}". Check spelling.`);
      console.log('Known teams:', Object.keys(_currentData.teams).join(', '));
      return;
    }
    const prev = _currentData.teams[teamName].stage;
    const newData = JSON.parse(JSON.stringify(_currentData));
    newData.teams[teamName].stage = stage;
    newData.lastUpdated = new Date().toISOString().slice(0, 10);
    try {
      await patchGist(newData, this._pat);
      renderApp(newData);
      console.log(`%c✓ ${teamName}: ${prev} → ${stage} (+${STAGE_PTS[stage] ?? 0} pts)`, 'color:#10b981;font-weight:bold');
    } catch (err) {
      console.error('Update failed:', err.message);
    }
  },

  async updateMany(updates) {
    // updates: [["Spain", "r16"], ["Germany", "qf"], ...]
    if (!this._pat) { console.error('No PAT set. Run: tg.setPAT("ghp_yourtoken")'); return; }
    const newData = JSON.parse(JSON.stringify(_currentData));
    for (const [teamName, stage] of updates) {
      if (!VALID_STAGES.includes(stage)) { console.warn(`Skipping "${teamName}" — invalid stage "${stage}"`); continue; }
      if (!newData.teams[teamName]) { console.warn(`Skipping unknown team "${teamName}"`); continue; }
      newData.teams[teamName].stage = stage;
    }
    newData.lastUpdated = new Date().toISOString().slice(0, 10);
    try {
      await patchGist(newData, this._pat);
      renderApp(newData);
      console.log(`%c✓ Updated ${updates.length} teams`, 'color:#10b981;font-weight:bold');
    } catch (err) {
      console.error('Update failed:', err.message);
    }
  },

  showData() {
    console.table(
      Object.entries(_currentData.teams).map(([team, t]) => ({
        Team: team, Owner: t.owner, Stage: t.stage, Pts: STAGE_PTS[t.stage] ?? 0,
      }))
    );
  },

  async resetAll() {
    if (!this._pat) { console.error('No PAT set.'); return; }
    if (!confirm('Reset ALL teams to group stage?')) return;
    const newData = JSON.parse(JSON.stringify(_currentData));
    for (const t of Object.values(newData.teams)) t.stage = 'group';
    newData.lastUpdated = new Date().toISOString().slice(0, 10);
    await patchGist(newData, this._pat);
    renderApp(newData);
    console.log('%c✓ All teams reset to group stage', 'color:#f59e0b;font-weight:bold');
  },
};

// ── Init ───────────────────────────────────────────────────────────────────────

(async function init() {
  initTabs();
  initTeamsFilter();

  const data = await fetchGistData();
  renderApp(data);

  // Console instructions
  console.log('%c🏆 Troll Games – Admin Console', 'font-size:14px;font-weight:bold;color:#f59e0b');
  console.log('%cSet your PAT once per session:', 'color:#94a3b8');
  console.log('  tg.setPAT("ghp_yourtoken")');
  console.log('%cUpdate a single team:', 'color:#94a3b8');
  console.log('  tg.updateTeam("Spain", "r16")');
  console.log('%cUpdate multiple teams at once:', 'color:#94a3b8');
  console.log('  tg.updateMany([["Spain","r16"], ["Germany","qf"]])');
  console.log('%cView current state:', 'color:#94a3b8');
  console.log('  tg.showData()');
  console.log('%cValid stages: group | r16 | qf | sf | champion | eliminated', 'color:#64748b');
})();
