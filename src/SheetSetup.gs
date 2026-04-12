// ============================================================
// SheetSetup.gs — 初始化六個分頁結構
// 執行 initializeSpreadsheet() 一次即可完成所有分頁建立
// ============================================================

/**
 * 主入口：初始化整個 Spreadsheet（建立分頁、標頭、資料驗證）
 * 在 GAS 編輯器手動執行一次即可。
 */
function initializeSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  _setupImplantSheet(ss);
  _setupOperationSheet(ss);
  _setupFollowUpSheet(ss);
  _setupAIStagingSheet(ss);
  _setupPushLogSheet(ss);
  _setupAIAnalysisSheet(ss);
  SpreadsheetApp.getUi().alert('✅ 六個分頁建立完成！請填入耗材代碼表後開始使用。');
}

// ---------- 分頁 1：耗材代碼表 ----------
function _setupImplantSheet(ss) {
  var sheet = _getOrCreateSheet(ss, SHEET.IMPLANT);
  sheet.clearContents();
  var headers = ['implant_code', 'implant_name', 'category', 'brand', 'note'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length);

  // 範例資料
  var samples = [
    ['CAGE-TLIF-08', 'TLIF Cage 8mm',  'Cage', '廠牌A', ''],
    ['CAGE-TLIF-10', 'TLIF Cage 10mm', 'Cage', '廠牌A', ''],
    ['CAGE-TLIF-12', 'TLIF Cage 12mm', 'Cage', '廠牌A', ''],
    ['SCREW-PED-5',  'Pedicle Screw 5mm', 'Screw', '廠牌B', ''],
    ['BONE-AUTO',    '自體骨',          'Bone Graft', '', ''],
    ['BONE-ALLO',    '異體骨',          'Bone Graft', '', ''],
    ['BONE-CEMENT',  '骨水泥',          'Cement', '', '']
  ];
  sheet.getRange(2, 1, samples.length, samples[0].length).setValues(samples);

  // category 下拉
  var catRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Cage', 'Screw', 'Bone Graft', 'Cement', 'Other'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(2, 3, 200, 1).setDataValidation(catRule);
}

