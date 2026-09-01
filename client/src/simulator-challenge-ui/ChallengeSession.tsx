import React, { useRef, useState } from 'react';
import type { Difficulty, Challenge, VerificationResult } from '../simulator-challenge-engine/types.js';
import { generateChallenge, verifyCircuit } from '../simulator-challenge-engine/index.js';
import type { CircuitState } from '../logic-circuit-simulator-engine/index.js';
import { CircuitSimulator } from '../logic-circuit-simulator-ui/index.js';
import { ChallengeControls } from './ChallengeControls.js';
import { ChallengeSidebar }  from './ChallengeSidebar.js';
import { SubmissionResult }  from './SubmissionResult.js';
import { SolutionDisplay }   from './SolutionDisplay.js';

interface ChallengeSessionProps {
  difficulty: Difficulty;
  onBack:     () => void;
  onHome?:    () => void;
}

export function ChallengeSession({ difficulty, onBack, onHome }: ChallengeSessionProps) {
  const [challenge, setChallenge] = useState<Challenge>(() => generateChallenge(difficulty));
  // Incrementing this key force-remounts CircuitSimulator, resetting the canvas.
  const [sessionKey, setSessionKey] = useState(0);

  // Ref kept up-to-date by CircuitSimulator on every render.
  // Read on-demand when the user hits Submit — no extra re-renders.
  const csRef = useRef<CircuitState | undefined>(undefined);

  const [submissionResult, setSubmissionResult] = useState<VerificationResult | null>(null);
  const [solutionOpen,     setSolutionOpen]     = useState(false);

  function handleNewChallenge() {
    setChallenge(generateChallenge(difficulty));
    setSessionKey(k => k + 1);
    setSubmissionResult(null);
    setSolutionOpen(false);
  }

  function handleSubmit() {
    const cs = csRef.current;
    if (!cs) return;
    const result = verifyCircuit(cs, challenge.truthTable);
    setSubmissionResult(result);
  }

  const challengeControls = (
    <ChallengeControls
      onNewChallenge={handleNewChallenge}
      onSubmit={handleSubmit}
      onViewSolution={() => setSolutionOpen(true)}
    />
  );

  const sidebar = (
    <ChallengeSidebar
      truthTable={challenge.truthTable}
      difficulty={difficulty}
    />
  );

  return (
    <>
      <CircuitSimulator
        key={sessionKey}
        onBack={onBack}
        onHome={onHome}
        challengeMode
        extraRightControls={challengeControls}
        rightSidebar={sidebar}
        csRef={csRef}
      />

      {submissionResult !== null && (
        <SubmissionResult
          result={submissionResult}
          referenceGateCount={challenge.referenceGateCount}
          varCount={challenge.truthTable.varCount}
          onClose={() => setSubmissionResult(null)}
        />
      )}

      {solutionOpen && (
        <SolutionDisplay
          referenceCircuit={challenge.referenceCircuit}
          referenceGateCount={challenge.referenceGateCount}
          onClose={() => setSolutionOpen(false)}
        />
      )}
    </>
  );
}
