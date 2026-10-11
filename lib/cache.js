/**
 * dsh-next-prompt —— 提示词的磁盘缓存（仅宿主半使用）
 *
 * 浏览器半和宿主半的状态都只在内存里，关掉 DSH 就没了。这里把每个会话最近
 * 一条生成成功的提示词存成一个 JSON 文件，重开 DSH、切回会话时，只要这之后
 * 没有新的对话（见 core.js 的 historyFingerprint），就把它还给浏览器半。
 *
 * 文件很小（每个会话一条、有上限），所以整体读、整体写：写临时文件再 rename，
 * 中途崩溃也不会留下半个文件。读写失败一律只记日志，不影响生成本身。
 *
 * @module dsh-next-prompt/cache
 */

import { mkdir, rename, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** 文件格式版本；不认识的版本当成空缓存。 */
const FORMAT = 1

/** 最多为多少个会话保留提示词；超出时丢掉最久的。 */
export const MAX_CACHED_SESSIONS = 200

/**
 * DSH 的用户数据目录。
 *
 * 优先用 DSH 启动时解析好的 `profileContext.home`；取不到时按 DSH 自己的规则
 * （`@deepseek-ai/dsh-home-paths` 的 resolveDshHome）退回 `$DSH_HOME` 或 `~/.dsh`。
 *
 * @param profileContext - `ctx.get('profileContext')`，可能为 undefined。
 */
export function dshHome(profileContext) {
  if (typeof profileContext?.home === 'string' && profileContext.home !== '') return profileContext.home
  const env = process.env.DSH_HOME
  if (typeof env === 'string' && env.trim() !== '') return env
  return join(homedir(), '.dsh')
}

/** 缓存文件的位置：`<DSH 主目录>/plugin-data/dsh-next-prompt/suggestions.json`。 */
export function cacheFile(profileContext) {
  return join(dshHome(profileContext), 'plugin-data', 'dsh-next-prompt', 'suggestions.json')
}

/**
 * 建立一个缓存。
 *
 * @param options.file - 缓存文件路径。
 * @param options.logger - 可选，写失败原因。
 * @param options.maxEntries - 最多保留的会话数。
 */
export function createSuggestionCache({ file, logger, maxEntries = MAX_CACHED_SESSIONS }) {
  /** sessionId → { candidate, fingerprint, turn?, savedAt }，按写入先后排序。 */
  let entries
  /** 写盘串行化：同一时间只有一次写，后来的写总是写最新状态。 */
  let writing = Promise.resolve()
  let dirty = false

  function load() {
    if (entries !== undefined) return entries
    entries = new Map()
    let parsed
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'))
    } catch (error) {
      if (error?.code !== 'ENOENT') logger?.warn?.(`dsh-next-prompt: 读取提示词缓存失败，按空缓存处理：${String(error?.message ?? error)}`)
      return entries
    }
    if (parsed?.format !== FORMAT || !parsed.sessions || typeof parsed.sessions !== 'object') return entries
    const valid = Object.entries(parsed.sessions)
      .filter(([, entry]) => typeof entry?.candidate === 'string' && entry.candidate !== ''
        && typeof entry.fingerprint === 'string' && entry.fingerprint !== '')
      .sort((a, b) => (Number(a[1].savedAt) || 0) - (Number(b[1].savedAt) || 0))
    for (const [sessionId, entry] of valid.slice(-maxEntries)) entries.set(sessionId, entry)
    return entries
  }

  function persist() {
    dirty = true
    writing = writing.then(async () => {
      if (!dirty) return
      dirty = false
      const body = JSON.stringify({ format: FORMAT, sessions: Object.fromEntries(load()) })
      const temp = `${file}.${process.pid}.tmp`
      try {
        await mkdir(dirname(file), { recursive: true, mode: 0o700 })
        await writeFile(temp, body, { mode: 0o600 })
        await rename(temp, file)
      } catch (error) {
        logger?.warn?.(`dsh-next-prompt: 写入提示词缓存失败：${String(error?.message ?? error)}`)
      }
    })
    return writing
  }

  return {
    file,
    get size() { return load().size },
    /** 取一个会话的缓存。 */
    get(sessionId) {
      return load().get(sessionId)
    },
    /** 存一个会话的提示词（覆盖旧的）。 */
    set(sessionId, { candidate, fingerprint, turn }) {
      if (typeof candidate !== 'string' || candidate === '' || typeof fingerprint !== 'string' || fingerprint === '') return
      const map = load()
      map.delete(sessionId)
      map.set(sessionId, { candidate, fingerprint, ...(Number.isInteger(turn) ? { turn } : {}), savedAt: Date.now() })
      while (map.size > maxEntries) map.delete(map.keys().next().value)
      persist()
    },
    /** 删掉一个会话的缓存；本来就没有时不写盘。 */
    delete(sessionId) {
      if (load().delete(sessionId)) persist()
    },
    /** 等所有写盘完成（卸载时与测试用）。 */
    flush() {
      return writing
    },
  }
}
