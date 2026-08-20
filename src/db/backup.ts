import { getDaysInLocalMonth, getLocalMonth } from '../domain/dateUtils'
import type {
  AppSettings,
  BudgetAccountId,
  LocalMonth,
  MonthlyPlan,
  ThemePreference,
  Transaction,
} from '../domain/models'
import type { BudgetDatabase } from './database'
import { budgetDb } from './database'
import { initializeBudgetData, loadBudgetData } from './repositories'

const BACKUP_FORMAT = 'budget00-backup'
const BACKUP_VERSION = 1

export interface BudgetBackup {
  readonly format: typeof BACKUP_FORMAT
  readonly version: typeof BACKUP_VERSION
  readonly exportedAt: string
  readonly data: {
    readonly monthlyPlans: readonly MonthlyPlan[]
    readonly transactions: readonly Transaction[]
    readonly appSettings: AppSettings
  }
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupValidationError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new BackupValidationError(`${label} nesne olmalıdır.`)
  }
  return value
}

const requireString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BackupValidationError(`${label} geçerli bir metin olmalıdır.`)
  }
  return value
}

const requireTimestamp = (value: unknown, label: string): string => {
  const timestamp = requireString(value, label)
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new BackupValidationError(`${label} geçerli bir tarih olmalıdır.`)
  }
  return timestamp
}

const requireAccountId = (value: unknown, label: string): BudgetAccountId => {
  if (value !== 'personal' && value !== 'multinet') {
    throw new BackupValidationError(`${label} personal veya multinet olmalıdır.`)
  }
  return value
}

const requireMinor = (value: unknown, label: string, allowZero: boolean): number => {
  const validLowerBound = allowZero ? Number(value) >= 0 : Number(value) > 0
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || !validLowerBound) {
    throw new BackupValidationError(`${label} geçerli bir tam sayı kuruş değeri olmalıdır.`)
  }
  return value
}

const requireMonth = (value: unknown, label: string): LocalMonth => {
  const month = requireString(value, label) as LocalMonth
  try {
    getDaysInLocalMonth(month)
  } catch {
    throw new BackupValidationError(`${label} YYYY-AA formatında geçerli bir ay olmalıdır.`)
  }
  return month
}

const requireLocalDate = (value: unknown, label: string): Transaction['localDate'] => {
  const localDate = requireString(value, label) as Transaction['localDate']
  try {
    getLocalMonth(localDate)
  } catch {
    throw new BackupValidationError(`${label} YYYY-AA-GG formatında geçerli bir tarih olmalıdır.`)
  }
  return localDate
}

const validatePlan = (value: unknown, index: number): MonthlyPlan => {
  const plan = requireRecord(value, `monthlyPlans[${index}]`)
  return {
    budgetAccountId: requireAccountId(
      plan.budgetAccountId,
      `monthlyPlans[${index}].budgetAccountId`,
    ),
    month: requireMonth(plan.month, `monthlyPlans[${index}].month`),
    limitMinor: requireMinor(plan.limitMinor, `monthlyPlans[${index}].limitMinor`, true),
  }
}

const validateTransaction = (value: unknown, index: number): Transaction => {
  const transaction = requireRecord(value, `transactions[${index}]`)
  const category = transaction.category
  const note = transaction.note

  if (category !== undefined && typeof category !== 'string') {
    throw new BackupValidationError(`transactions[${index}].category metin olmalıdır.`)
  }
  if (note !== undefined && typeof note !== 'string') {
    throw new BackupValidationError(`transactions[${index}].note metin olmalıdır.`)
  }

  return {
    id: requireString(transaction.id, `transactions[${index}].id`),
    budgetAccountId: requireAccountId(
      transaction.budgetAccountId,
      `transactions[${index}].budgetAccountId`,
    ),
    localDate: requireLocalDate(transaction.localDate, `transactions[${index}].localDate`),
    amountMinor: requireMinor(
      transaction.amountMinor,
      `transactions[${index}].amountMinor`,
      false,
    ),
    category: category?.trim() || 'Diğer',
    note: note?.trim() || undefined,
    createdAt: requireTimestamp(transaction.createdAt, `transactions[${index}].createdAt`),
    updatedAt: requireTimestamp(transaction.updatedAt, `transactions[${index}].updatedAt`),
  }
}

