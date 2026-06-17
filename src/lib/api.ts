const BASE_URL = '/api'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })
    return (await res.json()) as ApiResponse<T>
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络请求失败' }
  }
}

function httpGet<T>(path: string) {
  return request<T>(path, { method: 'GET' })
}

function httpPost<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

function httpPut<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  })
}

function httpDelete<T>(path: string) {
  return request<T>(path, { method: 'DELETE' })
}

// ==================== Types ====================

export interface Department {
  id: number
  name: string
  created_at: string
}

export interface Position {
  id: number
  name: string
  department_id: number
  department_name: string
  created_at: string
}

export interface Employee {
  id: number
  name: string
  employee_no: string
  department_id: number
  department_name: string
  position_id: number | null
  position_name: string | null
  role: string
  hire_date: string
  manager_id: number | null
  manager_name: string | null
  created_at: string
}

export interface AttendanceRecord {
  id: number
  employeeId: number
  employeeName: string
  employeeNo: string
  departmentName: string | null
  positionName: string | null
  checkIn: string | null
  checkOut: string | null
  attendanceDate: string
  status: string
  checkInStatus: string | null
  checkOutStatus: string | null
  isFieldWork: boolean
  fieldLocation: string | null
  fieldDescription: string | null
  shiftName: string | null
  shiftType: string | null
  startTime: string | null
  endTime: string | null
  createdAt: string
}

export interface MakeupRequest {
  id: number
  employeeId: number
  employeeName: string
  employeeNo: string
  attendanceDate: string
  makeupType: string
  makeupTime: string
  reason: string
  status: string
  approverId: number | null
  approverName: string | null
  approvedAt: string | null
  createdAt: string
}

export interface LeaveRequest {
  id: number
  employeeId: number
  employeeName: string
  employeeNo?: string
  departmentId?: number
  leaveType: string
  startDate: string
  endDate: string
  duration: number
  reason: string
  status: string
  approverId: number | null
  approverName: string | null
  approvedAt: string | null
  createdAt: string
}

export interface OvertimeRequest {
  id: number
  employeeId: number
  employeeName: string
  employeeNo?: string
  departmentId?: number
  overtimeDate: string
  duration: number
  reason: string
  status: string
  approverId: number | null
  approverName: string | null
  approvedAt: string | null
  createdAt: string
}

export interface AnnualQuota {
  id?: number
  employeeId: number
  employeeName: string
  employeeNo: string
  yearsOfService: number
  quotaDays: number
  usedDays: number
  remainingDays: number
  year: number
  updatedAt?: string
}

export interface AnnualLeaveQuota {
  id?: number
  employee_id: number
  employee_name: string
  employee_no: string
  years_of_service: number
  quota_days: number
  used_days: number
  remaining_days: number
  year: number
  updated_at?: string
}

export interface RulesData {
  late_tolerance_minutes: number
  flexible_core_start: string
  flexible_core_end: string
  monthly_makeup_limit: number
  annual_leave_base: number
  annual_leave_per_year: number
  annual_leave_max: number
}

export interface TodayStats {
  total: number
  checkedIn: number
  absent: number
  late: number
}

export interface DashboardData {
  todayStats: TodayStats
  lateList: Array<{
    id: number
    name: string
    employee_no: string
    department: string
    check_in: string
    check_in_status: string
  }>
  monthAttendanceRate: number
  monthLateTop5: Array<{ name: string; late_count: number }>
  monthOvertimeTop5: Array<{ name: string; overtime_hours: number }>
  departmentRates: Array<{
    id: number
    name: string
    totalScheduled: number
    attended: number
    attendanceRate: number
  }>
}

export interface Warning {
  employeeId: number
  name: string
  employeeNo: string
  department: string
  type: string
  streakDays: number
  startDate: string
  endDate: string
  highlighted: boolean
}

export interface WarningItem extends Warning {}

export interface WarningsData {
  year: number
  month: number
  warnings: Warning[]
}

