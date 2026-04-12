// ============================================================
// WeeklyAnalysis.gs — 週報分析、AI 分析區填寫、CSV 匯出
// 每週一 09:00 由觸發器呼叫 weeklyAnalysis()
// ============================================================

var LOW_SAMPLE_THRESHOLD = 15;

/**
 * 主週報函式：讀取已確認資料 → 統計 → Gemini 摘要 → 寫入分析區 → 發信
 */
function weeklyAnalysis() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var followUpSheet  = ss.getSheetByName(SHEET.FOLLOW_UP);
  var opSheet        = ss.getSheetByName(SHEET.OPERATION);
  var analysisSheet  = ss.getSheetByName(SHEET.AI_ANALYSIS);

  // 只讀取 confirmed=TRUE 的資料
  var confirmedLogs = _getConfirmedLogs(followUpSheet);
  var opData        = opSheet.getDataRange().getValues().slice(1); // 去標頭

  if (confirmedLogs.length === 0) {
    Logger.log('[weeklyAnalysis] 無已確認資料，略過分析。');
    return;
  }

  // 統計區塊
  var cageStats    = _calcCageStats(confirmedLogs, opData);
  var opStats      = _calcOpNameStats(confirmedLogs, opData);
  var completeness = _calcCompleteness(opData, confirmedLogs);
  var weekRange    = _getWeekRange();

  // 寫入 AI 分析區
  _writeAnalysisSheet(analysisSheet, cageStats, opStats, completeness, weekRange);

  // Gemini 週報摘要
  var stats = { cage: cageStats, operation: opStats, completeness: completeness };
  var aiSummary = generateWeeklyReport(stats, weekRange);
  analysisSheet.getRange('A41').setValue(aiSummary);

  // 發信給主責醫師
  _sendWeeklyEmail(aiSummary, weekRange, completeness);

  Logger.log('[weeklyAnalysis] 完成，週期=' + weekRange);
}

// ---------- 讀取已確認記錄 ----------
function _getConfirmedLogs(sheet) {
  var data = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][LOG_COL.CONFIRMED] === true) {
      result.push(data[i]);
    }
  }
  return result;
}

// ---------- 耗材效益比較（依 cage_code 分組）----------
function _calcCageStats(logs, opData) {
  // 建立 research_id → opRecord 的 Map
  var opMap = {};
  opData.forEach(function(row) {
    var id = row[OP_COL.RESEARCH_ID];
    if (id) opMap[id] = row;
  });

  // 依 cage_code 分組，收集術前 VAS 與各追蹤點 VAS
  var groups = {};
  logs.forEach(function(log) {
    var id = log[LOG_COL.RESEARCH_ID];
    var op = opMap[id];
    if (!op) return;

    var cage = op[OP_COL.CAGE_CODE] || '未填';
    var opName = op[OP_COL.OP_NAME] || '';
    var preVas = (parseFloat(op[OP_COL.PRE_VAS_BACK]) + parseFloat(op[OP_COL.PRE_VAS_LEG])) / 2;

    if (!groups[cage]) groups[cage] = { cage: cage, opName: opName, preVas: [], vas14: [], ids: [] };
    if (groups[cage].ids.indexOf(id) === -1) {
      groups[cage].ids.push(id);
      groups[cage].preVas.push(isNaN(preVas) ? null : preVas);
    }

    var days = parseInt(log[LOG_COL.DAYS_POST_OP], 10);
    if (days >= 12 && days <= 16) { // 約 14 天
      var vas = (parseFloat(log[LOG_COL.VAS_BACK]) + parseFloat(log[LOG_COL.VAS_LEG])) / 2;
      if (!isNaN(vas)) groups[cage].vas14.push(vas);
    }
  });

  // 計算統計
  return Object.keys(groups).map(function(cage) {
    var g = groups[cage];
    var n = g.ids.length;
    var avgPre = _avg(g.preVas.filter(function(v) { return v !== null; }));
    var avg14  = _avg(g.vas14);
    var improvement = (avgPre !== null && avg14 !== null) ? (avgPre - avg14) : null;
    var rate = (avgPre && improvement !== null) ? ((improvement / avgPre) * 100).toFixed(1) : null;
    return {
      cage:        cage,
      n:           n,
      preVas:      avgPre !== null ? avgPre.toFixed(1) : 'N/A',
      vas14:       avg14  !== null ? avg14.toFixed(1)  : 'N/A',
      improvement: improvement !== null ? improvement.toFixed(1) : 'N/A',
      rate:        rate !== null ? rate + '%' : 'N/A',
      opName:      g.opName,
      warning:     n < LOW_SAMPLE_THRESHOLD ? '⚠️ 樣本量不足（n=' + n + '），結論僅供參考，請勿用於正式發表。' : ''
    };
  });
}

