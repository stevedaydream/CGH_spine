// ============================================================
// Config.gs — 全域常數與欄位索引
// 修改此檔案即可調整所有分頁名稱與欄位位置
// ============================================================

// ---------- Spreadsheet 分頁名稱 ----------
var SHEET = {
  HEALTH_EDU:   '衛教QA表',
  LINE_REPLY:   'LINE Bot 回覆設定',
  IMPLANT:      '耗材代碼表',
  OPERATION:    '手術記錄表',
  FOLLOW_UP:    '術後追蹤日誌',
  AI_STAGING:   'AI暫存待確認區',
  PUSH_LOG:     '推播排程Log',
  AI_ANALYSIS:  'AI分析區',
  CHAT_STATE:   '對話狀態表',
  BINDING_CODE: '綁定碼表',
  ODI_DETAIL:   'ODI明細表',
  ODI_REF:      'ODI計分對照表'
};

// ---------- 【綁定碼表】欄位索引（0-based）----------
var BIND_COL = {
  CODE:        0,  // 6 位數字綁定碼
  RESEARCH_ID: 1,  // 對應研究編號
  CREATED_AT:  2,  // 產生時間
  EXPIRES_AT:  3,  // 到期時間（48 小時後）
  USED:        4,  // TRUE / FALSE
  USED_AT:     5,  // 使用時間
  BOUND_UID:   6   // 綁定的 LINE UID
};

// ---------- 【手術記錄表】欄位索引（0-based）----------
var OP_COL = {
  RESEARCH_ID:        0,   // research_id
  OP_DATE:            1,   // op_date
  SURGEON:            2,   // surgeon
  PRE_VAS_BACK:       3,   // pre_vas_back
  PRE_VAS_LEG:        4,   // pre_vas_leg
  PRE_ODI:            5,   // pre_odi
  PRE_SVA:            6,   // pre_sva
  PRE_COBB:           7,   // pre_cobb
  OP_NAME:            8,   // op_name
  OP_LEVELS:          9,   // op_levels
  OP_DURATION:        10,  // op_duration
  EBL:                11,  // ebl
  CAGE_CODE:          12,  // cage_code
  SCREW_CODE:         13,  // screw_code
  BONE_GRAFT:         14,  // bone_graft
  OTHER_IMPLANT:      15,  // other_implant
  COMPLICATION:       16,  // complication
  LINE_STATUS:        17,  // line_status: active / blocked / unbound
  INTERVENTION_GROUP: 18   // intervention_group: line_bot / control / partial
};

// ---------- 【術後追蹤日誌】欄位索引（0-based）----------
var LOG_COL = {
  LOG_ID:          0,  // log_id
  RESEARCH_ID:     1,  // research_id
  LOG_DATETIME:    2,  // log_datetime
  DAYS_POST_OP:    3,  // days_post_op
  VAS_BACK:        4,  // vas_back
  VAS_LEG:         5,  // vas_leg
  ODI_DESCRIPTION: 6,  // odi_description（文字，舊欄位保留）
  WOUND_STATUS:    7,  // wound_status
  RAW_MESSAGE:     8,  // raw_message
  RECORD_TYPE:     9,  // record_type: direct / ai_parsed / amended
  CONFIRMED:       10, // confirmed: TRUE / FALSE
  ODI_SCORE:       11, // odi_score 0–100（數值，新）
  PASS:            12, // pass: Y / N
  ANCHOR_Q:        13  // anchor_q: 1–7（PGIC）
};

// ---------- 【AI暫存待確認區】欄位索引（0-based）----------
var STAGE_COL = {
  RESEARCH_ID:    0,  // research_id
  RAW_MESSAGE:    1,  // raw_message
  AI_VAS_BACK:    2,  // ai_vas_back
  AI_VAS_LEG:     3,  // ai_vas_leg
  AI_SUMMARY:     4,  // ai_summary
  AI_PARSED_AT:   5,  // ai_parsed_at
  REVIEW_STATUS:  6,  // review_status: pending / approved / rejected
  REVIEWED_BY:    7,  // reviewed_by
  REVIEWED_AT:    8   // reviewed_at
};

// ---------- 【推播排程Log】欄位索引（0-based）----------
var PUSH_COL = {
  RESEARCH_ID:    0,  // research_id
  SCHEDULED_DAY:  1,  // scheduled_day
  SCHEDULED_DATE: 2,  // scheduled_date
  SENT_AT:        3,  // sent_at
  STATUS:         4,  // status: sent / failed / skipped
  SKIP_REASON:    5,  // skip_reason
  ERROR_MESSAGE:  6   // error_message
};

// ---------- 推播排程天數 ----------
var PUSH_SCHEDULE_DAYS = [1, 3, 5, 7, 10, 13, 17, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84];

// ---------- 【對話狀態表】欄位索引（0-based）----------
var STATE_COL = {
  LINE_UID:      0,  // LINE User ID
  RESEARCH_ID:   1,  // 對應研究編號
  CURRENT_STEP:  2,  // 目前步驟：idle / vas_back / odi_q1 … / pass / anchor_q / done / chat
  SESSION_DATA:  3,  // JSON 字串，本次累積分數
  TP_TARGET:     4,  // 本次對應時間點（如 D7）
  LAST_ACTIVE:   5   // 最後活動時間，逾 24h 自動重置
};

