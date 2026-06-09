<script setup>
import { ref, computed } from 'vue'

const currentCategory = ref('survey') // 'survey' | 'exempt' | 'case_report' | 'clinical_trial' | 'maintenance'

const categories = [
  { id: 'survey', label: '臨床問卷研究', icon: 'bi-journal-medical', desc: '適用於本追蹤系統之線上關懷問卷計畫，如探討術後 VAS/ODI 之變化。' },
  { id: 'exempt', label: '免除審查案 (免審)', icon: 'bi-patch-check', desc: '適用於利用去識別化之去連結臨床病歷資料庫進行之研究，風險極低。' },
  { id: 'case_report', label: '個案報告發表', icon: 'bi-file-earmark-person', desc: '針對單一或少數個案（小於等於 3 例）之特殊臨床病歷分析報告。' },
  { id: 'clinical_trial', label: '介入型臨床試驗', icon: 'bi-heart-pulse', desc: '涉及新醫療技術、新藥品或新醫療器材臨床試驗之高風險研究。' },
  { id: 'maintenance', label: '案置後續變更與結案', icon: 'bi-arrow-repeat', desc: '計畫核准後之追蹤管理，如計畫變更、年度期中報告、結案報告等。' }
]

// ── 國泰綜合醫院 IRB 表單下載資料庫 ────────────────────────────────
const cghIrbFiles = {
  survey: {
    title: '臨床問卷研究送審必備文件',
    flow: '初審案程序：填寫計畫書 $\rightarrow$ 設計受試者同意書 $\rightarrow$ 送審取得核准函 $\rightarrow$ 啟動 LINE 系統收案。',
    docs: [
      { code: '1-1', name: '收件表格 (初審案用)', doc: '65_1-1.doc', odt: '65_1-1.odt' },
      { code: '1-5', name: '研究計畫內容摘要表', doc: '65_1-5.docx', odt: '65_1-5.odt' },
      { code: '1-7-2', name: '人體研究計畫 計劃書範本', doc: '65_1-7-2.doc', odt: '65_1-7-2.odt' },
      { code: '1-8-4', name: '受試者同意書 (問卷專用範本)', doc: '65_1-8-4.docx', odt: '65_1-8-4.odt' },
      { code: '1-17', name: '研究執行問卷（附錄：本系統之 VAS/ODI 題目樣張）', note: '需自行檢附系統問卷截圖或題目表' }
    ],
    tips: [
      '於「受試者同意書」中，必須說明：資料將儲存於加密之資料庫，並以去識別化之編號進行後續統計。',
      '計畫書中研究方法須提及：本研究使用通訊軟體 (LINE) 官方帳號進行自動化問卷關懷追蹤。',
      '若問卷完全採「匿名」且無法回溯至病人真實身份，可改用「1-8-6 匿名問卷同意書」。但因本系統有綁定驗證碼以對照手術歷程，建議使用「1-8-4 問卷同意書」。'
    ]
  },
  exempt: {
    title: '免除審查案 (免審) 送審必備文件',
    flow: '免審程序：填寫免審申請書 $\rightarrow$ 填寫範圍核對表與自評表 $\rightarrow$ 送審取得免審核准證明 $\rightarrow$ 開始回溯分析。',
    docs: [
      { code: '11-1', name: '收件表格 / 研究團隊授權書', doc: '65_11-1.doc', odt: '65_11-1.odt' },
      { code: '11-4', name: '免審審查申請表', doc: '65_11-4.docx', odt: '65_11-4.odt' },
      { code: '11-5', name: '免除審查範圍核對表', doc: '65_11-5.docx', odt: '65_11-5.odt' },
      { code: '11-7', name: '主持人自評表 (免審專用)', doc: '65_11-7.docx', odt: '65_11-7.odt' },
      { code: '11-8', name: '計畫中英文摘要', doc: '65_11-8.docx', odt: '65_11-8.odt' }
    ],
    tips: [
      '免除審查（Exempt Review）通常適用於「使用已去連結之病歷回溯資料」。',
      '在「11-5 範圍核對表」中，本系統之回溯數據分析通常符合「使用已去識別化之次級資料」條款。',
      '必須檢附「顯著財務利益申報表 (11-9-2)」與計畫摘要送審。'
    ]
  },
  case_report: {
    title: '個案報告發表送審必備文件',
    flow: '個案報告程序：撰寫個案摘要 $\rightarrow$ 取得病人簽署同意書 $\rightarrow$ 提交個案報告審查。',
    docs: [
      { code: '10-1', name: '收件表格 / 研究團隊授權書', doc: '65_10-1.doc', odt: '65_10-1.odt' },
      { code: '10-2', name: '計畫主持人和研究團隊最新履歷 (CV)', doc: '65_10-2.doc', odt: '65_10-2.odt' },
      { code: '10-4', name: '個案報告審查申請表', doc: '65_10-4.docx', odt: '65_10-4.odt' },
      { code: '10-5', name: '計畫中英文摘要 (個案分析)', doc: '65_10-5.docx', odt: '65_10-5.odt' },
      { code: '10-6', name: '個案報告(研究) 病人資料提供同意書', doc: '65_10-6.docx', odt: '65_10-6.odt' },
      { code: '10-7-1', name: '顯著財務(非財務關係)評估說明表(主持人)', doc: '65_10-7-1.doc', odt: '65_10-7-1.odt' },
      { code: '10-7-2', name: '顯著財務利益申報表(全體成員)', doc: '65_10-7-2.doc', odt: '65_10-7-2.odt' }
    ],
    tips: [
      '若要發表特定病患的特殊醫療歷程（例如極罕見脊椎併發症或創新融合術），需使用「10-6 同意書」取得該病人簽字。',
      '個案報告若病人已死亡且無法取得家屬簽字，需向 IRB 提出免除知情同意之特別申請說明。',
      '所有共同作者（全體研究成員）均需簽署「10-7-2 顯著財務利益申報表」，並檢附最新履歷送審。'
    ]
  },
  clinical_trial: {
    title: '介入型臨床試驗送審必備文件',
    flow: '高風險試驗程序：醫療法第八條新醫療技術/器材申請 $\rightarrow$ 計畫基本表 $\rightarrow$ 臨床試驗計畫書 $\rightarrow$ 一般/醫材同意書。',
    docs: [
      { code: '1-1', name: '收件表格 (初審案用)', doc: '65_1-1.doc', odt: '65_1-1.odt' },
      { code: '1-5-1', name: '計畫摘要表 (醫療器材專用)', doc: '65_1-5-1.docx', odt: '65_1-5-1.odt' },
      { code: '1-6-2', name: '人體試驗基本資料表 (醫療器材)', doc: '65_1-6-2.docx', odt: '65_1-6-2.odt' },
      { code: '1-7-1', name: '新醫療技術 / 藥品臨床試驗計畫書範本', doc: '65_1-7-1.doc', odt: '65_1-7-1.odt' },
      { code: '1-7-3', name: '醫療器材臨床試驗計畫書範本', doc: '65_1-7-3.doc', odt: '65_1-7-3.odt' },
      { code: '1-8-7', name: '受試者同意書 (醫療器材專用範本)', doc: '65_1-8-7.docx', odt: '65_1-8-7.odt' }
    ],
    tips: [
      '若脊椎手術中使用了「全新未核准之新型 Cage」或「非常規適應症之骨水泥」，屬於醫療法第8條範疇，必須使用此類表單。',
      '通常需檢附受試者保險證明、主持人手冊（Investigator Brochure）以及資料安全性監測計畫（DSMP）。'
    ]
  },
  maintenance: {
    title: '計畫變更、追蹤與結案文件',
    flow: '維護程序：依情況填寫變更表（變更案） $\rightarrow$ 每年提交進度（期中） $\rightarrow$ 收案結束提交報告（結案）。',
    docs: [
      { code: '3-2', name: '變更臨床試驗申請表 (變更案)', doc: '65_3-2.docx', odt: '65_3-2.odt' },
      { code: '3-3', name: '修正前後內容對照表', doc: '65_3-3.docx', odt: '65_3-3.odt' },
      { code: '4-2', name: '期中報告表 (年度追蹤用)', doc: '65_4-2.docx', odt: '65_4-2.odt' },
      { code: '5-2', name: '結案報告表', doc: '65_5-2.docx', odt: '65_5-2.odt' }
    ],
    tips: [
      '**計畫變更**：若後續想在 LINE Bot 中「新增問卷題目」或「調整發送天數」，必須先送「變更案」核准後才能更改程式碼。',
      '**結案報告**：計畫收案完畢並發表論文前，須向 IRB 提交結案報告。'
    ]
  }
}

