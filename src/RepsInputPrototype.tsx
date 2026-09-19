import { useEffect, useRef, useState } from "react";

import { shouldAcceptRepsInput } from "./inputConstraints";

import "./repsInputPrototype.css";

type InputMode = "stepper" | "wheel";

const MIN_REPS = 1;
const MAX_REPS = 999;
const WHEEL_MAX_REPS = 30;
const WHEEL_ITEM_HEIGHT = 48;
const INITIAL_REPS: Array<number | null> = [8, 7, null];

function clampReps(value: number): number {
  return Math.min(MAX_REPS, Math.max(MIN_REPS, value));
}

function findPreviousReps(reps: Array<number | null>, index: number): number | null {
  for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
    const value = reps[previousIndex];
    if (value !== null) {
      return value;
    }
  }

  return null;
}

export function RepsInputPrototype() {
  const [inputMode, setInputMode] = useState<InputMode>("stepper");
  const [reps, setReps] = useState<Array<number | null>>(INITIAL_REPS);
  const [activeSetIndex, setActiveSetIndex] = useState<number | null>(null);
  const [draftReps, setDraftReps] = useState("8");
  const [usesDirectInput, setUsesDirectInput] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const wheelRef = useRef<HTMLDivElement>(null);

  const totalReps = reps.reduce<number>((total, value) => total + (value ?? 0), 0);

  useEffect(() => {
    if (activeSetIndex === null || usesDirectInput || wheelRef.current === null) {
      return;
    }

    const wheelValue = Math.min(Number(draftReps) || MIN_REPS, WHEEL_MAX_REPS);
    wheelRef.current.scrollTop = (wheelValue - MIN_REPS) * WHEEL_ITEM_HEIGHT;
  }, [activeSetIndex, draftReps, usesDirectInput]);

  function switchMode(mode: InputMode) {
    setInputMode(mode);
    setActiveSetIndex(null);
    setUsesDirectInput(false);
    setStatusMessage("");
  }

  function updateReps(index: number, value: number | null) {
    setReps((currentReps) =>
      currentReps.map((currentValue, currentIndex) =>
        currentIndex === index ? value : currentValue,
      ),
    );
    setStatusMessage("");
  }

  function adjustReps(index: number, amount: number) {
    const currentValue = reps[index];
    const previousValue = findPreviousReps(reps, index);
    const baseValue = currentValue ?? previousValue ?? 8;
    updateReps(index, clampReps(baseValue + amount));
  }

  function updateDirectReps(index: number, text: string) {
    if (text === "") {
      updateReps(index, null);
      return;
    }

    if (!shouldAcceptRepsInput(text)) {
      return;
    }

    updateReps(index, Number.parseInt(text, 10));
  }

  function removeSet(index: number) {
    setReps((currentReps) =>
      currentReps.length === 1
        ? currentReps
        : currentReps.filter((_, currentIndex) => currentIndex !== index),
    );
    setStatusMessage("");
  }

  function openWheel(index: number) {
    const initialValue = reps[index] ?? findPreviousReps(reps, index) ?? 8;
    setActiveSetIndex(index);
    setDraftReps(String(initialValue));
    setUsesDirectInput(initialValue > WHEEL_MAX_REPS);
    setStatusMessage("");
  }

  function closeWheel() {
    setActiveSetIndex(null);
    setUsesDirectInput(false);
  }

  function confirmWheel() {
    if (activeSetIndex === null) {
      return;
    }

    updateReps(activeSetIndex, clampReps(Number.parseInt(draftReps, 10) || MIN_REPS));
    closeWheel();
  }

  function handleWheelScroll() {
    if (wheelRef.current === null) {
      return;
    }

    const index = Math.round(wheelRef.current.scrollTop / WHEEL_ITEM_HEIGHT);
    setDraftReps(String(Math.min(WHEEL_MAX_REPS, Math.max(MIN_REPS, index + MIN_REPS))));
  }

  return (
    <main className="reps-prototype-shell">
      <section className="reps-prototype" aria-label="reps入力方式の比較">
        <header className="prototype-header">
          <span aria-hidden="true" />
          <div>
            <p>Workout Tracker</p>
            <h1>reps入力比較</h1>
          </div>
          <span aria-hidden="true" />
        </header>

        <div className="prototype-mode-switch" role="group" aria-label="入力方式">
          <button
            type="button"
            className={inputMode === "stepper" ? "selected" : ""}
            aria-pressed={inputMode === "stepper"}
            onClick={() => switchMode("stepper")}
          >
            ステッパー
          </button>
          <button
            type="button"
            className={inputMode === "wheel" ? "selected" : ""}
            aria-pressed={inputMode === "wheel"}
            onClick={() => switchMode("wheel")}
          >
            ホイール
          </button>
        </div>

        <div className="prototype-content">
          <section className="prototype-section" aria-labelledby="prototype-set-heading">
            <div className="prototype-section-heading">
              <h2 id="prototype-set-heading">セット内容</h2>
              <p>合計 {totalReps} reps</p>
            </div>

            <div className="prototype-column-labels" aria-hidden="true">
              <span>#</span>
              <span>重量</span>
              <span>reps</span>
              <span />
            </div>

            <div className="prototype-set-list">
              {reps.map((value, index) => {
                const previousValue = findPreviousReps(reps, index);
                const suggestedValue = previousValue ?? 8;
                const setNumber = index + 1;

                return (
                  <div className="prototype-set-row" key={setNumber}>
                    <span className="prototype-set-number">{setNumber}</span>
                    <div
                      className="prototype-weight"
                      aria-label={`${setNumber}セット目の重量`}
                    >
                      60
                    </div>

                    {inputMode === "stepper" ? (
                      <div className="prototype-stepper">
                        <button
                          type="button"
                          aria-label={`${setNumber}セット目のrepsを減らす`}
                          onClick={() => adjustReps(index, -1)}
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`${setNumber}セット目のreps`}
                          value={value ?? ""}
                          placeholder={String(suggestedValue)}
                          onChange={(event) =>
                            updateDirectReps(index, event.target.value)
                          }
                        />
                        <button
                          type="button"
                          aria-label={`${setNumber}セット目のrepsを増やす`}
                          onClick={() => adjustReps(index, 1)}
                        >
                          ＋
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={`prototype-wheel-trigger ${value === null ? "suggested" : ""}`}
                        aria-label={`${setNumber}セット目のrepsを選択`}
                        onClick={() => openWheel(index)}
                      >
                        {value ?? suggestedValue}
                      </button>
                    )}

                    <button
                      type="button"
                      className="prototype-delete-button"
                      aria-label={`${setNumber}セット目を削除`}
                      disabled={reps.length === 1}
                      onClick={() => removeSet(index)}
                    >
                      −
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="prototype-section prototype-note-section">
            <h2>所感</h2>
            <textarea aria-label="所感" placeholder="フォーム末尾の入力欄" />
          </section>
        </div>

        <footer className="prototype-save-footer">
          <button
            type="button"
            onClick={() => setStatusMessage("比較用モックのため保存されません。")}
          >
            保存
          </button>
          <p aria-live="polite">{statusMessage}</p>
        </footer>

        {activeSetIndex !== null ? (
          <div className="prototype-picker-backdrop" role="presentation">
            <section
              className="prototype-picker"
              role="dialog"
              aria-modal="true"
              aria-label={`${activeSetIndex + 1}セット目のrepsを選択`}
            >
              <div className="prototype-picker-header">
                <button type="button" onClick={closeWheel}>
                  キャンセル
                </button>
                <h2>repsを選択</h2>
                <button type="button" onClick={confirmWheel}>
                  決定
                </button>
              </div>

              {usesDirectInput ? (
                <label className="prototype-direct-input">
                  <span>直接入力</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="repsを直接入力"
                    value={draftReps}
                    onChange={(event) => {
                      if (shouldAcceptRepsInput(event.target.value)) {
                        setDraftReps(event.target.value);
                      }
                    }}
                  />
                  <button type="button" onClick={() => setUsesDirectInput(false)}>
                    ホイールに戻る
                  </button>
                </label>
              ) : (
                <>
                  <div className="prototype-wheel-window" aria-label="repsホイール">
                    <div
                      className="prototype-wheel"
                      ref={wheelRef}
                      onScroll={handleWheelScroll}
                    >
                      {Array.from(
                        { length: WHEEL_MAX_REPS },
                        (_, index) => index + 1,
                      ).map((wheelValue) => (
                        <button
                          type="button"
                          className={wheelValue === Number(draftReps) ? "selected" : ""}
                          key={wheelValue}
                          onClick={() => setDraftReps(String(wheelValue))}
                        >
                          {wheelValue}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="prototype-direct-button"
                    onClick={() => setUsesDirectInput(true)}
                  >
                    直接入力
                  </button>
                </>
              )}
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
