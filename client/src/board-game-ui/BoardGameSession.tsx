import { useState, useEffect, useCallback, useRef } from 'react';
import {
  initializeBoard,
  applyMove,
  computeOptimalSolution,
  computeFullScore,
} from '@boolean-logic/shared';
import type { BoardState, BitValue, Player } from '@boolean-logic/shared';
import { selectComputerMove } from '../computer-player-engine/index.js';

import { GameBoard }         from './GameBoard.js';
import { ScoreDisplay }      from './ScoreDisplay.js';
import { TurnIndicator }     from './TurnIndicator.js';
import { GameResultDisplay } from './GameResultDisplay.js';
import { RulesDialog }       from './RulesDialog.js';
import type { BoardGameSessionProps } from './types.js';
import './BoardGameSession.css';

const HouseIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="1,8 8,2 15,8" />
    <polyline points="4,8 4,14 12,14 12,8" />
    <polyline points="6.5,14 6.5,10.5 9.5,10.5 9.5,14" />
  </svg>
);

type Phase = 'playing' | 'result';

interface SoloState {
  optimalScore: number;
}

export function BoardGameSession({
  boardMode,
  difficulty,
  socket,
  playerName   = 'You',
  opponentName = 'Opponent',
  onBack,
  onHome,
  onPlayAgain: onPlayAgainProp,
}: BoardGameSessionProps) {

  const isOnline = boardMode === 'online';
  const gameMode = boardMode === 'single' ? 'solo' : 'two-player';

  const initBoard = () => {
    const state = initializeBoard(gameMode);
    return boardMode === 'vs-computer' ? { ...state, currentPlayer: 'blue' as const } : state;
  };

  const [boardState, setBoardState] = useState<BoardState | null>(
    isOnline ? null : initBoard(),
  );
  const [localPlayer, setLocalPlayer] = useState<Player>(
    boardMode === 'vs-computer' ? 'blue' : 'red',
  );
  const [waitingForServer, setWaitingForServer] = useState(false);
  const [phase,            setPhase]            = useState<Phase>('playing');
  const [rulesOpen,        setRulesOpen]        = useState(false);
  const [soloState,           setSoloState]           = useState<SoloState | null>(null);
  const [computerThinking,    setComputerThinking]    = useState(false);
  const [solutionRevealed,    setSolutionRevealed]    = useState(false);
  const [victoryDismissed,    setVictoryDismissed]    = useState(false);
  const [playerScoreAtReveal, setPlayerScoreAtReveal] = useState<number | null>(null);
  const [resultDismissed,      setResultDismissed]      = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  const boardStateRef = useRef<BoardState | null>(boardState);
  boardStateRef.current = boardState;

  // ─── Online: handle incoming Socket.IO events ────────────────────────────
  useEffect(() => {
    if (!isOnline || socket == null) return;

    socket.on('board:game_start', (data) => {
      setLocalPlayer(data.yourPlayer);
      setBoardState(data.state);
      setWaitingForServer(false);
    });

    socket.on('board:state_update', (data) => {
      setBoardState(data.state);
      setWaitingForServer(false);
    });

    socket.on('board:game_end', (data) => {
      setBoardState(data.finalState);
      setWaitingForServer(false);
      setPhase('result');
    });

    socket.on('opponent:disconnected', () => setOpponentDisconnected(true));

    // All listeners are registered — tell the server we are ready.
    // The server will not emit board:game_start until both players signal
    // ready, preventing the race where the event arrives before this effect runs.
    socket.emit('board:ready');

    return () => {
      socket.off('board:game_start');
      socket.off('board:state_update');
      socket.off('board:game_end');
      socket.off('opponent:disconnected');
    };
  }, [isOnline, socket]);

  // ─── vs-computer: trigger computer move when it's the computer's turn ─────
  const isComputerTurn =
    boardMode === 'vs-computer' &&
    boardState !== null &&
    boardState.currentPlayer === 'red' &&
    !boardState.isComplete;

  useEffect(() => {
    if (!isComputerTurn || phase !== 'playing' || computerThinking) return;

    setComputerThinking(true);
    const timer = setTimeout(() => {
      const state = boardStateRef.current;
      if (state === null) return;
      const move = selectComputerMove(state, difficulty ?? 'medium', 'red');
      const { newState } = applyMove(state, move);
      setBoardState(newState);
      setComputerThinking(false);
      if (newState.isComplete) setPhase('result');
    }, 350);

    return () => clearTimeout(timer);
  }, [isComputerTurn, difficulty, phase]); // computerThinking intentionally omitted: including it causes the re-render it triggers to cancel the timer via cleanup before it fires

  // ─── Solo: compute optimal score whenever the board is fully filled ────────
  useEffect(() => {
    if (boardMode !== 'single' || boardState === null || !boardState.isComplete) return;
    const result = computeOptimalSolution(boardState.cells);
    setSoloState({ optimalScore: result.optimalScore });
  }, [boardMode, boardState]);

  // ─── Derived solo flags ────────────────────────────────────────────────────
  const isVictory =
    boardMode === 'single' &&
    !solutionRevealed &&
    soloState !== null &&
    boardState !== null &&
    boardState.scores.red >= soloState.optimalScore;

  // ─── Board disabled logic ─────────────────────────────────────────────────
  const boardDisabled = (() => {
    if (phase !== 'playing' || boardState === null) return true;
    if (opponentDisconnected) return true;
    if (boardMode === 'single') {
      return solutionRevealed || isVictory;
    }
    if (boardState.isComplete) return true;
    if (boardMode === 'vs-computer' && (isComputerTurn || computerThinking)) return true;
    if (isOnline && (boardState.currentPlayer !== localPlayer || waitingForServer)) return true;
    return false;
  })();

  // ─── Handle a bit placement ───────────────────────────────────────────────
  const handlePlace = useCallback((row: number, col: number, value: BitValue) => {
    if (phase !== 'playing' || boardState === null) return;

    if (isOnline) {
      if (waitingForServer) return;
      socket?.emit('board:move', { row, col, value });
      setWaitingForServer(true);
      return;
    }

    try {
      const { newState } = applyMove(boardState, { row, col, value });
      setBoardState(newState);
      if (newState.isComplete && boardMode !== 'single') setPhase('result');
    } catch {
      // Invalid move — silently ignore
    }
  }, [boardState, boardMode, isOnline, phase, socket, waitingForServer]);

  const handleClear = useCallback((row: number, col: number) => {
    if (phase !== 'playing' || boardState === null) return;
    const cell = boardState.cells[row][col];
    if (cell.type !== 'bit' || cell.value === null) return;
    const newCells = boardState.cells.map((rowCells, r) =>
      rowCells.map((c, cl) =>
        r === row && cl === col && c.type === 'bit'
          ? { type: 'bit' as const, value: null, placedBy: null }
          : c
      )
    );
    const newScores = computeFullScore(newCells);
    setBoardState({ ...boardState, cells: newCells, scores: newScores, isComplete: false });
    setSoloState(null);
    setPlayerScoreAtReveal(null);
  }, [boardState, phase]);

  function handleShowSolution() {
    if (boardState === null) return;
    setPlayerScoreAtReveal(boardState.scores.red);
    const { optimalScore, solution } = computeOptimalSolution(boardState.cells);
    const newCells = boardState.cells.map((row, r) =>
      row.map((cell, c) => {
        if (cell.type === 'gate') return cell;
        return { type: 'bit' as const, value: solution[r][c]!, placedBy: 'red' as const };
      })
    );
    const newScores = computeFullScore(newCells);
    setBoardState({ ...boardState, cells: newCells, scores: newScores, isComplete: true });
    setSoloState({ optimalScore });
    setSolutionRevealed(true);
  }

  function handlePlayAgain() {
    if (isOnline) return;
    setBoardState(initBoard());
    setPhase('playing');
    setSoloState(null);
    setComputerThinking(false);
    setSolutionRevealed(false);
    setVictoryDismissed(false);
    setPlayerScoreAtReveal(null);
    setResultDismissed(false);
  }

  // ─── Render: result screen ────────────────────────────────────────────────
  if (phase === 'result' && boardMode === 'two-player' && boardState !== null) {
    return (
      <div className="board-game-session">
        <GameResultDisplay
          scores={boardState.scores}
          boardMode={boardMode}
          playerName={playerName}
          opponentName={opponentName}
          localPlayer={localPlayer}
          onPlayAgain={handlePlayAgain}
          onBack={onBack}
        />
      </div>
    );
  }

  // ─── Render: waiting for server ───────────────────────────────────────────
  if (isOnline && boardState === null) {
    return (
      <div className="board-game-session board-game-session--waiting">
        <div className="board-game-session__nav">
          <button className="board-game-session__back" onClick={onBack}>← Back To Menu</button>
          {onHome !== undefined && <button className="home-btn" onClick={onHome}><HouseIcon /> Home</button>}
        </div>
        <p className="board-game-session__waiting-msg">Waiting for game to start…</p>
      </div>
    );
  }

  // ─── Render: playing ──────────────────────────────────────────────────────
  return (
    <div className={`board-game-session${boardMode === 'single' ? ' board-game-session--solo' : ''}`}>
      <div className="board-game-session__nav">
        <button className="board-game-session__back" onClick={onBack}>← Back To Menu</button>
        {onHome !== undefined && <button className="home-btn" onClick={onHome}><HouseIcon /> Home</button>}
      </div>
      <div className="board-game-session__top-right">
        {boardMode === 'single' && (
          <button className="board-game-session__new-round" onClick={handlePlayAgain}>
            New Round
          </button>
        )}
        {boardMode === 'single' && !solutionRevealed && !isVictory && (
          <button className="board-game-session__show-solution" onClick={handleShowSolution}>
            Reveal Solution
          </button>
        )}
        <button className="board-game-session__rules-btn" onClick={() => setRulesOpen(true)}>Game Instructions</button>
      </div>

      {boardMode !== 'single' && boardState !== null && !boardState.isComplete && (
        <TurnIndicator
          currentPlayer={boardState.currentPlayer}
          boardMode={boardMode}
          isComputerTurn={isComputerTurn || computerThinking}
          localPlayer={localPlayer}
          playerName={playerName}
          opponentName={opponentName}
        />
      )}

      {boardState !== null && (
        <GameBoard
          state={boardState}
          disabled={boardDisabled}
          onPlace={handlePlace}
          onClear={boardMode === 'single' ? handleClear : undefined}
        />
      )}

      {boardState !== null && (() => {
        const redLabel  = boardMode === 'vs-computer' ? 'Computer'
                        : isOnline ? (localPlayer === 'red' ? 'You' : 'Opponent')
                        : 'Red';
        const blueLabel = boardMode === 'vs-computer' ? 'You'
                        : isOnline ? (localPlayer === 'blue' ? 'You' : 'Opponent')
                        : 'Blue';
        return (
          <ScoreDisplay
            scores={boardState.scores}
            gameMode={gameMode}
            optimalScore={soloState?.optimalScore}
            playerScore={playerScoreAtReveal ?? undefined}
            redLabel={redLabel}
            blueLabel={blueLabel}
          />
        );
      })()}

      {phase === 'result' && (boardMode === 'vs-computer' || boardMode === 'online') && boardState !== null && !resultDismissed && (() => {
        const { scores } = boardState;
        const winningColor = scores.red > scores.blue ? 'red' : scores.blue > scores.red ? 'blue' : null;
        const isDraw       = winningColor === null;
        const localWins    = !isDraw && winningColor === localPlayer;
        const opponentDisplayName = boardMode === 'vs-computer' ? 'Computer' : opponentName;
        const winnerText   = isDraw
          ? 'It\u2019s a draw!'
          : `The winner is: ${localWins ? playerName : opponentDisplayName}`;
        const winnerMod    = isDraw ? 'result-draw' : `result-${winningColor}`;
        const blueLabel    = localPlayer === 'blue' ? playerName : opponentDisplayName;
        const redLabel     = localPlayer === 'red'  ? playerName : opponentDisplayName;
        return (
          <div className="board-game-session__result-overlay">
            <div className={`board-game-session__result-modal board-game-session__result-modal--${winnerMod}`}>
              <button
                className="board-game-session__result-close"
                onClick={() => setResultDismissed(true)}
                aria-label="Close"
              >✕</button>
              <p className="board-game-session__result-title">{winnerText}</p>
              <div className="board-game-session__result-scores">
                <span className="board-game-session__result-score board-game-session__result-score--blue">{blueLabel}: {scores.blue}</span>
                <span className="board-game-session__result-score-sep">–</span>
                <span className="board-game-session__result-score board-game-session__result-score--red">{redLabel}: {scores.red}</span>
              </div>
              <div className="board-game-session__result-actions">
                <button
                  className="board-game-session__result-btn board-game-session__result-btn--primary"
                  onClick={isOnline && onPlayAgainProp ? onPlayAgainProp : handlePlayAgain}
                >
                  Play Again
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {isVictory && !victoryDismissed && (
        <div className="board-game-session__victory-overlay">
          <div className="board-game-session__victory-modal">
            <button
              className="board-game-session__victory-close"
              onClick={() => setVictoryDismissed(true)}
              aria-label="Close"
            >✕</button>
            <p className="board-game-session__victory-title">Maximum Score Reached!</p>
            <p className="board-game-session__victory-sub">You found an optimal solution.</p>
          </div>
        </div>
      )}

      {rulesOpen && (
        <RulesDialog boardMode={boardMode} onClose={() => setRulesOpen(false)} />
      )}

      {opponentDisconnected && (
        <div className="board-game-session__disconnect-overlay">
          <div className="board-game-session__result-modal">
            <p className="board-game-session__result-title" style={{ color: '#94a3b8' }}>
              Opponent Disconnected
            </p>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>
              Your opponent has left the game.
            </p>
            <div className="board-game-session__result-actions">
              <div className="board-game-session__result-back-row">
                <button
                  className="board-game-session__result-btn board-game-session__result-btn--secondary"
                  onClick={onBack}
                >
                  ← Back to Menu
                </button>
                {onHome !== undefined && (
                  <button className="home-btn" onClick={onHome}><HouseIcon /> Home</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
