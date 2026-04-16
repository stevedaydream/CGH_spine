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

  var today      = new Date();
  today.setHours(0, 0, 0, 0);
  var privacyMap = _getPrivacyMap_();

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
        chartNumber:  (privacyMap[id] && privacyMap[id].chartNumber) || '',
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
 * 從個資對照表建立 research_id → { lineUid, chartNumber } 查詢 Map
 * 若 PRIVACY_TABLE_ID 未設定則回傳空物件
 */
function _getPrivacyMap_() {
  var privacySheetId = getConfig_('PRIVACY_TABLE_ID');
  if (!privacySheetId) return {};
  try {
    var data = SpreadsheetApp.openById(privacySheetId).getSheets()[0].getDataRange().getValues();
    var map  = {};
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      var id = String(r[PRIVACY_COL.RESEARCH_ID]);
      if (!id) continue;
      map[id] = {
        lineUid:     String(r[PRIVACY_COL.LINE_UID]     || ''),
        chartNumber: String(r[PRIVACY_COL.CHART_NUMBER] || '')
      };
    }
    return map;
  } catch (e) {
    Logger.log('[_getPrivacyMap_] ' + e.message);
    return {};
  }
}

// ────────────────────────────────────────────
// 衛教 QA 管理函式
// ────────────────────────────────────────────

/** 取得所有衛教 QA 條目（含停用） */
function getHealthEdu_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.HEALTH_EDU);
  if (!sheet || sheet.getLastRow() < 2) return { items: [] };

  var items = sheet.getDataRange().getValues().slice(1)
    .filter(function(r) { return !!r[HEALTH_EDU_COL.ID]; })
    .map(function(r) {
      return {
        id:           String(r[HEALTH_EDU_COL.ID]),
        category:     String(r[HEALTH_EDU_COL.CATEGORY]     || ''),
        question:     String(r[HEALTH_EDU_COL.QUESTION]     || ''),
        answer:       String(r[HEALTH_EDU_COL.ANSWER]        || ''),
        videoUrl:     String(r[HEALTH_EDU_COL.VIDEO_URL]    || ''),
        active:       r[HEALTH_EDU_COL.ACTIVE] === true,
        displayOrder: Number(r[HEALTH_EDU_COL.DISPLAY_ORDER] || 0),
        daysFrom:     r[HEALTH_EDU_COL.DAYS_FROM] !== '' ? Number(r[HEALTH_EDU_COL.DAYS_FROM]) : '',
        daysTo:       r[HEALTH_EDU_COL.DAYS_TO]   !== '' ? Number(r[HEALTH_EDU_COL.DAYS_TO])   : '',
        pdfUrl:       String(r[HEALTH_EDU_COL.PDF_URL]      || '')
      };
    });
  return { items: items };
}

/**
 * 新增或更新衛教 QA 條目
 * 有 id → 更新；無 id → 新增
 */
function saveHealthEdu_(p) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.HEALTH_EDU);
  if (!sheet) throw new Error('找不到衛教QA表，請先執行初始化');

  var row = [
    p.id || '',
    p.category     || '',
    p.question     || '',
    p.answer       || '',
    p.videoUrl     || '',
    p.active !== false,
    Number(p.displayOrder) || 0,
    p.daysFrom !== '' && p.daysFrom != null ? Number(p.daysFrom) : '',
    p.daysTo   !== '' && p.daysTo   != null ? Number(p.daysTo)   : '',
    p.pdfUrl       || ''
  ];

  if (p.id) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][HEALTH_EDU_COL.ID]) === String(p.id)) {
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        return { success: true };
      }
    }
    throw new Error('找不到 id：' + p.id);
  }

  var newId = 'QA-' + Date.now();
  row[HEALTH_EDU_COL.ID] = newId;
  sheet.appendRow(row);
  return { success: true, id: newId };
}

/** 刪除指定 QA 條目 */
function deleteHealthEdu_(id) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.HEALTH_EDU);
  if (!sheet) throw new Error('找不到衛教QA表');
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][HEALTH_EDU_COL.ID]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  throw new Error('找不到 id：' + id);
}

// ────────────────────────────────────────
// LINE Bot 回覆設定管理函式
// ────────────────────────────────────────

