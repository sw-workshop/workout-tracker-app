import type { StoredWorkoutRecord } from "./types";
import { createUuid, validateDraftIdentity } from "./recordForm";

const workoutRecordsStorageKey = "workout-tracker.records";

export type WorkoutRecordClientRepository = {
  findAll(): Promise<StoredWorkoutRecord[]>;
  saveAll(
    records: StoredWorkoutRecord[],
    options?: { backupBeforeWrite: boolean },
  ): Promise<void>;
};

export function createLocalStorageWorkoutRecordRepository(
  storage: Storage,
): WorkoutRecordClientRepository {
  let loadedText: string | null | undefined;
  return {
    async findAll() {
      const text = storage.getItem(workoutRecordsStorageKey);
      if (text === null) {
        loadedText = null;
        return [];
      }

      const parsed: unknown = JSON.parse(text);
      if (
        !Array.isArray(parsed) ||
        !parsed.every(
          (record: unknown) =>
            typeof record === "object" && record !== null && isStoredRecord(record),
        )
      ) {
        throw new Error("記録データを読み込めません。");
      }
      if (
        new Set(parsed.map((record: StoredWorkoutRecord) => record.id)).size !==
        parsed.length
      ) {
        throw new Error("記録IDが重複しています。");
      }
      loadedText = text;
      return parsed as StoredWorkoutRecord[];
    },

    async saveAll(records, options) {
      const save = () => {
        if (
          loadedText === undefined &&
          storage.getItem(workoutRecordsStorageKey) !== null
        ) {
          throw new Error("保存前に記録データを正常に読み込む必要があります。");
        }
        if (
          loadedText !== undefined &&
          storage.getItem(workoutRecordsStorageKey) !== loadedText
        ) {
          throw new Error(
            "別の画面で記録が更新されています。入力を控えてから再読み込みしてください。",
          );
        }
        const text = JSON.stringify(records, null, 2);
        if (options?.backupBeforeWrite) {
          const backup = JSON.stringify({
            version: 1,
            createdAt: new Date().toISOString(),
            records: storage.getItem(workoutRecordsStorageKey),
            exercises: storage.getItem("workout-tracker.exercises"),
          });
          try {
            storage.setItem(`workout-tracker.pre-link-backup.${createUuid()}`, backup);
          } catch {
            throw new Error(
              "変更前のデータを退避できないため、紐付けを中止しました。記録は変更していません。",
            );
          }
        }
        storage.setItem(workoutRecordsStorageKey, text);
        loadedText = text;
      };
      if (typeof window !== "undefined" && navigator.locks) {
        await navigator.locks.request(workoutRecordsStorageKey, async () => save());
      } else save();
    },
  };
}

function isStoredRecord(value: object): boolean {
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.exerciseName !== "string")
    return false;
  if (record.status === undefined || record.status === "completed")
    return Array.isArray(record.sets);
  if (
    record.status !== "draft" ||
    !record.id.startsWith("record_") ||
    typeof record.date !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string" ||
    record.exerciseType !== "weighted" ||
    typeof record.isUnilateral !== "boolean" ||
    typeof record.note !== "string" ||
    (record.exerciseId !== undefined &&
      (typeof record.exerciseId !== "string" ||
        !record.exerciseId.startsWith("exercise_"))) ||
    typeof record.form !== "object" ||
    record.form === null
  )
    return false;
  const form = record.form as Record<string, unknown>;
  if (
    !["date", "exerciseName", "topSuccessWeightKg", "topFailedWeightKg", "note"].every(
      (key) => typeof form[key] === "string",
    ) ||
    form.date !== record.date ||
    form.exerciseName !== record.exerciseName ||
    form.exerciseId !== record.exerciseId ||
    form.isUnilateral !== record.isUnilateral ||
    form.note !== record.note ||
    !Array.isArray(form.sets) ||
    form.sets.length === 0
  )
    return false;
  if (validateDraftIdentity(form as unknown as import("./recordForm").RecordForm, false))
    return false;
  const ids = new Set<string>();
  return form.sets.every((set: unknown) => {
    if (typeof set !== "object" || set === null) return false;
    const row = set as Record<string, unknown>;
    if (
      !["id", "weightKg", "reps", "leftWeightKg", "leftReps"].every(
        (key) => typeof row[key] === "string",
      ) ||
      ids.has(row.id as string)
    )
      return false;
    ids.add(row.id as string);
    return true;
  });
}