// ---------- 分頁 2：手術記錄表 ----------
function _setupOperationSheet(ss) {
  var sheet = _getOrCreateSheet(ss, SHEET.OPERATION);
  sheet.clearContents();
  var headers = [
    'research_id', 'op_date', 'surgeon',
    'pre_vas_back', 'pre_vas_leg', 'pre_odi', 'pre_sva', 'pre_cobb',
    'op_name', 'op_levels', 'op_duration', 'ebl',
    'cage_code', 'screw_code', 'bone_graft', 'other_implant',
    'complication', 'line_status', 'intervention_group'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length);

  // op_name 下拉
  var opRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TLIF', 'PLIF', 'ALIF', 'Endoscopic', 'MIS-TLIF', 'Laminectomy', 'Other'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(2, 9, 500, 1).setDataValidation(opRule);

  // bone_graft 下拉
  var boneRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['自體骨', '異體骨', '骨水泥', '人工骨', '無'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(2, 15, 500, 1).setDataValidation(boneRule);

  // line_status 下拉
  var lineRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['active', 'blocked', 'unbound'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(2, 18, 500, 1).setDataValidation(lineRule);

  // intervention_group 下拉
  var groupRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['line_bot', 'control', 'partial'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(2, 19, 500, 1).setDataValidation(groupRule);

  // VAS 欄位 0-10 驗證
  var vasRule = SpreadsheetApp.newDataValidation()
    .requireNumberBetween(0, 10).setAllowInvalid(false).build();
  sheet.getRange(2, 4, 500, 2).setDataValidation(vasRule); // pre_vas_back, pre_vas_leg

  sheet.setColumnWidth(1, 130);  // research_id
  sheet.setColumnWidth(2, 110);  // op_date
}

// ---------- 分頁 3：術後追蹤日誌 ----------
function _setupFollowUpSheet(ss) {
  var sheet = _getOrCreateSheet(ss, SHEET.FOLLOW_UP);
  sheet.clearContents();
  var headers = [
    'log_id', 'research_id', 'log_datetime', 'days_post_op',
    'vas_back', 'vas_leg', 'odi_description', 'wound_status',
    'raw_message', 'record_type', 'confirmed'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length);

  // record_type 下拉
  var rtRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['direct', 'ai_parsed', 'amended'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(2, 10, 2000, 1).setDataValidation(rtRule);

  // confirmed 核取方塊
  sheet.getRange(2, 11, 2000, 1).insertCheckboxes();

  sheet.setColumnWidth(9, 250);  // raw_message
}

// ---------- 分頁 4：AI暫存待確認區 ----------
function _setupAIStagingSheet(ss) {
  var sheet = _getOrCreateSheet(ss, SHEET.AI_STAGING);
  sheet.clearContents();
  var headers = [
    'research_id', 'raw_message', 'ai_vas_back', 'ai_vas_leg',
    'ai_summary', 'ai_parsed_at', 'review_status', 'reviewed_by', 'reviewed_at'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length);

  // review_status 下拉
  var rvRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['pending', 'approved', 'rejected'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(2, 7, 2000, 1).setDataValidation(rvRule);

  sheet.setColumnWidth(2, 250);  // raw_message
  sheet.setColumnWidth(5, 300);  // ai_summary
}

// ---------- 分頁 5：推播排程Log ----------
function _setupPushLogSheet(ss) {
  var sheet = _getOrCreateSheet(ss, SHEET.PUSH_LOG);
  sheet.clearContents();
  var headers = [
    'research_id', 'scheduled_day', 'scheduled_date',
    'sent_at', 'status', 'skip_reason', 'error_message'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length);

  // status 下拉
  var stRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['sent', 'failed', 'skipped'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(2, 5, 5000, 1).setDataValidation(stRule);
}

// ---------- 分頁 6：AI分析區 ----------
function _setupAIAnalysisSheet(ss) {
  var sheet = _getOrCreateSheet(ss, SHEET.AI_ANALYSIS);
  sheet.clearContents();

  // 標題區塊
  sheet.getRange('A1').setValue('智慧化脊椎手術追蹤系統 — AI 分析區');
  sheet.getRange('A1').setFontSize(14).setFontWeight('bold');
  sheet.getRange('A2').setValue('最後更新：（尚未執行分析）');

  sheet.getRange('A4').setValue('【耗材效益比較】').setFontWeight('bold');
  sheet.getRange('A5:H5').setValues([['cage_code', '樣本數(n)', '術前VAS均值', '術後14天VAS均值', 'VAS改善分數', '改善率%', '手術方式', '警示']]);
  _styleHeader(sheet, 8, 5);

  sheet.getRange('A12').setValue('【手術方式比較】').setFontWeight('bold');
  sheet.getRange('A13:G13').setValues([['op_name', '樣本數(n)', '術後7天VAS均值', '術後14天VAS均值', '術後28天VAS均值', '平均住院天數', '警示']]);
  _styleHeader(sheet, 7, 13);

  sheet.getRange('A20').setValue('【追蹤完整度】').setFontWeight('bold');
  sheet.getRange('A21:F21').setValues([['research_id', '應填次數', '實填次數', '完整度%', '連續未回覆次數', '狀態']]);
  _styleHeader(sheet, 6, 21);

  sheet.getRange('A40').setValue('【Gemini AI 摘要】').setFontWeight('bold');
  sheet.getRange('A41').setValue('（執行週報分析後自動填入）');

  sheet.getRange('A44').setValue('【匯出】').setFontWeight('bold');
  sheet.getRange('A45').setValue('點擊選單「系統功能 > 匯出 CSV」可下載 SPSS 相容格式（僅含 confirmed=TRUE 資料）');
  sheet.getRange('A45').setFontColor('#1155CC');
}

// ---------- 共用工具 ----------
function _getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function _styleHeader(sheet, numCols, row) {
  row = row || 1;
  var range = sheet.getRange(row, 1, 1, numCols);
  range.setBackground('#1a73e8')
       .setFontColor('#ffffff')
       .setFontWeight('bold')
       .setHorizontalAlignment('center');
  sheet.setFrozenRows(row);
}

/**
 * 自訂選單（Spreadsheet 開啟時自動建立）
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('系統功能')
    .addItem('初始化分頁結構', 'initializeSpreadsheet')
    .addSeparator()
    .addItem('立即執行推播排程', 'dailyPushScheduler')
    .addItem('執行週報 AI 分析', 'weeklyAnalysis')
    .addSeparator()
    .addItem('匯出 CSV（confirmed 資料）', 'exportConfirmedCsv')
    .addSeparator()
    .addItem('安裝自動觸發器', 'setupTriggers')
    .addItem('刪除所有觸發器', 'deleteAllTriggers')
    .addToUi();
}
