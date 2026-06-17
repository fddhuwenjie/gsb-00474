import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/dashboard', (req: Request, res: Response): void => {
  try {
    const { today } = req.query
    const todayDate = today ? new Date(String(today)) : new Date()
    const todayStr = todayDate.toISOString().split('T')[0]
    const year = todayDate.getFullYear()
    const month = todayDate.getMonth() + 1
    const monthStr = `${year}-${String(month).padStart(2, '0')}`

    const totalEmployees = db.prepare('SELECT COUNT(*) as count FROM employees').get() as { count: number }

    const todayStatsRow = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status != 'absent' AND check_in IS NOT NULL THEN 1 ELSE 0 END) as checked_in,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN check_in_status = 'late' OR status = 'late' THEN 1 ELSE 0 END) as late
      FROM attendance_records
      WHERE attendance_date = ?
    `).get(todayStr) as any

    const todayStats = {
      total: totalEmployees.count,
      checkedIn: todayStatsRow.checked_in || 0,
      absent: todayStatsRow.absent || 0,
      late: todayStatsRow.late || 0,
    }

    const lateList = db.prepare(`
      SELECT e.id, e.name, e.employee_no, d.name as department, ar.check_in, ar.check_in_status
      FROM attendance_records ar
      JOIN employees e ON ar.employee_id = e.id
      JOIN departments d ON e.department_id = d.id
      WHERE ar.attendance_date = ? AND (ar.check_in_status = 'late' OR ar.status = 'late')
      ORDER BY ar.check_in ASC
    `).all(todayStr)

    const monthAttendance = db.prepare(`
      SELECT
        COUNT(*) as total_scheduled,
        SUM(CASE WHEN status IN ('normal', 'late', 'early_leave', 'leave', 'field_work') THEN 1 ELSE 0 END) as attended
      FROM attendance_records
      WHERE strftime('%Y-%m', attendance_date) = ?
    `).get(monthStr) as any

    const monthAttendanceRate = monthAttendance.total_scheduled > 0
      ? Math.round((monthAttendance.attended / monthAttendance.total_scheduled) * 10000) / 100
      : 0

    const monthLateTop5 = db.prepare(`
      SELECT e.name, COUNT(*) as late_count
      FROM attendance_records ar
      JOIN employees e ON ar.employee_id = e.id
      WHERE strftime('%Y-%m', ar.attendance_date) = ?
        AND (ar.check_in_status = 'late' OR ar.status = 'late')
      GROUP BY ar.employee_id
      ORDER BY late_count DESC
      LIMIT 5
    `).all(monthStr)

    const monthOvertimeTop5 = db.prepare(`
      SELECT e.name, SUM(ot.duration) as overtime_hours
      FROM overtime_requests ot
      JOIN employees e ON ot.employee_id = e.id
      WHERE strftime('%Y-%m', ot.overtime_date) = ? AND ot.status = 'approved'
      GROUP BY ot.employee_id
      ORDER BY overtime_hours DESC
      LIMIT 5
    `).all(monthStr)

    const departmentRates = db.prepare(`
      SELECT d.id, d.name,
        COUNT(*) as total_scheduled,
        SUM(CASE WHEN ar.status IN ('normal', 'late', 'early_leave', 'leave', 'field_work') THEN 1 ELSE 0 END) as attended
      FROM attendance_records ar
      JOIN employees e ON ar.employee_id = e.id
      JOIN departments d ON e.department_id = d.id
      WHERE strftime('%Y-%m', ar.attendance_date) = ?
      GROUP BY d.id
    `).all(monthStr).map((row: any) => ({
      id: row.id,
      name: row.name,
      totalScheduled: row.total_scheduled,
      attended: row.attended,
      attendanceRate: row.total_scheduled > 0
        ? Math.round((row.attended / row.total_scheduled) * 10000) / 100
        : 0,
    }))

    res.json({
      success: true,
      data: {
        todayStats,
        lateList,
        monthAttendanceRate,
        monthLateTop5,
        monthOvertimeTop5,
        departmentRates,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '获取仪表盘数据失败' })
  }
})

router.get('/personal', (req: Request, res: Response): void => {
  try {
    const { employeeId, year, month } = req.query
    if (!employeeId || !year || !month) {
      res.status(400).json({ success: false, error: '缺少参数: employeeId, year, month' })
      return
    }

    const empId = Number(employeeId)
    const y = Number(year)
    const m = Number(month)
    const monthStr = `${y}-${String(m).padStart(2, '0')}`

    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(empId) as any
    if (!employee) {
      res.status(404).json({ success: false, error: '员工不存在' })
      return
    }

    const monthStats = db.prepare(`
      SELECT
        SUM(CASE WHEN status IN ('normal', 'late', 'early_leave', 'field_work') THEN 1 ELSE 0 END) as attendance_days,
        SUM(CASE WHEN check_in_status = 'late' OR status = 'late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN check_out_status = 'early_leave' OR status = 'early_leave' THEN 1 ELSE 0 END) as early_leave_count,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave_days
      FROM attendance_records
      WHERE employee_id = ? AND strftime('%Y-%m', attendance_date) = ?
    `).get(empId, monthStr) as any

    const overtimeHours = db.prepare(`
      SELECT COALESCE(SUM(duration), 0) as total
      FROM overtime_requests
      WHERE employee_id = ? AND strftime('%Y-%m', overtime_date) = ? AND status = 'approved'
    `).get(empId, monthStr) as { total: number }

    const dailyRecords = db.prepare(`
      SELECT
        ar.attendance_date,
        ar.status,
        ar.check_in,
        ar.check_out,
        ar.check_in_status,
        ar.check_out_status,
        ar.is_field_work,
        ar.field_location,
        ar.field_description,
        st.name as shift_name,
        st.start_time,
        st.end_time
      FROM attendance_records ar
      LEFT JOIN schedules s ON ar.employee_id = s.employee_id AND ar.attendance_date = s.schedule_date
      LEFT JOIN shift_templates st ON s.shift_id = st.id
      WHERE ar.employee_id = ? AND strftime('%Y-%m', ar.attendance_date) = ?
      ORDER BY ar.attendance_date ASC
    `).all(empId, monthStr)

    const leaveRecords = db.prepare(`
      SELECT leave_type, start_date, end_date, duration, status
      FROM leave_requests
      WHERE employee_id = ?
        AND (strftime('%Y-%m', start_date) = ? OR strftime('%Y-%m', end_date) = ?)
    `).all(empId, monthStr, monthStr)

    res.json({
      success: true,
      data: {
        employee: {
          id: employee.id,
          name: employee.name,
          employeeNo: employee.employee_no,
        },
        attendanceDays: monthStats.attendance_days || 0,
        lateCount: monthStats.late_count || 0,
        earlyLeaveCount: monthStats.early_leave_count || 0,
        absentCount: monthStats.absent_count || 0,
        leaveDays: monthStats.leave_days || 0,
        overtimeHours: overtimeHours.total || 0,
        dailyRecords,
        leaveRecords,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '获取个人考勤汇总失败' })
  }
})

router.get('/department', (req: Request, res: Response): void => {
  try {
    const { departmentId, year, month } = req.query
    if (!departmentId || !year || !month) {
      res.status(400).json({ success: false, error: '缺少参数: departmentId, year, month' })
      return
    }

    const deptId = Number(departmentId)
    const y = Number(year)
    const m = Number(month)
    const monthStr = `${y}-${String(m).padStart(2, '0')}`

    const department = db.prepare('SELECT * FROM departments WHERE id = ?').get(deptId) as any
    if (!department) {
      res.status(404).json({ success: false, error: '部门不存在' })
      return
    }

    const employees = db.prepare(`
      SELECT id, name, employee_no, department_id
      FROM employees
      WHERE department_id = ?
    `).all(deptId)

    const summary = employees.map((emp: any) => {
      const stats = db.prepare(`
        SELECT
          SUM(CASE WHEN status IN ('normal', 'late', 'early_leave', 'field_work') THEN 1 ELSE 0 END) as attendance_days,
          SUM(CASE WHEN check_in_status = 'late' OR status = 'late' THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN check_out_status = 'early_leave' OR status = 'early_leave' THEN 1 ELSE 0 END) as early_leave_count,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
          SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave_days
        FROM attendance_records
        WHERE employee_id = ? AND strftime('%Y-%m', attendance_date) = ?
      `).get(emp.id, monthStr) as any

      const ot = db.prepare(`
        SELECT COALESCE(SUM(duration), 0) as overtime_hours
        FROM overtime_requests
        WHERE employee_id = ? AND strftime('%Y-%m', overtime_date) = ? AND status = 'approved'
      `).get(emp.id, monthStr) as { overtime_hours: number }

      const totalScheduled = db.prepare(`
        SELECT COUNT(*) as total
        FROM attendance_records
        WHERE employee_id = ? AND strftime('%Y-%m', attendance_date) = ?
      `).get(emp.id, monthStr) as { total: number }

      const attendanceDays = stats.attendance_days || 0
      const total = totalScheduled.total || 0

      return {
        employeeId: emp.id,
        employeeNo: emp.employee_no,
        name: emp.name,
        departmentId: emp.department_id,
        departmentName: department.name,
        totalScheduled: total,
        attendanceDays,
        attendanceRate: total > 0 ? Math.round((attendanceDays / total) * 10000) / 100 : 0,
        lateCount: stats.late_count || 0,
        earlyLeaveCount: stats.early_leave_count || 0,
        absentCount: stats.absent_count || 0,
        leaveDays: stats.leave_days || 0,
        overtimeHours: ot.overtime_hours || 0,
      }
    })

    res.json({
      success: true,
      data: {
        department: { id: department.id, name: department.name },
        year: y,
        month: m,
        employees: summary,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '获取部门考勤报表失败' })
  }
})

router.get('/export-csv', (req: Request, res: Response): void => {
  try {
    const { departmentId, year, month } = req.query
    if (!departmentId || !year || !month) {
      res.status(400).json({ success: false, error: '缺少参数: departmentId, year, month' })
      return
    }

    const deptId = Number(departmentId)
    const y = Number(year)
    const m = Number(month)
    const monthStr = `${y}-${String(m).padStart(2, '0')}`

    const department = db.prepare('SELECT * FROM departments WHERE id = ?').get(deptId) as any
    if (!department) {
      res.status(404).json({ success: false, error: '部门不存在' })
      return
    }

    const employees = db.prepare(`
      SELECT id, name, employee_no, department_id
      FROM employees
      WHERE department_id = ?
    `).all(deptId)

    const rows: string[] = []
    rows.push('工号,姓名,部门,出勤天数,迟到次数,早退次数,缺勤天数,请假天数,加班时长')

    for (const emp of employees as any[]) {
      const stats = db.prepare(`
        SELECT
          SUM(CASE WHEN status IN ('normal', 'late', 'early_leave', 'field_work') THEN 1 ELSE 0 END) as attendance_days,
          SUM(CASE WHEN check_in_status = 'late' OR status = 'late' THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN check_out_status = 'early_leave' OR status = 'early_leave' THEN 1 ELSE 0 END) as early_leave_count,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
          SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave_days
        FROM attendance_records
        WHERE employee_id = ? AND strftime('%Y-%m', attendance_date) = ?
      `).get(emp.id, monthStr) as any

      const ot = db.prepare(`
        SELECT COALESCE(SUM(duration), 0) as overtime_hours
        FROM overtime_requests
        WHERE employee_id = ? AND strftime('%Y-%m', overtime_date) = ? AND status = 'approved'
      `).get(emp.id, monthStr) as { overtime_hours: number }

      const row = [
        emp.employee_no,
        emp.name,
        department.name,
        stats.attendance_days || 0,
        stats.late_count || 0,
        stats.early_leave_count || 0,
        stats.absent_count || 0,
        stats.leave_days || 0,
        ot.overtime_hours || 0,
      ]
      rows.push(row.join(','))
    }

    const csvContent = rows.join('\n')
    const filename = `${department.name}_${y}年${m}月考勤报表.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    res.write('\uFEFF')
    res.write(csvContent)
    res.end()
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '导出CSV失败' })
  }
})

