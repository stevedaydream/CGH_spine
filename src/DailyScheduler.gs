// ============================================================
// DailyScheduler.gs — 每日推播排程器（每天 08:00 觸發）
// ============================================================

/**
 * 主排程函式，由時間觸發器每天 08:00 呼叫。
 * 掃描所有 active 病患，判斷今天是否為推播日，防重複後發送。
 */
function dailyPushScheduler() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var opSheet = ss.getSheetByName(SHEET.OPERATION);
  var logSheet = ss.getSheetByName(SHEET.PUSH_LOG);
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var patients = opSheet.getDataRange().getValues();
  var errors = [];

  // 從第 2 列開始（跳過標頭）
  for (var i = 1; i < patients.length; i++) {
    var row = patients[i];
    var researchId = row[OP_COL.RESEARCH_ID];
    if (!researchId) continue;

    var opDate = new Date(row[OP_COL.OP_DATE]);
    if (isNaN(opDate.getTime())) continue;

    var lineStatus        = row[OP_COL.LINE_STATUS];
    var interventionGroup = row[OP_COL.INTERVENTION_GROUP];
    var daysPostOp        = daysDiff_(opDate, today);

    // 僅追蹤 line_bot 與 partial 組
    if (interventionGroup === 'control') continue;

    // 未綁定或已封鎖則跳過
    if (lineStatus !== 'active') {
      _appendPushLog(logSheet, researchId, daysPostOp, today, 'skipped', lineStatus, '');
      continue;
    }

    // 今天不是推播日則略過（不寫 log，避免 log 爆量）
    if (!isScheduledDay(daysPostOp)) continue;

    // 防重複：今天已推播過
    if (alreadySentToday(logSheet, researchId, today)) {
      _appendPushLog(logSheet, researchId, daysPostOp, today, 'skipped', 'already_sent', '');
      continue;
    }

    // 個人化訊息（帶入上次數據）
    var lastRecord = getLastRecord(researchId);
    var message = _buildPushMessage(researchId, daysPostOp, lastRecord);

    // 發送 Line 推播（附 Quick Reply 開始填寫按鈕）
    try {
      var success = sendLineMessageWithQuickReply(researchId, message, [
        { label: '開始填寫問卷', text: '開始填寫' }
      ]);
      _appendPushLog(logSheet, researchId, daysPostOp, today,
        success ? 'sent' : 'failed', '', success ? '' : 'Line API 回傳失敗');
      if (!success) errors.push(researchId);
    } catch (e) {
      _appendPushLog(logSheet, researchId, daysPostOp, today, 'failed', '', e.message);
      errors.push(researchId);
    }
  }

  // 批次錯誤通知
  if (errors.length > 0) {
    notifyAdminError_(
      '每日推播排程失敗',
      '以下病患推播失敗：\n' + errors.join('\n') + '\n\n請至推播排程Log 查看詳情。'
    );
  }

  Logger.log('[dailyPushScheduler] 完成，日期=' + formatDate_(today) + '，失敗=' + errors.length);
}

/**
 * 判斷術後天數是否為預定推播日
 * @param {number} days  術後天數
 * @returns {boolean}
 */
function isScheduledDay(days) {
  return PUSH_SCHEDULE_DAYS.indexOf(days) !== -1;
}

/**
 * 確認今天是否已對此病患推播過（防重複）
 * @param {Sheet}  logSheet    推播排程Log 分頁
 * @param {string} researchId
 * @param {Date}   today       今日 00:00:00
 * @returns {boolean}
 */
function alreadySentToday(logSheet, researchId, today) {
  var data = logSheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var row = data[i];
    if (row[PUSH_COL.RESEARCH_ID] !== researchId) continue;
    if (row[PUSH_COL.STATUS] !== 'sent') continue;

    var sentAt = new Date(row[PUSH_COL.SENT_AT]);
    sentAt.setHours(0, 0, 0, 0);
    if (sentAt.getTime() === today.getTime()) return true;
  }
  return false;
}

/**
 * 建立個人化推播訊息
 * @param {string}      researchId
 * @param {number}      daysPostOp   術後天數
 * @param {Object|null} lastRecord   { vasBack, vasLeg, daysPostOp }
 * @returns {string}
 */
function _buildPushMessage(researchId, daysPostOp, lastRecord) {
  var greeting = '您好，今天是術後第 ' + daysPostOp + ' 天 🌿\n\n';

  var context = '';
  if (lastRecord && lastRecord.vasBack !== '' && lastRecord.vasLeg !== '') {
    context = '上次您回報腰痛 ' + lastRecord.vasBack + ' 分、腳痛 ' + lastRecord.vasLeg + ' 分，\n';
  }

  var prompt =
    '今天感覺如何呢？\n\n' +
    '可以直接用說的告訴我，例如：\n' +
    '「腳不痛了，腰還有點緊」\n\n' +
    '或直接回覆數字：\n' +
    '背痛 ___ 分 / 腿痛 ___ 分（0-10）';

  return greeting + context + prompt;
}

/**
 * 新增一筆推播 log
 */
function _appendPushLog(logSheet, researchId, scheduledDay, scheduledDate, status, skipReason, errorMsg) {
  logSheet.appendRow([
    researchId,
    scheduledDay,
    formatDate_(scheduledDate),
    status === 'sent' ? Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss') : '',
    status,
    skipReason,
    errorMsg
  ]);
}
