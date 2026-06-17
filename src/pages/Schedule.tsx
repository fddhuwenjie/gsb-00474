import { useEffect, useState, useMemo } from 'react'
import {
  CalendarDays,
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  Building2,
  Send,
  Layers,
  Loader2,
  RefreshCw,
  Eye,
  AlertCircle,
  CheckCircle2,
  User,
} from 'lucide-react'
import {
  getShiftTemplates,
  createShiftTemplate,
  updateShiftTemplate,
  deleteShiftTemplate,
  getWeekSchedule,
  createSchedule,
  batchSchedule,
  publishSchedule,
  getDepartments,
  getEmployees,
  api,
  type ShiftTemplate,
  type ScheduleItem,
  type Department,
  type Employee,
} from '@/lib/api'
import { cn } from '@/lib/utils'

type TabType = 'templates' | 'schedule'
type ShiftType = string
type ViewMode = 'manager' | 'employee'

const SHIFT_TYPE_OPTIONS: { value: ShiftType; label: string; color: string }[] = [
  { value: 'morning', label: '早班', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'afternoon', label: '中班', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'night', label: '晚班', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'flexible', label: '弹性班', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
]

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, days: number): Date {
  const nd = new Date(d)
  nd.setDate(nd.getDate() + days)
  return nd
}

