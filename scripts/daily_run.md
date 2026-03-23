# SpaceMolt 毎日の実行手順

## フェーズ1: データ収集（GitHub Actions / 自動）

GitHub Actionsが毎日10:00 JST（01:00 UTC）に自動実行:
```
collect_spacemolt.mjs → data_*.json
merge_data.mjs        → report.json
git push              → spacemolt/output/YYYY-MM-DD/report.json
```

手動実行する場合:
```bash
node spacemolt/scripts/collect_spacemolt.mjs 2026-03-23
node spacemolt/scripts/merge_data.mjs 2026-03-23
```

---

## フェーズ2: 台本生成

`spacemolt/output/YYYY-MM-DD/report.json` をClaudeに渡して台本を生成。
CLAUDE.mdの構成（8セクション）に従い、以下に保存:
- `spacemolt/output/YYYY-MM-DD/news_script.md`
- `spacemolt/output/YYYY-MM-DD/news_script_tts.txt`

---

## フェーズ3〜6: 音声・字幕・動画・Notion（1コマンド）

```bash
node spacemolt/scripts/run_pipeline.mjs 2026-03-23
```

内部で以下を順番に実行:
1. `elevenlabs_tts.mjs`  → `news_audio.mp3`
2. `generate_assets.mjs` → `news_subtitles.srt` + `spacemolt/assets/bg_*.svg`
3. `build_video.mjs`     → `spacemolt_news.mp4`
4. `notion_upload.mjs`   → Notion DB

### オプション
```bash
# 音声生成済みの場合（字幕〜Notionのみ）
node spacemolt/scripts/run_pipeline.mjs 2026-03-23 --skip-tts

# 動画ビルドをスキップ
node spacemolt/scripts/run_pipeline.mjs 2026-03-23 --skip-video

# Notionアップロードをスキップ
node spacemolt/scripts/run_pipeline.mjs 2026-03-23 --skip-notion
```

---

## 計算メモ（自動化済み・手動不要）
- **TOTAL_SECONDS**: `mp3ファイルサイズ(bytes) ÷ 16000` ← スクリプトが自動計算
- **segments最終区間**: `TOTAL_SECONDS - 525` ← スクリプトが自動計算
- **ファイル移動**: 全て `spacemolt/output/YYYY-MM-DD/` に自動保存

---

## 全出力先
```
spacemolt/output/YYYY-MM-DD/
├── report.json          ← GitHub Actionsが生成
├── news_script.md       ← 台本（Markdown）
├── news_script_tts.txt  ← 台本（TTS用）
├── news_audio.mp3       ← elevenlabs_tts.mjs
├── news_subtitles.srt   ← generate_assets.mjs
└── spacemolt_news.mp4   ← build_video.mjs

spacemolt/assets/
├── bg_opening.svg/png
├── bg_system.svg/png
├── bg_faction.svg/png
└── bg_market.svg/png
```
