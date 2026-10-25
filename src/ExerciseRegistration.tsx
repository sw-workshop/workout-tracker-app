import { useRef, useState } from "react";
import type { Exercise } from "./types";
import type { ExerciseRepository } from "./exerciseRepository";

export function ExerciseRegistration({
  initialName,
  repository,
  onSelect,
  onClose,
}: {
  initialName: string;
  repository: ExerciseRepository;
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [unilateral, setUnilateral] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  async function register() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      onSelect(await repository.add(name, unilateral));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "種目を登録できませんでした。");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="record-form-app" aria-label="種目登録">
        <header className="form-header">
          <button
            type="button"
            className="back-button button-secondary"
            onClick={onClose}
            disabled={busy}
          >
            ← 戻る
          </button>
          <div>
            <p className="screen-label">Workout Tracker</p>
            <h1>種目を登録</h1>
          </div>
          <span />
        </header>
        <div className="exercise-picker-content">
          <div className="form-section">
            <label className="field">
              <span>
                種目名 <span className="required-mark">*</span>
              </span>
              <input
                aria-label="登録する種目名"
                value={name}
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={error !== ""}
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
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
          </div>
        </div>
        <footer className="form-footer">
          <button
            type="button"
            className="button-primary bottom-save-button"
            disabled={busy}
            onClick={() => void register()}
          >
            登録して選択
          </button>
        </footer>
      </section>
    </main>
  );
}
