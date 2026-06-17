import { useState, useEffect, useMemo } from 'react'
import {
  BarChart3,
  Users,
  AlertTriangle,
  Download,
  CalendarDays,
  Clock,
  UserCheck,
  XCircle,
  LogOut,
  FileText,
  Timer,
  ChevronUp,
  ChevronDown,
  User,
  Building2,
} from 'lucide-react'
import {
  api,
  basicApi,
  type Department,
  type Employee,
  type PersonalReport,
  type DepartmentReport,
  type Warning,
} from '@/lib/api'
import { cn } from '@/lib/utils'

type TabKey = 'personal' | 'department' | 'warnings' | 'export'

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'personal', label: '个人考勤', icon: UserCheck },
  { key: 'department', label: '部门报表', icon: Users },
  { key: 'warnings', label: '异常预警', icon: AlertTriangle },
  { key: 'export', label: '导出', icon: Download },
]

function getCurrentYearMonth() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function getStatusBadge(status: string, checkInStatus: string | null, checkOutStatus: string | null) {
  if (status === 'leave') return { text: '请假', className: 'bg-blue-100 text-blue-700' }
  if (status === 'absent') return { text: '缺勤', className: 'bg-red-100 text-red-700' }
  if (checkInStatus === 'late' || status === 'late') return { text: '迟到', className: 'bg-orange-100 text-orange-700' }
  if (checkOutStatus === 'early_leave' || status === 'early_leave') return { text: '早退', className: 'bg-yellow-100 text-yellow-700' }
  if (status === 'field_work') return { text: '外勤', className: 'bg-teal-100 text-teal-700' }
  return { text: '正常', className: 'bg-green-100 text-green-700' }
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  unit?: string
  color: string
}

function StatCard({ icon: Icon, label, value, unit, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-2">{label}</p>
          <div className="flex items-baseline gap-1">
            <span className={cn('text-3xl font-bold', color)}>{value}</span>
            {unit && <span className="text-sm text-gray-500">{unit}</span>}
          </div>
        </div>
        <div className={cn('p-3 rounded-lg bg-opacity-10', color.replace('text-', 'bg-'))}>
          <Icon className={cn('w-6 h-6', color)} />
        </div>
      </div>
    </div>
  )
}

interface Option {
  value: number
  label: string
}

function SelectField({
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
}: {
  value: number | string
  onChange: (v: number) => void
  options: Option[]
  placeholder: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          'w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm text-gray-900 shadow-sm',
          'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all',
          Icon ? 'pl-10 pr-8' : 'pl-4 pr-8',
        )}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<TabKey>('personal')

  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  const { year: currentYear, month: currentMonth } = getCurrentYearMonth()

  useEffect(() => {
    basicApi.getDepartments().then(res => { if (res.success) setDepartments(res.data || []) }).catch(console.error)
    basicApi.getEmployees().then(res => { if (res.success) setEmployees(res.data || []) }).catch(console.error)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
            统计报表
          </h1>
          <p className="text-gray-500 mt-1">查看考勤统计、部门报表和异常预警信息</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="flex border-b border-gray-200">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-all -mb-px',
                    active
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {activeTab === 'personal' && <PersonalTab employees={employees} currentYear={currentYear} currentMonth={currentMonth} />}
        {activeTab === 'department' && <DepartmentTab departments={departments} currentYear={currentYear} currentMonth={currentMonth} />}
        {activeTab === 'warnings' && <WarningsTab currentYear={currentYear} currentMonth={currentMonth} />}
        {activeTab === 'export' && <ExportTab departments={departments} currentYear={currentYear} currentMonth={currentMonth} />}
      </div>
    </div>
  )
}

