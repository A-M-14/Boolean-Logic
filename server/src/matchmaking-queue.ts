/**
 * matchmaking-queue.ts — Matchmaking Queue Manager
 *
 * Maintains per-(gameType, difficulty) waiting queues and pairs players
 * as soon as a compatible opponent is available.
 *
 * Queue keys follow the pattern:
 *   "board"                    — for the board game (difficulty-agnostic)
 *   "evaluation:easy"          — Evaluation game at Easy difficulty
 *   "evaluation:medium"        — Evaluation game at Medium difficulty
 *   "evaluation:hard"          — Evaluation game at Hard difficulty
 *   "equivalence:easy|medium|hard"  — Equivalence game variants
 */

import type { TypedSocket, GameType } from './types.js';
import type { Difficulty } from '@boolean-logic/shared';

/** One entry in a matchmaking queue. */
interface QueueEntry {
  socket:   TypedSocket;
  nickname: string;
}

/** Opaque string key identifying a specific (gameType, difficulty) queue. */
type QueueKey = string;

export class MatchmakingQueue {
  /** Maps a QueueKey to the list of players waiting in that queue. */
  private readonly queues = new Map<QueueKey, QueueEntry[]>();

  /** Reverse lookup: socket ID → queue the socket is currently waiting in. */
  private readonly socketToKey = new Map<string, QueueKey>();

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Attempt to match the given socket with a waiting player.
   *
   * - If a compatible waiting player exists, removes them from the queue
   *   and returns their entry so the caller can create a game room.
   * - If no match is found, adds the socket to the queue and returns null.
   *
   * Note: a socket already in this queue will not be matched with itself.
   */
  enqueue(
    socket:      TypedSocket,
    gameType:    GameType,
    difficulty?: Difficulty,
    nickname:    string = 'Player',
  ): QueueEntry | null {
    const key = this.makeKey(gameType, difficulty);

    // Get the existing queue or create a new one and store it immediately.
    let queue = this.queues.get(key);
    if (!queue) {
      queue = [];
      this.queues.set(key, queue);
    }

    // Find a waiting opponent (any socket other than the caller).
    const opponentIndex = queue.findIndex(e => e.socket.id !== socket.id);

    if (opponentIndex !== -1) {
      // Match found — remove the opponent from the queue in-place.
      const [opponent] = queue.splice(opponentIndex, 1);

      if (queue.length === 0) {
        this.queues.delete(key);
      }
      this.socketToKey.delete(opponent.socket.id);

      return opponent;
    }

    // No match — add caller to the queue.
    const entry: QueueEntry = { socket, nickname };
    queue.push(entry);
    this.socketToKey.set(socket.id, key);

    return null;
  }

  /**
   * Remove a socket from whatever queue it is currently waiting in.
   * Safe to call even if the socket is not queued (no-op).
   */
  dequeue(socketId: string): void {
    const key = this.socketToKey.get(socketId);
    if (!key) return;

    const queue = this.queues.get(key);
    if (queue) {
      const idx = queue.findIndex(e => e.socket.id === socketId);
      if (idx !== -1) {
        queue.splice(idx, 1);
        if (queue.length === 0) {
          this.queues.delete(key);
        }
      }
    }

    this.socketToKey.delete(socketId);
  }

  /** Returns true if the given socket is currently waiting in any queue. */
  isQueued(socketId: string): boolean {
    return this.socketToKey.has(socketId);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private makeKey(gameType: GameType, difficulty?: Difficulty): QueueKey {
    // Board game has no difficulty dimension; formula games do.
    return gameType === 'board' ? 'board' : `${gameType}:${difficulty ?? 'easy'}`;
  }
}