export interface PersonalReport {
  employee: { id: number; name: string; employeeNo: string }
  attendanceDays: number
  lateCount: number
  earlyLeaveCount: number
  absentCount: number
  leaveDays: number
  overtimeHours: number
  dailyRecords: Array<{
    attendance_date: string
    status: string
    check_in: string | null
    check_out: string | null
    check_in_status: string | null
    check_out_status: string | null
    is_field_work: number
    field_location: string | null
    field_description: string | null
    shift_name: string | null
    start_time: string | null
    end_time: string | null
  }>
  leaveRecords: Array<{
    leave_type: string
    start_date: string
    end_date: string
    duration: number
    status: string
  }>
}

export interface DepartmentReport {
  department: { id: number; name: string }
  year: number
  month: number
  employees: Array<{
    employeeId: number
    employeeNo: string
    name: string
    departmentId: number
    departmentName: string
    totalScheduled: number
    attendanceDays: number
    attendanceRate: number
    lateCount: number
    earlyLeaveCount: number
    absentCount: number
    leaveDays: number
    overtimeHours: number
  }>
}

export type ShiftType = 'morning' | 'afternoon' | 'night' | 'flexible'

export interface ShiftTemplate {
  id: number
  name: string
  type: ShiftType
  start_time: string | null
  end_time: string | null
  core_start: string | null
  core_end: string | null
  next_day: number
  created_at: string
}

export interface ScheduleItem {
  id: number
  employee_id: number
  employee_name: string
  employee_no: string
  department_id: number
  department_name: string
  position_name: string | null
  shift_id: number
  shift_name: string
  shift_type: string
  start_time: string | null
  end_time: string | null
  core_start: string | null
  core_end: string | null
  next_day: number
  schedule_date: string
  week_number: number
  year: number
  status: string
}

export interface Schedule extends ScheduleItem {}

// ==================== Attendance API ====================

export const attendanceApi = {
  checkIn: (data: {
    employeeId: number
    attendanceDate: string
    isFieldWork?: boolean
    fieldLocation?: string
    fieldDescription?: string
    latitude?: number
    longitude?: number
  }) => httpPost<AttendanceRecord & { outOfGeofence?: boolean; geofenceDistance?: number }>('/attendance/check-in', data),

  checkOut: (data: { employeeId: number; attendanceDate: string }) =>
    httpPost<AttendanceRecord>('/attendance/check-out', data),

  fieldCheckIn: (data: {
    employeeId: number
    attendanceDate: string
    fieldLocation: string
    fieldDescription: string
  }) => httpPost<AttendanceRecord>('/attendance/field', data),

  getRecords: (params?: {
    employeeId?: number
    startDate?: string
    endDate?: string
    departmentId?: number
  }) => {
    const qs = new URLSearchParams()
    if (params?.employeeId) qs.set('employeeId', String(params.employeeId))
    if (params?.startDate) qs.set('startDate', params.startDate)
    if (params?.endDate) qs.set('endDate', params.endDate)
    if (params?.departmentId) qs.set('departmentId', String(params.departmentId))
    return httpGet<AttendanceRecord[]>(`/attendance/records?${qs.toString()}`)
  },

  applyMakeup: (data: {
    employeeId: number
    attendanceDate: string
    makeupType: 'checkin' | 'checkout'
    makeupTime: string
    reason: string
  }) => httpPost<MakeupRequest>('/attendance/makeup', data),

  getMakeupRequests: (params?: { employeeId?: number; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.employeeId) qs.set('employeeId', String(params.employeeId))
    if (params?.status) qs.set('status', params.status)
    return httpGet<MakeupRequest[]>(`/attendance/makeup-requests?${qs.toString()}`)
  },

  approveMakeup: (data: { requestId: number; status: 'approved' | 'rejected'; approverId: number }) =>
    httpPost<MakeupRequest>('/attendance/makeup-approve', data),

  autoCorrect: (date?: string) =>
    httpPost<{ date: string; corrected: number; details: Array<{ employeeId: number; action: string }> }>('/attendance/auto-correct', { date }),
}

