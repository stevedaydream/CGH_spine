// ============================================================
// WebApp.gs — GAS HTML Service 路由與伺服器端資料函式
// doGet 提供醫護後台與分析儀表板兩個頁面
// ============================================================

/**
 * Web App 路由
 * ?page=dashboard  → 醫護後台（預設）
 * ?page=analytics  → 分析儀表板
 */
function doGet(e) {
  // Vue app REST API 路由：有 action 參數時回傳 JSON
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest_(e);
  }

  var page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'dashboard';
  var template;

  if (page === 'analytics') {
    template = HtmlService.createTemplateFromFile('analytics');
    return template.evaluate()
      .setTitle('AI 分析儀表板 — 脊椎追蹤系統')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  template = HtmlService.createTemplateFromFile('dashboard');
  return template.evaluate()
    .setTitle('醫護後台 — 脊椎追蹤系統')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ────────────────────────────────────────────
// 醫護後台資料函式
// ────────────────────────────────────────────

/**
 * 取得 AI 暫存待確認區的 pending 記錄
 * @returns {Array<Object>}
 */
function getPendingRecords() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.AI_STAGING);
  var data  = sheet.getDataRange().getValues();
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[STAGE_COL.RESEARCH_ID]) continue;
    if (row[STAGE_COL.REVIEW_STATUS] !== 'pending') continue;
    result.push({
      rowIndex:     i + 1,
      researchId:   row[STAGE_COL.RESEARCH_ID],
      rawMessage:   row[STAGE_COL.RAW_MESSAGE],
      aiVasBack:    row[STAGE_COL.AI_VAS_BACK],
      aiVasLeg:     row[STAGE_COL.AI_VAS_LEG],
      aiSummary:    row[STAGE_COL.AI_SUMMARY],
      aiParsedAt:   row[STAGE_COL.AI_PARSED_AT]
    });
  }
  return result;
}

/**
 * 取得病患列表與追蹤狀態
 * @returns {Array<Object>}
 */
function getPatientList() {
  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var opSheet   = ss.getSheetByName(SHEET.OPERATION);
  var logSheet  = ss.getSheetByName(SHEET.FOLLOW_UP);

  var opData  = opSheet.getDataRange().getValues().slice(1);
  var logData = logSheet.getDataRange().getValues().slice(1);

  // 統計每位病患已確認的記錄數
  var logCount = {};
  var lastVas  = {};
  logData.forEach(function(row) {
    if (row[LOG_COL.CONFIRMED] !== true) return;
    var id = row[LOG_COL.RESEARCH_ID];
    logCount[id] = (logCount[id] || 0) + 1;
    // 記錄最後一筆 VAS
    if (!lastVas[id] || new Date(row[LOG_COL.LOG_DATETIME]) > new Date(lastVas[id].dt)) {
      lastVas[id] = {
        vasBack:    row[LOG_COL.VAS_BACK],
        vasLeg:     row[LOG_COL.VAS_LEG],
        daysPostOp: row[LOG_COL.DAYS_POST_OP],
        dt:         row[LOG_COL.LOG_DATETIME]
      };
    }
  });

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  return opData
    .filter(function(row) { return !!row[OP_COL.RESEARCH_ID]; })
    .map(function(row) {
      var id         = row[OP_COL.RESEARCH_ID];
      var opDate     = new Date(row[OP_COL.OP_DATE]);
      var daysPostOp = isNaN(opDate.getTime()) ? '-' : daysDiff_(opDate, today);
      var expected   = typeof daysPostOp === 'number'
        ? PUSH_SCHEDULE_DAYS.filter(function(d) { return d <= daysPostOp; }).length
        : 0;
      var actual  = logCount[id] || 0;
      var pct     = expected > 0 ? Math.round((actual / expected) * 100) : 100;
      var last    = lastVas[id] || null;

      return {
        researchId:   id,
        opDate:       formatDate_(opDate),
        opName:       row[OP_COL.OP_NAME],
        cageCode:     row[OP_COL.CAGE_CODE],
        surgeon:      row[OP_COL.SURGEON],
        daysPostOp:   daysPostOp,
        lineStatus:   row[OP_COL.LINE_STATUS],
        expected:     expected,
        actual:       actual,
        pct:          pct,
        lastVasBack:  last ? last.vasBack  : '-',
        lastVasLeg:   last ? last.vasLeg   : '-',
        lastDays:     last ? last.daysPostOp : '-'
      };
    });
}

