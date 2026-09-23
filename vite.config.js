import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// La version vive en package.json y se inyecta al bundle en build. Asi la
// pantalla de carga muestra siempre la version realmente desplegada, sin
// tener que acordarse de tocar dos archivos a mano.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
})
