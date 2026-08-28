import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Corrige a regra de recorrência sem precisar alterar o arquivo principal:
// a próxima dose nasce do HORÁRIO REAL DE CONFIRMAÇÃO (event.at),
// e não do horário originalmente previsto (scheduledAt).
function confirmationTimeScheduleFix(): Plugin {
  return {
    name: 'confirmation-time-schedule-fix',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/App.tsx')) return null

      const pattern = /function lastConfirmed\(m:Med,events:Event\[\]\)\{[\s\S]*?\}(?=\n?\/\/ A dose only advances)/
      const replacement = `function lastConfirmed(m:Med,events:Event[]){const xs=events.filter(e=>e.medId===m.id&&e.at&&Number.isFinite(Date.parse(e.at))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));return xs.length?Date.parse(xs[xs.length-1].at):null}`

      if (!pattern.test(code)) {
        this.warn('Regra de horário de confirmação não encontrada em App.tsx; nenhuma transformação aplicada.')
        return null
      }

      return { code: code.replace(pattern, replacement), map: null }
    },
  }
}

export default defineConfig({
  plugins: [confirmationTimeScheduleFix(), react()],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
})
