// ============================================================
// RichMenu.gs — LINE Rich Menu 建立與管理
//
// 使用步驟：
//   1. 準備 Rich Menu 圖片（2500 x 843 px，參考下方說明）
//   2. 在 GAS 編輯器執行 createAndSetRichMenu()
//   3. 依提示上傳圖片（在 LINE Developers Console）
//
// 圖片設計規格（給設計師）：
//   尺寸：2500 x 843 px
//   配色：國泰黃綠 #8DC63F（主色）+ 白字
//   版面：2 列 x 3 欄（六宮格，每格 833x421）
//   格局：
//     [  填寫問卷（大格，左欄全高 833x843）  ] [ 我的記錄 ] [ AI 諮詢  ]
//                                              [ 聯絡門診 ] [ 使用說明 ]
//   各格內容：文字 + Bootstrap Icons 對應圖示
//     1. 📝 填寫問卷
//     2. 📊 我的記錄
//     3. 💬 AI 諮詢
//     4. 📞 聯絡門診
//     5. ❓ 使用說明
//   背景：可放國泰大樹 Logo 在大格右下角（半透明）
// ============================================================

var RICH_MENU_LINE_API = 'https://api.line.me/v2/bot/richmenu';

/**
 * 主函式：建立 Rich Menu 並設為預設
 * 在 GAS 編輯器手動執行一次
 */
function createAndSetRichMenu() {
  var ui = SpreadsheetApp.getUi();

  // 1. 建立 Rich Menu 結構
  var menuId = _createRichMenuStructure();
  if (!menuId) {
    ui.alert('❌ 建立 Rich Menu 失敗，請查看 Logger');
    return;
  }

  // 2. 儲存 menuId 到 Script Properties
  PropertiesService.getScriptProperties().setProperty('RICH_MENU_ID', menuId);

  // 3. 設為預設選單
  var ok = _setDefaultRichMenu(menuId);

  ui.alert(
    ok ? '✅ Rich Menu 建立完成！' : '⚠️ 結構建立成功，但設為預設失敗',
    'Rich Menu ID：' + menuId + '\n\n' +
    '⚠️ 還需要上傳圖片！\n\n' +
    '請前往 LINE Developers Console：\n' +
    'Messaging API → Rich Menu → 找到此 ID\n' +
    '→ Upload image（2500 x 843 px）\n\n' +
    '或執行 uploadRichMenuImageFromUrl() 自動上傳。',
    ui.ButtonSet.OK
  );
}

/**
 * 刪除目前預設 Rich Menu（重新設定時用）
 */
function deleteCurrentRichMenu() {
  var menuId = PropertiesService.getScriptProperties().getProperty('RICH_MENU_ID');
  if (!menuId) {
    SpreadsheetApp.getUi().alert('未找到儲存的 Rich Menu ID');
    return;
  }
  var token = getConfig_('LINE_CHANNEL_ACCESS_TOKEN');
  var res = UrlFetchApp.fetch(RICH_MENU_LINE_API + '/' + menuId, {
    method: 'delete',
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  });
  SpreadsheetApp.getUi().alert(
    res.getResponseCode() === 200 ? '✅ 已刪除 Rich Menu' : '❌ 刪除失敗：' + res.getContentText()
  );
}

// ──────────────────────────────────────────────────────────
// 內部：建立 Rich Menu 結構
// ──────────────────────────────────────────────────────────
function _createRichMenuStructure() {
  var token = getConfig_('LINE_CHANNEL_ACCESS_TOKEN');

  // 六宮格（大）：2500 x 1686，2 列 x 3 欄，每格 833 x 843
  var body = {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: '汐止國泰骨科術後追蹤',
    chatBarText: '功能選單',
    areas: [
      // 第一列
      {
        bounds: { x: 0,    y: 0, width: 833, height: 843 },
        action: { type: 'message', label: '填寫問卷', text: '開始填寫' }
      },
      {
        bounds: { x: 833,  y: 0, width: 834, height: 843 },
        action: { type: 'message', label: '我的記錄', text: '查看記錄' }
      },
      {
        bounds: { x: 1667, y: 0, width: 833, height: 843 },
        action: { type: 'message', label: 'AI諮詢', text: '諮詢' }
      },
      // 第二列
      {
        bounds: { x: 0,    y: 843, width: 833, height: 843 },
        action: { type: 'uri', label: '聯絡門診', uri: 'tel:0226482121' }
      },
      {
        bounds: { x: 833,  y: 843, width: 834, height: 843 },
        action: { type: 'message', label: '使用說明', text: '使用說明' }
      },
      {
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: { type: 'uri', label: '網路掛號', uri: 'https://reg.cgh.org.tw/tw/reg/main.jsp' }
      }
    ]
  };

  try {
    var res = UrlFetchApp.fetch(RICH_MENU_LINE_API, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + token },
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });

    var code = res.getResponseCode();
    var json = JSON.parse(res.getContentText());

    if (code === 200) {
      Logger.log('[createRichMenu] richMenuId=' + json.richMenuId);
      return json.richMenuId;
    } else {
      Logger.log('[createRichMenu] 失敗 ' + code + '：' + res.getContentText());
      return null;
    }
  } catch (e) {
    Logger.log('[createRichMenu] Exception: ' + e.message);
    return null;
  }
}

// ──────────────────────────────────────────────────────────
// 內部：設為預設 Rich Menu
// ──────────────────────────────────────────────────────────
function _setDefaultRichMenu(menuId) {
  var token = getConfig_('LINE_CHANNEL_ACCESS_TOKEN');
  try {
    var res = UrlFetchApp.fetch(
      'https://api.line.me/v2/bot/user/all/richmenu/' + menuId,
      {
        method: 'post',
        headers: { 'Authorization': 'Bearer ' + token },
        muteHttpExceptions: true
      }
    );
    return res.getResponseCode() === 200;
  } catch (e) {
    Logger.log('[setDefaultRichMenu] ' + e.message);
    return false;
  }
}
