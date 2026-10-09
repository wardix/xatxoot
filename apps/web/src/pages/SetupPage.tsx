import { type OrganizationSetupInput, OrganizationSetupInputSchema } from '@xatxoot/shared'
import { useState } from 'react'

export interface SetupPageProps {
  onSuccess?: (data: unknown) => void
}

export function SetupPage({ onSuccess }: SetupPageProps) {
  const [formData, setFormData] = useState<OrganizationSetupInput>({
    organizationName: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    timezone: 'Asia/Jakarta',
    defaultLocale: 'id',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGlobalError(null)

    const parseResult = OrganizationSetupInputSchema.safeParse(formData)
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parseResult.error.issues) {
        const fieldName = issue.path[0] as string
        if (fieldName && !fieldErrors[fieldName]) {
          fieldErrors[fieldName] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/v1/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseResult.data),
      })

      const data = await response.json()

      if (!response.ok) {
        setGlobalError(data.error || 'Gagal melakukan inisialisasi organisasi')
        setIsLoading(false)
        return
      }

      setIsSuccess(true)
      setIsLoading(false)
      if (onSuccess) {
        onSuccess(data)
      }
    } catch {
      setGlobalError('Terjadi kesalahan koneksi ke server API')
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200 text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            ✓
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Instansi Siap Digunakan!</h2>
          <p className="text-slate-600 mb-6">
            Organisasi{' '}
            <span className="font-semibold text-slate-800">{formData.organizationName}</span> dan
            akun administrator pertama telah berhasil dikonfigurasi.
          </p>
          <a
            href="/login"
            className="inline-block w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors shadow-sm"
          >
            Masuk ke Dashboard
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-600 p-6 sm:p-8 text-white text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/20 mb-3 backdrop-blur-sm font-bold text-xl">
            X
          </div>
          <h1 className="text-2xl font-bold">Inisialisasi Instansi Xatxoot</h1>
          <p className="text-emerald-100 text-sm mt-1">
            Konfigurasi profil instansi dan akun administrator pertama
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {globalError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
              {globalError}
            </div>
          )}

          {/* Profil Organisasi */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Profil Instansi (Singleton)
            </h2>
            <div>
              <label
                htmlFor="organizationName"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Nama Organisasi / Perusahaan
              </label>
              <input
                id="organizationName"
                name="organizationName"
                type="text"
                placeholder="Contoh: Layanan Publik Terpadu"
                value={formData.organizationName}
                onChange={handleChange}
                className={`w-full px-3.5 py-2.5 rounded-xl border ${
                  errors.organizationName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm`}
              />
              {errors.organizationName && (
                <p className="mt-1 text-xs text-rose-600">{errors.organizationName}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="timezone" className="block text-sm font-medium text-slate-700 mb-1">
                  Zona Waktu
                </label>
                <select
                  id="timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm bg-white"
                >
                  <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                  <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                  <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="defaultLocale"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Bahasa Default
                </label>
                <select
                  id="defaultLocale"
                  name="defaultLocale"
                  value={formData.defaultLocale}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm bg-white"
                >
                  <option value="id">Bahasa Indonesia (id)</option>
                  <option value="en">English (en)</option>
                </select>
              </div>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Akun Administrator Pertama */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              2. Akun Administrator Pertama (Owner)
            </h2>
            <div>
              <label htmlFor="adminName" className="block text-sm font-medium text-slate-700 mb-1">
                Nama Lengkap Administrator
              </label>
              <input
                id="adminName"
                name="adminName"
                type="text"
                placeholder="Contoh: Budi Santoso"
                value={formData.adminName}
                onChange={handleChange}
                className={`w-full px-3.5 py-2.5 rounded-xl border ${
                  errors.adminName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm`}
              />
              {errors.adminName && <p className="mt-1 text-xs text-rose-600">{errors.adminName}</p>}
            </div>

            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium text-slate-700 mb-1">
                Alamat Email Administrator
              </label>
              <input
                id="adminEmail"
                name="adminEmail"
                type="email"
                placeholder="admin@instansi.go.id"
                value={formData.adminEmail}
                onChange={handleChange}
                className={`w-full px-3.5 py-2.5 rounded-xl border ${
                  errors.adminEmail ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm`}
              />
              {errors.adminEmail && (
                <p className="mt-1 text-xs text-rose-600">{errors.adminEmail}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="adminPassword"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Kata Sandi Administrator
              </label>
              <input
                id="adminPassword"
                name="adminPassword"
                type="password"
                placeholder="Minimal 8 karakter"
                value={formData.adminPassword}
                onChange={handleChange}
                className={`w-full px-3.5 py-2.5 rounded-xl border ${
                  errors.adminPassword ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm`}
              />
              {errors.adminPassword && (
                <p className="mt-1 text-xs text-rose-600">{errors.adminPassword}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center text-sm"
          >
            {isLoading ? 'Menginisialisasi Instansi...' : 'Selesaikan Setup & Mulai Menggunakan'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SetupPage
