import React, { useState, useEffect, useRef } from 'react';
import {
  ROUNDS_PER_SESSION,
  ROUND_DURATION_SECONDS,
  TimerManager,
  generateEvaluationRound,
  generateEquivalenceRound,
  submitEvaluationAnswer,
  submitEquivalenceAnswer,
  evaluateFormula,
  checkEquivalence,
  calculateScore,
} from '@boolean-logic/shared';
import type { EvaluationRound, EquivalenceRound, FormulaNode } from '@boolean-logic/shared';

import { FormulaDisplay, nodeToString } from './FormulaDisplay.js';
import { VariableAssignmentDisplay }   from './VariableAssignmentDisplay.js';
import { TimerDisplay }                from './TimerDisplay.js';
import { ScoreDisplay }                from './ScoreDisplay.js';
import { AnswerSelector }              from './AnswerSelector.js';
import { SubmitButton }                from './SubmitButton.js';
import { EquivalenceAnswerButtons }    from './EquivalenceAnswerButtons.js';
import { RoundResult }                 from './RoundResult.js';
import { SessionSummary }             from './SessionSummary.js';
import { RoundReview }                from './RoundReview.js';
import { NotationSelector }           from './NotationSelector.js';
import { NotationLegend }             from './NotationLegend.js';
import { DraftPane }                  from './DraftPane.js';

import type {
  FormulaGameSessionProps,
  SessionPhase,
  RoundResultInfo,
  RoundRecord,
  FormulaNotation,
} from './types.js';

import './FormulaGameSession.css';

const HouseIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="1,8 8,2 15,8" />
    <polyline points="4,8 4,14 12,14 12,8" />
    <polyline points="6.5,14 6.5,10.5 9.5,10.5 9.5,14" />
  </svg>
);

function extractVariables(node: FormulaNode): string[] {
  if (node.type === 'variable') return [node.name];
  if (node.type === 'not')      return extractVariables(node.operand);
  return [...extractVariables(node.left), ...extractVariables(node.right)];
}

