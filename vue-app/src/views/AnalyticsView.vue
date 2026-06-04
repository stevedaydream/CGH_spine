<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Chart from 'chart.js/auto'
import { getAnalyticsData, exportCsv } from '../api/gas.js'

const loading = ref(true)
const summary      = ref({ totalPatients: 0, activePatients: 0, avgCompleteness: 0, pendingReview: 0 })
const cageStats    = ref([])
const opStats      = ref([])
const completeness = ref([])
const cageWarning  = ref('')
const opWarning    = ref('')

let cageChart = null
let opChart   = null

// Toast
const toast = ref({ show: false, msg: '', type: 'success' })
let toastTimer = null
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer)
  toast.value = { show: true, msg, type }
  toastTimer = setTimeout(() => { toast.value.show = false }, 3500)
}

// ── 資料載入 ──────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    const data = await getAnalyticsData()
    summary.value      = data.summary      || summary.value
    cageStats.value    = data.cageStats    || []
    opStats.value      = data.opStats      || []
    completeness.value = data.completeness || []
    renderCageChart()
    renderOpChart()
  } catch (e) {
    showToast('載入失敗：' + e.message, 'danger')
  } finally {
    loading.value = false
  }
}

// ── Chart.js 繪製 ─────────────────────────────────────
function renderCageChart() {
  const el = document.getElementById('cageChart')
  if (!el || cageStats.value.length === 0) return
  if (cageChart) cageChart.destroy()

  const stats = cageStats.value
  cageChart = new Chart(el, {
    type: 'bar',
    data: {
      labels: stats.map(r => `${r.cage} (n=${r.n})`),
      datasets: [{
        label: 'VAS 改善分數',
        data: stats.map(r => parseFloat(r.improvement) || 0),
        backgroundColor: stats.map(r => r.n < 15 ? '#f59e0b' : '#0a5c66'), // warm amber / deep teal
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: '改善分數（分）', font: { family: 'Plus Jakarta Sans', weight: '600' } },
          ticks: { font: { family: 'Plus Jakarta Sans' } }
        },
        x: {
          ticks: { font: { family: 'Plus Jakarta Sans' } }
        }
      }
    }
  })

  const warns = stats.filter(r => r.warning).map(r => r.warning)
  cageWarning.value = warns.join(' | ')
}

