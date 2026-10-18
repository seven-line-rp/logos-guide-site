import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SITE_VERSION } from './version.js'

test('the site version matches package.json and the changelog', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(SITE_VERSION, pkg.version)
  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
  assert.match(changelog, new RegExp(`^## ${SITE_VERSION.replaceAll('.', '\\.')}`, 'm'))
})
