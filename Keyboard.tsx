import { useEffect, useRef, useCallback, useState } from 'preact/hooks'

// Key mappings
export const MUSIC_KEYS = {
  prev: ['j', 'J'],
  toggle: ['k', 'K'],
  next: ['l', 'L'],
}

export const SHIP_KEYS = {
  left: ['a', 'A', 'ArrowLeft'],
  right: ['d', 'D', 'ArrowRight'],
  up: ['w', 'W', 'ArrowUp'],
  down: ['s', 'S', 'ArrowDown'],
}

// Hook for music controls (j=prev, k=toggle, l=next)
export function useMusicKeys(callbacks) {
  const { onPrev, onToggle, onNext } = callbacks

  useEffect(() => {
    const onKeyDown = (e) => {
      if (MUSIC_KEYS.prev.includes(e.key)) onPrev?.()
      else if (MUSIC_KEYS.toggle.includes(e.key)) onToggle?.()
      else if (MUSIC_KEYS.next.includes(e.key)) onNext?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onPrev, onToggle, onNext])
}

// Hook for ship controls (WASD/arrows) - returns current key state
export function useShipKeys(element) {
  const keys = useRef({ left: false, right: false, up: false, down: false })

  useEffect(() => {
    const target = element?.current || document

    const onKeyDown = (e) => {
      if (SHIP_KEYS.left.includes(e.key)) keys.current.left = true
      if (SHIP_KEYS.right.includes(e.key)) keys.current.right = true
      if (SHIP_KEYS.up.includes(e.key)) keys.current.up = true
      if (SHIP_KEYS.down.includes(e.key)) keys.current.down = true
      if (element) e.preventDefault()
    }

    const onKeyUp = (e) => {
      if (SHIP_KEYS.left.includes(e.key)) keys.current.left = false
      if (SHIP_KEYS.right.includes(e.key)) keys.current.right = false
      if (SHIP_KEYS.up.includes(e.key)) keys.current.up = false
      if (SHIP_KEYS.down.includes(e.key)) keys.current.down = false
    }

    target.addEventListener('keydown', onKeyDown)
    target.addEventListener('keyup', onKeyUp)
    return () => {
      target.removeEventListener('keydown', onKeyDown)
      target.removeEventListener('keyup', onKeyUp)
    }
  }, [element])

  return keys
}

// Standalone preview - shows key bindings with live highlighting
export default function Keyboard() {
  const [pressed, setPressed] = useState({})

  useEffect(() => {
    const onKeyDown = (e) => {
      setPressed(p => ({ ...p, [e.key]: true }))
    }
    const onKeyUp = (e) => {
      setPressed(p => ({ ...p, [e.key]: false }))
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const isActive = (keys) => keys.some(k => pressed[k])
  const rowStyle = (keys) => ({
    padding: '0.3rem 0.8rem',
    borderRadius: '4px',
    transition: 'all 0.1s',
    background: isActive(keys) ? '#ff00ff' : 'transparent',
    color: isActive(keys) ? '#000' : '#00ffff',
    fontWeight: isActive(keys) ? 'bold' : 'normal',
  })

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#050509',
      color: '#00ffff',
      fontFamily: 'monospace',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#ff00ff', marginBottom: '2rem' }}>Keyboard Controls</h2>
        <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>Press keys to highlight</p>
        <div style={{ display: 'flex', gap: '3rem', justifyContent: 'center' }}>
          <div>
            <h3 style={{ color: '#ff6600' }}>Movement</h3>
            <p style={rowStyle(SHIP_KEYS.up)}>W / ↑ - Up / Zoom</p>
            <p style={rowStyle(SHIP_KEYS.down)}>S / ↓ - Down / Zoom</p>
            <p style={rowStyle(SHIP_KEYS.left)}>A / ← - Left</p>
            <p style={rowStyle(SHIP_KEYS.right)}>D / → - Right</p>
          </div>
          <div>
            <h3 style={{ color: '#ff6600' }}>Ships</h3>
            <p style={rowStyle(['['])}>[ - Previous ship</p>
            <p style={rowStyle([']'])}>] - Next ship</p>
            <p style={rowStyle(['1','2','3','4','5','6','7','8'])}>1-8 - Select ship</p>
            <p style={rowStyle(['m', 'M'])}>M - Cycle animations</p>
          </div>
          <div>
            <h3 style={{ color: '#ff6600' }}>Game</h3>
            <p style={rowStyle(['Enter'])}>Enter - Start/Restart</p>
            <p style={rowStyle(['p', 'P'])}>P - Pause/Resume</p>
          </div>
          <div>
            <h3 style={{ color: '#ff6600' }}>Music</h3>
            <p style={rowStyle(MUSIC_KEYS.prev)}>J - Previous track</p>
            <p style={rowStyle(MUSIC_KEYS.toggle)}>K - Play/Pause</p>
            <p style={rowStyle(MUSIC_KEYS.next)}>L - Next track</p>
          </div>
        </div>
      </div>
    </div>
  )
}
