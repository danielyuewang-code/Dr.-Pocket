import { useState } from 'react'

const SYMPTOMS = ['Soreness', 'Cramp', 'Stiffness', 'Itchiness', 'Swelling', 'Sharp Pain']

function App() {
  const [symptom, setSymptom] = useState(null)
  const [customText, setCustomText] = useState('')
  const [remedies, setRemedies] = useState(null)
  const [loading, setLoading] = useState(false)

  const getRemedies = async () => {
    setLoading(true)
    setRemedies(null)
    const description = customText || symptom
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `I have ${description}. Give me 4 practical at-home remedies I can do RIGHT NOW. Include stretches, massage techniques, and heat/cold treatments. Be specific and concise. Format as a numbered list.`
        }]
      })
    })
    const data = await response.json()
    setRemedies(data.content[0].text)
    setLoading(false)
  }

  return (
    <div style={{ background: '#0f0f0f', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.8rem' }}>🩺</span>
        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '700' }}>Dr. Pocket</h1>
        <span style={{ color: '#666', fontSize: '0.95rem', marginLeft: '0.5rem' }}>Your personal body relief guide</span>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 80px)' }}>
        <div style={{ width: '450px', borderRight: '1px solid #222', position: 'relative', background: '#111' }}>
          <p style={{ position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)', color: '#aaa', fontSize: '0.85rem', zIndex: 10, whiteSpace: 'nowrap' }}>
            🖱️ Drag to rotate • Scroll to zoom
          </p>
          <model-viewer
            src="/human-simple.glb"
            camera-controls
            auto-rotate
            shadow-intensity="1"
            style={{ width: '100%', height: '100%', background: 'transparent' }}
          />
        </div>

        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <h2 style={{ marginTop: 0 }}>What are you feeling?</h2>
          <p style={{ color: '#888', marginBottom: '1rem', fontSize: '0.9rem' }}>Rotate the model to find your area, then describe your symptom below.</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {SYMPTOMS.map(s => (
              <button key={s} onClick={() => setSymptom(s)} style={{
                padding: '0.6rem 1.2rem', borderRadius: '999px',
                border: `2px solid ${symptom === s ? '#3b82f6' : '#333'}`,
                background: symptom === s ? '#1d4ed8' : '#1a1a1a',
                color: 'white', cursor: 'pointer', fontWeight: '500'
              }}>{s}</button>
            ))}
          </div>

          <p style={{ color: '#888', marginBottom: '0.5rem' }}>Or describe it yourself:</p>
          <textarea
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder='e.g. "my lower back locks up when I stand up too fast"'
            style={{
              width: '100%', minHeight: '80px', background: '#1a1a1a',
              border: '1px solid #333', borderRadius: '10px', color: 'white',
              padding: '0.75rem', fontSize: '0.95rem', resize: 'vertical', boxSizing: 'border-box'
            }}
          />

          <button
            onClick={getRemedies}
            disabled={(!symptom && !customText) || loading}
            style={{
              marginTop: '1rem', padding: '0.8rem 2rem', background: '#3b82f6',
              color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem',
              fontWeight: '700', cursor: 'pointer',
              opacity: (!symptom && !customText) || loading ? 0.5 : 1
            }}
          >
            {loading ? '⏳ Finding remedies...' : '💊 Get Remedies'}
          </button>

          {remedies && (
            <div style={{ marginTop: '1.5rem', background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '1.5rem' }}>
              <h3 style={{ marginTop: 0, color: '#3b82f6' }}>🩹 Your At-Home Remedies</h3>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', color: '#ddd' }}>{remedies}</p>
              <p style={{ color: '#555', fontSize: '0.8rem', marginTop: '1rem' }}>⚠️ Not a substitute for professional medical advice.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App