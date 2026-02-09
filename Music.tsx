import { useEffect, useRef, useState, useCallback } from 'react'
import { useMusicKeys } from './Keyboard'

interface MusicProps {
  playing?: boolean
  command?: string | null
  onSongChange?: (title: string) => void
}

// Music player with prev/play-pause/next controls
// When standalone (preview), shows full UI. When embedded, just the iframe.
export default function Music({ playing: externalPlaying, command, onSongChange }: MusicProps) {
  const [internalPlaying, setInternalPlaying] = useState(true)
  const [internalCommand, setInternalCommand] = useState<string | null>(null)
  const playing = externalPlaying !== undefined ? externalPlaying : internalPlaying
  const activeCommand = command !== undefined ? command : internalCommand
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const lastCommand = useRef<string | null>(null)
  const lastSongTitle = useRef('')
  const isStandalone = externalPlaying === undefined

  const params = new URLSearchParams({
    autoplay: '1',
    controls: '0',
    loop: '1',
    list: 'PLJI0AAXX2j3WeFaRxa8psa_cXGEaXMVTw',
    index: '0',
    enablejsapi: '1',
  })

  const skipPrev = useCallback(() => setInternalCommand(`prev-${Date.now()}`), [])
  const skipNext = useCallback(() => setInternalCommand(`next-${Date.now()}`), [])
  const togglePlay = useCallback(() => setInternalPlaying(p => !p), [])

  // Keyboard controls (j=prev, k=toggle, l=next) - only when standalone
  useMusicKeys(isStandalone ? { onPrev: skipPrev, onToggle: togglePlay, onNext: skipNext } : {})

  // Handle play/pause
  useEffect(() => {
    if (!iframeRef.current) return
    const cmd = playing ? 'playVideo' : 'pauseVideo'
    iframeRef.current.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: cmd, args: '' }),
      '*',
    )
  }, [playing])

  // Handle skip commands (next/prev)
  useEffect(() => {
    if (!iframeRef.current || !activeCommand || activeCommand === lastCommand.current) return
    lastCommand.current = activeCommand
    const func = activeCommand.startsWith('next')
      ? 'nextVideo'
      : activeCommand.startsWith('prev')
        ? 'previousVideo'
        : null
    if (func) {
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args: '' }),
        '*',
      )
    }
  }, [activeCommand])

  // Subscribe to YouTube player events and emit song title changes.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow
      if (!iframeWindow || event.source !== iframeWindow) return

      let payload: unknown = event.data
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch {
          return
        }
      }
      if (!payload || typeof payload !== 'object') return

      const info = (payload as { info?: unknown }).info
      if (!info || typeof info !== 'object') return

      const videoData = (info as { videoData?: unknown }).videoData
      if (!videoData || typeof videoData !== 'object') return

      const title = (videoData as { title?: unknown }).title
      if (typeof title !== 'string' || !title || title === lastSongTitle.current) return

      lastSongTitle.current = title
      onSongChange?.(title)
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onSongChange])

  const handleIframeLoad = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*')
  }, [])

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
      {isStandalone && <div style={{ position: 'fixed', inset: 0, background: '#050509' }} />}
      <iframe
        ref={iframeRef}
        onLoad={handleIframeLoad}
        src={`https://www.youtube.com/embed/b5BNUa_op2o?${params}`}
        title="Background music player"
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
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            display: 'flex',
            gap: '0.5rem',
            zIndex: 100,
          }}>
          <button type="button" onClick={skipPrev} style={btnStyle} title="Previous track (J)">
            ⏮
          </button>
          <button
            type="button"
            onClick={togglePlay}
            style={btnStyle}
            title={internalPlaying ? 'Pause (K)' : 'Play (K)'}>
            {internalPlaying ? '⏸' : '▶'}
          </button>
          <button type="button" onClick={skipNext} style={btnStyle} title="Next track (L)">
            ⏭
          </button>
        </div>
      )}
    </>
  )
}
