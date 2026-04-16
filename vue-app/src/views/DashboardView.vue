<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getDashboardData, approveRecord, rejectRecord, getPatientDetail, updateChartNumber } from '../api/gas.js'

// 自動 focus 指令（行內編輯輸入框用）
const vFocus = { mounted: (el) => el.focus() }

const router = useRouter()

const LINE_BOT_ID = import.meta.env.VITE_LINE_BOT_ID || ''
const lineQrUrl   = LINE_BOT_ID ? `https://qr-official.line.me/sid/L/${LINE_BOT_ID}.png` : ''
const lineAddUrl  = LINE_BOT_ID ? `https://line.me/R/ti/p/@${LINE_BOT_ID}` : ''
const showQr      = ref(false)

const loading  = ref(true)
const summary  = ref({ totalPatients: 0, activePatients: 0, avgCompleteness: 0, pendingReview: 0 })
const pending  = ref([])
const patients = ref([])

// Toast
const toast = ref({ show: false, msg: '', type: 'success' })
let toastTimer = null
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer)
  toast.value = { show: true, msg, type }
  toastTimer = setTimeout(() => { toast.value.show = false }, 3000)
}

// 追蹤每列的 approve loading 狀態
const approveLoadingRows = ref(new Set())

// ── 病患詳情 Modal ─────────────────────────────
const detailModal     = ref(false)
const detailLoading   = ref(false)
const detailPatient   = ref(null)
const detailRecords   = ref([])

async function openDetail(researchId) {
  detailPatient.value = null
  detailRecords.value = []
  detailModal.value   = true
  detailLoading.value = true
  try {
    const data = await getPatientDetail(researchId)
    detailPatient.value = data.patient
    detailRecords.value = data.records || []
  } catch (e) {
    showToast('載入詳情失敗：' + e.message, 'danger')
    detailModal.value = false
  } finally {
    detailLoading.value = false
  }
}

function anchorLabel(v) {
  const map = { 1:'非常惡化', 2:'明顯惡化', 3:'稍微惡化', 4:'沒有變化', 5:'稍微改善', 6:'明顯改善', 7:'非常改善' }
  return map[v] || '-'
}
function odiSeverity(pct) {
  if (pct === '' || pct === null || pct === undefined) return ''
  const n = Number(pct)
  if (n <= 20) return '最小障礙'
  if (n <= 40) return '中度障礙'
  if (n <= 60) return '重度障礙'
  if (n <= 80) return '嚴重殘疾'
  return '完全殘疾'
}

// ODI 各題選項標籤（與 Config.gs ODI_QUESTIONS 對應）
const ODI_LABELS = [
  { title:'Q1 疼痛強度',  opts:['完全不痛','輕微疼痛','中度疼痛','嚴重疼痛','非常嚴重','最嚴重'] },
  { title:'Q2 個人照護',  opts:['完全自理','略感不方便','需他人協助','大部分依賴','完全依賴','無法照顧自己'] },
  { title:'Q3 提重物',    opts:['可提重物','提重物時痛','只能提輕物','不能從地上提','不能提物','連輕物也不行'] },
  { title:'Q4 行走距離',  opts:['正常行走','可走 1 公里','可走 500m','可走 100m','需助行器','臥床為主'] },
  { title:'Q5 坐姿耐受',  opts:['任何椅都可以','硬椅可久坐','最多 1 小時','最多 30 分','最多 10 分','完全無法坐'] },
  { title:'Q6 站立耐受',  opts:['久站無痛','站 1 小時後痛','最多 1 小時','最多 30 分','最多 10 分','完全無法站'] },
  { title:'Q7 睡眠品質',  opts:['不影響睡眠','偶爾睡不好','少於 6 小時','少於 4 小時','少於 2 小時','完全無法入睡'] },
  { title:'Q8 社交活動',  opts:['正常社交','稍受限制','明顯受限','只能基本社交','幾乎無社交','完全無社交活動'] },
  { title:'Q9 旅行交通',  opts:['可任意旅行','稍受限','明顯受限','只能短途','幾乎不行','完全無法出行'] },
  { title:'Q10 職業家務', opts:['正常工作','稍受限制','明顯受限','只能輕鬆工作','幾乎無法工作','完全無法工作'] },
]

