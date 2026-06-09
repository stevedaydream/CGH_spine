// ============================================================
// FormHandler.gs — 門診快速填表後端邏輯
// ============================================================

/**
 * Tab A：新增手術記錄
 */
function addOperationRecord_(p) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.OPERATION);

  // 防重複
  if (getOperationRecord(p.researchId)) {
    throw new Error('研究編號已存在：' + p.researchId);
  }

  sheet.appendRow([
    p.researchId,
    p.opDate,
    p.surgeon        || '',
    toNum_(p.preVasBack),
    toNum_(p.preVasLeg),
    toNum_(p.preOdi),
    toNum_(p.preSva),
    toNum_(p.preCobb),
    p.opName         || '',
    p.opLevels       || '',
    toNum_(p.opDuration),
    toNum_(p.ebl),
    p.cageCode       || '',
    p.screwCode      || '',
    p.boneGraft      || '',
    p.otherImplant   || '',
    p.complication   || '',
    'unbound',
    p.interventionGroup || 'control'
  ]);

  // 同步寫入個資對照表（帶病歷號）
  _upsertPrivacyChartNumber_(p.researchId, p.chartNumber || '');

  // 同步產生 LINE 綁定碼（僅 line_bot / partial 組需要）
  var bindingCode = '';
  if (p.interventionGroup !== 'control') {
    try {
      bindingCode = generateBindingCode_(p.researchId);
    } catch (e) {
      Logger.log('[addOperationRecord_] 產生綁定碼失敗：' + e.message);
    }
  }

  return { success: true, bindingCode: bindingCode };
}

/**
 * Tab B：新增術後追蹤記錄（門診直接確認）
 */
function addFollowUpRecord_(p) {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var sheet    = ss.getSheetByName(SHEET.FOLLOW_UP);
  var opRecord = getOperationRecord(p.researchId);

  if (!opRecord) throw new Error('找不到研究編號：' + p.researchId);

  var now        = new Date();
  var daysPostOp = daysDiff_(opRecord.opDate, now);
  var logId      = generateLogId();

  var lock = LockService.getScriptLock();
  try {
    lock.tryLock(10000);
    sheet.appendRow([
      logId,
      p.researchId,
      Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'),
      daysPostOp,
      toNum_(p.vasBack),
      toNum_(p.vasLeg),
      '',                          // odi_description（門診留空）
      p.woundStatus    || '',
      '',                          // raw_message
      'direct',                    // record_type
      true,                        // confirmed
      toNum_(p.odiScore),          // odi_score 0-100（新）
      p.pass           || '',      // pass Y/N（新）
      toNum_(p.anchorQ)            // anchor_q 1-7（新）
    ]);
  } finally {
    lock.releaseLock();
  }

  return { success: true, daysPostOp: daysPostOp, logId: logId, odiScore: toNum_(p.odiScore) };
}

/**
 * 取得填表所需下拉選單資料
 */
function getFormOptions_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 現有病患 ID
  var opSheet = ss.getSheetByName(SHEET.OPERATION);
  var opData  = opSheet ? opSheet.getDataRange().getValues().slice(1) : [];
  var patientIds = opData
    .filter(function(r) { return !!r[OP_COL.RESEARCH_ID]; })
    .map(function(r)    { return String(r[OP_COL.RESEARCH_ID]); });

  // 耗材代碼（Cage 類）
  var implantSheet = ss.getSheetByName(SHEET.IMPLANT);
  var implantData  = implantSheet ? implantSheet.getDataRange().getValues().slice(1) : [];
  var cageCodes = implantData
    .filter(function(r) { return r[2] === 'Cage'; })
    .map(function(r)    { return r[0]; });

  // 建議下一個研究編號：讀最後一筆的流水號 +1
  var year    = new Date().getFullYear();
  var nextNum = 1;
  for (var i = patientIds.length - 1; i >= 0; i--) {
    var m = patientIds[i].match(/(\d+)$/);   // 取末尾數字
    if (m) { nextNum = parseInt(m[1], 10) + 1; break; }
  }
  var nextId = 'SP-' + year + '-' + String(nextNum).padStart(3, '0');

  // 醫師名單：指令碼屬性 SURGEON_LIST（逗號分隔）+ 手術記錄表現有名字
  var surgeonProp = getConfig_('SURGEON_LIST') || '';
  var fromProp    = surgeonProp.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  var fromSheet   = opData
    .map(function(r) { return String(r[OP_COL.SURGEON] || '').trim(); })
    .filter(Boolean);
  var surgeons    = Array.from(new Set(fromProp.concat(fromSheet)));

  // 病歷號 → research_id 反查表（供 Tab B 快速帶入）
  var chartMap = {};
  var privacySheetId = getConfig_('PRIVACY_TABLE_ID');
  if (privacySheetId) {
    try {
      var privacyData = SpreadsheetApp.openById(privacySheetId).getSheets()[0].getDataRange().getValues();
      for (var pi = 1; pi < privacyData.length; pi++) {
        var chartNum = String(privacyData[pi][PRIVACY_COL.CHART_NUMBER] || '').trim();
        var privRid  = String(privacyData[pi][PRIVACY_COL.RESEARCH_ID]  || '').trim();
        if (chartNum && privRid) chartMap[chartNum] = privRid;
      }
    } catch (e) {
      Logger.log('[getFormOptions_] chartMap: ' + e.message);
    }
  }

  return { patientIds: patientIds, cageCodes: cageCodes, nextId: nextId, surgeons: surgeons, chartMap: chartMap };
}

