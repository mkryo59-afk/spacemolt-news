import fs from 'fs';
import https from 'https';
import path from 'path';

// .env読み込み
const envPath = path.join('C:\\Users\\mkryo', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const API_KEY   = process.env.ELEVENLABS_API_KEY;
const VOICE_ID  = '3JDquces8E8bkmvbh6Bc';
const MODEL_ID  = 'eleven_v3';
const INPUT_FILE  = 'C:\\Users\\mkryo\\news_script_tts.txt';
const AUDIO_OUT   = 'C:\\Users\\mkryo\\news_audio.mp3';
const SRT_OUT     = 'C:\\Users\\mkryo\\news_subtitles.srt';

if (!API_KEY) { console.error('ELEVENLABS_API_KEY が設定されていません'); process.exit(1); }

// ── SRT用ライン分割（generate_assets.mjs と同じロジック） ──
function splitToLines(text) {
  const raw = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const lines = [];
  for (const line of raw) {
    if (line.length <= 40) {
      lines.push(line);
    } else {
      const parts = line.split(/(?<=。|、|！|？|…)/);
      let buf = '';
      for (const p of parts) {
        if ((buf + p).length > 40) {
          if (buf) lines.push(buf.trim());
          buf = p;
        } else {
          buf += p;
        }
      }
      if (buf.trim()) lines.push(buf.trim());
    }
  }
  return lines;
}

function toSrtTime(sec) {
  const h  = Math.floor(sec / 3600);
  const m  = Math.floor((sec % 3600) / 60);
  const s  = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}

// ── with-timestamps APIリクエスト ──────────────────────────
function requestWithTimestamps(text) {
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
      path: `/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`,
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
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          resolve(json);
        } catch(e) {
          reject(new Error('JSONパースエラー: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── アライメントからSRTを生成 ─────────────────────────────
function buildSrt(entries, alignment) {
  const chars      = alignment.characters;
  const startTimes = alignment.character_start_times_seconds;
  const endTimes   = alignment.character_end_times_seconds;

  // 非空白文字だけのインデックス付きリスト
  let alignIdx = 0;

  let srt = '';
  const GAP = 0.05;

  for (let i = 0; i < entries.length; i++) {
    // エントリから読み上げ対象文字（非空白）を抽出
    const speechChars = entries[i].replace(/\s/g, '').split('');
    if (speechChars.length === 0) continue;

    // アライメントの中で一致する位置を探す
    let entryStart = null;
    let entryEnd   = null;
    let matched    = 0;

    while (alignIdx < chars.length && matched < speechChars.length) {
      const c = chars[alignIdx];
      if (/\S/.test(c)) {
        if (matched === 0) entryStart = startTimes[alignIdx];
        entryEnd = endTimes[alignIdx];
        matched++;
      }
      alignIdx++;
    }

    if (entryStart === null) continue;

    const start = Math.max(0, entryStart - GAP);
    const end   = entryEnd + GAP;

    srt += `${i + 1}\n`;
    srt += `${toSrtTime(start)} --> ${toSrtTime(end)}\n`;
    srt += `${entries[i]}\n\n`;
  }

  return srt;
}

// ── メイン ────────────────────────────────────────────────
async function main() {
  const scriptText = fs.readFileSync(INPUT_FILE, 'utf8');
  const lines   = splitToLines(scriptText);
  const entries = [];
  for (let i = 0; i < lines.length; i += 2) {
    entries.push(lines[i] + (lines[i+1] ? '\n' + lines[i+1] : ''));
  }
  console.log(`字幕エントリ数: ${entries.length}`);
  console.log('ElevenLabs with-timestamps リクエスト送信中...');

  const result = await requestWithTimestamps(scriptText);

  // 音声保存
  const audioBuffer = Buffer.from(result.audio_base64, 'base64');
  fs.writeFileSync(AUDIO_OUT, audioBuffer);
  console.log(`✓ 音声保存: ${AUDIO_OUT} (${(audioBuffer.length/1024).toFixed(1)} KB)`);

  // アライメント確認
  const al = result.alignment || result.normalized_alignment;
  if (!al || !al.characters) {
    throw new Error('アライメントデータが取得できませんでした');
  }
  console.log(`アライメント文字数: ${al.characters.length}`);
  console.log(`音声長: ${al.character_end_times_seconds.at(-1).toFixed(2)}秒`);

  // SRT生成
  const srt = buildSrt(entries, al);
  fs.writeFileSync(SRT_OUT, srt, 'utf8');
  console.log(`✓ SRT保存: ${SRT_OUT} (${entries.length}エントリ)`);
}

main().catch(err => {
  console.error('エラー:', err.message);
  process.exit(1);
});
