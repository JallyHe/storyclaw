// ─────────────────────────────────────────────────────────────────────────────
// 构建期加密：把 skills/ 与 agents/ 整树加密为 skills.enc/ 与 agents.enc/。
// 打包时只分发 .enc 产物（见 package.json extraResources），运行时再解密到临时目录。
//
// 运行：node electron/agent/encrypt-resources.mjs
// 由 package.json 的 predist 钩子在打包前自动执行。
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { encryptBuffer, ENC_EXT } from './resource-crypto.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 把 srcDir 整树加密到 dstDir（文件名追加 .enc，目录结构保留）。 */
function encryptTree(srcDir, dstDir) {
  fs.rmSync(dstDir, { recursive: true, force: true })
  let count = 0
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name)
    if (entry.isDirectory()) {
      count += encryptTree(src, path.join(dstDir, entry.name))
    } else if (entry.isFile()) {
      fs.mkdirSync(dstDir, { recursive: true })
      const enc = encryptBuffer(fs.readFileSync(src))
      fs.writeFileSync(path.join(dstDir, entry.name + ENC_EXT), enc)
      count++
    }
  }
  return count
}

const pairs = [
  ['skills', 'skills.enc'],
  ['agents', 'agents.enc'],
]

let total = 0
for (const [src, dst] of pairs) {
  const srcDir = path.join(__dirname, src)
  const dstDir = path.join(__dirname, dst)
  if (!fs.existsSync(srcDir)) {
    console.error(`!! 源目录不存在：${srcDir}`)
    process.exit(1)
  }
  const n = encryptTree(srcDir, dstDir)
  total += n
  console.log(`🔒 ${src} → ${dst}：加密 ${n} 个文件`)
}
console.log(`✅ 共加密 ${total} 个资源文件。agent-skills.json 保持明文（仅为映射，非提示词）。`)