const expandedOdi = ref(new Set())
function toggleOdi(logId) {
  const s = new Set(expandedOdi.value)
  s.has(logId) ? s.delete(logId) : s.add(logId)
  expandedOdi.value = s
}
function odiDetailRows(detail) {
  if (!detail) return []
  return ODI_LABELS.map((q, i) => {
    const score = detail['q' + (i + 1)]
    return { title: q.title, score, label: q.opts[score] ?? '-' }
  })
}

// ── 資料載入 ──────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    const data = await getDashboardData()
    summary.value  = data.summary  || summary.value
    pending.value  = data.pending  || []
    patients.value = data.patients || []
  } catch (e) {
    showToast('載入失敗：' + e.message, 'danger')
  } finally {
    loading.value = false
  }
}

// ── 核准 / 拒絕 ───────────────────────────────────────
async function doApprove(rowIndex) {
  approveLoadingRows.value = new Set([...approveLoadingRows.value, rowIndex])
  try {
    await approveRecord(rowIndex)
    pending.value = pending.value.filter(r => r.rowIndex !== rowIndex)
    summary.value.pendingReview = Math.max(0, (summary.value.pendingReview || 0) - 1)
    showToast('已核准並移入追蹤日誌 ✅', 'success')
  } catch (e) {
    showToast('操作失敗：' + e.message, 'danger')
  } finally {
    const s = new Set(approveLoadingRows.value)
    s.delete(rowIndex)
    approveLoadingRows.value = s
  }
}

async function doReject(rowIndex) {
  if (!confirm('確定拒絕這筆記錄？')) return
  try {
    await rejectRecord(rowIndex)
    pending.value = pending.value.filter(r => r.rowIndex !== rowIndex)
    summary.value.pendingReview = Math.max(0, (summary.value.pendingReview || 0) - 1)
    showToast('已拒絕此記錄', 'warning')
  } catch (e) {
    showToast('操作失敗：' + e.message, 'danger')
  }
}

// ── 工具函式 ──────────────────────────────────────────
function vasClass(v) {
  if (v === '' || v === null || v === undefined || isNaN(Number(v))) return ''
  return 'vas-pill vas-' + Math.min(10, Math.max(0, Math.round(Number(v))))
}

function lineStatusInfo(s) {
  const map = { active: ['success', '追蹤中'], blocked: ['danger', '已封鎖'], unbound: ['secondary', '未綁定'] }
  return map[s] || ['secondary', s]
}

function pctColor(pct) {
  return pct >= 80 ? '#34a853' : pct >= 50 ? '#fbbc04' : '#ea4335'
}

// ── 病歷號行內編輯 ────────────────────────────────────
const editingChart = ref(null)   // { researchId, value }
const savingChart  = ref(false)

function startEditChart(p) {
  editingChart.value = { researchId: p.researchId, value: p.chartNumber || '' }
}
function cancelEditChart() {
  editingChart.value = null
}
async function saveChart() {
  if (!editingChart.value) return
  savingChart.value = true
  try {
    await updateChartNumber(editingChart.value.researchId, editingChart.value.value)
    const p = patients.value.find(x => x.researchId === editingChart.value.researchId)
    if (p) p.chartNumber = editingChart.value.value
    editingChart.value = null
    showToast('病歷號已更新 ✅')
  } catch (e) {
    showToast('更新失敗：' + e.message, 'danger')
  } finally {
    savingChart.value = false
  }
}

onMounted(load)
</script>

