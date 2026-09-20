import React, { useMemo } from 'react'
import type { Grid } from '../hooks/useGame'

interface NumPadProps {
  grid?: Grid
  pencilMode: boolean
  onDigit: (d: number) => void
  onErase: () => void
  onUndo: () => void
  onHint: () => void
  onTogglePencil: () => void
  hintPhase: 'pattern' | 'reveal'
  hasHint: boolean
  hintsUsed: number
}

const NumPad: React.FC<NumPadProps> = ({
  grid, pencilMode, onDigit, onErase, onUndo, onHint, onTogglePencil,
  hintPhase, hasHint, hintsUsed
}) => {
  const digitCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 }
    if (!grid) return counts
    for (const row of grid) {
      for (const cell of row) {
        if (cell.value >= 1 && cell.value <= 9) {
          counts[cell.value]++
        }
      }
    }
    return counts
  }, [grid])

  return (
    <div className="numpad">
      <div className="numpad-digits">
        {[1,2,3,4,5,6,7,8,9].map(d => {
          const count = digitCounts[d] || 0
          const remaining = Math.max(0, 9 - count)
          const isComplete = remaining === 0

          return (
            <button
              key={d}
              className={`numpad-digit${isComplete ? ' numpad-digit--complete' : ''}`}
              onClick={() => onDigit(d)}
              aria-label={`${pencilMode ? 'Note' : 'Enter'} ${d}${isComplete ? ' (completed)' : `, ${remaining} remaining`}`}
              disabled={isComplete && !pencilMode}
            >
              <span className="numpad-digit-val">{d}</span>
              {grid && (
                <span className={`numpad-digit-count${isComplete ? ' numpad-digit-count--done' : ''}`}>
                  {isComplete ? '✓' : remaining}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="numpad-actions">
        <button className="action-btn" onClick={onUndo} aria-label="Undo" title="Undo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
          </svg>
          <span>Undo</span>
        </button>

        <button className="action-btn" onClick={onErase} aria-label="Erase" title="Erase">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 20H7L3 16l10-10 7 7-3.5 3.5"/><path d="M6.5 17.5l3-3"/>
          </svg>
          <span>Erase</span>
        </button>

        <button
          className={`action-btn${pencilMode ? ' action-btn--active' : ''}`}
          onClick={onTogglePencil}
          aria-label="Toggle pencil mode"
          title="Notes"
          aria-pressed={pencilMode}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          <span>Notes</span>
        </button>

        <button
          className={`action-btn hint-btn${hasHint && hintPhase === 'pattern' ? ' hint-btn--lit' : ''}`}
          onClick={onHint}
          aria-label={hasHint && hintPhase === 'pattern' ? 'Reveal hint answer' : 'Get hint'}
          title="Hint"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span>{hasHint && hintPhase === 'pattern' ? 'Reveal' : `Hint${hintsUsed > 0 ? ` (${hintsUsed})` : ''}`}</span>
        </button>
      </div>
    </div>
  )
}

export default NumPad
