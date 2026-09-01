import React from 'react';
import './ChallengeControls.css';

interface ChallengeControlsProps {
  onNewChallenge:  () => void;
  onSubmit:        () => void;
  onViewSolution:  () => void;
}

export function ChallengeControls({
  onNewChallenge,
  onSubmit,
  onViewSolution,
}: ChallengeControlsProps) {
  return (
    <div className="challenge-controls">
      <button
        className="challenge-controls__btn challenge-controls__btn--new"
        onClick={onNewChallenge}
        title="Generate a new challenge"
      >
        New Challenge
      </button>
      <button
        className="challenge-controls__btn challenge-controls__btn--submit"
        onClick={onSubmit}
        title="Test your circuit against the challenge"
      >
        Submit for Testing
      </button>
      <button
        className="challenge-controls__btn challenge-controls__btn--solution"
        onClick={onViewSolution}
        title="View a reference solution circuit"
      >
        Show Solution
      </button>
    </div>
  );
}
