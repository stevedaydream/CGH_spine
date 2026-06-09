<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import {
  getLineReply, saveLineReply, deleteLineReply,
  getHealthEdu, saveHealthEdu, deleteHealthEdu,
  getImplants, saveImplant, deleteImplant
} from '../api/gas.js'

// ── Toast ──────────────────────────────────────────────────
const toast = ref({ show: false, msg: '', type: 'success' })
let toastTimer = null
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer)
  toast.value = { show: true, msg, type }
  toastTimer = setTimeout(() => { toast.value.show = false }, 3000)
}

// ─────────────────────────────────────────────────────────
// Tab 狀態
// ─────────────────────────────────────────────────────────
const mainTab    = ref('bot')   // 'bot' | 'edu' | 'implant'
const botSubTab  = ref('sys')   // 'sys' | 'kw'

// ─────────────────────────────────────────────────────────
// Tab 1：LINE Bot 回覆設定
// ─────────────────────────────────────────────────────────
const replyItems  = ref([])
const replyLoading = ref(false)

const sysItems = computed(() =>
  replyItems.value.filter(r => r.group === '系統訊息' || r.group === '問卷步驟')
)
const kwItems = computed(() =>
  replyItems.value.filter(r => r.group === '自訂關鍵字')
)

async function loadReply() {
  replyLoading.value = true
  try {
    const data = await getLineReply()
    replyItems.value = data.items || []
  } catch (e) {
    showToast('載入失敗：' + e.message, 'danger')
  } finally {
    replyLoading.value = false
  }
}

// ── 系統訊息 Modal ──────────────────────────────────────
const showSysModal = ref(false)
const sysSaving    = ref(false)
const sysForm = reactive({ id: '', group: '', key: '', triggers: '', content: '', active: true, note: '' })

function openSysEdit(item) {
  Object.assign(sysForm, { ...item })
  showSysModal.value = true
}

async function saveSys() {
  sysSaving.value = true
  try {
    await saveLineReply({ ...sysForm })
    showSysModal.value = false
    await loadReply()
    showToast('已儲存 ✅')
  } catch (e) {
    showToast('儲存失敗：' + e.message, 'danger')
  } finally {
    sysSaving.value = false
  }
}

// placeholder 說明
const PLACEHOLDER_NOTES = {
  binding_success:       '可使用：{researchId}',
  binding_fail:          '可使用：{reason}',
  questionnaire_complete:'可使用：{daysPostOp}、{vasBack}、{vasLeg}、{odiScore}',
  questionnaire_paused:  '可使用：{progress}、{total}、{preview}'
}

// ── 自訂關鍵字 Modal ─────────────────────────────────────
const showKwModal = ref(false)
const kwSaving    = ref(false)
const isKwEdit    = ref(false)
const kwForm = reactive({ id: '', triggers: '', content: '', active: true })

function openKwAdd() {
  isKwEdit.value = false
  Object.assign(kwForm, { id: '', triggers: '', content: '', active: true })
  showKwModal.value = true
}

function openKwEdit(item) {
  isKwEdit.value = true
  Object.assign(kwForm, { id: item.id, triggers: item.triggers, content: item.content, active: item.active })
  showKwModal.value = true
}

async function saveKw() {
  if (!kwForm.triggers.trim() || !kwForm.content.trim()) {
    showToast('關鍵字與回覆內容為必填', 'danger')
    return
  }
  kwSaving.value = true
  try {
    await saveLineReply({ ...kwForm })
    showKwModal.value = false
    await loadReply()
    showToast(isKwEdit.value ? '已更新 ✅' : '已新增 ✅')
  } catch (e) {
    showToast('儲存失敗：' + e.message, 'danger')
  } finally {
    kwSaving.value = false
  }
}

async function removeKw(item) {
  if (!confirm(`確定刪除關鍵字「${item.triggers}」的規則？`)) return
  try {
    await deleteLineReply(item.id)
    await loadReply()
    showToast('已刪除')
  } catch (e) {
    showToast('刪除失敗：' + e.message, 'danger')
  }
}

async function toggleReply(item) {
  try {
    await saveLineReply({ ...item, active: !item.active })
    await loadReply()
  } catch (e) {
    showToast('更新失敗：' + e.message, 'danger')
  }
}

// 解析 triggers 字串為 badges
function triggerBadges(triggers) {
  return triggers ? triggers.split(',').map(k => k.trim()).filter(Boolean) : []
}

// ─────────────────────────────────────────────────────────
// Tab 2：衛教 QA 管理
// ─────────────────────────────────────────────────────────
const eduItems    = ref([])
const eduLoading  = ref(false)
const selectedCat = ref('全部')

const categories = computed(() => {
  const cats = [...new Set(eduItems.value.map(q => q.category).filter(Boolean))].sort()
  return cats
})
const filtered = computed(() => {
  const list = selectedCat.value === '全部'
    ? eduItems.value
    : eduItems.value.filter(q => q.category === selectedCat.value)
  return [...list].sort((a, b) => a.displayOrder - b.displayOrder)
})

async function loadEdu() {
  eduLoading.value = true
  try {
    const data = await getHealthEdu()
    eduItems.value = data.items || []
  } catch (e) {
    showToast('載入失敗：' + e.message, 'danger')
  } finally {
    eduLoading.value = false
  }
}

const showEduModal = ref(false)
const isEduEdit    = ref(false)
const eduSaving    = ref(false)
const eduForm = reactive({
  id: '', category: '', question: '', answer: '',
  videoUrl: '', pdfUrl: '', active: true, displayOrder: 0,
  daysFrom: '', daysTo: ''
})

