import React, { useRef, useState } from 'react';
import type { Difficulty, Challenge, VerificationResult } from '../simulator-challenge-engine/types.js';
import { generateChallenge, verifyCircuit } from '../simulator-challenge-engine/index.js';
import type { CircuitState } from '../logic-circuit-simulator-engine/index.js';
import { CircuitSimulator } from '../logic-circuit-simulator-ui/index.js';
import { ChallengeControls } from './ChallengeControls.js';
import { ChallengePanel }    from './ChallengePanel.js';
import { SubmissionResult }  from './SubmissionResult.js';
import { SolutionDisplay }   from './SolutionDisplay.js';

interface ChallengeSessionProps {
  difficulty: Difficulty;
  onBack:     () => void;
}

export function ChallengeSession({ difficulty, onBack }: ChallengeSessionProps) {
  const [challenge, setChallenge] = useState<Challenge>(() => generateChallenge(difficulty));
  // Incrementing this key force-remounts CircuitSimulator, resetting the canvas.
  const [sessionKey, setSessionKey] = useState(0);

  // Ref kept up-to-date by CircuitSimulator on every render.
  // Read on-demand when the user hits Submit — no extra re-renders.
  const csRef = useRef<CircuitState | undefined>(undefined);

  const [panelOpen,        setPanelOpen]        = useState(false);
  const [submissionResult, setSubmissionResult] = useState<VerificationResult | null>(null);
  const [solutionOpen,     setSolutionOpen]     = useState(false);

  function handleNewChallenge() {
    setChallenge(generateChallenge(difficulty));
    setSessionKey(k => k + 1);
    setPanelOpen(false);
    setSubmissionResult(null);
    setSolutionOpen(false);
  }

  function handleSubmit() {
    const cs = csRef.current;
    if (!cs) return;
    const result = verifyCircuit(cs, challenge.truthTable);
    setSubmissionResult(result);
  }

  // Three buttons injected beside the Back button in the simulator topbar.
  const challengeControls = (
    <ChallengeControls
      onViewChallenge={() => setPanelOpen(true)}
      onNewChallenge={handleNewChallenge}
      onSubmit={handleSubmit}
      onViewSolution={() => setSolutionOpen(true)}
    />
  );

  return (
    <>
      <CircuitSimulator
        key={sessionKey}
        onBack={onBack}
        challengeMode
        extraRightControls={challengeControls}
        csRef={csRef}
      />

      {panelOpen && (
        <ChallengePanel
          truthTable={challenge.truthTable}
          difficulty={difficulty}
          onClose={() => setPanelOpen(false)}
        />
      )}

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
