<script setup>
import { ref, reactive, onMounted } from 'vue'
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
  <div style="background:#f0f4f8; min-height:100vh; font-family:'Segoe UI',sans-serif">

    <!-- Navbar -->
    <nav class="navbar navbar-dark px-3 py-2" style="background:linear-gradient(135deg,#1a73e8,#0d47a1)">
      <span class="navbar-brand fw-bold">
        <i class="bi bi-person-plus me-2"></i>脊椎追蹤系統
      </span>
      <div class="d-flex gap-2">
        <span class="text-white-50 small align-self-center">新增追蹤個案</span>
        <RouterLink to="/"          class="btn btn-outline-light btn-sm"><i class="bi bi-house me-1"></i>後台</RouterLink>
        <RouterLink to="/clinic"    class="btn btn-outline-light btn-sm"><i class="bi bi-clipboard2-pulse me-1"></i>回診登記</RouterLink>
        <RouterLink to="/analytics" class="btn btn-outline-light btn-sm"><i class="bi bi-bar-chart-line me-1"></i>分析</RouterLink>
        <RouterLink to="/mcid"      class="btn btn-outline-light btn-sm"><i class="bi bi-graph-up-arrow me-1"></i>MCID</RouterLink>
      </div>
    </nav>

    <div class="container py-4" style="max-width:760px">
      <div class="card border-0" style="border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <div class="card-body p-4">

          <!-- 送出成功畫面 -->
          <div v-if="doneA" class="py-3">
            <div class="text-center mb-3">
              <i class="bi bi-check-circle-fill text-success" style="font-size:3rem"></i>
              <div class="fs-5 fw-bold mt-3">手術記錄已儲存</div>
              <div class="text-muted mt-1">{{ formA.researchId }}</div>
            </div>

            <!-- LINE 綁定碼 -->
            <div v-if="bindingCode" class="card border-0 mb-4"
                 style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #86efac!important">
              <div class="card-body py-4">
                <div class="d-flex align-items-center justify-content-center gap-2 mb-3">
                  <i class="bi bi-qr-code-scan text-success fs-4"></i>
                  <span class="fw-bold text-success fs-6">交給病患 — LINE 綁定說明</span>
                </div>
                <div class="row g-3 align-items-center">
                  <div class="col-auto text-center">
                    <a v-if="lineQrUrl" :href="lineAddUrl" target="_blank">
                      <img :src="lineQrUrl" alt="LINE Bot QR Code"
                           style="width:110px;height:110px;border-radius:8px;border:2px solid #86efac">
                    </a>
                    <div class="text-muted" style="font-size:10px;margin-top:4px">掃我加好友</div>
                  </div>
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
              <RouterLink to="/clinic" class="btn btn-primary">
                <i class="bi bi-clipboard-pulse me-1"></i>前往回診登記
              </RouterLink>
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
