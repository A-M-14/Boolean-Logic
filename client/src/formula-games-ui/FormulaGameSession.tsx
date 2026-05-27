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
import type { EvaluationRound, EquivalenceRound } from '@boolean-logic/shared';

import { FormulaDisplay }              from './FormulaDisplay.js';
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
  ServerToClientMessage,
  ClientToServerMessage,
  FormulaNotation,
} from './types.js';

import './FormulaGameSession.css';

export function FormulaGameSession({
  gameType,
  mode,
  difficulty,
  onSessionEnd,
  onPlayAgain,
  onBackToMenu,
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

  const timerRef          = useRef(new TimerManager());
  const pendingElapsedRef = useRef(0);
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

  // ─── Online: handle incoming WebSocket messages ───────────────────────────
  useEffect(() => {
    if (mode !== 'online' || socket == null) return;

    function onMessage(event: MessageEvent) {
      const message = JSON.parse(event.data as string) as ServerToClientMessage;

      switch (message.type) {
        case 'round': {
          answeredRef.current = false;
          setPendingAnswer(null);

          if (message.gameType === 'evaluation') {
            const variables = Object.keys(message.assignment).sort();
            setCurrentRound({
              formula:       { root: message.formula, variables },
              assignment:    message.assignment,
              correctAnswer: false,   // unknown client-side; never used in online mode
            } satisfies EvaluationRound);
          } else {
            setCurrentRound({
              formulaA:      { root: message.formulaA, variables: [] },
              formulaB:      { root: message.formulaB, variables: [] },
              areEquivalent: false,   // unknown client-side; never used in online mode
            } satisfies EquivalenceRound);
          }

          setRoundIndex(message.roundIndex);
          setPhase('playing');
          break;
        }

        case 'round_result': {
          timerRef.current.stop();
          const elapsed     = pendingElapsedRef.current;
          const roundPoints = calculateScore(message.correct, elapsed);
          setTotalScore(message.yourScore);
          setLastResult({ correct: message.correct, points: roundPoints });

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
              correct:      message.correct,
              points:       roundPoints,
              round:        reviewRound,
              playerAnswer: pendingAnswerRef.current,
              gameType,
            }]);
          }

          setPhase('result');
          break;
        }

        case 'opponent_score':
          setOpponentScore(message.score);
          break;

        case 'session_end':
          setTotalScore(message.yourFinalScore);
          setOpponentScore(message.opponentFinalScore);
          setPhase('ended');
          break;
      }
    }

    socket.addEventListener('message', onMessage);
    return () => socket.removeEventListener('message', onMessage);
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
          setTimeout(() => handleAnswerRef.current(null), 1000);  // 1s pause at 0 before advancing
          return 0;
        }
        return previousValue - 1;
      });
    }, 1000);

    return () => clearInterval(id);
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
      // Online: record the answer so the round_result handler can store it
      pendingAnswerRef.current = answer;
      // Send to server; phase transition is driven by 'round_result' message
      const message: ClientToServerMessage = {
        type:           'answer',
        answer,
        elapsedSeconds: elapsed,
      };
      socket.send(JSON.stringify(message));
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
        onMenu={() => onSessionEnd(totalScore)}
        onReviewRound={setReviewRoundIndex}
        onBackToMenu={onBackToMenu}
      />
    );
  }

  // ─── Render: playing / showing result ────────────────────────────────────
  const isAnswered = answeredRef.current || phase === 'result';

  return (
    <div className="formula-game-session-container">

      {/* Notation controls + back button */}
      <div className="formula-game-session-notation-bar">
        <div className="notation-bar-side notation-bar-left">
          {onBackToMenu !== undefined && (
            <button className="game-back-btn" onClick={onBackToMenu}>← Back to Menu</button>
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

      {/* Result feedback (shown for 2 s after submission) */}
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

      {/* Draft pane — cleared each round via key */}
      <DraftPane key={roundIndex} />

    </div>
  );
}
