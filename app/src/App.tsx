import { useState } from 'react';
import './App.css';
import { GameScreen } from './components/GameScreen';
import { DailyChallenge } from './components/DailyChallenge';

type Mode = 'daily' | 'practice';

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
        <button
          id="shuffleBtn"
          className={mode === 'daily' ? 'ready' : undefined}
          style={mode === 'daily' ? { background: 'var(--amber)', color: '#241c14' } : undefined}
          onClick={() => setMode('daily')}
        >
          Daily Challenge
        </button>
        <button
          id="shuffleBtn"
          className={mode === 'practice' ? 'ready' : undefined}
          style={mode === 'practice' ? { background: 'var(--amber)', color: '#241c14' } : undefined}
          onClick={() => setMode('practice')}
        >
          Practice
        </button>
      </div>

      {mode === 'daily' ? <DailyChallenge /> : <GameScreen key="practice" />}
    </>
  );
}

export default App;
