import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // @gamenest/shared-types builds to CommonJS (see packages/shared-types) so
  // apps/api and apps/agent can `require()` it. Vite's dev server serves
  // linked workspace packages as native ESM by default and won't run CJS
  // interop on them unless they're pulled into dependency pre-bundling —
  // without this, named imports like `ServerStatus` fail at runtime in dev
  // (though production `vite build` works fine, since that always goes
  // through esbuild/rollup).
  optimizeDeps: {
    include: ['@gamenest/shared-types'],
  },
})
