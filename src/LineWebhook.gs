// ============================================================
// LineWebhook.gs — LINE Bot Webhook（14步問卷狀態機 + Gemini 對話）
// ============================================================

function doPost(e) {
  var output = ContentService.createTextOutput('OK');
  try {
    if (!e || !e.postData || !e.postData.contents) return output;
    var body   = JSON.parse(e.postData.contents);
    var events = body.events;
    if (!events || events.length === 0) return output;

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
    Logger.log('[doPost] ' + err.message);
    notifyAdminError_('Webhook 處理錯誤', err.message);
  }
  return output;
}

// ── 主入口 ────────────────────────────────────────────────────
function _handleTextMessage(event) {
  var lineUid    = event.source.userId;
  var replyToken = event.replyToken;
  var rawMessage = event.message.text.trim();

  // 載入回覆設定（容錯，Sheet 12 不存在時回傳空物件）
  var RS = _loadReplySettings();

  // ── 綁定碼攔截（6 位數字，最優先處理）────────────────────
  if (/^\d{6}$/.test(rawMessage)) {
    var bindResult = validateAndBind_(rawMessage, lineUid);
    if (bindResult.ok) {
      replyLineMessage(replyToken, _fillPlaceholders(
        _getReplyContent(RS, 'binding_success',
          '🎉 綁定成功！\n\n您已完成術後追蹤系統帳號綁定 ✅\n研究編號：{researchId}\n\n' +
          '系統將依術後時程定期傳送問卷提醒，\n您也可以隨時傳「開始填寫」進行回報。\n\n感謝您的配合，祝您早日康復 🌿'),
        { researchId: bindResult.researchId }
      ));
    } else {
      replyLineMessage(replyToken, _fillPlaceholders(
        _getReplyContent(RS, 'binding_fail',
          '⚠️ 綁定失敗\n\n原因：{reason}\n\n請確認數字是否正確，\n或向醫護人員重新索取綁定碼。'),
        { reason: bindResult.reason }
      ));
    }
    return;
  }

  var state = _getState(lineUid);

  // 問卷進行中：交給狀態機處理
  if (state.step !== 'idle' && state.step !== 'chat' && state.step !== 'paused') {
    // 中途離開指令
    var exitWords = ['離開', '取消', '結束', '先不填', '停止', 'exit', 'quit'];
    if (exitWords.indexOf(rawMessage) !== -1) {
      var pausedIdx = QUESTION_STEPS.indexOf(state.step);
      _saveState(state.rowIndex, lineUid, state.sessionData.researchId || '', 'paused', state.sessionData, state.tpTarget);
      replyLineMessage(replyToken, _fillPlaceholders(
        _getReplyContent(RS, 'questionnaire_paused',
          '問卷已暫停 📋\n\n目前進度：第 {progress}／{total} 題\n\n【已填選項】\n{preview}\n\n下次點選「填寫問卷」可選擇繼續或重新開始。'),
        { progress: String(pausedIdx + 1), total: String(QUESTION_STEPS.length), preview: _buildProgressPreview(state.sessionData) }
      ));
      return;
    }
    _handleQuestionnaireStep(replyToken, lineUid, state, rawMessage, RS);
    return;
  }

  // 查找研究編號（優先從 state 取，避免重複查 Drive）
  var researchId = state.sessionData.researchId || _lookupResearchIdByUid(lineUid);
  if (!researchId) {
    replyLineMessage(replyToken, '您的 LINE UID：\n' + lineUid + '\n\n請聯絡醫療團隊完成帳號綁定。');
    return;
  }

  // 把 researchId 存入 state（加速後續查詢）
  if (!state.sessionData.researchId) {
    state.sessionData.researchId = researchId;
    _saveState(state.rowIndex, lineUid, researchId, 'idle', state.sessionData, '');
  }

  var opRecord = getOperationRecord(researchId);
  if (!opRecord || opRecord.lineStatus !== 'active') {
    replyLineMessage(replyToken, '您好，您目前的追蹤狀態暫停中。\n如有疑問請聯絡醫療團隊。');
    return;
  }

  // 觸發詞：開始問卷
  var triggerWords = ['開始', '開始填寫', '填寫問卷', '回報', '開始回報'];
  if (triggerWords.indexOf(rawMessage) !== -1) {
    // 有暫存進度 → 詢問繼續或重新開始
    if (state.step === 'paused') {
      var pausedIdx = QUESTION_STEPS.indexOf(state.sessionData._pausedStep || '') + 1 ||
                      _countAnswered(state.sessionData);
      replyWithQuickReply(replyToken,
        '📋 您有未完成的問卷\n\n' +
        '上次進度：第 ' + pausedIdx + '／' + QUESTION_STEPS.length + ' 題\n\n' +
        '要繼續填寫，還是重新開始？',
        [
          { label: '▶ 繼續填寫', text: '繼續填寫' },
          { label: '🔄 重新開始', text: '重新開始' }
        ]
      );
      return;
    }
    _startQuestionnaire(replyToken, lineUid, researchId, state.rowIndex, opRecord);
    return;
  }

  // 繼續填寫（從暫停恢復）
  if (rawMessage === '繼續填寫' && state.step === 'paused') {
    var resumeStep = _findResumeStep(state.sessionData);
    var resumeIdx  = QUESTION_STEPS.indexOf(resumeStep);
    _saveState(state.rowIndex, lineUid, researchId, resumeStep, state.sessionData, state.tpTarget);
    var bubble = _buildFlexBubbleForStep(resumeStep, resumeIdx, '▶ 繼續上次進度', RS);
    replyWithFlex(replyToken, '問卷 ' + (resumeIdx + 1) + '/' + QUESTION_STEPS.length, bubble);
    return;
  }

  // 重新開始（清除暫存，從頭填）
  if (rawMessage === '重新開始' && state.step === 'paused') {
    _startQuestionnaire(replyToken, lineUid, researchId, state.rowIndex, opRecord);
    return;
  }

  // 觸發詞：查看記錄
  var recordWords = ['查看記錄', '我的記錄', '查看我的記錄', '記錄'];
  if (recordWords.indexOf(rawMessage) !== -1) {
    _handleViewRecord(replyToken, researchId, opRecord);
    return;
  }

  // 觸發詞：AI 諮詢（明確進入對話模式）
  var chatWords = ['諮詢', 'AI諮詢', '我要諮詢', '問問題'];
  if (chatWords.indexOf(rawMessage) !== -1) {
    _handleChatEntry(replyToken, opRecord);
    return;
  }

  // QA 類別快速按鈕：QA_CAT:類別名  或  QA_CAT:類別名:qaId（子問題）
  if (rawMessage.indexOf('QA_CAT:') === 0) {
    var catPayload = rawMessage.slice(7);
    var colonIdx   = catPayload.indexOf(':');
    var catName    = colonIdx === -1 ? catPayload : catPayload.slice(0, colonIdx);
    var qaId       = colonIdx === -1 ? null        : catPayload.slice(colonIdx + 1);
    _handleQaCategory(replyToken, catName, opRecord, qaId);
    return;
  }

  // 設定驅動的觸發詞（聯絡門診、網路掛號、使用說明、直接提問 等）
  // triggerMap 由 Sheet 12 動態產生，fallback 到硬寫預設
  var settingKey = RS.triggerMap[rawMessage];
  if (!settingKey) {
    // 硬寫 fallback（Sheet 12 尚未建立時保持功能正常）
    var _fbMap = {
      '直接提問': 'chat_direct_prompt',
      '聯絡門診': 'contact_clinic', '聯絡醫師': 'contact_clinic',
      '電話': 'contact_clinic', '門診電話': 'contact_clinic',
      '網路掛號': 'appointment_url', '掛號': 'appointment_url', '預約': 'appointment_url',
      '使用說明': 'how_to_use', '說明': 'how_to_use',
      '幫助': 'how_to_use', 'help': 'how_to_use', '怎麼用': 'how_to_use'
    };
    settingKey = _fbMap[rawMessage] || null;
  }
  if (settingKey) {
    var _fallbacks = {
      chat_direct_prompt: '請直接輸入您想問的問題 ✍️\n我會根據您的術後狀況給予參考說明。',
      contact_clinic:     '汐止國泰醫院骨科門診\n📞 02-2648-2121 轉 5032\n\n緊急狀況請直接前往急診。',
      appointment_url:    '網路掛號請至以下連結：\nhttps://reg.cgh.org.tw/tw/reg/main.jsp\n\n或電話：02-2648-2121 轉 5032',
      how_to_use:         '📋 汐止國泰醫院骨科術後追蹤系統\n\n【主要功能】\n✅ 填寫問卷 — 回報今日疼痛狀況\n📊 我的記錄 — 查看最近一筆記錄\n💬 AI 諮詢 — 詢問術後相關問題\n📞 聯絡門診 — 取得診所電話\n\n如有任何問題請撥：02-2648-2121 轉 5032'
    };
    replyLineMessage(replyToken, _getReplyContent(RS, settingKey, _fallbacks[settingKey] || ''));
    return;
  }

  // 自訂關鍵字規則（優先於 Gemini）
  var customReply = _checkKeywordRules(RS, rawMessage);
  if (customReply) {
    replyLineMessage(replyToken, customReply);
    return;
  }

  // 其餘訊息：Gemini context injection 對話模式
  _handleChatMode(replyToken, lineUid, researchId, rawMessage, opRecord);
}

