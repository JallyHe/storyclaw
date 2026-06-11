// ─────────────────────────────────────────────────────────────────────────────
// 内置提示词资源（skills / agents 的 .md）加解密 — 构建脚本与主进程共用。
//
// ⚠️ 安全说明：这是「混淆」而非密码学意义的保密。解密密钥随应用一起分发，
// 铁了心的逆向者可从打包产物中提取密钥再解密。目标只是让普通用户无法在安装
// 目录里直接打开阅读提示词，把门槛抬高到「逆向整个 Electron 应用」。
//
// 算法：AES-256-GCM。单文件密文布局：[iv(12)][authTag(16)][ciphertext]。
// ─────────────────────────────────────────────────────────────────────────────
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const IV_LEN = 12
const TAG_LEN = 16

// 密钥口令以碎片拼装，避免在二进制里留下完整可读字符串（仅为提高翻找门槛）。
const FRAGMENTS = ['sc', 'rip', 't-cl', 'aw', '::res', '-v1', '::', '7f3a9d', 'e2c184b6']
const SALT = Buffer.from('storyclaw.resource.salt.20260611', 'utf8')

let cachedKey = null
function deriveKey() {
  if (cachedKey) return cachedKey
  const passphrase = FRAGMENTS.join('')
  cachedKey = scryptSync(passphrase, SALT, 32)
  return cachedKey
}

/** 加密明文 Buffer/字符串 → 密文 Buffer。 */
export function encryptBuffer(plain) {
  const data = Buffer.isBuffer(plain) ? plain : Buffer.from(plain, 'utf8')
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(), iv)
  const ct = Buffer.concat([cipher.update(data), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct])
}

/** 解密密文 Buffer → 明文 Buffer。 */
export function decryptBuffer(enc) {
  const iv = enc.subarray(0, IV_LEN)
  const tag = enc.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ct = enc.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()])
}

/** 加密产物文件后缀。 */
export const ENC_EXT = '.enc'
