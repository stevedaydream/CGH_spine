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
  _setupChatStateSheet(ss);
  _setupBindingCodeSheet(ss);
  _setupOdiDetailSheet(ss);
  _setupOdiReferenceSheet(ss);
  _setupHealthEduSheet(ss);
  _setupLineReplySheet(ss);
  SpreadsheetApp.getUi().alert('✅ 十二個分頁建立完成！請填入耗材代碼表後開始使用。');
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
    'raw_message', 'record_type', 'confirmed',
    'odi_score', 'pass', 'anchor_q'
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

  // odi_score 0-100 驗證
  var odiRule = SpreadsheetApp.newDataValidation()
    .requireNumberBetween(0, 100).setAllowInvalid(true).build();
  sheet.getRange(2, 12, 2000, 1).setDataValidation(odiRule);

  // pass 下拉
  var passRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Y', 'N'], true)
    .setAllowInvalid(true).build();
  sheet.getRange(2, 13, 2000, 1).setDataValidation(passRule);

  // anchor_q 1-7 驗證
  var anchorRule = SpreadsheetApp.newDataValidation()
    .requireNumberBetween(1, 7).setAllowInvalid(true).build();
  sheet.getRange(2, 14, 2000, 1).setDataValidation(anchorRule);

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

// ---------- 分頁 7：對話狀態表 ----------
function _setupChatStateSheet(ss) {
  var sheet = _getOrCreateSheet(ss, SHEET.CHAT_STATE);
  sheet.clearContents();
  var headers = [
    'line_uid', 'research_id', 'current_step',
    'session_data', 'tp_target', 'last_active'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length);

  // current_step 下拉提示
  var stepRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['idle','vas_back','vas_leg',
      'odi_q1','odi_q2','odi_q3','odi_q4','odi_q5',
      'odi_q6','odi_q7','odi_q8','odi_q9','odi_q10',
      'pass','anchor_q','done','chat'], true)
    .setAllowInvalid(true).build();
  sheet.getRange(2, 3, 1000, 1).setDataValidation(stepRule);

  sheet.setColumnWidth(1, 180);  // line_uid
  sheet.setColumnWidth(4, 300);  // session_data (JSON)
}

// ---------- 分頁 8：綁定碼表 ----------
function _setupBindingCodeSheet(ss) {
  var sheet = _getOrCreateSheet(ss, SHEET.BINDING_CODE);
  sheet.clearContents();
  var headers = ['code', 'research_id', 'created_at', 'expires_at', 'used', 'used_at', 'bound_uid'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length);

  // used 核取方塊
  sheet.getRange(2, 5, 2000, 1).insertCheckboxes();

  sheet.setColumnWidth(1, 90);   // code
  sheet.setColumnWidth(2, 140);  // research_id
  sheet.setColumnWidth(3, 160);  // created_at
  sheet.setColumnWidth(4, 160);  // expires_at
  sheet.setColumnWidth(7, 200);  // bound_uid
}

// ---------- 分頁 9：ODI 明細表 ----------
function _setupOdiDetailSheet(ss) {
  var sheet = _getOrCreateSheet(ss, SHEET.ODI_DETAIL);
  sheet.clearContents();
  var headers = [
    'log_id', 'research_id', 'log_datetime', 'days_post_op',
    'odi_q1', 'odi_q2', 'odi_q3', 'odi_q4', 'odi_q5',
    'odi_q6', 'odi_q7', 'odi_q8', 'odi_q9', 'odi_q10',
    'odi_raw', 'odi_score'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length);

  // Q1-Q10 分數 0-5 驗證
  var qRule = SpreadsheetApp.newDataValidation()
    .requireNumberBetween(0, 5).setAllowInvalid(false).build();
  sheet.getRange(2, 5, 2000, 10).setDataValidation(qRule);  // col 5-14

  // odi_raw 0-50
  var rawRule = SpreadsheetApp.newDataValidation()
    .requireNumberBetween(0, 50).setAllowInvalid(false).build();
  sheet.getRange(2, 15, 2000, 1).setDataValidation(rawRule);

  // odi_score 0-100
  var scoreRule = SpreadsheetApp.newDataValidation()
    .requireNumberBetween(0, 100).setAllowInvalid(false).build();
  sheet.getRange(2, 16, 2000, 1).setDataValidation(scoreRule);

  sheet.setColumnWidth(1, 130);  // log_id
  sheet.setColumnWidth(2, 140);  // research_id
  sheet.setColumnWidth(3, 160);  // log_datetime

  // 凍結前 4 欄方便橫向捲動時識別
  sheet.setFrozenColumns(4);
}

