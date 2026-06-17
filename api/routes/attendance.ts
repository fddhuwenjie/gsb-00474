import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

interface RuleRow {
  value: string
}

interface LeaveRow {
  id: number
}

interface ScheduleRow {
  id: number
  employee_id: number
  shift_id: number
  schedule_date: string
  week_number: number
  year: number
  status: string
  start_time: string | null
  end_time: string | null
  core_start: string | null
  core_end: string | null
  next_day: number
  shift_type: string
}

interface AttendanceRecordRow {
  id: number
  employee_id: number
  check_in: string | null
  check_out: string | null
  attendance_date: string
  status: string
  check_in_status: string | null
  check_out_status: string | null
  is_field_work: number
  field_location: string | null
  field_description: string | null
  created_at: string
}

interface EmployeeRow {
  id: number
  name?: string
  employee_no?: string
  department_id?: number
  position_id?: number
}

interface CountRow {
  count: number
}

interface MakeupRequestRow {
  id: number
  employee_id: number
  attendance_date: string
  makeup_type: string
  makeup_time: string
  reason: string
  status: string
  approver_id: number | null
  approved_at: string | null
  created_at: string
}

function getRuleValue(key: string, defaultValue: string): string {
  const rule = db.prepare('SELECT value FROM attendance_rules WHERE key = ?').get(key) as RuleRow | undefined
  return rule ? rule.value : defaultValue
}

function parseTime(timeStr: string | null): { hours: number; minutes: number } | null {
  if (!timeStr) return null
  const parts = timeStr.split(':')
  if (parts.length < 2) return null
  return { hours: parseInt(parts[0]), minutes: parseInt(parts[1]) }
}

function getDateTimeMinutes(datetimeStr: string): number {
  const dt = new Date(datetimeStr)
  return dt.getHours() * 60 + dt.getMinutes()
}

function combineDateAndTime(dateStr: string, timeObj: { hours: number; minutes: number }): Date {
  const d = new Date(dateStr + 'T00:00:00')
  d.setHours(timeObj.hours, timeObj.minutes, 0, 0)
  return d
}

function calculateOverallStatus(checkInStatus: string | null, checkOutStatus: string | null, isLeave: boolean): string {
  if (isLeave) return 'leave'
  if (!checkInStatus && !checkOutStatus) return 'absent'
  if (checkInStatus === 'late' || checkOutStatus === 'early_leave') {
    if (checkInStatus === 'late' && checkOutStatus === 'early_leave') return 'late'
    return checkInStatus === 'late' ? 'late' : 'early_leave'
  }
  return 'normal'
}

function checkHasApprovedLeave(employeeId: number, dateStr: string): boolean {
  const leave = db.prepare(`
    SELECT id FROM leave_requests
    WHERE employee_id = ?
      AND status = 'approved'
      AND start_date <= ?
      AND end_date >= ?
  `).get(employeeId, dateStr, dateStr) as LeaveRow | undefined
  return !!leave
}

