import { useCallback } from 'react'

interface Props {
  width: number
  setWidth: (w: number) => void
  edge: 'left' | 'right'
  min?: number
  max?: number
}

export function ResizeHandle({ width, setWidth, edge, min = 200, max = 560 }: Props) {
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX, startW = width
    document.body.classList.add('resizing')

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const w = edge === 'left' ? startW - dx : startW + dx
      setWidth(Math.max(min, Math.min(max, Math.round(w))))
    }
    const onUp = () => {
      document.body.classList.remove('resizing')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [width, setWidth, edge, min, max])

  return <div className={`resizer ${edge}`} onPointerDown={onPointerDown} />
}
