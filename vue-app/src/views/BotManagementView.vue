<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import {
  getLineReply, saveLineReply, deleteLineReply,
  getHealthEdu, saveHealthEdu, deleteHealthEdu
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
const mainTab    = ref('bot')   // 'bot' | 'edu'
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
// Tab 2：衛教 QA 管理（與原 HealthEduView 相同）
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
onMounted(() => { loadReply(); loadEdu() })
</script>

<template>
  <div style="background:#f0f4f8;min-height:100vh;font-family:'Segoe UI',sans-serif">

    <!-- Navbar -->
    <nav class="navbar navbar-dark px-3 py-2" style="background:linear-gradient(135deg,#1a73e8,#0d47a1)">
      <span class="navbar-brand fw-bold"><i class="bi bi-robot me-2"></i>Bot 管理</span>
      <div class="d-flex gap-2">
        <RouterLink to="/"       class="btn btn-outline-light btn-sm"><i class="bi bi-house me-1"></i>後台</RouterLink>
        <RouterLink to="/form"   class="btn btn-outline-light btn-sm"><i class="bi bi-pencil-square me-1"></i>填表</RouterLink>
        <RouterLink to="/export" class="btn btn-outline-light btn-sm"><i class="bi bi-download me-1"></i>匯出</RouterLink>
      </div>
    </nav>

    <div class="container-fluid py-4 px-4" style="max-width:1100px">

      <!-- 主 Tab -->
      <ul class="nav nav-tabs mb-4">
        <li class="nav-item">
          <button class="nav-link" :class="mainTab === 'bot' ? 'active fw-bold' : ''"
                  @click="mainTab = 'bot'">
            <i class="bi bi-robot me-1"></i>LINE Bot 回覆設定
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link" :class="mainTab === 'edu' ? 'active fw-bold' : ''"
                  @click="mainTab = 'edu'">
            <i class="bi bi-journal-medical me-1"></i>衛教 QA 管理
          </button>
        </li>
      </ul>

      <!-- ════════════════════════════════════════
           Tab 1：LINE Bot 回覆設定
      ════════════════════════════════════════ -->
      <div v-show="mainTab === 'bot'">

        <!-- 統計列 -->
        <div class="row g-3 mb-3">
          <div class="col-auto">
            <div class="card border-0 shadow-sm px-3 py-2">
              <div class="text-muted small">系統訊息</div>
              <div class="fw-bold fs-5 text-primary">{{ sysItems.length }}</div>
            </div>
          </div>
          <div class="col-auto">
            <div class="card border-0 shadow-sm px-3 py-2">
              <div class="text-muted small">自訂關鍵字</div>
              <div class="fw-bold fs-5 text-success">{{ kwItems.length }}</div>
            </div>
          </div>
        </div>

        <!-- Sub-tab -->
        <ul class="nav nav-pills mb-3 gap-2">
          <li class="nav-item">
            <button class="nav-link" :class="botSubTab === 'sys' ? 'active' : 'btn-outline-secondary text-secondary'"
                    @click="botSubTab = 'sys'">系統訊息 / 問卷步驟</button>
          </li>
          <li class="nav-item">
            <button class="nav-link" :class="botSubTab === 'kw' ? 'active' : 'btn-outline-secondary text-secondary'"
                    @click="botSubTab = 'kw'">自訂關鍵字</button>
          </li>
        </ul>

        <!-- ── 系統訊息 ── -->
        <div v-show="botSubTab === 'sys'">
          <div v-if="replyLoading" class="text-center text-muted py-5">
            <div class="spinner-border spinner-border-sm me-2"></div>載入中…
          </div>
          <div v-else class="card border-0 shadow-sm">
            <div class="card-body p-0">
              <div class="table-responsive">
                <table class="table table-hover align-middle mb-0" style="font-size:.85rem">
                  <thead class="table-light">
                    <tr>
                      <th style="width:80px">群組</th>
                      <th style="width:120px">用途說明</th>
                      <th style="width:180px">觸發方式</th>
                      <th>內容預覽</th>
                      <th style="width:60px">啟用</th>
                      <th style="width:60px"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in sysItems" :key="item.id" :style="!item.active ? 'opacity:.45' : ''">
                      <td>
                        <span class="badge rounded-pill"
                              :style="item.group === '問卷步驟' ? 'background:#e8f4fd;color:#0d6efd' : 'background:#e8f0fe;color:#1a73e8'">
                          {{ item.group }}
                        </span>
                      </td>
                      <td class="small fw-bold">{{ item.note || item.key }}</td>
                      <td>
                        <span v-if="triggerBadges(item.triggers).length">
                          <span v-for="kw in triggerBadges(item.triggers)" :key="kw"
                                class="badge bg-secondary me-1 mb-1" style="font-size:.7rem">{{ kw }}</span>
                        </span>
                        <span v-else class="text-muted small">（事件觸發）</span>
                      </td>
                      <td class="text-muted small"
                          style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                        {{ item.content }}
                      </td>
                      <td>
                        <div class="form-check form-switch mb-0">
                          <input class="form-check-input" type="checkbox"
                                 :checked="item.active" @change="toggleReply(item)">
                        </div>
                      </td>
                      <td>
                        <button class="btn btn-outline-primary btn-sm px-2" @click="openSysEdit(item)" title="編輯">
                          <i class="bi bi-pencil"></i>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- ── 自訂關鍵字 ── -->
        <div v-show="botSubTab === 'kw'">
          <div class="d-flex justify-content-end mb-3">
            <button class="btn btn-success" @click="openKwAdd">
              <i class="bi bi-plus-circle me-1"></i>新增關鍵字規則
            </button>
          </div>
          <div v-if="replyLoading" class="text-center text-muted py-5">
            <div class="spinner-border spinner-border-sm me-2"></div>載入中…
          </div>
          <div v-else-if="kwItems.length === 0" class="text-center text-muted py-5">
            <i class="bi bi-chat-left-text fs-2 d-block mb-2"></i>
            尚無自訂關鍵字，點上方「新增」開始建立
          </div>
          <div v-else class="card border-0 shadow-sm">
            <div class="card-body p-0">
              <div class="table-responsive">
                <table class="table table-hover align-middle mb-0" style="font-size:.85rem">
                  <thead class="table-light">
                    <tr>
                      <th>觸發關鍵字</th>
                      <th>回覆內容預覽</th>
                      <th style="width:60px">啟用</th>
                      <th style="width:100px"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in kwItems" :key="item.id" :style="!item.active ? 'opacity:.45' : ''">
                      <td>
                        <span v-for="kw in triggerBadges(item.triggers)" :key="kw"
                              class="badge bg-primary me-1" style="font-size:.78rem">{{ kw }}</span>
                      </td>
                      <td class="text-muted small"
                          style="max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                        {{ item.content }}
                      </td>
                      <td>
                        <div class="form-check form-switch mb-0">
                          <input class="form-check-input" type="checkbox"
                                 :checked="item.active" @change="toggleReply(item)">
                        </div>
                      </td>
                      <td>
                        <div class="d-flex gap-1">
                          <button class="btn btn-outline-primary btn-sm px-2" @click="openKwEdit(item)">
                            <i class="bi bi-pencil"></i>
                          </button>
                          <button class="btn btn-outline-danger btn-sm px-2" @click="removeKw(item)">
                            <i class="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div><!-- /Tab 1 -->

      <!-- ════════════════════════════════════════
           Tab 2：衛教 QA 管理
      ════════════════════════════════════════ -->
      <div v-show="mainTab === 'edu'">

        <!-- 統計列 -->
        <div class="row g-3 mb-3">
          <div class="col-auto">
            <div class="card border-0 shadow-sm px-3 py-2">
              <div class="text-muted small">全部條目</div>
              <div class="fw-bold fs-5 text-primary">{{ eduItems.length }}</div>
            </div>
          </div>
          <div class="col-auto">
            <div class="card border-0 shadow-sm px-3 py-2">
              <div class="text-muted small">啟用中</div>
              <div class="fw-bold fs-5 text-success">{{ eduItems.filter(q => q.active).length }}</div>
            </div>
          </div>
          <div class="col-auto">
            <div class="card border-0 shadow-sm px-3 py-2">
              <div class="text-muted small">類別數</div>
              <div class="fw-bold fs-5">{{ categories.length }}</div>
            </div>
          </div>
          <div class="col d-flex align-items-center justify-content-end">
            <button class="btn btn-primary" @click="openEduAdd">
              <i class="bi bi-plus-circle me-1"></i>新增衛教 QA
            </button>
          </div>
        </div>

        <!-- 類別 Tabs -->
        <div class="mb-3 d-flex flex-wrap gap-2">
          <button class="btn btn-sm" :class="selectedCat === '全部' ? 'btn-primary' : 'btn-outline-secondary'"
                  @click="selectedCat = '全部'">
            全部（{{ eduItems.length }}）
          </button>
          <button v-for="cat in categories" :key="cat" class="btn btn-sm"
                  :class="selectedCat === cat ? 'btn-primary' : 'btn-outline-secondary'"
                  @click="selectedCat = cat">
            {{ cat }}（{{ eduItems.filter(q => q.category === cat).length }}）
          </button>
        </div>

        <!-- QA 表格 -->
        <div class="card border-0 rounded-3 shadow-sm">
          <div class="card-body p-0">
            <div v-if="eduLoading" class="text-center py-5">
              <div class="spinner-border text-primary me-2"></div><span class="text-muted">載入中…</span>
            </div>
            <div v-else-if="filtered.length === 0" class="text-center text-muted py-5">
              <i class="bi bi-inbox fs-2 d-block mb-2"></i>尚無衛教 QA，點上方「新增」開始建立
            </div>
            <div v-else class="table-responsive">
              <table class="table table-hover align-middle mb-0" style="font-size:.85rem">
                <thead class="table-light">
                  <tr>
                    <th style="width:40px">序</th>
                    <th style="width:100px">類別</th>
                    <th style="width:180px">問題</th>
                    <th>回答預覽</th>
                    <th style="width:90px">適用天數</th>
                    <th style="width:50px">影片</th>
                    <th style="width:50px">單張</th>
                    <th style="width:60px">啟用</th>
                    <th style="width:100px"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="qa in filtered" :key="qa.id" :style="!qa.active ? 'opacity:.45' : ''">
                    <td class="text-muted small">{{ qa.displayOrder }}</td>
                    <td>
                      <span class="badge rounded-pill" style="background:#e8f0fe;color:#1a73e8;font-size:.75rem">
                        {{ qa.category }}
                      </span>
                    </td>
                    <td class="fw-bold small">{{ qa.question }}</td>
                    <td class="text-muted small"
                        style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                      {{ qa.answer }}
                    </td>
                    <td>
                      <span class="badge bg-light text-dark border" style="font-size:.72rem">
                        {{ daysLabel(qa) }}
                      </span>
                    </td>
                    <td>
                      <a v-if="qa.videoUrl" :href="qa.videoUrl" target="_blank"
                         class="btn btn-link btn-sm p-0" title="影片">
                        <i class="bi bi-play-circle-fill text-danger"></i>
                      </a>
                      <span v-else class="text-muted">—</span>
                    </td>
                    <td>
                      <a v-if="qa.pdfUrl" :href="qa.pdfUrl" target="_blank"
                         class="btn btn-link btn-sm p-0" title="衛教單張">
                        <i class="bi bi-file-earmark-pdf-fill text-warning"></i>
                      </a>
                      <span v-else class="text-muted">—</span>
                    </td>
                    <td>
                      <div class="form-check form-switch mb-0">
                        <input class="form-check-input" type="checkbox"
                               :checked="qa.active" @change="toggleEdu(qa)">
                      </div>
                    </td>
                    <td>
                      <div class="d-flex gap-1">
                        <button class="btn btn-outline-primary btn-sm px-2" @click="openEduEdit(qa)">
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm px-2" @click="removeEdu(qa)">
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div><!-- /Tab 2 -->

    </div><!-- /container -->

    <!-- ══ 系統訊息編輯 Modal ══ -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showSysModal"
             class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
             style="background:rgba(0,0,0,.5);z-index:9500" @click.self="showSysModal = false">
          <div class="bg-white rounded-3 shadow-lg" style="width:min(96vw,640px);max-height:92vh;overflow-y:auto">
            <div class="d-flex justify-content-between align-items-center px-4 py-3 border-bottom">
              <div class="fw-bold" style="color:#1a73e8">
                <i class="bi bi-pencil-square me-2"></i>編輯回覆內容
              </div>
              <button class="btn-close" @click="showSysModal = false"></button>
            </div>
            <div class="px-4 py-3">
              <!-- 說明 -->
              <div class="alert alert-info py-2 small mb-3">
                <strong>{{ sysForm.note || sysForm.key }}</strong>
                <span v-if="PLACEHOLDER_NOTES[sysForm.key]" class="ms-2 text-muted">
                  — {{ PLACEHOLDER_NOTES[sysForm.key] }}
                </span>
              </div>
              <!-- 觸發關鍵字（僅系統訊息有顯示，問卷步驟無觸發詞） -->
              <div v-if="sysForm.group === '系統訊息'" class="mb-3">
                <label class="form-label small fw-bold">觸發關鍵字（逗號分隔）</label>
                <input v-model="sysForm.triggers" type="text" class="form-control form-control-sm"
                       placeholder="例：使用說明,說明,help">
                <div class="form-text">修改後對應的關鍵字即可觸發此回覆（留空表示僅事件觸發）</div>
              </div>
              <!-- 回覆內容 -->
              <div class="mb-3">
                <label class="form-label small fw-bold">回覆內容</label>
                <textarea v-model="sysForm.content" class="form-control form-control-sm" rows="9"
                          style="font-family:monospace;font-size:.83rem"></textarea>
                <div class="form-text text-end">{{ sysForm.content.length }} 字</div>
              </div>
              <!-- 啟用 -->
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="sysActive" v-model="sysForm.active">
                <label class="form-check-label small" for="sysActive">
                  啟用（停用後 Bot 將使用內建預設文字）
                </label>
              </div>
            </div>
            <div class="px-4 py-3 border-top d-flex justify-content-end gap-2">
              <button class="btn btn-outline-secondary" @click="showSysModal = false">取消</button>
              <button class="btn btn-primary" :disabled="sysSaving" @click="saveSys">
                <span v-if="sysSaving" class="spinner-border spinner-border-sm me-1"></span>儲存
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
             style="background:rgba(0,0,0,.5);z-index:9500" @click.self="showKwModal = false">
          <div class="bg-white rounded-3 shadow-lg" style="width:min(96vw,560px);max-height:92vh;overflow-y:auto">
            <div class="d-flex justify-content-between align-items-center px-4 py-3 border-bottom">
              <div class="fw-bold" style="color:#198754">
                <i class="bi bi-chat-left-text me-2"></i>{{ isKwEdit ? '編輯關鍵字規則' : '新增關鍵字規則' }}
              </div>
              <button class="btn-close" @click="showKwModal = false"></button>
            </div>
            <div class="px-4 py-3">
              <div class="mb-3">
                <label class="form-label small fw-bold">觸發關鍵字 <span class="text-danger">*</span></label>
                <input v-model="kwForm.triggers" type="text" class="form-control form-control-sm"
                       placeholder="例：你好,Hello,Hi">
                <div class="form-text">多個關鍵字以逗號分隔，完全符合時觸發</div>
                <div class="mt-1">
                  <span v-for="kw in triggerBadges(kwForm.triggers)" :key="kw"
                        class="badge bg-primary me-1">{{ kw }}</span>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label small fw-bold">回覆內容 <span class="text-danger">*</span></label>
                <textarea v-model="kwForm.content" class="form-control form-control-sm" rows="5"
                          placeholder="病患傳送關鍵字後的回覆文字"></textarea>
                <div class="form-text text-end">{{ kwForm.content.length }} 字</div>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="kwActive" v-model="kwForm.active">
                <label class="form-check-label small" for="kwActive">啟用</label>
              </div>
            </div>
            <div class="px-4 py-3 border-top d-flex justify-content-end gap-2">
              <button class="btn btn-outline-secondary" @click="showKwModal = false">取消</button>
              <button class="btn btn-success" :disabled="kwSaving" @click="saveKw">
                <span v-if="kwSaving" class="spinner-border spinner-border-sm me-1"></span>
                {{ isKwEdit ? '儲存變更' : '新增' }}
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
             style="background:rgba(0,0,0,.5);z-index:9500" @click.self="showEduModal = false">
          <div class="bg-white rounded-3 shadow-lg" style="width:min(96vw,620px);max-height:92vh;overflow-y:auto">
            <div class="d-flex justify-content-between align-items-center px-4 py-3 border-bottom">
              <div class="fw-bold" style="color:#1a73e8">
                <i class="bi bi-journal-medical me-2"></i>{{ isEduEdit ? '編輯衛教 QA' : '新增衛教 QA' }}
              </div>
              <button class="btn-close" @click="showEduModal = false"></button>
            </div>
            <div class="px-4 py-3">
              <div class="row g-3">
                <div class="col-sm-7">
                  <label class="form-label small fw-bold">類別 <span class="text-danger">*</span></label>
                  <input v-model="eduForm.category" type="text" class="form-control form-control-sm"
                         list="eduCatList" placeholder="輸入或選擇類別">
                  <datalist id="eduCatList">
                    <option v-for="c in categories" :key="c" :value="c" />
                  </datalist>
                  <div class="form-text">新類別直接輸入即可自動建立</div>
                </div>
                <div class="col-sm-5">
                  <label class="form-label small fw-bold">顯示排序</label>
                  <input v-model.number="eduForm.displayOrder" type="number" min="0"
                         class="form-control form-control-sm" placeholder="數字小的排前面">
                </div>
                <div class="col-12">
                  <label class="form-label small fw-bold">適用術後天數（空白 = 不限）</label>
                  <div class="d-flex align-items-center gap-2">
                    <input v-model.number="eduForm.daysFrom" type="number" min="0"
                           class="form-control form-control-sm" style="width:90px" placeholder="起">
                    <span class="text-muted small">至</span>
                    <input v-model.number="eduForm.daysTo" type="number" min="0"
                           class="form-control form-control-sm" style="width:90px" placeholder="迄">
                    <span class="text-muted small">天</span>
                  </div>
                </div>
                <div class="col-12">
                  <label class="form-label small fw-bold">問題標題 <span class="text-danger">*</span></label>
                  <input v-model="eduForm.question" type="text" class="form-control form-control-sm"
                         placeholder="簡短問題（建議 18 字以內）">
                </div>
                <div class="col-12">
                  <label class="form-label small fw-bold">衛教回答 <span class="text-danger">*</span></label>
                  <textarea v-model="eduForm.answer" class="form-control form-control-sm" rows="5"
                            placeholder="衛教說明內容"></textarea>
                  <div class="form-text text-end" :class="eduForm.answer.length > 200 ? 'text-warning' : ''">
                    {{ eduForm.answer.length }} 字
                  </div>
                </div>
                <div class="col-12">
                  <label class="form-label small fw-bold">
                    <i class="bi bi-play-circle text-danger me-1"></i>衛教影片連結（選填）
                  </label>
                  <input v-model="eduForm.videoUrl" type="url" class="form-control form-control-sm"
                         placeholder="https://youtube.com/watch?v=...">
                </div>
                <div class="col-12">
                  <label class="form-label small fw-bold">
                    <i class="bi bi-file-earmark-pdf text-warning me-1"></i>衛教單張 PDF 連結（選填）
                  </label>
                  <input v-model="eduForm.pdfUrl" type="url" class="form-control form-control-sm"
                         placeholder="https://drive.google.com/file/d/...">
                  <div class="form-text">可貼入 Google Drive 或醫院網站的 PDF 直連網址</div>
                </div>
                <div class="col-12">
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="eduActive" v-model="eduForm.active">
                    <label class="form-check-label small" for="eduActive">啟用</label>
                  </div>
                </div>
              </div>
            </div>
            <div class="px-4 py-3 border-top d-flex justify-content-end gap-2">
              <button class="btn btn-outline-secondary" @click="showEduModal = false">取消</button>
              <button class="btn btn-primary" :disabled="eduSaving" @click="submitEdu">
                <span v-if="eduSaving" class="spinner-border spinner-border-sm me-1"></span>
                {{ isEduEdit ? '儲存變更' : '新增' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity .2s; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity .3s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }
.nav-pills .nav-link:not(.active) { color: #6c757d; }
</style>
