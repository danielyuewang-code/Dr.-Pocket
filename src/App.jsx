import { useState, useRef, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const SYMPTOMS = ['Soreness', 'Cramp', 'Stiffness', 'Itchiness', 'Swelling', 'Sharp Pain']

const MUSCLE_REGIONS = [
  { name: 'Head',            yMin: 0.76,  yMax: 1.11,  xMin: -0.88, xMax: 0.88,  zMin: -0.29, zMax: 0.29 },
  { name: 'Neck',            yMin: 0.54,  yMax: 0.78,  xMin: -0.18, xMax: 0.18,  zMin: -0.29, zMax: 0.29 },
  { name: 'Left Bicep',      yMin: 0.05,  yMax: 0.40,  xMin: -0.88, xMax: -0.50, zMin: -0.05, zMax: 0.29 },
  { name: 'Right Bicep',     yMin: 0.05,  yMax: 0.40,  xMin:  0.50, xMax:  0.88, zMin: -0.05, zMax: 0.29 },
  { name: 'Left Tricep',     yMin: 0.05,  yMax: 0.40,  xMin: -0.88, xMax: -0.50, zMin: -0.29, zMax: 0.05 },
  { name: 'Right Tricep',    yMin: 0.05,  yMax: 0.40,  xMin:  0.50, xMax:  0.88, zMin: -0.29, zMax: 0.05 },
  { name: 'Left Forearm',    yMin: -0.30, yMax: 0.08,  xMin: -0.88, xMax: -0.52, zMin: -0.29, zMax: 0.29 },
  { name: 'Right Forearm',   yMin: -0.30, yMax: 0.08,  xMin:  0.52, xMax:  0.88, zMin: -0.29, zMax: 0.29 },
  { name: 'Left Shoulder',   yMin: 0.32,  yMax: 0.58,  xMin: -0.70, xMax: -0.32, zMin: -0.29, zMax: 0.29 },
  { name: 'Right Shoulder',  yMin: 0.32,  yMax: 0.58,  xMin:  0.32, xMax:  0.70, zMin: -0.29, zMax: 0.29 },
  { name: 'Left Pec',        yMin: 0.10,  yMax: 0.42,  xMin: -0.38, xMax: -0.02, zMin: 0.04,  zMax: 0.29 },
  { name: 'Right Pec',       yMin: 0.10,  yMax: 0.42,  xMin:  0.02, xMax:  0.38, zMin: 0.04,  zMax: 0.29 },
  { name: 'Trapezius',       yMin: 0.28,  yMax: 0.58,  xMin: -0.38, xMax: 0.38,  zMin: -0.29, zMax: -0.02 },
  { name: 'Left Lat',        yMin: -0.08, yMax: 0.38,  xMin: -0.55, xMax: -0.18, zMin: -0.29, zMax: -0.02 },
  { name: 'Right Lat',       yMin: -0.08, yMax: 0.38,  xMin:  0.18, xMax:  0.55, zMin: -0.29, zMax: -0.02 },
  { name: 'Upper Back',      yMin: 0.10,  yMax: 0.42,  xMin: -0.22, xMax: 0.22,  zMin: -0.29, zMax: -0.02 },
  { name: 'Lower Back',      yMin: -0.35, yMax: 0.12,  xMin: -0.28, xMax: 0.28,  zMin: -0.29, zMax: -0.02 },
  { name: 'Abs',             yMin: -0.25, yMax: 0.12,  xMin: -0.22, xMax: 0.22,  zMin: 0.04,  zMax: 0.29 },
  { name: 'Left Oblique',    yMin: -0.28, yMax: 0.15,  xMin: -0.44, xMax: -0.18, zMin: 0.02,  zMax: 0.29 },
  { name: 'Right Oblique',   yMin: -0.28, yMax: 0.15,  xMin:  0.18, xMax:  0.44, zMin: 0.02,  zMax: 0.29 },
  { name: 'Left Hip',        yMin: -0.55, yMax: -0.22, xMin: -0.55, xMax: -0.08, zMin: -0.29, zMax: 0.29 },
  { name: 'Right Hip',       yMin: -0.55, yMax: -0.22, xMin:  0.08, xMax:  0.55, zMin: -0.29, zMax: 0.29 },
  { name: 'Glutes',          yMin: -0.75, yMax: -0.42, xMin: -0.55, xMax: 0.55,  zMin: -0.29, zMax: 0.02 },
  { name: 'Left Quad',       yMin: -1.12, yMax: -0.58, xMin: -0.44, xMax: -0.08, zMin: 0.00,  zMax: 0.29 },
  { name: 'Right Quad',      yMin: -1.12, yMax: -0.58, xMin:  0.08, xMax:  0.44, zMin: 0.00,  zMax: 0.29 },
  { name: 'Left Hamstring',  yMin: -1.12, yMax: -0.58, xMin: -0.44, xMax: -0.08, zMin: -0.29, zMax: 0.00 },
  { name: 'Right Hamstring', yMin: -1.12, yMax: -0.58, xMin:  0.08, xMax:  0.44, zMin: -0.29, zMax: 0.00 },
  { name: 'Left Knee',       yMin: -1.30, yMax: -1.10, xMin: -0.36, xMax: -0.06, zMin: -0.29, zMax: 0.29 },
  { name: 'Right Knee',      yMin: -1.30, yMax: -1.10, xMin:  0.06, xMax:  0.36, zMin: -0.29, zMax: 0.29 },
  { name: 'Left Calf',       yMin: -1.72, yMax: -1.28, xMin: -0.30, xMax: -0.04, zMin: -0.29, zMax: 0.29 },
  { name: 'Right Calf',      yMin: -1.72, yMax: -1.28, xMin:  0.04, xMax:  0.30, zMin: -0.29, zMax: 0.29 },
  { name: 'Left Foot',       yMin: -2.01, yMax: -1.70, xMin: -0.40, xMax: -0.02, zMin: -0.29, zMax: 0.29 },
  { name: 'Right Foot',      yMin: -2.01, yMax: -1.70, xMin:  0.02, xMax:  0.40, zMin: -0.29, zMax: 0.29 },
]

function getBodyRegion(point) {
  const { x, y, z } = point
  for (const r of MUSCLE_REGIONS) {
    if (x >= r.xMin && x <= r.xMax && y >= r.yMin && y <= r.yMax && z >= r.zMin && z <= r.zMax) return r
  }
  return null
}

function CameraController({ target, zoom, orbitRef, landingMode, stopRef }) {
  const { camera } = useThree()
  const animating = useRef(false)
  const targetCamPos = useRef(new THREE.Vector3())
  const targetLook = useRef(new THREE.Vector3())

  useEffect(() => {
    if (landingMode) {
      // Pure side profile — camera on X axis looking in
      targetCamPos.current.set(0.45, 0.91, 0.14)
      targetLook.current.set(0, 0.91, 0.14)
    } else if (target && zoom) {
      targetCamPos.current.copy(target).add(new THREE.Vector3(0, 0, 1.4))
      targetLook.current.copy(target).add(new THREE.Vector3(0.2, 0, 0))
    } else {
      // Full body view — pulled way back so feet are visible
      targetCamPos.current.set(0, -0.3, 10)
      targetLook.current.set(0, -0.3, 0)
    }
    animating.current = true
  }, [target, zoom, landingMode])

  useFrame(() => {
    if (stopRef && stopRef.current) { animating.current = false; stopRef.current = false }
    if (!animating.current) return
    const speed = landingMode ? 0.03 : 0.08
    camera.position.lerp(targetCamPos.current, speed)
    if (orbitRef.current) {
      orbitRef.current.target.lerp(targetLook.current, speed)
      orbitRef.current.update()
    }
    if (camera.position.distanceTo(targetCamPos.current) < 0.01) {
      animating.current = false
    }
  })

  return null
}

function BodyModel({ onPartClick, onHover, onHoverEnd, interactive }) {
  const { scene } = useGLTF('/human-simple.glb')
  const baseMat = useRef(null)
  const hoverMat = useRef(null)
  const pointerDown = useRef(null)

  useEffect(() => {
    baseMat.current = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.85, 0.82, 0.78), roughness: 0.75, metalness: 0.0
    })
    hoverMat.current = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.23, 0.51, 0.96), roughness: 0.6, metalness: 0.1,
      emissive: new THREE.Color(0.04, 0.10, 0.30)
    })
    scene.traverse(c => { if (c.isMesh) c.material = baseMat.current })
  }, [scene])

  return (
    <primitive
      object={scene} scale={0.15} position={[0, -2, 0]}
      onPointerDown={interactive ? (e) => {
        pointerDown.current = { x: e.clientX, y: e.clientY }
      } : undefined}
      onClick={interactive ? (e) => {
        e.stopPropagation()
        if (!pointerDown.current) return
        const dx = e.clientX - pointerDown.current.x
        const dy = e.clientY - pointerDown.current.y
        if (Math.sqrt(dx * dx + dy * dy) > 5) return
        const r = getBodyRegion(e.point)
        if (r) onPartClick(e.point.clone(), r.name)
      } : undefined}
      onPointerMove={interactive ? (e) => {
        e.stopPropagation()
        const r = getBodyRegion(e.point)
        scene.traverse(c => { if (c.isMesh) c.material = r ? hoverMat.current : baseMat.current })
        if (r) onHover(r.name, e.clientX, e.clientY); else onHoverEnd()
      } : undefined}
      onPointerOut={interactive ? () => {
        scene.traverse(c => { if (c.isMesh) c.material = baseMat.current })
        onHoverEnd(); document.body.style.cursor = 'default'
      } : undefined}
      onPointerOver={interactive ? () => { document.body.style.cursor = 'pointer' } : undefined}
    />
  )
}

