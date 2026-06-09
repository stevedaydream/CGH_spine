<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const pageTitle = computed(() => {
  const path = route.path
  if (path === '/') return { brand: '脊椎手術智慧追蹤系統', sub: '臨床管理端', icon: 'bi-house' }
  if (path === '/form') return { brand: '脊椎手術智慧追蹤系統', sub: '新增追蹤個案', icon: 'bi-person-plus' }
  if (path === '/clinic') return { brand: '回診登記與智慧檢索', sub: '臨床管理端', icon: 'bi-clipboard2-pulse' }
  if (path === '/analytics') return { brand: '脊椎手術智慧追蹤系統', sub: 'AI 分析儀表板', icon: 'bi-bar-chart-line' }
  if (path === '/mcid') return { brand: 'MCID 達成分析', sub: '臨床管理端', icon: 'bi-graph-up-arrow' }
  if (path === '/export') return { brand: '資料匯出與預覽', sub: '臨床管理端', icon: 'bi-download' }
  if (path === '/irb') return { brand: '國泰 IRB 審查文件指引', sub: '院內送審導引', icon: 'bi-shield-check' }
  if (path === '/bot-management') return { brand: '系統設定', sub: '臨床管理端', icon: 'bi-gear' }
  if (path === '/demo') return { brand: '系統功能 Demo 演示', sub: '展示導覽環境', icon: 'bi-play-circle' }
  return { brand: '脊椎手術智慧追蹤系統', sub: '臨床管理端', icon: 'bi-house' }
})

const menuItems = [
  { path: '/', label: '儀表板', icon: 'bi-house', type: 'standard' },
  { path: '/form', label: '手術登錄', icon: 'bi-person-plus', type: 'standard' },
  { path: '/clinic', label: '回診登記', icon: 'bi-clipboard2-pulse', type: 'standard' },
  { path: '/analytics', label: '分析', icon: 'bi-bar-chart-line', type: 'standard' },
  { path: '/mcid', label: 'MCID', icon: 'bi-graph-up-arrow', type: 'standard' },
  { path: '/export', label: '匯出', icon: 'bi-download', type: 'standard' },
  { path: '/irb', label: 'IRB表單', icon: 'bi-shield-check', type: 'standard' },
  { path: '/bot-management', label: '系統設定', icon: 'bi-gear', type: 'standard' },
  { path: '/demo', label: 'Demo演示', icon: 'bi-play-circle', type: 'warning' }
]
</script>

<template>
  <div>
    <!-- Desktop Top Navbar (screens >= 992px) -->
    <nav class="desktop-navbar d-none d-lg-flex px-4 py-3 shadow-sm border-bottom">
      <div class="container-fluid p-0 d-flex justify-content-between align-items-center">
        <span class="navbar-brand fw-bold fs-5 d-flex align-items-center" style="white-space: nowrap;">
          <i :class="'bi ' + pageTitle.icon + ' me-2'" aria-hidden="true"></i>{{ pageTitle.brand }}
        </span>
        <div class="d-flex gap-2 flex-wrap align-items-center">
          <span class="text-white-50 small me-2.5 tabular-nums">{{ pageTitle.sub }}</span>
          
          <RouterLink v-for="item in menuItems" :key="item.path"
                      :to="item.path"
                      class="btn btn-sm px-3 py-1.5 fw-medium d-flex align-items-center gap-1 transition-btn"
                      :class="[
                        route.path === item.path
                          ? (item.type === 'warning' ? 'btn-warning text-dark' : 'btn-light text-dark shadow-sm')
                          : (item.type === 'warning' ? 'btn-outline-warning' : 'btn-outline-light')
                      ]">
            <i :class="'bi ' + item.icon" aria-hidden="true"></i>{{ item.label }}
          </RouterLink>
        </div>
      </div>
    </nav>

    <!-- Mobile Fixed Bottom Navbar (screens < 992px) -->
    <nav class="mobile-navbar d-lg-none fixed-bottom shadow-lg border-top">
      <!-- 當前頁面抬頭 -->
      <div class="mobile-header px-3.5 py-2 border-bottom d-flex align-items-center justify-content-between">
        <span class="fw-bold small d-flex align-items-center gap-1.5">
          <i :class="'bi ' + pageTitle.icon + ' text-accent'" aria-hidden="true"></i>{{ pageTitle.brand }}
        </span>
        <span class="text-muted" style="font-size: 0.72rem;">{{ pageTitle.sub }}</span>
      </div>
      
      <!-- 滾動式選單按鈕列 -->
      <div class="mobile-menu-scroll d-flex gap-2 px-3" style="padding-top: 10px; padding-bottom: 10px;">
        <RouterLink v-for="item in menuItems" :key="item.path"
                    :to="item.path"
                    class="btn fw-semibold d-flex align-items-center gap-2 transition-btn rounded-pill text-nowrap"
                    style="padding: 10px 18px; min-height: 44px;"
                    :class="[
                      route.path === item.path
                        ? (item.type === 'warning' ? 'btn-warning-active text-dark shadow-sm' : 'btn-active-teal text-white shadow-sm')
                        : 'btn-mobile-inactive text-secondary'
                    ]">
          <i :class="'bi ' + item.icon" aria-hidden="true" style="font-size: 1.1rem;"></i>
          <span style="font-size: 0.88rem;">{{ item.label }}</span>
        </RouterLink>
      </div>
    </nav>
  </div>
</template>

<style scoped>
/* ── Desktop Navbar ── */
.desktop-navbar {
  background: linear-gradient(135deg, var(--color-primary), #063e45);
  border-color: rgba(255, 255, 255, 0.1) !important;
}
.desktop-navbar .navbar-brand {
  color: #ffffff;
}
.transition-btn {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ── Mobile Fixed Bottom Navbar ── */
.mobile-navbar {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid rgba(226, 232, 240, 0.8) !important;
  z-index: 1050;
  padding-bottom: env(safe-area-inset-bottom);
}
.mobile-header {
  background: rgba(248, 250, 252, 0.7);
  color: var(--color-primary);
}
.text-accent {
  color: var(--color-accent) !important;
}

/* 橫向滾動容器 */
.mobile-menu-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; /* Firefox */
}
.mobile-menu-scroll::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

/* 按鈕狀態樣式 */
.btn-active-teal {
  background-color: var(--color-primary);
  border: 1px solid var(--color-primary);
}
.btn-warning-active {
  background-color: #f59e0b;
  border: 1px solid #f59e0b;
}
.btn-mobile-inactive {
  background-color: rgba(241, 245, 249, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.9);
  color: var(--color-text-muted) !important;
}
.btn-mobile-inactive:hover {
  background-color: #e2e8f0;
}
</style>
