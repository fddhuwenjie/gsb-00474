import { useEffect, useState } from 'react'
import {
  CalendarRange,
  Briefcase,
  ClipboardList,
  Send,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  FileText,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  leaveApi,
  type LeaveRequest,
  type OvertimeRequest,
  type AnnualQuota,
} from '@/lib/api'

const CURRENT_EMPLOYEE_ID = 1
const IS_MANAGER = true

type MainTab = 'leave' | 'overtime' | 'mine'
type MineSubTab = 'leave' | 'overtime'

const LEAVE_TYPE_OPTIONS = [
  { value: 'personal', label: '事假' },
  { value: 'sick', label: '病假' },
  { value: 'annual', label: '年假' },
  { value: 'compensatory', label: '调休' },
  { value: 'marriage', label: '婚假' },
  { value: 'maternity', label: '产假' },
]

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: '待审批', className: 'bg-gray-100 text-gray-600 border-gray-300' },
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

function getLeaveTypeLabel(v: string) {
  return LEAVE_TYPE_OPTIONS.find((o) => o.value === v)?.label || v
}

function calcDurationDays(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start)
  const e = new Date(end)
  if (e < s) return 0
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export default function Leave() {
  const [activeTab, setActiveTab] = useState<MainTab>('leave')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">异常处理</h1>

        <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1">
          {(
            [
              { key: 'leave', label: '请假申请', icon: CalendarRange },
              { key: 'overtime', label: '加班申请', icon: Briefcase },
              { key: 'mine', label: '我的申请', icon: ClipboardList },
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

        {activeTab === 'leave' && <LeaveApply />}
        {activeTab === 'overtime' && <OvertimeApply />}
        {activeTab === 'mine' && <MyApplications />}
      </div>
    </div>
  )
}

function LeaveApply() {
  const [form, setForm] = useState({
    leaveType: 'personal',
    startDate: '',
    endDate: '',
    duration: 1,
    reason: '',
  })
  const [quota, setQuota] = useState<AnnualQuota | null>(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadQuota = async () => {
    setQuotaLoading(true)
    try {
      const res = await leaveApi.getAnnualQuotas(CURRENT_EMPLOYEE_ID)
      if (res.success && res.data && res.data.length > 0) {
        setQuota(res.data[0])
      } else {
        setQuota(null)
      }
    } finally {
      setQuotaLoading(false)
    }
  }

  useEffect(() => {
    loadQuota()
  }, [])

  useEffect(() => {
    const days = calcDurationDays(form.startDate, form.endDate)
    if (days > 0) setForm((f) => ({ ...f, duration: days }))
  }, [form.startDate, form.endDate])

  const handleSubmit = async () => {
    if (!form.startDate || !form.endDate) {
      setError('请选择起止日期')
      return
    }
    if (!form.reason.trim()) {
      setError('请填写事由')
      return
    }
    if (form.duration <= 0) {
      setError('时长无效')
      return
    }
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const res = await leaveApi.applyLeave({
        employeeId: CURRENT_EMPLOYEE_ID,
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        duration: form.duration,
        reason: form.reason.trim(),
      })
      if (res.success) {
        setMessage('请假申请已提交')
        setForm({ leaveType: 'personal', startDate: '', endDate: '', duration: 1, reason: '' })
        if (form.leaveType === 'annual') await loadQuota()
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
      {form.leaveType === 'annual' && (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-lg font-semibold text-indigo-900">
            <CalendarRange className="h-5 w-5" />
            年假额度
          </div>
          {quotaLoading ? (
            <div className="flex items-center gap-2 text-indigo-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : quota ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <QuotaCard label="工龄" value={`${quota.yearsOfService} 年`} />
              <QuotaCard label="总额度" value={`${quota.quotaDays} 天`} highlight />
              <QuotaCard label="已使用" value={`${quota.usedDays} 天`} warn={quota.usedDays > 0} />
              <QuotaCard
                label="剩余"
                value={`${quota.remainingDays} 天`}
                success
              />
            </div>
          ) : (
            <div className="text-indigo-700">暂无额度信息</div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Send className="h-5 w-5 text-indigo-600" />
          请假申请
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">请假类型</label>
            <select
              value={form.leaveType}
              onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {LEAVE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">时长（天）</label>
            <input
              type="number"
              min={1}
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: Math.max(1, Number(e.target.value) || 1) })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">开始日期</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">结束日期</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">事由</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="请详细说明请假事由..."
              rows={4}
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
    </div>
  )
}

function QuotaCard({
  label,
  value,
  highlight,
  success,
  warn,
}: {
  label: string
  value: string
  highlight?: boolean
  success?: boolean
  warn?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 text-center',
        highlight && 'border-indigo-300 bg-indigo-100/50',
        success && 'border-green-300 bg-green-100/50',
        warn && 'border-orange-300 bg-orange-100/50',
        !highlight && !success && !warn && 'border-white bg-white'
      )}
    >
      <div className="mb-1 text-xs text-gray-600">{label}</div>
      <div
        className={cn(
          'text-xl font-bold tabular-nums',
          highlight && 'text-indigo-700',
          success && 'text-green-700',
          warn && 'text-orange-700',
          !highlight && !success && !warn && 'text-gray-900'
        )}
      >
        {value}
      </div>
    </div>
  )
}

function OvertimeApply() {
  const [form, setForm] = useState({
    overtimeDate: '',
    duration: 2,
    reason: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    if (!form.overtimeDate) {
      setError('请选择加班日期')
      return
    }
    if (form.duration <= 0) {
      setError('时长必须大于0')
      return
    }
    if (!form.reason.trim()) {
      setError('请填写加班原因')
      return
    }
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const res = await leaveApi.applyOvertime({
        employeeId: CURRENT_EMPLOYEE_ID,
        overtimeDate: form.overtimeDate,
        duration: form.duration,
        reason: form.reason.trim(),
      })
      if (res.success) {
        setMessage('加班申请已提交')
        setForm({ overtimeDate: '', duration: 2, reason: '' })
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
          <Briefcase className="h-5 w-5 text-orange-500" />
          加班申请
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">加班日期</label>
            <input
              type="date"
              value={form.overtimeDate}
              onChange={(e) => setForm({ ...form, overtimeDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-gray-700">
              <Clock className="h-4 w-4" />
              时长（小时）
            </label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={form.duration}
              onChange={(e) =>
                setForm({ ...form, duration: Math.max(0.5, Number(e.target.value) || 0.5) })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">原因</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="请详细说明加班原因及工作内容..."
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
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
    </div>
  )
}

function MyApplications() {
  const [subTab, setSubTab] = useState<MineSubTab>('leave')
  const [leaveRecords, setLeaveRecords] = useState<LeaveRequest[]>([])
  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeRequest[]>([])
  const [pendingLeave, setPendingLeave] = useState<LeaveRequest[]>([])
  const [pendingOvertime, setPendingOvertime] = useState<OvertimeRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [myLeave, myOvertime, pLeave, pOvertime] = await Promise.all([
        leaveApi.getLeaveRequests({ employeeId: CURRENT_EMPLOYEE_ID }),
        leaveApi.getOvertimeRequests({ employeeId: CURRENT_EMPLOYEE_ID }),
        IS_MANAGER ? leaveApi.getLeaveRequests({ status: 'pending' }) : null,
        IS_MANAGER ? leaveApi.getOvertimeRequests({ status: 'pending' }) : null,
      ])
      if (myLeave.success) setLeaveRecords(myLeave.data || [])
      if (myOvertime.success) setOvertimeRecords(myOvertime.data || [])
      if (pLeave?.success) setPendingLeave(pLeave.data || [])
      if (pOvertime?.success) setPendingOvertime(pOvertime.data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleApproveLeave = async (id: number, status: 'approved' | 'rejected') => {
    setApprovingId(id)
    setError('')
    setMessage('')
    try {
      const res = await leaveApi.approveLeave({
        requestId: id,
        status,
        approverId: CURRENT_EMPLOYEE_ID,
      })
      if (res.success) {
        setMessage(status === 'approved' ? '请假已通过' : '请假已驳回')
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

  const handleApproveOvertime = async (id: number, status: 'approved' | 'rejected') => {
    setApprovingId(id)
    setError('')
    setMessage('')
    try {
      const res = await leaveApi.approveOvertime({
        requestId: id,
        status,
        approverId: CURRENT_EMPLOYEE_ID,
      })
      if (res.success) {
        setMessage(status === 'approved' ? '加班已通过' : '加班已驳回')
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
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {(
          [
            { key: 'leave', label: '请假记录', icon: FileText },
            { key: 'overtime', label: '加班记录', icon: Briefcase },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition',
              subTab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
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

      {subTab === 'leave' ? (
        <>
          <LeaveRecords
            records={leaveRecords}
            loading={loading}
            title="我的请假记录"
            titleIcon={<ClipboardList className="h-5 w-5 text-indigo-600" />}
            showActions={false}
            approvingId={approvingId}
            onApprove={handleApproveLeave}
          />
          {IS_MANAGER && (
            <LeaveRecords
              records={pendingLeave}
              loading={loading}
              title="待审批请假申请"
              titleIcon={<AlertCircle className="h-5 w-5 text-orange-500" />}
              showActions
              approvingId={approvingId}
              onApprove={handleApproveLeave}
              showEmployee
            />
          )}
        </>
      ) : (
        <>
          <OvertimeRecords
            records={overtimeRecords}
            loading={loading}
            title="我的加班记录"
            titleIcon={<ClipboardList className="h-5 w-5 text-orange-500" />}
            showActions={false}
            approvingId={approvingId}
            onApprove={handleApproveOvertime}
          />
          {IS_MANAGER && (
            <OvertimeRecords
              records={pendingOvertime}
              loading={loading}
              title="待审批加班申请"
              titleIcon={<AlertCircle className="h-5 w-5 text-orange-500" />}
              showActions
              approvingId={approvingId}
              onApprove={handleApproveOvertime}
              showEmployee
            />
          )}
        </>
      )}
    </div>
  )
}

function LeaveRecords({
  records,
  loading,
  title,
  titleIcon,
  showActions,
  approvingId,
  onApprove,
  showEmployee,
}: {
  records: LeaveRequest[]
  loading: boolean
  title: string
  titleIcon: React.ReactNode
  showActions: boolean
  approvingId: number | null
  onApprove: (id: number, status: 'approved' | 'rejected') => void
  showEmployee?: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          {titleIcon}
          {title}
          {records.length > 0 && (
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {records.length}
            </span>
          )}
        </h3>
      </div>

      {records.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-gray-400" />
          暂无记录
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {records.map((r) => (
            <div key={r.id} className="px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    {showEmployee && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-sm text-blue-700">
                        <User className="h-3.5 w-3.5" />
                        {r.employeeName}
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-0.5 text-sm font-medium text-indigo-700">
                      {getLeaveTypeLabel(r.leaveType)}
                    </span>
                    <span className="text-sm text-gray-600">
                      {r.startDate} ~ {r.endDate}
                    </span>
                    <span className="text-sm text-gray-600">共 {r.duration} 天</span>
                    <span
                      className={cn(
                        'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium',
                        getStatusStyle(r.status).className
                      )}
                    >
                      {getStatusStyle(r.status).label}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">事由：{r.reason}</div>
                  {r.approverName && (
                    <div className="text-xs text-gray-500">
                      审批人：{r.approverName}
                      {r.approvedAt && ` · ${r.approvedAt.slice(0, 16)}`}
                    </div>
                  )}
                  <div className="text-xs text-gray-400">申请时间：{r.createdAt?.slice(0, 16)}</div>
                </div>
                {showActions && r.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onApprove(r.id, 'approved')}
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
                      onClick={() => onApprove(r.id, 'rejected')}
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
  )
}

function OvertimeRecords({
  records,
  loading,
  title,
  titleIcon,
  showActions,
  approvingId,
  onApprove,
  showEmployee,
}: {
  records: OvertimeRequest[]
  loading: boolean
  title: string
  titleIcon: React.ReactNode
  showActions: boolean
  approvingId: number | null
  onApprove: (id: number, status: 'approved' | 'rejected') => void
  showEmployee?: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          {titleIcon}
          {title}
          {records.length > 0 && (
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {records.length}
            </span>
          )}
        </h3>
      </div>

      {records.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-gray-400" />
          暂无记录
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {records.map((r) => (
            <div key={r.id} className="px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    {showEmployee && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-sm text-blue-700">
                        <User className="h-3.5 w-3.5" />
                        {r.employeeName}
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-md bg-orange-50 px-2.5 py-0.5 text-sm font-medium text-orange-700">
                      加班
                    </span>
                    <span className="text-sm text-gray-600">{r.overtimeDate}</span>
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <Clock className="h-3.5 w-3.5" />
                      {r.duration} 小时
                    </span>
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
                {showActions && r.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onApprove(r.id, 'approved')}
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
                      onClick={() => onApprove(r.id, 'rejected')}
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
  )
}
