import { describe, expect, test, vi, beforeEach } from "vitest";
import { plugin } from "./index";
import type { Context } from "@yaakapp/api";
import type { CallTemplateFunctionArgs } from "@yaakapp/api";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeArgs(values: Record<string, string>, purpose: "send" | "preview" = "send"): CallTemplateFunctionArgs {
  return { purpose, values };
}

function makeCtx(overrides: Partial<{
  storeData: Record<string, unknown>;
  formResult: Record<string, unknown> | null;
}>= {}): Context {
  const storeData: Record<string, unknown> = overrides.storeData ?? {};
  const formResult = overrides.formResult !== undefined ? overrides.formResult : { value: "OptionA" };

  return {
    store: {
      get: vi.fn(async (key: string) => storeData[key] ?? undefined),
      set: vi.fn(async (key: string, value: unknown) => { storeData[key] = value; }),
      delete: vi.fn(async () => false),
    },
    prompt: {
      text: vi.fn(),
      form: vi.fn(async () => formResult),
    },
    templates: {
      render: vi.fn(async ({ data }: { data: Record<string, string> }) => data),
    },
    toast: { show: vi.fn() },
    clipboard: { copyText: vi.fn() },
    window: {
      requestId: vi.fn(),
      workspaceId: vi.fn(),
      environmentId: vi.fn(),
      openUrl: vi.fn(),
      openExternalUrl: vi.fn(),
    },
    cookies: { listNames: vi.fn(), getValue: vi.fn() },
    grpcRequest: { render: vi.fn() },
    httpRequest: { send: vi.fn(), getById: vi.fn(), render: vi.fn(), list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    folder: { list: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    httpResponse: { find: vi.fn() },
    plugin: { reload: vi.fn() },
    workspace: { list: vi.fn(), withContext: vi.fn() },
  } as unknown as Context;
}

const fn = plugin.templateFunctions?.[0];
if (!fn) throw new Error("prompt.select not found");

// ── tests ─────────────────────────────────────────────────────────────────────

describe("prompt.select plugin", () => {
  test("plugin exports templateFunctions with prompt.select", () => {
    expect(plugin).toBeTypeOf("object");
    expect(plugin.templateFunctions).toHaveLength(1);
    expect(fn?.name).toBe("prompt_select");
  });

  test("arg names are correct", () => {
    const names = fn?.args.map((a) => ("name" in a ? a.name : null)).filter(Boolean);
    expect(names).toEqual(["label", "title", "options", "labels", "defaultValue", "store", "namespace", "key", "ttl"]);
  });

  test("returns selected value from form", async () => {
    const ctx = makeCtx({ formResult: { value: "Female" } });
    const result = await fn?.onRender(ctx, makeArgs({
      label: "Gender",
      title: "Select Gender",
      options: "Male,Female,Other",
      store: "none",
    }));
    expect(result).toBe("Female");
  });

  test("returns defaultValue when user cancels (form returns null)", async () => {
    const ctx = makeCtx({ formResult: null });
    const result = await fn?.onRender(ctx, makeArgs({
      label: "Gender",
      title: "Select Gender",
      options: "Male,Female,Other",
      defaultValue: "Male",
      store: "none",
    }));
    expect(result).toBe("Male");
  });

  test("returns null when cancelled with no defaultValue", async () => {
    const ctx = makeCtx({ formResult: null });
    const result = await fn?.onRender(ctx, makeArgs({
      label: "Gender",
      title: "Select Gender",
      options: "Male,Female,Other",
      store: "none",
    }));
    expect(result).toBeNull();
  });

  test("renders options and namespace through ctx.templates.render", async () => {
    const ctx = makeCtx({ formResult: { value: "1" } });
    await fn?.onRender(ctx, makeArgs({
      label: "L",
      title: "T",
      options: "${[ response.body.path() ]}",
      namespace: "${[ ctx.workspace() ]}",
      store: "none",
    }));
    expect(ctx.templates.render).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ options: "${[ response.body.path() ]}", namespace: "${[ ctx.workspace() ]}" }) })
    );
  });

  test("store=none: never reads or writes store", async () => {
    const ctx = makeCtx({ formResult: { value: "A" } });
    await fn?.onRender(ctx, makeArgs({ label: "L", title: "T", options: "A,B", store: "none" }));
    expect(ctx.store.get).not.toHaveBeenCalled();
    expect(ctx.store.set).not.toHaveBeenCalled();
  });

  test("store=forever: writes after first prompt", async () => {
    const ctx = makeCtx({ formResult: { value: "B" } });
    await fn?.onRender(ctx, makeArgs({ label: "L", title: "T", options: "A,B", store: "forever", namespace: "ns", key: "k" }));
    expect(ctx.store.set).toHaveBeenCalledWith("ns:k", expect.objectContaining({ value: "B" }));
  });

  test("store=forever: returns cached value on second call (skips prompt)", async () => {
    const storeData: Record<string, unknown> = {};
    const ctx1 = makeCtx({ storeData, formResult: { value: "B" } });
    await fn?.onRender(ctx1, makeArgs({ label: "L", title: "T", options: "A,B", store: "forever", namespace: "ns", key: "k" }));

    const ctx2 = makeCtx({ storeData, formResult: { value: "A" } });
    const result = await fn?.onRender(ctx2, makeArgs({ label: "L", title: "T", options: "A,B", store: "forever", namespace: "ns", key: "k" }));
    expect(result).toBe("B");
    expect(ctx2.prompt.form).not.toHaveBeenCalled();
  });

  test("store=expire: returns cached value within TTL", async () => {
    const storeData: Record<string, unknown> = { "ns:k": { value: "B", storedAt: Date.now() - 1000 } };
    const ctx = makeCtx({ storeData, formResult: { value: "A" } });
    const result = await fn?.onRender(ctx, makeArgs({ label: "L", title: "T", options: "A,B", store: "expire", namespace: "ns", key: "k", ttl: "3600" }));
    expect(result).toBe("B");
    expect(ctx.prompt.form).not.toHaveBeenCalled();
  });

  test("store=expire: re-prompts after TTL expires", async () => {
    const storeData: Record<string, unknown> = { "ns:k": { value: "B", storedAt: Date.now() - 10000 } };
    const ctx = makeCtx({ storeData, formResult: { value: "A" } });
    const result = await fn?.onRender(ctx, makeArgs({ label: "L", title: "T", options: "A,B", store: "expire", namespace: "ns", key: "k", ttl: "5" }));
    expect(result).toBe("A");
    expect(ctx.prompt.form).toHaveBeenCalled();
  });

  test("uses options as labels when labels not provided", async () => {
    const ctx = makeCtx({ formResult: { value: "Male" } });
    await fn?.onRender(ctx, makeArgs({ label: "L", title: "T", options: "Male,Female", store: "none" }));
    expect(ctx.prompt.form).toHaveBeenCalledWith(expect.objectContaining({
      inputs: [expect.objectContaining({
        options: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }],
      })],
    }));
  });

  test("uses separate labels when provided", async () => {
    const ctx = makeCtx({ formResult: { value: "1" } });
    await fn?.onRender(ctx, makeArgs({ label: "L", title: "T", options: "1,2", labels: "Junior,Senior", store: "none" }));
    expect(ctx.prompt.form).toHaveBeenCalledWith(expect.objectContaining({
      inputs: [expect.objectContaining({
        options: [{ value: "1", label: "Junior" }, { value: "2", label: "Senior" }],
      })],
    }));
  });

  test("zips to shorter length when counts differ", async () => {
    const ctx = makeCtx({ formResult: { value: "1" } });
    await fn?.onRender(ctx, makeArgs({ label: "L", title: "T", options: "1,2,3", labels: "A,B", store: "none" }));
    expect(ctx.prompt.form).toHaveBeenCalledWith(expect.objectContaining({
      inputs: [expect.objectContaining({
        options: [{ value: "1", label: "A" }, { value: "2", label: "B" }],
      })],
    }));
  });

  test("returns defaultValue when options list is empty", async () => {
    const ctx = makeCtx({ formResult: null });
    const result = await fn?.onRender(ctx, makeArgs({ label: "L", title: "T", options: "", defaultValue: "fallback", store: "none" }));
    expect(result).toBe("fallback");
    expect(ctx.prompt.form).not.toHaveBeenCalled();
  });

  test("store key falls back: key > label > title", async () => {
    // key provided
    const storeData: Record<string, unknown> = {};
    const ctx = makeCtx({ storeData, formResult: { value: "X" } });
    await fn?.onRender(ctx, makeArgs({ label: "MyLabel", title: "MyTitle", options: "X,Y", store: "forever", namespace: "ns", key: "mykey" }));
    expect(ctx.store.set).toHaveBeenCalledWith("ns:mykey", expect.anything());

    // no key — falls back to label
    const ctx2 = makeCtx({ storeData: {}, formResult: { value: "X" } });
    await fn?.onRender(ctx2, makeArgs({ label: "MyLabel", title: "MyTitle", options: "X,Y", store: "forever", namespace: "ns" }));
    expect(ctx2.store.set).toHaveBeenCalledWith("ns:MyLabel", expect.anything());
  });
});
