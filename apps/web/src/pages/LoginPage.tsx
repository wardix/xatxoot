import { type LoginInput, LoginInputSchema } from '@xatxoot/shared'
import { useState } from 'react'

export interface LoginPageProps {
  onSuccess?: (data: unknown) => void
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [formData, setFormData] = useState<LoginInput>({
    email: '',
    password: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const parseResult = LoginInputSchema.safeParse(formData)
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
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseResult.data),
      })

      const data = await response.json()

      if (!response.ok) {
        setGlobalError(data.error || 'Email atau kata sandi tidak sesuai')
        setIsLoading(false)
        return
      }

      setIsLoading(false)
      if (onSuccess) {
        onSuccess(data)
      } else {
        // Redirect to dashboard
        window.location.href = '/'
      }
    } catch {
      setGlobalError('Terjadi kesalahan koneksi ke server API')
      setIsLoading(false)
    }
  }

  const handleGoogleSSO = () => {
    window.location.href = '/api/v1/auth/google'
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-600 p-6 sm:p-8 text-white text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/20 mb-3 backdrop-blur-sm font-bold text-xl">
            X
          </div>
          <h1 className="text-2xl font-bold">Masuk ke Xatxoot</h1>
          <p className="text-emerald-100 text-sm mt-1">
            Platform Layanan Pelanggan & WhatsApp Customer Support
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-5">
          {globalError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
              {globalError}
            </div>
          )}

          {/* Tombol Google OAuth SSO */}
          <button
            type="button"
            onClick={handleGoogleSSO}
            className="w-full py-3 px-4 border border-slate-300 hover:bg-slate-50 font-medium rounded-xl transition-all shadow-sm flex items-center justify-center gap-3 text-slate-700 text-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Masuk dengan Google (SSO)</span>
          </button>

          <div className="flex items-center gap-3 my-4">
            <hr className="flex-1 border-slate-200" />
            <span className="text-xs text-slate-400 font-medium">atau gunakan email</span>
            <hr className="flex-1 border-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Alamat Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="nama@instansi.go.id"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-3.5 py-2.5 rounded-xl border ${
                  errors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm`}
              />
              {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Kata Sandi
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className={`w-full px-3.5 py-2.5 rounded-xl border ${
                  errors.password ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm`}
              />
              {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center text-sm"
            >
              {isLoading ? 'Memproses Masuk...' : 'Masuk ke Dashboard'}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="text-center pt-2">
            <p className="text-xs text-slate-500">
              Instansi belum dikonfigurasi?{' '}
              <a href="/setup" className="font-semibold text-emerald-600 hover:text-emerald-700">
                Inisialisasi sekarang
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
