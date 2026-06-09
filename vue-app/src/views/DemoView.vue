<script setup>
import { ref, computed } from 'vue'

// ── 角色 & 步驟 ──────────────────────────────────────────
const roles = [
  { id: 'doctor',  icon: '🏥', label: '醫師後台',    steps: ['儀表板總覽', 'AI 待確認審核', '病患詳情 & 管理', 'MCID 分析', '系統設定'] },
  { id: 'nurse',   icon: '💉', label: '護理師作業',   steps: ['手術登錄', 'LINE 綁定碼', '回診登記（智慧搜尋）', '追蹤完整度'] },
  { id: 'patient', icon: '📱', label: '病患 LINE Bot', steps: ['加入好友 & 綁定', '收到推播提醒', '填寫問卷 VAS', 'ODI 問題', '問卷完成 & 衛教'] },
]

const activeRole = ref('doctor')
const stepIndex  = ref(0)

const currentRole = computed(() => roles.find(r => r.id === activeRole.value))
const totalSteps  = computed(() => currentRole.value.steps.length)
const stepLabel   = computed(() => currentRole.value.steps[stepIndex.value])

function selectRole(id) { activeRole.value = id; stepIndex.value = 0 }
function prevStep() { if (stepIndex.value > 0) stepIndex.value-- }
function nextStep() { if (stepIndex.value < totalSteps.value - 1) stepIndex.value++ }

// ── Demo 互動 ─────────────────────────────────────────────
const approvedRows = ref(new Set())
const rejectedRows = ref(new Set())
function demoApprove(id) { approvedRows.value = new Set([...approvedRows.value, id]); showToast('✅ 已核准，該紀錄已成功寫入個案追蹤日誌', 'success') }
function demoReject(id)  { rejectedRows.value = new Set([...rejectedRows.value, id]); showToast('❌ 已拒絕並退回該筆 AI 擷取建議', 'warning') }

const toast = ref({ show: false, msg: '', type: 'info' })
let toastTimer = null
function showToast(msg, type = 'info') {
  clearTimeout(toastTimer)
  toast.value = { show: true, msg, type }
  toastTimer = setTimeout(() => { toast.value.show = false }, 3000)
}

// 搜尋 autocomplete demo
const searchQuery   = ref('')
const searchDone    = ref(false)
const showSuggest   = ref(false)
const suggestions   = ['SP-2026-012', 'SP-2026-021', 'SP-2026-043']
const filteredSugg  = computed(() =>
  searchQuery.value.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(searchQuery.value.toLowerCase()))
    : []
)
function pickSuggest(id) {
  searchQuery.value = id
  showSuggest.value = false
  searchDone.value  = true
}
function doSearch() { if (searchQuery.value.trim()) searchDone.value = true }

// LINE 問卷互動
const selectedVas1 = ref(null)
const selectedVas2 = ref(null)
const selectedOdi1 = ref(null)

// 系統設定 tab
const settingsTab = ref('implant')

// ── Mock 資料 ─────────────────────────────────────────────
const mockSummary = { total: 42, active: 35, completeness: 87, pending: 3 }

const mockPending = [
  { id: 1, researchId: 'SP-2026-008', raw: '背還是有點痛，腿好多了，大概3分', aiBack: 3, aiLeg: 1, summary: '術後第14天，背痛3分、腿痛改善至1分', time: '09:12' },
  { id: 2, researchId: 'SP-2026-015', raw: '走路走多了會痛，休息就好，大概5', aiBack: 5, aiLeg: 3, summary: '術後第7天，活動後背痛5分，休息可緩解', time: '08:47' },
  { id: 3, researchId: 'SP-2026-021', raw: '幾乎沒有不舒服了，很滿意', aiBack: 1, aiLeg: 0, summary: '術後第28天，症狀幾乎完全緩解', time: '21:33' },
]

const mockPatients = [
  { researchId: 'SP-2026-003', opDate: '2026-01-10', opName: 'MIS TLIF', surgeon: '陳大偉', daysPostOp: 143, lineStatus: 'active',  lastVas: 1, pct: 100 },
  { researchId: 'SP-2026-012', opDate: '2026-03-15', opName: 'MIS TLIF', surgeon: '陳大偉', daysPostOp: 80,  lineStatus: 'active',  lastVas: 2, pct: 87  },
  { researchId: 'SP-2026-025', opDate: '2026-04-20', opName: 'PLIF',     surgeon: '王志明', daysPostOp: 44,  lineStatus: 'active',  lastVas: 4, pct: 60  },
  { researchId: 'SP-2026-031', opDate: '2026-05-01', opName: 'TLIF',     surgeon: '陳大偉', daysPostOp: 33,  lineStatus: 'unbound', lastVas: 5, pct: 40  },
  { researchId: 'SP-2026-043', opDate: '2026-06-01', opName: 'MIS TLIF', surgeon: '王志明', daysPostOp: 2,   lineStatus: 'unbound', lastVas: 7, pct: 6   },
]

const mockDetail = {
  researchId: 'SP-2026-012', opDate: '2026-03-15', opName: 'MIS TLIF', opLevels: 'L4-5',
  surgeon: '陳大偉醫師', daysPostOp: 80, preVasBack: 8, preVasLeg: 7, preOdi: 64,
}
const mockRecords = [
  { day: 'D1',  back: 5, leg: 4, odi: null, pgic: null, pass: null },
  { day: 'D7',  back: 4, leg: 3, odi: 44,   pgic: 5,    pass: 'Y'  },
  { day: 'D14', back: 3, leg: 2, odi: 36,   pgic: 6,    pass: 'Y'  },
  { day: 'D28', back: 2, leg: 1, odi: 24,   pgic: 7,    pass: 'Y'  },
  { day: 'D56', back: 1, leg: 0, odi: 14,   pgic: 7,    pass: 'Y'  },
]

const mockMcid = [
  { researchId: 'SP-2026-003', vasB: '✅', vasL: '✅', odi: '✅', pass: 'Y' },
  { researchId: 'SP-2026-007', vasB: '✅', vasL: '❌', odi: '✅', pass: 'Y' },
  { researchId: 'SP-2026-012', vasB: '✅', vasL: '✅', odi: '✅', pass: 'Y' },
  { researchId: 'SP-2026-018', vasB: '❌', vasL: '❌', odi: '❌', pass: 'N' },
  { researchId: 'SP-2026-025', vasB: '✅', vasL: '✅', odi: '❌', pass: 'Y' },
]

const mockImplants = [
  { code: 'CREO-C-L', name: 'Creo Cage Large', category: 'Cage',       brand: 'Medtronic' },
  { code: 'CREO-C-M', name: 'Creo Cage Medium', category: 'Cage',      brand: 'Medtronic' },
  { code: 'CD-HORM',  name: 'CD Horizon Screw', category: 'Screw',     brand: 'Medtronic' },
  { code: 'DBM-GEL',  name: 'DBM Gel',          category: 'Bone Graft', brand: 'Musculoskeletal' },
]

