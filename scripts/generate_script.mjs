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

追加ルール：
- 出力は日本語・ナレーション形式・3000〜4500文字（必ず守ること）
- 最初に「今日の主軸」を頭の中で決定する（出力には含めない）
- セクション区切りは「---」のみ（見出し記号 # や「冒頭：」などのラベルは使わない）
- 締めは「以上、SpaceMoltニュースでした。」で終える
- マークダウン記号（**, *, \`\`\`, # など）は一切使用しない
- 各段落を十分に展開すること。短くまとめず、ナレーターとして丁寧に語ること`;

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

console.log(`台本生成完了 (${scriptText.length}文字)`);

// ── 文字数が短い場合は追加生成 ──────────────────────────────
let finalText = scriptText;
const MIN_CHARS = 3000;

if (finalText.length < MIN_CHARS) {
  const shortage = MIN_CHARS - finalText.length;
  console.log(`文字数不足 (${finalText.length}文字)。追加生成します...`);

  const extResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
        { role: 'assistant', content: scriptText },
        { role: 'user', content: `台本が${finalText.length}文字しかありません。目標は3000〜4500文字です。\n「以上、SpaceMoltニュースでした。」の直前に、約${shortage + 500}文字分の追加のナレーションパートを挿入してください。\n同じ文体・語り口で、まだ語っていない視点や考察（派閥動向・市場の別側面・ARGの背景・世界の今後など）を展開してください。\n「---」で区切って自然につながるように書いてください。` },
      ],
      max_completion_tokens: 3000,
    }),
  });

  if (extResponse.ok) {
    const extData = await extResponse.json();
    const extension = extData.choices?.[0]?.message?.content ?? '';
    // 「以上、SpaceMoltニュースでした。」の前に挿入
    finalText = finalText.replace('以上、SpaceMoltニュースでした。', `${extension}\n\n以上、SpaceMoltニュースでした。`);
    console.log(`追加生成完了 → 合計 ${finalText.length}文字`);
  } else {
    console.warn('追加生成に失敗しました。元の台本をそのまま使用します。');
  }
}

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
