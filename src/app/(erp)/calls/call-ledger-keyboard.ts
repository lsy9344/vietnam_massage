export const EDITABLE_CALL_FIELDS = [
  "startTime",
  "actualEntryTime",
  "roomId",
  "courseId",
  "customerMemo",
  "customerId",
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

/**
 * `fields`는 기본으로 모든 편집 칸 순서(EDITABLE_CALL_FIELDS)를 쓰지만, 원장 보기(티켓 19)마다
 * 보이는 열이 다르면 그 보기의 편집 칸 순서를 넘긴다. 키보드 이동 순서가 보이는 열의 순서를 따른다.
 */
export function moveTabCell(
  current: CellCoordinate,
  rowCount: number,
  backwards: boolean,
  fields: readonly string[] = EDITABLE_CALL_FIELDS
): CellCoordinate {
  const rowIndex = boundedRowIndex(current.rowIndex, rowCount);
  const columnIndex = fieldIndex(fields, current.columnId);
  const direction = backwards ? -1 : 1;
  const nextColumnIndex = columnIndex + direction;

  if (nextColumnIndex >= 0 && nextColumnIndex < fields.length) {
    return { rowIndex, columnId: fields[nextColumnIndex] };
  }

  const nextRowIndex = rowIndex + direction;
  if (nextRowIndex < 0 || nextRowIndex >= rowCount) {
    return { rowIndex, columnId: fields[columnIndex] };
  }

  return {
    rowIndex: nextRowIndex,
    columnId: backwards ? fields[fields.length - 1] : fields[0]
  };
}

export function moveEnterCell(current: CellCoordinate, rowCount: number): CellCoordinate {
  const rowIndex = boundedRowIndex(current.rowIndex, rowCount);
  return {
    rowIndex: boundedRowIndex(rowIndex + 1, rowCount),
    columnId: current.columnId
  };
}

export function moveAdjacentCell(
  current: CellCoordinate,
  rowCount: number,
  key: ArrowNavigationKey,
  fields: readonly string[] = NAVIGABLE_CALL_FIELDS
): CellCoordinate {
  const rowIndex = boundedRowIndex(current.rowIndex, rowCount);
  const columnIndex = fieldIndex(fields, current.columnId);

  if (key === "ArrowUp") {
    return { rowIndex: boundedRowIndex(rowIndex - 1, rowCount), columnId: fields[columnIndex] };
  }

  if (key === "ArrowDown") {
    return { rowIndex: boundedRowIndex(rowIndex + 1, rowCount), columnId: fields[columnIndex] };
  }

  const nextColumnIndex = key === "ArrowLeft" ? columnIndex - 1 : columnIndex + 1;
  if (nextColumnIndex < 0 || nextColumnIndex >= fields.length) {
    return { rowIndex, columnId: fields[columnIndex] };
  }

  return { rowIndex, columnId: fields[nextColumnIndex] };
}

export function cancelCellDraft<T extends Record<string, unknown>>(currentDraft: T, baselineDraft: T): T {
  void currentDraft;
  return { ...baselineDraft };
}