const chatSteps = [
  [
    { who:'bot',     text:'您好！我是汐止國泰醫院骨科脊椎追蹤系統小幫手 🌿\n\n為了維護您的隱私與醫療安全，請輸入門診護理師提供給您的 6 位數綁定驗證碼。' },
    { who:'patient', text:'847392' },
    { who:'bot',     text:'🎉 綁定成功！\n\n您的個人化研究編號為：SP-2026-043\n\n系統將依據主治醫師安排的術後復原時程，自動發送問卷關懷。共規劃 17 個追蹤點（至術後第 84 天）。' },
  ],
  [
    { who:'bot', text:'您好，今天是手術後第 7 天 🌿\n\n請問您今天感覺如何呢？身體有任何不適嗎？請點擊下方按鈕開始填寫今日關懷問卷。', quickReply: '開始填寫問卷' },
    { who:'patient', text:'開始填寫問卷' },
    { who:'bot', text:'好的，即刻為您開啟問卷 📋\n\n共計 14 題簡易評估，大約 3 分鐘即可完成。您的填報將即時回傳給您的醫療團隊。' },
  ],
  [
    { who:'bot', text:'📍 【背部疼痛強度評估】 (1/14)\n\n0 代表完全不痛，10 代表想像中最嚴重的劇痛。請選取符合您今日疼痛感受的分數：', vasGrid: true, vasKey: 1 },
    { who:'patient', text:'3 分', cond: () => selectedVas1.value !== null },
    { who:'bot', text:'📍 【腿部疼痛強度評估】 (2/14)\n\n請選取您今日大腿或小腿最痛的感受分數：', vasGrid: true, vasKey: 2 },
    { who:'patient', text:'2 分', cond: () => selectedVas2.value !== null },
  ],
  [
    { who:'bot', text:'📍 【Q1 疼痛強度】 (3/14)\n\n請選擇最符合您目前日常狀況的選項：',
      options: ['0 完全不痛','1 輕微疼痛，不需吃止痛藥','2 中度疼痛，吃藥可控制','3 嚴重疼痛，吃止痛藥效果有限','4 非常嚴重，疼痛嚴重干擾日常生活','5 最嚴重，完全無法忍受'], optKey: 'odi1' },
    { who:'patient', text:'1 輕微疼痛', cond: () => selectedOdi1.value !== null },
  ],
  [
    { who:'bot', text:'✅ 術後關懷問卷填報完成！\n\n今日（D7）紀錄已成功送出：\n・背痛：3 分 (輕微)\n・腿痛：2 分 (輕微)\n・ODI 功能障礙：22% (輕度)\n・PGIC 自我評估：稍微改善\n・PASS 狀態：滿意可接受' },
    { who:'bot', text:'💡 術後第 7 天衛教提醒\n\n提醒您現階段適用的護理建議：\n1. 傷口請保持乾燥，若有紅腫熱痛或滲液請即刻就醫。\n2. 下床活動時請務必配戴脊椎硬式護腰。\n3. 避免久坐或彎腰動作。\n\n點選下方主題，即可直接閱讀圖文與影片指南 👇', quickReply: '閱讀傷口護理指南' },
  ],
]

// ── 工具函式 ──────────────────────────────────────────────
const vasColors = ['#14b8a6','#2dd4bf','#99f6e4','#fef08a','#fef08a','#fde047','#f59e0b','#ea580c','#ef4444','#dc2626','#991b1b']
const vasStyle  = v => v !== null && v !== undefined
  ? `display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;font-size:.78rem;font-weight:700;color:${[3,4,5].includes(v)?'#333':'#fff'};background:${vasColors[v]}`
  : ''
const pctColor  = p => p >= 80 ? '#10b981' : p >= 50 ? '#f59e0b' : '#ef4444'
const lineLabel = { active: '已綁定', unbound: '未綁定', blocked: '已封鎖' }
const lineClass = { active: 'background: #e6fdf5; color: #0f766e; border: 1px solid #ccfbf1;', unbound: 'background: #fffbeb; color: #b45309; border: 1px solid #fef3c7;', blocked: 'background: #fef2f2; color: #b91c1c; border: 1px solid #fee2e2;' }
const pgicLabel = v => ({1:'非常惡化',2:'明顯惡化',3:'稍微惡化',4:'沒有變化',5:'稍微改善',6:'明顯改善',7:'非常改善'}[v]||'-')
const catClass  = c => ({ Cage:'background: var(--color-primary-light); color: var(--color-primary);', Screw:'background: #ecfeff; color: #0891b2;', 'Bone Graft':'background: #e6fdf5; color: #0f766e;', Cement:'background: #f1f5f9; color: #475569;' }[c] || 'background: #f1f5f9; color: #475569;')
</script>

