/**
 * formula-games-room-manager.ts — Formula Games Room Manager
 *
 * Manages all active multiplayer Formula Evaluation and Formula Equivalence
 * game sessions.
 *
 * Responsibilities:
 *   - Creates rooms for matched player pairs and starts the first round.
 *   - Generates rounds server-side via the shared Boolean Formula Games Engine
 *     (generateEvaluationRound / generateEquivalenceRound).
 *   - Collects per-round answers from both players; resolves the round once
 *     both have submitted OR the server-side timeout fires (ROUND_DURATION_SECONDS
 *     + a 5-second grace period).
 *   - Scores answers using submitEvaluationAnswer / submitEquivalenceAnswer and
 *     maintains cumulative session scores.
 *   - Advances through ROUNDS_PER_SESSION rounds then emits formula:session_end.
 *   - Cleans up room state on player disconnect.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  generateEvaluationRound,
  generateEquivalenceRound,
  submitEvaluationAnswer,
  submitEquivalenceAnswer,
  ROUNDS_PER_SESSION,
  ROUND_DURATION_SECONDS,
} from '@boolean-logic/shared';
import type { EvaluationRound, EquivalenceRound, Difficulty } from '@boolean-logic/shared';
import type { TypedSocket, TypedServer } from './types.js';

// ─── Internal data structures ─────────────────────────────────────────────────

interface FormulaPlayer {
  socketId: string;
  score:    number;
}

interface RoundSubmission {
  answer:         boolean;
  elapsedSeconds: number;
}

interface FormulaRoom {
  roomId:             string;
  gameType:           'evaluation' | 'equivalence';
  difficulty:         Difficulty;
  players:            [FormulaPlayer, FormulaPlayer];
  roundIndex:         number;
  currentRound:       EvaluationRound | EquivalenceRound | null;
  /** Submissions received for the current round, keyed by socket ID. */
  submissions:        Map<string, RoundSubmission>;
  /** Server-side round expiry timer handle. Cleared when the round resolves. */
  roundTimeoutHandle: ReturnType<typeof setTimeout> | null;
  /** Socket IDs of players who have emitted formula:ready. Using a Set so that
   *  repeated signals from the same socket (e.g. React StrictMode double-invoke)
   *  are deduplicated; the first round starts only once both distinct players signal. */
  readyPlayers: Set<string>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Extra seconds added to ROUND_DURATION_SECONDS before the server force-resolves. */
const SERVER_GRACE_SECONDS = 5;

// ─── Manager class ────────────────────────────────────────────────────────────

export class FormulaGamesRoomManager {
  /** All active formula-game rooms keyed by room ID. */
  private readonly rooms = new Map<string, FormulaRoom>();

  /** Reverse lookup: socket ID → room ID. */
  private readonly socketToRoom = new Map<string, string>();

  constructor(private readonly io: TypedServer) {}

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Create a new formula-game room for two matched players.
   *
   * Joins both sockets to the Socket.IO room and immediately starts
   * the first round by emitting formula:round to both players.
   *
   * @returns The new room ID.
   */
  createRoom(
    socket1:    TypedSocket,
    socket2:    TypedSocket,
    gameType:   'evaluation' | 'equivalence',
    difficulty: Difficulty,
  ): string {
    const roomId = uuidv4();

    const room: FormulaRoom = {
      roomId,
      gameType,
      difficulty,
      players: [
        { socketId: socket1.id, score: 0 },
        { socketId: socket2.id, score: 0 },
      ],
      roundIndex:         0,
      currentRound:       null,
      submissions:        new Map(),
      roundTimeoutHandle: null,
      readyPlayers: new Set(),
    };

    this.rooms.set(roomId, room);
    this.socketToRoom.set(socket1.id, roomId);
    this.socketToRoom.set(socket2.id, roomId);

    socket1.join(roomId);
    socket2.join(roomId);

    console.log(
      `[FormulaGamesRoomManager] Room ${roomId} created — ` +
      `${gameType}/${difficulty}: ${socket1.id} vs ${socket2.id}`,
    );

    // The first round is deferred until both players emit formula:ready.
    // This prevents formula:round from arriving before the clients have
    // mounted and registered their event listeners.

    return roomId;
  }

  /**
   * Handle a formula:evaluation_answer event from a connected socket.
   *
   * Validates the socket is in an evaluation-mode room, then records the
   * player's determination of the formula's boolean output. Resolves the
   * round when both players have submitted.
   */
  handleEvaluationAnswer(
    socket: TypedSocket,
    data:   { result: boolean; elapsedSeconds: number },
  ): void {
    const room = this.resolveRoom(socket, 'evaluation');
    if (!room) return;
    this.recordSubmission(socket, room, data.result, data.elapsedSeconds);
  }

