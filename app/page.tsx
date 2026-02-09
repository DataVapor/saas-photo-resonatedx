'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, MapPin, LogOut, ChevronRight, ChevronLeft, ArrowRight,
  Upload, CheckCircle2, X, Loader2,
  AlertCircle, ImagePlus, Send, RotateCcw, Locate,
  Image as ImageIcon,
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────── */
type Step = 'welcome' | 'pin' | 'photos' | 'metadata' | 'uploading' | 'success'

interface PhotoFile {
  file: File
  preview: string
  id: string
}

const STEP_ORDER: Step[] = ['welcome', 'pin', 'photos', 'metadata', 'uploading', 'success']

/* ─── Animation Variants ─────────────────────────────── */
const EASE_OUT = [0.25, 0.8, 0.25, 1] as const
const EASE_IN = [0.4, 0, 1, 1] as const

const pageVariants = {
  enter: (d: number) => ({
    x: d > 0 ? '100%' : '-100%',
    y: d > 0 ? 20 : 0,
    opacity: 1,
  }),
  center: {
    x: 0,
    y: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: EASE_OUT },
  },
  exit: (d: number) => ({
    x: d < 0 ? '100%' : '-100%',
    y: 0,
    opacity: 1,
    transition: { duration: 0.2, ease: EASE_IN },
  }),
}

const stagger = {
  animate: { transition: { staggerChildren: 0.04 } },
}

const slideUp = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE_OUT },
  },
}

const popIn = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.35, ease: EASE_OUT },
  },
}

