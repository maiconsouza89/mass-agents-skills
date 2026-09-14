import { marked, Renderer } from 'marked'
import { AGENTS } from '../src/core/agents.ts'
import { extractTriggerPhrases, parseDescription } from '../src/core/description.ts'
import type { RegistrySkill, SkillsRegistry, TriggerEvals } from '../src/core/types.ts'

export interface SiteContext {
  registry: SkillsRegistry
  repoUrl: string
  siteTitle: string
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function layout(options: { title: string; description: string; depth: number; current: 'catalog' | 'agents' | 'skill'; body: string; scripts?: string[]; siteTitle: string; repoUrl: string }): string {
  const root = options.depth === 0 ? './' : '../'.repeat(options.depth)
  const scripts = (options.scripts ?? []).map((script) => `<script src="${root}assets/${script}" defer></script>`).join('\n    ')
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)}</title>
    <meta name="description" content="${escapeHtml(options.description)}" />
    <meta name="color-scheme" content="dark" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${root}assets/tokens.css" />
    <link rel="stylesheet" href="${root}assets/base.css" />
    <link rel="icon" href="${root}assets/favicon.svg" type="image/svg+xml" />
    ${scripts}
  </head>
  <body>
    <a class="visually-hidden" href="#main">Skip to content</a>
    <header class="top-nav">
      <div class="container">
        <a class="wordmark" href="${root}"><span class="mark">M</span><span>${escapeHtml(options.siteTitle)}</span><span class="muted">/ skills</span></a>
        <nav class="nav-links" aria-label="Primary">
          <a href="${root}"${options.current === 'catalog' ? ' aria-current="page"' : ''}>Catalog</a>
          <a href="${root}agents/"${options.current === 'agents' ? ' aria-current="page"' : ''}>Agents</a>
          <a href="${options.repoUrl}" rel="noopener">GitHub</a>
        </nav>
      </div>
    </header>
    <main id="main">
${options.body}
    </main>
    <footer class="footer">
      <div class="container">
        <span>Mass Solutions internal skills catalog. MIT licensed.</span>
        <span><a href="${options.repoUrl}/blob/main/CONTRIBUTING.md">Contribute</a> · <a href="${options.repoUrl}/blob/main/SECURITY.md">Security</a> · <a href="${root}catalog.json">catalog.json</a></span>
      </div>
    </footer>
  </body>
