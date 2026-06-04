<script setup>
import { ref, computed, onMounted } from 'vue'
import { getFormOptions, getExportData } from '../api/gas.js'

// ── 篩選條件 ──────────────────────────────────────────
const patientIds   = ref([])
const selectedId   = ref('')
const PUSH_DAYS    = [1,3,5,7,10,13,17,21,28,35,42,49,56,63,70,77,84]
const selectedDays = ref([])   // 空 = 全部時間點

const fields = ref({
  vas:       true,
  odi:       true,
  odiDetail: true,
  pass:      true
})

// ── 狀態 ──────────────────────────────────────────────
const loading       = ref(false)
const previewRows   = ref([])
const previewLoaded = ref(false)
const toast         = ref({ show: false, msg: '', type: 'success' })
let toastTimer      = null

function showToast(msg, type = 'success') {
  clearTimeout(toastTimer)
  toast.value = { show: true, msg, type }
  toastTimer = setTimeout(() => { toast.value.show = false }, 3000)
}

// ── 欄位標題（依勾選動態產生）────────────────────────
const ODI_Q_TITLES = [
  'Q1 疼痛強度','Q2 個人照護','Q3 提重物','Q4 行走距離','Q5 坐姿耐受',
  'Q6 站立耐受','Q7 睡眠品質','Q8 社交活動','Q9 旅行交通','Q10 職業家務'
]
const ODI_Q_OPTIONS = [
  ['完全不痛','輕微疼痛','中度疼痛','嚴重疼痛','非常嚴重','最嚴重'],
  ['完全自理','略感不方便','需他人協助','大部分依賴','完全依賴','無法照顧自己'],
  ['可提重物','提重物時痛','只能提輕物','不能從地上提','不能提物','連輕物也不行'],
  ['正常行走','可走 1 公里','可走 500m','可走 100m','需助行器','臥床為主'],
  ['任何椅都可以','硬椅可久坐','最多 1 小時','最多 30 分','最多 10 分','完全無法坐'],
  ['久站無痛','站 1 小時後痛','最多 1 小時','最多 30 分','最多 10 分','完全無法站'],
  ['不影響睡眠','偶爾睡不好','少於 6 小時','少於 4 小時','少於 2 小時','完全無法入睡'],
  ['正常社交','稍受限制','明顯受限','只能基本社交','幾乎無社交','完全無社交活動'],
  ['可任意旅行','稍受限','明顯受限','只能短途','幾乎不行','完全無法出行'],
  ['正常工作','稍受限制','明顯受限','只能輕鬆工作','幾乎無法工作','完全無法工作'],
]

const previewHeaders = computed(() => {
  const h = ['研究編號','病歷號','手術日期','術式','主刀','回報日期','術後天數','來源']
  if (fields.value.vas) h.push('術前VAS背','術前VAS腿','VAS背','VAS腿')
  if (fields.value.odi) h.push('術前ODI%','ODI%')
  if (fields.value.odiDetail) ODI_Q_TITLES.forEach(t => h.push(t))
  if (fields.value.pass) h.push('PASS','整體改善')
  return h
})

function rowToArray(r) {
  const a = [
    r.research_id, r.chart_number ?? '', r.op_date, r.op_name, r.surgeon,
    r.log_datetime, r.days_post_op, r.record_type
  ]
  if (fields.value.vas) a.push(r.pre_vas_back ?? '', r.pre_vas_leg ?? '', r.vas_back ?? '', r.vas_leg ?? '')
  if (fields.value.odi) a.push(r.pre_odi ?? '', r.odi_score ?? '')
  if (fields.value.odiDetail) {
    for (let q = 1; q <= 10; q++) {
      const score = r['odi_q' + q]
      const label = (score !== '' && score !== null && score !== undefined)
        ? `${score}-${ODI_Q_OPTIONS[q-1][score] ?? ''}` : ''
      a.push(label)
    }
  }
  if (fields.value.pass) a.push(r.pass ?? '', r.anchor_q ?? '')
  return a
}

