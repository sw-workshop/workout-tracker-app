import { useEffect, useMemo, useRef, useState } from "react";

import type { WorkoutRecord } from "./types";
import { CalendarCarousel } from "./CalendarCarousel";
import { WorkoutSheet } from "./WorkoutSheet";
import { readViewState, writeViewState } from "./viewState";

import { formatDateLabel, formatMonthTitle, formatStorageDate } from "./dateUtils";
import {
  isValidWeightValue,
  parseRepsValue,
  shouldAcceptRepsInput,
  shouldAcceptWeightInput,
} from "./inputConstraints";
import {
  buildWorkoutRecordFromForm,
  countTotalReps,
  createForm,
  createFormFromWorkoutRecord,
  findInvalidRepsSetNumbers,
  findInvalidWeightLabels,
  type FormSet,
  type RecordForm,
} from "./recordForm";
import { createLocalStorageWorkoutRecordRepository } from "./workoutRecordRepository";
import {
  countWorkoutRecordTotalReps,
  formatReps,
  formatWeight,
  formatWorkoutRecordDate,
  summarizeWorkoutRecord,
} from "./workoutRecordSummary";

const exerciseOptions = [
  "ベンチプレス",
  "スクワット",
  "デッドリフト",
  "ショルダープレス",
  "ラットプルダウン",
  "汎用",
];
const defaultReps = 8;
const minReps = 1;
const maxReps = 999;
const discardChangesMessage = "未保存の変更があります。破棄して戻りますか？";

type ViewMode = "calendar" | "new-record" | "edit-record" | "record-detail";

type SetValidationError = {
  weightKg?: string;
  reps?: string;
  leftWeightKg?: string;
  leftReps?: string;
};

type FormValidationErrors = {
  date?: string;
  exerciseName?: string;
  topSuccessWeightKg?: string;
  topFailedWeightKg?: string;
  setSection?: string;
  sets: SetValidationError[];
};

