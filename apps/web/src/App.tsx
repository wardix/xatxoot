import { useState } from 'react'

export function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 border border-slate-200 text-center">
        <h1 className="text-2xl font-bold text-emerald-600 mb-2">Xatxoot Web</h1>
        <p className="text-slate-600 mb-6">WhatsApp Customer Support Platform</p>
        <button
          type="button"
          onClick={() => setCount((prev) => prev + 1)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
        >
          Clicked {count} times
        </button>
      </div>
    </div>
  )
}

export default App
