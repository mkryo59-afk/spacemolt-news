/**
 * generate_script.mjs
 * report.json を読み込み、OpenAI API でニュース台本を生成する
 *
 * 使用方法:
 *   node spacemolt/scripts/generate_script.mjs [YYYY-MM-DD]
 *
 * 出力:
 *   spacemolt/output/YYYY-MM-DD/news_script_tts.txt  (TTS用・マークダウンなし)
 *   spacemolt/output/YYYY-MM-DD/news_script.md       (人間向け・マークダウンあり)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// .env 読み込み
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('エラー: OPENAI_API_KEY が設定されていません');
  process.exit(1);
}

// 日付引数
const args = process.argv.slice(2);
const DATE = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = path.resolve('spacemolt', 'output', DATE);
const REPORT_PATH = path.join(OUTPUT_DIR, 'report.json');

if (!fs.existsSync(REPORT_PATH)) {
  console.error(`エラー: report.json が見つかりません: ${REPORT_PATH}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));
console.log(`report.json 読み込み完了: ${DATE}`);

// ── プロンプト構築 ───────────────────────────────────────────
// news_prompt.md をシステムプロンプトとして読み込む
const PROMPT_PATH = path.join(__dirname, 'news_prompt.md');
if (!fs.existsSync(PROMPT_PATH)) {
  console.error(`エラー: news_prompt.md が見つかりません: ${PROMPT_PATH}`);
  process.exit(1);
}
const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, 'utf-8');

const USER_PROMPT = `以下のreport.jsonをもとに台本を生成してください。

${JSON.stringify(report, null, 2)}

【出力ルール】
- 日本語・ナレーション形式
- セクション区切りは「---」のみ（見出しラベル・# 記号は使わない）
- マークダウン記号（**, *, \`\`\`, # など）は一切使用しない
- 締めは「以上、SpaceMoltニュースでした。」で終える

【必須セクション構成と最低文字数】
以下の7つのブロックを必ず書くこと。各ブロックは「---」で区切る。

1. 冒頭・全体像（400文字以上）
   今日の主軸を1つ決め、世界全体の印象から入る。数字は意味に変換する。

2. 世界構造（400文字以上）
   領土・派閥・拠点・プレイヤー分布の構造的意味を語る。

3. 戦況（350文字以上）
   戦闘がなければ「静寂の意味」を深く語る。艦隊集結なども含む。

4. 市場（700文字以上・最重要）
   価格乖離・需給ギャップ・アービトラージ機会を物語として語る。
   具体的な品名・数値を使い、その意味を解釈する。

5. 行動分析（400文字以上）
   艦隊パターン・派閥行動の読み解き。市場との関係も語る。

6. フォーラム・イベント（400文字以上）
   議論の熱量・ARGの進行・コミュニティの動向を語る。

7. 締め・展望（350文字以上）
   世界のフェーズを言語化し、変化の兆候を示唆して終える。

合計3000〜4500文字。各セクションを十分に展開すること。`;


// ── OpenAI API 呼び出し ──────────────────────────────────────
console.log('OpenAI API に台本生成を依頼中...');

const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'gpt-5-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT },
    ],
    max_completion_tokens: 6000,
  }),
});

if (!response.ok) {
  const err = await response.text();
  console.error(`OpenAI APIエラー: ${response.status} ${err}`);
  process.exit(1);
}

const data = await response.json();
const scriptText = data.choices?.[0]?.message?.content;

if (!scriptText) {
  console.error('エラー: APIから台本テキストが取得できませんでした');
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

const finalText = scriptText;
const warn = finalText.length < 3000 ? ' ⚠️ 目標3000文字を下回っています' : '';
console.log(`台本生成完了 (${finalText.length}文字)${warn}`);

// ── 保存 ────────────────────────────────────────────────────
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// TTS用（そのまま保存）
const ttsPaht = path.join(OUTPUT_DIR, 'news_script_tts.txt');
fs.writeFileSync(ttsPaht, finalText, 'utf-8');
console.log(`✓ TTS用台本: ${ttsPaht}`);

// Markdown用（ヘッダー付き）
const mdContent = `# SpaceMolt 観測ニュース ${DATE}\n\n生成日時: ${new Date().toISOString()}\nモデル: gpt-5-mini\nトークン使用: ${data.usage?.total_tokens ?? '不明'}\n文字数: ${finalText.length}\n\n---\n\n${finalText}`;
const mdPath = path.join(OUTPUT_DIR, 'news_script.md');
fs.writeFileSync(mdPath, mdContent, 'utf-8');

console.log(`✓ Markdown台本: ${mdPath}`);

console.log('\n完了');
