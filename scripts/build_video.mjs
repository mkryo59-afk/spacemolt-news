import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const FFMPEG = 'C:\\Users\\mkryo\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe';

const DATE = process.argv[2] || new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = path.resolve('spacemolt', 'output', DATE);
const ASSETS_DIR = path.resolve('spacemolt', 'assets');
const BUILD_DIR  = path.resolve('video_build');

// ── TOTAL_SECONDS: mp3ファイルサイズから自動計算 ─────────────
const audioFile = path.join(OUTPUT_DIR, 'news_audio.mp3');
if (!fs.existsSync(audioFile)) {
  console.error(`エラー: ${audioFile} が見つかりません`);
  process.exit(1);
}
const audioSize = fs.statSync(audioFile).size;
const TOTAL_SECONDS = Math.round(audioSize / 16000);
console.log(`音声サイズ: ${audioSize} bytes → TOTAL_SECONDS: ${TOTAL_SECONDS}秒`);

// ── セクション別タイムライン（最終区間は自動計算）────────────
const FIXED_SEGMENTS = [
  { svg: 'bg_opening.svg', start: 0,   duration: 30  },  // オープニング
  { svg: 'bg_system.svg',  start: 30,  duration: 130 },  // 全体状況・戦況
  { svg: 'bg_faction.svg', start: 160, duration: 200 },  // 行動分析・フォーラム
  { svg: 'bg_market.svg',  start: 360, duration: 165 },  // 市場・注目ポイント
];
const CLOSING_START = 525;
const segments = [
  ...FIXED_SEGMENTS,
  { svg: 'bg_opening.svg', start: CLOSING_START, duration: Math.max(10, TOTAL_SECONDS - CLOSING_START) },  // 締め
];

fs.mkdirSync(BUILD_DIR, { recursive: true });

// ── 1. SVG → PNG変換 ──────────────────────────────────────
console.log('\n1. SVG → PNG変換中...');
const seen = new Set();
for (const seg of segments) {
  if (seen.has(seg.svg)) continue;
  seen.add(seg.svg);
  const svgPath = path.join(ASSETS_DIR, seg.svg);
  const pngPath = path.join(BUILD_DIR, seg.svg.replace('.svg', '.png'));
  if (!fs.existsSync(svgPath)) {
    console.error(`エラー: ${svgPath} が見つかりません`);
    process.exit(1);
  }
  const svgData = fs.readFileSync(svgPath);
  const resvg = new Resvg(svgData, { fitTo: { mode: 'width', value: 1920 } });
  const rendered = resvg.render();
  fs.writeFileSync(pngPath, rendered.asPng());
  console.log(`  ✓ ${seg.svg} → ${path.basename(pngPath)}`);
}

// ── 2. セグメント別動画を生成 ──────────────────────────────
console.log('\n2. セグメント動画生成中...');
const segVideos = [];
for (let i = 0; i < segments.length; i++) {
  const seg = segments[i];
  const pngPath = path.join(BUILD_DIR, seg.svg.replace('.svg', '.png'));
  const outPath = path.join(BUILD_DIR, `seg_${i}.mp4`);

  const cmd = `"${FFMPEG}" -y -loop 1 -i "${pngPath}" -t ${seg.duration} -vf "scale=1920:1080,fps=24" -c:v libx264 -preset fast -pix_fmt yuv420p "${outPath}"`;
  execSync(cmd, { stdio: 'pipe' });
  segVideos.push(outPath);
  console.log(`  ✓ セグメント${i+1}: ${seg.svg.replace('.svg','')} (${seg.duration}秒)`);
}

// ── 3. セグメントを結合 ────────────────────────────────────
console.log('\n3. 映像セグメント結合中...');
const listFile = path.join(BUILD_DIR, 'segments.txt');
fs.writeFileSync(listFile, segVideos.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'));

const videoOnly = path.join(BUILD_DIR, 'video_only.mp4');
execSync(`"${FFMPEG}" -y -f concat -safe 0 -i "${listFile}" -c copy "${videoOnly}"`, { stdio: 'pipe' });
console.log('  ✓ 映像結合完了');

// ── 4. 音声と合成（字幕焼き込み） ──────────────────────────
console.log('\n4. 音声合成 + 字幕焼き込み中...');
const srtFile = path.join(OUTPUT_DIR, 'news_subtitles.srt');
const finalVideo = path.join(OUTPUT_DIR, 'spacemolt_news.mp4');

const subtitleFilter = `subtitles='${srtFile.replace(/\\/g, '/').replace(/:/g, '\\:')}':force_style='FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,Alignment=2,MarginV=40'`;

const finalCmd = `"${FFMPEG}" -y -i "${videoOnly}" -i "${audioFile}" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -vf "${subtitleFilter}" -movflags +faststart "${finalVideo}"`;
execSync(finalCmd, { stdio: 'pipe' });

// ── 5. 後片付け ────────────────────────────────────────────
segVideos.forEach(f => { try { fs.unlinkSync(f); } catch {} });
try { fs.unlinkSync(videoOnly); } catch {}
try { fs.unlinkSync(listFile); } catch {}

const stat = fs.statSync(finalVideo);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✓ 完成: ${finalVideo}`);
console.log(`  サイズ: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
console.log('  解像度: 1920x1080 / H.264 / AAC 192kbps');
console.log('  YouTube推奨フォーマット: ✓');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
