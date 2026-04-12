---
name: Project Spine CGH
description: 智慧化脊椎手術追蹤系統（Lite 版）— GAS + Google Sheets + Line Bot + Gemini MVP
type: project
---

已完成初版建置（2026-04-12）。

架構：Google Sheets（6個分頁）+ Google Apps Script + Line Messaging API + Gemini API

**已建立檔案：**
- `src/Config.gs` — 全域常數、欄位索引
- `src/SheetSetup.gs` — 六個分頁初始化、onOpen 選單
- `src/Utils.gs` — Line 推播、個資查詢、共用工具
- `src/DailyScheduler.gs` — 每日 08:00 推播排程器
- `src/GeminiAPI.gs` — Gemini 語意解析、週報摘要生成
- `src/LineWebhook.gs` — doPost Webhook 接收器
- `src/ReviewHandler.gs` — 醫護確認 onEdit 邏輯
- `src/WeeklyAnalysis.gs` — 週報統計、CSV 匯出
- `src/TriggerSetup.gs` — 觸發器安裝/刪除
- `DEPLOY.md` — 完整部署指南

**Why:** MVP 驗證期，零 App 開發成本，快速部署臨床數據追蹤方案。

**How to apply:** 後續修改請優先調整 Config.gs 的欄位索引，其他 .gs 檔案依賴此常數。升級至 V4（Firebase + Spring Boot）時欄位命名已與本版一致，可直接遷移。
