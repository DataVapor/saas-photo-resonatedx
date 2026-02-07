import { query } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { BlobServiceClient, BlobSASPermissions } from '@azure/storage-blob'

let blobClient: BlobServiceClient | null = null

function getBlobClient(): BlobServiceClient | null {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) return null
  if (!blobClient) {
    blobClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    )
  }
  return blobClient
}

export async function GET(req: Request) {
  try {
    // Verify auth
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    const sessionId = decoded.sessionId

    // Fetch photos for this session
    const result = await query(
      `SELECT id, file_name, blob_url, file_size, width, height, mime_type,
              latitude, longitude, location_name, notes, incident_id, created_at
       FROM photos
       WHERE session_id = @sessionId
       ORDER BY created_at DESC`,
      { sessionId }
    )

    // Generate SAS URLs for blob access
    const client = getBlobClient()
    const container = client?.getContainerClient('aspr-photos')

    const photos = await Promise.all(
      result.rows.map(async (row: any) => {
        let thumbnailUrl = ''
        let originalUrl = ''

        if (container) {
          try {
            const sasExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
            const sasPerms = BlobSASPermissions.parse('r')

            thumbnailUrl = await container
              .getBlobClient(`${row.id}/thumbnail`)
              .generateSasUrl({ permissions: sasPerms, expiresOn: sasExpiry })

            originalUrl = await container
              .getBlobClient(`${row.id}/original`)
              .generateSasUrl({ permissions: sasPerms, expiresOn: sasExpiry })
          } catch (e) {
            console.error('SAS generation error for photo', row.id, e)
            // Fall back to stored blob_url
            originalUrl = row.blob_url || ''
          }
        }

        return {
          id: row.id,
          fileName: row.file_name,
          thumbnailUrl,
          originalUrl,
          fileSize: row.file_size,
          width: row.width,
          height: row.height,
          mimeType: row.mime_type,
          latitude: row.latitude,
          longitude: row.longitude,
          locationName: row.location_name,
          notes: row.notes,
          incidentId: row.incident_id,
          createdAt: row.created_at,
        }
      })
    )

    return Response.json({ photos })
  } catch (error) {
    console.error('Photos fetch error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch photos' },
      { status: 500 }
    )
  }
}
