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

  return { success: true };
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

  sheet.appendRow([
    logId,
    p.researchId,
    Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'),
    daysPostOp,
    toNum_(p.vasBack),
    toNum_(p.vasLeg),
    p.odiDescription || '',
    p.woundStatus    || '',
    '',         // raw_message（門診直接填，無原始訊息）
    'direct',   // record_type
    true        // confirmed（門診即時確認）
  ]);

  return { success: true, daysPostOp: daysPostOp, logId: logId };
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

  return { patientIds: patientIds, cageCodes: cageCodes, nextId: nextId, surgeons: surgeons };
}

/** 轉數字，空值回傳空字串 */
function toNum_(v) {
  if (v === '' || v === null || v === undefined) return '';
  var n = Number(v);
  return isNaN(n) ? '' : n;
}
