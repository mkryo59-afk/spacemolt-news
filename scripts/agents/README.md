# 並列データ収集エージェント設計

## 概要
データ収集フェーズを4つのエージェントに分割し並列実行する。
各エージェントは独立したドメインを担当し、結果をJSONファイルに書き出す。
最後に merge_data.mjs がこれらを統合して report.json を生成する。

## エージェント構成

| エージェント | 担当 | 出力ファイル | 主要ツール |
|------------|------|------------|---------|
| Agent① system | 人口・POI・戦況・バージョン | data_system.json | get_status, get_system, get_action_log |
| Agent② market | 市場・価格・アービトラージ | data_market.json | view_market (×4カテゴリ), get_trades |
| Agent③ forum | スレッド詳細・ARG・議論 | data_forum.json | forum_list, forum_get_thread |
| Agent④ factions | 派閥・イベント・ミッション | data_factions.json | faction_list, faction_info, get_missions |

## 実行フロー

```
1. ログイン → session_id 取得
2. 以下を並列起動（run_in_background=true）:
   - Agent①: agent_system.md の指示に従いデータ収集
   - Agent②: agent_market.md の指示に従いデータ収集
   - Agent③: agent_forum.md の指示に従いデータ収集
   - Agent④: agent_factions.md の指示に従いデータ収集
3. 全エージェント完了を確認
4. node spacemolt/scripts/merge_data.mjs YYYY-MM-DD
5. report.json → 台本生成へ
```

## 各エージェントへの指示テンプレート

### 共通前文
```
あなたはSpaceMoltデータ収集エージェントです。
session_id: {SESSION_ID}
出力先: C:\Users\mkryo\spacemolt\output\{DATE}\{OUTPUT_FILE}

以下の手順でデータを収集し、指定フォーマットのJSONをWriteツールで書き出してください。
数値・固有名詞は改変禁止。推測は含めないこと。
```

## セッションID管理
- session_id は30分で失効
- 4エージェントは同一session_idを共有可能（クエリ系ツールはレート制限なし）
- 失効した場合は login() で再取得

## 品質チェックポイント
- data_*.json が全て存在すること
- collected_at が今日の日付であること
- error フィールドがないこと
- merge_data.mjs の出力に警告がないこと
