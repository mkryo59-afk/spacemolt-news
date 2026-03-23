# SpaceMolt 毎日の実行手順

## フェーズ1: データ収集（並列エージェント）

### Step 1. ログイン
```
SpaceMolt MCP: login(username="Orion.Watch", password="...")
→ session_id を取得・記録
```

### Step 2. 4エージェントを並列起動（run_in_background=true）

出力先: `C:\Users\mkryo\spacemolt\output\YYYY-MM-DD\`

| エージェント | 指示書 | 出力ファイル |
|------------|--------|------------|
| Agent① | agents/agent_system.md | data_system.json |
| Agent② | agents/agent_market.md | data_market.json |
| Agent③ | agents/agent_forum.md | data_forum.json |
| Agent④ | agents/agent_factions.md | data_factions.json |

### Step 3. マージ
```
node spacemolt/scripts/merge_data.mjs YYYY-MM-DD
```

---

## フェーズ2: 台本生成
- `report.json` を読み込み
- CLAUDE.md の構成（8セクション）に従って台本を生成
- `news_script.md` と `news_script_tts.txt` に書き出し

---

## フェーズ3: 音声生成
```
# input: C:\Users\mkryo\news_script_tts.txt（コピーして配置）
node spacemolt/scripts/elevenlabs_tts.mjs
# output: C:\Users\mkryo\news_audio.mp3 → output/YYYY-MM-DD/ に移動
```

---

## フェーズ4: 字幕・背景生成
```
# TOTAL_SECONDS を音声実測値に更新してから実行
node spacemolt/scripts/generate_assets.mjs
# output: news_subtitles.srt, bg_*.svg → 各所定の場所に移動
```

---

## フェーズ5: 動画ビルド
```
# segments の合計秒数を音声長に合わせて調整してから実行
node spacemolt/scripts/build_video.mjs
# output: C:\Users\mkryo\spacemolt_news.mp4 → output/YYYY-MM-DD/ に移動
```

---

## フェーズ6: Notionアップロード
```
# ファイルを scripts/ にコピーしてから実行
node spacemolt/scripts/notion_upload.mjs
# 実行後: scripts/ の一時ファイルを削除
```

---

## 計算メモ
- **TOTAL_SECONDS**: `音声ファイルサイズ(bytes) ÷ 16000`
- **segments最終区間**: `TOTAL_SECONDS - 525` 秒
- **ファイル移動先**: `spacemolt/output/YYYY-MM-DD/`

## ファイル配置（ハードコードパス対応）
各スクリプトはルート `C:\Users\mkryo\` を参照するため:
- 実行前: 必要なファイルをルートにコピー
- 実行後: 出力ファイルを `output/YYYY-MM-DD/` に移動してルートのものを削除
