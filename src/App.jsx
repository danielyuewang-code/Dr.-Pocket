import { useState, useRef, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// Doc 3 added: Discomfort, Nerve Pain, Pressure
const SYMPTOMS = ['Soreness', 'Cramp', 'Stiffness', 'Itchiness', 'Swelling', 'Sharp Pain', 'Discomfort', 'Nerve Pain', 'Pressure']

const labelStyle = { fontSize: '9px', fontWeight: '400', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '4px', fontFamily: "'DM Sans', sans-serif" }
const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '7px 10px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: '300', fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' }

// ─── Mesh-based region detection ─────────────────────────────────────────────
const IGNORED_NAMES = new Set(['', 'Scene', 'Group1'])

// Also ignore Blender auto-named nodes like 'Group1.003', 'Group1.016' etc.
function isIgnored(name) {
  if (!name) return true
  if (IGNORED_NAMES.has(name)) return true
  if (/^Group1\.\d+$/.test(name)) return true
  return false
}

function getMeshRegionName(obj) {
  if (!isIgnored(obj.name)) return obj.name
  return null
}

// ─── Camera Controller ────────────────────────────────────────────────────────
function CameraController({ target, zoom, orbitRef, landingMode, stopRef, resetKey }) {
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
  }, [target, zoom, landingMode, resetKey])

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
const BASE_COLOR  = new THREE.Color(0.85, 0.82, 0.78)
const HOVER_COLOR = new THREE.Color(0.80, 0.12, 0.12)  // Doc 4: red highlight
const HOVER_EMIT  = new THREE.Color(0.40, 0.04, 0.04)

