// ============================================================
// TestData.gs — 測試資料建立與清除工具
//
// 使用步驟：
//   1. 先傳訊息給 LINE Bot，Bot 會回覆你的 LINE UID
//   2. 把 UID 填入下方 TEST_LINE_UID 常數
//   3. 在 GAS 編輯器執行 setupTestData()
//   4. 在 LINE 傳「開始填寫」，測試完整 14 步問卷流程
//   5. 測試完畢後執行 cleanupTestData() 清除
// ============================================================

// ▼▼▼ 填入你的 LINE UID（傳訊息給 Bot 後會顯示）▼▼▼
var TEST_LINE_UID = 'Ua40b7ec5f38d1c146e37d37d21377454';
var TEST_RESEARCH_ID = 'SP-2026-001';

// ▼▼▼ 填入主任的 LINE UID ▼▼▼
var TEST_LINE_UID_2 = 'U073a58002ea2ae938ce63d4ee558a2ab';
var TEST_RESEARCH_ID_2 = 'SP-2026-002';

// ──────────────────────────────────────────────────────────
// 主函式：建立整套測試資料
// ──────────────────────────────────────────────────────────
function setupTestData() {
  if (TEST_LINE_UID === 'Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    SpreadsheetApp.getUi().alert(
      '⚠️ 請先填入 TEST_LINE_UID！\n\n' +
      '步驟：\n' +
      '1. 傳任意訊息給 LINE Bot\n' +
      '2. Bot 會回覆你的 LINE UID（格式：Uxxxxxxxxx）\n' +
      '3. 將 UID 貼入 TestData.gs 第 13 行 TEST_LINE_UID\n' +
      '4. 再次執行 setupTestData()'
    );
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var results = [];

  results.push(_setupOperationTestRecord(ss));
  results.push(_setupFollowUpTestRecords(ss));
  results.push(_setupPrivacyTestRecord());

  var msg = '✅ 測試資料建立完成！\n\n' + results.join('\n') + '\n\n';

  if (TEST_LINE_UID_2 !== 'Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    msg += '👨‍⚕️ 主任（' + TEST_RESEARCH_ID_2 + '）也已建立，可用 LINE 傳「開始填寫」測試。\n\n';
  } else {
    msg += '⚠️ 主任 UID 尚未填入（TEST_LINE_UID_2），主任帳號暫不可用。\n\n';
  }

  msg += '測試完畢後執行 cleanupTestData() 清除資料。';
  SpreadsheetApp.getUi().alert(msg);
}

// ──────────────────────────────────────────────────────────
// 清除測試資料
// ──────────────────────────────────────────────────────────
function cleanupTestData() {
  var ui   = SpreadsheetApp.getUi();
  var ids  = SEED_PATIENTS.map(function(p) { return p.id; });
  var resp = ui.alert('確認清除？',
    '將刪除以下所有測試病患資料：\n' + ids.join('\n'),
    ui.ButtonSet.OK_CANCEL);
  if (resp !== ui.Button.OK) return;

  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var removed = [];

  ids.forEach(function(id) {
    [SHEET.OPERATION, SHEET.FOLLOW_UP, SHEET.AI_STAGING, SHEET.PUSH_LOG].forEach(function(sheetName) {
      var r = _deleteRowsByResearchId(ss, sheetName, id);
      if (r) removed.push(r);
    });
  });

  // 清除對話狀態（只清主測試帳號）
  var cs = _cleanChatState(ss);
  if (cs) removed.push(cs);

  // 清除個資對照表
  var pr = _deletePrivacyTestRecord();
  if (pr) removed.push(pr);

  ui.alert('✅ 清除完成\n\n' + removed.join('\n'));
}

