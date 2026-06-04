<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({ modelValue: { type: Number, default: null } })
const emit = defineEmits(['update:modelValue'])

// Refined color variables matching Dashboard/Clinic views
const COLORS = [
  '#10b981', '#10b981', '#10b981', // 0-2 (Mild)
  '#f59e0b', '#f59e0b', '#f59e0b', // 3-5 (Moderate)
  '#f97316', '#f97316', '#f97316', // 6-8 (Severe)
  '#ef4444', '#ef4444'             // 9-10 (Very Severe)
]

const darkText = [3, 4, 5]
const buttonRefs = ref([])

function selectValue(val) {
  emit('update:modelValue', val)
}

function handleKeydown(e, index) {
  let nextIndex = index
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    nextIndex = Math.max(0, index - 1)
    e.preventDefault()
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    nextIndex = Math.min(10, index + 1)
    e.preventDefault()
  } else {
    return
  }
  
  selectValue(nextIndex)
  // Shift focus to the newly selected button
  buttonRefs.value[nextIndex]?.focus()
}
</script>

<template>
  <div class="d-flex flex-wrap gap-1.5 py-1" role="radiogroup" aria-label="VAS 疼痛評分 0 至 10">
    <button v-for="n in 11" :key="n - 1"
            ref="el => { if (el) buttonRefs[n - 1] = el }"
            type="button"
            role="radio"
            class="vas-btn tabular-nums"
            :aria-checked="modelValue === n - 1"
            :aria-label="`疼痛分數 ${n - 1}`"
            :tabindex="modelValue === n - 1 || (modelValue === null && n === 1) ? 0 : -1"
            :style="{
              background:  modelValue === n - 1 ? COLORS[n - 1] : '#f8fafc',
              color:       modelValue === n - 1 ? (darkText.includes(n - 1) ? '#1f2937' : '#ffffff') : '#475569',
              border:      `1px solid ${modelValue === n - 1 ? COLORS[n - 1] : '#cbd5e1'}`,
              fontWeight:  modelValue === n - 1 ? '700' : '500',
              transform:   modelValue === n - 1 ? 'scale(1.1)' : 'scale(1)',
              boxShadow:   modelValue === n - 1 ? `0 4px 10px rgba(0,0,0,0.15)` : 'none'
            }"
            @click="selectValue(n - 1)"
            @keydown="handleKeydown($event, n - 1)">
      {{ n - 1 }}
    </button>
  </div>
</template>

<style scoped>
.vas-btn {
  width: 42px;
  height: 42px;
  padding: 0;
  border-radius: 50%;
  font-size: .95rem;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  outline: none;
}
.vas-btn:hover {
  border-color: var(--color-accent) !important;
  background-color: var(--color-primary-light) !important;
  color: var(--color-primary) !important;
}
.vas-btn:focus-visible {
  outline: 3px solid rgba(20, 184, 166, 0.45) !important;
  outline-offset: 2px;
}
</style>
