# Security Policy

## Reporting a vulnerability

Please report suspected security vulnerabilities **privately**. Do not open a public issue containing exploit details, credentials, private source material, or instructions that would make an unpatched vulnerability easier to abuse.

Preferred reporting paths, in order:

1. If this repository's **Security** tab offers **Report a vulnerability**, use GitHub's private vulnerability reporting flow.
2. Otherwise, contact the repository maintainer through a private contact method listed on the maintainer's GitHub profile and include a link to this repository.
3. If neither private path is available, open a minimal public issue asking the maintainer for a private security contact **without disclosing the vulnerability details**.

A useful report includes:

- affected Wikiplane version or commit;
- affected component (`application`, acquisition adapter, model gateway, MarkItDown service, Git transaction layer, MCP, etc.);
- reproduction steps or proof of concept;
- security impact;
- whether exploitation requires a malicious source document, model response, configuration, repository, or network condition;
- suggested mitigation if you have one.

Please remove real API keys, private brain contents, personal data, and unrelated secrets from reports and reproductions.

## What to expect

Maintainers should acknowledge a private report, reproduce and assess the issue, coordinate a fix, and decide on disclosure after affected users have a reasonable opportunity to update. Exact response times are not guaranteed while Wikiplane remains an early-stage project.

## Scope

Security reports are especially useful for issues involving:

- SSRF or bypasses of remote-acquisition network restrictions;
- unsafe redirect handling or download-size bypasses;
- path traversal or converter workspace escape;
- arbitrary command/code execution from source content;
- model output gaining unintended filesystem or Git authority;
- secret leakage into logs, telemetry, commits, or brain repositories;
- unsafe Git transaction or push behavior;
- MCP/tool behavior that exposes source bodies or secrets unexpectedly;
- authentication/authorization defects if such surfaces are added later.

The project's technical trust boundaries and mitigations are documented separately in [docs/security-model.md](docs/security-model.md). Architecture rationale is recorded in [docs/adr/](docs/adr/).

## Supported versions

Wikiplane is currently under active development and does not yet publish a long-term support matrix. Security fixes are made on the current development line unless a release notice states otherwise.
