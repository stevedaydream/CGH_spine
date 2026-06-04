<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import VasInput from '../components/VasInput.vue'
import { getFormOptions, addOperationRecord } from '../api/gas.js'

const opts = reactive({ patientIds: [], cageCodes: [], nextId: '', surgeons: [] })

const OP_TYPES    = ['TLIF', 'Endoscopic TLIF', 'PLIF', 'MIS-TLIF', 'MIDLIF', 'Decompression only', 'Others']
const BONE_GRAFTS = ['自體骨', '同種骨', '人工骨', '骨水泥', '無']
const GROUPS      = [
  { value: 'line_bot', label: 'Line Bot 組' },
  { value: 'control',  label: '對照組' },
  { value: 'partial',  label: '部分介入' }
]

onMounted(async () => {
  try {
    const data = await getFormOptions()
    opts.patientIds  = data.patientIds || []
    opts.cageCodes   = data.cageCodes  || []
    opts.nextId      = data.nextId     || ''
    opts.surgeons    = data.surgeons   || []
    formA.researchId = data.nextId     || ''
  } catch (_) {}
})

const formA = reactive({
  researchId: '', chartNumber: '', opDate: today(), surgeon: '',
  opName: '', opLevels: '', cageCode: '', screwCode: '',
  boneGraft: '', otherImplant: '', complication: '',
  preVasBack: null, preVasLeg: null,
  preOdi: '', preSva: '', preCobb: '',
  opDuration: '', ebl: '',
  interventionGroup: 'line_bot',
  // IRB 收案追蹤欄位
  isRetrospective: false,
  irbType: 'consent_survey', // 'consent_survey' | 'exempt' | 'none'
  hasIrbConsent: false,
  irbConsentDate: today()
})
const showAdvA    = ref(false)
const errA        = reactive({})
const loadingA    = ref(false)
const doneA       = ref(false)
const bindingCode = ref('')

// ── 術前 ODI 計算器 ────────────────────────────────────
const showOdiHelper = ref(false)
const odiAnswers = reactive(Array(10).fill(null))

const computedPreOdi = computed(() => {
  const answered = odiAnswers.filter(v => v !== null)
  if (answered.length === 0) return ''
  const sum = answered.reduce((a, b) => a + b, 0)
  return Math.round((sum / (answered.length * 5)) * 100)
})

watch(computedPreOdi, (newVal) => {
  if (newVal !== '') {
    formA.preOdi = newVal
  }
})

function validateA() {
  Object.keys(errA).forEach(k => delete errA[k])
  if (!formA.researchId.trim()) errA.researchId = '必填'
  if (!formA.opDate)            errA.opDate     = '必填'
  if (!formA.opName)            errA.opName     = '必填'
  return Object.keys(errA).length === 0
}

async function submitA() {
  if (!validateA()) return
  loadingA.value = true
  try {
    const res = await addOperationRecord({ ...formA })
    bindingCode.value = res.bindingCode || ''
    doneA.value = true
  } catch (e) {
    showToast(e.message, 'danger')
  } finally {
    loadingA.value = false
  }
}

function resetA() {
  Object.assign(formA, {
    researchId: opts.nextId, chartNumber: '', opDate: today(), surgeon: '',
    opName: '', opLevels: '', cageCode: '', screwCode: '',
    boneGraft: '', otherImplant: '', complication: '',
    preVasBack: null, preVasLeg: null,
    preOdi: '', preSva: '', preCobb: '',
    opDuration: '', ebl: '', interventionGroup: 'line_bot',
    isRetrospective: false,
    irbType: 'consent_survey',
    hasIrbConsent: false,
    irbConsentDate: today()
  })
  odiAnswers.fill(null)
  showOdiHelper.value = false
  Object.keys(errA).forEach(k => delete errA[k])
  doneA.value = false
  bindingCode.value = ''
}

const toast = ref({ show: false, msg: '', type: 'danger' })
let toastTimer = null
function showToast(msg, type = 'danger') {
  clearTimeout(toastTimer)
  toast.value = { show: true, msg, type }
  toastTimer = setTimeout(() => { toast.value.show = false }, 4000)
}

const LINE_BOT_ID = import.meta.env.VITE_LINE_BOT_ID || ''
const lineQrUrl   = LINE_BOT_ID ? `https://qr-official.line.me/sid/L/${LINE_BOT_ID}.png` : ''
const lineAddUrl  = LINE_BOT_ID ? `https://line.me/R/ti/p/@${LINE_BOT_ID}` : ''

function today() {
  return new Date().toISOString().slice(0, 10)
}
</script>