// ──────────────────────────────────────────────────────────
// 查看目前測試狀態（不修改資料）
// ──────────────────────────────────────────────────────────
function checkTestStatus() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lines = ['📋 測試狀態報告\n'];

  // 手術記錄
  var opSheet = ss.getSheetByName(SHEET.OPERATION);
  var opData  = opSheet ? opSheet.getDataRange().getValues() : [];
  var opRow   = opData.find(function(r) { return String(r[0]) === TEST_RESEARCH_ID; });
  if (opRow) {
    var opDate     = new Date(opRow[OP_COL.OP_DATE]);
    var daysPostOp = Math.round((new Date() - opDate) / 86400000);
    lines.push('✅ 手術記錄：' + TEST_RESEARCH_ID + '，術後第 ' + daysPostOp + ' 天');
    lines.push('   LINE狀態：' + opRow[OP_COL.LINE_STATUS] + '，介入組：' + opRow[OP_COL.INTERVENTION_GROUP]);
  } else {
    lines.push('❌ 手術記錄：未找到');
  }

  // 追蹤記錄數
  var logSheet = ss.getSheetByName(SHEET.FOLLOW_UP);
  var logData  = logSheet ? logSheet.getDataRange().getValues().slice(1) : [];
  var logCount = logData.filter(function(r) { return String(r[LOG_COL.RESEARCH_ID]) === TEST_RESEARCH_ID; }).length;
  lines.push('📊 追蹤日誌：' + logCount + ' 筆');

  // 對話狀態
  var stateSheet = ss.getSheetByName(SHEET.CHAT_STATE);
  var stateData  = stateSheet ? stateSheet.getDataRange().getValues().slice(1) : [];
  var stateRow   = stateData.find(function(r) { return String(r[STATE_COL.LINE_UID]) === TEST_LINE_UID; });
  if (stateRow) {
    lines.push('💬 對話狀態：step=' + stateRow[STATE_COL.CURRENT_STEP]);
    lines.push('   最後活動：' + stateRow[STATE_COL.LAST_ACTIVE]);
  } else {
    lines.push('💬 對話狀態：尚未建立（等待第一次 LINE 訊息）');
  }

  // 個資對照表
  var privacyCheck = _checkPrivacyRecord();
  lines.push(privacyCheck ? '✅ 個資對照表：已綁定' : '❌ 個資對照表：未找到');

  SpreadsheetApp.getUi().alert(lines.join('\n'));
}

// ──────────────────────────────────────────────────────────
// 重置對話狀態（測試卡住時使用）
// ──────────────────────────────────────────────────────────
function resetChatState() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.CHAT_STATE);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][STATE_COL.LINE_UID]) === TEST_LINE_UID) {
      sheet.getRange(i + 1, 1, 1, 6).setValues([[
        TEST_LINE_UID, TEST_RESEARCH_ID, 'idle', '{"researchId":"' + TEST_RESEARCH_ID + '"}', '',
        Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss')
      ]]);
      SpreadsheetApp.getUi().alert('✅ 對話狀態已重置為 idle');
      return;
    }
  }
  SpreadsheetApp.getUi().alert('找不到對應的對話狀態列');
}

// ──────────────────────────────────────────────────────────
// Seed 資料定義
// ──────────────────────────────────────────────────────────

// 計算相對今天的日期字串
function _daysAgo(n) {
  var d = new Date();
  d.setDate(d.getDate() - n);
  return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy/MM/dd');
}

// 病患種子資料
// line_status: 只有 TEST_RESEARCH_ID 是 active（綁定你的 LINE UID）
//              其餘設 unbound，用於 MCID 數據測試
var SEED_PATIENTS = [
  // 0：你自己（SP-2026-001），術後第 7 天，用於 LINE Bot 問卷測試
  {
    id: TEST_RESEARCH_ID, opDate: _daysAgo(7),
    surgeon: '測試醫師', preVasBack: 7, preVasLeg: 6, preOdi: 52,
    opName: 'TLIF', opLevels: 'L4-L5', opDuration: 120, ebl: 200,
    cageCode: 'CAGE-TLIF-10', boneGraft: '自體骨',
    lineStatus: 'active', group: 'line_bot'
  },
  // 1：主任帳號，術後第 7 天，用於 LINE Bot 問卷測試（第二位測試者）
  {
    id: TEST_RESEARCH_ID_2, opDate: _daysAgo(7),
    surgeon: '王醫師', preVasBack: 8, preVasLeg: 6, preOdi: 58,
    opName: 'TLIF', opLevels: 'L3-L4', opDuration: 135, ebl: 250,
    cageCode: 'CAGE-TLIF-12', boneGraft: '異體骨',
    lineStatus: TEST_LINE_UID_2 !== 'Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' ? 'active' : 'unbound',
    group: 'line_bot'
  },
  // 2：術後 84 天，line_bot 組（測試完整 MCID，接近 D84 終點）
  {
    id: 'SP-SEED-003', opDate: _daysAgo(84),
    surgeon: '王醫師', preVasBack: 9, preVasLeg: 8, preOdi: 72,
    opName: 'Endoscopic TLIF', opLevels: 'L5-S1', opDuration: 90, ebl: 100,
    cageCode: 'CAGE-TLIF-08', boneGraft: '自體骨',
    lineStatus: 'unbound', group: 'line_bot'
  },
  // 3：術後 42 天，部分介入組
  {
    id: 'SP-SEED-004', opDate: _daysAgo(42),
    surgeon: '李醫師', preVasBack: 6, preVasLeg: 4, preOdi: 38,
    opName: 'PLIF', opLevels: 'L4-L5, L5-S1', opDuration: 180, ebl: 400,
    cageCode: 'CAGE-TLIF-10', boneGraft: '人工骨',
    lineStatus: 'unbound', group: 'partial'
  },
  // 4：術後 56 天，對照組
  {
    id: 'SP-SEED-005', opDate: _daysAgo(56),
    surgeon: '李醫師', preVasBack: 5, preVasLeg: 3, preOdi: 28,
    opName: 'TLIF', opLevels: 'L4-L5', opDuration: 110, ebl: 150,
    cageCode: 'CAGE-TLIF-10', boneGraft: '自體骨',
    lineStatus: 'unbound', group: 'control'
  }
];

