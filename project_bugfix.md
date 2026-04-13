# 除錯紀錄（BF）

> 記錄踩過的坑與解法，避免重蹈覆轍。
> 格式：問題描述 → 嘗試過程 → 根本原因 → 最終解法 → 牽扯檔案

---

## BF-001：Windows batch 呼叫 clasp / npm / wrangler 後閃退不返回選單

**問題描述**
`GAS_push_deploy.bat` 選單選 1（GAS push + deploy）後，視窗立即關閉（閃退），不顯示任何錯誤訊息，也不返回選單。

**嘗試過程**
1. 懷疑 clasp 未安裝或不在 PATH → 但應觸發 errorlevel 錯誤處理，應有 pause
2. 懷疑 `for /f` 日期解析失敗 → 不會造成整個 bat 關閉
3. 確認根本原因後一次修正

**根本原因**
Windows batch 規則：**從 .bat 呼叫另一個 .bat / .cmd 檔案，若不加 `call`，子批次結束後控制權不會返回父批次，父批次直接終止。**

`clasp`、`npm`、`wrangler` 在 Windows 上均為 `.cmd` 檔案（npm 全域安裝產生）。直接寫 `clasp push` 等同於呼叫 `clasp.cmd`，結束後父 bat 跟著結束。

**最終解法**
所有工具呼叫一律加 `call`：
```batch
call clasp push --force
call clasp deploy --deploymentId ...
call npm run build
call wrangler pages deploy ...
```

**牽扯檔案**
- `GAS_push_deploy.bat`：`:GAS_DEPLOY` 區塊的 `clasp push` 與 `clasp deploy` 兩行

**通用規則**
> 在 Windows batch 中，凡是呼叫 `.cmd` 或 `.bat` 工具（包含所有 npm 全域安裝的 CLI），**一律加 `call`**。
