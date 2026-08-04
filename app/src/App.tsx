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

      {mode === 'daily' && <DailyChallenge />}
      {mode === 'practice' && <GameScreen key="practice" />}
      {mode === 'profile' && <Profile />}
    </>
  );
}

export default App;
