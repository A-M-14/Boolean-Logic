import React, { useState } from 'react';
import type { Difficulty } from '@boolean-logic/shared';
import type { GameType } from './formula-games-ui/types.js';
import { FormulaGameSession } from './formula-games-ui/FormulaGameSession.js';
import './App.css';

type BoardMode       = 'single' | 'one-on-one' | 'vs-computer';
type FormulaPlayMode = 'solo'   | 'one-on-one';

type Screen =
  | { id: 'main' }
  | { id: 'simulator' }
  | { id: 'board-mode' }
  | { id: 'board-level'; boardMode: BoardMode }
  | { id: 'board-game';  boardMode: BoardMode; difficulty?: Difficulty }
  | { id: 'formula-type' }
  | { id: 'formula-play-mode'; gameType: GameType }
  | { id: 'formula-level'; gameType: GameType; playMode: FormulaPlayMode }
  | { id: 'formula-game';  gameType: GameType; playMode: FormulaPlayMode; difficulty: Difficulty };

// ─── Logo SVG ─────────────────────────────────────────────────────────────────

function AppLogo() {
  return (
    <svg
      className="app-logo"
      viewBox="0 0 160 130"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <filter id="logo-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Connector lines */}
      <line x1="42"  y1="48"  x2="80"  y2="20"  stroke="#64ffda" strokeWidth="1" opacity="0.4" />
      <line x1="118" y1="48"  x2="80"  y2="20"  stroke="#64ffda" strokeWidth="1" opacity="0.4" />
      <line x1="42"  y1="48"  x2="80"  y2="100" stroke="#64ffda" strokeWidth="1" opacity="0.4" />
      <line x1="118" y1="48"  x2="80"  y2="100" stroke="#64ffda" strokeWidth="1" opacity="0.4" />

      {/* ¬  NOT node — left */}
      <circle
        cx="42" cy="48" r="24"
        fill="#12102a" stroke="#a78bfa" strokeWidth="2"
        filter="url(#logo-glow)"
      />
      <text
        x="42" y="57" textAnchor="middle"
        fill="#a78bfa" fontSize="22" fontFamily="Georgia,serif" fontWeight="bold"
      >¬</text>

      {/* ∧  AND node — right */}
      <circle
        cx="118" cy="48" r="24"
        fill="#0c1928" stroke="#64ffda" strokeWidth="2"
        filter="url(#logo-glow)"
      />
      <text
        x="118" y="57" textAnchor="middle"
        fill="#64ffda" fontSize="20" fontFamily="Georgia,serif" fontWeight="bold"
      >∧</text>

      {/* ∨  OR node — bottom center */}
      <circle
        cx="80" cy="100" r="24"
        fill="#200c1e" stroke="#f472b6" strokeWidth="2"
        filter="url(#logo-glow)"
      />
      <text
        x="80" y="109" textAnchor="middle"
        fill="#f472b6" fontSize="20" fontFamily="Georgia,serif" fontWeight="bold"
      >∨</text>
    </svg>
  );
}

// ─── Feature Card Icons ───────────────────────────────────────────────────────

/** AND gate silhouette */
function SimulatorIcon() {
  return (
    <svg
      width="52" height="41" viewBox="0 0 56 44"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
      style={{ filter: 'drop-shadow(0 0 5px #64ffda55)', display: 'block' }}
    >
      {/* Gate body: flat left wall + right semicircle */}
      <path
        d="M 6,4 L 22,4 A 18,18 0 0,1 22,40 L 6,40 Z"
        fill="#64ffda0d" stroke="#64ffda" strokeWidth="2" strokeLinejoin="round"
      />
      {/* Input wires */}
      <line x1="2" y1="13" x2="6"  y2="13" stroke="#64ffda" strokeWidth="2" strokeLinecap="round" />
      <line x1="2" y1="31" x2="6"  y2="31" stroke="#64ffda" strokeWidth="2" strokeLinecap="round" />
      {/* Output wire */}
      <line x1="40" y1="22" x2="54" y2="22" stroke="#64ffda" strokeWidth="2" strokeLinecap="round" />
      {/* Terminals */}
      <circle cx="2"  cy="13" r="2" fill="#64ffda" />
      <circle cx="2"  cy="31" r="2" fill="#64ffda" />
      <circle cx="54" cy="22" r="2" fill="#64ffda" />
    </svg>
  );
}

