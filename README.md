# Yaak Plugin: Prompt Select

**Prompt Select** is a Yaak template function plugin that interrupts request execution to display a dropdown UI prompt. It allows users to dynamically select and inject values at runtime without modifying the underlying request configuration.

## Usage

Insert the `prompt_select` template tag into any valid Yaak request field (e.g., URL, Headers, Body).

**Basic Syntax:**
```text
${prompt_select(label="Environment", title="Select environment", options="dev,staging,prod")}
```

## Arguments

| Argument | Required | Description |
| :--- | :--- | :--- |
| `label` | Yes | The input label displayed next to the dropdown dialog. |
| `title` | Yes | The title of the prompt dialog window. |
| `options` | Yes | A comma-separated list of the actual values to be injected. Supports nested template expressions. |
| `labels` | No | A comma-separated list of display names corresponding to the `options`. Defaults to the `options` values if omitted. |
| `defaultValue` | No | The option to pre-select when the prompt opens, or the fallback value if the user cancels the prompt. |
| `store` | No | Cache behavior for the selection. Accepts: `none` (default), `forever`, or `expire`. |
| `namespace` | No | Groups stored values to prevent key collisions across different requests. Supports nested template expressions. |
| `key` | No | A custom storage key. Defaults to `label` or `title` if omitted. |
| `ttl` | No | Time-to-live in seconds. Specifies how long to retain the cached selection (requires `store="expire"`). |

## Core Behaviors

* **Dynamic Template Evaluation:** The `options`, `labels`, and `namespace` arguments are evaluated at runtime via Yaak's template engine. You can nest other Yaak tags inside them (e.g., dynamically populating options using a JSONPath extraction from a previous response).
* **Preview Mode Safety:** When Yaak attempts to render previews (such as inside the CodeMirror editor or argument config view), the plugin safely skips template evaluation and dialog rendering. It immediately returns the `defaultValue` (or `null`) to prevent crashes from unresolvable context references.
* **Label/Option Mapping:** If the number of provided `options` and `labels` differs, the plugin safely maps them one-to-one up to the length of the shorter list.
* **Storage Keys:** Cached selections are stored strictly using the format `namespace:key`. If `key` is missing, it falls back to `label`, then `title`.

## Examples

### 1. Basic Dropdown with Custom Labels
Displays human-readable labels in the UI while injecting the underlying technical value.
```text
${[ prompt_select(label='Environment', title='Select Environment', options=b64'ZGV2LHN0YWdpbmcscHJvZA', labels=b64'RGV2ZWxvcG1lbnQsU3RhZ2luZyxQcm9kdWN0aW9u') ]}
```

### 2. Persistent Selection
Prompts the user once and caches the selection indefinitely. Useful for static tokens.
```text
${[ prompt_select(label='Token', title='Select Auth Token', options=b64'dG9rZW4tYSx0b2tlbi1i', store='forever') ]}
```

### 3. Volatile Selection Caching (TTL)
Caches the user's selection for 1 hour (3600 seconds) before expiring and prompting them again.
```text
${[ prompt_select(label='Region', title='Select Target Region', options=b64'dXMtZWFzdC0xLGV1LXdlc3QtMQ', store='expire', ttl='3600') ]}
```

### 4. Dynamic Options via Nested Templates
Extracts options dynamically from a previous request using a nested Yaak tag. If the options evaluate to an empty list, it skips the prompt and returns the `defaultValue`.
```text
${[ prompt_select(label='Gender', title='Select Gender', options=b64'TWFsZSwgRmVtYWxlLCBPdGhlcg', defaultValue=b64'JHtbIHJlc3BvbnNlLmJvZHkucGF0aChyZXF1ZXN0PSdycV81OENDUmNVb0VQJywgYmVoYXZpb3I9J3R0bCcsIHR0bD0nMjQwJywgcmVzdWx0PSdmaXJzdCcsIGpvaW49YjY0J0xDQScsIHBhdGg9YjY0J0pDNWtZWFJoTG5WelpYSXVaMlZ1WkdWeScpIF19', store='none', namespace=b64'JHtbY3R4LndvcmtzcGFjZSgpXX0', ttl='0') ]}
```
![prompt select window](assets/demo/スクリーンショット%202026-04-07%20152308.png)