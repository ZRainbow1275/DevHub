# Security Policy

## Supported Versions

R8 development builds on the `main` and `master` branches receive security fixes. Packaged releases inherit support from the latest signed Windows installer once release signing is enabled.

## Reporting a Vulnerability

Report vulnerabilities privately before opening a public issue. Include:

- Affected version or commit
- Operating system and architecture
- Reproduction steps
- Expected impact
- Whether secrets, local files, windows, processes, or AI tool sessions are exposed
- Logs or diagnostic pack paths after redaction

If a private security address is not configured for the repository, contact the maintainer through the repository owner profile and state that the message is a security disclosure. Do not include exploit details in a public issue.

## Response Targets

- Initial triage: 3 business days
- Severity classification: 7 business days
- Fix or mitigation plan: 14 business days for high and critical issues

## Security Boundaries

DevHub is local-first. Security-sensitive boundaries include Electron preload APIs, IPC handlers, local SQLite/electron-store data, process/window control APIs, diagnostic export, injection workflows, and CSV/SKILL execution. Reports that cross those boundaries are treated as higher risk.