// ---------- 手術方式比較 ----------
function _calcOpNameStats(logs, opData) {
  var opMap = {};
  opData.forEach(function(row) {
    if (row[OP_COL.RESEARCH_ID]) opMap[row[OP_COL.RESEARCH_ID]] = row;
  });

  var groups = {};
  logs.forEach(function(log) {
    var id  = log[LOG_COL.RESEARCH_ID];
    var op  = opMap[id];
    if (!op) return;
    var opName = op[OP_COL.OP_NAME] || '未填';
    if (!groups[opName]) groups[opName] = { ids: [], vas7: [], vas14: [], vas28: [] };
    if (groups[opName].ids.indexOf(id) === -1) groups[opName].ids.push(id);

    var days = parseInt(log[LOG_COL.DAYS_POST_OP], 10);
    var vas  = (parseFloat(log[LOG_COL.VAS_BACK]) + parseFloat(log[LOG_COL.VAS_LEG])) / 2;
    if (isNaN(vas)) return;
    if (days >= 5  && days <= 9)  groups[opName].vas7.push(vas);
    if (days >= 12 && days <= 16) groups[opName].vas14.push(vas);
    if (days >= 26 && days <= 30) groups[opName].vas28.push(vas);
  });

  return Object.keys(groups).map(function(name) {
    var g = groups[name];
    var n = g.ids.length;
    return {
      opName: name,
      n:      n,
      vas7:   _avg(g.vas7)  !== null ? _avg(g.vas7).toFixed(1)  : 'N/A',
      vas14:  _avg(g.vas14) !== null ? _avg(g.vas14).toFixed(1) : 'N/A',
      vas28:  _avg(g.vas28) !== null ? _avg(g.vas28).toFixed(1) : 'N/A',
      warning: n < LOW_SAMPLE_THRESHOLD ? '⚠️ 樣本量不足（n=' + n + '）' : ''
    };
  });
}

// ---------- 追蹤完整度 ----------
function _calcCompleteness(opData, logs) {
  var logMap = {};
  logs.forEach(function(log) {
    var id = log[LOG_COL.RESEARCH_ID];
    if (!logMap[id]) logMap[id] = 0;
    logMap[id]++;
  });

  var results = [];
  opData.forEach(function(row) {
    var id = row[OP_COL.RESEARCH_ID];
    if (!id) return;
    var opDate = new Date(row[OP_COL.OP_DATE]);
    if (isNaN(opDate.getTime())) return;

    var today = new Date();
    var daysPostOp = daysDiff_(opDate, today);
    var expected = PUSH_SCHEDULE_DAYS.filter(function(d) { return d <= daysPostOp; }).length;
    var actual   = logMap[id] || 0;
    var pct      = expected > 0 ? Math.round((actual / expected) * 100) : 100;

    // 計算連續未回覆次數（最近幾個推播日沒有記錄）
    var consecutiveMissed = _calcConsecutiveMissed(id, daysPostOp, logs);

    results.push({
      researchId:        id,
      expected:          expected,
      actual:            actual,
      pct:               pct,
      consecutiveMissed: consecutiveMissed,
      status:            pct >= 80 ? '✅ 良好' : pct >= 50 ? '⚠️ 普通' : '🔴 不足'
    });
  });

  return results;
}

function _calcConsecutiveMissed(researchId, daysPostOp, logs) {
  var logDays = logs
    .filter(function(l) { return l[LOG_COL.RESEARCH_ID] === researchId; })
    .map(function(l) { return parseInt(l[LOG_COL.DAYS_POST_OP], 10); });

  var missed = 0;
  var pastDays = PUSH_SCHEDULE_DAYS.filter(function(d) { return d <= daysPostOp; });
  for (var i = pastDays.length - 1; i >= 0; i--) {
    if (logDays.indexOf(pastDays[i]) === -1) missed++;
    else break;
  }
  return missed;
}

