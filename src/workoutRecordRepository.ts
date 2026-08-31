import type { WorkoutRecord } from "./types";

const workoutRecordsStorageKey = "workout-tracker.records";

export type WorkoutRecordClientRepository = {
  findAll(): Promise<WorkoutRecord[]>;
  saveAll(records: WorkoutRecord[]): Promise<void>;
};

export function createLocalStorageWorkoutRecordRepository(
  storage: Storage,
): WorkoutRecordClientRepository {
  return {
    async findAll() {
      const text = storage.getItem(workoutRecordsStorageKey);
      if (text === null) {
        return [];
      }

      return JSON.parse(text) as WorkoutRecord[];
    },

    async saveAll(records) {
      storage.setItem(workoutRecordsStorageKey, JSON.stringify(records, null, 2));
    },
  };
}
