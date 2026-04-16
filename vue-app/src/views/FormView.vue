<script setup>
import { ref, reactive, onMounted } from 'vue'
import VasInput from '../components/VasInput.vue'
import { getFormOptions, addOperationRecord, addFollowUpRecord } from '../api/gas.js'

// ── 下拉選單資料 ───────────────────────────────────────
const opts = reactive({ patientIds: [], cageCodes: [], nextId: '', surgeons: [] })

const OP_TYPES   = ['TLIF', 'Endoscopic TLIF', 'PLIF', 'MIS-TLIF', 'MIDLIF', 'Decompression only', 'Others']
const BONE_GRAFTS = ['自體骨', '同種骨', '人工骨', '骨水泥', '無']
const GROUPS     = [
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

// ── Tab A：手術記錄 ────────────────────────────────────
const formA = reactive({
  researchId: '', chartNumber: '', opDate: today(), surgeon: '',
  opName: '', opLevels: '', cageCode: '', screwCode: '',
  boneGraft: '', otherImplant: '', complication: '',
  preVasBack: null, preVasLeg: null,
  preOdi: '', preSva: '', preCobb: '',
  opDuration: '', ebl: '',
  interventionGroup: 'line_bot'
})
const showAdvA    = ref(false)
const errA        = reactive({})
const loadingA    = ref(false)
const doneA       = ref(false)
const bindingCode = ref('')

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
    // 自動帶入 Tab B 的研究編號
    formB.researchId = formA.researchId
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
    opDuration: '', ebl: '', interventionGroup: 'line_bot'
  })
  Object.keys(errA).forEach(k => delete errA[k])
  doneA.value = false
  bindingCode.value = ''
}

// ── Tab B：術後追蹤 ────────────────────────────────────
const formB = reactive({
  researchId: '', vasBack: null, vasLeg: null,
  odiScore: '', pass: '', anchorQ: '', woundStatus: ''
})
const errB     = reactive({})
const loadingB = ref(false)
const doneB    = ref({ show: false, daysPostOp: null, odiScore: null })

function validateB() {
  Object.keys(errB).forEach(k => delete errB[k])
  if (!formB.researchId.trim())                  errB.researchId = '必填'
  if (formB.vasBack === null && formB.vasLeg === null) errB.vas = '背痛或腿痛至少填一項'
  return Object.keys(errB).length === 0
}

async function submitB() {
  if (!validateB()) return
  loadingB.value = true
  try {
    const res = await addFollowUpRecord({ ...formB })
    doneB.value = { show: true, daysPostOp: res.daysPostOp, odiScore: res.odiScore }
  } catch (e) {
    showToast(e.message, 'danger')
  } finally {
    loadingB.value = false
  }
}

function resetB() {
  Object.assign(formB, { researchId: '', vasBack: null, vasLeg: null,
    odiScore: '', pass: '', anchorQ: '', woundStatus: '' })
  Object.keys(errB).forEach(k => delete errB[k])
  doneB.value = { show: false, daysPostOp: null, odiScore: null }
}

// ── Toast ──────────────────────────────────────────────
const toast = ref({ show: false, msg: '', type: 'danger' })
let toastTimer = null
function showToast(msg, type = 'danger') {
  clearTimeout(toastTimer)
  toast.value = { show: true, msg, type }
  toastTimer = setTimeout(() => { toast.value.show = false }, 4000)
}

// ── LINE Bot QR ───────────────────────────────────────
const LINE_BOT_ID  = import.meta.env.VITE_LINE_BOT_ID || ''
const lineQrUrl    = LINE_BOT_ID ? `https://qr-official.line.me/sid/L/${LINE_BOT_ID}.png` : ''
const lineAddUrl   = LINE_BOT_ID ? `https://line.me/R/ti/p/@${LINE_BOT_ID}` : ''

// ── 工具 ──────────────────────────────────────────────
function today() {
  return new Date().toISOString().slice(0, 10)
}
</script>

