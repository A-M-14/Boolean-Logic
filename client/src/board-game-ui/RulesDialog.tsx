import type { BoardMode } from './types.js';
import './RulesDialog.css';

interface RulesDialogProps {
  onClose:   () => void;
  boardMode: BoardMode;
}

export function RulesDialog({ onClose, boardMode }: RulesDialogProps) {
  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-dialog" onClick={e => e.stopPropagation()}>
        <button className="rules-dialog__close" onClick={onClose} aria-label="Close rules">✕</button>
        <h2 className="rules-dialog__title">How to Play</h2>

        <div className="rules-dialog__body">
          {boardMode === 'single' ? (
            <section className="rules-dialog__section">
              <h3>Goal</h3>
              <p>
                Fill the board to achieve a maximum score. You can click any bit cell — including ones already placed — to change its value at any time.
              </p>
              <p>
                At any point you may reveal a <strong>maximum solution</strong>, but doing so will end your game.
              </p>
            </section>
          ) : (
            <section className="rules-dialog__section">
              <h3>Goal</h3>
              <p>Outscore your opponent. The player with the higher score when the board is full wins.</p>
            </section>
          )}

          <section className="rules-dialog__section">
            <h3>The Board</h3>
            <p>
              The 7×7 grid contains two types of cells: <strong>gate cells</strong> holding a randomly assigned logic gate, and <strong>bit cells</strong> where you place a <strong>0</strong> or <strong>1</strong>.
            </p>
          </section>

          <section className="rules-dialog__section">
            <h3>How Scoring Works</h3>
            <p>
              Each gate scores independently in two directions:
            </p>
            <ul>
              <li><strong>Horizontal</strong> — evaluates the bits to its left and right</li>
              <li><strong>Vertical</strong> — evaluates the bits above and below it</li>
            </ul>
            <p>
              Each direction computes its own output (0 or 1) from those two bits using the gate's logic. Once both bits in a direction are placed, each of those bits is scored:
            </p>
            <ul>
              <li>Bit <strong>matches</strong> the gate output → <strong>+1</strong></li>
              <li>Bit <strong>differs</strong> from the gate output → <strong>−1</strong></li>
            </ul>
          </section>

          {boardMode !== 'single' && (
            <section className="rules-dialog__section">
              <h3>Rules</h3>
              <p>
                Players alternate turns. On your turn, click any empty bit cell and choose <strong>0</strong> or <strong>1</strong>. Once placed, a bit cannot be changed.
              </p>
            </section>
          )}

          <section className="rules-dialog__section">
            <h3>Logic Gates</h3>
            <table className="rules-dialog__gate-table">
              <thead>
                <tr><th>Gate</th><th>Output is 1 when…</th></tr>
              </thead>
              <tbody>
                <tr><td>AND</td> <td>Both inputs are 1</td></tr>
                <tr><td>OR</td>  <td>At least one input is 1</td></tr>
                <tr><td>XOR</td> <td>Inputs differ</td></tr>
                <tr><td>NAND</td><td>Not both inputs are 1</td></tr>
                <tr><td>NOR</td> <td>Both inputs are 0</td></tr>
                <tr><td>XNOR</td><td>Inputs are the same</td></tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}