function PersonalTab({
  employees,
  currentYear,
  currentMonth,
}: {
  employees: Employee[]
  currentYear: number
  currentMonth: number
}) {
  const [employeeId, setEmployeeId] = useState<number>(employees[0]?.id ?? 0)
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [report, setReport] = useState<PersonalReport | null>(null)
  const [loading, setLoading] = useState(false)

  const employeeOptions = useMemo(
    () => employees.map((e) => ({ value: e.id, label: `${e.employee_no} - ${e.name}（${e.department_name}）` })),
    [employees],
  )
  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({ value: currentYear - 2 + i, label: `${currentYear - 2 + i}年` })),
    [currentYear],
  )
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` })),
    [],
  )

  useEffect(() => {
    if (employeeOptions.length > 0 && !employeeId) {
      setEmployeeId(employeeOptions[0].value)
    }
  }, [employeeOptions, employeeId])

  useEffect(() => {
    if (!employeeId) return
    setLoading(true)
    api
      .getPersonalReport(employeeId, year, month)
      .then(res => { if (res.success) setReport(res.data || null) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [employeeId, year, month])

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectField
            value={employeeId}
            onChange={setEmployeeId}
            options={employeeOptions}
            placeholder="请选择员工"
            icon={User}
          />
          <SelectField value={year} onChange={setYear} options={yearOptions} placeholder="选择年份" icon={CalendarDays} />
          <SelectField value={month} onChange={setMonth} options={monthOptions} placeholder="选择月份" icon={CalendarDays} />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">加载中...</div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard icon={CalendarDays} label="出勤天数" value={report.attendanceDays} unit="天" color="text-green-600" />
            <StatCard icon={Clock} label="迟到次数" value={report.lateCount} unit="次" color="text-orange-600" />
            <StatCard icon={LogOut} label="早退次数" value={report.earlyLeaveCount} unit="次" color="text-yellow-600" />
            <StatCard icon={XCircle} label="缺勤天数" value={report.absentCount} unit="天" color="text-red-600" />
            <StatCard icon={FileText} label="请假天数" value={report.leaveDays} unit="天" color="text-blue-600" />
            <StatCard icon={Timer} label="加班时长" value={report.overtimeHours} unit="小时" color="text-indigo-600" />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">每日明细</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">日期</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">班次</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">上班</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">下班</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">状态</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">备注</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.dailyRecords.map((rec, idx) => {
                    const badge = getStatusBadge(rec.status, rec.check_in_status, rec.check_out_status)
                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-sm text-gray-900">{rec.attendance_date}</td>
                        <td className="px-5 py-3 text-sm text-gray-700">{rec.shift_name || '—'}</td>
                        <td className="px-5 py-3 text-sm text-gray-700">
                          {rec.check_in ? rec.check_in.slice(0, 5) : '—'}
                          {rec.start_time && (
                            <span className="ml-1 text-xs text-gray-400">/{rec.start_time.slice(0, 5)}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-700">
                          {rec.check_out ? rec.check_out.slice(0, 5) : '—'}
                          {rec.end_time && (
                            <span className="ml-1 text-xs text-gray-400">/{rec.end_time.slice(0, 5)}</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-medium', badge.className)}>
                            {badge.text}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-500">
                          {rec.is_field_work ? `外勤：${rec.field_location || ''}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {report.dailyRecords.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                        暂无考勤记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">暂无数据</div>
      )}
    </div>
  )
}

