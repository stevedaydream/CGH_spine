<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getDashboardData, approveRecord, rejectRecord, getPatientDetail, updateChartNumber, deleteOperationRecord } from '../api/gas.js'

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
  return pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
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

// ── 刪除追蹤個案 ──────────────────────────────────────
async function deletePatient(p) {
  if (!confirm(`確定刪除「${p.researchId}」？\n此操作將移除手術記錄及個資對照，無法復原。`)) return
  try {
    await deleteOperationRecord(p.researchId)
    patients.value = patients.value.filter(x => x.researchId !== p.researchId)
    showToast('已刪除 ' + p.researchId, 'warning')
  } catch (e) {
    showToast('刪除失敗：' + e.message, 'danger')
  }
}

onMounted(load)
</script>

<template>
  <div style="background: var(--color-bg-base); min-height: 100vh; font-family: var(--font-family);">

    <!-- LINE QR 展示卡 -->
    <Transition name="slide-down">
      <div v-if="showQr && lineQrUrl" id="qrPanel"
           style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px 0;" class="shadow-inner">
        <div class="d-flex flex-column align-items-center gap-2">
          <div class="text-white fw-bold fs-5">加入 LINE Bot，開始術後追蹤</div>
          <a :href="lineAddUrl" target="_blank" aria-label="打開 LINE 機器人連結">
            <img :src="lineQrUrl" alt="LINE 官方帳號 QR 碼"
                 style="width: 170px; height: 170px; border-radius: 16px; border: 4px solid #fff; box-shadow: 0 10px 25px -5px rgba(0,0,0,.3)">
          </a>
          <div class="text-white-50 small mt-1">掃描後加好友，輸入護理師提供的 6 位綁定碼</div>
          <button class="btn btn-outline-light btn-sm mt-2 px-3" @click="showQr = false" aria-label="收起 QR 碼區塊">
            <i class="bi bi-x-lg me-1" aria-hidden="true"></i>收起
          </button>
        </div>
      </div>
    </Transition>

    <!-- Loading overlay -->
    <div v-if="loading"
         class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
         style="background: rgba(248, 250, 252, 0.85); z-index: 9999;" aria-live="polite">
      <div class="text-center">
        <div class="spinner-border text-teal mb-3" style="width: 3rem; height: 3rem; color: var(--color-accent);" role="status">
          <span class="visually-hidden">載入中…</span>
        </div>
        <div class="text-muted fw-medium">載入追蹤資料中…</div>
      </div>
    </div>

    <div v-else class="container-fluid py-4 px-4 max-width-xl">

      <!-- 頁面標題與 LINE QR 按鈕 -->
      <div class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
        <div>
          <h1 class="h3 fw-bold text-teal m-0" style="color: var(--color-primary);">臨床追蹤儀表板</h1>
          <p class="text-muted small m-0 mt-1">即時監控患者術後回復指標與填寫完整度</p>
        </div>
        <button v-if="lineQrUrl" class="btn btn-success btn-sm px-3 py-2 fw-medium d-flex align-items-center gap-2 align-self-start align-self-sm-auto shadow-sm"
                @click="showQr = !showQr" aria-expanded="showQr" aria-controls="qrPanel">
          <i class="bi bi-qr-code" aria-hidden="true"></i>{{ showQr ? '關閉 LINE QR 碼' : '開啟 LINE QR 碼' }}
        </button>
      </div>

      <!-- 統計卡片 -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-3">
          <div class="clinical-card p-3 d-flex align-items-center justify-content-between" style="border-left: 4px solid var(--color-primary);">
            <div>
              <div class="text-muted small mb-1"><i class="bi bi-people me-1" aria-hidden="true"></i>總病患數</div>
              <div class="fs-3 fw-bold text-teal tabular-nums" style="color: var(--color-primary);">{{ summary.totalPatients }}</div>
            </div>
            <i class="bi bi-person-fill-check text-muted opacity-50 fs-2" aria-hidden="true"></i>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="clinical-card p-3 d-flex align-items-center justify-content-between" style="border-left: 4px solid var(--color-accent);">
            <div>
              <div class="text-muted small mb-1"><i class="bi bi-activity me-1" aria-hidden="true"></i>追蹤中</div>
              <div class="fs-3 fw-bold text-success tabular-nums">{{ summary.activePatients }}</div>
            </div>
            <i class="bi bi-heart-pulse-fill text-muted opacity-50 fs-2" aria-hidden="true"></i>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="clinical-card p-3 d-flex align-items-center justify-content-between" style="border-left: 4px solid #f59e0b;">
            <div>
              <div class="text-muted small mb-1"><i class="bi bi-percent me-1" aria-hidden="true"></i>平均完整度</div>
              <div class="fs-3 fw-bold text-warning tabular-nums">{{ summary.avgCompleteness }}%</div>
            </div>
            <i class="bi bi-check-all text-muted opacity-50 fs-2" aria-hidden="true"></i>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="clinical-card p-3 d-flex align-items-center justify-content-between" style="border-left: 4px solid #ef4444;">
            <div>
              <div class="text-muted small mb-1"><i class="bi bi-clock-history me-1" aria-hidden="true"></i>待確認</div>
              <div class="fs-3 fw-bold tabular-nums" :class="summary.pendingReview > 0 ? 'text-danger' : 'text-secondary'">
                {{ summary.pendingReview }}
              </div>
            </div>
            <i class="bi bi-exclamation-circle-fill text-muted opacity-50 fs-2" aria-hidden="true"></i>
          </div>
        </div>
      </div>

      <!-- AI 待確認區 -->
      <div class="clinical-card mb-4 overflow-hidden">
        <div class="card-header-ai px-4 py-3 d-flex justify-content-between align-items-center border-bottom">
          <div class="d-flex align-items-center gap-2">
            <span class="badge-ai-indicator" aria-hidden="true">AI</span>
            <h2 class="fs-6 m-0 fw-bold" style="color: var(--color-primary);">AI 暫存待確認區</h2>
          </div>
          <button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 px-3 py-1.5 border-dashed" @click="load" aria-label="重新整理待確認列表">
            <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>重新整理
          </button>
        </div>
        <div class="p-0">
          <!-- 無待確認 -->
          <div v-if="pending.length === 0" class="text-center text-muted py-5">
            <i class="bi bi-check-circle-fill fs-2 text-success d-block mb-3" aria-hidden="true"></i>
            <span class="fw-medium">目前無待確認記錄，所有資料已核准</span>
          </div>

          <!-- 待確認表格 -->
          <div v-else class="table-responsive">
            <table class="clinical-table mb-0">
              <thead>
                <tr>
                  <th scope="col">研究編號</th>
                  <th scope="col">原始訊息</th>
                  <th scope="col">AI解讀 背/腿</th>
                  <th scope="col">AI摘要</th>
                  <th scope="col">解析時間</th>
                  <th scope="col" style="text-align: right;">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in pending" :key="r.rowIndex">
                  <td class="tabular-nums"><strong>{{ r.researchId }}</strong></td>
                  <td>
                    <div :title="r.rawMessage" class="text-truncate-clinical" style="max-width: 250px;">
                      {{ r.rawMessage }}
                    </div>
                  </td>
                  <td>
                    <span :class="vasClass(r.aiVasBack)">{{ r.aiVasBack !== '' ? r.aiVasBack : '?' }}</span>
                    <span class="text-muted small mx-1">/</span>
                    <span :class="vasClass(r.aiVasLeg)">{{ r.aiVasLeg !== '' ? r.aiVasLeg : '?' }}</span>
                  </td>
                  <td><div class="text-truncate-clinical" style="max-width: 250px;">{{ r.aiSummary }}</div></td>
                  <td class="tabular-nums text-muted small">{{ r.aiParsedAt }}</td>
                  <td style="text-align: right; white-space: nowrap;">
                    <button class="btn btn-success btn-sm me-2 px-3"
                            :disabled="approveLoadingRows.has(r.rowIndex)"
                            @click="doApprove(r.rowIndex)"
                            aria-label="核准此 AI 記錄">
                      <span v-if="approveLoadingRows.has(r.rowIndex)" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      <template v-else><i class="bi bi-check-lg" aria-hidden="true"></i> 核准</template>
                    </button>
                    <button class="btn btn-outline-danger btn-sm px-3"
                            @click="doReject(r.rowIndex)"
                            aria-label="拒絕並廢棄此 AI 記錄">
                      <i class="bi bi-x-lg" aria-hidden="true"></i> 拒絕
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 病患追蹤列表 -->
      <div class="clinical-card overflow-hidden">
        <div class="px-4 py-3 border-bottom d-flex justify-content-between align-items-center">
          <h2 class="fs-6 m-0 fw-bold" style="color: var(--color-primary);">病患術後追蹤狀態</h2>
        </div>
        <div class="p-0">
          <div class="table-responsive">
            <table class="clinical-table mb-0">
              <thead>
                <tr>
                  <th scope="col">研究編號</th>
                  <th scope="col">病歷號</th>
                  <th scope="col">手術項目</th>
                  <th scope="col">Cage 代碼</th>
                  <th scope="col">術後時程</th>
                  <th scope="col">LINE 狀態</th>
                  <th scope="col">最後 VAS 背/腿</th>
                  <th scope="col">問卷填寫完整度</th>
                  <th scope="col" style="text-align: right;">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="patients.length === 0">
                  <td colspan="9" class="text-center text-muted py-5">尚無個案病患資料</td>
                </tr>
                <tr v-for="p in patients" :key="p.researchId">
                  <td class="tabular-nums">
                    <strong>{{ p.researchId }}</strong><br>
                    <span class="text-muted small">{{ p.opDate }}</span>
                  </td>
                  <!-- 病歷號行內編輯 -->
                  <td style="min-width: 140px;">
                    <template v-if="editingChart && editingChart.researchId === p.researchId">
                      <div class="d-flex gap-1 align-items-center">
                        <input v-model="editingChart.value" type="text"
                               class="form-control form-control-sm border-teal focus-ring"
                               style="width: 90px; font-size: .8rem;"
                               name="chartNumber"
                               aria-label="病歷號輸入框"
                               autocomplete="off"
                               @keyup.enter="saveChart"
                               @keyup.escape="cancelEditChart"
                               v-focus>
                        <button class="btn btn-success btn-sm p-1 d-flex align-items-center"
                                :disabled="savingChart" @click="saveChart"
                                aria-label="儲存病歷號" title="儲存">
                          <span v-if="savingChart" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          <i v-else class="bi bi-check fs-6" aria-hidden="true"></i>
                        </button>
                        <button class="btn btn-outline-secondary btn-sm p-1 d-flex align-items-center"
                                @click="cancelEditChart" aria-label="取消編輯" title="取消">
                          <i class="bi bi-x fs-6" aria-hidden="true"></i>
                        </button>
                      </div>
                    </template>
                    <template v-else>
                      <span class="small me-2 font-monospace">{{ p.chartNumber || '—' }}</span>
                      <button class="btn btn-link btn-edit-chart p-1 text-muted"
                              @click="startEditChart(p)" aria-label="編輯病歷號" title="編輯病歷號">
                        <i class="bi bi-pencil" aria-hidden="true"></i>
                      </button>
                    </template>
                  </td>
                  <td><div class="text-truncate-clinical" style="max-width: 120px;" :title="p.opName">{{ p.opName || '—' }}</div></td>
                  <td class="tabular-nums"><span class="badge bg-light text-secondary border font-monospace">{{ p.cageCode || '—' }}</span></td>
                  <td class="tabular-nums">
                    <span class="badge bg-soft-teal text-teal border border-teal-light px-2.5 py-1">D+{{ p.daysPostOp }}</span>
                  </td>
                  <td>
                    <span class="dot-indicator" :class="`dot-${lineStatusInfo(p.lineStatus)[0]}`"></span>
                    <span class="small fw-medium">{{ lineStatusInfo(p.lineStatus)[1] }}</span>
                  </td>
                  <td class="tabular-nums">
                    <span :class="vasClass(p.lastVasBack)">{{ p.lastVasBack }}</span>
                    <span class="text-muted mx-1">/</span>
                    <span :class="vasClass(p.lastVasLeg)">{{ p.lastVasLeg }}</span>
                    <span v-if="p.lastDays !== '-'" class="text-muted ms-1 small">D{{ p.lastDays }}</span>
                  </td>
                  <td style="min-width: 150px;">
                    <div class="d-flex align-items-center gap-2 mb-1">
                      <div class="progress-bar-container">
                        <div class="progress-bar-fill" :style="`width: ${p.pct}%; background-color: ${pctColor(p.pct)};`"></div>
                      </div>
                      <span class="small fw-bold tabular-nums" :style="`color: ${pctColor(p.pct)}`">{{ p.pct }}%</span>
                    </div>
                    <div class="text-muted tabular-nums" style="font-size: .7rem;">已填寫 {{ p.actual }} / 應填寫 {{ p.expected }} 次</div>
                  </td>
                  <td style="text-align: right; white-space: nowrap;">
                    <div class="d-flex gap-1 justify-content-end">
                      <button class="btn btn-outline-primary btn-sm px-3 d-flex align-items-center gap-1"
                              @click="openDetail(p.researchId)" aria-label="查看此病患詳情">
                        <i class="bi bi-journal-text" aria-hidden="true"></i>詳情
                      </button>
                      <button class="btn btn-outline-danger btn-sm p-1.5 d-flex align-items-center"
                              @click="deletePatient(p)" aria-label="刪除此個案記錄" title="刪除個案">
                        <i class="bi bi-trash" aria-hidden="true"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>

    <!-- 病患詳情 Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="detailModal"
             class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
             style="background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(4px); z-index: 9500;"
             @click.self="detailModal = false"
             role="dialog"
             aria-modal="true"
             aria-labelledby="modalTitle">
          <div class="bg-white rounded-4 shadow-2xl d-flex flex-column border border-light overflow-hidden"
               style="width: min(96vw, 920px); max-height: 90vh;">

            <!-- Modal Header -->
            <div class="d-flex justify-content-between align-items-center px-4 py-3 border-bottom bg-light-surface">
              <h3 class="fw-bold fs-6 m-0 d-flex align-items-center gap-2" id="modalTitle" style="color: var(--color-primary);">
                <i class="bi bi-journal-text text-teal" aria-hidden="true"></i>
                術後恢復追蹤報告
                <span v-if="detailPatient" class="badge bg-teal-soft text-teal font-monospace ms-2">{{ detailPatient.researchId }}</span>
              </h3>
              <button class="btn-close shadow-none" @click="detailModal = false" aria-label="關閉詳情"></button>
            </div>

            <!-- Loading inside modal -->
            <div v-if="detailLoading" class="d-flex align-items-center justify-content-center py-5">
              <div class="spinner-border text-teal me-2" role="status" style="color: var(--color-accent);">
                <span class="visually-hidden">載入中…</span>
              </div>
              <span class="text-muted fw-medium">載入病患病歷中…</span>
            </div>

            <template v-else-if="detailPatient">
              <!-- 病患基本資訊 -->
              <div class="px-4 py-3 border-bottom" style="background-color: var(--color-bg-base);">
                <div class="row g-3 small">
                  <div class="col-6 col-md-3">
                    <div class="text-muted mb-0.5">手術日期</div>
                    <div class="fw-semibold tabular-nums text-dark">{{ detailPatient.opDate }}</div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="text-muted mb-0.5">手術術式與節段</div>
                    <div class="fw-semibold text-dark">{{ detailPatient.opName }} {{ detailPatient.opLevels }}</div>
                  </div>
                  <div class="col-6 col-md-2">
                    <div class="text-muted mb-0.5">Cage 耗材</div>
                    <div class="fw-semibold font-monospace text-dark">{{ detailPatient.cageCode || '—' }}</div>
                  </div>
                  <div class="col-6 col-md-2">
                    <div class="text-muted mb-0.5">術後進度</div>
                    <div class="fw-semibold text-dark tabular-nums">D+{{ detailPatient.daysPostOp }}</div>
                  </div>
                  <div class="col-6 col-md-2 text-md-end">
                    <div class="text-muted mb-0.5">術前基線 VAS 背/腿</div>
                    <div class="fw-semibold tabular-nums">
                      <span :class="vasClass(detailPatient.preVasBack)">{{ detailPatient.preVasBack }}</span>
                      <span class="mx-1 text-muted">/</span>
                      <span :class="vasClass(detailPatient.preVasLeg)">{{ detailPatient.preVasLeg }}</span>
                    </div>
                  </div>
                  <div class="col-6 col-md-2">
                    <div class="text-muted mb-0.5">術前 ODI 評分</div>
                    <div class="fw-semibold tabular-nums text-dark">{{ detailPatient.preOdi !== '' ? detailPatient.preOdi + '%' : '—' }}</div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="text-muted mb-0.5">骨移植方式</div>
                    <div class="fw-semibold text-dark">{{ detailPatient.boneGraft || '—' }}</div>
                  </div>
                  <div class="col-6 col-md-2">
                    <div class="text-muted mb-0.5">主刀醫師</div>
                    <div class="fw-semibold text-dark">{{ detailPatient.surgeon }}</div>
                  </div>
                </div>
              </div>

              <!-- 追蹤記錄表格 -->
              <div class="overflow-auto flex-grow-1 px-4 py-3">
                <div v-if="detailRecords.length === 0" class="text-center text-muted py-5">
                  <i class="bi bi-inbox fs-2 d-block mb-2" aria-hidden="true"></i>
                  尚無此病患回報之追蹤記錄
                </div>
                <table v-else class="clinical-table mb-0">
                  <thead class="sticky-top bg-white border-bottom">
                    <tr>
                      <th scope="col">術後時程</th>
                      <th scope="col">填寫日期</th>
                      <th scope="col">VAS背痛</th>
                      <th scope="col">VAS腿痛</th>
                      <th scope="col">ODI 功能指數</th>
                      <th scope="col">整體改善感</th>
                      <th scope="col">狀態接受</th>
                      <th scope="col" style="text-align: right;">來源</th>
                    </tr>
                  </thead>
                  <tbody>
                    <!-- 術前基線列 -->
                    <tr style="background-color: #fefbeb;">
                      <td class="tabular-nums"><span class="badge bg-warning text-dark px-2">術前</span></td>
                      <td class="small text-muted font-monospace">Baseline</td>
                      <td><span :class="vasClass(detailPatient.preVasBack)">{{ detailPatient.preVasBack }}</span></td>
                      <td><span :class="vasClass(detailPatient.preVasLeg)">{{ detailPatient.preVasLeg }}</span></td>
                      <td class="small tabular-nums fw-medium">{{ detailPatient.preOdi !== '' ? detailPatient.preOdi + '%' : '—' }}</td>
                      <td>—</td>
                      <td>—</td>
                      <td style="text-align: right;"><span class="badge bg-secondary-soft text-secondary">系統</span></td>
                    </tr>
                    <!-- 追蹤記錄 -->
                    <template v-for="r in detailRecords" :key="r.logId">
                      <tr>
                        <td class="tabular-nums">
                          <span class="badge bg-light text-dark border font-monospace px-2.5">D+{{ r.daysPostOp }}</span>
                        </td>
                        <td class="small text-muted tabular-nums font-monospace">{{ r.logDatetime }}</td>
                        <td><span :class="vasClass(r.vasBack)">{{ r.vasBack }}</span></td>
                        <td><span :class="vasClass(r.vasLeg)">{{ r.vasLeg }}</span></td>
                        <td>
                          <span v-if="r.odiScore !== ''" class="small tabular-nums">
                            <button class="btn btn-link btn-odi-trigger p-0 text-decoration-none d-inline-flex align-items-center"
                                    :title="r.odiDetail ? '點擊展開各題明細' : '無各題明細（門診快速填寫）'"
                                    @click="r.odiDetail && toggleOdi(r.logId)"
                                    :aria-expanded="expandedOdi.has(r.logId)">
                              {{ r.odiScore }}%
                              <span class="text-muted ms-1" style="font-size: .75rem;">({{ odiSeverity(r.odiScore) }})</span>
                              <i v-if="r.odiDetail" :class="expandedOdi.has(r.logId) ? 'bi bi-chevron-up' : 'bi bi-chevron-down'"
                                 class="ms-1.5 text-teal" style="font-size: .7rem;" aria-hidden="true"></i>
                            </button>
                          </span>
                          <span v-else class="text-muted">—</span>
                        </td>
                        <td class="small text-dark">{{ r.anchorQ ? anchorLabel(r.anchorQ) : '—' }}</td>
                        <td>
                          <span v-if="r.pass === 'Y'" class="badge bg-success-soft text-success px-2 py-0.5 border border-success-light">可接受</span>
                          <span v-else-if="r.pass === 'N'" class="badge bg-danger-soft text-danger px-2 py-0.5 border border-danger-light">不滿意</span>
                          <span v-else class="text-muted">—</span>
                        </td>
                        <td style="text-align: right;">
                          <span :class="r.recordType === 'direct' ? 'badge bg-teal-soft text-teal border border-teal-light' : r.recordType === 'ai_parsed' ? 'badge bg-purple-soft text-purple border border-purple-light' : 'badge bg-light text-muted border'"
                                style="font-size: .7rem; font-weight: 500;">
                            {{ r.recordType === 'direct' ? 'LINE' : r.recordType === 'ai_parsed' ? 'AI解析' : r.recordType }}
                          </span>
                        </td>
                      </tr>
                      <!-- ODI 各題展開明細 -->
                      <tr v-if="r.odiDetail && expandedOdi.has(r.logId)"
                          style="background-color: var(--color-bg-base);">
                        <td colspan="8" class="py-3 px-4 border-bottom">
                          <div class="small fw-bold text-teal mb-2.5 d-flex align-items-center gap-1.5">
                            <i class="bi bi-card-list" aria-hidden="true"></i>ODI 問卷答題明細
                          </div>
                          <div class="row g-2">
                            <div v-for="item in odiDetailRows(r.odiDetail)" :key="item.title"
                                 class="col-6 col-md-4 col-lg-3">
                              <div class="d-flex align-items-center gap-2 px-2.5 py-1.5 rounded-3 bg-white border shadow-sm">
                                <span class="badge d-flex align-items-center justify-content-center tabular-nums"
                                      :style="`background-color:${['#10b981','#84cc16','#eab308','#f97316','#ef4444','#991b1b'][item.score]};color:${item.score>=3?'#fff':'#1f2937'};min-width:24px;height:24px;border-radius:50%;font-weight:700`">
                                  {{ item.score }}
                                </span>
                                <div class="text-truncate" style="flex: 1;">
                                  <div class="text-muted text-truncate" style="font-size: .65rem;">{{ item.title }}</div>
                                  <div class="fw-semibold text-dark text-truncate" style="font-size: .78rem;" :title="item.label">{{ item.label }}</div>
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
              <div class="px-4 py-3 border-top d-flex justify-content-between align-items-center bg-light-surface">
                <span class="small text-muted tabular-nums">共計 {{ detailRecords.length }} 筆歷史記錄</span>
                <button class="btn btn-secondary btn-sm px-4 py-1.5" @click="detailModal = false">關閉</button>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>

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
.sys-menu-dropdown {
  display: none;
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--color-bg-surface);
  border-radius: 12px;
  padding: 6px 0;
  min-width: 180px;
  z-index: 1000;
  border-color: var(--color-border);
}
.sys-menu:hover .sys-menu-dropdown {
  display: block;
}
.dropdown-item {
  padding: 8px 16px;
  font-size: .85rem;
  color: var(--color-text-main);
  white-space: nowrap;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: background-color 0.15s ease;
}
.dropdown-item:hover {
  background-color: var(--color-bg-base);
}
.dropdown-item + .dropdown-item {
  border-top: 1px solid var(--color-border);
}

