import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const rules = db.prepare(`
      SELECT id, key, value, description, updated_at
      FROM attendance_rules
      ORDER BY id ASC
    `).all()

    const data: Record<string, any> = {}
    for (const rule of rules as any[]) {
      const numVal = Number(rule.value)
      data[rule.key] = isNaN(numVal) ? rule.value : numVal
    }

    res.json({
      success: true,
      data,
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '获取考勤规则失败' })
  }
})

router.put('/', (req: Request, res: Response): void => {
  try {
    const body = req.body
    const allowedKeys = [
      'late_tolerance_minutes',
      'flexible_core_start',
      'flexible_core_end',
      'monthly_makeup_limit',
      'annual_leave_base',
      'annual_leave_per_year',
      'annual_leave_max',
    ]

    const updates: { key: string; value: string }[] = []
    for (const key of allowedKeys) {
      if (body[key] !== undefined && body[key] !== null) {
        updates.push({
          key,
          value: String(body[key]),
        })
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ success: false, error: '没有提供有效的更新参数' })
      return
    }

    const stmt = db.prepare(`
      UPDATE attendance_rules
      SET value = ?, updated_at = CURRENT_TIMESTAMP
      WHERE key = ?
    `)

    const transaction = db.transaction(() => {
      for (const u of updates) {
        stmt.run(u.value, u.key)
      }
    })

    transaction()

    const rules = db.prepare(`
      SELECT id, key, value, description, updated_at
      FROM attendance_rules
      ORDER BY id ASC
    `).all()

    const data: Record<string, any> = {}
    for (const rule of rules as any[]) {
      const numVal = Number(rule.value)
      data[rule.key] = isNaN(numVal) ? rule.value : numVal
    }

    res.json({
      success: true,
      data,
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '更新考勤规则失败' })
  }
})

router.post('/recalculate-quotas', (req: Request, res: Response): void => {
  try {
    const rulesRows = db.prepare(`
      SELECT key, value FROM attendance_rules
      WHERE key IN ('annual_leave_base', 'annual_leave_per_year', 'annual_leave_max')
    `).all() as any[]

    const ruleMap: Record<string, number> = {}
    for (const r of rulesRows) {
      ruleMap[r.key] = Number(r.value)
    }

    const annualLeaveBase = ruleMap.annual_leave_base ?? 5
    const annualLeavePerYear = ruleMap.annual_leave_per_year ?? 1
    const annualLeaveMax = ruleMap.annual_leave_max ?? 15

    const currentYear = new Date().getFullYear()
    const employees = db.prepare(`
      SELECT id, hire_date FROM employees
    `).all() as any[]

    const upsertStmt = db.prepare(`
      INSERT INTO annual_leave_quotas (employee_id, years_of_service, quota_days, used_days, year, updated_at)
      VALUES (?, ?, ?, 0, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(employee_id) DO UPDATE SET
        years_of_service = excluded.years_of_service,
        quota_days = excluded.quota_days,
        year = excluded.year,
        updated_at = CURRENT_TIMESTAMP
    `)

    const updatedCount = { count: 0 }

    const transaction = db.transaction(() => {
      for (const emp of employees) {
        const hireDate = new Date(emp.hire_date)
        let years = currentYear - hireDate.getFullYear()
        if (
          hireDate.getMonth() > new Date().getMonth() ||
          (hireDate.getMonth() === new Date().getMonth() && hireDate.getDate() > new Date().getDate())
        ) {
          years = Math.max(0, years - 1)
        }
        years = Math.max(0, years)
        const quota = Math.min(annualLeaveBase + years * annualLeavePerYear, annualLeaveMax)
        upsertStmt.run(emp.id, years, quota, currentYear)
        updatedCount.count++
      }
    })

    transaction()

    const quotas = db.prepare(`
      SELECT
        alq.id,
        alq.employee_id,
        e.name as employee_name,
        e.employee_no,
        alq.years_of_service,
        alq.quota_days,
        alq.used_days,
        (alq.quota_days - alq.used_days) as remaining_days,
        alq.year,
        alq.updated_at
      FROM annual_leave_quotas alq
      JOIN employees e ON alq.employee_id = e.id
      WHERE alq.year = ?
      ORDER BY alq.employee_id ASC
    `).all(currentYear)

    res.json({
      success: true,
      data: {
        updatedCount: updatedCount.count,
        rules: {
          annualLeaveBase,
          annualLeavePerYear,
          annualLeaveMax,
        },
        quotas,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '重新计算年假额度失败' })
  }
})

export default router
