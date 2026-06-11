import React from 'react'
import type { ScoreEntry } from '../hooks/useGame'

interface CompletionProps {
  score: number
  highScores: ScoreEntry[]
  difficulty: number
  timeSeconds: number
  hintsUsed: number
  onNewGame: () => void
  onClose: () => void
}

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

const Completion: React.FC<CompletionProps> = ({
  score, highScores, difficulty, timeSeconds, hintsUsed, onNewGame, onClose
}) => {
  const rank = highScores.findIndex(e => e.score === score) + 1
  const isHighScore = rank === 1

  return (
    <div className="completion-overlay" onClick={onClose}>
      <div className="completion-panel" onClick={e => e.stopPropagation()} role="dialog" aria-label="Puzzle complete">
        <div className="completion-header">
          <div className="completion-emoji">{isHighScore ? '🏆' : '✓'}</div>
          <h2>{isHighScore ? 'New High Score!' : 'Puzzle Solved!'}</h2>
        </div>

        <div className="completion-stats">
          <div className="stat">
            <span className="stat-label">Score</span>
            <span className="stat-value stat-value--score">{score.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Time</span>
            <span className="stat-value">{formatTime(timeSeconds)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Difficulty</span>
            <span className="stat-value">{diffLabel(difficulty)}</span>
          </div>
          {hintsUsed > 0 && (
            <div className="stat">
              <span className="stat-label">Hints used</span>
              <span className="stat-value">{hintsUsed}</span>
            </div>
          )}
        </div>

        {highScores.length > 0 && (
          <div className="leaderboard">
            <h3>Top Scores</h3>
            <div className="leaderboard-list">
              {highScores.slice(0, 5).map((entry, i) => (
                <div key={i} className={`leaderboard-row${entry.score === score && i === rank-1 ? ' leaderboard-row--current' : ''}`}>
                  <span className="lb-rank">{i+1}</span>
                  <span className="lb-score">{entry.score.toLocaleString()}</span>
                  <span className="lb-diff">{diffLabel(entry.difficulty)}</span>
                  <span className="lb-time">{formatTime(entry.timeSeconds)}</span>
                  <span className="lb-date">{entry.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn--primary completion-new-game" onClick={onNewGame}>
          New Game
        </button>
      </div>
    </div>
  )
}

export default Completion
