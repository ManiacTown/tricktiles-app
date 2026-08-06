import { useState } from 'react';
import './App.css';
import { GameScreen } from './components/GameScreen';
import { DailyChallenge } from './components/DailyChallenge';
import { Profile } from './components/Profile';
import { Badges } from './components/Badges';
import { Leaderboard } from './components/Leaderboard';

type Mode = 'daily' | 'practice' | 'profile' | 'badges' | 'leaderboard';

const TABS: Array<{ mode: Mode; label: string }> = [
  { mode: 'daily', label: 'Daily Challenge' },
  { mode: 'practice', label: 'Practice' },
  { mode: 'profile', label: 'Profile' },
  { mode: 'badges', label: 'Badges' },
  { mode: 'leaderboard', label: 'Leaderboard' },
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

      <div className="controls mode-tabs" style={{ marginTop: 0, marginBottom: '10px' }}>
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

      {/* Every tab stays mounted and is only hidden via CSS, rather
          than conditionally rendered — switching tabs would otherwise
          unmount/remount each one, losing the in-progress board, fetched
          daily puzzle, etc. every time. Each panel centers its own
          children directly (rather than using display:contents to let
          them be centered by #root) since display:contents has
          historically inconsistent support for promoting children into a
          flex layout across browsers. */}
      <div className={`tab-panel${mode === 'daily' ? '' : ' tab-panel-hidden'}`}>
        <DailyChallenge active={mode === 'daily'} />
      </div>
      <div className={`tab-panel${mode === 'practice' ? '' : ' tab-panel-hidden'}`}>
        <GameScreen active={mode === 'practice'} />
      </div>
      <div className={`tab-panel${mode === 'profile' ? '' : ' tab-panel-hidden'}`}>
        <Profile />
      </div>
      <div className={`tab-panel${mode === 'badges' ? '' : ' tab-panel-hidden'}`}>
        <Badges />
      </div>
      <div className={`tab-panel${mode === 'leaderboard' ? '' : ' tab-panel-hidden'}`}>
        <Leaderboard />
      </div>
    </>
  );
}

export default App;
