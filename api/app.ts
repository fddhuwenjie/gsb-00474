/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import scheduleRoutes from './routes/schedule.js'
import basicRoutes from './routes/basic.js'
import attendanceRoutes from './routes/attendance.js'
import leaveRoutes from './routes/leave.js'
import reportsRoutes from './routes/reports.js'
import rulesRoutes from './routes/rules.js'
import swapRoutes from './routes/swap.js'
import tripRoutes from './routes/trip.js'
import officeLocationRoutes from './routes/officeLocations.js'
import calendarRoutes from './routes/calendar.js'
import salaryRoutes from './routes/salary.js'
import notificationRoutes from './routes/notifications.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/schedule', scheduleRoutes)
app.use('/api/basic', basicRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/leave', leaveRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/rules', rulesRoutes)
app.use('/api/swap', swapRoutes)
app.use('/api/trip', tripRoutes)
app.use('/api/office-locations', officeLocationRoutes)
app.use('/api/calendar', calendarRoutes)
app.use('/api/salary', salaryRoutes)
app.use('/api/notifications', notificationRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
