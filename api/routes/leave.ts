import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

const LEAVE_TYPES = ['personal', 'sick', 'annual', 'compensatory', 'marriage', 'maternity']
const REQUEST_STATUSES = ['pending', 'approved', 'rejected']

router.post('/apply', (req: Request, res: Response): void => {
  try {
    const { employeeId, leaveType, startDate, endDate, duration, reason } = req.body

    if (!employeeId || !leaveType || !startDate || !endDate || !duration || !reason) {
      res.json({ success: false, error: '缺少必填参数' })
      return
    }

    if (!LEAVE_TYPES.includes(leaveType)) {
      res.json({ success: false, error: '无效的请假类型' })
      return
    }

    const employee = db.prepare('SELECT id, name FROM employees WHERE id = ?').get(employeeId) as any
    if (!employee) {
      res.json({ success: false, error: '员工不存在' })
      return
    }

    if (leaveType === 'annual') {
      const currentYear = new Date().getFullYear()
      const quota = db.prepare(
        'SELECT * FROM annual_leave_quotas WHERE employee_id = ? AND year = ?'
      ).get(employeeId, currentYear) as any
      if (quota && quota.used_days + duration > quota.quota_days) {
        res.json({ success: false, error: '年假额度不足' })
        return
      }
    }

    const info = db.prepare(
      `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, duration, reason)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(employeeId, leaveType, startDate, endDate, duration, reason) as any

    res.json({ success: true, data: { id: info.lastInsertRowid } })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '申请失败' })
  }
})

router.get('/requests', (req: Request, res: Response): void => {
  try {
    const { employeeId, status, departmentId } = req.query

    let sql = `
      SELECT lr.*, e.name as employee_name, e.department_id,
             a.name as approver_name
      FROM leave_requests lr
      LEFT JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN employees a ON lr.approver_id = a.id
      WHERE 1=1
    `
    const params: any[] = []

    if (employeeId) {
      sql += ' AND lr.employee_id = ?'
      params.push(employeeId)
    }
    if (status) {
      sql += ' AND lr.status = ?'
      params.push(status)
    }
    if (departmentId) {
      sql += ' AND e.department_id = ?'
      params.push(departmentId)
    }

    sql += ' ORDER BY lr.created_at DESC'

    const rows = db.prepare(sql).all(...params) as any[]

    const list = rows.map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      leaveType: row.leave_type,
      startDate: row.start_date,
      endDate: row.end_date,
      duration: row.duration,
      reason: row.reason,
      status: row.status,
      approverId: row.approver_id,
      approverName: row.approver_name,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
    }))

    res.json({ success: true, data: list })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '获取列表失败' })
  }
})

router.post('/approve', (req: Request, res: Response): void => {
  try {
    const { requestId, status, approverId } = req.body

    if (!requestId || !status || !approverId) {
      res.json({ success: false, error: '缺少必填参数' })
      return
    }

    if (!['approved', 'rejected'].includes(status)) {
      res.json({ success: false, error: '无效的审批状态' })
      return
    }

    const approver = db.prepare('SELECT id FROM employees WHERE id = ?').get(approverId) as any
    if (!approver) {
      res.json({ success: false, error: '审批人不存在' })
      return
    }

    const request = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(requestId) as any
    if (!request) {
      res.json({ success: false, error: '申请记录不存在' })
      return
    }

    if (request.status !== 'pending') {
      res.json({ success: false, error: '该申请已处理' })
      return
    }

    db.prepare(
      `UPDATE leave_requests SET status = ?, approver_id = ?, approved_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(status, approverId, requestId)

    if (status === 'approved' && request.leave_type === 'annual') {
      const currentYear = new Date().getFullYear()
      const quota = db.prepare(
        'SELECT * FROM annual_leave_quotas WHERE employee_id = ? AND year = ?'
      ).get(request.employee_id, currentYear) as any
      if (quota) {
        db.prepare(
          'UPDATE annual_leave_quotas SET used_days = used_days + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(request.duration, quota.id)
      }
    }

    res.json({ success: true, data: null })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '审批失败' })
  }
})