router.post('/check-in', (req: Request, res: Response): void => {
  const { employeeId, attendanceDate, isFieldWork, fieldLocation, fieldDescription, latitude, longitude } = req.body

  if (!employeeId || !attendanceDate) {
    res.json({ success: false, error: '缺少必要参数' })
    return
  }

  try {
    let outOfGeofence = false
    let geofenceDistance: number | null = null
    let geofenceOfficeName: string | null = null

    if (latitude !== undefined && longitude !== undefined) {
      const offices = db.prepare('SELECT * FROM office_locations').all() as Array<{
        id: number
        name: string
        latitude: number
        longitude: number
        radius: number
        is_default: number
      }>
      let minDist = Infinity
      let closestOffice: typeof offices[0] | null = null
      for (const office of offices) {
        const R = 6371000
        const dLat = (office.latitude - latitude) * Math.PI / 180
        const dLon = (office.longitude - longitude) * Math.PI / 180
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(latitude * Math.PI / 180) * Math.cos(office.latitude * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const dist = R * c
        if (dist < minDist) {
          minDist = dist
          closestOffice = office
        }
      }
      if (closestOffice) {
        geofenceDistance = Math.round(minDist)
        geofenceOfficeName = closestOffice.name
        outOfGeofence = minDist > closestOffice.radius
      }
    }

    const forcedFieldWork = outOfGeofence && !isFieldWork
    const finalIsFieldWork = isFieldWork || forcedFieldWork

    if (forcedFieldWork && !fieldDescription) {
      res.json({
        success: false,
        error: '您当前不在办公地点范围内，需填写外勤说明才能打卡',
        data: { outOfGeofence: true, distance: geofenceDistance, officeName: geofenceOfficeName }
      })
      return
    }

    const schedule = db.prepare(`
      SELECT s.*, st.start_time, st.end_time, st.core_start, st.core_end, st.next_day, st.type as shift_type
      FROM schedules s
      JOIN shift_templates st ON s.shift_id = st.id
      WHERE s.employee_id = ? AND s.schedule_date = ? AND s.status = 'published'
    `).get(employeeId, attendanceDate) as ScheduleRow | undefined

    if (!schedule) {
      res.json({ success: false, error: '当天无排班信息' })
      return
    }

    const hasLeave = checkHasApprovedLeave(employeeId, attendanceDate)

    const now = new Date()
    const checkInTime = now.toISOString().replace('T', ' ').substring(0, 19)
    const lateToleranceMinutes = parseInt(getRuleValue('late_tolerance_minutes', '5'))

    let checkInStatus: string | null = null

    if (schedule.shift_type === 'flexible') {
      checkInStatus = 'normal'
    } else {
      const startTime = parseTime(schedule.start_time)
      if (startTime) {
        const startDateObj = combineDateAndTime(attendanceDate, startTime)
        const toleranceDate = new Date(startDateObj.getTime() + lateToleranceMinutes * 60 * 1000)
        checkInStatus = now > toleranceDate ? 'late' : 'normal'
      } else {
        checkInStatus = 'normal'
      }
    }

    const existingRecord = db.prepare(`
      SELECT id FROM attendance_records WHERE employee_id = ? AND attendance_date = ?
    `).get(employeeId, attendanceDate) as { id: number } | undefined

    let finalStatus: string
    let checkOutStatus: string | null = null

    if (existingRecord) {
      const oldRecord = db.prepare('SELECT check_out, check_out_status FROM attendance_records WHERE id = ?').get(existingRecord.id) as { check_out: string | null; check_out_status: string | null }
      checkOutStatus = oldRecord.check_out_status
      finalStatus = calculateOverallStatus(checkInStatus, checkOutStatus, hasLeave)

      db.prepare(`
        UPDATE attendance_records
        SET check_in = ?, check_in_status = ?, status = ?, is_field_work = ?, field_location = ?, field_description = ?
        WHERE id = ?
      `).run(
        checkInTime,
        checkInStatus,
        finalStatus,
        finalIsFieldWork ? 1 : 0,
        fieldLocation || (forcedFieldWork ? `距${geofenceOfficeName}${geofenceDistance}米` : null),
        fieldDescription || null,
        existingRecord.id
      )
    } else {
      finalStatus = calculateOverallStatus(checkInStatus, null, hasLeave)

      db.prepare(`
        INSERT INTO attendance_records
        (employee_id, check_in, attendance_date, status, check_in_status, check_out_status, is_field_work, field_location, field_description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        employeeId,
        checkInTime,
        attendanceDate,
        finalStatus,
        checkInStatus,
        null,
        finalIsFieldWork ? 1 : 0,
        fieldLocation || (forcedFieldWork ? `距${geofenceOfficeName}${geofenceDistance}米` : null),
        fieldDescription || null
      )
    }

    res.json({
      success: true,
      data: {
        employeeId,
        attendanceDate,
        checkInTime,
        checkInStatus,
        status: finalStatus,
        isFieldWork: !!finalIsFieldWork,
        fieldLocation: fieldLocation || (forcedFieldWork ? `距${geofenceOfficeName}${geofenceDistance}米` : null),
        fieldDescription: fieldDescription || null,
        outOfGeofence,
        geofenceDistance
      }
    })
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/check-out', (req: Request, res: Response): void => {
  const { employeeId, attendanceDate } = req.body

  if (!employeeId || !attendanceDate) {
    res.json({ success: false, error: '缺少必要参数' })
    return
  }

  try {
    const record = db.prepare(`
      SELECT * FROM attendance_records WHERE employee_id = ? AND attendance_date = ?
    `).get(employeeId, attendanceDate) as AttendanceRecordRow | undefined

    if (!record || !record.check_in) {
      res.json({ success: false, error: '未找到上班打卡记录' })
      return
    }

    const schedule = db.prepare(`
      SELECT s.*, st.start_time, st.end_time, st.core_start, st.core_end, st.next_day, st.type as shift_type
      FROM schedules s
      JOIN shift_templates st ON s.shift_id = st.id
      WHERE s.employee_id = ? AND s.schedule_date = ? AND s.status = 'published'
    `).get(employeeId, attendanceDate) as ScheduleRow | undefined

    if (!schedule) {
      res.json({ success: false, error: '当天无排班信息' })
      return
    }

    const now = new Date()
    const checkOutTime = now.toISOString().replace('T', ' ').substring(0, 19)

    let checkOutStatus: string | null = null

    if (schedule.shift_type === 'flexible') {
      checkOutStatus = 'normal'
    } else {
      const endTime = parseTime(schedule.end_time)
      if (endTime) {
        let endDateObj: Date
        if (schedule.next_day) {
          const nextDate = new Date(attendanceDate + 'T00:00:00')
          nextDate.setDate(nextDate.getDate() + 1)
          endDateObj = new Date(nextDate)
          endDateObj.setHours(endTime.hours, endTime.minutes, 0, 0)
        } else {
          endDateObj = combineDateAndTime(attendanceDate, endTime)
        }
        checkOutStatus = now < endDateObj ? 'early_leave' : 'normal'
      } else {
        checkOutStatus = 'normal'
      }
    }

    const hasLeave = checkHasApprovedLeave(employeeId, attendanceDate)
    const finalStatus = calculateOverallStatus(record.check_in_status, checkOutStatus, hasLeave)

    db.prepare(`
      UPDATE attendance_records
      SET check_out = ?, check_out_status = ?, status = ?
      WHERE id = ?
    `).run(checkOutTime, checkOutStatus, finalStatus, record.id)

    res.json({
      success: true,
      data: {
        employeeId,
        attendanceDate,
        checkOutTime,
        checkOutStatus,
        status: finalStatus
      }
    })
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/field', (req: Request, res: Response): void => {
  const { employeeId, attendanceDate, fieldLocation, fieldDescription } = req.body

  if (!employeeId || !attendanceDate) {
    res.json({ success: false, error: '缺少必要参数' })
    return
  }

  try {
    const schedule = db.prepare(`
      SELECT s.*, st.start_time, st.end_time, st.core_start, st.core_end, st.next_day, st.type as shift_type
      FROM schedules s
      JOIN shift_templates st ON s.shift_id = st.id
      WHERE s.employee_id = ? AND s.schedule_date = ? AND s.status = 'published'
    `).get(employeeId, attendanceDate) as ScheduleRow | undefined

    if (!schedule) {
      res.json({ success: false, error: '当天无排班信息' })
      return
    }

    const hasLeave = checkHasApprovedLeave(employeeId, attendanceDate)

    const now = new Date()
    const checkInTime = now.toISOString().replace('T', ' ').substring(0, 19)
    const lateToleranceMinutes = parseInt(getRuleValue('late_tolerance_minutes', '5'))

    let checkInStatus: string | null = null

    if (schedule.shift_type === 'flexible') {
      checkInStatus = 'normal'
    } else {
      const startTime = parseTime(schedule.start_time)
      if (startTime) {
        const startDateObj = combineDateAndTime(attendanceDate, startTime)
        const toleranceDate = new Date(startDateObj.getTime() + lateToleranceMinutes * 60 * 1000)
        checkInStatus = now > toleranceDate ? 'late' : 'normal'
      } else {
        checkInStatus = 'normal'
      }
    }

    const existingRecord = db.prepare(`
      SELECT id, check_out, check_out_status FROM attendance_records WHERE employee_id = ? AND attendance_date = ?
    `).get(employeeId, attendanceDate) as { id: number; check_out: string | null; check_out_status: string | null } | undefined

    let finalStatus: string
    const fieldWorkValue = 1

    if (existingRecord) {
      finalStatus = calculateOverallStatus(checkInStatus, existingRecord.check_out_status, hasLeave)

      db.prepare(`
        UPDATE attendance_records
        SET check_in = ?, check_in_status = ?, status = ?, is_field_work = ?, field_location = ?, field_description = ?
        WHERE id = ?
      `).run(
        checkInTime,
        checkInStatus,
        finalStatus,
        fieldWorkValue,
        fieldLocation || null,
        fieldDescription || null,
        existingRecord.id
      )
    } else {
      finalStatus = calculateOverallStatus(checkInStatus, null, hasLeave)

      db.prepare(`
        INSERT INTO attendance_records
        (employee_id, check_in, attendance_date, status, check_in_status, check_out_status, is_field_work, field_location, field_description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        employeeId,
        checkInTime,
        attendanceDate,
        finalStatus,
        checkInStatus,
        null,
        fieldWorkValue,
        fieldLocation || null,
        fieldDescription || null
      )
    }

    res.json({
      success: true,
      data: {
        employeeId,
        attendanceDate,
        checkInTime,
        checkInStatus,
        status: finalStatus,
        isFieldWork: true,
        fieldLocation: fieldLocation || null,
        fieldDescription: fieldDescription || null
      }
    })
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.get('/records', (req: Request, res: Response): void => {
  const { employeeId, startDate, endDate, departmentId } = req.query

  try {
    const whereClauses: string[] = []
    const params: (string | number)[] = []

    if (employeeId) {
      whereClauses.push('ar.employee_id = ?')
      params.push(employeeId as string)
    }
    if (startDate) {
      whereClauses.push('ar.attendance_date >= ?')
      params.push(startDate as string)
    }
    if (endDate) {
      whereClauses.push('ar.attendance_date <= ?')
      params.push(endDate as string)
    }
    if (departmentId) {
      whereClauses.push('e.department_id = ?')
      params.push(departmentId as string)
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''

    const sql = `
      SELECT
        ar.id,
        ar.employee_id,
        e.name as employee_name,
        e.employee_no,
        d.name as department_name,
        p.name as position_name,
        ar.check_in,
        ar.check_out,
        ar.attendance_date,
        ar.status,
        ar.check_in_status,
        ar.check_out_status,
        ar.is_field_work,
        ar.field_location,
        ar.field_description,
        st.name as shift_name,
        st.type as shift_type,
        st.start_time,
        st.end_time,
        ar.created_at
      FROM attendance_records ar
      JOIN employees e ON ar.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN schedules s ON ar.employee_id = s.employee_id AND ar.attendance_date = s.schedule_date
      LEFT JOIN shift_templates st ON s.shift_id = st.id
      ${whereSQL}
      ORDER BY ar.attendance_date DESC, ar.employee_id ASC
    `

    const records = db.prepare(sql).all(...params) as Array<{
      id: number
      employee_id: number
      employee_name: string
      employee_no: string
      department_name: string | null
      position_name: string | null
      check_in: string | null
      check_out: string | null
      attendance_date: string
      status: string
      check_in_status: string | null
      check_out_status: string | null
      is_field_work: number
      field_location: string | null
      field_description: string | null
      shift_name: string | null
      shift_type: string | null
      start_time: string | null
      end_time: string | null
      created_at: string
    }>

    const result = records.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      employeeNo: r.employee_no,
      departmentName: r.department_name,
      positionName: r.position_name,
      checkIn: r.check_in,
      checkOut: r.check_out,
      attendanceDate: r.attendance_date,
      status: r.status,
      checkInStatus: r.check_in_status,
      checkOutStatus: r.check_out_status,
      isFieldWork: !!r.is_field_work,
      fieldLocation: r.field_location,
      fieldDescription: r.field_description,
      shiftName: r.shift_name,
      shiftType: r.shift_type,
      startTime: r.start_time,
      endTime: r.end_time,
      createdAt: r.created_at
    }))

    res.json({ success: true, data: result })
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/makeup', (req: Request, res: Response): void => {
  const { employeeId, attendanceDate, makeupType, makeupTime, reason } = req.body

  if (!employeeId || !attendanceDate || !makeupType || !makeupTime || !reason) {
    res.json({ success: false, error: '缺少必要参数' })
    return
  }

  if (makeupType !== 'checkin' && makeupType !== 'checkout') {
    res.json({ success: false, error: '补卡类型必须为 checkin 或 checkout' })
    return
  }

  try {
    const employee = db.prepare('SELECT id FROM employees WHERE id = ?').get(employeeId) as EmployeeRow | undefined
    if (!employee) {
      res.json({ success: false, error: '员工不存在' })
      return
    }

    const monthlyLimit = parseInt(getRuleValue('monthly_makeup_limit', '3'))
    const dateObj = new Date(attendanceDate)
    const year = dateObj.getFullYear()
    const month = dateObj.getMonth() + 1
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEndDate = new Date(year, month, 0)
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${monthEndDate.getDate()}`

    const monthCount = db.prepare(`
      SELECT COUNT(*) as count FROM makeup_requests
      WHERE employee_id = ? AND attendance_date >= ? AND attendance_date <= ?
    `).get(employeeId, monthStart, monthEnd) as CountRow

    if (monthCount.count >= monthlyLimit) {
      res.json({ success: false, error: `本月补卡次数已达上限 (${monthlyLimit}次)` })
      return
    }

    const existingRequest = db.prepare(`
      SELECT id FROM makeup_requests
      WHERE employee_id = ? AND attendance_date = ? AND makeup_type = ? AND status = 'pending'
    `).get(employeeId, attendanceDate, makeupType) as { id: number } | undefined

    if (existingRequest) {
      res.json({ success: false, error: '该日期此类型补卡申请已存在，等待审批中' })
      return
    }

    const info = db.prepare(`
      INSERT INTO makeup_requests
      (employee_id, attendance_date, makeup_type, makeup_time, reason, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(employeeId, attendanceDate, makeupType, makeupTime, reason)

    res.json({
      success: true,
      data: {
        id: info.lastInsertRowid,
        employeeId,
        attendanceDate,
        makeupType,
        makeupTime,
        reason,
        status: 'pending'
      }
    })
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.get('/makeup-requests', (req: Request, res: Response): void => {
  const { employeeId, status } = req.query

  try {
    const whereClauses: string[] = []
    const params: (string | number)[] = []

    if (employeeId) {
      whereClauses.push('mr.employee_id = ?')
      params.push(employeeId as string)
    }
    if (status) {
      whereClauses.push('mr.status = ?')
      params.push(status as string)
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''

    const sql = `
      SELECT
        mr.id,
        mr.employee_id,
        e.name as employee_name,
        e.employee_no,
        mr.attendance_date,
        mr.makeup_type,
        mr.makeup_time,
        mr.reason,
        mr.status,
        mr.approver_id,
        ea.name as approver_name,
        mr.approved_at,
        mr.created_at
      FROM makeup_requests mr
      JOIN employees e ON mr.employee_id = e.id
      LEFT JOIN employees ea ON mr.approver_id = ea.id
      ${whereSQL}
      ORDER BY mr.created_at DESC
    `

    const requests = db.prepare(sql).all(...params) as Array<{
      id: number
      employee_id: number
      employee_name: string
      employee_no: string
      attendance_date: string
      makeup_type: string
      makeup_time: string
      reason: string
      status: string
      approver_id: number | null
      approver_name: string | null
      approved_at: string | null
      created_at: string
    }>

    const result = requests.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      employeeNo: r.employee_no,
      attendanceDate: r.attendance_date,
      makeupType: r.makeup_type,
      makeupTime: r.makeup_time,
      reason: r.reason,
      status: r.status,
      approverId: r.approver_id,
      approverName: r.approver_name,
      approvedAt: r.approved_at,
      createdAt: r.created_at
    }))

    res.json({ success: true, data: result })
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/makeup-approve', (req: Request, res: Response): void => {
  const { requestId, status, approverId } = req.body

  if (!requestId || !status || !approverId) {
    res.json({ success: false, error: '缺少必要参数' })
    return
  }

  if (status !== 'approved' && status !== 'rejected') {
    res.json({ success: false, error: '审批状态必须为 approved 或 rejected' })
    return
  }

  try {
    const request = db.prepare(`
      SELECT * FROM makeup_requests WHERE id = ?
    `).get(requestId) as MakeupRequestRow | undefined

    if (!request) {
      res.json({ success: false, error: '补卡申请不存在' })
      return
    }

    if (request.status !== 'pending') {
      res.json({ success: false, error: '该申请已处理，无法重复审批' })
      return
    }

    const approver = db.prepare('SELECT id FROM employees WHERE id = ?').get(approverId) as EmployeeRow | undefined
    if (!approver) {
      res.json({ success: false, error: '审批人不存在' })
      return
    }

    const approvedAt = new Date().toISOString().replace('T', ' ').substring(0, 19)

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE makeup_requests
        SET status = ?, approver_id = ?, approved_at = ?
        WHERE id = ?
      `).run(status, approverId, approvedAt, requestId)

      if (status === 'approved') {
        const record = db.prepare(`
          SELECT * FROM attendance_records WHERE employee_id = ? AND attendance_date = ?
        `).get(request.employee_id, request.attendance_date) as AttendanceRecordRow | undefined

        if (request.makeup_type === 'checkin') {
          if (record) {
            let checkInStatus = record.check_in_status
            if (!checkInStatus) {
              const schedule = db.prepare(`
                SELECT s.*, st.start_time, st.end_time, st.type as shift_type
                FROM schedules s
                JOIN shift_templates st ON s.shift_id = st.id
                WHERE s.employee_id = ? AND s.schedule_date = ?
              `).get(request.employee_id, request.attendance_date) as ScheduleRow | undefined

              if (schedule && schedule.shift_type !== 'flexible') {
                const startTime = parseTime(schedule.start_time)
                const lateToleranceMinutes = parseInt(getRuleValue('late_tolerance_minutes', '5'))
                if (startTime) {
                  const makeupMinutes = getDateTimeMinutes(request.makeup_time)
                  const startMinutes = startTime.hours * 60 + startTime.minutes
                  checkInStatus = (makeupMinutes - startMinutes) > lateToleranceMinutes ? 'late' : 'normal'
                }
              } else {
                checkInStatus = 'normal'
              }
            }

            const hasLeave = checkHasApprovedLeave(request.employee_id, request.attendance_date)
            const finalStatus = calculateOverallStatus(checkInStatus, record.check_out_status, hasLeave)

            db.prepare(`
              UPDATE attendance_records
              SET check_in = ?, check_in_status = ?, status = ?
              WHERE id = ?
            `).run(request.makeup_time, checkInStatus, finalStatus, record.id)
          } else {
            db.prepare(`
              INSERT INTO attendance_records
              (employee_id, check_in, attendance_date, status, check_in_status, check_out_status)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(request.employee_id, request.makeup_time, request.attendance_date, 'normal', 'normal', null)
          }
        } else if (request.makeup_type === 'checkout') {
          if (record) {
            let checkOutStatus = 'normal'
            const schedule = db.prepare(`
              SELECT s.*, st.start_time, st.end_time, st.next_day, st.type as shift_type
              FROM schedules s
              JOIN shift_templates st ON s.shift_id = st.id
              WHERE s.employee_id = ? AND s.schedule_date = ?
            `).get(request.employee_id, request.attendance_date) as ScheduleRow | undefined

            if (schedule && schedule.shift_type !== 'flexible') {
              const endTime = parseTime(schedule.end_time)
              if (endTime) {
                const makeupMinutes = getDateTimeMinutes(request.makeup_time)
                if (schedule.next_day) {
                  const endMinutes = endTime.hours * 60 + endTime.minutes
                  checkOutStatus = makeupMinutes < endMinutes ? 'early_leave' : 'normal'
                } else {
                  const endMinutes = endTime.hours * 60 + endTime.minutes
                  checkOutStatus = makeupMinutes < endMinutes ? 'early_leave' : 'normal'
                }
              }
            }

            const hasLeave = checkHasApprovedLeave(request.employee_id, request.attendance_date)
            const finalStatus = calculateOverallStatus(record.check_in_status, checkOutStatus, hasLeave)

            db.prepare(`
              UPDATE attendance_records
              SET check_out = ?, check_out_status = ?, status = ?
              WHERE id = ?
            `).run(request.makeup_time, checkOutStatus, finalStatus, record.id)
          }
        }
      }
    })

    tx()

    res.json({
      success: true,
      data: {
        id: requestId,
        status,
        approverId,
        approvedAt
      }
    })
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/auto-correct', (req: Request, res: Response): void => {
  const { date } = req.body
  const targetDate = date || new Date().toISOString().split('T')[0]

  try {
    const scheduledEmployees = db.prepare(`
      SELECT s.employee_id
      FROM schedules s
      WHERE s.schedule_date = ? AND s.status = 'published'
    `).all(targetDate) as Array<{ employee_id: number }>

    let corrected = 0
    const details: Array<{ employeeId: number; action: string }> = []

    const tx = db.transaction(() => {
      for (const emp of scheduledEmployees) {
        const record = db.prepare(`
          SELECT id, status FROM attendance_records
          WHERE employee_id = ? AND attendance_date = ?
        `).get(emp.employee_id, targetDate) as { id: number; status: string } | undefined

        if (record && record.status === 'absent') {
          const hasLeave = checkHasApprovedLeave(emp.employee_id, targetDate)

          const hasTrip = db.prepare(`
            SELECT id FROM business_trips
            WHERE employee_id = ? AND status = 'approved' AND start_date <= ? AND end_date >= ?
          `).get(emp.employee_id, targetDate, targetDate) as { id: number } | undefined

          if (hasLeave) {
            db.prepare(`
              UPDATE attendance_records SET status = 'leave' WHERE id = ?
            `).run(record.id)
            corrected++
            details.push({ employeeId: emp.employee_id, action: 'marked_as_leave' })
          } else if (hasTrip) {
            db.prepare(`
              UPDATE attendance_records SET status = 'normal', is_field_work = 1, field_description = '出差' WHERE id = ?
            `).run(record.id)
            corrected++
            details.push({ employeeId: emp.employee_id, action: 'marked_as_business_trip' })
          }
        } else if (!record) {
          const hasLeave = checkHasApprovedLeave(emp.employee_id, targetDate)
          const hasTrip = db.prepare(`
            SELECT id FROM business_trips
            WHERE employee_id = ? AND status = 'approved' AND start_date <= ? AND end_date >= ?
          `).get(emp.employee_id, targetDate, targetDate) as { id: number } | undefined

          if (hasLeave) {
            db.prepare(`
              INSERT INTO attendance_records (employee_id, attendance_date, status, check_in_status, check_out_status)
              VALUES (?, ?, 'leave', NULL, NULL)
            `).run(emp.employee_id, targetDate)
            corrected++
            details.push({ employeeId: emp.employee_id, action: 'created_as_leave' })
          } else if (hasTrip) {
            db.prepare(`
              INSERT INTO attendance_records (employee_id, attendance_date, status, is_field_work, field_description, check_in_status, check_out_status)
              VALUES (?, ?, 'normal', 1, '出差', NULL, NULL)
            `).run(emp.employee_id, targetDate)
            corrected++
            details.push({ employeeId: emp.employee_id, action: 'created_as_business_trip' })
          }
        }
      }
    })

    tx()

    res.json({
      success: true,
      data: { date: targetDate, corrected, details }
    })
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

export default router
