<script setup>
defineProps({ modelValue: { type: Number, default: null } })
defineEmits(['update:modelValue'])

const COLORS = [
  '#34a853','#4caf50','#8bc34a','#cddc39','#ffeb3b',
  '#ffc107','#ff9800','#ff5722','#f44336','#e53935','#b71c1c'
]
const darkText = [3, 4, 5]
</script>

<template>
  <div class="d-flex flex-wrap gap-1">
    <button v-for="n in 11" :key="n - 1"
            type="button"
            class="vas-btn"
            :style="{
              background:  modelValue === n - 1 ? COLORS[n - 1] : '#f8f9fa',
              color:       modelValue === n - 1 ? (darkText.includes(n - 1) ? '#333' : '#fff') : '#555',
              border:      `2px solid ${COLORS[n - 1]}`,
              fontWeight:  modelValue === n - 1 ? '700' : '400',
              transform:   modelValue === n - 1 ? 'scale(1.15)' : 'scale(1)'
            }"
            @click="$emit('update:modelValue', n - 1)">
      {{ n - 1 }}
    </button>
  </div>
</template>

<style scoped>
.vas-btn {
  width: 40px; height: 40px; padding: 0;
  border-radius: 50%; font-size: .9rem;
  cursor: pointer; transition: all .15s;
}
.vas-btn:hover { opacity: .85; }
</style>
