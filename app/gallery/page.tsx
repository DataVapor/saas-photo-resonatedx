'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LogOut, Download, X, ChevronLeft, ChevronRight,
  MapPin, FileText, AlertCircle, Loader2, Image as ImageIcon,
  Camera, Filter, Trash2,
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────── */
interface Photo {
  id: string
  fileName: string
  thumbnailUrl: string
  originalUrl: string
  fileSize: number
  width: number
  height: number
  mimeType: string
  latitude: number | null
  longitude: number | null
  locationName: string | null
  notes: string | null
  incidentId: string | null
  createdAt: string
}

/* ─── Animation Variants ─────────────────────────────── */
const stagger = {
  animate: { transition: { staggerChildren: 0.04 } },
}

const cardVariant = {
  initial: { opacity: 0, scale: 0.9, y: 16 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 350, damping: 22 },
  },
}

/* ─── Helpers ────────────────────────────────────────── */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/* ─── Gallery Page ───────────────────────────────────── */
export default function GalleryPage() {
  const router = useRouter()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [token, setToken] = useState('')
  const [teamName, setTeamName] = useState('')

  // Lightbox
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  // Filter
  const [filterIncident, setFilterIncident] = useState<string>('')

  // Delete
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Auth + fetch on mount
  useEffect(() => {
    const t = sessionStorage.getItem('aspr_token')
    const team = sessionStorage.getItem('aspr_team')
    if (!t) {
      router.push('/')
      return
    }
    setToken(t)
    setTeamName(team || 'Anonymous')
    fetchPhotos(t)
  }, [router])

  const fetchPhotos = async (authToken: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/photos', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to load photos')
      }
      const data = await res.json()
      setPhotos(data.photos || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photos')
    } finally {
      setLoading(false)
    }
  }

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (selectedIdx === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIdx(null)
      if (e.key === 'ArrowRight') setSelectedIdx((i) => i !== null ? Math.min(i + 1, filtered.length - 1) : null)
      if (e.key === 'ArrowLeft') setSelectedIdx((i) => i !== null ? Math.max(i - 1, 0) : null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIdx])

  const logout = () => {
    sessionStorage.clear()
    router.push('/')
  }

  const deletePhoto = async (photoId: string) => {
    setDeleting(photoId)
    try {
      const res = await fetch(`/api/photos/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Delete failed')
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      // If we deleted the photo that was open in lightbox, close or move
      if (selectedIdx !== null) {
        const newFiltered = filtered.filter((p) => p.id !== photoId)
        if (newFiltered.length === 0) {
          setSelectedIdx(null)
        } else if (selectedIdx >= newFiltered.length) {
          setSelectedIdx(newFiltered.length - 1)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(null)
      setConfirmDelete(null)
    }
  }

  // Derived
  const incidentIds = [...new Set(photos.filter((p) => p.incidentId).map((p) => p.incidentId!))]
  const filtered = filterIncident
    ? photos.filter((p) => p.incidentId === filterIncident)
    : photos
  const totalSize = filtered.reduce((sum, p) => sum + p.fileSize, 0)
  const selectedPhoto = selectedIdx !== null ? filtered[selectedIdx] : null

  if (!token) return null

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* ─── Header ─── */}
      <motion.header
        initial={{ y: -64 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
        className="sticky top-0 z-40 bg-gradient-to-r from-[#062e61] to-[#155197] text-white px-4 py-3 shadow-2xl shadow-[#062e61]/30"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/aspr-logo-white.png" alt="ASPR" className="h-8 w-auto" />
            <div className="h-5 w-px bg-white/25" />
            <span className="text-sm font-medium text-white/70">Team: {teamName}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition"
            >
              <Camera className="w-4 h-4" /> Upload
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </motion.header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* ─── Title + Stats ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-display tracking-wide uppercase text-slate-800">
              Photo Gallery
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {filtered.length} photo{filtered.length !== 1 ? 's' : ''} &bull; {formatBytes(totalSize)}
            </p>
          </div>

          {/* Incident filter */}
          {incidentIds.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterIncident}
                onChange={(e) => { setFilterIncident(e.target.value); setSelectedIdx(null) }}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white
                  focus:border-[#155197] focus:ring-2 focus:ring-[#155197]/15 outline-none"
              >
                <option value="">All Incidents</option>
                {incidentIds.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </div>
          )}
        </motion.div>

        {/* ─── Loading ─── */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 gap-4"
          >
            <Loader2 className="w-8 h-8 animate-spin text-[#155197]" />
            <p className="text-slate-400">Loading photos...</p>
          </motion.div>
        )}

        {/* ─── Error ─── */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </motion.div>
        )}

        {/* ─── Empty state ─── */}
        {!loading && !error && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-4"
          >
            <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
              <ImageIcon className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-slate-400 text-lg font-medium">No photos yet</p>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 bg-[#062e61] text-white px-6 py-3 rounded-xl font-semibold"
            >
              <Camera className="w-4 h-4" /> Upload Photos
            </motion.button>
          </motion.div>
        )}

        {/* ─── Photo Grid ─── */}
        {!loading && filtered.length > 0 && (
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
          >
            {filtered.map((photo, i) => (
              <motion.div
                key={photo.id}
                variants={cardVariant}
                layoutId={`photo-${photo.id}`}
                onClick={() => setSelectedIdx(i)}
                className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer group shadow-md hover:shadow-xl transition-shadow"
              >
                {photo.thumbnailUrl ? (
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.fileName}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget
                      // Try original URL as fallback, then show placeholder
                      if (photo.originalUrl && target.src !== photo.originalUrl) {
                        target.src = photo.originalUrl
                      } else {
                        target.style.display = 'none'
                        target.parentElement?.classList.add('bg-slate-100')
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent
                  opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                {/* Bottom info */}
                <div className="absolute bottom-0 inset-x-0 p-2.5 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                  <p className="text-[11px] text-white font-medium truncate">{photo.fileName}</p>
                  <p className="text-[10px] text-white/60">
                    {formatBytes(photo.fileSize)}
                    {photo.incidentId && ` \u2022 ${photo.incidentId}`}
                  </p>
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirmDelete === photo.id) {
                      deletePhoto(photo.id)
                    } else {
                      setConfirmDelete(photo.id)
                      setTimeout(() => setConfirmDelete((c) => c === photo.id ? null : c), 3000)
                    }
                  }}
                  className={`absolute top-2 right-2 w-7 h-7 rounded-full backdrop-blur-sm
                    flex items-center justify-center transition-all z-10
                    ${confirmDelete === photo.id
                      ? 'bg-red-500 opacity-100 scale-100'
                      : 'bg-black/40 opacity-0 group-hover:opacity-100 hover:bg-red-500'
                    }
                    ${deleting === photo.id ? 'animate-pulse' : ''}
                  `}
                >
                  {deleting === photo.id ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                  )}
                </button>

                {/* Location pin */}
                {photo.latitude && (
                  <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white/80 backdrop-blur-sm
                    flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <MapPin className="w-3.5 h-3.5 text-[#155197]" />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* ─── Lightbox ─── */}
      <AnimatePresence>
        {selectedPhoto && selectedIdx !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex"
            onClick={() => setSelectedIdx(null)}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setSelectedIdx(null)}
              className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                flex items-center justify-center text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Nav: Previous */}
            {selectedIdx > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSelectedIdx(selectedIdx - 1) }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full
                  bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {/* Nav: Next */}
            {selectedIdx < filtered.length - 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSelectedIdx(selectedIdx + 1) }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full
                  bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition
                  md:right-[340px]"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {/* Photo display */}
            <div
              className="flex-1 flex items-center justify-center p-16 md:pr-[340px]"
              onClick={() => setSelectedIdx(null)}
            >
              <motion.div
                key={selectedPhoto.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                onClick={(e) => e.stopPropagation()}
                className="relative max-w-full max-h-full"
              >
                {selectedPhoto.originalUrl ? (
                  <img
                    src={selectedPhoto.originalUrl}
                    alt={selectedPhoto.fileName}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                    onError={(e) => {
                      if (selectedPhoto.thumbnailUrl && e.currentTarget.src !== selectedPhoto.thumbnailUrl) {
                        e.currentTarget.src = selectedPhoto.thumbnailUrl
                      }
                    }}
                  />
                ) : selectedPhoto.thumbnailUrl ? (
                  <img
                    src={selectedPhoto.thumbnailUrl}
                    alt={selectedPhoto.fileName}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                  />
                ) : (
                  <div className="w-96 h-64 bg-slate-800 rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-slate-600" />
                  </div>
                )}

                {/* Counter */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2
                  bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full">
                  {selectedIdx + 1} / {filtered.length}
                </div>
              </motion.div>
            </div>

            {/* ─── Metadata sidebar ─── */}
            <motion.div
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="hidden md:flex flex-col w-[320px] bg-white/5 backdrop-blur-md
                border-l border-white/10 text-white overflow-y-auto"
            >
              <div className="p-6 space-y-6">
                {/* Filename */}
                <div>
                  <h3 className="font-display text-2xl tracking-wide uppercase truncate">
                    {selectedPhoto.fileName}
                  </h3>
                  <p className="text-xs text-white/40 mt-1">
                    {formatDate(selectedPhoto.createdAt)}
                  </p>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Size</p>
                    <p className="text-sm font-semibold mt-0.5">{formatBytes(selectedPhoto.fileSize)}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Dimensions</p>
                    <p className="text-sm font-semibold mt-0.5">
                      {selectedPhoto.width}&times;{selectedPhoto.height}
                    </p>
                  </div>
                </div>

                {/* Incident ID */}
                {selectedPhoto.incidentId && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Incident</p>
                    <div className="bg-white/5 rounded-xl px-3 py-2 text-sm font-mono">
                      {selectedPhoto.incidentId}
                    </div>
                  </div>
                )}

                {/* Location */}
                {selectedPhoto.latitude && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" /> Location
                    </p>
                    <div className="bg-white/5 rounded-xl px-3 py-2 text-sm font-mono">
                      {selectedPhoto.locationName || `${selectedPhoto.latitude}, ${selectedPhoto.longitude}`}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedPhoto.notes && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3 h-3" /> Notes
                    </p>
                    <div className="bg-white/5 rounded-xl px-3 py-2.5 text-sm leading-relaxed">
                      {selectedPhoto.notes}
                    </div>
                  </div>
                )}

                {/* Download */}
                {selectedPhoto.originalUrl && (
                  <motion.a
                    href={selectedPhoto.originalUrl}
                    download={selectedPhoto.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                      bg-white text-[#062e61] font-semibold text-sm
                      hover:bg-white/90 transition"
                  >
                    <Download className="w-4 h-4" />
                    Download Original
                  </motion.a>
                )}

                {/* Delete */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirmDelete === selectedPhoto.id) {
                      deletePhoto(selectedPhoto.id)
                    } else {
                      setConfirmDelete(selectedPhoto.id)
                      setTimeout(() => setConfirmDelete((c) => c === selectedPhoto.id ? null : c), 3000)
                    }
                  }}
                  disabled={deleting === selectedPhoto.id}
                  className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl
                    font-semibold text-sm transition
                    ${confirmDelete === selectedPhoto.id
                      ? 'bg-red-500 text-white'
                      : 'bg-white/5 text-red-400 hover:bg-red-500/20'
                    }`}
                >
                  {deleting === selectedPhoto.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {confirmDelete === selectedPhoto.id ? 'Tap again to confirm' : 'Delete Photo'}
                </button>
              </div>
            </motion.div>

            {/* ─── Mobile metadata (bottom sheet) ─── */}
            <motion.div
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="md:hidden absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-md
                border-t border-white/10 text-white p-4 rounded-t-2xl max-h-[40vh] overflow-y-auto"
            >
              <div className="w-8 h-1 bg-white/20 rounded-full mx-auto mb-3" />

              <h3 className="font-semibold truncate">{selectedPhoto.fileName}</h3>
              <p className="text-xs text-white/40">{formatDate(selectedPhoto.createdAt)}</p>

              <div className="flex gap-3 mt-3 text-xs">
                <span className="bg-white/10 px-2.5 py-1 rounded-lg">
                  {formatBytes(selectedPhoto.fileSize)}
                </span>
                <span className="bg-white/10 px-2.5 py-1 rounded-lg">
                  {selectedPhoto.width}&times;{selectedPhoto.height}
                </span>
                {selectedPhoto.incidentId && (
                  <span className="bg-white/10 px-2.5 py-1 rounded-lg font-mono">
                    {selectedPhoto.incidentId}
                  </span>
                )}
              </div>

              {selectedPhoto.notes && (
                <p className="text-sm text-white/70 mt-3">{selectedPhoto.notes}</p>
              )}

              <div className="flex gap-2 mt-3">
                {selectedPhoto.originalUrl && (
                  <a
                    href={selectedPhoto.originalUrl}
                    download={selectedPhoto.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                      bg-white text-[#062e61] font-semibold text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirmDelete === selectedPhoto.id) {
                      deletePhoto(selectedPhoto.id)
                    } else {
                      setConfirmDelete(selectedPhoto.id)
                      setTimeout(() => setConfirmDelete((c) => c === selectedPhoto.id ? null : c), 3000)
                    }
                  }}
                  disabled={deleting === selectedPhoto.id}
                  className={`px-4 py-3 rounded-xl font-semibold text-sm transition
                    ${confirmDelete === selectedPhoto.id
                      ? 'bg-red-500 text-white'
                      : 'bg-white/10 text-red-400'
                    }`}
                >
                  {deleting === selectedPhoto.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