function RequiredMark() {
  return (
    <span className="required-mark" aria-hidden="true">
      *
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  return message === undefined ? null : <p className="field-error">{message}</p>;
}

function buildFormValidationErrors(
  form: RecordForm,
  shouldShowRequiredErrors: boolean,
): FormValidationErrors {
  const invalidWeightLabels = findInvalidWeightLabels(form);
  const invalidRepsSetNumbers = findInvalidRepsSetNumbers(form.sets, form.isUnilateral);
  const setErrors = form.sets.map<SetValidationError>(() => ({}));
  const errors: FormValidationErrors = { sets: setErrors };

  if (shouldShowRequiredErrors && form.date.trim() === "") {
    errors.date = "日付を入力してください。";
  }

  if (shouldShowRequiredErrors && form.exerciseName.trim() === "") {
    errors.exerciseName = "種目名を入力してください。";
  }

  if (invalidWeightLabels.includes("トップセット成功重量")) {
    errors.topSuccessWeightKg = "0より大きい数値で入力してください。";
  }

  if (invalidWeightLabels.includes("トップセット失敗重量")) {
    errors.topFailedWeightKg = "0より大きい数値で入力してください。";
  }

  let hasEnteredSet = false;
  let previousWeightKg = "";
  let previousLeftWeightKg = "";
  form.sets.forEach((set, index) => {
    const weightText = set.weightKg.trim();
    const repsText = set.reps.trim();
    const hasWeight = weightText !== "";
    const hasReps = repsText !== "";

    const leftWeightText = set.leftWeightKg.trim();
    const leftRepsText = set.leftReps.trim();
    const hasLeftWeight = leftWeightText !== "";
    const hasLeftReps = leftRepsText !== "";

    if (hasWeight || hasReps || (form.isUnilateral && (hasLeftWeight || hasLeftReps))) {
      hasEnteredSet = true;
    }

    if (invalidWeightLabels.includes(`${index + 1}セット目の重量`)) {
      setErrors[index].weightKg = "0より大きい数値で入力してください。";
    }

    if (invalidRepsSetNumbers.includes(index + 1)) {
      if (repsText !== "" && !shouldAcceptRepsInput(repsText)) {
        setErrors[index].reps = "1以上の整数で入力してください。";
      }
      if (
        form.isUnilateral &&
        leftRepsText !== "" &&
        !shouldAcceptRepsInput(leftRepsText)
      ) {
        setErrors[index].leftReps = "1以上の整数で入力してください。";
      }
    }

    if (invalidWeightLabels.includes(`${index + 1}セット目（左）の重量`)) {
      setErrors[index].leftWeightKg = "0より大きい数値で入力してください。";
    }

    if (
      !shouldShowRequiredErrors ||
      (!hasWeight && !hasReps && (!form.isUnilateral || (!hasLeftWeight && !hasLeftReps)))
    ) {
      if (hasWeight && isValidWeightValue(weightText)) {
        previousWeightKg = weightText;
      }
      return;
    }

    if (!hasReps) {
      setErrors[index].reps = "repsを入力してください。";
    }

    if (!hasWeight && previousWeightKg === "") {
      setErrors[index].weightKg = "重量を入力してください。";
    }

    if (hasWeight && isValidWeightValue(weightText)) {
      previousWeightKg = weightText;
    }

    if (form.isUnilateral) {
      if (!hasLeftReps) setErrors[index].leftReps = "repsを入力してください。";
      if (!hasLeftWeight && previousLeftWeightKg === "") {
        setErrors[index].leftWeightKg = "重量を入力してください。";
      }
      if (hasLeftWeight && isValidWeightValue(leftWeightText)) {
        previousLeftWeightKg = leftWeightText;
      }
    }
  });

  if (shouldShowRequiredErrors && !hasEnteredSet) {
    errors.setSection = "セット内容を1件以上入力してください。";
  }

  return errors;
}

function hasFormValidationErrors(errors: FormValidationErrors): boolean {
  return (
    errors.date !== undefined ||
    errors.exerciseName !== undefined ||
    errors.topSuccessWeightKg !== undefined ||
    errors.topFailedWeightKg !== undefined ||
    errors.setSection !== undefined ||
    errors.sets.some(
      (setError) =>
        setError.weightKg !== undefined ||
        setError.reps !== undefined ||
        setError.leftWeightKg !== undefined ||
        setError.leftReps !== undefined,
    )
  );
}

function findPreviousReps(
  sets: FormSet[],
  index: number,
  side: "right" | "left" = "right",
): number | null {
  for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
    const value = parseRepsValue(
      side === "right" ? sets[previousIndex].reps : sets[previousIndex].leftReps,
    );
    if (value > 0) {
      return value;
    }
  }

  return null;
}

function areRecordFormsEqual(left: RecordForm, right: RecordForm): boolean {
  return (
    left.date === right.date &&
    left.exerciseName === right.exerciseName &&
    left.topSuccessWeightKg === right.topSuccessWeightKg &&
    left.topFailedWeightKg === right.topFailedWeightKg &&
    left.isUnilateral === right.isUnilateral &&
    left.note === right.note &&
    left.sets.length === right.sets.length &&
    left.sets.every((set, index) => {
      const otherSet = right.sets[index];
      return (
        otherSet !== undefined &&
        set.id === otherSet.id &&
        set.weightKg === otherSet.weightKg &&
        set.reps === otherSet.reps &&
        set.leftWeightKg === otherSet.leftWeightKg &&
        set.leftReps === otherSet.leftReps
      );
    })
  );
}