// ---------- 寫入 AI 分析區 ----------
function _writeAnalysisSheet(sheet, cageStats, opStats, completeness, weekRange) {
  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
  sheet.getRange('A2').setValue('最後更新：' + now + '（週期：' + weekRange + '）');

  // 耗材比較（從第 6 列開始）
  _clearSection(sheet, 6, 5);
  cageStats.forEach(function(r, idx) {
    var row = 6 + idx;
    sheet.getRange(row, 1, 1, 8).setValues([[
      r.cage, r.n, r.preVas, r.vas14, r.improvement, r.rate, r.opName, r.warning
    ]]);
    if (r.n < LOW_SAMPLE_THRESHOLD) {
      sheet.getRange(row, 8).setFontColor('#cc0000');
    }
  });

  // 手術方式比較（從第 14 列開始）
  _clearSection(sheet, 14, 6);
  opStats.forEach(function(r, idx) {
    var row = 14 + idx;
    sheet.getRange(row, 1, 1, 7).setValues([[
      r.opName, r.n, r.vas7, r.vas14, r.vas28, '', r.warning
    ]]);
  });

  // 追蹤完整度（從第 22 列開始）
  _clearSection(sheet, 22, completeness.length + 1);
  completeness.forEach(function(r, idx) {
    var row = 22 + idx;
    sheet.getRange(row, 1, 1, 6).setValues([[
      r.researchId, r.expected, r.actual, r.pct + '%', r.consecutiveMissed, r.status
    ]]);
    // 顏色標示
    var bg = r.pct >= 80 ? '#d9ead3' : r.pct >= 50 ? '#fff2cc' : '#fce8b2';
    sheet.getRange(row, 1, 1, 6).setBackground(bg);
  });
}

function _clearSection(sheet, startRow, numRows) {
  if (numRows <= 0) return;
  sheet.getRange(startRow, 1, numRows, 8).clearContent().setBackground(null).setFontColor(null);
}

// ---------- 發送週報 Email ----------
function _sendWeeklyEmail(aiSummary, weekRange, completeness) {
  var doctorEmail = getConfig_('DOCTOR_EMAIL');
  if (!doctorEmail) return;

  var missedPatients = completeness.filter(function(r) { return r.consecutiveMissed >= 3; });
  var missedList = missedPatients.length > 0
    ? '\n\n【需關注病患（連續3次未回覆）】\n' + missedPatients.map(function(r) { return '- ' + r.researchId; }).join('\n')
    : '';

  var body =
    '主責醫師您好，\n\n' +
    '本週數據摘要（' + weekRange + '）\n\n' +
    aiSummary +
    missedList +
    '\n\n請至 Google Sheets AI 分析區查看完整數據。\n' +
    '如需匯出 CSV，請使用選單「系統功能 > 匯出 CSV」。\n\n' +
    '智慧化脊椎手術追蹤系統';

  MailApp.sendEmail(doctorEmail, '脊椎追蹤系統週報（' + weekRange + '）', body);
}

// ---------- 匯出 CSV（只含 confirmed=TRUE）----------
function exportConfirmedCsv() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.FOLLOW_UP);
  var data  = sheet.getDataRange().getValues();
  var headers = data[0];

  var rows = [headers.join(',')];
  for (var i = 1; i < data.length; i++) {
    if (data[i][LOG_COL.CONFIRMED] !== true) continue;
    var escaped = data[i].map(function(cell) {
      var s = String(cell).replace(/"/g, '""');
      return /[,"\n]/.test(s) ? '"' + s + '"' : s;
    });
    rows.push(escaped.join(','));
  }

  var csv = rows.join('\n');
  var filename = 'spine_confirmed_' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd') + '.csv';

  // 儲存至 Drive 並提供下載連結
  var file = DriveApp.createFile(filename, csv, MimeType.CSV);
  var url  = file.getUrl();

  SpreadsheetApp.getUi().alert(
    '✅ CSV 已匯出完成！\n\n' +
    '檔案名稱：' + filename + '\n' +
    '請至 Google Drive 下載：\n' + url
  );
}

// ---------- 工具函式 ----------
function _avg(arr) {
  var clean = arr.filter(function(v) { return v !== null && !isNaN(v); });
  if (clean.length === 0) return null;
  return clean.reduce(function(a, b) { return a + b; }, 0) / clean.length;
}

function _getWeekRange() {
  var today = new Date();
  var monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  var sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return formatDate_(monday) + ' - ' + formatDate_(sunday);
}
