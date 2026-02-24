/**
 * Synth Run - inspired by CubeRun by Adam Karlsten
 * Original: https://cuberun.adamkarlsten.com/
 * Source: https://github.com/akarlsten/cuberun (MIT License)
 */
import { useEffect, useRef, useState } from 'preact/hooks'
import { useVar } from 'orbitcode'
import { initializeGame } from './Game'
import Music from './Music'
import ShipPicker from './ShipPicker'
import type { ShipConfig } from './Ships'
import './styles.css'

interface GameInstance {
  start: () => void
  cleanup: () => void
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<GameInstance | null>(null)
  const [selectedShip, setSelectedShip] = useState<ShipConfig | null>(null)
  const [selectedAnim, setSelectedAnim] = useState(-1)
  const [started, setStarted] = useState(false)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useVar('highScore', 0)
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [victory, setVictory] = useState(false)
  const [paused, setPaused] = useState(false)
  const [levelClear, setLevelClear] = useState(false)
  const [currentMajorLevel, setCurrentMajorLevel] = useState(1)
  const [displayShipName, setDisplayShipName] = useState('')

  // Enter key to start/restart when menu is showing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selectedShip) {
        // Start or restart when showing a menu (not started, game over, or victory)
        if (!started || gameOver || victory) {
          e.preventDefault()
          setStarted(true)
          setIsNewHighScore(false)
          setGameOver(false)
          setVictory(false)
          setPaused(false)
          setLevelClear(false)
          setCurrentMajorLevel(1)
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

    gameRef.current = initializeGame(
      containerRef.current,
      {
        onScore: setScore,
        onGameOver: () => setGameOver(true),
        onVictory: (finalScore: number) => {
          setScore(finalScore)
          setVictory(true)
        },
        onPause: setPaused,
        onShipChange: (ship: ShipConfig) => setDisplayShipName(ship.name),
        onLevelClear: () => setLevelClear(true),
        onLevelClearDone: () => {
          setLevelClear(false)
          setCurrentMajorLevel(2)
        },
      },
      selectedShip,
      selectedAnim,
    )

    return () => gameRef.current?.cleanup()
  }, [selectedShip, selectedAnim])

  const handleShipSelect = (ship: ShipConfig, animIndex: number) => {
    setSelectedShip(ship)
    setSelectedAnim(animIndex)
    setDisplayShipName(ship.name)
  }

  const handleStart = () => {
    setStarted(true)
    setIsNewHighScore(false)
    setGameOver(false)
    setVictory(false)
    setPaused(false)
    setLevelClear(false)
    setCurrentMajorLevel(1)
    setScore(0)
    gameRef.current?.start()
  }

  const handleChangeShip = () => {
    gameRef.current?.cleanup()
    gameRef.current = null
    setSelectedShip(null)
    setSelectedAnim(-1)
    setDisplayShipName('')
    setStarted(false)
    setIsNewHighScore(false)
    setGameOver(false)
    setVictory(false)
    setPaused(false)
    setLevelClear(false)
    setCurrentMajorLevel(1)
  }

  const handleClick = () => window.focus()

  useEffect(() => {
    if (!gameOver && !victory) return
    if (score > highScore) {
      setHighScore(score)
      setIsNewHighScore(true)
      return
    }
    setIsNewHighScore(false)
  }, [gameOver, victory, score, highScore, setHighScore])

  // Show ship picker if no ship selected
  if (!selectedShip) {
    return <ShipPicker onSelect={handleShipSelect} />
  }

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleClick}
      role="presentation"
      style={{ position: 'fixed', inset: 0 }}>
      <Music playing={started} />
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <div className="ship-info">
        {highScore > 0 && <p>HIGH SCORE: {highScore}</p>}
        <p>SHIP: {displayShipName}</p>
      </div>
      <div className="hud">
        {!started && (
          <div className="menu">
            <h1 className="title">SYNTH RUN</h1>
            <div className="menu-buttons">
              <button type="button" className="start-btn" onClick={handleStart}>
                START
              </button>
              <button type="button" className="start-btn secondary-btn" onClick={handleChangeShip}>
                CHANGE SHIP
              </button>
            </div>
          </div>
        )}
        {started && !gameOver && !victory && (
          <div className="score-wrap">
            <div className="score">SCORE: {score}</div>
          </div>
        )}
        {levelClear && (
          <div className="menu level-clear-overlay">
            <h1 className="level-clear">LEVEL 1 CLEAR!</h1>
            <p className="level-clear-subtitle">PREPARE FOR FLIGHT MODE</p>
          </div>
        )}
        {(!started || paused || gameOver || victory) && (
          <p className="controls">
            {currentMajorLevel === 2
              ? 'AD move \u00b7 WS fly \u00b7 P pause \u00b7 Enter start'
              : 'AD move \u00b7 WS camera \u00b7 P pause \u00b7 Enter start'}
          </p>
        )}
        {paused && (
          <div className="menu">
            <h1 className="paused">PAUSED</h1>
            <p className="controls resume-hint">Press P to resume</p>
          </div>
        )}
        {gameOver && !victory && (
          <div className="menu">
            <h1 className="game-over">GAME OVER</h1>
            <p className="final-score">SCORE: {score}</p>
            {isNewHighScore && <p className="new-high-score">NEW HIGH SCORE!</p>}
            <div className="menu-buttons">
              <button type="button" className="start-btn" onClick={handleStart}>
                RETRY
              </button>
              <button type="button" className="start-btn secondary-btn" onClick={handleChangeShip}>
                CHANGE SHIP
              </button>
            </div>
          </div>
        )}
        {victory && (
          <div className="menu">
            <h1 className="victory">VICTORY!</h1>
            <p className="final-score">FINAL SCORE: {score}</p>
            {isNewHighScore && <p className="new-high-score">NEW HIGH SCORE!</p>}
            <div className="menu-buttons">
              <button type="button" className="start-btn" onClick={handleStart}>
                PLAY AGAIN
              </button>
              <button type="button" className="start-btn secondary-btn" onClick={handleChangeShip}>
                CHANGE SHIP
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