function renderOpChart() {
  const el = document.getElementById('opChart')
  if (!el || opStats.value.length === 0) return
  if (opChart) opChart.destroy()

  const palette = ['#0a5c66', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
  opChart = new Chart(el, {
    type: 'line',
    data: {
      labels: ['術後第7天', '術後第14天', '術後第28天'],
      datasets: opStats.value.map((r, i) => ({
        label: `${r.opName} (n=${r.n})`,
        data: [parseFloat(r.vas7) || null, parseFloat(r.vas14) || null, parseFloat(r.vas28) || null],
        borderColor: palette[i % palette.length],
        backgroundColor: palette[i % palette.length] + '22',
        tension: 0.35,
        fill: false,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBorderWidth: 2,
        pointBackgroundColor: '#fff'
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, font: { family: 'Plus Jakarta Sans', size: 12 } }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 10,
          title: { display: true, text: 'VAS 平均分', font: { family: 'Plus Jakarta Sans', weight: '600' } },
          ticks: { font: { family: 'Plus Jakarta Sans' } }
        },
        x: {
          ticks: { font: { family: 'Plus Jakarta Sans' } }
        }
      },
      spanGaps: true
    }
  })

  const warns = opStats.value.filter(r => r.warning).map(r => r.warning)
  opWarning.value = warns.join(' | ')
}

// ── CSV 匯出 ──────────────────────────────────────────
async function doExportCsv() {
  showToast('匯出中，請稍候…', 'info')
  try {
    await exportCsv()
    showToast('✅ CSV 已匯出至 Google Drive！', 'success')
  } catch (e) {
    showToast('匯出失敗：' + e.message, 'danger')
  }
}

// ── 工具 ──────────────────────────────────────────────
function pctColor(pct) {
  return pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
}
function pctRowClass(pct) {
  return pct >= 80 ? '' : pct >= 50 ? 'row-warning' : 'row-danger'
}

onMounted(load)
onUnmounted(() => {
  cageChart?.destroy()
  opChart?.destroy()
})
</script>

<template>
  <div style="background: var(--color-bg-base); min-height: 100vh; font-family: var(--font-family);">

    <!-- Navbar / Header -->
    <nav class="navbar navbar-expand-lg navbar-dark px-4 py-3 shadow-sm border-bottom" style="background: linear-gradient(135deg, var(--color-primary), #063e45);">
      <div class="container-fluid p-0 d-flex justify-content-between align-items-center">
        <span class="navbar-brand fw-bold fs-5 d-flex align-items-center">
          <i class="bi bi-bar-chart-line me-2" aria-hidden="true"></i>脊椎手術智慧追蹤系統
        </span>
        <div class="d-flex gap-2 flex-wrap">
          <span class="text-white-50 small align-self-center me-2 tabular-nums">AI 分析儀表板</span>
          <RouterLink to="/" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-house" aria-hidden="true"></i>儀表板
          </RouterLink>
          <RouterLink to="/form" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-person-plus" aria-hidden="true"></i>手術登錄
          </RouterLink>
          <RouterLink to="/mcid" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-graph-up-arrow" aria-hidden="true"></i>MCID
          </RouterLink>
          <RouterLink to="/irb" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-shield-check" aria-hidden="true"></i>IRB表單
          </RouterLink>
          <button class="btn btn-light btn-sm text-dark px-3 py-1.5 fw-medium d-flex align-items-center gap-1 transition-btn" @click="load" aria-label="重新整理數據">
            <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>重新整理
          </button>
        </div>
      </div>
    </nav>

    <!-- Loading overlay -->
    <div v-if="loading"
         class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
         style="background: rgba(248, 250, 252, 0.85); z-index: 9999;" aria-live="polite">
      <div class="text-center">
        <div class="spinner-border text-teal mb-3" style="width: 3rem; height: 3rem; color: var(--color-accent);" role="status">
          <span class="visually-hidden">載入分析資料中…</span>
        </div>
        <div class="text-muted fw-medium">AI 分析臨床資料中…</div>
      </div>
    </div>

    <div v-else class="container-fluid py-4 px-4 max-width-xl">

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
              <div class="fs-3 fw-bold text-danger tabular-nums">{{ summary.pendingReview }}</div>
            </div>
            <i class="bi bi-exclamation-circle-fill text-muted opacity-50 fs-2" aria-hidden="true"></i>
          </div>
        </div>
      </div>

      <!-- 圖表區 -->
      <div class="row g-4 mb-4">
        <div class="col-12 col-lg-6">
          <div class="clinical-card p-4 bg-white h-100">
            <h2 class="fs-6 fw-bold mb-4 pb-2 border-bottom d-flex align-items-center gap-2" style="color: var(--color-primary);">
              <i class="bi bi-bar-chart-fill text-teal" aria-hidden="true"></i>耗材效益比較（VAS 改善分數）
            </h2>
            <div style="position: relative; height: 280px;">
              <canvas id="cageChart"></canvas>
            </div>
            <div v-if="cageWarning" class="mt-3 alert alert-warning p-2.5 small d-flex align-items-center gap-2 mb-0 border-0" style="color: #b45309; background-color: #fffbeb;">
              <i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
              <span class="font-semibold">{{ cageWarning }}</span>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-6">
          <div class="clinical-card p-4 bg-white h-100">
            <h2 class="fs-6 fw-bold mb-4 pb-2 border-bottom d-flex align-items-center gap-2" style="color: var(--color-primary);">
              <i class="bi bi-graph-up text-teal" aria-hidden="true"></i>手術方式 VAS 恢復趨勢
            </h2>
            <div style="position: relative; height: 280px;">
              <canvas id="opChart"></canvas>
            </div>
            <div v-if="opWarning" class="mt-3 alert alert-warning p-2.5 small d-flex align-items-center gap-2 mb-0 border-0" style="color: #b45309; background-color: #fffbeb;">
              <i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
              <span class="font-semibold">{{ opWarning }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 追蹤完整度 -->
      <div class="clinical-card mb-4 overflow-hidden">
        <div class="px-4 py-3 border-bottom d-flex justify-content-between align-items-center bg-white">
          <h2 class="fs-6 m-0 fw-bold d-flex align-items-center gap-2" style="color: var(--color-primary);">
            <i class="bi bi-check2-square text-teal" aria-hidden="true"></i>病患追蹤完整度
          </h2>
          <button class="btn btn-sm btn-success px-3.5 py-1.5 fw-semibold d-flex align-items-center gap-1.5 shadow-sm" @click="doExportCsv">
            <i class="bi bi-download" aria-hidden="true"></i>匯出 CSV 檔
          </button>
        </div>
        <div class="p-0">
          <div class="table-responsive">
            <table class="clinical-table mb-0">
              <thead>
                <tr>
                  <th scope="col">研究編號</th>
                  <th scope="col">預計回報次數</th>
                  <th scope="col">實際回報次數</th>
                  <th scope="col">問卷填寫完整度</th>
                  <th scope="col">連續未回覆次數</th>
                  <th scope="col">追蹤狀態</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="completeness.length === 0">
                  <td colspan="6" class="text-center text-muted py-5">目前尚無完整度追蹤資料</td>
                </tr>
                <tr v-for="r in completeness" :key="r.researchId" :class="pctRowClass(r.pct)">
                  <td class="tabular-nums font-semibold"><strong>{{ r.researchId }}</strong></td>
                  <td class="tabular-nums">{{ r.expected }}</td>
                  <td class="tabular-nums">{{ r.actual }}</td>
                  <td style="min-width: 160px;">
                    <div class="d-flex align-items-center gap-2">
                      <div class="progress-bar-container">
                        <div class="progress-bar-fill" :style="`width: ${r.pct}%; background-color: ${pctColor(r.pct)};`"></div>
                      </div>
                      <span class="small fw-bold tabular-nums" :style="`color: ${pctColor(r.pct)}`">{{ r.pct }}%</span>
                    </div>
                  </td>
                  <td class="tabular-nums">
                    <span v-if="r.consecutiveMissed >= 3" class="badge bg-danger px-2.5 py-1">連續未填 {{ r.consecutiveMissed }} 次</span>
                    <span v-else-if="r.consecutiveMissed > 0" class="badge bg-warning text-dark px-2.5 py-1">未填 {{ r.consecutiveMissed }} 次</span>
                    <span v-else class="text-muted small">0</span>
                  </td>
                  <td>
                    <span class="badge" :style="{
                      backgroundColor: r.status === '追蹤中' ? 'var(--color-primary-light)' : '#f1f5f9',
                      color: r.status === '追蹤中' ? 'var(--color-primary)' : '#64748b',
                      border: '1px solid currentColor'
                    }">{{ r.status }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 耗材效益明細 -->
      <div class="clinical-card mb-4 overflow-hidden">
        <div class="px-4 py-3 border-bottom bg-white">
          <h2 class="fs-6 m-0 fw-bold d-flex align-items-center gap-2" style="color: var(--color-primary);">
            <i class="bi bi-file-earmark-medical text-teal" aria-hidden="true"></i>耗材效益明細數據表
          </h2>
        </div>
        <div class="p-0">
          <div class="table-responsive">
            <table class="clinical-table mb-0">
              <thead>
                <tr>
                  <th scope="col">Cage 耗材代碼</th>
                  <th scope="col">樣本個案數</th>
                  <th scope="col">術前基線 VAS</th>
                  <th scope="col">術後 14 天 VAS</th>
                  <th scope="col">VAS 改善幅度</th>
                  <th scope="col">疼痛改善率</th>
                  <th scope="col">主介入手術方式</th>
                  <th scope="col">數據警示</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="cageStats.length === 0">
                  <td colspan="8" class="text-center text-muted py-5">目前尚無耗材統計分析資料</td>
                </tr>
                <tr v-for="r in cageStats" :key="r.cage">
                  <td class="font-monospace"><strong>{{ r.cage }}</strong></td>
                  <td class="tabular-nums"><span class="badge bg-secondary font-monospace px-2.5 py-1">{{ r.n }}</span></td>
                  <td class="tabular-nums">{{ r.preVas }}</td>
                  <td class="tabular-nums">{{ r.vas14 }}</td>
                  <td class="tabular-nums">
                    <span v-if="r.improvement !== 'N/A'" class="text-success fw-bold">▲ {{ r.improvement }}</span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="tabular-nums">{{ r.rate !== 'N/A' ? r.rate : '—' }}</td>
                  <td>{{ r.opName || '—' }}</td>
                  <td>
                    <span v-if="r.warning" class="text-danger small font-semibold d-flex align-items-center gap-1">
                      <i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>{{ r.warning }}
                    </span>
                    <span v-else class="text-muted small">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
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

.transition-btn {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.text-teal {
  color: var(--color-primary) !important;
}

/* Custom completeness table row alerts background */
.row-warning td {
  background-color: #fffbeb !important;
}
.row-danger td {
  background-color: #fef2f2 !important;
}

/* Completeness progress bar */
.progress-bar-container {
  height: 8px;
  border-radius: 4px;
  background-color: #e2e8f0;
  flex-grow: 1;
  overflow: hidden;
  border: 1px solid #cbd5e1;
}
.progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Transitions */
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
</style>
