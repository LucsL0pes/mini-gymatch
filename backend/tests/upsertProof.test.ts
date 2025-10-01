import assert from "node:assert/strict";
import type { PostgrestError } from "@supabase/supabase-js";

process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "http://localhost";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test";

let upsertProof!: typeof import("../src/routes/proofs").upsertProof;

type QueryResult<T> = { data: T; error: PostgrestError | null };

type SupabaseLike = {
  from: (table: string) => any;
};

function createExistingLookupHandler(
  expectedUserId: string,
  result: QueryResult<{ id: string } | null>
) {
  return () => ({
    select(columns: string) {
      assert.equal(columns, "id");
      return {
        eq(column: string, value: string) {
          assert.equal(column, "user_id");
          assert.equal(value, expectedUserId);
          return {
            order(column: string, options: { ascending: boolean }) {
              assert.equal(column, "created_at");
              assert.deepEqual(options, { ascending: false });
              return {
                limit(count: number) {
                  assert.equal(count, 1);
                  return {
                    maybeSingle: async () => result,
                  };
                },
              };
            },
          };
        },
      };
    },
  });
}

type ProofPayload = {
  status: "manual_review" | "approved" | "rejected";
  reason: string | null;
  file_url: string | null;
  ocr_text: string | null;
};

function createInsertHandler(
  onInsert: (payload: Record<string, unknown>) => void,
  result: QueryResult<ProofPayload>
) {
  return () => ({
    insert(payload: Record<string, unknown>) {
      onInsert(payload);
      return {
        select(columns: string) {
          assert.equal(columns, "status, reason, file_url, ocr_text");
          return {
            single: async () => result,
          };
        },
      };
    },
  });
}

function createUpdateHandler(
  expectedId: string,
  onUpdate: (payload: Record<string, unknown>) => void,
  result: QueryResult<ProofPayload>
) {
  return () => ({
    update(payload: Record<string, unknown>) {
      onUpdate(payload);
      return {
        eq(column: string, value: string) {
          assert.equal(column, "id");
          assert.equal(value, expectedId);
          return {
            select(columns: string) {
              assert.equal(columns, "status, reason, file_url, ocr_text");
              return {
                single: async () => result,
              };
            },
          };
        },
      };
    },
  });
}

function createClient(handlers: Array<() => any>): SupabaseLike {
  let callIndex = 0;
  return {
    from(table: string) {
      assert.equal(table, "proofs");
      if (callIndex >= handlers.length) {
        throw new Error(`Unexpected supabase.from call #${callIndex}`);
      }
      const handler = handlers[callIndex++];
      return handler();
    },
  };
}

async function testInsertCreatesNewRecord() {
  const insertedPayloads: Record<string, unknown>[] = [];
  const client = createClient([
    createExistingLookupHandler("user-1", { data: null, error: null }),
    createInsertHandler((payload) => insertedPayloads.push(payload), {
      data: {
        status: "manual_review",
        reason: null,
        file_url: "https://example.com/proof.jpg",
        ocr_text: null,
      },
      error: null,
    }),
  ]);

  const result = await upsertProof(
    "user-1",
    {
      status: "manual_review",
      reason: undefined,
      file_url: "https://example.com/proof.jpg",
      ocr_text: null,
    },
    client
  );

  assert.equal(insertedPayloads.length, 1);
  assert.deepEqual(insertedPayloads[0], {
    user_id: "user-1",
    status: "manual_review",
    file_url: "https://example.com/proof.jpg",
    ocr_text: null,
  });

  assert.deepEqual(result, {
    status: "manual_review",
    reason: null,
    file_url: "https://example.com/proof.jpg",
    ocr_text: null,
  });
}

async function testUpdateUsesExistingId() {
  const updatedPayloads: Record<string, unknown>[] = [];
  const client = createClient([
    createExistingLookupHandler("user-42", { data: { id: "proof-123" }, error: null }),
    createUpdateHandler(
      "proof-123",
      (payload) => updatedPayloads.push(payload),
      {
        data: {
          status: "approved",
          reason: "Tudo certo",
          file_url: "https://example.com/proof.jpg",
          ocr_text: "academia",
        },
        error: null,
      }
    ),
  ]);

  const result = await upsertProof(
    "user-42",
    {
      status: "approved",
      reason: "Tudo certo",
      file_url: "https://example.com/proof.jpg",
      ocr_text: "academia",
    },
    client
  );

  assert.equal(updatedPayloads.length, 1);
  assert.deepEqual(updatedPayloads[0], {
    status: "approved",
    reason: "Tudo certo",
    file_url: "https://example.com/proof.jpg",
    ocr_text: "academia",
  });

  assert.deepEqual(result, {
    status: "approved",
    reason: "Tudo certo",
    file_url: "https://example.com/proof.jpg",
    ocr_text: "academia",
  });
}

async function testLookupErrorIsPropagated() {
  const client = createClient([
    createExistingLookupHandler("user-9", {
      data: null,
      error: { message: "database unavailable" } as PostgrestError,
    }),
  ]);

  let caught: Error | null = null;
  try {
    await upsertProof("user-9", { status: "manual_review" }, client);
  } catch (err) {
    caught = err as Error;
  }

  assert.ok(caught, "Expected the error to be thrown");
  assert.equal(caught?.message, "database unavailable");
}

async function run() {
  const module = await import("../src/routes/proofs");
  upsertProof = module.upsertProof;
  await testInsertCreatesNewRecord();
  await testUpdateUsesExistingId();
  await testLookupErrorIsPropagated();
  console.log("All upsertProof tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