// ---------- 14 步問卷順序 ----------
var QUESTION_STEPS = [
  'vas_back','vas_leg',
  'odi_q1','odi_q2','odi_q3','odi_q4','odi_q5',
  'odi_q6','odi_q7','odi_q8','odi_q9','odi_q10',
  'anchor_q','pass'
];

// ---------- ODI 題目定義 ----------
var ODI_QUESTIONS = [
  { step:'odi_q1',  title:'Q1 疼痛強度',  labels:['0 完全不痛','1 輕微','2 中度','3 嚴重','4 非常嚴重','5 最嚴重'] },
  { step:'odi_q2',  title:'Q2 個人照護',  labels:['0 完全自理','1 略不方便','2 需協助','3 大部分依賴','4 完全依賴','5 無法照顧'] },
  { step:'odi_q3',  title:'Q3 提重物',    labels:['0 可提重物','1 提重物痛','2 只提輕物','3 不能從地提','4 不能提物','5 連輕物不行'] },
  { step:'odi_q4',  title:'Q4 行走距離',  labels:['0 正常行走','1 可走1公里','2 可走500m','3 可走100m','4 需助行器','5 臥床為主'] },
  { step:'odi_q5',  title:'Q5 坐姿耐受',  labels:['0 任何椅OK','1 硬椅久坐','2 最多1小時','3 最多30分','4 最多10分','5 完全無法坐'] },
  { step:'odi_q6',  title:'Q6 站立耐受',  labels:['0 久站無痛','1 站1小時痛','2 最多1小時','3 最多30分','4 最多10分','5 完全無法站'] },
  { step:'odi_q7',  title:'Q7 睡眠品質',  labels:['0 不影響','1 偶爾睡不好','2 少於6小時','3 少於4小時','4 少於2小時','5 完全無法睡'] },
  { step:'odi_q8',  title:'Q8 社交活動',  labels:['0 正常社交','1 稍受限','2 明顯受限','3 只能基本','4 幾乎無社交','5 無社交'] },
  { step:'odi_q9',  title:'Q9 旅行交通',  labels:['0 可任意旅行','1 稍受限','2 明顯受限','3 只能短途','4 幾乎不行','5 完全無法'] },
  { step:'odi_q10', title:'Q10 職業家務', labels:['0 正常工作','1 稍受限','2 明顯受限','3 只能輕鬆','4 幾乎無法','5 完全無法'] }
];

// ---------- 【ODI明細表】欄位索引（0-based）----------
var ODI_COL = {
  LOG_ID:      0,   // FK → 術後追蹤日誌
  RESEARCH_ID: 1,
  LOG_DATETIME:2,
  DAYS_POST_OP:3,
  Q1:          4,
  Q2:          5,
  Q3:          6,
  Q4:          7,
  Q5:          8,
  Q6:          9,
  Q7:          10,
  Q8:          11,
  Q9:          12,
  Q10:         13,
  ODI_RAW:     14,  // 原始分 0-50
  ODI_SCORE:   15   // 百分比 0-100
};

// ---------- 【衛教QA表】欄位索引（0-based）----------
var HEALTH_EDU_COL = {
  ID:            0,  // 唯一流水號（QA-xxxxxxxxxx）
  CATEGORY:      1,  // 類別（自由維護）
  QUESTION:      2,  // 問題標題（LINE 按鈕標籤）
  ANSWER:        3,  // 衛教答案內容
  VIDEO_URL:     4,  // 衛教影片連結（選填）
  ACTIVE:        5,  // TRUE / FALSE
  DISPLAY_ORDER: 6,  // 排序數字（小的排前）
  DAYS_FROM:     7,  // 適用術後天數起（空 = 不限）
  DAYS_TO:       8,  // 適用術後天數迄（空 = 不限）
  PDF_URL:       9   // 衛教單張 PDF 連結（選填）
};

// ---------- 【LINE Bot 回覆設定】欄位索引（0-based）----------
var LINE_REPLY_COL = {
  ID:       0,  // 唯一識別（如 SYS-001）
  GROUP:    1,  // 系統訊息 / 問卷步驟 / 自訂關鍵字
  KEY:      2,  // 程式識別名（如 welcome, how_to_use）
  TRIGGERS: 3,  // 觸發關鍵字（逗號分隔；系統訊息留空）
  CONTENT:  4,  // 回覆文字，支援 {placeholder}
  ACTIVE:   5,  // TRUE / FALSE
  NOTE:     6   // 說明欄（前端顯示，不送出）
};

// ---------- 【個資對照表】欄位索引（0-based）----------
var PRIVACY_COL = {
  RESEARCH_ID:  0,  // 研究編號
  LINE_UID:     1,  // LINE User ID
  CHART_NUMBER: 2   // 病歷號（院內 MRN）
};

// ---------- API 設定（部署前填入 Script Properties）----------
// 請於 GAS 專案設定 > 指令碼屬性 中新增以下 key：
//   LINE_CHANNEL_ACCESS_TOKEN  — Line Bot Channel Access Token
//   GEMINI_API_KEY             — Google Gemini API Key
//   ADMIN_EMAIL                — 接收錯誤通知的管理者 Email
//   DOCTOR_EMAIL               — 接收週報的主責醫師 Email
//   PRIVACY_TABLE_ID           — 個資對照表 Spreadsheet ID（獨立 Drive 檔案）

function getConfig_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}
