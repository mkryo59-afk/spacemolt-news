/**
 * run_pipeline.mjs
 * SpaceMolt動画作成パイプラインを1コマンドで実行するオーケストレータ
 *
 * 使用方法:
 *   node spacemolt/scripts/run_pipeline.mjs [YYYY-MM-DD] [--skip-tts] [--skip-video] [--skip-notion]
 *
 * オプション:
 *   --skip-tts     音声生成をスキップ（既存のnews_audio.mp3を使用）
 *   --skip-video   動画生成をスキップ
 *   --skip-notion  Notionアップロードをスキップ
 *
 * 前提条件:
 *   spacemolt/output/YYYY-MM-DD/report.json        ← merge_data.mjs で生成
 *   spacemolt/output/YYYY-MM-DD/news_script_tts.txt ← 手動または台本生成で作成
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const DATE = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || new Date().toISOString().slice(0, 10);
const skipTts    = args.includes('--skip-tts');
const skipVideo  = args.includes('--skip-video');
const skipNotion = args.includes('--skip-notion');

const OUTPUT_DIR = path.resolve('spacemolt', 'output', DATE);
const SCRIPTS_DIR = path.resolve('spacemolt', 'scripts');

function step(name, cmd) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶ ${name}`);
  console.log(`${'─'.repeat(60)}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✓ ${name} 完了`);
  } catch (err) {
    console.error(`✗ ${name} 失敗`);
    process.exit(1);
  }
}

function checkFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`エラー: ${label} が見つかりません: ${filePath}`);
    process.exit(1);
  }
}

// ── 開始 ──────────────────────────────────────────────────
console.log('━'.repeat(60));
console.log(`SpaceMolt 動画作成パイプライン`);
console.log(`日付: ${DATE}`);
console.log(`出力先: ${OUTPUT_DIR}`);
console.log(`TTS: ${skipTts ? 'スキップ' : '実行'}`);
console.log(`動画: ${skipVideo ? 'スキップ' : '実行'}`);
console.log(`Notion: ${skipNotion ? 'スキップ' : '実行'}`);
console.log('━'.repeat(60));

// 前提ファイル確認
checkFile(path.join(OUTPUT_DIR, 'report.json'), 'report.json');
checkFile(path.join(OUTPUT_DIR, 'news_script_tts.txt'), 'news_script_tts.txt');

// ── Step 1: 音声生成 ──────────────────────────────────────
if (!skipTts) {
  step('音声生成（ElevenLabs TTS）', `node "${path.join(SCRIPTS_DIR, 'elevenlabs_tts.mjs')}" ${DATE}`);
} else {
  checkFile(path.join(OUTPUT_DIR, 'news_audio.mp3'), 'news_audio.mp3（--skip-tts指定）');
  console.log('\n⏭ 音声生成スキップ（既存ファイル使用）');
}

// ── Step 2: 字幕・背景素材生成 ────────────────────────────
step('字幕・背景素材生成', `node "${path.join(SCRIPTS_DIR, 'generate_assets.mjs')}" ${DATE}`);

// ── Step 3: 動画ビルド ────────────────────────────────────
if (!skipVideo) {
  step('動画ビルド（FFmpeg）', `node "${path.join(SCRIPTS_DIR, 'build_video.mjs')}" ${DATE}`);
} else {
  console.log('\n⏭ 動画ビルドスキップ');
}

// ── Step 4: Notionアップロード ────────────────────────────
if (!skipNotion) {
  step('Notionアップロード', `node "${path.join(SCRIPTS_DIR, 'notion_upload.mjs')}" ${DATE}`);
} else {
  console.log('\n⏭ Notionアップロードスキップ');
}

// ── 完了サマリー ──────────────────────────────────────────
console.log('\n' + '━'.repeat(60));
console.log('✓ パイプライン完了');
console.log(`出力フォルダ: ${OUTPUT_DIR}`);
const mp4 = path.join(OUTPUT_DIR, 'spacemolt_news.mp4');
if (fs.existsSync(mp4)) {
  const size = fs.statSync(mp4).size;
  console.log(`動画: spacemolt_news.mp4 (${(size / 1024 / 1024).toFixed(1)} MB)`);
}
console.log('━'.repeat(60));