router.get('/warnings', (req: Request, res: Response): void => {
  try {
    const { year, month } = req.query
    if (!year || !month) {
      res.status(400).json({ success: false, error: '缺少参数: year, month' })
      return
    }

    const y = Number(year)
    const m = Number(month)
    const monthStr = `${y}-${String(m).padStart(2, '0')}`

    const allRecords = db.prepare(`
      SELECT ar.employee_id, e.name, e.employee_no, d.name as department,
        ar.attendance_date, ar.status, ar.check_in_status, ar.check_out_status
      FROM attendance_records ar
      JOIN employees e ON ar.employee_id = e.id
      JOIN departments d ON e.department_id = d.id
      WHERE strftime('%Y-%m', ar.attendance_date) = ?
      ORDER BY ar.employee_id, ar.attendance_date
    `).all(monthStr) as any[]

    const grouped: Record<string, any[]> = {}
    for (const rec of allRecords) {
      if (!grouped[rec.employee_id]) {
        grouped[rec.employee_id] = []
      }
      grouped[rec.employee_id].push(rec)
    }

    const warnings: any[] = []

    for (const empId in grouped) {
      const records = grouped[empId]
      let lateStreak = 0
      let absentStreak = 0
      let lateStreakStart: string | null = null
      let absentStreakStart: string | null = null
      const employeeInfo = {
        employeeId: records[0].employee_id,
        name: records[0].name,
        employeeNo: records[0].employee_no,
        department: records[0].department,
      }

      for (const rec of records) {
        const isLate = rec.check_in_status === 'late' || rec.status === 'late'
        const isAbsent = rec.status === 'absent'

        if (isLate) {
          if (lateStreak === 0) lateStreakStart = rec.attendance_date
          lateStreak++
          if (lateStreak >= 3) {
            warnings.push({
              ...employeeInfo,
              type: '连续迟到',
              streakDays: lateStreak,
              startDate: lateStreakStart,
              endDate: rec.attendance_date,
              highlighted: true,
            })
            lateStreak = 0
            lateStreakStart = null
          }
        } else {
          lateStreak = 0
          lateStreakStart = null
        }

        if (isAbsent) {
          if (absentStreak === 0) absentStreakStart = rec.attendance_date
          absentStreak++
          if (absentStreak >= 3) {
            warnings.push({
              ...employeeInfo,
              type: '连续缺勤未请假',
              streakDays: absentStreak,
              startDate: absentStreakStart,
              endDate: rec.attendance_date,
              highlighted: true,
            })
            absentStreak = 0
            absentStreakStart = null
          }
        } else {
          absentStreak = 0
          absentStreakStart = null
        }
      }
    }

    res.json({
      success: true,
      data: {
        year: y,
        month: m,
        warnings,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '获取异常考勤预警失败' })
  }
})

export default router
