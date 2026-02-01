import { ConnectionPool, config as sqlConfig } from 'mssql'
import { DefaultAzureCredential } from '@azure/identity'

let pool: ConnectionPool | null = null

async function getAccessToken(): Promise<string> {
  // In production, use Entra ID authentication
  // In development, return a mock token (requires SQL Server to allow local connections)
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ Using development mode - ensure SQL Server allows local connections')
    return 'dev-mock-token'
  }

  try {
    const credential = new DefaultAzureCredential()
    const token = await credential.getToken('https://database.windows.net/.default')
    return token.token
  } catch (error) {
    console.error('❌ Entra ID authentication failed:', error instanceof Error ? error.message : error)
    throw new Error('Failed to obtain Azure access token. Ensure application is running in Azure or has proper credentials configured.')
  }
}

async function getPool(): Promise<ConnectionPool> {
  if (pool) return pool

  // Determine authentication method
  let config: sqlConfig

  if (process.env.NODE_ENV === 'development' && process.env.SQL_USERNAME && process.env.SQL_PASSWORD) {
    // Development: Use SQL Server authentication
    config = {
      server: process.env.SQL_SERVER || '',
      database: process.env.SQL_DATABASE || '',
      authentication: {
        type: 'default',
        options: {
          userName: process.env.SQL_USERNAME,
          password: process.env.SQL_PASSWORD,
        },
      },
      options: {
        encrypt: true,
        trustServerCertificate: true, // Allow self-signed certs in dev
        connectTimeout: 30000,
      },
    }
    console.log('ℹ️ Using SQL Server authentication (development mode)')
  } else {
    // Production: Use Entra ID token authentication
    const accessToken = await getAccessToken()
    config = {
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
    console.log('✅ Connected to SQL Server via Entra ID')
  }

  pool = new ConnectionPool(config)
  try {
    await pool.connect()
    console.log('✅ Successfully connected to SQL Server')
  } catch (error) {
    console.error('❌ Failed to connect to SQL Server:', error instanceof Error ? error.message : error)
    pool = null
    throw error
  }

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
