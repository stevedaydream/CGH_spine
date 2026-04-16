// ============================================================
// BindingCode.gs — LINE 綁定碼產生與驗證
//
// 流程：
//   1. 門診建立病患手術記錄 → generateBindingCode_() → 產生 6 位碼
//   2. 印出綁定碼交給病患（含 LINE Bot QR Code）
//   3. 病患加好友 → 傳入 6 位碼
//   4. validateAndBind_() → 寫入個資對照表 → line_status = active
// ============================================================

var BINDING_CODE_EXPIRE_HOURS = 48;

/**
 * 為指定病患產生新的 6 位數綁定碼
 * @param {string} researchId
 * @returns {string} 6 位數字字串
 */
function generateBindingCode_(researchId) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = _getOrCreateBindSheet_(ss);

  // 確保沒有未使用的有效碼（防止重複產生）
  var existing = _getActiveCodeForPatient_(sheet, researchId);
  if (existing) return existing;

  var code = _generateUniqueCode_(sheet);
  var now  = new Date();
  var exp  = new Date(now.getTime() + BINDING_CODE_EXPIRE_HOURS * 3600000);

  sheet.appendRow([
    code,
    researchId,
    Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'),
    Utilities.formatDate(exp, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'),
    false,  // used
    '',     // used_at
    ''      // bound_uid
  ]);

  Logger.log('[generateBindingCode_] researchId=' + researchId + '，code=' + code);
  return code;
}

/**
 * 驗證綁定碼並完成 LINE UID 綁定
 * @param {string} code     病患輸入的 6 位碼
 * @param {string} lineUid  LINE User ID
 * @returns {Object} { ok: boolean, researchId: string|null, reason: string }
 */
function validateAndBind_(code, lineUid) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = _getOrCreateBindSheet_(ss);
  var data  = sheet.getDataRange().getValues();
  var now   = new Date();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[BIND_COL.CODE]) !== String(code)) continue;

    // 已使用
    if (row[BIND_COL.USED] === true) {
      return { ok: false, researchId: null, reason: '此綁定碼已使用過' };
    }

    // 已過期
    var expiresAt = new Date(row[BIND_COL.EXPIRES_AT]);
    if (now > expiresAt) {
      return { ok: false, researchId: null, reason: '綁定碼已過期，請向醫護人員重新索取' };
    }

    var researchId = String(row[BIND_COL.RESEARCH_ID]);

    // 寫入個資對照表
    var writeOk = _writeToPrivacyTable_(researchId, lineUid);
    if (!writeOk) {
      return { ok: false, researchId: null, reason: '系統錯誤，請聯絡醫療團隊' };
    }

    // 更新 line_status → active
    _updateLineStatus(researchId, 'active');

    // 標記碼已使用
    sheet.getRange(i + 1, BIND_COL.USED     + 1).setValue(true);
    sheet.getRange(i + 1, BIND_COL.USED_AT  + 1).setValue(
      Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss')
    );
    sheet.getRange(i + 1, BIND_COL.BOUND_UID + 1).setValue(lineUid);

    Logger.log('[validateAndBind_] 綁定成功：' + researchId + ' ← ' + lineUid);
    return { ok: true, researchId: researchId, reason: '' };
  }

  return { ok: false, researchId: null, reason: '找不到此綁定碼，請確認數字是否正確' };
}

// ──────────────────────────────────────────────────────────
// 內部工具
// ──────────────────────────────────────────────────────────

function _getOrCreateBindSheet_(ss) {
  var sheet = ss.getSheetByName(SHEET.BINDING_CODE);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET.BINDING_CODE);
    sheet.appendRow(['code','research_id','created_at','expires_at','used','used_at','bound_uid']);
  }
  return sheet;
}

/** 產生不重複的 6 位數碼 */
function _generateUniqueCode_(sheet) {
  var data      = sheet.getDataRange().getValues();
  var usedCodes = {};
  data.slice(1).forEach(function(r) { usedCodes[String(r[BIND_COL.CODE])] = true; });

  var code;
  var attempts = 0;
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
    attempts++;
    if (attempts > 100) throw new Error('無法產生唯一綁定碼');
  } while (usedCodes[code]);

  return code;
}

/** 若病患已有未使用且未過期的碼，直接回傳（避免重複產生） */
function _getActiveCodeForPatient_(sheet, researchId) {
  var data = sheet.getDataRange().getValues();
  var now  = new Date();
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[BIND_COL.RESEARCH_ID]) !== String(researchId)) continue;
    if (row[BIND_COL.USED] === true) continue;
    if (new Date(row[BIND_COL.EXPIRES_AT]) > now) return String(row[BIND_COL.CODE]);
  }
  return null;
}

/** 寫入或更新個資對照表（research_id ↔ line_uid），保留既有 chart_number */
function _writeToPrivacyTable_(researchId, lineUid) {
  var privacySheetId = getConfig_('PRIVACY_TABLE_ID');
  if (!privacySheetId) {
    Logger.log('[_writeToPrivacyTable_] 未設定 PRIVACY_TABLE_ID');
    return false;
  }
  try {
    var sheet = SpreadsheetApp.openById(privacySheetId).getSheets()[0];
    var data  = sheet.getDataRange().getValues();

    // 找到已有的 research_id → 只更新 LINE UID，保留 chart_number
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][PRIVACY_COL.RESEARCH_ID]) === String(researchId)) {
        sheet.getRange(i + 1, PRIVACY_COL.LINE_UID + 1).setValue(lineUid);
        return true;
      }
    }

    // 沒有 → 新增（chart_number 留空）
    sheet.appendRow([researchId, lineUid, '']);
    return true;
  } catch (e) {
    Logger.log('[_writeToPrivacyTable_] Exception: ' + e.message);
    notifyAdminError_('個資對照表寫入失敗', e.message + '\nresearch_id=' + researchId);
    return false;
  }
}
