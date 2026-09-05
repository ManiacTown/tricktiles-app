import { useLayoutEffect, useRef, useState } from 'react';
import './App.css';
import { GameScreen } from './components/GameScreen';
import { DailyChallenge } from './components/DailyChallenge';
import { Profile } from './components/Profile';
import { Badges } from './components/Badges';
import { Leaderboard } from './components/Leaderboard';
import { Footer } from './components/Footer';

type Mode = 'daily' | 'practice' | 'profile' | 'badges' | 'leaderboard';

const TABS: Array<{ mode: Mode; label: string }> = [
  { mode: 'daily', label: 'Daily Challenge' },
  { mode: 'practice', label: 'Practice' },
  { mode: 'profile', label: 'Profile' },
  { mode: 'badges', label: 'Badges' },
  { mode: 'leaderboard', label: 'Leaderboard' },
];

const TAB_SLIDE_DISTANCE = 36;

function App() {
  const [mode, setMode] = useState<Mode>('daily');

  // Tab-switch transition: the panel that becomes visible slides in from
  // the direction OPPOSITE the clicked tab's own position (a tab on the
  // left sends the content in from the right, arriving at its normal
  // resting spot, and vice versa) rather than every switch looking the
  // same regardless of which tab was clicked. Every panel stays mounted
  // (see the render below), so this can't be a remount-driven CSS
  // animation — that would blow away DailyChallenge/GameScreen's live
  // state. Imperative WAAPI on the panel's own DOM node sidesteps that
  // entirely: it's just a transient paint effect on an element that never
  // unmounts, so it can't remount its children.
  const panelRefs = useRef<Partial<Record<Mode, HTMLDivElement | null>>>({});
  const pendingDirectionRef = useRef(0);
  const isFirstRenderRef = useRef(true);

  function handleTabClick(index: number, tabMode: Mode) {
    const mid = (TABS.length - 1) / 2;
    // -1 = tab sits left of center, +1 = right of center, 0 = dead center
    // (the middle tab, if the count is odd) — a plain fade for that case
    // rather than picking an arbitrary left/right.
    pendingDirectionRef.current = index < mid ? -1 : index > mid ? 1 : 0;
    setMode(tabMode);
  }

  useLayoutEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return; // no transition on the initial page load, only real switches
    }
    const el = panelRefs.current[mode];
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const sign = pendingDirectionRef.current;
    const startX = -sign * TAB_SLIDE_DISTANCE; // opposite of the button's own side
    el.animate(
      [
        { transform: `translateX(${startX}px)`, opacity: sign === 0 ? 0 : 0.5 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      { duration: 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
  }, [mode]);

  // Only the Daily/Practice tabs need to fit the viewport with no page
  // scroll (the board/rack/controls layout) — Profile/Badges/Leaderboard
  // keep normal scrolling. This class is the single on/off switch the CSS
  // height-capping rules key off of, toggled before paint so there's no
  // flash of the wrong layout when switching tabs.
  useLayoutEffect(() => {
    const isGameTab = mode === 'daily' || mode === 'practice';
    document.body.classList.toggle('game-tab-active', isGameTab);
  }, [mode]);

  return (
    <>
      <header>
        <div>
          <h1 className="stamp">TRICKTILES</h1>
          <div className="subtitle">Daily Word Grid</div>
        </div>
      </header>

      <div className="controls mode-tabs" style={{ marginTop: 0, marginBottom: '10px' }}>
        {TABS.map((tab, index) => (
          <button
            key={tab.mode}
            className={`mode-tab${mode === tab.mode ? ' active' : ''}`}
            onClick={() => handleTabClick(index, tab.mode)}
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
          flex layout across browsers. Refs feed the tab-switch slide
          animation above — assigned on every panel (not just the active
          one) since which one is "active" changes on every click. */}
      <div
        ref={(el) => {
          panelRefs.current.daily = el;
        }}
        className={`tab-panel${mode === 'daily' ? '' : ' tab-panel-hidden'}`}
      >
        <DailyChallenge active={mode === 'daily'} />
      </div>
      <div
        ref={(el) => {
          panelRefs.current.practice = el;
        }}
        className={`tab-panel${mode === 'practice' ? '' : ' tab-panel-hidden'}`}
      >
        <GameScreen active={mode === 'practice'} />
      </div>
      <div
        ref={(el) => {
          panelRefs.current.profile = el;
        }}
        className={`tab-panel${mode === 'profile' ? '' : ' tab-panel-hidden'}`}
      >
        <Profile />
      </div>
      <div
        ref={(el) => {
          panelRefs.current.badges = el;
        }}
        className={`tab-panel${mode === 'badges' ? '' : ' tab-panel-hidden'}`}
      >
        <Badges />
      </div>
      <div
        ref={(el) => {
          panelRefs.current.leaderboard = el;
        }}
        className={`tab-panel${mode === 'leaderboard' ? '' : ' tab-panel-hidden'}`}
      >
        <Leaderboard />
      </div>

      <Footer />
    </>
  );
}

export default App;
