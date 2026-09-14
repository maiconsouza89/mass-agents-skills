# Security

## What the catalog guarantees

**At authoring time** (`npm run validate`, enforced in CI):

- No binary files inside skills; every file is plain text a reviewer can read.
- Secret patterns (AWS keys, GitHub tokens, private keys, Slack tokens, JWTs, API keys) fail validation.
- Shell scripts are flagged when they pipe remote content into a shell, decode base64 into a shell, `eval` command substitutions or send environment variables over the network.
- Prompt-injection style wording ("ignore previous instructions") is flagged.
- Scripts must declare a shebang and be explicitly marked executable; nothing becomes executable by accident.
- Every skill has a named owner and a review date; unreviewed skills surface in a weekly issue.

**At install time** (`mass-skills`):

- The registry lists every file with its sha256 and every skill with a content hash. Downloads that do not match are rejected and never written to an agent directory.
- The CLI downloads from a pinned git ref (`--ref`, default `main`) and never executes downloaded content.
- Skill names are sanitised and every write is checked to stay inside the agent's skills directory.
- Installs are recorded in `.mass-skills.lock.json`; `mass-skills doctor` reports local modifications, dangling symlinks and unmanaged skill folders.
- Agents other than Claude Code receive `SKILL.md` without `allowed-tools`, so no tool pre-approval leaks into agents with different permission models.

## What it does not guarantee

- Skills are instructions for an agent. A skill can still ask an agent to run commands; review the skill before installing it, as you would review a script.
- The CLI trusts the registry at the chosen ref. Protect the `main` branch (required reviews, CODEOWNERS) so the registry cannot be changed without review.
- `--from <dir>` installs from a local checkout without hash verification against GitHub; use it for development only.

## Reporting a vulnerability

Open a private security advisory on the repository or contact the maintainers listed in `.github/CODEOWNERS`. Do not open a public issue for secrets or exploitable behaviour. Expect an acknowledgement within two business days.
