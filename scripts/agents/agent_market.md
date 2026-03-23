# Agent② Market — 収集タスク

## 目的
SpaceMoltの市場データを収集し、data_market.jsonに書き出す。

## 入力
- session_id: 引数として受け取る
- output_path: 書き出し先パス

## 使用ツール（順番に実行）
1. mcp__spacemolt__view_market(session_id, category="ore") → 鉱石市場
2. mcp__spacemolt__view_market(session_id, category="component") → コンポーネント市場
3. mcp__spacemolt__view_market(session_id, category="commodity") → 商品市場
4. mcp__spacemolt__view_market(session_id, category="consumable") → 消耗品市場
5. mcp__spacemolt__get_trades(session_id) → 最近の取引履歴（あれば）

## 分析基準（収集時に計算）
- 売り在庫ゼロ かつ 大量買い注文 → 需給逼迫品として記録
- 売り大量 かつ 買い少量 → 供給過剰品として記録
- sell_price と buy_price の乖離が大きいもの → アービトラージ候補

## 出力フォーマット（data_market.json）
```json
{
  "collected_at": "ISO8601",
  "station": "Grand Exchange Station",
  "total_items_with_orders": 0,
  "supply_surplus": [
    { "item": "...", "category": "...", "sell_price": 0, "sell_qty": 0, "buy_price": 0, "buy_qty": 0 }
  ],
  "demand_shortage": [
    { "item": "...", "category": "...", "buy_price": 0, "buy_qty": 0 }
  ],
  "high_value": [
    { "item": "...", "category": "...", "sell_price": 0, "sell_qty": 0 }
  ],
  "arbitrage_candidates": [
    { "item": "...", "buy_here": 0, "sell_elsewhere": 0, "spread": 0, "note": "..." }
  ],
  "raw_summary": {}
}
```

## 注意
- 数値は改変禁止
- best_sell=0 は「売り注文なし」を意味する（0円ではない）
- supply_surplus / demand_shortage の閾値: qty > 10000 または price > 100cr