/** 取得所有 LINE Bot 回覆設定 */
function getLineReply_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.LINE_REPLY);
  if (!sheet || sheet.getLastRow() < 2) return { items: [] };

  var items = sheet.getDataRange().getValues().slice(1)
    .filter(function(r) { return !!r[LINE_REPLY_COL.ID]; })
    .map(function(r) {
      return {
        id:       String(r[LINE_REPLY_COL.ID]),
        group:    String(r[LINE_REPLY_COL.GROUP]    || ''),
        key:      String(r[LINE_REPLY_COL.KEY]      || ''),
        triggers: String(r[LINE_REPLY_COL.TRIGGERS] || ''),
        content:  String(r[LINE_REPLY_COL.CONTENT]  || ''),
        active:   r[LINE_REPLY_COL.ACTIVE] === true,
        note:     String(r[LINE_REPLY_COL.NOTE]     || '')
      };
    });
  return { items: items };
}

/**
 * 更新回覆設定（content / triggers / active）
 * 有 id → 更新；無 id → 新增（僅自訂關鍵字）
 */
function saveLineReply_(p) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.LINE_REPLY);
  if (!sheet) throw new Error('找不到 LINE Bot 回覆設定表，請先執行初始化');

  if (p.id) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][LINE_REPLY_COL.ID]) === String(p.id)) {
        sheet.getRange(i + 1, LINE_REPLY_COL.TRIGGERS + 1).setValue(p.triggers || '');
        sheet.getRange(i + 1, LINE_REPLY_COL.CONTENT  + 1).setValue(p.content  || '');
        sheet.getRange(i + 1, LINE_REPLY_COL.ACTIVE   + 1).setValue(p.active !== false);
        return { success: true };
      }
    }
    throw new Error('找不到 id：' + p.id);
  }

  // 新增自訂關鍵字
  var newId = 'KW-' + Date.now();
  var row = ['', '', '', '', '', true, ''];
  row[LINE_REPLY_COL.ID]       = newId;
  row[LINE_REPLY_COL.GROUP]    = '自訂關鍵字';
  row[LINE_REPLY_COL.KEY]      = '';
  row[LINE_REPLY_COL.TRIGGERS] = p.triggers || '';
  row[LINE_REPLY_COL.CONTENT]  = p.content  || '';
  row[LINE_REPLY_COL.ACTIVE]   = p.active !== false;
  row[LINE_REPLY_COL.NOTE]     = p.note || '';
  sheet.appendRow(row);
  return { success: true, id: newId };
}

/** 刪除指定回覆設定（僅自訂關鍵字可刪）*/
function deleteLineReply_(id) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.LINE_REPLY);
  if (!sheet) throw new Error('找不到 LINE Bot 回覆設定表');
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][LINE_REPLY_COL.ID]) === String(id)) {
      if (String(data[i][LINE_REPLY_COL.GROUP]) !== '自訂關鍵字') {
        throw new Error('系統訊息與問卷步驟不可刪除，請使用「停用」代替');
      }
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  throw new Error('找不到 id：' + id);
}

/**
 * 更新指定病患的病歷號（寫入個資對照表）
 * @param {string} researchId
 * @param {string} chartNumber
 */
function updateChartNumber_(researchId, chartNumber) {
  if (!researchId) throw new Error('researchId 必填');
  var privacySheetId = getConfig_('PRIVACY_TABLE_ID');
  if (!privacySheetId) throw new Error('未設定 PRIVACY_TABLE_ID');

  var sheet = SpreadsheetApp.openById(privacySheetId).getSheets()[0];
  var data  = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][PRIVACY_COL.RESEARCH_ID]) === String(researchId)) {
      sheet.getRange(i + 1, PRIVACY_COL.CHART_NUMBER + 1).setValue(chartNumber);
      return { success: true };
    }
  }
  // 若個資表尚無此 research_id，新建一列（line_uid 留空）
  sheet.appendRow([researchId, '', chartNumber]);
  return { success: true };
}

/**
 * 匯出資料（供 ExportView 使用）
 * params: researchId（空=全部）, days（逗號分隔天數，空=全部）,
 *         fields（vas/odi/odiDetail/pass）逗號分隔
 */
