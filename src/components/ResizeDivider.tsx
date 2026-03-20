import { useCallback, useRef, useState } from 'react'

interface ResizeDividerProps {
  direction: 'horizontal' | 'vertical'
  onResize: (delta: number) => void
}

export function ResizeDivider({ direction, onResize }: ResizeDividerProps) {
  const [dragging, setDragging] = useState(false)
  const startPos = useRef<number | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY
    setDragging(true)

    const onMouseMove = (e: MouseEvent) => {
      if (startPos.current === null) return
      const pos = direction === 'horizontal' ? e.clientX : e.clientY
      const delta = pos - startPos.current
      startPos.current = pos
      onResize(delta)
    }

    const onMouseUp = () => {
      startPos.current = null
      setDragging(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [direction, onResize])

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`resize-divider resize-divider--${direction}${dragging ? ' is-dragging' : ''}`}
    />
  )
}