/** 3 × 3 boolean board with T / F squares */
function BoardGameIcon() {
  return (
    <svg
      width="46" height="46" viewBox="0 0 56 56"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
      style={{ filter: 'drop-shadow(0 0 5px #a78bfa55)', display: 'block' }}
    >
      {/* Board outline */}
      <rect x="3" y="3" width="50" height="50" fill="none" stroke="#a78bfa" strokeWidth="1.5" rx="3" />
      {/* Grid lines */}
      <line x1="3"  y1="20" x2="53" y2="20" stroke="#a78bfa" strokeWidth="0.9" opacity="0.5" />
      <line x1="3"  y1="37" x2="53" y2="37" stroke="#a78bfa" strokeWidth="0.9" opacity="0.5" />
      <line x1="20" y1="3"  x2="20" y2="53" stroke="#a78bfa" strokeWidth="0.9" opacity="0.5" />
      <line x1="37" y1="3"  x2="37" y2="53" stroke="#a78bfa" strokeWidth="0.9" opacity="0.5" />
      {/* Cell (0,0) — 1 */}
      <rect x="5" y="5" width="13" height="13" fill="#a78bfa" rx="2" opacity="0.85" />
      <text x="11.5" y="15" textAnchor="middle" fill="#0d0b1e"
            fontSize="9" fontWeight="bold" fontFamily="system-ui,sans-serif">1</text>
      {/* Cell (2,1) — 0 */}
      <rect x="39" y="22" width="13" height="13" fill="#a78bfa" rx="2" opacity="0.4" />
      <text x="45.5" y="32" textAnchor="middle" fill="#e2e8f0"
            fontSize="9" fontWeight="bold" fontFamily="system-ui,sans-serif">0</text>
      {/* Cell (1,2) — 1 */}
      <rect x="22" y="39" width="13" height="13" fill="#a78bfa" rx="2" opacity="0.85" />
      <text x="28.5" y="49" textAnchor="middle" fill="#0d0b1e"
            fontSize="9" fontWeight="bold" fontFamily="system-ui,sans-serif">1</text>
      {/* Center cell (1,1) — gate name */}
      <text x="28.5" y="31" textAnchor="middle" fill="#a78bfa"
            fontSize="7" fontWeight="bold" fontFamily="system-ui,sans-serif">AND</text>
    </svg>
  );
}

/**
 * Formula equivalence in the app's mathematical notation (De Morgan's law):
 *   ̄(x ∧ y)  ≡  (x̄ ∨ ȳ)
 */
function FormulaIcon() {
  return (
    <svg
      width="52" height="40" viewBox="0 0 64 50"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
      style={{ filter: 'drop-shadow(0 0 5px #f472b655)', display: 'block' }}
    >
      {/* Negation bar above the first expression */}
      <line x1="15" y1="6" x2="49" y2="6" stroke="#f472b6" strokeWidth="1.5" opacity="0.9" />
      {/* Top formula: NOT(x AND y) */}
      <text x="32" y="16" textAnchor="middle"
            fill="#f472b6" fontSize="12" fontFamily="Georgia,serif">(x ∧ y)</text>
      {/* Equals sign */}
      <text x="32" y="35" textAnchor="middle"
            fill="#f472b6" fontSize="12" fontFamily="Georgia,serif">=</text>
      {/* Bottom formula: NOT(x) OR NOT(y) — individual overlines */}
      <text x="32" y="49" textAnchor="middle"
            fill="#f472b6" fontSize="11" fontFamily="Georgia,serif">
        <tspan>(</tspan>
        <tspan style={{ textDecoration: 'overline' }}>x</tspan>
        <tspan> ∨ </tspan>
        <tspan style={{ textDecoration: 'overline' }}>y</tspan>
        <tspan>)</tspan>
      </text>
    </svg>
  );
}

// ─── Main Menu ────────────────────────────────────────────────────────────────

