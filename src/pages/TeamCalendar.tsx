import { useEffect, useState } from 'react'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  calendarApi,
  basicApi,
  type CalendarDayData,
  type CalendarDayDetail,
  type Department,
} from '@/lib/api'

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  normal: { label: '正常', className: 'bg-green-100 text-green-700 border-green-200' },
  late: { label: '迟到', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  early_leave: { label: '早退', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  absent: { label: '缺勤', className: 'bg-red-100 text-red-700 border-red-200' },
  leave: { label: '请假', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  pending: { label: '待审批', className: 'bg-gray-100 text-gray-600 border-gray-200' },
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

function extractTime(s: string | null) {
  if (!s) return '-'
  return s.split(' ')[1]?.slice(0, 5) || '-'
}

const DOT_ITEMS = [
  { key: 'normalCount', label: '正常出勤', color: 'bg-green-500' },
  { key: 'lateCount', label: '迟到', color: 'bg-orange-500' },
  { key: 'absentCount', label: '缺勤', color: 'bg-red-500' },
  { key: 'leaveCount', label: '请假', color: 'bg-blue-500' },
  { key: 'tripCount', label: '出差', color: 'bg-purple-500' },
] as const

const WEEK_HEADERS = ['一', '二', '三', '四', '五', '六', '日']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month - 1, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function formatDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function TeamCalendar() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined)
  const [departments, setDepartments] = useState<Department[]>([])
  const [monthlyData, setMonthlyData] = useState<CalendarDayData[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayDetail, setDayDetail] = useState<CalendarDayDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    basicApi.getDepartments().then((res) => {
      if (res.success) setDepartments(res.data || [])
    })
  }, [])

  useEffect(() => {
    loadMonthly()
  }, [year, month, departmentId])

  useEffect(() => {
    if (selectedDate) {
      loadDailyDetail(selectedDate)
    } else {
      setDayDetail([])
    }
  }, [selectedDate, departmentId])

  const loadMonthly = async () => {
    setLoading(true)
    try {
      const res = await calendarApi.getMonthly(year, month, departmentId)
      if (res.success) {
        setMonthlyData(res.data || [])
      } else {
        setMonthlyData([])
      }
    } finally {
      setLoading(false)
    }
  }

  const loadDailyDetail = async (date: string) => {
    setDetailLoading(true)
    try {
      const res = await calendarApi.getDailyDetail(date, departmentId)
      if (res.success) {
        setDayDetail(res.data || [])
      } else {
        setDayDetail([])
      }
    } finally {
      setDetailLoading(false)
    }
  }

  const prevMonth = () => {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else {
      setMonth(month - 1)
    }
    setSelectedDate(null)
  }

  const nextMonth = () => {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else {
      setMonth(month + 1)
    }
    setSelectedDate(null)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const todayStr = formatDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate())

  const dataMap = new Map(monthlyData.map((d) => [d.date, d]))

  const calendarCells: Array<{
    day: number
    dateStr: string
    isCurrentMonth: boolean
  }> = []

  for (let i = 0; i < firstDay; i++) {
    calendarCells.push({ day: 0, dateStr: '', isCurrentMonth: false })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDateStr(year, month, d)
    calendarCells.push({ day: d, dateStr, isCurrentMonth: true })
  }

  const totalCells = Math.ceil(calendarCells.length / 7) * 7
  while (calendarCells.length < totalCells) {
    calendarCells.push({ day: 0, dateStr: '', isCurrentMonth: false })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">团队日历</h1>

        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
            <button onClick={prevMonth} className="rounded-lg p-1 hover:bg-gray-100">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <span className="min-w-[120px] text-center text-base font-semibold text-gray-900">
              {year}年{month}月
            </span>
            <button onClick={nextMonth} className="rounded-lg p-1 hover:bg-gray-100">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          <select
            value={departmentId ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setDepartmentId(v ? Number(v) : undefined)
              setSelectedDate(null)
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">全部部门</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            {DOT_ITEMS.map((item) => (
              <div key={item.key} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={cn('h-2 w-2 rounded-full', item.color)} />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16 shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="grid grid-cols-7 border-b border-gray-200">
              {WEEK_HEADERS.map((h) => (
                <div
                  key={h}
                  className="py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  {h}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarCells.map((cell, idx) => {
                if (!cell.isCurrentMonth) {
                  return <div key={idx} className="min-h-[90px] border-b border-r border-gray-100" />
                }

                const dayData = dataMap.get(cell.dateStr)
                const isToday = cell.dateStr === todayStr
                const isSelected = cell.dateStr === selectedDate

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(isSelected ? null : cell.dateStr)}
                    className={cn(
                      'min-h-[90px] border-b border-r border-gray-100 p-2 text-left align-top transition hover:bg-gray-50',
                      isToday && 'ring-2 ring-inset ring-indigo-500',
                      isSelected && 'bg-indigo-50'
                    )}
                  >
                    <div
                      className={cn(
                        'mb-1 text-sm font-medium',
                        isToday ? 'text-indigo-600' : 'text-gray-900'
                      )}
                    >
                      {cell.day}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {DOT_ITEMS.map((item) => {
                        const count = dayData ? dayData[item.key] : 0
                        if (count <= 0) return null
                        return (
                          <div
                            key={item.key}
                            className="flex items-center gap-1 text-[11px] text-gray-600"
                          >
                            <span className={cn('h-2 w-2 rounded-full flex-shrink-0', item.color)} />
                            {count}
                          </div>
                        )
                      })}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {selectedDate && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Calendar className="h-5 w-5 text-indigo-600" />
                {selectedDate} 出勤详情
              </h3>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : dayDetail.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <AlertCircle className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                暂无记录
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">姓名</th>
                      <th className="px-4 py-3 font-medium">班次</th>
                      <th className="px-4 py-3 font-medium">上班时间</th>
                      <th className="px-4 py-3 font-medium">下班时间</th>
                      <th className="px-4 py-3 font-medium">状态</th>
                      <th className="px-4 py-3 font-medium">备注</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dayDetail.map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{d.employeeName}</div>
                          <div className="text-xs text-gray-500">{d.employeeNo}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {d.shiftName ? (
                            <div>
                              <div>{d.shiftName}</div>
                              <div className="text-xs text-gray-500">
                                {d.startTime?.slice(0, 5)}-{d.endTime?.slice(0, 5)}
                              </div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 tabular-nums">
                          {extractTime(d.checkIn)}
                        </td>
                        <td className="px-4 py-3 text-gray-700 tabular-nums">
                          {extractTime(d.checkOut)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium',
                              getStatusStyle(d.status || 'normal').className
                            )}
                          >
                            {getStatusStyle(d.status || 'normal').label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {d.isFieldWork && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                                外勤
                              </span>
                            )}
                            {d.isOnTrip && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                                出差
                              </span>
                            )}
                            {d.isOnLeave && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                请假
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