// ── 問卷啟動 ──────────────────────────────────────────────────
function _startQuestionnaire(replyToken, lineUid, researchId, rowIndex, opRecord) {
  var daysPostOp = daysDiff_(opRecord.opDate, new Date());
  var tpTarget   = 'D' + daysPostOp;
  var sessionData = { researchId: researchId };

  _saveState(rowIndex, lineUid, researchId, 'vas_back', sessionData, tpTarget);

  var RS     = _loadReplySettings();
  var bubble = _buildFlexBubbleForStep('vas_back', 0, '好的！開始今天（術後第 ' + daysPostOp + ' 天）的問卷 📋', RS);
  replyWithFlex(replyToken, '問卷 1/' + QUESTION_STEPS.length + '：背部疼痛評分', bubble);
}

// ── 問卷步驟處理 ──────────────────────────────────────────────
function _handleQuestionnaireStep(replyToken, lineUid, state, rawMessage, RS) {
  RS = RS || {};
  var step        = state.step;
  var sessionData = state.sessionData;

  var value = _parseStepValue(step, rawMessage);

  if (value === null) {
    // 回傳無效，重送本題
    var idx    = QUESTION_STEPS.indexOf(step);
    var bubble = _buildFlexBubbleForStep(step, idx, '⚠️ 請選擇有效選項', RS);
    replyWithFlex(replyToken, '⚠️ 請重新選擇', bubble);
    return;
  }

  // 儲存本題答案
  sessionData[step] = value;

  var nextIdx = QUESTION_STEPS.indexOf(step) + 1;

  if (nextIdx >= QUESTION_STEPS.length) {
    // 所有題目完成
    _completeQuestionnaire(replyToken, lineUid, state.rowIndex, sessionData, state.tpTarget);
    return;
  }

  var nextStep = QUESTION_STEPS[nextIdx];
  _saveState(state.rowIndex, lineUid, sessionData.researchId, nextStep, sessionData, state.tpTarget);

  var bubble = _buildFlexBubbleForStep(nextStep, nextIdx, null, RS);
  replyWithFlex(replyToken, '問卷 ' + (nextIdx + 1) + '/' + QUESTION_STEPS.length, bubble);
}

