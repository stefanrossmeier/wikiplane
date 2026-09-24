# Security Policy

## Threat model

Wikiplane processes untrusted remote documents and model output. The security boundary assumes runtime configuration and the selected brain Git remote are trusted, but source content is not.

Remote acquisition permits HTTP/HTTPS only, rejects credentials in URLs, resolves and blocks local/private/link-local/multicast targets on every redirect, applies timeout/redirect/streaming size limits, and checks media types. MarkItDown accepts only paths under its configured workspace. Git is invoked with argument arrays rather than shell interpolation. LLM output is parsed into structured mutations and never gets direct filesystem or Git authority.

Secrets belong in environment variables, Docker secrets, or CI secret stores. They must not be written to the brain, YAML configuration, operation log, prompt logs, or source telemetry.

Report suspected vulnerabilities privately to the repository owner rather than opening a public issue with exploit details or credentials.
