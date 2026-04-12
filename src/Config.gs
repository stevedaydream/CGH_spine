// ============================================================
// Config.gs — 全域常數與欄位索引
// 修改此檔案即可調整所有分頁名稱與欄位位置
// ============================================================

// ---------- Spreadsheet 分頁名稱 ----------
var SHEET = {
  IMPLANT:    '耗材代碼表',
  OPERATION:  '手術記錄表',
  FOLLOW_UP:  '術後追蹤日誌',
  AI_STAGING: 'AI暫存待確認區',
  PUSH_LOG:   '推播排程Log',
  AI_ANALYSIS:'AI分析區'
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
  ODI_DESCRIPTION: 6,  // odi_description
  WOUND_STATUS:    7,  // wound_status
  RAW_MESSAGE:     8,  // raw_message
  RECORD_TYPE:     9,  // record_type: direct / ai_parsed / amended
  CONFIRMED:       10  // confirmed: TRUE / FALSE
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