export interface ShiftSwapRequest {
  id: number
  requesterId: number
  requesterName: string
  targetEmployeeId: number | null
  targetEmployeeName: string | null
  swapType: 'shift_swap' | 'shift_exchange'
  originalDate: string
  targetDate: string | null
  originalShiftId: number
  originalShiftName: string
  targetShiftId: number | null
  targetShiftName: string | null
  reason: string
  targetConfirmed: boolean
  status: string
  approverId: number | null
  approverName: string | null
  approvedAt: string | null
  createdAt: string
}

export interface BusinessTripRequest {
  id: number
  employeeId: number
  employeeName: string
  employeeNo: string
  departmentName: string | null
  destination: string
  startDate: string
  endDate: string
  purpose: string
  status: string
  approverId: number | null
  approverName: string | null
  approvedAt: string | null
  createdAt: string
}

export interface OfficeLocation {
  id: number
  name: string
  latitude: number
  longitude: number
  radius: number
  isDefault: boolean
  createdAt: string
}

export interface SalaryRule {
  id: number
  employeeId: number | null
  employeeName: string | null
  employeeNo: string | null
  baseSalary: number
  lateDeduction: number
  earlyLeaveDeduction: number
  absentDeductionRatio: number
  overtimeWeekdayRate: number
  overtimeWeekendRate: number
  overtimeHolidayRate: number
  createdAt: string
  updatedAt: string
}

export interface SalaryDetail {
  employeeId: number
  employeeName: string
  employeeNo: string
  departmentName: string | null
  baseSalary: number
  lateCount: number
  lateDeduction: number
  earlyLeaveCount: number
  earlyLeaveDeduction: number
  absentCount: number
  absentDeduction: number
  overtimeHours: number
  overtimePay: number
  netSalary: number
}

export interface Notification {
  id: number
  employeeId: number
  title: string
  content: string
  type: string
  isRead: boolean
  createdAt: string
}

export interface CalendarDayData {
  date: string
  normalCount: number
  lateCount: number
  absentCount: number
  leaveCount: number
  tripCount: number
}

export interface CalendarDayDetail {
  employeeId: number
  employeeName: string
  employeeNo: string
  departmentName: string | null
  shiftName: string | null
  startTime: string | null
  endTime: string | null
  checkIn: string | null
  checkOut: string | null
  status: string | null
  checkInStatus: string | null
  checkOutStatus: string | null
  isFieldWork: boolean
  isOnTrip: boolean
  isOnLeave: boolean
}

export const swapApi = {
  apply: (data: {
    requesterId: number
    swapType: 'shift_swap' | 'shift_exchange'
    originalDate: string
    targetDate?: string
    targetEmployeeId?: number
    originalShiftId: number
    targetShiftId?: number
    reason: string
  }) => httpPost<{ id: number }>('/swap/apply', data),

  confirm: (id: number, targetEmployeeId: number) =>
    httpPost<null>(`/swap/confirm/${id}`, { targetEmployeeId }),

  approve: (id: number, approverId: number, status: 'approved' | 'rejected') =>
    httpPost<null>(`/swap/approve/${id}`, { approverId, status }),

  getRequests: (params?: { employeeId?: number; status?: string; departmentId?: number }) => {
    const qs = new URLSearchParams()
    if (params?.employeeId) qs.set('employeeId', String(params.employeeId))
    if (params?.status) qs.set('status', params.status)
    if (params?.departmentId) qs.set('departmentId', String(params.departmentId))
    return httpGet<ShiftSwapRequest[]>(`/swap/requests?${qs.toString()}`)
  },

  getMyRequests: (employeeId: number, status?: string) => {
    const qs = new URLSearchParams({ employeeId: String(employeeId) })
    if (status) qs.set('status', status)
    return httpGet<ShiftSwapRequest[]>(`/swap/my?${qs.toString()}`)
  },
}

