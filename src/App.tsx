import React, { useState, useEffect, useCallback } from 'react'
import Board from './components/Board'
import NumPad from './components/NumPad'
import HintBanner from './components/HintBanner'
import Settings from './components/Settings'
import Completion from './components/Completion'
import { useGame } from './hooks/useGame'

function formatTime(s: number): string {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function diffLabel(v: number): string {
  if (v < 0.15) return 'Trivial'
  if (v < 0.38) return 'Easy'
  if (v < 0.62) return 'Medium'
  if (v < 0.85) return 'Hard'
  return 'Maximum'
}

function App() {
  const game = useGame()
  const [showSettings, setShowSettings] = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)

  // Show completion modal when puzzle is solved
  useEffect(() => {
    if (game.completed) setShowCompletion(true)
  }, [game.completed])

  // Keyboard input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showSettings || showCompletion) return
      if (e.key >= '1' && e.key <= '9') game.inputDigit(parseInt(e.key))
      if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') game.erase()
      if (e.key === 'p' || e.key === 'P') game.setPencilMode(m => !m)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); game.undo() }
      if (e.key === 'h' || e.key === 'H') game.requestHint()
      // Arrow keys for cell navigation
      if (!game.selected) return
      const [r, c] = game.selected
      if (e.key === 'ArrowUp')    game.selectCell(Math.max(0, r-1), c)
      if (e.key === 'ArrowDown')  game.selectCell(Math.min(8, r+1), c)
      if (e.key === 'ArrowLeft')  game.selectCell(r, Math.max(0, c-1))
      if (e.key === 'ArrowRight') game.selectCell(r, Math.min(8, c+1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [game, showSettings, showCompletion])

  const handleNewGame = useCallback(() => {
    setShowCompletion(false)
    game.startNewGame()
  }, [game])

  const highScore = game.highScores[0]?.score ?? 0

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <button
          className="header-btn"
          onClick={handleNewGame}
          aria-label="New game"
          title="New Game"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
        </button>

        <div className="header-center">
          <div className="app-logo-wrap">
            <img src="./z-logo.png" alt="Z" className="app-logo" />
            <h1 className="app-title">Z-Sudoku</h1>
          </div>
          {game.gameData && (
            <span className="difficulty-badge">{diffLabel(game.gameData.difficulty)}</span>
          )}
        </div>

        <button
          className="header-btn"
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
          title="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </header>

      {/* Score bar */}
      <div className="score-bar">
        <div className="score-item">
          <span className="score-label">Time</span>
          <span className="score-value timer" onClick={game.pauseResume} style={{ cursor: 'pointer' }} title="Click to pause">
            {game.running || game.completed ? formatTime(game.elapsed) : '⏸ ' + formatTime(game.elapsed)}
          </span>
        </div>
        {highScore > 0 && (
          <div className="score-item">
            <span className="score-label">Best</span>
            <span className="score-value">{highScore.toLocaleString()}</span>
          </div>
        )}
        {game.completed && (
          <div className="score-item">
            <span className="score-label">Score</span>
            <span className="score-value score-value--highlight">{game.score.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Main content */}
      <main className="main">
        {game.generating ? (
          <div className="generating-spinner">
            <div className="spinner" />
            <p>Generating puzzle…</p>
          </div>
        ) : game.grid.length > 0 ? (
          <>
            {!game.running && !game.completed && (
              <div className="paused-overlay" onClick={game.pauseResume}>
                <p>Paused — tap to resume</p>
              </div>
            )}

            <Board
              grid={game.grid}
              solution={game.gameData?.solution ?? []}
              selected={game.selected}
              hint={game.hint}
              hintPhase={game.hintPhase}
              showErrors={game.settings.showErrors}
              onSelect={game.selectCell}
            />

            {game.hint && (
              <HintBanner
                hint={game.hint}
                phase={game.hintPhase}
                onApply={game.applyHint}
                onDismiss={() => { game.requestHint() }}
              />
            )}

            <NumPad
              pencilMode={game.pencilMode}
              onDigit={game.inputDigit}
              onErase={game.erase}
              onUndo={game.undo}
              onHint={game.requestHint}
              onTogglePencil={() => game.setPencilMode(m => !m)}
              hintPhase={game.hintPhase}
              hasHint={game.hint !== null}
              hintsUsed={game.hintsUsed}
            />
          </>
        ) : (
          <div className="welcome">
            <p>Welcome to Sudoku</p>
            <button className="btn btn--primary" onClick={handleNewGame}>
              Start Game
            </button>
          </div>
        )}
      </main>

      {showSettings && (
        <Settings
          settings={game.settings}
          onChange={game.updateSettings}
          onNewGame={() => game.startNewGame()}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showCompletion && game.gameData && (
        <Completion
          score={game.score}
          highScores={game.highScores}
          difficulty={game.gameData.difficulty}
          timeSeconds={game.elapsed}
          hintsUsed={game.hintsUsed}
          onNewGame={() => { setShowCompletion(false); handleNewGame() }}
          onClose={() => setShowCompletion(false)}
        />
      )}
    </div>
  )
}

export default App
