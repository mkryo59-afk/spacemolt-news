/**
 * merge_data.mjs
 * 4エージェントが収集した data_*.json を結合して report.json を生成する
 * 使用方法: node spacemolt/scripts/merge_data.mjs [YYYY-MM-DD]
 */

import fs from 'fs';
import path from 'path';

const date = process.argv[2] || new Date().toISOString().slice(0, 10);
const outputDir = `C:\\Users\\mkryo\\spacemolt\\output\\${date}`;

function readJson(filename) {
  const p = path.join(outputDir, filename);
  if (!fs.existsSync(p)) {
    console.warn(`警告: ${filename} が存在しません`);
    return null;
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const sys  = readJson('data_system.json');
const mkt  = readJson('data_market.json');
const frm  = readJson('data_forum.json');
const fct  = readJson('data_factions.json');

if (!sys || !mkt || !frm || !fct) {
  console.error('エラー: 必要なデータファイルが不足しています');
  process.exit(1);
}

const report = {
  meta: {
    date,
    generated_at: new Date().toISOString(),
    observer: 'Orion.Watch',
    empire: 'nebula',
    location: 'Haven / Grand Exchange Station',
    game_version: sys.game_version ?? '?',
    prev_version: null,
    collection_mode: 'parallel_agents_v1'
  },

  version_update: sys.version_update ?? null,

  world_state: {
    total_factions: fct.total_factions ?? 0,
    factions_with_bases: fct.factions_with_bases ?? 0,
  },

  online_players: {
    system: sys.system?.name ?? 'Haven',
    security: sys.system?.security ?? '',
    pois: sys.system?.pois ?? [],
    system_total: sys.system?.total_online ?? 0,
    largest_concentration: (() => {
      const pois = sys.system?.pois ?? [];
      const top = pois.reduce((a, b) => (b.online > (a?.online ?? 0) ? b : a), null);
      return top ? {
        poi: top.name,
        count: top.online,
        share_pct: sys.system?.total_online
          ? +((top.online / sys.system.total_online) * 100).toFixed(1)
          : 0
      } : null;
    })(),
    mining_belt_players: (sys.system?.pois ?? [])
      .filter(p => p.type === 'asteroid_belt')
      .reduce((s, p) => s + p.online, 0),
    connections: sys.system?.connections ?? [],
  },

  factions: {
    total: fct.total_factions ?? 0,
    top_by_members: fct.top_factions ?? [],
    single_member_count: fct.single_member_count ?? 0,
    notable_operations: fct.public_missions ?? [],
  },

  market: {
    station: mkt.station ?? 'Grand Exchange Station',
    system: 'Haven',
    total_items_with_orders: mkt.total_items_with_orders ?? 0,
    supply_surplus: mkt.supply_surplus ?? [],
    demand_shortage: mkt.demand_shortage ?? [],
    high_value: mkt.high_value ?? [],
    arbitrage_opportunity: mkt.arbitrage_candidates?.[0] ?? null,
    summary: mkt.summary ?? '',
  },

  combat: {
    active_wars: sys.combat?.active_wars ?? 0,
    recent_combat_events: sys.combat?.recent_events ?? [],
  },

  events: {
    active: fct.events ?? [],
    rescue_requests: fct.rescue_requests ?? [],
  },

  forum: {
    top_threads: frm.threads ?? [],
    dominant_topic: frm.dominant_topic ?? '',
    signal_arg_summary: frm.signal_arg_status?.summary ?? '',
    new_threads_today: frm.new_threads_today ?? [],
  },
};

const reportPath = path.join(outputDir, 'report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log(`✓ report.json 生成完了: ${reportPath}`);
console.log(`  派閥数: ${report.world_state.total_factions}`);
console.log(`  システム人口: ${report.online_players.system_total}`);
console.log(`  市場品目数: ${report.market.total_items_with_orders}`);
console.log(`  フォーラムスレッド数: ${report.forum.top_threads.length}`);
