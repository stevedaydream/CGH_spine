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
  showToast('CSV 已下載 ✅')
}
</script>

<template>
  <div style="background:#f0f4f8;min-height:100vh;font-family:'Segoe UI',sans-serif">

    <!-- Navbar -->
    <nav class="navbar navbar-dark px-3 py-2" style="background:linear-gradient(135deg,#1a73e8,#0d47a1)">
      <span class="navbar-brand fw-bold"><i class="bi bi-download me-2"></i>資料匯出</span>
      <div class="d-flex gap-2">
        <RouterLink to="/"          class="btn btn-outline-light btn-sm"><i class="bi bi-house me-1"></i>後台</RouterLink>
        <RouterLink to="/analytics" class="btn btn-outline-light btn-sm"><i class="bi bi-bar-chart-line me-1"></i>分析</RouterLink>
        <RouterLink to="/mcid"      class="btn btn-outline-light btn-sm"><i class="bi bi-graph-up-arrow me-1"></i>MCID</RouterLink>
      </div>
    </nav>

    <div class="container-fluid py-4 px-4" style="max-width:1100px">

      <div class="row g-4">

        <!-- 左欄：篩選條件 -->
        <div class="col-12 col-lg-4">
          <div class="card border-0 rounded-3 shadow-sm">
            <div class="card-body p-4">
              <div class="fw-bold mb-3" style="color:#1a73e8;border-bottom:2px solid #1a73e8;padding-bottom:6px">
                <i class="bi bi-funnel me-1"></i>篩選條件
              </div>

              <!-- 病患選擇 -->
              <div class="mb-3">
                <label class="form-label small fw-bold text-muted">病患</label>
                <select v-model="selectedId" class="form-select form-select-sm">
                  <option v-for="id in patientIds" :key="id" :value="id">{{ id }}</option>
                </select>
              </div>

              <!-- 時間點 -->
              <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <label class="form-label small fw-bold text-muted mb-0">術後時間點</label>
                  <button class="btn btn-link btn-sm p-0 text-decoration-none"
                          style="font-size:.75rem" @click="toggleAllDays">
                    {{ selectedDays.length === PUSH_DAYS.length ? '取消全選' : '全選' }}
                  </button>
                </div>
                <div class="d-flex flex-wrap gap-1">
                  <button v-for="d in PUSH_DAYS" :key="d"
                          class="btn btn-sm"
                          :class="selectedDays.includes(d) ? 'btn-primary' : 'btn-outline-secondary'"
                          style="font-size:.72rem;padding:2px 8px;min-width:36px"
                          @click="toggleDay(d)">
                    D{{ d }}
                  </button>
                </div>
                <div class="text-muted mt-1" style="font-size:.72rem">
                  {{ selectedDays.length === 0 ? '全部時間點' : '已選 ' + selectedDays.length + ' 個時間點' }}
                </div>
              </div>

              <!-- 匯出欄位 -->
              <div class="mb-4">
                <label class="form-label small fw-bold text-muted">匯出欄位</label>
                <div class="d-flex flex-column gap-2">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="f-vas" v-model="fields.vas">
                    <label class="form-check-label small" for="f-vas">
                      VAS 疼痛評分
                      <span class="text-muted">（術前 + 術後背痛/腿痛）</span>
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="f-odi" v-model="fields.odi">
                    <label class="form-check-label small" for="f-odi">
                      ODI 總分
                      <span class="text-muted">（術前 + 術後百分比）</span>
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="f-odiDetail" v-model="fields.odiDetail">
                    <label class="form-check-label small" for="f-odiDetail">
                      ODI 各題明細
                      <span class="text-muted">（Q1–Q10 分數與選項）</span>
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="f-pass" v-model="fields.pass">
                    <label class="form-check-label small" for="f-pass">
                      PASS / PGIC
                      <span class="text-muted">（可接受度 + 整體改善）</span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- 操作按鈕 -->
              <button class="btn btn-outline-primary w-100 mb-2"
                      :disabled="loading" @click="loadPreview">
                <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                <i v-else class="bi bi-eye me-1"></i>
                預覽資料
              </button>
              <button class="btn btn-success w-100"
                      :disabled="!previewLoaded || previewRows.length === 0"
                      @click="downloadCsv">
                <i class="bi bi-file-earmark-spreadsheet me-1"></i>
                下載 CSV（{{ previewLoaded ? previewRows.length + ' 筆' : '—' }}）
              </button>
            </div>
          </div>
        </div>

        <!-- 右欄：預覽表格 -->
        <div class="col-12 col-lg-8">
          <div class="card border-0 rounded-3 shadow-sm h-100">
            <div class="card-body p-4">
              <div class="fw-bold mb-3" style="color:#1a73e8;border-bottom:2px solid #1a73e8;padding-bottom:6px">
                <i class="bi bi-table me-1"></i>資料預覽
                <span v-if="previewLoaded" class="ms-2 badge bg-primary">{{ previewRows.length }} 筆</span>
              </div>

              <!-- 未預覽提示 -->
              <div v-if="!previewLoaded && !loading"
                   class="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
                <i class="bi bi-arrow-left-circle fs-2 mb-2"></i>
                設定條件後點「預覽資料」
              </div>

              <!-- Loading -->
              <div v-if="loading" class="d-flex align-items-center justify-content-center py-5">
                <div class="spinner-border text-primary me-2"></div>
                <span class="text-muted">載入中…</span>
              </div>

              <!-- 無資料 -->
              <div v-else-if="previewLoaded && previewRows.length === 0"
                   class="text-center text-muted py-5">
                <i class="bi bi-inbox fs-2 d-block mb-2"></i>
                符合條件的資料為空
              </div>

              <!-- 預覽表格 -->
              <div v-else-if="previewLoaded" class="table-responsive" style="max-height:560px;overflow-y:auto">
                <table class="table table-sm table-hover align-middle mb-0" style="font-size:.8rem;white-space:nowrap">
                  <thead class="table-light sticky-top">
                    <tr>
                      <th v-for="h in previewHeaders" :key="h">{{ h }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(r, i) in previewRows" :key="i">
                      <td v-for="(v, j) in rowToArray(r)" :key="j">
                        <span v-if="j === 4 || j === 5" class="text-muted">{{ v }}</span>
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
    </div>

    <!-- Toast -->
    <div class="position-fixed bottom-0 end-0 p-3" style="z-index:9000">
      <Transition name="toast-fade">
        <div v-if="toast.show"
             :class="`toast show align-items-center text-white border-0 bg-${toast.type}`">
          <div class="d-flex">
            <div class="toast-body">{{ toast.msg }}</div>
            <button class="btn-close btn-close-white me-2 m-auto" @click="toast.show = false"></button>
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