// ── 問卷完成：寫入 Sheets ─────────────────────────────────────
function _completeQuestionnaire(replyToken, lineUid, rowIndex, sessionData, tpTarget) {
  var researchId = sessionData.researchId;
  var opRecord   = getOperationRecord(researchId);
  var now        = new Date();
  var daysPostOp = daysDiff_(opRecord.opDate, now);
  var logId      = generateLogId();

  // 計算 ODI 百分比
  var odiRaw = 0;
  for (var q = 1; q <= 10; q++) {
    odiRaw += (sessionData['odi_q' + q] || 0);
  }
  var odiScore = Math.round(odiRaw / 50 * 100);

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.FOLLOW_UP);
  sheet.appendRow([
    logId,
    researchId,
    Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'),
    daysPostOp,
    sessionData.vas_back !== undefined ? sessionData.vas_back : '',
    sessionData.vas_leg  !== undefined ? sessionData.vas_leg  : '',
    '',            // odi_description
    '',            // wound_status
    'LINE問卷',    // raw_message
    'direct',      // record_type
    true,          // confirmed
    odiScore,      // odi_score
    sessionData.pass     || '',
    sessionData.anchor_q || ''
  ]);

  // 寫入 ODI 明細表（LINE Bot 問卷才有各題分數）
  _writeOdiDetail(ss, logId, researchId, now, daysPostOp, sessionData, odiRaw, odiScore);

  _clearState(rowIndex, lineUid);

  // 問卷完成後推送適用衛教（延遲發送，先回覆問卷結果）
  _pushHealthEduAfterQuestionnaire(lineUid, researchId, daysPostOp);

  var anchorLabel  = _getAnchorLabel(sessionData.anchor_q);
  var passLabel    = sessionData.pass === 'Y' ? '✅ 可接受' : '❌ 還不滿意';
  var odiSeverity  = _getOdiSeverity(odiScore);

  var RS = _loadReplySettings();
  replyLineMessage(replyToken, _fillPlaceholders(
    _getReplyContent(RS, 'questionnaire_complete',
      '✅ 問卷填寫完成！感謝您的回報。\n\n術後第 {daysPostOp} 天記錄已儲存：\n  背痛：{vasBack} 分\n  腿痛：{vasLeg} 分\n  ODI：{odiScore}%\n\n如有任何不適請聯絡門診：02-2648-2121 轉 5032\n感謝您的配合，祝您早日康復 🌿'),
    { daysPostOp: daysPostOp, vasBack: sessionData.vas_back, vasLeg: sessionData.vas_leg, odiScore: odiScore }
  ));
}

