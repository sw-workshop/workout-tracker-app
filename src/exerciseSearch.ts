const nameCollator = new Intl.Collator("ja", { numeric: true });

export function compareExerciseNames(
  left: { id: string; name: string },
  right: { id: string; name: string },
): number {
  const compared = nameCollator.compare(
    normalizeExerciseSearch(left.name),
    normalizeExerciseSearch(right.name),
  );
  if (compared !== 0) return compared;
  if (left.name !== right.name) return left.name < right.name ? -1 : 1;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function normalizeExerciseSearch(value: string): string {
  return value
    .trim()
    .normalize("NFC")
    .replace(/[\u3041-\u3096]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) + 0x60),
    );
}