function MainMenu({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="main-menu">

      <div className="main-menu__hero">
        <AppLogo />
        <h1 className="main-menu__title">Boolean Logic</h1>
      </div>

      <div className="main-menu__cards">

        <button
          className="feature-card feature-card--cyan"
          onClick={() => onNavigate({ id: 'simulator' })}
        >
          <span className="feature-card__icon"><SimulatorIcon /></span>
          <span className="feature-card__title">Simulator</span>
          <span className="feature-card__desc">
            Build and simulate Boolean circuits with live truth-table output.
          </span>
        </button>

        <button
          className="feature-card feature-card--purple"
          onClick={() => onNavigate({ id: 'board-mode' })}
        >
          <span className="feature-card__icon"><BoardGameIcon /></span>
          <span className="feature-card__title">Board Game</span>
          <span className="feature-card__desc">
            Challenge yourself or others in an interactive logic strategy game.
          </span>
        </button>

        <button
          className="feature-card feature-card--pink"
          onClick={() => onNavigate({ id: 'formula-type' })}
        >
          <span className="feature-card__icon"><FormulaIcon /></span>
          <span className="feature-card__title">Formula Games</span>
          <span className="feature-card__desc">
            Evaluate formulas and prove equivalences against the clock.
          </span>
        </button>

      </div>
    </div>
  );
}

// ─── Generic Sub-Menu ─────────────────────────────────────────────────────────

interface MenuOption {
  icon:      React.ReactNode;
  label:     string;
  desc:      string;
  value:     string;
  disabled?: boolean;
}

