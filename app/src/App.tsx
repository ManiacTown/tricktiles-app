import { useState } from 'react';
import './App.css';
import { GameScreen } from './components/GameScreen';
import { DailyChallenge } from './components/DailyChallenge';
import { Profile } from './components/Profile';

type Mode = 'daily' | 'practice' | 'profile';

const TABS: Array<{ mode: Mode; label: string }> = [
  { mode: 'daily', label: 'Daily Challenge' },
  { mode: 'practice', label: 'Practice' },
  { mode: 'profile', label: 'Profile' },
];

function App() {
  const [mode, setMode] = useState<Mode>('daily');

  return (
    <>
      <header>
        <div>
          <h1 className="stamp">TRICKTILES</h1>
          <div className="subtitle">Daily Word Grid</div>
        </div>
      </header>

      <div className="controls" style={{ marginTop: 0, marginBottom: '10px' }}>
        {TABS.map((tab) => (
          <button
            key={tab.mode}
            className={`mode-tab${mode === tab.mode ? ' active' : ''}`}
            onClick={() => setMode(tab.mode)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* All three tabs stay mounted and are only hidden via CSS, rather
          than conditionally rendered — switching tabs would otherwise
          unmount/remount each one, losing the in-progress board, fetched
          daily puzzle, etc. every time. */}
      <div style={{ display: mode === 'daily' ? 'contents' : 'none' }}>
        <DailyChallenge active={mode === 'daily'} />
      </div>
      <div style={{ display: mode === 'practice' ? 'contents' : 'none' }}>
        <GameScreen active={mode === 'practice'} />
      </div>
      <div style={{ display: mode === 'profile' ? 'contents' : 'none' }}>
        <Profile />
      </div>
    </>
  );
}

export default App;
