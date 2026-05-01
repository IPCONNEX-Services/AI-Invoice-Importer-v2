# AI Invoice Importer v2

AI-powered supplier invoice import for ERPNext v16. Upload a PDF, extract invoice data with a vision-capable LLM, review the parsed result, and post a Purchase Invoice.

## Features

- **Multi-provider LLM support** — Claude (Anthropic), OpenAI, and Gemini
- **Vision + text extraction** — falls back to native PDF text when the document is selectable, switches to vision when it isn't
- **Fuzzy supplier matching** — maps extracted vendor names to existing ERPNext Suppliers
- **Settings doctype** — per-provider API keys, model selection, and defaults
- **Import log** — every extraction recorded with provider, model, token count, and outcome
- **Validate page** — review and edit extracted data before submitting

## Installation

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/IPCONNEX-Services/AI-Invoice-Importer-v2 --branch main
bench --site $SITE install-app erpnext_ai_importer
bench restart
```

After install, open **AI Import Settings** and add the API key for the provider(s) you want to use.

## Doctypes

| Doctype | Purpose |
| --- | --- |
| `AI Import Settings` | Singleton — provider keys, default model per provider |
| `AI Invoice Import` | One row per uploaded invoice — extracted fields, status |
| `AI Invoice Import Item` | Child table — line items extracted from the invoice |
| `AI Import Log` | Append-only log of every extraction call |

## Contributing

This app uses `pre-commit` for formatting and linting:

```bash
cd apps/erpnext_ai_importer
pre-commit install
```

Tools: `ruff`, `eslint`, `prettier`, `pyupgrade`.

## License

MIT
