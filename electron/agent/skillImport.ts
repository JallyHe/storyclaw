import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

import { getWorkspaceSkillsDir, parseFrontmatterField } from './skills'

export interface ImportedSkill {
  name: string
  title: string
  description: string
  targetDir: string
}

function sanitizeSkillName(name: string): string {
  const trimmed = name.trim()
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(trimmed)) {
    throw new Error('技能名称只能包含字母、数字、点、下划线或连字符')
  }
  if (trimmed === '.' || trimmed === '..' || trimmed.includes('..')) {
    throw new Error('技能名称不合法')
  }
  return trimmed
}

async function findSkillRoot(sourcePath: string): Promise<string> {
  const stat = await fs.stat(sourcePath)
  if (!stat.isDirectory()) throw new Error('请选择包含 SKILL.md 的文件夹或 .zip 技能包')

  const direct = path.join(sourcePath, 'SKILL.md')
  try {
    await fs.access(direct)
    return sourcePath
  } catch {
    // Common zip layout: package-name/SKILL.md
  }

  const entries = await fs.readdir(sourcePath, { withFileTypes: true })
  const childSkillRoots: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const child = path.join(sourcePath, entry.name)
    try {
      await fs.access(path.join(child, 'SKILL.md'))
      childSkillRoots.push(child)
    } catch {
      // Ignore non-skill directories.
    }
  }
  if (childSkillRoots.length === 1) return childSkillRoots[0]
  throw new Error('技能包需要包含 SKILL.md 文件')
}

async function extractZip(sourcePath: string): Promise<string> {
  const extract = (await import('extract-zip')).default
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storyclaw-skill-'))
  await extract(sourcePath, { dir: tempDir })
  return tempDir
}

export async function installSkillPackage(workspaceRoot: string, sourcePath: string): Promise<ImportedSkill> {
  const isZip = sourcePath.toLowerCase().endsWith('.zip')
  const extractedDir = isZip ? await extractZip(sourcePath) : null
  const searchRoot = extractedDir ?? sourcePath

  try {
    const skillRoot = await findSkillRoot(searchRoot)
    const skillMdPath = path.join(skillRoot, 'SKILL.md')
    const md = await fs.readFile(skillMdPath, 'utf8')
    const name = sanitizeSkillName(parseFrontmatterField(md, 'name') || path.basename(skillRoot))
    const title = parseFrontmatterField(md, 'title') || name
    const description = parseFrontmatterField(md, 'description')
    if (!description) throw new Error('SKILL.md 需要包含 description 字段')

    const skillsDir = getWorkspaceSkillsDir(workspaceRoot)
    const targetDir = path.join(skillsDir, name)
    const resolvedSkillsDir = path.resolve(skillsDir)
    const resolvedTargetDir = path.resolve(targetDir)
    if (!resolvedTargetDir.startsWith(resolvedSkillsDir + path.sep)) {
      throw new Error('技能安装路径不合法')
    }

    await fs.mkdir(skillsDir, { recursive: true })
    await fs.rm(targetDir, { recursive: true, force: true })
    await fs.cp(skillRoot, targetDir, { recursive: true })

    return { name, title, description, targetDir }
  } finally {
    if (extractedDir) await fs.rm(extractedDir, { recursive: true, force: true }).catch(() => {})
  }
}