export const tripApi = {
  apply: (data: { employeeId: number; destination: string; startDate: string; endDate: string; purpose: string }) =>
    httpPost<{ id: number }>('/trip/apply', data),

  approve: (id: number, approverId: number, status: 'approved' | 'rejected') =>
    httpPost<null>(`/trip/approve/${id}`, { approverId, status }),

  getRequests: (params?: { employeeId?: number; status?: string; departmentId?: number }) => {
    const qs = new URLSearchParams()
    if (params?.employeeId) qs.set('employeeId', String(params.employeeId))
    if (params?.status) qs.set('status', params.status)
    if (params?.departmentId) qs.set('departmentId', String(params.departmentId))
    return httpGet<BusinessTripRequest[]>(`/trip/requests?${qs.toString()}`)
  },

  check: (employeeId: number, date: string) =>
    httpGet<{ hasTrip: boolean }>(`/trip/check?employeeId=${employeeId}&date=${date}`),
}

export const officeLocationApi = {
  getAll: () => httpGet<OfficeLocation[]>('/office-locations/'),

  create: (data: { name: string; latitude: number; longitude: number; radius?: number; isDefault?: boolean }) =>
    httpPost<{ id: number }>('/office-locations/', data),

  update: (id: number, data: Partial<OfficeLocation>) =>
    httpPut<{ message: string }>(`/office-locations/${id}`, data),

  delete: (id: number) => httpDelete<{ message: string }>(`/office-locations/${id}`),

  getDefault: () => httpGet<OfficeLocation | null>('/office-locations/default'),
}

export const calendarApi = {
  getMonthly: (year: number, month: number, departmentId?: number) => {
    const qs = new URLSearchParams({ year: String(year), month: String(month) })
    if (departmentId) qs.set('departmentId', String(departmentId))
    return httpGet<CalendarDayData[]>(`/calendar/monthly?${qs.toString()}`)
  },

  getDailyDetail: (date: string, departmentId?: number) => {
    const qs = new URLSearchParams({ date })
    if (departmentId) qs.set('departmentId', String(departmentId))
    return httpGet<CalendarDayDetail[]>(`/calendar/daily-detail?${qs.toString()}`)
  },
}

export const salaryApi = {
  getRules: (employeeId?: number) => {
    const qs = employeeId ? `?employeeId=${employeeId}` : ''
    return httpGet<SalaryRule[]>(`/salary/rules${qs}`)
  },

  createRule: (data: {
    employeeId?: number | null
    baseSalary: number
    lateDeduction: number
    earlyLeaveDeduction: number
    absentDeductionRatio: number
    overtimeWeekdayRate: number
    overtimeWeekendRate: number
    overtimeHolidayRate: number
  }) => httpPost<{ id: number }>('/salary/rules', data),

  updateRule: (id: number, data: Partial<SalaryRule>) =>
    httpPut<{ message: string }>(`/salary/rules/${id}`, data),

  deleteRule: (id: number) => httpDelete<{ message: string }>(`/salary/rules/${id}`),

  calculate: (year: number, month: number, departmentId?: number, employeeId?: number) => {
    const qs = new URLSearchParams({ year: String(year), month: String(month) })
    if (departmentId) qs.set('departmentId', String(departmentId))
    if (employeeId) qs.set('employeeId', String(employeeId))
    return httpGet<SalaryDetail[]>(`/salary/calculate?${qs.toString()}`)
  },

  exportCsv: (year: number, month: number, departmentId?: number) => {
    const qs = new URLSearchParams({ year: String(year), month: String(month) })
    if (departmentId) qs.set('departmentId', String(departmentId))
    return `${BASE_URL}/salary/export-csv?${qs.toString()}`
  },
}

