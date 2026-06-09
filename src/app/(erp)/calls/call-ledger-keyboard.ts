export const EDITABLE_CALL_FIELDS = [
  "startTime",
  "roomId",
  "courseId",
  "customerMemo",
  "therapist1Id",
  "therapist2Id",
  "earcareEmployeeId",
  "status",
  "discountTypeCode",
  "paymentMethodCode",
  "note",
  "confirmationCode"
] as const;

export const READONLY_CALL_FIELDS = [
  "paymentAmount",
  "discountAmount",
  "therapist1Commission",
  "therapist2Commission",
  "earcarePoolAmount",
  "opsCallCredit",
  "calculationStatus"
] as const;

const NAVIGABLE_CALL_FIELDS = [...EDITABLE_CALL_FIELDS, ...READONLY_CALL_FIELDS] as const;

export type EditableCallField = (typeof EDITABLE_CALL_FIELDS)[number];
export type ReadonlyCallField = (typeof READONLY_CALL_FIELDS)[number];
export type NavigableCallField = (typeof NAVIGABLE_CALL_FIELDS)[number];
export type CellCoordinate = {
  rowIndex: number;
  columnId: string;
};
export type ArrowNavigationKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

function boundedRowIndex(rowIndex: number, rowCount: number) {
  if (rowCount <= 0) return 0;
  return Math.min(Math.max(rowIndex, 0), rowCount - 1);
}

function fieldIndex(fields: readonly string[], columnId: string) {
  const index = fields.indexOf(columnId);
  return index === -1 ? 0 : index;
}

export function isEditableCallField(columnId: string): columnId is EditableCallField {
  return EDITABLE_CALL_FIELDS.includes(columnId as EditableCallField);
}

export function isReadonlyCallField(columnId: string): columnId is ReadonlyCallField {
  return READONLY_CALL_FIELDS.includes(columnId as ReadonlyCallField);
}

export function moveTabCell(current: CellCoordinate, rowCount: number, backwards: boolean): CellCoordinate {
  const rowIndex = boundedRowIndex(current.rowIndex, rowCount);
  const columnIndex = fieldIndex(EDITABLE_CALL_FIELDS, current.columnId);
  const direction = backwards ? -1 : 1;
  const nextColumnIndex = columnIndex + direction;

  if (nextColumnIndex >= 0 && nextColumnIndex < EDITABLE_CALL_FIELDS.length) {
    return { rowIndex, columnId: EDITABLE_CALL_FIELDS[nextColumnIndex] };
  }

  const nextRowIndex = rowIndex + direction;
  if (nextRowIndex < 0 || nextRowIndex >= rowCount) {
    return { rowIndex, columnId: EDITABLE_CALL_FIELDS[columnIndex] };
  }

  return {
    rowIndex: nextRowIndex,
    columnId: backwards ? EDITABLE_CALL_FIELDS[EDITABLE_CALL_FIELDS.length - 1] : EDITABLE_CALL_FIELDS[0]
  };
}

export function moveEnterCell(current: CellCoordinate, rowCount: number): CellCoordinate {
  const rowIndex = boundedRowIndex(current.rowIndex, rowCount);
  return {
    rowIndex: boundedRowIndex(rowIndex + 1, rowCount),
    columnId: current.columnId
  };
}

export function moveAdjacentCell(current: CellCoordinate, rowCount: number, key: ArrowNavigationKey): CellCoordinate {
  const rowIndex = boundedRowIndex(current.rowIndex, rowCount);
  const columnIndex = fieldIndex(NAVIGABLE_CALL_FIELDS, current.columnId);

  if (key === "ArrowUp") {
    return { rowIndex: boundedRowIndex(rowIndex - 1, rowCount), columnId: NAVIGABLE_CALL_FIELDS[columnIndex] };
  }

  if (key === "ArrowDown") {
    return { rowIndex: boundedRowIndex(rowIndex + 1, rowCount), columnId: NAVIGABLE_CALL_FIELDS[columnIndex] };
  }

  const nextColumnIndex = key === "ArrowLeft" ? columnIndex - 1 : columnIndex + 1;
  if (nextColumnIndex < 0 || nextColumnIndex >= NAVIGABLE_CALL_FIELDS.length) {
    return { rowIndex, columnId: NAVIGABLE_CALL_FIELDS[columnIndex] };
  }

  return { rowIndex, columnId: NAVIGABLE_CALL_FIELDS[nextColumnIndex] };
}

export function cancelCellDraft<T extends Record<string, unknown>>(currentDraft: T, baselineDraft: T): T {
  void currentDraft;
  return { ...baselineDraft };
}
