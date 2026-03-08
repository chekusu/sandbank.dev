import { useEffect, useRef } from 'react'

const WAVE_CHARS = '~≈∽∿⏜⌒._-—'
const FOAM_CHARS = '.:·°*˙∘○◦'
const DENSITY_CHARS = " .'`^,:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
const CHAR_SIZE = 14

export default function AsciiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const timeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0

    const resize = () => {
      width = canvas.clientWidth
      height = canvas.clientHeight
      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
    }

    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMouseMove)
    resize()

    let raf = 0

    const render = () => {
      const t = timeRef.current
      ctx.clearRect(0, 0, width, height)
      ctx.font = `${CHAR_SIZE}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const cols = Math.ceil(width / CHAR_SIZE)
      const rows = Math.ceil(height / CHAR_SIZE)
      const rect = canvas.getBoundingClientRect()
      const relMouseX = mouseRef.current.x - rect.left
      const relMouseY = mouseRef.current.y - rect.top

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const posX = x * CHAR_SIZE
          const posY = y * CHAR_SIZE
          const normalizedY = y / rows

          // Wave layers
          const wave1 = Math.sin(x * 0.06 + t * 0.8) * 0.08
          const wave2 = Math.sin(x * 0.12 - t * 1.2 + 2.0) * 0.04
          const wave3 = Math.sin(x * 0.03 + t * 0.4 + 1.5) * 0.06
          const wave4 = Math.cos(x * 0.09 + t * 0.6 + 3.0) * 0.03
          const swell = Math.sin(x * 0.015 + t * 0.2) * 0.12
          const surfaceLine = 0.25 + wave1 + wave2 + wave3 + wave4 + swell

          // Mouse
          const dx = posX - relMouseX
          const dy = posY - relMouseY
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (normalizedY <= surfaceLine) continue

          const depth = normalizedY - surfaceLine
          let char: string
          let shouldDraw = true

          if (depth < 0.03) {
            const foamNoise = Math.sin(x * 0.3 + t * 2) * Math.cos(x * 0.5 - t * 1.5)
            shouldDraw = foamNoise > -0.3
            char = FOAM_CHARS[Math.floor(Math.abs(foamNoise * 10)) % FOAM_CHARS.length]
          } else if (depth < 0.15) {
            const waveMotion = Math.sin(x * 0.08 + y * 0.1 + t * 1.5)
            const undercurrent = Math.sin(x * 0.04 - t * 0.5 + y * 0.05)
            shouldDraw = waveMotion + undercurrent > -0.5
            char = WAVE_CHARS[Math.floor(Math.abs(waveMotion) * WAVE_CHARS.length) % WAVE_CHARS.length]
          } else if (depth < 0.4) {
            const deepFlow = Math.sin(x * 0.03 + y * 0.06 + t * 0.3)
            const drift = Math.cos(x * 0.05 - t * 0.2)
            shouldDraw = deepFlow + drift > 0.6
            const idx = Math.floor(Math.abs(deepFlow) * DENSITY_CHARS.length * 0.3)
            char = DENSITY_CHARS[idx % DENSITY_CHARS.length]
          } else {
            const abyssNoise = Math.sin(x * 0.02 + y * 0.02 + t * 0.1)
            shouldDraw = abyssNoise > 0.85
            char = DENSITY_CHARS[Math.floor(Math.random() * 10) % DENSITY_CHARS.length]
          }

          if (!shouldDraw) continue

          const alpha = Math.max(0, 1 - normalizedY * 1.2)

          if (dist < 120) {
            ctx.fillStyle = 'rgba(212, 168, 83, 1)'
            char = Math.random() > 0.5 ? '1' : '0'
          } else {
            ctx.fillStyle = `rgba(212, 168, 83, ${alpha * 0.4})`
          }

          ctx.fillText(char, posX + CHAR_SIZE / 2, posY + CHAR_SIZE / 2)
        }
      }

      timeRef.current += 0.012
      raf = requestAnimationFrame(render)
    }

    raf = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return <canvas ref={canvasRef} className="block w-full h-full" />
}