useGLTF.preload('/human-simple.glb')

function AnnotationDot({ point }) {
  return (
    <mesh position={point}>
      <sphereGeometry args={[0.025, 16, 16]} />
      <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={2} />
    </mesh>
  )
}

function AnnotationPanel({ region, symptom, setSymptom, customText, setCustomText, onGetRemedies, loading, onClear, remedies }) {
  return (
    <div style={{
      position: 'absolute', right: '10vw', top: '50%', transform: 'translateY(-50%)',
      width: '460px', maxHeight: '84vh', overflowY: 'auto', zIndex: 200,
      background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '20px', padding: '28px', boxShadow: '0 32px 80px rgba(0,0,0,0.95)',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: '400', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: '5px' }}>Selected area</div>
          <div style={{ color: 'white', fontSize: '20px', fontWeight: '300', letterSpacing: '-0.4px' }}>{region}</div>
        </div>
        <button onClick={onClear} style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
          color: 'rgba(255,255,255,0.3)', borderRadius: '50%', width: '28px', height: '28px',
          cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>✕</button>
      </div>
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '14px' }} />
      <div style={{ fontSize: '10px', fontWeight: '400', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: '8px' }}>Symptoms</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
        {SYMPTOMS.map(s => (
          <button key={s} onClick={() => setSymptom(s === symptom ? null : s)} style={{
            padding: '5px 11px', borderRadius: '999px', fontSize: '12px', fontWeight: '300',
            fontFamily: "'DM Sans', sans-serif",
            border: `1px solid ${symptom === s ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
            background: symptom === s ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: symptom === s ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
            cursor: 'pointer',
          }}>{s}</button>
        ))}
      </div>
      <textarea value={customText} onChange={e => setCustomText(e.target.value)}
        placeholder="e.g. sharp pain when I twist..."
        style={{
          width: '100%', height: '52px', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px',
          color: 'rgba(255,255,255,0.7)', padding: '8px 10px', fontSize: '12px',
          fontWeight: '300', fontFamily: "'DM Sans', sans-serif",
          resize: 'none', boxSizing: 'border-box', marginBottom: '12px', outline: 'none',
        }}
      />
      <button onClick={onGetRemedies} disabled={(!symptom && !customText) || loading}
        style={{
          width: '100%', padding: '11px', background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px', fontSize: '11px', fontWeight: '400',
          fontFamily: "'DM Sans', sans-serif", letterSpacing: '2.5px',
          textTransform: 'uppercase', cursor: 'pointer',
          opacity: (!symptom && !customText) || loading ? 0.35 : 1,
        }}>
        {loading ? 'Finding remedies...' : 'Get remedies'}
      </button>
      {remedies && (
        <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
          <div style={{ fontSize: '10px', fontWeight: '400', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: '10px' }}>Remedies</div>
          <div style={{ fontSize: '12px', fontWeight: '300', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{remedies}</div>
        </div>
      )}
    </div>
  )
}

const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,200;9..40,300;9..40,400;9..40,500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { width: 100%; height: 100%; overflow: hidden; background: #000; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes blink {
    0%, 100% { opacity: 0.18; }
    50% { opacity: 0.5; }
  }
`

export default function App() {
  const [showLanding, setShowLanding] = useState(true)
  const [fading, setFading] = useState(false)
  const [clickPoint, setClickPoint] = useState(null)
  const [region, setRegion] = useState(null)
  const [symptom, setSymptom] = useState(null)
  const [customText, setCustomText] = useState('')
  const [remedies, setRemedies] = useState(null)
  const [loading, setLoading] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [hoverRegion, setHoverRegion] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const orbitRef = useRef()
  const stopAnimRef = useRef(false)

  const dismissLanding = () => {
    if (!showLanding || fading) return
    setFading(true)
    setTimeout(() => setShowLanding(false), 800)
  }

  const handlePartClick = (point, regionName) => {
    setClickPoint(point); setRegion(regionName); setZoomed(true)
    setSymptom(null); setCustomText(''); setRemedies(null); setHoverRegion(null)
  }

  const handleClear = () => {
    setClickPoint(null); setRegion(null); setZoomed(false)
    setSymptom(null); setCustomText(''); setRemedies(null)
  }

  const dismissPopup = () => {
    setRegion(null)
    setSymptom(null); setCustomText(''); setRemedies(null)
  }

  const getRemedies = async () => {
    setLoading(true); setRemedies(null)
    const area = region ? `my ${region}` : ''
    const description = customText || (symptom && area ? `${symptom} in ${area}` : symptom || area)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 1000,
        messages: [{ role: 'user', content: `I have ${description}. Give me 4 practical at-home remedies RIGHT NOW. Be specific and concise. Format as a numbered list.` }]
      })
    })
    const data = await res.json()
    setRemedies(data.content[0].text); setLoading(false)
  }

  return (
    <>
      <style>{GLOBAL_STYLE}</style>
      <div style={{
        width: '100vw', height: '100vh', background: '#000',
        position: 'relative', overflow: 'hidden',
        fontFamily: "'DM Sans', sans-serif"
      }}>

        <Canvas
          camera={{ position: [0.45, 0.91, 0.14], fov: 24 }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          dpr={window.devicePixelRatio}
          gl={{ antialias: true }}
          onPointerMissed={!showLanding ? handleClear : undefined}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', e => e.preventDefault(), false)
          }}
        >
          <color attach="background" args={['#000000']} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[3, 5, 3]} intensity={1.4} />
          <directionalLight position={[-2, -2, -2]} intensity={0.2} />
          <directionalLight position={[0, -4, 2]} intensity={0.3} />

          <CameraController target={clickPoint} zoom={zoomed} orbitRef={orbitRef} landingMode={showLanding} stopRef={stopAnimRef} />

          <Suspense fallback={null}>
            <BodyModel
              onPartClick={handlePartClick}
              onHover={(r, x, y) => { setHoverRegion(r); setTooltipPos({ x, y }) }}
              onHoverEnd={() => setHoverRegion(null)}
              interactive={!showLanding}
            />
          </Suspense>

          {!showLanding && clickPoint && region && (
            <AnnotationDot point={clickPoint} />
          )}

          <OrbitControls
            ref={orbitRef} enabled={!showLanding}
            enablePan={false} enableDamping dampingFactor={0.05}
            minDistance={1.5} maxDistance={12}
            onStart={() => { stopAnimRef.current = true; if (region) dismissPopup() }}
          />
        </Canvas>

        {/* Landing — pure text over canvas, zero background divs */}
        {showLanding && (
          <div
            onClick={dismissLanding}
            style={{
              position: 'absolute', inset: 0,
              cursor: 'pointer', zIndex: 100,
              opacity: fading ? 0 : 1,
              transition: 'opacity 0.8s ease',
              pointerEvents: fading ? 'none' : 'all',
              display: 'flex', alignItems: 'center',
            }}
          >
            <button
              onClick={e => { e.stopPropagation() }}
              style={{
                position: 'absolute', top: '24px', right: '32px',
                padding: '10px 28px', background: 'white', color: '#000',
                border: 'none', borderRadius: '999px', fontSize: '13px',
                fontWeight: '400', fontFamily: "'DM Sans', sans-serif",
                letterSpacing: '0.5px', cursor: 'pointer', zIndex: 3,
              }}
            >
              Log in
            </button>
            <div style={{
              position: 'relative', zIndex: 2,
              paddingLeft: '12vw',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            }}>
              {/* Logo + title */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '20px',
                marginBottom: '12px',
                animation: 'fadeUp 0.7s ease both',
                animationDelay: '0.1s',
              }}>
                <img src="/Logo.png" alt="Dr. Pocket"
                  style={{ height: '88px', width: '88px', objectFit: 'contain', flexShrink: 0 }}
                />
                <span style={{
                  fontSize: '88px', fontWeight: '300', color: '#fff',
                  letterSpacing: '-3px', lineHeight: 1, whiteSpace: 'nowrap',
                  textShadow: '0 2px 40px rgba(0,0,0,0.8)',
                }}>
                  Dr. Pocket
                </span>
              </div>

              {/* Slogan aligned under "Dr. Pocket" text */}
              <div style={{
                paddingLeft: '108px',
                marginBottom: '36px',
                animation: 'fadeUp 0.7s ease both',
                animationDelay: '0.28s',
              }}>
                <span style={{
                  fontSize: '19px', fontWeight: '300',
                  color: 'rgba(255,255,255,0.55)',
                  letterSpacing: '0.1px', whiteSpace: 'nowrap',
                  textShadow: '0 2px 20px rgba(0,0,0,0.9)',
                }}>
                  Pinpoint your pain. Get remedies instantly.
                </span>
              </div>

              {/* CTA */}
              <div style={{
                paddingLeft: '108px',
                display: 'flex', alignItems: 'center', gap: '10px',
                animation: 'fadeUp 0.7s ease both',
                animationDelay: '0.44s',
              }}>
                <span style={{
                  fontSize: '12px', fontWeight: '300',
                  color: 'rgba(255,255,255,0.35)',
                  letterSpacing: '3.5px', textTransform: 'uppercase',
                  animation: 'blink 2.8s ease-in-out infinite',
                  textShadow: '0 2px 12px rgba(0,0,0,0.9)',
                }}>
                  Click anywhere to begin
                </span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.25, flexShrink: 0 }}>
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

            </div>
          </div>
        )}

        {/* App UI */}
        {!showLanding && (
          <>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
              padding: '16px 28px',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <img src="/Logo.png" alt="" style={{ height: '26px', width: '26px', objectFit: 'contain' }} />
              <span style={{ fontSize: '17px', fontWeight: '400', color: 'white', letterSpacing: '-0.3px' }}>Dr. Pocket</span>
              <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
              <span style={{ fontSize: '10px', fontWeight: '400', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
                Hover to explore · Click to select
              </span>
              {clickPoint && (
                <button onClick={handleClear} style={{
                  marginLeft: 'auto', padding: '5px 14px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.35)', borderRadius: '999px', cursor: 'pointer',
                  fontSize: '11px', fontWeight: '300', letterSpacing: '1px', fontFamily: 'inherit',
                }}>← Reset</button>
              )}
            </div>

            {hoverRegion && !clickPoint && (
              <div style={{
                position: 'fixed', left: tooltipPos.x + 14, top: tooltipPos.y - 38,
                zIndex: 30, background: '#0a0a0a',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
                padding: '6px 13px', color: 'rgba(255,255,255,0.75)',
                fontSize: '12px', fontWeight: '300', letterSpacing: '0.3px',
                pointerEvents: 'none', whiteSpace: 'nowrap',
              }}>
                {hoverRegion}
              </div>
            )}

            {clickPoint && region && (
              <AnnotationPanel
                region={region}
                symptom={symptom} setSymptom={setSymptom}
                customText={customText} setCustomText={setCustomText}
                onGetRemedies={getRemedies} loading={loading}
                onClear={handleClear} remedies={remedies}
              />
            )}

            {!clickPoint && !hoverRegion && (
              <div style={{
                position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
                fontSize: '10px', fontWeight: '400', letterSpacing: '2.5px',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)',
                zIndex: 10, pointerEvents: 'none', whiteSpace: 'nowrap',
              }}>
                Hover · Click · Drag · Scroll
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