// ── 查看最近記錄 ──────────────────────────────────────────
function _handleViewRecord(replyToken, researchId, opRecord) {
  var last = getLastRecord(researchId);
  var daysPostOp = daysDiff_(opRecord.opDate, new Date());

  if (!last) {
    replyLineMessage(replyToken,
      '📊 目前尚無回報記錄\n\n' +
      '術後第 ' + daysPostOp + ' 天\n\n' +
      '點選下方「填寫問卷」開始第一次回報！'
    );
    return;
  }

  var odiText = (last.odiScore !== '' && last.odiScore !== null && last.odiScore !== undefined)
    ? '\n  ODI：' + last.odiScore + '%（' + _getOdiSeverity(last.odiScore) + '）'
    : '';

  replyLineMessage(replyToken,
    '📊 您的最近一筆記錄\n\n' +
    '術後第 ' + last.daysPostOp + ' 天（' + last.logDatetime.toString().slice(0, 10) + '）\n' +
    '  背痛：' + last.vasBack + ' 分\n' +
    '  腿痛：' + last.vasLeg + ' 分' +
    odiText + '\n\n' +
    '目前術後第 ' + daysPostOp + ' 天\n' +
    '如需更新，點選「填寫問卷」重新回報。'
  );
}

// ── 諮詢入口：顯示類別快速選單 ───────────────────────────────
function _handleChatEntry(replyToken, opRecord) {
  var daysPostOp = opRecord ? daysDiff_(opRecord.opDate, new Date()) : null;
  var qaItems    = _loadActiveQaItems(daysPostOp);

  if (qaItems.length === 0) {
    replyLineMessage(replyToken,
      '您好！有什麼問題想詢問嗎？🌿\n\n請直接輸入您想問的問題。\n（緊急狀況請電：02-2648-2121 轉 5032）'
    );
    return;
  }

  // 每個類別取第一筆（顯示排序最前）
  var seen = {};
  var items = [];
  qaItems.forEach(function(q) {
    if (!q.category || seen[q.category]) return;
    seen[q.category] = true;
    var label = q.category.length > 18 ? q.category.slice(0, 18) + '…' : q.category;
    items.push({ label: label, text: 'QA_CAT:' + q.category });
  });
  // 最多 12 類 + 自由提問按鈕（LINE Quick Reply 上限 13）
  items = items.slice(0, 12);
  items.push({ label: '✍️ 直接提問', text: '直接提問' });

  replyWithQuickReply(replyToken,
    '您好！以下是常見衛教主題 🌿\n' +
    (daysPostOp != null ? '（術後第 ' + daysPostOp + ' 天適用）\n' : '') +
    '請點選主題或直接輸入問題：',
    items
  );
}

// ── 顯示指定類別的衛教內容 ────────────────────────────────────
// qaId：若非 null，優先顯示該 ID 的問題（子問題按鈕點擊時傳入）
function _handleQaCategory(replyToken, category, opRecord, qaId) {
  var daysPostOp = opRecord ? daysDiff_(opRecord.opDate, new Date()) : null;
  var qaItems    = _loadActiveQaItems(daysPostOp);
  var inCat      = qaItems.filter(function(q) { return q.category === category; });

  if (inCat.length === 0) {
    replyLineMessage(replyToken, '目前此主題尚無衛教資料。\n請直接輸入您的問題，或聯絡門診：02-2648-2121 轉 5032');
    return;
  }

  // 若指定 qaId，優先顯示該筆；否則顯示類別第一筆
  var qa = inCat[0];
  if (qaId) {
    var found = inCat.filter(function(q) { return String(q.id) === String(qaId); });
    if (found.length > 0) qa = found[0];
  }

  var text = '【' + qa.category + '】\n' + qa.question + '\n\n' + qa.answer;
  if (qa.videoUrl) {
    text += '\n\n🎬 衛教影片：\n' + qa.videoUrl;
  }
  if (qa.pdfUrl) {
    text += '\n\n📄 衛教單張：\n' + qa.pdfUrl;
  }

  // 若同類別有多筆，附上其他問題快速按鈕
  var moreItems = inCat.slice(1, 5).map(function(q) {
    var label = q.question.length > 18 ? q.question.slice(0, 18) + '…' : q.question;
    return { label: label, text: 'QA_CAT:' + q.category + ':' + q.id };
  });
  moreItems.push({ label: '📋 其他主題', text: '諮詢' });

  replyWithQuickReply(replyToken, text, moreItems);
}

// ── Gemini 對話模式 ───────────────────────────────────────────
function _handleChatMode(replyToken, lineUid, researchId, rawMessage, opRecord) {
  var daysPostOp = daysDiff_(opRecord.opDate, new Date());

  // 先嘗試 QA 比對
  var qaItems = _loadActiveQaItems(daysPostOp);
  if (qaItems.length > 0) {
    var matched = matchHealthEduQuestion(rawMessage, qaItems);
    if (matched) {
      var text = '【' + matched.category + '】\n' + matched.question + '\n\n' + matched.answer;
      if (matched.videoUrl) text += '\n\n🎬 衛教影片：\n' + matched.videoUrl;
      if (matched.pdfUrl)   text += '\n\n📄 衛教單張：\n' + matched.pdfUrl;
      replyLineMessage(replyToken, text);
      return;
    }
  }

  // 無匹配 → Gemini context injection
  var lastRecord = getLastRecord(researchId);
  var patientCtx = {
    daysPostOp:     daysPostOp,
    opName:         opRecord.opName,
    lastVasBack:    lastRecord ? lastRecord.vasBack    : '無記錄',
    lastVasLeg:     lastRecord ? lastRecord.vasLeg     : '無記錄',
    lastReportDays: lastRecord ? lastRecord.daysPostOp : '無記錄'
  };

  var result = chatWithPatient(rawMessage, patientCtx);

  if (result.vasBack !== null || result.vasLeg !== null) {
    _writeToStaging(researchId, rawMessage, { vasBack: result.vasBack, vasLeg: result.vasLeg, summary: result.reply });
  }

  replyLineMessage(replyToken, result.reply);
}

