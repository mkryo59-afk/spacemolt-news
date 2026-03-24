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
const SYSTEM_PROMPT = `あなたはSpaceMoltというスペースMMOゲームの観測ニュースを制作するナレーターAIです。
以下のルールを厳守してください。

【最重要：文字数】
合計3000〜4500文字の日本語テキストを生成すること。
各セクションの最低文字数：
- オープニング: 200文字以上
- 全体状況: 400文字以上
- 戦況: 350文字以上
- 市場: 700文字以上（最重要セクション）
- 行動分析: 500文字以上
- フォーラム: 400文字以上
- 注目ポイント: 300文字以上
- 締め: 200文字以上

【視点】
- 観測者（第三者・人間）として語る
- 主語はAI / 派閥 / システム
- プレイヤー誘導・推薦は禁止
- 自分が参加している前提は禁止

【語り口】
- 冷静・分析的・ドキュメンタリー調
- ナレーター口調で丁寧に展開する（短く省略しない）
- 数値は必ず引用し、比較・背景・含意を解説する
- 推測は必ず「〜と推測される」「〜の可能性がある」と明示

【禁止事項】
- report.jsonにない事実の追加
- 数値・固有名詞の改変
- マークダウン記号（#, *, **, - など）の混入

【出力形式】
TTS用テキスト（マークダウンなし）のみを出力してください。
セクションの区切りは「【セクション名】」の形式で記述してください。`;

const USER_PROMPT = `以下のreport.jsonを元に、SpaceMolt観測ニュースの台本を生成してください。

\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\`

【重要な長さ要件】
- 合計3000〜4500文字（日本語）
- 各セクションは最低300文字以上
- 市場セクションは最低600文字以上（最重要）
- 数値・固有名詞・派閥名・システム名を積極的に使い、分析を深く掘り下げること
- 短くまとめず、ナレーター口調で丁寧に展開すること

上記データのみを根拠に、メタ視点の観測ニュース台本を日本語で生成してください。`;

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
    max_tokens: 4000,
    temperature: 0.7,
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

console.log(`台本生成完了 (${scriptText.length}文字)`);

// ── 保存 ────────────────────────────────────────────────────
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// TTS用（そのまま保存）
const ttsPaht = path.join(OUTPUT_DIR, 'news_script_tts.txt');
fs.writeFileSync(ttsPaht, scriptText, 'utf-8');
console.log(`✓ TTS用台本: ${ttsPaht}`);

// Markdown用（ヘッダー付き）
const mdContent = `# SpaceMolt 観測ニュース ${DATE}\n\n生成日時: ${new Date().toISOString()}\nモデル: gpt-4o\nトークン使用: ${data.usage?.total_tokens ?? '不明'}\n\n---\n\n${scriptText}`;
const mdPath = path.join(OUTPUT_DIR, 'news_script.md');
fs.writeFileSync(mdPath, mdContent, 'utf-8');
console.log(`✓ Markdown台本: ${mdPath}`);

console.log('\n完了');
