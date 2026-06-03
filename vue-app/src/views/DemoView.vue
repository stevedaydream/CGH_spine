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
function demoApprove(id) { approvedRows.value = new Set([...approvedRows.value, id]); showToast('✅ 已核准，資料移入追蹤日誌') }
function demoReject(id)  { rejectedRows.value = new Set([...rejectedRows.value, id]); showToast('❌ 已拒絕') }

const deletedPatient = ref(false)

const toast = ref({ show: false, msg: '', type: 'info' })
let toastTimer = null
function showToast(msg, type = 'info') {
  clearTimeout(toastTimer)
  toast.value = { show: true, msg, type }
  toastTimer = setTimeout(() => { toast.value.show = false }, 2500)
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
    { who:'bot',     text:'您好！我是汐止國泰醫院骨科脊椎追蹤系統小幫手 🌿\n請輸入護理師提供的 6 位數綁定碼' },
    { who:'patient', text:'847392' },
    { who:'bot',     text:'🎉 綁定成功！\n研究編號：SP-2026-043\n系統將依術後時程定期傳送問卷提醒，\n共 17 個追蹤時間點（至術後第 84 天）' },
  ],
  [
    { who:'bot', text:'您好，今天是術後第 7 天 🌿\n請問您今天感覺如何呢？', quickReply: '開始填寫問卷' },
    { who:'patient', text:'開始填寫問卷' },
    { who:'bot', text:'好的，我們開始填寫問卷 📋\n共 14 個問題，約 3 分鐘完成' },
  ],
  [
    { who:'bot', text:'📍 背部疼痛 1/14\n0 = 完全不痛，10 = 最嚴重\n請選擇：', vasGrid: true, vasKey: 1 },
    { who:'patient', text:'3', cond: () => selectedVas1.value !== null },
    { who:'bot', text:'📍 腿部疼痛 2/14\n請選擇：', vasGrid: true, vasKey: 2 },
    { who:'patient', text:'2', cond: () => selectedVas2.value !== null },
  ],
  [
    { who:'bot', text:'📍 Q1 疼痛強度 3/14\n請選擇最符合您目前狀況的選項：',
      options: ['0 完全不痛','1 輕微疼痛','2 中度疼痛','3 嚴重疼痛','4 非常嚴重','5 最嚴重'], optKey: 'odi1' },
    { who:'patient', text:'1 輕微疼痛', cond: () => selectedOdi1.value !== null },
  ],
  [
    { who:'bot', text:'✅ 問卷填寫完成！\n術後第 7 天記錄已儲存：\n・背痛 3 分　・腿痛 2 分\n・ODI 22%　・PGIC 稍微改善\n・PASS：可接受' },
    { who:'bot', text:'💡 術後第 7 天衛教提醒\n以下主題適合您現階段參考：\n・傷口護理注意事項\n・術後復健運動\n・正確姿勢調整\n\n點選主題可查看詳細說明 👇', quickReply: '傷口護理' },
  ],
]

// ── 工具函式 ──────────────────────────────────────────────
const vasColors = ['#34a853','#4caf50','#8bc34a','#cddc39','#ffeb3b','#ffc107','#ff9800','#ff5722','#f44336','#e53935','#b71c1c']
const vasStyle  = v => v !== null && v !== undefined
  ? `display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font-size:.8rem;font-weight:700;color:${[3,4,5].includes(v)?'#333':'#fff'};background:${vasColors[v]}`
  : ''
const pctColor  = p => p >= 80 ? '#34a853' : p >= 50 ? '#fbbc04' : '#ea4335'
const lineLabel = { active: '已綁定', unbound: '未綁定', blocked: '已封鎖' }
const lineClass = { active: 'bg-success', unbound: 'bg-warning text-dark', blocked: 'bg-danger' }
const pgicLabel = v => ({1:'非常惡化',2:'明顯惡化',3:'稍微惡化',4:'沒有變化',5:'稍微改善',6:'明顯改善',7:'非常改善'}[v]||'-')
const catClass  = c => ({ Cage:'bg-primary', Screw:'bg-info text-dark', 'Bone Graft':'bg-success', Cement:'bg-secondary' }[c] || 'bg-secondary')
</script>