// ── 載入病患清單 ──────────────────────────────────────
onMounted(async () => {
  try {
    const opts = await getFormOptions()
    patientIds.value = ['（全部病患）', ...(opts.patientIds || [])]
    selectedId.value = '（全部病患）'
  } catch (e) {
    showToast('載入病患清單失敗', 'danger')
  }
})

// ── 切換時間點 ────────────────────────────────────────
function toggleDay(d) {
  const i = selectedDays.value.indexOf(d)
  i === -1 ? selectedDays.value.push(d) : selectedDays.value.splice(i, 1)
}
function toggleAllDays() {
  selectedDays.value = selectedDays.value.length === PUSH_DAYS.length ? [] : [...PUSH_DAYS]
}

// ── 預覽 ──────────────────────────────────────────────
async function loadPreview() {
  loading.value = true
  previewLoaded.value = false
  try {
    const params = buildParams()
    const data = await getExportData(params)
    previewRows.value = data.rows || []
    previewLoaded.value = true
    showToast(`預覽成功，共載入 ${previewRows.value.length} 筆資料`)
  } catch (e) {
    showToast('預覽失敗：' + e.message, 'danger')
  } finally {
    loading.value = false
  }
}

function buildParams() {
  const fieldArr = Object.entries(fields.value)
    .filter(([, v]) => v).map(([k]) => k)
  return {
    researchId: selectedId.value === '（全部病患）' ? '' : (selectedId.value || ''),
    days:       selectedDays.value.length > 0 ? selectedDays.value.join(',') : '',
    fields:     fieldArr.join(',')
  }
}