<template>
  <div style="background: var(--color-bg-base); min-height: 100vh; font-family: var(--font-family);">

    <!-- Navbar / Header -->
    <nav class="navbar navbar-expand-lg navbar-dark px-4 py-3 shadow-sm border-bottom" style="background: linear-gradient(135deg, var(--color-primary), #063e45);">
      <div class="container-fluid p-0 d-flex justify-content-between align-items-center">
        <span class="navbar-brand fw-bold fs-5 d-flex align-items-center">
          <i class="bi bi-person-plus me-2" aria-hidden="true"></i>脊椎手術智慧追蹤系統
        </span>
        <div class="d-flex gap-2 flex-wrap">
          <span class="text-white-50 small align-self-center me-2 tabular-nums">新增追蹤個案</span>
          <RouterLink to="/" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-house" aria-hidden="true"></i>儀表板
          </RouterLink>
          <RouterLink to="/clinic" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-clipboard2-pulse" aria-hidden="true"></i>回診登記
          </RouterLink>
          <RouterLink to="/analytics" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-bar-chart-line" aria-hidden="true"></i>分析
          </RouterLink>
          <RouterLink to="/mcid" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-graph-up-arrow" aria-hidden="true"></i>MCID
          </RouterLink>
          <RouterLink to="/irb" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-shield-check" aria-hidden="true"></i>IRB表單
          </RouterLink>
        </div>
      </div>
    </nav>

    <div class="container py-4" style="max-width: 780px;">
      <div class="clinical-card overflow-hidden">
        <div class="card-body p-4 bg-white">

          <!-- 送出成功畫面 -->
          <div v-if="doneA" class="py-3">
            <div class="text-center mb-4">
              <i class="bi bi-check-circle-fill text-success" style="font-size: 3.5rem;" aria-hidden="true"></i>
              <h2 class="fs-4 fw-bold mt-3" style="color: var(--color-primary);">手術個案登記已儲存</h2>
              <div class="text-muted font-monospace mt-1 font-semibold tabular-nums" style="font-size: 1.05rem;">{{ formA.researchId }}</div>
            </div>

            <!-- IRB 提示與指示 -->
            <div v-if="formA.irbType !== 'none'" class="alert alert-info border-0 p-3.5 rounded-3 mb-4 small d-flex gap-2" style="background-color: #ecfeff; border-left: 4px solid var(--color-accent) !important; color: #0891b2;">
              <i class="bi bi-info-circle-fill fs-5 mt-0.5" aria-hidden="true"></i>
              <div>
                <div class="fw-bold mb-1" style="color: var(--color-primary);">國泰綜合醫院 IRB 研究歸檔核對</div>
                <div class="small" v-if="formA.irbType === 'consent_survey'">
                  本個案採<strong>「項目 1-8-4 受試者同意書(問卷)」</strong>收案模式：
                  <ul class="mb-0 mt-1 ps-3.5">
                    <li v-if="!formA.isRetrospective">已啟動 LINE 端受試者電子同意書簽署程序。</li>
                    <li v-else>已確認取得紙本同意書（簽署日期：{{ formA.irbConsentDate }}），請將紙本同意書歸檔至研究專卷。</li>
                  </ul>
                </div>
                <div class="small" v-else-if="formA.irbType === 'exempt'">
                  本個案採<strong>「項目 11 免除審查 (免審案)」</strong>模式：
                  <div class="mt-1">請確保此項研究計畫已取得免審核准函，並妥善保管個資去識別化對照清單。</div>
                </div>
              </div>
            </div>
            <div v-if="bindingCode" class="border-0 mb-4 p-4 rounded-4 shadow-sm"
                 style="background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 1.5px solid #6ee7b7 !important;">
              <div class="d-flex align-items-center justify-content-center gap-2 mb-3">
                <i class="bi bi-qr-code-scan text-success fs-4" aria-hidden="true"></i>
                <span class="fw-bold text-success fs-6">臨床指示 — 個案 LINE 追蹤對接</span>
              </div>
              <div class="row g-3 align-items-center justify-content-center">
                <div class="col-12 col-sm-auto text-center">
                  <a v-if="lineQrUrl" :href="lineAddUrl" target="_blank" aria-label="打開 LINE 機器人連結">
                    <img :src="lineQrUrl" alt="LINE 機器人 QR 碼"
                         style="width: 120px; height: 120px; border-radius: 12px; border: 3px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.08)">
                  </a>
                  <div class="text-muted small mt-1.5" style="font-size: 0.72rem;">掃描加好友</div>
                </div>
                <div class="col-12 col-sm text-center text-sm-start ps-sm-4">
                  <div class="text-muted small mb-1">步驟 ①：請個案掃描 QR Code 加入 LINE 官方帳號</div>
                  <div class="text-muted small mb-2">步驟 ②：在 LINE 對話框輸入此 6 位驗證碼：</div>
                  <div class="d-flex align-items-center justify-content-center justify-content-sm-start gap-2.5 mb-2">
                    <div class="fw-bold text-success font-monospace tabular-nums"
                         style="font-size: 2.4rem; letter-spacing: .25em; line-height: 1.1;">
                      {{ bindingCode }}
                    </div>
                    <button class="btn btn-outline-success btn-sm px-2.5 py-1.5"
                            @click="navigator.clipboard.writeText(bindingCode)"
                            aria-label="複製驗證碼"
                            title="複製驗證碼">
                      <i class="bi bi-clipboard" aria-hidden="true"></i>
                    </button>
                  </div>
                  <div class="text-muted font-semibold small" style="font-size: 0.75rem;">
                    <i class="bi bi-clock-fill me-1" aria-hidden="true"></i>驗證碼將於 48 小時後過期，且限使用一次
                  </div>
                </div>
              </div>
            </div>

            <div class="d-flex justify-content-center gap-3 flex-wrap">
              <button class="btn btn-outline-secondary px-4 py-2" @click="resetA">
                <i class="bi bi-plus-circle me-1" aria-hidden="true"></i>再登錄一筆新個案
              </button>
              <RouterLink to="/clinic" class="btn btn-primary px-4 py-2 fw-semibold">
                <i class="bi bi-clipboard2-pulse me-1" aria-hidden="true"></i>前往診間回診登記
              </RouterLink>
            </div>
          </div>

          <!-- 手術登記表單 -->
          <form v-else @submit.prevent="submitA" novalidate autocomplete="off">

            <!-- 基本資料 -->
            <div class="section-label">基本個案資料</div>
            <div class="row g-3 mb-4">
              <div class="col-sm-6">
                <label for="researchId" class="form-label-clinical mb-2">研究編號 <span class="text-danger">*</span></label>
                <input v-model="formA.researchId" type="text" id="researchId"
                       class="form-control focus-ring font-monospace"
                       :class="{ 'is-invalid': errA.researchId }"
                       placeholder="如：SP-2026-001">
                <div class="invalid-feedback">{{ errA.researchId }}</div>
              </div>
              <div class="col-sm-6">
                <label for="chartNumber" class="form-label-clinical mb-2">病歷號</label>
                <input v-model="formA.chartNumber" type="text" id="chartNumber"
                       class="form-control focus-ring font-monospace"
                       placeholder="院內病歷號（選填）">
                <div class="form-text small text-muted mt-1">僅存於加密個資對照表，不進入公開研究資料庫</div>
              </div>
              <div class="col-sm-6">
                <label for="opDate" class="form-label-clinical mb-2">手術日期 <span class="text-danger">*</span></label>
                <input v-model="formA.opDate" type="date" id="opDate"
                       class="form-control focus-ring tabular-nums"
                       :class="{ 'is-invalid': errA.opDate }">
                <div class="invalid-feedback">{{ errA.opDate }}</div>
              </div>
              <div class="col-sm-6">
                <label for="surgeon" class="form-label-clinical mb-2">主刀醫師</label>
                <input v-model="formA.surgeon" type="text" id="surgeon"
                       class="form-control focus-ring"
                       list="surgeonList" placeholder="輸入或下拉選擇醫師">
                <datalist id="surgeonList">
                  <option v-for="s in opts.surgeons" :key="s" :value="s" />
                </datalist>
              </div>
              <div class="col-sm-6">
                <label for="interventionGroup" class="form-label-clinical mb-2">研究介入組別</label>
                <select v-model="formA.interventionGroup" id="interventionGroup" class="form-select focus-ring">
                  <option v-for="g in GROUPS" :key="g.value" :value="g.value">{{ g.label }}</option>
                </select>
              </div>
              <div class="col-sm-6">
                <label for="isRetrospective" class="form-label-clinical mb-2">收案模式</label>
                <select v-model="formA.isRetrospective" id="isRetrospective" class="form-select focus-ring">
                  <option :value="false">新收案 (Prospective - LINE 電子同意書)</option>
                  <option :value="true">補登舊個案 (Retrospective - 診間簽署)</option>
                </select>
              </div>
              <div class="col-sm-6">
                <label for="irbType" class="form-label-clinical mb-2">國泰 IRB 審查文件對照</label>
                <select v-model="formA.irbType" id="irbType" class="form-select focus-ring">
                  <option value="consent_survey">項目 1-8-4 受試者同意書(問卷)</option>
                  <option value="exempt">項目 11 免除審查案 (免審)</option>
                  <option value="none">無 (不申請/一般追蹤)</option>
                </select>
              </div>
              <div class="col-sm-6" v-if="formA.irbType !== 'none'">
                <div class="form-check mt-4">
                  <input v-model="formA.hasIrbConsent" type="checkbox" id="hasIrbConsent" class="form-check-input focus-ring">
                  <label for="hasIrbConsent" class="form-check-label small fw-bold text-teal">
                    已確認取得受試者同意書簽署
                  </label>
                </div>
              </div>
              <div class="col-sm-6" v-if="formA.irbType !== 'none' && formA.hasIrbConsent">
                <label for="irbConsentDate" class="form-label-clinical mb-2">同意書簽署日期</label>
                <input v-model="formA.irbConsentDate" type="date" id="irbConsentDate" class="form-control focus-ring tabular-nums">
              </div>
            </div>

            <!-- 手術與術式 -->
            <div class="section-label">手術與術式</div>
            <div class="row g-3 mb-4">
              <div class="col-sm-6">
                <label for="opName" class="form-label-clinical mb-2">手術類型 <span class="text-danger">*</span></label>
                <select v-model="formA.opName" id="opName" class="form-select focus-ring"
                        :class="{ 'is-invalid': errA.opName }">
                  <option value="">請選擇手術方式</option>
                  <option v-for="t in OP_TYPES" :key="t" :value="t">{{ t }}</option>
                </select>
                <div class="invalid-feedback">{{ errA.opName }}</div>
              </div>
              <div class="col-sm-6">
                <label for="opLevels" class="form-label-clinical mb-2">手術節段</label>
                <input v-model="formA.opLevels" type="text" id="opLevels"
                       class="form-control focus-ring font-monospace" placeholder="例如：L4-L5">
              </div>
            </div>

            <!-- 耗材與移植 -->
            <div class="section-label">手術使用耗材</div>
            <div class="row g-3 mb-4">
              <div class="col-sm-6">
                <label for="cageCode" class="form-label-clinical mb-2">Cage 耗材代碼</label>
                <input v-model="formA.cageCode" type="text" id="cageCode"
                       class="form-control focus-ring font-monospace"
                       list="cageList" placeholder="輸入或下拉選擇">
                <datalist id="cageList">
                  <option v-for="c in opts.cageCodes" :key="c" :value="c" />
                </datalist>
              </div>
              <div class="col-sm-6">
                <label for="boneGraft" class="form-label-clinical mb-2">骨移植方式</label>
                <select v-model="formA.boneGraft" id="boneGraft" class="form-select focus-ring">
                  <option value="">請選擇移植類型</option>
                  <option v-for="b in BONE_GRAFTS" :key="b" :value="b">{{ b }}</option>
                </select>
              </div>
            </div>

            <!-- 術前 VAS 基線 -->
            <div class="section-label">術前 Baseline 疼痛評分</div>
            <div class="mb-4">
              <span class="form-label-clinical d-block mb-2">術前 VAS 背部疼痛 (0–10)</span>
              <VasInput v-model="formA.preVasBack" />
            </div>
            <div class="mb-4">
              <span class="form-label-clinical d-block mb-2">術前 VAS 腿部/神經疼痛 (0–10)</span>
              <VasInput v-model="formA.preVasLeg" />
            </div>

            <!-- 進階欄位 -->
            <div class="mb-4">
              <button type="button" class="btn btn-link text-decoration-none p-0 mb-3 small d-flex align-items-center gap-1.5 fw-bold"
                      style="color: var(--color-primary);"
                      @click="showAdvA = !showAdvA"
                      :aria-expanded="showAdvA"
                      aria-controls="advFields">
                <i :class="showAdvA ? 'bi bi-chevron-up' : 'bi bi-chevron-down'" aria-hidden="true"></i>
                {{ showAdvA ? '收起進階欄位' : '展開進階研究欄位（ODI、X光影像、其他耗材、手術時長與失血量）' }}
              </button>

              <Transition name="fade">
                <div v-if="showAdvA" id="advFields" class="row g-3 p-3.5 rounded-4 bg-light-surface border shadow-inner">
                  <div class="col-sm-4">
                    <label for="preOdi" class="form-label-clinical mb-2">術前 ODI 殘疾指數 %</label>
                    <div class="d-flex gap-2">
                      <div class="input-group input-group-sm">
                        <input v-model="formA.preOdi" type="number" min="0" max="100" id="preOdi" class="form-control focus-ring tabular-nums" placeholder="0-100">
                        <span class="input-group-text bg-white text-muted fw-bold">%</span>
                      </div>
                      <button type="button" class="btn btn-outline-teal btn-sm text-nowrap" @click="showOdiHelper = !showOdiHelper">
                        <i class="bi bi-calculator" aria-hidden="true"></i> {{ showOdiHelper ? '收起' : '計算器' }}
                      </button>
                    </div>
                  </div>

                  <!-- ODI 試算工具面版 -->
                  <div class="col-12" v-if="showOdiHelper">
                    <div class="p-3.5 rounded-3 border bg-white shadow-sm">
                      <div class="fw-bold small text-teal mb-2.5 d-flex align-items-center justify-content-between">
                        <span><i class="bi bi-calculator-fill me-1" aria-hidden="true"></i>術前紙本 ODI 問卷快速登記（自動轉換）</span>
                        <span class="badge bg-secondary font-monospace tabular-nums">已填寫 {{ odiAnswers.filter(v => v !== null).length }} / 10 題</span>
                      </div>
                      <div class="row g-2">
                        <div v-for="q in 10" :key="q" class="col-12 col-sm-6 d-flex align-items-center justify-content-between gap-2 border-bottom py-1.5">
                          <span class="small text-muted text-truncate" style="max-width: 180px;">Q{{ q }} 面向評估分數</span>
                          <select v-model.number="odiAnswers[q-1]" class="form-select form-select-sm focus-ring" style="width: 110px;">
                            <option :value="null">未填寫 (N/A)</option>
                            <option v-for="val in 6" :key="val-1" :value="val-1">{{ val-1 }} 分</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="col-sm-4">
                    <label for="preSva" class="form-label-clinical mb-2">術前 SVA (mm)</label>
                    <input v-model="formA.preSva" type="number" id="preSva" class="form-control form-control-sm focus-ring tabular-nums" placeholder="公釐">
                  </div>
                  <div class="col-sm-4">
                    <label for="preCobb" class="form-label-clinical mb-2">術前 Cobb Angle (°)</label>
                    <input v-model="formA.preCobb" type="number" id="preCobb" class="form-control form-control-sm focus-ring tabular-nums" placeholder="角度">
                  </div>
                  <div class="col-sm-6">
                    <label for="screwCode" class="form-label-clinical mb-2">Screw 釘類代碼</label>
                    <input v-model="formA.screwCode" type="text" id="screwCode" class="form-control form-control-sm focus-ring font-monospace">
                  </div>
                  <div class="col-sm-6">
                    <label for="otherImplant" class="form-label-clinical mb-2">其他置入耗材</label>
                    <input v-model="formA.otherImplant" type="text" id="otherImplant" class="form-control form-control-sm focus-ring">
                  </div>
                  <div class="col-sm-4">
                    <label for="opDuration" class="form-label-clinical mb-2">手術時長 (min)</label>
                    <input v-model="formA.opDuration" type="number" min="0" id="opDuration" class="form-control form-control-sm focus-ring tabular-nums" placeholder="分鐘">
                  </div>
                  <div class="col-sm-4">
                    <label for="ebl" class="form-label-clinical mb-2">術中估計失血量 EBL (mL)</label>
                    <input v-model="formA.ebl" type="number" min="0" id="ebl" class="form-control form-control-sm focus-ring tabular-nums" placeholder="毫升">
                  </div>
                  <div class="col-12">
                    <label for="complication" class="form-label-clinical mb-2">術中併發症紀錄</label>
                    <input v-model="formA.complication" type="text" id="complication" class="form-control form-control-sm focus-ring" placeholder="如無併發症，請保留空白">
                  </div>
                </div>
              </Transition>
            </div>

            <button type="submit" class="btn btn-primary w-100 py-2.5 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                    :disabled="loadingA">
              <span v-if="loadingA" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              <i v-else class="bi bi-save" aria-hidden="true"></i>
              儲存並登錄手術記錄
            </button>

          </form>

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
.section-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: .06em;
  border-bottom: 2px solid var(--color-border);
  padding-bottom: 6px;
  margin-bottom: 16px;
  margin-top: 8px;
}

.form-label-clinical {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-primary);
}

.bg-light-surface {
  background-color: var(--color-bg-base);
}

/* CSS focus rings */
.focus-ring:focus {
  border-color: var(--color-accent) !important;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.25) !important;
  outline: none !important;
}

/* Transitions */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
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
</style>
