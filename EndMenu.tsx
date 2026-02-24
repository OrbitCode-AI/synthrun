export default function EndMenuButtons({
  hasCheckpoint,
  primaryLabel,
  onResume,
  onStartOver,
  onChangeShip,
}: {
  hasCheckpoint: boolean
  primaryLabel: string
  onResume: () => void
  onStartOver: () => void
  onChangeShip: () => void
}) {
  return (
    <div className="menu-buttons">
      {hasCheckpoint && (
        <button type="button" className="start-btn" onClick={onResume}>
          {primaryLabel}
        </button>
      )}
      <button
        type="button"
        className={hasCheckpoint ? 'start-btn secondary-btn' : 'start-btn'}
        onClick={onStartOver}>
        START OVER
      </button>
      <button type="button" className="start-btn secondary-btn" onClick={onChangeShip}>
        CHANGE SHIP
      </button>
    </div>
  )
}