// ---------- 分頁 10：ODI 計分對照表 ----------
function _setupOdiReferenceSheet(ss) {
  var sheet = _getOrCreateSheet(ss, SHEET.ODI_REF);
  sheet.clearContents();
  sheet.clearFormats();

  // ── 標題 ──
  sheet.getRange('A1').setValue('ODI（Oswestry Disability Index）計分對照表');
  sheet.getRange('A1').setFontSize(14).setFontWeight('bold').setFontColor('#1a73e8');
  sheet.getRange('A2').setValue('每題 0–5 分，共 10 題。ODI% = 總原始分 ÷ 50 × 100%');
  sheet.getRange('A2').setFontColor('#555555').setFontStyle('italic');

  // MCID / 嚴重度說明
  sheet.getRange('A3').setValue('MCID 門檻：改善 ≥ 12.8%　|　PASS：VAS 背痛 ≤ 3');
  sheet.getRange('A3').setFontColor('#e67e22').setFontWeight('bold');

  // 嚴重度分級
  var severityHeaders = ['ODI 範圍', '障礙程度', '說明'];
  var severityData = [
    ['0 – 20%',  '最小障礙',  '可獨立完成日常生活，通常不需治療'],
    ['21 – 40%', '中度障礙',  '坐立或搬重物有困難，保守治療為主'],
    ['41 – 60%', '重度障礙',  '疼痛影響大多數活動，需詳細評估'],
    ['61 – 80%', '嚴重殘疾',  '影響所有生活面向，手術可能有益'],
    ['81 – 100%','完全殘疾',  '臥床或誇大症狀，需進一步評估'],
  ];
  sheet.getRange('A5').setValue('【嚴重度分級】').setFontWeight('bold');
  sheet.getRange('A6:C6').setValues([severityHeaders]);
  _styleHeader(sheet, 3, 6);
  sheet.getRange(7, 1, severityData.length, 3).setValues(severityData);
  // 顏色標示
  var severityColors = ['#e8f5e9','#fff9c4','#fff3e0','#fce4ec','#f3e5f5'];
  severityColors.forEach(function(color, i) {
    sheet.getRange(7 + i, 1, 1, 3).setBackground(color);
  });

  // ── 各題選項對照表 ──
  var startRow = 14;
  sheet.getRange('A' + startRow).setValue('【各題計分選項對照】').setFontWeight('bold');

  var colHeaders = ['題號', '評估面向', '0 分', '1 分', '2 分', '3 分', '4 分', '5 分'];
  sheet.getRange(startRow + 1, 1, 1, colHeaders.length).setValues([colHeaders]);
  _styleHeader(sheet, colHeaders.length, startRow + 1);

  var questions = [
    ['Q1', '疼痛強度',  '完全不痛',     '輕微疼痛',   '中度疼痛',   '嚴重疼痛',   '非常嚴重',   '最嚴重（無法忍受）'],
    ['Q2', '個人照護',  '完全自理',     '略感不方便', '需他人協助', '大部分依賴', '完全依賴',   '無法照顧自己'],
    ['Q3', '提重物',    '可提重物',     '提重物時痛', '只能提輕物', '不能從地上提','不能提物',  '連輕物也不行'],
    ['Q4', '行走距離',  '正常行走',     '可走 1 公里','可走 500m',  '可走 100m',  '需助行器',   '臥床為主'],
    ['Q5', '坐姿耐受',  '任何椅都可以', '硬椅可久坐', '最多 1 小時','最多 30 分', '最多 10 分', '完全無法坐'],
    ['Q6', '站立耐受',  '久站無痛',     '站 1 小時後痛','最多 1 小時','最多 30 分','最多 10 分', '完全無法站'],
    ['Q7', '睡眠品質',  '不影響睡眠',   '偶爾睡不好', '少於 6 小時','少於 4 小時','少於 2 小時','完全無法入睡'],
    ['Q8', '社交活動',  '正常社交',     '稍受限制',   '明顯受限',   '只能基本社交','幾乎無社交','完全無社交活動'],
    ['Q9', '旅行交通',  '可任意旅行',   '稍受限',     '明顯受限',   '只能短途',   '幾乎不行',   '完全無法出行'],
    ['Q10','職業家務',  '正常工作',     '稍受限制',   '明顯受限',   '只能輕鬆工作','幾乎無法工作','完全無法工作'],
  ];

  sheet.getRange(startRow + 2, 1, questions.length, 8).setValues(questions);

  // 交替底色
  questions.forEach(function(_, i) {
    var bg = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
    sheet.getRange(startRow + 2 + i, 1, 1, 8).setBackground(bg);
  });

  // 分數欄 0分=綠, 5分=紅 漸層標示
  var scoreColors = ['#e8f5e9','#f1f8e9','#fff9c4','#fff3e0','#fce4ec','#f3e5f5'];
  questions.forEach(function(_, i) {
    scoreColors.forEach(function(color, j) {
      sheet.getRange(startRow + 2 + i, 3 + j).setBackground(color);
    });
  });

  // 欄寬
  sheet.setColumnWidth(1, 50);   // 題號
  sheet.setColumnWidth(2, 100);  // 面向
  for (var c = 3; c <= 8; c++) {
    sheet.setColumnWidth(c, 140); // 各分數說明
  }

  sheet.setFrozenRows(startRow + 1);
  sheet.setFrozenColumns(2);

  // 保護（唯讀）
  var protection = sheet.protect().setDescription('ODI 對照表（請勿編輯）');
  protection.setWarningOnly(true);
}

