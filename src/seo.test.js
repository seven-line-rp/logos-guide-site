import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PAGES, pageHtml } from './seo.js'

// Страницы для поисковиков и превью ссылок (dist/_pages, см. vite.config.js).

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8')
const indexHtml = read('../index.html')

test('each page copy carries its own title, description, canonical and og tags', () => {
  const html = pageHtml(indexHtml, '/map')
  assert.match(html, /<title>Карта этажей \| ЛОГОС:Путеводитель<\/title>/)
  assert.match(html, /<link rel="canonical" href="https:\/\/logos-guide\.ru\/map" \/>/)
  assert.match(html, /<meta property="og:url" content="https:\/\/logos-guide\.ru\/map" \/>/)
  assert.match(html, /<meta property="og:title" content="Карта этажей \| ЛОГОС:Путеводитель" \/>/)
  assert.ok(html.includes(`<meta name="description" content="${PAGES['/map'].description}" />`))
  assert.ok(html.includes('<meta property="og:image" content="https://logos-guide.ru/og-image.jpg" />'), 'картинка превью остаётся')
  assert.ok(html.includes('<div id="root"></div>'), 'приложение то же самое')
})

test('the build fails loudly when index.html loses a tag it rewrites', () => {
  assert.throws(() => pageHtml(indexHtml.replace(/<meta property="og:url"[^>]*>/, ''), '/map'), /og:url/)
})

test('page descriptions are readable in search results', () => {
  for (const [path, page] of Object.entries(PAGES)) {
    assert.ok(page.description.length >= 50 && page.description.length <= 200, `${path}: ${page.description.length} символов`)
    assert.ok(!/[<>"]/.test(page.description), `${path}: без кавычек и угловых скобок`)
  }
})

test('the sitemap lists exactly the public pages', () => {
  const inSitemap = [...read('../public/sitemap.xml').matchAll(/<loc>https:\/\/logos-guide\.ru([^<]*)<\/loc>/g)].map((match) => match[1] || '/').sort()
  assert.deepEqual(inSitemap, Object.keys(PAGES).sort())
})

test('the host serves the page copy for a section address', () => {
  const htaccess = read('../public/.htaccess')
  assert.match(htaccess, /RewriteCond %\{DOCUMENT_ROOT\}\/_pages\/\$1\.html -f\n\s*RewriteRule \^\(\[a-z-\]\+\)\$ _pages\/\$1\.html \[L\]/)
  assert.ok(htaccess.indexOf('R=301') < htaccess.indexOf('_pages/$1.html [L]'), 'сначала переадресация на основной домен')
  assert.match(read('../deploy/nginx-spa.conf'), /try_files \$uri \/_pages\$uri\.html \/index\.html;/)
  assert.match(read('../public/robots.txt'), /Disallow: \/_pages\//)
})