  /**
   * Handle a formula:equivalence_answer event from a connected socket.
   *
   * Validates the socket is in an equivalence-mode room, then records the
   * player's judgment on whether the two formulas are logically equivalent.
   * Resolves the round when both players have submitted.
   */
  handleEquivalenceAnswer(
    socket: TypedSocket,
    data:   { areEquivalent: boolean; elapsedSeconds: number },
  ): void {
    const room = this.resolveRoom(socket, 'equivalence');
    if (!room) return;
    this.recordSubmission(socket, room, data.areEquivalent, data.elapsedSeconds);
  }

  /**
   * Handle a formula:ready event from a connected socket.
   *
   * The client emits this once it has mounted and registered all socket
   * listeners. The server starts the first round only after both players
   * in the room have signalled ready, guaranteeing formula:round is sent
   * after listeners are in place.
   */
  handleReady(socket: TypedSocket): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.readyPlayers.add(socket.id);
    if (room.readyPlayers.size >= room.players.length) {
      this.startNextRound(room);
    }
  }

  /**
   * Handle a socket disconnect while the player is in a formula-game room.
   * Cleans up the room so the remaining player does not hang waiting.
   */
  handleDisconnect(socketId: string): void {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      const opponent = room.players.find(p => p.socketId !== socketId);
      if (opponent) {
        this.io.to(opponent.socketId).emit('opponent:disconnected', {
          message: 'Your opponent has left the game.',
        });
      }
    }

    console.log(
      `[FormulaGamesRoomManager] Player ${socketId} disconnected from room ${roomId}.`,
    );
    this.cleanupRoom(roomId);
  }

  /** Returns true if the given socket is currently in a formula-game room. */
  isInRoom(socketId: string): boolean {
    return this.socketToRoom.has(socketId);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Look up the room for a socket and validate it is the expected game type.
   * Emits a typed error event and returns null on any validation failure,
   * so callers can simply `if (!room) return`.
   */
  private resolveRoom(
    socket:           TypedSocket,
    expectedGameType: 'evaluation' | 'equivalence',
  ): FormulaRoom | null {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) {
      socket.emit('error', { message: 'You are not in an active formula-game room.' });
      return null;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found.' });
      return null;
    }

    if (room.gameType !== expectedGameType) {
      socket.emit('error', {
        message: `This room runs ${room.gameType} mode — cannot accept a ${expectedGameType} answer.`,
      });
      return null;
    }

    return room;
  }

  /**
   * Record a player's boolean answer for the current round and trigger
   * resolution once both players have submitted.
   *
   * Shared by handleEvaluationAnswer and handleEquivalenceAnswer; by the time
   * this is called the room's game type has already been validated by resolveRoom.
   *
   * @param answer     The normalised boolean answer (formula result or equivalence judgment).
   * @param rawElapsed Client-measured elapsed seconds, clamped to [0, ROUND_DURATION_SECONDS].
   */
  private recordSubmission(
    socket:     TypedSocket,
    room:       FormulaRoom,
    answer:     boolean,
    rawElapsed: number,
  ): void {
    if (room.currentRound === null) {
      socket.emit('error', { message: 'No active round to submit an answer for.' });
      return;
    }

    if (room.submissions.has(socket.id)) {
      socket.emit('error', { message: 'You have already submitted an answer for this round.' });
      return;
    }

    const elapsedSeconds = Math.min(Math.max(0, rawElapsed), ROUND_DURATION_SECONDS);
    room.submissions.set(socket.id, { answer, elapsedSeconds });

    if (room.submissions.size === room.players.length) {
      this.resolveRound(room);
    }
  }

  /**
   * Generate and broadcast a new round to both players in the room.
   * Also arms the server-side round expiry timer.
   */
  private startNextRound(room: FormulaRoom): void {
    // Clear any leftover timeout from the previous round.
    if (room.roundTimeoutHandle !== null) {
      clearTimeout(room.roundTimeoutHandle);
      room.roundTimeoutHandle = null;
    }

    // Generate the round server-side using the shared engine.
    const round: EvaluationRound | EquivalenceRound =
      room.gameType === 'evaluation'
        ? generateEvaluationRound(room.difficulty)
        : generateEquivalenceRound(room.difficulty, Math.random() < 0.5);

    room.currentRound = round;
    room.submissions  = new Map();

    // Broadcast the round data to both players.
    if (room.gameType === 'evaluation') {
      const evalRound = round as EvaluationRound;
      this.io.to(room.roomId).emit('formula:round', {
        gameType:   'evaluation',
        roundIndex: room.roundIndex,
        formula:    evalRound.formula.root,
        assignment: evalRound.assignment,
      });
    } else {
      const eqRound = round as EquivalenceRound;
      this.io.to(room.roomId).emit('formula:round', {
        gameType:   'equivalence',
        roundIndex: room.roundIndex,
        formulaA:   eqRound.formulaA.root,
        formulaB:   eqRound.formulaB.root,
        proof:      eqRound.proof,
      });
    }

    // Arm a server-side expiry timer. If both players do not submit within
    // ROUND_DURATION_SECONDS + SERVER_GRACE_SECONDS, the round is force-resolved
    // and missing submissions are treated as incorrect with zero points.
    room.roundTimeoutHandle = setTimeout(() => {
      console.log(
        `[FormulaGamesRoomManager] Round ${room.roundIndex} in room ${room.roomId} ` +
        `timed out — force-resolving with ${room.submissions.size}/2 submissions.`,
      );
      this.resolveRound(room);
    }, (ROUND_DURATION_SECONDS + SERVER_GRACE_SECONDS) * 1000);
  }

  /**
   * Score all player submissions for the current round, emit per-player
   * results and cross-scores, then either advance to the next round or
   * end the session.
   *
   * Called when both players have submitted OR the server timeout fires.
   * If a player has not submitted, a default incorrect/zero-points answer
   * is used for them.
   */
  private resolveRound(room: FormulaRoom): void {
    // Guard: if already resolved (e.g. timeout fires after both players
    // submitted in the same tick), bail out immediately.
    if (room.currentRound === null) return;

    // Clear the timeout (handles the early-both-submitted path).
    if (room.roundTimeoutHandle !== null) {
      clearTimeout(room.roundTimeoutHandle);
      room.roundTimeoutHandle = null;
    }

    const round = room.currentRound;

    // Cache socket references once; each is used multiple times below.
    const [p1, p2] = room.players;
    const s1 = this.io.sockets.sockets.get(p1.socketId);
    const s2 = this.io.sockets.sockets.get(p2.socketId);

    // Score each player; use a timed-out default for absent submitters.
    for (const [player, socket] of [[p1, s1], [p2, s2]] as const) {
      const submission = room.submissions.get(player.socketId) ?? {
        answer:         false,
        elapsedSeconds: ROUND_DURATION_SECONDS, // full time elapsed → 0 points
      };

      const { correct, roundPoints } = this.scoreSubmission(
        round, room.gameType, submission,
      );

      player.score += roundPoints;
      socket?.emit('formula:round_result', { correct, yourScore: player.score });
    }

    // Cross-broadcast updated scores so each player sees the opponent's total.
    s1?.emit('formula:opponent_score', { score: p2.score });
    s2?.emit('formula:opponent_score', { score: p1.score });

    // Mark the round as resolved to prevent duplicate processing.
    room.currentRound = null;
    room.roundIndex++;

    // Wait 2 seconds before advancing so both players can read their result.
    // This mirrors the 2-second auto-advance delay used in solo mode.
    if (room.roundIndex >= ROUNDS_PER_SESSION) {
      setTimeout(() => {
        // All rounds complete — send final scores and clean up.
        s1?.emit('formula:session_end', {
          yourFinalScore:     p1.score,
          opponentFinalScore: p2.score,
        });
        s2?.emit('formula:session_end', {
          yourFinalScore:     p2.score,
          opponentFinalScore: p1.score,
        });

        console.log(
          `[FormulaGamesRoomManager] Session in room ${room.roomId} complete — ` +
          `${p1.socketId}: ${p1.score}, ${p2.socketId}: ${p2.score}`,
        );

        this.cleanupRoom(room.roomId);
      }, 2000);
    } else {
      setTimeout(() => this.startNextRound(room), 2000);
    }
  }

  /**
   * Score a single player submission against the current round.
   * Encapsulates the evaluation vs equivalence dispatch to avoid
   * repeating the same branching in the per-player loop.
   */
  private scoreSubmission(
    round:      EvaluationRound | EquivalenceRound,
    gameType:   'evaluation' | 'equivalence',
    submission: RoundSubmission,
  ): { correct: boolean; roundPoints: number } {
    if (gameType === 'evaluation') {
      const result = submitEvaluationAnswer(
        round as EvaluationRound,
        submission.answer,
        submission.elapsedSeconds,
      );
      return { correct: result.userAnswer === result.correctAnswer, roundPoints: result.score };
    }

    const result = submitEquivalenceAnswer(
      round as EquivalenceRound,
      submission.answer,
      submission.elapsedSeconds,
    );
    return { correct: result.userAnswer === result.areEquivalent, roundPoints: result.score };
  }

  private cleanupRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Always clear any pending timeout before releasing the room.
    if (room.roundTimeoutHandle !== null) {
      clearTimeout(room.roundTimeoutHandle);
    }

    for (const player of room.players) {
      this.socketToRoom.delete(player.socketId);
    }

    this.rooms.delete(roomId);
  }
}
