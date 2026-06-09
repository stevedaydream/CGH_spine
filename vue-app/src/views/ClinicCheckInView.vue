<script setup>
import { ref, computed, onMounted } from 'vue'
import VasInput from '../components/VasInput.vue'
import { searchPatient, getClinicCheckInInfo, addFollowUpRecord, getFormOptions } from '../api/gas.js'

const query      = ref('')
const searching  = ref(false)
const patient    = ref(null)
const bindCode   = ref('')
const expiresAt  = ref('')
const copied     = ref(false)

const patientIds      = ref([])
const showSuggestions = ref(false)

const suggestions = computed(() => {
  const q = query.value.trim()
  if (!q) return []
  return patientIds.value
    .filter(id => id.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 8)
})

onMounted(async () => {
  try {
    const opts = await getFormOptions()
    patientIds.value = opts.patientIds || []
  } catch(e) { /* autocomplete 不影響主功能 */ }
})

function selectSuggestion(id) {
  query.value = id
  showSuggestions.value = false
  doSearch()
}

const form = ref({ vasBack: null, vasLeg: null, odiScore: '', pass: '', anchorQ: null, woundStatus: '' })
const submitting = ref(false)

const toast = ref({ show: false, msg: '', type: 'success' })
let toastTimer = null
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer)
  toast.value = { show: true, msg, type }
  toastTimer = setTimeout(() => { toast.value.show = false }, 3000)
}

async function doSearch() {
  if (!query.value.trim()) return
  searching.value = true
  patient.value   = null
  bindCode.value  = ''
  expiresAt.value = ''
  try {
    const res = await searchPatient(query.value.trim())
    if (!res.found) { showToast('找不到此病患', 'warning'); return }
    patient.value = res
    const info = await getClinicCheckInInfo(res.researchId)
    bindCode.value  = info.bindingCode || ''
    expiresAt.value = info.expiresAt   || ''
  } catch(e) {
    showToast('搜尋失敗：' + e.message, 'danger')
  } finally {
    searching.value = false
  }
}

