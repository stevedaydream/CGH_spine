# 程式碼慣例

> 本文件記錄專案的程式碼慣例，避免風格不一致。

---

## 技術棧快速索引

| 層級 | 技術 | 版本/說明 |
|------|------|---------|
| 前端框架 | Vue 3 + Vite | Composition API + `<script setup>` |
| 前端部署 | Cloudflare Pages | `wrangler pages deploy` |
| 後端 | Google Apps Script (GAS) | clasp 管理，部署為 Web App |
| 資料庫 | Google Sheets | SpreadsheetApp 原生 API |
| LINE Bot | LINE Messaging API | GAS doPost Webhook |
| AI 解析 | Gemini API | Script Properties 存 key |
| 部署腳本 | GAS_push_deploy.bat | 選單式批次，Windows 環境 |

---

## 檔案結構慣例

```
CGH_spine/
├── src/                    # GAS 後端（clasp 管理）
│   ├── Config.gs           # 全域常數、分頁名稱、欄位索引
│   ├── WebApp.gs           # REST API 路由（doGet / doPost）
│   ├── FormHandler.gs      # addOperationRecord / addFollowUpRecord
│   ├── ReviewHandler.gs    # approveRecordByRow / rejectRecordByRow
│   ├── LineWebhook.gs      # LINE Bot webhook 處理
│   ├── GeminiAPI.gs        # Gemini API 呼叫
│   ├── DailyScheduler.gs   # 每日推播排程（GAS Trigger）
│   ├── WeeklyAnalysis.gs   # 每週統計分析（GAS Trigger）
│   ├── SheetSetup.gs       # 初始化 Sheets 結構
│   ├── TriggerSetup.gs     # GAS Trigger 設定
│   └── Utils.gs            # 共用工具函式
│
├── vue-app/                # Vue 3 前端
│   ├── src/
│   │   ├── views/          # 頁面（對應路由）
│   │   ├── components/     # 可重用元件
│   │   └── api/gas.js      # GAS Web App API 呼叫封裝
│   └── dist/               # 打包輸出（Cloudflare Pages 部署來源）
│
├── project.md              # 架構藍圖
├── project_conventions.md  # 本文件
├── project_decisions.md    # 技術決策紀錄
├── project_api.md          # API 合約
├── project_bugfix.md       # 除錯紀錄
└── GAS_push_deploy.bat     # 開發者工具選單
```

---

## GAS 後端慣例

- **欄位索引統一在 `Config.gs` 定義**，不在其他 .gs 檔案 hardcode 數字
- **分頁名稱**用 `SHEET.XXX` 常數，不用字串 literal
- **私密設定**（Token、API Key）一律存 Script Properties，用 `getConfig_('KEY')` 取得
- 函式命名：公開 API 用 camelCase（`getDashboardData`），內部 helper 加底線後綴（`_calcCageStats`）
- 錯誤處理：所有對外 API 函式包 `try/catch`，catch 回傳安全的空值結構

## Vue 前端慣例

- API 呼叫統一走 `src/api/gas.js`，不在 View 內直接 fetch
- Toast 通知：各 View 自己維護 `toast ref`，統一格式 `{ show, msg, type }`
- 載入狀態：`loading ref`，全螢幕 overlay spinner
- 樣式：Bootstrap 5 + inline style 為主，scoped CSS 只用於動畫

---

## 資料庫操作慣例

- **術後追蹤日誌**：Append-only，不修改既有列
- `confirmed = TRUE` 才納入統計計算
- `record_type`：`direct`（醫護填）/ `ai_parsed`（LINE Bot）/ `amended`（修正）

---

## 平台注意事項

- **Windows batch 呼叫 .cmd 工具**（clasp、npm、wrangler）必須加 `call`，否則父批次不返回（見 project_bugfix.md）
- **GAS 執行限制**：單次執行上限 6 分鐘，大量資料處理需分批
- **Cloudflare Pages 部署**：`wrangler pages deploy vue-app/dist --project-name spine-cgh --branch main`
