import { useEffect, useRef, useState } from 'react'

function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
}

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const outlineRef = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: 0, y: 0 })
  const outlinePos = useRef({ x: 0, y: 0 })
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (isTouchDevice()) return
    setEnabled(true)

    const onMove = (e: MouseEvent) => {
      pos.current.x = e.clientX
      pos.current.y = e.clientY
      if (dotRef.current) {
        dotRef.current.style.left = `${e.clientX}px`
        dotRef.current.style.top = `${e.clientY}px`
      }
    }
    window.addEventListener('mousemove', onMove)

    let raf = 0
    const loop = () => {
      const dx = pos.current.x - outlinePos.current.x
      const dy = pos.current.y - outlinePos.current.y
      outlinePos.current.x += dx * 0.15
      outlinePos.current.y += dy * 0.15
      if (outlineRef.current) {
        outlineRef.current.style.left = `${outlinePos.current.x}px`
        outlineRef.current.style.top = `${outlinePos.current.y}px`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  if (!enabled) return null

  return (
    <>
      <div
        ref={dotRef}
        className="fixed top-0 left-0 z-[9999] pointer-events-none rounded-full"
        style={{
          width: 6,
          height: 6,
          backgroundColor: 'white',
          transform: 'translate(-50%, -50%)',
          mixBlendMode: 'difference',
        }}
      />
      <div
        ref={outlineRef}
        className="fixed top-0 left-0 z-[9999] pointer-events-none rounded-full transition-[width,height] duration-200"
        style={{
          width: 40,
          height: 40,
          border: '1px solid white',
          transform: 'translate(-50%, -50%)',
          mixBlendMode: 'difference',
        }}
      />
    </>
  )
}
