/**
 * 排班管理API
 */
import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

// ============== 班次模板管理 ==============

/**
 * 获取所有班次模板
 * GET /api/schedule/shift-templates
 */
router.get('/shift-templates', (req: Request, res: Response): void => {
  try {
    const stmt = db.prepare(`
      SELECT id, name, type, start_time, end_time, core_start, core_end, next_day, created_at
      FROM shift_templates
      ORDER BY id ASC
    `)
    const templates = stmt.all()
    res.json({ success: true, data: templates })
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : '获取班次模板失败' })
  }
})

/**
 * 创建班次模板
 * POST /api/schedule/shift-templates
 * body: { name, type, start_time?, end_time?, core_start?, core_end?, next_day? }
 */
router.post('/shift-templates', (req: Request, res: Response): void => {
  try {
    const { name, type, start_time, end_time, core_start, core_end, next_day } = req.body

    // 参数校验：班次名称和类型必填
    if (!name || !type) {
      res.json({ success: false, error: '班次名称和类型不能为空' })
      return
    }

    // 检查名称是否已存在
    const checkStmt = db.prepare('SELECT id FROM shift_templates WHERE name = ?')
    if (checkStmt.get(name)) {
      res.json({ success: false, error: '班次名称已存在' })
      return
    }

    const stmt = db.prepare(`
      INSERT INTO shift_templates (name, type, start_time, end_time, core_start, core_end, next_day)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(name, type, start_time || null, end_time || null, core_start || null, core_end || null, next_day || 0)

    res.json({ success: true, data: { id: result.lastInsertRowid } })
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : '创建班次模板失败' })
  }
})

/**
 * 更新班次模板
 * PUT /api/schedule/shift-templates/:id
 */
router.put('/shift-templates/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { name, type, start_time, end_time, core_start, core_end, next_day } = req.body

    // 检查模板是否存在
    const checkStmt = db.prepare('SELECT id FROM shift_templates WHERE id = ?')
    if (!checkStmt.get(id)) {
      res.json({ success: false, error: '班次模板不存在' })
      return
    }

    // 如果修改了名称，检查新名称是否与其他模板冲突
    if (name) {
      const nameCheckStmt = db.prepare('SELECT id FROM shift_templates WHERE name = ? AND id != ?')
      if (nameCheckStmt.get(name, id)) {
        res.json({ success: false, error: '班次名称已存在' })
        return
      }
    }

    const stmt = db.prepare(`
      UPDATE shift_templates
      SET name = COALESCE(?, name),
          type = COALESCE(?, type),
          start_time = ?,
          end_time = ?,
          core_start = ?,
          core_end = ?,
          next_day = COALESCE(?, next_day)
      WHERE id = ?
    `)
    stmt.run(name || null, type || null, start_time ?? null, end_time ?? null, core_start ?? null, core_end ?? null, next_day ?? null, id)

    res.json({ success: true, data: { message: '更新成功' } })
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : '更新班次模板失败' })
  }
})

/**
 * 删除班次模板
 * DELETE /api/schedule/shift-templates/:id
 */
router.delete('/shift-templates/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    // 检查是否有排班使用此模板
    const usageStmt = db.prepare('SELECT COUNT(*) as count FROM schedules WHERE shift_id = ?')
    const usage = usageStmt.get(id) as { count: number }
    if (usage.count > 0) {
      res.json({ success: false, error: '该班次模板已被排班使用，无法删除' })
      return
    }

    const stmt = db.prepare('DELETE FROM shift_templates WHERE id = ?')
    const result = stmt.run(id)

    if (result.changes === 0) {
      res.json({ success: false, error: '班次模板不存在' })
      return
    }

    res.json({ success: true, data: { message: '删除成功' } })
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : '删除班次模板失败' })
  }
})

// ============== 排班管理 ==============

// 辅助函数：根据日期计算周数和年份
function getWeekInfo(dateStr: string): { weekNumber: number; year: number } {
  const date = new Date(dateStr)
  const firstDay = new Date(date.getFullYear(), 0, 1)
  const weekNumber = Math.ceil(((date.getTime() - firstDay.getTime()) / 86400000 + firstDay.getDay() + 1) / 7)
  return { weekNumber, year: date.getFullYear() }
}

/**
 * 按周获取排班表
 * GET /api/schedule/weeks
 * query: weekStart(YYYY-MM-DD), departmentId?, employeeId?
 */
router.get('/weeks', (req: Request, res: Response): void => {
  try {
    const { weekStart, departmentId, employeeId } = req.query as {
      weekStart: string
      departmentId?: string
      employeeId?: string
    }

    // 参数校验：weekStart必填
    if (!weekStart) {
      res.json({ success: false, error: '周起始日期不能为空' })
      return
    }

    // 计算一周七天的日期范围
    const startDate = new Date(weekStart)
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6)

    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    // 构建查询条件
    let query = `
      SELECT
        s.id,
        s.employee_id,
        e.name as employee_name,
        e.employee_no,
        e.department_id,
        d.name as department_name,
        p.name as position_name,
        s.shift_id,
        st.name as shift_name,
        st.type as shift_type,
        st.start_time,
        st.end_time,
        st.core_start,
        st.core_end,
        st.next_day,
        s.schedule_date,
        s.week_number,
        s.year,
        s.status
      FROM schedules s
      JOIN employees e ON s.employee_id = e.id
      JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      JOIN shift_templates st ON s.shift_id = st.id
      WHERE s.schedule_date BETWEEN ? AND ?
    `
    const params: (string | number)[] = [startStr, endStr]

    if (departmentId) {
      query += ' AND e.department_id = ?'
      params.push(Number(departmentId))
    }
    if (employeeId) {
      query += ' AND e.id = ?'
      params.push(Number(employeeId))
    }

    query += ' ORDER BY s.schedule_date ASC, e.department_id ASC, e.id ASC'

    const stmt = db.prepare(query)
    const schedules = stmt.all(...params)

    res.json({ success: true, data: schedules })
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : '获取排班表失败' })
  }
})

/**
 * 单条排班
 * POST /api/schedule
 * body: { employeeId, shiftId, scheduleDate }
 */
router.post('/', (req: Request, res: Response): void => {
  try {
    const { employeeId, shiftId, scheduleDate } = req.body

    // 参数校验
    if (!employeeId || !shiftId || !scheduleDate) {
      res.json({ success: false, error: '员工ID、班次ID和排班日期不能为空' })
      return
    }

    // 计算周数和年份
    const { weekNumber, year } = getWeekInfo(scheduleDate)

    // 使用 INSERT OR REPLACE 处理同一天同一员工已有排班的情况
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO schedules (employee_id, shift_id, schedule_date, week_number, year, status)
      VALUES (?, ?, ?, ?, ?, COALESCE((SELECT status FROM schedules WHERE employee_id = ? AND schedule_date = ?), 'draft'))
    `)
    const result = stmt.run(employeeId, shiftId, scheduleDate, weekNumber, year, employeeId, scheduleDate)

    res.json({ success: true, data: { id: result.lastInsertRowid } })
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : '排班失败' })
  }
})

