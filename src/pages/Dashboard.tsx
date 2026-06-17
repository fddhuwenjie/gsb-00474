import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  Users,
  BarChart3,
  Timer,
  Building2,
  AlertOctagon,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import {
  getDashboard,
  getWarnings,
  type DashboardData,
  type WarningItem,
} from '@/lib/api'
import { cn } from '@/lib/utils'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [warnings, setWarnings] = useState<WarningItem[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const now = new Date()
      const [dashRes, warnRes] = await Promise.all([
        getDashboard(),
        getWarnings(now.getFullYear(), now.getMonth() + 1),
      ])
      if (!dashRes.success) {
        setError(dashRes.error || '获取仪表盘数据失败')
      } else {
        setData(dashRes.data || null)
      }
      if (warnRes.success && warnRes.data) {
        setWarnings(warnRes.data.warnings)
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertOctagon className="w-16 h-16 text-red-500" />
        <p className="text-red-600 text-lg">{error}</p>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          重试
        </button>
      </div>
    )
  }

  const stats = data?.todayStats
  const lateList = data?.lateList || []
  const monthAttendanceRate = data?.monthAttendanceRate || 0
  const monthLateTop5 = data?.monthLateTop5 || []
  const monthOvertimeTop5 = data?.monthOvertimeTop5 || []
  const departmentRates = data?.departmentRates || []

  const maxLateCount = Math.max(...monthLateTop5.map((i) => i.late_count), 1)
  const maxOvertimeHours = Math.max(...monthOvertimeTop5.map((i) => i.overtime_hours), 1)
  const maxDeptRate = Math.max(...departmentRates.map((i) => i.attendanceRate), 1)

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">考勤仪表盘</h1>
          <p className="text-slate-500 mt-1">实时掌握公司考勤状况</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          刷新数据
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="今日已打卡"
          value={stats?.checkedIn || 0}
          icon={<CheckCircle2 className="w-6 h-6" />}
          iconBg="bg-emerald-500"
          valueColor="text-emerald-600"
          subtitle={`总人数 ${stats?.total || 0}`}
        />
        <StatCard
          title="今日未打卡"
          value={stats?.absent || 0}
          icon={<XCircle className="w-6 h-6" />}
          iconBg="bg-rose-500"
          valueColor="text-rose-600"
          subtitle={`占比 ${stats?.total ? Math.round((stats.absent / stats.total) * 100) : 0}%`}
        />
        <StatCard
          title="今日迟到人数"
          value={stats?.late || 0}
          icon={<Clock className="w-6 h-6" />}
          iconBg="bg-amber-500"
          valueColor="text-amber-600"
          subtitle="需要关注"
        />
        <StatCard
          title="本月出勤率"
          value={`${monthAttendanceRate}%`}
          icon={<TrendingUp className="w-6 h-6" />}
          iconBg="bg-indigo-500"
          valueColor="text-indigo-600"
          subtitle={monthAttendanceRate >= 95 ? '表现优秀' : '有待提升'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-slate-900">今日迟到人员</h2>
            <span className="ml-auto text-sm text-slate-500">{lateList.length} 人</span>
          </div>
          <div className="p-4 max-h-80 overflow-y-auto">
            {lateList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <CheckCircle2 className="w-10 h-10 mb-2" />
                <p>今日无迟到记录</p>
              </div>
            ) : (
                <ul className="space-y-3">
                  {lateList.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-medium text-sm">
                          {item.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.department} · {item.employee_no}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-amber-600 font-medium">
                          {item.check_in ? item.check_in.split(' ')[1]?.substring(0, 5) : '--:--'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h2 className="font-semibold text-slate-900">异常预警</h2>
            <span className="ml-auto text-sm text-slate-500">{warnings.length} 条</span>
          </div>
          <div className="p-4 max-h-80 overflow-y-auto">
            {warnings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <div className="w-10 h-10 mb-2 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p>本月无异常考勤</p>
            </div>
            ) : (
              <ul className="space-y-3">
                {warnings.map((item, idx) => (
                  <li
                    key={idx}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border',
                      item.highlighted
                        ? 'bg-rose-50 border-rose-200'
                        : 'bg-slate-50 border-slate-100',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-9 h-9 rounded-full flex items-center justify-center',
                          item.highlighted ? 'bg-rose-200 text-rose-700' : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <p className={cn('font-medium text-sm', item.highlighted ? 'text-rose-700' : 'text-slate-900')}>
                          {item.name} <span className="font-normal text-xs ml-1">· {item.department}</span>
                        </p>
                        <p className={cn('text-xs', item.highlighted ? 'text-rose-600' : 'text-slate-500')}>
                          {item.type} · 连续 {item.streakDays} 天
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-xs', item.highlighted ? 'text-rose-600' : 'text-slate-500')}>
                        {item.startDate}
                      </p>
                      <p className={cn('text-xs', item.highlighted ? 'text-rose-600' : 'text-slate-500')}>
                        至 {item.endDate}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-slate-900">本月迟到 TOP5</h2>
          </div>
          <div className="p-5 space-y-4">
            {monthLateTop5.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Users className="w-10 h-10 mb-2" />
                <p>本月无迟到记录</p>
              </div>
            ) : (
                monthLateTop5.map((item, idx) => {
                  const width = (item.late_count / maxLateCount) * 100
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{item.name}</span>
                        <span className="text-amber-600 font-semibold">{item.late_count} 次</span>
                      </div>
                      <div className="h-7 bg-slate-100 rounded-lg overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-lg flex items-center justify-end pr-3 transition-all duration-500"
                          style={{ width: `${width}%` }}
                        >
                          {width > 25 && (
                            <span className="text-xs text-white font-medium">
                              {idx + 1}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )
            }
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <Timer className="w-5 h-5 text-violet-600" />
            <h2 className="font-semibold text-slate-900">本月加班 TOP5</h2>
          </div>
          <div className="p-5 space-y-4">
            {monthOvertimeTop5.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Users className="w-10 h-10 mb-2" />
                <p>本月无加班记录</p>
              </div>
            ) : (
                monthOvertimeTop5.map((item, idx) => {
                  const width = (item.overtime_hours / maxOvertimeHours) * 100
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{item.name}</span>
                        <span className="text-violet-600 font-semibold">{item.overtime_hours} 小时</span>
                      </div>
                      <div className="h-7 bg-slate-100 rounded-lg overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-violet-400 to-violet-500 rounded-lg flex items-center justify-end pr-3 transition-all duration-500"
                          style={{ width: `${width}%` }}
                        >
                          {width > 25 && (
                            <span className="text-xs text-white font-medium">
                              {idx + 1}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )
            }
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-sky-600" />
          <h2 className="font-semibold text-slate-900">各部门出勤率对比</h2>
        </div>
        <div className="p-5">
          {departmentRates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Building2 className="w-10 h-10 mb-2" />
              <p>暂无部门数据</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {departmentRates.map((dept, idx) => {
                const barHeight = dept.attendanceRate
                const barColor =
                  barHeight >= 95
                    ? 'from-emerald-400 to-emerald-500'
                    : barHeight >= 85
                      ? 'from-sky-400 to-sky-500'
                      : 'from-amber-400 to-amber-500'
                const textColor =
                  barHeight >= 95
                    ? 'text-emerald-600'
                    : barHeight >= 85
                      ? 'text-sky-600'
                      : 'text-amber-600'
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-100 bg-slate-50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-slate-800">{dept.name}</span>
                      <span className={cn('text-lg font-bold', textColor)}>
                      {dept.attendanceRate}%
                    </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', barColor)}
                        style={{ width: `${barHeight}%` }}
                      />
                    </div>
                    <div className="mt-3 flex justify-between text-xs text-slate-500">
                      <span>出勤 {dept.attended} 天</span>
                      <span>应出勤 {dept.totalScheduled} 天</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  iconBg: string
  valueColor: string
  subtitle?: string
}

function StatCard({ title, value, icon, iconBg, valueColor, subtitle }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className={cn('text-3xl font-bold mt-2', valueColor)}>{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={cn('w-12 h-12 rounded-xl text-white flex items-center justify-center shadow-md', iconBg)}>
          {icon}
        </div>
      </div>
    </div>
  )
}