<template>
  <div style="background: var(--color-bg-base); min-height: 100vh; font-family: var(--font-family);">

    <!-- 展示引言 -->
    <div class="px-4 py-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2" style="background: linear-gradient(to right, #ecfeff, var(--color-bg-base));">
      <div>
        <h1 class="fs-5 m-0 fw-bold d-flex align-items-center gap-1.5" style="color: var(--color-primary);">
          <i class="bi bi-stars text-teal" aria-hidden="true"></i> 智慧化脊椎術後關懷系統 ── 多角色模擬互動展示
        </h1>
        <p class="text-muted small m-0 mt-0.5">此頁面為展示專用之互動模型，整合了「醫師、護理師、病患 LINE 機器人」三端的完整業務流，方便進行操作演示與功能驗證。</p>
      </div>
      <span class="badge px-3 py-2 text-teal border border-teal-light" style="background: var(--color-primary-light); font-size: 0.8rem; font-weight: 600;">演示環境 v1.2</span>
    </div>

    <!-- 主體內容 -->
    <div class="container-fluid py-4 px-4">
      <div class="row g-4">

        <!-- 左側角色及步驟導航 -->
        <div class="col-12 col-lg-3">
          <div class="clinical-card bg-white p-4 h-100">
            <h2 class="fs-6 fw-bold mb-3.5 pb-2 border-bottom text-muted text-uppercase" style="letter-spacing: .06em; font-size: 0.8rem;">
              <i class="bi bi-person-workspace text-teal" aria-hidden="true"></i> 第一步：選擇模擬角色
            </h2>
            
            <div class="d-flex flex-column gap-2 mb-4">
              <button v-for="r in roles" :key="r.id"
                      class="btn w-100 text-start py-2.5 px-3.5 transition-btn d-flex align-items-center justify-content-between"
                      :class="activeRole === r.id ? 'btn-teal shadow-sm text-white' : 'btn-light text-secondary border'"
                      style="border-radius: 12px; font-weight: 600;"
                      @click="selectRole(r.id)">
                <span><span class="me-2.5">{{ r.icon }}</span>{{ r.label }}</span>
                <i class="bi bi-chevron-right small opacity-75" aria-hidden="true"></i>
              </button>
            </div>

            <h2 class="fs-6 fw-bold mb-3.5 pt-2 pb-2 border-bottom text-muted text-uppercase" style="letter-spacing: .06em; font-size: 0.8rem;">
              <i class="bi bi-list-task text-teal" aria-hidden="true"></i> 第二步：點選演示步驟
            </h2>

            <!-- 步驟垂直 timeline -->
            <div class="position-relative ps-2">
              <div class="position-absolute h-100 border-start border-2" style="left: 17px; top: 8px; z-index: 1; border-color: #e2e8f0 !important;"></div>
              
              <div v-for="(s, i) in currentRole.steps" :key="i"
                   class="position-relative d-flex align-items-start gap-3 mb-4 cursor-pointer user-select-none"
                   style="z-index: 2;"
                   @click="stepIndex = i">
                <!-- 狀態圈圈 -->
                <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 transition-btn shadow-sm"
                     style="width: 22px; height: 22px; font-size: .7rem; font-weight: 700;"
                     :style="{
                       background: i === stepIndex ? 'var(--color-primary)' : i < stepIndex ? 'var(--color-accent)' : '#fff',
                       color: i === stepIndex ? '#fff' : i < stepIndex ? '#fff' : '#94a3b8',
                       border: i === stepIndex ? '2px solid var(--color-primary)' : i < stepIndex ? '2px solid var(--color-accent)' : '2px solid #cbd5e1'
                     }">
                  {{ i < stepIndex ? '✓' : i + 1 }}
                </div>
                <!-- 步驟名稱 -->
                <div class="small" style="line-height: 1.4; padding-top: 1px;">
                  <span class="d-block fw-bold"
                        :style="{ color: i === stepIndex ? 'var(--color-primary)' : i < stepIndex ? 'var(--color-accent)' : '#64748b' }">
                    {{ s }}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- 右側演示畫面 -->
        <div class="col-12 col-lg-9">
          <div class="clinical-card bg-white p-4 d-flex flex-column h-100" style="min-height: 580px;">

            <!-- 演示區域標題 -->
            <div class="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-2">
              <div>
                <span class="badge me-2 text-white" style="background: var(--color-primary); font-size: 0.78rem; font-weight: 600; padding: 5px 10px;">
                  步驟 {{ stepIndex + 1 }} / {{ totalSteps }}
                </span>
                <span class="fw-bold fs-6" style="color: var(--color-primary);">{{ stepLabel }}</span>
              </div>
              <div class="text-muted small fw-semibold">
                正在展示：{{ currentRole.icon }} {{ currentRole.label }} 介面
              </div>
            </div>

            <!-- 演示實體內容 -->
            <div class="flex-grow-1">
              <Transition name="step-fade" mode="out-in">

                <!-- ══════════════════════════════════════
                     醫師後台
                ══════════════════════════════════════ -->
                <div v-if="activeRole === 'doctor'" :key="'d' + stepIndex">

                  <!-- D0 儀表板總覽 -->
                  <div v-if="stepIndex === 0">
                    <div class="row g-3 mb-4">
                      <div class="col-6 col-md-3" v-for="(c,i) in [
                        { label:'總病患數', val: mockSummary.total,        color:'var(--color-primary)', icon:'bi-people'       },
                        { label:'追蹤中',   val: mockSummary.active,       color:'var(--color-accent)', icon:'bi-activity'     },
                        { label:'平均完整度', val: mockSummary.completeness+'%', color:'#f59e0b', icon:'bi-percent' },
                        { label:'AI待確認', val: mockSummary.pending,      color:'#ef4444', icon:'bi-clock-history' },
                      ]" :key="i">
                        <div class="p-3 border rounded-3 bg-light-soft" :style="`border-left: 4px solid ${c.color} !important; border-radius: 12px;`">
                          <div class="text-muted small mb-1"><i :class="'bi '+c.icon+' me-1'" aria-hidden="true"></i>{{ c.label }}</div>
                          <div class="fs-4 fw-bold tabular-nums" :style="`color:${c.color}`">{{ c.val }}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div class="small fw-bold text-muted mb-2"><i class="bi bi-table me-1" aria-hidden="true"></i>病患追蹤進度清單 (模擬畫面)</div>
                    <div class="table-responsive border rounded-3 overflow-hidden">
                      <table class="clinical-table mb-0 text-nowrap" style="font-size: .82rem;">
                        <thead>
                          <tr>
                            <th scope="col">研究編號</th>
                            <th scope="col">手術日期</th>
                            <th scope="col">手術名稱</th>
                            <th scope="col">術後進程</th>
                            <th scope="col">LINE 狀態</th>
                            <th scope="col">最後 VAS</th>
                            <th scope="col">填寫進度</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="p in mockPatients" :key="p.researchId">
                            <td class="tabular-nums font-semibold"><strong>{{ p.researchId }}</strong></td>
                            <td class="tabular-nums text-muted">{{ p.opDate }}</td>
                            <td>{{ p.opName }}</td>
                            <td class="tabular-nums"><span class="badge bg-light text-dark border">D+{{ p.daysPostOp }}</span></td>
                            <td><span class="badge" :style="lineClass[p.lineStatus]">{{ lineLabel[p.lineStatus] }}</span></td>
                            <td class="tabular-nums"><span :style="vasStyle(p.lastVas)">{{ p.lastVas }}</span></td>
                            <td style="min-width: 150px;">
                              <div class="d-flex align-items-center gap-2">
                                <div style="flex: 1; height: 6px; border-radius: 3px; background: #e2e8f0; overflow: hidden;">
                                  <div :style="`height: 100%; width: ${p.pct}%; background: ${pctColor(p.pct)}`"></div>
                                </div>
                                <span class="small fw-bold tabular-nums" :style="`color: ${pctColor(p.pct)}`">{{ p.pct }}%</span>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <!-- D1 AI待確認 -->
                  <div v-else-if="stepIndex === 1">
                    <div class="d-flex align-items-center gap-2.5 mb-3 p-3 rounded-3" style="background: #fffbeb; border: 1px solid #fde047;">
                      <i class="bi bi-robot fs-5 text-warning" aria-hidden="true"></i>
                      <span class="small text-secondary">
                        <strong>AI 自由文字自動分析：</strong> 當患者在 LINE 中直接回報文字訊息而非填寫問卷時，後台 AI 模組會自動提取其中的 <strong>背痛分數</strong>、<strong>腿痛分數</strong> 與 <strong>症狀描述</strong>，在此等待臨床醫療人員人工核准。核准後，將自動轉換並寫入追蹤日誌。
                      </span>
                    </div>

                    <div v-for="r in mockPending" :key="r.id" v-show="!rejectedRows.has(r.id)"
                         class="card mb-3 border-0 transition-btn shadow-sm"
                         style="border-radius: 12px; border-left: 5px solid #f59e0b !important; background: #fffdf5;">
                      <div class="card-body p-3.5">
                        <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                          <div style="min-width: 0; flex: 1;">
                            <div class="d-flex align-items-center gap-2 mb-1.5">
                              <span class="fw-bold text-teal font-monospace">{{ r.researchId }}</span>
                              <span class="text-muted small font-monospace"><i class="bi bi-clock me-1" aria-hidden="true"></i>今天 {{ r.time }}</span>
                            </div>
                            <div class="p-2 rounded mb-2.5 small" style="background: rgba(245, 158, 11, 0.06); border-left: 3px solid #fde047; font-style: italic; color: #475569;">
                              「{{ r.raw }}」
                            </div>
                            <div class="small fw-medium d-flex align-items-center gap-2 flex-wrap text-secondary">
                              <span>背痛估算：<span :style="vasStyle(r.aiBack)">{{ r.aiBack }}</span></span>
                              <span class="text-muted">|</span>
                              <span>腿痛估算：<span :style="vasStyle(r.aiLeg)">{{ r.aiLeg }}</span></span>
                              <span class="text-muted">|</span>
                              <span class="text-muted fw-normal">AI摘要：{{ r.summary }}</span>
                            </div>
                          </div>
                          
                          <div class="d-flex gap-2 flex-shrink-0">
                            <template v-if="!approvedRows.has(r.id)">
                              <button class="btn btn-success btn-sm px-3.5 py-1.5 fw-bold d-flex align-items-center gap-1 shadow-sm transition-btn" @click="demoApprove(r.id)">
                                <i class="bi bi-check-lg" aria-hidden="true"></i>核准寫入
                              </button>
                              <button class="btn btn-outline-danger btn-sm p-1.5 transition-btn" @click="demoReject(r.id)" aria-label="退回">
                                <i class="bi bi-x-lg" aria-hidden="true"></i>
                              </button>
                            </template>
                            <span v-else class="badge bg-success align-self-center py-2 px-3 fw-bold d-flex align-items-center gap-1.5">
                              <i class="bi bi-patch-check" aria-hidden="true"></i>已核准寫入
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div v-if="mockPending.every(r => rejectedRows.has(r.id) || approvedRows.has(r.id))"
                         class="text-center text-success py-5">
                      <i class="bi bi-check-circle-fill fs-1 d-block mb-3" aria-hidden="true"></i>
                      <div class="fw-bold fs-6">目前暫無待確認條目</div>
                      <div class="small text-muted mt-1">所有從 LINE 擷取之 AI 估算關懷記錄皆已處理完畢。</div>
                    </div>
                  </div>

                  <!-- D2 病患詳情 -->
                  <div v-else-if="stepIndex === 2">
                    <div class="rounded-3 border p-3.5 mb-4 bg-light-soft" style="border-radius: 12px;">
                      <div class="row g-3 small">
                        <div class="col-6 col-sm-4"><div class="text-muted">研究個案編號</div><div class="fw-bold fs-6 text-teal">{{ mockDetail.researchId }}</div></div>
                        <div class="col-6 col-sm-4"><div class="text-muted">手術術式</div><div class="fw-bold">{{ mockDetail.opName }} ({{ mockDetail.opLevels }})</div></div>
                        <div class="col-6 col-sm-4"><div class="text-muted">主刀醫師</div><div class="fw-bold">{{ mockDetail.surgeon }}</div></div>
                        <div class="col-6 col-sm-4"><div class="text-muted">術後追蹤期</div><div class="fw-bold"><span class="badge bg-light text-dark border tabular-nums">D+{{ mockDetail.daysPostOp }}</span></div></div>
                        <div class="col-6 col-sm-4">
                          <div class="text-muted">術前 VAS 背/腿</div>
                          <div class="fw-bold d-flex gap-1 align-items-center">
                            <span :style="vasStyle(mockDetail.preVasBack)">{{ mockDetail.preVasBack }}</span>
                            <span class="text-muted">/</span>
                            <span :style="vasStyle(mockDetail.preVasLeg)">{{ mockDetail.preVasLeg }}</span>
                          </div>
                        </div>
                        <div class="col-6 col-sm-4"><div class="text-muted">術前 ODI 指數</div><div class="fw-bold tabular-nums">{{ mockDetail.preOdi }}%</div></div>
                      </div>
                    </div>
                    
                    <div class="small fw-bold text-muted mb-2"><i class="bi bi-activity me-1" aria-hidden="true"></i>術後歷次時間點關懷回報紀錄 (模擬趨勢)</div>
                    <div class="table-responsive border rounded-3 overflow-hidden">
                      <table class="clinical-table mb-0 text-nowrap" style="font-size: .8rem;">
                        <thead>
                          <tr>
                            <th scope="col">時間點</th>
                            <th scope="col" class="text-center">背部疼痛</th>
                            <th scope="col" class="text-center">腿部疼痛</th>
                            <th scope="col" class="text-center">ODI %</th>
                            <th scope="col">患者自我整體改善感 (PGIC)</th>
                            <th scope="col">可接受度 (PASS)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style="background: rgba(245, 158, 11, 0.04);">
                            <td><span class="badge bg-secondary font-monospace">Pre-Op 術前</span></td>
                            <td class="text-center"><span :style="vasStyle(mockDetail.preVasBack)">{{ mockDetail.preVasBack }}</span></td>
                            <td class="text-center"><span :style="vasStyle(mockDetail.preVasLeg)">{{ mockDetail.preVasLeg }}</span></td>
                            <td class="text-center tabular-nums">{{ mockDetail.preOdi }}%</td>
                            <td class="text-muted">—</td>
                            <td class="text-muted">—</td>
                          </tr>
                          <tr v-for="r in mockRecords" :key="r.day">
                            <td><span class="badge bg-light text-dark border font-monospace">{{ r.day }}</span></td>
                            <td class="text-center"><span :style="vasStyle(r.back)">{{ r.back }}</span></td>
                            <td class="text-center"><span :style="vasStyle(r.leg)">{{ r.leg }}</span></td>
                            <td class="text-center tabular-nums">{{ r.odi !== null ? r.odi+'%' : '—' }}</td>
                            <td>{{ r.pgic ? pgicLabel(r.pgic) : '—' }}</td>
                            <td>
                              <span v-if="r.pass === 'Y'" class="badge" style="background: #e6fdf5; color: #0f766e; border: 1px solid #ccfbf1;">滿意 (Y)</span>
                              <span v-else-if="r.pass === 'N'" class="badge" style="background: #fef2f2; color: #b91c1c; border: 1px solid #fee2e2;">未滿意 (N)</span>
                              <span v-else class="text-muted">—</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <!-- D3 MCID -->
                  <div v-else-if="stepIndex === 3">
                    <div class="row g-3 mb-4">
                      <div class="col-4" v-for="(c,i) in [
                        { label:'VAS 背部改善 MCID', val:'71.4%', color:'#10b981' },
                        { label:'ODI 功能改善 MCID', val:'65.2%', color:'var(--color-primary)' },
                        { label:'PASS 滿意度達成率', val:'80.0%', color:'#8b5cf6' },
                      ]" :key="i">
                        <div class="p-3 border rounded-3 bg-light-soft text-center" :style="`border-top: 4px solid ${c.color} !important; border-radius: 12px;`">
                          <div class="text-muted small mb-1">{{ c.label }}</div>
                          <div class="fs-3 fw-bold tabular-nums" :style="`color:${c.color}`">{{ c.val }}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div class="small fw-bold text-muted mb-2"><i class="bi bi-patch-check-fill text-teal me-1" aria-hidden="true"></i>病患 MCID 達成明細 (隨機樣本)</div>
                    <div class="table-responsive border rounded-3 overflow-hidden">
                      <table class="clinical-table mb-0 text-nowrap" style="font-size: .82rem;">
                        <thead>
                          <tr>
                            <th scope="col">研究個案編號</th>
                            <th scope="col">VAS 背痛 (改善≥2.5)</th>
                            <th scope="col">VAS 腿痛 (改善)</th>
                            <th scope="col">ODI 功能 (改善≥12.8%)</th>
                            <th scope="col">整體滿意度 (PASS)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="r in mockMcid" :key="r.researchId">
                            <td class="tabular-nums font-semibold"><strong>{{ r.researchId }}</strong></td>
                            <td>
                              <span v-if="r.vasB === '✅'" class="text-success"><i class="bi bi-check-circle-fill me-1" aria-hidden="true"></i>達成</span>
                              <span v-else class="text-danger"><i class="bi bi-x-circle-fill me-1" aria-hidden="true"></i>未達</span>
                            </td>
                            <td>
                              <span v-if="r.vasL === '✅'" class="text-success"><i class="bi bi-check-circle-fill me-1" aria-hidden="true"></i>達成</span>
                              <span v-else class="text-danger"><i class="bi bi-x-circle-fill me-1" aria-hidden="true"></i>未達</span>
                            </td>
                            <td>
                              <span v-if="r.odi === '✅'" class="text-success"><i class="bi bi-check-circle-fill me-1" aria-hidden="true"></i>達成</span>
                              <span v-else class="text-danger"><i class="bi bi-x-circle-fill me-1" aria-hidden="true"></i>未達</span>
                            </td>
                            <td>
                              <span v-if="r.pass === 'Y'" class="badge" style="background: #ecfeff; color: #0891b2; border: 1px solid #cffafe;">滿意 (Y)</span>
                              <span v-else class="badge" style="background: #fff1f2; color: #e11d48; border: 1px solid #ffe4e6;">不滿意 (N)</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <!-- D4 系統設定 -->
                  <div v-else-if="stepIndex === 4">
                    <div class="card mb-4 border-0 shadow-sm" style="border-radius: 12px; background: #fff;">
                      <div class="card-body p-2 d-flex gap-2 flex-wrap">
                        <button class="btn btn-sm px-4 py-2 fw-semibold transition-btn"
                                :class="settingsTab === 'implant' ? 'btn-teal text-white shadow-sm' : 'btn-light text-muted'"
                                @click="settingsTab = 'implant'">
                          <i class="bi bi-box-seam me-1" aria-hidden="true"></i>脊椎骨科耗材管理
                        </button>
                        <button class="btn btn-sm px-4 py-2 fw-semibold transition-btn"
                                :class="settingsTab === 'bot' ? 'btn-teal text-white shadow-sm' : 'btn-light text-muted'"
                                @click="settingsTab = 'bot'">
                          <i class="bi bi-robot me-1" aria-hidden="true"></i>LINE Bot 自動回覆
                        </button>
                      </div>
                    </div>

                    <div v-if="settingsTab==='implant'">
                      <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="text-muted small">共 {{ mockImplants.length }} 筆模擬耗材對照</span>
                        <button class="btn btn-primary btn-sm px-3 py-1.5 fw-bold" @click="showToast('展示模式：無法真正新增耗材', 'warning')">
                          <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>新增耗材品項
                        </button>
                      </div>
                      
                      <div class="table-responsive border rounded-3 overflow-hidden">
                        <table class="clinical-table mb-0 text-nowrap" style="font-size: .8rem;">
                          <thead>
                            <tr>
                              <th scope="col">耗材代碼</th>
                              <th scope="col">醫材品名</th>
                              <th scope="col">耗材類別</th>
                              <th scope="col">原廠廠牌</th>
                              <th scope="col" style="width: 80px; text-align: right;">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="item in mockImplants" :key="item.code">
                              <td class="font-monospace"><strong>{{ item.code }}</strong></td>
                              <td>{{ item.name }}</td>
                              <td><span class="badge" :style="catClass(item.category)">{{ item.category }}</span></td>
                              <td class="text-muted">{{ item.brand }}</td>
                              <td style="text-align: right;">
                                <div class="d-flex gap-1 justify-content-end">
                                  <button class="btn btn-outline-secondary btn-sm p-1" @click="showToast('展示編輯：' + item.code)" aria-label="編輯"><i class="bi bi-pencil" aria-hidden="true"></i></button>
                                  <button class="btn btn-outline-danger btn-sm p-1" @click="showToast('展示刪除：' + item.code)" aria-label="刪除"><i class="bi bi-trash" aria-hidden="true"></i></button>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div v-else class="text-center py-5 text-muted border border-dashed rounded-3">
                      <i class="bi bi-robot fs-1 text-teal-soft d-block mb-3" aria-hidden="true" style="color: #cbd5e1;"></i>
                      <div class="fw-bold">LINE Bot 自動對答策略設定</div>
                      <div class="small mt-1 px-4 text-center mx-auto" style="max-width: 480px;">
                        包含「綁定成功回覆」、「每日追蹤問卷起始詞」、「衛教資料庫自動發佈」等。系統可依據患者的臨床術後天數（如 D7、D14、D28）智慧推送關聯文章。
                      </div>
                    </div>
                  </div>

                </div>

                <!-- ══════════════════════════════════════
                     護理師作業
                ══════════════════════════════════════ -->
                <div v-else-if="activeRole === 'nurse'" :key="'n' + stepIndex">

                  <!-- N0 手術登錄 -->
                  <div v-if="stepIndex === 0">
                    <div class="d-flex align-items-center gap-2 mb-4 p-3 rounded-3" style="background: rgba(10, 92, 102, 0.05); border-left: 4px solid var(--color-primary);">
                      <i class="bi bi-person-plus-fill text-teal fs-5" aria-hidden="true"></i>
                      <span class="small text-secondary">
                        <strong>新手術個案登錄：</strong> 在患者出院前，護理師在此錄入手術基本資訊。系統將自動生成專屬研究編號，並產生一個時效性之 6 位數 LINE 綁定驗證碼。
                      </span>
                    </div>
                    
                    <div class="row g-3" style="max-width: 600px;">
                      <div class="col-12 col-sm-6">
                        <label class="form-label small fw-bold text-muted">個案研究編號（系統自動派發）</label>
                        <input class="form-control form-control-sm font-monospace fw-bold" value="SP-2026-044" readonly style="background: #e6fdf5; color: #0f766e; border: 1px solid #ccfbf1;">
                      </div>
                      <div class="col-12 col-sm-6">
                        <label class="form-label small fw-bold text-muted" for="chart-num">病歷號 (僅儲存於加密表)</label>
                        <input id="chart-num" class="form-control form-control-sm focus-ring" value="C9012345" placeholder="請輸入病患病歷號">
                      </div>
                      <div class="col-12 col-sm-6">
                        <label class="form-label small fw-bold text-muted" for="op-date">手術日期</label>
                        <input id="op-date" type="date" class="form-control form-control-sm focus-ring" value="2026-06-04">
                      </div>
                      <div class="col-12 col-sm-6">
                        <label class="form-label small fw-bold text-muted" for="op-select">手術名稱</label>
                        <select id="op-select" class="form-select form-select-sm focus-ring"><option>MIS TLIF</option><option>PLIF</option></select>
                      </div>
                      <div class="col-12 col-sm-6">
                        <label class="form-label small fw-bold text-muted" for="surgeon-name">主刀醫師</label>
                        <input id="surgeon-name" class="form-control form-control-sm focus-ring" value="陳大偉醫師">
                      </div>
                      <div class="col-12 col-sm-6">
                        <label class="form-label small fw-bold text-muted" for="levels">病灶節段</label>
                        <input id="levels" class="form-control form-control-sm focus-ring" value="L4-5">
                      </div>
                      <div class="col-12">
                        <button class="btn btn-teal btn-sm px-4 py-2 fw-semibold shadow-sm transition-btn focus-ring" @click="showToast('✅ 模擬存檔完成，已自動導向綁定頁面')">
                          <i class="bi bi-save me-1.5" aria-hidden="true"></i>確認登錄並產生 LINE 綁定碼
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- N1 LINE 綁定碼 -->
                  <div v-else-if="stepIndex === 1">
                    <div class="text-center py-4 px-3">
                      <div class="text-muted small fw-semibold">個案 SP-2026-044 手術登錄完成</div>
                      <div class="display-3 fw-bold my-4 font-monospace tabular-nums text-teal" style="letter-spacing: .15em; text-shadow: 0 2px 4px rgba(0,0,0,0.06);">
                        391 847
                      </div>
                      
                      <div class="d-inline-flex align-items-center gap-2 p-2.5 rounded-pill mb-4 border" style="background: #fffbeb; border-color: #fde047 !important; color: #b45309;">
                        <i class="bi bi-clock-fill" aria-hidden="true"></i>
                        <span class="small font-semibold font-monospace">有效綁定時間：48 小時內（至 2026-06-06 23:28）</span>
                      </div>
                      
                      <div class="d-flex flex-column align-items-center justify-content-center mt-2">
                        <!-- Line QR Code placeholder -->
                        <div class="d-flex flex-column align-items-center justify-content-center rounded-3 p-3 border-dashed mb-3"
                             style="width: 140px; height: 140px; border: 3px solid #00B900; background: #fdfdfd; color: #00B900;">
                          <i class="bi bi-qr-code fs-1" aria-hidden="true"></i>
                          <span class="small fw-bold mt-1" style="font-size: 0.72rem;">LINE 官方帳號</span>
                        </div>
                        <p class="text-muted small max-width-md mx-auto" style="max-width: 450px;">
                          病患使用個人手機掃描上方 QR Code 加入關懷好友，於對話視窗中輸入此 <strong>6 位數綁定碼</strong> 即可完成關連，即刻啟動定時關懷問卷提醒。
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- N2 回診登記 -->
                  <div v-else-if="stepIndex === 2">
                    <div class="d-flex align-items-center gap-2.5 mb-3 p-3 rounded-3" style="background: #e6fdf5; border: 1px solid #ccfbf1; color: #0f766e;">
                      <i class="bi bi-search fs-5" aria-hidden="true"></i>
                      <span class="small">
                        <strong>智慧回診登記：</strong> 護理師在診間為患者登記回診時，可直接輸入病患編號後 3 碼（例如「012」）或病歷號。系統將即時補全個案資料並呈顯其最近期填報狀態。
                      </span>
                    </div>

                    <!-- Autocomplete 搜尋框 -->
                    <div class="mb-4" style="position: relative; max-width: 500px;">
                      <div class="d-flex gap-2">
                        <div class="position-relative flex-grow-1">
                          <input v-model="searchQuery" type="text"
                                 class="form-control form-control-md focus-ring"
                                 placeholder="請輸入病患編號後三碼 (如 012) 或病歷號"
                                 @focus="showSuggest = true"
                                 @blur="setTimeout(() => showSuggest = false, 200)"
                                 @keyup.enter="doSearch">
                          
                          <div v-if="showSuggest && filteredSugg.length"
                               class="position-absolute w-100 bg-white border rounded-3 mt-1 shadow-lg overflow-hidden"
                               style="z-index: 100;">
                            <div v-for="s in filteredSugg" :key="s"
                                 @mousedown.prevent="pickSuggest(s)"
                                 class="p-2.5 cursor-pointer small border-bottom dropdown-item"
                                 style="transition: background-color 0.15s ease;">
                              <i class="bi bi-person-fill text-teal me-2" aria-hidden="true"></i>{{ s }}
                            </div>
                          </div>
                        </div>
                        <button class="btn btn-teal px-4" style="border-radius: 12px;" @click="doSearch">
                          <i class="bi bi-search" aria-hidden="true"></i>
                        </button>
                      </div>
                    </div>

                    <!-- 搜尋結果展示 -->
                    <div v-if="searchDone" class="p-3.5 border rounded-3 bg-light-soft transition-btn" style="border-radius: 12px;">
                      <div class="d-flex justify-content-between align-items-center mb-3">
                        <div>
                          <div class="fw-bold fs-6 text-teal font-monospace">SP-2026-012</div>
                          <div class="text-muted small font-monospace">病歷編碼對照：A2345678</div>
                        </div>
                        <span class="badge" style="background: #e6fdf5; color: #0f766e; border: 1px solid #ccfbf1;">LINE 已正常綁定</span>
                      </div>
                      
                      <div class="row g-3 small mb-3.5">
                        <div class="col-4">
                          <div class="text-muted">術後天數</div>
                          <div class="fw-semibold font-monospace mt-0.5"><span class="badge bg-light text-dark border">D+80 天</span></div>
                        </div>
                        <div class="col-4">
                          <div class="text-muted">手術名稱</div>
                          <div class="fw-semibold mt-0.5">MIS TLIF (L4-5)</div>
                        </div>
                        <div class="col-4">
                          <div class="text-muted">最近一次 VAS</div>
                          <div class="fw-semibold mt-0.5 d-flex gap-1 align-items-center">
                            背 <span :style="vasStyle(2)">2</span> / 腿 <span :style="vasStyle(1)">1</span>
                          </div>
                        </div>
                      </div>
                      
                      <!-- 快速回診記錄 -->
                      <div class="border-top pt-3">
                        <div class="small fw-bold mb-2.5 text-teal"><i class="bi bi-clipboard-pulse me-1" aria-hidden="true"></i>本次回診臨床指標登記</div>
                        <div class="row g-3 small">
                          <div class="col-12 col-sm-6">
                            <label class="form-label small text-muted fw-bold" for="wound-state">傷口評估狀態</label>
                            <input id="wound-state" class="form-control form-control-sm focus-ring" value="術後拆線完畢，傷口乾燥癒合良好。">
                          </div>
                          <div class="col-6 col-sm-3">
                            <label class="form-label small text-muted fw-bold" for="odi-number">ODI 指數登記 (%)</label>
                            <input id="odi-number" type="number" class="form-control form-control-sm focus-ring" value="14">
                          </div>
                          <div class="col-6 col-sm-3">
                            <label class="form-label small text-muted fw-bold">患者滿意度 (PASS)</label>
                            <div class="btn-group btn-group-sm d-flex">
                              <button class="btn btn-teal active">滿意 (Y)</button>
                              <button class="btn btn-outline-secondary">未滿 (N)</button>
                            </div>
                          </div>
                        </div>
                        <button class="btn btn-teal btn-sm mt-3 px-3 py-2 fw-semibold transition-btn" @click="showToast('✅ 模擬回診數據已寫入診間臨床資料庫', 'success')">
                          <i class="bi bi-check-lg me-1" aria-hidden="true"></i>送出本次回診登記
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- N3 追蹤完整度 -->
                  <div v-else-if="stepIndex === 3">
                    <div class="small fw-bold text-muted mb-3"><i class="bi bi-percent me-1" aria-hidden="true"></i>病患追蹤期問卷完成率總覽 (共 5 名演示病患)</div>
                    
                    <div v-for="p in mockPatients" :key="p.researchId"
                         class="d-flex align-items-center gap-3 mb-3 p-3.5 border rounded-3 bg-light-soft" style="border-radius: 12px;">
                      <div class="small fw-bold font-monospace" style="width: 120px; flex-shrink: 0;">{{ p.researchId }}</div>
                      <span class="badge flex-shrink-0" :style="lineClass[p.lineStatus]" style="width: 70px; text-align: center;">{{ lineLabel[p.lineStatus] }}</span>
                      
                      <div class="flex-grow-1" style="height: 10px; border-radius: 5px; background: #e2e8f0; overflow: hidden; border: 1px solid #cbd5e1;">
                        <div :style="`height: 100%; width: ${p.pct}%; background: ${pctColor(p.pct)}; transition: width .5s;`"></div>
                      </div>
                      
                      <div class="small fw-bold font-monospace text-end" :style="`color: ${pctColor(p.pct)}; width: 44px;`">{{ p.pct }}%</div>
                    </div>
                    
                    <div class="mt-4 p-3 rounded-3 small border d-flex gap-2 align-items-start" style="background: #fffbeb; border-color: #fde047 !important; color: #b45309;">
                      <i class="bi bi-exclamation-triangle-fill fs-5 mt-0.5" aria-hidden="true"></i>
                      <div>
                        <strong>臨床完整度警示：</strong>
                        個案 SP-2026-031 尚未綁定 LINE，且個案 SP-2026-043 為新登錄個案（追蹤天數偏短，進度較低）。建議護理師可於回診時口頭提醒患者綁定並開啟 LINE 訊息通知。
                      </div>
                    </div>
                  </div>

                </div>

                <!-- ══════════════════════════════════════
                     病患 LINE Bot
                ══════════════════════════════════════ -->
                <div v-else-if="activeRole === 'patient'" :key="'p' + stepIndex">
                  <div class="d-flex justify-content-center">
                    
                    <!-- 手機外框 - 磨砂玻璃 Premium Glassmorphism 質感 -->
                    <div class="simulated-phone-container p-3" style="width: 380px; border: 10px solid #1e293b; border-radius: 40px; background: #0f172a; box-shadow: 0 12px 40px rgba(0,0,0,0.25);">
                      <!-- 頂部相機感應凹槽 -->
                      <div class="d-flex justify-content-center mb-3">
                        <div style="width: 80px; height: 16px; border-radius: 8px; background: #1e293b;"></div>
                      </div>
                      
                      <!-- LINE 專屬視窗 -->
                      <div class="rounded-4 overflow-hidden d-flex flex-column" style="background: #849ebd; height: 460px;">
                        <!-- LINE 頂部 Navbar -->
                        <div class="d-flex align-items-center gap-2 px-3 py-2 text-white" style="background: #06c755;">
                          <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                               style="width: 32px; height: 32px; background: rgba(255,255,255,0.25); font-size: .85rem;">
                            🏥
                          </div>
                          <div>
                            <div class="fw-bold small" style="font-size: 0.8rem; line-height: 1.2;">汐止國泰醫院 脊椎關懷助手</div>
                            <div class="text-white-50" style="font-size: .65rem;"><i class="bi bi-shield-check" aria-hidden="true"></i> 官方帳號 · 醫療服務</div>
                          </div>
                        </div>

                        <!-- 聊天訊息流對話區 -->
                        <div class="flex-grow-1 p-2.5 d-flex flex-column gap-2 overflow-y-auto" style="scroll-behavior: smooth;">
                          <template v-for="(msg, i) in chatSteps[stepIndex]" :key="i">
                            <template v-if="!msg.cond || msg.cond()">
                              
                              <!-- Bot 訊息泡泡 -->
                              <div v-if="msg.who === 'bot'" class="d-flex gap-1.5 align-items-start mb-1.5">
                                <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                                     style="width: 26px; height: 26px; background: #06c755; color: #fff; font-size: .65rem;">
                                  🏥
                                </div>
                                <div style="max-width: 245px;">
                                  <div class="bg-white rounded-3 px-2.5 py-2 shadow-sm text-dark" style="font-size: 0.78rem; line-height: 1.4; white-space: pre-line;">
                                    {{ msg.text }}
                                  </div>
                                  
                                  <!-- 1. VAS 疼痛滑動按鈕區 -->
                                  <div v-if="msg.vasGrid" class="d-flex flex-wrap gap-1 mt-1.5" style="max-width: 240px;">
                                    <button v-for="n in 11" :key="n-1" type="button"
                                            class="rounded-circle border-0 fw-bold d-flex align-items-center justify-content-center transition-btn"
                                            style="width: 28px; height: 28px; font-size: .75rem; cursor: pointer;"
                                            :style="{
                                              background: vasColors[n-1],
                                              color: [3,4,5].includes(n-1) ? '#333' : '#fff',
                                              transform: (msg.vasKey === 1 ? selectedVas1 : selectedVas2) === n-1 ? 'scale(1.22) rotate(10deg)' : 'scale(1)',
                                              border: (msg.vasKey === 1 ? selectedVas1 : selectedVas2) === n-1 ? '2px solid #000' : 'none'
                                            }"
                                            @click="msg.vasKey === 1 ? (selectedVas1 = n-1) : (selectedVas2 = n-1)">
                                      {{ n-1 }}
                                    </button>
                                  </div>
                                  
                                  <!-- 2. ODI 單選選項 -->
                                  <div v-if="msg.options" class="d-flex flex-column gap-1.5 mt-2" style="max-width: 240px;">
                                    <button v-for="(opt, oi) in msg.options" :key="oi" type="button"
                                            class="btn btn-sm text-start rounded-3 border text-dark transition-btn"
                                            :style="selectedOdi1 === oi ? 'background: #06c755; color: #fff; border-color: #06c755;' : 'background: #fff; border-color: #e2e8f0;'"
                                            style="font-size: .74rem; line-height: 1.3; font-weight: 500;"
                                            @click="selectedOdi1 = oi">
                                      {{ opt }}
                                    </button>
                                  </div>
                                  
                                  <!-- 3. Quick Reply 快速回覆按鈕 -->
                                  <div v-if="msg.quickReply" class="mt-1.5">
                                    <button class="btn btn-sm px-3 py-1.5 rounded-pill border-success text-success bg-white fw-bold transition-btn shadow-sm"
                                            style="font-size: .75rem; border: 1.5px solid;"
                                            @click="showToast('模擬動作：病患已點擊「' + msg.quickReply + '」衛教文章', 'success')">
                                      <i class="bi bi-book me-1" aria-hidden="true"></i> {{ msg.quickReply }}
                                    </button>
                                  </div>
                                  
                                </div>
                              </div>
                              
                              <!-- 病患訊息泡泡 -->
                              <div v-else class="d-flex justify-content-end mb-1.5">
                                <div class="rounded-3 px-2.5 py-2 shadow-sm" style="background: #8ced72; color: #000; font-size: 0.78rem; max-width: 200px; white-space: pre-line; line-height: 1.3;">
                                  {{ msg.text }}
                                </div>
                              </div>

                            </template>
                          </template>
                        </div>

                        <!-- LINE 輸入控制列 (只作視覺呈現) -->
                        <div class="d-flex gap-1.5 p-2 bg-white border-top align-items-center">
                          <i class="bi bi-plus-lg text-muted fs-5 cursor-pointer" aria-hidden="true"></i>
                          <i class="bi bi-camera text-muted fs-5 cursor-pointer" aria-hidden="true"></i>
                          <div class="flex-grow-1 rounded-pill px-3 py-1 small text-muted border text-start" style="font-size: 0.72rem; background: #f8fafc;">
                            輸入訊息或點選下方選單...
                          </div>
                          <button class="rounded-circle border-0 d-flex align-items-center justify-content-center"
                                  style="width: 28px; height: 28px; background: #06c755; color: #fff;"
                                  @click="showToast('請使用上方對話框中的按鈕進行互動點選', 'info')">
                            <i class="bi bi-arrow-up-short fs-5" aria-hidden="true"></i>
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

              </Transition>
            </div>

            <!-- 演示底部控制導覽 -->
            <div class="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
              <button class="btn btn-outline-secondary btn-sm px-3 fw-bold focus-ring" :disabled="stepIndex === 0" @click="prevStep">
                <i class="bi bi-chevron-left me-1" aria-hidden="true"></i>上一步
              </button>
              <span class="text-muted small font-monospace">演示進度：{{ stepIndex + 1 }} / {{ totalSteps }}</span>
              <button class="btn btn-teal btn-sm px-3 fw-bold focus-ring" :disabled="stepIndex === totalSteps - 1" @click="nextStep">
                下一步<i class="bi bi-chevron-right ms-1" aria-hidden="true"></i>
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>

    <!-- Toast container -->
    <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 9000;">
      <Transition name="toast-fade">
        <div v-if="toast.show"
             class="toast show align-items-center text-white border-0 shadow-lg px-2 py-1"
             :class="`bg-${toast.type === 'danger' ? 'danger' : toast.type === 'warning' ? 'warning' : 'success'}`"
             role="alert"
             aria-live="assertive"
             aria-atomic="true">
          <div class="d-flex">
            <div class="toast-body fw-medium d-flex align-items-center gap-2">
              <i v-if="toast.type === 'success'" class="bi bi-check-circle-fill" aria-hidden="true"></i>
              <i v-else-if="toast.type === 'warning'" class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
              <i v-else class="bi bi-x-circle-fill" aria-hidden="true"></i>
              {{ toast.msg }}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto shadow-none"
                    @click="toast.show = false" aria-label="關閉通知"></button>
          </div>
        </div>
      </Transition>
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
.bg-light-soft {
  background-color: #f8fafc;
  border: 1px solid var(--color-border);
}
.text-teal {
  color: var(--color-primary) !important;
}
.step-fade-enter-active, .step-fade-leave-active {
  transition: opacity .18s ease, transform .18s ease;
}
.step-fade-enter-from {
  opacity: 0;
  transform: translateX(12px);
}
.step-fade-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
.toast-fade-enter-active, .toast-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-fade-enter-from, .toast-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
.btn-close {
  background-size: 0.8rem;
  transition: transform 0.15s;
}
.btn-close:hover {
  transform: rotate(90deg);
}

.simulated-phone-container {
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.15);
}

.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}
.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}
.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 2px;
}
</style>
