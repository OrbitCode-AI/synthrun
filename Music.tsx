import { useEffect, useRef, useState, useCallback } from 'react'
import { useMusicKeys } from './Keyboard'

// Extract song title from YouTube player message payload
function extractSongTitle(data: unknown): string | null {
  let payload = data
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    } catch {
      return null
    }
  }
  if (!payload || typeof payload !== 'object') return null
  const info = (payload as { info?: unknown }).info
  if (!info || typeof info !== 'object') return null
  const videoData = (info as { videoData?: unknown }).videoData
  if (!videoData || typeof videoData !== 'object') return null
  const title = (videoData as { title?: unknown }).title
  return typeof title === 'string' && title ? title : null
}

interface MusicProps {
  playing?: boolean
}

// Music player with prev/play-pause/next controls.
// `playing` is an external gate: undefined=standalone preview, true=allowed, false=forced pause.
export default function Music({ playing: externalPlaying }: MusicProps) {
  const [internalPlaying, setInternalPlaying] = useState(true)
  const [internalCommand, setInternalCommand] = useState<string | null>(null)
  const [songTitle, setSongTitle] = useState('')
  const isPreview = externalPlaying === undefined
  const effectivePlaying =
    (externalPlaying === undefined || externalPlaying) && internalPlaying
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const lastCommand = useRef<string | null>(null)
  const lastSongTitle = useRef('')

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

  // Keyboard controls (j=prev, k=toggle, l=next)
  useMusicKeys({ onPrev: skipPrev, onToggle: togglePlay, onNext: skipNext })

  // Handle play/pause
  useEffect(() => {
    if (!iframeRef.current) return
    const cmd = effectivePlaying ? 'playVideo' : 'pauseVideo'
    iframeRef.current.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: cmd, args: '' }),
      '*',
    )
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*')
  }, [effectivePlaying])

  // Handle skip commands (next/prev)
  useEffect(() => {
    if (!iframeRef.current || !internalCommand || internalCommand === lastCommand.current) return
    lastCommand.current = internalCommand
    const func = internalCommand.startsWith('next')
      ? 'nextVideo'
      : internalCommand.startsWith('prev')
        ? 'previousVideo'
        : null
    if (func) {
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args: '' }),
        '*',
      )
      iframeRef.current.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*')
    }
  }, [internalCommand])

  // Subscribe to YouTube player events and emit song title changes.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const title = extractSongTitle(event.data)
      if (!title || title === lastSongTitle.current) return
      lastSongTitle.current = title
      setSongTitle(title)
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Re-register "listening" periodically because YouTube may ignore initial registration.
  useEffect(() => {
    const postListening = () => {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*')
    }
    postListening()
    const intervalId = window.setInterval(postListening, 2000)
    return () => window.clearInterval(intervalId)
  }, [])

  const handleIframeLoad = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*')
  }, [])

  return (
    <>
      {isPreview && <div style={{ position: 'fixed', inset: 0, background: '#050509' }} />}
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
      <div className="music-panel">
        <div className="music-controls">
          <button
            type="button"
            className="music-btn"
            onClick={e => {
              e.stopPropagation()
              skipPrev()
            }}
            title="Previous track (J)">
            ⏮
          </button>
          <button
            type="button"
            className="music-btn"
            onClick={e => {
              e.stopPropagation()
              togglePlay()
            }}
            title={effectivePlaying ? 'Pause (K)' : 'Play (K)'}>
            {effectivePlaying ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            className="music-btn"
            onClick={e => {
              e.stopPropagation()
              skipNext()
            }}
            title="Next track (L)">
            ⏭
          </button>
        </div>
      </div>
      <div className="now-playing-label">
        <span>♪ {songTitle || 'NOW PLAYING'}</span>
        <span>♪ {songTitle || 'NOW PLAYING'}</span>
      </div>
    </>
  )
}