export default function Schedule() {
  const [activeTab, setActiveTab] = useState<TabType>('templates')

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">排班管理</h1>
        <p className="text-slate-500 mt-1">管理班次模板与员工排班</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200">
          <nav className="flex">
            <TabButton
              active={activeTab === 'templates'}
              onClick={() => setActiveTab('templates')}
              icon={<ClipboardList className="w-4 h-4" />}
              label="班次模板管理"
            />
            <TabButton
              active={activeTab === 'schedule'}
              onClick={() => setActiveTab('schedule')}
              icon={<CalendarDays className="w-4 h-4" />}
              label="排班表"
            />
          </nav>
        </div>

        <div className="p-5">
          {activeTab === 'templates' ? <ShiftTemplatesTab /> : <ScheduleTableTab />}
        </div>
      </div>
    </div>
  )
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors',
        active
          ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function ShiftTemplatesTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null)

  const fetchTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getShiftTemplates()
      if (res.success) {
        setTemplates(res.data || [])
      } else {
        setError(res.error || '获取班次模板失败')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const handleCreate = () => {
    setEditingTemplate(null)
    setShowModal(true)
  }

  const handleEdit = (tpl: ShiftTemplate) => {
    setEditingTemplate(tpl)
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该班次模板吗？')) return
    const res = await deleteShiftTemplate(id)
    if (res.success) {
      alert('删除成功')
      fetchTemplates()
    } else {
      alert(res.error || '删除失败')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold text-slate-900 text-lg">班次模板列表</h2>
          <p className="text-sm text-slate-500 mt-1">共 {templates.length} 个模板</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTemplates}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            刷新
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新增模板
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertCircle className="w-12 h-12 text-rose-500" />
          <p className="text-rose-600">{error}</p>
          <button
            onClick={fetchTemplates}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            重试
          </button>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">名称</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">类型</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">时间</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">跨天</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">核心工时</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-slate-400">
                    <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>暂无班次模板，点击右上角新增</p>
                  </td>
                </tr>
              ) : (
                templates.map((tpl) => {
                  const typeInfo = SHIFT_TYPE_OPTIONS.find((o) => o.value === tpl.type)
                  return (
                    <tr key={tpl.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{tpl.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border',
                            typeInfo?.color || 'bg-slate-100 text-slate-600 border-slate-200',
                          )}
                        >
                          {typeInfo?.label || tpl.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {tpl.type === 'flexible' ? (
                          <span className="text-slate-400">弹性时间</span>
                        ) : (
                          `${tpl.start_time || '--:--'} - ${tpl.end_time || '--:--'}`
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {tpl.next_day ? (
                          <span className="text-rose-600 font-medium">是</span>
                        ) : (
                          <span className="text-slate-400">否</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {tpl.core_start && tpl.core_end
                          ? `${tpl.core_start} - ${tpl.core_end}`
                          : <span className="text-slate-400">--</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(tpl)}
                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="编辑"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(tpl.id)}
                            className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ShiftTemplateModal
          template={editingTemplate}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            fetchTemplates()
          }}
        />
      )}
    </div>
  )
}

interface ModalProps {
  template: ShiftTemplate | null
  onClose: () => void
  onSaved: () => void
}

function ShiftTemplateModal({ template, onClose, onSaved }: ModalProps) {
  const [name, setName] = useState(template?.name || '')
  const [type, setType] = useState<ShiftType>(template?.type || 'morning')
  const [startTime, setStartTime] = useState(template?.start_time || '09:00')
  const [endTime, setEndTime] = useState(template?.end_time || '18:00')
  const [coreStart, setCoreStart] = useState(template?.core_start || '')
  const [coreEnd, setCoreEnd] = useState(template?.core_end || '')
  const [nextDay, setNextDay] = useState<number>(template?.next_day || 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('请输入班次名称')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload: Partial<ShiftTemplate> = {
        name: name.trim(),
        type: type as ShiftTemplate['type'],
        start_time: type === 'flexible' ? null : startTime || null,
        end_time: type === 'flexible' ? null : endTime || null,
        core_start: coreStart || null,
        core_end: coreEnd || null,
        next_day: nextDay,
      }
      const res = template
        ? await updateShiftTemplate(template.id, payload)
        : await createShiftTemplate(payload)
      if (res.success) {
        onSaved()
      } else {
        setError(res.error || '保存失败')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            {template ? '编辑班次模板' : '新增班次模板'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">班次名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：标准早班"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">班次类型 *</label>
            <div className="grid grid-cols-2 gap-2">
              {SHIFT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    'px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition-all',
                    type === opt.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {type !== 'flexible' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">开始时间</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">结束时间</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                核心工时开始 {type === 'flexible' && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="time"
                value={coreStart}
                onChange={(e) => setCoreStart(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                核心工时结束 {type === 'flexible' && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="time"
                value={coreEnd}
                onChange={(e) => setCoreEnd(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <input
              type="checkbox"
              id="next_day"
              checked={!!nextDay}
              onChange={(e) => setNextDay(e.target.checked ? 1 : 0)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <label htmlFor="next_day" className="text-sm text-slate-700 cursor-pointer">
              下班时间跨天（夜班）
            </label>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ScheduleTableTab() {
  const [viewMode, setViewMode] = useState<ViewMode>('manager')
  const [weekStart, setWeekStart] = useState<Date>(getMondayOfWeek(new Date()))
  const [departmentId, setDepartmentId] = useState<number | ''>('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [showCellModal, setShowCellModal] = useState(false)
  const [cellModalData, setCellModalData] = useState<{ employeeId: number; employeeName: string; date: string; currentShiftId: number | null; scheduleId: number | null } | null>(null)

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [weekStart])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const weekStartStr = formatDate(weekStart)
      const [deptRes, empRes, schRes, tplRes] = await Promise.all([
        getDepartments(),
        getEmployees(departmentId || undefined),
        getWeekSchedule(weekStartStr, departmentId || undefined),
        getShiftTemplates(),
      ])
      if (deptRes.success) setDepartments(deptRes.data || [])
      if (empRes.success) setEmployees(empRes.data || [])
      if (schRes.success) setSchedules(schRes.data || [])
      if (tplRes.success) setTemplates(tplRes.data || [])
      if (!schRes.success) setError(schRes.error || '获取排班失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [weekStart, departmentId])

  const getShiftForCell = (employeeId: number, dateStr: string): ScheduleItem | undefined => {
    return schedules.find((s) => s.employee_id === employeeId && s.schedule_date === dateStr)
  }

  const handleCellClick = (emp: Employee, date: Date) => {
    if (viewMode === 'employee') return
    const dateStr = formatDate(date)
    const existing = getShiftForCell(emp.id, dateStr)
    setCellModalData({
      employeeId: emp.id,
      employeeName: emp.name,
      date: dateStr,
      currentShiftId: existing?.shift_id || null,
      scheduleId: existing?.id || null,
    })
    setShowCellModal(true)
  }

  const handlePublish = async () => {
    if (!confirm('确定发布本周排班吗？发布后员工即可查看。')) return
    const res = await publishSchedule({ weekStart: formatDate(weekStart) })
    if (res.success) {
      alert(res.data?.message || '发布成功')
      fetchData()
    } else {
      alert(res.error || '发布失败')
    }
  }

  const shiftWeek = (offset: number) => {
    setWeekStart((prev) => addDays(prev, offset * 7))
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('manager')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                viewMode === 'manager'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <Users className="w-3.5 h-3.5" />
              管理员视角
            </button>
            <button
              onClick={() => setViewMode('employee')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                viewMode === 'employee'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              员工视角
            </button>
          </div>

          <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => shiftWeek(-1)}
              className="p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors border-r border-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-4 py-2 text-sm">
              <span className="font-semibold text-slate-900">
                {formatDate(weekDates[0])} ~ {formatDate(weekDates[6])}
              </span>
            </div>
            <button
              onClick={() => shiftWeek(1)}
              className="p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors border-l border-slate-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value === '' ? '' : Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">全部部门</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            刷新
          </button>

          {viewMode === 'manager' && (
            <>
              <button
                onClick={() => setShowBatchModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Layers className="w-4 h-4" />
                批量排班
              </button>
              <button
                onClick={handlePublish}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
                发布排班
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertCircle className="w-12 h-12 text-rose-500" />
          <p className="text-rose-600">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            重试
          </button>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[180px] border-r border-slate-200">
                    员工
                  </th>
                  {weekDates.map((d, idx) => {
                    const isWeekend = idx >= 5
                    const isToday = formatDate(d) === formatDate(new Date())
                    return (
                      <th
                        key={idx}
                        className={cn(
                          'px-3 py-3 text-center font-medium min-w-[110px]',
                          isWeekend ? 'text-orange-500' : 'text-slate-600',
                          isToday && 'bg-indigo-50',
                        )}
                      >
                        <div className="text-xs">{WEEKDAY_LABELS[idx]}</div>
                        <div className={cn('text-sm mt-0.5', isToday && 'text-indigo-600 font-bold')}>
                          {String(d.getMonth() + 1).padStart(2, '0')}/{String(d.getDate()).padStart(2, '0')}
                        </div>
                        {isToday && (
                          <div className="inline-block mt-1 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px]">
                            今天
                          </div>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-20 text-center text-slate-400">
                      <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>暂无员工数据</p>
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const lastSchedule = schedules
                      .filter((s) => s.employee_id === emp.id)
                      .sort((a, b) => b.schedule_date.localeCompare(a.schedule_date))[0]
                    const isPublished = lastSchedule?.status === 'published'

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold shadow-sm">
                              {emp.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 truncate">{emp.name}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                <span>{emp.employee_no}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                <span className="truncate">{emp.department_name}</span>
                                {viewMode === 'manager' && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span
                                      className={cn(
                                        'px-1.5 py-0.5 rounded text-[10px]',
                                        isPublished
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-amber-100 text-amber-700',
                                      )}
                                    >
                                      {isPublished ? '已发布' : '草稿'}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        {weekDates.map((d, idx) => {
                          const dateStr = formatDate(d)
                          const schedule = getShiftForCell(emp.id, dateStr)
                          const isToday = dateStr === formatDate(new Date())
                          const isWeekend = idx >= 5
                          const typeInfo = schedule
                            ? SHIFT_TYPE_OPTIONS.find((o) => o.value === (schedule.shift_type as ShiftType))
                            : null
                          return (
                            <td
                              key={idx}
                              onClick={() => handleCellClick(emp, d)}
                              className={cn(
                                'px-2 py-3 text-center align-middle',
                                isToday && 'bg-indigo-50/40',
                                viewMode === 'manager' && 'cursor-pointer hover:bg-indigo-50',
                              )}
                            >
                              {schedule ? (
                                <div
                                  className={cn(
                                    'inline-flex flex-col items-center px-2 py-1.5 rounded-lg border text-xs min-w-[90px]',
                                    typeInfo?.color || 'bg-slate-100 border-slate-200 text-slate-700',
                                    viewMode === 'manager' && schedule.status !== 'published' && 'border-dashed',
                                  )}
                                >
                                  <span className="font-semibold">{schedule.shift_name}</span>
                                  {schedule.start_time && schedule.end_time && (
                                    <span className="text-[10px] opacity-80 mt-0.5">
                                      {schedule.start_time.substring(0, 5)}-{schedule.end_time.substring(0, 5)}
                                    </span>
                                  )}
                                </div>
                              ) : isWeekend ? (
                                <span className="text-xs text-slate-300">
                                  {viewMode === 'manager' ? '点击排班' : '休息'}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-300">
                                  {viewMode === 'manager' ? '点击排班' : '未安排'}
                                </span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showBatchModal && (
        <BatchScheduleModal
          weekStart={weekStart}
          templates={templates}
          departments={departments}
          employees={employees}
          onClose={() => setShowBatchModal(false)}
          onDone={() => {
            setShowBatchModal(false)
            fetchData()
          }}
        />
      )}

      {showCellModal && cellModalData && (
        <CellEditModal
          data={cellModalData}
          templates={templates}
          onClose={() => setShowCellModal(false)}
          onDone={() => {
            setShowCellModal(false)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

interface BatchModalProps {
  weekStart: Date
  templates: ShiftTemplate[]
  departments: Department[]
  employees: Employee[]
  onClose: () => void
  onDone: () => void
}

function BatchScheduleModal({ weekStart, templates, departments, employees, onClose, onDone }: BatchModalProps) {
  const [scopeType, setScopeType] = useState<'department' | 'employee'>('department')
  const [deptId, setDeptId] = useState<number | ''>(departments[0]?.id || '')
  const [empIds, setEmpIds] = useState<number[]>([])
  const [shiftId, setShiftId] = useState<number | ''>(templates[0]?.id || '')
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!shiftId) {
      setError('请选择班次')
      return
    }
    if (days.length === 0) {
      setError('请选择排班日期')
      return
    }
    if (scopeType === 'department' && !deptId) {
      setError('请选择部门')
      return
    }
    if (scopeType === 'employee' && empIds.length === 0) {
      setError('请选择员工')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await batchSchedule({
        departmentId: scopeType === 'department' ? Number(deptId) : undefined,
        employeeIds: scopeType === 'employee' ? empIds : undefined,
        shiftId: Number(shiftId),
        weekStart: formatDate(weekStart),
        days,
      })
      if (res.success) {
        alert(res.data?.message || '批量排班成功')
        onDone()
      } else {
        setError(res.error || '排班失败')
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleDay = (day: number) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  const toggleEmp = (id: number) => {
    setEmpIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]))
  }

  const filteredEmployees = deptId ? employees.filter((e) => e.department_id === deptId) : employees

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">批量排班</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">排班范围</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScopeType('department')}
                className={cn(
                  'px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition-all',
                  scopeType === 'department'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                )}
              >
                <Building2 className="w-4 h-4 inline mr-1.5" />
                按部门 / 岗位
              </button>
              <button
                type="button"
                onClick={() => setScopeType('employee')}
                className={cn(
                  'px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition-all',
                  scopeType === 'employee'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                )}
              >
                <Users className="w-4 h-4 inline mr-1.5" />
                指定员工
              </button>
            </div>
          </div>

          {scopeType === 'department' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">选择部门 *</label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">请选择部门</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                选择员工 * <span className="text-xs text-slate-400 font-normal">(已选 {empIds.length} 人)</span>
              </label>
              <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto p-1">
                {filteredEmployees.length === 0 ? (
                  <p className="p-3 text-center text-sm text-slate-400">暂无员工</p>
                ) : (
                  filteredEmployees.map((emp) => (
                    <label
                      key={emp.id}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded cursor-pointer',
                        empIds.includes(emp.id) ? 'bg-indigo-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={empIds.includes(emp.id)}
                        onChange={() => toggleEmp(emp.id)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700">{emp.name}</span>
                      <span className="text-xs text-slate-400">{emp.employee_no}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">选择班次 *</label>
            <select
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">请选择班次</option>
              {templates.map((t) => {
                const typeInfo = SHIFT_TYPE_OPTIONS.find((o) => o.value === t.type)
                return (
                  <option key={t.id} value={t.id}>
                    {t.name} ({typeInfo?.label})
                  </option>
                )
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              排班日期 * <span className="text-xs text-slate-400 font-normal">(本周，已选 {days.length} 天)</span>
            </label>
            <div className="grid grid-cols-7 gap-2">
              {WEEKDAY_LABELS.map((label, idx) => {
                const d = addDays(weekStart, idx)
                const selected = days.includes(idx)
                const isWeekend = idx >= 5
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={cn(
                      'flex flex-col items-center py-2.5 rounded-lg border-2 text-xs transition-all',
                      selected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : isWeekend
                          ? 'border-orange-200 bg-orange-50/50 text-orange-600 hover:border-orange-300'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    )}
                  >
                    <span className="font-medium">{label}</span>
                    <span className="mt-0.5">
                      {String(d.getMonth() + 1).padStart(2, '0')}/{String(d.getDate()).padStart(2, '0')}
                    </span>
                    {selected && <CheckCircle2 className="w-3.5 h-3.5 mt-1" />}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? '排班中...' : '确认排班'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface CellModalProps {
  data: { employeeId: number; employeeName: string; date: string; currentShiftId: number | null; scheduleId: number | null }
  templates: ShiftTemplate[]
  onClose: () => void
  onDone: () => void
}

function CellEditModal({ data, templates, onClose, onDone }: CellModalProps) {
  const [shiftId, setShiftId] = useState<number | ''>(data.currentShiftId || '')
  const [clearShift, setClearShift] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!clearShift && !shiftId) {
      setError('请选择班次或勾选清除排班')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (clearShift) {
        if (data.scheduleId) {
          const res = await api.deleteSchedule(data.scheduleId)
          if (!res.success) {
            setError(res.error || '清除失败')
            return
          }
        }
        onDone()
        return
      }

      const res = await createSchedule({
        employeeId: data.employeeId,
        shiftId: Number(shiftId),
        scheduleDate: data.date,
      })
      if (res.success) {
        onDone()
      } else {
        setError(res.error || '保存失败')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">编辑排班</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">员工</div>
                <div className="font-semibold text-slate-900 mt-0.5">{data.employeeName}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-500">日期</div>
                <div className="font-semibold text-slate-900 mt-0.5">{data.date}</div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">选择班次</label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-1">
              {templates.map((t) => {
                const typeInfo = SHIFT_TYPE_OPTIONS.find((o) => o.value === t.type)
                const selected = Number(shiftId) === t.id
                return (
                  <label
                    key={t.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all',
                      selected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shift"
                        checked={selected}
                        onChange={() => {
                          setShiftId(t.id)
                          setClearShift(false)
                        }}
                        className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-medium text-slate-900 text-sm">{t.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {t.type === 'flexible'
                            ? '弹性时间'
                            : `${t.start_time?.substring(0, 5) || '--:--'} - ${t.end_time?.substring(0, 5) || '--:--'}`}
                          {t.next_day ? ' · 跨天' : ''}
                        </div>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border',
                        typeInfo?.color || 'bg-slate-100 text-slate-600 border-slate-200',
                      )}
                    >
                      {typeInfo?.label}
                    </span>
                  </label>
                )
              })}
              {templates.length === 0 && (
                <p className="p-4 text-center text-sm text-slate-400">暂无班次模板</p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 p-3 bg-rose-50 rounded-lg border border-rose-100 cursor-pointer">
            <input
              type="checkbox"
              checked={clearShift}
              onChange={(e) => {
                setClearShift(e.target.checked)
                if (e.target.checked) setShiftId('')
              }}
              className="w-4 h-4 text-rose-600 rounded border-rose-300 focus:ring-rose-500"
            />
            <span className="text-sm text-rose-700">清除该日排班</span>
          </label>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
