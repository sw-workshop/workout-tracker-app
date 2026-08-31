import { describe, expect, it } from "vitest";

import type { WorkoutRecord } from "./types";

import { createLocalStorageWorkoutRecordRepository } from "./workoutRecordRepository";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const record: WorkoutRecord = {
  id: "record_test",
  date: "2026-08-23",
  exerciseName: "ベンチプレス",
  exerciseType: "weighted",
  topSet: {
    successWeightKg: 120,
    failedWeightKg: null,
  },
  sets: [{ setNumber: 1, weightKg: 90, reps: 8 }],
  note: "",
  createdAt: "2026-08-23T08:00:00.000Z",
  updatedAt: "2026-08-23T08:00:00.000Z",
};

describe("createLocalStorageWorkoutRecordRepository", () => {
  it("returns an empty list when records are not saved yet", async () => {
    const repository = createLocalStorageWorkoutRecordRepository(new MemoryStorage());

    await expect(repository.findAll()).resolves.toEqual([]);
  });

  it("saves and loads workout records", async () => {
    const repository = createLocalStorageWorkoutRecordRepository(new MemoryStorage());

    await repository.saveAll([record]);

    await expect(repository.findAll()).resolves.toEqual([record]);
  });
});