export const notificationApi = {
  getList: (employeeId: number, unreadOnly?: boolean) => {
    const qs = new URLSearchParams({ employeeId: String(employeeId) })
    if (unreadOnly) qs.set('unreadOnly', 'true')
    return httpGet<Notification[]>(`/notifications/?${qs.toString()}`)
  },

  markRead: (id: number) => httpPut<null>(`/notifications/read/${id}`),

  markAllRead: (employeeId: number) => httpPut<null>('/notifications/read-all', { employeeId }),
}

// ==================== Leave / Overtime API ====================

export const leaveApi = {
  applyLeave: (data: {
    employeeId: number
    leaveType: string
    startDate: string
    endDate: string
    duration: number
    reason: string
  }) => httpPost<LeaveRequest>('/leave/apply', data),

  getLeaveRequests: (params?: { employeeId?: number; status?: string; departmentId?: number }) => {
    const qs = new URLSearchParams()
    if (params?.employeeId) qs.set('employeeId', String(params.employeeId))
    if (params?.status) qs.set('status', params.status)
    if (params?.departmentId) qs.set('departmentId', String(params.departmentId))
    return httpGet<LeaveRequest[]>(`/leave/requests?${qs.toString()}`)
  },

  approveLeave: (data: { requestId: number; status: 'approved' | 'rejected'; approverId: number }) =>
    httpPost<LeaveRequest>('/leave/approve', data),

  applyOvertime: (data: {
    employeeId: number
    overtimeDate: string
    duration: number
    reason: string
  }) => httpPost<OvertimeRequest>('/leave/overtime', data),

  getOvertimeRequests: (params?: { employeeId?: number; status?: string; departmentId?: number }) => {
    const qs = new URLSearchParams()
    if (params?.employeeId) qs.set('employeeId', String(params.employeeId))
    if (params?.status) qs.set('status', params.status)
    if (params?.departmentId) qs.set('departmentId', String(params.departmentId))
    return httpGet<OvertimeRequest[]>(`/leave/overtime-requests?${qs.toString()}`)
  },

  approveOvertime: (data: { requestId: number; status: 'approved' | 'rejected'; approverId: number }) =>
    httpPost<OvertimeRequest>('/leave/overtime-approve', data),

  getAnnualQuotas: (employeeId: number) => {
    const qs = new URLSearchParams()
    qs.set('employeeId', String(employeeId))
    return httpGet<AnnualQuota[]>(`/leave/quotas?${qs.toString()}`)
  },
}

// ==================== Basic API ====================

export const basicApi = {
  getDepartments: () => httpGet<Department[]>('/basic/departments'),
  getPositions: (departmentId?: number) => {
    const qs = departmentId ? `?departmentId=${departmentId}` : ''
    return httpGet<Position[]>(`/basic/positions${qs}`)
  },
  getEmployees: (departmentId?: number) => {
    const qs = departmentId ? `?departmentId=${departmentId}` : ''
    return httpGet<Employee[]>(`/basic/employees${qs}`)
  },
}

// ==================== Reports / Rules / Dashboard API ====================

