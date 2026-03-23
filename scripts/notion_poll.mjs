/**
 * notion_poll.mjs
 * Notionのコマンドボードを定期チェックし、待機中のコマンドを実行する
 * 起動: node notion_poll.mjs
 * 停止: Ctrl+C
 */

import fs from 'fs';
import { execSync } from 'child_process';

// .env読み込み
const envPath = new URL('./.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const TOKEN = process.env.NOTION_TOKEN;
const COMMAND_DB_ID = process.env.NOTION_COMMAND_DB_ID;
const POLL_INTERVAL_MS = 60 * 1000; // 1分

if (!TOKEN || !COMMAND_DB_ID) {
  console.error('エラー: NOTION_TOKEN または NOTION_COMMAND_DB_ID が未設定');
  process.exit(1);
}

// 利用可能なコマンド定義
const COMMANDS = {
  'upload_notion':   { desc: 'Notionにアップロード',     cmd: 'node notion_upload.mjs' },
  'full_pipeline':   { desc: '全工程実行',               cmd: 'node notion_upload.mjs' }, // 将来拡張用
  'help':            { desc: 'コマンド一覧を返す',        cmd: null },
};

async function notionRequest(path, method = 'GET', body = null) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ステータス更新
async function updateStatus(pageId, status, result = '') {
  await notionRequest(`/pages/${pageId}`, 'PATCH', {
    properties: {
      'ステータス': { select: { name: status } },
      '実行結果': { rich_text: [{ text: { content: result.slice(0, 2000) } }] },
    }
  });
}

// コマンド実行
async function runCommand(pageId, commandName) {
  const cmd = COMMANDS[commandName];

  if (!cmd) {
    const available = Object.entries(COMMANDS).map(([k, v]) => `${k}: ${v.desc}`).join('\n');
    await updateStatus(pageId, 'エラー', `不明なコマンド: ${commandName}\n\n利用可能:\n${available}`);
    return;
  }

  if (commandName === 'help') {
    const list = Object.entries(COMMANDS).map(([k, v]) => `• ${k} — ${v.desc}`).join('\n');
    await updateStatus(pageId, '完了', `利用可能なコマンド:\n${list}`);
    return;
  }

  await updateStatus(pageId, '実行中', '実行開始...');

  try {
    const output = execSync(cmd.cmd, {
      cwd: 'C:/Users/mkryo',
      encoding: 'utf8',
      timeout: 120000,
    });
    await updateStatus(pageId, '完了', output.trim() || '完了');
    console.log(`[完了] ${commandName}`);
  } catch (err) {
    const errMsg = err.stdout || err.stderr || err.message || '不明なエラー';
    await updateStatus(pageId, 'エラー', errMsg.slice(0, 2000));
    console.error(`[エラー] ${commandName}: ${errMsg.slice(0, 200)}`);
  }
}

// 待機中コマンドを取得
async function fetchPendingCommands() {
  const data = await notionRequest(`/databases/${COMMAND_DB_ID}/query`, 'POST', {
    filter: { property: 'ステータス', select: { equals: '待機中' } },
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
  });
  return data.results || [];
}

// メインループ
async function poll() {
  const pages = await fetchPendingCommands();
  if (pages.length === 0) return;

  console.log(`[${new Date().toLocaleTimeString()}] ${pages.length}件のコマンドを検出`);

  for (const page of pages) {
    const commandName = page.properties?.['コマンド']?.title?.[0]?.plain_text?.trim().toLowerCase();
    if (!commandName) continue;
    console.log(`  → 実行: ${commandName}`);
    await runCommand(page.id, commandName);
  }
}

console.log('=== Notion ポーリング開始 ===');
console.log(`チェック間隔: ${POLL_INTERVAL_MS / 1000}秒`);
console.log('利用可能コマンド:', Object.keys(COMMANDS).join(', '));
console.log('停止: Ctrl+C\n');

// 初回即時実行 → 以降定期実行
poll().catch(console.error);
setInterval(() => poll().catch(console.error), POLL_INTERVAL_MS);