// ── 載入有效衛教 QA（依術後天數篩選）────────────────────────
function _loadActiveQaItems(daysPostOp) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.HEALTH_EDU);
  if (!sheet || sheet.getLastRow() < 2) return [];

  return sheet.getDataRange().getValues().slice(1)
    .filter(function(r) {
      if (!r[HEALTH_EDU_COL.ID])             return false;
      if (r[HEALTH_EDU_COL.ACTIVE] !== true) return false;
      // 術後天數篩選（空欄 = 不限）
      if (daysPostOp != null) {
        var from = r[HEALTH_EDU_COL.DAYS_FROM];
        var to   = r[HEALTH_EDU_COL.DAYS_TO];
        if (from !== '' && from != null && Number(daysPostOp) < Number(from)) return false;
        if (to   !== '' && to   != null && Number(daysPostOp) > Number(to))   return false;
      }
      return true;
    })
    .map(function(r) {
      return {
        id:           String(r[HEALTH_EDU_COL.ID]),
        category:     String(r[HEALTH_EDU_COL.CATEGORY]     || ''),
        question:     String(r[HEALTH_EDU_COL.QUESTION]     || ''),
        answer:       String(r[HEALTH_EDU_COL.ANSWER]        || ''),
        videoUrl:     String(r[HEALTH_EDU_COL.VIDEO_URL]    || ''),
        pdfUrl:       String(r[HEALTH_EDU_COL.PDF_URL]      || ''),
        displayOrder: Number(r[HEALTH_EDU_COL.DISPLAY_ORDER] || 0)
      };
    })
    .sort(function(a, b) { return a.displayOrder - b.displayOrder; });
}

// ── 問卷完成後推送適用衛教 ────────────────────────────────────
function _pushHealthEduAfterQuestionnaire(lineUid, researchId, daysPostOp) {
  var items = _loadActiveQaItems(daysPostOp);
  if (items.length === 0) return;

  // 每類別取第一筆，最多 4 類
  var seen = {}, cats = [];
  items.forEach(function(q) {
    if (!q.category || seen[q.category] || cats.length >= 4) return;
    seen[q.category] = true;
    cats.push(q.category);
  });
  if (cats.length === 0) return;

  // 用 push API 發送純文字（push 不支援 Quick Reply）
  var lines = [
    '💡 術後第 ' + daysPostOp + ' 天衛教提醒',
    '',
    '以下主題適合您現階段參考：'
  ];
  cats.forEach(function(c) { lines.push('・' + c); });
  lines.push('');
  lines.push('傳送主題名稱即可查看詳細說明\n（如直接輸入「傷口護理」）');

  sendLineMessage(researchId, lines.join('\n'));
}

// ── Flex Message 格狀問卷題目 ─────────────────────────────────
// noteText（選填）：顯示在按鈕上方的提示文字，如 '⚠️ 請選擇有效選項'
// RS（選填）：_loadReplySettings() 結果，用於取問卷步驟說明文字

