import { useEffect, useState } from 'react'
import {
  ArrowLeftRight,
  ArrowRightLeft,
  ClipboardCheck,
  Send,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  User,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  swapApi,
  basicApi,
  api,
  type ShiftSwapRequest,
  type Employee,
  type ScheduleItem,
} from '@/lib/api'

const CURRENT_EMPLOYEE_ID = 1
const IS_MANAGER = true

type TabType = 'shift_swap' | 'shift_exchange' | 'approval'

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: '待确认', className: 'bg-gray-100 text-gray-600 border-gray-300' },
  confirmed: { label: '已确认待审批', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  approved: { label: '已通过', className: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { label: '已驳回', className: 'bg-red-100 text-red-700 border-red-200' },
}

function getStatusStyle(status: string) {
  return (
    STATUS_MAP[status] || {
      label: status,
      className: 'bg-gray-100 text-gray-600 border-gray-200',
    }
  )
}

function getSwapTypeLabel(type: string) {
  return type === 'shift_swap' ? '调班' : '换班'
}

function getWeekStart(dateStr: string) {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().split('T')[0]
}

export default function ShiftSwap() {
  const [activeTab, setActiveTab] = useState<TabType>('shift_swap')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">调班换班</h1>

        <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1">
          {(
            [
              { key: 'shift_swap', label: '调班申请', icon: ArrowLeftRight },
              { key: 'shift_exchange', label: '换班申请', icon: ArrowRightLeft },
              { key: 'approval', label: '审批管理', icon: ClipboardCheck },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition',
                activeTab === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'shift_swap' && <ShiftSwapTab />}
        {activeTab === 'shift_exchange' && <ShiftExchangeTab />}
        {activeTab === 'approval' && IS_MANAGER && <ApprovalTab />}
      </div>
    </div>
  )
}

function ShiftSwapTab() {
  const [form, setForm] = useState({
    originalDate: '',
    targetDate: '',
    reason: '',
  })
  const [originalSchedule, setOriginalSchedule] = useState<ScheduleItem | null>(null)
  const [targetSchedule, setTargetSchedule] = useState<ScheduleItem | null>(null)
  const [myRequests, setMyRequests] = useState<ShiftSwapRequest[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadSchedule = async (date: string, target: 'original' | 'target') => {
    if (!date) {
      if (target === 'original') setOriginalSchedule(null)
      else setTargetSchedule(null)
      return
    }
    try {
      const weekStart = getWeekStart(date)
      const res = await api.getWeekSchedule(weekStart, undefined, CURRENT_EMPLOYEE_ID)
      if (res.success && res.data) {
        const item = res.data.find((s: ScheduleItem) => s.schedule_date === date)
        if (target === 'original') setOriginalSchedule(item || null)
        else setTargetSchedule(item || null)
      }
    } catch {
      if (target === 'original') setOriginalSchedule(null)
      else setTargetSchedule(null)
    }
  }

  const loadMyRequests = async () => {
    setLoading(true)
    try {
      const res = await swapApi.getMyRequests(CURRENT_EMPLOYEE_ID)
      if (res.success) {
        setMyRequests(res.data?.filter((r: ShiftSwapRequest) => r.swapType === 'shift_swap') || [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMyRequests()
  }, [])

  useEffect(() => {
    loadSchedule(form.originalDate, 'original')
  }, [form.originalDate])

  useEffect(() => {
    loadSchedule(form.targetDate, 'target')
  }, [form.targetDate])

  const handleSubmit = async () => {
    if (!form.originalDate || !form.targetDate) {
      setError('请选择原日期和目标日期')
      return
    }
    if (!originalSchedule) {
      setError('原日期无排班信息')
      return
    }
    if (!targetSchedule) {
      setError('目标日期无排班信息')
      return
    }
    if (!form.reason.trim()) {
      setError('请填写调班原因')
      return
    }
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const res = await swapApi.apply({
        requesterId: CURRENT_EMPLOYEE_ID,
        swapType: 'shift_swap',
        originalDate: form.originalDate,
        targetDate: form.targetDate,
        originalShiftId: originalSchedule.shift_id,
        targetShiftId: targetSchedule.shift_id,
        reason: form.reason.trim(),
      })
      if (res.success) {
        setMessage('调班申请已提交')
        setForm({ originalDate: '', targetDate: '', reason: '' })
        setOriginalSchedule(null)
        setTargetSchedule(null)
        await loadMyRequests()
      } else {
        setError(res.error || '提交失败')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <ArrowLeftRight className="h-5 w-5 text-indigo-600" />
          调班申请
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">原日期</label>
            <input
              type="date"
              value={form.originalDate}
              onChange={(e) => setForm({ ...form, originalDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            {originalSchedule && (
              <div className="mt-1.5 text-xs text-gray-500">
                班次：{originalSchedule.shift_name}（{originalSchedule.start_time?.slice(0, 5)} - {originalSchedule.end_time?.slice(0, 5)}）
              </div>
            )}
            {form.originalDate && !originalSchedule && (
              <div className="mt-1.5 text-xs text-orange-500">该日期无排班</div>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">目标日期</label>
            <input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            {targetSchedule && (
              <div className="mt-1.5 text-xs text-gray-500">
                班次：{targetSchedule.shift_name}（{targetSchedule.start_time?.slice(0, 5)} - {targetSchedule.end_time?.slice(0, 5)}）
              </div>
            )}
            {form.targetDate && !targetSchedule && (
              <div className="mt-1.5 text-xs text-orange-500">该日期无排班</div>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">原因</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="请详细说明调班原因..."
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            提交申请
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <XCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <FileText className="h-5 w-5 text-indigo-600" />
            我的调班申请
          </h3>
        </div>
        <SwapRequestList
          requests={myRequests}
          loading={loading}
          emptyText="暂无调班申请记录"
        />
      </div>
    </div>
  )
}

function ShiftExchangeTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [form, setForm] = useState({
    originalDate: '',
    targetEmployeeId: '',
    reason: '',
  })
  const [originalSchedule, setOriginalSchedule] = useState<ScheduleItem | null>(null)
  const [myRequests, setMyRequests] = useState<ShiftSwapRequest[]>([])
  const [incomingRequests, setIncomingRequests] = useState<ShiftSwapRequest[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    basicApi.getEmployees().then((res: { success: boolean; data?: Employee[] }) => {
      if (res.success) setEmployees((res.data || []).filter((e: Employee) => e.id !== CURRENT_EMPLOYEE_ID))
    })
  }, [])

  const loadSchedule = async (date: string) => {
    if (!date) {
      setOriginalSchedule(null)
      return
    }
    try {
      const weekStart = getWeekStart(date)
      const res = await api.getWeekSchedule(weekStart, undefined, CURRENT_EMPLOYEE_ID)
      if (res.success && res.data) {
        const item = res.data.find((s: ScheduleItem) => s.schedule_date === date)
        setOriginalSchedule(item || null)
      }
    } catch {
      setOriginalSchedule(null)
    }
  }

  useEffect(() => {
    loadSchedule(form.originalDate)
  }, [form.originalDate])

  const loadData = async () => {
    setLoading(true)
    try {
      const [mineRes, allRes] = await Promise.all([
        swapApi.getMyRequests(CURRENT_EMPLOYEE_ID),
        swapApi.getRequests({ status: 'pending' }),
      ])
      if (mineRes.success) {
        setMyRequests(mineRes.data?.filter((r: ShiftSwapRequest) => r.swapType === 'shift_exchange') || [])
      }
      if (allRes.success) {
        setIncomingRequests(
          (allRes.data || []).filter(
            (r: ShiftSwapRequest) => r.swapType === 'shift_exchange' && r.targetEmployeeId === CURRENT_EMPLOYEE_ID && !r.targetConfirmed
          )
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSubmit = async () => {
    if (!form.originalDate) {
      setError('请选择原日期')
      return
    }
    if (!originalSchedule) {
      setError('原日期无排班信息')
      return
    }
    if (!form.targetEmployeeId) {
      setError('请选择换班对象')
      return
    }
    if (!form.reason.trim()) {
      setError('请填写换班原因')
      return
    }
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const res = await swapApi.apply({
        requesterId: CURRENT_EMPLOYEE_ID,
        swapType: 'shift_exchange',
        originalDate: form.originalDate,
        targetEmployeeId: Number(form.targetEmployeeId),
        originalShiftId: originalSchedule.shift_id,
        reason: form.reason.trim(),
      })
      if (res.success) {
        setMessage('换班申请已提交')
        setForm({ originalDate: '', targetEmployeeId: '', reason: '' })
        setOriginalSchedule(null)
        await loadData()
      } else {
        setError(res.error || '提交失败')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirm = async (id: number) => {
    setConfirmingId(id)
    setError('')
    setMessage('')
    try {
      const res = await swapApi.confirm(id, CURRENT_EMPLOYEE_ID)
      if (res.success) {
        setMessage('已确认换班申请')
        await loadData()
      } else {
        setError(res.error || '确认失败')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '确认失败')
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
          换班申请
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">原日期</label>
            <input
              type="date"
              value={form.originalDate}
              onChange={(e) => setForm({ ...form, originalDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            {originalSchedule && (
              <div className="mt-1.5 text-xs text-gray-500">
                班次：{originalSchedule.shift_name}（{originalSchedule.start_time?.slice(0, 5)} - {originalSchedule.end_time?.slice(0, 5)}）
              </div>
            )}
            {form.originalDate && !originalSchedule && (
              <div className="mt-1.5 text-xs text-orange-500">该日期无排班</div>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">换班对象</label>
            <select
              value={form.targetEmployeeId}
              onChange={(e) => setForm({ ...form, targetEmployeeId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">请选择员工</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} - {e.department_name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">原因</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="请详细说明换班原因..."
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            提交申请
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <XCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {incomingRequests.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 shadow-sm">
          <div className="border-b border-orange-100 px-6 py-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              待我确认的换班请求
            </h3>
          </div>
          <div className="divide-y divide-orange-100">
            {incomingRequests.map((r) => (
              <div key={r.id} className="px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-sm text-blue-700">
                        <User className="h-3.5 w-3.5" />
                        {r.requesterName}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-0.5 text-sm font-medium text-indigo-700">
                        换班
                      </span>
                      <span className="text-sm text-gray-600">原日期：{r.originalDate}</span>
                    </div>
                    <div className="text-sm text-gray-600">原因：{r.reason}</div>
                  </div>
                  <button
                    onClick={() => handleConfirm(r.id)}
                    disabled={confirmingId === r.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                  >
                    {confirmingId === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    确认
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <FileText className="h-5 w-5 text-indigo-600" />
            我的换班申请
          </h3>
        </div>
        <SwapRequestList
          requests={myRequests}
          loading={loading}
          emptyText="暂无换班申请记录"
        />
      </div>
    </div>
  )
}

function ApprovalTab() {
  const [requests, setRequests] = useState<ShiftSwapRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [pendingRes, confirmedRes] = await Promise.all([
        swapApi.getRequests({ status: 'pending' }),
        swapApi.getRequests({ status: 'confirmed' }),
      ])
      const list: ShiftSwapRequest[] = []
      if (pendingRes.success) list.push(...(pendingRes.data || []))
      if (confirmedRes.success) list.push(...(confirmedRes.data || []))
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setRequests(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleApprove = async (id: number, status: 'approved' | 'rejected') => {
    setApprovingId(id)
    setError('')
    setMessage('')
    try {
      const res = await swapApi.approve(id, CURRENT_EMPLOYEE_ID, status)
      if (res.success) {
        setMessage(status === 'approved' ? '已通过' : '已驳回')
        await loadData()
      } else {
        setError(res.error || '操作失败')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <XCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <ClipboardCheck className="h-5 w-5 text-indigo-600" />
            待审批调班换班申请
          </h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-gray-400" />
            暂无待审批申请
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.map((r) => (
              <div key={r.id} className="px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-sm text-blue-700">
                        <User className="h-3.5 w-3.5" />
                        {r.requesterName}
                      </span>
                      <span className={cn(
                        'inline-flex items-center rounded-md px-2.5 py-0.5 text-sm font-medium',
                        r.swapType === 'shift_swap'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-purple-50 text-purple-700'
                      )}>
                        {getSwapTypeLabel(r.swapType)}
                      </span>
                      <span className="text-sm text-gray-600">原日期：{r.originalDate}</span>
                      {r.swapType === 'shift_swap' && r.targetDate && (
                        <span className="text-sm text-gray-600">目标日期：{r.targetDate}</span>
                      )}
                      {r.swapType === 'shift_exchange' && r.targetEmployeeName && (
                        <span className="text-sm text-gray-600">换班对象：{r.targetEmployeeName}</span>
                      )}
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium',
                          getStatusStyle(r.status).className
                        )}
                      >
                        {getStatusStyle(r.status).label}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">原因：{r.reason}</div>
                    <div className="text-xs text-gray-400">申请时间：{r.createdAt?.slice(0, 16)}</div>
                  </div>
                  {(r.status === 'pending' || r.status === 'confirmed') && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(r.id, 'approved')}
                        disabled={approvingId === r.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-60"
                      >
                        {approvingId === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ThumbsUp className="h-4 w-4" />
                        )}
                        通过
                      </button>
                      <button
                        onClick={() => handleApprove(r.id, 'rejected')}
                        disabled={approvingId === r.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        {approvingId === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ThumbsDown className="h-4 w-4" />
                        )}
                        驳回
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SwapRequestList({
  requests,
  loading,
  emptyText,
}: {
  requests: ShiftSwapRequest[]
  loading: boolean
  emptyText: string
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }
  if (requests.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-gray-400" />
        {emptyText}
      </div>
    )
  }
  return (
    <div className="divide-y divide-gray-100">
      {requests.map((r) => (
        <div key={r.id} className="px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn(
                  'inline-flex items-center rounded-md px-2.5 py-0.5 text-sm font-medium',
                  r.swapType === 'shift_swap'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'bg-purple-50 text-purple-700'
                )}>
                  {getSwapTypeLabel(r.swapType)}
                </span>
                <span className="text-sm text-gray-600">原日期：{r.originalDate}</span>
                {r.swapType === 'shift_swap' && r.targetDate && (
                  <span className="text-sm text-gray-600">目标日期：{r.targetDate}</span>
                )}
                {r.swapType === 'shift_exchange' && r.targetEmployeeName && (
                  <span className="text-sm text-gray-600">换班对象：{r.targetEmployeeName}</span>
                )}
                <span
                  className={cn(
                    'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    getStatusStyle(r.status).className
                  )}
                >
                  {getStatusStyle(r.status).label}
                </span>
              </div>
              <div className="text-sm text-gray-600">原因：{r.reason}</div>
              {r.approverName && (
                <div className="text-xs text-gray-500">
                  审批人：{r.approverName}
                  {r.approvedAt && ` · ${r.approvedAt.slice(0, 16)}`}
                </div>
              )}
              <div className="text-xs text-gray-400">申请时间：{r.createdAt?.slice(0, 16)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
