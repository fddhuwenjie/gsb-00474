import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  Clock,
  TimerReset,
  Calendar,
  RefreshCw,
  Save,
  AlertCircle,
  CheckCircle2,
  Users,
  CalendarCheck,
} from 'lucide-react'
import { api, type RulesData, type AnnualLeaveQuota } from '@/lib/api'
import { cn } from '@/lib/utils'

interface CardProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  children: React.ReactNode
  iconColor?: string
}

function ConfigCard({ icon: Icon, title, description, children, iconColor = 'text-indigo-600' }: CardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-start gap-3">
        <div className={cn('p-2 rounded-lg bg-opacity-10 flex-shrink-0', iconColor.replace('text-', 'bg-'))}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

interface FieldProps {
  label: string
  hint?: string
  children: React.ReactNode
}

function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start py-2">
      <div className="md:col-span-1 pt-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      </div>
      <div className="md:col-span-3">{children}</div>
    </div>
  )
}

interface NumberInputProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  suffix?: string
  placeholder?: string
}

function NumberInput({ value, onChange, min = 0, max, suffix, placeholder }: NumberInputProps) {
  return (
    <div className="relative w-full max-w-xs">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-gray-300 bg-white py-2.5 px-4 pr-12 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
      />
      {suffix && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">{suffix}</span>
      )}
    </div>
  )
}

interface TimeInputProps {
  value: string
  onChange: (v: string) => void
}

function TimeInput({ value, onChange }: TimeInputProps) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full max-w-xs rounded-lg border border-gray-300 bg-white py-2.5 px-4 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
    />
  )
}

type ToastType = 'success' | 'error'
interface Toast { type: ToastType; message: string }