router.post('/overtime/apply', (req: Request, res: Response): void => {
  try {
    const { employeeId, overtimeDate, duration, reason } = req.body

    if (!employeeId || !overtimeDate || !duration || !reason) {
      res.json({ success: false, error: '缺少必填参数' })
      return
    }

    const employee = db.prepare('SELECT id, name FROM employees WHERE id = ?').get(employeeId) as any
    if (!employee) {
      res.json({ success: false, error: '员工不存在' })
      return
    }

    const info = db.prepare(
      `INSERT INTO overtime_requests (employee_id, overtime_date, duration, reason)
       VALUES (?, ?, ?, ?)`
    ).run(employeeId, overtimeDate, duration, reason) as any

    res.json({ success: true, data: { id: info.lastInsertRowid } })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '申请失败' })
  }
})

router.get('/overtime/requests', (req: Request, res: Response): void => {
  try {
    const { employeeId, status, departmentId } = req.query

    let sql = `
      SELECT orr.*, e.name as employee_name, e.department_id,
             a.name as approver_name
      FROM overtime_requests orr
      LEFT JOIN employees e ON orr.employee_id = e.id
      LEFT JOIN employees a ON orr.approver_id = a.id
      WHERE 1=1
    `
    const params: any[] = []

    if (employeeId) {
      sql += ' AND orr.employee_id = ?'
      params.push(employeeId)
    }
    if (status) {
      sql += ' AND orr.status = ?'
      params.push(status)
    }
    if (departmentId) {
      sql += ' AND e.department_id = ?'
      params.push(departmentId)
    }

    sql += ' ORDER BY orr.created_at DESC'

    const rows = db.prepare(sql).all(...params) as any[]

    const list = rows.map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      overtimeDate: row.overtime_date,
      duration: row.duration,
      reason: row.reason,
      status: row.status,
      approverId: row.approver_id,
      approverName: row.approver_name,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
    }))

    res.json({ success: true, data: list })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '获取列表失败' })
  }
})

router.post('/overtime/approve', (req: Request, res: Response): void => {
  try {
    const { requestId, status, approverId } = req.body

    if (!requestId || !status || !approverId) {
      res.json({ success: false, error: '缺少必填参数' })
      return
    }

    if (!['approved', 'rejected'].includes(status)) {
      res.json({ success: false, error: '无效的审批状态' })
      return
    }

    const approver = db.prepare('SELECT id FROM employees WHERE id = ?').get(approverId) as any
    if (!approver) {
      res.json({ success: false, error: '审批人不存在' })
      return
    }

    const request = db.prepare('SELECT * FROM overtime_requests WHERE id = ?').get(requestId) as any
    if (!request) {
      res.json({ success: false, error: '申请记录不存在' })
      return
    }

    if (request.status !== 'pending') {
      res.json({ success: false, error: '该申请已处理' })
      return
    }

    db.prepare(
      `UPDATE overtime_requests SET status = ?, approver_id = ?, approved_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(status, approverId, requestId)

    res.json({ success: true, data: null })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '审批失败' })
  }
})

router.get('/annual-quota', (req: Request, res: Response): void => {
  try {
    const { employeeId } = req.query

    if (!employeeId) {
      res.json({ success: false, error: '缺少参数 employeeId' })
      return
    }

    const employee = db.prepare(
      'SELECT id, name, hire_date FROM employees WHERE id = ?'
    ).get(employeeId) as any

    if (!employee) {
      res.json({ success: false, error: '员工不存在' })
      return
    }

    const currentYear = new Date().getFullYear()
    let quota = db.prepare(
      'SELECT * FROM annual_leave_quotas WHERE employee_id = ? AND year = ?'
    ).get(employeeId, currentYear) as any

    if (!quota) {
      const hireDate = new Date(employee.hire_date)
      const yearsOfService = currentYear - hireDate.getFullYear()
      const baseDays = 5
      const perYear = 1
      const maxDays = 15
      const quotaDays = Math.min(baseDays + yearsOfService * perYear, maxDays)

      db.prepare(
        `INSERT INTO annual_leave_quotas (employee_id, years_of_service, quota_days, used_days, year)
         VALUES (?, ?, ?, 0, ?)`
      ).run(employeeId, yearsOfService, quotaDays, currentYear)

      quota = db.prepare(
        'SELECT * FROM annual_leave_quotas WHERE employee_id = ? AND year = ?'
      ).get(employeeId, currentYear) as any
    }

    const data = {
      employeeId: employee.id,
      employeeName: employee.name,
      yearsOfService: quota.years_of_service,
      quotaDays: quota.quota_days,
      usedDays: quota.used_days,
      remainingDays: quota.quota_days - quota.used_days,
    }

    res.json({ success: true, data })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '获取年假额度失败' })
  }
})

export default router
