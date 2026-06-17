import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.post('/apply', (req: Request, res: Response): void => {
  try {
    const { employeeId, destination, startDate, endDate, purpose } = req.body

    if (!employeeId || !destination || !startDate || !endDate || !purpose) {
      res.json({ success: false, error: '缺少必填参数' })
      return
    }

    const employee = db.prepare('SELECT id, name FROM employees WHERE id = ?').get(employeeId) as any
    if (!employee) {
      res.json({ success: false, error: '员工不存在' })
      return
    }

    const info = db.prepare(
      `INSERT INTO business_trips (employee_id, destination, start_date, end_date, purpose, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`
    ).run(employeeId, destination, startDate, endDate, purpose) as any

    res.json({ success: true, data: { id: info.lastInsertRowid } })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '申请失败' })
  }
})

router.post('/approve/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { approverId, status } = req.body

    if (!approverId || !status) {
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

    const trip = db.prepare('SELECT * FROM business_trips WHERE id = ?').get(id) as any
    if (!trip) {
      res.json({ success: false, error: '出差申请不存在' })
      return
    }

    if (trip.status !== 'pending') {
      res.json({ success: false, error: '该申请已处理' })
      return
    }

    db.prepare(
      `UPDATE business_trips SET status = ?, approver_id = ?, approved_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(status, approverId, id)

    if (status === 'approved') {
      db.prepare(
        `INSERT INTO notifications (employee_id, title, content, type)
         VALUES (?, ?, ?, ?)`
      ).run(trip.employee_id, '出差申请已通过', `您提交的出差申请（目的地：${trip.destination}）已通过审批`, 'success')
    }

    res.json({ success: true, data: null })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '审批失败' })
  }
})

router.get('/requests', (req: Request, res: Response): void => {
  try {
    const { employeeId, status, departmentId } = req.query

    let sql = `
      SELECT bt.*, e.name as employee_name, e.employee_no, e.department_id,
             d.name as department_name,
             a.name as approver_name
      FROM business_trips bt
      LEFT JOIN employees e ON bt.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN employees a ON bt.approver_id = a.id
      WHERE 1=1
    `
    const params: any[] = []

    if (employeeId) {
      sql += ' AND bt.employee_id = ?'
      params.push(employeeId)
    }
    if (status) {
      sql += ' AND bt.status = ?'
      params.push(status)
    }
    if (departmentId) {
      sql += ' AND e.department_id = ?'
      params.push(departmentId)
    }

    sql += ' ORDER BY bt.created_at DESC'

    const rows = db.prepare(sql).all(...params) as any[]

    const list = rows.map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      employeeNo: row.employee_no,
      departmentName: row.department_name,
      destination: row.destination,
      startDate: row.start_date,
      endDate: row.end_date,
      purpose: row.purpose,
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

router.get('/check', (req: Request, res: Response): void => {
  try {
    const { employeeId, date } = req.query

    if (!employeeId || !date) {
      res.json({ success: false, error: '缺少必填参数' })
      return
    }

    const trip = db.prepare(
      `SELECT id FROM business_trips
       WHERE employee_id = ? AND status = 'approved' AND start_date <= ? AND end_date >= ?`
    ).get(employeeId, date, date) as any

    res.json({ success: true, data: { hasTrip: !!trip } })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '查询失败' })
  }
})

export default router
