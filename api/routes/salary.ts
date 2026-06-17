import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

interface SalaryRuleRow {
  id: number
  employee_id: number | null
  base_salary: number
  late_deduction: number
  early_leave_deduction: number
  absent_deduction_ratio: number
  overtime_weekday_rate: number
  overtime_weekend_rate: number
  overtime_holiday_rate: number
  created_at: string
  updated_at: string
  employee_name?: string
  employee_no?: string
}

router.get('/rules', (req: Request, res: Response): void => {
  const { employeeId } = req.query

  try {
    if (employeeId) {
      const rule = db.prepare(`
        SELECT sr.*, e.name as employee_name, e.employee_no
        FROM salary_rules sr
        LEFT JOIN employees e ON sr.employee_id = e.id
        WHERE sr.employee_id = ?
      `).get(Number(employeeId)) as SalaryRuleRow | undefined

      if (!rule) {
        const defaultRule = db.prepare(`
          SELECT sr.*, NULL as employee_name, NULL as employee_no
          FROM salary_rules sr
          WHERE sr.employee_id IS NULL
        `).get() as SalaryRuleRow | undefined

        res.json({ success: true, data: defaultRule || null })
        return
      }

      res.json({
        success: true,
        data: {
          id: rule.id,
          employeeId: rule.employee_id,
          employeeName: rule.employee_name,
          employeeNo: rule.employee_no,
          baseSalary: rule.base_salary,
          lateDeduction: rule.late_deduction,
          earlyLeaveDeduction: rule.early_leave_deduction,
          absentDeductionRatio: rule.absent_deduction_ratio,
          overtimeWeekdayRate: rule.overtime_weekday_rate,
          overtimeWeekendRate: rule.overtime_weekend_rate,
          overtimeHolidayRate: rule.overtime_holiday_rate,
          createdAt: rule.created_at,
          updatedAt: rule.updated_at,
        },
      })
      return
    }

    const rules = db.prepare(`
      SELECT sr.*, e.name as employee_name, e.employee_no
      FROM salary_rules sr
      LEFT JOIN employees e ON sr.employee_id = e.id
      ORDER BY sr.employee_id IS NULL DESC, sr.employee_id ASC
    `).all() as SalaryRuleRow[]

    const result = rules.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employee_name || '全局默认',
      employeeNo: r.employee_no,
      baseSalary: r.base_salary,
      lateDeduction: r.late_deduction,
      earlyLeaveDeduction: r.early_leave_deduction,
      absentDeductionRatio: r.absent_deduction_ratio,
      overtimeWeekdayRate: r.overtime_weekday_rate,
      overtimeWeekendRate: r.overtime_weekend_rate,
      overtimeHolidayRate: r.overtime_holiday_rate,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))

    res.json({ success: true, data: result })
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/rules', (req: Request, res: Response): void => {
  const {
    employeeId,
    baseSalary,
    lateDeduction,
    earlyLeaveDeduction,
    absentDeductionRatio,
    overtimeWeekdayRate,
    overtimeWeekendRate,
    overtimeHolidayRate,
  } = req.body

  if (baseSalary === undefined || lateDeduction === undefined || earlyLeaveDeduction === undefined ||
      absentDeductionRatio === undefined || overtimeWeekdayRate === undefined ||
      overtimeWeekendRate === undefined || overtimeHolidayRate === undefined) {
    res.json({ success: false, error: '缺少必要参数' })
    return
  }

  try {
    if (employeeId) {
      const employee = db.prepare('SELECT id FROM employees WHERE id = ?').get(employeeId) as { id: number } | undefined
      if (!employee) {
        res.json({ success: false, error: '员工不存在' })
        return
      }
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
    const empId = employeeId || null

    db.prepare(`
      INSERT OR REPLACE INTO salary_rules
      (employee_id, base_salary, late_deduction, early_leave_deduction, absent_deduction_ratio,
       overtime_weekday_rate, overtime_weekend_rate, overtime_holiday_rate, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      empId, baseSalary, lateDeduction, earlyLeaveDeduction, absentDeductionRatio,
      overtimeWeekdayRate, overtimeWeekendRate, overtimeHolidayRate, now, now
    )

    res.json({
      success: true,
      data: {
        employeeId: empId,
        baseSalary,
        lateDeduction,
        earlyLeaveDeduction,
        absentDeductionRatio,
        overtimeWeekdayRate,
        overtimeWeekendRate,
        overtimeHolidayRate,
      },
    })
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.put('/rules/:id', (req: Request, res: Response): void => {
  const { id } = req.params

  try {
    const existing = db.prepare('SELECT * FROM salary_rules WHERE id = ?').get(Number(id)) as SalaryRuleRow | undefined
    if (!existing) {
      res.json({ success: false, error: '薪资规则不存在' })
      return
    }

    const {
      baseSalary,
      lateDeduction,
      earlyLeaveDeduction,
      absentDeductionRatio,
      overtimeWeekdayRate,
      overtimeWeekendRate,
      overtimeHolidayRate,
    } = req.body

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

    db.prepare(`
      UPDATE salary_rules
      SET base_salary = ?, late_deduction = ?, early_leave_deduction = ?,
          absent_deduction_ratio = ?, overtime_weekday_rate = ?, overtime_weekend_rate = ?,
          overtime_holiday_rate = ?, updated_at = ?
      WHERE id = ?
    `).run(
      baseSalary ?? existing.base_salary,
      lateDeduction ?? existing.late_deduction,
      earlyLeaveDeduction ?? existing.early_leave_deduction,
      absentDeductionRatio ?? existing.absent_deduction_ratio,
      overtimeWeekdayRate ?? existing.overtime_weekday_rate,
      overtimeWeekendRate ?? existing.overtime_weekend_rate,
      overtimeHolidayRate ?? existing.overtime_holiday_rate,
      now,
      Number(id)
    )

    res.json({ success: true, data: { id: Number(id) } })
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.delete('/rules/:id', (req: Request, res: Response): void => {
  const { id } = req.params

  try {
    const existing = db.prepare('SELECT * FROM salary_rules WHERE id = ?').get(Number(id)) as SalaryRuleRow | undefined
    if (!existing) {
      res.json({ success: false, error: '薪资规则不存在' })
      return
    }

    if (existing.employee_id === null) {
      res.json({ success: false, error: '不能删除全局默认薪资规则' })
      return
    }

    db.prepare('DELETE FROM salary_rules WHERE id = ?').run(Number(id))

    res.json({ success: true, data: { id: Number(id) } })
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.get('/calculate', (req: Request, res: Response): void => {
  const { year, month, departmentId, employeeId } = req.query

  if (!year || !month) {
    res.json({ success: false, error: '缺少必要参数 year, month' })
    return
  }

  try {
    const y = Number(year)
    const m = Number(month)
    const monthStr = `${y}-${String(m).padStart(2, '0')}`

    const whereClauses: string[] = []
    const params: (string | number)[] = []

    if (departmentId) {
      whereClauses.push('e.department_id = ?')
      params.push(Number(departmentId))
    }
    if (employeeId) {
      whereClauses.push('e.id = ?')
      params.push(Number(employeeId))
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''

    const employees = db.prepare(`
      SELECT e.id, e.name, e.employee_no, d.name as department_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      ${whereSQL}
    `).all(...params) as Array<{
      id: number
      name: string
      employee_no: string
      department_name: string | null
    }>

    const defaultRule = db.prepare(`
      SELECT * FROM salary_rules WHERE employee_id IS NULL
    `).get() as SalaryRuleRow | undefined

    const results = employees.map((emp) => {
      const rule = db.prepare(`
        SELECT * FROM salary_rules WHERE employee_id = ?
      `).get(emp.id) as SalaryRuleRow | undefined

      const effectiveRule = rule || defaultRule

      if (!effectiveRule) {
        return {
          employeeId: emp.id,
          employeeName: emp.name,
          employeeNo: emp.employee_no,
          departmentName: emp.department_name,
          baseSalary: 0,
          lateCount: 0,
          lateDeduction: 0,
          earlyLeaveCount: 0,
          earlyLeaveDeduction: 0,
          absentCount: 0,
          absentDeduction: 0,
          overtimeHours: 0,
          overtimePay: 0,
          netSalary: 0,
        }
      }

      const stats = db.prepare(`
        SELECT
          SUM(CASE WHEN check_in_status = 'late' OR status = 'late' THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN check_out_status = 'early_leave' OR status = 'early_leave' THEN 1 ELSE 0 END) as early_leave_count,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count
        FROM attendance_records
        WHERE employee_id = ? AND strftime('%Y-%m', attendance_date) = ?
      `).get(emp.id, monthStr) as { late_count: number; early_leave_count: number; absent_count: number }

      const overtimeRow = db.prepare(`
        SELECT COALESCE(SUM(duration), 0) as total
        FROM overtime_requests
        WHERE employee_id = ? AND strftime('%Y-%m', overtime_date) = ? AND status = 'approved'
      `).get(emp.id, monthStr) as { total: number }

      const lateCount = stats.late_count || 0
      const earlyLeaveCount = stats.early_leave_count || 0
      const absentCount = stats.absent_count || 0
      const overtimeHours = overtimeRow.total || 0

      const dailyWage = effectiveRule.base_salary / 21.75
      const lateDeduction = lateCount * effectiveRule.late_deduction
      const earlyLeaveDeduction = earlyLeaveCount * effectiveRule.early_leave_deduction
      const absentDeduction = absentCount * dailyWage * effectiveRule.absent_deduction_ratio
      const overtimePay = overtimeHours * (dailyWage / 8) * effectiveRule.overtime_weekday_rate
      const netSalary = effectiveRule.base_salary - lateDeduction - earlyLeaveDeduction - absentDeduction + overtimePay

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        employeeNo: emp.employee_no,
        departmentName: emp.department_name,
        baseSalary: effectiveRule.base_salary,
        lateCount,
        lateDeduction: Math.round(lateDeduction * 100) / 100,
        earlyLeaveCount,
        earlyLeaveDeduction: Math.round(earlyLeaveDeduction * 100) / 100,
        absentCount,
        absentDeduction: Math.round(absentDeduction * 100) / 100,
        overtimeHours,
        overtimePay: Math.round(overtimePay * 100) / 100,
        netSalary: Math.round(netSalary * 100) / 100,
      }
    })

    res.json({ success: true, data: results })
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

router.get('/export-csv', (req: Request, res: Response): void => {
  const { year, month, departmentId } = req.query

  if (!year || !month) {
    res.json({ success: false, error: '缺少必要参数 year, month' })
    return
  }

  try {
    const y = Number(year)
    const m = Number(month)
    const monthStr = `${y}-${String(m).padStart(2, '0')}`

    const whereClauses: string[] = []
    const params: (string | number)[] = []

    if (departmentId) {
      whereClauses.push('e.department_id = ?')
      params.push(Number(departmentId))
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''

    const employees = db.prepare(`
      SELECT e.id, e.name, e.employee_no, d.name as department_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      ${whereSQL}
    `).all(...params) as Array<{
      id: number
      name: string
      employee_no: string
      department_name: string | null
    }>

    const defaultRule = db.prepare(`
      SELECT * FROM salary_rules WHERE employee_id IS NULL
    `).get() as SalaryRuleRow | undefined

    const rows: string[] = []
    rows.push('工号,姓名,部门,基本工资,迟到次数,迟到扣款,早退次数,早退扣款,缺勤天数,缺勤扣款,加班时长,加班补贴,应发工资')

    for (const emp of employees) {
      const rule = db.prepare(`
        SELECT * FROM salary_rules WHERE employee_id = ?
      `).get(emp.id) as SalaryRuleRow | undefined

      const effectiveRule = rule || defaultRule

      if (!effectiveRule) {
        rows.push(`${emp.employee_no},${emp.name},${emp.department_name || ''},0,0,0,0,0,0,0,0,0,0`)
        continue
      }

      const stats = db.prepare(`
        SELECT
          SUM(CASE WHEN check_in_status = 'late' OR status = 'late' THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN check_out_status = 'early_leave' OR status = 'early_leave' THEN 1 ELSE 0 END) as early_leave_count,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count
        FROM attendance_records
        WHERE employee_id = ? AND strftime('%Y-%m', attendance_date) = ?
      `).get(emp.id, monthStr) as { late_count: number; early_leave_count: number; absent_count: number }

      const overtimeRow = db.prepare(`
        SELECT COALESCE(SUM(duration), 0) as total
        FROM overtime_requests
        WHERE employee_id = ? AND strftime('%Y-%m', overtime_date) = ? AND status = 'approved'
      `).get(emp.id, monthStr) as { total: number }

      const lateCount = stats.late_count || 0
      const earlyLeaveCount = stats.early_leave_count || 0
      const absentCount = stats.absent_count || 0
      const overtimeHours = overtimeRow.total || 0

      const dailyWage = effectiveRule.base_salary / 21.75
      const lateDeduction = Math.round(lateCount * effectiveRule.late_deduction * 100) / 100
      const earlyLeaveDeduction = Math.round(earlyLeaveCount * effectiveRule.early_leave_deduction * 100) / 100
      const absentDeduction = Math.round(absentCount * dailyWage * effectiveRule.absent_deduction_ratio * 100) / 100
      const overtimePay = Math.round(overtimeHours * (dailyWage / 8) * effectiveRule.overtime_weekday_rate * 100) / 100
      const netSalary = Math.round((effectiveRule.base_salary - lateDeduction - earlyLeaveDeduction - absentDeduction + overtimePay) * 100) / 100

      rows.push(
        `${emp.employee_no},${emp.name},${emp.department_name || ''},${effectiveRule.base_salary},${lateCount},${lateDeduction},${earlyLeaveCount},${earlyLeaveDeduction},${absentCount},${absentDeduction},${overtimeHours},${overtimePay},${netSalary}`
      )
    }

    const csvContent = rows.join('\n')
    const filename = `${y}年${m}月薪资报表.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    res.write('\uFEFF')
    res.write(csvContent)
    res.end()
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

export default router