/**
 * 在個資對照表為指定 research_id 寫入或更新病歷號
 * 若該列不存在則建立（line_uid 留空等待綁定）
 */
function _upsertPrivacyChartNumber_(researchId, chartNumber) {
  var privacySheetId = getConfig_('PRIVACY_TABLE_ID');
  if (!privacySheetId) return;
  try {
    var sheet = SpreadsheetApp.openById(privacySheetId).getSheets()[0];
    var data  = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][PRIVACY_COL.RESEARCH_ID]) === String(researchId)) {
        sheet.getRange(i + 1, PRIVACY_COL.CHART_NUMBER + 1).setValue(chartNumber);
        return;
      }
    }
    // 新病患尚未綁定，先建立一列
    sheet.appendRow([researchId, '', chartNumber]);
  } catch (e) {
    Logger.log('[_upsertPrivacyChartNumber_] ' + e.message);
  }
}

// ============================================================
// 耗材管理
// ============================================================

function getImplants_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.IMPLANT);
  if (!sheet) return { items: [] };
  var data = sheet.getDataRange().getValues().slice(1);
  var items = data
    .filter(function(r) { return !!r[0]; })
    .map(function(r) {
      return {
        code:     String(r[0] || ''),
        name:     String(r[1] || ''),
        category: String(r[2] || ''),
        brand:    String(r[3] || ''),
        note:     String(r[4] || '')
      };
    });
  return { items: items };
}

function saveImplant_(p) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.IMPLANT);
  if (!sheet) throw new Error('找不到耗材代碼表');
  if (!p.code) throw new Error('耗材代碼必填');

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.code)) {
      sheet.getRange(i + 1, 1, 1, 5).setValues([[
        p.code, p.name || '', p.category || '', p.brand || '', p.note || ''
      ]]);
      return { success: true, action: 'updated' };
    }
  }
  sheet.appendRow([p.code, p.name || '', p.category || '', p.brand || '', p.note || '']);
  return { success: true, action: 'created' };
}

function deleteImplant_(code) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.IMPLANT);
  if (!sheet) throw new Error('找不到耗材代碼表');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(code)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  throw new Error('找不到耗材代碼：' + code);
}

// ============================================================
// 刪除追蹤個案
// ============================================================

function deleteOperationRecord_(researchId) {
  if (!researchId) throw new Error('researchId 必填');
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.OPERATION);
  var lock  = LockService.getScriptLock();
  try {
    lock.tryLock(10000);
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][OP_COL.RESEARCH_ID]) === String(researchId)) {
        sheet.deleteRow(i + 1);
        _deletePrivacyRow_(researchId);
        return { success: true };
      }
    }
    throw new Error('找不到研究編號：' + researchId);
  } finally {
    lock.releaseLock();
  }
}

function _deletePrivacyRow_(researchId) {
  var privacySheetId = getConfig_('PRIVACY_TABLE_ID');
  if (!privacySheetId) return;
  try {
    var sheet = SpreadsheetApp.openById(privacySheetId).getSheets()[0];
    var data  = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][PRIVACY_COL.RESEARCH_ID]) === String(researchId)) {
        sheet.deleteRow(i + 1);
        return;
      }
    }
  } catch (e) {
    Logger.log('[_deletePrivacyRow_] ' + e.message);
  }
}

/** 轉數字，空值回傳空字串 */
function toNum_(v) {
  if (v === '' || v === null || v === undefined) return '';
  var n = Number(v);
  return isNaN(n) ? '' : n;
}
