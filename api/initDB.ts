import db from './db.js';

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      employee_no TEXT NOT NULL UNIQUE,
      department_id INTEGER NOT NULL,
      position_id INTEGER,
      role TEXT NOT NULL DEFAULT 'employee',
      hire_date DATE NOT NULL,
      manager_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (position_id) REFERENCES positions(id),
      FOREIGN KEY (manager_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS shift_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      core_start TEXT,
      core_end TEXT,
      next_day INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      shift_id INTEGER NOT NULL,
      schedule_date DATE NOT NULL,
      week_number INTEGER NOT NULL,
      year INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (shift_id) REFERENCES shift_templates(id),
      UNIQUE(employee_id, schedule_date)
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      check_in DATETIME,
      check_out DATETIME,
      attendance_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'absent',
      check_in_status TEXT,
      check_out_status TEXT,
      is_field_work INTEGER DEFAULT 0,
      field_location TEXT,
      field_description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      UNIQUE(employee_id, attendance_date)
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      duration REAL NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approver_id INTEGER,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (approver_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS overtime_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      overtime_date DATE NOT NULL,
      duration REAL NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approver_id INTEGER,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (approver_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS makeup_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      attendance_date DATE NOT NULL,
      makeup_type TEXT NOT NULL,
      makeup_time DATETIME NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approver_id INTEGER,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (approver_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS attendance_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS annual_leave_quotas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL UNIQUE,
      years_of_service INTEGER NOT NULL,
      quota_days REAL NOT NULL,
      used_days REAL DEFAULT 0,
      year INTEGER NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS shift_swap_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL,
      target_employee_id INTEGER,
      swap_type TEXT NOT NULL,
      original_date DATE NOT NULL,
      target_date DATE,
      original_shift_id INTEGER NOT NULL,
      target_shift_id INTEGER,
      reason TEXT NOT NULL,
      target_confirmed INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      approver_id INTEGER,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (requester_id) REFERENCES employees(id),
      FOREIGN KEY (target_employee_id) REFERENCES employees(id),
      FOREIGN KEY (original_shift_id) REFERENCES shift_templates(id),
      FOREIGN KEY (target_shift_id) REFERENCES shift_templates(id),
      FOREIGN KEY (approver_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS business_trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      destination TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      purpose TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approver_id INTEGER,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (approver_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS office_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius INTEGER NOT NULL DEFAULT 200,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS salary_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER UNIQUE,
      base_salary REAL NOT NULL DEFAULT 0,
      late_deduction REAL NOT NULL DEFAULT 0,
      early_leave_deduction REAL NOT NULL DEFAULT 0,
      absent_deduction_ratio REAL NOT NULL DEFAULT 0,
      overtime_weekday_rate REAL NOT NULL DEFAULT 1.5,
      overtime_weekend_rate REAL NOT NULL DEFAULT 2.0,
      overtime_holiday_rate REAL NOT NULL DEFAULT 3.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
  `);

  const deptCount = db.prepare('SELECT COUNT(*) as count FROM departments').get() as { count: number };
  if (deptCount.count === 0) {
    const insertDept = db.prepare('INSERT INTO departments (name) VALUES (?)');
    insertDept.run('研发部');
    insertDept.run('市场部');

    const insertPos = db.prepare('INSERT INTO positions (name, department_id) VALUES (?, ?)');
    insertPos.run('前端工程师', 1);
    insertPos.run('后端工程师', 1);
    insertPos.run('测试工程师', 1);
    insertPos.run('研发经理', 1);
    insertPos.run('市场专员', 2);
    insertPos.run('市场经理', 2);

    const insertShift = db.prepare(`INSERT INTO shift_templates (name, type, start_time, end_time, core_start, core_end, next_day) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    insertShift.run('早班', 'morning', '08:00', '17:00', null, null, 0);
    insertShift.run('中班', 'afternoon', '12:00', '21:00', null, null, 0);
    insertShift.run('晚班', 'night', '20:00', '05:00', null, null, 1);
    insertShift.run('弹性班', 'flexible', null, null, '10:00', '16:00', 0);

    const insertEmp = db.prepare(`INSERT INTO employees (name, employee_no, department_id, position_id, role, hire_date, manager_id) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    insertEmp.run('张伟', 'EMP001', 1, 4, 'manager', '2020-03-15', null);
    insertEmp.run('李强', 'EMP002', 1, 1, 'employee', '2021-06-01', 1);
    insertEmp.run('王芳', 'EMP003', 1, 2, 'employee', '2022-02-10', 1);
    insertEmp.run('刘洋', 'EMP004', 1, 2, 'employee', '2021-11-20', 1);
    insertEmp.run('陈静', 'EMP005', 1, 3, 'employee', '2023-04-05', 1);
    insertEmp.run('赵敏', 'EMP006', 2, 6, 'manager', '2019-08-12', null);
    insertEmp.run('孙磊', 'EMP007', 2, 5, 'employee', '2022-09-01', 6);
    insertEmp.run('周婷', 'EMP008', 2, 5, 'employee', '2023-01-18', 6);

    const insertRule = db.prepare('INSERT INTO attendance_rules (key, value, description) VALUES (?, ?, ?)');
    insertRule.run('late_tolerance_minutes', '5', '迟到容忍时间（分钟）');
    insertRule.run('flexible_core_start', '10:00', '弹性班核心工时开始');
    insertRule.run('flexible_core_end', '16:00', '弹性班核心工时结束');
    insertRule.run('monthly_makeup_limit', '3', '每月允许补卡次数上限');
    insertRule.run('annual_leave_base', '5', '年假基础天数');
    insertRule.run('annual_leave_per_year', '1', '每满1年工龄增加年假天数');
    insertRule.run('annual_leave_max', '15', '年假最大天数');

    const insertQuota = db.prepare('INSERT INTO annual_leave_quotas (employee_id, years_of_service, quota_days, used_days, year) VALUES (?, ?, ?, ?, ?)');
    const employees = db.prepare('SELECT id, hire_date FROM employees').all() as Array<{ id: number; hire_date: string }>;
    const currentYear = new Date().getFullYear();
    employees.forEach((emp) => {
      const hireDate = new Date(emp.hire_date);
      let years = currentYear - hireDate.getFullYear();
      const baseDays = 5;
      const perYear = 1;
      const maxDays = 15;
      let quota = Math.min(baseDays + years * perYear, maxDays);
      insertQuota.run(emp.id, years, quota, 0, currentYear);
    });

    const insertSchedule = db.prepare(`INSERT OR REPLACE INTO schedules (employee_id, shift_id, schedule_date, week_number, year, status) VALUES (?, ?, ?, ?, ?, 'published')`);
    
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay() + 1);

    for (let weekOffset = -1; weekOffset <= 1; weekOffset++) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(currentWeekStart.getDate() + weekOffset * 7);
      const firstDay = new Date(weekStart.getFullYear(), 0, 1);
      const weekNumber = Math.ceil(((weekStart.getTime() - firstDay.getTime()) / 86400000 + firstDay.getDay() + 1) / 7);

      for (let empIdx = 0; empIdx < employees.length; empIdx++) {
        const empId = employees[empIdx].id;
        let shiftPatterns = empIdx % 4;

        for (let day = 0; day < 7; day++) {
          const scheduleDate = new Date(weekStart);
          scheduleDate.setDate(weekStart.getDate() + day);
          const dateStr = scheduleDate.toISOString().split('T')[0];

          if (day >= 5) {
            continue;
          }

          let shiftId = (day + shiftPatterns) % 4 + 1;
          insertSchedule.run(empId, shiftId, dateStr, weekNumber, currentYear);
        }
      }
    }

    const insertAttendance = db.prepare(`INSERT OR REPLACE INTO attendance_records (employee_id, check_in, check_out, attendance_date, status, check_in_status, check_out_status, is_field_work, field_location, field_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const records = [
      { emp: 2, in: '08:02', out: '17:05', date: -6, status: 'normal', inStatus: 'normal', outStatus: 'normal' },
      { emp: 2, in: '08:15', out: '17:00', date: -5, status: 'late', inStatus: 'late', outStatus: 'normal' },
      { emp: 2, in: '08:01', out: '16:30', date: -4, status: 'early_leave', inStatus: 'normal', outStatus: 'early_leave' },
      { emp: 2, in: '07:58', out: '17:02', date: -3, status: 'normal', inStatus: 'normal', outStatus: 'normal' },
      { emp: 2, in: '08:03', out: '17:10', date: -2, status: 'normal', inStatus: 'normal', outStatus: 'normal' },
      { emp: 3, in: '12:05', out: '21:00', date: -6, status: 'normal', inStatus: 'normal', outStatus: 'normal' },
      { emp: 3, in: '12:20', out: '21:15', date: -5, status: 'late', inStatus: 'late', outStatus: 'normal' },
      { emp: 3, in: null, out: null, date: -4, status: 'absent', inStatus: null, outStatus: null },
      { emp: 3, in: '12:02', out: '20:55', date: -3, status: 'normal', inStatus: 'normal', outStatus: 'normal' },
      { emp: 4, in: '09:55', out: '18:30', date: -6, status: 'normal', inStatus: 'normal', outStatus: 'normal' },
      { emp: 4, in: '10:10', out: '18:00', date: -5, status: 'normal', inStatus: 'normal', outStatus: 'normal' },
      { emp: 4, in: null, out: '18:05', date: -4, status: 'normal', inStatus: null, outStatus: 'normal', field: 1, loc: '客户现场', desc: '拜访客户' },
      { emp: 4, in: '09:50', out: '18:15', date: -3, status: 'normal', inStatus: 'normal', outStatus: 'normal' },
      { emp: 5, in: '08:00', out: '17:08', date: -6, status: 'normal', inStatus: 'normal', outStatus: 'normal' },
      { emp: 5, in: '08:10', out: '17:00', date: -5, status: 'normal', inStatus: 'normal', outStatus: 'normal' },
      { emp: 5, in: '08:05', out: '17:02', date: -3, status: 'normal', inStatus: 'normal', outStatus: 'normal' },
      { emp: 6, in: null, out: null, date: -6, status: 'leave', inStatus: null, outStatus: null },
      { emp: 6, in: '10:00', out: '19:00', date: -5, status: 'normal', inStatus: 'normal', outStatus: 'normal' },
      { emp: 7, in: '12:08', out: '21:05', date: -6, status: 'normal', inStatus: 'normal', outStatus: 'normal' },
      { emp: 7, in: '12:03', out: '21:00', date: -5, status: 'normal', inStatus: 'normal', outStatus: 'normal' },
    ];

    records.forEach(r => {
      const d = new Date();
      d.setDate(d.getDate() + r.date);
      const dateStr = d.toISOString().split('T')[0];
      const checkIn = r.in ? `${dateStr}T${r.in}:00` : null;
      const checkOut = r.out ? `${dateStr}T${r.out}:00` : null;
      insertAttendance.run(r.emp, checkIn, checkOut, dateStr, r.status, r.inStatus, r.outStatus, r.field || 0, r.loc || null, r.desc || null);
    });

    const insertLeave = db.prepare(`INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, duration, reason, status, approver_id, approved_at) VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, CURRENT_TIMESTAMP)`);
    const d1 = new Date(); d1.setDate(d1.getDate() - 6);
    const d2 = new Date(); d2.setDate(d2.getDate() - 6);
    insertLeave.run(6, 'sick', d1.toISOString().split('T')[0], d2.toISOString().split('T')[0], 1, '感冒发烧，需要休息', 1);

    const d3 = new Date(); d3.setDate(d3.getDate() - 3);
    const d4 = new Date(); d4.setDate(d4.getDate() - 3);
    insertLeave.run(5, 'personal', d3.toISOString().split('T')[0], d4.toISOString().split('T')[0], 0.5, '处理个人事务', 1);

    const insertOT = db.prepare(`INSERT INTO overtime_requests (employee_id, overtime_date, duration, reason, status, approver_id, approved_at) VALUES (?, ?, ?, ?, 'approved', ?, CURRENT_TIMESTAMP)`);
    const otDate = new Date(); otDate.setDate(otDate.getDate() - 4);
    insertOT.run(3, otDate.toISOString().split('T')[0], 3, '项目上线加班调试', 1);

    const insertOffice = db.prepare(`INSERT INTO office_locations (name, latitude, longitude, radius, is_default) VALUES (?, ?, ?, ?, ?)`);
    insertOffice.run('总部大厦', 39.9042, 116.4074, 200, 1);
    insertOffice.run('科技园分部', 39.9842, 116.3074, 300, 0);

    const insertSalaryRules = db.prepare(`INSERT INTO salary_rules (employee_id, base_salary, late_deduction, early_leave_deduction, absent_deduction_ratio, overtime_weekday_rate, overtime_weekend_rate, overtime_holiday_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    insertSalaryRules.run(null, 8000, 50, 50, 0.1, 1.5, 2.0, 3.0);
    insertSalaryRules.run(1, 15000, 100, 100, 0.05, 1.5, 2.0, 3.0);
    insertSalaryRules.run(2, 10000, 50, 50, 0.08, 1.5, 2.0, 3.0);
    insertSalaryRules.run(3, 11000, 50, 50, 0.08, 1.5, 2.0, 3.0);
    insertSalaryRules.run(4, 11000, 50, 50, 0.08, 1.5, 2.0, 3.0);
    insertSalaryRules.run(5, 9000, 50, 50, 0.1, 1.5, 2.0, 3.0);
    insertSalaryRules.run(6, 14000, 100, 100, 0.05, 1.5, 2.0, 3.0);
    insertSalaryRules.run(7, 9000, 50, 50, 0.1, 1.5, 2.0, 3.0);
    insertSalaryRules.run(8, 8500, 50, 50, 0.1, 1.5, 2.0, 3.0);

    const insertNotification = db.prepare(`INSERT INTO notifications (employee_id, title, content, type) VALUES (?, ?, ?, ?)`);
    insertNotification.run(2, '排班已发布', '本周排班已发布，请及时查看', 'info');
    insertNotification.run(3, '补卡审批结果', '您提交的补卡申请已通过', 'success');

    const insertTrip = db.prepare(`INSERT INTO business_trips (employee_id, destination, start_date, end_date, purpose, status, approver_id, approved_at) VALUES (?, ?, ?, ?, ?, 'approved', ?, CURRENT_TIMESTAMP)`);
    const tripStart = new Date(); tripStart.setDate(tripStart.getDate() - 4);
    const tripEnd = new Date(); tripEnd.setDate(tripEnd.getDate() - 3);
    insertTrip.run(4, '上海客户现场', tripStart.toISOString().split('T')[0], tripEnd.toISOString().split('T')[0], '拜访重要客户进行项目交付', 1);
  }

  console.log('Database initialized successfully!');
}

initDatabase();