function copyCode() {
  navigator.clipboard.writeText(bindCode.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

async function submitRecord() {
  if (!patient.value) return
  submitting.value = true
  try {
    await addFollowUpRecord({
      researchId:  patient.value.researchId,
      vasBack:     form.value.vasBack,
      vasLeg:      form.value.vasLeg,
      odiScore:    form.value.odiScore,
      pass:        form.value.pass,
      anchorQ:     form.value.anchorQ,
      woundStatus: form.value.woundStatus
    })
    showToast('回診記錄已儲存')
    form.value = { vasBack: null, vasLeg: null, odiScore: '', pass: '', anchorQ: null, woundStatus: '' }
    doSearch()
  } catch(e) {
    showToast('儲存失敗：' + e.message, 'danger')
  } finally {
    submitting.value = false
  }
}

const lineStatusLabel = { active: '已綁定', unbound: '未綁定', blocked: '已封鎖' }
const lineStatusClass = { active: 'success', unbound: 'warning', blocked: 'danger' }

function getVasColor(score) {
  if (score === null || score === undefined || isNaN(score)) return '#cbd5e1';
  const val = Number(score);
  if (val <= 2) return '#10b981'; // green
  if (val <= 5) return '#f59e0b'; // amber
  if (val <= 8) return '#f97316'; // orange
  return '#ef4444'; // red
}
</script>

<template>
  <div style="background: var(--color-bg-base); min-height: 100vh; font-family: var(--font-family);">



    <div class="container py-4" style="max-width: 780px;">

      <!-- 頁面標題 -->
      <div class="mb-4">
        <h1 class="fw-bold mb-1 fs-4 d-flex align-items-center gap-2" style="color: var(--color-primary);">
          <i class="bi bi-clipboard2-pulse text-teal" aria-hidden="true"></i>回診登記中心
        </h1>
        <div class="text-muted small">搜尋病患編號 · LINE 追蹤綁定 · 診間快速回診病歷紀錄</div>
      </div>

      <!-- 搜尋區 -->
      <div class="clinical-card mb-4 overflow-hidden">
        <div class="card-body p-4 bg-white">
          <label for="patientSearch" class="form-label fw-bold small text-teal mb-2">搜尋回診個案</label>
          <div class="d-flex gap-2">
            <div class="position-relative flex-grow-1" role="combobox" aria-haspopup="listbox" :aria-expanded="showSuggestions && suggestions.length > 0">
              <input v-model="query" type="text"
                     id="patientSearch"
                     class="form-control form-control-lg focus-ring font-monospace"
                     placeholder="輸入研究編號（如 SP-2026-001）或病歷號…"
                     autocomplete="off"
                     @keyup.enter="doSearch"
                     @focus="showSuggestions = true"
                     @blur="showSuggestions = false"
                     style="border-radius: 10px; font-size: 1rem;">
              <ul v-if="showSuggestions && suggestions.length"
                   class="suggestions-list shadow-lg border m-0 p-0"
                   role="listbox">
                <li v-for="id in suggestions" :key="id"
                     @mousedown.prevent="selectSuggestion(id)"
                     class="suggestion-item font-monospace"
                     role="option">
                  <i class="bi bi-person me-2 text-muted" aria-hidden="true"></i>{{ id }}
                </li>
              </ul>
            </div>
            <button class="btn btn-primary btn-lg px-4 d-flex align-items-center gap-2"
                    :disabled="searching || !query.trim()"
                    @click="doSearch"
                    style="border-radius: 10px; white-space: nowrap; font-size: 1rem;">
              <span v-if="searching" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              <i v-else class="bi bi-search" aria-hidden="true"></i>
              搜尋
            </button>
          </div>
        </div>
      </div>

      <!-- 搜尋結果：病患資訊卡 -->
      <Transition name="fade">
        <div v-if="patient" class="clinical-card mb-4 overflow-hidden">
          <div class="card-body p-4 bg-white">

            <!-- 卡片標題 + LINE 狀態 -->
            <div class="d-flex justify-content-between align-items-start mb-3 border-bottom pb-3">
              <div>
                <div class="fw-bold fs-5 font-monospace" style="color: var(--color-primary);">{{ patient.researchId }}</div>
                <div class="text-muted small tabular-nums">病歷號：{{ patient.chartNumber || '—' }}</div>
              </div>
              <span :class="`badge px-3 py-2 bg-${lineStatusClass[patient.lineStatus] || 'secondary'} fs-7 d-flex align-items-center gap-1.5`">
                <i class="bi bi-chat-fill" aria-hidden="true"></i>
                LINE {{ lineStatusLabel[patient.lineStatus] || patient.lineStatus }}
              </span>
            </div>

            <!-- 病患基本追蹤資訊 -->
            <div class="row g-3 mb-4 small">
              <div class="col-6 col-md-3">
                <div class="text-muted mb-0.5">手術日期</div>
                <div class="fw-semibold tabular-nums text-dark">{{ patient.opDate || '—' }}</div>
              </div>
              <div class="col-6 col-md-3">
                <div class="text-muted mb-0.5">術後時程</div>
                <div class="fw-semibold">
                  <span class="badge bg-soft-teal text-teal border border-teal-light tabular-nums px-2.5">D+{{ patient.daysPostOp }}</span>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="text-muted mb-0.5">手術項目</div>
                <div class="fw-semibold text-dark text-truncate" :title="patient.opName">{{ patient.opName || '—' }}</div>
              </div>
              <div class="col-6 col-md-3">
                <div class="text-muted mb-0.5">主刀醫師</div>
                <div class="fw-semibold text-dark">{{ patient.surgeon || '—' }}</div>
              </div>
              <div class="col-6 col-md-3">
                <div class="text-muted mb-0.5">上一次 VAS 背痛</div>
                <div class="fw-semibold tabular-nums">
                  <span v-if="patient.lastVasBack !== undefined" class="vas-score-circle" :style="`background-color:${getVasColor(patient.lastVasBack)}`">{{ patient.lastVasBack }}</span>
                  <span v-else class="text-muted">—</span>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="text-muted mb-0.5">上一次 VAS 腿痛</div>
                <div class="fw-semibold tabular-nums">
                  <span v-if="patient.lastVasLeg !== undefined" class="vas-score-circle" :style="`background-color:${getVasColor(patient.lastVasLeg)}`">{{ patient.lastVasLeg }}</span>
                  <span v-else class="text-muted">—</span>
                </div>
              </div>
            </div>

            <!-- LINE 綁定區塊（僅非 active 才顯示）-->
            <div v-if="patient.lineStatus !== 'active' && bindCode"
                 class="rounded-4 p-4 text-center border-dashed-orange"
                 style="background-color: #fffbeb;">
              <div class="text-warning-dark small mb-1 fw-bold"><i class="bi bi-qr-code-scan me-1" aria-hidden="true"></i>病患 LINE 綁定驗證碼</div>
              <div class="display-5 fw-bold letter-spacing-wide font-monospace my-2 tabular-nums" style="letter-spacing: .25em; color: #d97706;">
                {{ bindCode }}
              </div>
              <div v-if="expiresAt" class="text-muted small mb-2 tabular-nums">此驗證碼有效期限至：{{ expiresAt }}</div>
              <div class="text-muted small mb-3">
                請引導病患手機掃描診間 LINE QR Code，加入好友後輸入此 6 位數代碼完成對接。
              </div>
              <button class="btn btn-sm px-4 py-1.5 shadow-sm"
                      :class="copied ? 'btn-success' : 'btn-outline-secondary'"
                      @click="copyCode"
                      aria-label="複製 LINE 綁定驗證碼">
                <i :class="copied ? 'bi bi-check-lg' : 'bi bi-clipboard'" class="me-1" aria-hidden="true"></i>
                {{ copied ? '已複製！' : '複製驗證碼' }}
              </button>
            </div>

          </div>
        </div>
      </Transition>

      <!-- 快速回診記錄表單 -->
      <Transition name="fade">
        <div v-if="patient" class="clinical-card overflow-hidden">
          <div class="card-body p-4 bg-white">
            <h2 class="fw-bold mb-4 fs-6 pb-2.5 border-bottom d-flex align-items-center gap-2" style="color: var(--color-primary);">
              <i class="bi bi-plus-circle text-teal" aria-hidden="true"></i>快速回診臨床病歷登錄
            </h2>

            <div class="mb-4">
              <span class="form-label-clinical d-block mb-2">VAS 背部疼痛評分 (0–10)</span>
              <VasInput v-model="form.vasBack" />
            </div>

            <div class="mb-4">
              <span class="form-label-clinical d-block mb-2">VAS 腿部疼痛評分 (0–10)</span>
              <VasInput v-model="form.vasLeg" />
            </div>

            <div class="row g-3 mb-4">
              <div class="col-12 col-md-6">
                <label for="odiScore" class="form-label-clinical mb-2">ODI 功能殘疾總分 %</label>
                <div class="input-group">
                  <input v-model="form.odiScore" type="number" min="0" max="100" id="odiScore"
                         class="form-control focus-ring tabular-nums" placeholder="0–100" style="max-width: 140px;">
                  <span class="input-group-text bg-light text-muted fw-bold">%</span>
                </div>
              </div>

              <div class="col-12 col-md-6">
                <span class="form-label-clinical d-block mb-2">PASS（病患可接受目前的狀態？）</span>
                <div class="btn-group w-100" role="group" aria-label="治療結果可接受性狀態選擇">
                  <button type="button"
                          class="btn btn-sm py-2 fw-semibold border w-50"
                          :class="form.pass === 'Y' ? 'btn-success text-white border-success' : 'btn-outline-success'"
                          @click="form.pass = form.pass === 'Y' ? '' : 'Y'">
                    <i class="bi bi-emoji-smile me-1.5" aria-hidden="true"></i>Y 可接受
                  </button>
                  <button type="button"
                          class="btn btn-sm py-2 fw-semibold border w-50"
                          :class="form.pass === 'N' ? 'btn-danger text-white border-danger' : 'btn-outline-danger'"
                          @click="form.pass = form.pass === 'N' ? '' : 'N'">
                    <i class="bi bi-emoji-frown me-1.5" aria-hidden="true"></i>N 不滿意
                  </button>
                </div>
              </div>
            </div>

            <div class="mb-4">
              <span class="form-label-clinical d-block mb-2">PGIC — 整體症狀改善感受 (1=惡化 → 7=顯著改善)</span>
              <div class="d-flex gap-2 flex-wrap" role="group" aria-label="PGIC 評分 1 至 7">
                <button v-for="n in 7" :key="n" type="button"
                        class="btn pgic-btn fw-bold tabular-nums"
                        :class="form.anchorQ === n ? 'active-pgic' : ''"
                        @click="form.anchorQ = form.anchorQ === n ? null : n"
                        :aria-label="`PGIC 評分 ${n}`"
                        :aria-pressed="form.anchorQ === n">
                  {{ n }}
                </button>
              </div>
              <div class="d-flex justify-content-between text-muted mt-2 px-1" style="font-size: .75rem;">
                <span>1 非常惡化</span>
                <span>4 沒有變化</span>
                <span>7 非常改善</span>
              </div>
            </div>

            <div class="mb-4">
              <label for="woundStatus" class="form-label-clinical mb-2">診間傷口評估狀況</label>
              <input v-model="form.woundStatus" type="text" id="woundStatus" class="form-control focus-ring"
                     placeholder="例：術後傷口癒合良乾淨，無發紅或滲液，已順利拆線…">
            </div>

            <button class="btn btn-primary px-4 py-2.5 d-flex align-items-center gap-2 fw-semibold shadow-sm"
                    :disabled="submitting" @click="submitRecord">
              <span v-if="submitting" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              <i v-else class="bi bi-check-lg" aria-hidden="true"></i>
              儲存回診紀錄
            </button>
          </div>
        </div>
      </Transition>

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

.suggestions-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 1050;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  max-height: 280px;
  overflow-y: auto;
}
.suggestion-item {
  padding: 12px 16px;
  cursor: pointer;
  font-size: .95rem;
  border-bottom: 1px solid #f1f5f9;
  list-style: none;
  color: var(--color-text-main);
  transition: background-color 0.15s ease;
}
.suggestion-item:hover {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}

/* Form inputs & labels */
.form-label-clinical {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-primary);
}
.focus-ring:focus {
  border-color: var(--color-accent) !important;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.25) !important;
  outline: none !important;
}

/* Orange dashed border for binding box */
.border-dashed-orange {
  border: 2px dashed #fcd34d;
}
.text-warning-dark {
  color: #b45309;
}

/* VAS inline circles */
.vas-score-circle {
  display: inline-block;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  text-align: center;
  line-height: 24px;
  color: #fff;
  font-weight: 700;
  font-size: 0.75rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Custom PGIC layout buttons */
.pgic-btn {
  background-color: #f8fafc;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}
.pgic-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background-color: var(--color-primary-light);
}
.active-pgic {
  background-color: var(--color-accent) !important;
  border-color: var(--color-accent) !important;
  color: #ffffff !important;
  transform: scale(1.08);
  box-shadow: 0 4px 10px rgba(20, 184, 166, 0.35);
}

/* Soft teal elements */
.bg-soft-teal {
  background-color: var(--color-primary-light);
}
.border-teal-light {
  border-color: #ccebe5 !important;
}
.text-teal {
  color: var(--color-primary) !important;
}

/* Transitions */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.toast-fade-enter-active, .toast-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-fade-enter-from, .toast-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