function openEduAdd() {
  isEduEdit.value = false
  Object.assign(eduForm, {
    id: '', category: selectedCat.value !== '全部' ? selectedCat.value : '',
    question: '', answer: '', videoUrl: '', pdfUrl: '', active: true,
    displayOrder: filtered.value.length + 1, daysFrom: '', daysTo: ''
  })
  showEduModal.value = true
}

function openEduEdit(qa) {
  isEduEdit.value = true
  Object.assign(eduForm, {
    id: qa.id, category: qa.category, question: qa.question, answer: qa.answer,
    videoUrl: qa.videoUrl || '', pdfUrl: qa.pdfUrl || '', active: qa.active,
    displayOrder: qa.displayOrder,
    daysFrom: qa.daysFrom !== '' && qa.daysFrom != null ? qa.daysFrom : '',
    daysTo:   qa.daysTo   !== '' && qa.daysTo   != null ? qa.daysTo   : ''
  })
  showEduModal.value = true
}

async function submitEdu() {
  if (!eduForm.category.trim() || !eduForm.question.trim() || !eduForm.answer.trim()) {
    showToast('類別、問題、答案為必填', 'danger'); return
  }
  eduSaving.value = true
  try {
    await saveHealthEdu({ ...eduForm })
    showEduModal.value = false
    await loadEdu()
    showToast(isEduEdit.value ? '已更新 ✅' : '已新增 ✅')
  } catch (e) {
    showToast('儲存失敗：' + e.message, 'danger')
  } finally {
    eduSaving.value = false
  }
}

async function removeEdu(qa) {
  if (!confirm(`確定刪除「${qa.question}」？`)) return
  try {
    await deleteHealthEdu(qa.id)
    await loadEdu()
    showToast('已刪除')
  } catch (e) {
    showToast('刪除失敗：' + e.message, 'danger')
  }
}

async function toggleEdu(qa) {
  try {
    await saveHealthEdu({ ...qa, active: !qa.active })
    await loadEdu()
  } catch (e) {
    showToast('更新失敗：' + e.message, 'danger')
  }
}

function daysLabel(qa) {
  if (qa.daysFrom === '' && qa.daysTo === '') return '不限'
  if (qa.daysFrom !== '' && qa.daysTo !== '') return `D${qa.daysFrom}–D${qa.daysTo}`
  if (qa.daysFrom !== '') return `D${qa.daysFrom} 起`
  return `至 D${qa.daysTo}`
}

// ─────────────────────────────────────────────────────────
// Tab 3：耗材管理
// ─────────────────────────────────────────────────────────
const IMPLANT_CATS   = ['Cage', 'Screw', 'Bone Graft', 'Cement']
const implants       = ref([])
const implantLoading = ref(false)
const showImplantModal = ref(false)
const isImplantEdit    = ref(false)
const implantSaving    = ref(false)
const implantForm = reactive({ code: '', name: '', category: 'Cage', brand: '', note: '' })

async function loadImplants() {
  implantLoading.value = true
  try {
    const data = await getImplants()
    implants.value = data.items || []
  } catch (e) {
    showToast('載入耗材失敗：' + e.message, 'danger')
  } finally {
    implantLoading.value = false
  }
}

function openImplantAdd() {
  isImplantEdit.value = false
  Object.assign(implantForm, { code: '', name: '', category: 'Cage', brand: '', note: '' })
  showImplantModal.value = true
}

function openImplantEdit(item) {
  isImplantEdit.value = true
  Object.assign(implantForm, { ...item })
  showImplantModal.value = true
}

async function submitImplant() {
  if (!implantForm.code.trim() || !implantForm.category) {
    showToast('耗材代碼與類別為必填', 'danger'); return
  }
  implantSaving.value = true
  try {
    await saveImplant({ ...implantForm })
    showImplantModal.value = false
    await loadImplants()
    showToast(isImplantEdit.value ? '已更新 ✅' : '已新增 ✅')
  } catch (e) {
    showToast('儲存失敗：' + e.message, 'danger')
  } finally {
    implantSaving.value = false
  }
}

async function removeImplant(item) {
  if (!confirm(`確定刪除耗材「${item.code}」？`)) return
  try {
    await deleteImplant(item.code)
    await loadImplants()
    showToast('已刪除')
  } catch (e) {
    showToast('刪除失敗：' + e.message, 'danger')
  }
}

// ─────────────────────────────────────────────────────────
onMounted(() => { loadReply(); loadEdu(); loadImplants() })
</script>

