import type { PluginDefinition } from "@yaakapp/api";

type StoredValue = { value: string; storedAt?: number };

export const plugin: PluginDefinition = {
  templateFunctions: [
    {
      name: "prompt_select",
      aliases: ["prompt.select"],
      description: "Show a dropdown prompt and return the selected value",
      args: [
        { type: "text", name: "label", label: "Label" },
        { type: "text", name: "title", label: "Title" },
        { type: "text", name: "options", label: "Options (comma-separated values)" },
        { type: "text", name: "labels", label: "Labels (comma-separated display text, optional)", optional: true },
        { type: "text", name: "defaultValue", label: "Default Value", optional: true },
        { type: "text", name: "store", label: "Store (none / forever / expire)", optional: true },
        { type: "text", name: "namespace", label: "Namespace", optional: true },
        { type: "text", name: "key", label: "Key", optional: true },
        { type: "text", name: "ttl", label: "TTL (seconds, for expire store)", optional: true },
      ],
      async onRender(ctx, args) {
        const v = args.values;
        const label = String(v["label"] ?? "");
        const title = String(v["title"] ?? "");
        const rawOptions = String(v["options"] ?? "");
        const rawLabels = String(v["labels"] ?? "");
        const rawNamespace = String(v["namespace"] ?? "");
        const defaultValue = String(v["defaultValue"] ?? "");
        const store = String(v["store"] ?? "none");
        const key = String(v["key"] ?? "");
        const ttl = Number(v["ttl"] ?? 0);

        // During preview (CodeMirror tag rendering / arg editor), skip all template
        // rendering and dialog — return defaultValue immediately to avoid crashing
        // on unresolvable expressions like response.body.path(...)
        if (args.purpose === "preview") {
          return defaultValue || null;
        }

        // Render template expressions inside options, labels, namespace, and key
        let renderedOptions: string;
        let renderedLabels: string;
        let renderedNamespace: string;
        let renderedKey: string;
        try {
          const rendered = await ctx.templates.render({
            purpose: args.purpose,
            data: { options: rawOptions, labels: rawLabels, namespace: rawNamespace, key },
          });
          renderedOptions = String(rendered["options"] ?? "");
          renderedLabels = String(rendered["labels"] ?? "");
          renderedNamespace = String(rendered["namespace"] ?? "");
          renderedKey = String(rendered["key"] ?? "");
        } catch (e) {
          return String(e);
        }

        // Build option pairs { value, label }
        const optionValues = renderedOptions.split(",").map((s) => s.trim()).filter(Boolean);
        const labelList = renderedLabels.split(",").map((s) => s.trim()).filter(Boolean);
        const labelValues = labelList.length > 0 ? labelList : optionValues;

        const len = Math.min(optionValues.length, labelValues.length);
        const selectOptions = Array.from({ length: len }, (_, i) => ({
          value: optionValues[i] ?? "",
          label: labelValues[i] ?? optionValues[i] ?? "",
        }));

        // Compute store key
        const storeKey = `${renderedNamespace}:${renderedKey || label || title}`;

        // Return cached value if applicable
        if (store !== "none") {
          const stored = await ctx.store.get<StoredValue>(storeKey);
          if (stored != null) {
            if (store === "forever") {
              return stored.value;
            }
            if (store === "expire" && ttl > 0) {
              const age = Date.now() - (stored.storedAt ?? 0);
              if (age < ttl * 1000) {
                return stored.value;
              }
            }
          }
        }

        // No options — skip prompt
        if (selectOptions.length === 0) {
          return defaultValue || null;
        }

        // Show dropdown prompt
        const result = await ctx.prompt.form({
          id: storeKey,
          title,
          inputs: [
            {
              type: "select",
              name: "value",
              label,
              options: selectOptions,
              defaultValue: defaultValue || selectOptions[0]?.value,
            },
          ],
        });

        // User cancelled
        if (result == null) {
          return defaultValue || null;
        }

        const selected = String(result["value"] ?? defaultValue ?? "");

        // Persist selected value (only when the stored value can actually be read back)
        if (store === "forever" || (store === "expire" && ttl > 0)) {
          await ctx.store.set<StoredValue>(storeKey, { value: selected, storedAt: Date.now() });
        }

        return selected;
      },
    },
  ],
};
