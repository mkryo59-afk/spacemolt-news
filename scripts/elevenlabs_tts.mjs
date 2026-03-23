import fs from 'fs';
import path from 'path';
import https from 'https';

// .envから環境変数を読み込む（dotenvなしの簡易実装）
const envPath = new URL('./.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) { console.error('ELEVENLABS_API_KEY が設定されていません'); process.exit(1); }

const MODEL_ID = 'eleven_v3';
const VOICE_ID = '3JDquces8E8bkmvbh6Bc';
const MAX_CHARS = 4500;

const INPUT_FILE = 'C:\\Users\\mkryo\\news_script_tts.txt';
const OUTPUT_FILE = 'C:\\Users\\mkryo\\news_audio.mp3';

function splitIntoChunks(text, maxChars) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > maxChars) {
      if (current) chunks.push(current.trim());
      current = para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function ttsRequest(text, chunkIndex) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.5,
        use_speaker_boost: true
      }
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let err = '';
        res.on('data', d => err += d);
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${err}`)));
        return;
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const tmpFile = `C:\\Users\\mkryo\\chunk_${chunkIndex}.mp3`;
        fs.writeFileSync(tmpFile, buf);
        console.log(`  チャンク ${chunkIndex + 1}: ${buf.length} bytes → ${tmpFile}`);
        resolve(tmpFile);
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const text = fs.readFileSync(INPUT_FILE, 'utf8');
  const chunks = splitIntoChunks(text, MAX_CHARS);

  console.log(`テキストを ${chunks.length} チャンクに分割しました。`);
  chunks.forEach((c, i) => console.log(`  チャンク ${i + 1}: ${c.length} 文字`));
  console.log('');

  const tmpFiles = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`リクエスト ${i + 1}/${chunks.length} 送信中...`);
    const file = await ttsRequest(chunks[i], i);
    tmpFiles.push(file);
    // レート制限回避のため少し待機
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  // 全チャンクのMP3を結合
  console.log('\n音声ファイルを結合中...');
  const buffers = tmpFiles.map(f => fs.readFileSync(f));
  const combined = Buffer.concat(buffers);
  fs.writeFileSync(OUTPUT_FILE, combined);

  // 一時ファイルを削除
  tmpFiles.forEach(f => fs.unlinkSync(f));

  console.log(`\n完了: ${OUTPUT_FILE}`);
  console.log(`ファイルサイズ: ${(combined.length / 1024).toFixed(1)} KB`);
}

main().catch(err => {
  console.error('エラー:', err.message);
  process.exit(1);
});
