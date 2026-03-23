import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const FFMPEG = 'C:\\Users\\mkryo\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe';
const BASE = 'C:\\Users\\mkryo';
const OUT_DIR = 'C:\\Users\\mkryo\\video_build';

// 音声の長さ: 555秒（実測554.7秒 / 2026-03-23）
// セクション別タイムライン
const segments = [
  { svg: 'bg_opening.svg', start: 0,   duration: 30  },  // オープニング
  { svg: 'bg_system.svg',  start: 30,  duration: 130 },  // 全体状況・戦況
  { svg: 'bg_faction.svg', start: 160, duration: 200 },  // 行動分析・フォーラム
  { svg: 'bg_market.svg',  start: 360, duration: 165 },  // 市場・注目ポイント
  { svg: 'bg_opening.svg', start: 525, duration: 30  },  // 締め
];

// ── 1. SVG → PNG変換 ──────────────────────────────────────
console.log('1. SVG → PNG変換中...');
const pngFiles = [];
const seen = new Set();
for (const seg of segments) {
  if (seen.has(seg.svg)) continue;
  seen.add(seg.svg);
  const svgPath = path.join(BASE, seg.svg);
  const pngPath = path.join(OUT_DIR, seg.svg.replace('.svg', '.png'));
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
  const pngPath = path.join(OUT_DIR, seg.svg.replace('.svg', '.png'));
  const outPath = path.join(OUT_DIR, `seg_${i}.mp4`);

  const cmd = `"${FFMPEG}" -y -loop 1 -i "${pngPath}" -t ${seg.duration} -vf "scale=1920:1080,fps=24" -c:v libx264 -preset fast -pix_fmt yuv420p "${outPath}"`;
  execSync(cmd, { stdio: 'pipe' });
  segVideos.push(outPath);
  console.log(`  ✓ セグメント${i+1}: ${seg.svg.replace('.svg','')} (${seg.duration}秒)`);
}

// ── 3. セグメントを結合 ────────────────────────────────────
console.log('\n3. 映像セグメント結合中...');
const listFile = path.join(OUT_DIR, 'segments.txt');
fs.writeFileSync(listFile, segVideos.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'));

const videoOnly = path.join(OUT_DIR, 'video_only.mp4');
execSync(`"${FFMPEG}" -y -f concat -safe 0 -i "${listFile}" -c copy "${videoOnly}"`, { stdio: 'pipe' });
console.log('  ✓ 映像結合完了');

// ── 4. 音声と合成（字幕焼き込み） ──────────────────────────
console.log('\n4. 音声合成 + 字幕焼き込み中...');
const audioFile = path.join(BASE, 'news_audio.mp3');
const srtFile = path.join(BASE, 'news_subtitles.srt');
const finalVideo = path.join(BASE, 'spacemolt_news.mp4');

// 字幕スタイル: 白文字、黒縁取り、画面下部
const subtitleFilter = `subtitles='${srtFile.replace(/\\/g, '/').replace(/:/g, '\\:')}':force_style='FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,Alignment=2,MarginV=40'`;

const finalCmd = `"${FFMPEG}" -y -i "${videoOnly}" -i "${audioFile}" -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k -shortest -vf "${subtitleFilter}" -movflags +faststart "${finalVideo}"`;
execSync(finalCmd, { stdio: 'pipe' });

// ── 5. 後片付け ────────────────────────────────────────────
segVideos.forEach(f => fs.unlinkSync(f));
fs.unlinkSync(videoOnly);
fs.unlinkSync(listFile);

const stat = fs.statSync(finalVideo);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✓ 完成: C:\\Users\\mkryo\\spacemolt_news.mp4');
console.log(`  サイズ: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
console.log('  解像度: 1920x1080 / H.264 / AAC 192kbps');
console.log('  YouTube推奨フォーマット: ✓');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
