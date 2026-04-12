# 專案藍圖 Lite：智慧化脊椎手術追蹤系統（輕量版）

> **版本**：V1（Google Sheets 核心架構）｜**更新日期**：2026-04-12  
> **定位**：以 Google Sheets + GAS + Line Bot 為核心，零 App 開發成本，快速部署的臨床數據追蹤方案。  
> **適用階段**：MVP 驗證期 → 可平滑升級至 V4 完整架構

---

## 目錄

1. [方案概覽](#1-方案概覽)
2. [資料表結構設計](#2-資料表結構設計)
3. [自動化追蹤邏輯](#3-自動化追蹤邏輯)
4. [三端輸入方式](#4-三端輸入方式)
5. [AI 分析與統計回饋](#5-ai-分析與統計回饋)
6. [資安與合規設計](#6-資安與合規設計)
7. [數據品質保障機制](#7-數據品質保障機制)
8. [實施步驟](#8-實施步驟)
9. [技術架構總覽](#9-技術架構總覽)

---

## 1. 方案概覽

### 設計原則

| 原則 | 說明 |
|------|------|
| 低成本 | 全程使用 Google 免費工具，無需自建伺服器 |
| 快速部署 | 第一版可在 2 週內上線 |
| 合規優先 | 個資保護設計內建，非事後補加 |
| 可升級 | 數據結構與 V4 完整版相容，未來可無縫遷移 |

### 工具組合

```
Google Sheets   → 核心資料庫
Google Forms    → 醫護端輸入介面（第一階段）
AppSheet        → 醫護端 App 介面（第二階段升級）
Google Apps Script (GAS) → 自動化排程、Line Bot 串接、AI 分析
Line Messaging API → 病患端推播與回覆
Gemini API      → 自然語言解析、AI 回饋生成
```

---

## 2. 資料表結構設計

> 單一 Spreadsheet，包含以下 **六個分頁**。

---

### 分頁 1：【耗材代碼表】

> 所有下拉選單的來源，確保輸入標準化，解決自由文字造成的統計合併問題。

| 欄位 | 說明 | 範例 |
|------|------|------|
| `implant_code` | 耗材唯一代碼 | `CAGE-TLIF-10` |
| `implant_name` | 完整名稱 | TLIF Cage 10mm |
| `category` | 分類 | Cage / Screw / Bone Graft / Cement |
| `brand` | 廠牌 | （自行填入） |
| `note` | 備註 | — |

---

### 分頁 2：【手術記錄表】

> 醫護端術後填寫，為所有追蹤的基準資料。**僅存研究編號，不存姓名。**

| 欄位類別 | 欄位名稱 | 類型 | 備註 |
|----------|----------|------|------|
| **識別** | `research_id` | 文字 | 匿名研究編號，如 `SP-2026-001` |
| **識別** | `op_date` | 日期 | 手術日期，用於計算追蹤天數 |
| **識別** | `surgeon` | 下拉 | 主刀醫師代碼 |
| **術前** | `pre_vas_back` | 數字 | 術前 VAS（背）0-10 |
| **術前** | `pre_vas_leg` | 數字 | 術前 VAS（腿）0-10 |
| **術前** | `pre_odi` | 數字 | 術前 ODI 指數 |
| **術前** | `pre_sva` | 數字 | 影像參數 SVA（mm） |
| **術前** | `pre_cobb` | 數字 | 影像參數 Cobb Angle（度） |
| **手術** | `op_name` | 下拉 | TLIF / Endoscopic / PLIF… |
| **手術** | `op_levels` | 文字 | 如 `L4-L5` |
| **手術** | `op_duration` | 數字 | 手術時間（分鐘） |
| **手術** | `ebl` | 數字 | 失血量（mL） |
| **耗材** | `cage_code` | 下拉 | 來自耗材代碼表 |
| **耗材** | `screw_code` | 下拉 | 來自耗材代碼表 |
| **耗材** | `bone_graft` | 下拉 | 骨髓 / 骨水泥 / 人工骨 / 無 |
| **耗材** | `other_implant` | 下拉（多選） | 其他耗材代碼 |
| **結果** | `complication` | 文字 | 術中併發症（無則留空） |
| **系統** | `line_status` | 下拉 | `active / blocked / unbound` |
| **系統** | `intervention_group` | 下拉 | `line_bot / control / partial` |

---

### 分頁 3：【術後追蹤日誌】

> **只新增不修改**（Append-only）設計，每次更新都是新一列，保留完整溯源記錄。

| 欄位名稱 | 來源 | 說明 |
|----------|------|------|
| `log_id` | 自動 | 唯一流水號 |
| `research_id` | 關聯 | 對應手術記錄表 |
| `log_datetime` | 自動 | 填寫時間戳 |
| `days_post_op` | 公式 | `=log_date - op_date` |
| `vas_back` | 輸入 | VAS 背痛 0-10 |
| `vas_leg` | 輸入 | VAS 腿痛 0-10 |
| `odi_description` | 輸入 | 功能描述（文字） |
| `wound_status` | 輸入 | 傷口狀況描述 |
| `raw_message` | Line Bot | 病患原始訊息 |
| `record_type` | 系統 | `direct / ai_parsed / amended` |
| `confirmed` | 醫護 | `TRUE / FALSE`（是否已醫護確認） |

---

### 分頁 4：【AI 暫存待確認區】

> Gemini 解析結果的緩衝區，**醫護確認後才移入正式追蹤日誌**，避免 AI 誤判直接入庫。

| 欄位名稱 | 說明 |
|----------|------|
| `research_id` | 病患研究編號 |
| `raw_message` | 病患 Line 原始訊息 |
| `ai_vas_back` | AI 解讀的 VAS 背痛 |
| `ai_vas_leg` | AI 解讀的 VAS 腿痛 |
| `ai_summary` | AI 生成的狀況摘要 |
| `ai_parsed_at` | 解析時間 |
| `review_status` | `pending / approved / rejected` |
| `reviewed_by` | 確認者帳號 |
| `reviewed_at` | 確認時間 |

---

### 分頁 5：【推播排程 Log】

> 追蹤每次推播狀態，防止重複推播，並記錄失敗原因。

| 欄位名稱 | 說明 |
|----------|------|
| `research_id` | 病患研究編號 |
| `scheduled_day` | 計畫推播天數（如 `7`） |
| `scheduled_date` | 計畫推播日期 |
| `sent_at` | 實際發送時間 |
| `status` | `sent / failed / skipped` |
| `skip_reason` | `holiday / line_blocked / already_sent` |
| `error_message` | 失敗原因（如有） |

---

### 分頁 6：【AI 分析區】

> 點擊「生成分析」按鈕後，GAS 自動統計並填入結果。

| 區塊 | 內容 |
|------|------|
| 耗材效益比較 | 各 Cage 規格 vs VAS 改善率（含樣本數警示） |
| 手術方式比較 | TLIF vs Endoscopic 術後恢復趨勢 |
| 追蹤完整度 | 各病患應填 vs 實填次數、完整度 % |
| 缺失警示 | 完整度 < 50% 標紅，50-79% 標黃 |
| 匯出功能 | 一鍵匯出 SPSS/STATA 相容 CSV（僅含 `confirmed=TRUE` 數據） |

> ⚠️ **樣本數警示規則**：任一比較組 n < 15 時，自動顯示「樣本量不足（n=X），結論僅供參考，請勿用於正式發表。」

---

## 3. 自動化追蹤邏輯

### 追蹤頻率排程

| 術後期間 | 推播頻率 | 推播天數 |
|----------|----------|----------|
| 第 1 週 | 兩天一次 | 第 1, 3, 5, 7 天 |
| 第 2 週 | 三天一次 | 第 10, 13 天 |
| 第 3 週 | 四天一次 | 第 17, 21 天 |
| 第 4 週起 | 每週一次 | 第 28, 35, 42… 天 |

### GAS 推播排程器邏輯

```javascript
// 每天 08:00 觸發
function dailyPushScheduler() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('手術記錄表');
  const logSheet = SpreadsheetApp.getActive().getSheetByName('推播排程Log');
  const today = new Date();

  const patients = sheet.getDataRange().getValues();

  patients.forEach(row => {
    const researchId  = row[COL.RESEARCH_ID];
    const opDate      = new Date(row[COL.OP_DATE]);
    const lineStatus  = row[COL.LINE_STATUS];  // active / blocked / unbound
    const daysPostOp  = Math.floor((today - opDate) / 86400000);

    // 防呆：未綁定或封鎖則跳過
    if (lineStatus !== 'active') {
      appendLog(logSheet, researchId, daysPostOp, 'skipped', lineStatus);
      return;
    }

    // 判斷今天是否為推播日
    if (!isScheduledDay(daysPostOp)) return;

    // 防重複：確認今天是否已推播過
    if (alreadySentToday(logSheet, researchId, today)) {
      appendLog(logSheet, researchId, daysPostOp, 'skipped', 'already_sent');
      return;
    }

    // 個人化訊息（帶入上次數據）
    const lastRecord = getLastRecord(researchId);
    const message = buildMessage(researchId, daysPostOp, lastRecord);

    // 發送 Line 推播
    const success = sendLineMessage(researchId, message);
    appendLog(logSheet, researchId, daysPostOp, success ? 'sent' : 'failed', '');
  });
}

function isScheduledDay(days) {
  const schedule = [1,3,5,7,10,13,17,21,28,35,42,49,56,63,70,77,84];
  return schedule.includes(days);
}
```

### 個人化推播訊息範例

```
哲瑋先生您好，今天是術後第 7 天 🌿

上次您提到腰部還有些緊繃（VAS 3），
今天感覺如何呢？

請直接用說的告訴我，例如：
「腳不痛了，腰還有點緊」

或直接回覆數字：
背痛 ___ 分 / 腿痛 ___ 分（0-10）
```

---

## 4. 三端輸入方式

### 醫護端

| 階段 | 工具 | 說明 |
|------|------|------|
| 第一階段（MVP） | Google Forms | 零學習成本，手術後護理師平板填寫，直接入庫 |
| 第二階段（升級） | AppSheet | 將 Sheets 轉為有按鈕的手機 App 介面 |

**Google Forms 設計重點：**
- Cage 規格、手術方式 → 全部使用下拉選單（來源：耗材代碼表）
- 必填欄位設定：`research_id`、`op_date`、`op_name`、`cage_code`
- 提交後自動寫入【手術記錄表】

### 病患端（Line Bot）

```
病患在 Line 說話
    ↓
GAS Webhook 接收原始訊息
    ↓
Gemini API 解析 → VAS 數值 + 狀況摘要
    ↓
寫入【AI 暫存待確認區】（record_type: ai_parsed）
    ↓
Line 回覆病患：「感謝您的回覆！已記錄，
              醫療團隊會定期查看您的狀況。」
    ↓
醫護在 Sheets 確認暫存區 → 點擊 [核准] / [拒絕]
    ↓
核准後自動移入【術後追蹤日誌】（confirmed: TRUE）
```

### 醫護確認介面

- 使用 Sheets **Filter View** 篩選 `review_status = pending`
- 每列右側加入「核准 ✅」「拒絕 ❌」按鈕（GAS onEdit 觸發）
- 目標：醫護每日花 3-5 分鐘完成當日確認

---

## 5. AI 分析與統計回饋

### 週報自動分析（每週一 09:00 觸發）

```
GAS 讀取【術後追蹤日誌】（僅 confirmed=TRUE）
    ↓
依 cage_code 分組，計算各時間點平均 VAS
    ↓
偵測樣本數：n < 15 → 加入警示標記
    ↓
呼叫 Gemini API 生成文字摘要
    ↓
寫入【AI 分析區】並發送摘要 Email 給主責醫師
```

### 回饋範例

```
哲瑋醫師，本週數據摘要（2026/04/06 - 2026/04/12）

【耗材比較】
使用 TLIF Cage 10mm（n=18）的病患，術後第 14 天
平均 VAS 下降 4.2 分；使用 8mm（n=12）組下降 3.1 分。
差異有統計趨勢，建議持續觀察（樣本量仍需擴大）。

【追蹤完整度】
本週應填 23 人次，實際填寫 19 人次（完整度 83%）✅
2 名病患連續 3 次未回覆，已標記待聯絡。

【匯出】點擊下方按鈕可下載本月 CSV（SPSS 相容格式）
```

---

## 6. 資安與合規設計

### 個資保護架構

```
公開研究數據（Sheets）         敏感對照資料（Drive）
─────────────────────         ─────────────────────
research_id: SP-2026-001  ←→  姓名：王○○
                               身分證末四碼：XXXX
                               Line UID：Uxxxxxxx
                               （僅限特定 Google 帳號存取）
```

### 存取控制

| 角色 | 可存取分頁 | 權限 |
|------|-----------|------|
| 主責醫師 | 全部 | 讀寫 |
| 護理師 / RA | 手術記錄、追蹤日誌、暫存確認區 | 讀寫 |
| 研究助理 | AI 分析區、追蹤日誌（唯讀） | 唯讀 |
| GAS 服務帳號 | 全部（程式執行用） | 讀寫 |

### 其他合規措施

- Sheets 啟用「版本紀錄」（Google 原生功能），任何修改均可回溯
- Line UID 不存入 Sheets，只存於 Drive 對照表
- GAS 執行 log 保留 90 天

---

## 7. 數據品質保障機制

| 風險 | 機制 |
|------|------|
| AI 語意誤判 | 暫存待確認區 + 醫護每日 review |
| 積分/打卡濫用 | 每日限回覆一次（GAS 防重複） |
| GAS 逾時失敗 | 分批處理 + 失敗時 Email 通知管理者 |
| 統計誤導 | n < 15 自動顯示樣本不足警示 |
| 數據被覆蓋 | Append-only 日誌，`record_type` 標記溯源 |
| 重複推播 | `last_sent_date` + `推播排程Log` 雙重防呆 |
| 假日推播 | 可設定節假日清單，GAS 自動跳過 |

---

## 8. 實施步驟

| 步驟 | 內容 | 工具 | 預估時間 |
|------|------|------|----------|
| 1 | 確認耗材清單，建立耗材代碼表 | Sheets | 0.5 天 |
| 2 | 建立六個分頁結構與欄位 | Sheets | 0.5 天 |
| 3 | 建立 Google Forms（含下拉選單） | Forms | 0.5 天 |
| 4 | GAS：推播排程器（含防呆 log） | GAS | 2 天 |
| 5 | Line Bot Webhook + Gemini 串接 | GAS + Gemini API | 2 天 |
| 6 | 暫存區確認按鈕介面 | GAS | 1 天 |
| 7 | AI 分析區 + 匯出 CSV 按鈕 | GAS + Gemini API | 1 天 |
| 8 | 測試與上線 | — | 1 天 |

**預估總工時：約 8-9 個工作天可完成 MVP**

---

## 9. 技術架構總覽

```
┌─────────────────────────────────────────────────────────┐
│                   Google Sheets（核心資料庫）             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │耗材代碼表 │ │手術記錄表│ │術後追蹤  │ │AI暫存     │  │
│  │（下拉源） │ │（基準線）│ │日誌      │ │待確認區   │  │
│  └──────────┘ └──────────┘ │Append    │ └───────────┘  │
│  ┌──────────┐ ┌──────────┐ │only      │                 │
│  │推播排程  │ │AI 分析區 │ └──────────┘                 │
│  │Log       │ │(+CSV匯出)│                              │
│  └──────────┘ └──────────┘                              │
└─────────────────────────────────────────────────────────┘
         ↑ 讀寫              ↑ 分析觸發
┌────────────────┐    ┌──────────────────┐
│ Google Forms   │    │ GAS 自動化引擎    │
│ （醫護端輸入） │    │ ├ 每日推播排程器 │
└────────────────┘    │ ├ Line Webhook   │
                      │ ├ 週報分析觸發器 │
┌────────────────┐    │ └ 失敗 Email通知 │
│ Line Bot       │    └──────────────────┘
│ （病患端回覆） │           ↓
└────────────────┘    ┌──────────────────┐
         ↕            │  Gemini API      │
         └──────────→ │  語意解析 + 回饋 │
                      └──────────────────┘

個資保護層（Google Drive，獨立權限控管）
└── research_id ↔ 姓名 / Line UID 對照表
```

---

## 升級路徑

```
現在（Lite 版）          →  未來（V4 完整版）
─────────────────────       ──────────────────────
Google Sheets            →  Firebase Firestore
Google Forms             →  Vue PWA 介面
GAS 排程器               →  Spring Boot 後端
AppSheet（第二階段）     →  原生 App
Line Bot 文字回覆        →  積分遊戲化 + 恢復進度視覺化
手動 CSV 匯出            →  自動週報儀表板
```

> Lite 版與 V4 版的欄位命名保持一致，確保未來數據可直接遷移，無需重新清洗。

---

*文件由 Claude AI 協助整合生成，內容需由主責開發者確認後執行。*
