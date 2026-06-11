import React from 'react'
import type { GameSettings } from '../hooks/useGame'

interface SettingsProps {
  settings: GameSettings
  onChange: (partial: Partial<GameSettings>) => void
  onNewGame: () => void
  onClose: () => void
}

const DIFFICULTY_LABELS = [
  [0,    'Trivial'],
  [0.25, 'Easy'],
  [0.5,  'Medium'],
  [0.75, 'Hard'],
  [1.0,  'Maximum'],
] as const

function diffLabel(v: number): string {
  for (let i = DIFFICULTY_LABELS.length - 1; i >= 0; i--) {
    if (v >= DIFFICULTY_LABELS[i][0]) return DIFFICULTY_LABELS[i][1]
  }
  return 'Easy'
}

const Settings: React.FC<SettingsProps> = ({ settings, onChange, onNewGame, onClose }) => {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <div className="settings-body">
          <label className="setting-row">
            <span className="setting-label">
              Difficulty
              <span className="setting-value-tag">{diffLabel(settings.difficulty)}</span>
            </span>
            <input
              type="range" min="0" max="1" step="0.05"
              value={settings.difficulty}
              onChange={e => onChange({ difficulty: parseFloat(e.target.value) })}
              className="difficulty-slider"
              aria-label="Difficulty"
            />
            <div className="slider-labels">
              <span>Trivial</span><span>Easy</span><span>Medium</span><span>Hard</span><span>Max</span>
            </div>
          </label>

          <label className="setting-row setting-row--toggle">
            <span className="setting-label">
              Show mistakes immediately
              <span className="setting-hint">Incorrect digits are highlighted in red</span>
            </span>
            <div
              className={`toggle${settings.showErrors ? ' toggle--on' : ''}`}
              onClick={() => onChange({ showErrors: !settings.showErrors })}
              role="switch"
              aria-checked={settings.showErrors}
              tabIndex={0}
              onKeyDown={e => e.key===' ' && onChange({ showErrors: !settings.showErrors })}
            />
          </label>

          <label className="setting-row setting-row--toggle">
            <span className="setting-label">
              Adaptive difficulty
              <span className="setting-hint">Difficulty adjusts based on your solve speed</span>
            </span>
            <div
              className={`toggle${settings.progressiveDifficulty ? ' toggle--on' : ''}`}
              onClick={() => onChange({ progressiveDifficulty: !settings.progressiveDifficulty })}
              role="switch"
              aria-checked={settings.progressiveDifficulty}
              tabIndex={0}
              onKeyDown={e => e.key===' ' && onChange({ progressiveDifficulty: !settings.progressiveDifficulty })}
            />
          </label>
        </div>

        <div className="settings-footer">
          <button className="btn btn--primary" onClick={() => { onClose(); onNewGame() }}>
            New Game with these settings
          </button>
        </div>
      </div>
    </div>
  )
}

export default Settings
