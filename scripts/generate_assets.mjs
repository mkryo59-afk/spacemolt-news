import fs from 'fs';
import path from 'path';

const DATE = process.argv[2] || new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = path.resolve('spacemolt', 'output', DATE);
const ASSETS_DIR = path.resolve('spacemolt', 'assets');

// ── TOTAL_SECONDS: mp3ファイルサイズから自動計算 ─────────────
const audioPath = path.join(OUTPUT_DIR, 'news_audio.mp3');
if (!fs.existsSync(audioPath)) {
  console.error(`エラー: ${audioPath} が見つかりません`);
  process.exit(1);
}
const audioSize = fs.statSync(audioPath).size;
const TOTAL_SECONDS = Math.round(audioSize / 16000);
console.log(`音声サイズ: ${audioSize} bytes → TOTAL_SECONDS: ${TOTAL_SECONDS}秒`);

// ── SRT生成 ─────────────────────────────────────────────
const scriptPath = path.join(OUTPUT_DIR, 'news_script_tts.txt');
if (!fs.existsSync(scriptPath)) {
  console.error(`エラー: ${scriptPath} が見つかりません`);
  process.exit(1);
}
const scriptText = fs.readFileSync(scriptPath, 'utf8');

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
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}

const lines = splitToLines(scriptText);
const totalChars = lines.reduce((s, l) => s + l.length, 0);
const charsPerSec = totalChars / TOTAL_SECONDS;

const entries = [];
for (let i = 0; i < lines.length; i += 2) {
  const text = lines[i] + (lines[i+1] ? '\n' + lines[i+1] : '');
  entries.push(text);
}

let srt = '';
let currentTime = 0.0;
for (let i = 0; i < entries.length; i++) {
  const chars = entries[i].replace('\n','').length;
  const duration = Math.max(1.5, chars / charsPerSec);
  const gap = 0.08;
  const start = currentTime;
  const end = currentTime + duration;

  srt += `${i + 1}\n`;
  srt += `${toSrtTime(start)} --> ${toSrtTime(end)}\n`;
  srt += `${entries[i]}\n\n`;

  currentTime = end + gap;
}

const srtOut = path.join(OUTPUT_DIR, 'news_subtitles.srt');
fs.writeFileSync(srtOut, srt, 'utf8');
console.log(`✓ news_subtitles.srt (${entries.length}エントリ)`);

