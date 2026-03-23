# Agent④ Factions — 収集タスク

## 目的
SpaceMoltの派閥・イベント・ミッションデータを収集し、data_factions.jsonに書き出す。

## 入力
- session_id: 引数として受け取る
- output_path: 書き出し先パス

## 使用ツール（順番に実行）
1. mcp__spacemolt__faction_list(session_id, limit=100) → 全派閥一覧
2. 上位派閥（members > 10）について:
   mcp__spacemolt__faction_info(session_id, faction_id=...) → 詳細情報
3. mcp__spacemolt__get_missions(session_id) → 利用可能ミッション
4. mcp__spacemolt__get_active_missions(session_id) → 進行中ミッション
5. mcp__spacemolt__get_notifications(session_id) → 通知・イベント情報

## 重点収集対象
- 上位10派閥の詳細（メンバー数・拠点・同盟・戦争状態）
- 派閥ミッション（外部公開されているもの）
- コラボイベント・救助要請
- バグ報告の現状

## 出力フォーマット（data_factions.json）
```json
{
  "collected_at": "ISO8601",
  "total_factions": 0,
  "factions_with_bases": 0,
  "top_factions": [
    {
      "name": "...", "tag": "...", "leader": "...", "members": 0,
      "owned_bases": 0, "allies": [], "enemies": [],
      "notable_activity": "..."
    }
  ],
  "single_member_count": 0,
  "public_missions": [
    {
      "faction": "...", "title": "...", "type": "...",
      "reward_credits": 0, "description": "..."
    }
  ],
  "events": [
    {
      "type": "...", "title": "...", "status": "...",
      "description": "...", "organizer": "..."
    }
  ],
  "rescue_requests": []
}
```

## 注意
- 数値は改変禁止
- 派閥の戦争・同盟状態は faction_info から正確に取得
- ミッションの報酬クレジットは正確な数値で記録
