# SpaceMolt 毎日の作業手順

## 全体フロー

```
10:00 JST       自分          自分              自分
GitHub Actions  start_day     ChatGPT         run_pipeline
    ↓               ↓             ↓                ↓
report.json → クリップボード → 台本作成 → 音声・動画・Notion
```

---

## ① 10:00 JST 以降に作業開始

GitHub Actions が自動で `report.json` を生成・pushしています。

---

## ② start_day.mjs を実行（1コマンド）

```bash
node scripts/start_day.mjs
```

これだけで以下が自動実行されます:
- `git pull` で最新 report.json を取得
- report.json の内容をクリップボードにコピー
- 出力フォルダ（`output/YYYY-MM-DD/`）をエクスプローラーで開く
- 次の手順を画面に表示

---

## ③ ChatGPT で台本を作成

1. [ChatGPT](https://chat.openai.com) を開く
2. `scripts/news_prompt.md` の内容を貼り付ける
3. クリップボードの `report.json` を続けて貼り付ける
4. 生成された台本を以下に保存:
   ```
   output/YYYY-MM-DD/news_script_tts.txt
   ```

---

## ④ パイプラインを実行（1コマンド）

```bash
node scripts/run_pipeline.mjs YYYY-MM-DD --skip-script
```

内部で以下を順番に実行:
1. `elevenlabs_tts.mjs`  → `news_audio.mp3`
2. `generate_assets.mjs` → `news_subtitles.srt` + `assets/bg_*.svg`
3. `build_video.mjs`     → `spacemolt_news.mp4`
4. `notion_upload.mjs`   → Notion DB

### よく使うオプション
```bash
# 音声生成済みの場合
node scripts/run_pipeline.mjs YYYY-MM-DD --skip-script --skip-tts

# Notionアップロードをスキップ
node scripts/run_pipeline.mjs YYYY-MM-DD --skip-script --skip-notion
```

---

## トラブル時

### report.json がない場合（Actions が失敗した日）
```bash
node scripts/collect_spacemolt.mjs YYYY-MM-DD
node scripts/merge_data.mjs YYYY-MM-DD
```

### 自動生成台本を試したい場合
```bash
# gpt-5-mini（低コスト）
node scripts/generate_script.mjs YYYY-MM-DD

# gpt-5（高品質）
node scripts/generate_script.mjs YYYY-MM-DD --model=gpt-5

# 生成後にパイプラインを続けて実行
node scripts/run_pipeline.mjs YYYY-MM-DD --skip-script
```

---

## 出力ファイル一覧

```
output/YYYY-MM-DD/
├── report.json          ← GitHub Actions が自動生成
├── news_script_tts.txt  ← ChatGPT で手動作成
├── news_script.md       ← 同上（Markdown版）
├── news_audio.mp3       ← elevenlabs_tts.mjs
├── news_subtitles.srt   ← generate_assets.mjs
└── spacemolt_news.mp4   ← build_video.mjs

assets/
├── bg_opening.svg/png
├── bg_system.svg/png
├── bg_faction.svg/png
└── bg_market.svg/png
```

---

## 毎日の作業まとめ（最短3コマンド）

```bash
node scripts/start_day.mjs          # 準備（git pull + クリップボード）
# → ChatGPT で台本作成 → ファイル保存
node scripts/run_pipeline.mjs YYYY-MM-DD --skip-script  # 動画まで一気に
```
