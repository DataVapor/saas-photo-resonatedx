import { ConnectionPool, config as sqlConfig } from 'mssql'
import { DefaultAzureCredential } from '@azure/identity'

let pool: ConnectionPool | null = null

async function getAccessToken(): Promise<string> {
  const credential = new DefaultAzureCredential()
  const token = await credential.getToken('https://database.windows.net/.default')
  return token.token
}

async function getPool(): Promise<ConnectionPool> {
  if (pool) return pool

  const accessToken = await getAccessToken()

  const config: sqlConfig = {
    server: process.env.SQL_SERVER || '',
    database: process.env.SQL_DATABASE || '',
    authentication: {
      type: 'azure-active-directory-access-token',
      options: {
        token: accessToken,
      },
    },
    options: {
      encrypt: true,
      trustServerCertificate: false,
      connectTimeout: 30000,
    },
  }

  pool = new ConnectionPool(config)
  await pool.connect()
  console.log('✅ Connected to SQL Server via Entra ID')
  return pool
}

export async function query(sql: string, params?: Record<string, any>) {
  const pool = await getPool()
  const request = pool.request()

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value)
    })
  }

  const result = await request.query(sql)
  return { rows: result.recordset || [] }
}

export async function closePool() {
  if (pool) await pool.close()
}
