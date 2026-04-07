# Prompt Select

A Yaak template function plugin that shows a dropdown prompt and returns the selected value.

## Usage

Use `${prompt_select(...)}` in your request templates.

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `label` | yes | Label shown next to the dropdown |
| `title` | yes | Title of the prompt dialog |
| `options` | yes | Comma-separated list of values |
| `labels` | no | Comma-separated display text (defaults to `options`) |
| `defaultValue` | no | Value selected by default |
| `store` | no | `none` (default), `forever`, or `expire` |
| `namespace` | no | Namespace for storing the value |
| `key` | no | Key for storing the value (defaults to label/title) |
| `ttl` | no | TTL in seconds (used with `store: expire`) |

### Examples

Basic dropdown:
```
${prompt_select(label="Environment", title="Select environment", options="dev,staging,prod")}
```

With custom display labels:
```
${prompt_select(label="Environment", title="Select environment", options="dev,staging,prod", labels="Development,Staging,Production")}
```

Remember selection forever:
```
${prompt_select(label="Region", title="Select region", options="us-east-1,eu-west-1", store="forever")}
```

Cache selection for 1 hour:
```
${prompt_select(label="Token", title="Select token", options="token-a,token-b", store="expire", ttl="3600")}
```
