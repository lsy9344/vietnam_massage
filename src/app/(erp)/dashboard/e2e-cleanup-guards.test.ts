import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

function afterAllBody(path: string) {
  const match = source(path).match(/test\.afterAll\(async \(\) => \{([\s\S]*?)\n  \}\);/);
  assert.ok(match, `${path} should have a test.afterAll cleanup block`);
  return match[1];
}

describe("dashboard E2E cleanup guards", () => {
  it("skips monthly dashboard cleanup when seed data was never created", () => {
    const cleanup = afterAllBody("tests/e2e/story-6-2-monthly-dashboard.spec.ts");

    assert.match(cleanup, /if \(!seededData\) \{\s*await prisma\.\$disconnect\(\);\s*return;\s*\}/);
    assert.match(cleanup, /try \{[\s\S]*await cleanupStoryData\(/);
    assert.match(cleanup, /finally \{\s*await prisma\.\$disconnect\(\);\s*\}/);
  });

  it("skips graph report cleanup when seed data was never created", () => {
    const cleanup = afterAllBody("tests/e2e/story-6-3-graph-report.spec.ts");

    assert.match(cleanup, /if \(!seededData\) \{\s*await prisma\.\$disconnect\(\);\s*return;\s*\}/);
    assert.match(cleanup, /try \{[\s\S]*await cleanupStoryData\(/);
    assert.match(cleanup, /finally \{\s*await prisma\.\$disconnect\(\);\s*\}/);
  });
});
