export type RecordId = `record_${string}`;

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
  id: RecordId;
  date: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  isUnilateral?: boolean;
  topSet: TopSet;
  sets: WorkoutSet[];
  note: string;
  createdAt: string;
  updatedAt: string;
};
