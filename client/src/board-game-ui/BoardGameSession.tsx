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
import type {
  BoardGameSessionProps,
  BoardServerToClientMessage,
  BoardClientToServerMessage,
} from './types.js';
import './BoardGameSession.css';

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
  const [soloState,        setSoloState]        = useState<SoloState | null>(null);
  const [computerThinking, setComputerThinking] = useState(false);
  const [solutionRevealed, setSolutionRevealed] = useState(false);
  const [victoryDismissed, setVictoryDismissed] = useState(false);

  const boardStateRef = useRef<BoardState | null>(boardState);
  boardStateRef.current = boardState;

  // ─── Online: handle incoming WebSocket messages ───────────────────────────
  useEffect(() => {
    if (!isOnline || socket == null) return;

    function onMessage(event: MessageEvent) {
      const message = JSON.parse(event.data as string) as BoardServerToClientMessage;

      switch (message.type) {
        case 'game_start':
          setLocalPlayer(message.yourPlayer);
          setBoardState(message.state);
          setWaitingForServer(false);
          break;

        case 'state_update':
          setBoardState(message.state);
          setWaitingForServer(false);
          break;

        case 'game_end':
          setBoardState(message.finalState);
          setWaitingForServer(false);
          setPhase('result');
          break;
      }
    }

    socket.addEventListener('message', onMessage);
    return () => socket.removeEventListener('message', onMessage);
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
      const message: BoardClientToServerMessage = { type: 'move', row, col, value };
      socket?.send(JSON.stringify(message));
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
  }, [boardState, phase]);

  function handleShowSolution() {
    if (boardState === null) return;
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
  }

  // ─── Render: result screen ────────────────────────────────────────────────
  if (phase === 'result' && boardMode !== 'single' && boardState !== null) {
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
        <button className="board-game-session__back" onClick={onBack}>← Back To Menu</button>
        <p className="board-game-session__waiting-msg">Waiting for game to start…</p>
      </div>
    );
  }

  // ─── Render: playing ──────────────────────────────────────────────────────
  return (
    <div className="board-game-session">
      <button className="board-game-session__back" onClick={onBack}>← Back To Menu</button>
      <div className="board-game-session__top-right">
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
            redLabel={redLabel}
            blueLabel={blueLabel}
          />
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
    </div>
  );
}
