import type { Exercise, StoredWorkoutRecord as WorkoutRecord } from "./types";
import type { ExerciseRepository } from "./exerciseRepository";
import type { WorkoutRecordClientRepository } from "./workoutRecordRepository";

export function groupUnlinkedRecords(
  records: WorkoutRecord[],
): Map<string, WorkoutRecord[]> {
  const grouped = new Map<string, WorkoutRecord[]>();
  for (const record of records) {
    if (!record.exerciseId)
      grouped.set(record.exerciseName, [
        ...(grouped.get(record.exerciseName) ?? []),
        record,
      ]);
  }
  return grouped;
}

export async function linkExerciseRecords(
  records: WorkoutRecord[],
  ids: string[],
  target: Exercise,
  recordRepository: WorkoutRecordClientRepository,
  exerciseRepository: ExerciseRepository,
): Promise<WorkoutRecord[]> {
  const latestTarget = (await exerciseRepository.findAll()).find(
    (item) => item.id === target.id,
  );
  if (
    !latestTarget ||
    latestTarget.isHidden ||
    JSON.stringify(latestTarget) !== JSON.stringify(target)
  ) {
    throw new Error(
      "紐付け先の種目が変更されています。最新の内容を読み込み直してください。",
    );
  }
  const selected = new Set(ids);
  if (
    selected.size === 0 ||
    records.filter((record) => selected.has(record.id) && !record.exerciseId).length !==
      selected.size
  ) {
    throw new Error("紐付け対象を選択し直してください。");
  }
  const updated = records.map((record) =>
    selected.has(record.id)
      ? {
          ...record,
          exerciseId: target.id,
          ...(record.status === "draft"
            ? { form: { ...record.form, exerciseId: target.id } }
            : {}),
        }
      : record,
  );
  await recordRepository.saveAll(updated, { backupBeforeWrite: true });
  return updated;
}
