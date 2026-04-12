import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const GAS_URL = process.env.VITE_GAS_URL ||
  'https://script.google.com/macros/s/AKfycbxRZHwOH8LNA-SgYJUiDcG62cWfcdALQrH8fJYyFcbfR42T6u-up_xlPfsutZnUKam8Ng/exec'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/gas-proxy': {
        target: GAS_URL,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/gas-proxy/, ''),
        followRedirects: true
      }
    }
  }
})
