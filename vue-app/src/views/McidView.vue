<script setup>
import { ref, computed, onMounted } from 'vue'
import { getMcidData } from '../api/gas.js'

const loading = ref(true)
const summary = ref({})
const patients = ref([])

const sortKey = ref('researchId')
const sortAsc = ref(true)
const filterGroup = ref('')

// Toast Notification
const toast = ref({ show: false, msg: '', type: 'success' })
let toastTimer = null
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer)
  toast.value = { show: true, msg, type }
  toastTimer = setTimeout(() => { toast.value.show = false }, 3000)
}

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await getMcidData()
    summary.value  = data.summary  || {}
    patients.value = data.patients || []
    showToast('數據已載入最新臨床記錄')
  } catch (e) {
    summary.value  = {}
    patients.value = []
    showToast('載入失敗：' + e.message, 'danger')
  } finally {
    loading.value = false
  }
}

function sortBy(key) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = true
  }
}

function sortIcon(key) {
  if (sortKey.value !== key) return 'bi-arrow-down-up text-muted opacity-50'
  return sortAsc.value ? 'bi-sort-down-alt text-teal' : 'bi-sort-up-alt text-teal'
}

const filtered = computed(() => {
  let rows = patients.value
  if (filterGroup.value) rows = rows.filter(r => r.group === filterGroup.value)
  return [...rows].sort((a, b) => {
    const va = a[sortKey.value], vb = b[sortKey.value]
    if (va === null || va === undefined) return 1
    if (vb === null || vb === undefined) return -1
    const cmp = va < vb ? -1 : va > vb ? 1 : 0
    return sortAsc.value ? cmp : -cmp
  })
})

function fmt(v, unit = '') {
  if (v === null || v === undefined || v === '') return '—'
  return v + unit
}

function getGroupBadgeStyle(group) {
  if (group === 'line_bot') {
    return 'background: var(--color-primary-light); color: var(--color-primary); border: 1px solid rgba(10, 92, 102, 0.2);'
  } else if (group === 'control') {
    return 'background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1;'
  } else {
    return 'background: #fffbeb; color: #b45309; border: 1px solid #fef3c7;'
  }
}

function getGroupLabel(group) {
  return group === 'line_bot' ? 'Bot 組' : group === 'control' ? '對照組' : '部分介入'
}
</script>

