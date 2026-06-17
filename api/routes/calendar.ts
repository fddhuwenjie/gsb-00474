import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

interface AttendanceCountRow {
  date: string
  normalCount: number
  lateCount: number
  absentCount: number
  leaveCount: number
}

interface TripRow {
  employee_id: number
  start_date: string
  end_date: string
}

router.get('/monthly', (req: Request, res: Response): void => {
  const { year, month, departmentId } = req.query as {
    year: string
    month: string
    departmentId?: string
  }

  if (!year || !month) {
    res.json({ success: false, error: '缺少必要参数' })
    return
  }

  try {
    const y = parseInt(year)
    const m = parseInt(month)
    const firstDay = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDayDate = new Date(y, m, 0)
    const lastDay = `${y}-${String(m).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`

    let attendanceQuery = `
      SELECT
        ar.attendance_date as date,
        SUM(CASE WHEN ar.status = 'normal' THEN 1 ELSE 0 END) as normalCount,
        SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as lateCount,
        SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absentCount,
        SUM(CASE WHEN ar.status = 'leave' THEN 1 ELSE 0 END) as leaveCount
      FROM attendance_records ar
      LEFT JOIN employees e ON ar.employee_id = e.id
      WHERE ar.attendance_date BETWEEN ? AND ?
    `
    const attendanceParams: (string | number)[] = [firstDay, lastDay]

    if (departmentId) {
      attendanceQuery += ' AND e.department_id = ?'
      attendanceParams.push(Number(departmentId))
    }

    attendanceQuery += ' GROUP BY ar.attendance_date'

    const attendanceData = db.prepare(attendanceQuery).all(...attendanceParams) as AttendanceCountRow[]

    const attendanceMap = new Map<string, AttendanceCountRow>()
    for (const row of attendanceData) {
      attendanceMap.set(row.date, row)
    }

    let tripQuery = `
      SELECT bt.employee_id, bt.start_date, bt.end_date
      FROM business_trips bt
      LEFT JOIN employees e ON bt.employee_id = e.id
      WHERE bt.status = 'approved'
        AND bt.start_date <= ?
        AND bt.end_date >= ?
    `
    const tripParams: (string | number)[] = [lastDay, firstDay]

    if (departmentId) {
      tripQuery += ' AND e.department_id = ?'
      tripParams.push(Number(departmentId))
    }

    const trips = db.prepare(tripQuery).all(...tripParams) as TripRow[]

    const daysInMonth = lastDayDate.getDate()
    const result = []

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const att = attendanceMap.get(dateStr)

      const tripEmployees = new Set<number>()
      for (const trip of trips) {
        if (trip.start_date <= dateStr && trip.end_date >= dateStr) {
          tripEmployees.add(trip.employee_id)
        }
      }

      result.push({
        date: dateStr,
        normalCount: att?.normalCount ?? 0,
        lateCount: att?.lateCount ?? 0,
        absentCount: att?.absentCount ?? 0,
        leaveCount: att?.leaveCount ?? 0,
        tripCount: tripEmployees.size
      })
    }

    res.json({ success: true, data: result })
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.get('/daily-detail', (req: Request, res: Response): void => {
  const { date, departmentId } = req.query as {
    date: string
    departmentId?: string
  }

  if (!date) {
    res.json({ success: false, error: '缺少必要参数' })
    return
  }

  try {
    let query = `
      SELECT
        e.id as employeeId,
        e.name as employeeName,
        e.employee_no as employeeNo,
        d.name as departmentName,
        st.name as shiftName,
        st.start_time as startTime,
        st.end_time as endTime,
        ar.check_in as checkIn,
        ar.check_out as checkOut,
        ar.status,
        ar.check_in_status as checkInStatus,
        ar.check_out_status as checkOutStatus,
        ar.is_field_work as isFieldWork,
        EXISTS(SELECT 1 FROM business_trips WHERE employee_id = e.id AND status = 'approved' AND start_date <= ? AND end_date >= ?) as isOnTrip,
        EXISTS(SELECT 1 FROM leave_requests WHERE employee_id = e.id AND status = 'approved' AND start_date <= ? AND end_date >= ?) as isOnLeave
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN schedules s ON s.employee_id = e.id AND s.schedule_date = ? AND s.status = 'published'
      LEFT JOIN shift_templates st ON s.shift_id = st.id
      LEFT JOIN attendance_records ar ON ar.employee_id = e.id AND ar.attendance_date = ?
    `
    const params: (string | number)[] = [date, date, date, date, date, date]

    if (departmentId) {
      query += ' WHERE e.department_id = ?'
      params.push(Number(departmentId))
    }

    query += ' ORDER BY e.id ASC'

    const rows = db.prepare(query).all(...params) as Array<{
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
      isFieldWork: number | null
      isOnTrip: number
      isOnLeave: number
    }>

    const result = rows.map((r) => ({
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      employeeNo: r.employeeNo,
      departmentName: r.departmentName,
      shiftName: r.shiftName,
      startTime: r.startTime,
      endTime: r.endTime,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      status: r.status,
      checkInStatus: r.checkInStatus,
      checkOutStatus: r.checkOutStatus,
      isFieldWork: !!r.isFieldWork,
      isOnTrip: !!r.isOnTrip,
      isOnLeave: !!r.isOnLeave
    }))

    res.json({ success: true, data: result })
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

export default router
