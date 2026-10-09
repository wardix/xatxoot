import { AppShell } from './components/AppShell'

export function App() {
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Workspace Layanan Percakapan</h2>
        <p className="text-sm text-slate-600 mb-6">
          Platform Xatxoot Customer Support siap digunakan. Dashboard operasional tiket dan
          integrasi WhatsApp.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Fase 0: Fondasi & Auth Selesai
        </div>
      </div>
    </AppShell>
  )
}

export default App
