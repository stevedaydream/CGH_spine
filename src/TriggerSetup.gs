// ============================================================
// TriggerSetup.gs — 安裝 / 刪除 GAS 時間觸發器
// 執行 setupTriggers() 一次即可完成所有觸發器安裝
// ============================================================

/**
 * 安裝所有自動觸發器：
 *  1. 每天 08:00 → dailyPushScheduler
 *  2. 每週一 09:00 → weeklyAnalysis
 *  3. onEdit → onEditReviewHandler（監聽暫存確認區）
 */
function setupTriggers() {
  // 先清除舊觸發器，避免重複
  deleteAllTriggers();

  var ss = SpreadsheetApp.getActive();

  // 每日推播排程：08:00 - 09:00 之間執行
  ScriptApp.newTrigger('dailyPushScheduler')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  // 週報分析：每週一 09:00 - 10:00 之間執行
  ScriptApp.newTrigger('weeklyAnalysis')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();

  // onEdit 觸發器（監聽 AI 暫存待確認區）
  ScriptApp.newTrigger('onEditReviewHandler')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert(
    '✅ 觸發器安裝完成！\n\n' +
    '已安裝：\n' +
    '・每天 08:00 推播排程器\n' +
    '・每週一 09:00 週報分析\n' +
    '・onEdit 醫護確認監聽器\n\n' +
    '可至「擴充功能 > Apps Script > 觸發器」查看。'
  );
}

/**
 * 刪除此 Spreadsheet 所有觸發器
 */
function deleteAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });
  Logger.log('[deleteAllTriggers] 已刪除 ' + triggers.length + ' 個觸發器');
}

/**
 * 顯示目前所有觸發器清單
 */
function listTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  if (triggers.length === 0) {
    SpreadsheetApp.getUi().alert('目前沒有任何觸發器。\n請執行「安裝自動觸發器」。');
    return;
  }
  var msg = '目前觸發器清單：\n\n';
  triggers.forEach(function(t) {
    msg += '・' + t.getHandlerFunction() + '（' + t.getEventType() + '）\n';
  });
  SpreadsheetApp.getUi().alert(msg);
}

/**
 * 設定 Script Properties（指引用）
 * 實際填入請至：擴充功能 > Apps Script > 專案設定 > 指令碼屬性
 */
function showPropertySetupGuide() {
  var guide =
    '請至「擴充功能 > Apps Script > 專案設定 > 指令碼屬性」\n' +
    '新增以下屬性：\n\n' +
    'LINE_CHANNEL_ACCESS_TOKEN\n  → Line Bot Channel Access Token\n\n' +
    'GEMINI_API_KEY\n  → Google AI Studio API Key\n\n' +
    'ADMIN_EMAIL\n  → 接收錯誤通知的管理員 Email\n\n' +
    'DOCTOR_EMAIL\n  → 接收週報的主責醫師 Email\n\n' +
    'PRIVACY_TABLE_ID\n  → 個資對照表 Spreadsheet ID\n  （格式：1ABC...XYZ，從 Drive URL 取得）';

  SpreadsheetApp.getUi().alert('系統設定指引', guide, SpreadsheetApp.getUi().ButtonSet.OK);
}
