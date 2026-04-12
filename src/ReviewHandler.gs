// ============================================================
// ReviewHandler.gs — 醫護確認介面邏輯
// 監聽 AI暫存待確認區 的 review_status 欄位變更
// ============================================================

/**
 * onEdit 觸發器：監聽【AI暫存待確認區】的 review_status 欄位
 * 當醫護將狀態改為 approved → 自動移入術後追蹤日誌
 * 當醫護將狀態改為 rejected → 標記拒絕，結束流程
 *
 * 安裝方式：TriggerSetup.gs 中的 setupTriggers() 會自動安裝。
 */
function onEditReviewHandler(e) {
  if (!e) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET.AI_STAGING) return;

  var col = e.range.getColumn();
  // 只關心 review_status 欄（STAGE_COL.REVIEW_STATUS 是 0-based，Sheet 是 1-based）
  if (col !== STAGE_COL.REVIEW_STATUS + 1) return;

  var row    = e.range.getRow();
  if (row <= 1) return; // 跳過標頭

  var newStatus = e.range.getValue();

  if (newStatus === 'approved') {
    _approveRecord(sheet, row);
  } else if (newStatus === 'rejected') {
    _rejectRecord(sheet, row);
  }
}

// ---------- 核准：移入術後追蹤日誌 ----------
function _approveRecord(stagingSheet, row) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rowData = stagingSheet.getRange(row, 1, 1, 9).getValues()[0];

  var researchId  = rowData[STAGE_COL.RESEARCH_ID];
  var rawMessage  = rowData[STAGE_COL.RAW_MESSAGE];
  var aiVasBack   = rowData[STAGE_COL.AI_VAS_BACK];
  var aiVasLeg    = rowData[STAGE_COL.AI_VAS_LEG];

  // 取得手術日期以計算術後天數
  var opRecord = getOperationRecord(researchId);
  if (!opRecord) {
    SpreadsheetApp.getUi().alert('找不到對應的手術記錄：' + researchId);
    return;
  }

  var now = new Date();
  var daysPostOp = daysDiff_(opRecord.opDate, now);
  var logId = generateLogId();

  // 寫入術後追蹤日誌
  var followUpSheet = ss.getSheetByName(SHEET.FOLLOW_UP);
  followUpSheet.appendRow([
    logId,
    researchId,
    Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'),
    daysPostOp,
    aiVasBack !== '' ? aiVasBack : '',
    aiVasLeg  !== '' ? aiVasLeg  : '',
    '',           // odi_description（留空，由醫護補填）
    '',           // wound_status
    rawMessage,
    'ai_parsed',  // record_type
    true          // confirmed
  ]);

  // 更新暫存區的確認資訊
  var reviewer = Session.getActiveUser().getEmail();
  var reviewedAt = Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
  stagingSheet.getRange(row, STAGE_COL.REVIEWED_BY + 1).setValue(reviewer);
  stagingSheet.getRange(row, STAGE_COL.REVIEWED_AT + 1).setValue(reviewedAt);

  // 標記該列為已核准的背景色
  stagingSheet.getRange(row, 1, 1, 9).setBackground('#d9ead3'); // 淺綠

  Logger.log('[_approveRecord] 已核准：' + researchId + ' | log_id=' + logId);
}

// ---------- 拒絕：標記不採用 ----------
function _rejectRecord(stagingSheet, row) {
  var reviewer   = Session.getActiveUser().getEmail();
  var reviewedAt = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
  stagingSheet.getRange(row, STAGE_COL.REVIEWED_BY + 1).setValue(reviewer);
  stagingSheet.getRange(row, STAGE_COL.REVIEWED_AT + 1).setValue(reviewedAt);

  // 標記該列為拒絕的背景色
  stagingSheet.getRange(row, 1, 1, 9).setBackground('#fce8b2'); // 淺橘

  var researchId = stagingSheet.getRange(row, STAGE_COL.RESEARCH_ID + 1).getValue();
  Logger.log('[_rejectRecord] 已拒絕：' + researchId + ' | row=' + row);
}

/**
 * 批次核准所有 pending 記錄（供管理員一鍵使用）
 * 菜單觸發：系統功能 > 批次核准所有 Pending
 */
function approveAllPending() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.AI_STAGING);
  var data = sheet.getDataRange().getValues();
  var count = 0;

  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][STAGE_COL.REVIEW_STATUS] === 'pending') {
      sheet.getRange(i + 1, STAGE_COL.REVIEW_STATUS + 1).setValue('approved');
      _approveRecord(sheet, i + 1);
      count++;
    }
  }

  SpreadsheetApp.getUi().alert('✅ 已批次核准 ' + count + ' 筆記錄並移入術後追蹤日誌。');
}

/**
 * 顯示尚未確認的 pending 數量
 */
function showPendingCount() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.AI_STAGING);
  var data = sheet.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    if (data[i][STAGE_COL.REVIEW_STATUS] === 'pending') count++;
  }
  SpreadsheetApp.getUi().alert('目前有 ' + count + ' 筆 AI 解析記錄待確認。');
}