function BodyModel({ onPartClick, onHover, onHoverEnd, interactive, selectedRegion, highlightName }) {
  const { scene } = useGLTF('/sampleUntitled.glb')
  const pointerDown = useRef(null)
  const selectedMesh = useRef(null)

  useEffect(() => {
    scene.traverse(c => {
      if (c.isMesh) {
        c.material = new THREE.MeshStandardMaterial({
          color: BASE_COLOR.clone(), roughness: 0.75, metalness: 0.0
        })
      }
    })
  }, [scene])

  // Doc 4: clear selection highlight when region deselected
  useEffect(() => {
    if (!selectedRegion) {
      selectedMesh.current = null
      scene.traverse(c => {
        if (c.isMesh) {
          c.material.color.copy(BASE_COLOR)
          c.material.emissive.set(0, 0, 0)
          c.material.emissiveIntensity = 0
        }
      })
    }
  }, [selectedRegion, scene])

  // Doc 3: highlight by name from history hover
  useEffect(() => {
    if (!highlightName) return
    scene.traverse(c => {
      if (!c.isMesh) return
      if (c.name === highlightName) {
        c.material.color.copy(HOVER_COLOR)
        c.material.emissive.copy(HOVER_EMIT)
        c.material.emissiveIntensity = 1
      } else {
        c.material.color.copy(BASE_COLOR)
        c.material.emissive.set(0, 0, 0)
        c.material.emissiveIntensity = 0
      }
    })
  }, [highlightName, scene])

  const applyHighlight = (mesh) => {
    if (!mesh || !mesh.isMesh) return
    mesh.material.color.copy(HOVER_COLOR)
    mesh.material.emissive.copy(HOVER_EMIT)
    mesh.material.emissiveIntensity = 1
  }

  const resetAll = () => {
    scene.traverse(c => {
      if (c.isMesh) {
        c.material.color.copy(BASE_COLOR)
        c.material.emissive.set(0, 0, 0)
        c.material.emissiveIntensity = 0
      }
    })
    // Doc 4: keep selected mesh highlighted after hover moves away
    if (selectedMesh.current) applyHighlight(selectedMesh.current)
  }

  const highlightRegion = (hitObj) => {
    resetAll()
    const name = getMeshRegionName(hitObj)
    if (!name) return null
    if (hitObj.isMesh) applyHighlight(hitObj)
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
        if (name) {
          selectedMesh.current = e.object
          applyHighlight(e.object)
          onPartClick(e.point.clone(), name)
        }
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

// ─── Annotation Panel ─────────────────────────────────────────────────────────
function AnnotationPanel({ region, regionType, setRegionType, symptom, setSymptom, customText, setCustomText, onGetRemedies, loading, onClear, remedies, historyOpen }) {
  return (
    <div style={{
      position: 'absolute', right: historyOpen ? '420px' : '320px', top: '50%', transform: 'translateY(-50%)',
      transition: 'right 0.35s cubic-bezier(0.4,0,0.2,1)',
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

      {/* Doc 3: Region type */}
      <div style={{ fontSize: '10px', fontWeight: '400', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: '8px' }}>Region</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
        {['Muscle Group', 'Bone', 'Tissue', 'General Area'].map(r => (
          <button key={r} onClick={() => setRegionType(r === regionType ? null : r)} style={{
            padding: '5px 11px', borderRadius: '999px', fontSize: '12px', fontWeight: '300',
            fontFamily: "'DM Sans', sans-serif",
            border: `1px solid ${regionType === r ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
            background: regionType === r ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: regionType === r ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
            cursor: 'pointer',
          }}>{r}</button>
        ))}
      </div>

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

      {/* Doc 3: loading state inside remedies section */}
      {(loading || remedies) && (
        <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
          <div style={{ fontSize: '10px', fontWeight: '400', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: '10px' }}>Remedies</div>
          {loading
            ? <div style={{ fontSize: '12px', fontWeight: '300', color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, animation: 'blink 1.6s ease-in-out infinite' }}>Loading...</div>
            : <div style={{ fontSize: '12px', fontWeight: '300', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{remedies}</div>
          }
        </div>
      )}
    </div>
  )
}

// ─── Global styles ────────────────────────────────────────────────────────────
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,200;9..40,300;9..40,400;9..40,500&family=Inter:wght@300;400;500&display=swap');
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
  @keyframes bob {
    0%, 100% { transform: translateX(0); opacity: 0.55; }
    50% { transform: translateX(-5px); opacity: 0.85; }
  }
  select option { color: #000; background: #fff; }
`

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [showLanding, setShowLanding]   = useState(true)
  const [fading, setFading]             = useState(false)
  const [clickPoint, setClickPoint]     = useState(null)
  const [region, setRegion]             = useState(null)
  const [regionType, setRegionType]     = useState(null)
  const [symptom, setSymptom]           = useState(null)
  const [customText, setCustomText]     = useState('')
  const [remedies, setRemedies]         = useState(null)
  const [loading, setLoading]           = useState(false)
  const [zoomed, setZoomed]             = useState(false)
  const [cameraModified, setCameraModified] = useState(false)
  const [hoverRegion, setHoverRegion]   = useState(null)
  const [tooltipPos, setTooltipPos]     = useState({ x: 0, y: 0 })
  const [showLogin, setShowLogin]       = useState(false)
  const [loginEmail, setLoginEmail]     = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showHistory, setShowHistory]   = useState(false)
  const [historyHintSeen, setHistoryHintSeen] = useState(false)
  const [history, setHistory]           = useState([])
  const [expandedHistoryId, setExpandedHistoryId]     = useState(null)
  const [hoveredHistoryRegion, setHoveredHistoryRegion] = useState(null)
  const [profileOpen, setProfileOpen]     = useState(false)
  const [profileSaved, setProfileSaved]   = useState(false)
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileDraft, setProfileDraft]   = useState({
    dob: '', sex: '', height: '', weight: '',
    conditions: '', medications: '', allergies: '',
    activityLevel: '', smoking: '', familyHistory: '',
  })
  const [profile, setProfile] = useState({
    dob: '', sex: '', height: '', weight: '',
    conditions: '', medications: '', allergies: '',
    activityLevel: '', smoking: '', familyHistory: '',
  })
  const orbitRef    = useRef()
  const stopAnimRef = useRef(false)
  const [resetKey, setResetKey] = useState(0)

  const dismissLanding = () => {
    if (!showLanding || fading) return
    setFading(true)
    setTimeout(() => setShowLanding(false), 800)
  }

  const handlePartClick = (point, regionName) => {
    setClickPoint(point); setRegion(regionName); setZoomed(true)
    setSymptom(null); setCustomText(''); setRemedies(null)
    setHoverRegion(null); setRegionType(null)
  }

  const handleClear = () => {
    stopAnimRef.current = false
    setClickPoint(null); setRegion(null); setZoomed(false)
    setSymptom(null); setCustomText(''); setRemedies(null)
    setRegionType(null); setCameraModified(false)
    setResetKey(k => k + 1)
  }

  const dismissPopup = () => {
    setRegion(null)
    setSymptom(null); setCustomText(''); setRemedies(null); setRegionType(null)
  }

  const getRemedies = async () => {
    setLoading(true); setRemedies(null)

    const parts = []
    if (region) parts.push(`affected area: ${region}${regionType ? ` (${regionType})` : ''}`)
    if (symptom) parts.push(`symptom: ${symptom}`)
    if (customText) parts.push(`additional details: ${customText}`)

    const ctx = [
      profile.dob           && `Date of birth: ${profile.dob}`,
      profile.sex           && `Sex: ${profile.sex}`,
      profile.height        && `Height: ${profile.height}`,
      profile.weight        && `Weight: ${profile.weight}`,
      profile.activityLevel && `Activity level: ${profile.activityLevel}`,
      profile.smoking       && `Smoking: ${profile.smoking}`,
      profile.conditions    && `Pre-existing conditions: ${profile.conditions}`,
      profile.medications   && `Current medications: ${profile.medications}`,
      profile.allergies     && `Allergies: ${profile.allergies}`,
      profile.familyHistory && `Family history: ${profile.familyHistory}`,
    ].filter(Boolean).join('. ')

    const prompt = `I have the following issue — ${parts.join(', ')}.${ctx ? ` Patient context: ${ctx}.` : ''} Give me the best practical at-home remedies. Be specific and concise. Format as a numbered list.`

    const res = await fetch('/api/remedies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    if (!res.ok) {
      setLoading(false)
      setRemedies('Something went wrong. Please try again.')
      return
    }
    const data = await res.json()
    const remedyText = data.text
    setRemedies(remedyText); setLoading(false)

    setHistory(prev => [{
      id: Date.now(), region, regionType, symptom, customText,
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

        {/* Content area — shifts left when history opens */}
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

            <CameraController target={clickPoint} zoom={zoomed} orbitRef={orbitRef} landingMode={showLanding} stopRef={stopAnimRef} resetKey={resetKey} />

            <Suspense fallback={null}>
              <BodyModel
                onPartClick={handlePartClick}
                onHover={(r, x, y) => { setHoverRegion(r); setTooltipPos({ x, y }) }}
                onHoverEnd={() => setHoverRegion(null)}
                interactive={!showLanding}
                selectedRegion={region}
                highlightName={hoveredHistoryRegion}
              />
            </Suspense>

            <OrbitControls
              ref={orbitRef} enabled={!showLanding}
              enablePan={false} enableDamping dampingFactor={0.08}
              zoomSpeed={0.4}
              minDistance={1.5} maxDistance={12}
              onStart={() => { stopAnimRef.current = true; setCameraModified(true); if (region) dismissPopup() }}
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
                  regionType={regionType} setRegionType={setRegionType}
                  symptom={symptom} setSymptom={setSymptom}
                  customText={customText} setCustomText={setCustomText}
                  onGetRemedies={getRemedies} loading={loading}
                  onClear={handleClear} remedies={remedies}
                  historyOpen={showHistory}
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
            <div style={{
              position: 'absolute', bottom: '12px', right: '20px',
              fontSize: '10px', fontWeight: '300', color: 'rgba(255,255,255,0.15)',
              zIndex: 10, pointerEvents: 'none', whiteSpace: 'nowrap',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              © 2026 Jason Chan, Soren Caron, Daniel Wang, Samuel Zhu. All rights reserved.
            </div>
            </>
          )}

          {/* Login modal */}
          {showLogin && (
            <div onClick={() => setShowLogin(false)} style={{
              position: 'absolute', inset: 0, zIndex: 500,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div onClick={e => e.stopPropagation()} style={{
                width: '400px', background: '#0a0a0a',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '24px', padding: '40px',
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
              }}>
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
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '400', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', display: 'block', marginBottom: '8px' }}>Email</label>
                  <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="you@example.com"
                    style={{ width: '100%', padding: '13px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: 'white', fontSize: '14px', fontWeight: '300', fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '28px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '400', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', display: 'block', marginBottom: '8px' }}>Password</label>
                  <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••"
                    style={{ width: '100%', padding: '13px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: 'white', fontSize: '14px', fontWeight: '300', fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <button onClick={() => {}} style={{ width: '100%', padding: '14px', background: 'white', color: '#000', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
                  Log in
                </button>
                <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', fontWeight: '300', color: 'rgba(255,255,255,0.25)' }}>
                  Don't have an account? <span style={{ color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>Sign up</span>
                </div>
              </div>
            </div>
          )}
        </div>{/* end content area */}

        {/* Navbar — outside content so it doesn't shift with sidebar */}
        {!showLanding && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 300,
            padding: '16px 28px', display: 'flex', alignItems: 'center', gap: '12px',
            pointerEvents: 'none',
          }}>
            <img src="/Logo.png" alt="" style={{ height: '26px', width: '26px', objectFit: 'contain', pointerEvents: 'all' }} />
            <span style={{ fontSize: '17px', fontWeight: '400', color: 'white', letterSpacing: '-0.3px' }}>Dr. Pocket</span>
            <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
            <span style={{ fontSize: '10px', fontWeight: '400', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
              Hover to explore · Click to select
            </span>
          </div>
        )}

        {/* Reset button — bottom center */}
        {!showLanding && (clickPoint || cameraModified) && (
          <div style={{
            position: 'absolute', bottom: '72px', left: '50%',
            transform: showHistory ? 'translateX(calc(-50% - 180px))' : 'translateX(-50%)',
            transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
            zIndex: 300,
          }}>
            <button onClick={handleClear} style={{
              padding: '10px 28px', background: 'white', border: 'none', borderRadius: '999px',
              color: '#111', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
              fontFamily: "'DM Sans', sans-serif", boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}>← Reset</button>
          </div>
        )}

        {/* Edge tab — chevron, anchored to sidebar left edge */}
        {!showLanding && (
          <div style={{
            position: 'absolute', top: '50%', right: '360px',
            transform: showHistory ? 'translateY(-50%)' : 'translate(360px, -50%)',
            transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
            zIndex: 310,
          }}>
            {!historyHintSeen && !showHistory && (
              <div style={{
                position: 'absolute', right: '30px', top: 0, bottom: 0,
                display: 'flex', alignItems: 'center', pointerEvents: 'none',
              }}>
                <span style={{
                  display: 'block', whiteSpace: 'nowrap', fontSize: '11px', fontWeight: '500',
                  letterSpacing: '1.8px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
                  fontFamily: "'Inter', sans-serif", animation: 'bob 2s ease-in-out infinite',
                }}>Click to View Medical History</span>
              </div>
            )}
            <button onClick={() => { setShowHistory(h => !h); setHistoryHintSeen(true) }} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '22px', height: '72px',
              background: '#111', border: '1px solid rgba(255,255,255,0.1)',
              borderRight: 'none', borderRadius: '6px 0 0 6px',
              cursor: 'pointer', padding: 0,
            }}>
              <svg width="14" height="24" viewBox="0 0 14 24" fill="none">
                {showHistory
                  ? <path d="M3 1l8 11-8 11" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  : <path d="M11 1L3 12l8 11" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                }
              </svg>
            </button>
          </div>
        )}

        {/* Medical history sidebar */}
        {!showLanding && (
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: '360px',
            transform: showHistory ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
            background: '#0a0a0a', borderLeft: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', flexDirection: 'column',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '16px', fontWeight: '400', color: 'white', letterSpacing: '-0.3px' }}>Medical History</div>
              {history.length > 0 && (
                <div style={{ fontSize: '11px', fontWeight: '300', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                  {history.length} entr{history.length === 1 ? 'y' : 'ies'}
                </div>
              )}
            </div>

            {/* Health Profile collapsible */}
            {(() => {
              const profileHasData = Object.values(profile).some(v => v)
              const showForm = !profileSaved || profileEditing
              return (
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <button onClick={() => setProfileOpen(o => !o)} style={{
                    width: '100%', padding: '14px 24px', background: 'transparent', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', color: 'rgba(255,255,255,0.55)', fontFamily: "'DM Sans', sans-serif",
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '400', letterSpacing: '1.8px', textTransform: 'uppercase' }}>Health Profile</span>
                      {!profileHasData && (
                        <span style={{ fontSize: '10px', fontWeight: '300', color: 'rgba(255,255,255,0.25)', letterSpacing: '0', textTransform: 'none' }}>optional · for more accurate results</span>
                      )}
                    </div>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                      <path d="M2 4l4 4 4-4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {profileOpen && (
                    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {showForm ? (
                        <>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={labelStyle}>Date of Birth</div>
                              <input type="date" value={profileDraft.dob} onChange={e => setProfileDraft(p => ({...p, dob: e.target.value}))} style={inputStyle} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={labelStyle}>Sex</div>
                              <select value={profileDraft.sex} onChange={e => setProfileDraft(p => ({...p, sex: e.target.value}))} style={inputStyle}>
                                <option value="">—</option>
                                <option>Male</option><option>Female</option><option>Other</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {[['height',"e.g. 5'10\""],['weight','e.g. 160 lbs']].map(([key, ph]) => (
                              <div key={key} style={{ flex: 1 }}>
                                <div style={labelStyle}>{key.charAt(0).toUpperCase()+key.slice(1)}</div>
                                <input placeholder={ph} value={profileDraft[key]} onChange={e => setProfileDraft(p => ({...p, [key]: e.target.value}))} style={inputStyle} />
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={labelStyle}>Activity Level</div>
                              <select value={profileDraft.activityLevel} onChange={e => setProfileDraft(p => ({...p, activityLevel: e.target.value}))} style={inputStyle}>
                                <option value="">—</option>
                                <option>Sedentary</option><option>Lightly Active</option>
                                <option>Moderately Active</option><option>Very Active</option>
                              </select>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={labelStyle}>Smoking</div>
                              <select value={profileDraft.smoking} onChange={e => setProfileDraft(p => ({...p, smoking: e.target.value}))} style={inputStyle}>
                                <option value="">—</option>
                                <option>Non-smoker</option><option>Former smoker</option><option>Current smoker</option>
                              </select>
                            </div>
                          </div>
                          {[
                            ['conditions','Pre-existing Conditions','e.g. diabetes, hypertension…'],
                            ['medications','Current Medications','e.g. metformin, ibuprofen…'],
                            ['allergies','Allergies','e.g. penicillin, peanuts, latex…'],
                            ['familyHistory','Family History','e.g. heart disease, cancer…'],
                          ].map(([key, label, ph]) => (
                            <div key={key}>
                              <div style={labelStyle}>{label}</div>
                              <textarea placeholder={ph} value={profileDraft[key]} onChange={e => setProfileDraft(p => ({...p, [key]: e.target.value}))}
                                style={{...inputStyle, resize: 'none', height: '52px', lineHeight: '1.5'}} />
                            </div>
                          ))}
                          <button onClick={() => {
                            const hasAny = Object.values(profileDraft).some(v => v)
                            if (hasAny) { setProfile({...profileDraft}); setProfileSaved(true) }
                            setProfileEditing(false)
                          }} style={{
                            width: '100%', padding: '10px', marginTop: '4px',
                            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '10px', color: 'white', cursor: 'pointer',
                            fontSize: '12px', fontWeight: '500', fontFamily: "'DM Sans', sans-serif",
                          }}>Save Profile</button>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[
                              ['Date of Birth', profile.dob], ['Sex', profile.sex],
                              ['Height', profile.height], ['Weight', profile.weight],
                              ['Activity Level', profile.activityLevel], ['Smoking', profile.smoking],
                              ['Pre-existing Conditions', profile.conditions],
                              ['Current Medications', profile.medications],
                              ['Allergies', profile.allergies], ['Family History', profile.familyHistory],
                            ].filter(([, v]) => v).map(([label, val]) => (
                              <div key={label}>
                                <div style={labelStyle}>{label}</div>
                                <div style={{ fontSize: '12px', fontWeight: '300', color: 'rgba(255,255,255,0.6)', lineHeight: '1.5' }}>{val}</div>
                              </div>
                            ))}
                          </div>
                          <button onClick={() => { setProfileDraft({...profile}); setProfileEditing(true) }} style={{
                            width: '100%', padding: '10px', marginTop: '4px',
                            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px', color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
                            fontSize: '12px', fontFamily: "'DM Sans', sans-serif",
                          }}>Edit Profile</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* History entries — expandable + hover-to-highlight */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: '60px', color: 'rgba(255,255,255,0.2)', fontSize: '13px', fontWeight: '300' }}>
                  Click a body part and get remedies<br />to start building your history.
                </div>
              ) : history.map(entry => {
                const isExpanded = expandedHistoryId === entry.id
                return (
                  <div key={entry.id}
                    onMouseEnter={() => setHoveredHistoryRegion(entry.region)}
                    onMouseLeave={() => setHoveredHistoryRegion(null)}
                    onClick={() => setExpandedHistoryId(isExpanded ? null : entry.id)}
                    style={{
                      background: 'rgba(255,255,255,0.03)', borderRadius: '14px',
                      padding: '16px', marginBottom: '12px', cursor: 'pointer',
                      border: `1px solid ${hoveredHistoryRegion === entry.region ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}`,
                      transition: 'border-color 0.2s',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isExpanded ? '10px' : 0 }}>
                      <div style={{ fontSize: '16px', fontWeight: '400', color: 'white', letterSpacing: '-0.3px' }}>{entry.region}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '10px', fontWeight: '300', color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap', marginTop: '2px' }}>{entry.date}</div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>{isExpanded ? '▲' : '▼'}</div>
                      </div>
                    </div>
                    {isExpanded && (
                      <>
                        {(entry.regionType || entry.symptom || entry.customText) && (
                          <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {entry.regionType && <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '300', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>{entry.regionType}</span>}
                            {entry.symptom && <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '300', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }}>{entry.symptom}</span>}
                            {entry.customText && <span style={{ fontSize: '12px', fontWeight: '300', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>"{entry.customText}"</span>}
                          </div>
                        )}
                        {entry.remedies && (
                          <>
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '10px' }} />
                            <div style={{ fontSize: '10px', fontWeight: '400', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '6px' }}>Remedies</div>
                            <div style={{ fontSize: '12px', fontWeight: '300', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{entry.remedies}</div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button style={{
                width: '100%', padding: '11px', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '11px',
                fontWeight: '400', letterSpacing: '1.2px', textTransform: 'uppercase', fontFamily: 'inherit',
              }}>↓ Download Full Medical History</button>
              {history.length > 0 && (
                <button onClick={() => setHistory([])} style={{
                  width: '100%', padding: '10px', background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px',
                  color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '11px',
                  fontWeight: '400', letterSpacing: '1.5px', textTransform: 'uppercase', fontFamily: 'inherit',
                }}>Clear history</button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
