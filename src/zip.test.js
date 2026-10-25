import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32, makeZip } from './zip.js'

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926)
})

test('zip archive is readable by unzip, with Cyrillic names and intact content', { skip: spawnSync('unzip', ['-v']).status !== 0 && 'unzip не установлен' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'zip-test-'))
  try {
    const files = [{ name: '1-этаж_Библиотека №214.svg', data: '<svg>привет</svg>' }, { name: 'b.svg', data: new Uint8Array([1, 2, 3]) }]
    writeFileSync(join(dir, 'a.zip'), makeZip(files))
    assert.equal(spawnSync('unzip', ['-tq', join(dir, 'a.zip')]).status, 0)
    spawnSync('unzip', ['-qq', '-O', 'UTF-8', join(dir, 'a.zip'), '-d', join(dir, 'out')])
    assert.equal(readFileSync(join(dir, 'out', '1-этаж_Библиотека №214.svg'), 'utf8'), '<svg>привет</svg>')
    assert.deepEqual([...readFileSync(join(dir, 'out', 'b.svg'))], [1, 2, 3])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