function getExportData_(params) {
  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var opSheet   = ss.getSheetByName(SHEET.OPERATION);
  var logSheet  = ss.getSheetByName(SHEET.FOLLOW_UP);
  var odiSheet  = ss.getSheetByName(SHEET.ODI_DETAIL);

  // ── 篩選條件 ──
  var filterId   = params.researchId || '';
  var filterDays = params.days ? params.days.split(',').map(Number) : [];
  var fields     = params.fields ? params.fields.split(',') : ['vas','odi','odiDetail','pass'];
  var wantVas       = fields.indexOf('vas')       !== -1;
  var wantOdi       = fields.indexOf('odi')       !== -1;
  var wantOdiDetail = fields.indexOf('odiDetail') !== -1;
  var wantPass      = fields.indexOf('pass')      !== -1;

  // ── 個資對照表（research_id → chart_number）──
  var privacyMap = _getPrivacyMap_();

  // ── 術前基線資料 ──
  var opMap = {};
  opSheet.getDataRange().getValues().slice(1).forEach(function(r) {
    if (!r[OP_COL.RESEARCH_ID]) return;
    opMap[String(r[OP_COL.RESEARCH_ID])] = {
      opDate:     formatDate_(new Date(r[OP_COL.OP_DATE])),
      opName:     r[OP_COL.OP_NAME],
      surgeon:    r[OP_COL.SURGEON],
      preVasBack: r[OP_COL.PRE_VAS_BACK],
      preVasLeg:  r[OP_COL.PRE_VAS_LEG],
      preOdi:     r[OP_COL.PRE_ODI]
    };
  });

  // ── ODI 明細查詢表 ──
  var odiMap = {};
  if (odiSheet && wantOdiDetail) {
    odiSheet.getDataRange().getValues().slice(1).forEach(function(r) {
      var lid = String(r[ODI_COL.LOG_ID]);
      if (!lid) return;
      odiMap[lid] = [
        r[ODI_COL.Q1], r[ODI_COL.Q2], r[ODI_COL.Q3], r[ODI_COL.Q4], r[ODI_COL.Q5],
        r[ODI_COL.Q6], r[ODI_COL.Q7], r[ODI_COL.Q8], r[ODI_COL.Q9], r[ODI_COL.Q10]
      ];
    });
  }

  // ── 組合資料列 ──
  var rows = [];
  logSheet.getDataRange().getValues().slice(1).forEach(function(r) {
    if (r[LOG_COL.CONFIRMED] !== true) return;
    var id = String(r[LOG_COL.RESEARCH_ID]);
    if (filterId && id !== filterId) return;
    var days = Number(r[LOG_COL.DAYS_POST_OP]);
    if (filterDays.length > 0 && filterDays.indexOf(days) === -1) return;

    var op  = opMap[id] || {};
    var lid = String(r[LOG_COL.LOG_ID]);
    var odi = odiMap[lid] || null;

    var row = {
      research_id:  id,
      chart_number: (privacyMap[id] && privacyMap[id].chartNumber) || '',
      op_date:      op.opDate    || '',
      op_name:      op.opName    || '',
      surgeon:      op.surgeon   || '',
      log_datetime: String(r[LOG_COL.LOG_DATETIME]).slice(0, 10),
      days_post_op: days,
      record_type:  r[LOG_COL.RECORD_TYPE]
    };

    if (wantVas) {
      row.pre_vas_back = op.preVasBack !== undefined ? op.preVasBack : '';
      row.pre_vas_leg  = op.preVasLeg  !== undefined ? op.preVasLeg  : '';
      row.vas_back     = r[LOG_COL.VAS_BACK];
      row.vas_leg      = r[LOG_COL.VAS_LEG];
    }
    if (wantOdi) {
      row.pre_odi   = op.preOdi !== undefined ? op.preOdi : '';
      row.odi_score = r[LOG_COL.ODI_SCORE];
    }
    if (wantOdiDetail) {
      for (var q = 1; q <= 10; q++) {
        row['odi_q' + q] = odi ? odi[q - 1] : '';
      }
    }
    if (wantPass) {
      row.pass     = r[LOG_COL.PASS];
      row.anchor_q = r[LOG_COL.ANCHOR_Q];
    }

    rows.push(row);
  });

  rows.sort(function(a, b) {
    return a.research_id < b.research_id ? -1 : a.research_id > b.research_id ? 1
         : Number(a.days_post_op) - Number(b.days_post_op);
  });

  return { rows: rows, total: rows.length };
}

/**
 * 取得單一病患完整追蹤詳情（供 Dashboard 詳情 Modal 使用）
 * @param {string} researchId
 * @returns {Object} { patient, records }
 */
