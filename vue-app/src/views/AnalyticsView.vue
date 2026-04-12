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
        backgroundColor: stats.map(r => r.n < 15 ? '#fbbc04' : '#1a73e8'),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, title: { display: true, text: '改善分數（分）' } } }
    }
  })

  const warns = stats.filter(r => r.warning).map(r => r.warning)
  cageWarning.value = warns.join(' | ')
}

function renderOpChart() {
  const el = document.getElementById('opChart')
  if (!el || opStats.value.length === 0) return
  if (opChart) opChart.destroy()

  const palette = ['#1a73e8','#34a853','#fbbc04','#ea4335','#9c27b0','#00bcd4']
  opChart = new Chart(el, {
    type: 'line',
    data: {
      labels: ['術後第7天','術後第14天','術後第28天'],
      datasets: opStats.value.map((r, i) => ({
        label: `${r.opName} (n=${r.n})`,
        data: [parseFloat(r.vas7) || null, parseFloat(r.vas14) || null, parseFloat(r.vas28) || null],
        borderColor: palette[i % palette.length],
        backgroundColor: palette[i % palette.length] + '33',
        tension: 0.3, fill: false, pointRadius: 5
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
      scales: { y: { min: 0, max: 10, title: { display: true, text: 'VAS 平均分' } } },
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
  return pct >= 80 ? '#34a853' : pct >= 50 ? '#fbbc04' : '#ea4335'
}
function pctRowClass(pct) {
  return pct >= 80 ? '' : pct >= 50 ? 'table-warning' : 'table-danger'
}

onMounted(load)
onUnmounted(() => {
  cageChart?.destroy()
  opChart?.destroy()
})
</script>

<template>
  <div style="background:#f0f4f8; min-height:100vh; font-family:'Segoe UI',sans-serif">

    <!-- Navbar -->
    <nav class="navbar navbar-dark px-3 py-2" style="background:linear-gradient(135deg,#1a73e8,#0d47a1)">
      <span class="navbar-brand fw-bold">
        <i class="bi bi-bar-chart-line me-2"></i>脊椎追蹤系統
      </span>
      <div class="d-flex gap-2">
        <span class="text-white-50 small align-self-center">AI 分析儀表板</span>
        <RouterLink to="/"     class="btn btn-outline-light btn-sm"><i class="bi bi-house me-1"></i>後台</RouterLink>
        <RouterLink to="/form" class="btn btn-outline-light btn-sm"><i class="bi bi-pencil-square me-1"></i>填表</RouterLink>
        <button class="btn btn-outline-light btn-sm" @click="load">
          <i class="bi bi-arrow-clockwise me-1"></i>重新整理
        </button>
      </div>
    </nav>

    <!-- Loading -->
    <div v-if="loading"
         class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
         style="background:rgba(255,255,255,.7);z-index:9999">
      <div class="text-center">
        <div class="spinner-border text-primary mb-2"></div>
        <div class="text-muted small">分析資料中…</div>
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
            <div class="fs-3 fw-bold text-danger">{{ summary.pendingReview }}</div>
          </div>
        </div>
      </div>

      <!-- 圖表區 -->
      <div class="row g-4 mb-4">
        <div class="col-md-6">
          <div class="card p-3 h-100" style="border:none;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
            <div style="font-size:1rem;font-weight:700;color:#1a73e8;border-bottom:2px solid #1a73e8;padding-bottom:6px;margin-bottom:16px">
              耗材效益比較（VAS 改善分數）
            </div>
            <div style="position:relative;height:260px">
              <canvas id="cageChart"></canvas>
            </div>
            <div v-if="cageWarning" class="mt-2" style="color:#ea4335;font-size:.75rem">
              {{ cageWarning }}
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card p-3 h-100" style="border:none;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
            <div style="font-size:1rem;font-weight:700;color:#1a73e8;border-bottom:2px solid #1a73e8;padding-bottom:6px;margin-bottom:16px">
              手術方式 VAS 恢復趨勢
            </div>
            <div style="position:relative;height:260px">
              <canvas id="opChart"></canvas>
            </div>
            <div v-if="opWarning" class="mt-2" style="color:#ea4335;font-size:.75rem">
              {{ opWarning }}
            </div>
          </div>
        </div>
      </div>

      <!-- 追蹤完整度 -->
      <div class="card mb-4" style="border:none;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div style="font-size:1rem;font-weight:700;color:#1a73e8;border-bottom:2px solid #1a73e8;padding-bottom:6px">
              追蹤完整度
            </div>
            <button class="btn btn-sm btn-success" @click="doExportCsv">
              <i class="bi bi-download me-1"></i>匯出 CSV
            </button>
          </div>
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>研究編號</th>
                  <th>應填次數</th>
                  <th>實填次數</th>
                  <th>完整度</th>
                  <th>連續未回覆</th>
                  <th>狀態</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="completeness.length === 0">
                  <td colspan="6" class="text-center text-muted py-3">尚無追蹤資料</td>
                </tr>
                <tr v-for="r in completeness" :key="r.researchId" :class="pctRowClass(r.pct)">
                  <td><strong>{{ r.researchId }}</strong></td>
                  <td>{{ r.expected }}</td>
                  <td>{{ r.actual }}</td>
                  <td style="min-width:130px">
                    <div class="d-flex align-items-center gap-2">
                      <div style="height:8px;border-radius:4px;background:#e9ecef;flex-grow:1">
                        <div :style="`height:100%;border-radius:4px;width:${r.pct}%;background:${pctColor(r.pct)}`"></div>
                      </div>
                      <span class="small fw-bold" :style="`color:${pctColor(r.pct)}`">{{ r.pct }}%</span>
                    </div>
                  </td>
                  <td>
                    <span v-if="r.consecutiveMissed >= 3" class="badge bg-danger">{{ r.consecutiveMissed }} 次</span>
                    <span v-else-if="r.consecutiveMissed > 0" class="badge bg-warning text-dark">{{ r.consecutiveMissed }} 次</span>
                    <span v-else class="text-muted">0</span>
                  </td>
                  <td>{{ r.status }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 耗材效益明細 -->
      <div class="card mb-4" style="border:none;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <div class="card-body">
          <div style="font-size:1rem;font-weight:700;color:#1a73e8;border-bottom:2px solid #1a73e8;padding-bottom:6px;margin-bottom:16px">
            耗材效益明細
          </div>
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>Cage 代碼</th>
                  <th>樣本數</th>
                  <th>術前 VAS</th>
                  <th>術後14天 VAS</th>
                  <th>改善分數</th>
                  <th>改善率</th>
                  <th>手術方式</th>
                  <th>警示</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="cageStats.length === 0">
                  <td colspan="8" class="text-center text-muted py-3">尚無耗材比較資料</td>
                </tr>
                <tr v-for="r in cageStats" :key="r.cage">
                  <td><strong>{{ r.cage }}</strong></td>
                  <td><span class="badge bg-secondary">{{ r.n }}</span></td>
                  <td>{{ r.preVas }}</td>
                  <td>{{ r.vas14 }}</td>
                  <td>
                    <span v-if="r.improvement !== 'N/A'" class="text-success fw-bold">▲ {{ r.improvement }}</span>
                    <span v-else>—</span>
                  </td>
                  <td>{{ r.rate !== 'N/A' ? r.rate : '—' }}</td>
                  <td>{{ r.opName || '—' }}</td>
                  <td>
                    <span v-if="r.warning" style="color:#ea4335;font-size:.75rem">
                      <i class="bi bi-exclamation-triangle me-1"></i>{{ r.warning }}
                    </span>
                    <span v-else>—</span>
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
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity .3s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }
</style>
