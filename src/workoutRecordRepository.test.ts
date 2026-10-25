import { describe, expect, it } from "vitest";

import type { WorkoutRecord } from "./types";

import { createLocalStorageWorkoutRecordRepository } from "./workoutRecordRepository";
import { buildDraftWorkoutRecord, createFormFromWorkoutRecord } from "./recordForm";

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
  it("roundtrips drafts alongside unchanged legacy records and detects draft conflicts", async () => {
    const storage = new MemoryStorage();
    const repo = createLocalStorageWorkoutRecordRepository(storage);
    const form = createFormFromWorkoutRecord(record);
    form.sets[0].weightKg = "90.";
    form.sets[0].reps = "";
    const draft = buildDraftWorkoutRecord(form, new Date());
    await repo.saveAll([record, draft]);
    const other = createLocalStorageWorkoutRecordRepository(storage);
    expect(await other.findAll()).toEqual([record, draft]);
    await repo.saveAll([draft]);
    await expect(other.saveAll([])).rejects.toThrow("別の画面");
    expect(await repo.findAll()).toEqual([draft]);
  });

  it.each(["unknown", "broken-form", "duplicate-row", "invalid-date"])(
    "protects malformed state data (%s)",
    async (kind) => {
      const storage = new MemoryStorage();
      const draft = buildDraftWorkoutRecord(
        createFormFromWorkoutRecord(record),
        new Date(),
      );
      const malformed =
        kind === "unknown"
          ? { ...record, status: "future" }
          : kind === "broken-form"
            ? { ...draft, form: null }
            : kind === "invalid-date"
              ? { ...draft, date: "bad" }
              : {
                  ...draft,
                  form: { ...draft.form, sets: [draft.form.sets[0], draft.form.sets[0]] },
                };
      const raw = JSON.stringify([malformed]);
      storage.setItem("workout-tracker.records", raw);
      const repo = createLocalStorageWorkoutRecordRepository(storage);
      await expect(repo.findAll()).rejects.toThrow();
      await expect(repo.saveAll([])).rejects.toThrow();
      expect(storage.getItem("workout-tracker.records")).toBe(raw);
    },
  );
  it("refuses to overwrite another reader's update", async () => {
    const storage = new MemoryStorage();
    const first = createLocalStorageWorkoutRecordRepository(storage);
    const second = createLocalStorageWorkoutRecordRepository(storage);
    await first.findAll();
    await second.saveAll([record]);
    await expect(first.saveAll([])).rejects.toThrow("別の画面");
    expect(await second.findAll()).toEqual([record]);
  });

  it("does not overwrite malformed or unread records", async () => {
    const storage = new MemoryStorage();
    storage.setItem("workout-tracker.records", "{}");
    const repo = createLocalStorageWorkoutRecordRepository(storage);
    await expect(repo.findAll()).rejects.toThrow();
    await expect(repo.saveAll([])).rejects.toThrow();
    expect(storage.getItem("workout-tracker.records")).toBe("{}");
  });

  it("roundtrips an optional exercise ID", async () => {
    const repo = createLocalStorageWorkoutRecordRepository(new MemoryStorage());
    await repo.saveAll([{ ...record, exerciseId: "exercise_master" }]);
    expect((await repo.findAll())[0].exerciseId).toBe("exercise_master");
  });

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