function _buildFlexBubbleForStep(step, stepIndex, noteText, RS) {
  RS = RS || {};
  var progress = (stepIndex + 1) + '/' + QUESTION_STEPS.length;

  var COLORS = { vas: '#0D87CE', odi: '#00897B', pgic: '#8E24AA', pass: '#00B900' };

  function btn(label, val, style) {
    return { type: 'button', height: 'sm', style: style || 'secondary',
             action: { type: 'message', label: String(label), text: String(val) } };
  }
  function row(btns) {
    return { type: 'box', layout: 'horizontal', spacing: 'xs', contents: btns };
  }
  function filler() { return { type: 'filler' }; }
  function hdr(title, sub, color) {
    var rows = [{ type: 'text', text: title, color: '#ffffff', weight: 'bold', size: 'md', wrap: true }];
    if (sub) rows.push({ type: 'text', text: sub, color: '#cceeff', size: 'sm' });
    return { type: 'box', layout: 'vertical', paddingAll: 'md', backgroundColor: color, contents: rows };
  }

  var EXIT_BTN = { type: 'button', height: 'sm', style: 'secondary', color: '#AAAAAA',
                   action: { type: 'message', label: '✖ 離開問卷', text: '離開' } };
  var noteRows = noteText
    ? [{ type: 'text', text: noteText, size: 'sm', color: '#e74c3c', wrap: true, margin: 'sm' }]
    : [];

  // ── VAS（0–10）：3×4 格 ──
  if (step === 'vas_back' || step === 'vas_leg') {
    var title = (step === 'vas_back' ? '【背部疼痛評分】' : '【腿部疼痛評分】') + ' ' + progress;
    var vasSub = step === 'vas_back'
      ? _getReplyContent(RS, 'step_vas_back_sub', '0 = 完全不痛，10 = 最痛')
      : _getReplyContent(RS, 'step_vas_leg_sub',  '0 = 完全不痛，10 = 最痛');
    return { type: 'bubble',
      header: hdr(title, vasSub, COLORS.vas),
      body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: 'sm',
        contents: noteRows.concat([
          row([btn(0,0), btn(1,1), btn(2,2), btn(3,3)]),
          row([btn(4,4), btn(5,5), btn(6,6), btn(7,7)]),
          row([btn(8,8), btn(9,9), btn(10,10), filler()]),
          EXIT_BTN
        ])
      }
    };
  }

  // ── ODI（各題 0–5）：2×3 格 ──
  var odiIdx = parseInt(step.replace('odi_q', ''), 10) - 1;
  if (!isNaN(odiIdx) && odiIdx >= 0 && odiIdx < 10) {
    var q = ODI_QUESTIONS[odiIdx];
    var L = q.labels;
    return { type: 'bubble',
      header: hdr('【' + q.title + '】 ' + progress, '請選擇最符合您現況的選項', COLORS.odi),
      body: { type: 'box', layout: 'vertical', spacing: 'xs', paddingAll: 'sm',
        contents: noteRows.concat([
          row([btn(L[0], 0), btn(L[1], 1)]),
          row([btn(L[2], 2), btn(L[3], 3)]),
          row([btn(L[4], 4), btn(L[5], 5)]),
          EXIT_BTN
        ])
      }
    };
  }

  // ── PGIC anchor_q（7→1）：2 列+exit ──
  if (step === 'anchor_q') {
    return { type: 'bubble',
      header: hdr('【整體改善評估】 ' + progress, _getReplyContent(RS, 'step_anchor_q_desc', '和手術前相比，整體狀況如何？（7最佳，1最差）'), COLORS.pgic),
      body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: 'sm',
        contents: noteRows.concat([
          row([btn('7 非常改善', 7, 'primary'), btn('6 明顯改善', 6, 'primary')]),
          row([btn('5 稍微改善', 5),             btn('4 沒有變化', 4)]),
          row([btn('3 稍微惡化', 3),             btn('2 明顯惡化', 2)]),
          row([btn('1 非常惡化', 1),             filler()]),
          EXIT_BTN
        ])
      }
    };
  }

  // ── PASS（Y/N）：1×2 格 ──
  if (step === 'pass') {
    return { type: 'bubble',
      header: hdr('【整體可接受度】 ' + progress, _getReplyContent(RS, 'step_pass_desc', '目前的術後狀態，您個人可以接受嗎？'), COLORS.pass),
      body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: 'sm',
        contents: noteRows.concat([
          row([btn('✅ 可以接受', 'Y', 'primary'), btn('❌ 還不滿意', 'N')]),
          EXIT_BTN
        ])
      }
    };
  }

  return null;
}

// ── 答案解析 ──────────────────────────────────────────────────
function _parseStepValue(step, text) {
  if (step === 'vas_back' || step === 'vas_leg') {
    var n = parseInt(text, 10);
    return (!isNaN(n) && n >= 0 && n <= 10) ? n : null;
  }
  var odiIdx = parseInt(step.replace('odi_q', ''), 10);
  if (!isNaN(odiIdx)) {
    var n = parseInt(text, 10);
    return (!isNaN(n) && n >= 0 && n <= 5) ? n : null;
  }
  if (step === 'pass') {
    var t = text.toUpperCase();
    if (t === 'Y' || t === '是' || t === '可以' || t === '可以接受') return 'Y';
    if (t === 'N' || t === '否' || t === '不行' || t === '還不滿意') return 'N';
    return null;
  }
  if (step === 'anchor_q') {
    var n = parseInt(text, 10);
    return (!isNaN(n) && n >= 1 && n <= 7) ? n : null;
  }
  return null;
}

