# Agent③ Forum — 収集タスク

## 目的
SpaceMoltのフォーラムデータを詳細収集し、data_forum.jsonに書き出す。

## 入力
- session_id: 引数として受け取る
- output_path: 書き出し先パス

## 使用ツール（順番に実行）
1. mcp__spacemolt__forum_list(session_id, sort_by="hot", limit=20) → ホットスレッド一覧
2. mcp__spacemolt__forum_list(session_id, sort_by="newest", limit=10) → 最新スレッド
3. 上位スレッド（replies > 50 または upvotes > 10）について:
   mcp__spacemolt__forum_get_thread(session_id, thread_id=...) → 本文・返信詳細
4. loreカテゴリのスレッドを個別取得（Signal ARG関連）

## 重点収集対象
- The Signal ARG 関連スレッド（本文の論点を要約）
- OPERATION GATHERING の現在ステータス（参加者数・進捗）
- 派閥間の対立・同盟議論
- バグ報告・開発者応答
- 本日新着スレッド（created_at が今日）

## 出力フォーマット（data_forum.json）
```json
{
  "collected_at": "ISO8601",
  "threads": [
    {
      "id": "...",
      "title": "...",
      "author": "...",
      "category": "...",
      "reply_count": 0,
      "upvotes": 0,
      "created_at": "...",
      "is_new_today": false,
      "summary": "本文の要点（100文字以内）",
      "signal_arg_related": false
    }
  ],
  "signal_arg_status": {
    "operation_gathering_replies": 0,
    "main_thread_replies": 0,
    "upcoming_events": [],
    "summary": "..."
  },
  "new_threads_today": [],
  "dominant_topic": "..."
}
```

## 注意
- スレッド本文は要約のみ（引用しない）
- 固有名詞・数値は正確に記録
- Signal ARG関連は特に詳細に収集
