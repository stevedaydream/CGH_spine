<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getDashboardData, approveRecord, rejectRecord } from '../api/gas.js'

const router = useRouter()

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
      </div>
    </nav>

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
                  <th>手術</th>
                  <th>Cage</th>
                  <th>術後天數</th>
                  <th>Line 狀態</th>
                  <th>最後VAS 背/腿</th>
                  <th>追蹤完整度</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="patients.length === 0">
                  <td colspan="7" class="text-center text-muted py-3">尚無病患資料</td>
                </tr>
                <tr v-for="p in patients" :key="p.researchId">
                  <td>
                    <strong>{{ p.researchId }}</strong><br>
                    <span class="text-muted small">{{ p.opDate }}</span>
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
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div><!-- /container -->

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
</style>
