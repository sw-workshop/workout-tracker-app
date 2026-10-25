import type { Exercise, WorkoutRecord } from "./types";
import { createUuid } from "./recordForm";

const storageKey = "workout-tracker.exercises";

export type ExerciseRepository = {
  findAll(): Promise<Exercise[]>;
  add(name: string, defaultIsUnilateral: boolean): Promise<Exercise>;
  update(
    exercise: Exercise,
    changes: Pick<Exercise, "name" | "defaultIsUnilateral" | "isHidden">,
  ): Promise<Exercise>;
};

export function validateExerciseName(name: string): string {
  const trimmed = name.trim();
  if (Array.from(trimmed).length < 1 || Array.from(trimmed).length > 100) {
    throw new Error("種目名は1〜100文字で入力してください。");
  }
  return trimmed;
}

export function resolveExerciseName(
  record: Pick<WorkoutRecord, "exerciseId" | "exerciseName">,
  exercises: Exercise[],
): string {
  return (
    exercises.find((exercise) => exercise.id === record.exerciseId)?.name ??
    record.exerciseName
  );
}

export function createLocalStorageExerciseRepository(
  storage: Storage,
): ExerciseRepository {
  function read(): Exercise[] {
    const raw = storage.getItem(storageKey);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      !parsed.every((value: unknown) => {
        if (typeof value !== "object" || value === null) return false;
        const item = value as Record<string, unknown>;
        return (
          typeof item.id === "string" &&
          item.id.startsWith("exercise_") &&
          typeof item.name === "string" &&
          item.name.trim() !== "" &&
          typeof item.defaultIsUnilateral === "boolean" &&
          typeof item.isHidden === "boolean" &&
          typeof item.createdAt === "string" &&
          typeof item.updatedAt === "string"
        );
      })
    )
      throw new Error("種目データを読み込めません。元のデータは変更していません。");
    const exercises = parsed as Exercise[];
    if (new Set(exercises.map((item) => item.id)).size !== exercises.length) {
      throw new Error("種目IDが重複しています。元のデータは変更していません。");
    }
    return exercises;
  }

  return {
    async findAll() {
      return read();
    },
    async add(name, defaultIsUnilateral) {
      const add = () => {
        const normalized = validateExerciseName(name);
        const exercises = read();
        const duplicate = exercises.find((item) => item.name === normalized);
        if (duplicate)
          throw new Error(
            duplicate.isHidden
              ? "同名の非表示種目があります。"
              : "同名の種目が登録されています。一覧から選択してください。",
          );
        const timestamp = new Date().toISOString();
        const exercise: Exercise = {
          id: `exercise_${createUuid()}`,
          name: normalized,
          defaultIsUnilateral,
          isHidden: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        storage.setItem(storageKey, JSON.stringify([...exercises, exercise]));
        return exercise;
      };
      return typeof window !== "undefined" && navigator.locks
        ? navigator.locks.request(storageKey, async () => add())
        : add();
    },
    async update(exercise, changes) {
      const update = () => {
        const exercises = read();
        const index = exercises.findIndex((item) => item.id === exercise.id);
        if (index < 0 || JSON.stringify(exercises[index]) !== JSON.stringify(exercise)) {
          throw new Error(
            "種目が別の画面で更新されています。最新の内容を読み込み直してください。",
          );
        }
        const name = validateExerciseName(changes.name);
        if (exercises.some((item) => item.id !== exercise.id && item.name === name)) {
          throw new Error(
            "同名の種目が登録されています。非表示の種目も確認してください。",
          );
        }
        const updated = {
          ...exercises[index],
          ...changes,
          name,
          updatedAt: new Date().toISOString(),
        };
        exercises[index] = updated;
        storage.setItem(storageKey, JSON.stringify(exercises));
        return updated;
      };
      return typeof window !== "undefined" && navigator.locks
        ? navigator.locks.request(storageKey, async () => update())
        : update();
    },
  };
}
