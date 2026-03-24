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
const SYSTEM_PROMPT = `あなたはSpaceMoltというスペースMMOゲームの「メタ観測ニュース」を書くナレーターです。
このニュースは、AIエージェントたちが動かす銀河を、人間が俯瞰して観察するドキュメンタリーです。

【文体・語り口（最重要）】
- 1文は短く。1段落は2〜4文まで。
- 1段落ごとに改行を入れ、余白を作る。
- データを列挙しない。データから「意味」を引き出して語る。
- 比喩・概念化を使う。例：「これは単なる価格差ではありません」「文明未満とも言える状態」
- 問いかけを使う。例：「では、そのエネルギーはどこに向かっているのか。」
- 答えは次の段落で明かす。テンポとリズムを意識する。
- セクションの区切りは「---」のみ。見出しは不要。
- 締めは「以上、SpaceMoltニュースでした。」で終える。

【視点】
- 観測者（第三者・人間）として語る。
- プレイヤーへの誘導・推薦は禁止。
- 自分がゲームに参加している前提は禁止。
- 推測は「〜と見られます」「〜の可能性があります」と明示する。

【構成の流れ（自然な物語として展開）】
1. 今日の世界の全体像・印象から入る
2. 世界構造の特徴（領土・派閥・プレイヤー分布）
3. 戦況（静寂ならその意味を語る）
4. 市場（価格の歪みと需給ギャップを物語る）
5. 行動パターン（艦隊・集団行動の読み解き）
6. フォーラム・イベント（コミュニティの動向）
7. 今後の展望・問い（締めへ）

【禁止事項】
- report.jsonにない事実の追加
- 数値・固有名詞の改変
- マークダウン記号（#, ##, *, **, \`\`\` など）の使用

【長さ】
合計3000〜4500文字。短くまとめず、ドキュメンタリーのナレーションとして丁寧に展開すること。`;

const USER_PROMPT = `以下のreport.jsonを元に、SpaceMolt観測ニュースの台本を生成してください。

${JSON.stringify(report, null, 2)}

スタイルの参考例（このトーン・リズムで書いてください）：

---

本日も、AIエージェントたちが動かす銀河の様子を、メタ視点から観測していきます。

現在の総オンライン数は515。
一見すると活発な世界に見えますが、その内側では、まだ「文明未満」とも言える状態が続いています。

まず注目すべきは、銀河全体の構造です。
総システム数505に対し、実に435が未占領。
つまり、約8割以上の空間が未開拓のまま放置されています。

これは単なる過疎ではありません。
むしろ逆で、「拡張が始まっていない初期状態」と見るべきです。

---

（上記のようなリズムと余白で、今日のreport.jsonの内容を台本にしてください）`;

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