/* Redefined premium VAS colors */
.vas-pill {
  display: inline-block;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  line-height: 26px;
  text-align: center;
  font-size: .78rem;
  font-weight: 700;
  color: #fff;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.vas-0, .vas-1, .vas-2 { background-color: #10b981; } /* mild green */
.vas-3, .vas-4, .vas-5 { background-color: #f59e0b; color: #1f2937; } /* warm amber */
.vas-6, .vas-7, .vas-8 { background-color: #f97316; } /* intense orange */
.vas-9, .vas-10 { background-color: #ef4444; } /* clinical red */

/* AI UI Indicators */
.card-header-ai {
  background: linear-gradient(90deg, rgba(243, 232, 255, 0.4) 0%, rgba(255, 255, 255, 0) 100%);
}
.badge-ai-indicator {
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2.5px 7px;
  border-radius: 6px;
  letter-spacing: 0.05em;
  box-shadow: 0 2px 4px rgba(139, 92, 246, 0.25);
}

.text-truncate-clinical {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Edit pencil styles */
.btn-edit-chart {
  transition: opacity 0.15s, color 0.15s;
}
.btn-edit-chart:hover {
  color: var(--color-accent) !important;
}

/* Soft teal indicator */
.bg-soft-teal {
  background-color: var(--color-primary-light);
}
.border-teal-light {
  border-color: #ccebe5 !important;
}
.text-teal {
  color: var(--color-primary) !important;
}
.border-teal {
  border-color: var(--color-accent) !important;
}

/* Dot indicators */
.dot-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}
.dot-success { background-color: #10b981; }
.dot-warning { background-color: #f59e0b; }
.dot-danger { background-color: #ef4444; }
.dot-secondary { background-color: #94a3b8; }

/* Custom Progress Bar */
.progress-bar-container {
  height: 8px;
  border-radius: 4px;
  background-color: #f1f5f9;
  flex-grow: 1;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}
.progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Modal and transition overrides */
.btn-close {
  background-size: 0.8rem;
  transition: transform 0.15s;
}
.btn-close:hover {
  transform: rotate(90deg);
}
.border-dashed {
  border-style: dashed !important;
}
.bg-teal-soft {
  background-color: var(--color-primary-light);
}
.bg-purple-soft {
  background-color: #f5f3ff;
}
.bg-success-soft {
  background-color: #ecfdf5;
}
.bg-danger-soft {
  background-color: #fef2f2;
}
.bg-secondary-soft {
  background-color: #f8fafc;
}
.text-purple {
  color: #7c3aed !important;
}
.border-purple-light {
  border-color: #ddd6fe !important;
}
.border-success-light {
  border-color: #a7f3d0 !important;
}
.border-danger-light {
  border-color: #fecaca !important;
}
.btn-odi-trigger {
  color: var(--color-text-main);
  font-weight: 500;
  transition: color 0.15s;
}
.btn-odi-trigger:hover {
  color: var(--color-accent) !important;
}

/* Custom CSS focus rings */
.focus-ring:focus-visible {
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.3);
  border-color: var(--color-accent) !important;
  outline: none !important;
}

/* Transitions */
.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-down-enter-from, .slide-down-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.25s ease;
}
.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0;
}

.toast-fade-enter-active, .toast-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-fade-enter-from, .toast-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
