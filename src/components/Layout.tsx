import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarClock,
  ClipboardList,
  AlertTriangle,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  Building2,
  Menu,
  X,
  ArrowLeftRight,
  CalendarDays,
  DollarSign,
} from 'lucide-react'
import { useAppStore, selectIsManager, type CurrentUser } from '@/store'
import { cn } from '@/lib/utils'

interface NavItem {
  path: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/schedule', label: '排班管理', icon: CalendarClock },
  { path: '/attendance', label: '打卡记录', icon: ClipboardList },
  { path: '/exceptions', label: '异常处理', icon: AlertTriangle },
  { path: '/swap', label: '调班换班', icon: ArrowLeftRight },
  { path: '/calendar', label: '团队日历', icon: CalendarDays },
  { path: '/salary', label: '薪资报表', icon: DollarSign },
  { path: '/reports', label: '统计报表', icon: BarChart3 },
  { path: '/rules', label: '规则配置', icon: Settings },
]

const roleLabelMap: Record<string, string> = {
  employee: '员工',
  manager: '经理',
  admin: '管理员',
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { currentUser, employees, setCurrentUser, loadBasicData } = useAppStore()
  const isManager = useAppStore(selectIsManager)
  const location = useLocation()

  useEffect(() => {
    loadBasicData()
  }, [loadBasicData])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location])

  const handleSwitchUser = (employee: { id: number; name: string; role: string; department_id: number; employee_no: string }) => {
    const user: CurrentUser = {
      id: employee.id,
      name: employee.name,
      role: employee.role as 'employee' | 'manager' | 'admin',
      department_id: employee.department_id,
      employee_no: employee.employee_no,
    }
    setCurrentUser(user)
    setUserDropdownOpen(false)
  }

  const SidebarContent = () => (
    <>
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700/50">
        <div className={cn('flex items-center gap-3 overflow-hidden', collapsed && 'justify-center')}>
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-white font-bold text-base tracking-wide whitespace-nowrap">
                考勤系统
              </span>
              <span className="text-slate-400 text-[11px] whitespace-nowrap">
                Attendance Management
              </span>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 shadow-inner'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                )
              }
              title={collapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'w-5 h-5 flex-shrink-0 transition-colors',
                      isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-white'
                    )}
                  />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-lg shadow-indigo-400/50" />
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="p-3 border-t border-slate-700/50">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors"
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5 mx-auto" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5 flex-shrink-0" />
              <span>收起侧边栏</span>
            </>
          )}
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-slate-800 transition-all duration-300 ease-in-out border-r border-slate-700/50',
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-slate-800 border-r border-slate-700/50 md:hidden transition-transform duration-300 ease-in-out',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 md:px-6 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/50 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-800 dark:text-white hidden sm:block">
                企业智能考勤管理系统
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden md:block">
                高效、精准、智能的考勤解决方案
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Role Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20">
              <User className="w-3 h-3" />
              {roleLabelMap[currentUser.role] || currentUser.role}
            </div>

            {/* User Switcher */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 sm:gap-3 pl-2 pr-2 sm:pr-3 py-1.5 sm:py-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/50 transition-all duration-200 group"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-md shadow-indigo-500/20 group-hover:shadow-lg group-hover:shadow-indigo-500/30 transition-shadow">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-sm font-medium text-slate-800 dark:text-white leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    {currentUser.employee_no}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-slate-400 transition-transform duration-200 hidden sm:block',
                    userDropdownOpen && 'rotate-180'
                  )}
                />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl shadow-slate-200/60 dark:shadow-slate-900/60 border border-slate-200 dark:border-slate-700/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-indigo-50/50 dark:from-slate-700/50 dark:to-indigo-500/10 border-b border-slate-200 dark:border-slate-700/50">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      切换用户
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      模拟不同身份登录体验
                    </p>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-1.5">
                    {employees.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-400" />
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">加载用户列表中...</p>
                      </div>
                    ) : (
                      employees.map((emp) => {
                        const isActive = emp.id === currentUser.id
                        return (
                          <button
                            key={emp.id}
                            onClick={() => handleSwitchUser(emp)}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left',
                              isActive
                                ? 'bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-200 dark:ring-indigo-500/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                            )}
                          >
                            <div
                              className={cn(
                                'w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-sm flex-shrink-0',
                                isActive
                                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/30'
                                  : 'bg-slate-400 dark:bg-slate-600'
                              )}
                            >
                              {emp.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    'text-sm font-medium truncate',
                                    isActive
                                      ? 'text-indigo-700 dark:text-indigo-300'
                                      : 'text-slate-800 dark:text-slate-200'
                                  )}
                                >
                                  {emp.name}
                                </span>
                                <span
                                  className={cn(
                                    'text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0',
                                    emp.role === 'manager' || emp.role === 'admin'
                                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-slate-100 dark:bg-slate-600/50 text-slate-600 dark:text-slate-300'
                                  )}
                                >
                                  {roleLabelMap[emp.role]}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {emp.employee_no}
                                </span>
                                {emp.department_name && (
                                  <>
                                    <span className="text-slate-300 dark:text-slate-600">·</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                      {emp.department_name}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            {isActive && (
                              <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-md shadow-indigo-500/50 flex-shrink-0" />
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
            {isManager && (
              <div className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  当前以<span className="font-semibold mx-1">{roleLabelMap[currentUser.role]}</span>
                  身份登录，可进行管理操作。如需切换角色请点击右上角用户。
                </p>
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
