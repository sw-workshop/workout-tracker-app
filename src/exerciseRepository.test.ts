import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalStorageWorkoutRecordRepository } from "./workoutRecordRepository";
import { groupUnlinkedRecords, linkExerciseRecords } from "./exerciseLinking";
import { compareExerciseNames, normalizeExerciseSearch } from "./exerciseSearch";
import {
  createLocalStorageExerciseRepository,
  resolveExerciseName,
  validateExerciseName,
} from "./exerciseRepository";
import {
  buildWorkoutRecordFromForm,
  buildDraftWorkoutRecord,
  createForm,
  createFormFromWorkoutRecord,
} from "./recordForm";
import type { WorkoutRecord } from "./types";

// @vitest-environment jsdom

describe("exercise master", () => {
  it("links and reloads a draft without changing its raw form and preserves its backup", async () => {
    const masters = createLocalStorageExerciseRepository(window.localStorage);
    const target = await masters.add("カール", false);
    const form = createFormFromWorkoutRecord(makeLegacyRecord());
    form.sets[0].weightKg = "70.";
    form.sets[0].leftReps = "";
    const draft = buildDraftWorkoutRecord(form, new Date());
    const repo = createLocalStorageWorkoutRecordRepository(window.localStorage);
    await repo.saveAll([draft]);
    const before = window.localStorage.getItem("workout-tracker.records");
    const linked = await linkExerciseRecords(
      await repo.findAll(),
      [draft.id],
      target,
      repo,
      masters,
    );
    expect(linked[0]).toEqual({
      ...draft,
      exerciseId: target.id,
      form: { ...draft.form, exerciseId: target.id },
    });
    expect(await repo.findAll()).toEqual(linked);
    const key = Object.keys(window.localStorage).find((key) =>
      key.startsWith("workout-tracker.pre-link-backup."),
    )!;
    expect(JSON.parse(window.localStorage.getItem(key)!).records).toBe(before);
    const renamed = await masters.update(target, {
      name: "ダンベルカール",
      defaultIsUnilateral: false,
      isHidden: true,
    });
    expect(resolveExerciseName(linked[0], [renamed])).toBe("ダンベルカール");
    expect(linked[0].isUnilateral).toBe(true);
  });
  it("renames and hides a master without changing identity, and rejects stale edits", async () => {
    const repo = createLocalStorageExerciseRepository(window.localStorage);
    const item = await repo.add("片足レッグプレス", true);
    const renamed = await repo.update(item, {
      name: "レッグプレス（片足）",
      defaultIsUnilateral: false,
      isHidden: true,
    });
    expect(renamed).toMatchObject({
      id: item.id,
      createdAt: item.createdAt,
      name: "レッグプレス（片足）",
      isHidden: true,
    });
    await expect(
      repo.update(item, { name: "古い編集", defaultIsUnilateral: true, isHidden: false }),
    ).rejects.toThrow("別の画面");
    const shown = await repo.update(renamed, {
      name: renamed.name,
      defaultIsUnilateral: true,
      isHidden: false,
    });
    expect(shown.isHidden).toBe(false);
    const other = await repo.add("別種目", false);
    await expect(
      repo.update(other, {
        name: shown.name,
        defaultIsUnilateral: false,
        isHidden: false,
      }),
    ).rejects.toThrow("同名");
  });

  it("links selected old records only after preserving an exact backup", async () => {
    const masters = createLocalStorageExerciseRepository(window.localStorage);
    const target = await masters.add("レッグプレス（片足）", true);
    const repo = createLocalStorageWorkoutRecordRepository(window.localStorage);
    const old = makeLegacyRecord();
    const other = { ...old, id: "record_other" as const };
    await repo.saveAll([old, other]);
    const before = window.localStorage.getItem("workout-tracker.records");
    const loaded = await repo.findAll();
    expect(groupUnlinkedRecords(loaded).get(old.exerciseName)).toHaveLength(2);
    const linked = await linkExerciseRecords(loaded, [old.id], target, repo, masters);
    expect(linked[0]).toEqual({ ...old, exerciseId: target.id });
    expect(linked[1]).toEqual(other);
    expect(groupUnlinkedRecords(linked).get(old.exerciseName)).toHaveLength(1);
    const key = Object.keys(window.localStorage).find((value) =>
      value.startsWith("workout-tracker.pre-link-backup."),
    )!;
    expect(JSON.parse(window.localStorage.getItem(key)!).records).toBe(before);
    expect(resolveExerciseName(linked[0], [target])).toBe(target.name);
  });

  it.each(["backup", "records"])(
    "keeps original records if the %s write fails",
    async (stage) => {
      const masters = createLocalStorageExerciseRepository(window.localStorage);
      const target = await masters.add("紐付け先", false);
      const repo = createLocalStorageWorkoutRecordRepository(window.localStorage);
      await repo.saveAll([makeLegacyRecord()]);
      const records = await repo.findAll();
      const before = window.localStorage.getItem("workout-tracker.records");
      const original = Storage.prototype.setItem;
      const failure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
        this: Storage,
        key,
        value,
      ) {
        if (
          (stage === "backup" && key.startsWith("workout-tracker.pre-link-backup.")) ||
          (stage === "records" && key === "workout-tracker.records")
        )
          throw new Error("保存失敗");
        original.call(this, key, value);
      });
      await expect(
        linkExerciseRecords(records, [records[0].id], target, repo, masters),
      ).rejects.toThrow(stage === "backup" ? "退避できない" : "保存失敗");
      expect(window.localStorage.getItem("workout-tracker.records")).toBe(before);
      failure.mockRestore();
      await expect(
        linkExerciseRecords(records, [records[0].id], target, repo, masters),
      ).resolves.toHaveLength(1);
    },
  );

  it("rejects stale record or master snapshots without linking", async () => {
    const masters = createLocalStorageExerciseRepository(window.localStorage);
    const target = await masters.add("紐付け先", false);
    const repo = createLocalStorageWorkoutRecordRepository(window.localStorage);
    await repo.saveAll([makeLegacyRecord()]);
    const records = await repo.findAll();
    window.localStorage.setItem(
      "workout-tracker.records",
      JSON.stringify([{ ...records[0], note: "別タブ" }]),
    );
    await expect(
      linkExerciseRecords(records, [records[0].id], target, repo, masters),
    ).rejects.toThrow("別の画面");
    await masters.update(target, {
      name: "新しい名前",
      isHidden: false,
      defaultIsUnilateral: false,
    });
    await expect(
      linkExerciseRecords(records, [records[0].id], target, repo, masters),
    ).rejects.toThrow("紐付け先");
  });
  it("sorts names in Japanese order independently of registration or selection order", () => {
    const items = [
      { id: "exercise_z", name: "ベンチ10" },
      { id: "exercise_b", name: "れっぐプレス" },
      { id: "exercise_a", name: "アームカール" },
      { id: "exercise_c", name: "ベンチ2" },
      { id: "exercise_d", name: "レッグプレス" },
    ];
    const sorted = [...items].sort(compareExerciseNames);
    expect(sorted.slice(0, 3).map((item) => item.name)).toEqual([
      "アームカール",
      "ベンチ2",
      "ベンチ10",
    ]);
    expect([...items].reverse().sort(compareExerciseNames)).toEqual(sorted);
    expect(
      [
        { id: "exercise_b", name: "同名" },
        { id: "exercise_a", name: "同名" },
      ].sort(compareExerciseNames)[0].id,
    ).toBe("exercise_a");
    expect(items[0].name).toBe("ベンチ10");
  });
  it("matches hiragana and katakana for search only", async () => {
    expect(normalizeExerciseSearch(" べんち ")).toBe("ベンチ");
    expect(normalizeExerciseSearch("だんべる")).toBe("ダンベル");
    expect(normalizeExerciseSearch("う\u3099ぁりえーしょん")).toBe("ヴァリエーション");
    expect(normalizeExerciseSearch("胸")).not.toBe(normalizeExerciseSearch("チェスト"));
    const repo = createLocalStorageExerciseRepository(window.localStorage);
    await repo.add("ベンチ", false);
    await repo.add("べんち", false);
    expect((await repo.findAll()).map((item) => item.name)).toEqual(["ベンチ", "べんち"]);
  });
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("adds and reloads a stable ID with a default", async () => {
    const repo = createLocalStorageExerciseRepository(window.localStorage);
    const added = await repo.add(" ベンチプレス ", true);
    expect(added).toMatchObject({
      name: "ベンチプレス",
      defaultIsUnilateral: true,
      isHidden: false,
    });
    expect(added.id).toMatch(/^exercise_/);
    expect(await repo.findAll()).toEqual([added]);
    await expect(repo.add("ベンチプレス", false)).rejects.toThrow("同名");
    expect(await repo.findAll()).toHaveLength(1);
  });

  it("rechecks current storage when a different repository has added an item", async () => {
    const first = createLocalStorageExerciseRepository(window.localStorage);
    const second = createLocalStorageExerciseRepository(window.localStorage);
    await first.findAll();
    await second.add("スクワット", false);
    await first.add("デッドリフト", false);
    expect(await first.findAll()).toHaveLength(2);
    await expect(second.add("デッドリフト", true)).rejects.toThrow("同名");
  });

  it("preserves invalid data rather than overwriting it", async () => {
    for (const raw of ["{", "{}", '[{"name":"test"}]']) {
      window.localStorage.setItem("workout-tracker.exercises", raw);
      const repo = createLocalStorageExerciseRepository(window.localStorage);
      await expect(repo.findAll()).rejects.toThrow();
      await expect(repo.add("新種目", false)).rejects.toThrow();
      expect(window.localStorage.getItem("workout-tracker.exercises")).toBe(raw);
    }
  });

  it("rejects hidden duplicate names", async () => {
    const repo = createLocalStorageExerciseRepository(window.localStorage);
    const added = await repo.add("スクワット", false);
    window.localStorage.setItem(
      "workout-tracker.exercises",
      JSON.stringify([{ ...added, isHidden: true }]),
    );
    await expect(repo.add(" スクワット ", true)).rejects.toThrow("非表示");
  });

  it("validates trimmed 1-100 code point names without normalizing distinct names", () => {
    expect(validateExerciseName(" あ ")).toBe("あ");
    expect(validateExerciseName("あ".repeat(100))).toHaveLength(100);
    expect(() => validateExerciseName(" ")).toThrow();
    expect(() => validateExerciseName("あ".repeat(101))).toThrow();
    expect(validateExerciseName("Ａ a  b")).toBe("Ａ a  b");
  });

  it("resolves renamed or hidden masters and preserves the record ID through editing", async () => {
    const master = await createLocalStorageExerciseRepository(window.localStorage).add(
      "新しい名前",
      true,
    );
    const form = {
      ...createForm("2026-10-24"),
      exerciseId: master.id,
      exerciseName: "旧名",
    };
    form.sets[0] = { ...form.sets[0], weightKg: "60", reps: "8" };
    const result = buildWorkoutRecordFromForm(form, new Date());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(resolveExerciseName(result.record, [{ ...master, isHidden: true }])).toBe(
      "新しい名前",
    );
    expect(resolveExerciseName(result.record, [])).toBe("旧名");
    expect(createFormFromWorkoutRecord(result.record).exerciseId).toBe(master.id);
    expect(result.record.isUnilateral).toBeUndefined();
    const legacy: WorkoutRecord = { ...result.record, exerciseId: undefined };
    expect(resolveExerciseName(legacy, [master])).toBe("旧名");
  });
});

function makeLegacyRecord(): WorkoutRecord {
  return {
    id: "record_legacy",
    date: "2026-10-24",
    exerciseName: "片足レッグプレス",
    exerciseType: "weighted",
    isUnilateral: true,
    topSet: { successWeightKg: null, failedWeightKg: null },
    sets: [
      {
        setNumber: 1,
        right: { weightKg: 70, reps: 10 },
        left: { weightKg: 65, reps: 8 },
      },
    ],
    note: "元の所感",
    createdAt: "2026-10-24T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z",
  };
}
