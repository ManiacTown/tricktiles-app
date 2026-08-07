import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Board } from './Board';
import { Rack } from './Rack';
import { Hud } from './Hud';
import { Controls } from './Controls';
import { Overlay } from './Overlay';
import { PauseOverlay } from './PauseOverlay';
import { advanceRound, createInitialState, gameReducer, hydrateState, toPersistedState } from '../game/gameState';
import type { PersistedGameState } from '../game/gameState';
import { LETTER_VALUES } from '../game/letterBag';
import { COLS, ROUNDS, ROWS } from '../game/rounds';
import { validateBoard } from '../game/validator';
import { scoreRuns } from '../game/scoring';
import { boardFromSolution, type SolutionCell } from '../game/adminSolve';
import type { Board as BoardModel, Tile } from '../game/types';
import { useAuth } from '../supabase/useAuth';

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.8;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function touchDistance(a: Touch, b: Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function statusMessage(
  complete: boolean,
  rackLength: number,
  hasIsolatedTiles: boolean,
  isConnected: boolean,
  allWordsValid: boolean,
  round: number,
): string {
  if (complete) {
    return round < ROUNDS - 1
      ? 'All tiles placed! Ready for the next round.'
      : 'Board complete — finish the game!';
  }
  if (rackLength > 0) {
    return `${rackLength} tile${rackLength === 1 ? '' : 's'} left to place.`;
  }
  if (hasIsolatedTiles) return 'Every tile needs to be part of a word (2+ letters).';
  if (!isConnected) return 'All your words need to connect into one group.';
  if (!allWordsValid) return "Some letters don't form a valid word.";
  return '';
}

const NOT_READY_MESSAGES = [
  "Hold your horses — the board isn't finished yet.",
  'Not so fast! A few tiles are still homeless.',
  "Nice try, but this board's not done cooking.",
];

interface GameScreenProps {
  // Fixed per-round letters for daily-puzzle mode; omitted for practice
  // mode, which deals randomly from the local letter bag instead.
  roundLetters?: string[];
  // Resumes an in-progress (or already-finished) session's board instead of
  // dealing a fresh one. Only meaningful together with roundLetters — the
  // caller (DailyChallenge) is expected to remount GameScreen (via a `key`
  // on the session id) rather than change this prop in place.
  savedState?: PersistedGameState;
  // Debounced checkpoint callback, fired a moment after any board/rack/round
  // change so a closed tab loses at most a few seconds of progress. Omitted
  // in practice mode, which has nowhere to persist to. May return a promise
  // — handleCompleteRound awaits it for the final round specifically, to
  // guarantee that save actually lands before onRoundComplete's RPC flips
  // the session to 'completed' (see that function's comment).
  onSaveState?: (state: PersistedGameState) => void | Promise<void>;
  // Called with the 1-indexed round number right as it's completed —
  // daily mode uses this to record the completion server-side.
  onRoundComplete?: (round: number) => void;
  // Daily-only display number for the result overlay ("Daily Puzzle
  // #122"). Omitted in practice mode, where the overlay shows a plain
  // "(Practice)" label instead — see the hardcoded placeholder note in
  // DailyChallenge.tsx.
  puzzleNumber?: number;
  // Admin/testing shortcut: when provided, shows a "Complete Puzzle"
  // button that jumps straight to the finished state using this
  // pre-solved reference board (see build plan section 6). Only wired up
  // for daily mode, which has one available for free from the generator.
  adminSolution?: SolutionCell[];
  onAdminComplete?: () => void;
  // Whether this GameScreen is the currently-visible tab. App.tsx keeps
  // every tab mounted (to preserve state across switches) rather than
  // conditionally rendering them, which means a hidden GameScreen's own
  // window-level keydown listener would otherwise still fire — typing on
  // one tab could silently place tiles on another, hidden one. Defaults
  // to true for callers that don't need tab-switching (there's only ever
  // one instance in that case).
  active?: boolean;
}

export function GameScreen({
  roundLetters,
  savedState,
  onSaveState,
  onRoundComplete,
  puzzleNumber,
  adminSolution,
  onAdminComplete,
  active = true,
}: GameScreenProps) {
  // Lazy initializer only — savedState/roundLetters are read once at mount.
  // DailyChallenge remounts this component (via `key={gameSession.id}`)
  // whenever the underlying session changes, so there's no case where
  // these props change under a live GameScreen instance.
  const [state, dispatch] = useReducer(gameReducer, null, () =>
    savedState ? hydrateState(savedState, roundLetters) : createInitialState(roundLetters),
  );
  const [activeTileId, setActiveTileId] = useState<string | null>(null);
  // The dragged tile's own on-screen size at the moment the drag starts —
  // applied explicitly to the DragOverlay clone so it renders at its real
  // original size (rack tile, or whatever size the board cell currently
  // is, zoom included) instead of falling back to the base .tile CSS's
  // percentage sizing, which has no meaningful parent to resolve against
  // inside the overlay portal.
  const [activeTileSize, setActiveTileSize] = useState<{ width: number; height: number } | null>(null);
  const [, forceTick] = useState(0);

  // Board+Rack+Controls zoom (see the zoom-wrap render below) — a plain
  // scale applied to everything below the Hud, driven by the mouse wheel
  // (only when the player has chosen "Zoom" over "Scroll" in Profile's
  // config section — see wheelMode below) or a two-finger touch pinch
  // (always on, since pinch doesn't compete with any other gesture the
  // way wheel-scroll does). Lifted up here from what used to be Board's
  // own local zoom state so the rack and controls scale along with the
  // board instead of only the board ending up a mismatched size relative
  // to everything else once zoomed.
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const zoomAreaRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ startDistance: number; startZoom: number } | null>(null);
  // useAuth works the same in both Practice and Daily (AuthProvider wraps
  // the whole app) — an anonymous Practice player just has no profile, so
  // wheelMode falls back to 'scroll' (never hijacks the page's own
  // scrolling for someone who never opted in).
  const { profile } = useAuth();
  const wheelMode = profile?.wheel_mode ?? 'scroll';
  const wheelModeRef = useRef(wheelMode);
  wheelModeRef.current = wheelMode;
  // Set synchronously in handleDragStart/handleDragEnd below (not derived
  // from activeTileId React state, which updates a render late) — a
  // scale change on .zoom-scale WHILE dnd-kit has an active drag in
  // flight is what actually broke dragging: dnd-kit measures/caches
  // droppable cell rects during the drag, and changing the ancestor's
  // transform mid-gesture (e.g. a single stray wheel tick from a
  // trackpad or a scroll-wheel mouse during what's meant to be a plain
  // click-drag — very easy to trigger by accident, not a deliberate
  // zoom) shifts every cell out from under those cached rects, so the
  // drop resolves against stale positions instead of where things
  // visually are. Freezing zoom for the duration of any drag removes
  // that whole failure mode regardless of wheelMode.
  const isDraggingRef = useRef(false);

  // Native listeners with { passive: false }, same reasoning as the old
  // Board-local version: preventDefault is required to actually stop the
  // page from scrolling once zoom mode wants the wheel instead, and
  // React's synthetic wheel handler doesn't reliably allow that. Reads
  // both zoom and wheelMode via refs so the listeners attach once
  // (empty deps) rather than being torn down/re-added on every change.
  useEffect(() => {
    const el = zoomAreaRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      if (isDraggingRef.current) return; // never rescale mid-drag — see isDraggingRef's comment
      if (wheelModeRef.current !== 'zoom') return; // let the page scroll as normal
      e.preventDefault();
      setZoom(clamp(zoomRef.current - e.deltaY * 0.0015, MIN_ZOOM, MAX_ZOOM));
    }

    function onTouchStart(e: TouchEvent) {
      if (isDraggingRef.current) return;
      if (e.touches.length === 2) {
        pinchRef.current = {
          startDistance: touchDistance(e.touches[0], e.touches[1]),
          startZoom: zoomRef.current,
        };
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (isDraggingRef.current) return;
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const ratio = touchDistance(e.touches[0], e.touches[1]) / pinchRef.current.startDistance;
        setZoom(clamp(pinchRef.current.startZoom * ratio, MIN_ZOOM, MAX_ZOOM));
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) pinchRef.current = null;
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const finished = state.endTime !== null;
  // Clicking out of the result overlay (or its Exit button) hides it
  // without un-finishing the round — the board stays visible underneath,
  // read-only (see Controls' disabled prop below). Reset back to false
  // wherever a fresh round actually starts (RESTART, in handleExit below)
  // so a later finish in the same GameScreen instance shows the overlay
  // again instead of staying permanently dismissed.
  const [overlayDismissed, setOverlayDismissed] = useState(false);

  // Tab-visibility auto-pause: stops the on-screen timer while the browser
  // tab is backgrounded, and while this GameScreen's own app-tab isn't the
  // visible one — App.tsx keeps Daily/Practice mounted simultaneously via
  // `active`, so without the `!active` check here, playing Practice for 10
  // minutes and switching back to Daily would silently add those 10
  // minutes to Daily's timer. Deliberately invisible/seamless (no modal) —
  // unlike manuallyPaused below, there's no one to see a modal on a
  // backgrounded or hidden tab anyway.
  //
  // Two independent signals, not just visibilitychange: switching to a
  // different browser tab always changes window focus even on the rare
  // occasion visibilitychange itself doesn't fire promptly (browser/OS
  // dependent), so window blur/focus is a genuine second line of defense
  // here, not a redundant one — this treats "tab not visible" OR "window
  // doesn't have focus" as equally meaning "not being looked at."
  const [tabHidden, setTabHidden] = useState(
    () => document.visibilityState === 'hidden' || !document.hasFocus(),
  );
  useEffect(() => {
    function updateTabHidden() {
      setTabHidden(document.visibilityState === 'hidden' || !document.hasFocus());
    }
    document.addEventListener('visibilitychange', updateTabHidden);
    window.addEventListener('blur', updateTabHidden);
    window.addEventListener('focus', updateTabHidden);
    return () => {
      document.removeEventListener('visibilitychange', updateTabHidden);
      window.removeEventListener('blur', updateTabHidden);
      window.removeEventListener('focus', updateTabHidden);
    };
  }, []);

  // The explicit Pause button (see Hud) — shows the Paused modal, covers
  // the board, and hides the rack (see the Rack render below).
  const [manuallyPaused, setManuallyPaused] = useState(false);
  // `!finished &&` guards against tabHidden toggling after a win and
  // retroactively shrinking the already-locked final time — once the
  // round is over there's nothing left to pause.
  const paused = !finished && (manuallyPaused || tabHidden || !active);

  // Active play time, in ms — the actual source of elapsedSeconds below,
  // and NOT computed as `now - state.startTime` the way it used to be.
  // That wall-clock approach is what caused a real reported bug: it can't
  // tell "time spent away" from "time spent playing," and worse, a real
  // browser can discard/reload a backgrounded tab under memory pressure —
  // when that happens mid-away, this component remounts from scratch, and
  // any in-memory-only pause tracking (the old pausedMs state) is gone
  // with it, so the restored timer silently included the entire away
  // period. Instead this is a plain accumulator that only ever grows by
  // real elapsed time recorded while actually active (not paused, not
  // finished), and it's checkpointed into every save below — so a reload
  // mid-pause restores the exact frozen value the accumulator already
  // had, rather than resuming wall-clock math from a stale startTime.
  //
  // A ref, not state: both this effect and the save effects below need to
  // read/write the authoritative up-to-the-moment value synchronously,
  // without waiting for a setState to actually commit in a later render
  // (which sibling effects in the same commit wouldn't see yet anyway).
  // forceTick (existing) is what actually drives the periodic re-render
  // needed to visibly increment the displayed number.
  const activeMsRef = useRef(savedState?.activeMs ?? 0);
  const activeStartRef = useRef<number | null>(null);

  function flushActiveSegment() {
    if (activeStartRef.current !== null) {
      activeMsRef.current += Date.now() - activeStartRef.current;
      activeStartRef.current = null;
    }
  }

  useEffect(() => {
    if (!paused && !finished) {
      activeStartRef.current = Date.now();
    } else {
      flushActiveSegment();
    }
  }, [paused, finished]);

  useEffect(() => {
    if (finished || paused) return;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [finished, paused]);

  // The live value, including whatever time has passed in the current
  // still-open active segment — flushActiveSegment() only folds a segment
  // into activeMsRef.current once it ENDS, so reading activeMsRef.current
  // alone mid-segment would be stale by however long that segment's been
  // running. Used both for display and (via currentActiveMs() below) for
  // every save checkpoint.
  function currentActiveMs(): number {
    return activeStartRef.current !== null
      ? activeMsRef.current + (Date.now() - activeStartRef.current)
      : activeMsRef.current;
  }

  const elapsedSeconds = Math.floor(currentActiveMs() / 1000);

  // onSaveState is a ref (not a dep of the effects below) since
  // DailyChallenge passes a fresh closure each render.
  const onSaveStateRef = useRef(onSaveState);
  onSaveStateRef.current = onSaveState;

  // All saves — debounced, heartbeat, flush-on-pause, flush-on-finish,
  // and the final-round save — funnel through this single serialized,
  // coalescing queue instead of each firing its own independent fetch.
  // Without it, several of those triggers can land in-flight at the same
  // time (a slow/variable connection makes this easy: the 3s heartbeat
  // alone can overlap a request that's still pending from 3s ago), and
  // nothing stops their responses from arriving at the server, and being
  // *applied*, out of order — a slightly-stale request that happens to
  // land after a newer one silently overwrites it, since every save is an
  // unconditional PATCH of the whole snapshot. That's what "fragmented
  // saves" looks like from the outside: progress that was already
  // persisted appears to unravel for no visible reason. Serializing to at
  // most one in-flight request at a time makes that reordering
  // impossible — the server only ever sees writes in the order they were
  // actually sent. Coalescing (only the latest queued state survives
  // while one's in flight) means a burst of triggers close together costs
  // one extra request, not one per trigger.
  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef<{ state: PersistedGameState; resolvers: (() => void)[] } | null>(null);

  function flushSaveQueue() {
    if (saveInFlightRef.current || !pendingSaveRef.current) return;
    const { state: toSave, resolvers } = pendingSaveRef.current;
    pendingSaveRef.current = null;
    saveInFlightRef.current = true;
    Promise.resolve(onSaveStateRef.current?.(toSave))
      .catch((err) => console.error('Failed to save session state:', err))
      .finally(() => {
        saveInFlightRef.current = false;
        resolvers.forEach((resolve) => resolve());
        flushSaveQueue();
      });
  }

  function requestSave(persisted: PersistedGameState): Promise<void> {
    if (!onSaveStateRef.current) return Promise.resolve();
    return new Promise((resolve) => {
      if (pendingSaveRef.current) {
        pendingSaveRef.current.state = persisted; // newest snapshot always wins
        pendingSaveRef.current.resolvers.push(resolve);
      } else {
        pendingSaveRef.current = { state: persisted, resolvers: [resolve] };
      }
      flushSaveQueue();
    });
  }

  // Debounced checkpoint: requests a save ~1s after board/rack/round
  // settles, rather than on every single tile move.
  useEffect(() => {
    if (!onSaveStateRef.current) return;
    const id = setTimeout(() => requestSave(toPersistedState(state, currentActiveMs())), 1000);
    return () => clearTimeout(id);
  }, [state]);

  // Periodic heartbeat, independent of the debounce above: every few
  // seconds while genuinely active, regardless of whether the board/rack
  // actually changed. Two real reports this was missing: (1) a player who
  // sits thinking without moving a tile for a while, then reloads, sees
  // the timer jump backward to whatever the last *edit*-triggered save
  // happened to be, since nothing else was checkpointing activeMs in the
  // meantime; (2) finishing a round and switching tabs within roughly a
  // second could lose that round's progress if the flush-on-pause save
  // below lost its race with the tab actually being discarded before the
  // request landed. A save this stale is never more than ~3s stale to
  // begin with, so either failure mode now costs a few seconds at worst
  // instead of however long since the last real edit. Reads `state` via a
  // ref rather than depending on it directly so the interval doesn't
  // restart (and its own 3s clock reset) on every tile move — the
  // debounced save above already covers the "just edited" case well.
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    if (!onSaveStateRef.current || paused || finished) return;
    const id = setInterval(() => {
      requestSave(toPersistedState(stateRef.current, currentActiveMs()));
    }, 3000);
    return () => clearInterval(id);
  }, [paused, finished]);

  // Flushes an immediate (non-debounced) save the instant the player stops
  // actively engaging with this tab — backgrounded, switched to a
  // different app-tab, or manually paused. Real-world browsers can
  // discard/reload a backgrounded tab under memory pressure; without this,
  // whatever the debounced save's last snapshot happened to be could be
  // several tile-placements stale, so returning to a freshly-reloaded tab
  // would restore an outdated board. currentActiveMs() here also matters
  // for its own sake, independent of the board: it's the checkpoint that
  // makes activeMsRef recoverable across exactly the reload this is
  // guarding against — see that ref's own comment above. Keyed on `paused`
  // alone (not `state`), same pattern as the finished-flush effect below —
  // only meant to fire once, on the transition into paused.
  useEffect(() => {
    if (paused) requestSave(toPersistedState(state, currentActiveMs()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // Fires immediately (not debounced) the instant the round finishes,
  // racing ahead of the round-complete RPC (DailyChallenge's
  // onRoundComplete) that flips the session to 'completed' server-side —
  // once that happens, RLS silently no-ops any further save, so waiting
  // out the full 1s debounce above risked losing that race and leaving
  // final_board_state stuck on a stale, not-yet-finished snapshot (which
  // made the game look "unfinished," timer and all, on the next reload).
  // Doesn't fully guarantee the ordering, but narrows the window from "the
  // whole debounce" to "however long this one request takes." Deliberately
  // keyed on `finished` alone (not `state`) — only meant to fire once, on
  // the transition into the finished state.
  useEffect(() => {
    if (finished) requestSave(toPersistedState(state, currentActiveMs()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const validation = useMemo(
    () => validateBoard(state.board, state.rack.length === 0),
    [state.board, state.rack.length],
  );

  // Live, whole-board recompute — used to know what completing the current
  // round would lock in, and as the ceiling once it does. Not shown
  // directly once a round is locked; see displayScore below.
  const liveScore = useMemo(
    () => scoreRuns(validation.runs, state.board),
    [validation.runs, state.board],
  );

  const lockedTotal = useMemo(
    () => state.roundScores.reduce((a, b) => a + b, 0),
    [state.roundScores],
  );

  // Floored at the locked total so temporarily disturbing an earlier
  // round's words while building the current one never shows as a scary
  // dip — the number can only drop for real once the round is completed
  // and locks in (see gameState.ts's advanceRound).
  const displayScore = Math.max(lockedTotal, liveScore);

  const allTiles = useMemo(() => {
    const map = new Map<string, Tile>();
    for (const t of state.rack) map.set(t.id, t);
    for (const row of state.board) for (const t of row) if (t) map.set(t.id, t);
    return map;
  }, [state.rack, state.board]);

  // A smaller activation distance means the drag itself starts responding
  // sooner after a pointer-down; closestCenter (rather than the default
  // rectangle-overlap detection) picks whichever cell's center the
  // pointer is nearest to, so a cell can register as the drop target
  // before the dragged tile is even fully over it — the "magnetic" feel.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 2 } }));

  // The cell the next keyboard action targets — real mouse hover normally,
  // or an auto-advanced cell right after a keyboard letter placement (see
  // below). It's React state (not just a ref) because it needs to be
  // visible: Board highlights whichever cell this points at.
  const [typingCursor, setTypingCursor] = useState<{ r: number; c: number } | null>(null);
  const typingCursorRef = useRef(typingCursor);
  typingCursorRef.current = typingCursor;

  const rackRef = useRef(state.rack);
  rackRef.current = state.rack;
  const boardRef = useRef<BoardModel>(state.board);
  boardRef.current = state.board;

  // Marquee-selected board tiles (see Board.tsx) that drag or arrow keys
  // move together as a rigid group instead of individually. A selection
  // of exactly one tile is treated as no selection at all — dragging it
  // falls back to the normal single-tile path, which supports swapping
  // onto an occupied cell; MOVE_GROUP deliberately doesn't (it rejects
  // the whole move instead), since that's the right behavior for a real
  // multi-tile group but would be a regression for ordinary single drags.
  const [selectedTileIds, setSelectedTileIds] = useState<Set<string>>(new Set());
  const selectedTileIdsRef = useRef(selectedTileIds);
  selectedTileIdsRef.current = selectedTileIds;

  const [notReadyMessage, setNotReadyMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!notReadyMessage) return;
    const id = setTimeout(() => setNotReadyMessage(null), 2200);
    return () => clearTimeout(id);
  }, [notReadyMessage]);

  async function handleCompleteRound() {
    if (!validation.complete) {
      setNotReadyMessage(NOT_READY_MESSAGES[Math.floor(Math.random() * NOT_READY_MESSAGES.length)]);
      return;
    }
    const nextRound = state.round + 1;
    const willFinish = nextRound >= ROUNDS;

    if (willFinish) {
      // Save the truly-finished state BEFORE telling the server this
      // (last) round is complete — previously onRoundComplete fired
      // first, giving its RPC (which flips the session to 'completed'
      // server-side) a head start over any save, since the save only ever
      // happened in a later render's effect. Once that RPC lands, RLS
      // silently blocks any further save, so losing this race left
      // final_board_state stuck without a finished snapshot — the exact
      // bug that made a freshly-completed puzzle look wiped out and
      // "unfinished" on the next visit. advanceRound is the same pure
      // function the reducer itself uses; calling it here just to compute
      // what the saved snapshot should be (rather than waiting for the
      // dispatch below to take effect on the next render) means its own
      // Date.now() runs a few ms apart from the dispatch's — harmless,
      // since this endTime is only ever used for display, never scoring.
      await requestSave(toPersistedState(advanceRound(state, liveScore), currentActiveMs()));
    }
    onRoundComplete?.(nextRound);
    dispatch({ type: 'ADVANCE_ROUND', liveScore });
    setSelectedTileIds(new Set());
  }

  function handleDeleteTileAt(r: number, c: number) {
    const tile = boardRef.current[r]?.[c];
    if (!tile) return;
    dispatch({ type: 'MOVE_TILE', tileId: tile.id, to: { kind: 'rack' } });
  }

  // Rigid whole-board shift, one cell at a time — reuses MOVE_GROUP (built
  // for marquee-drag/arrow-nudge) with every placed tile's ID as the
  // group, so a move that would push anything off the edge is rejected as
  // a no-op exactly like a smaller group move would be, with no separate
  // reducer logic needed.
  function handleShiftBoard(dr: number, dc: number) {
    if (paused || finished) return;
    const tileIds: string[] = [];
    for (const row of state.board) for (const t of row) if (t) tileIds.push(t.id);
    if (tileIds.length === 0) return;
    dispatch({ type: 'MOVE_GROUP', tileIds, dr, dc });
  }

  // Refs so the keydown effect below can be attached once (empty deps)
  // while always calling the latest version of these instead of going
  // stale after the first render.
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const handleCompleteRoundRef = useRef(handleCompleteRound);
  handleCompleteRoundRef.current = handleCompleteRound;
  const deleteTileAtRef = useRef(handleDeleteTileAt);
  deleteTileAtRef.current = handleDeleteTileAt;
  const activeRef = useRef(active);
  activeRef.current = active;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  // Once finished, the board is a read-only look-back at an already-scored
  // puzzle — nothing left for a keyboard shortcut to legitimately do.
  const finishedRef = useRef(finished);
  finishedRef.current = finished;

  // Keyboard shortcuts, attached once via refs/callbacks rather than
  // depending on state directly, so the listener never goes stale without
  // needing to be torn down and re-attached on every render.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!activeRef.current || pausedRef.current || finishedRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleCompleteRoundRef.current();
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        dispatchRef.current({ type: 'UNDO' });
        return;
      }

      if (e.key === 'Delete') {
        const cell = typingCursorRef.current;
        if (cell) deleteTileAtRef.current(cell.r, cell.c);
        return;
      }

      if (e.key === 'Escape') {
        setSelectedTileIds(new Set());
        return;
      }

      const ARROW_DELTAS: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      // Shift+Arrow shifts the whole board one cell, regardless of any
      // active marquee selection — checked first so it takes priority over
      // (rather than falling through to) the selection-only nudge below.
      if (e.shiftKey && e.key in ARROW_DELTAS) {
        e.preventDefault();
        const [dr, dc] = ARROW_DELTAS[e.key];
        const tileIds: string[] = [];
        for (const row of boardRef.current) for (const t of row) if (t) tileIds.push(t.id);
        if (tileIds.length > 0) dispatchRef.current({ type: 'MOVE_GROUP', tileIds, dr, dc });
        return;
      }

      if (e.key in ARROW_DELTAS && selectedTileIdsRef.current.size > 0) {
        e.preventDefault();
        const [dr, dc] = ARROW_DELTAS[e.key];
        dispatchRef.current({ type: 'MOVE_GROUP', tileIds: Array.from(selectedTileIdsRef.current), dr, dc });
        return;
      }

      const letter = e.key.toUpperCase();
      if (letter.length !== 1 || letter < 'A' || letter > 'Z') return;
      const cell = typingCursorRef.current;
      if (!cell) return;
      const tile = rackRef.current.find((t) => t.letter === letter);
      if (!tile) return;

      dispatchRef.current({ type: 'MOVE_TILE', tileId: tile.id, to: { kind: 'board', r: cell.r, c: cell.c } });

      // Auto-advance so the player can keep typing to spell a word without
      // touching the mouse. Vertical continuation (down) when there's a
      // tile directly above and nothing to the left suggesting a
      // horizontal word instead; otherwise the default is rightward.
      const board = boardRef.current;
      const above = cell.r > 0 ? board[cell.r - 1][cell.c] : null;
      const left = cell.c > 0 ? board[cell.r][cell.c - 1] : null;
      const vertical = above && !left;
      const dr = vertical ? 1 : 0;
      const dc = vertical ? 0 : 1;
      const inBounds = (p: { r: number; c: number }) => p.r >= 0 && p.r < ROWS && p.c >= 0 && p.c < COLS;

      let next = { r: cell.r + dr, c: cell.c + dc };
      if (inBounds(next) && board[next.r][next.c]) {
        // A single occupied cell in the way — hop over it and keep going
        // in the same direction, rather than landing on (and offering to
        // overwrite) an existing tile that's likely part of the word
        // already. Only for exactly one tile of blockage: if the cell
        // beyond that is also occupied, this isn't a quick hop-over
        // anymore, so just stop at the blocked cell as before.
        const afterNext = { r: next.r + dr, c: next.c + dc };
        if (inBounds(afterNext) && !board[afterNext.r][afterNext.c]) {
          next = afterNext;
        }
      }
      setTypingCursor(inBounds(next) ? next : null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function handleDragStart(event: DragStartEvent) {
    // Belt-and-suspenders for the paused case — the pause modal's backdrop
    // already blocks pointer events from reaching the board, but this
    // covers any edge case (e.g. a drag that started just before pausing).
    // The finished check is the one that actually matters day-to-day: once
    // the round is over and scored, there's no overlay/backdrop blocking
    // the board itself (see Overlay/GameScreen — it stays visible and
    // dismissible underneath the result screen), so without this a player
    // could still drag their already-submitted board's tiles around.
    if (paused || finished) return;
    isDraggingRef.current = true;
    setActiveTileId(event.active.id as string);
    // Measured directly from the DOM via the tile's data-tile-id rather
    // than dnd-kit's own rect.current.initial — with a small activation
    // distance (needed for the "magnetic" drag feel), onDragStart can
    // fire before dnd-kit's internal rect measurement finishes, leaving
    // rect.current.initial null and silently breaking the overlay
    // (nothing throws, it just never renders). The DOM node is always
    // there and measurable the moment the drag starts, so query for it
    // directly instead of relying on dnd-kit's timing.
    const node = document.querySelector<HTMLElement>(`[data-tile-id="${CSS.escape(String(event.active.id))}"]`);
    const rect = node?.getBoundingClientRect() ?? event.active.rect.current.initial;
    setActiveTileSize(rect ? { width: rect.width, height: rect.height } : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    isDraggingRef.current = false;
    setActiveTileId(null);
    setActiveTileSize(null);
    // dnd-kit's own drag machinery (useDraggable's listeners, wired
    // directly onto each tile) runs independently of handleDragStart's
    // early return above — that only skips this component's own overlay
    // state, it doesn't stop dnd-kit from still calling onDragEnd for a
    // gesture that completes anyway. This is the guard that actually
    // matters: without it, a drag started and finished entirely within one
    // gesture would still dispatch a move on a paused/finished board.
    if (paused || finished) return;
    const { active, over } = event;
    if (!over) return;
    const tileId = active.id as string;
    const overId = over.id as string;

    if (overId === 'rack') {
      dispatch({ type: 'MOVE_TILE', tileId, to: { kind: 'rack' } });
      return;
    }
    if (!overId.startsWith('cell-')) return;
    const [, rStr, cStr] = overId.split('-');
    const targetR = Number(rStr);
    const targetC = Number(cStr);

    const selected = selectedTileIdsRef.current;
    if (selected.size > 1 && selected.has(tileId)) {
      const board = boardRef.current;
      let origin: { r: number; c: number } | null = null;
      outer: for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
          if (board[r][c]?.id === tileId) {
            origin = { r, c };
            break outer;
          }
        }
      }
      if (origin) {
        const dr = targetR - origin.r;
        const dc = targetC - origin.c;
        if (dr !== 0 || dc !== 0) {
          dispatch({ type: 'MOVE_GROUP', tileIds: Array.from(selected), dr, dc });
        }
        return;
      }
    }

    dispatch({ type: 'MOVE_TILE', tileId, to: { kind: 'board', r: targetR, c: targetC } });
  }

  const activeTile = activeTileId ? (allTiles.get(activeTileId) ?? null) : null;
  const isLastRound = state.round >= ROUNDS - 1;

  function handleAdminComplete() {
    if (!adminSolution) return;
    const result = boardFromSolution(adminSolution);
    if (!result) return;
    dispatch({ type: 'ADMIN_COMPLETE', board: result.board, score: result.score });
    onAdminComplete?.();
  }

  // Backdrop click or the overlay's own Exit button. Daily mode's puzzle is
  // already scored server-side, so exiting just reveals the finished board
  // underneath (read-only — see Controls' disabled prop below). Practice
  // mode has no other way back into a playable board, so exiting there
  // also deals a fresh one, same as the old "Play Again" behavior.
  function handleExit() {
    setOverlayDismissed(true);
    if (!roundLetters) {
      dispatch({ type: 'RESTART' });
      setSelectedTileIds(new Set());
      setOverlayDismissed(false);
      activeMsRef.current = 0;
      activeStartRef.current = Date.now();
      setManuallyPaused(false);
    }
  }

  return (
    <>
      <Hud
        round={state.round}
        elapsedSeconds={elapsedSeconds}
        score={displayScore}
        onPause={() => setManuallyPaused(true)}
        pauseDisabled={finished}
      />

      {/* Board + rack + controls all scale together (see the zoom state
          above) so the buttons and tiles stay proportional to the board
          instead of the board zooming on its own and leaving everything
          else a mismatched size. overflow:auto lives on the OUTER,
          untransformed wrapper — transform:scale doesn't affect layout
          size, but a scaled child's visual overflow still contributes to
          its scrolling ancestor's scrollable region, so this still lets a
          zoomed-in view be scrolled into view like the board's own
          zoom-wrap used to. */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        // dnd-kit auto-scrolls the nearest scrollable ancestor of the
        // dragged tile by default. Before the zoom-wrap change, board
        // tiles' nearest scrollable ancestor was the small
        // board-only wrapper and rack tiles had none at all; now both
        // sit inside .zoom-wrap (needs overflow:auto so a zoomed-in
        // board can still be scrolled into view — see its own
        // comment), so dnd-kit started auto-scrolling that container
        // during ordinary drags. That's the page-scroll-during-drag
        // behavior explicitly not wanted here, and disabling it also
        // clears up drags that stopped landing correctly.
        autoScroll={false}
      >
        <div className="zoom-wrap" ref={zoomAreaRef}>
          <div className="zoom-scale" style={{ transform: `scale(${zoom})` }}>
            {/* Blurred (not hidden) while manually paused — the letters read as
                indistinct blobs instead of vanishing outright, which reads
                better with the Paused card's own fade/pop-in transition than a
                hard cut to an empty rack did. pointer-events:none is a second
                line of defense alongside handleDragStart's own paused check. */}
            <div className={`playfield${manuallyPaused ? ' playfield-blurred' : ''}`}>
              <Board
                board={state.board}
                cellStatus={validation.cellStatus}
                typingCursor={typingCursor}
                onHoverCell={(cell) => setTypingCursor(cell)}
                onDeleteTile={(tileId) => {
                  // Right-click-to-delete bypasses both the keyboard guard and
                  // handleDragStart's own paused/finished check (see those) —
                  // it's wired straight from TileView's onContextMenu, so it
                  // needs its own guard here.
                  if (paused || finished) return;
                  dispatch({ type: 'MOVE_TILE', tileId, to: { kind: 'rack' } });
                }}
                selectedTileIds={selectedTileIds}
                onSelectionChange={(ids) => setSelectedTileIds(new Set(ids))}
              />
              <Rack rack={state.rack} />
            </div>

            <Controls
              onShift={handleShiftBoard}
              onUndo={() => dispatch({ type: 'UNDO' })}
              onNext={handleCompleteRound}
              canUndo={state.history.length > 0}
              ready={validation.complete}
              isLastRound={isLastRound}
              disabled={finished || paused}
            />
          </div>
        </div>

        {/* Deliberately OUTSIDE .zoom-wrap/.zoom-scale, even though it's
            still inside DndContext (a React-tree relationship, not a DOM
            one — this is fine). dnd-kit's DragOverlay clone positions
            itself with CSS position:fixed to track the cursor, which
            needs the real VIEWPORT as its containing block. Any CSS
            transform on an ancestor — including transform:scale(1),
            mathematically a no-op but still a non-'none' transform value
            — creates a NEW containing block for position:fixed
            descendants per spec. Nesting DragOverlay inside .zoom-scale
            (which always has a transform, even at 1x) was silently
            reinterpreting its "fixed" coordinates relative to
            .zoom-scale's own box instead of the viewport, which is why
            a dragged tile rendered somewhere near its original position
            instead of following the cursor. */}
        <DragOverlay>
          {activeTile && activeTileSize ? (
            <div
              className="tile drag-overlay"
              style={{ width: activeTileSize.width, height: activeTileSize.height }}
            >
              {activeTile.letter}
              <span className="pts">{LETTER_VALUES[activeTile.letter]}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="status">
        {finished
          ? '🎉 Solved!'
          : paused
            ? 'Paused'
            : (notReadyMessage ??
              statusMessage(
                validation.complete,
                state.rack.length,
                validation.hasIsolatedTiles,
                validation.isConnected,
                validation.allWordsValid,
                state.round,
              ))}
      </div>

      {finished && overlayDismissed && (
        <button className="admin-btn" style={{ marginTop: '12px' }} onClick={() => setOverlayDismissed(false)}>
          View Result
        </button>
      )}

      {adminSolution && !finished && (
        <button className="admin-btn" style={{ marginTop: '12px' }} onClick={handleAdminComplete}>
          Admin: Complete Puzzle
        </button>
      )}

      <Overlay
        show={finished && !overlayDismissed}
        finalTime={formatTime(elapsedSeconds)}
        finalScore={lockedTotal}
        rounds={state.roundScores.map((roundScore, i) => ({
          round: i + 1,
          score: roundScore,
          elapsedSeconds: Math.floor(
            (state.roundCompletedAt[i] - (i === 0 ? state.startTime : state.roundCompletedAt[i - 1])) / 1000,
          ),
        }))}
        puzzleNumber={puzzleNumber}
        onExit={handleExit}
      />

      <PauseOverlay show={manuallyPaused} onResume={() => setManuallyPaused(false)} />
    </>
  );
}