// 建立已填選項預覽文字
function _buildProgressPreview(sessionData) {
  var lines = [];
  var odiSum = 0;
  var odiCount = 0;

  QUESTION_STEPS.forEach(function(step) {
    if (sessionData[step] === undefined) return;
    var val = sessionData[step];

    if (step === 'vas_back') {
      lines.push('背痛：' + val + ' 分');
    } else if (step === 'vas_leg') {
      lines.push('腿痛：' + val + ' 分');
    } else if (step.indexOf('odi_q') === 0) {
      var qIdx = parseInt(step.replace('odi_q', ''), 10) - 1;
      lines.push('ODI Q' + (qIdx + 1) + '：' + val + ' 分（' + ODI_QUESTIONS[qIdx].title + '）');
      odiSum += val;
      odiCount++;
    } else if (step === 'anchor_q') {
      lines.push('整體改善：' + _getAnchorLabel(val));
    } else if (step === 'pass') {
      lines.push('整體可接受：' + (val === 'Y' ? '可接受' : '不滿意'));
    }
  });

  if (odiCount > 0) {
    var odiEst = Math.round(odiSum / (odiCount * 5) * 100);
    lines.push('（ODI 已填 ' + odiCount + '/10 題，目前估計 ' + odiEst + '%）');
  }

  return lines.length > 0 ? lines.join('\n') : '（尚無已填項目）';
}

// 找出暫停時的第一個未答題目
function _findResumeStep(sessionData) {
  for (var i = 0; i < QUESTION_STEPS.length; i++) {
    if (sessionData[QUESTION_STEPS[i]] === undefined) {
      return QUESTION_STEPS[i];
    }
  }
  return QUESTION_STEPS[0];
}

// 計算已回答題數
function _countAnswered(sessionData) {
  var count = 0;
  QUESTION_STEPS.forEach(function(s) {
    if (sessionData[s] !== undefined) count++;
  });
  return count;
}

function _getAnchorLabel(val) {
  var labels = { 1:'非常惡化', 2:'明顯惡化', 3:'稍微惡化', 4:'沒有變化', 5:'稍微改善', 6:'明顯改善', 7:'非常改善' };
  return labels[val] || '未填';
}

function _getOdiSeverity(pct) {
  if (pct <= 20) return '最小障礙';
  if (pct <= 40) return '中度障礙';
  if (pct <= 60) return '重度障礙';
  if (pct <= 80) return '嚴重殘疾';
  return '完全殘疾';
}

// ── 對話狀態管理 ──────────────────────────────────────────────
function _getState(lineUid) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.CHAT_STATE);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET.CHAT_STATE);
    sheet.appendRow(['line_uid','research_id','current_step','session_data','tp_target','last_active']);
  }

  var data = sheet.getDataRange().getValues();
  var now  = new Date();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][STATE_COL.LINE_UID]) !== String(lineUid)) continue;

    var lastActive   = new Date(data[i][STATE_COL.LAST_ACTIVE]);
    var hoursElapsed = (now - lastActive) / 3600000;

    var sessionData = {};
    try { sessionData = JSON.parse(data[i][STATE_COL.SESSION_DATA] || '{}'); } catch(e) {}

    if (hoursElapsed > 24) {
      // 超時重置（保留 researchId）
      var preserved = sessionData.researchId ? { researchId: sessionData.researchId } : {};
      _saveState(i + 1, lineUid, preserved.researchId || '', 'idle', preserved, '');
      return { step: 'idle', sessionData: preserved, tpTarget: '', rowIndex: i + 1 };
    }

    return {
      step:        data[i][STATE_COL.CURRENT_STEP] || 'idle',
      sessionData: sessionData,
      tpTarget:    data[i][STATE_COL.TP_TARGET]    || '',
      rowIndex:    i + 1
    };
  }

  // 不存在：新增列
  sheet.appendRow([lineUid, '', 'idle', '{}', '', Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss')]);
  return { step: 'idle', sessionData: {}, tpTarget: '', rowIndex: sheet.getLastRow() };
}

function _saveState(rowIndex, lineUid, researchId, step, sessionData, tpTarget) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.CHAT_STATE);
  var now   = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
  sheet.getRange(rowIndex, 1, 1, 6).setValues([[
    lineUid, researchId || '', step, JSON.stringify(sessionData), tpTarget || '', now
  ]]);
}

function _clearState(rowIndex, lineUid) {
  _saveState(rowIndex, lineUid, '', 'idle', {}, '');
}

// ── ODI 明細寫入 ──────────────────────────────────────────────
function _writeOdiDetail(ss, logId, researchId, now, daysPostOp, sessionData, odiRaw, odiScore) {
  var sheet = ss.getSheetByName(SHEET.ODI_DETAIL);
  if (!sheet) return;
  sheet.appendRow([
    logId,
    researchId,
    Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'),
    daysPostOp,
    sessionData.odi_q1  || 0,
    sessionData.odi_q2  || 0,
    sessionData.odi_q3  || 0,
    sessionData.odi_q4  || 0,
    sessionData.odi_q5  || 0,
    sessionData.odi_q6  || 0,
    sessionData.odi_q7  || 0,
    sessionData.odi_q8  || 0,
    sessionData.odi_q9  || 0,
    sessionData.odi_q10 || 0,
    odiRaw,
    odiScore
  ]);
}