<template>
  <div style="background:#f0f4f8; min-height:100vh; font-family:'Segoe UI',sans-serif">

    <!-- Navbar -->
    <nav class="navbar navbar-dark px-3 py-2" style="background:linear-gradient(135deg,#1a73e8,#0d47a1)">
      <span class="navbar-brand fw-bold">
        <i class="bi bi-pencil-square me-2"></i>脊椎追蹤系統
      </span>
      <div class="d-flex gap-2">
        <span class="text-white-50 small align-self-center">門診快速填表</span>
        <RouterLink to="/"          class="btn btn-outline-light btn-sm"><i class="bi bi-house me-1"></i>後台</RouterLink>
        <RouterLink to="/analytics" class="btn btn-outline-light btn-sm"><i class="bi bi-bar-chart-line me-1"></i>分析</RouterLink>
        <RouterLink to="/mcid"      class="btn btn-outline-light btn-sm"><i class="bi bi-graph-up-arrow me-1"></i>MCID</RouterLink>
      </div>
    </nav>

    <div class="container py-4" style="max-width:760px">

      <!-- Bootstrap Tabs -->
      <ul class="nav nav-tabs nav-fill mb-0" id="formTabs">
        <li class="nav-item">
          <button class="nav-link active fw-bold" id="tab-a-btn"
                  data-bs-toggle="tab" data-bs-target="#tab-a" type="button">
            <i class="bi bi-person-plus me-1"></i>Tab A — 新病患手術登錄
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link fw-bold" id="tab-b-btn"
                  data-bs-toggle="tab" data-bs-target="#tab-b" type="button">
            <i class="bi bi-clipboard-pulse me-1"></i>Tab B — 門診回診記錄
          </button>
        </li>
      </ul>

      <div class="tab-content">

        <!-- ══ TAB A ══════════════════════════════════════ -->
        <div class="tab-pane fade show active" id="tab-a">
          <div class="card border-0 rounded-top-0" style="border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
            <div class="card-body p-4">

              <!-- 送出成功畫面 -->
              <div v-if="doneA" class="py-3">
                <div class="text-center mb-3">
                  <i class="bi bi-check-circle-fill text-success" style="font-size:3rem"></i>
                  <div class="fs-5 fw-bold mt-3">手術記錄已儲存</div>
                  <div class="text-muted mt-1">{{ formA.researchId }}</div>
                </div>

                <!-- LINE 綁定碼（僅 line_bot / partial 組顯示）-->
                <div v-if="bindingCode" class="card border-0 mb-4"
                     style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #86efac!important">
                  <div class="card-body py-4">

                    <div class="d-flex align-items-center justify-content-center gap-2 mb-3">
                      <i class="bi bi-qr-code-scan text-success fs-4"></i>
                      <span class="fw-bold text-success fs-6">交給病患 — LINE 綁定說明</span>
                    </div>

                    <div class="row g-3 align-items-center">

                      <!-- 左：QR code -->
                      <div class="col-auto text-center">
                        <a v-if="lineQrUrl" :href="lineAddUrl" target="_blank">
                          <img :src="lineQrUrl" alt="LINE Bot QR Code"
                               style="width:110px;height:110px;border-radius:8px;border:2px solid #86efac">
                        </a>
                        <div class="text-muted" style="font-size:10px;margin-top:4px">掃我加好友</div>
                      </div>

                      <!-- 右：綁定碼 + 說明 -->
                      <div class="col">
                        <div class="text-muted small mb-1">步驟 ①  掃描左側 QR Code 加 LINE 好友</div>
                        <div class="text-muted small mb-2">步驟 ②  在對話框輸入以下綁定碼：</div>
                        <div class="d-flex align-items-center gap-2 mb-2">
                          <div class="fw-bold text-success"
                               style="font-size:2.2rem;letter-spacing:.3em;font-variant-numeric:tabular-nums">
                            {{ bindingCode }}
                          </div>
                          <button class="btn btn-outline-success btn-sm"
                                  @click="() => navigator.clipboard.writeText(bindingCode)"
                                  title="複製">
                            <i class="bi bi-clipboard"></i>
                          </button>
                        </div>
                        <div class="text-muted" style="font-size:11px">
                          <i class="bi bi-clock me-1"></i>有效期限 48 小時 · 限使用一次
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                <div class="d-flex justify-content-center gap-3">
                  <button class="btn btn-outline-secondary" @click="resetA">
                    <i class="bi bi-plus-circle me-1"></i>再新增一筆
                  </button>
                  <button class="btn btn-primary" @click="() => { resetA(); document.getElementById('tab-b-btn').click() }">
                    <i class="bi bi-clipboard-pulse me-1"></i>繼續填回診記錄
                  </button>
                </div>
              </div>

              <!-- 表單 -->
              <form v-else @submit.prevent="submitA" novalidate>

                <!-- 基本資料 -->
                <div class="section-label">基本資料</div>
                <div class="row g-3 mb-3">
                  <div class="col-sm-6">
                    <label class="form-label">研究編號 <span class="text-danger">*</span></label>
                    <input v-model="formA.researchId" type="text" class="form-control"
                           :class="{ 'is-invalid': errA.researchId }"
                           placeholder="SP-2026-001">
                    <div class="invalid-feedback">{{ errA.researchId }}</div>
                  </div>
                  <div class="col-sm-6">
                    <label class="form-label">病歷號</label>
                    <input v-model="formA.chartNumber" type="text" class="form-control"
                           placeholder="院內病歷號（選填）">
                    <div class="form-text">僅存於個資對照表，不進入研究資料</div>
                  </div>
                  <div class="col-sm-6">
                    <label class="form-label">手術日期 <span class="text-danger">*</span></label>
                    <input v-model="formA.opDate" type="date" class="form-control"
                           :class="{ 'is-invalid': errA.opDate }">
                    <div class="invalid-feedback">{{ errA.opDate }}</div>
                  </div>
                  <div class="col-sm-6">
                    <label class="form-label">主刀醫師</label>
                    <input v-model="formA.surgeon" type="text" class="form-control"
                           list="surgeonList" placeholder="輸入或選擇醫師">
                    <datalist id="surgeonList">
                      <option v-for="s in opts.surgeons" :key="s" :value="s" />
                    </datalist>
                  </div>
                  <div class="col-sm-6">
                    <label class="form-label">介入組別</label>
                    <select v-model="formA.interventionGroup" class="form-select">
                      <option v-for="g in GROUPS" :key="g.value" :value="g.value">{{ g.label }}</option>
                    </select>
                  </div>
                </div>

                <!-- 術式 -->
                <div class="section-label">術式</div>
                <div class="row g-3 mb-3">
                  <div class="col-sm-6">
                    <label class="form-label">手術類型 <span class="text-danger">*</span></label>
                    <select v-model="formA.opName" class="form-select"
                            :class="{ 'is-invalid': errA.opName }">
                      <option value="">請選擇</option>
                      <option v-for="t in OP_TYPES" :key="t" :value="t">{{ t }}</option>
                    </select>
                    <div class="invalid-feedback">{{ errA.opName }}</div>
                  </div>
                  <div class="col-sm-6">
                    <label class="form-label">手術節段</label>
                    <input v-model="formA.opLevels" type="text" class="form-control" placeholder="L4-L5">
                  </div>
                </div>

                <!-- 耗材 -->
                <div class="section-label">耗材</div>
                <div class="row g-3 mb-3">
                  <div class="col-sm-6">
                    <label class="form-label">Cage 代碼</label>
                    <input v-model="formA.cageCode" type="text" class="form-control"
                           list="cageList" placeholder="輸入或選擇">
                    <datalist id="cageList">
                      <option v-for="c in opts.cageCodes" :key="c" :value="c" />
                    </datalist>
                  </div>
                  <div class="col-sm-6">
                    <label class="form-label">骨移植</label>
                    <select v-model="formA.boneGraft" class="form-select">
                      <option value="">請選擇</option>
                      <option v-for="b in BONE_GRAFTS" :key="b" :value="b">{{ b }}</option>
                    </select>
                  </div>
                </div>

                <!-- 術前 VAS -->
                <div class="section-label">術前 VAS</div>
                <div class="mb-3">
                  <label class="form-label">背痛（0 = 不痛，10 = 最痛）</label>
                  <VasInput v-model="formA.preVasBack" />
                </div>
                <div class="mb-4">
                  <label class="form-label">腿痛 / 神經痛</label>
                  <VasInput v-model="formA.preVasLeg" />
                </div>

                <!-- 進階欄位（可展開） -->
                <button type="button" class="btn btn-link text-muted p-0 mb-3 small"
                        @click="showAdvA = !showAdvA">
                  <i :class="showAdvA ? 'bi bi-chevron-up' : 'bi bi-chevron-down'" class="me-1"></i>
                  {{ showAdvA ? '收合進階欄位' : '展開進階欄位（ODI、影像、耗材細節、手術時間）' }}
                </button>

                <div v-if="showAdvA" class="row g-3 mb-4">
                  <div class="col-sm-4">
                    <label class="form-label">術前 ODI</label>
                    <input v-model="formA.preOdi" type="number" min="0" max="100" class="form-control" placeholder="0-100">
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label">SVA (mm)</label>
                    <input v-model="formA.preSva" type="number" class="form-control">
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label">Cobb Angle (°)</label>
                    <input v-model="formA.preCobb" type="number" class="form-control">
                  </div>
                  <div class="col-sm-6">
                    <label class="form-label">Screw 代碼</label>
                    <input v-model="formA.screwCode" type="text" class="form-control">
                  </div>
                  <div class="col-sm-6">
                    <label class="form-label">其他耗材</label>
                    <input v-model="formA.otherImplant" type="text" class="form-control">
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label">手術時間 (min)</label>
                    <input v-model="formA.opDuration" type="number" min="0" class="form-control">
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label">失血量 EBL (mL)</label>
                    <input v-model="formA.ebl" type="number" min="0" class="form-control">
                  </div>
                  <div class="col-12">
                    <label class="form-label">術中併發症</label>
                    <input v-model="formA.complication" type="text" class="form-control" placeholder="無則留空">
                  </div>
                </div>

                <button type="submit" class="btn btn-primary w-100 py-2 fw-bold"
                        :disabled="loadingA">
                  <span v-if="loadingA" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="bi bi-save me-2"></i>
                  儲存手術記錄
                </button>
              </form>

            </div>
          </div>
        </div>

        <!-- ══ TAB B ══════════════════════════════════════ -->
        <div class="tab-pane fade" id="tab-b">
          <div class="card border-0 rounded-top-0" style="border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
            <div class="card-body p-4">

              <!-- 送出成功畫面 -->
              <div v-if="doneB.show" class="text-center py-4">
                <i class="bi bi-check-circle-fill text-success" style="font-size:3rem"></i>
                <div class="fs-5 fw-bold mt-3">回診記錄已儲存</div>
                <div class="text-muted mt-1">
                  {{ formB.researchId }} — 術後第 {{ doneB.daysPostOp }} 天
                </div>
                <div v-if="doneB.odiScore !== '' && doneB.odiScore !== null"
                     class="mt-2 badge bg-info fs-6">
                  ODI {{ doneB.odiScore }}%
                </div>
                <button class="btn btn-outline-secondary mt-4" @click="resetB">
                  <i class="bi bi-plus-circle me-1"></i>再新增一筆
                </button>
              </div>

              <!-- 表單 -->
              <form v-else @submit.prevent="submitB" novalidate>

                <!-- 病患選擇 -->
                <div class="section-label">病患</div>
                <div class="mb-4">
                  <label class="form-label">研究編號 <span class="text-danger">*</span></label>
                  <input v-model="formB.researchId" type="text" class="form-control form-control-lg"
                         :class="{ 'is-invalid': errB.researchId }"
                         list="patientList" placeholder="輸入或選擇研究編號">
                  <datalist id="patientList">
                    <option v-for="id in opts.patientIds" :key="id" :value="id" />
                  </datalist>
                  <div class="invalid-feedback">{{ errB.researchId }}</div>
                </div>

                <!-- VAS -->
                <div class="section-label">
                  VAS 疼痛評估
                  <span v-if="errB.vas" class="text-danger small ms-2">{{ errB.vas }}</span>
                </div>
                <div class="mb-3">
                  <label class="form-label">背痛</label>
                  <VasInput v-model="formB.vasBack" />
                </div>
                <div class="mb-4">
                  <label class="form-label">腿痛 / 神經痛</label>
                  <VasInput v-model="formB.vasLeg" />
                </div>

                <!-- ODI 評分 -->
                <div class="section-label">ODI 功能障礙指數</div>
                <div class="row g-3 mb-4">
                  <div class="col-sm-4">
                    <label class="form-label">ODI 分數 (0–100%)</label>
                    <input v-model="formB.odiScore" type="number" min="0" max="100"
                           class="form-control" placeholder="如：36">
                    <div class="form-text">0=無障礙，100=完全障礙</div>
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label">PASS（症狀可接受）</label>
                    <div class="btn-group w-100" role="group">
                      <input type="radio" class="btn-check" id="passY" v-model="formB.pass" value="Y">
                      <label class="btn btn-outline-success" for="passY">Y — 可接受</label>
                      <input type="radio" class="btn-check" id="passN" v-model="formB.pass" value="N">
                      <label class="btn btn-outline-danger"  for="passN">N — 不可接受</label>
                    </div>
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label">整體改善感受 (1–7)</label>
                    <select v-model="formB.anchorQ" class="form-select">
                      <option value="">請選擇</option>
                      <option value="1">1 — 差很多</option>
                      <option value="2">2 — 差一些</option>
                      <option value="3">3 — 稍微差</option>
                      <option value="4">4 — 沒變化</option>
                      <option value="5">5 — 稍微好</option>
                      <option value="6">6 — 好一些</option>
                      <option value="7">7 — 好很多</option>
                    </select>
                    <div class="form-text">PGIC 整體改變印象</div>
                  </div>
                  <div class="col-12">
                    <label class="form-label">傷口狀況</label>
                    <input v-model="formB.woundStatus" type="text" class="form-control"
                           placeholder="例：傷口乾燥無滲液，縫線已拆除">
                  </div>
                </div>

                <button type="submit" class="btn btn-success w-100 py-2 fw-bold"
                        :disabled="loadingB">
                  <span v-if="loadingB" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="bi bi-clipboard-check me-2"></i>
                  儲存回診記錄
                </button>

              </form>
            </div>
          </div>
        </div>

      </div><!-- /tab-content -->
    </div><!-- /container -->

    <!-- Toast -->
    <div class="position-fixed bottom-0 end-0 p-3" style="z-index:9000">
      <Transition name="fade">
        <div v-if="toast.show"
             :class="`toast show align-items-center text-white border-0 bg-${toast.type}`">
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
.section-label {
  font-size: .8rem; font-weight: 700; color: #1a73e8;
  text-transform: uppercase; letter-spacing: .05em;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 4px; margin-bottom: 12px; margin-top: 4px;
}
.fade-enter-active, .fade-leave-active { transition: opacity .3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
