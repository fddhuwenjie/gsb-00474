/**
 * 基础数据API
 */
import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

/**
 * 获取部门列表
 * GET /api/basic/departments
 */
router.get('/departments', (req: Request, res: Response): void => {
  try {
    const stmt = db.prepare(`
      SELECT id, name, created_at
      FROM departments
      ORDER BY id ASC
    `)
    const departments = stmt.all()
    res.json({ success: true, data: departments })
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : '获取部门列表失败' })
  }
})

/**
 * 获取岗位列表
 * GET /api/basic/positions
 * query: departmentId? (可选，按部门筛选)
 */
router.get('/positions', (req: Request, res: Response): void => {
  try {
    const { departmentId } = req.query as { departmentId?: string }

    let query = `
      SELECT
        p.id,
        p.name,
        p.department_id,
        d.name as department_name,
        p.created_at
      FROM positions p
      JOIN departments d ON p.department_id = d.id
    `
    const params: number[] = []

    // 如果传入 departmentId，则按部门筛选
    if (departmentId) {
      query += ' WHERE p.department_id = ?'
      params.push(Number(departmentId))
    }

    query += ' ORDER BY p.department_id ASC, p.id ASC'

    const stmt = db.prepare(query)
    const positions = stmt.all(...params)
    res.json({ success: true, data: positions })
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : '获取岗位列表失败' })
  }
})

/**
 * 获取员工列表
 * GET /api/basic/employees
 * query: departmentId? (可选，按部门筛选)
 * 返回员工详情，包含部门名称和岗位名称
 */
router.get('/employees', (req: Request, res: Response): void => {
  try {
    const { departmentId } = req.query as { departmentId?: string }

    let query = `
      SELECT
        e.id,
        e.name,
        e.employee_no,
        e.department_id,
        d.name as department_name,
        e.position_id,
        p.name as position_name,
        e.role,
        e.hire_date,
        e.manager_id,
        m.name as manager_name,
        e.created_at
      FROM employees e
      JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN employees m ON e.manager_id = m.id
    `
    const params: number[] = []

    // 如果传入 departmentId，则按部门筛选
    if (departmentId) {
      query += ' WHERE e.department_id = ?'
      params.push(Number(departmentId))
    }

    query += ' ORDER BY e.department_id ASC, e.id ASC'

    const stmt = db.prepare(query)
    const employees = stmt.all(...params)
    res.json({ success: true, data: employees })
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : '获取员工列表失败' })
  }
})

export default router