</html>
`
}

function whatPart(skill: RegistrySkill): string {
  return parseDescription(skill.description)?.what ?? skill.description
}

function card(skill: RegistrySkill, categoryName: string, root: string): string {
  const search = [skill.name, skill.description, skill.tags.join(' '), categoryName].join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  return `<a class="feature-card" href="${root}skills/${skill.name}/" data-skill="${skill.name}" data-category="${skill.category}" data-search="${escapeHtml(search)}">
  <div class="card-head"><h2 class="card-title">${escapeHtml(skill.name)}</h2><span class="status-badge">${escapeHtml(categoryName)}</span></div>
  <p class="card-body">${escapeHtml(whatPart(skill))}</p>
  <div class="card-meta"><span>v${escapeHtml(skill.version)}</span><span>${escapeHtml(skill.owner)}</span><span>~${skill.tokens.skillMd} tokens</span></div>
  <div class="tags">${skill.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
</a>`
}

export function renderIndex(context: SiteContext): string {
  const { registry } = context
  const categoryIds = Object.keys(registry.categories)
  const pills = categoryIds
    .map((id) => `<button type="button" class="pill" data-category="${id}" aria-pressed="false">${escapeHtml(registry.categories[id]!.name)} <span class="muted">${registry.skills.filter((skill) => skill.category === id).length}</span></button>`)
    .join('\n          ')
  const cards = registry.skills.map((skill) => card(skill, registry.categories[skill.category]?.name ?? skill.category, './')).join('\n')
  const body = `      <section class="hero container">
        <p class="eyebrow">Mass Solutions · Agent Skills</p>
        <h1 class="display">Skills our agents follow, the way we work.</h1>
        <p class="lead">Validated SKILL.md packages for Claude Code, Cursor, Copilot and five other agents. Every skill has an owner, a review date, a token budget and trigger evals, and installs with one command.</p>
        <div class="stats">
          <span><strong>${registry.skills.length}</strong> skills</span>
          <span><strong>${categoryIds.length}</strong> categories</span>
          <span><strong>${AGENTS.length}</strong> agents</span>
          <span>catalog <strong>v${escapeHtml(registry.catalogVersion)}</strong></span>
        </div>
      </section>
      <section class="container" aria-label="Catalog">
        <div class="toolbar">
          <label class="visually-hidden" for="search">Search skills</label>
          <input id="search" class="text-input" type="search" placeholder="Search skills, tags or triggers (press / to focus)" autocomplete="off" />
          <div class="pills" role="group" aria-label="Filter by category">
          ${pills}
          </div>
          <span id="count" class="count" aria-live="polite"></span>
        </div>
        <div id="grid" class="grid">
${cards}
          <p id="empty" class="empty" hidden>No skills match. Try fewer words or clear the category.</p>
        </div>
      </section>`
  return layout({ title: `${context.siteTitle} Skills`, description: 'Mass Solutions catalog of validated skills for AI coding agents.', depth: 0, current: 'catalog', body, scripts: ['search.js'], siteTitle: context.siteTitle, repoUrl: context.repoUrl })
}

export function renderSkillBody(markdown: string, skill: RegistrySkill, repoUrl: string): string {
  const renderer = new Renderer()
  const base = `${repoUrl}/blob/main/${skill.path}/`
  renderer.link = ({ href, title, tokens }) => {
    const text = renderer.parser.parseInline(tokens)
    const resolved = /^(https?:|mailto:|#)/.test(href) ? href : `${base}${href.replace(/^\.\//, '')}`
    return `<a href="${escapeHtml(resolved)}"${title ? ` title="${escapeHtml(title)}"` : ''}${resolved.startsWith('http') ? ' rel="noopener"' : ''}>${text}</a>`
  }
  return marked.parse(markdown, { gfm: true, renderer, async: false }) as string
}

export function renderSkillPage(context: SiteContext, skill: RegistrySkill, bodyHtml: string, evals: TriggerEvals | null): string {
  const { registry } = context
  const category = registry.categories[skill.category]
  const parts = parseDescription(skill.description)
  const triggers = parts ? extractTriggerPhrases(parts.useWhen) : []
  const install = `npx github:${registry.repo} install ${skill.name} -a claude-code`
  const requires = skill.requires ?? {}
  const facts: Array<[string, string]> = [
    ['Category', category?.name ?? skill.category],
    ['Owner', skill.owner],
    ['Version', skill.version],
    ['Reviewed', skill.reviewed],
    ['License', skill.license ?? 'unspecified'],
    ['Tokens', `~${skill.tokens.skillMd} (SKILL.md) · ~${skill.tokens.total} (all markdown)`],
  ]
  if (requires.skills?.length) facts.push(['Requires skills', requires.skills.map((name) => `<a href="../${name}/">${escapeHtml(name)}</a>`).join(', ')])
  if (requires.tools?.length) facts.push(['Requires tools', requires.tools.map(escapeHtml).join(', ')])
  if (requires.mcp?.length) facts.push(['Requires MCP', requires.mcp.map(escapeHtml).join(', ')])
  if (skill.compatibility) facts.push(['Compatibility', escapeHtml(skill.compatibility)])
  if (skill.source) facts.push(['Source', `<a href="${escapeHtml(skill.source.url)}" rel="noopener">${escapeHtml(skill.source.url)}</a> @ ${escapeHtml(skill.source.ref)} (${escapeHtml(skill.source.license)})`])
  const factsHtml = facts.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${['Requires skills', 'Requires tools', 'Requires MCP', 'Compatibility', 'Source'].includes(label) ? value : escapeHtml(value)}</dd>`).join('')
  const files = skill.files.map((file) => `<li><span class="path"><a href="${context.repoUrl}/blob/main/${skill.path}/${escapeHtml(file.path)}" rel="noopener">${escapeHtml(file.path)}</a>${file.executable ? ' <span class="status-badge">exec</span>' : ''}</span><span class="size">${formatBytes(file.bytes)}</span></li>`).join('')
  const positives = evals?.positive ?? triggers
  const negatives = evals?.negative ?? []
  const body = `      <div class="page container">
        <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="../../">Catalog</a> / <a href="../../?category=${skill.category}">${escapeHtml(category?.name ?? skill.category)}</a> / ${escapeHtml(skill.name)}</nav>
        <h1 class="headline">${escapeHtml(skill.name)}</h1>
        <p class="lead">${escapeHtml(whatPart(skill))}</p>
        <div class="tags">${skill.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
        <div class="layout">
          <article>
            <h2 class="section-title">When it triggers</h2>
            <ul class="triggers">${positives.map((phrase) => `<li>${escapeHtml(phrase)}</li>`).join('')}</ul>
            ${parts ? `<p class="card-body" style="margin-top: var(--space-sm)"><strong>Do NOT use</strong> ${escapeHtml(parts.doNotUse.replace(/^for\s+/i, 'for '))}</p>` : ''}
            ${negatives.length ? `<p class="card-body">Should not trigger on: ${negatives.map((item) => `“${escapeHtml(item.prompt)}”${item.expect ? ` (→ <a href="../${item.expect}/">${escapeHtml(item.expect)}</a>)` : ''}`).join(', ')}.</p>` : ''}
            <h2 class="section-title">Instructions</h2>
            <div class="prose">
${bodyHtml}
            </div>
            <h2 class="section-title">Files installed</h2>
            <ul class="file-list">${files}</ul>
          </article>
          <aside class="panel" aria-label="Install">
            <div class="snippet" id="install-cli">${escapeHtml(install)}<button type="button" class="button-secondary copy" data-copy="install-cli">Copy</button></div>
            <div class="snippet" id="install-plugin">/plugin marketplace add ${escapeHtml(registry.repo)}
/plugin install mass-solutions-skills@mass-solutions<button type="button" class="button-secondary copy" data-copy="install-plugin">Copy</button></div>
            <dl class="facts">${factsHtml}</dl>
            <a class="button-primary" href="${context.repoUrl}/blob/main/${skill.path}/SKILL.md" rel="noopener">View source on GitHub</a>
          </aside>
        </div>
      </div>`
  return layout({ title: `${skill.name} · ${context.siteTitle} Skills`, description: whatPart(skill), depth: 2, current: 'skill', body, scripts: ['copy.js'], siteTitle: context.siteTitle, repoUrl: context.repoUrl })
}

export function renderAgentsPage(context: SiteContext): string {
  const rows = AGENTS.map((agent) => `<tr><td>${escapeHtml(agent.displayName)}</td><td><code>${agent.id}</code></td><td><code>${agent.projectDir}/</code></td><td><code>~/${agent.globalDir}/</code></td><td><a href="${agent.docs}" rel="noopener">docs</a></td></tr>`).join('\n')
  const repo = context.registry.repo
  const body = `      <div class="page container">
        <p class="eyebrow">Install</p>
        <h1 class="display">One catalog, eight agents.</h1>
        <p class="lead">Skills follow the open Agent Skills format. The installer copies the same folder into each agent's skills directory, verifies every file against the registry, and records what it did in a lockfile.</p>
        <div class="steps">
          <div class="feature-card"><h3>Claude Code plugin</h3><p class="card-body">Adds the whole catalog as a plugin marketplace.</p><div class="snippet">/plugin marketplace add ${escapeHtml(repo)}
/plugin install mass-solutions-skills@mass-solutions</div></div>
          <div class="feature-card"><h3>CLI, any agent</h3><p class="card-body">Runs from GitHub with npx; no publish step required.</p><div class="snippet">npx github:${escapeHtml(repo)} install mass-code-review -a auto</div></div>
          <div class="feature-card"><h3>Keep it healthy</h3><p class="card-body">Check for updates and local edits in CI or before a review.</p><div class="snippet">npx github:${escapeHtml(repo)} update --check
npx github:${escapeHtml(repo)} doctor</div></div>
        </div>
        <h2 class="section-title">Supported agents</h2>
        <div class="table-wrap">
          <table class="agents-table">
            <thead><tr><th>Agent</th><th>id</th><th>Project directory</th><th>Global directory</th><th></th></tr></thead>
            <tbody>
${rows}
            </tbody>
          </table>
        </div>
        <h2 class="section-title">Commands</h2>
        <div class="prose">
          <ul>
            <li><code>list [--category id] [--installed]</code> and <code>search &lt;query&gt;</code> browse the registry.</li>
            <li><code>install &lt;skills...&gt; -a &lt;agents...&gt; [--global] [--symlink] [--no-deps]</code> installs skills and their <code>requires.skills</code>.</li>
            <li><code>update [skills...] [--check]</code> reinstalls skills whose content hash changed; <code>--check</code> exits 1 when outdated.</li>
            <li><code>remove &lt;skills...&gt;</code> removes skills from the agent directories listed in the lockfile.</li>
            <li><code>doctor</code> reports missing directories, dangling symlinks, local edits, outdated versions and unmanaged skills.</li>
          </ul>
          <p>Global flags: <code>--ref &lt;git-ref&gt;</code>, <code>--from &lt;dir&gt;</code>, <code>--global</code>, <code>--refresh</code>, <code>--json</code>.</p>
        </div>
      </div>`
  return layout({ title: `Agents · ${context.siteTitle} Skills`, description: 'How to install Mass Solutions skills into Claude Code, Cursor, Copilot and other agents.', depth: 1, current: 'agents', body, siteTitle: context.siteTitle, repoUrl: context.repoUrl })
}

export function renderNotFound(context: SiteContext): string {
  const body = `      <div class="page container"><p class="eyebrow">404</p><h1 class="display">Nothing here.</h1><p class="lead">The skill may have been renamed or deprecated. Check the catalog.</p><a class="button-primary" href="./">Back to the catalog</a></div>`
  return layout({ title: `Not found · ${context.siteTitle} Skills`, description: 'Page not found', depth: 0, current: 'catalog', body, siteTitle: context.siteTitle, repoUrl: context.repoUrl })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}
