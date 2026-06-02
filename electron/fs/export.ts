import fs from 'node:fs/promises'
import path from 'node:path'
import { BrowserWindow, dialog } from 'electron'
import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx'
import type { EpFile } from '../../src/types'
import { exportScreenplayAsFountain, exportScreenplayAsTxt, screenplayToHtml, splitDialogueLine } from '../../src/editors/screenplay/markup'
import { readStoryFile } from './workspace'

type ExportFormat = 'pdf' | 'docx' | 'fountain' | 'txt'

const EXPORT_FILTERS = [
  { name: 'PDF 文档', extensions: ['pdf'] },
  { name: 'Word 文档', extensions: ['docx'] },
  { name: 'Fountain 剧本', extensions: ['fountain'] },
  { name: '纯文本', extensions: ['txt'] }
]

export async function exportScreenplayFile(sourcePath: string, parentWindow: BrowserWindow | null): Promise<string | null> {
  const ext = path.extname(sourcePath).toLowerCase()
  if (ext !== '.ep') throw new Error('当前仅支持导出剧本文件（.ep）')

  const screenplay = await readStoryFile(sourcePath) as EpFile
  const baseName = path.basename(sourcePath, '.ep')
  const options = {
    title: '导出剧本',
    defaultPath: path.join(path.dirname(sourcePath), `${baseName}.pdf`),
    filters: EXPORT_FILTERS
  }
  const choice = parentWindow
    ? await dialog.showSaveDialog(parentWindow, options)
    : await dialog.showSaveDialog(options)
  if (choice.canceled || !choice.filePath) return null

  const format = inferFormat(choice.filePath)
  if (format === 'pdf') {
    await exportPdf(screenplay, choice.filePath)
  } else if (format === 'docx') {
    await exportDocx(screenplay, choice.filePath)
  } else if (format === 'fountain') {
    await fs.writeFile(choice.filePath, exportScreenplayAsFountain(screenplay), 'utf-8')
  } else {
    await fs.writeFile(choice.filePath, exportScreenplayAsTxt(screenplay), 'utf-8')
  }

  return choice.filePath
}

function inferFormat(filePath: string): ExportFormat {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.docx') return 'docx'
  if (ext === '.fountain') return 'fountain'
  if (ext === '.txt') return 'txt'
  return 'pdf'
}

async function exportPdf(file: EpFile, targetPath: string) {
  const html = screenplayToHtml(file)
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: false }
  })
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { top: 0.5, bottom: 0.5, left: 0.6, right: 0.6 }
    })
    await fs.writeFile(targetPath, pdf)
  } finally {
    win.destroy()
  }
}

async function exportDocx(file: EpFile, targetPath: string) {
  const sections = getDocxEpisodes(file).flatMap(episode => {
    const title = episode.title.trim()
    return [
      ...(title ? [new Paragraph({
        spacing: { after: 260 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: title, bold: true, size: 32 })]
      })] : []),
      ...episode.blocks.flatMap(block => {
    if (block.type === 'scene') {
      return [new Paragraph({
        spacing: { before: 240, after: 120 },
        children: docxRunsForText(`${block.number ? `第 ${block.number} 场 ` : ''}${block.location} ${block.intext} ${block.time}`.trim(), { bold: true })
      })]
    }
    if (block.type === 'action') {
      return [new Paragraph({
        spacing: { after: 120 },
        children: docxRunsForText(block.text)
      })]
    }
    if (block.type === 'transition') {
      return [new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 120 },
        children: docxRunsForText(block.text, { bold: true })
      })]
    }
    if (block.type === 'dialogue') {
      const parsed = splitDialogueLine(block.text)
      if (!parsed) {
        return [new Paragraph({ spacing: { after: 120 }, children: docxRunsForText(block.text) })]
      }
      return [new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: parsed.speaker, bold: true }),
          ...(parsed.ext ? [new TextRun({ text: `（${parsed.ext}）`, italics: true })] : []),
          ...docxRunsForText(`：${parsed.content}`)
        ]
      })]
    }
    return []
      })
    ]
  })

  const doc = new Document({
    sections: [{ properties: {}, children: sections }]
  })

  await fs.writeFile(targetPath, await Packer.toBuffer(doc))
}

export function docxRunsForText(text: string, options: { bold?: boolean; italics?: boolean } = {}) {
  return text.split('\n').map((line, index) => new TextRun({
    text: line,
    break: index === 0 ? 0 : 1,
    ...options
  }))
}

function getDocxEpisodes(file: EpFile) {
  return file.episodes && file.episodes.length > 1 ? file.episodes : [file]
}
