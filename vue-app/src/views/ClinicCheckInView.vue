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
        <RouterLink to="/"           class="btn btn-outline-light btn-sm"><i class="bi bi-house me-1"></i>儀表板</RouterLink>
        <RouterLink to="/form"       class="btn btn-outline-light btn-sm"><i class="bi bi-person-plus me-1"></i>手術登錄</RouterLink>
        <RouterLink to="/analytics"  class="btn btn-outline-light btn-sm"><i class="bi bi-bar-chart-line me-1"></i>分析</RouterLink>
        <RouterLink to="/mcid"       class="btn btn-outline-light btn-sm"><i class="bi bi-graph-up-arrow me-1"></i>MCID</RouterLink>
        <RouterLink to="/export"     class="btn btn-outline-light btn-sm"><i class="bi bi-download me-1"></i>匯出</RouterLink>
        <div class="sys-menu">
          <RouterLink to="/bot-management" class="btn btn-outline-light btn-sm">
            <i class="bi bi-gear me-1"></i>系統設定
          </RouterLink>
          <div class="sys-menu-dropdown">
            <div><i class="bi bi-robot me-1"></i>LINE Bot 回覆設定</div>
            <div><i class="bi bi-journal-medical me-1"></i>衛教 QA 管理</div>
            <div><i class="bi bi-box-seam me-1"></i>耗材管理</div>
          </div>
        </div>
        <RouterLink to="/clinic"     class="btn btn-light btn-sm"><i class="bi bi-clipboard2-pulse me-1"></i>回診登記</RouterLink>
        <RouterLink to="/demo"       class="btn btn-outline-warning btn-sm"><i class="bi bi-play-circle me-1"></i>Demo演示</RouterLink>
      </div>
    </nav>

    <div class="container py-4" style="max-width:760px">

      <!-- 頁面標題 -->
      <div class="mb-4">
        <h4 class="fw-bold mb-1" style="color:#1a73e8">
          <i class="bi bi-clipboard2-pulse me-2"></i>回診登記中心
        </h4>
        <div class="text-muted small">搜尋病患 · 綁定 LINE · 快速記錄回診</div>
      </div>

      <!-- 搜尋區 -->
      <div class="card mb-4" style="border:none;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.1)">
        <div class="card-body p-4">
          <label class="form-label fw-semibold mb-2">病患搜尋</label>
          <div class="d-flex gap-2">
            <div style="position:relative;flex:1">
              <input v-model="query" type="text"
                     class="form-control form-control-lg"
                     placeholder="輸入研究編號（如 001、SP-2026-001）或病歷號"
                     @keyup.enter="doSearch"
                     @focus="showSuggestions = true"
                     @blur="showSuggestions = false"
                     style="border-radius:10px">
              <div v-if="showSuggestions && suggestions.length"
                   style="position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:1050;background:#fff;border:1px solid #dee2e6;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.12);overflow:hidden">
                <div v-for="id in suggestions" :key="id"
                     @mousedown.prevent="selectSuggestion(id)"
                     style="padding:10px 16px;cursor:pointer;font-size:.95rem;border-bottom:1px solid #f0f4f8;transition:background .1s"
                     @mouseover="$event.target.style.background='#e8f0fe'"
                     @mouseout="$event.target.style.background=''">
                  {{ id }}
                </div>
              </div>
            </div>
            <button class="btn btn-primary btn-lg px-4"
                    :disabled="searching || !query.trim()"
                    @click="doSearch"
                    style="border-radius:10px;white-space:nowrap">
              <span v-if="searching" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="bi bi-search me-1"></i>
              搜尋
            </button>
          </div>
        </div>
      </div>

      <!-- 搜尋結果：病患卡片 -->
      <Transition name="fade">
        <div v-if="patient" class="card mb-4" style="border:none;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.1)">
          <div class="card-body p-4">

            <!-- 卡片標題 + LINE 狀態 -->
            <div class="d-flex justify-content-between align-items-start mb-3">
              <div>
                <div class="fw-bold fs-5" style="color:#1a73e8">{{ patient.researchId }}</div>
                <div class="text-muted small">病歷號：{{ patient.chartNumber || '—' }}</div>
              </div>
              <span :class="`badge bg-${lineStatusClass[patient.lineStatus] || 'secondary'} fs-6`">
                <i class="bi bi-chat me-1"></i>
                LINE {{ lineStatusLabel[patient.lineStatus] || patient.lineStatus }}
              </span>
            </div>

            <!-- 病患資訊列 -->
            <div class="row g-3 mb-3 small">
              <div class="col-6 col-md-3">
                <div class="text-muted">手術日期</div>
                <div class="fw-semibold">{{ patient.opDate || '—' }}</div>
              </div>
              <div class="col-6 col-md-3">
                <div class="text-muted">術後天數</div>
                <div class="fw-semibold">
                  <span class="badge bg-light text-dark border fs-6">D+{{ patient.daysPostOp }}</span>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="text-muted">手術類型</div>
                <div class="fw-semibold">{{ patient.opName || '—' }}</div>
              </div>
              <div class="col-6 col-md-3">
                <div class="text-muted">主刀醫師</div>
                <div class="fw-semibold">{{ patient.surgeon || '—' }}</div>
              </div>
              <div class="col-6 col-md-3">
                <div class="text-muted">上次 VAS 背</div>
                <div class="fw-semibold">{{ patient.lastVasBack !== undefined ? patient.lastVasBack : '—' }}</div>
              </div>
              <div class="col-6 col-md-3">
                <div class="text-muted">上次 VAS 腿</div>
                <div class="fw-semibold">{{ patient.lastVasLeg !== undefined ? patient.lastVasLeg : '—' }}</div>
              </div>
            </div>

            <!-- LINE 綁定碼區塊（僅非 active 才顯示）-->
            <div v-if="patient.lineStatus !== 'active' && bindCode"
                 class="rounded-3 p-3 mb-0 text-center"
                 style="background:#fffde7;border:2px dashed #fbc02d">
              <div class="text-muted small mb-1 fw-semibold">LINE 綁定碼</div>
              <div class="display-4 fw-bold letter-spacing-wide my-2" style="letter-spacing:.25em;color:#e65100">
                {{ bindCode }}
              </div>
              <div v-if="expiresAt" class="text-muted small mb-2">到期時間：{{ expiresAt }}</div>
              <div class="text-muted small mb-3">
                請病患加入 LINE Bot 後，輸入此 6 位數碼完成綁定
              </div>
              <button class="btn btn-sm"
                      :class="copied ? 'btn-success' : 'btn-outline-secondary'"
                      @click="copyCode">
                <i :class="copied ? 'bi bi-check-lg' : 'bi bi-clipboard'" class="me-1"></i>
                {{ copied ? '已複製！' : '複製綁定碼' }}
              </button>
            </div>

          </div>
        </div>
      </Transition>

      <!-- 快速回診記錄表單 -->
      <Transition name="fade">
        <div v-if="patient"
             class="card" style="border:none;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.1)">
          <div class="card-body p-4">
            <div class="fw-bold mb-3" style="color:#1a73e8;border-bottom:2px solid #1a73e8;padding-bottom:6px">
              <i class="bi bi-plus-circle me-2"></i>快速回診記錄
            </div>

            <div class="mb-3">
              <label class="form-label fw-semibold small">VAS 背部疼痛</label>
              <VasInput v-model="form.vasBack" />
            </div>

            <div class="mb-3">
              <label class="form-label fw-semibold small">VAS 腿部疼痛</label>
              <VasInput v-model="form.vasLeg" />
            </div>

            <div class="mb-3">
              <label class="form-label fw-semibold small">ODI 總分 %</label>
              <input v-model="form.odiScore" type="number" min="0" max="100"
                     class="form-control" placeholder="0–100" style="width:140px">
            </div>

            <div class="mb-3">
              <label class="form-label fw-semibold small d-block">PASS（治療結果可接受？）</label>
              <div class="btn-group" role="group">
                <button type="button"
                        :class="form.pass === 'Y' ? 'btn btn-success btn-sm' : 'btn btn-outline-success btn-sm'"
                        @click="form.pass = form.pass === 'Y' ? '' : 'Y'">Y 可接受</button>
                <button type="button"
                        :class="form.pass === 'N' ? 'btn btn-danger btn-sm' : 'btn btn-outline-danger btn-sm'"
                        @click="form.pass = form.pass === 'N' ? '' : 'N'">N 不滿意</button>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label fw-semibold small d-block">PGIC — 整體改善感（1=非常惡化 → 7=非常改善）</label>
              <div class="d-flex gap-1 flex-wrap">
                <button v-for="n in 7" :key="n" type="button"
                        :class="form.anchorQ === n ? 'btn btn-primary btn-sm' : 'btn btn-outline-secondary btn-sm'"
                        style="min-width:40px"
                        @click="form.anchorQ = form.anchorQ === n ? null : n">{{ n }}</button>
              </div>
              <div class="text-muted mt-1" style="font-size:.75rem">
                1 非常惡化 · 4 沒有變化 · 7 非常改善
              </div>
            </div>

            <div class="mb-4">
              <label class="form-label fw-semibold small">傷口狀況</label>
              <input v-model="form.woundStatus" type="text" class="form-control"
                     placeholder="例：傷口乾燥無滲液，縫線已拆除">
            </div>

            <button class="btn btn-primary px-4" :disabled="submitting" @click="submitRecord">
              <span v-if="submitting" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="bi bi-check-lg me-1"></i>
              儲存回診記錄
            </button>
          </div>
        </div>
      </Transition>

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
.sys-menu { position: relative; }
.sys-menu-dropdown {
  display: none; position: absolute; top: calc(100% + 6px); right: 0;
  background: #fff; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.15);
  padding: 6px 0; min-width: 170px; z-index: 1000;
}
.sys-menu:hover .sys-menu-dropdown { display: block; }
.sys-menu-dropdown div {
  padding: 6px 14px; font-size: .82rem; color: #333; white-space: nowrap;
}
.sys-menu-dropdown div + div { border-top: 1px solid #f0f4f8; }
.fade-enter-active, .fade-leave-active { transition: opacity .25s, transform .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(8px); }
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity .3s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }
</style>
