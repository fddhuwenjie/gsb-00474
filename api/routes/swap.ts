import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

const FINAL_STATUSES = ['approved', 'rejected']
const ACTIVE_STATUSES = ['pending', 'confirmed']

router.post('/apply', (req: Request, res: Response): void => {
  try {
    const { requesterId, swapType, originalDate, targetDate, targetEmployeeId, originalShiftId, targetShiftId, reason } = req.body

    if (!requesterId || !swapType || !originalDate || !originalShiftId || !reason) {
      res.json({ success: false, error: '缺少必填参数' })
      return
    }

    if (!['shift_swap', 'shift_exchange'].includes(swapType)) {
      res.json({ success: false, error: '无效的调班类型' })
      return
    }

    if (swapType === 'shift_swap') {
      if (!targetDate) {
        res.json({ success: false, error: '调班需要指定目标日期' })
        return
      }
      if (!targetShiftId) {
        res.json({ success: false, error: '调班需要指定目标班次' })
        return
      }
    }

    if (swapType === 'shift_exchange' && !targetEmployeeId) {
      res.json({ success: false, error: '换班需要指定目标员工' })
      return
    }

    const requesterSchedule = db.prepare(
      'SELECT id, shift_id FROM schedules WHERE employee_id = ? AND schedule_date = ?'
    ).get(requesterId, originalDate) as any

    if (!requesterSchedule) {
      res.json({ success: false, error: '申请人在原日期没有排班' })
      return
    }

    if (Number(requesterSchedule.shift_id) !== Number(originalShiftId)) {
      res.json({ success: false, error: '原班次信息与实际排班不符，请刷新后重试' })
      return
    }

    if (swapType === 'shift_swap' && targetDate) {
      const targetSchedule = db.prepare(
        'SELECT id, shift_id FROM schedules WHERE employee_id = ? AND schedule_date = ?'
      ).get(requesterId, targetDate) as any

      if (!targetSchedule) {
        res.json({ success: false, error: '目标日期没有排班，请选择有排班的日期' })
        return
      }

      if (Number(targetSchedule.shift_id) !== Number(targetShiftId)) {
        res.json({ success: false, error: '目标班次信息与实际排班不符，请刷新后重试' })
        return
      }

      if (Number(originalShiftId) === Number(targetShiftId)) {
        res.json({ success: false, error: '原班次与目标班次相同，无需调班' })
        return
      }
    }

    if (swapType === 'shift_exchange' && targetEmployeeId) {
      const targetSchedule = db.prepare(
        'SELECT id, shift_id FROM schedules WHERE employee_id = ? AND schedule_date = ?'
      ).get(targetEmployeeId, originalDate) as any

      if (!targetSchedule) {
        res.json({ success: false, error: '目标员工在该日期没有排班' })
        return
      }

      if (Number(targetSchedule.shift_id) === Number(originalShiftId)) {
        res.json({ success: false, error: '双方班次相同，无需换班' })
        return
      }
    }

    const existingPending = db.prepare(`
      SELECT id FROM shift_swap_requests
      WHERE requester_id = ?
        AND swap_type = ?
        AND original_date = ?
        AND status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})
    `).get(requesterId, swapType, originalDate, ...ACTIVE_STATUSES) as any

    if (existingPending) {
      res.json({ success: false, error: '该日期已有待处理的申请，请先取消或等待处理' })
      return
    }

    const info = db.prepare(
      `INSERT INTO shift_swap_requests
        (requester_id, target_employee_id, swap_type, original_date, target_date, original_shift_id, target_shift_id, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).run(
      requesterId,
      targetEmployeeId || null,
      swapType,
      originalDate,
      targetDate || null,
      originalShiftId,
      targetShiftId || null,
      reason
    ) as any

    if (swapType === 'shift_exchange' && targetEmployeeId) {
      const requester = db.prepare('SELECT name FROM employees WHERE id = ?').get(requesterId) as any
      db.prepare(
        `INSERT INTO notifications (employee_id, title, content, type) VALUES (?, ?, ?, 'swap')`
      ).run(
        targetEmployeeId,
        '换班申请',
        `${requester?.name || '有员工'}申请与您在${originalDate}换班，请确认`
      )
    }

    res.json({ success: true, data: { id: info.lastInsertRowid } })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '申请失败' })
  }
})

router.post('/confirm/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { targetEmployeeId } = req.body

    if (!targetEmployeeId) {
      res.json({ success: false, error: '缺少必填参数' })
      return
    }

    const request = db.prepare('SELECT * FROM shift_swap_requests WHERE id = ?').get(id) as any
    if (!request) {
      res.json({ success: false, error: '申请记录不存在' })
      return
    }

    if (request.swap_type !== 'shift_exchange') {
      res.json({ success: false, error: '仅换班申请需要确认' })
      return
    }

    if (Number(request.target_employee_id) !== Number(targetEmployeeId)) {
      res.json({ success: false, error: '无权确认此申请' })
      return
    }

    if (FINAL_STATUSES.includes(request.status)) {
      res.json({ success: false, error: '该申请已处理，无法确认' })
      return
    }

    if (request.target_confirmed || request.status === 'confirmed') {
      res.json({ success: false, error: '已确认过，请勿重复操作' })
      return
    }

    if (request.status !== 'pending') {
      res.json({ success: false, error: '该申请状态不可确认' })
      return
    }

    const requesterSchedule = db.prepare(
      'SELECT id, shift_id FROM schedules WHERE employee_id = ? AND schedule_date = ?'
    ).get(request.requester_id, request.original_date) as any

    const targetSchedule = db.prepare(
      'SELECT id, shift_id FROM schedules WHERE employee_id = ? AND schedule_date = ?'
    ).get(request.target_employee_id, request.original_date) as any

    if (!requesterSchedule || !targetSchedule) {
      res.json({ success: false, error: '当前排班已变更，无法确认该换班申请' })
      return
    }

    if (Number(requesterSchedule.shift_id) !== Number(request.original_shift_id)) {
      res.json({ success: false, error: '申请人排班已变更，无法确认该换班申请' })
      return
    }

    const result = db.transaction(() => {
      const updateResult = db.prepare(
        `UPDATE shift_swap_requests
         SET target_confirmed = 1, status = 'confirmed'
         WHERE id = ? AND status = 'pending' AND target_confirmed = 0`
      ).run(id)

      if (updateResult.changes === 0) {
        throw new Error('申请状态已变更，请刷新后重试')
      }

      const target = db.prepare('SELECT name FROM employees WHERE id = ?').get(targetEmployeeId) as any
      db.prepare(
        `INSERT INTO notifications (employee_id, title, content, type) VALUES (?, ?, ?, 'swap')`
      ).run(
        request.requester_id,
        '换班已确认',
        `${target?.name || '目标员工'}已确认您的换班申请，等待审批`
      )

      return true
    })()

    if (result) {
      res.json({ success: true, data: null })
    } else {
      res.json({ success: false, error: '确认失败' })
    }
  } catch (err: any) {
    res.json({ success: false, error: err.message || '确认失败' })
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

    const approver = db.prepare('SELECT id, name FROM employees WHERE id = ?').get(approverId) as any
    if (!approver) {
      res.json({ success: false, error: '审批人不存在' })
      return
    }

    const request = db.prepare('SELECT * FROM shift_swap_requests WHERE id = ?').get(id) as any
    if (!request) {
      res.json({ success: false, error: '申请记录不存在' })
      return
    }

    if (FINAL_STATUSES.includes(request.status)) {
      res.json({ success: false, error: '该申请已处理，请勿重复操作' })
      return
    }

    if (!ACTIVE_STATUSES.includes(request.status)) {
      res.json({ success: false, error: '该申请状态不可审批' })
      return
    }

    if (status === 'approved') {
      if (request.swap_type === 'shift_exchange' && !request.target_confirmed) {
        res.json({ success: false, error: '换班申请需目标员工先确认' })
        return
      }

      if (request.swap_type === 'shift_swap') {
        if (!request.target_date) {
          res.json({ success: false, error: '调班申请缺少目标日期' })
          return
        }

        const originalSchedule = db.prepare(
          'SELECT id, shift_id FROM schedules WHERE employee_id = ? AND schedule_date = ?'
        ).get(request.requester_id, request.original_date) as any

        const targetSchedule = db.prepare(
          'SELECT id, shift_id FROM schedules WHERE employee_id = ? AND schedule_date = ?'
        ).get(request.requester_id, request.target_date) as any

        if (!originalSchedule) {
          res.json({ success: false, error: '申请人原日期排班已变更，无法通过审批' })
          return
        }

        if (!targetSchedule) {
          res.json({ success: false, error: '申请人目标日期排班已变更，无法通过审批' })
          return
        }

        if (Number(originalSchedule.shift_id) !== Number(request.original_shift_id)) {
          res.json({ success: false, error: '原班次已变更，无法通过审批' })
          return
        }

        if (Number(targetSchedule.shift_id) !== Number(request.target_shift_id)) {
          res.json({ success: false, error: '目标班次已变更，无法通过审批' })
          return
        }
      }

      if (request.swap_type === 'shift_exchange') {
        const requesterSchedule = db.prepare(
          'SELECT id, shift_id FROM schedules WHERE employee_id = ? AND schedule_date = ?'
        ).get(request.requester_id, request.original_date) as any

        const targetSchedule = db.prepare(
          'SELECT id, shift_id FROM schedules WHERE employee_id = ? AND schedule_date = ?'
        ).get(request.target_employee_id, request.original_date) as any

        if (!requesterSchedule || !targetSchedule) {
          res.json({ success: false, error: '排班已变更，无法通过审批' })
          return
        }

        if (Number(requesterSchedule.shift_id) !== Number(request.original_shift_id)) {
          res.json({ success: false, error: '申请人班次已变更，无法通过审批' })
          return
        }
      }
    }

    const success = db.transaction(() => {
      const statusPlaceholders = ACTIVE_STATUSES.map(() => '?').join(',')
      const updateResult = db.prepare(
        `UPDATE shift_swap_requests
         SET status = ?, approver_id = ?, approved_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status IN (${statusPlaceholders})`
      ).run(status, approverId, id, ...ACTIVE_STATUSES)

      if (updateResult.changes === 0) {
        throw new Error('申请状态已变更，请刷新后重试')
      }

      if (status === 'approved') {
        if (request.swap_type === 'shift_swap') {
          const originalSchedule = db.prepare(
            'SELECT id, shift_id FROM schedules WHERE employee_id = ? AND schedule_date = ?'
          ).get(request.requester_id, request.original_date) as any

          const targetSchedule = db.prepare(
            'SELECT id, shift_id FROM schedules WHERE employee_id = ? AND schedule_date = ?'
          ).get(request.requester_id, request.target_date) as any

          if (!originalSchedule || !targetSchedule) {
            throw new Error('排班数据不存在，审批失败')
          }

          const originalShiftId = originalSchedule.shift_id
          db.prepare('UPDATE schedules SET shift_id = ? WHERE id = ?').run(targetSchedule.shift_id, originalSchedule.id)
          db.prepare('UPDATE schedules SET shift_id = ? WHERE id = ?').run(originalShiftId, targetSchedule.id)
        } else if (request.swap_type === 'shift_exchange') {
          const requesterSchedule = db.prepare(
            'SELECT id, shift_id FROM schedules WHERE employee_id = ? AND schedule_date = ?'
          ).get(request.requester_id, request.original_date) as any

          const targetSchedule = db.prepare(
            'SELECT id, shift_id FROM schedules WHERE employee_id = ? AND schedule_date = ?'
          ).get(request.target_employee_id, request.original_date) as any

          if (!requesterSchedule || !targetSchedule) {
            throw new Error('排班数据不存在，审批失败')
          }

          const requesterShiftId = requesterSchedule.shift_id
          db.prepare('UPDATE schedules SET shift_id = ? WHERE id = ?').run(targetSchedule.shift_id, requesterSchedule.id)
          db.prepare('UPDATE schedules SET shift_id = ? WHERE id = ?').run(requesterShiftId, targetSchedule.id)
        }

        db.prepare(
          `INSERT INTO notifications (employee_id, title, content, type) VALUES (?, ?, ?, 'swap')`
        ).run(request.requester_id, '调班申请已通过', '您的调班申请已通过审批')

        if (request.swap_type === 'shift_exchange' && request.target_employee_id) {
          db.prepare(
            `INSERT INTO notifications (employee_id, title, content, type) VALUES (?, ?, ?, 'swap')`
          ).run(request.target_employee_id, '换班申请已通过', '您参与的换班申请已通过审批')
        }
      } else {
        db.prepare(
          `INSERT INTO notifications (employee_id, title, content, type) VALUES (?, ?, ?, 'swap')`
        ).run(request.requester_id, '调班申请已拒绝', '您的调班申请未被批准')

        if (request.swap_type === 'shift_exchange' && request.target_employee_id) {
          db.prepare(
            `INSERT INTO notifications (employee_id, title, content, type) VALUES (?, ?, ?, 'swap')`
          ).run(request.target_employee_id, '换班申请已拒绝', '您参与的换班申请未被批准')
        }
      }

      return true
    })()

    if (success) {
      res.json({ success: true, data: null })
    } else {
      res.json({ success: false, error: '审批失败' })
    }
  } catch (err: any) {
    res.json({ success: false, error: err.message || '审批失败' })
  }
})

router.get('/requests', (req: Request, res: Response): void => {
  try {
    const { employeeId, status, departmentId } = req.query

    let sql = `
      SELECT ssr.*,
             e1.name as requester_name,
             e2.name as target_employee_name,
             st1.name as original_shift_name,
             st2.name as target_shift_name
      FROM shift_swap_requests ssr
      LEFT JOIN employees e1 ON ssr.requester_id = e1.id
      LEFT JOIN employees e2 ON ssr.target_employee_id = e2.id
      LEFT JOIN shift_templates st1 ON ssr.original_shift_id = st1.id
      LEFT JOIN shift_templates st2 ON ssr.target_shift_id = st2.id
      WHERE 1=1
    `
    const params: any[] = []

    if (employeeId) {
      sql += ' AND (ssr.requester_id = ? OR ssr.target_employee_id = ?)'
      params.push(employeeId, employeeId)
    }
    if (status) {
      sql += ' AND ssr.status = ?'
      params.push(status)
    }
    if (departmentId) {
      sql += ' AND e1.department_id = ?'
      params.push(departmentId)
    }

    sql += ' ORDER BY ssr.created_at DESC'

    const rows = db.prepare(sql).all(...params) as any[]

    const list = rows.map((row) => ({
      id: row.id,
      requesterId: row.requester_id,
      requesterName: row.requester_name,
      targetEmployeeId: row.target_employee_id,
      targetEmployeeName: row.target_employee_name,
      swapType: row.swap_type,
      originalDate: row.original_date,
      targetDate: row.target_date,
      originalShiftId: row.original_shift_id,
      originalShiftName: row.original_shift_name,
      targetShiftId: row.target_shift_id,
      targetShiftName: row.target_shift_name,
      reason: row.reason,
      targetConfirmed: !!row.target_confirmed,
      status: row.status,
      approverId: row.approver_id,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
    }))

    res.json({ success: true, data: list })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '获取列表失败' })
  }
})

router.get('/my', (req: Request, res: Response): void => {
  try {
    const { employeeId, status } = req.query

    if (!employeeId) {
      res.json({ success: false, error: '缺少参数 employeeId' })
      return
    }

    let sql = `
      SELECT ssr.*,
             e1.name as requester_name,
             e2.name as target_employee_name,
             st1.name as original_shift_name,
             st2.name as target_shift_name
      FROM shift_swap_requests ssr
      LEFT JOIN employees e1 ON ssr.requester_id = e1.id
      LEFT JOIN employees e2 ON ssr.target_employee_id = e2.id
      LEFT JOIN shift_templates st1 ON ssr.original_shift_id = st1.id
      LEFT JOIN shift_templates st2 ON ssr.target_shift_id = st2.id
      WHERE (ssr.requester_id = ? OR ssr.target_employee_id = ?)
    `
    const params: any[] = [employeeId, employeeId]

    if (status) {
      sql += ' AND ssr.status = ?'
      params.push(status)
    }

    sql += ' ORDER BY ssr.created_at DESC'

    const rows = db.prepare(sql).all(...params) as any[]

    const list = rows.map((row) => ({
      id: row.id,
      requesterId: row.requester_id,
      requesterName: row.requester_name,
      targetEmployeeId: row.target_employee_id,
      targetEmployeeName: row.target_employee_name,
      swapType: row.swap_type,
      originalDate: row.original_date,
      targetDate: row.target_date,
      originalShiftId: row.original_shift_id,
      originalShiftName: row.original_shift_name,
      targetShiftId: row.target_shift_id,
      targetShiftName: row.target_shift_name,
      reason: row.reason,
      targetConfirmed: !!row.target_confirmed,
      status: row.status,
      approverId: row.approver_id,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
    }))

    res.json({ success: true, data: list })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '获取列表失败' })
  }
})

export default router