// ── 下載 CSV ─────────────────────────────────────────
function downloadCsv() {
  if (!previewRows.value.length) return
  const headers = previewHeaders.value
  const rows    = previewRows.value.map(rowToArray)

  const bom  = '\uFEFF'
  const csv  = bom + [headers, ...rows]
    .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href     = url
  a.download = `spine_questionnaire_${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
  showToast('CSV 下載成功 ✅')
}
</script>

<template>
  <div style="background: var(--color-bg-base); min-height: 100vh; font-family: var(--font-family);">

    <!-- Navbar / Header -->
    <nav class="navbar navbar-expand-lg navbar-dark px-4 py-3 shadow-sm border-bottom" style="background: linear-gradient(135deg, var(--color-primary), #063e45);">
      <div class="container-fluid p-0 d-flex justify-content-between align-items-center">
        <span class="navbar-brand fw-bold fs-5 d-flex align-items-center">
          <i class="bi bi-download me-2" aria-hidden="true"></i>資料匯出與預覽
        </span>
        <div class="d-flex gap-2 flex-wrap">
          <span class="text-white-50 small align-self-center me-2 tabular-nums">臨床管理端</span>
          <RouterLink to="/" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-house" aria-hidden="true"></i>儀表板
          </RouterLink>
          <RouterLink to="/form" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-person-plus" aria-hidden="true"></i>手術登錄
          </RouterLink>
          <RouterLink to="/analytics" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-bar-chart-line" aria-hidden="true"></i>分析
          </RouterLink>
          <RouterLink to="/mcid" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-graph-up-arrow" aria-hidden="true"></i>MCID
          </RouterLink>
          <RouterLink to="/export" class="btn btn-light btn-sm text-dark px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-download" aria-hidden="true"></i>匯出
          </RouterLink>
          <RouterLink to="/clinic" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-clipboard2-pulse" aria-hidden="true"></i>回診登記
          </RouterLink>
          <RouterLink to="/demo" class="btn btn-outline-warning btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-play-circle" aria-hidden="true"></i>Demo演示
          </RouterLink>
        </div>
      </div>
    </nav>

    <div class="container-fluid py-4 px-4">
      <div class="row g-4">

        <!-- 左欄：篩選條件 -->
        <div class="col-12 col-xl-4">
          <div class="clinical-card bg-white p-4 h-100">
            <h2 class="fs-6 fw-bold mb-4 pb-2 border-bottom d-flex align-items-center gap-2" style="color: var(--color-primary);">
              <i class="bi bi-funnel text-teal" aria-hidden="true"></i>篩選匯出條件
            </h2>

            <!-- 病患選擇 -->
            <div class="mb-4">
              <label for="patient-select" class="form-label small fw-bold text-muted d-flex align-items-center gap-1">
                <i class="bi bi-person text-teal" aria-hidden="true"></i> 指定個案編號
              </label>
              <select id="patient-select" v-model="selectedId" class="form-select focus-ring" aria-label="選擇病患研究編號">
                <option v-for="id in patientIds" :key="id" :value="id">{{ id }}</option>
              </select>
            </div>

            <!-- 時間點 -->
            <div class="mb-4">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="form-label small fw-bold text-muted mb-0 d-flex align-items-center gap-1">
                  <i class="bi bi-calendar-event text-teal" aria-hidden="true"></i> 術後時間點 (天數)
                </label>
                <button class="btn btn-link btn-sm p-0 text-decoration-none fw-semibold focus-ring"
                        style="font-size: .8rem; color: var(--color-accent);" @click="toggleAllDays">
                  {{ selectedDays.length === PUSH_DAYS.length ? '清除全選' : '快速全選' }}
                </button>
              </div>
              
              <div class="d-flex flex-wrap gap-1.5">
                <button v-for="d in PUSH_DAYS" :key="d"
                        type="button"
                        class="btn btn-sm px-2.5 py-1.5 transition-btn rounded-pill text-nowrap tabular-nums"
                        :class="selectedDays.includes(d) ? 'btn-teal text-white shadow-sm' : 'btn-light text-secondary border'"
                        style="font-size: .75rem; min-width: 44px;"
                        @click="toggleDay(d)">
                  D{{ d }}
                </button>
              </div>
              <div class="text-muted mt-2 small font-monospace">
                {{ selectedDays.length === 0 ? '預設包含所有追蹤時間點' : `已選擇 ${selectedDays.length} 個追蹤時間點` }}
              </div>
            </div>

            <!-- 匯出欄位 -->
            <div class="mb-4">
              <label class="form-label small fw-bold text-muted mb-2.5 d-flex align-items-center gap-1">
                <i class="bi bi-check-all text-teal" aria-hidden="true"></i> 選擇匯出欄位
              </label>
              <div class="d-flex flex-column gap-2.5 p-3 rounded-3" style="background: #f8fafc; border: 1px solid var(--color-border);">
                <div class="form-check">
                  <input class="form-check-input focus-ring" type="checkbox" id="f-vas" v-model="fields.vas">
                  <label class="form-check-label small fw-medium" for="f-vas">
                    VAS 疼痛分數
                    <span class="text-muted d-block small" style="font-size: 0.72rem;">術前/術後（背部與腿部疼痛分數）</span>
                  </label>
                </div>
                <div class="form-check">
                  <input class="form-check-input focus-ring" type="checkbox" id="f-odi" v-model="fields.odi">
                  <label class="form-check-label small fw-medium" for="f-odi">
                    ODI 功能障礙指數
                    <span class="text-muted d-block small" style="font-size: 0.72rem;">術前/術後（百分比總分）</span>
                  </label>
                </div>
                <div class="form-check">
                  <input class="form-check-input focus-ring" type="checkbox" id="f-odiDetail" v-model="fields.odiDetail">
                  <label class="form-check-label small fw-medium" for="f-odiDetail">
                    ODI 各題原始明細
                    <span class="text-muted d-block small" style="font-size: 0.72rem;">Q1–Q10 詳細選項值與文字描述</span>
                  </label>
                </div>
                <div class="form-check">
                  <input class="form-check-input focus-ring" type="checkbox" id="f-pass" v-model="fields.pass">
                  <label class="form-check-label small fw-medium" for="f-pass">
                    PASS 滿意度與 PGIC
                    <span class="text-muted d-block small" style="font-size: 0.72rem;">術後滿意狀態與患者自我整體改善感受</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- 操作按鈕 -->
            <div class="d-flex flex-column gap-2">
              <button class="btn btn-teal w-100 py-2.5 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm transition-btn focus-ring"
                      :disabled="loading" @click="loadPreview">
                <span v-if="loading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <i v-else class="bi bi-eye" aria-hidden="true"></i>
                預覽臨床資料
              </button>
              <button class="btn btn-success w-100 py-2.5 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm transition-btn focus-ring"
                      :disabled="!previewLoaded || previewRows.length === 0"
                      @click="downloadCsv">
                <i class="bi bi-file-earmark-spreadsheet" aria-hidden="true"></i>
                下載 CSV 檔案
                <span v-if="previewLoaded" class="badge bg-white text-success font-monospace" style="font-size: 0.75rem;">{{ previewRows.length }} 筆</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 右欄：預覽表格 -->
        <div class="col-12 col-xl-8">
          <div class="clinical-card bg-white p-4 h-100 d-flex flex-column" style="min-height: 500px;">
            <h2 class="fs-6 fw-bold mb-4 pb-2 border-bottom d-flex align-items-center justify-content-between" style="color: var(--color-primary);">
              <span class="d-flex align-items-center gap-2">
                <i class="bi bi-table text-teal" aria-hidden="true"></i>資料預覽視窗
              </span>
              <span v-if="previewLoaded" class="badge rounded-pill font-monospace" style="background: var(--color-primary-light); color: var(--color-primary);">
                共 {{ previewRows.length }} 筆符合資料
              </span>
            </h2>

            <!-- 未預覽提示 -->
            <div v-if="!previewLoaded && !loading"
                 class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-muted py-5">
              <i class="bi bi-arrow-left-circle fs-2 text-teal-soft mb-3" aria-hidden="true" style="color: #cbd5e1;"></i>
              <div class="fw-semibold fs-6 mb-1 text-secondary">尚未載入預覽</div>
              <div class="small">請於左側設定篩選與欄位條件後，點選「預覽臨床資料」按鈕。</div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 py-5">
              <div class="spinner-border text-teal mb-3" style="color: var(--color-accent);" role="status">
                <span class="visually-hidden">載入中…</span>
              </div>
              <span class="text-muted fw-medium">資料庫查詢中，請稍候…</span>
            </div>

            <!-- 無資料 -->
            <div v-else-if="previewLoaded && previewRows.length === 0"
                 class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-muted py-5">
              <i class="bi bi-inbox fs-2 text-warning mb-3" aria-hidden="true"></i>
              <div class="fw-semibold fs-6 mb-1 text-secondary">無符合條件資料</div>
              <div class="small">查無符合所選病患編號、天數的術後問卷填寫紀錄。</div>
            </div>

            <!-- 預覽表格 -->
            <div v-else-if="previewLoaded" class="table-responsive flex-grow-1" style="max-height: 600px; overflow-y: auto;">
              <table class="clinical-table mb-0 text-nowrap" style="font-size: .82rem;">
                <thead class="sticky-top bg-white border-bottom">
                  <tr>
                    <th scope="col" v-for="h in previewHeaders" :key="h" class="py-2.5 px-3">{{ h }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(r, i) in previewRows" :key="i">
                    <td v-for="(v, j) in rowToArray(r)" :key="j" class="py-2 px-3">
                      <!-- 依照列索引格式化樣式 -->
                      <span v-if="j === 0" class="tabular-nums font-semibold"><strong>{{ v }}</strong></span>
                      <span v-else-if="j === 1 || j === 2 || j === 5 || j === 6" class="tabular-nums text-muted">{{ v }}</span>
                      <span v-else-if="j >= 8 && j <= 13" class="tabular-nums text-center fw-semibold text-teal">{{ v }}</span>
                      <span v-else>{{ v }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
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
.transition-btn {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.btn-teal {
  background-color: var(--color-primary);
  color: #fff;
  border: 1px solid var(--color-primary);
}
.btn-teal:hover {
  background-color: #063e45;
  color: #fff;
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

/* Custom scrollbars inside preview window */
.table-responsive::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.table-responsive::-webkit-scrollbar-track {
  background: transparent;
}
.table-responsive::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.table-responsive::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
