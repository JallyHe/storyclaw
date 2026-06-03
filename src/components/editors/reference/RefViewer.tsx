import { useEffect, useMemo, useRef, useState } from 'react'
import { workspaceIpc } from '@/ipc/workspace'
import { FindBar } from '@/components/editors/FindBar'
import type { FindHandlers } from '@/components/editors/FindBar'
import { injectDomHighlights, clearDomSpans } from '@/editors/domFind'
import './reference.css'

interface Props { filePath: string }

type PreviewMode = 'loading' | 'text' | 'pdf' | 'docx' | 'error'

function detectMode(name: string): PreviewMode {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  return 'text'
}

async function loadPdfWorker(): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return worker.default
}

export function RefViewer({ filePath }: Props) {
  const [mode, setMode] = useState<PreviewMode>('loading')
  const [textContent, setTextContent] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [pdfBlobUrl, setPdfBlobUrl] = useState('')
  const [pdfPageCount, setPdfPageCount] = useState(0)
  const [docxKey, setDocxKey] = useState(0)
  const [docxFallbackText, setDocxFallbackText] = useState('')
  const [workerReady, setWorkerReady] = useState(false)
  const [showDocxFind, setShowDocxFind] = useState(false)
  const docxRef = useRef<HTMLDivElement>(null)
  const docxStyleRef = useRef<HTMLDivElement>(null)
  const docxSpansRef = useRef<HTMLSpanElement[]>([])
  const docxCurrentRef = useRef(0)

  const fileName = filePath.split(/[\\/]/).pop() ?? filePath

  const docxFindHandlers = useMemo<FindHandlers>(() => ({
    find(query, opts) {
      clearDomSpans(docxSpansRef.current)
      docxSpansRef.current = []
      docxCurrentRef.current = 0
      if (!query || !docxRef.current) return 0
      const spans = injectDomHighlights(docxRef.current, query, opts)
      docxSpansRef.current = spans
      return spans.length
    },
    next() {
      const spans = docxSpansRef.current
      if (!spans.length) return
      spans[docxCurrentRef.current].className = 'find-highlight'
      docxCurrentRef.current = (docxCurrentRef.current + 1) % spans.length
      spans[docxCurrentRef.current].className = 'find-highlight-current'
      spans[docxCurrentRef.current].scrollIntoView({ block: 'center', behavior: 'smooth' })
    },
    prev() {
      const spans = docxSpansRef.current
      if (!spans.length) return
      spans[docxCurrentRef.current].className = 'find-highlight'
      docxCurrentRef.current = (docxCurrentRef.current - 1 + spans.length) % spans.length
      spans[docxCurrentRef.current].className = 'find-highlight-current'
      spans[docxCurrentRef.current].scrollIntoView({ block: 'center', behavior: 'smooth' })
    },
    clear() {
      clearDomSpans(docxSpansRef.current)
      docxSpansRef.current = []
      docxCurrentRef.current = 0
    }
  }), [])

  useEffect(() => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') {
      loadPdfWorker().then(() => setWorkerReady(true)).catch(() => {
        setMode('error')
        setErrorMessage('PDF 渲染引擎加载失败。')
      })
    }
  }, [filePath])

  useEffect(() => {
    const targetMode = detectMode(fileName)

    async function load() {
      setMode('loading')
      setErrorMessage('')

      try {
        if (targetMode === 'pdf' && !workerReady) return

        if (targetMode === 'text') {
          const text = await workspaceIpc.readText(filePath)
          setTextContent(text)
          setMode('text')
        } else if (targetMode === 'pdf') {
          const buf = await workspaceIpc.readFileBuffer(filePath)
          const blob = new Blob([buf.slice()], { type: 'application/pdf' })
          const url = URL.createObjectURL(blob)
          if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
          setPdfBlobUrl(url)
          setMode('pdf')

          const pdfjsLib = await import('pdfjs-dist')
          const task = pdfjsLib.getDocument(url)
          const pdf = await task.promise
          setPdfPageCount(pdf.numPages)
        } else if (targetMode === 'docx') {
          setDocxFallbackText('')
          setDocxKey(k => k + 1)
          setMode('docx')
        }
      } catch (err: any) {
        setErrorMessage(err?.message ?? String(err))
        setMode('error')
      }
    }

    void load()
  }, [filePath, workerReady])

  useEffect(() => {
    if (mode !== 'docx' || !docxRef.current) return

    let cancelled = false

    async function render() {
      try {
        const buf = await workspaceIpc.readFileBuffer(filePath)
        const arrayBuffer = toStableArrayBuffer(buf)
        if (cancelled) return
        const docxPreview = await import('docx-preview')
        const renderAsync = docxPreview.renderAsync
        if (typeof renderAsync !== 'function') {
          throw new Error('DOCX 渲染引擎加载失败：缺少 renderAsync')
        }
        if (cancelled) return

        if (docxRef.current) docxRef.current.innerHTML = ''
        if (docxStyleRef.current) docxStyleRef.current.innerHTML = ''

        await renderAsync(arrayBuffer, docxRef.current!, docxStyleRef.current!, {
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          ignoreLastRenderedPageBreak: false,
          breakPages: true,
          experimental: false,
          className: 'docx'
        })
        if (!cancelled && docxRef.current) {
          paginateDocxPreview(docxRef.current)
          if (!hasRenderedDocxContent(docxRef.current)) {
            setDocxFallbackText(await workspaceIpc.readText(filePath))
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMessage(err?.message ?? String(err))
          setMode('error')
        }
      }
    }

    void render()
    return () => { cancelled = true }
  }, [mode, filePath, docxKey])

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    }
  }, [pdfBlobUrl])

  if (mode === 'loading') {
    return (
      <div className="ref-viewer">
        <div className="ref-loading">正在加载 {fileName}...</div>
      </div>
    )
  }

  if (mode === 'error') {
    return (
      <div className="ref-viewer">
        <div className="ref-error">
          <p>无法预览 {fileName}</p>
          <pre>{errorMessage}</pre>
        </div>
      </div>
    )
  }

  if (mode === 'pdf') {
    return (
      <div className="ref-viewer">
        <PdfPreview url={pdfBlobUrl} totalPages={pdfPageCount} fileName={fileName} />
      </div>
    )
  }

  if (mode === 'docx') {
    return (
      <div
        className="ref-viewer"
        style={{ position: 'relative' }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowDocxFind(true) }
        }}
        tabIndex={-1}
      >
        {showDocxFind && (
          <FindBar
            handlers={docxFindHandlers}
            allowReplace={false}
            onClose={() => { docxFindHandlers.clear(); setShowDocxFind(false) }}
          />
        )}
        <div className="ref-header">
          <span className="ref-filename">{fileName}</span>
          <span className="ref-badge">DOCX</span>
          <button className="ref-find-btn" title="查找 (Ctrl+F)" onClick={() => setShowDocxFind(v => !v)}>搜</button>
        </div>
        <div className="ref-docx" key={docxKey}>
          <div ref={docxStyleRef} />
          <div ref={docxRef} className="docx-preview-content" />
          {docxFallbackText && <pre className="ref-docx-fallback">{docxFallbackText}</pre>}
        </div>
      </div>
    )
  }

  return (
    <div className="ref-viewer">
      <div className="ref-header">
        <span className="ref-filename">{fileName}</span>
        <span className="ref-badge">TXT</span>
      </div>
      <pre className="ref-text">{textContent}</pre>
    </div>
  )
}