<template>
  <div style="background:#f0f4f8;min-height:100vh;font-family:'Segoe UI',sans-serif">

    <!-- Navbar（模擬真實系統 navbar）-->
    <nav class="navbar navbar-dark px-3 py-2" style="background:linear-gradient(135deg,#1a73e8,#0d47a1)">
      <span class="navbar-brand fw-bold"><i class="bi bi-hospital me-2"></i>脊椎追蹤系統</span>
      <div class="d-flex gap-1 flex-wrap">
        <span class="btn btn-outline-light btn-sm disabled opacity-75"><i class="bi bi-house me-1"></i>儀表板</span>
        <span class="btn btn-outline-light btn-sm disabled opacity-75"><i class="bi bi-person-plus me-1"></i>手術登錄</span>
        <span class="btn btn-outline-light btn-sm disabled opacity-75"><i class="bi bi-bar-chart-line me-1"></i>分析</span>
        <span class="btn btn-outline-light btn-sm disabled opacity-75"><i class="bi bi-download me-1"></i>匯出</span>
        <span class="btn btn-outline-light btn-sm disabled opacity-75"><i class="bi bi-gear me-1"></i>系統設定</span>
        <span class="btn btn-outline-light btn-sm disabled opacity-75"><i class="bi bi-clipboard2-pulse me-1"></i>回診登記</span>
        <RouterLink to="/demo" class="btn btn-warning btn-sm"><i class="bi bi-play-circle me-1"></i>Demo演示</RouterLink>
      </div>
    </nav>

    <!-- 大標題 -->
    <div class="text-center py-3" style="background:linear-gradient(135deg,#e3f2fd,#f0f4f8);border-bottom:1px solid #dee2e6">
      <h4 class="fw-bold mb-0" style="color:#1a73e8">
        <i class="bi bi-stars me-2"></i>智慧化脊椎術後追蹤系統 · 功能演示
      </h4>
      <div class="text-muted small mt-1">汐止國泰醫院骨科 · 2026 ｜ 互動式角色演示</div>
    </div>

    <!-- 主體 -->
    <div class="container-fluid py-3 px-3" style="max-width:1100px">
      <div class="row g-3">

        <!-- 左側角色選擇 -->
        <div class="col-auto" style="width:195px">
          <div class="card h-100 border-0 shadow-sm" style="border-radius:14px">
            <div class="card-body p-3">
              <div class="small fw-bold text-uppercase text-muted mb-3" style="letter-spacing:.06em">角色選擇</div>
              <div v-for="r in roles" :key="r.id" class="mb-2">
                <button class="btn w-100 text-start py-2 px-3"
                        :class="activeRole === r.id ? 'btn-primary shadow-sm' : 'btn-outline-secondary'"
                        style="border-radius:10px;font-size:.9rem"
                        @click="selectRole(r.id)">
                  <span class="me-2">{{ r.icon }}</span>{{ r.label }}
                </button>
              </div>
              <!-- 步驟進度 -->
              <div class="mt-4 pt-3 border-top">
                <div class="small text-muted mb-2 fw-semibold">步驟進度</div>
                <div v-for="(s, i) in currentRole.steps" :key="i"
                     class="d-flex align-items-center gap-2 mb-1"
                     style="cursor:pointer" @click="stepIndex = i">
                  <div style="width:18px;height:18px;border-radius:50%;font-size:.65rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s"
                       :style="{ background: i === stepIndex ? '#1a73e8' : i < stepIndex ? '#34a853' : '#dee2e6',
                                 color: i <= stepIndex ? '#fff' : '#999' }">
                    {{ i < stepIndex ? '✓' : i + 1 }}
                  </div>
                  <div class="small" style="line-height:1.2"
                       :style="{ color: i === stepIndex ? '#1a73e8' : i < stepIndex ? '#34a853' : '#999',
                                 fontWeight: i === stepIndex ? '600' : '400' }">
                    {{ s }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右側內容 -->
        <div class="col">
          <div class="card border-0 shadow-sm" style="border-radius:14px;min-height:540px">
            <div class="card-body p-4 d-flex flex-column">

              <!-- 步驟標題 -->
              <div class="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
                <div>
                  <span class="badge me-2" style="background:#1a73e8">{{ stepIndex + 1 }}/{{ totalSteps }}</span>
                  <span class="fw-bold fs-6">{{ stepLabel }}</span>
                </div>
                <div class="text-muted small">
                  {{ currentRole.icon }} {{ currentRole.label }}
                </div>
              </div>

              <!-- 步驟內容 -->
              <div class="flex-grow-1">
                <Transition name="step-fade" mode="out-in">

                  <!-- ══════════════════════════════════════
                       醫師後台
                  ══════════════════════════════════════ -->
                  <div v-if="activeRole === 'doctor'" :key="'d' + stepIndex">

                    <!-- D0 儀表板總覽 -->
                    <div v-if="stepIndex === 0">
                      <div class="row g-3 mb-3">
                        <div class="col-6 col-md-3" v-for="(c,i) in [
                          { label:'總病患數', val: mockSummary.total,        color:'#1a73e8', icon:'bi-people'       },
                          { label:'追蹤中',   val: mockSummary.active,       color:'#34a853', icon:'bi-activity'     },
                          { label:'平均完整度', val: mockSummary.completeness+'%', color:'#fbbc04', icon:'bi-percent' },
                          { label:'AI待確認', val: mockSummary.pending,      color:'#ea4335', icon:'bi-clock-history' },
                        ]" :key="i">
                          <div class="card p-3 border-0 shadow-sm" :style="`border-radius:12px;border-left:4px solid ${c.color}!important`">
                            <div class="text-muted small mb-1"><i :class="'bi '+c.icon+' me-1'"></i>{{ c.label }}</div>
                            <div class="fs-3 fw-bold" :style="`color:${c.color}`">{{ c.val }}</div>
                          </div>
                        </div>
                      </div>
                      <div class="small fw-semibold text-muted mb-2">病患追蹤列表</div>
                      <div class="table-responsive">
                        <table class="table table-hover table-sm align-middle mb-0" style="font-size:.85rem">
                          <thead class="table-light">
                            <tr>
                              <th>研究編號</th><th>手術日期</th><th>術式</th>
                              <th>術後天數</th><th>LINE</th><th>最後VAS</th><th>完整度</th><th></th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="p in mockPatients" :key="p.researchId">
                              <td class="fw-semibold">{{ p.researchId }}</td>
                              <td class="text-muted">{{ p.opDate }}</td>
                              <td>{{ p.opName }}</td>
                              <td><span class="badge bg-light text-dark border">D+{{ p.daysPostOp }}</span></td>
                              <td><span class="badge" :class="lineClass[p.lineStatus]" style="font-size:.72rem">{{ lineLabel[p.lineStatus] }}</span></td>
                              <td><span :style="vasStyle(p.lastVas)">{{ p.lastVas }}</span></td>
                              <td>
                                <div style="display:flex;align-items:center;gap:6px">
                                  <div style="flex:1;height:8px;border-radius:4px;background:#e9ecef">
                                    <div :style="`height:100%;border-radius:4px;width:${p.pct}%;background:${pctColor(p.pct)}`"></div>
                                  </div>
                                  <span class="small fw-bold" :style="`color:${pctColor(p.pct)}`">{{ p.pct }}%</span>
                                </div>
                              </td>
                              <td>
                                <div class="d-flex gap-1">
                                  <button class="btn btn-outline-primary btn-sm" style="font-size:.72rem" @click="showToast('開啟 '+p.researchId+' 詳情')">
                                    <i class="bi bi-journal-text me-1"></i>詳情
                                  </button>
                                  <button class="btn btn-outline-danger btn-sm" style="font-size:.72rem" @click="showToast('⚠️ 需確認後才會刪除', 'warning')" title="刪除個案">
                                    <i class="bi bi-trash"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <!-- D1 AI待確認 -->
                    <div v-else-if="stepIndex === 1">
                      <div class="d-flex align-items-center gap-2 mb-3">
                        <span class="badge bg-warning text-dark fs-6">{{ mockPending.filter(r => !rejectedRows.has(r.id)).length }} 筆待確認</span>
                        <span class="text-muted small">AI 解析病患自由文字訊息，醫師確認後寫入追蹤日誌</span>
                      </div>
                      <div v-for="r in mockPending" :key="r.id" v-show="!rejectedRows.has(r.id)"
                           class="card mb-2 border-0" style="border-radius:10px;border-left:4px solid #fbc02d!important;background:#fffde7">
                        <div class="card-body py-2 px-3">
                          <div class="d-flex justify-content-between align-items-start gap-2">
                            <div style="min-width:0">
                              <div class="fw-bold small mb-1">{{ r.researchId }} <span class="text-muted fw-normal">· {{ r.time }}</span></div>
                              <div class="text-muted small mb-1" style="font-style:italic">「{{ r.raw }}」</div>
                              <div class="small">
                                AI：背
                                <span :style="vasStyle(r.aiBack)">{{ r.aiBack }}</span>
                                &nbsp;腿
                                <span :style="vasStyle(r.aiLeg)">{{ r.aiLeg }}</span>
                                &nbsp;·&nbsp;{{ r.summary }}
                              </div>
                            </div>
                            <div class="d-flex gap-1 flex-shrink-0">
                              <template v-if="!approvedRows.has(r.id)">
                                <button class="btn btn-success btn-sm" style="font-size:.75rem" @click="demoApprove(r.id)">
                                  <i class="bi bi-check-lg"></i> 核准
                                </button>
                                <button class="btn btn-outline-danger btn-sm" style="font-size:.75rem" @click="demoReject(r.id)">
                                  <i class="bi bi-x-lg"></i>
                                </button>
                              </template>
                              <span v-else class="badge bg-success align-self-center">已核准</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div v-if="mockPending.every(r => rejectedRows.has(r.id) || approvedRows.has(r.id))"
                           class="text-center text-success py-3">
                        <i class="bi bi-check-circle-fill fs-3 d-block mb-1"></i>所有待確認記錄已處理完畢
                      </div>
                    </div>

                    <!-- D2 病患詳情 -->
                    <div v-else-if="stepIndex === 2">
                      <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="rounded-3 border p-3 flex-grow-1 me-3" style="background:#f8f9fa">
                          <div class="row g-2 small">
                            <div class="col-4"><div class="text-muted">研究編號</div><div class="fw-bold">{{ mockDetail.researchId }}</div></div>
                            <div class="col-4"><div class="text-muted">手術</div><div class="fw-bold">{{ mockDetail.opName }} {{ mockDetail.opLevels }}</div></div>
                            <div class="col-4"><div class="text-muted">主刀醫師</div><div class="fw-bold">{{ mockDetail.surgeon }}</div></div>
                            <div class="col-4"><div class="text-muted">術後天數</div><div class="fw-bold"><span class="badge bg-light text-dark border">D+{{ mockDetail.daysPostOp }}</span></div></div>
                            <div class="col-4">
                              <div class="text-muted">術前 VAS 背/腿</div>
                              <div class="fw-bold d-flex gap-1 align-items-center">
                                <span :style="vasStyle(mockDetail.preVasBack)">{{ mockDetail.preVasBack }}</span>
                                <span class="text-muted">/</span>
                                <span :style="vasStyle(mockDetail.preVasLeg)">{{ mockDetail.preVasLeg }}</span>
                              </div>
                            </div>
                            <div class="col-4"><div class="text-muted">術前 ODI</div><div class="fw-bold">{{ mockDetail.preOdi }}%</div></div>
                          </div>
                        </div>
                        <div>
                          <button class="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
                                  @click="showToast('確認刪除後將移除手術記錄及個資對照', 'warning')">
                            <i class="bi bi-trash"></i>刪除個案
                          </button>
                        </div>
                      </div>
                      <div class="small fw-semibold text-muted mb-2">術後各時間點趨勢</div>
                      <div class="table-responsive">
                        <table class="table table-sm table-hover align-middle mb-0" style="font-size:.83rem">
                          <thead class="table-light">
                            <tr><th>術後</th><th>背痛</th><th>腿痛</th><th>ODI</th><th>整體改善感</th><th>可接受</th></tr>
                          </thead>
                          <tbody>
                            <tr style="background:#fff8e1">
                              <td><span class="badge bg-secondary">術前</span></td>
                              <td><span :style="vasStyle(mockDetail.preVasBack)">{{ mockDetail.preVasBack }}</span></td>
                              <td><span :style="vasStyle(mockDetail.preVasLeg)">{{ mockDetail.preVasLeg }}</span></td>
                              <td>{{ mockDetail.preOdi }}%</td><td>—</td><td>—</td>
                            </tr>
                            <tr v-for="r in mockRecords" :key="r.day">
                              <td><span class="badge bg-light text-dark border">{{ r.day }}</span></td>
                              <td><span :style="vasStyle(r.back)">{{ r.back }}</span></td>
                              <td><span :style="vasStyle(r.leg)">{{ r.leg }}</span></td>
                              <td>{{ r.odi !== null ? r.odi+'%' : '—' }}</td>
                              <td class="small">{{ r.pgic ? pgicLabel(r.pgic) : '—' }}</td>
                              <td>
                                <span v-if="r.pass === 'Y'" class="badge bg-success">可接受</span>
                                <span v-else-if="r.pass === 'N'" class="badge bg-danger">不滿意</span>
                                <span v-else class="text-muted">—</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <!-- D3 MCID -->
                    <div v-else-if="stepIndex === 3">
                      <div class="row g-3 mb-3">
                        <div class="col-4" v-for="(c,i) in [
                          { label:'VAS 背 MCID 達成率', val:'71%', color:'#34a853' },
                          { label:'ODI MCID 達成率',    val:'65%', color:'#1a73e8' },
                          { label:'PASS 達成率',         val:'80%', color:'#9c27b0' },
                        ]" :key="i">
                          <div class="card text-center p-3 border-0 shadow-sm" :style="`border-radius:12px;border-top:4px solid ${c.color}!important`">
                            <div class="text-muted small mb-1">{{ c.label }}</div>
                            <div class="fs-2 fw-bold" :style="`color:${c.color}`">{{ c.val }}</div>
                          </div>
                        </div>
                      </div>
                      <div class="small fw-semibold text-muted mb-2">個人 MCID 明細</div>
                      <div class="table-responsive">
                        <table class="table table-sm table-hover align-middle mb-0" style="font-size:.83rem">
                          <thead class="table-light">
                            <tr><th>研究編號</th><th>VAS背 MCID</th><th>VAS腿 MCID</th><th>ODI MCID</th><th>PASS</th></tr>
                          </thead>
                          <tbody>
                            <tr v-for="r in mockMcid" :key="r.researchId">
                              <td class="fw-semibold">{{ r.researchId }}</td>
                              <td>{{ r.vasB }}</td><td>{{ r.vasL }}</td><td>{{ r.odi }}</td>
                              <td><span :class="r.pass==='Y'?'badge bg-success':'badge bg-danger'">{{ r.pass }}</span></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <!-- D4 系統設定 -->
                    <div v-else-if="stepIndex === 4">
                      <ul class="nav nav-tabs mb-3">
                        <li class="nav-item">
                          <button class="nav-link" :class="settingsTab==='bot'?'active fw-bold':''"
                                  @click="settingsTab='bot'">
                            <i class="bi bi-robot me-1"></i>LINE Bot 回覆設定
                          </button>
                        </li>
                        <li class="nav-item">
                          <button class="nav-link" :class="settingsTab==='edu'?'active fw-bold':''"
                                  @click="settingsTab='edu'">
                            <i class="bi bi-journal-medical me-1"></i>衛教 QA 管理
                          </button>
                        </li>
                        <li class="nav-item">
                          <button class="nav-link" :class="settingsTab==='implant'?'active fw-bold':''"
                                  @click="settingsTab='implant'">
                            <i class="bi bi-box-seam me-1"></i>耗材管理
                          </button>
                        </li>
                      </ul>

                      <div v-if="settingsTab==='implant'">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                          <span class="text-muted small">共 {{ mockImplants.length }} 筆耗材，可新增 / 編輯 / 刪除</span>
                          <button class="btn btn-primary btn-sm" @click="showToast('開啟新增耗材表單')">
                            <i class="bi bi-plus-lg me-1"></i>新增耗材
                          </button>
                        </div>
                        <div class="table-responsive">
                          <table class="table table-hover align-middle mb-0" style="font-size:.85rem">
                            <thead class="table-light">
                              <tr><th>代碼</th><th>名稱</th><th>類別</th><th>廠牌</th><th></th></tr>
                            </thead>
                            <tbody>
                              <tr v-for="item in mockImplants" :key="item.code">
                                <td><strong>{{ item.code }}</strong></td>
                                <td>{{ item.name }}</td>
                                <td><span class="badge" :class="catClass(item.category)">{{ item.category }}</span></td>
                                <td class="text-muted">{{ item.brand }}</td>
                                <td>
                                  <div class="d-flex gap-1">
                                    <button class="btn btn-outline-secondary btn-sm" @click="showToast('編輯 '+item.code)"><i class="bi bi-pencil"></i></button>
                                    <button class="btn btn-outline-danger btn-sm" @click="showToast('刪除 '+item.code)"><i class="bi bi-trash"></i></button>
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div v-else-if="settingsTab==='bot'" class="text-center py-4 text-muted">
                        <i class="bi bi-robot fs-2 d-block mb-2"></i>
                        管理 LINE Bot 系統訊息文字（綁定成功、問卷步驟等）<br>
                        <span class="small">及自訂關鍵字觸發回覆規則</span>
                      </div>

                      <div v-else class="text-center py-4 text-muted">
                        <i class="bi bi-journal-medical fs-2 d-block mb-2"></i>
                        管理術後衛教 QA 資料庫<br>
                        <span class="small">可依術後天數、類別篩選，LINE Bot 自動推送適合內容</span>
                      </div>
                    </div>

                  </div>

                  <!-- ══════════════════════════════════════
                       護理師作業
                  ══════════════════════════════════════ -->
                  <div v-else-if="activeRole === 'nurse'" :key="'n' + stepIndex">

                    <!-- N0 手術登錄 -->
                    <div v-if="stepIndex === 0">
                      <div class="d-flex align-items-center gap-2 mb-3 p-2 rounded" style="background:#e3f2fd">
                        <i class="bi bi-info-circle text-primary"></i>
                        <span class="small text-primary">手術登錄為獨立頁面，研究編號自動產生，病歷號存入加密個資對照表</span>
                      </div>
                      <div class="row g-3" style="max-width:480px">
                        <div class="col-6">
                          <label class="form-label small fw-semibold">研究編號（自動產生）</label>
                          <input class="form-control form-control-sm" value="SP-2026-044" readonly style="background:#e8f5e9;color:#1b5e20;font-weight:700">
                        </div>
                        <div class="col-6">
                          <label class="form-label small fw-semibold">病歷號（選填）</label>
                          <input class="form-control form-control-sm" value="C9012345" placeholder="院內病歷號">
                        </div>
                        <div class="col-6">
                          <label class="form-label small fw-semibold">手術日期 *</label>
                          <input type="date" class="form-control form-control-sm" value="2026-06-09">
                        </div>
                        <div class="col-6">
                          <label class="form-label small fw-semibold">術式 *</label>
                          <select class="form-select form-select-sm"><option>MIS TLIF</option></select>
                        </div>
                        <div class="col-6">
                          <label class="form-label small fw-semibold">主刀醫師</label>
                          <input class="form-control form-control-sm" value="陳大偉醫師">
                        </div>
                        <div class="col-6">
                          <label class="form-label small fw-semibold">手術節段</label>
                          <input class="form-control form-control-sm" value="L4-5">
                        </div>
                        <div class="col-6">
                          <label class="form-label small fw-semibold">介入組別</label>
                          <select class="form-select form-select-sm"><option>Line Bot 組</option></select>
                        </div>
                        <div class="col-12">
                          <button class="btn btn-primary btn-sm" @click="showToast('✅ 手術記錄已儲存，自動產生 LINE 綁定碼')">
                            <i class="bi bi-save me-1"></i>儲存手術記錄
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- N1 LINE 綁定碼 -->
                    <div v-else-if="stepIndex === 1">
                      <div class="d-flex align-items-center gap-2 mb-3 p-2 rounded" style="background:#f3e5f5">
                        <i class="bi bi-info-circle" style="color:#7b1fa2"></i>
                        <span class="small" style="color:#7b1fa2">登錄完成後系統自動產生綁定碼，直接交給病患或複製給護理師</span>
                      </div>
                      <div class="text-center py-2">
                        <div class="text-muted small mb-1">SP-2026-044 的 LINE 綁定碼</div>
                        <div class="display-1 fw-bold my-3" style="letter-spacing:.3em;color:#e65100;font-variant-numeric:tabular-nums">
                          391847
                        </div>
                        <div class="rounded-3 d-inline-block p-2 mb-3" style="background:#fffde7;border:2px dashed #fbc02d">
                          <i class="bi bi-clock me-1 text-warning"></i>
                          <span class="small fw-semibold">有效期限：2026-06-11 17:00（48小時）</span>
                        </div>
                        <br>
                        <div class="d-inline-flex align-items-center justify-content-center rounded-3 mb-3"
                             style="width:130px;height:130px;border:3px solid #00B900;background:#f8fff8;color:#00B900;font-weight:700;font-size:.9rem;text-align:center">
                          LINE<br>QR Code
                        </div>
                        <div class="text-muted small mt-1">病患掃描加入好友後，在對話框輸入此 6 位數碼完成綁定</div>
                      </div>
                    </div>

                    <!-- N2 回診登記 -->
                    <div v-else-if="stepIndex === 2">
                      <div class="d-flex align-items-center gap-2 mb-3 p-2 rounded" style="background:#e8f5e9">
                        <i class="bi bi-search text-success"></i>
                        <span class="small text-success fw-semibold">智慧搜尋：輸入流水號（如「012」）自動補全研究編號</span>
                      </div>
                      <!-- autocomplete demo -->
                      <div class="mb-3" style="position:relative;max-width:500px">
                        <div class="d-flex gap-2">
                          <div style="position:relative;flex:1">
                            <input v-model="searchQuery" type="text"
                                   class="form-control form-control-lg"
                                   placeholder="輸入 012 或 SP-2026-012 或病歷號"
                                   @focus="showSuggest = true"
                                   @blur="setTimeout(() => showSuggest = false, 200)"
                                   @keyup.enter="doSearch"
                                   style="border-radius:10px">
                            <div v-if="showSuggest && filteredSugg.length"
                                 style="position:absolute;top:calc(100%+4px);left:0;right:0;z-index:100;background:#fff;border:1px solid #dee2e6;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.12);overflow:hidden">
                              <div v-for="s in filteredSugg" :key="s"
                                   @mousedown.prevent="pickSuggest(s)"
                                   style="padding:10px 16px;cursor:pointer;font-size:.95rem;border-bottom:1px solid #f0f4f8"
                                   @mouseover="$event.target.style.background='#e8f0fe'"
                                   @mouseout="$event.target.style.background=''">
                                {{ s }}
                              </div>
                            </div>
                          </div>
                          <button class="btn btn-primary btn-lg px-4" style="border-radius:10px" @click="doSearch">
                            <i class="bi bi-search"></i>
                          </button>
                        </div>
                      </div>
                      <!-- 搜尋結果 -->
                      <div v-if="searchDone" class="rounded-3 border p-3 mb-3" style="background:#e8f5e9">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                          <div>
                            <div class="fw-bold" style="color:#1a73e8">SP-2026-012</div>
                            <div class="text-muted small">病歷號：A2345678</div>
                          </div>
                          <span class="badge bg-success">LINE 已綁定</span>
                        </div>
                        <div class="row g-2 small mb-3">
                          <div class="col-4"><div class="text-muted">術後天數</div><div class="fw-semibold"><span class="badge bg-light text-dark border">D+80</span></div></div>
                          <div class="col-4"><div class="text-muted">手術</div><div class="fw-semibold">MIS TLIF L4-5</div></div>
                          <div class="col-4"><div class="text-muted">上次VAS背/腿</div><div class="fw-semibold d-flex gap-1"><span :style="vasStyle(2)">2</span><span class="text-muted">/</span><span :style="vasStyle(1)">1</span></div></div>
                        </div>
                        <!-- 快速回診記錄 -->
                        <div class="border-top pt-2">
                          <div class="small fw-semibold mb-2" style="color:#1a73e8">快速回診記錄</div>
                          <div class="row g-2 small">
                            <div class="col-6">
                              <label class="form-label small mb-1">傷口狀況</label>
                              <input class="form-control form-control-sm" placeholder="例：傷口乾燥無滲液" value="傷口乾燥，縫線已拆除">
                            </div>
                            <div class="col-3">
                              <label class="form-label small mb-1">ODI %</label>
                              <input type="number" class="form-control form-control-sm" value="14">
                            </div>
                            <div class="col-3">
                              <label class="form-label small mb-1">PASS</label>
                              <div class="btn-group btn-group-sm">
                                <button class="btn btn-success active">Y</button>
                                <button class="btn btn-outline-danger">N</button>
                              </div>
                            </div>
                          </div>
                          <button class="btn btn-primary btn-sm mt-2" @click="showToast('✅ 回診記錄已儲存')">
                            <i class="bi bi-check-lg me-1"></i>儲存回診記錄
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- N3 追蹤完整度 -->
                    <div v-else-if="stepIndex === 3">
                      <div class="small fw-semibold text-muted mb-3">追蹤完整度總覽（共 {{ mockPatients.length }} 位）</div>
                      <div v-for="p in mockPatients" :key="p.researchId"
                           class="d-flex align-items-center gap-3 mb-2 p-2 rounded" style="background:#fff">
                        <div class="small fw-semibold" style="width:115px;flex-shrink:0">{{ p.researchId }}</div>
                        <span class="badge flex-shrink-0" :class="lineClass[p.lineStatus]" style="font-size:.7rem;width:52px;text-align:center">{{ lineLabel[p.lineStatus] }}</span>
                        <div style="flex:1;height:12px;border-radius:6px;background:#e9ecef">
                          <div :style="`height:100%;border-radius:6px;width:${p.pct}%;background:${pctColor(p.pct)};transition:width .6s`"></div>
                        </div>
                        <div class="small fw-bold" :style="`color:${pctColor(p.pct)};width:36px;text-align:right`">{{ p.pct }}%</div>
                      </div>
                      <div class="mt-3 p-2 rounded small text-muted" style="background:#fff3e0">
                        <i class="bi bi-exclamation-triangle text-warning me-1"></i>
                        SP-2026-043 完整度偏低（術後僅 2 天），SP-2026-031 尚未綁定 LINE
                      </div>
                    </div>

                  </div>

                  <!-- ══════════════════════════════════════
                       病患 LINE Bot
                  ══════════════════════════════════════ -->
                  <div v-else-if="activeRole === 'patient'" :key="'p' + stepIndex">
                    <div class="d-flex justify-content-center">
                      <!-- 手機外框 -->
                      <div style="width:360px;border:3px solid #999;border-radius:36px;background:#e5ddd5;padding:16px 8px;box-shadow:0 8px 30px rgba(0,0,0,.2)">
                        <div class="d-flex justify-content-center mb-2">
                          <div style="width:60px;height:6px;border-radius:3px;background:#bbb"></div>
                        </div>
                        <!-- LINE 標題 -->
                        <div class="d-flex align-items-center gap-2 px-3 py-2 mb-2 rounded-3" style="background:#00B900;color:#fff">
                          <div style="width:32px;height:32px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;color:#00B900;font-weight:900;font-size:.9rem">L</div>
                          <div>
                            <div class="fw-bold small">汐止國泰脊椎追蹤</div>
                            <div style="font-size:.7rem;opacity:.8">Official Account · 醫療服務</div>
                          </div>
                        </div>
                        <!-- 對話區 -->
                        <div style="min-height:310px;max-height:390px;overflow-y:auto;padding:4px 8px">
                          <template v-for="(msg, i) in chatSteps[stepIndex]" :key="i">
                            <template v-if="!msg.cond || msg.cond()">
                              <!-- Bot 訊息 -->
                              <div v-if="msg.who === 'bot'" class="d-flex gap-2 mb-2">
                                <div style="width:30px;height:30px;border-radius:50%;background:#00B900;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:.75rem">L</div>
                                <div>
                                  <div class="rounded-3 p-2 shadow-sm" style="background:#fff;max-width:240px;font-size:.83rem;white-space:pre-line;line-height:1.5">{{ msg.text }}</div>
                                  <!-- VAS 按鈕 -->
                                  <div v-if="msg.vasGrid" class="d-flex flex-wrap gap-1 mt-1" style="max-width:240px">
                                    <button v-for="n in 11" :key="n-1" type="button"
                                            class="rounded-circle border-0 fw-bold"
                                            style="width:32px;height:32px;font-size:.78rem;cursor:pointer;transition:transform .15s"
                                            :style="{ background:vasColors[n-1], color:[3,4,5].includes(n-1)?'#333':'#fff',
                                                      transform:(msg.vasKey===1?selectedVas1:selectedVas2)===n-1?'scale(1.25)':'scale(1)' }"
                                            @click="msg.vasKey===1?(selectedVas1=n-1):(selectedVas2=n-1)">
                                      {{ n-1 }}
                                    </button>
                                  </div>
                                  <!-- ODI 選項 -->
                                  <div v-if="msg.options" class="d-flex flex-column gap-1 mt-1" style="max-width:240px">
                                    <button v-for="(opt, oi) in msg.options" :key="oi" type="button"
                                            class="btn btn-sm text-start rounded-pill"
                                            :class="selectedOdi1===oi?'btn-success':'btn-outline-secondary'"
                                            style="font-size:.78rem" @click="selectedOdi1=oi">{{ opt }}</button>
                                  </div>
                                  <!-- Quick Reply -->
                                  <div v-if="msg.quickReply" class="mt-1">
                                    <button class="btn btn-sm btn-outline-success rounded-pill" style="font-size:.78rem"
                                            @click="showToast('病患點擊：' + msg.quickReply)">
                                      {{ msg.quickReply }}
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <!-- 病患訊息 -->
                              <div v-else class="d-flex justify-content-end mb-2">
                                <div class="rounded-3 p-2 shadow-sm" style="background:#dcf8c6;max-width:200px;font-size:.83rem;white-space:pre-line">{{ msg.text }}</div>
                              </div>
                            </template>
                          </template>
                        </div>
                        <!-- 輸入列 -->
                        <div class="d-flex gap-1 mt-2 px-2">
                          <div class="flex-grow-1 rounded-pill px-3 py-1 small text-muted" style="background:#fff;border:1px solid #ddd">輸入訊息…</div>
                          <button class="rounded-circle border-0 d-flex align-items-center justify-content-center"
                                  style="width:34px;height:34px;background:#00B900;color:#fff">
                            <i class="bi bi-send-fill" style="font-size:.78rem"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                </Transition>
              </div>

              <!-- 底部導覽 -->
              <div class="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                <button class="btn btn-outline-secondary btn-sm px-3" :disabled="stepIndex === 0" @click="prevStep">
                  <i class="bi bi-chevron-left me-1"></i>上一步
                </button>
                <span class="text-muted small">{{ stepIndex + 1 }} / {{ totalSteps }} — {{ stepLabel }}</span>
                <button class="btn btn-primary btn-sm px-3" :disabled="stepIndex === totalSteps - 1" @click="nextStep">
                  下一步<i class="bi bi-chevron-right ms-1"></i>
                </button>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Toast -->
    <div class="position-fixed bottom-0 end-0 p-3" style="z-index:9000">
      <Transition name="toast-fade">
        <div v-if="toast.show" class="toast show align-items-center border-0 text-white"
             :class="toast.type === 'warning' ? 'bg-warning text-dark' : 'bg-info'" role="alert">
          <div class="d-flex">
            <div class="toast-body"><i class="bi bi-info-circle me-1"></i>{{ toast.msg }}</div>
            <button type="button" class="btn-close me-2 m-auto"
                    :class="toast.type === 'warning' ? '' : 'btn-close-white'"
                    @click="toast.show = false"></button>
          </div>
        </div>
      </Transition>
    </div>

  </div>
</template>

<style scoped>
.step-fade-enter-active, .step-fade-leave-active { transition: opacity .18s, transform .18s; }
.step-fade-enter-from { opacity: 0; transform: translateX(16px); }
.step-fade-leave-to   { opacity: 0; transform: translateX(-16px); }
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity .25s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }
</style>
