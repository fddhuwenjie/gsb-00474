import { create } from 'zustand'
import { basicApi, api, type Department, type Employee, type ShiftTemplate } from '@/lib/api'

export interface CurrentUser {
  id: number
  name: string
  role: 'employee' | 'manager' | 'admin'
  department_id: number
  employee_no: string
}

interface AppState {
  currentUser: CurrentUser
  departments: Department[]
  employees: Employee[]
  shiftTemplates: ShiftTemplate[]
  loading: boolean
  error: string | null
  setCurrentUser: (user: CurrentUser) => void
  loadBasicData: () => Promise<void>
}

const defaultUser: CurrentUser = {
  id: 1,
  name: '张伟',
  role: 'manager',
  department_id: 1,
  employee_no: 'EMP001',
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: defaultUser,
  departments: [],
  employees: [],
  shiftTemplates: [],
  loading: false,
  error: null,

  setCurrentUser: (user: CurrentUser) => set({ currentUser: user }),

  loadBasicData: async () => {
    set({ loading: true, error: null })
    try {
      const [deptRes, empRes, shiftRes] = await Promise.all([
        basicApi.getDepartments(),
        basicApi.getEmployees(),
        api.getShiftTemplates(),
      ])
      const departments = deptRes.success ? deptRes.data || [] : []
      const employees = empRes.success ? empRes.data || [] : []
      const shiftTemplates = shiftRes.success ? shiftRes.data || [] : []
      set({ departments, employees, shiftTemplates, loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '加载基础数据失败',
        loading: false,
      })
    }
  },
}))

export const selectIsManager = (state: AppState): boolean =>
  state.currentUser.role === 'manager' || state.currentUser.role === 'admin'
