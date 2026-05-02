interface NamedRow {
  name: string;
}

interface NamedIdentifiedRow extends NamedRow {
  id: string;
}

const rowNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function sortRowsByName<T extends NamedRow>(rows: readonly T[]) {
  return [...rows].sort((left, right) => rowNameCollator.compare(left.name, right.name));
}

export function appendSortedRowByName<T extends NamedRow>(rows: readonly T[], row: T) {
  return sortRowsByName([...rows, row]);
}

export function replaceSortedRowByName<T extends NamedIdentifiedRow>(
  rows: readonly T[],
  row: T,
) {
  return sortRowsByName(rows.map((currentRow) => (currentRow.id === row.id ? row : currentRow)));
}
