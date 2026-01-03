import { useEffect, useRef, useState, useCallback } from 'preact/hooks'
import { useMusicKeys } from './Keyboard'

// Music player with prev/play-pause/next controls
// When standalone (preview), shows full UI. When embedded, just the iframe.
export default function Music({ playing: externalPlaying, command }) {
  const [internalPlaying, setInternalPlaying] = useState(true)
  const [internalCommand, setInternalCommand] = useState(null)
  const playing = externalPlaying !== undefined ? externalPlaying : internalPlaying
  const activeCommand = command !== undefined ? command : internalCommand
  const iframeRef = useRef(null)
  const lastCommand = useRef(null)
  const isStandalone = externalPlaying === undefined

  const params = new URLSearchParams({
    autoplay: '1',
    controls: '0',
    loop: '1',
    list: 'PLJI0AAXX2j3WeFaRxa8psa_cXGEaXMVTw',
    index: '0',
    enablejsapi: '1',
  })

  const skipPrev = useCallback(() => setInternalCommand('prev-' + Date.now()), [])
  const skipNext = useCallback(() => setInternalCommand('next-' + Date.now()), [])
  const togglePlay = useCallback(() => setInternalPlaying(p => !p), [])

  // Keyboard controls (j=prev, k=toggle, l=next) - only when standalone
  useMusicKeys(isStandalone ? { onPrev: skipPrev, onToggle: togglePlay, onNext: skipNext } : {})

  // Handle play/pause
  useEffect(() => {
    if (!iframeRef.current) return
    const cmd = playing ? 'playVideo' : 'pauseVideo'
    iframeRef.current.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: cmd, args: '' }),
      '*'
    )
  }, [playing])

  // Handle skip commands (next/prev)
  useEffect(() => {
    if (!iframeRef.current || !activeCommand || activeCommand === lastCommand.current) return
    lastCommand.current = activeCommand
    const func = activeCommand.startsWith('next') ? 'nextVideo' : activeCommand.startsWith('prev') ? 'previousVideo' : null
    if (func) {
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args: '' }),
        '*'
      )
    }
  }, [activeCommand])

  const btnStyle = {
    width: '2.5rem',
    height: '2.5rem',
    borderRadius: '50%',
    border: '2px solid #ff00ff',
    background: 'rgba(0, 0, 0, 0.5)',
    fontSize: '1rem',
    cursor: 'pointer',
    color: '#ff00ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  return (
    <>
      {isStandalone && (
        <div style={{ position: 'fixed', inset: 0, background: '#050509' }} />
      )}
      <iframe
        ref={iframeRef}
        src={`https://www.youtube.com/embed/b5BNUa_op2o?${params}`}
        frameBorder="0"
        allow="autoplay"
        style={{
          position: 'fixed',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
      {isStandalone && (
        <div style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          display: 'flex',
          gap: '0.5rem',
          zIndex: 100,
        }}>
          <button onClick={skipPrev} style={btnStyle} title="Previous track (J)">⏮</button>
          <button onClick={togglePlay} style={btnStyle} title={internalPlaying ? 'Pause (K)' : 'Play (K)'}>
            {internalPlaying ? '⏸' : '▶'}
          </button>
          <button onClick={skipNext} style={btnStyle} title="Next track (L)">⏭</button>
        </div>
      )}
    </>
  )
}
