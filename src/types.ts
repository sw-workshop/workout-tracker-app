export type RecordId = `record_${string}`;

export type ExerciseType = "weighted";

export type TopSet = {
  successWeightKg: number | null;
  failedWeightKg: number | null;
};

export type WorkoutSet = {
  setNumber: number;
  weightKg: number;
  reps: number;
};

export type WorkoutRecord = {
  id: RecordId;
  date: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  topSet: TopSet;
  sets: WorkoutSet[];
  note: string;
  createdAt: string;
  updatedAt: string;
};
