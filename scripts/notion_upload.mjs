import fs from 'fs';
import path from 'path';

// .env読み込み
const envPath = new URL('./.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!TOKEN || !DATABASE_ID) {
  console.error('エラー: NOTION_TOKEN または NOTION_DATABASE_ID が .env に未設定');
  process.exit(1);
}

const DATE = process.argv[2] || new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = path.resolve('spacemolt', 'output', DATE);

// report.json 読み込み
const reportPath = path.join(OUTPUT_DIR, 'report.json');
if (!fs.existsSync(reportPath)) {
  console.error(`エラー: ${reportPath} が見つかりません`);
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// 各ファイル読み込み（あれば）
const scriptPath   = path.join(OUTPUT_DIR, 'news_script_tts.txt');
const scriptMdPath = path.join(OUTPUT_DIR, 'news_script.md');
const srtPath      = path.join(OUTPUT_DIR, 'news_subtitles.srt');
const scriptText   = fs.existsSync(scriptPath)   ? fs.readFileSync(scriptPath,   'utf8') : '';
const scriptMd     = fs.existsSync(scriptMdPath) ? fs.readFileSync(scriptMdPath, 'utf8') : '';
const srtText      = fs.existsSync(srtPath)      ? fs.readFileSync(srtPath,      'utf8') : '';

console.log(`日付: ${DATE}`);
console.log(`report.json: ✓`);
console.log(`台本TTS: ${scriptText ? '✓' : '（なし）'}`);
console.log(`台本MD:  ${scriptMd   ? '✓' : '（なし）'}`);
console.log(`字幕SRT: ${srtText    ? '✓' : '（なし）'}`);

// テキストを2000文字ごとに分割
function splitText(text, size = 2000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

const eventTitles = (report.events?.active || []).map(e => e.title).join(', ') || 'なし';

const children = [];

children.push({
  object: 'block', type: 'heading_2',
  heading_2: { rich_text: [{ type: 'text', text: { content: 'データサマリー' } }] }
});

const summary = [
  `プレイヤー数（Haven系）: ${report.online_players?.system_total ?? '-'}`,
  `最大集中POI: ${report.online_players?.largest_concentration?.poi ?? '-'} (${report.online_players?.largest_concentration?.share_pct ?? '-'}%)`,
  `採掘ベルト: ${report.online_players?.mining_belt_players ?? '-'}名`,
  `派閥数: ${report.factions?.total ?? '-'}（うち単独: ${report.factions?.single_member_count ?? '-'}）`,
  `アクティブ戦争: ${report.combat?.active_wars ?? '-'}`,
  `市場アクティブ注文: ${report.market?.active_orders ?? '-'}`,
  `ゲームバージョン: ${report.meta?.game_version ?? '-'}`,
  `アクティブイベント: ${eventTitles}`,
].join('\n');

children.push({
  object: 'block', type: 'paragraph',
  paragraph: { rich_text: [{ type: 'text', text: { content: summary } }] }
});

if (scriptText) {
  children.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: 'ニュース台本（TTS）' } }] } });
  for (const chunk of splitText(scriptText)) {
    children.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: chunk } }] } });
  }
}

if (scriptMd) {
  children.push({ object: 'block', type: 'divider', divider: {} });
  children.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '台本（Markdown）' } }] } });
  for (const chunk of splitText(scriptMd)) {
    children.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: chunk } }] } });
  }
}

if (srtText) {
  children.push({ object: 'block', type: 'divider', divider: {} });
  children.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '字幕（SRT）' } }] } });
  for (const chunk of splitText(srtText)) {
    children.push({ object: 'block', type: 'code', code: { rich_text: [{ type: 'text', text: { content: chunk } }], language: 'plain text' } });
  }
}

const body = {
  parent: { database_id: DATABASE_ID },
  properties: {
    '名前': { title: [{ text: { content: `SpaceMolt News ${report.meta.date}` } }] },
    '日付': { date: { start: report.meta.date } },
    'ステータス': { select: { name: scriptText ? '台本完成' : 'データ取得' } },
    'プレイヤー数': { number: report.online_players?.system_total ?? 0 },
    'アクティブ戦争': { number: report.combat?.active_wars ?? 0 },
    'バージョン': { rich_text: [{ text: { content: report.meta?.game_version ?? '' } }] },
  },
  children,
};

const res = await fetch('https://api.notion.com/v1/pages', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const data = await res.json();
if (data.url) {
  console.log(`\n✓ Notionにアップロード完了`);
  console.log(`  URL: ${data.url}`);
} else {
  console.error('エラー:', JSON.stringify(data).slice(0, 500));
  process.exit(1);
}
