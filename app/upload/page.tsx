'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, MapPin, AlertCircle, CheckCircle, LogOut } from 'lucide-react'

export default function UploadPage() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)

  // Form state
  const [notes, setNotes] = useState('')
  const [incidentId, setIncidentId] = useState('')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationName, setLocationName] = useState('')

  // Session state
  const [token, setToken] = useState('')
  const [teamName, setTeamName] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check authentication on mount
  useEffect(() => {
    const storedToken = sessionStorage.getItem('ndms_token')
    const storedTeam = sessionStorage.getItem('ndms_team')

    if (!storedToken) {
      router.push('/')
      return
    }

    setToken(storedToken)
    setTeamName(storedTeam || 'Anonymous')
  }, [router])

  // Get user location
  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not available on this device')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setLocationName(
          `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
        )
      },
      (err) => {
        setError(`Location error: ${err.message}`)
      }
    )
  }

  // Handle photo selection
  const handlePhotoSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File is too large (max 50MB)')
      return
    }

    setUploading(true)
    setError('')
    setSuccess(false)

    try {
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('notes', notes)
      formData.append('incidentId', incidentId)
      if (location) {
        formData.append('latitude', location.lat.toString())
        formData.append('longitude', location.lng.toString())
      }
      formData.append('locationName', locationName)

      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await response.json()

      setSuccess(true)
      setNotes('')
      setIncidentId('')
      setLocationName('')
      setProgress(0)

      // Reset after 2 seconds
      setTimeout(() => {
        setSuccess(false)
        fileInputRef.current?.click() // Prompt for next photo
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.clear()
    router.push('/')
  }

  if (!token) {
    return <div className="min-h-screen bg-aspr-gray-light flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-aspr-blue-light to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-aspr-blue-dark to-aspr-blue-primary text-white p-4 sticky top-0 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">NDMS Photo Uploader</h1>
            <p className="text-sm opacity-90">Team: {teamName}</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded text-sm font-semibold transition flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto p-4 space-y-4 py-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3 animate-pulse">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900">Photo uploaded!</p>
              <p className="text-sm text-green-700">Ready for another photo...</p>
            </div>
          </div>
        )}

        {/* Camera/Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full bg-gradient-to-r from-aspr-blue-primary to-aspr-blue-dark hover:from-aspr-blue-dark hover:to-aspr-blue-primary disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-6 rounded-lg flex items-center justify-center gap-3 transition shadow-lg"
        >
          <Camera className="w-7 h-7" />
          <div>
            <div>{uploading ? `Uploading... ${progress}%` : 'Take or Select Photo'}</div>
            {uploading && <div className="text-sm opacity-80">{progress}%</div>}
          </div>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0]
            if (file) handlePhotoSelect(file)
          }}
          className="hidden"
        />

        {/* Incident ID */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Incident ID (optional)
          </label>
          <input
            type="text"
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
            placeholder="e.g., HU-2024-001"
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-aspr-blue-primary focus:border-transparent font-semibold"
          />
        </div>

        {/* Location */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-700">Location</label>
            <button
              onClick={getLocation}
              disabled={uploading}
              className="text-xs bg-aspr-blue-100 hover:bg-aspr-blue-200 text-aspr-blue-700 px-3 py-1.5 rounded disabled:opacity-50 font-semibold transition flex items-center gap-1"
            >
              <MapPin className="w-3 h-3" />
              Get Location
            </button>
          </div>
          {location ? (
            <p className="text-sm text-white p-3 bg-aspr-blue-primary rounded font-semibold">
              📍 {locationName}
            </p>
          ) : (
            <p className="text-xs text-gray-500 italic p-2">No location captured</p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe what's in the photo..."
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-aspr-blue-primary focus:border-transparent"
            rows={3}
          />
        </div>

        {/* Tips */}
        <div className="bg-aspr-blue-light border-2 border-aspr-blue-primary rounded-lg p-4 text-sm text-aspr-blue-dark">
          <p className="font-bold mb-2">💡 Photography Tips</p>
          <ul className="space-y-1 text-xs">
            <li>✓ Use good lighting for clear photos</li>
            <li>✓ Include incident ID for organization</li>
            <li>✓ Add location for mapping</li>
            <li>✓ Add notes to describe context</li>
            <li>✓ Works offline (queues uploads)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