<template>
  <div style="background:#f0f4f8; min-height:100vh; font-family:'Segoe UI',sans-serif">

    <!-- Navbar -->
    <nav class="navbar navbar-dark px-3 py-2" style="background:linear-gradient(135deg,#1a73e8,#0d47a1)">
      <span class="navbar-brand fw-bold">
        <i class="bi bi-hospital me-2"></i>脊椎追蹤系統
      </span>
      <div class="d-flex gap-2">
        <span class="text-white-50 small align-self-center">醫護後台</span>
        <RouterLink to="/form"      class="btn btn-outline-light btn-sm"><i class="bi bi-pencil-square me-1"></i>填表</RouterLink>
        <RouterLink to="/analytics" class="btn btn-outline-light btn-sm"><i class="bi bi-bar-chart-line me-1"></i>分析</RouterLink>
        <RouterLink to="/mcid"      class="btn btn-outline-light btn-sm"><i class="bi bi-graph-up-arrow me-1"></i>MCID</RouterLink>
        <RouterLink to="/export"     class="btn btn-outline-light btn-sm"><i class="bi bi-download me-1"></i>匯出</RouterLink>
        <RouterLink to="/bot-management" class="btn btn-outline-light btn-sm"><i class="bi bi-robot me-1"></i>Bot管理</RouterLink>
        <button v-if="lineQrUrl" class="btn btn-success btn-sm"
                @click="showQr = !showQr">
          <i class="bi bi-qr-code me-1"></i>LINE QR
        </button>
      </div>
    </nav>

    <!-- LINE QR 展示卡（全寬橫幅，給病患掃）-->
    <Transition name="slide-down">
      <div v-if="showQr && lineQrUrl"
           style="background:linear-gradient(135deg,#00B900,#00d400);padding:20px 0">
        <div class="d-flex flex-column align-items-center gap-2">
          <div class="text-white fw-bold fs-5">加入 LINE Bot，開始術後追蹤</div>
          <a :href="lineAddUrl" target="_blank">
            <img :src="lineQrUrl" alt="LINE QR Code"
                 style="width:180px;height:180px;border-radius:12px;border:4px solid #fff;box-shadow:0 4px 20px rgba(0,0,0,.2)">
          </a>
          <div class="text-white-50 small">掃描後加好友，輸入護理師提供的 6 位綁定碼</div>
          <button class="btn btn-outline-light btn-sm mt-1" @click="showQr = false">
            <i class="bi bi-x me-1"></i>收起
          </button>
        </div>
      </div>
    </Transition>

    <!-- Loading -->
    <div v-if="loading"
         class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
         style="background:rgba(255,255,255,.7);z-index:9999">
      <div class="text-center">
        <div class="spinner-border text-primary mb-2"></div>
        <div class="text-muted small">載入資料中…</div>
      </div>
    </div>

    <div v-else class="container-fluid py-4 px-4">

      <!-- 統計卡片 -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-3">
          <div class="card p-3" style="border:none;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);border-left:4px solid #1a73e8">
            <div class="text-muted small mb-1"><i class="bi bi-people me-1"></i>總病患數</div>
            <div class="fs-3 fw-bold text-primary">{{ summary.totalPatients }}</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card p-3" style="border:none;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);border-left:4px solid #34a853">
            <div class="text-muted small mb-1"><i class="bi bi-activity me-1"></i>追蹤中</div>
            <div class="fs-3 fw-bold text-success">{{ summary.activePatients }}</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card p-3" style="border:none;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);border-left:4px solid #fbbc04">
            <div class="text-muted small mb-1"><i class="bi bi-percent me-1"></i>平均完整度</div>
            <div class="fs-3 fw-bold text-warning">{{ summary.avgCompleteness }}%</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card p-3" style="border:none;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);border-left:4px solid #ea4335">
            <div class="text-muted small mb-1"><i class="bi bi-clock-history me-1"></i>待確認</div>
            <div class="fs-3 fw-bold" :class="summary.pendingReview > 0 ? 'text-danger' : 'text-secondary'">
              {{ summary.pendingReview }}
            </div>
          </div>
        </div>
      </div>

      <!-- AI 待確認區 -->
      <div class="card mb-4" style="border:none;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div style="font-size:1rem;font-weight:700;color:#1a73e8;border-bottom:2px solid #1a73e8;padding-bottom:6px">
              AI 暫存待確認區
            </div>
            <button class="btn btn-sm btn-outline-secondary" @click="load">
              <i class="bi bi-arrow-clockwise me-1"></i>重新整理
            </button>
          </div>

          <!-- 無待確認 -->
          <div v-if="pending.length === 0" class="text-center text-muted py-4">
            <i class="bi bi-check-circle fs-2 text-success d-block mb-2"></i>
            目前無待確認記錄
          </div>

          <!-- 待確認表格 -->
          <div v-else class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>研究編號</th>
                  <th>原始訊息</th>
                  <th>AI解讀 背/腿</th>
                  <th>AI摘要</th>
                  <th>解析時間</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in pending" :key="r.rowIndex">
                  <td><strong>{{ r.researchId }}</strong></td>
                  <td>
                    <div :title="r.rawMessage"
                         style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.85rem;color:#555">
                      {{ r.rawMessage }}
                    </div>
                  </td>
                  <td>
                    <span :class="vasClass(r.aiVasBack)">{{ r.aiVasBack !== '' ? r.aiVasBack : '?' }}</span>
                    <span class="text-muted small mx-1">/</span>
                    <span :class="vasClass(r.aiVasLeg)">{{ r.aiVasLeg !== '' ? r.aiVasLeg : '?' }}</span>
                  </td>
                  <td class="small">{{ r.aiSummary }}</td>
                  <td class="small text-muted">{{ r.aiParsedAt }}</td>
                  <td>
                    <button class="btn btn-success btn-sm me-1"
                            :disabled="approveLoadingRows.has(r.rowIndex)"
                            @click="doApprove(r.rowIndex)"
                            style="font-size:.78rem;padding:3px 10px">
                      <span v-if="approveLoadingRows.has(r.rowIndex)"
                            class="spinner-border spinner-border-sm"></span>
                      <template v-else><i class="bi bi-check-lg"></i> 核准</template>
                    </button>
                    <button class="btn btn-outline-danger btn-sm"
                            @click="doReject(r.rowIndex)"
                            style="font-size:.78rem;padding:3px 10px">
                      <i class="bi bi-x-lg"></i> 拒絕
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 病患追蹤列表 -->
      <div class="card" style="border:none;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <div class="card-body">
          <div style="font-size:1rem;font-weight:700;color:#1a73e8;border-bottom:2px solid #1a73e8;padding-bottom:6px;margin-bottom:16px">
            病患追蹤狀態
          </div>
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>研究編號</th>
                  <th>病歷號</th>
                  <th>手術</th>
                  <th>Cage</th>
                  <th>術後天數</th>
                  <th>Line 狀態</th>
                  <th>最後VAS 背/腿</th>
                  <th>追蹤完整度</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="patients.length === 0">
                  <td colspan="9" class="text-center text-muted py-3">尚無病患資料</td>
                </tr>
                <tr v-for="p in patients" :key="p.researchId">
                  <td>
                    <strong>{{ p.researchId }}</strong><br>
                    <span class="text-muted small">{{ p.opDate }}</span>
                  </td>
                  <!-- 病歷號行內編輯 -->
                  <td style="min-width:110px">
                    <template v-if="editingChart && editingChart.researchId === p.researchId">
                      <div class="d-flex gap-1 align-items-center">
                        <input v-model="editingChart.value" type="text"
                               class="form-control form-control-sm"
                               style="width:80px;font-size:.78rem"
                               @keyup.enter="saveChart"
                               @keyup.escape="cancelEditChart"
                               v-focus>
                        <button class="btn btn-success btn-sm p-0 px-1"
                                :disabled="savingChart" @click="saveChart"
                                title="儲存">
                          <span v-if="savingChart" class="spinner-border spinner-border-sm"></span>
                          <i v-else class="bi bi-check"></i>
                        </button>
                        <button class="btn btn-outline-secondary btn-sm p-0 px-1"
                                @click="cancelEditChart" title="取消">
                          <i class="bi bi-x"></i>
                        </button>
                      </div>
                    </template>
                    <template v-else>
                      <span class="small me-1">{{ p.chartNumber || '—' }}</span>
                      <button class="btn btn-link btn-sm p-0 text-muted"
                              style="font-size:.72rem"
                              @click="startEditChart(p)" title="編輯病歷號">
                        <i class="bi bi-pencil"></i>
                      </button>
                    </template>
                  </td>
                  <td class="small">{{ p.opName || '-' }}</td>
                  <td class="small">{{ p.cageCode || '-' }}</td>
                  <td>
                    <span class="badge bg-light text-dark border">D+{{ p.daysPostOp }}</span>
                  </td>
                  <td>
                    <span :class="`badge bg-${lineStatusInfo(p.lineStatus)[0]}`">
                      {{ lineStatusInfo(p.lineStatus)[1] }}
                    </span>
                  </td>
                  <td>
                    <span :class="vasClass(p.lastVasBack)">{{ p.lastVasBack }}</span>
                    <span class="text-muted mx-1">/</span>
                    <span :class="vasClass(p.lastVasLeg)">{{ p.lastVasLeg }}</span>
                    <span v-if="p.lastDays !== '-'" class="text-muted ms-1 small">D{{ p.lastDays }}</span>
                  </td>
                  <td style="min-width:120px">
                    <div class="d-flex align-items-center gap-2">
                      <div style="height:6px;border-radius:3px;background:#e9ecef;flex-grow:1">
                        <div :style="`height:100%;border-radius:3px;width:${p.pct}%;background:${pctColor(p.pct)};transition:width .4s`"></div>
                      </div>
                      <span class="small fw-bold" :style="`color:${pctColor(p.pct)}`">{{ p.pct }}%</span>
                    </div>
                    <div class="text-muted" style="font-size:.72rem">{{ p.actual }}/{{ p.expected }} 次</div>
                  </td>
                  <td>
                    <button class="btn btn-outline-primary btn-sm" style="font-size:.78rem;white-space:nowrap"
                            @click="openDetail(p.researchId)">
                      <i class="bi bi-journal-text me-1"></i>詳情
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div><!-- /container -->

    <!-- 病患詳情 Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="detailModal"
             class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
             style="background:rgba(0,0,0,.5);z-index:9500"
             @click.self="detailModal = false">
          <div class="bg-white rounded-3 shadow-lg d-flex flex-column"
               style="width:min(96vw,860px);max-height:90vh">

            <!-- Modal Header -->
            <div class="d-flex justify-content-between align-items-center px-4 py-3 border-bottom">
              <div class="fw-bold fs-6" style="color:#1a73e8">
                <i class="bi bi-journal-text me-2"></i>
                術後追蹤詳情
                <span v-if="detailPatient" class="ms-2 text-muted fw-normal small">{{ detailPatient.researchId }}</span>
              </div>
              <button class="btn-close" @click="detailModal = false"></button>
            </div>

            <!-- Loading -->
            <div v-if="detailLoading" class="d-flex align-items-center justify-content-center py-5">
              <div class="spinner-border text-primary me-2"></div>
              <span class="text-muted">載入中…</span>
            </div>

            <template v-else-if="detailPatient">
              <!-- 病患基本資訊 -->
              <div class="px-4 py-3 border-bottom" style="background:#f8f9fa">
                <div class="row g-2 small">
                  <div class="col-6 col-md-3">
                    <div class="text-muted">手術日期</div>
                    <div class="fw-bold">{{ detailPatient.opDate }}</div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="text-muted">術式 / 節段</div>
                    <div class="fw-bold">{{ detailPatient.opName }} {{ detailPatient.opLevels }}</div>
                  </div>
                  <div class="col-6 col-md-2">
                    <div class="text-muted">Cage</div>
                    <div class="fw-bold">{{ detailPatient.cageCode }}</div>
                  </div>
                  <div class="col-6 col-md-2">
                    <div class="text-muted">術後天數</div>
                    <div class="fw-bold">D+{{ detailPatient.daysPostOp }}</div>
                  </div>
                  <div class="col-6 col-md-2">
                    <div class="text-muted">術前 VAS 背/腿</div>
                    <div class="fw-bold">
                      <span :class="vasClass(detailPatient.preVasBack)">{{ detailPatient.preVasBack }}</span>
                      <span class="mx-1 text-muted">/</span>
                      <span :class="vasClass(detailPatient.preVasLeg)">{{ detailPatient.preVasLeg }}</span>
                    </div>
                  </div>
                  <div class="col-6 col-md-2">
                    <div class="text-muted">術前 ODI</div>
                    <div class="fw-bold">{{ detailPatient.preOdi !== '' ? detailPatient.preOdi + '%' : '-' }}</div>
                  </div>
                  <div class="col-6 col-md-2">
                    <div class="text-muted">骨移植</div>
                    <div class="fw-bold">{{ detailPatient.boneGraft }}</div>
                  </div>
                  <div class="col-6 col-md-2">
                    <div class="text-muted">主刀</div>
                    <div class="fw-bold">{{ detailPatient.surgeon }}</div>
                  </div>
                </div>
              </div>

              <!-- 追蹤記錄表格 -->
              <div class="overflow-auto flex-grow-1 px-4 py-3">
                <div v-if="detailRecords.length === 0" class="text-center text-muted py-4">
                  <i class="bi bi-inbox fs-2 d-block mb-2"></i>
                  尚無追蹤記錄
                </div>
                <table v-else class="table table-sm table-hover align-middle mb-0">
                  <thead class="table-light sticky-top">
                    <tr>
                      <th>術後天數</th>
                      <th>日期</th>
                      <th>背痛</th>
                      <th>腿痛</th>
                      <th>ODI</th>
                      <th>整體改善</th>
                      <th>可接受</th>
                      <th>來源</th>
                    </tr>
                  </thead>
                  <tbody>
                    <!-- 術前基線列 -->
                    <tr style="background:#fff8e1">
                      <td><span class="badge bg-secondary">術前</span></td>
                      <td class="small text-muted">基線</td>
                      <td><span :class="vasClass(detailPatient.preVasBack)">{{ detailPatient.preVasBack }}</span></td>
                      <td><span :class="vasClass(detailPatient.preVasLeg)">{{ detailPatient.preVasLeg }}</span></td>
                      <td class="small">{{ detailPatient.preOdi !== '' ? detailPatient.preOdi + '%' : '-' }}</td>
                      <td>-</td>
                      <td>-</td>
                      <td><span class="badge bg-warning text-dark">術前</span></td>
                    </tr>
                    <!-- 追蹤記錄（template v-for 讓展開列共享同一個 r）-->
                    <template v-for="r in detailRecords" :key="r.logId">
                      <tr>
                        <td>
                          <span class="badge bg-light text-dark border">D+{{ r.daysPostOp }}</span>
                        </td>
                        <td class="small text-muted">{{ r.logDatetime }}</td>
                        <td><span :class="vasClass(r.vasBack)">{{ r.vasBack }}</span></td>
                        <td><span :class="vasClass(r.vasLeg)">{{ r.vasLeg }}</span></td>
                        <td>
                          <span v-if="r.odiScore !== ''" class="small">
                            <button class="btn btn-link btn-sm p-0 text-decoration-none"
                                    :title="r.odiDetail ? '點擊展開各題明細' : '無各題明細（門診填寫）'"
                                    @click="r.odiDetail && toggleOdi(r.logId)">
                              {{ r.odiScore }}%
                              <span class="text-muted">({{ odiSeverity(r.odiScore) }})</span>
                              <i v-if="r.odiDetail" :class="expandedOdi.has(r.logId) ? 'bi bi-chevron-up' : 'bi bi-chevron-down'"
                                 class="ms-1 text-primary" style="font-size:.7rem"></i>
                            </button>
                          </span>
                          <span v-else class="text-muted">-</span>
                        </td>
                        <td class="small">{{ r.anchorQ ? anchorLabel(r.anchorQ) : '-' }}</td>
                        <td>
                          <span v-if="r.pass === 'Y'" class="badge bg-success">可接受</span>
                          <span v-else-if="r.pass === 'N'" class="badge bg-danger">不滿意</span>
                          <span v-else class="text-muted">-</span>
                        </td>
                        <td>
                          <span :class="r.recordType === 'direct' ? 'badge bg-primary' : r.recordType === 'ai_parsed' ? 'badge bg-info text-dark' : 'badge bg-secondary'"
                                style="font-size:.7rem">
                            {{ r.recordType === 'direct' ? 'LINE' : r.recordType === 'ai_parsed' ? 'AI解析' : r.recordType }}
                          </span>
                        </td>
                      </tr>
                      <!-- ODI 各題展開列 -->
                      <tr v-if="r.odiDetail && expandedOdi.has(r.logId)"
                          style="background:#f0f7ff">
                        <td colspan="8" class="py-2 px-4">
                          <div class="small fw-bold text-primary mb-2">ODI 各題明細</div>
                          <div class="row g-1">
                            <div v-for="item in odiDetailRows(r.odiDetail)" :key="item.title"
                                 class="col-6 col-md-4 col-lg-3">
                              <div class="d-flex align-items-center gap-2 px-2 py-1 rounded"
                                   style="background:#fff;border:1px solid #dee2e6">
                                <span class="badge"
                                      :style="`background:${['#34a853','#8bc34a','#ffeb3b','#ff9800','#f44336','#b71c1c'][item.score]};color:${item.score>=3?'#fff':'#333'};min-width:22px`">
                                  {{ item.score }}
                                </span>
                                <div>
                                  <div style="font-size:.7rem;color:#888">{{ item.title }}</div>
                                  <div style="font-size:.8rem;font-weight:600">{{ item.label }}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>

              <!-- Footer -->
              <div class="px-4 py-2 border-top d-flex justify-content-between align-items-center">
                <span class="small text-muted">共 {{ detailRecords.length }} 筆記錄</span>
                <button class="btn btn-secondary btn-sm" @click="detailModal = false">關閉</button>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Toast -->
    <div class="position-fixed bottom-0 end-0 p-3" style="z-index:9000">
      <Transition name="toast-fade">
        <div v-if="toast.show"
             :class="`toast show align-items-center text-white border-0 bg-${toast.type}`"
             role="alert">
          <div class="d-flex">
            <div class="toast-body">{{ toast.msg }}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto"
                    @click="toast.show = false"></button>
          </div>
        </div>
      </Transition>
    </div>

  </div>
</template>

<style scoped>
.vas-pill {
  display: inline-block; width: 28px; height: 28px; border-radius: 50%;
  line-height: 28px; text-align: center; font-size: .8rem; font-weight: 600; color: #fff;
}
.vas-0  { background: #34a853; } .vas-1  { background: #4caf50; }
.vas-2  { background: #8bc34a; } .vas-3  { background: #cddc39; color: #333; }
.vas-4  { background: #ffeb3b; color: #333; } .vas-5  { background: #ffc107; color: #333; }
.vas-6  { background: #ff9800; } .vas-7  { background: #ff5722; }
.vas-8  { background: #f44336; } .vas-9  { background: #e53935; }
.vas-10 { background: #b71c1c; }
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity .3s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }
.slide-down-enter-active, .slide-down-leave-active { transition: all .3s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-12px); }
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity .2s; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
