# 部署指南：智慧化脊椎手術追蹤系統（Lite 版）

## 前置需求
- Google 帳號（主責醫師帳號）
- Line Developers 帳號（建立 Messaging API Channel）
- Google AI Studio 帳號（取得 Gemini API Key）

---

## Step 1：建立 Google Spreadsheet

1. 開啟 [Google Sheets](https://sheets.google.com)，建立新試算表
2. 命名為：`脊椎手術追蹤系統`
3. 記錄試算表的 **Spreadsheet ID**（從 URL 取得：`docs.google.com/spreadsheets/d/<ID>/edit`）

---

## Step 2：建立個資對照表（獨立檔案）

1. 另建一份試算表，命名為：`脊椎追蹤_個資對照表（限閱）`
2. 欄位格式：

   | research_id | line_uid    | name | notes |
   |-------------|-------------|------|-------|
   | SP-2026-001 | Uxxxxxxxx   | 王○○ |       |

3. **存取權限設定為只有主責醫師可讀寫**
4. 記錄此檔案的 **Spreadsheet ID**

---

## Step 3：上傳 GAS 程式碼

### 方法 A：使用 clasp（推薦）

```bash
# 安裝 clasp
npm install -g @google/clasp

# 登入 Google 帳號
clasp login

# 在 GAS 建立新專案，複製 scriptId 填入 .clasp.json
clasp create --type sheets --title "脊椎追蹤系統"

# 推送所有程式碼
clasp push
```

### 方法 B：手動複製貼上

1. 開啟試算表 → 擴充功能 → Apps Script
2. 依序建立以下檔案並貼入對應程式碼：
   - `Config.gs`
   - `Utils.gs`
   - `SheetSetup.gs`
   - `DailyScheduler.gs`
   - `GeminiAPI.gs`
   - `LineWebhook.gs`
   - `ReviewHandler.gs`
   - `WeeklyAnalysis.gs`
   - `TriggerSetup.gs`

---

## Step 4：設定 Script Properties

Apps Script → 專案設定 → 指令碼屬性，新增：

| 屬性名稱 | 說明 | 取得方式 |
|---------|------|---------|
| `LINE_CHANNEL_ACCESS_TOKEN` | Line Bot Token | Line Developers Console |
| `GEMINI_API_KEY` | Gemini API Key | [Google AI Studio](https://aistudio.google.com) |
| `ADMIN_EMAIL` | 管理員 Email | 自行填入 |
| `DOCTOR_EMAIL` | 主責醫師 Email | 自行填入 |
| `PRIVACY_TABLE_ID` | 個資對照表 ID | Step 2 取得的 Spreadsheet ID |

---

## Step 5：初始化分頁

1. 回到試算表，重新整理頁面
2. 點擊選單「系統功能 > 初始化分頁結構」
3. 確認六個分頁建立完成

---

## Step 6：填入耗材代碼表

1. 至【耗材代碼表】分頁
2. 填入所有使用的 Cage、Screw 代碼
3. 此表為所有下拉選單的資料來源

---

## Step 7：部署 Line Webhook

1. Apps Script → 部署 → 新增部署
2. 類型選「網頁應用程式」
3. 執行身分：**我**
4. 存取權：**所有人（包含匿名）**
5. 複製部署 URL
6. 至 Line Developers Console → Messaging API → Webhook URL 填入此 URL
7. 啟用「使用 Webhook」

---

## Step 8：安裝觸發器

點擊選單「系統功能 > 安裝自動觸發器」

這會安裝：
- 每天 08:00 推播排程器
- 每週一 09:00 週報分析
- onEdit 醫護確認監聽器

---

## Step 9：測試

1. 在【手術記錄表】新增一筆測試病患（`line_status = active`、`intervention_group = line_bot`）
2. 至個資對照表加入對應的 Line UID
3. 點擊「系統功能 > 立即執行推播排程」測試推播
4. 用 Line 帳號發訊息測試 Webhook 解析
5. 至【AI暫存待確認區】將 `review_status` 改為 `approved`，確認資料移入追蹤日誌

---

## 存取權限設定（Google Sheets）

| 角色 | 建議設定 |
|------|---------|
| 主責醫師 | 編輯者 |
| 護理師 / RA | 編輯者（可用 Filter View 限制） |
| 研究助理 | 檢視者 |

> 個資對照表**僅限主責醫師**，不開放其他人員存取。
