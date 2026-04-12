// ============================================================
// ApiHandler.gs — Vue app REST API 路由處理
// 由 WebApp.gs 的 doGet 在偵測到 action 參數時呼叫
//
// 使用方式（GAS URL + 查詢參數）：
//   GET ?action=getDashboardData&key=YOUR_KEY
//   GET ?action=getAnalyticsData&key=YOUR_KEY
//   GET ?action=approveRecord&rowIndex=5&key=YOUR_KEY
//   GET ?action=rejectRecord&rowIndex=5&key=YOUR_KEY
//   GET ?action=exportCsv&key=YOUR_KEY
//
// 前置設定：在 GAS 指令碼屬性中新增 VUE_API_KEY
// ============================================================

/**
 * 驗證 API Key 並路由至對應函式
 * @param {Object} e  doGet event object
 */
function handleApiRequest_(e) {
  var params = e.parameter || {};

  // ── API Key 驗證 ──────────────────────────────────────────
  var key      = params.key || '';
  var validKey = getConfig_('VUE_API_KEY');
  if (!validKey || key !== validKey) {
    return apiJson_({ error: 'Unauthorized' });
  }

  // ── Action 路由 ───────────────────────────────────────────
  var action = params.action;
  var result;

  try {
    switch (action) {

      case 'getDashboardData':
        result = getDashboardData();
        break;

      case 'getAnalyticsData':
        result = getAnalyticsData();
        break;

      case 'approveRecord': {
        var ri = parseInt(params.rowIndex, 10);
        if (isNaN(ri)) throw new Error('rowIndex 無效');
        result = approveRecordByRow(ri);
        break;
      }

      case 'rejectRecord': {
        var ri2 = parseInt(params.rowIndex, 10);
        if (isNaN(ri2)) throw new Error('rowIndex 無效');
        result = rejectRecordByRow(ri2);
        break;
      }

      case 'exportCsv':
        // exportConfirmedCsv() 定義於 WeeklyAnalysis.gs
        result = exportConfirmedCsv();
        break;

      case 'getFormOptions':
        result = getFormOptions_();
        break;

      case 'addOperationRecord':
        result = addOperationRecord_(params);
        break;

      case 'addFollowUpRecord':
        result = addFollowUpRecord_(params);
        break;

      default:
        result = { error: '未知的 action：' + action };
    }
  } catch (err) {
    Logger.log('[ApiHandler] ' + err.message);
    result = { error: err.message };
  }

  return apiJson_(result);
}

/** 回傳 JSON ContentService response（自動帶 CORS header） */
function apiJson_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
