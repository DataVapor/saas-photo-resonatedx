'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/validate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Invalid PIN')
      }

      const { token, sessionId, teamName } = await res.json()

      // Store in session storage (cleared when tab closes)
      sessionStorage.setItem('ndms_token', token)
      sessionStorage.setItem('ndms_session_id', sessionId)
      sessionStorage.setItem('ndms_team', teamName)

      router.push('/upload')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-aspr-blue-dark to-aspr-blue-primary flex flex-col items-center justify-center p-4">
      {/* HHS Logo - Above Box */}
      <div className="mb-8">
        <a href="https://www.hhs.gov" target="_blank" rel="noopener noreferrer" title="HHS.gov">
          <img
            src="/hhs_longlogo_white.png"
            alt="HHS - U.S. Department of Health and Human Services"
            style={{ height: '100px', width: 'auto' }}
            className="drop-shadow-lg hover:opacity-80 transition"
          />
        </a>
      </div>

      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        {/* ASPR + NDMS Logos Inside Box */}
        <div className="flex items-center justify-center gap-8 mb-10 px-4">
          <a href="https://aspr.hhs.gov" target="_blank" rel="noopener noreferrer" title="ASPR.HHS.gov">
            <img
              src="/aspr-logo-blue.png"
              alt="ASPR - Administration for Strategic Preparedness and Response"
              style={{ height: '68px', width: 'auto' }}
              className="hover:opacity-80 transition"
            />
          </a>
          <a href="https://aspr.hhs.gov" target="_blank" rel="noopener noreferrer" title="NDMS">
            <img
              src="/ndms-logo.webp"
              alt="NDMS - National Disaster Medical System"
              style={{ height: '68px', width: 'auto' }}
              className="hover:opacity-80 transition"
            />
          </a>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-aspr-blue-dark mb-2">NDMS</h1>
          <p className="text-gray-600 text-lg">Photo Upload Portal</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* PIN Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="pin" className="block text-sm font-semibold text-gray-700 mb-3">
              Enter 6-Digit PIN
            </label>
            <input
              id="pin"
              type="number"
              inputMode="numeric"
              maxLength={6}
              min="0"
              max="999999"
              value={pin}
              onChange={(e) => {
                const value = e.target.value.slice(0, 6).replace(/[^0-9]/g, '')
                setPin(value)
              }}
              placeholder="000000"
              autoComplete="off"
              className="w-full px-4 py-4 text-3xl text-center tracking-[0.5em] border-2 border-gray-300 rounded-lg focus:border-aspr-blue-primary focus:ring-2 focus:ring-aspr-blue-light font-mono font-bold text-aspr-blue-dark placeholder-gray-400"
            />
          </div>

          <button
            type="submit"
            disabled={pin.length !== 6 || loading}
            className="w-full bg-gradient-to-r from-aspr-blue-primary to-aspr-blue-dark hover:from-aspr-blue-dark hover:to-aspr-blue-primary disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition duration-200 text-lg"
          >
            {loading ? 'Verifying...' : 'Continue'}
          </button>
        </form>

        {/* Instructions */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center leading-relaxed">
            Ask your incident commander for the 6-digit PIN to access the photo upload portal.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>National Disaster Medical System</p>
          <p>Administration for Strategic Preparedness and Response</p>
        </div>
      </div>
    </div>
  )
}
