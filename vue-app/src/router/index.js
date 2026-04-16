import { createRouter, createWebHistory } from 'vue-router'
import DashboardView      from '../views/DashboardView.vue'
import AnalyticsView      from '../views/AnalyticsView.vue'
import FormView           from '../views/FormView.vue'
import McidView           from '../views/McidView.vue'
import ExportView         from '../views/ExportView.vue'
import BotManagementView  from '../views/BotManagementView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',                component: DashboardView     },
    { path: '/analytics',       component: AnalyticsView     },
    { path: '/form',            component: FormView          },
    { path: '/mcid',            component: McidView          },
    { path: '/export',          component: ExportView        },
    { path: '/bot-management',  component: BotManagementView }
  ]
})
