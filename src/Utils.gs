// ============================================================
// Utils.gs — 共用工具函式
// ============================================================

/**
 * 透過 Line Messaging API 推播訊息給單一病患
 * @param {string} researchId  研究編號，用於查詢個資對照表取得 Line UID
 * @param {string} message     推播文字訊息
 * @returns {boolean} 是否成功
 */
function sendLineMessage(researchId, message) {
  try {
    var uid = _getLineUid(researchId);
    if (!uid) {
      Logger.log('[sendLineMessage] 找不到 Line UID，research_id=' + researchId);
      return false;
    }

    var token = getConfig_('LINE_CHANNEL_ACCESS_TOKEN');
    var payload = JSON.stringify({
      to: uid,
      messages: [{ type: 'text', text: message }]
    });

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + token },
      payload: payload,
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
    var code = response.getResponseCode();

    if (code === 200) {
      return true;
    } else {
      Logger.log('[sendLineMessage] 失敗 HTTP ' + code + '：' + response.getContentText());
      return false;
    }
  } catch (e) {
    Logger.log('[sendLineMessage] Exception: ' + e.message);
    notifyAdminError_('sendLineMessage 發生錯誤', e.message + '\nresearch_id=' + researchId);
    return false;
  }
}

/**
 * 透過 Line Messaging API 回覆 Webhook 訊息（reply token 模式）
 * @param {string} replyToken  Line Webhook 回傳的 replyToken
 * @param {string} message     回覆文字
 */
function replyLineMessage(replyToken, message) {
  var token = getConfig_('LINE_CHANNEL_ACCESS_TOKEN');
  var payload = JSON.stringify({
    replyToken: replyToken,
    messages: [{ type: 'text', text: message }]
  });

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + token },
    payload: payload,
    muteHttpExceptions: true
  };

  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', options);
}

/**
 * 取得某病患最近一筆已確認的追蹤記錄
 * @param {string} researchId
 * @returns {Object|null} { vasBack, vasLeg, daysPostOp, logDatetime }
 */
function getLastRecord(researchId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.FOLLOW_UP);
  var data = sheet.getDataRange().getValues();

  var lastRow = null;
  for (var i = data.length - 1; i >= 1; i--) {
    var row = data[i];
    if (row[LOG_COL.RESEARCH_ID] === researchId && row[LOG_COL.CONFIRMED] === true) {
      lastRow = row;
      break;
    }
  }

  if (!lastRow) return null;
  return {
    vasBack:     lastRow[LOG_COL.VAS_BACK],
    vasLeg:      lastRow[LOG_COL.VAS_LEG],
    daysPostOp:  lastRow[LOG_COL.DAYS_POST_OP],
    logDatetime: lastRow[LOG_COL.LOG_DATETIME]
  };
}

/**
 * 取得手術記錄表中某病患的基本資料
 * @param {string} researchId
 * @returns {Object|null}
 */
function getOperationRecord(researchId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.OPERATION);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][OP_COL.RESEARCH_ID] === researchId) {
      return {
        opDate:            new Date(data[i][OP_COL.OP_DATE]),
        surgeon:           data[i][OP_COL.SURGEON],
        opName:            data[i][OP_COL.OP_NAME],
        lineStatus:        data[i][OP_COL.LINE_STATUS],
        interventionGroup: data[i][OP_COL.INTERVENTION_GROUP],
        rowIndex:          i + 1  // 1-based Sheet row
      };
    }
  }
  return null;
}

/**
 * 產生下一個追蹤日誌流水號
 * @returns {string}  例如 LOG-000123
 */
function generateLogId() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.FOLLOW_UP);
  var lastRow = sheet.getLastRow();
  var num = Math.max(lastRow, 1);
  return 'LOG-' + String(num).padStart(6, '0');
}

/**
 * 發送錯誤通知 Email 給管理員
 * @param {string} subject
 * @param {string} body
 */
function notifyAdminError_(subject, body) {
  var email = getConfig_('ADMIN_EMAIL');
  if (!email) return;
  try {
    MailApp.sendEmail(email, '[脊椎追蹤系統] 錯誤通知：' + subject, body);
  } catch (e) {
    Logger.log('[notifyAdminError_] 無法發送 Email：' + e.message);
  }
}

/**
 * 從個資對照表（Drive 獨立檔案）查詢 Line UID
 * 對照表需有兩欄：research_id | line_uid
 * @param {string} researchId
 * @returns {string|null}
 */
function _getLineUid(researchId) {
  var privacySheetId = getConfig_('PRIVACY_TABLE_ID');
  if (!privacySheetId) {
    Logger.log('[_getLineUid] 未設定 PRIVACY_TABLE_ID');
    return null;
  }
  try {
    var privacySS = SpreadsheetApp.openById(privacySheetId);
    var sheet = privacySS.getSheets()[0];
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(researchId)) {
        return String(data[i][1]);
      }
    }
  } catch (e) {
    Logger.log('[_getLineUid] Exception: ' + e.message);
  }
  return null;
}

/**
 * 格式化日期為 YYYY/MM/DD
 */
function formatDate_(date) {
  var d = new Date(date);
  return d.getFullYear() + '/' +
    String(d.getMonth() + 1).padStart(2, '0') + '/' +
    String(d.getDate()).padStart(2, '0');
}

/**
 * 計算兩日期相差天數
 */
function daysDiff_(dateA, dateB) {
  var a = new Date(dateA);
  var b = new Date(dateB);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400000);
}
