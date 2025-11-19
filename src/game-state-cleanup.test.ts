import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Room } from './room';

describe('Game State Cleanup', () => {
  let room: Room;

  beforeEach(() => {
    room = new Room('TestRoom');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should clear game state immediately on clearGameState()', () => {
    room.activeGame = 'frogger';
    room.gameState = { score: 100, level: 5 };
    room.gameTimeout = Date.now() + 30000;

    room.clearGameState();

    expect(room.activeGame).toBeNull();
    expect(room.gameState).toBeNull();
    expect(room.gameTimeout).toBeNull();
  });

  it('should clear existing timeout when setting new timeout', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    room.setGameTimeout(callback1, 1000);
    room.setGameTimeout(callback2, 2000);

    vi.advanceTimersByTime(1500);
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('should execute timeout callback after specified time', () => {
    const callback = vi.fn();
    room.setGameTimeout(callback, 5000);

    vi.advanceTimersByTime(4999);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should clear timeout when clearGameState is called', () => {
    const callback = vi.fn();
    room.setGameTimeout(callback, 5000);

    room.clearGameState();

    vi.advanceTimersByTime(10000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should preserve game state when activeGame is set to null but timeout not reached', () => {
    room.activeGame = 'frogger';
    room.gameState = { score: 100, level: 5 };

    // Simulate stop game (sets activeGame to null but keeps state)
    room.activeGame = null;

    expect(room.activeGame).toBeNull();
    expect(room.gameState).toEqual({ score: 100, level: 5 });
  });

  it('should clear both activeGame and gameState when timeout executes', () => {
    room.activeGame = 'frogger';
    room.gameState = { score: 100, level: 5 };

    room.setGameTimeout(
      () => {
        room.clearGameState();
      },
      30 * 60 * 1000,
    );

    room.activeGame = null; // Game stopped

    expect(room.activeGame).toBeNull();
    expect(room.gameState).toEqual({ score: 100, level: 5 });
    expect(room.gameTimeout).toBeGreaterThan(Date.now());

    // Fast-forward 30 minutes
    vi.advanceTimersByTime(30 * 60 * 1000);

    expect(room.activeGame).toBeNull();
    expect(room.gameState).toBeNull();
    expect(room.gameTimeout).toBeNull();
  });
});
