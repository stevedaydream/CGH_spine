# 專案藍圖：智慧化脊椎手術追蹤系統

> **版本**：V2.1（Vue 3 + GAS + Google Sheets）｜**更新日期**：2026-04-13
> **定位**：Vue 3（Cloudflare Pages）為醫護前端、Google Apps Script 為後端 API、Google Sheets 為資料庫、LINE Bot 為病患輸入介面的臨床數據追蹤方案。

---

## 目錄

1. [實際技術架構](#1-實際技術架構)
2. [Vue 前端（已實作）](#2-vue-前端已實作)
3. [GAS 後端（已實作）](#3-gas-後端已實作)
4. [Google Sheets 資料表結構](#4-google-sheets-資料表結構)
5. [LINE Bot 問卷流程（規劃中）](#5-line-bot-問卷流程規劃中)
6. [Gemini 自然語言對話（規劃中）](#6-gemini-自然語言對話規劃中)
7. [統計分析設計（規劃中）](#7-統計分析設計規劃中)
8. [資安與合規設計](#8-資安與合規設計)
9. [升級路徑](#9-升級路徑)

---

## 1. 實際技術架構

```
┌──────────────────────────────────────────────────────────┐
│  Vue 3 + Vite（Cloudflare Pages）                         │
│  ├ DashboardView  — 醫護後台（AI確認 + 病患追蹤列表）      │
│  ├ FormView       — 填表（Tab A 手術登錄 / Tab B 回診記錄） │
│  ├ AnalyticsView  — 分析儀表板（Chart.js 圖表）            │
│  └ [規劃] McidView — MCID 統計 + K-M 資料匯出             │
└────────────────┬─────────────────────────────────────────┘
                 │ HTTPS fetch（JSON）
┌────────────────▼─────────────────────────────────────────┐
│  Google Apps Script Web App（doGet REST API）             │
│  ├ WebApp.gs       — API 路由、getDashboardData            │
│  ├ FormHandler.gs  — addOperationRecord / addFollowUp     │
│  ├ ReviewHandler.gs— approveRecordByRow / rejectRecord    │
│  ├ LineWebhook.gs  — LINE Bot Webhook（doPost）           │
│  ├ GeminiAPI.gs    — Gemini API 語意解析                  │
│  ├ DailyScheduler.gs— 每日 08:00 推播排程（GAS Trigger）  │
│  ├ WeeklyAnalysis.gs— 每週一分析（GAS Trigger）           │
│  └ Config.gs       — 分頁名稱、欄位索引常數               │
└────────────────┬─────────────────────────────────────────┘
                 │ SpreadsheetApp（原生，無需憑證）
┌────────────────▼─────────────────────────────────────────┐
│  Google Sheets（6 個分頁，見第 4 章）                      │
└──────────────────────────────────────────────────────────┘

個資保護層（獨立 Google Drive，PRIVACY_TABLE_ID）
└── research_id ↔ 姓名 / LINE UID 對照表
```

### 部署設定

| 元件 | 工具 | 設定方式 |
|------|------|---------|
| 前端 | Cloudflare Pages | `.wrangler/` 設定，GitHub 推送自動部署 |
| 後端 | GAS Web App | `clasp push`，Script Properties 存密鑰 |
| 環境變數（GAS） | Script Properties | `LINE_CHANNEL_ACCESS_TOKEN`、`GEMINI_API_KEY`、`ADMIN_EMAIL`、`DOCTOR_EMAIL`、`PRIVACY_TABLE_ID` |

---

## 2. Vue 前端（已實作）

### 目前頁面結構

```
/ (DashboardView)  — 醫護後台
/form (FormView)   — 填表介面
/analytics (AnalyticsView) — 分析儀表板
```

### DashboardView（醫護後台）

**統計卡片（4 個）：** 總病患數 / 追蹤中 / 平均完整度 / 待確認數

**AI 暫存待確認區：**
- 顯示所有 `review_status = pending` 的記錄
- 每列顯示：研究編號、原始訊息（截斷）、AI 解讀 VAS（色圓 pill）、AI 摘要、解析時間
- 操作：核准（→ 移入追蹤日誌）、拒絕

**病患追蹤列表：**
- 欄位：研究編號 / 手術日期 / 手術類型 / Cage / 術後天數 / LINE 狀態 / 最後 VAS / 追蹤完整度（進度條）
- VAS 以色圓 pill 顯示（綠 0 → 紅 10）
- 完整度 = 實填次數 / 應填次數，依推播排程天數計算

### FormView（填表）

Bootstrap Tabs 分兩頁：

**Tab A — 新病患手術登錄（`addOperationRecord`）**

| 區塊 | 欄位 |
|------|------|
| 基本資料 | 研究編號（自動帶入下一號）、手術日期、主刀醫師、介入組別 |
| 術式 | 手術類型（下拉）、手術節段 |
| 耗材 | Cage 代碼（datalist）、骨移植（下拉）|
| 術前 VAS | VAS 背 / VAS 腿（VasInput 元件，0–10 按鈕）|
| 進階（可展開）| 術前 ODI、SVA、Cobb、Screw 代碼、其他耗材、手術時間、EBL、術中併發症 |

**Tab B — 門診回診記錄（`addFollowUpRecord`）**

| 欄位 | 說明 |
|------|------|
| 研究編號 | datalist 選擇（已有病患）|
| VAS 背 / 腿 | VasInput 元件 |
| 功能狀態描述 | 文字（ODI 相關，目前為非結構化）|
| 傷口狀況 | 文字 |

> Tab A 送出後自動帶入 Tab B 的研究編號，便於術後立即填第一筆回診記錄。

### AnalyticsView（分析儀表板）

| 區塊 | 內容 |
|------|------|
| 統計卡片 | 同 Dashboard 4 卡 |
| 耗材效益比較 | Bar chart：各 Cage VAS 改善分數（n<15 標黃）|
| 手術方式 VAS 趨勢 | Line chart：D7 / D14 / D28 平均 VAS（多線）|
| 追蹤完整度表格 | 每人應填/實填/完整度/連續未回覆次數 |
| 耗材效益明細表 | 術前 VAS / 術後14天 VAS / 改善率 / 警示 |
| CSV 匯出按鈕 | 呼叫 GAS `exportCsv()`，寫出至 Google Drive |

### VasInput 元件

0–10 的按鈕群組，選中後高亮，雙向綁定 v-model。

---

## 3. GAS 後端（已實作）

### API 端點（doGet + action 參數）

| action | 功能 | 對應 Vue |
|--------|------|---------|
| `getDashboardData` | pending 記錄 + 病患列表 + 摘要 | DashboardView |
| `getAnalyticsData` | 圖表資料 + 完整度 | AnalyticsView |
| `getFormOptions` | 病患 ID 列表、Cage 清單、下一編號 | FormView |
| `addOperationRecord` | 寫入手術記錄表 | FormView Tab A |
| `addFollowUpRecord` | 寫入術後追蹤日誌（直接，confirmed=TRUE）| FormView Tab B |
| `approveRecord` | AI 暫存 → 追蹤日誌 | DashboardView |
| `rejectRecord` | 標記 rejected | DashboardView |
| `exportCsv` | 匯出 confirmed=TRUE 資料至 Drive | AnalyticsView |

### LINE Bot（doPost）✅ 已走通

`LineWebhook.gs` 接收 LINE webhook → 呼叫 `GeminiAPI.gs` 解析 → 寫入 AI 暫存待確認區。

目前為**自由文字解析模式（已上線）**，下一步升級為 14 步結構化 Quick Reply 問卷。

### GAS Triggers

| 觸發器 | 時間 | 功能 |
|--------|------|------|
| `dailyPushScheduler` | 每日 08:00 | 依推播排程天數發送 LINE 推播 |
| `weeklyAnalysis` | 每週一 09:00 | 統計分析 + Email 主責醫師 |

### 推播排程天數（Config.gs）

```javascript
PUSH_SCHEDULE_DAYS = [1, 3, 5, 7, 10, 13, 17, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84]
// 共 17 個時間點，追蹤至術後第 84 天（Week 12）
```

---

## 4. Google Sheets 資料表結構

> 目前共 **6 個分頁**（已實作），另有 **2 個規劃中分頁**。

---

### 分頁 1：耗材代碼表（已實作）

| 欄位 | 說明 |
|------|------|
| `implant_code` | 耗材唯一代碼（下拉選單來源）|
| `implant_name` | 完整名稱 |
| `category` | Cage / Screw / Bone Graft / Cement |
| `brand` | 廠牌 |
| `note` | 備註 |

---

### 分頁 2：手術記錄表（已實作）

| 欄位（Col 索引）| 說明 |
|----------------|------|
| `research_id` (0) | 匿名研究編號，如 `SP-2026-001` |
| `op_date` (1) | 手術日期 |
| `surgeon` (2) | 主刀醫師 |
| `pre_vas_back` (3) | 術前 VAS 背 |
| `pre_vas_leg` (4) | 術前 VAS 腿 |
| `pre_odi` (5) | 術前 ODI（數字，0–100）|
| `pre_sva` (6) | SVA (mm) |
| `pre_cobb` (7) | Cobb Angle (°) |
| `op_name` (8) | 手術類型（TLIF / Endoscopic TLIF / PLIF…）|
| `op_levels` (9) | 手術節段（如 L4-L5）|
| `op_duration` (10) | 手術時間（分鐘）|
| `ebl` (11) | 失血量（mL）|
| `cage_code` (12) | Cage 代碼 |
| `screw_code` (13) | Screw 代碼 |
| `bone_graft` (14) | 骨移植方式 |
| `other_implant` (15) | 其他耗材 |
| `complication` (16) | 術中併發症 |
| `line_status` (17) | `active / blocked / unbound` |
| `intervention_group` (18) | `line_bot / control / partial` |

---

### 分頁 3：術後追蹤日誌（已實作，長表格）

> **Append-only**，每次回報一列。術後天數由 GAS 自動計算。

| 欄位（Col 索引）| 說明 |
|----------------|------|
| `log_id` (0) | 唯一流水號 |
| `research_id` (1) | 對應手術記錄表 |
| `log_datetime` (2) | 填寫時間戳 |
| `days_post_op` (3) | 術後天數（GAS 計算）|
| `vas_back` (4) | VAS 背痛 0–10 |
| `vas_leg` (5) | VAS 腿痛 0–10 |
| `odi_description` (6) | 功能狀態描述（目前為文字）|
| `wound_status` (7) | 傷口狀況 |
| `raw_message` (8) | LINE Bot 原始訊息 |
| `record_type` (9) | `direct / ai_parsed / amended` |
| `confirmed` (10) | `TRUE / FALSE`（醫護確認）|

> **待改善**：`odi_description` 目前為非結構化文字，無法用於 MCID 計算。規劃改為數值欄位 `odi_score`（0–100），或新增欄位並保留舊欄位。

---

### 分頁 4：AI 暫存待確認區（已實作）

| 欄位（Col 索引）| 說明 |
|----------------|------|
| `research_id` (0) | 病患研究編號 |
| `raw_message` (1) | LINE 原始訊息 |
| `ai_vas_back` (2) | Gemini 解讀 VAS 背 |
| `ai_vas_leg` (3) | Gemini 解讀 VAS 腿 |
| `ai_summary` (4) | AI 摘要 |
| `ai_parsed_at` (5) | 解析時間 |
| `review_status` (6) | `pending / approved / rejected` |
| `reviewed_by` (7) | 確認者帳號 |
| `reviewed_at` (8) | 確認時間 |

---

### 分頁 5：推播排程 Log（已實作）

| 欄位（Col 索引）| 說明 |
|----------------|------|
| `research_id` (0) | 病患研究編號 |
| `scheduled_day` (1) | 計畫推播天數（如 `7`）|
| `scheduled_date` (2) | 計畫推播日期 |
| `sent_at` (3) | 實際發送時間 |
| `status` (4) | `sent / failed / skipped` |
| `skip_reason` (5) | `holiday / line_blocked / already_sent` |
| `error_message` (6) | 失敗原因 |

---

### 分頁 6：AI 分析區（已實作）

GAS WeeklyAnalysis.gs 計算後寫入，含耗材效益、手術方式比較、追蹤完整度。

---

### 分頁 7：統計分析區【規劃中】

> 自動從分頁 2、3 拉取，以 D84（TP-17）為主要終點計算 MCID。

#### 區塊 A — MCID 達成總表（每人一列）

| 欄位 | 公式 |
|------|------|
| `vas_back_improvement` | `= pre_vas_back - post_vas_D84` |
| `vas_back_mcid` | `= IF(改善 >= 2.5, "✅ Success", "❌ Fail")` |
| `odi_improvement_pct` | `= pre_odi% - post_odi%_D84` |
| `odi_mcid` | `= IF(改善 >= 12.8%, "✅ Success", "❌ Fail")` |
| `vas_improvement_rate` | `= 改善 / 術前 * 100%` |

#### 區塊 B — PASS 達成天數（K-M 原始資料）

| 欄位 | 說明 |
|------|------|
| `pass_achieved` | TRUE / FALSE |
| `days_to_pass` | 首次 VAS_back ≤ 3 的術後天數 |
| `censored` | 追蹤結束仍未達 PASS |

#### 區塊 C — 統計模型備忘

```
【LMM】依變數 VAS、固定效應 time × group、隨機效應 by research_id
       工具：R lme4 / SPSS Mixed

【K-M】 事件：VAS_back ≤ 3；截尾：追蹤結束未達 PASS
        工具：R survival / SPSS KM
```

#### 區塊 D — 摘要統計

MCID 達成率、平均改善率、樣本數警示（n < 15 → ⚠️）

---

### 分頁 8：對話狀態表【規劃中】

> 解決 LINE Bot 14 步問卷的無狀態問題。GAS 每次 webhook 查此表取得進度。

| 欄位 | 說明 |
|------|------|
| `line_uid` | LINE User ID |
| `research_id` | 對應研究編號 |
| `current_step` | `idle / vas_back / vas_leg / odi_q1…odi_q10 / pass / anchor_q / done / chat` |
| `session_data` | JSON 文字，暫存本次累積分數 |
| `tp_target` | 本次對應時間點（如 `D7`）|
| `last_active` | 最後活動時間，逾 24h 自動重置 |

---

## 5. LINE Bot 問卷流程（規劃中）

> 目前 `LineWebhook.gs` 僅實作自由文字 → Gemini 解析。
> 以下為規劃的 14 步結構化問卷升級方向。

### 14 步問卷流程

| 步驟 | 問題 | 輸入方式 |
|------|------|---------|
| 1 | VAS 背痛（0–10）| Quick Reply 按鈕 |
| 2 | VAS 腿痛（0–10）| Quick Reply 按鈕 |
| 3–12 | ODI Q1–Q10（各 6 選項，0–5 分）| Quick Reply 按鈕 |
| 13 | PASS（現在的狀態您可以接受嗎？）| Quick Reply Y / N |
| 14 | 定錨問題（整體改善感受，1–7 分）| Quick Reply 按鈕 |

### ODI 10 題評估面向

| 題號 | 面向 | 題號 | 面向 |
|------|------|------|------|
| Q1 | 疼痛強度 | Q6 | 站立耐受 |
| Q2 | 個人照護 | Q7 | 睡眠品質 |
| Q3 | 提重物 | Q8 | 社交活動 |
| Q4 | 行走距離 | Q9 | 旅行交通 |
| Q5 | 坐姿耐受 | Q10 | 職業家務 |

### ODI 計分

```
ODI 原始分 = Q1+…+Q10（0–50）
ODI 百分比 = 原始分 ÷ 50 × 100%
MCID 達成  = 術前 ODI% - 術後 ODI% ≥ 12.8%
```

### 訊息流向（升級後）

```
病患 LINE 訊息
    ↓
LineWebhook.gs 接收
    ↓
查【對話狀態表】取 current_step
    ↓
    ├─ 問卷進行中 → Quick Reply 狀態機 → 累加 session_data
    │    → 問卷完成 → 直接寫入【術後追蹤日誌】（confirmed=TRUE）
    │
    └─ idle / chat / 自由文字
         → Gemini context injection → 個人化回覆
         → 解析數值 → 寫入【AI 暫存待確認區】
```

---

## 6. Gemini 自然語言對話（規劃中）

### Context Injection Prompt 結構

```javascript
function buildChatPrompt(patientCtx, rawMessage) {
  return `你是友善的術後照護助理，用溫暖口語的繁體中文回覆（2–3句）。

【病患現況】
術後第 ${patientCtx.daysPostOp} 天 | 手術：${patientCtx.opName}
上次回報（${patientCtx.lastReportDays}天前）：VAS背=${patientCtx.lastVasBack}，VAS腿=${patientCtx.lastVasLeg}

【病患訊息】"${rawMessage}"

請完成兩件事：
1. 溫暖回覆（不過度醫療化）
2. 若有疼痛資訊，推估數值，輸出 JSON；否則 null

格式：
REPLY: （回覆文字）
DATA: {"vas_back": 數字或null, "vas_leg": 數字或null, "confidence": "high/low"}`;
}
```

### 三種對話情境

| 情境 | 範例 | 處理 |
|------|------|------|
| 主動回報症狀 | 「腰好多了，腳還有點麻」| 回覆 + 推估 VAS → 暫存確認 |
| 詢問自身狀況 | 「我的恢復正常嗎？」| 查本人歷史 → 個人化回覆，不寫入 |
| 非醫療閒聊 | 「謝謝你們的關心」| 簡短回覆，不解析 |

---

## 7. 統計分析設計（規劃中）

### MCID 門檻（JBJS 標準）

| 指標 | MCID 門檻 | 計算基準 |
|------|----------|---------|
| VAS | 改善 ≥ 2.5 分 | 術前 vs D84 |
| ODI | 改善 ≥ 12.8% | 術前 vs D84 |

### 計畫新增 Vue Tab：McidView

| 區塊 | 內容 |
|------|------|
| MCID 達成率儀表板 | VAS / ODI 各自達成率，圓餅或數字卡 |
| 個人 MCID 明細表 | 每人術前/術後/改善量/結果 |
| PASS 達成天數表 | K-M 原始資料，可下載 CSV |
| 樣本數警示 | n < 15 顯示警示橫幅 |

---

## 8. 資安與合規設計

### 個資保護架構

```
Google Sheets（研究數據）            Google Drive（敏感對照）
────────────────────────             ──────────────────────
research_id: SP-2026-001   ←→       姓名、LINE UID
（無姓名、無 LINE UID）               （PRIVACY_TABLE_ID，獨立存取控管）
```

### 存取控制

| 角色 | 可存取分頁 | 權限 |
|------|-----------|------|
| 主責醫師 | 全部 | 讀寫 |
| 護理師 / RA | 手術記錄、追蹤日誌、AI 暫存 | 讀寫 |
| 研究助理 | AI 分析區、追蹤日誌 | 唯讀 |
| GAS 服務帳號 | 全部（程式執行）| 讀寫 |

---

## 9. 升級路徑

```
現在（V2.1 實作中）                  →  未來（V4 完整版）
────────────────────────────────       ──────────────────────────
Vue 3 + Cloudflare Pages           →  同（持續優化）
GAS Web App（REST API）            →  Cloudflare Workers（更快，無 cold start 問題）
Google Sheets（Append-only 長表）   →  Firebase Firestore（即時同步）
LINE Bot 自由文字 ✅ 已上線          →  14 步 Quick Reply 問卷（規劃中）
Gemini 解析（已實作）               →  Gemini context injection 對話（規劃中）
手動 CSV 匯出（已實作）             →  MCID Vue Tab + 自動週報（規劃中）
```

### 近期待實作優先順序

| 優先 | 功能 | 對應位置 |
|------|------|---------|
| ★★★ | `odi_description` → `odi_score`（數值欄位）| `Config.gs`、`FormHandler.gs`、FormView Tab B |
| ★★★ | LINE Bot 14 步 Quick Reply 問卷 + 對話狀態表 | `LineWebhook.gs`、新分頁 |
| ★★ | Vue McidView（MCID 統計 Tab）| `vue-app/src/views/`、`WebApp.gs` |
| ★★ | Gemini context injection 對話模式 | `GeminiAPI.gs`、`LineWebhook.gs` |
| ★ | 統計分析分頁（Sheets 公式）| Google Sheets |

---

*文件由 Claude AI 協助整合生成，內容需由主責開發者確認後執行。*
