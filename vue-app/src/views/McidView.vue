<script setup>
import { ref, computed, onMounted } from 'vue'
import { getMcidData } from '../api/gas.js'

const loading = ref(true)
const summary = ref({})
const patients = ref([])

const sortKey = ref('researchId')
const sortAsc = ref(true)
const filterGroup = ref('')

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await getMcidData()
    summary.value  = data.summary  || {}
    patients.value = data.patients || []
  } catch (e) {
    summary.value  = {}
    patients.value = []
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
  if (sortKey.value !== key) return 'bi-arrow-down-up text-muted'
  return sortAsc.value ? 'bi-sort-down-alt' : 'bi-sort-up-alt'
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

function improveBadge(val, threshold) {
  if (val === null || val === undefined || val === '') return ''
  return val >= threshold ? 'bg-success' : val >= 0 ? 'bg-warning text-dark' : 'bg-danger'
}
</script>

<template>
  <div style="background:#f0f4f8; min-height:100vh; font-family:'Segoe UI',sans-serif">

    <!-- Navbar -->
    <nav class="navbar navbar-dark px-3 py-2" style="background:linear-gradient(135deg,#1a73e8,#0d47a1)">
      <span class="navbar-brand fw-bold">
        <i class="bi bi-graph-up-arrow me-2"></i>MCID 達成分析
      </span>
      <div class="d-flex gap-2">
        <RouterLink to="/"          class="btn btn-outline-light btn-sm"><i class="bi bi-house me-1"></i>後台</RouterLink>
        <RouterLink to="/form"      class="btn btn-outline-light btn-sm"><i class="bi bi-pencil-square me-1"></i>填表</RouterLink>
        <RouterLink to="/analytics" class="btn btn-outline-light btn-sm"><i class="bi bi-bar-chart-line me-1"></i>分析</RouterLink>
      </div>
    </nav>

    <div class="container-fluid py-4 px-4">

      <!-- Loading -->
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
        <div class="mt-2 text-muted">載入中...</div>
      </div>

      <template v-else>

        <!-- 說明提示 -->
        <div class="alert alert-info py-2 mb-3 small">
          <i class="bi bi-info-circle me-1"></i>
          MCID 定義：VAS 改善 ≥ 2.5 分；ODI 改善 ≥ 12.8%。PASS：術後 VAS_back ≤ 3。
          術後數據優先取 D70–D84，否則取最後一筆已確認記錄。
          <span v-if="summary.total < 15" class="text-danger fw-bold ms-2">
            ⚠ 樣本量不足（n={{ summary.total }}），結論僅供參考，請勿用於正式發表。
          </span>
        </div>

        <!-- 摘要卡片 -->
        <div class="row g-3 mb-4">
          <div class="col-6 col-md-3">
            <div class="card border-0 shadow-sm text-center py-3">
              <div class="fs-2 fw-bold text-primary">{{ summary.total ?? '—' }}</div>
              <div class="text-muted small">總病患數</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="card border-0 shadow-sm text-center py-3">
              <div class="fs-2 fw-bold text-success">{{ summary.vasMcidPct ?? '—' }}%</div>
              <div class="text-muted small">VAS MCID 達成率</div>
              <div class="small text-muted">(n={{ summary.vasMcidN ?? 0 }})</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="card border-0 shadow-sm text-center py-3">
              <div class="fs-2 fw-bold" style="color:#9c27b0">{{ summary.odiMcidPct ?? '—' }}%</div>
              <div class="text-muted small">ODI MCID 達成率</div>
              <div class="small text-muted">(n={{ summary.odiMcidN ?? 0 }})</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="card border-0 shadow-sm text-center py-3">
              <div class="fs-2 fw-bold text-warning">{{ summary.passPct ?? '—' }}%</div>
              <div class="text-muted small">PASS 達成率</div>
              <div class="small text-muted">(n={{ summary.passN ?? 0 }})</div>
            </div>
          </div>
        </div>

        <!-- 篩選列 -->
        <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">
          <label class="form-label mb-0 fw-bold">介入組別：</label>
          <div class="btn-group btn-group-sm">
            <input type="radio" class="btn-check" id="gAll"      v-model="filterGroup" value="">
            <label class="btn btn-outline-secondary" for="gAll">全部</label>
            <input type="radio" class="btn-check" id="gBot"      v-model="filterGroup" value="line_bot">
            <label class="btn btn-outline-primary"   for="gBot">Line Bot 組</label>
            <input type="radio" class="btn-check" id="gCtrl"     v-model="filterGroup" value="control">
            <label class="btn btn-outline-secondary" for="gCtrl">對照組</label>
            <input type="radio" class="btn-check" id="gPartial"  v-model="filterGroup" value="partial">
            <label class="btn btn-outline-warning"   for="gPartial">部分介入</label>
          </div>
          <button class="btn btn-outline-primary btn-sm ms-auto" @click="load">
            <i class="bi bi-arrow-clockwise me-1"></i>重新載入
          </button>
        </div>

        <!-- 資料表 -->
        <div class="card border-0 shadow-sm">
          <div class="table-responsive">
            <table class="table table-hover mb-0 align-middle" style="font-size:.85rem">
              <thead style="background:#e8f0fe">
                <tr>
                  <th @click="sortBy('researchId')" style="cursor:pointer;white-space:nowrap">
                    研究編號 <i :class="'bi ' + sortIcon('researchId')"></i>
                  </th>
                  <th @click="sortBy('group')" style="cursor:pointer">
                    組別 <i :class="'bi ' + sortIcon('group')"></i>
                  </th>
                  <th @click="sortBy('lastDays')" style="cursor:pointer;white-space:nowrap">
                    最後追蹤天 <i :class="'bi ' + sortIcon('lastDays')"></i>
                  </th>
                  <th class="text-center">術前→術後<br>VAS_back</th>
                  <th @click="sortBy('vasBackImprove')" style="cursor:pointer" class="text-center">
                    VAS改善 <i :class="'bi ' + sortIcon('vasBackImprove')"></i>
                  </th>
                  <th class="text-center">MCID<br>(VAS≥2.5)</th>
                  <th class="text-center">術前→術後<br>ODI%</th>
                  <th @click="sortBy('odiImprove')" style="cursor:pointer" class="text-center">
                    ODI改善 <i :class="'bi ' + sortIcon('odiImprove')"></i>
                  </th>
                  <th class="text-center">MCID<br>(ODI≥12.8%)</th>
                  <th class="text-center">PASS</th>
                  <th @click="sortBy('anchorQ')" style="cursor:pointer" class="text-center">
                    PGIC <i :class="'bi ' + sortIcon('anchorQ')"></i>
                  </th>
                  <th class="text-center">記錄筆數</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filtered.length === 0">
                  <td colspan="12" class="text-center text-muted py-4">無資料</td>
                </tr>
                <tr v-for="p in filtered" :key="p.researchId">
                  <td class="fw-bold">{{ p.researchId }}</td>
                  <td>
                    <span :class="p.group === 'line_bot' ? 'badge bg-primary'
                                : p.group === 'control'  ? 'badge bg-secondary'
                                                         : 'badge bg-warning text-dark'">
                      {{ p.group === 'line_bot' ? 'Bot' : p.group === 'control' ? '對照' : '部分' }}
                    </span>
                  </td>
                  <td class="text-muted">{{ fmt(p.lastDays, ' 天') }}</td>
                  <td class="text-center">
                    <span v-if="p.preVasBack !== '' && p.preVasBack !== null">
                      {{ p.preVasBack }} → {{ fmt(p.postVasBack) }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center">
                    <span v-if="p.vasBackImprove !== null"
                          :class="'badge ' + improveBadge(p.vasBackImprove, 2.5)">
                      {{ p.vasBackImprove > 0 ? '+' : '' }}{{ p.vasBackImprove }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center">
                    <i v-if="p.lastDays !== null && p.vasMcid"    class="bi bi-check-circle-fill text-success fs-5"></i>
                    <i v-else-if="p.lastDays !== null && !p.vasMcid" class="bi bi-x-circle text-danger fs-5"></i>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center">
                    <span v-if="p.preOdi !== '' && p.preOdi !== null">
                      {{ p.preOdi }}% → {{ fmt(p.postOdi, '%') }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center">
                    <span v-if="p.odiImprove !== null"
                          :class="'badge ' + improveBadge(p.odiImprove, 12.8)">
                      {{ p.odiImprove > 0 ? '+' : '' }}{{ p.odiImprove }}%
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center">
                    <i v-if="p.lastDays !== null && p.odiMcid"    class="bi bi-check-circle-fill text-success fs-5"></i>
                    <i v-else-if="p.lastDays !== null && !p.odiMcid" class="bi bi-x-circle text-danger fs-5"></i>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center">
                    <span v-if="p.lastDays !== null && p.pass !== null"
                          :class="'badge ' + (p.pass ? 'bg-success' : 'bg-danger')">
                      {{ p.pass ? 'Y' : 'N' }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center">
                    <span v-if="p.anchorQ" class="fw-bold">{{ p.anchorQ }}</span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-center text-muted">{{ p.recordCount }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </template>
    </div>

  </div>
</template>

<style scoped>
th { white-space: nowrap; }
</style>
