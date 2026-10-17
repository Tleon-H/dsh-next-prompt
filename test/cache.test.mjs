/**
 * 提示词磁盘缓存测试：上限，以及 DSH 热更新时新旧两个实例共用一个文件。
 * 每个用例写在系统临时目录里，不碰真实的 DSH 主目录。
 *
 * 运行：node test/cache.test.mjs
 */

import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createSuggestionCache } from '../lib/cache.js'

let failures = 0
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${label}`)
    return
  }
  failures += 1
  console.log(`  FAIL ${label}${detail === '' ? '' : ` — ${detail}`}`)
}

const root = await mkdtemp(join(tmpdir(), 'dsh-next-prompt-cache-'))
let caseNo = 0
/** 每个用例一个独立目录，缓存文件放在还不存在的子目录里，顺便覆盖 mkdir。 */
function freshFile() {
  caseNo += 1
  return join(root, String(caseNo), 'plugin-data', 'suggestions.json')
}
function collectingLogger() {
  const warnings = []
  return { warnings, logger: { warn: (message) => warnings.push(message) } }
}

try {
  console.log('上限')
  {
    const file = freshFile()
    const cache = createSuggestionCache({ file, maxEntries: 2 })
    for (const id of ['a', 'b', 'c']) cache.set(id, { candidate: id, fingerprint: id })
    await cache.flush()
    const reopened = createSuggestionCache({ file, maxEntries: 2 })
    check('超出上限丢掉最久的', reopened.get('a') === undefined && reopened.get('c')?.candidate === 'c', String(reopened.size))
  }

  console.log('\n热更新：新旧实例共用一个文件')
  {
    // DSH 热更新插件时先卸载旧实例、再加载新实例，两者在同一个进程里。
    // 旧实例最后一批写盘可能还没完成，新实例就已经开始写。
    const file = freshFile()
    const { warnings, logger } = collectingLogger()
    const previous = createSuggestionCache({ file, logger })
    const next = createSuggestionCache({ file, logger })
    for (let i = 0; i < 20; i += 1) {
      previous.set(`old${i}`, { candidate: `旧${i}`, fingerprint: `f${i}` })
      next.set(`new${i}`, { candidate: `新${i}`, fingerprint: `f${i}` })
    }
    await Promise.all([previous.flush(), next.flush()])
    check('同时写盘不报错', warnings.length === 0, warnings.join(' | '))
    let parsed
    try {
      parsed = JSON.parse(await readFile(file, 'utf8'))
    } catch (error) {
      parsed = undefined
      check('文件是完整的 JSON', false, String(error?.message ?? error))
    }
    if (parsed !== undefined) check('文件是完整的 JSON', parsed.format === 1 && typeof parsed.sessions === 'object')
    const leftovers = (await readdir(join(file, '..'))).filter((name) => name.endsWith('.tmp'))
    check('不留下临时文件', leftovers.length === 0, leftovers.join(', '))
  }

  console.log('\n热更新：等旧实例写完再读')
  {
    const file = freshFile()
    const previous = createSuggestionCache({ file })
    previous.set('s1', { candidate: '旧实例最后写的', fingerprint: 'f1' })
    // 宿主半卸载时把 flush() 的 promise 交给 DSH，DSH 等它完成后才加载新实例。
    await previous.flush()
    const next = createSuggestionCache({ file })
    check('新实例读到旧实例最后一次写入', next.get('s1')?.candidate === '旧实例最后写的')
  }
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exitCode = failures === 0 ? 0 : 1