<template>
  <div style="background: var(--color-bg-base); min-height: 100vh; font-family: var(--font-family);">

    <div class="container-fluid py-4 px-4 max-width-xl">

      <!-- 頁面標題 -->
      <div class="mb-4">
        <h1 class="h3 fw-bold text-teal m-0" style="color: var(--color-primary);">系統管理與設定</h1>
        <p class="text-muted small m-0 mt-1">設定 LINE 機器人自動回覆、衛教 QA 與耗材模組</p>
      </div>

      <!-- 主 Tab 切換器 -->
      <div class="card mb-4 border-0 shadow-sm" style="border-radius: 12px; background: #fff;">
        <div class="card-body p-2 d-flex gap-2 flex-wrap">
          <button class="btn btn-sm px-4 py-2.5 fw-bold d-flex align-items-center gap-2 transition-btn"
                  :class="mainTab === 'bot' ? 'btn-primary shadow-sm' : 'btn-light text-muted'"
                  @click="mainTab = 'bot'">
            <i class="bi bi-robot" aria-hidden="true"></i>LINE Bot 回覆設定
          </button>
          <button class="btn btn-sm px-4 py-2.5 fw-bold d-flex align-items-center gap-2 transition-btn"
                  :class="mainTab === 'edu' ? 'btn-primary shadow-sm' : 'btn-light text-muted'"
                  @click="mainTab = 'edu'">
            <i class="bi bi-journal-medical" aria-hidden="true"></i>衛教 QA 管理
          </button>
          <button class="btn btn-sm px-4 py-2.5 fw-bold d-flex align-items-center gap-2 transition-btn"
                  :class="mainTab === 'implant' ? 'btn-primary shadow-sm' : 'btn-light text-muted'"
                  @click="mainTab = 'implant'">
            <i class="bi bi-box-seam" aria-hidden="true"></i>耗材管理
          </button>
        </div>
      </div>

      <!-- ════════════════════════════════════════
           Tab 1：LINE Bot 回覆設定
      ════════════════════════════════════════ -->
      <div v-show="mainTab === 'bot'">

        <!-- 統計與快捷區 -->
        <div class="row g-3 mb-4">
          <div class="col-6 col-sm-auto">
            <div class="clinical-card px-4 py-2.5 d-flex align-items-center justify-content-between gap-3">
              <div>
                <div class="text-muted small">系統訊息</div>
                <div class="fw-bold fs-5 text-teal tabular-nums" style="color: var(--color-primary);">{{ sysItems.length }}</div>
              </div>
            </div>
          </div>
          <div class="col-6 col-sm-auto">
            <div class="clinical-card px-4 py-2.5 d-flex align-items-center justify-content-between gap-3">
              <div>
                <div class="text-muted small">自訂關鍵字</div>
                <div class="fw-bold fs-5 text-success tabular-nums">{{ kwItems.length }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 子分頁按鈕 -->
        <div class="d-flex gap-2 mb-3">
          <button class="btn btn-sm px-3.5 py-2 fw-semibold transition-btn"
                  :class="botSubTab === 'sys' ? 'btn-teal text-white' : 'btn-outline-secondary text-secondary border-dashed'"
                  @click="botSubTab = 'sys'">系統訊息 / 問卷步驟</button>
          <button class="btn btn-sm px-3.5 py-2 fw-semibold transition-btn"
                  :class="botSubTab === 'kw' ? 'btn-teal text-white' : 'btn-outline-secondary text-secondary border-dashed'"
                  @click="botSubTab = 'kw'">自訂關鍵字規則</button>
        </div>

        <!-- 子分頁 1：系統訊息 -->
        <div v-show="botSubTab === 'sys'">
          <div v-if="replyLoading" class="text-center text-muted py-5">
            <div class="spinner-border text-teal mb-2" role="status">
              <span class="visually-hidden">載入中…</span>
            </div>
            <div>載入系統訊息設定中…</div>
          </div>
          <div v-else class="clinical-card overflow-hidden">
            <div class="table-responsive">
              <table class="clinical-table mb-0" style="font-size: .88rem;">
                <thead>
                  <tr>
                    <th scope="col" style="width: 100px;">群組</th>
                    <th scope="col" style="width: 180px;">用途說明</th>
                    <th scope="col" style="width: 220px;">觸發條件 / 關鍵字</th>
                    <th scope="col">回覆內容預覽</th>
                    <th scope="col" style="width: 80px;">狀態</th>
                    <th scope="col" style="width: 80px; text-align: right;">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in sysItems" :key="item.id" :style="!item.active ? 'opacity: 0.55;' : ''">
                    <td>
                      <span class="badge"
                            :style="item.group === '問卷步驟' ? 'background: #e0f2fe; color: #0369a1;' : 'background: var(--color-primary-light); color: var(--color-primary);'">
                        {{ item.group }}
                      </span>
                    </td>
                    <td><strong>{{ item.note || item.key }}</strong></td>
                    <td>
                      <div v-if="triggerBadges(item.triggers).length" class="d-flex flex-wrap gap-1">
                        <span v-for="kw in triggerBadges(item.triggers)" :key="kw"
                              class="badge bg-secondary px-2 py-1 font-monospace" style="font-size: .75rem;">{{ kw }}</span>
                      </div>
                      <span v-else class="text-muted small">（系統事件觸發）</span>
                    </td>
                    <td class="text-muted small">
                      <div class="text-truncate-clinical" style="max-width: 320px;" :title="item.content">
                        {{ item.content }}
                      </div>
                    </td>
                    <td>
                      <div class="form-check form-switch mb-0">
                        <input class="form-check-input focus-ring" type="checkbox"
                               :checked="item.active" @change="toggleReply(item)"
                               :aria-label="`啟用或停用 ${item.note || item.key}`">
                      </div>
                    </td>
                    <td style="text-align: right;">
                      <button class="btn btn-outline-primary btn-sm p-1.5" @click="openSysEdit(item)" aria-label="編輯系統訊息">
                        <i class="bi bi-pencil" aria-hidden="true"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 子分頁 2：自訂關鍵字 -->
        <div v-show="botSubTab === 'kw'">
          <div class="d-flex justify-content-end mb-3">
            <button class="btn btn-success px-3.5 py-2 d-flex align-items-center gap-1.5 fw-semibold shadow-sm" @click="openKwAdd">
              <i class="bi bi-plus-circle" aria-hidden="true"></i>新增關鍵字規則
            </button>
          </div>
          <div v-if="replyLoading" class="text-center text-muted py-5">
            <div class="spinner-border text-teal mb-2" role="status">
              <span class="visually-hidden">載入中…</span>
            </div>
            <div>載入關鍵字規則中…</div>
          </div>
          <div v-else-if="kwItems.length === 0" class="text-center text-muted py-5 clinical-card bg-white">
            <i class="bi bi-chat-left-text fs-2 text-muted d-block mb-3" aria-hidden="true"></i>
            <span class="fw-medium">目前無自訂關鍵字規則，請點擊上方按鈕建立</span>
          </div>
          <div v-else class="clinical-card overflow-hidden">
            <div class="table-responsive">
              <table class="clinical-table mb-0" style="font-size: .88rem;">
                <thead>
                  <tr>
                    <th scope="col" style="width: 250px;">觸發關鍵字</th>
                    <th scope="col">回覆內容預覽</th>
                    <th scope="col" style="width: 80px;">狀態</th>
                    <th scope="col" style="width: 120px; text-align: right;">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in kwItems" :key="item.id" :style="!item.active ? 'opacity: 0.55;' : ''">
                    <td>
                      <div class="d-flex flex-wrap gap-1">
                        <span v-for="kw in triggerBadges(item.triggers)" :key="kw"
                              class="badge bg-teal-soft text-teal border border-teal-light px-2.5 py-1 font-monospace" style="font-size: .8rem;">{{ kw }}</span>
                      </div>
                    </td>
                    <td class="text-muted small">
                      <div class="text-truncate-clinical" style="max-width: 450px;" :title="item.content">
                        {{ item.content }}
                      </div>
                    </td>
                    <td>
                      <div class="form-check form-switch mb-0">
                        <input class="form-check-input focus-ring" type="checkbox"
                               :checked="item.active" @change="toggleReply(item)"
                               :aria-label="`啟用或停用關鍵字 ${item.triggers}`">
                      </div>
                    </td>
                    <td style="text-align: right;">
                      <div class="d-flex gap-1 justify-content-end">
                        <button class="btn btn-outline-primary btn-sm p-1.5" @click="openKwEdit(item)" aria-label="編輯關鍵字規則">
                          <i class="bi bi-pencil" aria-hidden="true"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm p-1.5" @click="removeKw(item)" aria-label="刪除關鍵字規則">
                          <i class="bi bi-trash" aria-hidden="true"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div><!-- /Tab 1 -->

      <!-- ════════════════════════════════════════
           Tab 2：衛教 QA 管理
      ════════════════════════════════════════ -->
      <div v-show="mainTab === 'edu'">

        <!-- 統計與操作列 -->
        <div class="row g-3 mb-4 align-items-center">
          <div class="col-sm-auto d-flex gap-3">
            <div class="clinical-card px-4 py-2.5">
              <div class="text-muted small">全部條目</div>
              <div class="fw-bold fs-5 text-teal tabular-nums" style="color: var(--color-primary);">{{ eduItems.length }}</div>
            </div>
            <div class="clinical-card px-4 py-2.5">
              <div class="text-muted small">啟用中</div>
              <div class="fw-bold fs-5 text-success tabular-nums">{{ eduItems.filter(q => q.active).length }}</div>
            </div>
            <div class="clinical-card px-4 py-2.5">
              <div class="text-muted small">類別數</div>
              <div class="fw-bold fs-5 tabular-nums">{{ categories.length }}</div>
            </div>
          </div>
          <div class="col-sm d-flex justify-content-sm-end">
            <button class="btn btn-primary px-3.5 py-2 d-flex align-items-center gap-1.5 fw-semibold shadow-sm" @click="openEduAdd">
              <i class="bi bi-plus-circle" aria-hidden="true"></i>新增衛教 QA
            </button>
          </div>
        </div>

        <!-- 類別選擇選單 -->
        <div class="mb-3 d-flex flex-wrap gap-1.5">
          <button class="btn btn-sm px-3 py-1.5 fw-semibold transition-btn"
                  :class="selectedCat === '全部' ? 'btn-teal text-white' : 'btn-light text-muted'"
                  @click="selectedCat = '全部'">
            全部 ({{ eduItems.length }})
          </button>
          <button v-for="cat in categories" :key="cat"
                  class="btn btn-sm px-3 py-1.5 fw-semibold transition-btn"
                  :class="selectedCat === cat ? 'btn-teal text-white' : 'btn-light text-muted'"
                  @click="selectedCat = cat">
            {{ cat }} ({{ eduItems.filter(q => q.category === cat).length }})
          </button>
        </div>

        <!-- QA 資料表 -->
        <div v-if="eduLoading" class="text-center text-muted py-5">
          <div class="spinner-border text-teal mb-2" role="status">
            <span class="visually-hidden">載入中…</span>
          </div>
          <div>載入衛教 QA 列表中…</div>
        </div>
        <div v-else-if="filtered.length === 0" class="text-center text-muted py-5 clinical-card bg-white">
          <i class="bi bi-inbox fs-2 text-muted d-block mb-3" aria-hidden="true"></i>
          <span class="fw-medium">目前無此類別的衛教 QA 內容</span>
        </div>
        <div v-else class="clinical-card overflow-hidden">
          <div class="table-responsive">
            <table class="clinical-table mb-0" style="font-size: .88rem;">
              <thead>
                <tr>
                  <th scope="col" style="width: 50px;">序</th>
                  <th scope="col" style="width: 120px;">類別</th>
                  <th scope="col" style="width: 220px;">問題</th>
                  <th scope="col">回答預覽</th>
                  <th scope="col" style="width: 120px;">適用天數</th>
                  <th scope="col" style="width: 60px; text-align: center;">影片</th>
                  <th scope="col" style="width: 60px; text-align: center;">單張</th>
                  <th scope="col" style="width: 80px;">狀態</th>
                  <th scope="col" style="width: 120px; text-align: right;">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="qa in filtered" :key="qa.id" :style="!qa.active ? 'opacity: 0.55;' : ''">
                  <td class="text-muted small tabular-nums">{{ qa.displayOrder }}</td>
                  <td>
                    <span class="badge bg-soft-teal text-teal border border-teal-light px-2.5 py-1">
                      {{ qa.category }}
                    </span>
                  </td>
                  <td class="fw-bold small">{{ qa.question }}</td>
                  <td class="text-muted small">
                    <div class="text-truncate-clinical" style="max-width: 280px;" :title="qa.answer">
                      {{ qa.answer }}
                    </div>
                  </td>
                  <td class="tabular-nums">
                    <span class="badge bg-light text-secondary border" style="font-size: .75rem;">
                      {{ daysLabel(qa) }}
                    </span>
                  </td>
                  <td style="text-align: center;">
                    <a v-if="qa.videoUrl" :href="qa.videoUrl" target="_blank"
                       class="btn btn-link btn-sm p-0 d-inline-flex" aria-label="查看衛教影片" title="衛教影片">
                      <i class="bi bi-play-circle-fill text-danger fs-5"></i>
                    </a>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td style="text-align: center;">
                    <a v-if="qa.pdfUrl" :href="qa.pdfUrl" target="_blank"
                       class="btn btn-link btn-sm p-0 d-inline-flex" aria-label="下載衛教單張 PDF" title="PDF 單張">
                      <i class="bi bi-file-earmark-pdf-fill text-warning fs-5"></i>
                    </a>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td>
                    <div class="form-check form-switch mb-0">
                      <input class="form-check-input focus-ring" type="checkbox"
                             :checked="qa.active" @change="toggleEdu(qa)"
                             :aria-label="`啟用或停用衛教 QA 問題：${qa.question}`">
                    </div>
                  </td>
                  <td style="text-align: right;">
                    <div class="d-flex gap-1 justify-content-end">
                      <button class="btn btn-outline-primary btn-sm p-1.5" @click="openEduEdit(qa)" aria-label="編輯衛教 QA">
                        <i class="bi bi-pencil" aria-hidden="true"></i>
                      </button>
                      <button class="btn btn-outline-danger btn-sm p-1.5" @click="removeEdu(qa)" aria-label="刪除衛教 QA">
                        <i class="bi bi-trash" aria-hidden="true"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div><!-- /Tab 2 -->

      <!-- ════════════════════════════════════════
           Tab 3：耗材管理
      ════════════════════════════════════════ -->
      <div v-show="mainTab === 'implant'">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div class="text-muted small">共 <span class="fw-bold tabular-nums">{{ implants.length }}</span> 筆耗材資訊</div>
          <button class="btn btn-primary px-3.5 py-2 d-flex align-items-center gap-1.5 fw-semibold shadow-sm" @click="openImplantAdd">
            <i class="bi bi-plus-circle" aria-hidden="true"></i>新增耗材品項
          </button>
        </div>

        <div v-if="implantLoading" class="text-center text-muted py-5">
          <div class="spinner-border text-teal mb-2" role="status">
            <span class="visually-hidden">載入中…</span>
          </div>
          <div>載入耗材清單中…</div>
        </div>
        <div v-else-if="!implants.length" class="text-center text-muted py-5 clinical-card bg-white">
          <i class="bi bi-box-seam fs-2 text-muted d-block mb-3" aria-hidden="true"></i>
          <span class="fw-medium">目前尚無任何耗材登記</span>
        </div>
        <div v-else class="clinical-card overflow-hidden">
          <div class="table-responsive">
            <table class="clinical-table mb-0" style="font-size: .88rem;">
              <thead>
                <tr>
                  <th scope="col" style="width: 150px;">耗材代碼</th>
                  <th scope="col">耗材名稱</th>
                  <th scope="col" style="width: 140px;">耗材類別</th>
                  <th scope="col" style="width: 180px;">品牌/廠牌</th>
                  <th scope="col">備註</th>
                  <th scope="col" style="width: 120px; text-align: right;">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in implants" :key="item.code">
                  <td class="font-monospace"><strong>{{ item.code }}</strong></td>
                  <td>{{ item.name || '—' }}</td>
                  <td>
                    <span class="badge font-monospace px-2.5 py-1"
                          :style="{
                            background: item.category === 'Cage' ? '#ecfdf5' : item.category === 'Screw' ? '#f0f9ff' : '#f5f3ff',
                            color: item.category === 'Cage' ? '#047857' : item.category === 'Screw' ? '#0369a1' : '#6d28d9',
                            border: '1px solid currentColor'
                          }">
                      {{ item.category }}
                    </span>
                  </td>
                  <td>{{ item.brand || '—' }}</td>
                  <td class="text-muted small">{{ item.note || '—' }}</td>
                  <td style="text-align: right;">
                    <div class="d-flex gap-1 justify-content-end">
                      <button class="btn btn-outline-primary btn-sm p-1.5" @click="openImplantEdit(item)" aria-label="編輯耗材">
                        <i class="bi bi-pencil" aria-hidden="true"></i>
                      </button>
                      <button class="btn btn-outline-danger btn-sm p-1.5" @click="removeImplant(item)" aria-label="刪除耗材">
                        <i class="bi bi-trash" aria-hidden="true"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div><!-- /Tab 3 -->

    </div>

    <!-- ══ 系統訊息編輯 Modal ══ -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showSysModal"
             class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
             style="background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(4px); z-index: 9500;"
             @click.self="showSysModal = false"
             role="dialog"
             aria-modal="true"
             aria-labelledby="sysModalTitle">
          <div class="bg-white rounded-4 shadow-2xl d-flex flex-column border border-light overflow-hidden"
               style="width: min(96vw, 680px); max-height: 92vh;">
            <div class="d-flex justify-content-between align-items-center px-4 py-3 border-bottom bg-light-surface">
              <h3 class="fw-bold fs-6 m-0 d-flex align-items-center gap-2" id="sysModalTitle" style="color: var(--color-primary);">
                <i class="bi bi-pencil-square text-teal" aria-hidden="true"></i>
                編輯系統回覆設定
              </h3>
              <button class="btn-close shadow-none" @click="showSysModal = false" aria-label="關閉編輯"></button>
            </div>
            <div class="px-4 py-3 overflow-auto flex-grow-1">
              <!-- 說明提醒 -->
              <div class="alert alert-info py-2.5 px-3 mb-3 small d-flex flex-column gap-1 border-0" style="background-color: var(--color-primary-light); color: var(--color-primary);">
                <div class="fw-bold"><i class="bi bi-info-circle me-1" aria-hidden="true"></i>{{ sysForm.note || sysForm.key }}</div>
                <div v-if="PLACEHOLDER_NOTES[sysForm.key]" class="font-monospace mt-1 px-2 py-1 rounded bg-white-50" style="font-size: .8rem;">
                  動態變數：{{ PLACEHOLDER_NOTES[sysForm.key] }}
                </div>
              </div>
              <!-- 觸發關鍵字 -->
              <div v-if="sysForm.group === '系統訊息'" class="mb-3">
                <label for="sysTriggers" class="form-label-clinical mb-2">觸發關鍵字（請以英文半形逗號分隔）</label>
                <input v-model="sysForm.triggers" id="sysTriggers" type="text"
                       class="form-control focus-ring font-monospace"
                       placeholder="例：使用說明,說明,help,功能鍵" autocomplete="off">
                <div class="form-text small text-muted mt-1">留空表示僅透過 LINE 系統內部事件觸發，不接受文字觸發</div>
              </div>
              <!-- 回覆內容 -->
              <div class="mb-3">
                <label for="sysContent" class="form-label-clinical mb-2">回覆文字內容</label>
                <textarea v-model="sysForm.content" id="sysContent"
                          class="form-control focus-ring font-monospace" rows="10"
                          style="font-size: .88rem; line-height: 1.5;"></textarea>
                <div class="form-text text-end small text-muted mt-1 tabular-nums">字數：{{ sysForm.content.length }} 字</div>
              </div>
              <!-- 啟用狀態 -->
              <div class="form-check form-switch p-0 d-flex align-items-center gap-2">
                <input class="form-check-input ms-0 focus-ring" type="checkbox" id="sysActive" v-model="sysForm.active">
                <label class="form-check-label small fw-semibold text-dark" for="sysActive">
                  啟用此自訂回覆文字（若停用，LINE Bot 將自動採用系統預設範本）
                </label>
              </div>
            </div>
            <div class="px-4 py-3 border-top d-flex justify-content-end gap-2 bg-light-surface">
              <button class="btn btn-outline-secondary px-4 py-2" @click="showSysModal = false">取消</button>
              <button class="btn btn-primary px-4 py-2 fw-semibold" :disabled="sysSaving" @click="saveSys">
                <span v-if="sysSaving" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                儲存回覆設定
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ══ 自訂關鍵字 Modal ══ -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showKwModal"
             class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
             style="background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(4px); z-index: 9500;"
             @click.self="showKwModal = false"
             role="dialog"
             aria-modal="true"
             aria-labelledby="kwModalTitle">
          <div class="bg-white rounded-4 shadow-2xl d-flex flex-column border border-light overflow-hidden"
               style="width: min(96vw, 600px); max-height: 92vh;">
            <div class="d-flex justify-content-between align-items-center px-4 py-3 border-bottom bg-light-surface">
              <h3 class="fw-bold fs-6 m-0 d-flex align-items-center gap-2" id="kwModalTitle" style="color: var(--color-primary);">
                <i class="bi bi-chat-left-text text-teal" aria-hidden="true"></i>
                {{ isKwEdit ? '編輯關鍵字规则' : '新增關鍵字規則' }}
              </h3>
              <button class="btn-close shadow-none" @click="showKwModal = false" aria-label="關閉關鍵字視窗"></button>
            </div>
            <div class="px-4 py-3 overflow-auto flex-grow-1">
              <div class="mb-3">
                <label for="kwTriggers" class="form-label-clinical mb-2">觸發關鍵字 <span class="text-danger">*</span></label>
                <input v-model="kwForm.triggers" id="kwTriggers" type="text"
                       class="form-control focus-ring font-monospace"
                       placeholder="例：你好,Hello,資訊" autocomplete="off">
                <div class="form-text small text-muted mt-1">多個關鍵字以英文半形逗號分隔，病患訊息完全符合時觸發</div>
                <div class="mt-2 d-flex flex-wrap gap-1">
                  <span v-for="kw in triggerBadges(kwForm.triggers)" :key="kw"
                        class="badge bg-teal-soft text-teal border border-teal-light font-monospace">{{ kw }}</span>
                </div>
              </div>
              <div class="mb-3">
                <label for="kwContent" class="form-label-clinical mb-2">回覆訊息內容 <span class="text-danger">*</span></label>
                <textarea v-model="kwForm.content" id="kwContent"
                          class="form-control focus-ring font-monospace" rows="6"
                          placeholder="請輸入病患傳送關鍵字後，LINE Bot 自動回覆之文字內容"></textarea>
                <div class="form-text text-end small text-muted mt-1 tabular-nums">字數：{{ kwForm.content.length }} 字</div>
              </div>
              <div class="form-check form-switch p-0 d-flex align-items-center gap-2">
                <input class="form-check-input ms-0 focus-ring" type="checkbox" id="kwActive" v-model="kwForm.active">
                <label class="form-check-label small fw-semibold text-dark" for="kwActive">啟用此規則</label>
              </div>
            </div>
            <div class="px-4 py-3 border-top d-flex justify-content-end gap-2 bg-light-surface">
              <button class="btn btn-outline-secondary px-4 py-2" @click="showKwModal = false">取消</button>
              <button class="btn btn-success px-4 py-2 fw-semibold" :disabled="kwSaving" @click="saveKw">
                <span v-if="kwSaving" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                {{ isKwEdit ? '儲存變更' : '新增規則' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ══ 衛教 QA Modal ══ -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showEduModal"
             class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
             style="background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(4px); z-index: 9500;"
             @click.self="showEduModal = false"
             role="dialog"
             aria-modal="true"
             aria-labelledby="eduModalTitle">
          <div class="bg-white rounded-4 shadow-2xl d-flex flex-column border border-light overflow-hidden"
               style="width: min(96vw, 660px); max-height: 92vh;">
            <div class="d-flex justify-content-between align-items-center px-4 py-3 border-bottom bg-light-surface">
              <h3 class="fw-bold fs-6 m-0 d-flex align-items-center gap-2" id="eduModalTitle" style="color: var(--color-primary);">
                <i class="bi bi-journal-medical text-teal" aria-hidden="true"></i>
                {{ isEduEdit ? '編輯衛教 QA 條目' : '新增衛教 QA 條目' }}
              </h3>
              <button class="btn-close shadow-none" @click="showEduModal = false" aria-label="關閉視窗"></button>
            </div>
            <div class="px-4 py-3 overflow-auto flex-grow-1">
              <div class="row g-3">
                <div class="col-sm-7">
                  <label for="eduCategory" class="form-label-clinical mb-2">衛教類別 <span class="text-danger">*</span></label>
                  <input v-model="eduForm.category" id="eduCategory" type="text"
                         class="form-control focus-ring" list="eduCatList"
                         placeholder="請輸入或選擇衛教類別">
                  <datalist id="eduCatList">
                    <option v-for="c in categories" :key="c" :value="c" />
                  </datalist>
                  <div class="form-text small text-muted mt-1">若為新類別，直接輸入即可自動建立</div>
                </div>
                <div class="col-sm-5">
                  <label for="eduOrder" class="form-label-clinical mb-2">顯示排序</label>
                  <input v-model.number="eduForm.displayOrder" id="eduOrder" type="number" min="0"
                         class="form-control focus-ring tabular-nums" placeholder="數字越小越靠前">
                </div>
                <div class="col-12">
                  <span class="form-label-clinical d-block mb-2">適用術後時程（空白表示不限）</span>
                  <div class="d-flex align-items-center gap-2">
                    <input v-model.number="eduForm.daysFrom" type="number" min="0"
                           class="form-control focus-ring tabular-nums" style="width: 100px;" placeholder="D+ 起">
                    <span class="text-muted small">至</span>
                    <input v-model.number="eduForm.daysTo" type="number" min="0"
                           class="form-control focus-ring tabular-nums" style="width: 100px;" placeholder="D+ 迄">
                    <span class="text-muted small">天</span>
                  </div>
                </div>
                <div class="col-12">
                  <label for="eduQuestion" class="form-label-clinical mb-2">問題標題 <span class="text-danger">*</span></label>
                  <input v-model="eduForm.question" id="eduQuestion" type="text"
                         class="form-control focus-ring" placeholder="請輸入簡明問題（建議 18 字內以利手機顯示）">
                </div>
                <div class="col-12">
                  <label for="eduAnswer" class="form-label-clinical mb-2">衛教回答內容 <span class="text-danger">*</span></label>
                  <textarea v-model="eduForm.answer" id="eduAnswer"
                            class="form-control focus-ring" rows="5"
                            placeholder="請輸入詳細的衛教指導或解答內容"></textarea>
                  <div class="form-text text-end small text-muted mt-1 tabular-nums" :class="eduForm.answer.length > 200 ? 'text-warning' : ''">
                    {{ eduForm.answer.length }} 字
                  </div>
                </div>
                <div class="col-12">
                  <label for="eduVideo" class="form-label-clinical mb-2">
                    <i class="bi bi-play-circle-fill text-danger me-1" aria-hidden="true"></i>衛教影片連結（選填）
                  </label>
                  <input v-model="eduForm.videoUrl" id="eduVideo" type="url"
                         class="form-control focus-ring font-monospace" placeholder="https://youtube.com/watch?v=...">
                </div>
                <div class="col-12">
                  <label for="eduPdf" class="form-label-clinical mb-2">
                    <i class="bi bi-file-earmark-pdf-fill text-warning me-1" aria-hidden="true"></i>衛教單張 PDF 連結（選填）
                  </label>
                  <input v-model="eduForm.pdfUrl" id="eduPdf" type="url"
                         class="form-control focus-ring font-monospace" placeholder="https://drive.google.com/file/d/...">
                  <div class="form-text small text-muted mt-1">可提供 Google Drive 或雲端文件的 PDF 直連網址</div>
                </div>
                <div class="col-12">
                  <div class="form-check form-switch p-0 d-flex align-items-center gap-2">
                    <input class="form-check-input ms-0 focus-ring" type="checkbox" id="eduActive" v-model="eduForm.active">
                    <label class="form-check-label small fw-semibold text-dark" for="eduActive">啟用此衛教 QA 條目</label>
                  </div>
                </div>
              </div>
            </div>
            <div class="px-4 py-3 border-top d-flex justify-content-end gap-2 bg-light-surface">
              <button class="btn btn-outline-secondary px-4 py-2" @click="showEduModal = false">取消</button>
              <button class="btn btn-primary px-4 py-2 fw-semibold" :disabled="eduSaving" @click="submitEdu">
                <span v-if="eduSaving" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                儲存衛教內容
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ══ 耗材編輯 Modal ══ -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showImplantModal"
             class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
             style="background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(4px); z-index: 9500;"
             @click.self="showImplantModal = false"
             role="dialog"
             aria-modal="true"
             aria-labelledby="implantModalTitle">
          <div class="bg-white rounded-4 shadow-2xl d-flex flex-column border border-light overflow-hidden"
               style="width: min(96vw, 450px); max-height: 92vh;">
            <div class="d-flex justify-content-between align-items-center px-4 py-3 border-bottom bg-light-surface">
              <h3 class="fw-bold fs-6 m-0 d-flex align-items-center gap-2" id="implantModalTitle" style="color: var(--color-primary);">
                <i class="bi bi-box-seam text-teal" aria-hidden="true"></i>
                {{ isImplantEdit ? '編輯耗材品項' : '新增耗材品項' }}
              </h3>
              <button class="btn-close shadow-none" @click="showImplantModal = false" aria-label="關閉耗材視窗"></button>
            </div>
            <div class="px-4 py-3 overflow-auto flex-grow-1">
              <div class="mb-3">
                <label for="implantCode" class="form-label-clinical mb-2">耗材品項代碼 <span class="text-danger">*</span></label>
                <input v-model="implantForm.code" id="implantCode" type="text"
                       class="form-control focus-ring font-monospace"
                       placeholder="如：TLIF-C01, SC-S04" :disabled="isImplantEdit" autocomplete="off">
                <div class="form-text small text-muted mt-1" v-if="isImplantEdit">代碼為唯一識別鍵值，無法進行修改</div>
              </div>
              <div class="mb-3">
                <label for="implantName" class="form-label-clinical mb-2">耗材名稱</label>
                <input v-model="implantForm.name" id="implantName" type="text"
                       class="form-control focus-ring" placeholder="完整耗材品名規格">
              </div>
              <div class="mb-3">
                <label for="implantCategory" class="form-label-clinical mb-2">耗材類別 <span class="text-danger">*</span></label>
                <select v-model="implantForm.category" id="implantCategory" class="form-select focus-ring">
                  <option v-for="c in IMPLANT_CATS" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
              <div class="mb-3">
                <label for="implantBrand" class="form-label-clinical mb-2">品牌與製造廠牌</label>
                <input v-model="implantForm.brand" id="implantBrand" type="text"
                       class="form-control focus-ring" placeholder="品牌或製造商名稱">
              </div>
              <div class="mb-0">
                <label for="implantNote" class="form-label-clinical mb-2">臨床備註</label>
                <input v-model="implantForm.note" id="implantNote" type="text"
                       class="form-control focus-ring" placeholder="輸入耗材臨床備註">
              </div>
            </div>
            <div class="px-4 py-3 border-top d-flex justify-content-end gap-2 bg-light-surface">
              <button class="btn btn-outline-secondary px-4 py-2" @click="showImplantModal = false">取消</button>
              <button class="btn btn-primary px-4 py-2 fw-semibold" :disabled="implantSaving" @click="submitImplant">
                <span v-if="implantSaving" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                {{ isImplantEdit ? '確認更新' : '確認新增' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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

/* Sub tabs sub pills */
.btn-teal {
  background-color: var(--color-primary);
  color: #fff;
}
.btn-teal:hover {
  background-color: #063e45;
  color: #fff;
}

.text-teal {
  color: var(--color-primary) !important;
}
.bg-teal-soft {
  background-color: var(--color-primary-light);
}
.border-teal-light {
  border-color: #ccebe5 !important;
}

.text-truncate-clinical {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-label-clinical {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-primary);
}

.border-dashed {
  border-style: dashed !important;
}

/* Modals and toast transitions */
.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.25s ease;
}
.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0;
}

.toast-fade-enter-active, .toast-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-fade-enter-from, .toast-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* CSS focus indicators */
.focus-ring:focus {
  border-color: var(--color-accent) !important;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.25) !important;
  outline: none !important;
}
.focus-ring:focus-visible {
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.3);
  border-color: var(--color-accent) !important;
  outline: none !important;
}
.btn-close {
  background-size: 0.8rem;
  transition: transform 0.15s;
}
.btn-close:hover {
  transform: rotate(90deg);
}
</style>
