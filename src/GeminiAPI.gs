// ============================================================
// GeminiAPI.gs — Gemini AI 語意解析與摘要生成
// ============================================================

var GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

/**
 * 解析病患 Line 訊息，萃取 VAS 數值與狀況摘要
 * @param {string} rawMessage  病患原始訊息
 * @returns {Object} { vasBack: number|null, vasLeg: number|null, summary: string }
 */
function parsePatientMessage(rawMessage) {
  var systemPrompt =
    '你是一個醫療助理，專門解析脊椎手術術後病患的自然語言回報。\n' +
    '請從以下訊息中提取：\n' +
    '1. 背部疼痛分數（VAS 0-10，0=完全不痛，10=最痛）\n' +
    '2. 腿部/腳部疼痛分數（VAS 0-10）\n' +
    '3. 用繁體中文寫一句簡短的狀況摘要（20字以內）\n\n' +
    '若訊息中沒有明確數字，請根據描述語意估計（如「很痛」=7-8分，「有點不舒服」=3-4分，「還好」=1-2分，「不痛」=0分）。\n' +
    '若完全無法判斷，請回傳 null。\n\n' +
    '請嚴格以 JSON 格式回覆，不要有任何其他文字：\n' +
    '{"vas_back": <數字或null>, "vas_leg": <數字或null>, "summary": "<摘要文字>"}';

  var userMessage = '病患訊息：' + rawMessage;

  var result = _callGemini(systemPrompt, userMessage);

  if (!result) {
    return { vasBack: null, vasLeg: null, summary: '解析失敗，請人工確認' };
  }

  try {
    // 移除可能的 markdown 包裝
    var cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    var parsed = JSON.parse(cleaned);
    return {
      vasBack:  _sanitizeVas(parsed.vas_back),
      vasLeg:   _sanitizeVas(parsed.vas_leg),
      summary:  parsed.summary || '無法生成摘要'
    };
  } catch (e) {
    Logger.log('[parsePatientMessage] JSON 解析失敗：' + e.message + '\nGemini回傳：' + result);
    return { vasBack: null, vasLeg: null, summary: '解析失敗，請人工確認' };
  }
}

/**
 * 生成週報 AI 分析摘要
 * @param {Object} stats  統計資料物件（由 WeeklyAnalysis.gs 傳入）
 * @param {string} weekRange  如 "2026/04/06 - 2026/04/12"
 * @returns {string}  Gemini 生成的中文摘要
 */
function generateWeeklyReport(stats, weekRange) {
  var systemPrompt =
    '你是一位脊椎外科研究助理，請根據以下本週手術追蹤數據，' +
    '用繁體中文撰寫一份簡潔的週報摘要給主責醫師。\n' +
    '格式：\n' +
    '1. 耗材效益亮點（最多2點）\n' +
    '2. 追蹤完整度狀況\n' +
    '3. 需要關注的病患（連續未回覆者）\n' +
    '4. 建議事項（1-2點）\n\n' +
    '重要：若任何比較組 n < 15，必須加上「樣本量不足（n=X），結論僅供參考，請勿用於正式發表。」\n' +
    '全文控制在 300 字以內。';

  var userMessage =
    '統計週期：' + weekRange + '\n\n' +
    JSON.stringify(stats, null, 2);

  var result = _callGemini(systemPrompt, userMessage);
  return result || '本週 AI 摘要生成失敗，請查看下方統計數據。';
}

/**
 * 呼叫 Gemini API
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {string|null}  模型回覆文字
 */
function _callGemini(systemPrompt, userMessage) {
  var apiKey = getConfig_('GEMINI_API_KEY');
  if (!apiKey) {
    Logger.log('[_callGemini] 未設定 GEMINI_API_KEY');
    return null;
  }

  var payload = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [{ text: systemPrompt + '\n\n' + userMessage }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024
    }
  });

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true
  };

  try {
    var url = GEMINI_ENDPOINT + '?key=' + apiKey;
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();

    if (code !== 200) {
      Logger.log('[_callGemini] HTTP ' + code + '：' + response.getContentText());
      return null;
    }

    var json = JSON.parse(response.getContentText());
    return json.candidates[0].content.parts[0].text;
  } catch (e) {
    Logger.log('[_callGemini] Exception: ' + e.message);
    notifyAdminError_('Gemini API 呼叫失敗', e.message);
    return null;
  }
}

/**
 * 比對病患訊息與衛教 QA 清單，回傳最匹配的 QA item 或 null
 * @param {string} userMessage
 * @param {Array}  qaItems  [{ id, category, question }]
 * @returns {Object|null}  匹配的 qaItem 或 null
 */
