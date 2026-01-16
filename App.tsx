/**
 * Synth Run - inspired by CubeRun by Adam Karlsten
 * Original: https://cuberun.adamkarlsten.com/
 * Source: https://github.com/akarlsten/cuberun (MIT License)
 */
import { useEffect, useRef, useState, useCallback } from 'preact/hooks'
import { initializeGame } from './Game'
import Music from './Music'
import { useMusicKeys } from './Keyboard'
import ShipPicker from './ShipPicker'
import { type ShipConfig, SHIPS } from './Ships'
import './styles.css'

interface GameInstance {
  start: () => void;
  cleanup: () => void;
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<GameInstance | null>(null)
  const [selectedShip, setSelectedShip] = useState<ShipConfig | null>(null)
  const [selectedAnim, setSelectedAnim] = useState(-1)
  const [started, setStarted] = useState(false)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [victory, setVictory] = useState(false)
  const [paused, setPaused] = useState(false)
  const [musicOn, setMusicOn] = useState(true)
  const [musicCommand, setMusicCommand] = useState<string | null>(null)

  const skipPrev = useCallback(() => setMusicCommand('prev-' + Date.now()), [])
  const skipNext = useCallback(() => setMusicCommand('next-' + Date.now()), [])
  const toggleMusic = useCallback(() => setMusicOn(m => !m), [])

  // Music keyboard shortcuts (j=prev, k=play/pause, l=next)
  useMusicKeys({ onPrev: skipPrev, onToggle: toggleMusic, onNext: skipNext })

  // Enter key to start/restart when menu is showing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selectedShip) {
        // Start or restart when showing a menu (not started, game over, or victory)
        if (!started || gameOver || victory) {
          e.preventDefault()
          setStarted(true)
          setGameOver(false)
          setVictory(false)
          setPaused(false)
          setScore(0)
          gameRef.current?.start()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedShip, started, gameOver, victory])

  // Initialize game when ship is selected
  useEffect(() => {
    if (!containerRef.current || !selectedShip || gameRef.current) return

    gameRef.current = initializeGame(containerRef.current, {
      onScore: setScore,
      onGameOver: () => setGameOver(true),
      onVictory: (finalScore: number) => {
        setScore(finalScore)
        setVictory(true)
      },
      onPause: setPaused,
    }, selectedShip, selectedAnim)

    return () => gameRef.current?.cleanup()
  }, [selectedShip, selectedAnim])

  const handleShipSelect = (ship: ShipConfig, animIndex: number) => {
    setSelectedShip(ship)
    setSelectedAnim(animIndex)
  }

  const handleStart = () => {
    setStarted(true)
    setGameOver(false)
    setVictory(false)
    setPaused(false)
    setScore(0)
    gameRef.current?.start()
  }

  const handleChangeShip = () => {
    gameRef.current?.cleanup()
    gameRef.current = null
    setSelectedShip(null)
    setSelectedAnim(-1)
    setStarted(false)
    setGameOver(false)
    setVictory(false)
    setPaused(false)
  }

  const handleClick = () => window.focus()

  // Show ship picker if no ship selected
  if (!selectedShip) {
    return <ShipPicker onSelect={handleShipSelect} />
  }

  return (
    <div onClick={handleClick} style={{ position: 'fixed', inset: 0 }}>
      {started && <Music playing={musicOn} command={musicCommand} />}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <div className="music-controls">
        <button
          className="music-btn"
          onClick={(e) => { e.stopPropagation(); skipPrev() }}
          title="Previous track (J)"
        >⏮</button>
        <button
          className="music-btn"
          onClick={(e) => { e.stopPropagation(); toggleMusic() }}
          title={musicOn ? 'Pause (K)' : 'Play (K)'}
        >
          {musicOn ? '⏸' : '▶'}
        </button>
        <button
          className="music-btn"
          onClick={(e) => { e.stopPropagation(); skipNext() }}
          title="Next track (L)"
        >⏭</button>
      </div>
      <a
        href="https://cuberun.adamkarlsten.com/"
        target="_blank"
        rel="noopener"
        className="credit"
        onClick={(e) => e.stopPropagation()}
      >
        Inspired by CubeRun
      </a>
      <div className="hud">
        {!started && (
          <div className="menu">
            <h1 className="title">SYNTHWAVE</h1>
            <h2 className="subtitle">RUNNER</h2>
            <p style={{ color: '#00ffff', fontFamily: 'monospace', marginBottom: '1rem' }}>
              Ship: {selectedShip.name}
            </p>
            <button className="start-btn" onClick={handleStart}>START</button>
            <button
              className="start-btn"
              onClick={handleChangeShip}
              style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
            >
              CHANGE SHIP
            </button>
            <p className="controls">WASD move • P pause • Enter start</p>
          </div>
        )}
        {started && !gameOver && !victory && <div className="score">SCORE: {score}</div>}
        {paused && (
          <div className="menu">
            <h1 className="paused">PAUSED</h1>
            <p className="controls">Press P to resume</p>
          </div>
        )}
        {gameOver && !victory && (
          <div className="menu">
            <h1 className="game-over">GAME OVER</h1>
            <p className="final-score">SCORE: {score}</p>
            <button className="start-btn" onClick={handleStart}>RETRY</button>
            <button
              className="start-btn"
              onClick={handleChangeShip}
              style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
            >
              CHANGE SHIP
            </button>
          </div>
        )}
        {victory && (
          <div className="menu">
            <h1 className="victory">VICTORY!</h1>
            <p className="final-score">FINAL SCORE: {score}</p>
            <button className="start-btn" onClick={handleStart}>PLAY AGAIN</button>
            <button
              className="start-btn"
              onClick={handleChangeShip}
              style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
            >
              CHANGE SHIP
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
