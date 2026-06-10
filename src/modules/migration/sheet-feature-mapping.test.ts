import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXPECTED_SOURCE_SHEETS,
  SHEET_FEATURE_MAPPINGS,
  getSheetMappingSummary
} from "@/modules/migration/sheet-feature-mapping";

describe("Story 7.1 sheet feature mapping source of truth", () => {
  it("covers the exact visible sheets plus hidden 목록", () => {
    const expectedNames = EXPECTED_SOURCE_SHEETS.map((sheet) => sheet.name);
    const mappedNames = SHEET_FEATURE_MAPPINGS.map((mapping) => mapping.sourceSheet);

    assert.deepEqual(mappedNames, expectedNames);
    assert.equal(EXPECTED_SOURCE_SHEETS.filter((sheet) => sheet.visibility === "visible").length, 11);
    assert.equal(EXPECTED_SOURCE_SHEETS.filter((sheet) => sheet.visibility === "hidden").length, 1);
    assert.ok(mappedNames.includes("목록"));
  });

  it("connects every row to ERP evidence, preserved rules, and concrete verification items", () => {
    for (const mapping of SHEET_FEATURE_MAPPINGS) {
      const connectionCount =
        mapping.erpSurfaces.length + mapping.settings.length + mapping.calculationEngines.length + mapping.verificationItems.length;

      assert.ok(connectionCount > 0, `${mapping.sourceSheet} must connect to at least one ERP target`);
      assert.ok(mapping.workbookEvidence.length > 0, `${mapping.sourceSheet} must include workbook evidence`);
      assert.ok(mapping.preservedRules.length > 0, `${mapping.sourceSheet} must include preserved rules`);
      assert.ok(mapping.sourceReferences.length > 0, `${mapping.sourceSheet} must include source references`);
      assert.notEqual(mapping.workbookEvidence.join(" ").trim(), "이관됨", `${mapping.sourceSheet} cannot use vague migrated-only evidence`);
    }
  });

  it("preserves critical workbook distinctions and migration invariants", () => {
    const callLedger = SHEET_FEATURE_MAPPINGS.find((mapping) => mapping.sourceSheet === "실시간콜입력");
    assert.ok(callLedger);
    const callText = [
      ...callLedger.workbookEvidence,
      ...callLedger.calculationEngines,
      ...callLedger.verificationItems,
      ...callLedger.preservedRules
    ].join(" ");
    assert.match(callText, /A:S/);
    assert.match(callText, /U:X/);
    assert.match(callText, /방문완료/);

    const roomBoards = SHEET_FEATURE_MAPPINGS.filter((mapping) => ["웨이터리스트", "TV현황판"].includes(mapping.sourceSheet));
    for (const mapping of roomBoards) {
      const text = [...mapping.erpSurfaces, ...mapping.calculationEngines, ...mapping.preservedRules].join(" ");
      assert.match(text, /RoomStatusDto/);
      assert.match(text, /listRoomStatuses/);
    }

    const masterSheets = SHEET_FEATURE_MAPPINGS.filter((mapping) =>
      ["직원DB", "TV설정", "설정_코스수당", "목록"].includes(mapping.sourceSheet)
    );
    for (const mapping of masterSheets) {
      assert.match(mapping.preservedRules.join(" "), /(id|ID|staffCode|stable key|고유 ID)/, `${mapping.sourceSheet} must preserve stable IDs`);
    }
  });

  it("exposes a 100 percent preservation summary when nothing is missing", () => {
    const summary = getSheetMappingSummary();

    assert.equal(summary.totalSheets, 12);
    assert.equal(summary.visibleSheets, 11);
    assert.equal(summary.hiddenSheets, 1);
    assert.equal(summary.missingSheets.length, 0);
    assert.equal(summary.preservationRate, 100);
    assert.ok(summary.linkedTargetCount > 0);
    assert.ok(summary.verificationItemCount >= 12);
  });
});