/* ─── Floating Particles ─────────────────────────────── */
function Particles({ muted = false }: { muted?: boolean }) {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  if (!ready) return null

  const count = muted ? 18 : 35
  const opacity = muted ? 'bg-white/[0.04]' : 'bg-white/[0.07]'

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none z-[1] transition-opacity duration-1000 ${muted ? 'opacity-60' : 'opacity-100'}`}>
      {Array.from({ length: count }, (_, i) => {
        const size = 2 + (i * 7) % 6
        return (
          <div
            key={i}
            className={`absolute rounded-full ${opacity} animate-float`}
            style={{
              width: size,
              height: size,
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              animationDelay: `${(i * 0.3) % 10}s`,
              animationDuration: `${8 + (i * 0.4) % 8}s`,
            }}
          />
        )
      })}
    </div>
  )
}

/* ─── Step Dots ──────────────────────────────────────── */
function StepDots({ current }: { current: Step }) {
  const idx = STEP_ORDER.indexOf(current)
  return (
    <div className="flex gap-2 justify-center">
      {STEP_ORDER.map((s, i) => (
        <motion.div
          key={s}
          layout
          className={`h-1.5 rounded-full transition-all duration-500 ${
            i === idx
              ? 'bg-white w-8'
              : i < idx
                ? 'bg-white/50 w-2'
                : 'bg-white/15 w-2'
          }`}
        />
      ))}
    </div>
  )
}

/* ─── Main Wizard ────────────────────────────────────── */
export default function PhotoUploadWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [direction, setDirection] = useState(1)

  // Auth state
  const [pin, setPin] = useState<string[]>(Array(6).fill(''))
  const [token, setToken] = useState('')
  const [teamName, setTeamName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [pinValid, setPinValid] = useState(false)
  const [showPreloader, setShowPreloader] = useState(true)

  // Reliable preloader dismissal — timer-based, not animation-dependent
  useEffect(() => {
    const timer = setTimeout(() => setShowPreloader(false), 2200)
    return () => clearTimeout(timer)
  }, [])

  // Photos
  const [photos, setPhotos] = useState<PhotoFile[]>([])
  const [dragOver, setDragOver] = useState(false)

  // Metadata
  const [notes, setNotes] = useState('')
  const [incidentId, setIncidentId] = useState('')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationName, setLocationName] = useState('')
  const [locating, setLocating] = useState(false)

  // Upload
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedCount, setUploadedCount] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [lastBatchSize, setLastBatchSize] = useState(0)

  // Refs
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // Restore session
  useEffect(() => {
    const t = sessionStorage.getItem('aspr_token')
    const team = sessionStorage.getItem('aspr_team')
    if (t) {
      setToken(t)
      setTeamName(team || 'Anonymous')
      setStep('photos')
      setShowPreloader(false)
    }
  }, [])

  const goTo = useCallback(
    (next: Step) => {
      setDirection(STEP_ORDER.indexOf(next) > STEP_ORDER.indexOf(step) ? 1 : -1)
      setStep(next)
    },
    [step],
  )

  /* ───── PIN logic ──────────────────────────── */
  const handlePinInput = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return
    const next = [...pin]
    next[i] = val.slice(-1)
    setPin(next)
    setAuthError('')
    if (val && i < 5) pinRefs.current[i + 1]?.focus()
    if (val && i === 5 && next.every(Boolean)) submitPin(next.join(''))
  }

  const handlePinKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) pinRefs.current[i - 1]?.focus()
  }

  const handlePinPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (p.length === 6) {
      setPin(p.split(''))
      pinRefs.current[5]?.focus()
      submitPin(p)
    }
  }

  const submitPin = async (pinStr: string) => {
    setAuthLoading(true)
    setAuthError('')
    try {
      const res = await fetch('/api/auth/validate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinStr }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Invalid PIN')
      }
      const { token: t, sessionId, teamName: team } = await res.json()
      sessionStorage.setItem('aspr_token', t)
      sessionStorage.setItem('aspr_session_id', sessionId)
      sessionStorage.setItem('aspr_team', team)
      setToken(t)
      setTeamName(team)
      setPinValid(true)
      setTimeout(() => goTo('photos'), 900)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Verification failed')
      setPin(Array(6).fill(''))
      setTimeout(() => pinRefs.current[0]?.focus(), 120)
    } finally {
      setAuthLoading(false)
    }
  }

  /* ───── Photo logic ────────────────────────── */
  const addPhotos = useCallback((files: FileList | File[]) => {
    const arr: PhotoFile[] = []
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith('image/') || f.size > 50 * 1024 * 1024) return
      arr.push({
        file: f,
        preview: URL.createObjectURL(f),
        id: Math.random().toString(36).slice(2, 11),
      })
    })
    setPhotos((prev) => [...prev, ...arr])
  }, [])

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const r = prev.find((p) => p.id === id)
      if (r) URL.revokeObjectURL(r.preview)
      return prev.filter((p) => p.id !== id)
    })
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files) addPhotos(e.dataTransfer.files)
    },
    [addPhotos],
  )

  /* ───── Location ───────────────────────────── */
  const [gpsError, setGpsError] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [zipLooking, setZipLooking] = useState(false)

  const getLocation = () => {
    setGpsError('')
    if (!navigator.geolocation) {
      setGpsError('GPS not available on this device. Use ZIP code instead.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationName(
          `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
        )
        setLocating(false)
        setGpsError('')
      },
      (err) => {
        setLocating(false)
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('Location access denied. Enable in browser settings or use ZIP code.')
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError('Location unavailable. Use ZIP code instead.')
        } else {
          setGpsError('Location timed out. Use ZIP code instead.')
        }
      },
      { timeout: 10000 },
    )
  }

  const lookupZip = async () => {
    const cleaned = zipCode.replace(/\s/g, '').slice(0, 5)
    if (!/^\d{5}$/.test(cleaned)) {
      setGpsError('Enter a valid 5-digit ZIP code')
      return
    }
    setZipLooking(true)
    setGpsError('')
    try {
      const res = await fetch(
        `https://api.zippopotam.us/us/${cleaned}`
      )
      if (!res.ok) throw new Error('ZIP not found')
      const data = await res.json()
      const place = data.places?.[0]
      if (!place) throw new Error('ZIP not found')
      const lat = parseFloat(place.latitude)
      const lng = parseFloat(place.longitude)
      setLocation({ lat, lng })
      setLocationName(`${place['place name']}, ${place['state abbreviation']} ${cleaned}`)
      setGpsError('')
    } catch {
      setGpsError('ZIP code not found. Check and try again.')
    } finally {
      setZipLooking(false)
    }
  }

  /* ───── Upload ─────────────────────────────── */
  const handleUpload = async () => {
    setLastBatchSize(photos.length)
    goTo('uploading')
    setUploadProgress(0)
    setUploadedCount(0)
    setUploadError('')

    try {
      for (let i = 0; i < photos.length; i++) {
        const fd = new FormData()
        fd.append('photo', photos[i].file)
        if (notes) fd.append('notes', notes)
        if (incidentId) fd.append('incidentId', incidentId)
        if (location) {
          fd.append('latitude', location.lat.toString())
          fd.append('longitude', location.lng.toString())
        }
        if (locationName) fd.append('locationName', locationName)

        const res = await fetch('/api/photos/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.error || `Failed: ${photos[i].file.name}`)
        }
        setUploadedCount(i + 1)
        setUploadProgress(Math.round(((i + 1) / photos.length) * 100))
      }

      photos.forEach((p) => URL.revokeObjectURL(p.preview))
      setTimeout(() => goTo('success'), 600)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const resetForMore = () => {
    setPhotos([])
    setNotes('')
    setIncidentId('')
    setLocation(null)
    setLocationName('')
    setUploadProgress(0)
    setUploadedCount(0)
    setUploadError('')
    goTo('photos')
  }

  const logout = () => {
    sessionStorage.clear()
    setToken('')
    setTeamName('')
    setPin(Array(6).fill(''))
    setPinValid(false)
    goTo('welcome')
  }

  /* ───── Derived ────────────────────────────── */
  const isDark = true
  const RING_R = 52
  const RING_CIRC = 2 * Math.PI * RING_R

  /* ─── Background ───────────────────────────────────── */
  const showHero = step === 'welcome' || step === 'pin' || step === 'success'

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */
  return (
    <div
      className="h-screen relative overflow-hidden bg-[#031a36]"
    >
      {/* ─── Background layers ───
           Image is ALWAYS mounted & visible — never changes opacity.
           Visibility is controlled by the gradient curtain above it:
           hero steps → semi-transparent gradient (image shows through)
           other steps → fully opaque gradient (image hidden)         ─── */}
      <div className="absolute inset-0 z-0">
        {/* Layer 0: Hero image — always rendered, always animating */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src="/hero-field.webp"
            alt=""
            fetchPriority="high"
            className="absolute inset-0 w-full h-full object-cover animate-ken-burns"
          />
        </div>

        {/* Layer 1: Gradient curtain — only this transitions, never the image */}
        <div className={`absolute inset-0 z-10 transition-all duration-500 ease-in-out ${
          step === 'success'
            ? 'bg-gradient-to-b from-[#031a36]/70 via-emerald-950/60 to-[#062e61]'
            : showHero
              ? 'bg-gradient-to-b from-[#031a36]/40 via-[#062e61]/60 to-[#062e61]'
              : 'bg-gradient-to-br from-[#031a36] via-[#062e61] to-[#155197]'
        }`} />

        {/* Layer 2: Edge darken — only visible on hero steps */}
        <div className={`absolute inset-0 z-10 transition-opacity duration-500 ${showHero ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute inset-0 bg-gradient-to-l from-[#031a36]/70 via-[#031a36]/20 to-transparent" />
          <div className="absolute inset-0 hero-vignette" />
        </div>
      </div>

      {isDark && <Particles muted={showHero} />}

      {/* ─── Branded header (light steps) ─── */}
      {(step === 'photos' || step === 'metadata') && (
        <motion.header
          initial={{ y: -64 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 inset-x-0 z-50 bg-gradient-to-r from-[#062e61] to-[#155197] text-white px-4 py-3 shadow-2xl shadow-[#062e61]/30"
        >
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/aspr-logo-white.png" alt="ASPR" className="h-10 w-auto drop-shadow-[0_0_12px_rgba(21,81,151,0.4)]" />
              <div className="h-6 w-px bg-white/25" />
              <span className="text-sm font-medium text-white/70">Team: {teamName}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push('/gallery')}
                className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition"
              >
                <ImageIcon className="w-4 h-4" /> Gallery
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
      )}

      {/* ─── Step content ─── */}
      <AnimatePresence custom={direction}>
        {/* ═══ WELCOME ═══ */}
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            custom={direction}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ x: '-100%', opacity: 1, transition: { duration: 0.2, ease: EASE_IN } }}
            className="absolute inset-0 flex flex-col items-center justify-center px-6 z-10"
          >
            <motion.div
              variants={stagger}
              initial="initial"
              animate="animate"
              className="text-center space-y-6 lg:space-y-8"
            >
              {/* HHS */}
              <motion.div variants={slideUp}>
                <img
                  src="/hhs_longlogo_white.png"
                  alt="U.S. Department of Health and Human Services"
                  className="h-16 md:h-20 lg:h-28 mx-auto opacity-60"
                />
              </motion.div>

              {/* ASPR logo */}
              <motion.div variants={popIn}>
                <img
                  src="/aspr-logo-white.png"
                  alt="ASPR"
                  className="h-16 md:h-20 lg:h-24 mx-auto drop-shadow-[0_0_40px_rgba(21,81,151,0.6)]"
                />
              </motion.div>

              {/* Title */}
              <motion.div variants={slideUp} className="space-y-2">
                <h1 className="text-4xl md:text-5xl lg:text-7xl font-display text-white tracking-wide leading-tight uppercase">
                  Photo Repository
                </h1>
                <p className="text-base md:text-lg lg:text-xl text-blue-200/60 max-w-lg mx-auto leading-relaxed">
                  Secure photo upload for disaster response and emergency documentation
                </p>
              </motion.div>

              {/* CTA */}
              <motion.div variants={slideUp}>
                <motion.button
                  onClick={() => goTo('pin')}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="group inline-flex items-center gap-3 px-8 py-3.5 rounded
                    bg-white/[0.1] backdrop-blur-md text-white font-medium text-base
                    border border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.04)]
                    hover:bg-white/[0.16] hover:border-white/30
                    hover:shadow-[0_0_50px_rgba(255,255,255,0.08)] transition-all"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </motion.button>
              </motion.div>

              {/* Footer */}
              <motion.div variants={slideUp} className="pt-2 lg:pt-6 space-y-1 text-xs text-blue-300/30">
                <p className="font-semibold">
                  Administration for Strategic Preparedness and Response
                </p>
                <p>U.S. Department of Health and Human Services</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {/* ═══ PIN ═══ */}
        {step === 'pin' && (
          <motion.div
            key="pin"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 flex flex-col items-center justify-center px-6 z-10"
          >
            <motion.div
              variants={stagger}
              initial="initial"
              animate="animate"
              className="text-center space-y-6 w-full max-w-sm"
            >
              {/* ASPR logo */}
              <motion.div variants={slideUp}>
                <img
                  src="/aspr-logo-white.png"
                  alt="ASPR"
                  className="h-16 md:h-20 lg:h-24 mx-auto drop-shadow-[0_0_30px_rgba(21,81,151,0.5)]"
                />
              </motion.div>

              {/* Success checkmark */}
              {pinValid && (
                <motion.div variants={popIn}>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 12 }}
                  >
                    <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto drop-shadow-[0_0_20px_rgba(52,211,153,0.5)]" />
                  </motion.div>
                </motion.div>
              )}

              {/* Title */}
              <motion.div variants={slideUp} className="space-y-2">
                <h2 className="text-3xl md:text-4xl font-display text-white tracking-wide uppercase">
                  {pinValid ? `Welcome, ${teamName}` : 'Enter Access PIN'}
                </h2>
                {!pinValid && (
                  <p className="text-sm text-blue-200/50">
                    6-digit code from your incident commander
                  </p>
                )}
              </motion.div>

              {/* PIN boxes */}
              {!pinValid && (
                <motion.div
                  variants={slideUp}
                  className="flex gap-3 justify-center"
                  onPaste={handlePinPaste}
                >
                  {pin.map((digit, i) => (
                    <motion.input
                      key={i}
                      ref={(el) => {
                        pinRefs.current[i] = el
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinInput(i, e.target.value)}
                      onKeyDown={(e) => handlePinKey(i, e)}
                      animate={authError ? { x: [0, -10, 10, -10, 10, 0] } : {}}
                      transition={{ duration: 0.4 }}
                      disabled={authLoading}
                      autoFocus={i === 0}
                      className={`w-12 h-16 rounded-lg text-center text-2xl font-bold
                        bg-white/[0.07] backdrop-blur-sm border text-white outline-none
                        transition-all duration-200
                        ${digit ? 'border-blue-400/60 bg-blue-400/10' : 'border-white/15'}
                        focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/15
                        disabled:opacity-50`}
                    />
                  ))}
                </motion.div>
              )}

              {/* Error */}
              <AnimatePresence>
                {authError && (
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 justify-center text-red-400 text-sm"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {authError}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Loading */}
              {authLoading && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 justify-center text-blue-300/80"
                >
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying&hellip;
                </motion.p>
              )}

              {/* ID.me — Coming Soon */}
              {!pinValid && (
                <motion.div variants={slideUp} className="space-y-2 w-full">
                  <div className="flex items-center gap-3 text-blue-200/30 text-xs">
                    <div className="flex-1 h-px bg-blue-200/10" />
                    <span>or</span>
                    <div className="flex-1 h-px bg-blue-200/10" />
                  </div>
                  <button
                    type="button"
                    disabled
                    className="w-full inline-flex items-center justify-center gap-2.5
                      bg-[#08833D]/20 backdrop-blur-sm text-white/40 py-3 rounded
                      font-semibold text-sm border border-[#08833D]/30
                      cursor-not-allowed transition-all relative"
                  >
                    <svg className="h-4 w-auto" viewBox="0 0 93 34" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4.99 0.249H3.386C1.384 0.249 0.369 0.843 0.369 2.014V30.98C0.369 32.152 1.384 32.745 3.386 32.745H4.99C6.993 32.745 8.008 32.151 8.008 30.98V2.014C8.009 0.843 6.993 0.249 4.99 0.249Z" />
                      <path d="M33.278 29.197C33.278 25.741 35.556 22.817 38.703 21.81C39.063 20.199 39.244 18.423 39.247 16.48C39.247 6.01 33.922 0.243 24.25 0.243H13.94C12.5 0.243 11.829 0.908 11.829 2.336V30.625C11.829 32.053 12.5 32.718 13.939 32.718H24.249C27.936 32.718 30.99 31.877 33.359 30.26C33.307 29.908 33.28 29.553 33.277 29.197M24.248 26.206H19.501V6.755H24.248C30.188 6.755 31.435 12.044 31.435 16.48C31.435 20.917 30.188 26.206 24.248 26.206Z" />
                      <path d="M41.11 25.65C43.086 25.65 44.688 27.238 44.688 29.198C44.688 31.157 43.086 32.745 41.11 32.745C39.133 32.745 37.531 31.157 37.531 29.198C37.531 27.238 39.133 25.65 41.11 25.65Z" />
                      <path d="M92 24.219C91.896 24.174 91.784 24.149 91.669 24.145C91.18 24.129 90.847 24.32 90.552 24.792C90.378 25.074 90.207 25.362 90.036 25.649C89.387 26.746 88.717 27.877 87.742 28.689C86.419 29.791 84.503 30.306 82.86 30.007C81.883 29.83 81.185 29.129 80.771 28.572C80.012 27.55 79.643 26.173 79.702 24.586C82.121 24.384 89.41 23.316 89.991 17.838C90.103 16.776 89.798 15.813 89.108 15.054C88.234 14.092 86.838 13.561 85.179 13.561C80.318 13.561 75.519 18.603 74.91 24.35C74.744 25.927 74.942 27.382 75.5 28.68C75.146 29.019 74.741 29.302 74.302 29.519C73.895 29.711 73.542 29.751 73.283 29.633C72.963 29.486 72.833 29.115 72.782 28.83C72.591 27.778 72.838 26.569 73.131 25.319C73.303 24.586 73.519 23.823 73.709 23.149C74.297 21.07 74.905 18.921 74.702 16.749C74.518 14.761 73.11 13.526 71.029 13.526C68.111 13.526 66.189 15.59 64.946 17.36C64.92 16.041 64.603 15.084 63.981 14.444C63.39 13.835 62.522 13.525 61.401 13.525C58.539 13.525 56.642 15.508 55.401 17.244C55.418 17.084 55.435 16.921 55.453 16.759C55.531 16.015 55.566 14.949 54.967 14.29C54.61 13.898 54.074 13.699 53.373 13.699C52.891 13.684 52.409 13.721 51.936 13.811C51.929 13.812 51.286 13.937 51.041 14.16C50.612 14.55 50.749 15.087 50.827 15.394C50.837 15.433 50.846 15.469 50.851 15.499C50.9 15.839 50.915 16.183 50.896 16.526C50.806 18.613 50.416 20.7 50.045 22.466C49.844 23.417 49.618 24.385 49.395 25.34C48.899 27.46 48.388 29.65 48.125 31.854C48.067 32.282 48.366 32.676 48.795 32.735C48.834 32.74 48.873 32.742 48.913 32.742L49.067 32.743C50.64 32.764 52.185 32.7 52.549 31.81C52.951 30.829 53.173 29.636 53.37 28.581L53.457 28.113C53.923 25.686 54.331 23.948 55.152 21.713C55.575 20.56 56.348 19.523 56.973 18.747C57.73 17.807 58.547 16.887 59.468 16.864C59.849 16.845 60.098 16.957 60.286 17.204C61.18 18.388 60.066 22.208 59.591 23.84C59.488 24.193 59.401 24.491 59.346 24.709L59.018 25.97C58.535 27.808 58.036 29.708 57.781 31.63C57.755 31.827 57.731 32.024 57.711 32.224L57.689 32.492L57.891 32.645C58.297 32.958 61.196 32.521 61.219 32.514C62.288 32.156 62.521 31.159 62.598 30.831C62.797 29.983 62.973 29.117 63.142 28.28L63.155 28.218C63.474 26.642 63.804 25.011 64.297 23.437C65.261 20.375 66.546 18.286 68.117 17.228C68.789 16.774 69.479 16.724 69.791 17.107C70.335 17.769 69.991 19.56 69.843 20.325C69.64 21.386 69.38 22.466 69.129 23.51L69.116 23.563C68.955 24.229 68.795 24.894 68.646 25.561C68.187 27.628 67.809 30.191 68.983 31.67C69.581 32.424 70.505 32.806 71.731 32.806C73.031 32.806 74.253 32.376 75.579 31.453C75.944 31.197 76.313 30.898 76.743 30.543C78.236 32.225 79.93 32.945 82.376 32.945C87.907 32.945 90.507 29.302 91.982 26.562C92.178 26.211 92.351 25.848 92.499 25.474C92.682 24.97 92.463 24.418 92 24.22M84.963 19.2C84.174 21.737 81.952 22.187 80.03 22.251C80.283 21.168 80.658 20.116 81.147 19.117C82.083 17.228 83.257 16.055 84.212 16.054C85.669 16.054 85.211 18.384 84.963 19.2Z" />
                    </svg>
                    <span className="absolute -top-2 right-3 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider
                      bg-[#08833D]/30 text-emerald-300/80 border border-[#08833D]/40 rounded">
                      Coming Soon
                    </span>
                  </button>
                </motion.div>
              )}

              {/* Back */}
              {!pinValid && (
                <motion.button
                  variants={slideUp}
                  onClick={() => goTo('welcome')}
                  whileHover={{ x: -2 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.08]
                    flex items-center justify-center mx-auto
                    text-white/40 hover:text-white/80 hover:bg-white/[0.1] hover:border-white/15
                    transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* ═══ PHOTOS ═══ */}
        {step === 'photos' && (
          <motion.div
            key="photos"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 pt-14 flex flex-col z-10"
          >
            <div className="max-w-2xl mx-auto w-full px-4 py-4 flex flex-col flex-1 min-h-0">
              {/* Drop zone + camera — compact row */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2 flex-shrink-0"
              >
                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`flex-1 cursor-pointer rounded-2xl border-2 border-dashed
                    flex items-center gap-4 px-5 py-4 transition-all duration-300 ${
                      dragOver
                        ? 'border-blue-400 bg-blue-400/10 scale-[1.01]'
                        : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                    }`}
                >
                  <motion.div
                    animate={dragOver ? { scale: 1.15, rotate: 8 } : { scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                    className="w-10 h-10 rounded-xl bg-white/[0.07] border border-white/10
                      flex items-center justify-center flex-shrink-0"
                  >
                    <ImagePlus className="w-5 h-5 text-white/40" />
                  </motion.div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {dragOver ? 'Drop here' : 'Select photos'}
                    </p>
                    <p className="text-[11px] text-white/40 truncate">
                      Drag &amp; drop &bull; JPG, PNG &bull; 50 MB max
                    </p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    aria-label="Select photos to upload"
                    onChange={(e) => {
                      if (e.target.files) addPhotos(e.target.files)
                      e.target.value = ''
                    }}
                    className="hidden"
                  />
                </div>

                {/* Camera button — compact square */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*'
                    input.capture = 'environment'
                    input.onchange = (e) => {
                      const files = (e.target as HTMLInputElement).files
                      if (files) addPhotos(files)
                    }
                    input.click()
                  }}
                  className="w-[68px] rounded bg-white/[0.07] border border-white/10
                    flex flex-col items-center justify-center gap-1
                    hover:bg-white/[0.12] transition flex-shrink-0"
                >
                  <Camera className="w-5 h-5 text-white/60" />
                  <span className="text-[10px] text-white/40 font-medium">Camera</span>
                </motion.button>
              </motion.div>

              {/* Photo grid — scrollable area */}
              <div className="flex-1 min-h-0 mt-3 overflow-auto">
                <AnimatePresence>
                  {photos.length > 0 ? (
                    <motion.div
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                          {photos.length} photo{photos.length !== 1 ? 's' : ''} selected
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            photos.forEach((p) => URL.revokeObjectURL(p.preview))
                            setPhotos([])
                          }}
                          className="text-[11px] text-red-400/60 hover:text-red-300 transition font-medium"
                        >
                          Clear all
                        </button>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        <AnimatePresence>
                          {photos.map((photo, i) => (
                            <motion.div
                              key={photo.id}
                              layout
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{
                                delay: i * 0.03,
                                type: 'spring',
                                stiffness: 400,
                                damping: 22,
                              }}
                              className="relative aspect-square rounded-xl overflow-hidden group
                                shadow-md shadow-black/20 ring-1 ring-white/10"
                            >
                              <img
                                src={photo.preview}
                                alt={photo.file.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent
                                opacity-0 group-hover:opacity-100 transition-opacity" />
                              <motion.button
                                whileHover={{ scale: 1.15 }}
                                whileTap={{ scale: 0.85 }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removePhoto(photo.id)
                                }}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full
                                  bg-black/60 text-white flex items-center justify-center
                                  opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                              >
                                <X className="w-3 h-3" />
                              </motion.button>
                              <div className="absolute bottom-0 inset-x-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-[9px] text-white/90 truncate bg-black/40 backdrop-blur-sm rounded px-1 py-0.5">
                                  {photo.file.name}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="flex flex-col items-center justify-center h-full gap-3"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06]
                        flex items-center justify-center"
                      >
                        <Upload className="w-7 h-7 text-white/15" />
                      </div>
                      <p className="text-sm text-white/25">Select or capture photos above</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Sticky bottom bar — slides up when photos selected */}
              <AnimatePresence>
                {photos.length > 0 && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className="flex-shrink-0 pt-3 pb-1"
                  >
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ y: 0 }}
                      onClick={() => goTo('metadata')}
                      className="w-full py-3 rounded bg-white/90 backdrop-blur-sm text-[#062e61]
                        font-semibold text-sm border border-white/30
                        shadow-[0_0_15px_rgba(255,255,255,0.06)]
                        flex items-center justify-center gap-2 transition-all"
                    >
                      Continue with {photos.length} photo{photos.length !== 1 ? 's' : ''}
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ═══ METADATA ═══ */}
        {step === 'metadata' && (
          <motion.div
            key="metadata"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 pt-14 flex flex-col z-10"
          >
            <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col flex-1 min-h-0">
              {/* Photo strip */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-1.5 overflow-x-auto pb-2 snap-x scrollbar-none flex-shrink-0"
              >
                {photos.map((p) => (
                  <div
                    key={p.id}
                    className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden ring-2 ring-white/20 shadow-md snap-start"
                  >
                    <img
                      src={p.preview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </motion.div>

              <div className="flex-1 min-h-0 flex flex-col gap-3 pt-3">
                {/* Incident ID + Location row */}
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-semibold text-white/50">Incident ID</label>
                    <input
                      type="text"
                      value={incidentId}
                      onChange={(e) => setIncidentId(e.target.value)}
                      placeholder="e.g., HU-2024-001"
                      className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.08]
                        focus:border-white/25 focus:ring-2 focus:ring-white/10
                        outline-none transition-all text-white placeholder:text-white/30 text-sm"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-semibold text-white/50">Location</label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={getLocation}
                        disabled={locating}
                        className="flex items-center gap-1 px-2.5 py-2.5 rounded border border-white/10
                          bg-white/[0.08] hover:bg-white/[0.14] hover:border-white/20 transition-all text-xs font-medium text-white/70"
                      >
                        {locating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-300" />
                        ) : (
                          <Locate className="w-3.5 h-3.5 text-blue-300" />
                        )}
                        GPS
                      </button>
                      <div className="flex-1 flex gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={5}
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupZip() } }}
                          placeholder="ZIP"
                          className="w-[72px] px-2.5 py-2.5 rounded-lg border border-white/10 bg-white/[0.08]
                            focus:border-white/25 focus:ring-2 focus:ring-white/10
                            outline-none transition-all text-white placeholder:text-white/30 text-sm text-center"
                        />
                        {zipCode.length === 5 && (
                          <button
                            type="button"
                            onClick={lookupZip}
                            disabled={zipLooking}
                            className="px-2 py-2.5 rounded bg-white/[0.12] border border-white/15 text-white text-xs font-medium hover:bg-white/[0.18] transition-all"
                          >
                            {zipLooking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Go'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location result / error */}
                <AnimatePresence>
                  {gpsError && !location && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-amber-300 flex items-center gap-1.5"
                    >
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {gpsError}
                    </motion.p>
                  )}
                  {location && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg
                        bg-white/[0.08] border border-white/10
                        text-blue-200 text-xs font-mono"
                    >
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{locationName}</span>
                      <button
                        type="button"
                        title="Clear location"
                        onClick={() => { setLocation(null); setLocationName(''); setZipCode('') }}
                        className="ml-auto text-white/40 hover:text-white transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Notes */}
                <div className="flex-1 min-h-0 flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-white/50">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                    placeholder="Describe what's in the photos, context, conditions..."
                    className="flex-1 min-h-[60px] w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.08]
                      focus:border-white/25 focus:ring-2 focus:ring-white/10
                      outline-none transition-all resize-none text-white placeholder:text-white/30 text-sm"
                  />
                  <p className="text-[10px] text-white/30 text-right">{notes.length}/500</p>
                </div>
              </div>

              {/* Actions — always pinned at bottom */}
              <div className="flex gap-3 pt-3 pb-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => goTo('photos')}
                  className="flex-1 py-3 rounded border border-white/15 text-white/60
                    font-medium hover:bg-white/[0.08] hover:border-white/25 transition-all text-sm"
                >
                  &larr; Back
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  className="flex-[2] py-3 rounded bg-white/90 backdrop-blur-sm
                    text-[#062e61] font-semibold border border-white/30
                    shadow-[0_0_15px_rgba(255,255,255,0.06)]
                    flex items-center justify-center gap-2 transition-all
                    hover:bg-white hover:shadow-[0_0_25px_rgba(255,255,255,0.12)]"
                >
                  <Send className="w-4 h-4" />
                  Upload {photos.length} Photo{photos.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ UPLOADING ═══ */}
        {step === 'uploading' && (
          <motion.div
            key="uploading"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 flex flex-col items-center justify-center px-6 z-10"
          >
            <div className="text-center space-y-6">
              {/* ASPR logo */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ delay: 0.3 }}
              >
                <img src="/aspr-logo-white.png" alt="ASPR" className="h-12 lg:h-14 mx-auto drop-shadow-[0_0_20px_rgba(21,81,151,0.4)]" />
              </motion.div>

              {/* Progress ring */}
              <div className="relative w-32 h-32 lg:w-40 lg:h-40 mx-auto">
                <svg className="w-32 h-32 lg:w-40 lg:h-40 -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r={RING_R}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="6"
                  />
                  <motion.circle
                    cx="60"
                    cy="60"
                    r={RING_R}
                    fill="none"
                    stroke="url(#ring-grad)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRC}
                    initial={{ strokeDashoffset: RING_CIRC }}
                    animate={{
                      strokeDashoffset: RING_CIRC * (1 - uploadProgress / 100),
                    }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                  <defs>
                    <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    key={uploadProgress}
                    initial={{ scale: 1.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-3xl lg:text-4xl font-bold text-white"
                  >
                    {uploadProgress}%
                  </motion.span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-lg font-semibold text-white">
                  {uploadError
                    ? 'Upload Failed'
                    : uploadProgress === 100
                      ? 'Finishing up...'
                      : `Uploading ${uploadedCount} of ${lastBatchSize}`}
                </p>

                {/* Linear bar */}
                <div className="w-64 lg:w-72 mx-auto">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-blue-400 to-emerald-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.35 }}
                    />
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {uploadError && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 pt-2"
                    >
                      <p className="text-red-400 text-sm">{uploadError}</p>
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ y: 0 }}
                        onClick={handleUpload}
                        className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm text-[#062e61]
                          px-6 py-3 rounded font-semibold border border-white/30
                          shadow-[0_0_15px_rgba(255,255,255,0.06)] transition-all"
                      >
                        <RotateCcw className="w-4 h-4" /> Retry
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ SUCCESS ═══ */}
        {step === 'success' && (
          <motion.div
            key="success"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 flex flex-col items-center justify-center px-6 z-10"
          >
            {/* Celebration particles */}
            <SuccessParticles />

            <motion.div
              variants={stagger}
              initial="initial"
              animate="animate"
              className="text-center space-y-6 lg:space-y-8 relative z-10"
            >
              {/* ASPR logo */}
              <motion.div variants={slideUp}>
                <img src="/aspr-logo-white.png" alt="ASPR" className="h-12 lg:h-14 mx-auto opacity-60 drop-shadow-[0_0_20px_rgba(21,81,151,0.4)]" />
              </motion.div>

              {/* Success icon */}
              <motion.div
                variants={popIn}
                className="w-24 h-24 lg:w-28 lg:h-28 rounded-full bg-emerald-500/15 border border-emerald-400/20
                  flex items-center justify-center mx-auto backdrop-blur-sm"
              >
                <CheckCircle2 className="w-12 h-12 lg:w-16 lg:h-16 text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.4)]" />
              </motion.div>

              {/* Message */}
              <motion.div variants={slideUp} className="space-y-2">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-display text-white tracking-wide uppercase">Upload Complete</h2>
                <p className="text-blue-200/60 text-lg">
                  {lastBatchSize} photo{lastBatchSize !== 1 ? 's' : ''} uploaded successfully
                </p>
                <p className="text-sm text-blue-300/30">Team: {teamName}</p>
              </motion.div>

              {/* Actions */}
              <motion.div variants={slideUp} className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ y: 0 }}
                  onClick={resetForMore}
                  className="inline-flex items-center justify-center gap-2
                    bg-white/90 backdrop-blur-sm text-[#062e61] py-3 rounded
                    font-semibold text-sm border border-white/30
                    shadow-[0_0_15px_rgba(255,255,255,0.06)] transition-all"
                >
                  <Camera className="w-4 h-4" />
                  Upload More Photos
                </motion.button>
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ y: 0 }}
                  onClick={() => router.push('/gallery')}
                  className="inline-flex items-center justify-center gap-2
                    bg-white/[0.08] border border-white/15 text-white/80 py-3 rounded
                    font-medium text-sm backdrop-blur-sm hover:bg-white/[0.14] hover:border-white/25 transition-all"
                >
                  <ImageIcon className="w-4 h-4" />
                  View Gallery
                </motion.button>
                <button
                  type="button"
                  onClick={logout}
                  className="text-blue-300/40 hover:text-white transition text-sm py-2"
                >
                  Logout
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Bottom step dots (dark screens) ─── */}
      {isDark && step !== 'uploading' && (
        <div className="fixed bottom-6 inset-x-0 z-50 pointer-events-none">
          <StepDots current={step} />
        </div>
      )}

      {/* ─── Logo Preloader ─── */}
      <AnimatePresence>
        {showPreloader && (
          <motion.div
            key="preloader"
            className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-[#062e61]"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <img
              src="/aspr-logo-white.png"
              alt="ASPR"
              className="h-16 md:h-20 lg:h-24 drop-shadow-[0_0_40px_rgba(21,81,151,0.6)] animate-preloader-logo"
            />
            <p className="text-xs text-white/30 tracking-widest uppercase mt-6 animate-preloader-text">
              Photo Repository
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Success Celebration Particles ──────────────────── */
function SuccessParticles() {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  if (!ready) return null

  const colors = ['#34d399', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa', '#ffffff']

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 40 }, (_, i) => {
        const color = colors[i % colors.length]
        const size = 4 + (i * 3) % 8
        const startX = 40 + (i * 7) % 20
        const delay = (i * 0.05) % 2
        return (
          <motion.div
            key={i}
            initial={{
              x: `${startX}vw`,
              y: '50vh',
              scale: 0,
              opacity: 1,
            }}
            animate={{
              x: `${(i * 13) % 100}vw`,
              y: `${-20 + (i * 7) % 30}vh`,
              scale: [0, 1.5, 0.8],
              opacity: [1, 1, 0],
              rotate: (i % 2 === 0 ? 1 : -1) * 360,
            }}
            transition={{
              duration: 2 + (i * 0.05) % 1.5,
              delay,
              ease: 'easeOut',
            }}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: i % 3 === 0 ? '50%' : '2px',
              backgroundColor: color,
            }}
          />
        )
      })}
    </div>
  )
}
