import { useEffect, useRef } from 'react'

const VERT = `
attribute vec4 a_position;
void main() {
  gl_Position = a_position;
}
`

const FRAG = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_dpr;

// Palette — sandbank amber tones
const vec3 dot_color1 = vec3(0.831, 0.659, 0.325);  // #D4A853 amber
const vec3 dot_color2 = vec3(0.910, 0.569, 0.227);  // #E8913A warm orange

// 2D Simplex Noise — same algorithm as variant.com reference
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x * 34.0) + 1.0) * x);
}

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187,
                      0.366025403784439,
                      -0.577350269189626,
                      0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  st.x *= u_resolution.x / u_resolution.y;

  float gridDensity = 80.0;
  vec2 grid_st = fract(st * gridDensity);
  vec2 grid_id = floor(st * gridDensity);

  // Matrix rain: per-column vertical streams
  float colSeed = grid_id.x * 0.073;
  float rows = u_resolution.y / (u_resolution.x / gridDensity);

  // Each column gets unique speed, phase, and stream length from noise
  float n1 = snoise(vec2(colSeed, 0.0));
  float n2 = snoise(vec2(colSeed * 2.3, 1.0));
  float n3 = snoise(vec2(colSeed * 3.7, 2.0));

  float speed = 0.15 + (n1 * 0.5 + 0.5) * 0.15;   // 0.15 - 0.30 (slow)
  float phase = n2 * 6.28;
  float streamLen = 10.0 + (n3 * 0.5 + 0.5) * 15.0; // 10-25 dots

  // Column activity — slowly fades columns in and out
  float activity = snoise(vec2(colSeed * 1.5, u_time * 0.04));
  activity = smoothstep(-0.2, 0.6, activity);

  // Vertical scroll position within repeating stream
  float scroll = fract(grid_id.y / streamLen + u_time * speed + phase);

  // Head bright, tail fades — gentle power curve
  float brightness = pow(1.0 - scroll, 2.5) * activity;

  float size = brightness * 0.75;

  // Mouse interaction — expand dots near cursor
  vec2 mouseNorm = u_mouse * u_dpr / u_resolution;
  mouseNorm.x *= u_resolution.x / u_resolution.y;
  float mouseDist = length(st - mouseNorm);
  float mouseRadius = 0.12;
  float mouseInfluence = 1.0 - smoothstep(0.0, mouseRadius, mouseDist);
  mouseInfluence = mouseInfluence * mouseInfluence;

  // Mouse boosts dot size and adds brightness
  size = size + mouseInfluence * 0.5;
  size = clamp(size, 0.0, 0.95);

  // Draw square dot
  vec2 bl = step(vec2(0.5 - size / 2.0), grid_st);
  vec2 tr = step(vec2(0.5 - size / 2.0), 1.0 - grid_st);
  float is_dot = bl.x * bl.y * tr.x * tr.y;

  if (is_dot < 0.5) {
    gl_FragColor = vec4(0.0);
    return;
  }

  // Color — brighter heads lean orange, tails lean amber
  float headness = pow(1.0 - scroll, 4.0);
  vec3 dotColor = mix(dot_color1, dot_color2, headness + mouseInfluence * 0.5);

  // Opacity — subtle base, bright on mouse hover
  float alpha = 0.12 + mouseInfluence * 0.55;

  // Premultiplied alpha output
  gl_FragColor = vec4(dotColor * alpha, alpha);
}
`

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext, vert: string, frag: string): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vert)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, frag)
  if (!vs || !fs) return null

  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }

  gl.deleteShader(vs)
  gl.deleteShader(fs)
  return program
}

export default function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    })
    if (!gl) {
      console.error('WebGL not supported')
      return
    }

    const program = createProgram(gl, VERT, FRAG)
    if (!program) return

    // Fullscreen quad
    const quadVerts = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ])
    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW)

    const aPos = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    // Uniforms
    gl.useProgram(program)
    const uResolution = gl.getUniformLocation(program, 'u_resolution')
    const uTime = gl.getUniformLocation(program, 'u_time')
    const uMouse = gl.getUniformLocation(program, 'u_mouse')
    const uDpr = gl.getUniformLocation(program, 'u_dpr')

    // Resize handling
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(document.documentElement)

    // Mouse tracking
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
    }
    window.addEventListener('mousemove', onMouseMove)

    // Blending for premultiplied alpha
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    // Animation loop
    let animFrame = 0
    const startTime = performance.now()

    const render = () => {
      const elapsed = (performance.now() - startTime) / 1000.0
      const dpr = window.devicePixelRatio || 1

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl.useProgram(program)
      gl.uniform2f(uResolution, canvas.width, canvas.height)
      gl.uniform1f(uTime, elapsed)
      gl.uniform2f(uMouse, mouseRef.current.x, window.innerHeight - mouseRef.current.y)
      gl.uniform1f(uDpr, dpr)

      gl.drawArrays(gl.TRIANGLES, 0, 6)

      animFrame = requestAnimationFrame(render)
    }
    animFrame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animFrame)
      window.removeEventListener('mousemove', onMouseMove)
      resizeObserver.disconnect()
      gl.deleteBuffer(vbo)
      gl.deleteProgram(program)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
      }}
    />
  )
}
