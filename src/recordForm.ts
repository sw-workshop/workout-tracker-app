import type { RecordId, WorkoutRecord, WorkoutSet } from "./types";

import { isValidRepsValue, isValidWeightValue, parseRepsValue } from "./inputConstraints";

export type FormSet = {
  id: string;
  weightKg: string;
  reps: string;
};

export type RecordForm = {
  date: string;
  exerciseName: string;
  topSuccessWeightKg: string;
  topFailedWeightKg: string;
  sets: FormSet[];
  note: string;
};

export type BuildWorkoutRecordResult =
  | {
      ok: true;
      record: WorkoutRecord;
    }
  | {
      ok: false;
      error: string;
    };

export function createDefaultSets(): FormSet[] {
  return Array.from({ length: 3 }, (_, index) => ({
    id: `set-${index + 1}`,
    weightKg: "",
    reps: "",
  }));
}

export function createForm(date: string): RecordForm {
  return {
    date,
    exerciseName: "",
    topSuccessWeightKg: "",
    topFailedWeightKg: "",
    sets: createDefaultSets(),
    note: "",
  };
}

export function createFormFromWorkoutRecord(record: WorkoutRecord): RecordForm {
  const recordSets = record.sets.map((set) => ({
    id: `set-${set.setNumber}`,
    weightKg: String(set.weightKg),
    reps: String(set.reps),
  }));
  const emptySetCount = Math.max(0, 3 - recordSets.length);
  const emptySets = Array.from({ length: emptySetCount }, (_, index) => ({
    id: `set-${recordSets.length + index + 1}`,
    weightKg: "",
    reps: "",
  }));

  return {
    date: record.date,
    exerciseName: record.exerciseName,
    topSuccessWeightKg: formatOptionalWeight(record.topSet.successWeightKg),
    topFailedWeightKg: formatOptionalWeight(record.topSet.failedWeightKg),
    sets: [...recordSets, ...emptySets],
    note: record.note,
  };
}

export function findInvalidRepsSetNumbers(sets: FormSet[]): number[] {
  return sets.flatMap((set, index) => {
    if (set.reps.trim() === "" || isValidRepsValue(set.reps)) {
      return [];
    }

    return [index + 1];
  });
}

export function findInvalidWeightLabels(form: RecordForm): string[] {
  const invalidWeightLabels = [];
  if (
    form.topSuccessWeightKg.trim() !== "" &&
    !isValidWeightValue(form.topSuccessWeightKg)
  ) {
    invalidWeightLabels.push("トップセット成功重量");
  }
  if (
    form.topFailedWeightKg.trim() !== "" &&
    !isValidWeightValue(form.topFailedWeightKg)
  ) {
    invalidWeightLabels.push("トップセット失敗重量");
  }

  let previousWeightKg = "";
  form.sets.forEach((set, index) => {
    const hasAnySetInput = set.weightKg.trim() !== "" || set.reps.trim() !== "";
    const effectiveWeightKg = set.weightKg.trim() || previousWeightKg;

    if (set.weightKg.trim() !== "" && isValidWeightValue(set.weightKg)) {
      previousWeightKg = set.weightKg.trim();
    }

    if (hasAnySetInput && !isValidWeightValue(effectiveWeightKg)) {
      invalidWeightLabels.push(`${index + 1}セット目の重量`);
    }
  });

  return invalidWeightLabels;
}

export function countTotalReps(sets: FormSet[]): number {
  return sets.reduce((total, set) => total + parseRepsValue(set.reps), 0);
}

export function buildWorkoutRecordFromForm(
  form: RecordForm,
  now: Date,
  baseRecord?: WorkoutRecord,
): BuildWorkoutRecordResult {
  if (form.date.trim() === "") {
    return { ok: false, error: "日付を入力してください。" };
  }

  if (form.exerciseName.trim() === "") {
    return { ok: false, error: "種目名を入力してください。" };
  }

  const invalidWeights = findInvalidWeightLabels(form);
  if (invalidWeights.length > 0) {
    return {
      ok: false,
      error: `${invalidWeights.join(", ")}は0より大きい数値で入力してください。`,
    };
  }

  const invalidSetNumbers = findInvalidRepsSetNumbers(form.sets);
  if (invalidSetNumbers.length > 0) {
    return {
      ok: false,
      error: `${invalidSetNumbers.join(", ")}セット目のrepsは1以上の整数で入力してください。`,
    };
  }

  const parsedSets = buildWorkoutSets(form.sets);
  if (!parsedSets.ok) {
    return parsedSets;
  }

  const timestamp = now.toISOString();
  return {
    ok: true,
    record: {
      id: baseRecord?.id ?? createRecordId(),
      date: form.date,
      exerciseName: form.exerciseName.trim(),
      exerciseType: "weighted",
      topSet: {
        successWeightKg: parseOptionalWeightValue(form.topSuccessWeightKg),
        failedWeightKg: parseOptionalWeightValue(form.topFailedWeightKg),
      },
      sets: parsedSets.sets,
      note: form.note.trim(),
      createdAt: baseRecord?.createdAt ?? timestamp,
      updatedAt: timestamp,
    },
  };
}

function buildWorkoutSets(
  formSets: FormSet[],
): { ok: true; sets: WorkoutSet[] } | { ok: false; error: string } {
  let previousWeightKg: number | null = null;
  const sets: WorkoutSet[] = [];

  for (const [index, set] of formSets.entries()) {
    const weightText = set.weightKg.trim();
    const repsText = set.reps.trim();
    const hasWeight = weightText !== "";
    const hasReps = repsText !== "";

    if (!hasWeight && !hasReps) {
      continue;
    }

    if (!hasReps) {
      return {
        ok: false,
        error: `${index + 1}セット目のrepsを入力してください。`,
      };
    }

    if (!hasWeight && previousWeightKg === null) {
      return {
        ok: false,
        error: `${index + 1}セット目の重量を入力してください。`,
      };
    }

    if (hasWeight) {
      previousWeightKg = Number.parseFloat(weightText);
    }

    sets.push({
      setNumber: sets.length + 1,
      weightKg: previousWeightKg ?? 0,
      reps: Number.parseInt(repsText, 10),
    });
  }

  if (sets.length === 0) {
    return { ok: false, error: "セット内容を1件以上入力してください。" };
  }

  return { ok: true, sets };
}

function parseOptionalWeightValue(value: string): number | null {
  return value.trim() === "" ? null : Number.parseFloat(value);
}

function formatOptionalWeight(value: number | null): string {
  return value === null ? "" : String(value);
}

function createRecordId(): RecordId {
  return `record_${createUuid()}`;
}

function createUuid(): string {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}