function SubMenu({
  title,
  subtitle,
  options,
  onSelect,
  onBack,
}: {
  title:    string;
  subtitle: string;
  options:  MenuOption[];
  onSelect: (value: string) => void;
  onBack:   () => void;
}) {
  return (
    <div className="submenu">
      <button className="submenu__back" onClick={onBack}>← Back</button>
      <div className="submenu__header">
        <h2 className="submenu__title">{title}</h2>
        <p className="submenu__subtitle">{subtitle}</p>
      </div>
      <div className="submenu__options">
        {options.map(opt => (
          <button
            key={opt.value}
            className={`submenu__option${opt.disabled ? ' submenu__option--disabled' : ''}`}
            onClick={() => !opt.disabled && onSelect(opt.value)}
            disabled={opt.disabled}
          >
            <span className="submenu__option-icon">{opt.icon}</span>
            <span className="submenu__option-text">
              <span className="submenu__option-label">{opt.label}</span>
              <span className="submenu__option-desc">{opt.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Coming Soon placeholder ──────────────────────────────────────────────────

function ComingSoon({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="coming-soon">
      <span className="coming-soon__icon">🚧</span>
      <h2 className="coming-soon__title">{label}</h2>
      <p className="coming-soon__message">
        This feature is still under construction and will be available soon.
        <br />Stay tuned!
      </p>
      <button className="coming-soon__back" onClick={onBack}>← Back to Menu</button>
    </div>
  );
}

// ─── Static option lists ──────────────────────────────────────────────────────

const DIFFICULTY_OPTIONS: MenuOption[] = [
  { icon: '🌱', label: 'Easy',   desc: 'Short formulas, fewer variables',  value: 'easy'   },
  { icon: '🔥', label: 'Medium', desc: 'Moderate complexity',               value: 'medium' },
  { icon: '💀', label: 'Hard',   desc: 'Complex, deeply nested formulas',   value: 'hard'   },
];

const BOARD_MODE_OPTIONS: MenuOption[] = [
  { icon: '👤', label: 'Single Player',    desc: 'Play a solo puzzle session',     value: 'single'      },
  { icon: '👥', label: 'One-on-One',       desc: 'Two players on the same device', value: 'one-on-one'  },
  { icon: '🤖', label: 'Against Computer', desc: 'Challenge an AI opponent',       value: 'vs-computer' },
];

const FORMULA_PLAY_MODE_OPTIONS: MenuOption[] = [
  { icon: '👤', label: 'Solo',       desc: 'Play alone against the clock',              value: 'solo'       },
  { icon: '👥', label: 'One-on-One', desc: 'Play against another player',              value: 'one-on-one' },
];

const FORMULA_TYPE_OPTIONS: MenuOption[] = [
  {
    icon: (
      <svg width="28" height="22" viewBox="0 0 32 26"
           xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
           style={{ display: 'block' }}>
        <text x="16" y="11" textAnchor="middle"
              fill="#e2e8f0" fontSize="10" fontFamily="Georgia,serif">(x ∨ y)</text>
        <text x="16" y="24" textAnchor="middle"
              fill="#e2e8f0" fontSize="10" fontFamily="Georgia,serif">= 1</text>
      </svg>
    ),
    label: 'Evaluation',
    desc:  'Compute the truth value of a formula given variable assignments',
    value: 'evaluation',
  },
  {
    icon:  '⚖️',
    label: 'Equivalence',
    desc:  'Determine whether two formulas are logically equivalent',
    value: 'equivalence',
  },
];

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  const [screen, setScreen] = useState<Screen>({ id: 'main' });

  function navigate(s: Screen) { setScreen(s); }
  function goMain()            { setScreen({ id: 'main' }); }

  switch (screen.id) {

    case 'main':
      return (
        <div className="app">
          <MainMenu onNavigate={navigate} />
        </div>
      );

    case 'simulator':
      return (
        <div className="app">
          <ComingSoon label="Simulator" onBack={goMain} />
        </div>
      );

    case 'board-mode':
      return (
        <div className="app">
          <SubMenu
            title="Board Game"
            subtitle="Choose your game mode"
            options={BOARD_MODE_OPTIONS}
            onSelect={value => {
              const boardMode = value as BoardMode;
              if (boardMode === 'vs-computer') {
                navigate({ id: 'board-level', boardMode });
              } else {
                navigate({ id: 'board-game', boardMode });
              }
            }}
            onBack={goMain}
          />
        </div>
      );

    case 'board-level': {
      const { boardMode } = screen;
      return (
        <div className="app">
          <SubMenu
            title="Choose Difficulty"
            subtitle="Select a challenge level"
            options={DIFFICULTY_OPTIONS}
            onSelect={value =>
              navigate({ id: 'board-game', boardMode, difficulty: value as Difficulty })
            }
            onBack={() => navigate({ id: 'board-mode' })}
          />
        </div>
      );
    }

    case 'board-game': {
      const { boardMode } = screen;
      return (
        <div className="app">
          <ComingSoon
            label="Board Game"
            onBack={() =>
              boardMode === 'vs-computer'
                ? navigate({ id: 'board-level', boardMode })
                : navigate({ id: 'board-mode' })
            }
          />
        </div>
      );
    }

    case 'formula-type':
      return (
        <div className="app">
          <SubMenu
            title="Formula Games"
            subtitle="Choose a game type"
            options={FORMULA_TYPE_OPTIONS}
            onSelect={value => navigate({ id: 'formula-play-mode', gameType: value as GameType })}
            onBack={goMain}
          />
        </div>
      );

    case 'formula-play-mode': {
      const { gameType } = screen;
      return (
        <div className="app">
          <SubMenu
            title="Formula Games"
            subtitle="Choose a play mode"
            options={FORMULA_PLAY_MODE_OPTIONS}
            onSelect={value =>
              navigate({ id: 'formula-level', gameType, playMode: value as FormulaPlayMode })
            }
            onBack={() => navigate({ id: 'formula-type' })}
          />
        </div>
      );
    }

    case 'formula-level': {
      const { gameType, playMode } = screen;
      return (
        <div className="app">
          <SubMenu
            title="Choose Difficulty"
            subtitle="Select a challenge level"
            options={DIFFICULTY_OPTIONS}
            onSelect={value =>
              navigate({ id: 'formula-game', gameType, playMode, difficulty: value as Difficulty })
            }
            onBack={() => navigate({ id: 'formula-play-mode', gameType })}
          />
        </div>
      );
    }

    case 'formula-game': {
      const { gameType, playMode, difficulty } = screen;
      if (playMode === 'one-on-one') {
        return (
          <div className="app">
            <ComingSoon
              label="One-on-One Formula Games"
              onBack={() => navigate({ id: 'formula-level', gameType, playMode })}
            />
          </div>
        );
      }
      return (
        <FormulaGameSession
          gameType={gameType}
          mode="solo"
          difficulty={difficulty}
          playerName="Player"
          onSessionEnd={goMain}
          onBackToMenu={() => navigate({ id: 'formula-level', gameType, playMode })}
        />
      );
    }
  }
}
