/**
 * start_day.mjs
 * 毎日の台本作成作業を開始するセットアップスクリプト
 *
 * 実行すると:
 *   1. git pull で最新 report.json を取得
 *   2. report.json の内容をクリップボードにコピー
 *   3. 出力フォルダをエクスプローラーで開く
 *   4. ChatGPT に貼り付ける手順を表示
 *
 * 使用方法:
 *   node scripts/start_day.mjs [YYYY-MM-DD]
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const DATE = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = path.resolve('output', DATE);
const REPORT_PATH = path.join(OUTPUT_DIR, 'report.json');
const SCRIPT_PATH = path.join(OUTPUT_DIR, 'news_script_tts.txt');
const PROMPT_PATH = path.resolve('scripts', 'news_prompt.md');

console.log('━'.repeat(60));
console.log(`SpaceMolt ニュース作業開始`);
console.log(`日付: ${DATE}`);
console.log('━'.repeat(60));

// ── Step 1: git pull ──────────────────────────────────────────
console.log('\n▶ Step 1: 最新データを取得中 (git pull)...');
try {
  const result = execSync('git pull', { encoding: 'utf-8' });
  console.log(result.trim());
} catch (e) {
  console.warn('⚠️  git pull に失敗しました（ローカル変更がある可能性）');
  console.warn(e.message);
}

// ── Step 2: report.json の存在確認 ───────────────────────────
console.log(`\n▶ Step 2: report.json を確認中...`);
if (!fs.existsSync(REPORT_PATH)) {
  console.error(`✗ report.json が見つかりません: ${REPORT_PATH}`);
  console.error('  GitHub Actions がまだ実行されていない可能性があります。');
  console.error('  手動実行: node scripts/collect_spacemolt.mjs && node scripts/merge_data.mjs');
  process.exit(1);
}

const reportContent = fs.readFileSync(REPORT_PATH, 'utf-8');
const report = JSON.parse(reportContent);
console.log(`✓ report.json 確認済み`);
console.log(`  収集時刻: ${report.meta?.generated_at ?? '不明'}`);
console.log(`  派閥数: ${report.world_state?.total_factions ?? '?'}`);
console.log(`  市場品目: ${report.market?.total_items_with_orders ?? '?'}`);

// ── Step 3: report.json をクリップボードにコピー ──────────────
console.log(`\n▶ Step 3: report.json をクリップボードにコピー中...`);
try {
  execSync(`echo ${JSON.stringify(reportContent)} | clip`, { shell: 'cmd.exe' });
  console.log('✓ クリップボードにコピーしました');
} catch {
  // fallback: PowerShell で試みる
  try {
    execSync(`powershell -Command "Get-Content '${REPORT_PATH}' | Set-Clipboard"`, { encoding: 'utf-8' });
    console.log('✓ クリップボードにコピーしました（PowerShell）');
  } catch {
    console.warn('⚠️  クリップボードへのコピーに失敗しました。手動でコピーしてください。');
    console.warn(`   ファイル: ${REPORT_PATH}`);
  }
}

// ── Step 4: 出力フォルダを開く ───────────────────────────────
console.log(`\n▶ Step 4: 出力フォルダを開いています...`);
try {
  execSync(`start "" "${OUTPUT_DIR}"`, { shell: 'cmd.exe' });
} catch {
  console.warn(`⚠️  フォルダを開けませんでした: ${OUTPUT_DIR}`);
}

// ── 次の手順を表示 ────────────────────────────────────────────
console.log('\n' + '━'.repeat(60));
console.log('✓ 準備完了！次の手順:');
console.log('━'.repeat(60));
console.log(`
【1】ChatGPT を開く
     https://chat.openai.com

【2】以下のプロンプトを貼り付ける:
     ─────────────────────────────────
     （news_prompt.md の内容）
     ─────────────────────────────────
     ${PROMPT_PATH}

【3】クリップボードの report.json を続けて貼り付ける
     （さきほど自動コピー済み）

【4】生成された台本を以下のファイルに保存:
     ${SCRIPT_PATH}

【5】保存できたら以下を実行:
     node scripts/run_pipeline.mjs ${DATE} --skip-script
`);
console.log('━'.repeat(60));
