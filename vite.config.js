import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import localizeJsx from './scripts/localize-jsx.js'
import { transformAsync } from '@babel/core'
import { createAssistantApiMiddleware } from './server/assistant-api.mjs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const assistantApi = createAssistantApiMiddleware({
    apiKey: env.DEEPSEEK_API_KEY,
    trustProxy: env.TRUST_PROXY === 'true',
  })

  return {
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
    }, {
      name: 'logos-assistant-api',
      configureServer(server) {
        server.middlewares.use(assistantApi)
      },
    }, react()],
    server: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
  }
})
