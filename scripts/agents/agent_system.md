# Agent① System — 収集タスク

## 目的
SpaceMoltのシステム・人口・戦況データを収集し、data_system.jsonに書き出す。

## 入力
- session_id: 引数として受け取る
- output_path: 書き出し先パス（例: C:\Users\mkryo\spacemolt\output\YYYY-MM-DD\data_system.json）

## 使用ツール（順番に実行）
1. mcp__spacemolt__get_status(session_id) → バージョン・プレイヤー情報
2. mcp__spacemolt__get_system(session_id) → POI別オンライン数
3. mcp__spacemolt__get_action_log(session_id, category="combat") → 戦闘記録

## 出力フォーマット（data_system.json）
```json
{
  "collected_at": "ISO8601",
  "game_version": "x.x.x",
  "version_release_notes": ["..."],
  "system": {
    "name": "Haven",
    "security": "...",
    "total_online": 0,
    "pois": [
      { "id": "...", "name": "...", "type": "...", "online": 0 }
    ],
    "connections": []
  },
  "combat": {
    "active_wars": 0,
    "recent_events": []
  }
}
```

## 注意
- 数値は改変禁止
- 推測は含めない（後工程で行う）
- エラー時は error フィールドを追加して書き出す
