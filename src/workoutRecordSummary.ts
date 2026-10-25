import type { StoredWorkoutRecord, WorkoutRecord } from "./types";

export function formatWorkoutRecordDate(record: StoredWorkoutRecord): string {
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
  return record.sets.reduce(
    (total, set) => total + ("right" in set ? set.right.reps + set.left.reps : set.reps),
    0,
  );
}

export function summarizeWorkoutRecord(record: StoredWorkoutRecord): string {
  if (record.status === "draft") {
    const form = record.form;
    const weight = (text: string) => (text === "" ? "未入力" : `${text}kg`);
    const reps = (text: string) => (text === "" ? "未入力" : `${text} reps`);
    const sets = form.sets.flatMap((set, index) => {
      const values = form.isUnilateral
        ? [set.weightKg, set.reps, set.leftWeightKg, set.leftReps]
        : [set.weightKg, set.reps];
      if (values.every((value) => value === "")) return [];
      return [
        `${index + 1}: ${form.isUnilateral ? "右 " : ""}${weight(set.weightKg)} x ${reps(set.reps)}${form.isUnilateral ? `, 左 ${weight(set.leftWeightKg)} x ${reps(set.leftReps)}` : ""}`,
      ];
    });
    return [
      form.topSuccessWeightKg ? `top ${weight(form.topSuccessWeightKg)}` : "",
      form.topFailedWeightKg ? `(${weight(form.topFailedWeightKg)}失敗)` : "",
      sets.join(", ") || "セット未入力",
    ]
      .filter(Boolean)
      .join(" / ");
  }
  const topParts = [];
  if (record.topSet.successWeightKg !== null) {
    topParts.push(`top ${record.topSet.successWeightKg}kg`);
  }
  if (record.topSet.failedWeightKg !== null) {
    topParts.push(`(${record.topSet.failedWeightKg}kg失敗)`);
  }

  if (record.isUnilateral) {
    const setSummary = record.sets
      .map((set) =>
        "right" in set
          ? `${set.setNumber}: 右 ${set.right.weightKg}kg x ${set.right.reps}, 左 ${set.left.weightKg}kg x ${set.left.reps} reps`
          : `${set.weightKg}kg x ${set.reps} reps`,
      )
      .join(", ");
    return [...topParts, setSummary].filter(Boolean).join(" / ");
  }

  const setsByWeight = record.sets.reduce<{ weightKg: number; reps: number[] }[]>(
    (groups, set) => {
      if ("right" in set) return groups;
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
