import type { DraftWorkoutRecord } from "./types";

function weight(value: string): string {
  return value === "" ? "未入力" : `${value}kg`;
}

function reps(value: string): string {
  return value === "" ? "未入力" : `${value} reps`;
}

export function DraftWorkoutDetails({ record }: { record: DraftWorkoutRecord }) {
  const form = record.form;
  return (
    <>
      <section className="form-section" aria-labelledby="draft-top-fields">
        <h2 id="draft-top-fields">トップセット</h2>
        <div className="top-set-grid">
          <div className="detail-field">
            <span>成功重量</span>
            <p>{weight(form.topSuccessWeightKg)}</p>
          </div>
          <div className="detail-field">
            <span>失敗重量</span>
            <p>{weight(form.topFailedWeightKg)}</p>
          </div>
        </div>
      </section>
      <section className="form-section" aria-labelledby="draft-set-fields">
        <h2 id="draft-set-fields">セット内容</h2>
        <div className="detail-set-list">
          {form.sets.map((set, index) => (
            <div key={set.id} className="detail-set-pair">
              <div
                className={`detail-set-row${form.isUnilateral ? " unilateral-row right-side" : ""}`}
              >
                <span className={form.isUnilateral ? "set-side-badge" : "set-number"}>
                  {index + 1}
                  {form.isUnilateral ? " 右" : ""}
                </span>
                <span>{weight(set.weightKg)}</span>
                <span>{reps(set.reps)}</span>
              </div>
              {form.isUnilateral && (
                <div className="detail-set-row unilateral-row left-side">
                  <span className="set-side-badge">{index + 1} 左</span>
                  <span>{weight(set.leftWeightKg)}</span>
                  <span>{reps(set.leftReps)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