/**
 * 更新排班
 * PUT /api/schedule/:id
 * body: { shiftId?, scheduleDate? }
 */
router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { shiftId, scheduleDate } = req.body

    // 检查排班是否存在
    const checkStmt = db.prepare('SELECT * FROM schedules WHERE id = ?')
    const existing = checkStmt.get(id) as any
    if (!existing) {
      res.json({ success: false, error: '排班记录不存在' })
      return
    }

    // 如果更新了日期，需要重新计算周数和年份
    let weekNumber = existing.week_number
    let year = existing.year
    let finalScheduleDate = scheduleDate || existing.schedule_date

    if (scheduleDate && scheduleDate !== existing.schedule_date) {
      const info = getWeekInfo(scheduleDate)
      weekNumber = info.weekNumber
      year = info.year
    }

    const stmt = db.prepare(`
      UPDATE schedules
      SET shift_id = COALESCE(?, shift_id),
          schedule_date = ?,
          week_number = ?,
          year = ?
      WHERE id = ?
    `)
    const result = stmt.run(shiftId || null, finalScheduleDate, weekNumber, year, id)

    if (result.changes === 0) {
      res.json({ success: false, error: '更新失败' })
      return
    }

    res.json({ success: true, data: { message: '更新成功' } })
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : '更新排班失败' })
  }
})

/**
 * 删除排班
 * DELETE /api/schedule/:id
 */
router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const stmt = db.prepare('DELETE FROM schedules WHERE id = ?')
    const result = stmt.run(id)

    if (result.changes === 0) {
      res.json({ success: false, error: '排班记录不存在' })
      return
    }

    res.json({ success: true, data: { message: '删除成功' } })
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : '删除排班失败' })
  }
})

/**
 * 批量排班
 * POST /api/schedule/batch
 * body: { departmentId?, positionId?, employeeIds?, shiftId, weekStart, days }
 * days: 数组，取值0-6（0表示周一，6表示周日）
 */