// ---------- 分頁 11：衛教QA表 ----------
function _setupHealthEduSheet(ss) {
  var sheet = _getOrCreateSheet(ss, SHEET.HEALTH_EDU);
  if (sheet.getLastRow() > 0) return; // 已有資料就不清除
  var headers = [
    'id', 'category', 'question', 'answer', 'video_url', 'active', 'display_order',
    'days_from', 'days_to', 'pdf_url'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length, 1);
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 140);  // id
  sheet.setColumnWidth(2, 100);  // category
  sheet.setColumnWidth(3, 200);  // question
  sheet.setColumnWidth(4, 300);  // answer
  sheet.setColumnWidth(5, 200);  // video_url
  sheet.setColumnWidth(6, 60);   // active
  sheet.setColumnWidth(7, 60);   // display_order
  sheet.setColumnWidth(8, 80);   // days_from
  sheet.setColumnWidth(9, 80);   // days_to
  sheet.setColumnWidth(10, 200); // pdf_url
}

// ---------- 分頁 12：LINE Bot 回覆設定 ----------
function _setupLineReplySheet(ss) {
  var sheet = _getOrCreateSheet(ss, SHEET.LINE_REPLY);
  if (sheet.getLastRow() > 0) return;

  var headers = ['id', 'group', 'key', 'triggers', 'content', 'active', 'note'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _styleHeader(sheet, headers.length, 1);
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 90);
  sheet.setColumnWidth(3, 130);
  sheet.setColumnWidth(4, 200);
  sheet.setColumnWidth(5, 350);
  sheet.setColumnWidth(6, 60);
  sheet.setColumnWidth(7, 200);

  var rows = [
    ['SYS-001', '系統訊息', 'welcome', '',
      '🎉 歡迎加入汐止國泰醫院骨科術後追蹤系統！\n\n請向醫護人員索取 6 位數綁定碼，直接傳送即可完成綁定。\n\n綁定後系統將依術後時程定期傳送問卷提醒，您也可隨時點選下方功能選單回報狀況。\n\n如有任何問題請撥：02-2648-2121 轉 5032',
      true, '加入好友時的歡迎訊息（LINE follow 事件）'],
    ['SYS-002', '系統訊息', 'binding_success', '',
      '🎉 綁定成功！\n\n您已完成術後追蹤系統帳號綁定 ✅\n研究編號：{researchId}\n\n系統將依術後時程定期傳送問卷提醒，\n您也可以隨時傳「開始填寫」進行回報。\n\n感謝您的配合，祝您早日康復 🌿',
      true, '綁定成功訊息（支援 {researchId}）'],
    ['SYS-003', '系統訊息', 'binding_fail', '',
      '⚠️ 綁定失敗\n\n原因：{reason}\n\n請確認數字是否正確，\n或向醫護人員重新索取綁定碼。',
      true, '綁定失敗訊息（支援 {reason}）'],
    ['SYS-004', '系統訊息', 'how_to_use', '使用說明,說明,help,怎麼用,幫助',
      '📋 汐止國泰醫院骨科術後追蹤系統\n\n【主要功能】\n✅ 填寫問卷 — 回報今日疼痛狀況\n📊 我的記錄 — 查看最近一筆記錄\n💬 AI 諮詢 — 詢問術後相關問題\n📞 聯絡門診 — 取得診所電話\n\n【填寫時機】\n系統會依術後時程發送提醒，\n您也可隨時點選下方「填寫問卷」回報。\n\n如有任何問題請撥：02-2648-2121 轉 5032',
      true, '使用說明文字（triggers 欄可自訂觸發關鍵字）'],
    ['SYS-005', '系統訊息', 'contact_clinic', '聯絡門診,聯絡醫師,電話,門診電話',
      '汐止國泰醫院骨科門診\n📞 02-2648-2121 轉 5032\n\n緊急狀況請直接前往急診。',
      true, '聯絡門診回覆（triggers 欄可自訂觸發關鍵字）'],
    ['SYS-006', '系統訊息', 'appointment_url', '網路掛號,掛號,預約',
      '網路掛號請至以下連結：\nhttps://reg.cgh.org.tw/tw/reg/main.jsp\n\n或電話：02-2648-2121 轉 5032',
      true, '掛號連結回覆（triggers 欄可自訂觸發關鍵字）'],
    ['SYS-007', '系統訊息', 'questionnaire_complete', '',
      '✅ 問卷填寫完成！感謝您的回報。\n\n術後第 {daysPostOp} 天記錄已儲存：\n  背痛：{vasBack} 分\n  腿痛：{vasLeg} 分\n  ODI：{odiScore}%\n\n如有任何不適請聯絡門診：02-2648-2121 轉 5032\n感謝您的配合，祝您早日康復 🌿',
      true, '問卷完成訊息（支援 {daysPostOp} {vasBack} {vasLeg} {odiScore}）'],
    ['SYS-008', '系統訊息', 'questionnaire_paused', '',
      '問卷已暫停 📋\n\n目前進度：第 {progress}／{total} 題\n\n【已填選項】\n{preview}\n\n下次點選「填寫問卷」可選擇繼續或重新開始。',
      true, '問卷暫停訊息（支援 {progress} {total} {preview}）'],
    ['SYS-009', '系統訊息', 'chat_direct_prompt', '直接提問',
      '請直接輸入您想問的問題 ✍️\n我會根據您的術後狀況給予參考說明。',
      true, 'AI 諮詢直接提問提示（triggers 欄可自訂觸發關鍵字）'],
    ['STEP-001', '問卷步驟', 'step_vas_back_sub', '',
      '0 = 完全不痛，10 = 最痛', true, '背部疼痛評分 Flex 副標題'],
    ['STEP-002', '問卷步驟', 'step_vas_leg_sub', '',
      '0 = 完全不痛，10 = 最痛', true, '腿部疼痛評分 Flex 副標題'],
    ['STEP-003', '問卷步驟', 'step_anchor_q_desc', '',
      '和手術前相比，整體狀況如何？（7最佳，1最差）',
      true, '整體改善評估 Flex 說明文字'],
    ['STEP-004', '問卷步驟', 'step_pass_desc', '',
      '目前的術後狀態，您個人可以接受嗎？',
      true, '整體可接受度 Flex 說明文字']
  ];

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
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
    .addItem('初始化分頁結構（七個分頁）', 'initializeSpreadsheet')
    .addSeparator()
    .addItem('立即執行推播排程', 'dailyPushScheduler')
    .addItem('執行週報 AI 分析', 'weeklyAnalysis')
    .addSeparator()
    .addItem('匯出 CSV（confirmed 資料）', 'exportConfirmedCsv')
    .addSeparator()
    .addItem('安裝自動觸發器', 'setupTriggers')
    .addItem('刪除所有觸發器', 'deleteAllTriggers')
    .addSeparator()
    .addItem('📱 建立 LINE Rich Menu', 'createAndSetRichMenu')
    .addItem('📱 刪除 LINE Rich Menu', 'deleteCurrentRichMenu')
    .addSeparator()
    .addItem('🧪 建立測試資料', 'setupTestData')
    .addItem('🧪 查看測試狀態', 'checkTestStatus')
    .addItem('🧪 重置對話狀態', 'resetChatState')
    .addItem('🧪 清除測試資料', 'cleanupTestData')
    .addToUi();
}
