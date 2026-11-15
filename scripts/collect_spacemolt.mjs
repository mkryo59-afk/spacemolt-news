/**
 * collect_spacemolt.mjs
 * SpaceMolt APIに直接接続してデータを収集し、data_*.json に書き出す
 * 使用方法: node spacemolt/scripts/collect_spacemolt.mjs [YYYY-MM-DD]
 *
 * 出力:
 *   spacemolt/output/YYYY-MM-DD/data_system.json
 *   spacemolt/output/YYYY-MM-DD/data_market.json
 *   spacemolt/output/YYYY-MM-DD/data_forum.json
 *   spacemolt/output/YYYY-MM-DD/data_factions.json
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fs from 'fs';
import path from 'path';

// ── 設定 ────────────────────────────────────────────────────
const MCP_URL    = 'https://game.spacemolt.com/mcp';
const USERNAME   = process.env.SPACEMOLT_USERNAME || 'Orion.Watch';
const PASSWORD   = process.env.SPACEMOLT_PASSWORD;
const DATE       = process.argv[2] || new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = path.resolve('output', DATE);

if (!PASSWORD) {
  console.error('エラー: SPACEMOLT_PASSWORD 環境変数が未設定');
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ── MCPクライアント初期化 ─────────────────────────────────────
const client = new Client({ name: 'spacemolt-collector', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));

async function call(toolName, args = {}) {
  const res = await client.callTool({ name: toolName, arguments: args });
  const text = res.content?.[0]?.text;
  if (!text) throw new Error(`${toolName}: レスポンスが空`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function fetchPublicJson(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) { console.warn(`  ⚠ ${url}: HTTP ${res.status}`); return null; }
    return await res.json();
  } catch (e) {
    console.warn(`  ⚠ ${url}: ${e.message}`);
    return null;
  }
}

function saveJson(filename, data) {
  const p = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  ✓ ${filename}`);
}

// ── メイン ────────────────────────────────────────────────────
async function main() {
  console.log(`SpaceMolt データ収集開始: ${DATE}`);
  console.log(`接続先: ${MCP_URL}\n`);

  await client.connect(transport);

  // ── 1. ログイン ─────────────────────────────────────────────
  console.log('1. ログイン中...');
  const loginResult = await call('login', { username: USERNAME, password: PASSWORD });
  const sessionId = loginResult.session_id;
  if (!sessionId) throw new Error('session_id が取得できませんでした');
  const version = loginResult.release_info?.version;
  const versionNotes = loginResult.release_info?.notes || [];
  console.log(`  ✓ session_id 取得 (version: ${version})\n`);

  // ── 2. システム・人口・戦況 ──────────────────────────────────
  console.log('2. システムデータ収集中...');
  const [statusData, systemData, combatLog, nearbyData, galaxyStats, leaderboard] = await Promise.all([
    call('get_status', { session_id: sessionId }),
    call('get_system', { session_id: sessionId }),
    call('get_action_log', { session_id: sessionId, category: 'combat', page_size: 50 }),
    call('get_nearby', { session_id: sessionId }).catch(e => ({ _error: e.message })),
    fetchPublicJson('https://game.spacemolt.com/api/stats'),
    fetchPublicJson('https://game.spacemolt.com/api/leaderboard'),
  ]);

  const pois = systemData.system?.pois || [];
  // v0.622.0 以降、get_system の POI には online が含まれない（シップスキャナー装備時のみ ship_count）。
  // 取れない場合は 0 ではなく null にして「未観測」を区別する。
  const poiOnline = p => (p.online ?? p.ship_count ?? null);
  const poiCountsAvailable = pois.some(p => poiOnline(p) != null);
  const totalOnline = poiCountsAvailable ? pois.reduce((s, p) => s + (poiOnline(p) || 0), 0) : null;

  // 現在地（Grand Exchange）に見えているプレイヤー（get_nearby）
  const nearbyList = Array.isArray(nearbyData?.nearby) ? nearbyData.nearby : [];
  const countBy = (arr, keyFn) => {
    const m = {};
    for (const x of arr) { const k = keyFn(x); if (k) m[k] = (m[k] || 0) + 1; }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ key: k, count: v }));
  };
  const stationPresence = nearbyData && !nearbyData._error ? {
    poi_id: nearbyData.poi_id ?? null,
    visible_players: nearbyData.count ?? nearbyList.length,
    listed_players: nearbyList.length,
    offline_collapsed: nearbyData.offline_collapsed ?? null,
    docked: nearbyList.filter(p => p.docked).length,
    in_combat: nearbyList.filter(p => p.in_combat).length,
    pirate_count: nearbyData.pirate_count ?? 0,
    empire_npc_count: nearbyData.empire_npc_count ?? 0,
    top_faction_tags: countBy(nearbyList, p => p.faction_tag),
    top_ship_classes: countBy(nearbyList, p => p.ship_class),
  } : null;

  // 銀河全体の公開統計（認証不要 /api/stats）
  const galaxy = galaxyStats ? {
    online_players: galaxyStats.online_players ?? null,
    total_players: galaxyStats.total_players ?? null,
    total_systems: galaxyStats.total_systems ?? null,
    forum_threads: galaxyStats.forum_threads ?? null,
    forum_replies: galaxyStats.forum_replies ?? null,
    tick: galaxyStats.tick ?? null,
    version: galaxyStats.version ?? null,
  } : null;

  const dataSystem = {
    collected_at: new Date().toISOString(),
    game_version: version,
    version_update: version ? {
      version,
      release_date: DATE,
      changes: versionNotes,
    } : null,
    system: {
      name: systemData.system?.name || 'Haven',
      security: systemData.security_status || '',
      total_online: totalOnline,
      poi_counts_available: poiCountsAvailable,
      pois: pois.map(p => ({
        id: p.id, name: p.name, type: p.type,
        class: p.class || null, online: poiOnline(p), has_base: p.has_base || false,
      })),
      connections: systemData.system?.connections || [],
    },
    galaxy,
    station_presence: stationPresence,
    combat: {
      active_wars: 0,
      recent_events: combatLog.entries || [],
    },
  };
  saveJson('data_system.json', dataSystem);

  // 公開リーダーボード（上位10件のみ保存）
  if (leaderboard && typeof leaderboard === 'object') {
    const top = (arr, k = 10) => (Array.isArray(arr) ? arr.slice(0, k) : []);
    const pick = (group, keys) => Object.fromEntries(keys.map(k => [k, top(group?.[k])]));
    saveJson('data_leaderboard.json', {
      collected_at: new Date().toISOString(),
      generated_at: leaderboard.generated_at ?? null,
      players: pick(leaderboard.players, ['total_wealth', 'credits_earned', 'ships_destroyed', 'ships_lost', 'trades_completed', 'systems_explored', 'ore_mined', 'items_crafted']),
      factions: pick(leaderboard.factions, ['member_count', 'total_wealth', 'ships_destroyed', 'facility_investment', 'missions_completed']),
      exchange: pick(leaderboard.exchange, ['active_orders', 'sell_order_value']),
    });
  }

  // ── 3. 市場データ（カテゴリ別並列取得）────────────────────────
  console.log('3. 市場データ収集中（ore/component/commodity/consumable）...');
  const [mktOre, mktComp, mktComm, mktCons] = await Promise.all([
    call('view_market', { session_id: sessionId, category: 'ore' }),
    call('view_market', { session_id: sessionId, category: 'component' }),
    call('view_market', { session_id: sessionId, category: 'commodity' }),
    call('view_market', { session_id: sessionId, category: 'consumable' }),
  ]);

  const allItems = [
    ...(mktOre.items || []),
    ...(mktComp.items || []),
    ...(mktComm.items || []),
    ...(mktCons.items || []),
  ];

  const activeItems = allItems.filter(i => i.sell_quantity > 0 || i.buy_quantity > 0);
  const supplySurplus  = activeItems.filter(i => i.sell_quantity > 10000 || (i.sell_quantity > 0 && i.buy_quantity < 100));
  const demandShortage = activeItems.filter(i => i.sell_quantity === 0 && i.buy_quantity > 1000 && i.best_buy > 50);
  const highValue      = activeItems.filter(i => i.best_sell > 5000 || i.best_buy > 5000);

  const dataMarket = {
    collected_at: new Date().toISOString(),
    station: mktOre.base || 'Grand Exchange Station',
    total_items_with_orders: activeItems.length,
    supply_surplus: supplySurplus.map(i => ({
      item: i.item_name, category: i.category,
      sell_price: i.best_sell, sell_qty: i.sell_quantity,
      buy_price: i.best_buy, buy_qty: i.buy_quantity,
    })),
    demand_shortage: demandShortage.map(i => ({
      item: i.item_name, category: i.category,
      buy_price: i.best_buy, buy_qty: i.buy_quantity,
    })),
    high_value: highValue.map(i => ({
      item: i.item_name, category: i.category,
      sell_price: i.best_sell, sell_qty: i.sell_quantity,
      buy_price: i.best_buy, buy_qty: i.buy_quantity,
    })),
    arbitrage_candidates: [],
    summary: `${activeItems.length}品目に注文あり。供給過剰${supplySurplus.length}品目、需給逼迫${demandShortage.length}品目、高額${highValue.length}品目`,
  };
  saveJson('data_market.json', dataMarket);

  // ── 4. フォーラム（hot/新着 + 主要スレッド本文）───────────────
  console.log('4. フォーラムデータ収集中...');
  const [forumHot, forumNew] = await Promise.all([
    call('forum_list', { session_id: sessionId, sort_by: 'hot', limit: 20 }),
    call('forum_list', { session_id: sessionId, sort_by: 'newest', limit: 10 }),
  ]);

  const threads = forumHot.threads || [];
  const today = DATE;

  // 返信50件超またはupvote10以上のスレッド本文を取得
  const majorThreadIds = threads
    .filter(t => (t.reply_count > 50 || t.upvotes > 10) && t.id)
    .slice(0, 5)
    .map(t => t.id);

  const threadDetails = {};
  for (const id of majorThreadIds) {
    try {
      const detail = await call('forum_get_thread', { session_id: sessionId, thread_id: id });
      threadDetails[id] = detail;
    } catch (e) {
      console.warn(`    スレッド ${id} の詳細取得失敗: ${e.message}`);
    }
  }

  const newThreadsToday = [
    ...threads,
    ...(forumNew.threads || []),
  ].filter((t, i, arr) =>
    t.created_at?.startsWith(today) &&
    arr.findIndex(x => x.id === t.id) === i
  );

  // Signal ARG 関連スレッドを抽出
  const signalThreads = threads.filter(t =>
    /signal|gathering|alcor|first.?step|cult/i.test(t.title)
  );
  const gatheringThread = threads.find(t => /operation.?gathering/i.test(t.title));

  const dataForum = {
    collected_at: new Date().toISOString(),
    threads: threads.map(t => ({
      id: t.id,
      title: t.title,
      author: t.author,
      category: t.category,
      reply_count: t.reply_count || 0,
      upvotes: t.upvotes || 0,
      created_at: t.created_at,
      is_new_today: t.created_at?.startsWith(today) || false,
      signal_arg_related: /signal|gathering|alcor|first.?step|cult/i.test(t.title),
      body_preview: threadDetails[t.id]?.thread?.body?.slice(0, 200) || null,
    })),
    signal_arg_status: {
      operation_gathering_replies: gatheringThread?.reply_count || 0,
      main_thread_replies: signalThreads[0]?.reply_count || 0,
      upcoming_events: newThreadsToday.filter(t => /synchronization|gathering|alcor/i.test(t.title)),
      summary: `Signal ARG関連スレッド${signalThreads.length}件。OPERATION GATHERING返信${gatheringThread?.reply_count || 0}件。`,
    },
    new_threads_today: newThreadsToday,
    dominant_topic: threads[0]?.title || '',
  };
  saveJson('data_forum.json', dataForum);

  // ── 5. 派閥・イベント・ミッション ────────────────────────────
  console.log('5. 派閥データ収集中...');
  const [factionList, missions] = await Promise.all([
    call('faction_list', { session_id: sessionId, limit: 100 }),
    call('get_missions', { session_id: sessionId }),
  ]);

  const factions = factionList.factions || [];
  const topFactions = factions
    .sort((a, b) => b.member_count - a.member_count)
    .slice(0, 20);

  // 上位派閥の詳細取得（members > 15）
  const detailTargets = factions.filter(f => f.member_count > 15).slice(0, 5);
  const factionDetails = {};
  for (const f of detailTargets) {
    try {
      const detail = await call('faction_info', { session_id: sessionId, faction_id: f.id });
      factionDetails[f.id] = detail;
    } catch (e) {
      console.warn(`    派閥 ${f.name} 詳細取得失敗: ${e.message}`);
    }
  }

  const publicMissions = (missions.missions || []).filter(m => m.faction_id);
  const events = (missions.missions || []).filter(m =>
    m.type === 'exploration' || m.description?.includes('20名') || m.description?.includes('Signal')
  );

  const dataFactions = {
    collected_at: new Date().toISOString(),
    total_factions: factionList.total_count || factions.length,
    factions_with_bases: factions.filter(f => f.owned_bases > 0).length,
    top_factions: topFactions.map(f => {
      const detail = factionDetails[f.id];
      return {
        name: f.name,
        tag: f.tag,
        leader: f.leader_username,
        members: f.member_count,
        owned_bases: f.owned_bases || 0,
        allies: detail?.faction?.allies || [],
        enemies: detail?.faction?.enemies || [],
        notable_activity: null,
      };
    }),
    single_member_count: factions.filter(f => f.member_count === 1).length,
    public_missions: publicMissions.map(m => ({
      faction: m.faction_name,
      title: m.title,
      type: m.type,
      reward_credits: m.rewards?.credits || 0,
      description: m.description?.slice(0, 200),
    })),
    events: events.map(e => ({
      type: e.type,
      title: e.title,
      status: '進行中',
      description: e.description?.slice(0, 200),
      organizer: e.giver?.name || '',
    })),
    rescue_requests: (missions.missions || []).filter(m =>
      m.type === 'rescue' || /rescue|stranded/i.test(m.title)
    ).map(m => ({
      title: m.title,
      location: m.objectives?.[0]?.system_name || '',
      reward_credits: m.rewards?.credits || 0,
    })),
  };
  saveJson('data_factions.json', dataFactions);

  console.log(`\n✓ 全データ収集完了 → ${OUTPUT_DIR}`);
  await client.close();
}

main().catch(err => {
  console.error('\nエラー:', err.message);
  process.exit(1);
});
