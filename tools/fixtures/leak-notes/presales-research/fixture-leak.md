---
id: fixture-leak
title: "漏れ fixture ノート"
tags: [fixture]
created: 2026-11-08
updated: 2026-11-08
summary: "data-check の回帰用 fixture（漏れ側）。本文に社内パスを仕込んである。"
lang: ja
type: research
scope: public
related: [fixture-clean]
---

# 漏れ fixture ノート

本文に旧ツール継承の社内パスを混ぜてある:

- `scripts/import-intelhub.py` を直接呼ぶ手順
- `ark-harness` の旧出力を参照する

ここが検出されない場合、禁止語・社内パス検査が壊れている。
