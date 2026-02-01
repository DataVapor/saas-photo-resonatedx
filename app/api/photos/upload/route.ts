import { v4 as uuid } from 'uuid'
import { BlobServiceClient } from '@azure/storage-blob'
import sharp from 'sharp'
import { query } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

let blobClient: BlobServiceClient | null = null

function getBlobClient(): BlobServiceClient {
  if (!blobClient) {
    blobClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING || ''
    )
  }
  return blobClient
}

export async function POST(req: Request) {
  try {
    // Verify auth token
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    const sessionId = decoded.sessionId

    // Parse multipart form data
    const formData = await req.formData()
    const file = formData.get('photo') as File
    const notes = (formData.get('notes') as string) || null
    const latitude = formData.get('latitude') ? parseFloat(formData.get('latitude') as string) : null
    const longitude = formData.get('longitude') ? parseFloat(formData.get('longitude') as string) : null
    const locationName = (formData.get('locationName') as string) || null
    const incidentId = (formData.get('incidentId') as string) || null

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return Response.json({ error: 'Invalid image type' }, { status: 400 })
    }

    if (file.size > 50 * 1024 * 1024) {
      // 50MB limit
      return Response.json({ error: 'File too large' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const imageBuffer = Buffer.from(buffer)

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata()

    // Generate thumbnail
    const thumbnail = await sharp(imageBuffer)
      .resize(400, 300, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()

    // Upload to Azure Blob Storage
    const photoId = uuid()
    const containerClient = getBlobClient().getContainerClient('ndms-photos')

    // Create container if it doesn't exist
    try {
      await containerClient.create()
    } catch (e) {
      // Container might already exist
    }

    const originalBlob = containerClient.getBlockBlobClient(`${photoId}/original`)
    const thumbnailBlob = containerClient.getBlockBlobClient(`${photoId}/thumbnail`)

    await originalBlob.upload(imageBuffer, imageBuffer.length, {
      metadata: {
        uploadTime: new Date().toISOString(),
        sessionId,
      },
    })

    await thumbnailBlob.upload(thumbnail, thumbnail.length)

    // Save metadata to database
    const photoResult = await query(
      `INSERT INTO photos 
       (id, session_id, file_name, blob_url, file_size, width, height, mime_type, 
        latitude, longitude, location_name, notes, incident_id, timestamp) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
       RETURNING id`,
      [
        photoId,
        sessionId,
        file.name,
        originalBlob.url,
        file.size,
        metadata.width || 0,
        metadata.height || 0,
        file.type,
        latitude,
        longitude,
        locationName,
        notes,
        incidentId,
        new Date(),
      ]
    )

    return Response.json({
      success: true,
      photoId: photoResult.rows[0].id,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