/**
 * 取得分析儀表板資料
 * @returns {Object} { cageStats, opStats, completeness, summary }
 */
function getAnalyticsData() {
  try {
  var ss         = SpreadsheetApp.getActiveSpreadsheet();
  var followUp   = ss.getSheetByName(SHEET.FOLLOW_UP);
  var opSheet    = ss.getSheetByName(SHEET.OPERATION);
  if (!followUp || !opSheet) return { summary:{totalPatients:0,activePatients:0,avgCompleteness:0,pendingReview:0}, cageStats:[], opStats:[], completeness:[] };
  var opData     = opSheet.getDataRange().getValues().slice(1);
  var confirmedLogs = _getConfirmedLogs(followUp);

  var cageStats    = _calcCageStats(confirmedLogs, opData);
  var opStats      = _calcOpNameStats(confirmedLogs, opData);
  var completeness = _calcCompleteness(opData, confirmedLogs);

  // 整體摘要數字
  var totalPatients = opData.filter(function(r) { return !!r[OP_COL.RESEARCH_ID]; }).length;
  var activePatients = opData.filter(function(r) {
    return r[OP_COL.LINE_STATUS] === 'active';
  }).length;
  var avgPct = completeness.length > 0
    ? Math.round(completeness.reduce(function(s, r) { return s + r.pct; }, 0) / completeness.length)
    : 0;
  var pending = getPendingRecords().length;

  return {
    summary: {
      totalPatients:  totalPatients,
      activePatients: activePatients,
      avgCompleteness: avgPct,
      pendingReview:  pending
    },
    cageStats:    cageStats,
    opStats:      opStats,
    completeness: completeness
  };
  } catch(e) {
    Logger.log('[getAnalyticsData] ' + e.message);
    return { summary:{totalPatients:0,activePatients:0,avgCompleteness:0,pendingReview:0}, cageStats:[], opStats:[], completeness:[] };
  }
}

// ────────────────────────────────────────────
// 核准 / 拒絕（由前端呼叫）
// ────────────────────────────────────────────

/**
 * 醫護後台一次取得所有資料（減少 round-trip）
 */
function getDashboardData() {
  try {
    var analytics = getAnalyticsData();
    return {
      summary:  analytics.summary,
      pending:  getPendingRecords(),
      patients: getPatientList()
    };
  } catch(e) {
    Logger.log('[getDashboardData] ' + e.message);
    return {
      summary:  { totalPatients:0, activePatients:0, avgCompleteness:0, pendingReview:0 },
      pending:  [],
      patients: []
    };
  }
}

/**
 * 核准單筆 AI 暫存記錄
 * @param {number} rowIndex  1-based Sheet row
 */
function approveRecordByRow(rowIndex) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.AI_STAGING);
  sheet.getRange(rowIndex, STAGE_COL.REVIEW_STATUS + 1).setValue('approved');
  _approveRecord(sheet, rowIndex);
  return { success: true };
}

/**
 * 拒絕單筆 AI 暫存記錄
 * @param {number} rowIndex
 */
function rejectRecordByRow(rowIndex) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.AI_STAGING);
  sheet.getRange(rowIndex, STAGE_COL.REVIEW_STATUS + 1).setValue('rejected');
  _rejectRecord(sheet, rowIndex);
  return { success: true };
}
