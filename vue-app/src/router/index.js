import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import AnalyticsView from '../views/AnalyticsView.vue'
import FormView      from '../views/FormView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',          component: DashboardView },
    { path: '/analytics', component: AnalyticsView },
    { path: '/form',      component: FormView      }
  ]
})