export const api = {
  getDashboard: (today?: string) => {
    const query = today ? `?today=${encodeURIComponent(today)}` : ''
    return httpGet<DashboardData>(`/reports/dashboard${query}`)
  },

  getWarnings: (year: number, month: number) =>
    httpGet<WarningsData>(`/reports/warnings?year=${year}&month=${month}`),

  getPersonalReport: (employeeId: number, year: number, month: number) =>
    httpGet<PersonalReport>(
      `/reports/personal?employeeId=${employeeId}&year=${year}&month=${month}`,
    ),

  getDepartmentReport: (departmentId: number, year: number, month: number) =>
    httpGet<DepartmentReport>(
      `/reports/department?departmentId=${departmentId}&year=${year}&month=${month}`,
    ),

  exportCsv: (departmentId: number, year: number, month: number) =>
    `${BASE_URL}/reports/export-csv?departmentId=${departmentId}&year=${year}&month=${month}`,

  getRules: () => httpGet<RulesData>('/rules/'),
  updateRules: (data: Partial<RulesData>) => httpPut<RulesData>('/rules/', data),
  recalculateQuotas: () => httpPost<{
    updatedCount: number
    rules: { annualLeaveBase: number; annualLeavePerYear: number; annualLeaveMax: number }
    quotas: AnnualLeaveQuota[]
  }>('/rules/recalculate-quotas'),

  // Schedule APIs grouped here for convenience
  getShiftTemplates: () => httpGet<ShiftTemplate[]>('/schedule/shift-templates'),
  createShiftTemplate: (data: Partial<ShiftTemplate>) =>
    httpPost<{ id: number }>('/schedule/shift-templates', data),
  updateShiftTemplate: (id: number, data: Partial<ShiftTemplate>) =>
    httpPut<{ message: string }>(`/schedule/shift-templates/${id}`, data),
  deleteShiftTemplate: (id: number) =>
    httpDelete<{ message: string }>(`/schedule/shift-templates/${id}`),

  getWeekSchedule: (weekStart: string, departmentId?: number, employeeId?: number) => {
    const params = new URLSearchParams({ weekStart })
    if (departmentId) params.set('departmentId', String(departmentId))
    if (employeeId) params.set('employeeId', String(employeeId))
    return httpGet<ScheduleItem[]>(`/schedule/weeks?${params.toString()}`)
  },

  createSchedule: (data: { employeeId: number; shiftId: number; scheduleDate: string }) =>
    httpPost<{ id: number }>('/schedule', data),

  updateSchedule: (id: number, data: { shiftId?: number; scheduleDate?: string }) =>
    httpPut<{ message: string }>(`/schedule/${id}`, data),

  deleteSchedule: (id: number) => httpDelete<{ message: string }>(`/schedule/${id}`),

  batchSchedule: (data: {
    departmentId?: number
    positionId?: number
    employeeIds?: number[]
    shiftId: number
    weekStart: string
    days: number[]
  }) => httpPost<{ total: number; message: string }>('/schedule/batch', data),

  publishSchedule: (data: { weekStart: string; employeeIds?: number[] }) =>
    httpPost<{ updated: number; message: string }>('/schedule/publish', data),
}

// ==================== Standalone helpers for import destructuring ====================

export function getDashboard(today?: string) {
  return api.getDashboard(today)
}
export function getWarnings(year: number, month: number) {
  return api.getWarnings(year, month)
}
export function getShiftTemplates() {
  return api.getShiftTemplates()
}
export function createShiftTemplate(data: Partial<ShiftTemplate>) {
  return api.createShiftTemplate(data)
}
export function updateShiftTemplate(id: number, data: Partial<ShiftTemplate>) {
  return api.updateShiftTemplate(id, data)
}
export function deleteShiftTemplate(id: number) {
  return api.deleteShiftTemplate(id)
}
export function getWeekSchedule(weekStart: string, departmentId?: number, employeeId?: number) {
  return api.getWeekSchedule(weekStart, departmentId, employeeId)
}
export function createSchedule(data: { employeeId: number; shiftId: number; scheduleDate: string }) {
  return api.createSchedule(data)
}
export function updateSchedule(id: number, data: { shiftId?: number; scheduleDate?: string }) {
  return api.updateSchedule(id, data)
}
export function batchSchedule(data: {
  departmentId?: number
  positionId?: number
  employeeIds?: number[]
  shiftId: number
  weekStart: string
  days: number[]
}) {
  return api.batchSchedule(data)
}
export function publishSchedule(data: { weekStart: string; employeeIds?: number[] }) {
  return api.publishSchedule(data)
}
export function getDepartments() {
  return basicApi.getDepartments()
}
export function getPositions(departmentId?: number) {
  return basicApi.getPositions(departmentId)
}
export function getEmployees(departmentId?: number) {
  return basicApi.getEmployees(departmentId)
}
export function del(path: string) {
  return httpDelete(path)
}
