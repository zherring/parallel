/** "A", "A & B", "A, B & C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** "1 film", "4 films". */
export function filmCountLabel(count: number): string {
  return `${count} ${count === 1 ? "film" : "films"}`;
}