export function App() {
  const today = useMemo(() => new Date(), []);
  const [restoredView] = useState(readViewState);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const nextSetRowId = useRef(1);
  const repository = useMemo(
    () => createLocalStorageWorkoutRecordRepository(window.localStorage),
    [],
  );
  const [visibleMonth, setVisibleMonth] = useState(() =>
    restoredView
      ? new Date(`${restoredView.visibleMonth}T00:00:00`)
      : new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(() =>
    restoredView ? new Date(`${restoredView.selectedDate}T00:00:00`) : today,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetRevision, setSheetRevision] = useState(0);
  const [calendarRevision, setCalendarRevision] = useState(0);
  const [records, setRecords] = useState<WorkoutRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [form, setForm] = useState<RecordForm>(() =>
    createForm(formatStorageDate(today)),
  );
  const [initialForm, setInitialForm] = useState<RecordForm | null>(null);
  const [formError, setFormError] = useState("");
  const [hasSubmittedForm, setHasSubmittedForm] = useState(false);

  const recordsByDate = useMemo(() => {
    return records.reduce<Record<string, WorkoutRecord[]>>((grouped, record) => {
      grouped[record.date] = [...(grouped[record.date] ?? []), record];
      return grouped;
    }, {});
  }, [records]);

  const selectedDateKey = formatStorageDate(selectedDate);
  const selectedRecords = recordsByDate[selectedDateKey] ?? [];
  const selectedRecord =
    selectedRecordId === null
      ? null
      : (records.find((record) => record.id === selectedRecordId) ?? null);
  const totalReps = countTotalReps(form.sets, form.isUnilateral);
  const validationErrors = useMemo(
    () => buildFormValidationErrors(form, hasSubmittedForm),
    [form, hasSubmittedForm],
  );
  const hasUnsavedChanges =
    initialForm !== null && !areRecordFormsEqual(form, initialForm);

  useEffect(() => {
    let cancelled = false;
    void repository.findAll().then((loadedRecords) => {
      if (cancelled) return;
      setRecords(loadedRecords);
      if (restoredView?.recordId) {
        if (loadedRecords.some((record) => record.id === restoredView.recordId)) {
          setSelectedRecordId(restoredView.recordId);
          setViewMode("record-detail");
        } else {
          setSelectedDate(today);
          setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        }
      }
      setRecordsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [repository, restoredView, today]);

  useEffect(() => {
    if (!recordsLoaded) return;
    writeViewState({
      version: 1,
      selectedDate: formatStorageDate(selectedDate),
      visibleMonth: formatStorageDate(visibleMonth),
      recordId:
        viewMode === "record-detail" || viewMode === "edit-record"
          ? selectedRecordId
          : null,
    });
  }, [recordsLoaded, selectedDate, visibleMonth, viewMode, selectedRecordId]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const preventUnsavedChangesLoss = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", preventUnsavedChangesLoss);
    return () => {
      window.removeEventListener("beforeunload", preventUnsavedChangesLoss);
    };
  }, [hasUnsavedChanges]);

  function moveMonth(monthOffset: number) {
    setSheetOpen(false);
    setVisibleMonth(
      (currentMonth) =>
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + monthOffset, 1),
    );
  }

  function selectToday() {
    setCalendarRevision((value) => value + 1);
    setSheetOpen(true);
    setSheetRevision((value) => value + 1);
    setSelectedDate(today);
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  function selectDate(date: Date) {
    setCalendarRevision((value) => value + 1);
    setSheetOpen(true);
    setSheetRevision((value) => value + 1);
    setSelectedDate(date);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function openNewRecordForm() {
    const nextForm = createForm(formatStorageDate(selectedDate));
    setForm(nextForm);
    setInitialForm(nextForm);
    setFormError("");
    setHasSubmittedForm(false);
    setViewMode("new-record");
  }

  function openRecordDetail(record: WorkoutRecord) {
    setSelectedRecordId(record.id);
    setViewMode("record-detail");
  }

  function closeRecordDetail() {
    setSheetOpen(true);
    setSelectedRecordId(null);
    setViewMode("calendar");
  }

  function openEditRecordForm(record: WorkoutRecord) {
    setSelectedRecordId(record.id);
    const nextForm = createFormFromWorkoutRecord(record);
    setForm(nextForm);
    setInitialForm(nextForm);
    setFormError("");
    setHasSubmittedForm(false);
    setViewMode("edit-record");
  }

  function closeRecordForm() {
    if (hasUnsavedChanges && !window.confirm(discardChangesMessage)) {
      return;
    }

    setInitialForm(null);
    setFormError("");
    setHasSubmittedForm(false);
    setViewMode(viewMode === "edit-record" ? "record-detail" : "calendar");
  }

  function updateFormField(
    field: Exclude<keyof RecordForm, "sets" | "isUnilateral">,
    value: string,
  ) {
    setFormError("");
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function updateWeightFormField(
    field: "topSuccessWeightKg" | "topFailedWeightKg",
    value: string,
  ) {
    if (!shouldAcceptWeightInput(value)) {
      return;
    }

    updateFormField(field, value);
  }

  function toggleUnilateralExercise(isUnilateral: boolean) {
    setFormError("");
    setForm((currentForm) => ({ ...currentForm, isUnilateral }));
  }

  function updateSet(setId: string, field: keyof Omit<FormSet, "id">, value: string) {
    setFormError("");
    setForm((currentForm) => ({
      ...currentForm,
      sets: currentForm.sets.map((set) =>
        set.id === setId ? { ...set, [field]: value } : set,
      ),
    }));
  }

  function updateSetWeight(setId: string, value: string) {
    if (!shouldAcceptWeightInput(value)) {
      return;
    }

    updateSet(setId, "weightKg", value);
  }

  function updateLeftSetWeight(setId: string, value: string) {
    if (!shouldAcceptWeightInput(value)) return;
    updateSet(setId, "leftWeightKg", value);
  }

  function updateSetReps(setId: string, value: string) {
    if (!shouldAcceptRepsInput(value)) {
      return;
    }

    updateSet(setId, "reps", value);
  }

  function adjustSetReps(setId: string, amount: number) {
    adjustSetSideReps(setId, "right", amount);
  }

  function adjustSetSideReps(setId: string, side: "right" | "left", amount: number) {
    const setIndex = form.sets.findIndex((set) => set.id === setId);
    if (setIndex < 0) {
      return;
    }

    const field = side === "right" ? "reps" : "leftReps";
    const currentValue = parseRepsValue(form.sets[setIndex][field]);
    const currentRightValue = parseRepsValue(form.sets[setIndex].reps);
    const previousValue = findPreviousReps(form.sets, setIndex, side);
    const baseValue =
      currentValue ||
      (side === "left" ? currentRightValue : 0) ||
      previousValue ||
      defaultReps;
    const nextValue = Math.min(maxReps, Math.max(minReps, baseValue + amount));
    updateSet(setId, field, String(nextValue));
  }

  function addSetRow() {
    const setId = `set-added-${nextSetRowId.current}`;
    nextSetRowId.current += 1;

    setForm((currentForm) => ({
      ...currentForm,
      sets: [
        ...currentForm.sets,
        { id: setId, weightKg: "", reps: "", leftWeightKg: "", leftReps: "" },
      ],
    }));
  }

  function removeSetRow(setId: string) {
    setForm((currentForm) => ({
      ...currentForm,
      sets:
        currentForm.sets.length === 1
          ? currentForm.sets
          : currentForm.sets.filter((set) => set.id !== setId),
    }));
  }

  async function saveRecord() {
    const nextValidationErrors = buildFormValidationErrors(form, true);
    setHasSubmittedForm(true);
    if (hasFormValidationErrors(nextValidationErrors)) {
      setFormError("");
      return;
    }

    try {
      const baseRecord = viewMode === "edit-record" ? selectedRecord : null;
      const result = buildWorkoutRecordFromForm(
        form,
        new Date(),
        baseRecord ?? undefined,
      );
      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      const recordDate = new Date(`${form.date}T00:00:00`);
      const nextRecords =
        baseRecord === null
          ? [...records, result.record]
          : records.map((record) =>
              record.id === baseRecord.id ? result.record : record,
            );
      await repository.saveAll(nextRecords);
      setRecords(nextRecords);
      setSelectedDate(recordDate);
      setVisibleMonth(new Date(recordDate.getFullYear(), recordDate.getMonth(), 1));
      setForm(createForm(form.date));
      setInitialForm(null);
      setFormError("");
      setHasSubmittedForm(false);
      setSelectedRecordId(null);
      setViewMode("calendar");
    } catch {
      setFormError(
        "保存中にエラーが発生しました。画面を再読み込みしてもう一度お試しください。",
      );
    }
  }

  async function deleteSelectedRecord(record: WorkoutRecord) {
    if (!window.confirm("この記録を削除しますか？")) {
      return;
    }

    const nextRecords = records.filter((currentRecord) => currentRecord.id !== record.id);
    const recordDate = new Date(`${record.date}T00:00:00`);
    await repository.saveAll(nextRecords);
    setRecords(nextRecords);
    setSelectedRecordId(null);
    setSelectedDate(recordDate);
    setVisibleMonth(new Date(recordDate.getFullYear(), recordDate.getMonth(), 1));
    setViewMode("calendar");
  }

  if (viewMode === "record-detail" && selectedRecord !== null) {
    return (
      <main className="app-shell">
        <section className="record-detail-app" aria-label="記録詳細">
          <header className="form-header">
            <button
              className="back-button button-secondary"
              type="button"
              onClick={closeRecordDetail}
            >
              ← 戻る
            </button>
            <div>
              <p className="screen-label">Workout Tracker</p>
              <h1>{selectedRecord.exerciseName}</h1>
            </div>
            <span aria-hidden="true" />
          </header>

          <div className="record-detail">
            <section className="form-section" aria-labelledby="detail-basic-fields">
              <h2 id="detail-basic-fields">基本</h2>
              <div className="detail-field">
                <span>日付</span>
                <p>{formatWorkoutRecordDate(selectedRecord)}</p>
              </div>
              <div className="detail-field">
                <span>種目名</span>
                <p>{selectedRecord.exerciseName}</p>
              </div>
            </section>

            <section className="form-section" aria-labelledby="detail-top-set-fields">
              <h2 id="detail-top-set-fields">トップセット</h2>
              <div className="top-set-grid">
                <div className="detail-field">
                  <span>成功重量</span>
                  <p>{formatWeight(selectedRecord.topSet.successWeightKg)}</p>
                </div>
                <div className="detail-field">
                  <span>失敗重量</span>
                  <p>{formatWeight(selectedRecord.topSet.failedWeightKg)}</p>
                </div>
              </div>
            </section>

            <section className="form-section" aria-labelledby="detail-set-fields">
              <div className="set-section-heading">
                <h2 id="detail-set-fields">セット内容</h2>
                <p>合計 {countWorkoutRecordTotalReps(selectedRecord)} reps</p>
              </div>
              <div className="detail-set-list">
                {selectedRecord.sets.map((set) =>
                  "right" in set ? (
                    <div className="detail-set-pair" key={set.setNumber}>
                      <div className="detail-set-row unilateral-row right-side">
                        <span className="set-side-badge">{set.setNumber} 右</span>
                        <span>{formatWeight(set.right.weightKg)}</span>
                        <span>{formatReps(set.right.reps)}</span>
                      </div>
                      <div className="detail-set-row unilateral-row left-side">
                        <span className="set-side-badge">{set.setNumber} 左</span>
                        <span>{formatWeight(set.left.weightKg)}</span>
                        <span>{formatReps(set.left.reps)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="detail-set-row" key={set.setNumber}>
                      <span className="set-number">{set.setNumber}</span>
                      <span>{formatWeight(set.weightKg)}</span>
                      <span>{formatReps(set.reps)}</span>
                    </div>
                  ),
                )}
              </div>
            </section>

            <section className="form-section" aria-labelledby="detail-note-field">
              <h2 id="detail-note-field">所感</h2>
              <p className={selectedRecord.note === "" ? "empty-note" : "detail-note"}>
                {selectedRecord.note === "" ? "未入力" : selectedRecord.note}
              </p>
            </section>
          </div>
          <div className="action-footer" role="group" aria-label="記録操作">
            <button
              className="edit-button button-secondary"
              type="button"
              onClick={() => openEditRecordForm(selectedRecord)}
            >
              編集
            </button>
            <button
              className="delete-record-button button-danger"
              type="button"
              onClick={() => void deleteSelectedRecord(selectedRecord)}
            >
              記録を削除
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (viewMode === "new-record" || viewMode === "edit-record") {
    const isEditing = viewMode === "edit-record";

    return (
      <main className="app-shell">
        <section
          className="record-form-app"
          aria-label={isEditing ? "記録編集フォーム" : "記録追加フォーム"}
        >
          <header className="form-header">
            <button
              className="back-button button-secondary"
              type="button"
              onClick={closeRecordForm}
            >
              ← 戻る
            </button>
            <div>
              <p className="screen-label">Workout Tracker</p>
              <h1>{isEditing ? "記録を編集" : "新しい記録"}</h1>
            </div>
            <span aria-hidden="true" />
          </header>

          <form className="record-form" onSubmit={(event) => event.preventDefault()}>
            <section className="form-section" aria-labelledby="basic-fields">
              <h2 id="basic-fields">基本</h2>
              <label className="field">
                <span>
                  日付 <RequiredMark />
                </span>
                <input
                  aria-label="日付"
                  type="date"
                  value={form.date}
                  aria-invalid={validationErrors.date !== undefined}
                  className={validationErrors.date !== undefined ? "invalid-input" : ""}
                  onChange={(event) => updateFormField("date", event.target.value)}
                />
                <FieldError message={validationErrors.date} />
              </label>
              <label className="field">
                <span>
                  種目名 <RequiredMark />
                </span>
                <input
                  aria-label="種目名"
                  list="exercise-options"
                  placeholder="ベンチプレス"
                  value={form.exerciseName}
                  aria-invalid={validationErrors.exerciseName !== undefined}
                  className={
                    validationErrors.exerciseName !== undefined ? "invalid-input" : ""
                  }
                  onChange={(event) =>
                    updateFormField("exerciseName", event.target.value)
                  }
                />
                <FieldError message={validationErrors.exerciseName} />
              </label>
              <datalist id="exercise-options">
                {exerciseOptions.map((exercise) => (
                  <option value={exercise} key={exercise} />
                ))}
              </datalist>
            </section>

            <section className="form-section" aria-labelledby="top-set-fields">
              <h2 id="top-set-fields">トップセット</h2>
              <div className="top-set-grid">
                <label className="field">
                  <span>成功重量</span>
                  <input
                    aria-label="成功重量"
                    type="text"
                    inputMode="decimal"
                    placeholder="120"
                    value={form.topSuccessWeightKg}
                    aria-invalid={validationErrors.topSuccessWeightKg !== undefined}
                    className={
                      validationErrors.topSuccessWeightKg !== undefined
                        ? "invalid-input"
                        : ""
                    }
                    onChange={(event) =>
                      updateWeightFormField("topSuccessWeightKg", event.target.value)
                    }
                  />
                  <FieldError message={validationErrors.topSuccessWeightKg} />
                </label>
                <label className="field">
                  <span>失敗重量</span>
                  <input
                    aria-label="失敗重量"
                    type="text"
                    inputMode="decimal"
                    placeholder="125"
                    value={form.topFailedWeightKg}
                    aria-invalid={validationErrors.topFailedWeightKg !== undefined}
                    className={
                      validationErrors.topFailedWeightKg !== undefined
                        ? "invalid-input"
                        : ""
                    }
                    onChange={(event) =>
                      updateWeightFormField("topFailedWeightKg", event.target.value)
                    }
                  />
                  <FieldError message={validationErrors.topFailedWeightKg} />
                </label>
              </div>
            </section>

            <section className="form-section" aria-labelledby="set-fields">
              <div className="set-section-heading">
                <h2 id="set-fields">
                  セット内容 <RequiredMark />
                </h2>
                <p>合計 {totalReps} reps</p>
              </div>
              <FieldError message={validationErrors.setSection} />
              {formError !== "" ? <p className="form-error">{formError}</p> : null}

              <label className="unilateral-toggle">
                <input
                  type="checkbox"
                  checked={form.isUnilateral}
                  onChange={(event) => toggleUnilateralExercise(event.target.checked)}
                />
                <span>片側種目</span>
              </label>

              <div className="set-list">
                {form.sets.map((set, index) => {
                  const previousWeight = form.sets[index - 1]?.weightKg.trim();
                  const suggestedReps = findPreviousReps(form.sets, index) ?? defaultReps;
                  const setError = validationErrors.sets[index] ?? {};
                  const hasInvalidReps = setError.reps !== undefined;
                  const hasInvalidWeight = setError.weightKg !== undefined;
                  const previousLeftWeight = form.sets[index - 1]?.leftWeightKg.trim();
                  const suggestedLeftReps =
                    parseRepsValue(set.reps) ||
                    findPreviousReps(form.sets, index, "left") ||
                    defaultReps;
                  return (
                    <div
                      className={`set-pair${form.isUnilateral ? " is-unilateral" : ""}`}
                      key={set.id}
                    >
                      <div className="set-row right-side">
                        <span
                          className={form.isUnilateral ? "set-side-badge" : "set-number"}
                        >
                          {index + 1}
                          {form.isUnilateral ? " 右" : ""}
                        </span>
                        <label className="compact-field set-weight-field">
                          <span>重量</span>
                          <input
                            aria-label="重量"
                            type="text"
                            inputMode="decimal"
                            placeholder={previousWeight || "90"}
                            value={set.weightKg}
                            aria-invalid={hasInvalidWeight}
                            className={hasInvalidWeight ? "invalid-input" : ""}
                            onChange={(event) =>
                              updateSetWeight(set.id, event.target.value)
                            }
                          />
                          <FieldError message={setError.weightKg} />
                        </label>
                        <div className="compact-field">
                          <span>reps</span>
                          <div
                            className={`reps-stepper${hasInvalidReps ? " invalid-input" : ""}`}
                          >
                            <button
                              type="button"
                              aria-label={`${index + 1}セット目のrepsを減らす`}
                              onClick={() => adjustSetReps(set.id, -1)}
                            >
                              −
                            </button>
                            <input
                              aria-label="reps"
                              type="text"
                              inputMode="numeric"
                              placeholder={String(suggestedReps)}
                              value={set.reps}
                              aria-invalid={hasInvalidReps}
                              className={hasInvalidReps ? "invalid-input" : ""}
                              onChange={(event) =>
                                updateSetReps(set.id, event.target.value)
                              }
                            />
                            <button
                              type="button"
                              aria-label={`${index + 1}セット目のrepsを増やす`}
                              onClick={() => adjustSetReps(set.id, 1)}
                            >
                              +
                            </button>
                          </div>
                          <FieldError message={setError.reps} />
                        </div>
                        <button
                          className="delete-set-button button-danger"
                          type="button"
                          onClick={() => removeSetRow(set.id)}
                          disabled={form.sets.length === 1}
                          aria-label={`${index + 1}セット目を削除`}
                        >
                          −
                        </button>
                      </div>
                      {form.isUnilateral ? (
                        <div className="set-row left-side">
                          <span className="set-side-badge">{index + 1} 左</span>
                          <label className="compact-field set-weight-field unlabeled-field">
                            <span className="visually-hidden">左の重量</span>
                            <input
                              aria-label={`${index + 1}セット目（左）の重量`}
                              type="text"
                              inputMode="decimal"
                              placeholder={set.weightKg || previousLeftWeight || "10"}
                              value={set.leftWeightKg}
                              aria-invalid={setError.leftWeightKg !== undefined}
                              className={setError.leftWeightKg ? "invalid-input" : ""}
                              onChange={(event) =>
                                updateLeftSetWeight(set.id, event.target.value)
                              }
                            />
                            <FieldError message={setError.leftWeightKg} />
                          </label>
                          <div className="compact-field unlabeled-field">
                            <span className="visually-hidden">左のreps</span>
                            <div
                              className={`reps-stepper${setError.leftReps ? " invalid-input" : ""}`}
                            >
                              <button
                                type="button"
                                aria-label={`${index + 1}セット目（左）のrepsを減らす`}
                                onClick={() => adjustSetSideReps(set.id, "left", -1)}
                              >
                                −
                              </button>
                              <input
                                aria-label={`${index + 1}セット目（左）のreps`}
                                type="text"
                                inputMode="numeric"
                                placeholder={String(suggestedLeftReps)}
                                value={set.leftReps}
                                aria-invalid={setError.leftReps !== undefined}
                                onChange={(event) => {
                                  if (shouldAcceptRepsInput(event.target.value)) {
                                    updateSet(set.id, "leftReps", event.target.value);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                aria-label={`${index + 1}セット目（左）のrepsを増やす`}
                                onClick={() => adjustSetSideReps(set.id, "left", 1)}
                              >
                                +
                              </button>
                            </div>
                            <FieldError message={setError.leftReps} />
                          </div>
                          <span aria-hidden="true" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <button
                className="add-set-button button-secondary"
                type="button"
                onClick={addSetRow}
              >
                + セットを追加
              </button>
            </section>

            <section className="form-section" aria-labelledby="note-field">
              <h2 id="note-field">所感</h2>
              <label className="field">
                <span>メモ</span>
                <textarea
                  rows={4}
                  placeholder="トップ後なのでメインセットが重く感じた"
                  value={form.note}
                  onChange={(event) => updateFormField("note", event.target.value)}
                />
              </label>
            </section>
          </form>
          <div className="form-footer" role="group" aria-label="保存アクション">
            <button
              className="bottom-save-button button-primary"
              type="button"
              onClick={() => void saveRecord()}
            >
              保存
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="calendar-app" aria-label="Workout Tracker calendar prototype">
        <header className="calendar-header">
          <button
            className="today-button button-secondary"
            type="button"
            onClick={selectToday}
          >
            ← 今日
          </button>
          <div>
            <p className="screen-label">Workout Tracker</p>
            <h1>{formatMonthTitle(visibleMonth)}</h1>
          </div>
          <div aria-hidden="true" />
        </header>

        <div className="calendar-scroll">
          <CalendarCarousel
            key={calendarRevision}
            visibleMonth={visibleMonth}
            selectedDateKey={selectedDateKey}
            todayKey={formatStorageDate(today)}
            recordsByDate={recordsByDate}
            onSelectDate={selectDate}
            onMoveMonth={moveMonth}
          />
          <div className="calendar-sheet-clearance" aria-hidden="true" />
        </div>

        {sheetOpen && (
          <WorkoutSheet
            key={`${selectedDateKey}-${sheetRevision}`}
            onClose={() => setSheetOpen(false)}
            heading={<h2>{formatDateLabel(selectedDate)}</h2>}
            action={
              <button
                className="add-record-button button-primary"
                type="button"
                onClick={openNewRecordForm}
              >
                + 新しい記録を作成
              </button>
            }
          >
            {selectedRecords.length > 0 ? (
              <div className="record-list">
                {selectedRecords.map((record) => (
                  <button
                    className="record-summary"
                    type="button"
                    key={record.id}
                    onClick={() => openRecordDetail(record)}
                  >
                    <div className="record-accent" aria-hidden="true" />
                    <div>
                      <h3>{record.exerciseName}</h3>
                      <p>{summarizeWorkoutRecord(record)}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="empty-state">この日の記録はまだありません。</p>
            )}
          </WorkoutSheet>
        )}
      </section>
    </main>
  );
}
