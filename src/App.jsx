import { useState, useRef, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const SYMPTOMS = ['Soreness', 'Cramp', 'Stiffness', 'Itchiness', 'Swelling', 'Sharp Pain']

// ─── Mesh-based region detection ─────────────────────────────────────────────
const IGNORED_NAMES = new Set(['', 'Scene', 'Group1'])

// GLB is flat: all named muscle nodes are direct Scene children.
// Three.js GLTF loader sets e.object.name = the glTF node name, so "Left biceps" etc.
// Group1 is the base body skin — ignore it.
function getMeshRegionName(obj) {
  if (obj.name && !IGNORED_NAMES.has(obj.name)) return obj.name
  return null
}

// ─── Camera Controller ────────────────────────────────────────────────────────
function CameraController({ target, zoom, orbitRef, landingMode, stopRef }) {
  const { camera } = useThree()
  const animating = useRef(false)
  const targetCamPos = useRef(new THREE.Vector3())
  const targetLook = useRef(new THREE.Vector3())

  useEffect(() => {
    if (landingMode) {
      targetCamPos.current.set(0.45, 0.91, 0.22)
      targetLook.current.set(0, 0.91, 0.22)
    } else if (target && zoom) {
      targetCamPos.current.copy(target).add(new THREE.Vector3(0, 0, 1.4))
      targetLook.current.copy(target).add(new THREE.Vector3(0.2, 0, 0))
    } else {
      targetCamPos.current.set(0, -0.3, 10)
      targetLook.current.set(0, -0.3, 0)
    }
    animating.current = true
  }, [target, zoom, landingMode])

  useFrame(() => {
    if (stopRef && stopRef.current) { animating.current = false; stopRef.current = false }
    if (!animating.current) return
    const speed = landingMode ? 0.03 : (target && zoom) ? 0.08 : 0.035
    camera.position.lerp(targetCamPos.current, speed)
    if (orbitRef.current) {
      orbitRef.current.target.lerp(targetLook.current, speed)
      orbitRef.current.update()
    }
    if (camera.position.distanceTo(targetCamPos.current) < 0.01) animating.current = false
  })

  return null
}

// ─── Body Model ───────────────────────────────────────────────────────────────
const BASE_COLOR   = new THREE.Color(0.85, 0.82, 0.78)
const HOVER_COLOR  = new THREE.Color(0.23, 0.51, 0.96)
const HOVER_EMIT   = new THREE.Color(0.04, 0.10, 0.30)

function BodyModel({ onPartClick, onHover, onHoverEnd, interactive }) {
  const { scene } = useGLTF('/sampleUntitled.glb')
  const pointerDown = useRef(null)

  // Give every mesh its own material instance so we can highlight individually
  useEffect(() => {
    scene.traverse(c => {
      if (c.isMesh) {
        c.material = new THREE.MeshStandardMaterial({
          color: BASE_COLOR.clone(), roughness: 0.75, metalness: 0.0
        })
      }
    })
  }, [scene])

  // Reset all meshes back to base colour
  const resetAll = () => {
    scene.traverse(c => {
      if (c.isMesh) {
        c.material.color.copy(BASE_COLOR)
        c.material.emissive.set(0, 0, 0)
        c.material.emissiveIntensity = 0
      }
    })
  }

  // Highlight all meshes that belong to the named node (and its children),
  // then return that node's name.
  const highlightRegion = (hitObj) => {
    resetAll()
    const name = getMeshRegionName(hitObj)
    if (!name) return null
    if (hitObj.isMesh) {
      hitObj.material.color.copy(HOVER_COLOR)
      hitObj.material.emissive.copy(HOVER_EMIT)
      hitObj.material.emissiveIntensity = 1
    }
    return name
  }

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
        const name = getMeshRegionName(e.object)
        if (name) onPartClick(e.point.clone(), name)
      } : undefined}

      onPointerMove={interactive ? (e) => {
        e.stopPropagation()
        const name = highlightRegion(e.object)
        if (name) onHover(name, e.clientX, e.clientY)
        else { resetAll(); onHoverEnd() }
      } : undefined}

      onPointerOut={interactive ? () => {
        resetAll()
        onHoverEnd()
        document.body.style.cursor = 'default'
      } : undefined}

      onPointerOver={interactive ? () => {
        document.body.style.cursor = 'pointer'
      } : undefined}
    />
  )
}

useGLTF.preload('/sampleUntitled.glb')

// ─── Annotation Dot ───────────────────────────────────────────────────────────
function AnnotationDot({ point }) {
  return (
    <mesh position={point}>
      <sphereGeometry args={[0.025, 16, 16]} />
      <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={2} />
    </mesh>
  )
}

