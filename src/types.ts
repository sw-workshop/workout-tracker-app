export type RecordId = `record_${string}`;

export type ExerciseId = `exercise_${string}`;

export type Exercise = {
  id: ExerciseId;
  name: string;
  defaultIsUnilateral: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExerciseType = "weighted";

export type TopSet = {
  successWeightKg: number | null;
  failedWeightKg: number | null;
};

export type StandardWorkoutSet = {
  setNumber: number;
  weightKg: number;
  reps: number;
};

export type UnilateralSetSide = {
  weightKg: number;
  reps: number;
};

export type UnilateralWorkoutSet = {
  setNumber: number;
  right: UnilateralSetSide;
  left: UnilateralSetSide;
};

export type WorkoutSet = StandardWorkoutSet | UnilateralWorkoutSet;

export type WorkoutRecord = {
  status?: "completed";
  id: RecordId;
  date: string;
  exerciseName: string;
  exerciseId?: ExerciseId;
  exerciseType: ExerciseType;
  isUnilateral?: boolean;
  topSet: TopSet;
  sets: WorkoutSet[];
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type DraftWorkoutRecord = Pick<
  WorkoutRecord,
  | "id"
  | "date"
  | "exerciseName"
  | "exerciseId"
  | "exerciseType"
  | "createdAt"
  | "updatedAt"
> & {
  status: "draft";
  isUnilateral: boolean;
  note: string;
  form: import("./recordForm").RecordForm;
};

export type StoredWorkoutRecord = WorkoutRecord | DraftWorkoutRecord;