function getPatientDetail_(researchId) {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var opSheet  = ss.getSheetByName(SHEET.OPERATION);
  var logSheet = ss.getSheetByName(SHEET.FOLLOW_UP);

  // ── 取手術記錄 ──
  var opData = opSheet.getDataRange().getValues();
  var opRow  = null;
  for (var i = 1; i < opData.length; i++) {
    if (String(opData[i][OP_COL.RESEARCH_ID]) === researchId) { opRow = opData[i]; break; }
  }
  if (!opRow) return { error: '找不到病患：' + researchId };

  var opDate     = new Date(opRow[OP_COL.OP_DATE]);
  var daysPostOp = isNaN(opDate.getTime()) ? '-' : daysDiff_(opDate, new Date());

  var privacyMap  = _getPrivacyMap_();
  var privacyInfo = privacyMap[researchId] || {};

  var patient = {
    researchId:  String(opRow[OP_COL.RESEARCH_ID]),
    chartNumber: privacyInfo.chartNumber || '',
    opDate:      formatDate_(opDate),
    opName:      opRow[OP_COL.OP_NAME]     || '-',
    opLevels:    opRow[OP_COL.OP_LEVELS]   || '-',
    cageCode:    opRow[OP_COL.CAGE_CODE]   || '-',
    boneGraft:   opRow[OP_COL.BONE_GRAFT]  || '-',
    surgeon:     opRow[OP_COL.SURGEON]     || '-',
    preVasBack:  opRow[OP_COL.PRE_VAS_BACK],
    preVasLeg:   opRow[OP_COL.PRE_VAS_LEG],
    preOdi:      opRow[OP_COL.PRE_ODI],
    daysPostOp:  daysPostOp,
    lineStatus:  opRow[OP_COL.LINE_STATUS] || 'unbound'
  };

  // ── 建立 ODI 明細查詢表（log_id → 各題分數）──
  var odiMap = {};
  var odiSheet = ss.getSheetByName(SHEET.ODI_DETAIL);
  if (odiSheet) {
    odiSheet.getDataRange().getValues().slice(1).forEach(function(row) {
      var lid = String(row[ODI_COL.LOG_ID]);
      if (!lid) return;
      odiMap[lid] = {
        q1: row[ODI_COL.Q1],  q2: row[ODI_COL.Q2],  q3: row[ODI_COL.Q3],
        q4: row[ODI_COL.Q4],  q5: row[ODI_COL.Q5],  q6: row[ODI_COL.Q6],
        q7: row[ODI_COL.Q7],  q8: row[ODI_COL.Q8],  q9: row[ODI_COL.Q9],
        q10: row[ODI_COL.Q10]
      };
    });
  }

  // ── 取追蹤記錄（只含 confirmed）──
  var logData = logSheet.getDataRange().getValues().slice(1);
  var records = [];
  logData.forEach(function(row) {
    if (String(row[LOG_COL.RESEARCH_ID]) !== researchId) return;
    if (row[LOG_COL.CONFIRMED] !== true) return;
    var lid = String(row[LOG_COL.LOG_ID]);
    records.push({
      logId:       lid,
      logDatetime: String(row[LOG_COL.LOG_DATETIME]).slice(0, 10),
      daysPostOp:  row[LOG_COL.DAYS_POST_OP],
      vasBack:     row[LOG_COL.VAS_BACK],
      vasLeg:      row[LOG_COL.VAS_LEG],
      odiScore:    row[LOG_COL.ODI_SCORE],
      pass:        row[LOG_COL.PASS],
      anchorQ:     row[LOG_COL.ANCHOR_Q],
      recordType:  row[LOG_COL.RECORD_TYPE],
      odiDetail:   odiMap[lid] || null
    });
  });

  records.sort(function(a, b) { return Number(a.daysPostOp) - Number(b.daysPostOp); });

  return { patient: patient, records: records };
}

/**
 * 計算每位病患的 MCID 達成狀況（供 Vue MCID Tab 使用）
 * 比較術前基線 vs 術後最後一筆已確認記錄（優先取 D70-D84 附近）
 * @returns {Object} { summary, patients }
 */
