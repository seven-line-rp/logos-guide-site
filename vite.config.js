import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import localizeJsx from './scripts/localize-jsx.js'
import { transformAsync } from '@babel/core'

export default defineConfig({
  plugins: [{
    name: 'logos-localize-jsx',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.split('?')[0].endsWith('.jsx') || id.includes('node_modules')) return
      return transformAsync(code, {
        filename: id.split('?')[0], configFile: false, babelrc: false,
        parserOpts: { plugins: ['jsx'] }, plugins: [localizeJsx], sourceMaps: true,
      })
    },
  }, react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