// 追蹤記錄種子資料（只為非測試病患）
var SEED_FOLLOW_UPS = [
  // SP-SEED-002（術後28天）：D1, D3, D7, D14, D28
  { id:'SP-SEED-002', daysOffset:1,  vasBack:7, vasLeg:6, odi:'',  pass:'',  anchor:'' },
  { id:'SP-SEED-002', daysOffset:3,  vasBack:6, vasLeg:5, odi:'',  pass:'',  anchor:'' },
  { id:'SP-SEED-002', daysOffset:7,  vasBack:5, vasLeg:4, odi:44,  pass:'N', anchor:4  },
  { id:'SP-SEED-002', daysOffset:14, vasBack:4, vasLeg:3, odi:38,  pass:'N', anchor:5  },
  { id:'SP-SEED-002', daysOffset:28, vasBack:3, vasLeg:2, odi:30,  pass:'Y', anchor:6  },

  // SP-SEED-003（術後84天）：多時間點，達到 MCID
  { id:'SP-SEED-003', daysOffset:1,  vasBack:8, vasLeg:7, odi:'',  pass:'',  anchor:'' },
  { id:'SP-SEED-003', daysOffset:7,  vasBack:6, vasLeg:5, odi:56,  pass:'N', anchor:4  },
  { id:'SP-SEED-003', daysOffset:14, vasBack:5, vasLeg:4, odi:48,  pass:'N', anchor:5  },
  { id:'SP-SEED-003', daysOffset:28, vasBack:4, vasLeg:3, odi:40,  pass:'Y', anchor:5  },
  { id:'SP-SEED-003', daysOffset:56, vasBack:3, vasLeg:2, odi:28,  pass:'Y', anchor:6  },
  { id:'SP-SEED-003', daysOffset:84, vasBack:2, vasLeg:1, odi:18,  pass:'Y', anchor:7  },

  // SP-SEED-004（術後42天）：輕症，改善不顯著
  { id:'SP-SEED-004', daysOffset:7,  vasBack:5, vasLeg:3, odi:32,  pass:'N', anchor:4  },
  { id:'SP-SEED-004', daysOffset:21, vasBack:4, vasLeg:2, odi:26,  pass:'Y', anchor:5  },
  { id:'SP-SEED-004', daysOffset:42, vasBack:3, vasLeg:2, odi:22,  pass:'Y', anchor:5  },

  // SP-SEED-005（術後56天）：術後改善緩慢，未達 MCID
  { id:'SP-SEED-005', daysOffset:7,  vasBack:5, vasLeg:3, odi:24,  pass:'N', anchor:4  },
  { id:'SP-SEED-005', daysOffset:28, vasBack:4, vasLeg:3, odi:22,  pass:'N', anchor:4  },
  { id:'SP-SEED-005', daysOffset:56, vasBack:4, vasLeg:2, odi:20,  pass:'Y', anchor:5  }
];

// ──────────────────────────────────────────────────────────
// 內部工具：建立手術記錄（含 seed 病患）
// ──────────────────────────────────────────────────────────
function _setupOperationTestRecord(ss) {
  var sheet = ss.getSheetByName(SHEET.OPERATION);
  if (!sheet) return '❌ 找不到手術記錄表';

  var data      = sheet.getDataRange().getValues();
  var existIds  = data.slice(1).map(function(r) { return String(r[0]); });
  var added     = 0;

  SEED_PATIENTS.forEach(function(p) {
    if (existIds.indexOf(p.id) !== -1) return; // 跳過已存在
    sheet.appendRow([
      p.id, p.opDate, p.surgeon,
      p.preVasBack, p.preVasLeg, p.preOdi, '', '',
      p.opName, p.opLevels, p.opDuration, p.ebl,
      p.cageCode, '', p.boneGraft, '', '',
      p.lineStatus, p.group
    ]);
    added++;
  });

  return '✅ 手術記錄：新增 ' + added + ' 筆（共 ' + SEED_PATIENTS.length + ' 位測試病患）';
}