// ── SVG背景生成 ──────────────────────────────────────────
function randomStars(count, seed) {
  let s = seed;
  const stars = [];
  for (let i = 0; i < count; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const x = Math.abs(s % 1920);
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const y = Math.abs(s % 1080);
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const r = (Math.abs(s % 18) / 10 + 0.4).toFixed(1);
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const op = (Math.abs(s % 7) / 10 + 0.3).toFixed(1);
    stars.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="${op}"/>`);
  }
  return stars.join('\n');
}

const backgrounds = [
  {
    file: 'bg_opening.svg',
    label: 'OPENING / CLOSING',
    gradient: `
      <radialGradient id="bg" cx="50%" cy="50%" r="80%">
        <stop offset="0%" stop-color="#0d0626"/>
        <stop offset="60%" stop-color="#07031a"/>
        <stop offset="100%" stop-color="#000005"/>
      </radialGradient>
      <radialGradient id="neb" cx="40%" cy="45%" r="50%">
        <stop offset="0%" stop-color="#4a1070" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#4a1070" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="neb2" cx="70%" cy="60%" r="35%">
        <stop offset="0%" stop-color="#102050" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#102050" stop-opacity="0"/>
      </radialGradient>`,
    extra: `<ellipse cx="760" cy="490" rx="680" ry="420" fill="url(#neb)"/>
            <ellipse cx="1330" cy="640" rx="460" ry="300" fill="url(#neb2)"/>
            <text x="960" y="980" text-anchor="middle" font-family="monospace" font-size="18" fill="#7a5fa0" opacity="0.5" letter-spacing="8">ORION WATCH GALAXY REPORT</text>`,
    stars: randomStars(320, 42),
  },
  {
    file: 'bg_system.svg',
    label: 'SYSTEM REPORT',
    gradient: `
      <radialGradient id="bg" cx="50%" cy="50%" r="80%">
        <stop offset="0%" stop-color="#021520"/>
        <stop offset="100%" stop-color="#000508"/>
      </radialGradient>
      <radialGradient id="neb" cx="55%" cy="50%" r="45%">
        <stop offset="0%" stop-color="#0a3a50" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#0a3a50" stop-opacity="0"/>
      </radialGradient>`,
    extra: `<ellipse cx="960" cy="540" rx="600" ry="380" fill="url(#neb)"/>
            ${Array.from({length:11},(_,i)=>`<line x1="${i*192}" y1="0" x2="${i*192}" y2="1080" stroke="#0e4460" stroke-width="0.5" opacity="0.4"/>`).join('')}
            ${Array.from({length:7},(_,i)=>`<line x1="0" y1="${i*180}" x2="1920" y2="${i*180}" stroke="#0e4460" stroke-width="0.5" opacity="0.4"/>`).join('')}
            <circle cx="960" cy="540" r="38" fill="#ffe090" opacity="0.18"/>
            <circle cx="960" cy="540" r="16" fill="#ffd060" opacity="0.55"/>
            <circle cx="960" cy="540" r="6" fill="#fff8e0"/>
            <circle cx="960" cy="540" r="120" fill="none" stroke="#1a6080" stroke-width="0.8" opacity="0.5" stroke-dasharray="4 6"/>
            <circle cx="960" cy="540" r="220" fill="none" stroke="#1a6080" stroke-width="0.8" opacity="0.35" stroke-dasharray="4 8"/>
            <text x="960" y="980" text-anchor="middle" font-family="monospace" font-size="18" fill="#1a8090" opacity="0.5" letter-spacing="8">HAVEN SYSTEM — NEBULA COLLECTIVE</text>`,
    stars: randomStars(280, 77),
  },
  {
    file: 'bg_faction.svg',
    label: 'FACTION INTEL',
    gradient: `
      <radialGradient id="bg" cx="50%" cy="50%" r="80%">
        <stop offset="0%" stop-color="#0f0808"/>
        <stop offset="100%" stop-color="#050202"/>
      </radialGradient>
      <radialGradient id="neb" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="#2a0808" stop-opacity="0.7"/>
        <stop offset="100%" stop-color="#2a0808" stop-opacity="0"/>
      </radialGradient>`,
    extra: `<ellipse cx="960" cy="540" rx="700" ry="450" fill="url(#neb)"/>
            ${Array.from({length:54},(_,i)=>`<line x1="0" y1="${i*20}" x2="1920" y2="${i*20}" stroke="#200a0a" stroke-width="1" opacity="0.3"/>`).join('')}
            <circle cx="960" cy="540" r="280" fill="none" stroke="#8b0000" stroke-width="0.8" opacity="0.3" stroke-dasharray="6 10"/>
            <circle cx="960" cy="540" r="180" fill="none" stroke="#8b0000" stroke-width="0.6" opacity="0.25" stroke-dasharray="3 12"/>
            <line x1="680" y1="540" x2="1240" y2="540" stroke="#8b0000" stroke-width="0.6" opacity="0.25"/>
            <line x1="960" y1="260" x2="960" y2="820" stroke="#8b0000" stroke-width="0.6" opacity="0.25"/>
            <text x="960" y="980" text-anchor="middle" font-family="monospace" font-size="18" fill="#8b2020" opacity="0.5" letter-spacing="8">FACTION INTEL — CLASSIFIED</text>`,
    stars: randomStars(200, 13),
  },
  {
    file: 'bg_market.svg',
    label: 'MARKET DATA',
    gradient: `
      <radialGradient id="bg" cx="50%" cy="50%" r="80%">
        <stop offset="0%" stop-color="#0e0c02"/>
        <stop offset="100%" stop-color="#030200"/>
      </radialGradient>
      <radialGradient id="neb" cx="50%" cy="55%" r="50%">
        <stop offset="0%" stop-color="#2a2000" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#2a2000" stop-opacity="0"/>
      </radialGradient>`,
    extra: `<ellipse cx="960" cy="580" rx="650" ry="380" fill="url(#neb)"/>
            ${Array.from({length:9},(_,i)=>`<line x1="160" y1="${200+i*80}" x2="1760" y2="${200+i*80}" stroke="#3a2e00" stroke-width="0.8" opacity="0.5"/>`).join('')}
            ${Array.from({length:9},(_,i)=>`<line x1="${160+i*200}" y1="180" x2="${160+i*200}" y2="900" stroke="#3a2e00" stroke-width="0.8" opacity="0.4"/>`).join('')}
            <polyline points="160,720 360,680 560,600 660,580 760,520 860,500 960,460 1060,490 1160,420 1360,380 1560,340 1760,320"
              fill="none" stroke="#c87800" stroke-width="2" opacity="0.35"/>
            <polyline points="160,820 360,790 560,750 760,700 960,660 1160,620 1360,590 1560,560 1760,540"
              fill="none" stroke="#805010" stroke-width="1.5" opacity="0.25"/>
            <text x="960" y="980" text-anchor="middle" font-family="monospace" font-size="18" fill="#a06010" opacity="0.5" letter-spacing="8">GRAND EXCHANGE — MARKET FEED</text>`,
    stars: randomStars(180, 99),
  },
];

fs.mkdirSync(ASSETS_DIR, { recursive: true });
for (const bg of backgrounds) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    ${bg.gradient}
  </defs>
  <rect width="1920" height="1080" fill="url(#bg)"/>
  ${bg.stars}
  ${bg.extra}
</svg>`;
  fs.writeFileSync(path.join(ASSETS_DIR, bg.file), svg, 'utf8');
  console.log(`✓ ${bg.file}`);
}

console.log('\n全ファイル生成完了:');
console.log(`  ${srtOut}`);
console.log(`  ${ASSETS_DIR}/bg_opening.svg  (オープニング/クロージング)`);
console.log(`  ${ASSETS_DIR}/bg_system.svg   (星系レポート)`);
console.log(`  ${ASSETS_DIR}/bg_faction.svg  (勢力インテル)`);
console.log(`  ${ASSETS_DIR}/bg_market.svg   (マーケット)`);