export function FormulaGameSession({
  gameType,
  mode,
  difficulty,
  onSessionEnd,
  onPlayAgain,
  onBackToMenu,
  onHome,
  socket,
  playerName = 'You',
  opponentName = 'Opponent',
}: FormulaGameSessionProps) {

  const [phase, setPhase] = useState<SessionPhase>('playing');
  const [roundIndex, setRoundIndex] = useState(0);
  const [currentRound, setCurrentRound] = useState<EvaluationRound | EquivalenceRound | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_DURATION_SECONDS);
  const [totalScore, setTotalScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [lastResult, setLastResult] = useState<RoundResultInfo | null>(null);
  const [pendingAnswer, setPendingAnswer] = useState<boolean | null>(null);
  const [roundHistory, setRoundHistory]   = useState<RoundRecord[]>([]);
  const [notation, setNotation]           = useState<FormulaNotation>('mathematical');

  const [reviewRoundIndex, setReviewRoundIndex] = useState<number | null>(null);
  // Online only: true once the local player has submitted and we are waiting
  // for the opponent to submit (so the server can send formula:round_result).
  const [submittedOnline,      setSubmittedOnline]      = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  const timerRef             = useRef(new TimerManager());
  const pendingElapsedRef    = useRef(0);
  // Stores the active countdown interval ID so handleAnswer can clear it
  // immediately, freezing the visual timer the moment the player submits.
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks the player's answer for the current online round so it can be
  // stored in roundHistory when the server's round_result arrives.
  const pendingAnswerRef  = useRef<boolean | null>(null);
  // Always-fresh ref so the online message handler can read the current round
  // without stale-closure issues (the handler's useEffect deps are [mode, socket]).
  const currentRoundRef   = useRef<EvaluationRound | EquivalenceRound | null>(null);

  // Ref used by the countdown interval to always call the latest handleAnswer,
  // avoiding stale-closure issues without making handleAnswer a useCallback.
  const handleAnswerRef = useRef<(answer: boolean | null) => void>(() => {});

  // Synchronous guard against double-submission (user click + timer expiry
  // racing in the same event-loop tick).
  const answeredRef = useRef(false);

  // ─── Solo: generate a round whenever currentRound is cleared ─────────────
  useEffect(() => {
    if (mode !== 'solo' || currentRound !== null || phase !== 'playing') return;

    answeredRef.current = false;
    setPendingAnswer(null);

    const round =
      gameType === 'evaluation'
        ? generateEvaluationRound(difficulty)
        : generateEquivalenceRound(difficulty, Math.random() < 0.5);

    setCurrentRound(round);
  }, [currentRound, phase, mode, gameType, difficulty]);

  // ─── Online: handle incoming Socket.IO events ────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || socket == null) return;

    socket.on('formula:round', (data) => {
      answeredRef.current = false;
      setPendingAnswer(null);
      setSubmittedOnline(false);

      if (data.gameType === 'evaluation') {
        const variables = Object.keys(data.assignment).sort();
        setCurrentRound({
          formula:       { root: data.formula, variables },
          assignment:    data.assignment,
          correctAnswer: false,   // unknown client-side; never used in online mode
        } satisfies EvaluationRound);
      } else {
        setCurrentRound({
          formulaA:      { root: data.formulaA, variables: [...new Set(extractVariables(data.formulaA))].sort() },
          formulaB:      { root: data.formulaB, variables: [...new Set(extractVariables(data.formulaB))].sort() },
          areEquivalent: false,   // unknown client-side; computed in formula:round_result
          proof:         data.proof,
        } satisfies EquivalenceRound);
      }

      setRoundIndex(data.roundIndex);
      setPhase('playing');
    });

    socket.on('formula:round_result', (data) => {
      if (timerRef.current.isRunning()) timerRef.current.stop();
      const elapsed     = pendingElapsedRef.current;
      const roundPoints = calculateScore(data.correct, elapsed);
      setTotalScore(data.yourScore);
      setLastResult({ correct: data.correct, points: roundPoints });

      // Compute correct answers locally (they were placeholders in online mode)
      // so the stored round can be used for review with a "Show Solution" button.
      const prevRound = currentRoundRef.current;
      if (prevRound !== null) {
        let reviewRound: EvaluationRound | EquivalenceRound = prevRound;
        if (gameType === 'evaluation') {
          const evaluationRound = prevRound as EvaluationRound;
          reviewRound = { ...evaluationRound, correctAnswer: evaluateFormula(evaluationRound.formula.root, evaluationRound.assignment) };
        } else {
          const equivalenceRound = prevRound as EquivalenceRound;
          reviewRound = { ...equivalenceRound, areEquivalent: checkEquivalence(equivalenceRound.formulaA, equivalenceRound.formulaB) };
        }
        setRoundHistory(history => [...history, {
          elapsed,
          correct:      data.correct,
          points:       roundPoints,
          round:        reviewRound,
          playerAnswer: pendingAnswerRef.current,
          gameType,
        }]);
      }

      setPhase('result');
    });

    socket.on('formula:opponent_score', (data) => {
      setOpponentScore(data.score);
    });

    socket.on('formula:session_end', (data) => {
      setTotalScore(data.yourFinalScore);
      setOpponentScore(data.opponentFinalScore);
      setPhase('ended');
    });

    socket.on('opponent:disconnected', () => {
      answeredRef.current = true;
      if (countdownIntervalRef.current !== null) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      timerRef.current.stop();
      setOpponentDisconnected(true);
    });

    // All listeners are registered — tell the server we are ready.
    // The server will not emit formula:round until both players signal ready,
    // preventing the race where the event arrives before this useEffect runs.
    socket.emit('formula:ready');

    return () => {
      socket.off('formula:round');
      socket.off('formula:round_result');
      socket.off('formula:opponent_score');
      socket.off('formula:session_end');
      socket.off('opponent:disconnected');
    };
  }, [mode, socket]);

  // ─── Countdown: starts when a round is ready and we are in playing phase ──
  useEffect(() => {
    if (phase !== 'playing' || currentRound === null) return;

    timerRef.current.start();
    setSecondsLeft(ROUND_DURATION_SECONDS);

    const id = setInterval(() => {
      setSecondsLeft(previousValue => {
        if (previousValue <= 1) {
          clearInterval(id);
          countdownIntervalRef.current = null;
          setTimeout(() => handleAnswerRef.current(null), 1000);  // 1s pause at 0 before advancing
          return 0;
        }
        return previousValue - 1;
      });
    }, 1000);

    countdownIntervalRef.current = id;
    return () => {
      clearInterval(id);
      countdownIntervalRef.current = null;
    };
  }, [phase, currentRound]);

  // ─── Auto-advance after showing result (solo only) ────────────────────────
  useEffect(() => {
    if (phase !== 'result' || mode !== 'solo') return;

    const id = setTimeout(() => {
      if (roundIndex + 1 >= ROUNDS_PER_SESSION) {
        setPhase('ended');
      } else {
        setRoundIndex(previousValue => previousValue + 1);
        setCurrentRound(null);   // triggers round-generation effect
        setPhase('playing');
      }
    }, 2000);

    return () => clearTimeout(id);
  }, [phase, roundIndex, mode]);

  // ─── Handle player answer ─────────────────────────────────────────────────
  function handleAnswer(answer: boolean | null): void {
    if (answeredRef.current || phase !== 'playing' || currentRound === null) return;

    answeredRef.current = true;
    timerRef.current.stop();

    const elapsed = timerRef.current.getElapsedSeconds();
    pendingElapsedRef.current = elapsed;

    // Timeout: always incorrect, no points, skip result screen
    if (answer === null) {
      setRoundHistory(history => [...history, {
        elapsed,
        correct:      false,
        points:       0,
        round:        currentRound,
        playerAnswer: null,
        gameType,
      }]);
      if (roundIndex + 1 >= ROUNDS_PER_SESSION) {
        setPhase('ended');
      } else {
        setRoundIndex(previousValue => previousValue + 1);
        setCurrentRound(null);
        setPhase('playing');
      }
      return;
    }

    if (mode === 'solo') {
      let correct: boolean;
      let points:  number;

      if (gameType === 'evaluation') {
        const round  = currentRound as EvaluationRound;
        const result = submitEvaluationAnswer(round, answer, elapsed);
        correct = answer === round.correctAnswer;
        points  = result.score;
      } else {
        const round  = currentRound as EquivalenceRound;
        const result = submitEquivalenceAnswer(round, answer, elapsed);
        correct = answer === round.areEquivalent;
        points  = result.score;
      }

      setTotalScore(previousValue => previousValue + points);
      setLastResult({ correct, points });
      setRoundHistory(history => [...history, {
        elapsed,
        correct,
        points,
        round:        currentRound,
        playerAnswer: answer,
        gameType,
      }]);
      setPhase('result');

    } else if (socket != null) {
      // Freeze the visual countdown immediately so the player sees their
      // submission time locked in while waiting for the opponent.
      if (countdownIntervalRef.current !== null) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setSubmittedOnline(true);

      // Online: record the answer so the round_result handler can store it
      pendingAnswerRef.current = answer;
      // Emit to server; phase transition is driven by 'formula:round_result' event
      if (gameType === 'evaluation') {
        socket.emit('formula:evaluation_answer', { result: answer, elapsedSeconds: elapsed });
      } else {
        socket.emit('formula:equivalence_answer', { areEquivalent: answer, elapsedSeconds: elapsed });
      }
    }
  }

  // Keep refs pointing to the latest values
  handleAnswerRef.current  = handleAnswer;
  currentRoundRef.current  = currentRound;

  // ─── Reset for "Play Again" (solo only) ───────────────────────────────────
  function startNewSession(): void {
    answeredRef.current    = false;
    pendingAnswerRef.current = null;
    setPhase('playing');
    setRoundIndex(0);
    setTotalScore(0);
    setLastResult(null);
    setSecondsLeft(ROUND_DURATION_SECONDS);
    setPendingAnswer(null);
    setRoundHistory([]);
    setReviewRoundIndex(null);
    setCurrentRound(null);   // triggers round-generation effect
  }

  // ─── Render: session ended ────────────────────────────────────────────────
  if (phase === 'ended') {
    // Show Round Review when a row was clicked
    if (reviewRoundIndex !== null) {
      return (
        <RoundReview
          record={roundHistory[reviewRoundIndex]}
          roundNumber={reviewRoundIndex + 1}
          onBack={() => setReviewRoundIndex(null)}
          onBackToMenu={onBackToMenu}
          onHome={onHome}
        />
      );
    }

    if (mode === 'solo') {
      return (
        <SessionSummary
          mode="solo"
          finalScore={totalScore}
          roundHistory={roundHistory}
          onPlayAgain={() => { startNewSession(); onPlayAgain?.(); }}
          onMenu={() => onSessionEnd(totalScore)}
          onReviewRound={setReviewRoundIndex}
          onBackToMenu={onBackToMenu}
          onHome={onHome}
        />
      );
    }
    return (
      <SessionSummary
        mode="online"
        finalScore={totalScore}
        opponentScore={opponentScore}
        playerName={playerName}
        opponentName={opponentName}
        roundHistory={roundHistory}
        onPlayAgain={onPlayAgain ?? (() => onSessionEnd(totalScore))}
        onReviewRound={setReviewRoundIndex}
        onBackToMenu={onBackToMenu}
        onHome={onHome}
      />
    );
  }

  // ─── Render: playing / showing result ────────────────────────────────────
  const isAnswered = answeredRef.current || phase === 'result' || opponentDisconnected;

  return (
    <div className="formula-game-session-container">

      {/* Notation controls + back button */}
      <div className="formula-game-session-notation-bar">
        <div className="notation-bar-side notation-bar-left">
          {onBackToMenu !== undefined && (
            <button className="game-back-btn" onClick={onBackToMenu}>← Back to Menu</button>
          )}
          {onHome !== undefined && (
            <button className="home-btn" onClick={onHome}><HouseIcon /> Home</button>
          )}
        </div>
        <div className="notation-bar-center">
          <NotationSelector notation={notation} onChange={setNotation} />
          <NotationLegend />
        </div>
        <div className="notation-bar-side notation-bar-right" />
      </div>

      {/* Header: round counter + score */}
      <div className="formula-game-session-header">
        <span className="formula-game-session-round-label">
          Round {roundIndex + 1} / {ROUNDS_PER_SESSION}
        </span>
        {mode === 'solo' ? (
          <ScoreDisplay mode="solo" score={totalScore} />
        ) : (
          <ScoreDisplay
            mode="online"
            score={totalScore}
            opponentScore={opponentScore}
            playerName={playerName}
            opponentName={opponentName}
          />
        )}
      </div>

      {/* Timer */}
      <TimerDisplay secondsLeft={secondsLeft} />

      {/* Formula area */}
      <div className="formula-game-session-formula-area">
        {currentRound !== null && gameType === 'evaluation' && (
          <>
            <div className="formula-game-session-evaluation-formula-row">
              <FormulaDisplay
                node={(currentRound as EvaluationRound).formula.root}
                notation={notation}
              />
              <span className="formula-game-session-evaluation-equals-sign">=</span>
              <AnswerSelector
                value={pendingAnswer}
                onChange={setPendingAnswer}
                disabled={isAnswered}
              />
            </div>
            <VariableAssignmentDisplay
              assignment={(currentRound as EvaluationRound).assignment}
            />
          </>
        )}
        {currentRound !== null && gameType === 'equivalence' && (
          <>
            <FormulaDisplay
              node={(currentRound as EquivalenceRound).formulaA.root}
              label="A"
              notation={notation}
            />
            <FormulaDisplay
              node={(currentRound as EquivalenceRound).formulaB.root}
              label="B"
              notation={notation}
            />
          </>
        )}
      </div>

      {/* Result feedback — shown for 2 s then auto-advances (solo) or until
          the server sends the next formula:round event (online). */}
      {phase === 'result' && lastResult !== null && (
        <div className="formula-game-session-result-row">
          <RoundResult result={lastResult} />
        </div>
      )}

      {/* Answer controls */}
      {gameType === 'evaluation' && (
        <div className="formula-game-session-submit-row">
          <SubmitButton
            onSubmit={() => handleAnswer(pendingAnswer)}
            disabled={isAnswered || pendingAnswer === null}
          />
        </div>
      )}
      {gameType === 'equivalence' && (
        <EquivalenceAnswerButtons
          onAnswer={handleAnswer}
          disabled={isAnswered}
        />
      )}

      {/* Online: "submitted, waiting for opponent" indicator */}
      {mode === 'online' && submittedOnline && phase === 'playing' && !opponentDisconnected && (
        <p className="formula-game-waiting-msg">Waiting for opponent…</p>
      )}

      {/* Draft pane — pre-filled with the round's formula; remounted each round via key */}
      {currentRound !== null && (
        <DraftPane
          key={roundIndex}
          initialText={
            gameType === 'evaluation'
              ? `${nodeToString((currentRound as EvaluationRound).formula.root, notation)} = `
              : `A: ${nodeToString((currentRound as EquivalenceRound).formulaA.root, notation)} = \nB: ${nodeToString((currentRound as EquivalenceRound).formulaB.root, notation)} = `
          }
        />
      )}

      {opponentDisconnected && (
        <div className="formula-game-disconnect-overlay">
          <div className="formula-game-disconnect-modal">
            <p className="formula-game-disconnect-title">Opponent Disconnected</p>
            <p className="formula-game-disconnect-msg">Your opponent has left the game.</p>
            <div className="formula-game-disconnect-actions">
              {onBackToMenu !== undefined && (
                <button className="game-back-btn" onClick={onBackToMenu}>← Back to Menu</button>
              )}
              {onHome !== undefined && (
                <button className="home-btn" onClick={onHome}><HouseIcon /> Home</button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
