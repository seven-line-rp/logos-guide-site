import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import localizeJsx from './scripts/localize-jsx.js'
import { transformAsync } from '@babel/core'
import { buildKnowledge } from './src/ai-knowledge.js'
import { BELLS, LUNCH } from './src/schedule.js'
import { SITE_VERSION, SITE_VERSION_LABEL } from './src/version.js'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// Офлайн-режим: после сборки пишем dist/sw.js со списком всех файлов сайта
// (шаблон — scripts/sw-template.js). Серверные скрипты, звук и служебные
// файлы хостинга в кэш не кладём.
const OFFLINE_SKIP = /^(api\/|voice\/|team\/|assets\/KaTeX_|\.htaccess$|404\.html$|sw\.js$)|\.map$/
function offlineServiceWorker() {
  let outDir = 'dist'
  return {
    name: 'logos-offline-sw',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    writeBundle() {
      const walk = (dir) => readdirSync(dir).flatMap((name) => { const path = join(dir, name); return statSync(path).isDirectory() ? walk(path) : [path] })
      const files = walk(outDir).map((path) => relative(outDir, path).split(sep).join('/')).filter((path) => !OFFLINE_SKIP.test(path)).sort()
      const hash = createHash('sha1')
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)))
      const template = readFileSync('scripts/sw-template.js', 'utf8')
      const code = template.replace("'__VERSION__'", `'${hash.digest('hex').slice(0, 12)}'`).replace('= __PRECACHE__', '= ' + JSON.stringify(files.map((file) => `/${file}`)))
      writeFileSync(join(outDir, 'sw.js'), code)
    },
  }
}

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
  }, {
    // База знаний ИИ-агента рядом с public/api/ai-chat.php (см. deploy/ai-agent.md).
    name: 'logos-ai-knowledge',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'api/ai-knowledge.txt', source: buildKnowledge() })
    },
  }, {
    // Звонки и версия для рассылки уведомлений по крону (public/api/push.php, deploy/push.md).
    name: 'logos-push-meta',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'api/push-meta.json', source: JSON.stringify({ bells: BELLS, lunch: LUNCH, version: SITE_VERSION, versionLabel: SITE_VERSION_LABEL }) })
    },
  }, offlineServiceWorker(), react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    // Чат в режиме разработки: npm run build && php -S localhost:8787 -t dist
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
})
