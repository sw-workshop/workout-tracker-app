import { useEffect, useMemo, useRef, useState } from "react";

import type { WorkoutRecord } from "./types";

import {
  buildMonthCalendar,
  formatDateLabel,
  formatMonthTitle,
  formatStorageDate,
  isSameMonth,
} from "./dateUtils";
import {
  isValidWeightValue,
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

const weekDays = ["月", "火", "水", "木", "金", "土", "日"];
const exerciseOptions = [
  "ベンチプレス",
  "スクワット",
  "デッドリフト",
  "ショルダープレス",
  "ラットプルダウン",
  "汎用",
];

type ViewMode = "calendar" | "new-record" | "edit-record" | "record-detail";

type SetValidationError = {
  weightKg?: string;
  reps?: string;
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
  const invalidRepsSetNumbers = findInvalidRepsSetNumbers(form.sets);
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
  form.sets.forEach((set, index) => {
    const weightText = set.weightKg.trim();
    const repsText = set.reps.trim();
    const hasWeight = weightText !== "";
    const hasReps = repsText !== "";

    if (hasWeight || hasReps) {
      hasEnteredSet = true;
    }

    if (invalidWeightLabels.includes(`${index + 1}セット目の重量`)) {
      setErrors[index].weightKg = "0より大きい数値で入力してください。";
    }

    if (invalidRepsSetNumbers.includes(index + 1)) {
      setErrors[index].reps = "1以上の整数で入力してください。";
    }

    if (!shouldShowRequiredErrors || (!hasWeight && !hasReps)) {
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
      (setError) => setError.weightKg !== undefined || setError.reps !== undefined,
    )
  );
}

export function App() {
  const today = useMemo(() => new Date(), []);
  const nextSetRowId = useRef(1);
  const repository = useMemo(
    () => createLocalStorageWorkoutRecordRepository(window.localStorage),
    [],
  );
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [records, setRecords] = useState<WorkoutRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [form, setForm] = useState<RecordForm>(() =>
    createForm(formatStorageDate(today)),
  );
  const [formError, setFormError] = useState("");
  const [hasSubmittedForm, setHasSubmittedForm] = useState(false);

  const calendarDays = useMemo(() => buildMonthCalendar(visibleMonth), [visibleMonth]);
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
  const totalReps = countTotalReps(form.sets);
  const validationErrors = useMemo(
    () => buildFormValidationErrors(form, hasSubmittedForm),
    [form, hasSubmittedForm],
  );

  useEffect(() => {
    void repository.findAll().then((loadedRecords) => {
      setRecords(loadedRecords);
    });
  }, [repository]);

  function moveMonth(monthOffset: number) {
    setVisibleMonth(
      (currentMonth) =>
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + monthOffset, 1),
    );
  }

  function selectToday() {
    setSelectedDate(today);
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  function selectDate(date: Date) {
    setSelectedDate(date);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function openNewRecordForm() {
    setForm(createForm(formatStorageDate(selectedDate)));
    setFormError("");
    setHasSubmittedForm(false);
    setViewMode("new-record");
  }

  function openRecordDetail(record: WorkoutRecord) {
    setSelectedRecordId(record.id);
    setViewMode("record-detail");
  }

  function closeRecordDetail() {
    setSelectedRecordId(null);
    setViewMode("calendar");
  }

  function openEditRecordForm(record: WorkoutRecord) {
    setSelectedRecordId(record.id);
    setForm(createFormFromWorkoutRecord(record));
    setFormError("");
    setHasSubmittedForm(false);
    setViewMode("edit-record");
  }

  function updateFormField(field: keyof Omit<RecordForm, "sets">, value: string) {
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

  function updateSetReps(setId: string, value: string) {
    if (!shouldAcceptRepsInput(value)) {
      return;
    }

    updateSet(setId, "reps", value);
  }

  function addSetRow() {
    const setId = `set-added-${nextSetRowId.current}`;
    nextSetRowId.current += 1;

    setForm((currentForm) => ({
      ...currentForm,
      sets: [...currentForm.sets, { id: setId, weightKg: "", reps: "" }],
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
            <button className="back-button" type="button" onClick={closeRecordDetail}>
              ← 戻る
            </button>
            <div>
              <p className="screen-label">Workout Tracker</p>
              <h1>{selectedRecord.exerciseName}</h1>
            </div>
            <button
              className="edit-button"
              type="button"
              onClick={() => openEditRecordForm(selectedRecord)}
            >
              編集
            </button>
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
                {selectedRecord.sets.map((set) => (
                  <div className="detail-set-row" key={set.setNumber}>
                    <span className="set-number">{set.setNumber}</span>
                    <span>{formatWeight(set.weightKg)}</span>
                    <span>{formatReps(set.reps)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="form-section" aria-labelledby="detail-note-field">
              <h2 id="detail-note-field">所感</h2>
              <p className={selectedRecord.note === "" ? "empty-note" : "detail-note"}>
                {selectedRecord.note === "" ? "未入力" : selectedRecord.note}
              </p>
            </section>

            <section className="form-section danger-section" aria-label="危険な操作">
              <button
                className="delete-record-button"
                type="button"
                onClick={() => void deleteSelectedRecord(selectedRecord)}
              >
                記録を削除
              </button>
            </section>
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
              className="back-button"
              type="button"
              onClick={() => setViewMode(isEditing ? "record-detail" : "calendar")}
            >
              ← 戻る
            </button>
            <div>
              <p className="screen-label">Workout Tracker</p>
              <h1>{isEditing ? "記録を編集" : "新しい記録"}</h1>
            </div>
            <button
              className="save-button"
              type="button"
              onClick={() => void saveRecord()}
            >
              保存
            </button>
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

              <div className="set-list">
                {form.sets.map((set, index) => {
                  const previousWeight = form.sets[index - 1]?.weightKg.trim();
                  const setError = validationErrors.sets[index] ?? {};
                  const hasInvalidReps = setError.reps !== undefined;
                  const hasInvalidWeight = setError.weightKg !== undefined;
                  return (
                    <div className="set-row" key={set.id}>
                      <span className="set-number">{index + 1}</span>
                      <label className="compact-field">
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
                      <label className="compact-field">
                        <span>reps</span>
                        <input
                          aria-label="reps"
                          type="text"
                          inputMode="numeric"
                          placeholder="8"
                          value={set.reps}
                          aria-invalid={hasInvalidReps}
                          className={hasInvalidReps ? "invalid-input" : ""}
                          onChange={(event) => updateSetReps(set.id, event.target.value)}
                        />
                        <FieldError message={setError.reps} />
                      </label>
                      <button
                        className="delete-set-button"
                        type="button"
                        onClick={() => removeSetRow(set.id)}
                        disabled={form.sets.length === 1}
                        aria-label={`${index + 1}セット目を削除`}
                      >
                        −
                      </button>
                    </div>
                  );
                })}
              </div>

              <button className="add-set-button" type="button" onClick={addSetRow}>
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

            <div className="form-footer">
              <button
                className="bottom-save-button"
                type="button"
                onClick={() => void saveRecord()}
              >
                保存
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="calendar-app" aria-label="Workout Tracker calendar prototype">
        <header className="calendar-header">
          <button className="today-button" type="button" onClick={selectToday}>
            ← 今日
          </button>
          <div>
            <p className="screen-label">Workout Tracker</p>
            <h1>{formatMonthTitle(visibleMonth)}</h1>
          </div>
          <div className="month-actions" aria-label="月移動">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="前の月">
              ‹
            </button>
            <button type="button" onClick={() => moveMonth(1)} aria-label="次の月">
              ›
            </button>
          </div>
        </header>

        <section
          className="month-grid"
          aria-label={`${formatMonthTitle(visibleMonth)}のカレンダー`}
        >
          {weekDays.map((weekDay) => (
            <div className="week-day" key={weekDay}>
              {weekDay}
            </div>
          ))}

          {calendarDays.map((date) => {
            const dateKey = formatStorageDate(date);
            const records = recordsByDate[dateKey] ?? [];
            const isSelected = dateKey === selectedDateKey;
            const isToday = dateKey === formatStorageDate(today);

            return (
              <button
                className={[
                  "day-cell",
                  isSameMonth(date, visibleMonth) ? "" : "outside-month",
                  isSelected ? "selected" : "",
                  isToday ? "today" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                key={dateKey}
                onClick={() => selectDate(date)}
                aria-pressed={isSelected}
              >
                <span className="day-number">{date.getDate()}</span>
                <span className="record-stack">
                  {records.slice(0, 2).map((record) => (
                    <span className="record-chip" key={record.id}>
                      {record.exerciseName}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </section>

        <section className="selected-day-panel" aria-label="選択日の記録">
          <div className="selected-day-heading">
            <h2>{formatDateLabel(selectedDate)}</h2>
            <button
              className="add-record-button"
              type="button"
              onClick={openNewRecordForm}
            >
              + 新しい記録を作成
            </button>
          </div>

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
        </section>
      </section>
    </main>
  );
}