const activeIrb = computed(() => cghIrbFiles[currentCategory.value])

// 計算國泰醫院官網下載的絕對路徑
function getDownloadUrl(filename) {
  return `https://www.cgh.org.tw/ec99/rwd1320/allphoto/irb/${filename}`
}

// 模擬標記完成的複選框狀態
const completedDocs = ref(new Set())
function toggleDocComplete(code) {
  if (completedDocs.value.has(code)) {
    completedDocs.value.delete(code)
  } else {
    completedDocs.value.add(code)
  }
}
</script>

<template>
  <div style="background: var(--color-bg-base); min-height: 100vh; font-family: var(--font-family);">



    <div class="container-fluid py-4 px-4">
      <div class="row g-4">

        <!-- 左側：研究類別導航 -->
        <div class="col-12 col-md-4 col-xl-3">
          <div class="clinical-card bg-white p-4 h-100">
            <h2 class="fs-6 fw-bold mb-3.5 pb-2 border-bottom text-muted text-uppercase" style="letter-spacing: .06em; font-size: 0.8rem;">
              選擇研究與送審類別
            </h2>
            <div class="d-flex flex-column gap-2.5">
              <button v-for="cat in categories" :key="cat.id"
                      type="button"
                      class="btn w-100 text-start py-3 px-3.5 transition-btn d-flex flex-column align-items-start gap-1"
                      :class="currentCategory === cat.id ? 'btn-teal text-white shadow-sm' : 'btn-light text-secondary border'"
                      style="border-radius: 12px;"
                      @click="currentCategory = cat.id">
                <span class="fw-bold d-flex align-items-center gap-2">
                  <i :class="'bi ' + cat.icon" aria-hidden="true"></i>{{ cat.label }}
                </span>
                <span class="small opacity-75" style="font-size: 0.72rem; line-height: 1.3;">{{ cat.desc }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 右側：表單清單與國泰下載按鈕 -->
        <div class="col-12 col-md-8 col-xl-9">
          <div class="clinical-card bg-white p-4 h-100 d-flex flex-column">

            <!-- 標題與說明 -->
            <div class="pb-3 mb-4 border-bottom">
              <h2 class="fs-5 fw-bold text-teal mb-1.5">{{ activeIrb.title }}</h2>
              <div class="p-2.5 rounded-3 small border d-flex gap-2 align-items-center mb-0" style="background: rgba(10, 92, 102, 0.04); border-color: rgba(10, 92, 102, 0.15) !important;">
                <i class="bi bi-arrow-right-circle text-teal" aria-hidden="true"></i>
                <span class="text-secondary fw-semibold">研究收案流程建議：{{ activeIrb.flow }}</span>
              </div>
            </div>

            <!-- 文件對照列表 -->
            <div class="flex-grow-1 mb-4">
              <div class="small fw-bold text-muted mb-2.5"><i class="bi bi-file-earmark-word me-1" aria-hidden="true"></i>國泰綜合醫院官方審查表單（點選下載原檔）</div>
              <div class="table-responsive border rounded-3 overflow-hidden">
                <table class="clinical-table mb-0 align-middle" style="font-size: .85rem;">
                  <thead class="bg-light">
                    <tr>
                      <th scope="col" style="width: 50px; text-align: center;">已備</th>
                      <th scope="col" style="width: 80px;">編號</th>
                      <th scope="col">文件名稱</th>
                      <th scope="col" style="width: 220px; text-align: right;">下載國泰委員會官方原檔</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="doc in activeIrb.docs" :key="doc.code" :style="completedDocs.has(doc.code) ? 'opacity: 0.65;' : ''">
                      <td style="text-align: center;">
                        <input class="form-check-input focus-ring" type="checkbox"
                               :checked="completedDocs.has(doc.code)"
                               @change="toggleDocComplete(doc.code)"
                               :aria-label="`標記 ${doc.name} 為已準備`">
                      </td>
                      <td class="font-monospace fw-bold text-secondary">{{ doc.code }}</td>
                      <td>
                        <strong :style="completedDocs.has(doc.code) ? 'text-decoration: line-through;' : ''">{{ doc.name }}</strong>
                        <span v-if="doc.note" class="text-muted d-block small" style="font-size: .72rem;">{{ doc.note }}</span>
                      </td>
                      <td style="text-align: right;">
                        <div class="d-flex gap-1.5 justify-content-end" v-if="doc.doc || doc.odt">
                          <a v-if="doc.doc" :href="getDownloadUrl(doc.doc)" class="btn btn-outline-primary btn-sm px-2.5 py-1 fw-bold font-monospace" style="font-size: .72rem;">
                            <i class="bi bi-file-earmark-word me-0.5" aria-hidden="true"></i>DOCX
                          </a>
                          <a v-if="doc.odt" :href="getDownloadUrl(doc.odt)" class="btn btn-outline-secondary btn-sm px-2.5 py-1 fw-bold font-monospace" style="font-size: .72rem;">
                            <i class="bi bi-file-earmark-text me-0.5" aria-hidden="true"></i>ODT
                          </a>
                        </div>
                        <span v-else class="text-muted small">自行撰寫附錄</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- IRB 審查小撇步 -->
            <div class="p-3.5 rounded-4 bg-light-surface border shadow-inner">
              <h3 class="fs-6 fw-bold text-teal mb-2"><i class="bi bi-lightbulb-fill text-warning me-1.5" aria-hidden="true"></i>汐止國泰 / 總院人體試驗送審小撇步</h3>
              <ul class="mb-0 ps-3.5 small text-secondary d-flex flex-column gap-1.5">
                <li v-for="(tip, idx) in activeIrb.tips" :key="idx">{{ tip }}</li>
              </ul>
            </div>

          </div>
        </div>

      </div>
    </div>

  </div>
</template>

<style scoped>
.btn-teal {
  background-color: var(--color-primary);
  color: #fff;
  border: 1px solid var(--color-primary);
}
.btn-teal:hover {
  background-color: #063e45;
  color: #fff;
}
.bg-light-surface {
  background-color: var(--color-bg-base);
  border-color: var(--color-border) !important;
}
.text-teal {
  color: var(--color-primary) !important;
}
.transition-btn {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
