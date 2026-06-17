import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const { employeeId, unreadOnly } = req.query as { employeeId?: string; unreadOnly?: string }

    if (!employeeId) {
      res.json({ success: false, error: '缺少参数 employeeId' })
      return
    }

    let sql = 'SELECT * FROM notifications WHERE employee_id = ?'
    const params: any[] = [employeeId]

    if (unreadOnly === 'true') {
      sql += ' AND is_read = 0'
    }

    sql += ' ORDER BY created_at DESC'

    const rows = db.prepare(sql).all(...params) as any[]

    const list = rows.map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      title: row.title,
      content: row.content,
      type: row.type,
      isRead: row.is_read,
      createdAt: row.created_at,
    }))

    res.json({ success: true, data: list })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '获取通知列表失败' })
  }
})

router.put('/read/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as any
    if (!notification) {
      res.json({ success: false, error: '通知不存在' })
      return
    }

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id)

    res.json({ success: true, data: null })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '标记已读失败' })
  }
})

router.put('/read-all', (req: Request, res: Response): void => {
  try {
    const { employeeId } = req.body

    if (!employeeId) {
      res.json({ success: false, error: '缺少参数 employeeId' })
      return
    }

    db.prepare('UPDATE notifications SET is_read = 1 WHERE employee_id = ? AND is_read = 0').run(employeeId)

    res.json({ success: true, data: null })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '全部标记已读失败' })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const { employeeId, title, content, type } = req.body

    if (!employeeId || !title || !content) {
      res.json({ success: false, error: '缺少必填参数' })
      return
    }

    const notificationType = type || 'info'

    if (!['info', 'success', 'warning'].includes(notificationType)) {
      res.json({ success: false, error: '无效的通知类型' })
      return
    }

    const info = db.prepare(
      `INSERT INTO notifications (employee_id, title, content, type) VALUES (?, ?, ?, ?)`
    ).run(employeeId, title, content, notificationType) as any

    res.json({ success: true, data: { id: info.lastInsertRowid } })
  } catch (err: any) {
    res.json({ success: false, error: err.message || '创建通知失败' })
  }
})

export default router