function DepartmentTab({
  departments,
  currentYear,
  currentMonth,
}: {
  departments: Department[]
  currentYear: number
  currentMonth: number
}) {
  const [departmentId, setDepartmentId] = useState<number>(departments[0]?.id ?? 0)
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [report, setReport] = useState<DepartmentReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [sortField, setSortField] = useState<keyof DepartmentReport['employees'][number] | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const deptOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments],
  )
  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({ value: currentYear - 2 + i, label: `${currentYear - 2 + i}年` })),
    [currentYear],
  )
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` })),
    [],
  )

  useEffect(() => {
    if (deptOptions.length > 0 && !departmentId) {
      setDepartmentId(deptOptions[0].value)
    }
  }, [deptOptions, departmentId])

  useEffect(() => {
    if (!departmentId) return
    setLoading(true)
    api
      .getDepartmentReport(departmentId, year, month)
      .then(res => { if (res.success) setReport(res.data || null) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [departmentId, year, month])

  const sortedEmployees = useMemo(() => {
    if (!report?.employees) return []
    if (!sortField) return report.employees
    return [...report.employees].sort((a, b) => {
      const av = a[sortField] as number | string
      const bv = b[sortField] as number | string
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }, [report, sortField, sortDir])

  function handleSort(field: keyof DepartmentReport['employees'][number]) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sortableHeaders: { label: string; field: keyof DepartmentReport['employees'][number] }[] = [
    { label: '姓名/工号', field: 'name' },
    { label: '出勤', field: 'attendanceDays' },
    { label: '迟到', field: 'lateCount' },
    { label: '早退', field: 'earlyLeaveCount' },
    { label: '缺勤', field: 'absentCount' },
    { label: '请假', field: 'leaveDays' },
    { label: '加班(h)', field: 'overtimeHours' },
    { label: '出勤率(%)', field: 'attendanceRate' },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectField
            value={departmentId}
            onChange={setDepartmentId}
            options={deptOptions}
            placeholder="请选择部门"
            icon={Building2}
          />
          <SelectField value={year} onChange={setYear} options={yearOptions} placeholder="选择年份" icon={CalendarDays} />
          <SelectField value={month} onChange={setMonth} options={monthOptions} placeholder="选择月份" icon={CalendarDays} />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">加载中...</div>
      ) : report ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">{report.department.name} - {report.year}年{report.month}月考勤汇总</h3>
            <span className="text-sm text-gray-500">共 {report.employees.length} 人</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {sortableHeaders.map((h) => (
                    <th
                      key={h.field}
                      onClick={() => handleSort(h.field)}
                      className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
                    >
                      <span className="inline-flex items-center gap-1">
                        {h.label}
                        {sortField === h.field ? (
                          sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        ) : (
                          <span className="w-3 h-3 opacity-20">
                            <ChevronUp className="w-3 h-3" />
                          </span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedEmployees.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                      <div className="text-xs text-gray-500">{emp.employeeNo}</div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700">{emp.attendanceDays}</td>
                    <td className="px-5 py-3 text-sm">
                      {emp.lateCount > 0 ? (
                        <span className="text-orange-600 font-medium">{emp.lateCount}</span>
                      ) : (
                        <span className="text-gray-400">{emp.lateCount}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      {emp.earlyLeaveCount > 0 ? (
                        <span className="text-yellow-600 font-medium">{emp.earlyLeaveCount}</span>
                      ) : (
                        <span className="text-gray-400">{emp.earlyLeaveCount}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      {emp.absentCount > 0 ? (
                        <span className="text-red-600 font-medium">{emp.absentCount}</span>
                      ) : (
                        <span className="text-gray-400">{emp.absentCount}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700">{emp.leaveDays}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">{emp.overtimeHours}</td>
                    <td className="px-5 py-3 text-sm">
                      <span className={cn(
                        'font-medium',
                        emp.attendanceRate >= 95 ? 'text-green-600' : emp.attendanceRate >= 85 ? 'text-yellow-600' : 'text-red-600',
                      )}>
                        {emp.attendanceRate}%
                      </span>
                    </td>
                  </tr>
                ))}
                {sortedEmployees.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-gray-400">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">暂无数据</div>
      )}
    </div>
  )
}

function WarningsTab({ currentYear, currentMonth }: { currentYear: number; currentMonth: number }) {
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [loading, setLoading] = useState(false)

  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({ value: currentYear - 2 + i, label: `${currentYear - 2 + i}年` })),
    [currentYear],
  )
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` })),
    [],
  )

  useEffect(() => {
    setLoading(true)
    api
      .getWarnings(year, month)
      .then((res) => { if (res.success && res.data) setWarnings(res.data.warnings) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [year, month])

  const lateWarnings = warnings.filter((w) => w.type === '连续迟到')
  const absentWarnings = warnings.filter((w) => w.type === '连续缺勤未请假')

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <SelectField value={year} onChange={setYear} options={yearOptions} placeholder="选择年份" icon={CalendarDays} />
          <SelectField value={month} onChange={setMonth} options={monthOptions} placeholder="选择月份" icon={CalendarDays} />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">加载中...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-orange-500 rounded-lg">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-orange-700">连续迟到预警</p>
                  <p className="text-2xl font-bold text-orange-900">{lateWarnings.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-500 rounded-lg">
                  <XCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-red-700">连续缺勤未请假预警</p>
                  <p className="text-2xl font-bold text-red-900">{absentWarnings.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">预警列表</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {warnings.length === 0 ? (
                <div className="px-5 py-16 text-center text-gray-400">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>本月无异常预警记录</p>
                </div>
              ) : (
                warnings.map((w, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'px-5 py-4 flex items-start gap-4 transition-colors',
                      w.highlighted
                        ? w.type === '连续迟到'
                          ? 'bg-orange-50 hover:bg-orange-100'
                          : 'bg-red-50 hover:bg-red-100'
                        : 'hover:bg-gray-50',
                    )}
                  >
                    <div
                      className={cn(
                        'p-2.5 rounded-lg flex-shrink-0 mt-0.5',
                        w.type === '连续迟到' ? 'bg-orange-500' : 'bg-red-500',
                      )}
                    >
                      {w.type === '连续迟到' ? (
                        <Clock className="w-5 h-5 text-white" />
                      ) : (
                        <XCircle className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-900">{w.name}</span>
                        <span className="text-xs text-gray-500">({w.employeeNo})</span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{w.department}</span>
                        <span
                          className={cn(
                            'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold',
                            w.type === '连续迟到'
                              ? 'bg-orange-200 text-orange-800'
                              : 'bg-red-200 text-red-800',
                          )}
                        >
                          {w.type} × {w.streakDays}天
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        涉及日期：<span className="font-medium">{w.startDate}</span> 至{' '}
                        <span className="font-medium">{w.endDate}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ExportTab({
  departments,
  currentYear,
  currentMonth,
}: {
  departments: Department[]
  currentYear: number
  currentMonth: number
}) {
  const [departmentId, setDepartmentId] = useState<number>(departments[0]?.id ?? 0)
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)

  const deptOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments],
  )
  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({ value: currentYear - 2 + i, label: `${currentYear - 2 + i}年` })),
    [currentYear],
  )
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` })),
    [],
  )

  useEffect(() => {
    if (deptOptions.length > 0 && !departmentId) {
      setDepartmentId(deptOptions[0].value)
    }
  }, [deptOptions, departmentId])

  function handleExport() {
    if (!departmentId) return
    const url = api.exportCsv(departmentId, year, month)
    window.open(url, '_blank')
  }

  const selectedDeptName = departments.find((d) => d.id === departmentId)?.name || '未选择部门'

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">导出考勤报表</h3>
              <p className="text-sm text-gray-600">导出指定部门指定月份的考勤汇总数据为CSV文件</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectField
              value={departmentId}
              onChange={setDepartmentId}
              options={deptOptions}
              placeholder="请选择部门"
              icon={Building2}
            />
            <SelectField value={year} onChange={setYear} options={yearOptions} placeholder="选择年份" icon={CalendarDays} />
            <SelectField value={month} onChange={setMonth} options={monthOptions} placeholder="选择月份" icon={CalendarDays} />
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">导出预览信息</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">部门：</span>
                <span className="font-medium text-gray-900">{selectedDeptName}</span>
              </div>
              <div>
                <span className="text-gray-500">周期：</span>
                <span className="font-medium text-gray-900">{year}年{month}月</span>
              </div>
              <div>
                <span className="text-gray-500">格式：</span>
                <span className="font-medium text-gray-900">CSV</span>
              </div>
              <div>
                <span className="text-gray-500">编码：</span>
                <span className="font-medium text-gray-900">UTF-8 (BOM)</span>
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              导出字段：工号、姓名、部门、出勤天数、迟到次数、早退次数、缺勤天数、请假天数、加班时长
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              disabled={!departmentId}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm',
                departmentId
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed',
              )}
            >
              <Download className="w-4 h-4" />
              导出 CSV 文件
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