<template>
  <div style="background: var(--color-bg-base); min-height: 100vh; font-family: var(--font-family);">

    <!-- Navbar / Header -->
    <nav class="navbar navbar-expand-lg navbar-dark px-4 py-3 shadow-sm border-bottom" style="background: linear-gradient(135deg, var(--color-primary), #063e45);">
      <div class="container-fluid p-0 d-flex justify-content-between align-items-center">
        <span class="navbar-brand fw-bold fs-5 d-flex align-items-center">
          <i class="bi bi-graph-up-arrow me-2" aria-hidden="true"></i>MCID 達成分析
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
          <RouterLink to="/mcid" class="btn btn-light btn-sm text-dark px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
            <i class="bi bi-graph-up-arrow" aria-hidden="true"></i>MCID
          </RouterLink>
          <RouterLink to="/export" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1">
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

    <div class="container-fluid py-4 px-4 max-width-xl">

      <!-- Loading -->
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-teal mb-3" style="color: var(--color-accent);" role="status">
          <span class="visually-hidden">載入中...</span>
        </div>
        <div class="text-muted fw-medium">載入 MCID 分析數據中...</div>
      </div>

      <template v-else>

        <!-- 說明提示 -->
        <div class="alert alert-info border-0 shadow-sm p-3 mb-4 d-flex align-items-start gap-2.5" style="border-radius: 12px; background-color: #ecfeff; border-left: 4px solid var(--color-accent) !important; color: #0891b2;">
          <i class="bi bi-info-circle-fill fs-5 mt-0.5" aria-hidden="true"></i>
          <div>
            <div class="fw-bold mb-1" style="color: var(--color-primary);">MCID 臨床評估定義</div>
            <div class="small">
              <strong>VAS 疼痛改善度</strong> 須大於等於 <span class="tabular-nums">2.5</span> 分；<strong>ODI 功能障礙改善度</strong> 須改善大於等於 <span class="tabular-nums">12.8%</span>；<strong>PASS 滿意狀態</strong> 定義為術後 <span class="font-monospace">VAS_back</span> 小於等於 <span class="tabular-nums">3</span> 分。
              術後數據優先取 <span class="tabular-nums">D70–D84</span> 期間，無此期間記錄者取最近一次有效追蹤資料。
              <span v-if="summary.total < 15" class="text-danger fw-bold ms-1">
                <i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i> 臨床警示：樣本量不足（n = {{ summary.total }}），結論可能存在統計偏誤，請勿直接用於醫學學術發表。
              </span>
            </div>
          </div>
        </div>

        <!-- 摘要卡片 -->
        <div class="row g-3 mb-4">
          <div class="col-6 col-md-3">
            <div class="clinical-card p-3.5 d-flex flex-column align-items-center justify-content-center text-center" style="border-top: 4px solid var(--color-primary); min-height: 120px;">
              <div class="fs-2 fw-bold text-teal tabular-nums" style="color: var(--color-primary);">{{ summary.total ?? '—' }}</div>
              <div class="text-muted small mt-1">總追蹤個案數</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="clinical-card p-3.5 d-flex flex-column align-items-center justify-content-center text-center" style="border-top: 4px solid var(--color-accent); min-height: 120px;">
              <div class="fs-2 fw-bold text-success tabular-nums" style="color: #0d9488;">{{ summary.vasMcidPct ?? '—' }}%</div>
              <div class="text-muted small mt-1">VAS MCID 達成率</div>
              <div class="small text-muted font-monospace mt-0.5">(n={{ summary.vasMcidN ?? 0 }})</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="clinical-card p-3.5 d-flex flex-column align-items-center justify-content-center text-center" style="border-top: 4px solid #8b5cf6; min-height: 120px;">
              <div class="fs-2 fw-bold tabular-nums" style="color: #7c3aed;">{{ summary.odiMcidPct ?? '—' }}%</div>
              <div class="text-muted small mt-1">ODI MCID 達成率</div>
              <div class="small text-muted font-monospace mt-0.5">(n={{ summary.odiMcidN ?? 0 }})</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="clinical-card p-3.5 d-flex flex-column align-items-center justify-content-center text-center" style="border-top: 4px solid #f59e0b; min-height: 120px;">
              <div class="fs-2 fw-bold text-warning tabular-nums" style="color: #d97706;">{{ summary.passPct ?? '—' }}%</div>
              <div class="text-muted small mt-1">PASS 達成率</div>
              <div class="small text-muted font-monospace mt-0.5">(n={{ summary.passN ?? 0 }})</div>
            </div>
          </div>
        </div>

        <!-- 篩選列 -->
        <div class="card mb-4 border-0 shadow-sm" style="border-radius: 12px; background: #fff;">
          <div class="card-body p-3 d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div class="d-flex align-items-center gap-2">
              <span class="fw-bold small text-muted"><i class="bi bi-funnel me-1" aria-hidden="true"></i>篩選介入組別：</span>
              <div class="d-flex gap-1.5 flex-wrap">
                <button class="btn btn-sm px-3.5 py-1.5 fw-semibold transition-btn rounded-pill"
                        :class="filterGroup === '' ? 'btn-teal text-white shadow-sm' : 'btn-light text-secondary border'"
                        @click="filterGroup = ''">
                  全部 ({{ patients.length }})
                </button>
                <button class="btn btn-sm px-3.5 py-1.5 fw-semibold transition-btn rounded-pill"
                        :class="filterGroup === 'line_bot' ? 'btn-teal text-white shadow-sm' : 'btn-light text-secondary border'"
                        @click="filterGroup = 'line_bot'">
                  LINE Bot 組 ({{ patients.filter(p => p.group === 'line_bot').length }})
                </button>
                <button class="btn btn-sm px-3.5 py-1.5 fw-semibold transition-btn rounded-pill"
                        :class="filterGroup === 'control' ? 'btn-teal text-white shadow-sm' : 'btn-light text-secondary border'"
                        @click="filterGroup = 'control'">
                  對照組 ({{ patients.filter(p => p.group === 'control').length }})
                </button>
                <button class="btn btn-sm px-3.5 py-1.5 fw-semibold transition-btn rounded-pill"
                        :class="filterGroup === 'partial' ? 'btn-teal text-white shadow-sm' : 'btn-light text-secondary border'"
                        @click="filterGroup = 'partial'">
                  部分介入 ({{ patients.filter(p => p.group === 'partial').length }})
                </button>
              </div>
            </div>
            
            <button class="btn btn-outline-teal btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1.5 transition-btn" @click="load" aria-label="重新整理數據">
              <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>重新整理
            </button>
          </div>
        </div>

        <!-- 資料表 -->
        <div class="clinical-card overflow-hidden">
          <div class="table-responsive">
            <table class="clinical-table mb-0" style="font-size: .86rem;">
              <thead>
                <tr>
                  <th scope="col" @click="sortBy('researchId')" style="cursor: pointer; white-space: nowrap;" class="user-select-none">
                    研究編號 <i :class="sortIcon('researchId')" aria-hidden="true"></i>
                  </th>
                  <th scope="col" @click="sortBy('group')" style="cursor: pointer; white-space: nowrap;" class="user-select-none">
                    組別 <i :class="sortIcon('group')" aria-hidden="true"></i>
                  </th>
                  <th scope="col" @click="sortBy('lastDays')" style="cursor: pointer; white-space: nowrap;" class="user-select-none">
                    追蹤天數 <i :class="sortIcon('lastDays')" aria-hidden="true"></i>
                  </th>
                  <th scope="col" class="text-center" style="white-space: nowrap;">術前 → 術後 VAS</th>
                  <th scope="col" @click="sortBy('vasBackImprove')" style="cursor: pointer; white-space: nowrap;" class="text-center user-select-none">
                    VAS 改善 <i :class="sortIcon('vasBackImprove')" aria-hidden="true"></i>
                  </th>
                  <th scope="col" class="text-center" style="white-space: nowrap;">VAS MCID</th>
                  <th scope="col" class="text-center" style="white-space: nowrap;">術前 → 術後 ODI%</th>
                  <th scope="col" @click="sortBy('odiImprove')" style="cursor: pointer; white-space: nowrap;" class="text-center user-select-none">
                    ODI 改善 <i :class="sortIcon('odiImprove')" aria-hidden="true"></i>
                  </th>
                  <th scope="col" class="text-center" style="white-space: nowrap;">ODI MCID</th>
                  <th scope="col" class="text-center" style="white-space: nowrap;">PASS 狀態</th>
                  <th scope="col" @click="sortBy('anchorQ')" style="cursor: pointer; white-space: nowrap;" class="text-center user-select-none">
                    PGIC 指標 <i :class="sortIcon('anchorQ')" aria-hidden="true"></i>
                  </th>
                  <th scope="col" class="text-center" style="white-space: nowrap; width: 90px;">追蹤點數</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filtered.length === 0">
                  <td colspan="12" class="text-center text-muted py-5">無符合條件的 MCID 達成記錄</td>
                </tr>
                <tr v-for="p in filtered" :key="p.researchId">
                  <td class="tabular-nums font-semibold"><strong>{{ p.researchId }}</strong></td>
                  <td>
                    <span class="badge" :style="getGroupBadgeStyle(p.group)">
                      {{ getGroupLabel(p.group) }}
                    </span>
                  </td>
                  <td class="tabular-nums text-muted">{{ fmt(p.lastDays, ' 天') }}</td>
                  <td class="text-center tabular-nums">
                    <span v-if="p.preVasBack !== '' && p.preVasBack !== null" class="d-inline-flex align-items-center gap-1">
                      {{ p.preVasBack }} <i class="bi bi-arrow-right text-muted small" aria-hidden="true"></i> {{ fmt(p.postVasBack) }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center tabular-nums font-semibold">
                    <span v-if="p.vasBackImprove !== null"
                          :class="p.vasBackImprove >= 2.5 ? 'text-success' : p.vasBackImprove >= 0 ? 'text-warning' : 'text-danger'">
                      {{ p.vasBackImprove > 0 ? '+' : '' }}{{ p.vasBackImprove }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center">
                    <span v-if="p.lastDays !== null && p.vasMcid" class="badge" style="background: #e6fdf5; color: #0f766e; border: 1px solid #ccfbf1;">
                      <i class="bi bi-check-circle-fill me-1" aria-hidden="true"></i>達成
                    </span>
                    <span v-else-if="p.lastDays !== null && !p.vasMcid" class="badge" style="background: #fef2f2; color: #b91c1c; border: 1px solid #fee2e2;">
                      <i class="bi bi-x-circle-fill me-1" aria-hidden="true"></i>未達
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center tabular-nums">
                    <span v-if="p.preOdi !== '' && p.preOdi !== null" class="d-inline-flex align-items-center gap-1">
                      {{ p.preOdi }}% <i class="bi bi-arrow-right text-muted small" aria-hidden="true"></i> {{ fmt(p.postOdi, '%') }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center tabular-nums font-semibold">
                    <span v-if="p.odiImprove !== null"
                          :class="p.odiImprove >= 12.8 ? 'text-success' : p.odiImprove >= 0 ? 'text-warning' : 'text-danger'">
                      {{ p.odiImprove > 0 ? '+' : '' }}{{ p.odiImprove }}%
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center">
                    <span v-if="p.lastDays !== null && p.odiMcid" class="badge" style="background: #e6fdf5; color: #0f766e; border: 1px solid #ccfbf1;">
                      <i class="bi bi-check-circle-fill me-1" aria-hidden="true"></i>達成
                    </span>
                    <span v-else-if="p.lastDays !== null && !p.odiMcid" class="badge" style="background: #fef2f2; color: #b91c1c; border: 1px solid #fee2e2;">
                      <i class="bi bi-x-circle-fill me-1" aria-hidden="true"></i>未達
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center">
                    <span v-if="p.lastDays !== null && p.pass !== null"
                          class="badge"
                          :style="p.pass ? 'background: #ecfeff; color: #0891b2; border: 1px solid #cffafe;' : 'background: #fff1f2; color: #e11d48; border: 1px solid #ffe4e6;'">
                      {{ p.pass ? '滿意 (Y)' : '未滿意 (N)' }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center">
                    <span v-if="p.anchorQ" class="fw-semibold font-monospace" :class="p.anchorQ >= 5 ? 'text-success' : 'text-secondary'">
                      {{ p.anchorQ }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center tabular-nums text-muted font-monospace">{{ p.recordCount }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </template>
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
.btn-outline-teal {
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  background: transparent;
}
.btn-outline-teal:hover {
  background-color: var(--color-primary);
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
</style>