// ── 暫存區寫入 ────────────────────────────────────────────────
function _writeToStaging(researchId, rawMessage, parsed) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.AI_STAGING);
  var now   = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
  sheet.appendRow([
    researchId, rawMessage,
    parsed.vasBack !== null ? parsed.vasBack : '',
    parsed.vasLeg  !== null ? parsed.vasLeg  : '',
    parsed.summary, now, 'pending', '', ''
  ]);
}

// ── 加入好友 ──────────────────────────────────────────────────
function _handleFollow(event) {
  var lineUid    = event.source.userId;
  var replyToken = event.replyToken;
  notifyAdminError_('新病患加入 LINE Bot',
    '新病患加入，LINE UID：' + lineUid +
    '\n（病患輸入綁定碼後將自動完成綁定）'
  );
  var RS = _loadReplySettings();
  replyLineMessage(replyToken, _getReplyContent(RS, 'welcome',
    '您好！我是汐止國泰醫院骨科\n脊椎追蹤系統小幫手 🌿\n\n' +
    '請輸入護理師提供的【6 位數綁定碼】完成帳號綁定。\n\n' +
    '如有疑問請電：02-2648-2121 轉 5032'
  ));
}

// ── 封鎖 ──────────────────────────────────────────────────────
function _handleUnfollow(event) {
  var lineUid    = event.source.userId;
  var researchId = _lookupResearchIdByUid(lineUid);
  if (researchId) _updateLineStatus(researchId, 'blocked');
}

// ── 查找研究編號 ──────────────────────────────────────────────
function _lookupResearchIdByUid(lineUid) {
  var privacySheetId = getConfig_('PRIVACY_TABLE_ID');
  if (!privacySheetId) return null;
  try {
    var privacySS = SpreadsheetApp.openById(privacySheetId);
    var data      = privacySS.getSheets()[0].getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(lineUid)) return String(data[i][0]);
    }
  } catch (e) { Logger.log('[_lookupResearchIdByUid] ' + e.message); }
  return null;
}

// ── 更新 line_status ──────────────────────────────────────────
function _updateLineStatus(researchId, newStatus) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.OPERATION);
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][OP_COL.RESEARCH_ID] === researchId) {
      sheet.getRange(i + 1, OP_COL.LINE_STATUS + 1).setValue(newStatus);
      return;
    }
  }
}

// ── LINE Bot 回覆設定工具 ─────────────────────────────────────

/**
 * 從 Sheet 12 載入回覆設定，容錯回傳空結構
 * @returns {{ byKey: Object, triggerMap: Object, keywordRules: Array }}
 */
function _loadReplySettings() {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET.LINE_REPLY);
    if (!sheet || sheet.getLastRow() < 2) return { byKey: {}, triggerMap: {}, keywordRules: [] };

    var data = sheet.getDataRange().getValues().slice(1);
    var byKey = {}, triggerMap = {}, keywordRules = [];

    data.forEach(function(r) {
      var id       = String(r[LINE_REPLY_COL.ID]       || '');
      var group    = String(r[LINE_REPLY_COL.GROUP]    || '');
      var key      = String(r[LINE_REPLY_COL.KEY]      || '');
      var triggers = String(r[LINE_REPLY_COL.TRIGGERS] || '');
      var content  = String(r[LINE_REPLY_COL.CONTENT]  || '');
      var active   = r[LINE_REPLY_COL.ACTIVE] === true;
      if (!id) return;

      if (group === '自訂關鍵字') {
        if (active && triggers) {
          keywordRules.push({
            triggers: triggers.split(',').map(function(k) { return k.trim(); }).filter(Boolean),
            content:  content
          });
        }
        return;
      }

      if (key) {
        byKey[key] = { content: content, active: active };
        if (active && triggers) {
          triggers.split(',').forEach(function(kw) {
            var k = kw.trim();
            if (k) triggerMap[k] = key;
          });
        }
      }
    });

    return { byKey: byKey, triggerMap: triggerMap, keywordRules: keywordRules };
  } catch (e) {
    Logger.log('[_loadReplySettings] ' + e.message);
    return { byKey: {}, triggerMap: {}, keywordRules: [] };
  }
}

/**
 * 取回覆內容；若 sheet 未設定或已停用，回傳 fallback
 */
function _getReplyContent(settings, key, fallback) {
  var entry = settings.byKey[key];
  if (entry && entry.active && entry.content) return entry.content;
  return fallback;
}

/**
 * 替換 {placeholder} 為實際值
 */
function _fillPlaceholders(template, vars) {
  return template.replace(/\{(\w+)\}/g, function(match, name) {
    return vars.hasOwnProperty(name) ? String(vars[name]) : match;
  });
}

/**
 * 檢查自訂關鍵字規則（優先於 Gemini，低於所有內建指令）
 * @returns {string|null}
 */
function _checkKeywordRules(settings, rawMessage) {
  var rules = settings.keywordRules || [];
  for (var i = 0; i < rules.length; i++) {
    if (rules[i].triggers.indexOf(rawMessage) !== -1) return rules[i].content;
  }
  return null;
}