// ──────────────────────────────────────────────────────────
// 內部工具：建立追蹤記錄（seed 歷史數據）
// ──────────────────────────────────────────────────────────
function _setupFollowUpTestRecords(ss) {
  var logSheet = ss.getSheetByName(SHEET.FOLLOW_UP);
  var opSheet  = ss.getSheetByName(SHEET.OPERATION);
  if (!logSheet || !opSheet) return '❌ 找不到分頁';

  var opData = opSheet.getDataRange().getValues();
  // 建立 id → opDate 的查詢表
  var opDateMap = {};
  opData.slice(1).forEach(function(r) { opDateMap[String(r[0])] = new Date(r[1]); });

  // 取得已存在的 log_id
  var logData    = logSheet.getDataRange().getValues();
  var existLogIds = logData.slice(1).map(function(r) { return String(r[0]); });

  var added = 0;
  SEED_FOLLOW_UPS.forEach(function(f, idx) {
    var logId = 'LOG-SEED-' + String(idx + 1).padStart(3, '0');
    if (existLogIds.indexOf(logId) !== -1) return;

    var opDate = opDateMap[f.id];
    if (!opDate) return;

    var logDate = new Date(opDate);
    logDate.setDate(logDate.getDate() + f.daysOffset);

    logSheet.appendRow([
      logId, f.id,
      Utilities.formatDate(logDate, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'),
      f.daysOffset,
      f.vasBack, f.vasLeg,
      '', '',           // odi_description, wound_status
      '種子資料',       // raw_message
      'direct',         // record_type
      true,             // confirmed
      f.odi    || '',   // odi_score
      f.pass   || '',   // pass
      f.anchor || ''    // anchor_q
    ]);
    added++;
  });

  return '✅ 追蹤日誌：新增 ' + added + ' 筆 seed 歷史記錄（5 位病患）';
}

// ──────────────────────────────────────────────────────────
// 內部工具：個資對照表操作
// ──────────────────────────────────────────────────────────
function _setupPrivacyTestRecord() {
  var privacySheetId = getConfig_('PRIVACY_TABLE_ID');
  if (!privacySheetId) {
    return '⚠️ 未設定 PRIVACY_TABLE_ID，請手動在個資對照表新增測試記錄';
  }
  try {
    var sheet = SpreadsheetApp.openById(privacySheetId).getSheets()[0];
    var msgs  = [];

    // 寫入第一位測試者（你）
    msgs.push(_upsertPrivacyRow(sheet, TEST_RESEARCH_ID, TEST_LINE_UID, '0123456789'));

    // 寫入第二位測試者（主任），若 UID 已填入
    if (TEST_LINE_UID_2 !== 'Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
      msgs.push(_upsertPrivacyRow(sheet, TEST_RESEARCH_ID_2, TEST_LINE_UID_2, '9876543210'));
    }

    return '✅ 個資對照表：' + msgs.join('、');
  } catch (e) {
    return '❌ 個資對照表寫入失敗：' + e.message;
  }
}

function _upsertPrivacyRow(sheet, researchId, lineUid, chartNumber) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][PRIVACY_COL.RESEARCH_ID]) === researchId) {
      sheet.getRange(i + 1, PRIVACY_COL.LINE_UID + 1).setValue(lineUid);
      if (chartNumber !== undefined) {
        sheet.getRange(i + 1, PRIVACY_COL.CHART_NUMBER + 1).setValue(chartNumber);
      }
      return researchId + ' 已更新';
    }
  }
  sheet.appendRow([researchId, lineUid, chartNumber || '']);
  return researchId + ' 已新增';
}

function _checkPrivacyRecord() {
  var privacySheetId = getConfig_('PRIVACY_TABLE_ID');
  if (!privacySheetId) return false;
  try {
    var data = SpreadsheetApp.openById(privacySheetId).getSheets()[0].getDataRange().getValues();
    return data.some(function(r) {
      return String(r[0]) === TEST_RESEARCH_ID && String(r[1]) === TEST_LINE_UID;
    });
  } catch (e) { return false; }
}

function _deletePrivacyTestRecord() {
  var privacySheetId = getConfig_('PRIVACY_TABLE_ID');
  if (!privacySheetId) return '⚠️ 未設定 PRIVACY_TABLE_ID，請手動刪除個資對照表中的測試記錄';
  try {
    var sheet = SpreadsheetApp.openById(privacySheetId).getSheets()[0];
    var data  = sheet.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]) === TEST_RESEARCH_ID) {
        sheet.deleteRow(i + 1);
        return '✅ 個資對照表：已刪除測試記錄';
      }
    }
    return '⚠️ 個資對照表：未找到測試記錄';
  } catch (e) { return '❌ 個資對照表刪除失敗：' + e.message; }
}

