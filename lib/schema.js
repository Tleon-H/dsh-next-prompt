/**
 * dsh-next-prompt —— 设置页表单用的 Config schema（仅宿主半使用）
 *
 * DSH 的「插件」页只为插件导出的 Schemastery `Config` 里标了 `.volatile()` 的字段
 * 生成表单，改完不用重装、不用重启就生效。因此这里每个字段都是 volatile，
 * 插件收到的是带 `.get()` 的引用，读取时机见 core.js 的 liveConfig。
 *
 * 每个字段都带 `.loose()`：类型不对时退回默认值，而不是让整个插件加载失败，
 * 与没有 schema 时 resolveConfig 的宽松处理保持一致。
 *
 * Schemastery 由 DSH 宿主提供（peerDependencies），这里不直接 import，
 * 而是由调用方传进来，方便在没有它的旧版 DSH 上退回到「只读 cordis.patch.yml」。
 *
 * @module dsh-next-prompt/schema
 */

import { DEFAULT_CONFIG } from './core.js'

/**
 * 用宿主的 Schemastery 构造插件的 Config schema。
 *
 * @param Schema - `@deepseek-ai/schemastery` 的默认导出。
 * @returns 插件的 Config schema。
 */
export function buildConfigSchema(Schema) {
  const field = (schema, description) => schema.description(description).loose().volatile()
  const d = DEFAULT_CONFIG
  return Schema.object({
    enabled: field(Schema.boolean().default(d.enabled), '总开关。关闭后不再请求模型，也不再显示灰字。'),
    provider: field(Schema.string().default(d.provider), '固定用来生成提示词的提供方，例如 deepseek。和「模型」都填才生效，留空则跟随当前会话。'),
    model: field(Schema.string().default(d.model), '固定用来生成提示词的模型，例如 deepseek-flash。建议选响应快、不带思考的模型。'),
    timeoutMs: field(Schema.number().default(d.timeoutMs), '单次生成的超时时间（毫秒）。'),
    maxRecentTurns: field(Schema.number().default(d.maxRecentTurns), '发给模型的最近消息条数（用户、助手各算一条）。'),
    maxContextChars: field(Schema.number().default(d.maxContextChars), '发给模型的最近对话的总字符数上限。'),
    maxOutputTokens: field(Schema.number().default(d.maxOutputTokens), '单次生成的最大输出 token 数。'),
    maxCandidateChars: field(Schema.number().default(d.maxCandidateChars), '单条提示词的字符上限，超出会被截断。'),
    persistSuggestions: field(Schema.boolean().default(d.persistSuggestions), '把每个会话最近一条灰字存到 DSH 主目录，重开 DSH 后还原。关掉则只保留在内存里。'),
    useFallback: field(Schema.boolean().default(d.useFallback), '生成失败时改用下面的兜底提示词。'),
    fallbackPrompts: field(Schema.array(Schema.string()).default([...d.fallbackPrompts]), '打开兜底时依次轮换使用的提示词。'),
  })
}
