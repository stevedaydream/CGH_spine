// ============================================================
// LineWebhook.gs — Line Bot Webhook 接收器
// 部署為 Web App 後，將 URL 填入 Line Developers Console
// ============================================================

/**
 * Line Webhook 進入點（POST）
 * GAS Web App 以 doPost 接收 Line 推送事件
 */
function doPost(e) {
  // 立即回傳 200，確保 Line 不會 timeout
  var output = ContentService.createTextOutput('OK');

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return output;
    }
    var body = JSON.parse(e.postData.contents);
    var events = body.events;

    if (!events || events.length === 0) {
      return ContentService.createTextOutput('OK');
    }

    events.forEach(function(event) {
      if (event.type === 'message' && event.message.type === 'text') {
        _handleTextMessage(event);
      } else if (event.type === 'follow') {
        _handleFollow(event);
      } else if (event.type === 'unfollow') {
        _handleUnfollow(event);
      }
    });
  } catch (err) {
    Logger.log('[doPost] Exception: ' + err.message);
    notifyAdminError_('Webhook 處理錯誤', err.message + '\n\n' + JSON.stringify(e && e.postData));
  }

  return output;
}

// ---------- 文字訊息處理 ----------
function _handleTextMessage(event) {
  var lineUid    = event.source.userId;
  var replyToken = event.replyToken;
  var rawMessage = event.message.text.trim();
  Logger.log('[DEBUG] lineUid=' + lineUid);

  // 查找對應的研究編號
  var researchId = _lookupResearchIdByUid(lineUid);
  if (!researchId) {
    replyLineMessage(replyToken, '您的 Line UID：\n' + lineUid);
    return;
  }

  // 確認病患狀態是否為 active
  var opRecord = getOperationRecord(researchId);
  if (!opRecord || opRecord.lineStatus !== 'active') {
    replyLineMessage(replyToken, '您好，您目前的追蹤狀態暫停中。\n如有疑問請聯絡醫療團隊。');
    return;
  }

  // 呼叫 Gemini 解析訊息
  var parsed = parsePatientMessage(rawMessage);

  // 寫入 AI 暫存待確認區
  _writeToStaging(researchId, rawMessage, parsed);

  // 回覆病患
  var reply =
    '感謝您的回覆！✅\n\n' +
    '我們已記錄您今天的狀況。\n' +
    '醫療團隊會定期查看您的恢復狀況，\n' +
    '如有任何不適請隨時告知或直接聯絡醫院。\n\n' +
    '祝您早日康復 🙏';

  replyLineMessage(replyToken, reply);

  Logger.log('[_handleTextMessage] research_id=' + researchId + ' | vas_back=' + parsed.vasBack + ' | vas_leg=' + parsed.vasLeg);
}

// ---------- 使用者加入好友 ----------
function _handleFollow(event) {
  var lineUid    = event.source.userId;
  var replyToken = event.replyToken;

  // 通知管理員有新用戶需要綁定
  notifyAdminError_(
    '新病患加入 Line Bot',
    '有新病患加入好友，Line UID：' + lineUid + '\n請至個資對照表完成研究編號綁定。'
  );

  replyLineMessage(replyToken,
    '您好！歡迎使用脊椎手術術後追蹤系統 🏥\n\n' +
    '請聯絡醫療團隊完成帳號綁定後，\n' +
    '系統將依據您的術後時程定期提醒您回報狀況。\n\n' +
    '感謝您的配合！'
  );
}

// ---------- 使用者封鎖 ----------
function _handleUnfollow(event) {
  var lineUid = event.source.userId;
  var researchId = _lookupResearchIdByUid(lineUid);

  if (researchId) {
    // 更新手術記錄表中的 line_status 為 blocked
    _updateLineStatus(researchId, 'blocked');
    Logger.log('[_handleUnfollow] research_id=' + researchId + ' 封鎖 Line Bot');
  }
}

// ---------- 寫入暫存待確認區 ----------
function _writeToStaging(researchId, rawMessage, parsed) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.AI_STAGING);
  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');

  sheet.appendRow([
    researchId,
    rawMessage,
    parsed.vasBack !== null ? parsed.vasBack : '',
    parsed.vasLeg  !== null ? parsed.vasLeg  : '',
    parsed.summary,
    now,
    'pending',
    '',
    ''
  ]);
}

// ---------- 透過 Line UID 查找研究編號 ----------
function _lookupResearchIdByUid(lineUid) {
  var privacySheetId = getConfig_('PRIVACY_TABLE_ID');
  if (!privacySheetId) return null;

  try {
    var privacySS = SpreadsheetApp.openById(privacySheetId);
    var sheet = privacySS.getSheets()[0];
    var data = sheet.getDataRange().getValues();
    // 個資對照表格式：research_id | line_uid
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(lineUid)) {
        return String(data[i][0]);
      }
    }
  } catch (e) {
    Logger.log('[_lookupResearchIdByUid] Exception: ' + e.message);
  }
  return null;
}

// ---------- 更新手術記錄表的 line_status ----------
function _updateLineStatus(researchId, newStatus) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.OPERATION);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][OP_COL.RESEARCH_ID] === researchId) {
      sheet.getRange(i + 1, OP_COL.LINE_STATUS + 1).setValue(newStatus);
      return;
    }
  }
}
