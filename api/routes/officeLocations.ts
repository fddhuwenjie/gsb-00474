import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const locations = db.prepare(`
      SELECT id, name, latitude, longitude, radius, is_default, created_at
      FROM office_locations
      ORDER BY is_default DESC
    `).all()
    res.json({ success: true, data: locations })
  } catch (error: any) {
    res.json({ success: false, error: error.message || '获取办公地点列表失败' })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const { name, latitude, longitude, radius, isDefault } = req.body

    if (!name || latitude === undefined || longitude === undefined) {
      res.json({ success: false, error: '缺少必填字段: name, latitude, longitude' })
      return
    }

    const stmt = db.prepare(`
      INSERT INTO office_locations (name, latitude, longitude, radius, is_default)
      VALUES (?, ?, ?, ?, ?)
    `)
    const result = stmt.run(name, latitude, longitude, radius ?? 200, isDefault ? 1 : 0)

    const location = db.prepare(`
      SELECT id, name, latitude, longitude, radius, is_default, created_at
      FROM office_locations WHERE id = ?
    `).get(result.lastInsertRowid)

    res.json({ success: true, data: location })
  } catch (error: any) {
    res.json({ success: false, error: error.message || '创建办公地点失败' })
  }
})

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { name, latitude, longitude, radius, isDefault } = req.body

    const existing = db.prepare('SELECT id FROM office_locations WHERE id = ?').get(id)
    if (!existing) {
      res.json({ success: false, error: '办公地点不存在' })
      return
    }

    db.prepare(`
      UPDATE office_locations
      SET name = COALESCE(?, name),
          latitude = COALESCE(?, latitude),
          longitude = COALESCE(?, longitude),
          radius = COALESCE(?, radius),
          is_default = COALESCE(?, is_default)
      WHERE id = ?
    `).run(name ?? null, latitude ?? null, longitude ?? null, radius ?? null, isDefault !== undefined ? (isDefault ? 1 : 0) : null, id)

    const location = db.prepare(`
      SELECT id, name, latitude, longitude, radius, is_default, created_at
      FROM office_locations WHERE id = ?
    `).get(id)

    res.json({ success: true, data: location })
  } catch (error: any) {
    res.json({ success: false, error: error.message || '更新办公地点失败' })
  }
})

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const existing = db.prepare('SELECT id FROM office_locations WHERE id = ?').get(id)
    if (!existing) {
      res.json({ success: false, error: '办公地点不存在' })
      return
    }

    db.prepare('DELETE FROM office_locations WHERE id = ?').run(id)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.json({ success: false, error: error.message || '删除办公地点失败' })
  }
})

router.get('/default', (req: Request, res: Response): void => {
  try {
    const location = db.prepare(`
      SELECT id, name, latitude, longitude, radius, is_default, created_at
      FROM office_locations
      WHERE is_default = 1
    `).get()
    res.json({ success: true, data: location || null })
  } catch (error: any) {
    res.json({ success: false, error: error.message || '获取默认办公地点失败' })
  }
})

export default router