// ──────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────
// 衛教 QA 範例資料（術後傷口照護）
// 可單獨執行，不影響病患測試資料
// ──────────────────────────────────────────────────────────
function setupHealthEduSampleData() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.HEALTH_EDU);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('找不到衛教QA表，請先執行 initializeSpreadsheet()');
    return;
  }

  var samples = [
    // col: id, category, question, answer, video_url, active, display_order, days_from, days_to, pdf_url
    [
      'QA-SAMPLE-001', '術後傷口照護',
      '傷口如何清潔消毒？',
      '術後傷口每日以生理食鹽水或清水輕輕清潔，再以優碘消毒並覆蓋無菌紗布。清潔時注意動作輕柔，避免摩擦縫線。若傷口有膠帶（Steri-Strip），請勿自行撕除，讓其自然脫落。',
      '', true, 1, 1, 14, ''
    ],
    [
      'QA-SAMPLE-002', '術後傷口照護',
      '傷口有滲液正常嗎？',
      '術後 1–3 天有少量淡黃色或血水滲出屬正常現象。若滲液量多、顏色變深（綠或黃膿）、有異味，或伴隨發燒（體溫 > 38°C），請立即聯絡門診或至急診就醫。',
      '', true, 2, 1, 7, ''
    ],
    [
      'QA-SAMPLE-003', '術後傷口照護',
      '什麼症狀需要立即回診？',
      '出現以下情況請立即回診或急診：\n① 傷口紅腫熱痛加劇\n② 發燒超過 38°C\n③ 傷口裂開或縫線脫落\n④ 傷口流膿或有異味\n⑤ 下肢突然無力或麻木加劇\n⑥ 大小便失禁\n\n急診電話：02-2648-2121',
      '', true, 3, '', '', ''
    ],
    [
      'QA-SAMPLE-004', '術後傷口照護',
      '何時可以淋浴或洗澡？',
      '一般建議拆線後（術後 10–14 天）且確認傷口完全癒合後，才可正常淋浴。在此之前可以毛巾擦澡，注意保持傷口乾燥。洗澡時避免直接沖淋傷口，沖完後輕輕拍乾並重新換藥。泡澡與游泳請等傷口完全癒合後再考慮。',
      '', true, 4, 1, 14, ''
    ],
    [
      'QA-SAMPLE-005', '術後傷口照護',
      '拆線後還需要換藥嗎？',
      '拆線後若傷口已完全癒合（無滲液、無紅腫），通常不需要繼續換藥。可塗抹少量疤痕凝膠（矽膠類）以促進淡化。若傷口仍有輕微結痂，保持清潔乾燥即可，勿強行去除痂皮，讓其自然脫落。',
      '', true, 5, 14, 30, ''
    ],
    [
      'QA-SAMPLE-006', '術後傷口照護',
      '傷口照護衛教單張下載',
      '您可以點選下方連結下載完整的術後傷口照護衛教單張，包含換藥步驟圖解與注意事項，建議列印備用。',
      '', true, 6, '', '', ''
    ]
  ];

  var added = 0;
  samples.forEach(function(row) {
    // 避免重複新增（依 id 判斷）
    var existing = sheet.getDataRange().getValues();
    var dup = existing.some(function(r) { return String(r[0]) === String(row[0]); });
    if (!dup) {
      sheet.appendRow(row);
      added++;
    }
  });

  SpreadsheetApp.getUi().alert('✅ 衛教範例資料新增完成！共新增 ' + added + ' 筆（已存在的跳過）');
}

// ──────────────────────────────────────────────────────────
// 內部工具：刪除指定分頁中研究編號的列
// ──────────────────────────────────────────────────────────
function _deleteRowsByResearchId(ss, sheetName, researchId) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return null;
  var data    = sheet.getDataRange().getValues();
  var deleted = 0;
  // 從底部往上刪，避免 row index 偏移
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === researchId || String(data[i][1]) === researchId) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }
  return deleted > 0 ? '✅ ' + sheetName + '：刪除 ' + deleted + ' 列' : null;
}

function _cleanChatState(ss) {
  var sheet = ss.getSheetByName(SHEET.CHAT_STATE);
  if (!sheet) return null;
  var data    = sheet.getDataRange().getValues();
  var deleted = 0;
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][STATE_COL.LINE_UID]) === TEST_LINE_UID) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }
  return deleted > 0 ? '✅ 對話狀態表：已清除' : null;
}