export default function Settings() {
  const [rules, setRules] = useState<RulesData>({
    late_tolerance_minutes: 0,
    flexible_core_start: '10:00',
    flexible_core_end: '16:00',
    monthly_makeup_limit: 3,
    annual_leave_base: 5,
    annual_leave_per_year: 1,
    annual_leave_max: 15,
  })
  const [quotas, setQuotas] = useState<AnnualLeaveQuota[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .getRules()
      .then((r) => { if (r.success && r.data) setRules(r.data) })
      .catch((e) => showToast('error', e.message || '加载配置失败'))
      .finally(() => setLoading(false))

    api
      .recalculateQuotas()
      .then((r) => { if (r.success && r.data) setQuotas(r.data.quotas) })
      .catch(console.error)
  }, [])

  function showToast(type: ToastType, message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  function updateField<K extends keyof RulesData>(key: K, value: RulesData[K]) {
    setRules((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await api.updateRules(rules)
      if (res.success && res.data) {
        setRules(res.data)
        showToast('success', '配置保存成功')
      } else {
        showToast('error', res.error || '保存失败')
      }
    } catch (e: any) {
      showToast('error', e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleRecalculate() {
    setRecalculating(true)
    try {
      const res = await api.recalculateQuotas()
      if (res.success && res.data) {
        setQuotas(res.data.quotas)
        showToast('success', `已重新计算 ${res.data.updatedCount} 位员工的年假额度`)
      } else {
        showToast('error', res.error || '重新计算失败')
      }
    } catch (e: any) {
      showToast('error', e.message || '重新计算失败')
    } finally {
      setRecalculating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {toast && (
          <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-right-5">
            <div
              className={cn(
                'flex items-center gap-3 px-5 py-3 rounded-lg shadow-lg border',
                toast.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800',
              )}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SettingsIcon className="w-7 h-7 text-indigo-600" />
            规则配置
          </h1>
          <p className="text-gray-500 mt-1">配置考勤规则、弹性工时和年假额度等系统参数</p>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500 shadow-sm">
            加载中...
          </div>
        ) : (
          <div className="space-y-6">
            <ConfigCard
              icon={Clock}
              title="迟到容忍时间"
              description="设置上班打卡的容忍缓冲时间"
              iconColor="text-orange-600"
            >
              <Field label="容忍时间" hint="允许晚到N分钟不算迟到">
                <NumberInput
                  value={rules.late_tolerance_minutes}
                  onChange={(v) => updateField('late_tolerance_minutes', v)}
                  min={0}
                  max={60}
                  suffix="分钟"
                />
              </Field>
            </ConfigCard>

            <ConfigCard
              icon={TimerReset}
              title="弹性班核心工时"
              description="弹性工作制下员工必须在岗的时间段"
              iconColor="text-blue-600"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="核心开始时间" hint="此时间后必须在岗">
                  <TimeInput value={rules.flexible_core_start} onChange={(v) => updateField('flexible_core_start', v)} />
                </Field>
                <Field label="核心结束时间" hint="此时间前必须在岗">
                  <TimeInput value={rules.flexible_core_end} onChange={(v) => updateField('flexible_core_end', v)} />
                </Field>
              </div>
            </ConfigCard>

            <ConfigCard
              icon={CalendarCheck}
              title="补卡规则"
              description="限制每月补卡申请的次数上限"
              iconColor="text-teal-600"
            >
              <Field label="补卡次数上限" hint="超过此次数的补卡申请将自动拒绝">
                <NumberInput
                  value={rules.monthly_makeup_limit}
                  onChange={(v) => updateField('monthly_makeup_limit', v)}
                  min={0}
                  max={31}
                  suffix="次/月"
                />
              </Field>
            </ConfigCard>

            <ConfigCard
              icon={Calendar}
              title="年假额度配置"
              description="根据工龄计算每位员工的年假天数"
              iconColor="text-indigo-600"
            >
              <div className="space-y-2">
                <Field label="基础天数" hint="新入职员工的年假基础">
                  <NumberInput
                    value={rules.annual_leave_base}
                    onChange={(v) => updateField('annual_leave_base', v)}
                    min={0}
                    max={30}
                    suffix="天"
                  />
                </Field>
                <Field label="每年递增" hint="每工作满1年增加的年假天数">
                  <NumberInput
                    value={rules.annual_leave_per_year}
                    onChange={(v) => updateField('annual_leave_per_year', v)}
                    min={0}
                    max={10}
                    suffix="天/年"
                  />
                </Field>
                <Field label="最大天数" hint="年假上限，超过不再递增">
                  <NumberInput
                    value={rules.annual_leave_max}
                    onChange={(v) => updateField('annual_leave_max', v)}
                    min={0}
                    max={60}
                    suffix="天"
                  />
                </Field>
              </div>

              <div className="mt-6 pt-5 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-gray-500" />
                    <h4 className="font-medium text-gray-900">年假额度预览</h4>
                  </div>
                  <button
                    onClick={handleRecalculate}
                    disabled={recalculating}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={cn('w-4 h-4', recalculating && 'animate-spin')} />
                    {recalculating ? '计算中...' : '重新计算年假额度'}
                  </button>
                </div>

                <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">员工</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">工号</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">工龄</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">额度</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">已用</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">剩余</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {quotas.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                              暂无数据，点击上方按钮重新计算
                            </td>
                          </tr>
                        ) : (
                          quotas.map((q) => {
                            const remainingPct = q.quota_days > 0 ? (q.remaining_days / q.quota_days) * 100 : 0
                            return (
                              <tr key={q.id} className="hover:bg-white transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-xs font-medium">
                                      {q.employee_name.slice(0, 1)}
                                    </div>
                                    <span className="text-sm font-medium text-gray-900">{q.employee_name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">{q.employee_no}</td>
                                <td className="px-4 py-3 text-center text-sm text-gray-700">{q.years_of_service} 年</td>
                                <td className="px-4 py-3 text-center text-sm text-gray-900 font-medium">{q.quota_days} 天</td>
                                <td className="px-4 py-3 text-center text-sm">
                                  <span className={cn(
                                    q.used_days > 0 ? 'text-orange-600 font-medium' : 'text-gray-400',
                                  )}>
                                    {q.used_days} 天
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className={cn(
                                          'h-full rounded-full transition-all',
                                          remainingPct > 50 ? 'bg-green-500' : remainingPct > 20 ? 'bg-yellow-500' : 'bg-red-500',
                                        )}
                                        style={{ width: `${remainingPct}%` }}
                                      />
                                    </div>
                                    <span className={cn(
                                      'text-sm font-medium w-12 text-right',
                                      remainingPct > 50 ? 'text-green-600' : remainingPct > 20 ? 'text-yellow-600' : 'text-red-600',
                                    )}>
                                      {q.remaining_days}天
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  {quotas.length > 0 && (
                    <div className="px-4 py-3 bg-white border-t border-gray-200 text-xs text-gray-500">
                      共 {quotas.length} 位员工 · 当前年度：{quotas[0]?.year || new Date().getFullYear()}
                    </div>
                  )}
                </div>
              </div>
            </ConfigCard>

            <div className="sticky bottom-6 flex justify-end">
              <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 flex items-center gap-3">
                <span className="text-sm text-gray-500 px-2">修改配置后记得保存</span>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Save className={cn('w-4 h-4', saving && 'animate-pulse')} />
                  {saving ? '保存中...' : '保存配置'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
