import './SoloFeedbackPanel.css';

interface SoloFeedbackPanelProps {
  currentScore: number;
  optimalScore: number;
}

export function SoloFeedbackPanel({ currentScore, optimalScore }: SoloFeedbackPanelProps) {
  const gap      = optimalScore - currentScore;
  const isOptimal = gap <= 0;

  return (
    <div className={`solo-feedback${isOptimal ? ' solo-feedback--optimal' : ''}`}>
      <div className="solo-feedback__row">
        <span className="solo-feedback__label">Your score</span>
        <span className="solo-feedback__score solo-feedback__score--current">{currentScore}</span>
      </div>
      <div className="solo-feedback__row">
        <span className="solo-feedback__label">Optimal score</span>
        <span className="solo-feedback__score solo-feedback__score--optimal">{optimalScore}</span>
      </div>
      <div className="solo-feedback__row solo-feedback__row--gap">
        {isOptimal ? (
          <span className="solo-feedback__optimal-msg">Optimal solution reached!</span>
        ) : (
          <>
            <span className="solo-feedback__label">Gap</span>
            <span className="solo-feedback__gap">−{gap}</span>
          </>
        )}
      </div>
      {!isOptimal && (
        <p className="solo-feedback__hint">
          Keep modifying bits to close the gap.
        </p>
      )}
    </div>
  );
}
