import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listAuditActors } from "@/modules/audit/audit-service";

const accounts = [
  { id: "ckacc1", accountId: "lan_counter", employee: { displayName: "Lan" } },
  { id: "ckacc2", accountId: "story13_administrator", employee: null }
];

function fakeClient() {
  const calls: unknown[] = [];
  return {
    calls,
    client: {
      userAccount: {
        async findMany(args: { where: { OR: Array<{ id?: { in: string[] }; accountId?: { in: string[] } }> } }) {
          calls.push(args);
          const ids = args.where.OR[0].id?.in ?? [];
          const accountIds = args.where.OR[1].accountId?.in ?? [];
          return accounts.filter((account) => ids.includes(account.id) || accountIds.includes(account.accountId));
        }
      }
    }
  };
}

describe("listAuditActors", () => {
  it("names each actor by the account's staff name, whether the log kept the account's internal id or its account id", async () => {
    const { client } = fakeClient();
    const actors = await listAuditActors(["ckacc1", "story13_administrator"], { prismaClient: client });

    assert.deepEqual(actors.get("ckacc1"), { name: "Lan", accountId: "lan_counter" });
    assert.deepEqual(actors.get("story13_administrator"), { name: "story13_administrator", accountId: "story13_administrator" });
  });

  it("leaves actors with no account out, so the screen shows the recorded id", async () => {
    const { client } = fakeClient();
    const actors = await listAuditActors(["local-bypass-account"], { prismaClient: client });
    assert.equal(actors.has("local-bypass-account"), false);
  });

  it("asks once for the distinct ids and not at all when there are none", async () => {
    const { client, calls } = fakeClient();
    await listAuditActors(["ckacc1", "ckacc1"], { prismaClient: client });
    await listAuditActors([], { prismaClient: client });
    assert.equal(calls.length, 1);
    assert.deepEqual((calls[0] as { where: unknown }).where, { OR: [{ id: { in: ["ckacc1"] } }, { accountId: { in: ["ckacc1"] } }] });
  });
});
