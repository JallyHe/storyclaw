import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('versioning initialization', () => {
  it('runs git init only once when called concurrently for the same root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'storyclaw-version-lock-'))
    tempDirs.push(root)

    const gitDir = await mkdtemp(path.join(tmpdir(), 'storyclaw-git-shim-'))
    tempDirs.push(gitDir)

    await writeFile(path.join(gitDir, 'git.cmd'), [
      '@echo off',
      'node "%~dp0fake-git.mjs" %*',
      'exit /b %ERRORLEVEL%'
    ].join('\r\n'), 'utf8')

    await writeFile(path.join(gitDir, 'fake-git.mjs'), fakeGitScript, 'utf8')

    const originalPath = process.env.PATH ?? ''
    process.env.PATH = `${gitDir};${originalPath}`

    try {
      const { ensureVersioning } = await import('../electron/versioning/service')
      await Promise.all([ensureVersioning(root), ensureVersioning(root)])

      const description = await readFile(path.join(root, '.git', 'description'), 'utf8')
      expect(description).toContain('Unnamed repository')
    } finally {
      process.env.PATH = originalPath
    }
  }, 15000)
})

const fakeGitScript = `
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const args = process.argv.slice(2)
const commandIndex = args[0] === '-c' ? 2 : 0
const command = args[commandIndex]
const cwd = process.cwd()

if (command === 'init') {
  await new Promise(resolve => setTimeout(resolve, 25))
  const gitDir = path.join(cwd, '.git')
  await mkdir(gitDir, { recursive: true })
  await writeFile(path.join(gitDir, 'description'), 'Unnamed repository; edit this file \"description\" to name the repository.\\n', { flag: 'wx' })
  await writeFile(path.join(gitDir, 'HEAD'), 'ref: refs/heads/storyclaw-main\\n')
  process.exit(0)
}

if (command === 'config' || command === 'status' || command === 'branch' || command === 'log' || command === 'rev-parse' || command === 'tag' || command === 'diff' || command === 'checkout') {
  process.exit(0)
}

process.exit(0)
`