// ─── Annotation Panel ─────────────────────────────────────────────────────────
function AnnotationPanel({ region, symptom, setSymptom, customText, setCustomText, onGetRemedies, loading, onClear, remedies }) {
  return (
    <div style={{
      position: 'absolute', right: '220px', top: '50%', transform: 'translateY(-50%)',
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

// ─── Global styles ────────────────────────────────────────────────────────────
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,200;9..40,300;9..40,400;9..40,500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { width: 100%; height: 100%; overflow: hidden; background: #000; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes blink {
    0%, 100% { opacity: 0.2; }
    50% { opacity: 0.95; }
  }
`

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [showLanding, setShowLanding] = useState(true)
  const [fading, setFading]           = useState(false)
  const [clickPoint, setClickPoint]   = useState(null)
  const [region, setRegion]           = useState(null)
  const [symptom, setSymptom]         = useState(null)
  const [customText, setCustomText]   = useState('')
  const [remedies, setRemedies]       = useState(null)
  const [loading, setLoading]         = useState(false)
  const [zoomed, setZoomed]           = useState(false)
  const [hoverRegion, setHoverRegion] = useState(null)
  const [tooltipPos, setTooltipPos]   = useState({ x: 0, y: 0 })
  const [showLogin, setShowLogin]     = useState(false)
  const [loginEmail, setLoginEmail]   = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory]         = useState([])
  const orbitRef    = useRef()
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
    const area        = region ? `my ${region}` : ''
    const description = customText || (symptom && area ? `${symptom} in ${area}` : symptom || area)
    const res  = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 1000,
        messages: [{ role: 'user', content: `I have ${description}. Give me 4 practical at-home remedies RIGHT NOW. Be specific and concise. Format as a numbered list.` }]
      })
    })
    const data = await res.json()
    const remedyText = data.content[0].text
    setRemedies(remedyText); setLoading(false)
    setHistory(prev => [{
      id: Date.now(), region, symptom, customText,
      remedies: remedyText,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    }, ...prev])
  }

  return (
    <>
      <style>{GLOBAL_STYLE}</style>
      <div style={{
        width: '100vw', height: '100vh', background: '#000',
        position: 'relative', overflow: 'hidden',
        fontFamily: "'DM Sans', sans-serif"
      }}>
        {/* Content area — GPU-shifted left when history opens */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: showHistory ? 'translateX(-180px)' : 'translateX(0)',
          transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}>
        <Canvas
          camera={{ position: [0.45, 0.91, 0.22], fov: 24 }}
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

          {!showLanding && clickPoint && region && <AnnotationDot point={clickPoint} />}

          <OrbitControls
            ref={orbitRef} enabled={!showLanding}
            enablePan={false} enableDamping dampingFactor={0.05}
            minDistance={1.5} maxDistance={12}
            onStart={() => { stopAnimRef.current = true; if (region) dismissPopup() }}
          />
        </Canvas>

        {/* Landing */}
        {showLanding && (
          <div
            onClick={dismissLanding}
            style={{
              position: 'absolute', inset: 0, cursor: 'pointer', zIndex: 100,
              opacity: fading ? 0 : 1, transition: 'opacity 0.8s ease',
              pointerEvents: fading ? 'none' : 'all',
              display: 'flex', alignItems: 'center',
            }}
          >
            <button
              onClick={e => { e.stopPropagation(); setShowLogin(true) }}
              style={{
                position: 'absolute', top: '24px', right: '32px',
                padding: '13px 34px', background: 'white', color: '#000',
                border: 'none', borderRadius: '999px', fontSize: '15px',
                fontWeight: '800', fontFamily: "'DM Sans', sans-serif",
                letterSpacing: '0.5px', cursor: 'pointer', zIndex: 3,
              }}
            >Log in</button>
            <div style={{
              position: 'relative', zIndex: 2, paddingLeft: '16vw',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '12px',
                animation: 'fadeUp 0.7s ease both', animationDelay: '0.1s',
              }}>
                <img src="/Logo.png" alt="Dr. Pocket" style={{ height: '88px', width: '88px', objectFit: 'contain', flexShrink: 0 }} />
                <span style={{ fontSize: '104px', fontWeight: '300', color: '#fff', letterSpacing: '-3px', lineHeight: 1, whiteSpace: 'nowrap', textShadow: '0 2px 40px rgba(0,0,0,0.8)' }}>
                  Dr. Pocket
                </span>
              </div>
              <div style={{ paddingLeft: '108px', marginBottom: '36px', animation: 'fadeUp 0.7s ease both', animationDelay: '0.28s' }}>
                <span style={{ fontSize: '20.5px', fontWeight: '300', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1px', whiteSpace: 'nowrap', textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}>
                  Pinpoint your pain. Get remedies instantly.
                </span>
              </div>
              <div style={{ paddingLeft: '108px', display: 'flex', alignItems: 'center', gap: '10px', animation: 'fadeUp 0.7s ease both', animationDelay: '0.44s' }}>
                <span style={{ fontSize: '14px', fontWeight: '400', color: 'rgba(255,255,255,0.9)', letterSpacing: '3.5px', textTransform: 'uppercase', animation: 'blink 2.8s ease-in-out infinite', textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}>
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
              padding: '16px 28px', display: 'flex', alignItems: 'center', gap: '12px',
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

        {/* Login modal */}
        {/* Login modal */}
        {showLogin && (
          <div
            onClick={() => setShowLogin(false)}
            style={{
              position: 'absolute', inset: 0, zIndex: 500,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '400px', background: '#0a0a0a',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '24px', padding: '40px',
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: '300', color: 'white', letterSpacing: '-0.5px' }}>Welcome back</div>
                  <div style={{ fontSize: '13px', fontWeight: '300', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>Sign in to your account</div>
                </div>
                <button onClick={() => setShowLogin(false)} style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
                  color: 'rgba(255,255,255,0.3)', borderRadius: '50%', width: '32px', height: '32px',
                  cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              </div>

              {/* Email */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', fontWeight: '400', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', display: 'block', marginBottom: '8px' }}>Email</label>
                <input
                  type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: '100%', padding: '13px 16px', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
                    color: 'white', fontSize: '14px', fontWeight: '300',
                    fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: '28px' }}>
                <label style={{ fontSize: '11px', fontWeight: '400', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', display: 'block', marginBottom: '8px' }}>Password</label>
                <input
                  type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '13px 16px', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
                    color: 'white', fontSize: '14px', fontWeight: '300',
                    fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Submit */}
              <button
                onClick={() => { /* add auth logic here */ }}
                style={{
                  width: '100%', padding: '14px', background: 'white', color: '#000',
                  border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700',
                  fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', letterSpacing: '0.3px',
                }}
              >
                Log in
              </button>

              <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', fontWeight: '300', color: 'rgba(255,255,255,0.25)' }}>
                Don't have an account? <span style={{ color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>Sign up</span>
              </div>
            </div>
          </div>
        )}
          {/* Edge tab — lives inside content area so it moves with it */}
          {!showLanding && (
            <div style={{
              position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 200,
            }}>
              <button onClick={() => setShowHistory(h => !h)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '6px', width: '28px', height: '96px',
                background: '#111', border: '1px solid rgba(255,255,255,0.1)',
                borderRight: 'none', borderRadius: '8px 0 0 8px',
                cursor: 'pointer', padding: 0,
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2"/>
                  <path d="M6 3v3l2 1.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span style={{
                  writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)',
                  fontSize: '9px', fontWeight: '400', letterSpacing: '1.5px',
                  textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
                  fontFamily: "'DM Sans', sans-serif", userSelect: 'none',
                }}>History</span>
                {history.length > 0 && (
                  <span style={{ fontSize: '9px', fontWeight: '500', color: 'rgba(255,255,255,0.5)', fontFamily: "'DM Sans', sans-serif" }}>{history.length}</span>
                )}
              </button>
            </div>
          )}
        </div>{/* end content area */}

        {/* Medical history sidebar — GPU-slides in from right */}
        {!showLanding && (
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: '360px',
            transform: showHistory ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
            background: '#0a0a0a', borderLeft: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', flexDirection: 'column',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '400', color: 'white', letterSpacing: '-0.3px' }}>Medical History</div>
                <div style={{ fontSize: '11px', fontWeight: '300', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                  {history.length === 0 ? 'No entries yet' : `${history.length} entr${history.length === 1 ? 'y' : 'ies'}`}
                </div>
              </div>
              <button onClick={() => setShowHistory(false)} style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.3)', borderRadius: '50%', width: '30px', height: '30px',
                cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: '60px', color: 'rgba(255,255,255,0.2)', fontSize: '13px', fontWeight: '300' }}>
                  Click a body part and get remedies<br />to start building your history.
                </div>
              ) : history.map(entry => (
                <div key={entry.id} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '14px', padding: '16px', marginBottom: '12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '400', color: 'white', letterSpacing: '-0.3px' }}>{entry.region}</div>
                    <div style={{ fontSize: '10px', fontWeight: '300', color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap', marginLeft: '8px', marginTop: '2px' }}>{entry.date}</div>
                  </div>
                  {(entry.symptom || entry.customText) && (
                    <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {entry.symptom && (
                        <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '300', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }}>{entry.symptom}</span>
                      )}
                      {entry.customText && (
                        <span style={{ fontSize: '12px', fontWeight: '300', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>"{entry.customText}"</span>
                      )}
                    </div>
                  )}
                  {entry.remedies && (
                    <>
                      <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '10px' }} />
                      <div style={{ fontSize: '10px', fontWeight: '400', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '6px' }}>Remedies</div>
                      <div style={{ fontSize: '12px', fontWeight: '300', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{entry.remedies}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {history.length > 0 && (
              <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={() => setHistory([])} style={{
                  width: '100%', padding: '10px', background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px',
                  color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: '11px',
                  fontWeight: '400', letterSpacing: '1.5px', textTransform: 'uppercase',
                  fontFamily: 'inherit',
                }}>Clear history</button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
