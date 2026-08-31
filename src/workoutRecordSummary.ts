import type { WorkoutRecord } from "./types";

export function formatWorkoutRecordDate(record: WorkoutRecord): string {
  const [year, month, day] = record.date.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function formatWeight(weightKg: number | null): string {
  return weightKg === null ? "未入力" : `${weightKg}kg`;
}

export function formatReps(reps: number): string {
  return `${reps} reps`;
}

export function countWorkoutRecordTotalReps(record: WorkoutRecord): number {
  return record.sets.reduce((total, set) => total + set.reps, 0);
}

export function summarizeWorkoutRecord(record: WorkoutRecord): string {
  const topParts = [];
  if (record.topSet.successWeightKg !== null) {
    topParts.push(`top ${record.topSet.successWeightKg}kg`);
  }
  if (record.topSet.failedWeightKg !== null) {
    topParts.push(`(${record.topSet.failedWeightKg}kg失敗)`);
  }

  const setsByWeight = record.sets.reduce<{ weightKg: number; reps: number[] }[]>(
    (groups, set) => {
      const lastGroup = groups.at(-1);
      if (lastGroup?.weightKg === set.weightKg) {
        lastGroup.reps.push(set.reps);
        return groups;
      }

      return [...groups, { weightKg: set.weightKg, reps: [set.reps] }];
    },
    [],
  );

  const setSummary = setsByWeight
    .map((group) => `${group.weightKg}kg x ${group.reps.join(", ")} reps`)
    .join(", ");

  return [...topParts, setSummary].filter(Boolean).join(" / ");
}