function PdfPreview({ url, totalPages, fileName }: { url: string; totalPages: number; fileName: string }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [pdfScale, setPdfScale] = useState(1.25)
  const [showPdfFind, setShowPdfFind] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Array<HTMLDivElement | null>>([])
  const pdfMatchPagesRef = useRef<number[]>([])
  const pdfFindCurrentRef = useRef(0)

  useEffect(() => {
    if (!url) return
    let cancelled = false

    async function load() {
      const pdfjsLib = await import('pdfjs-dist')
      const task = pdfjsLib.getDocument(url)
      const doc = await task.promise
      if (!cancelled) setPdfDoc(doc)
    }

    void load()
    return () => { cancelled = true }
  }, [url])

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
    setPageInput(String(page))
    pageRefs.current[page - 1]?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  const pdfFindHandlers = useMemo<FindHandlers>(() => ({
    async find(query, opts) {
      pdfMatchPagesRef.current = []
      pdfFindCurrentRef.current = 0
      if (!pdfDoc || !query) return 0
      const needle = opts.caseSensitive ? query : query.toLowerCase()
      const matches: number[] = []
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i)
        const content = await page.getTextContent()
        const pageText = (content.items as Array<{ str?: string }>)
          .map(item => item.str ?? '').join('')
        const haystack = opts.caseSensitive ? pageText : pageText.toLowerCase()
        if (haystack.includes(needle)) matches.push(i)
      }
      pdfMatchPagesRef.current = matches
      if (matches.length > 0) goToPage(matches[0])
      return matches.length
    },
    next() {
      const m = pdfMatchPagesRef.current
      if (!m.length) return
      pdfFindCurrentRef.current = (pdfFindCurrentRef.current + 1) % m.length
      goToPage(m[pdfFindCurrentRef.current])
    },
    prev() {
      const m = pdfMatchPagesRef.current
      if (!m.length) return
      pdfFindCurrentRef.current = (pdfFindCurrentRef.current - 1 + m.length) % m.length
      goToPage(m[pdfFindCurrentRef.current])
    },
    clear() {
      pdfMatchPagesRef.current = []
      pdfFindCurrentRef.current = 0
    }
  }), [pdfDoc, goToPage])

  const updateCurrentPage = () => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    const viewportTop = scrollEl.getBoundingClientRect().top
    let bestPage = currentPage
    let bestDistance = Number.POSITIVE_INFINITY
    pageRefs.current.forEach((page, index) => {
      if (!page) return
      const distance = Math.abs(page.getBoundingClientRect().top - viewportTop - 12)
      if (distance < bestDistance) {
        bestDistance = distance
        bestPage = index + 1
      }
    })
    if (bestPage !== currentPage) {
      setCurrentPage(bestPage)
      setPageInput(String(bestPage))
    }
  }

  return (
    <div
      className="ref-pdf"
      style={{ position: 'relative' }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowPdfFind(true) }
      }}
      tabIndex={-1}
    >
      {showPdfFind && (
        <FindBar
          handlers={pdfFindHandlers}
          allowReplace={false}
          onClose={() => { pdfFindHandlers.clear(); setShowPdfFind(false) }}
        />
      )}
      <div className="ref-header">
        <span className="ref-filename">{fileName}</span>
        <span className="ref-badge">PDF</span>
        <button className="ref-find-btn" title="查找 (Ctrl+F)" onClick={() => setShowPdfFind(v => !v)}>搜</button>
        {totalPages > 0 && (
          <div className="ref-pdf-controls">
            <button disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>上一页</button>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={e => setPageInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') goToPage(Number(pageInput)) }}
              onBlur={() => goToPage(Number(pageInput))}
            />
            <span> / {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}>下一页</button>
            <button onClick={() => setPdfScale(scale => Math.max(0.6, Number((scale - 0.15).toFixed(2))))}>缩小</button>
            <button onClick={() => setPdfScale(1.25)}>重置</button>
            <button onClick={() => setPdfScale(scale => Math.min(2.4, Number((scale + 0.15).toFixed(2))))}>放大</button>
          </div>
        )}
      </div>
      <div className="ref-pdf-pages" ref={scrollRef} onScroll={updateCurrentPage}>
        {pdfDoc && Array.from({ length: totalPages }, (_, index) => (
          <div
            key={index + 1}
            className="ref-pdf-page"
            ref={el => { pageRefs.current[index] = el }}
          >
            <div className="ref-pdf-page-label">第 {index + 1} 页</div>
            <PdfPageRenderer doc={pdfDoc} pageNumber={index + 1} scale={pdfScale} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PdfPageRenderer({ doc, pageNumber, scale }: { doc: any; pageNumber: number; scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    let renderTask: { cancel(): void; promise: Promise<unknown> } | null = null

    async function render() {
      if (!doc || !canvasRef.current) return
      if (cancelled) return
      const page = await doc.getPage(pageNumber)
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current!
      canvas.height = viewport.height
      canvas.width = viewport.width
      const ctx = canvas.getContext('2d')!
      renderTask = page.render({ canvasContext: ctx, viewport })
      await renderTask.promise.catch(() => undefined)
    }

    void render()
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [doc, pageNumber, scale])

  return <canvas ref={canvasRef} className="ref-pdf-canvas" />
}

function paginateDocxPreview(container: HTMLElement): void {
  const wrapper = container.querySelector('.docx-wrapper')
  if (!wrapper) return
  wrapper.querySelectorAll('section.docx').forEach((section, index) => {
    section.setAttribute('data-page', String(index + 1))
  })
}

function hasRenderedDocxContent(container: HTMLElement): boolean {
  const sections = Array.from(container.querySelectorAll('section.docx'))
  if (sections.length === 0) return container.textContent?.trim().length ? true : false
  return sections.some(section => (section.textContent ?? '').trim().length > 0 || section.querySelector('img, svg, canvas'))
}

function toStableArrayBuffer(data: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  return copy.buffer
}
