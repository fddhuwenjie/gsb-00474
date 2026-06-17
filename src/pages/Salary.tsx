import { useEffect, useState } from 'react'
import {
  DollarSign,
  Download,
  Settings,
  Calculator,
  Loader2,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  X,
  Users,
  TrendingUp,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  salaryApi,
  basicApi,
  type SalaryRule,
  type SalaryDetail,
  type Department,
} from '@/lib/api'
import type { Employee } from '@/lib/api'

type MainTab = 'report' | 'rules'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const YEARS = [2024, 2025, 2026]

interface RuleForm {
  employeeId: number | ''
  baseSalary: number
  lateDeduction: number
  earlyLeaveDeduction: number
  absentDeductionRatio: number
  overtimeWeekdayRate: number
  overtimeWeekendRate: number
  overtimeHolidayRate: number
}

const EMPTY_FORM: RuleForm = {
  employeeId: '',
  baseSalary: 0,
  lateDeduction: 0,
  earlyLeaveDeduction: 0,
  absentDeductionRatio: 0,
  overtimeWeekdayRate: 1.5,
  overtimeWeekendRate: 2,
  overtimeHolidayRate: 3,
}

export default function Salary() {
  const [activeTab, setActiveTab] = useState<MainTab>('report')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">薪资管理</h1>

        <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1">
          {(
            [
              { key: 'report', label: '薪资报表', icon: DollarSign },
              { key: 'rules', label: '薪资规则', icon: Settings },
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

        {activeTab === 'report' && <SalaryReport />}
        {activeTab === 'rules' && <SalaryRules />}
      </div>
    </div>
  )
}

function SalaryReport() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [departmentId, setDepartmentId] = useState<number | ''>('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [details, setDetails] = useState<SalaryDetail[]>([])
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    basicApi.getDepartments().then((res: { success: boolean; data?: Department[] }) => {
      if (res.success && res.data) setDepartments(res.data)
    })
  }, [])

  const handleCalculate = async () => {
    setCalculating(true)
    setError('')
    try {
      const res = await salaryApi.calculate(
        year,
        month,
        departmentId ? Number(departmentId) : undefined
      )
      if (res.success && res.data) {
        setDetails(res.data)
      } else {
        setError(res.error || '计算失败')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '计算失败')
    } finally {
      setCalculating(false)
    }
  }

  const handleExportCsv = () => {
    const url = salaryApi.exportCsv(year, month, departmentId ? Number(departmentId) : undefined)
    window.open(url, '_blank')
  }

  const totalEmployees = details.length
  const totalPayroll = details.reduce((sum, d) => sum + d.netSalary, 0)
  const avgSalary = totalEmployees > 0 ? totalPayroll / totalEmployees : 0

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Calculator className="h-5 w-5 text-indigo-600" />
          薪资计算
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">年份</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">月份</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">部门</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">全部部门</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            计算薪资
          </button>
          {details.length > 0 && (
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              导出CSV
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {details.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard
              icon={<Users className="h-5 w-5 text-indigo-600" />}
              label="总人数"
              value={`${totalEmployees} 人`}
              className="border-indigo-200 bg-indigo-50"
            />
            <SummaryCard
              icon={<TrendingUp className="h-5 w-5 text-green-600" />}
              label="薪资总额"
              value={`¥${totalPayroll.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
              className="border-green-200 bg-green-50"
            />
            <SummaryCard
              icon={<BarChart3 className="h-5 w-5 text-orange-600" />}
              label="平均薪资"
              value={`¥${avgSalary.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
              className="border-orange-200 bg-orange-50"
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <DollarSign className="h-5 w-5 text-green-600" />
                薪资明细
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {details.length}
                </span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">工号</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">姓名</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">部门</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">基本工资</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">迟到次数/扣款</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">早退次数/扣款</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">缺勤天数/扣款</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">加班时长/补贴</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">应发工资</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {details.map((d) => (
                    <tr key={d.employeeId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{d.employeeNo}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{d.employeeName}</td>
                      <td className="px-4 py-3 text-gray-700">{d.departmentName || '-'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        ¥{d.baseSalary.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        <span className="tabular-nums">{d.lateCount}</span>次 /
                        <span className="ml-1 tabular-nums text-red-600">¥{d.lateDeduction.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        <span className="tabular-nums">{d.earlyLeaveCount}</span>次 /
                        <span className="ml-1 tabular-nums text-red-600">¥{d.earlyLeaveDeduction.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        <span className="tabular-nums">{d.absentCount}</span>天 /
                        <span className="ml-1 tabular-nums text-red-600">¥{d.absentDeduction.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        <span className="tabular-nums">{d.overtimeHours}</span>h /
                        <span className="ml-1 tabular-nums text-green-600">¥{d.overtimePay.toFixed(2)}</span>
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right tabular-nums font-bold',
                          d.netSalary >= 0 ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        ¥{d.netSalary.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {details.length === 0 && !error && (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-gray-500 shadow-sm">
          <DollarSign className="mx-auto mb-2 h-8 w-8 text-gray-400" />
          请选择年月和部门后点击"计算薪资"
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border p-5', className)}>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
        {icon}
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums text-gray-900">{value}</div>
    </div>
  )
}

function SalaryRules() {
  const [rules, setRules] = useState<SalaryRule[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<RuleForm>({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadRules = async () => {
    setLoading(true)
    try {
      const res = await salaryApi.getRules()
      if (res.success && res.data) setRules(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRules()
    basicApi.getEmployees().then((res: { success: boolean; data?: Employee[] }) => {
      if (res.success && res.data) setEmployees(res.data)
    })
  }, [])

  const openCreateForm = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setShowForm(true)
    setError('')
  }

  const openEditForm = (rule: SalaryRule) => {
    setEditingId(rule.id)
    setForm({
      employeeId: rule.employeeId ?? '',
      baseSalary: rule.baseSalary,
      lateDeduction: rule.lateDeduction,
      earlyLeaveDeduction: rule.earlyLeaveDeduction,
      absentDeductionRatio: rule.absentDeductionRatio,
      overtimeWeekdayRate: rule.overtimeWeekdayRate,
      overtimeWeekendRate: rule.overtimeWeekendRate,
      overtimeHolidayRate: rule.overtimeHolidayRate,
    })
    setShowForm(true)
    setError('')
  }

  const handleSubmit = async () => {
    if (form.baseSalary < 0) {
      setError('基本工资不能为负')
      return
    }
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        employeeId: form.employeeId === '' ? null : Number(form.employeeId),
        baseSalary: form.baseSalary,
        lateDeduction: form.lateDeduction,
        earlyLeaveDeduction: form.earlyLeaveDeduction,
        absentDeductionRatio: form.absentDeductionRatio,
        overtimeWeekdayRate: form.overtimeWeekdayRate,
        overtimeWeekendRate: form.overtimeWeekendRate,
        overtimeHolidayRate: form.overtimeHolidayRate,
      }
      if (editingId !== null) {
        const res = await salaryApi.updateRule(editingId, payload)
        if (res.success) {
          setMessage('规则已更新')
          setShowForm(false)
          await loadRules()
        } else {
          setError(res.error || '更新失败')
        }
      } else {
        const res = await salaryApi.createRule(payload)
        if (res.success) {
          setMessage('规则已创建')
          setShowForm(false)
          await loadRules()
        } else {
          setError(res.error || '创建失败')
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (rule: SalaryRule) => {
    if (rule.employeeId === null) {
      setError('不能删除全局默认规则')
      return
    }
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const res = await salaryApi.deleteRule(rule.id)
      if (res.success) {
        setMessage('规则已删除')
        await loadRules()
      } else {
        setError(res.error || '删除失败')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
          <DollarSign className="h-5 w-5 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Settings className="h-5 w-5 text-gray-600" />
            薪资规则
            {rules.length > 0 && (
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {rules.length}
              </span>
            )}
          </h3>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            新增规则
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : rules.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-gray-400" />
            暂无规则
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">适用对象</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">基本工资</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">迟到扣款</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">早退扣款</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">缺勤扣款比例</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">平时加班倍率</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">周末加班倍率</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">节假日加班倍率</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {rule.employeeId === null ? (
                        <span className="inline-flex rounded-md bg-indigo-50 px-2.5 py-0.5 text-sm font-medium text-indigo-700">
                          全局默认
                        </span>
                      ) : (
                        <span className="text-gray-900">{rule.employeeName || `员工#${rule.employeeId}`}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      ¥{rule.baseSalary.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">
                      ¥{rule.lateDeduction.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">
                      ¥{rule.earlyLeaveDeduction.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">
                      {(rule.absentDeductionRatio * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-600">
                      {rule.overtimeWeekdayRate}x
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-600">
                      {rule.overtimeWeekendRate}x
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-600">
                      {rule.overtimeHolidayRate}x
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditForm(rule)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(rule)}
                          disabled={rule.employeeId === null}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium',
                            rule.employeeId === null
                              ? 'cursor-not-allowed border-gray-200 text-gray-400'
                              : 'border-red-200 text-red-700 hover:bg-red-50'
                          )}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId !== null ? '编辑规则' : '新增规则'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  适用员工
                  <span className="ml-2 text-xs font-normal text-gray-400">留空则为全局默认规则</span>
                </label>
                <select
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value ? Number(e.target.value) : '' })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">全局默认</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employee_no})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">基本工资</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={form.baseSalary}
                    onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">迟到扣款 (每次)</label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={form.lateDeduction}
                    onChange={(e) => setForm({ ...form, lateDeduction: Number(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">早退扣款 (每次)</label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={form.earlyLeaveDeduction}
                    onChange={(e) => setForm({ ...form, earlyLeaveDeduction: Number(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">缺勤扣款比例</label>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={form.absentDeductionRatio}
                    onChange={(e) => setForm({ ...form, absentDeductionRatio: Number(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">平时加班倍率</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.overtimeWeekdayRate}
                    onChange={(e) => setForm({ ...form, overtimeWeekdayRate: Number(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">周末加班倍率</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.overtimeWeekendRate}
                    onChange={(e) => setForm({ ...form, overtimeWeekendRate: Number(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">节假日加班倍率</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.overtimeHolidayRate}
                    onChange={(e) => setForm({ ...form, overtimeHolidayRate: Number(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId !== null ? '更新' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
