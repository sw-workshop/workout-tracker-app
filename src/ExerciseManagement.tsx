import { useEffect, useRef, useState } from "react";
import type { Exercise, StoredWorkoutRecord as WorkoutRecord } from "./types";
import type { ExerciseRepository } from "./exerciseRepository";
import type { WorkoutRecordClientRepository } from "./workoutRecordRepository";
import { compareExerciseNames, normalizeExerciseSearch } from "./exerciseSearch";
import { groupUnlinkedRecords, linkExerciseRecords } from "./exerciseLinking";
import { summarizeWorkoutRecord } from "./workoutRecordSummary";

export function ExerciseManagement({
  mode,
  exerciseRepository,
  recordRepository,
  onClose,
}: {
  mode: "manage" | "link";
  exerciseRepository: ExerciseRepository;
  recordRepository: WorkoutRecordClientRepository;
  onClose: () => Promise<void>;
}) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [records, setRecords] = useState<WorkoutRecord[]>([]);
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState<Exercise | "new" | null>(null);
  const [name, setName] = useState("");
  const [unilateral, setUnilateral] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetId, setTargetId] = useState("");
  const dirty =
    editing !== null &&
    (name !== (editing === "new" ? "" : editing.name) ||
      unilateral !== (editing === "new" ? false : editing.defaultIsUnilateral) ||
      hidden !== (editing === "new" ? false : editing.isHidden));
  const groups = groupUnlinkedRecords(records);
  const candidates = exercises
    .filter((item) => !item.isHidden)
    .sort(compareExerciseNames);
  const sourceRecords = sourceName === null ? [] : (groups.get(sourceName) ?? []);

  useEffect(() => {
    let cancelled = false;
    void exerciseRepository
      .findAll()
      .then(async (masters) => {
        if (cancelled) return;
        const workouts = await recordRepository.findAll();
        if (cancelled) return;
        setExercises(masters);
        setRecords(workouts);
        setLoaded(true);
        setBusy(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("データを読み込めません。保存済みデータは変更していません。");
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [exerciseRepository, recordRepository]);

  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "処理に失敗しました。もう一度お試しください。",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function edit(item: Exercise | "new") {
    setEditing(item);
    setName(item === "new" ? "" : item.name);
    setUnilateral(item === "new" ? false : item.defaultIsUnilateral);
    setHidden(item === "new" ? false : item.isHidden);
    setError("");
    setNotice("");
  }

  function back() {
    if (dirty && !window.confirm("未保存の変更があります。破棄して戻りますか？")) return;
    if (editing) {
      setEditing(null);
      setError("");
      return;
    }
    if (sourceName !== null) {
      setSourceName(null);
      setError("");
      return;
    }
    void run(onClose);
  }

  async function saveMaster() {
    if (!editing) return;
    const saved =
      editing === "new"
        ? await exerciseRepository.add(name, unilateral)
        : await exerciseRepository.update(editing, {
            name,
            defaultIsUnilateral: unilateral,
            isHidden: hidden,
          });
    setExercises((current) => [...current.filter((item) => item.id !== saved.id), saved]);
    if (mode === "link") setTargetId(saved.id);
    setEditing(null);
    setNotice("種目を保存しました。");
  }

  async function reload() {
    const masters = await exerciseRepository.findAll();
    const workouts = await recordRepository.findAll();
    setExercises(masters);
    setRecords(workouts);
    setEditing(null);
    setSourceName(null);
    setLoaded(true);
  }

  async function assign() {
    const target = exercises.find((item) => item.id === targetId);
    if (!target || selectedIds.length === 0)
      throw new Error("対象の記録と紐付け先を選択してください。");
    if (
      !window.confirm(`${selectedIds.length}件の記録を「${target.name}」に紐付けますか？`)
    )
      return;
    setRecords(
      await linkExerciseRecords(
        records,
        selectedIds,
        target,
        recordRepository,
        exerciseRepository,
      ),
    );
    setSourceName(null);
    setSelectedIds([]);
    setTargetId("");
    setNotice("記録を紐付けました。");
  }

  return (
    <main className="app-shell">
      <section
        className="record-form-app"
        aria-label={mode === "manage" ? "種目管理" : "既存記録の整理"}
      >
        <header className="form-header">
          <button
            className="back-button button-secondary"
            type="button"
            disabled={busy}
            onClick={back}
          >
            ← 戻る
          </button>
          <div>
            <p className="screen-label">Workout Tracker</p>
            <h1>
              {editing ? "種目を編集" : mode === "manage" ? "種目管理" : "既存記録の整理"}
            </h1>
          </div>
          <span />
        </header>
        <div className="exercise-picker-content">
          {error && (
            <div className="form-section">
              <p role="alert" className="field-error">
                {error}
              </p>
              <button
                type="button"
                className="button-secondary"
                disabled={busy}
                onClick={() => {
                  if (
                    dirty &&
                    !window.confirm("未保存の変更を破棄して最新の内容を読み込みますか？")
                  )
                    return;
                  void run(reload);
                }}
              >
                最新の内容を読み込む
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className="management-notice">
              {notice}
            </p>
          )}
          {loaded &&
            (editing ? (
              <div className="form-section">
                <label className="field">
                  <span>
                    種目名 <span className="required-mark">*</span>
                  </span>
                  <input
                    aria-label="管理する種目名"
                    value={name}
                    disabled={busy}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className="unilateral-toggle">
                  <input
                    type="checkbox"
                    checked={unilateral}
                    disabled={busy}
                    onChange={(event) => setUnilateral(event.target.checked)}
                  />
                  片側種目
                </label>
                {editing !== "new" && (
                  <label className="unilateral-toggle">
                    <input
                      type="checkbox"
                      checked={hidden}
                      disabled={busy}
                      onChange={(event) => setHidden(event.target.checked)}
                    />
                    非表示
                  </label>
                )}
              </div>
            ) : mode === "manage" ? (
              <>
                <h2 className="management-section-heading" id="managed-search-heading">
                  種目を検索
                </h2>
                <div className="form-section">
                  <input
                    type="search"
                    aria-labelledby="managed-search-heading"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <label className="unilateral-toggle">
                    <input
                      type="checkbox"
                      checked={showHidden}
                      onChange={(event) => setShowHidden(event.target.checked)}
                    />
                    非表示の種目も表示
                  </label>
                </div>
                <section
                  className="management-list"
                  aria-labelledby="managed-exercises-heading"
                >
                  <h2
                    className="management-section-heading"
                    id="managed-exercises-heading"
                  >
                    保存済みの種目
                  </h2>
                  {exercises
                    .filter(
                      (item) =>
                        (showHidden || !item.isHidden) &&
                        normalizeExerciseSearch(item.name).includes(
                          normalizeExerciseSearch(query),
                        ),
                    )
                    .sort(compareExerciseNames)
                    .map((item) => (
                      <button
                        type="button"
                        disabled={busy}
                        key={item.id}
                        onClick={() => edit(item)}
                      >
                        <span>{item.name}</span>
                        <span>
                          {item.isHidden
                            ? "非表示"
                            : item.defaultIsUnilateral
                              ? "左右"
                              : ""}{" "}
                          ›
                        </span>
                      </button>
                    ))}
                </section>
                <div className="management-register-section">
                  <button
                    type="button"
                    className="button-secondary exercise-register-button"
                    disabled={busy}
                    onClick={() => edit("new")}
                  >
                    ＋ 種目を登録
                  </button>
                </div>
              </>
            ) : sourceName === null ? (
              <div className="management-list">
                {groups.size === 0 && (
                  <p className="empty-state">未整理の記録はありません。</p>
                )}
                {[...groups]
                  .sort(([left], [right]) =>
                    compareExerciseNames(
                      { name: left, id: left },
                      { name: right, id: right },
                    ),
                  )
                  .map(([label, items]) => (
                    <button
                      type="button"
                      disabled={busy}
                      key={label}
                      onClick={() => {
                        setSourceName(label);
                        setSelectedIds(items.map((record) => record.id));
                        setTargetId("");
                        setNotice("");
                      }}
                    >
                      <span>{label}</span>
                      <span>{items.length}件 ›</span>
                    </button>
                  ))}
              </div>
            ) : (
              <div className="form-section">
                <h2>{sourceName}</h2>
                <label className="unilateral-toggle">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={selectedIds.length === sourceRecords.length}
                    onChange={(event) =>
                      setSelectedIds(
                        event.target.checked
                          ? sourceRecords.map((record) => record.id)
                          : [],
                      )
                    }
                  />
                  すべて選択
                </label>
                {sourceRecords.map((record) => (
                  <label className="link-record" key={record.id}>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={selectedIds.includes(record.id)}
                      onChange={(event) =>
                        setSelectedIds((current) =>
                          event.target.checked
                            ? [...current, record.id]
                            : current.filter((id) => id !== record.id),
                        )
                      }
                    />
                    <span>
                      {record.date} · {record.isUnilateral ? "片側" : "通常"} ·{" "}
                      {record.status === "draft"
                        ? "進行中"
                        : `${record.sets.length}セット`}
                      <br />
                      {summarizeWorkoutRecord(record)}
                      {record.note && (
                        <>
                          <br />
                          {record.note}
                        </>
                      )}
                    </span>
                  </label>
                ))}
                <label className="field">
                  <span>紐付け先</span>
                  <select
                    aria-label="紐付け先"
                    value={targetId}
                    disabled={busy}
                    onChange={(event) => setTargetId(event.target.value)}
                  >
                    <option value="">選択してください</option>
                    {candidates.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="button-secondary exercise-register-button"
                  disabled={busy}
                  onClick={() => edit("new")}
                >
                  ＋ 種目を登録
                </button>
              </div>
            ))}
        </div>
        {loaded && (editing || sourceName !== null) && (
          <footer className="form-footer">
            <button
              type="button"
              className="button-primary bottom-save-button"
              disabled={busy || (!editing && (!targetId || selectedIds.length === 0))}
              onClick={() => void run(editing ? saveMaster : assign)}
            >
              {editing ? "保存" : `${selectedIds.length}件を紐付ける`}
            </button>
          </footer>
        )}
      </section>
    </main>
  );
}