function matchHealthEduQuestion(userMessage, qaItems) {
  if (!qaItems || qaItems.length === 0) return null;

  var catalog = qaItems.map(function(q, i) {
    return (i + 1) + '. [' + q.id + '] ' + q.category + '：' + q.question;
  }).join('\n');

  var systemPrompt =
    '你是衛教問題比對助理。以下是衛教QA清單：\n\n' + catalog + '\n\n' +
    '請判斷病患訊息與哪一筆最相關（主題高度吻合）。\n' +
    '若相關 → 只回傳該條目的 ID（如 QA-1234567890），不含任何其他文字。\n' +
    '若無相關 → 只回傳 null。';

  var result = _callGemini(systemPrompt, '病患訊息：' + userMessage);
  if (!result) return null;

  var id = result.trim().replace(/["`\s]/g, '');
  if (!id || id === 'null') return null;

  for (var i = 0; i < qaItems.length; i++) {
    if (qaItems[i].id === id) return qaItems[i];
  }
  return null;
}

/**
 * 與病患進行自然語言對話（Context Injection 模式）
 * @param {string} rawMessage   病患原始訊息
 * @param {Object} patientCtx   { daysPostOp, opName, lastVasBack, lastVasLeg, lastReportDays }
 * @returns {Object} { reply: string, vasBack: number|null, vasLeg: number|null }
 */
function chatWithPatient(rawMessage, patientCtx) {
  var ctx = patientCtx || {};
  var contextBlock =
    '【病患背景】\n' +
    '手術類型：' + (ctx.opName         || '不詳') + '\n' +
    '術後天數：' + (ctx.daysPostOp     != null ? ctx.daysPostOp + ' 天' : '不詳') + '\n' +
    '上次背痛：' + (ctx.lastVasBack    != null ? ctx.lastVasBack + ' 分' : '尚無記錄') + '\n' +
    '上次腿痛：' + (ctx.lastVasLeg     != null ? ctx.lastVasLeg + ' 分' : '尚無記錄') + '\n' +
    '上次回報距今：' + (ctx.lastReportDays != null ? ctx.lastReportDays + ' 天前' : '尚無') + '\n';

  var systemPrompt =
    '你是一位友善的脊椎外科護理助理，負責與術後病患進行 LINE 對話追蹤。\n\n' +
    contextBlock + '\n' +
    '脊椎術後常識（僅供回覆參考，不得自行推斷藥物）：\n' +
    '- 術後 1–3 天：正常有傷口疼痛與腫脹，可冰敷，依醫囑服藥\n' +
    '- 術後 1–2 週：避免彎腰、扭腰、提重物（5kg以上），可緩慢短距離步行\n' +
    '- 術後 4–6 週：可逐漸增加步行距離，避免久坐超過30分鐘\n' +
    '- 術後 3 個月：依復健師指示開始核心肌群訓練\n' +
    '- 緊急回診症狀：傷口紅腫化膿、發燒超過38.5°C、下肢突然無力或麻木加劇、大小便失禁\n\n' +
    '請根據病患說的話用溫暖的繁體中文回覆（100–150字）。\n' +
    '若問題超出範疇或需要專業判斷，請建議聯絡門診：02-2648-2121 轉 5032。\n' +
    '若訊息含疼痛資訊，萃取 VAS 分數（背痛/腿痛 0-10）。\n\n' +
    '回覆格式（嚴格遵守，不得有其他文字）：\n' +
    'REPLY: <給病患的回覆文字>\n' +
    'DATA: {"vas_back": <數字或null>, "vas_leg": <數字或null>}';

  var result = _callGemini(systemPrompt, '病患說：' + rawMessage);

  if (!result) {
    return { reply: '謝謝您的回覆！若有不適請隨時告知，或撥打 02-2648-2121 轉 5032 聯絡門診。', vasBack: null, vasLeg: null };
  }

  try {
    var replyMatch = result.match(/REPLY:\s*(.+?)(?:\nDATA:|$)/s);
    var dataMatch  = result.match(/DATA:\s*(\{.+?\})/s);

    var reply = replyMatch ? replyMatch[1].trim() : '謝謝您的回覆！';
    var vasBack = null, vasLeg = null;

    if (dataMatch) {
      var parsed = JSON.parse(dataMatch[1]);
      vasBack = _sanitizeVas(parsed.vas_back);
      vasLeg  = _sanitizeVas(parsed.vas_leg);
    }

    return { reply: reply, vasBack: vasBack, vasLeg: vasLeg };
  } catch (e) {
    Logger.log('[chatWithPatient] 解析失敗：' + e.message + '\nGemini回傳：' + result);
    return { reply: '謝謝您的回覆！若有不適請隨時告知。', vasBack: null, vasLeg: null };
  }
}

/**
 * 驗證並清理 VAS 分數（必須為 0-10 之間的整數）
 */
function _sanitizeVas(val) {
  if (val === null || val === undefined) return null;
  var num = parseInt(val, 10);
  if (isNaN(num)) return null;
  return Math.min(10, Math.max(0, num));
}
