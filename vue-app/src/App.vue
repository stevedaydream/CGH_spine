<script setup>
import AppNavbar from './components/AppNavbar.vue'
</script>

<template>
  <div class="app-container">
    <AppNavbar />
    <div class="main-content">
      <RouterView />
    </div>
  </div>
</template>

<style>
/* 為了避免手機版固定在底部的導覽列遮擋內容，我們在小螢幕時為主容器加上底部 Padding */
@media (max-width: 991.98px) {
  .main-content {
    padding-bottom: 110px; /* 給予手機版底部導覽列與安全區域足夠的空間 */
  }
}
</style>
