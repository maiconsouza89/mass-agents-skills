## What

One paragraph: which skill or tool changes and why.

## Skill checklist (delete if this PR does not touch `skills/`)

- [ ] `description` follows the formula: what it does, `Use when` with quoted triggers, `Do NOT use` naming neighbouring skills
- [ ] `metadata.version` bumped (patch: wording, minor: new steps, major: trigger scope changed)
- [ ] `metadata.reviewed` set to today
- [ ] `evals/triggers.yaml` updated for any new trigger or negative
- [ ] Long material lives in `references/` with an explicit read condition in `SKILL.md`
- [ ] `npm run registry -- --readme` executed and the result committed

## Verification

- [ ] `npm run check` passes locally
- [ ] Trigger eval shows no new misses (`npm run eval:triggers`)
- [ ] Tried the skill in at least one agent and pasted the prompt used below

Prompt tried:

```
```