router.post('/batch', (req: Request, res: Response): void => {
  try {
    const { departmentId, positionId, employeeIds, shiftId, weekStart, days } = req.body

    // 参数校验
    if (!shiftId || !weekStart || !days || !Array.isArray(days) || days.length === 0) {
      res.json({ success: false, error: '班次ID、周起始日期和排班日期数组不能为空' })
      return
    }

    // 确定排班的员工列表
    let employees: any[] = []

    if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
      // 优先使用指定的员工ID列表
      const placeholders = employeeIds.map(() => '?').join(',')
      const stmt = db.prepare(`SELECT id FROM employees WHERE id IN (${placeholders})`)
      employees = stmt.all(...employeeIds)
    } else if (departmentId) {
      // 按部门筛选，支持进一步按岗位筛选
      let query = 'SELECT id FROM employees WHERE department_id = ?'
      const params: (number | string)[] = [departmentId]
      if (positionId) {
        query += ' AND position_id = ?'
        params.push(positionId)
      }
      const stmt = db.prepare(query)
      employees = stmt.all(...params)
    } else {
      res.json({ success: false, error: '请指定员工范围（employeeIds、departmentId至少传一个）' })
      return
    }

    if (employees.length === 0) {
      res.json({ success: false, error: '未找到符合条件的员工' })
      return
    }

    const startDate = new Date(weekStart)
    const insertOrReplaceStmt = db.prepare(`
      INSERT OR REPLACE INTO schedules (employee_id, shift_id, schedule_date, week_number, year, status)
      VALUES (?, ?, ?, ?, ?, COALESCE((SELECT status FROM schedules WHERE employee_id = ? AND schedule_date = ?), 'draft'))
    `)

    // 使用事务确保批量操作原子性
    const transaction = db.transaction(() => {
      let count = 0
      for (const emp of employees as any[]) {
        for (const day of days as number[]) {
          // 计算具体日期：day=0表示周一（周起始日），依次类推
          const scheduleDate = new Date(startDate)
          scheduleDate.setDate(startDate.getDate() + day)
          const dateStr = scheduleDate.toISOString().split('T')[0]

          const { weekNumber, year } = getWeekInfo(dateStr)
          insertOrReplaceStmt.run(emp.id, shiftId, dateStr, weekNumber, year, emp.id, dateStr)
          count++
        }
      }
      return count
    })

    const totalCount = transaction()

    res.json({ success: true, data: { total: totalCount, message: `批量排班成功，共${totalCount}条记录` } })
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : '批量排班失败' })
  }
})

/**
 * 发布排班
 * POST /api/schedule/publish
 * body: { weekStart, employeeIds? }
 * employeeIds 不传则发布该周所有员工的排班
 */
router.post('/publish', (req: Request, res: Response): void => {
  try {
    const { weekStart, employeeIds } = req.body

    // 参数校验
    if (!weekStart) {
      res.json({ success: false, error: '周起始日期不能为空' })
      return
    }

    // 计算日期范围（一周）
    const startDate = new Date(weekStart)
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6)

    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    // 构建更新语句
    let query = `
      UPDATE schedules
      SET status = 'published'
      WHERE schedule_date BETWEEN ? AND ?
    `
    const params: (string | number)[] = [startStr, endStr]

    if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
      const placeholders = employeeIds.map(() => '?').join(',')
      query += ` AND employee_id IN (${placeholders})`
      params.push(...employeeIds)
    }

    const stmt = db.prepare(query)
    const result = stmt.run(...params)

    res.json({ success: true, data: { updated: result.changes, message: `发布成功，共${result.changes}条排班` } })
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : '发布排班失败' })
  }
})

/**
 * 员工查看自己的班表
 * GET /api/schedule/my
 * query: employeeId, weekOffset(0=本周, 1=下周, 默认0)
 */
router.get('/my', (req: Request, res: Response): void => {
  try {
    const { employeeId, weekOffset } = req.query as {
      employeeId: string
      weekOffset?: string
    }

    // 参数校验
    if (!employeeId) {
      res.json({ success: false, error: '员工ID不能为空' })
      return
    }

    // 计算目标周的起始日期（周一为一周开始）
    const offset = weekOffset ? parseInt(weekOffset) : 0
    const today = new Date()
    const currentWeekStart = new Date(today)
    // getDay() 返回0-6，周日=0，所以需要调整到周一为一周开始
    const dayOfWeek = currentWeekStart.getDay() === 0 ? 6 : currentWeekStart.getDay() - 1
    currentWeekStart.setDate(today.getDate() - dayOfWeek + offset * 7)

    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(currentWeekStart.getDate() + 6)

    const startStr = currentWeekStart.toISOString().split('T')[0]
    const endStr = weekEnd.toISOString().split('T')[0]

    const stmt = db.prepare(`
      SELECT
        s.id,
        s.schedule_date,
        s.shift_id,
        s.status,
        st.name as shift_name,
        st.type as shift_type,
        st.start_time,
        st.end_time,
        st.core_start,
        st.core_end,
        st.next_day
      FROM schedules s
      JOIN shift_templates st ON s.shift_id = st.id
      WHERE s.employee_id = ?
        AND s.schedule_date BETWEEN ? AND ?
      ORDER BY s.schedule_date ASC
    `)
    const schedules = stmt.all(Number(employeeId), startStr, endStr)

    // 返回周信息和排班数据
    res.json({
      success: true,
      data: {
        weekStart: startStr,
        weekEnd: endStr,
        weekOffset: offset,
        schedules,
      },
    })
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : '获取个人班表失败' })
  }
})

export default router