const validateSettings = (value: unknown): AppSettings => {
  const settings = requireRecord(value, 'appSettings')
  const categories = settings.categories

  if (!Array.isArray(categories) || categories.length === 0) {
    throw new BackupValidationError('appSettings.categories boş olmayan bir dizi olmalıdır.')
  }

  const validatedCategories = categories.map((category, index) =>
    requireString(category, `appSettings.categories[${index}]`).trim(),
  )
  const normalizedCategories = new Set(
    validatedCategories.map((category) => category.toLocaleLowerCase('tr')),
  )

  if (normalizedCategories.size !== validatedCategories.length) {
    throw new BackupValidationError('appSettings.categories tekrar eden değer içeremez.')
  }
  if (settings.id !== 'app' || settings.currency !== 'TRY') {
    throw new BackupValidationError('AppSettings kimliği veya para birimi uyumsuz.')
  }
  if (!['system', 'light', 'dark'].includes(String(settings.theme))) {
    throw new BackupValidationError('AppSettings tema tercihi uyumsuz.')
  }

  return {
    id: 'app',
    categories: validatedCategories,
    theme: settings.theme as ThemePreference,
    currency: 'TRY',
    updatedAt: requireTimestamp(settings.updatedAt, 'appSettings.updatedAt'),
  }
}

export function createBudgetBackup(
  monthlyPlans: readonly MonthlyPlan[],
  transactions: readonly Transaction[],
  appSettings: AppSettings,
  exportedAt = new Date().toISOString(),
): BudgetBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    data: {
      monthlyPlans: [...monthlyPlans],
      transactions: [...transactions],
      appSettings,
    },
  }
}

export function parseBudgetBackup(json: string): BudgetBackup {
  let parsed: unknown

  try {
    parsed = JSON.parse(json)
  } catch {
    throw new BackupValidationError('Dosya geçerli JSON içermiyor.')
  }

  const root = requireRecord(parsed, 'Yedek')
  if (root.format !== BACKUP_FORMAT || root.version !== BACKUP_VERSION) {
    throw new BackupValidationError('Yedek formatı veya sürümü bu uygulamayla uyumlu değil.')
  }

  const data = requireRecord(root.data, 'data')
  if (!Array.isArray(data.monthlyPlans) || !Array.isArray(data.transactions)) {
    throw new BackupValidationError('Yedek plan veya işlem listesi içermiyor.')
  }

  const monthlyPlans = data.monthlyPlans.map(validatePlan)
  const transactions = data.transactions.map(validateTransaction)
  const planKeys = monthlyPlans.map((plan) => `${plan.budgetAccountId}:${plan.month}`)
  const transactionIds = transactions.map((transaction) => transaction.id)

  if (new Set(planKeys).size !== planKeys.length) {
    throw new BackupValidationError('Yedek tekrar eden aylık plan içeriyor.')
  }
  if (new Set(transactionIds).size !== transactionIds.length) {
    throw new BackupValidationError('Yedek tekrar eden işlem kimliği içeriyor.')
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: requireTimestamp(root.exportedAt, 'exportedAt'),
    data: {
      monthlyPlans,
      transactions,
      appSettings: validateSettings(data.appSettings),
    },
  }
}

export async function exportBudgetData(
  database: BudgetDatabase = budgetDb,
): Promise<string> {
  const snapshot = await loadBudgetData(database)
  return JSON.stringify(
    createBudgetBackup(snapshot.monthlyPlans, snapshot.transactions, snapshot.settings),
    null,
    2,
  )
}

export async function restoreBudgetData(
  backup: BudgetBackup,
  currentMonth: LocalMonth,
  database: BudgetDatabase = budgetDb,
): Promise<void> {
  await database.transaction(
    'rw',
    database.monthlyPlans,
    database.transactions,
    database.appSettings,
    async () => {
      await Promise.all([
        database.monthlyPlans.clear(),
        database.transactions.clear(),
        database.appSettings.clear(),
      ])
      await database.monthlyPlans.bulkAdd([...backup.data.monthlyPlans])
      await database.transactions.bulkAdd([...backup.data.transactions])
      await database.appSettings.add(backup.data.appSettings)
    },
  )

  await initializeBudgetData(currentMonth, database)
}

export async function resetBudgetData(
  currentMonth: LocalMonth,
  database: BudgetDatabase = budgetDb,
): Promise<void> {
  await database.transaction(
    'rw',
    database.monthlyPlans,
    database.transactions,
    database.appSettings,
    async () => {
      await Promise.all([
        database.monthlyPlans.clear(),
        database.transactions.clear(),
        database.appSettings.clear(),
      ])
    },
  )

  await initializeBudgetData(currentMonth, database)
}