function getMcidData_() {
  try {
    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var opSheet  = ss.getSheetByName(SHEET.OPERATION);
    var logSheet = ss.getSheetByName(SHEET.FOLLOW_UP);

    if (!opSheet || !logSheet) return { summary: {}, patients: [] };

    var opData  = opSheet.getDataRange().getValues().slice(1);
    var logData = logSheet.getDataRange().getValues().slice(1);

    // 依 research_id 分組已確認的追蹤記錄
    var logsByPatient = {};
    logData.forEach(function(row) {
      if (row[LOG_COL.CONFIRMED] !== true) return;
      var id = String(row[LOG_COL.RESEARCH_ID]);
      if (!logsByPatient[id]) logsByPatient[id] = [];
      logsByPatient[id].push(row);
    });

    var VAS_MCID  = 2.5;   // VAS 改善 ≥ 2.5 視為達 MCID
    var ODI_MCID  = 12.8;  // ODI% 改善 ≥ 12.8% 視為達 MCID
    var PASS_THRESHOLD = 3; // VAS_back ≤ 3 = PASS

    var patients = [];
    var totals   = { vasMcid: 0, odiMcid: 0, pass: 0, total: 0 };

    opData.forEach(function(opRow) {
      var id = String(opRow[OP_COL.RESEARCH_ID]);
      if (!id) return;

      var preVasBack = opRow[OP_COL.PRE_VAS_BACK];
      var preVasLeg  = opRow[OP_COL.PRE_VAS_LEG];
      var preOdi     = opRow[OP_COL.PRE_ODI];       // 0-100 ODI%
      var opDate     = opRow[OP_COL.OP_DATE];
      var opName     = opRow[OP_COL.OP_NAME];
      var surgeon    = opRow[OP_COL.SURGEON];
      var group      = opRow[OP_COL.INTERVENTION_GROUP];

      var logs = logsByPatient[id] || [];
      if (logs.length === 0) {
        patients.push({
          researchId: id, opName: opName, surgeon: surgeon, group: group,
          preVasBack: preVasBack, preVasLeg: preVasLeg, preOdi: preOdi,
          postVasBack: null, postVasLeg: null, postOdi: null,
          vasBackImprove: null, vasLegImprove: null, odiImprove: null,
          vasMcid: false, odiMcid: false, pass: false,
          anchorQ: null, lastDays: null, recordCount: 0
        });
        totals.total++;
        return;
      }

      // 優先選 D70-D84 範圍，否則取最後一筆
      var targetLog = null;
      logs.forEach(function(row) {
        var d = row[LOG_COL.DAYS_POST_OP];
        if (d >= 70 && d <= 90) {
          if (!targetLog || d < targetLog[LOG_COL.DAYS_POST_OP]) targetLog = row;
        }
      });
      if (!targetLog) {
        targetLog = logs.reduce(function(a, b) {
          return b[LOG_COL.DAYS_POST_OP] > a[LOG_COL.DAYS_POST_OP] ? b : a;
        });
      }

      var postVasBack = targetLog[LOG_COL.VAS_BACK];
      var postVasLeg  = targetLog[LOG_COL.VAS_LEG];
      var postOdi     = targetLog[LOG_COL.ODI_SCORE];  // 0-100
      var anchorQ     = targetLog[LOG_COL.ANCHOR_Q];
      var lastDays    = targetLog[LOG_COL.DAYS_POST_OP];

      var vasBackImprove = (preVasBack !== '' && postVasBack !== '')
        ? Math.round((Number(preVasBack) - Number(postVasBack)) * 10) / 10 : null;
      var vasLegImprove  = (preVasLeg  !== '' && postVasLeg  !== '')
        ? Math.round((Number(preVasLeg)  - Number(postVasLeg))  * 10) / 10 : null;
      var odiImprove     = (preOdi !== '' && postOdi !== '')
        ? Math.round((Number(preOdi) - Number(postOdi)) * 10) / 10 : null;

      var vasMcidReached  = vasBackImprove !== null && vasBackImprove >= VAS_MCID;
      var odiMcidReached  = odiImprove     !== null && odiImprove     >= ODI_MCID;
      var passReached     = postVasBack    !== '' && Number(postVasBack) <= PASS_THRESHOLD;

      patients.push({
        researchId:     id,
        opName:         opName,
        surgeon:        surgeon,
        group:          group,
        preVasBack:     preVasBack,
        preVasLeg:      preVasLeg,
        preOdi:         preOdi,
        postVasBack:    postVasBack,
        postVasLeg:     postVasLeg,
        postOdi:        postOdi,
        vasBackImprove: vasBackImprove,
        vasLegImprove:  vasLegImprove,
        odiImprove:     odiImprove,
        vasMcid:        vasMcidReached,
        odiMcid:        odiMcidReached,
        pass:           passReached,
        anchorQ:        anchorQ || null,
        lastDays:       lastDays,
        recordCount:    logs.length
      });

      totals.total++;
      if (vasMcidReached) totals.vasMcid++;
      if (odiMcidReached) totals.odiMcid++;
      if (passReached)    totals.pass++;
    });

    var n = totals.total || 1;
    return {
      summary: {
        total:        totals.total,
        vasMcidPct:   Math.round(totals.vasMcid / n * 100),
        odiMcidPct:   Math.round(totals.odiMcid / n * 100),
        passPct:      Math.round(totals.pass    / n * 100),
        vasMcidN:     totals.vasMcid,
        odiMcidN:     totals.odiMcid,
        passN:        totals.pass
      },
      patients: patients
    };
  } catch (e) {
    Logger.log('[getMcidData_] ' + e.message);
    return { summary: {}, patients: [] };
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
