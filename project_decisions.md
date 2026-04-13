# 技術決策紀錄（ADR）

> 記錄重要的架構與技術決策，避免重複討論已決定的方案。
> 格式：背景 → 決策 → 理由 → 否決方案

---

## ADR-001：後端選用 Google Apps Script，而非 Python/Render

**背景**：需要一個後端來處理 LINE Bot webhook、Gemini API 呼叫、Sheets 讀寫，以及定期推播排程。

**決策**：使用 Google Apps Script（GAS）作為後端，部署為 Web App。

**理由**：
- GAS 與 Google Sheets 原生整合，不需 Service Account 憑證管理
- 免費，無 cold start 問題（相較 Render 免費方案）
- GAS Trigger 原生支援定時排程（每日推播、週報）
- clasp 工具支援本地開發 + 一鍵部署

**否決方案**：Python Flask on Render — 需要 Service Account JSON 管理、Render 免費方案有 cold start 延遲、部署複雜度較高。

---

## ADR-002：前端選用 Vue 3 + Cloudflare Pages

**背景**：需要醫護端操作介面，包含 AI 確認、病患列表、分析儀表板、填表功能。

**決策**：Vue 3（Composition API）+ Vite，部署至 Cloudflare Pages。

**理由**：
- Cloudflare Pages 免費、全球 CDN、無 cold start
- Vue 3 Composition API 適合複雜狀態管理
- 可直接呼叫 GAS Web App REST API
- Chart.js 整合簡單，滿足圖表需求

**否決方案**：Google AppSheet — 客製化程度低，無法實作自訂 UI 與 Chart.js 圖表。

---

## ADR-003：術後追蹤日誌採用長表格（Append-only）

**背景**：病患每次回報產生一筆記錄，討論過寬表格（每人一列，時間點橫向展開）。

**決策**：**目前維持長表格**（Append-only），每次回報一列。

**理由**：
- 現有 GAS 程式碼與 Vue 均基於長表格設計，已上線運作
- Append-only 確保完整稽核軌跡
- 寬表格有利 MCID 計算，但需大幅重構現有程式碼

**否決方案**：立即改寬表格 — 遷移成本高，需同步修改 Config.gs、FormHandler.gs、Vue FormView，風險高。

**待決策**：MCID 統計功能實作時，評估是否遷移或以 VIEW 方式在 GAS 轉換格式供統計使用。

---

## ADR-004：LINE Bot 採用 GAS doPost Webhook

**背景**：需要接收病患 LINE 訊息並解析。

**決策**：GAS Web App 的 `doPost` 函式直接作為 LINE Webhook URL。

**理由**：
- 無需另起伺服器
- GAS Web App URL 為 HTTPS，符合 LINE Webhook 要求
- 與 Sheets 整合零成本

**否決方案**：Render 上的 Python Flask Webhook — 有 cold start 問題，LINE 推播 timeout 可能失敗（LINE 要求 1 秒內回應）。

---

## ADR-005：個資保護採用雙表分離架構

**背景**：需同時保護病患隱私與支援研究數據分析。

**決策**：研究數據（Sheets）只存 `research_id`，姓名與 LINE UID 存於獨立 Google Drive 檔案（`PRIVACY_TABLE_ID`）。

**理由**：
- 符合研究倫理委員會要求
- Sheets 即使外洩也無法對應到真實身份
- LINE UID 僅 GAS 程式運作時在記憶體中短暫使用
