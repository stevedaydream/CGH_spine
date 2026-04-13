# API 合約與介面備忘

---

## 外部 API

### LINE Messaging API
- **Webhook**：GAS Web App URL（doPost）
- **推播**：`https://api.line.me/v2/bot/message/push`
- **Token**：Script Properties `LINE_CHANNEL_ACCESS_TOKEN`
- **Channel Secret**：Script Properties `LINE_CHANNEL_SECRET`（驗簽用）

### Gemini API
- **端點**：`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`
- **Key**：Script Properties `GEMINI_API_KEY`
- **用途**：病患自由文字 → 解析 VAS 數值 + 生成摘要

---

## 內部介面：GAS Web App REST API

> Vue 前端透過 `vue-app/src/api/gas.js` 呼叫，所有請求為 GET + `action` 參數（受 GAS 限制）。

### GET actions

| action | 參數 | 回傳結構 | 對應 View |
|--------|------|---------|---------|
| `getDashboardData` | 無 | `{ summary, pending[], patients[] }` | DashboardView |
| `getAnalyticsData` | 無 | `{ summary, cageStats[], opStats[], completeness[] }` | AnalyticsView |
| `getFormOptions` | 無 | `{ patientIds[], cageCodes[], nextId, surgeons[] }` | FormView |
| `addOperationRecord` | 手術記錄欄位 | `{ success: true }` | FormView Tab A |
| `addFollowUpRecord` | 回診記錄欄位 | `{ success: true, daysPostOp }` | FormView Tab B |
| `approveRecord` | `rowIndex` | `{ success: true }` | DashboardView |
| `rejectRecord` | `rowIndex` | `{ success: true }` | DashboardView |
| `exportCsv` | 無 | `{ success: true, fileUrl }` | AnalyticsView |

### 回傳格式（統一）

```json
// 成功
{ "status": "ok", "data": { ... } }

// 失敗
{ "status": "error", "message": "錯誤說明" }
```

---

## 資料格式備忘

### getDashboardData — patients[] 單筆

```json
{
  "researchId": "SP-2026-001",
  "opDate": "2026-03-01",
  "opName": "TLIF",
  "cageCode": "CAGE-TLIF-10",
  "surgeon": "Dr. A",
  "daysPostOp": 44,
  "lineStatus": "active",
  "expected": 9,
  "actual": 7,
  "pct": 78,
  "lastVasBack": 3,
  "lastVasLeg": 2,
  "lastDays": 42
}
```

### getDashboardData — pending[] 單筆

```json
{
  "rowIndex": 5,
  "researchId": "SP-2026-001",
  "rawMessage": "今天腰好很多，腳還有點麻",
  "aiVasBack": 3,
  "aiVasLeg": 4,
  "aiSummary": "腰部改善，腳部麻木持續",
  "aiParsedAt": "2026-04-14 10:23"
}
```

### getAnalyticsData — cageStats[] 單筆

```json
{
  "cage": "CAGE-TLIF-10",
  "n": 18,
  "preVas": 7.2,
  "vas14": 3.1,
  "improvement": "4.1",
  "rate": "56.9%",
  "opName": "TLIF",
  "warning": ""
}
```

### LINE Bot Webhook（doPost）payload

```json
{
  "events": [{
    "type": "message",
    "source": { "userId": "Uxxxxxxxxxx" },
    "message": { "type": "text", "text": "病患訊息內容" }
  }]
}
```

---

## GAS Script Properties 一覽

| Key | 說明 |
|-----|------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Bot 推播用 Token |
| `LINE_CHANNEL_SECRET` | LINE Webhook 驗簽 Secret |
| `GEMINI_API_KEY` | Gemini API 金鑰 |
| `ADMIN_EMAIL` | 系統錯誤通知 Email |
| `DOCTOR_EMAIL` | 週報接收醫師 Email |
| `PRIVACY_TABLE_ID` | 個資對照表 Spreadsheet ID |
