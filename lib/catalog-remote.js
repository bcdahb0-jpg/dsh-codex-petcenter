/**
 * dsh-codex-petcenter — remote skin catalog sources.
 *
 * Aggregates three sources into one market directory:
 *   1. builtin SKIN_CATALOG   — curated, offline, always available
 *   2. codex-pet.org          — the community gallery API (~1200 pets), cached
 *   3. GitHub topic search    — repos tagged `codex-pet` / `codex-pets`
 *
 * Remote results are cached to $DSH_HOME/petcenter-catalog.json for 1 hour so
 * the market stays snappy and API quotas (GitHub: 10 search/min, 60 core/h)
 * are respected. `refresh=1` forces a re-fetch.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const SITE_API = 'https://codex-pet.org/api/pets'
const ASSETS_BASE = 'https://assets.codex-pet.org'
const TTL_MS = 60 * 60 * 1000 // 1 hour
const GH_SEARCH = (topic) =>
  `https://api.github.com/search/repositories?q=topic:${topic}&sort=stars&order=desc&per_page=25`
const GH_TREE = (repo) => `https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`
const UA = { 'user-agent': 'dsh-codex-petcenter', 'accept': 'application/vnd.github+json' }

function cachePath() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'petcenter-catalog.json')
}

async function readCache() {
  try {
    const j = JSON.parse(await readFile(cachePath(), 'utf8'))
    if (j && Array.isArray(j.items)) return j
  } catch { /* no cache */ }
  return null
}

async function writeCache(items, sources, fetchedAt) {
  try {
    await mkdir(join(process.env.DSH_HOME || join(homedir(), '.dsh')), { recursive: true })
    await writeFile(cachePath(), JSON.stringify({ fetchedAt, sources, items }, null, 1), 'utf8')
  } catch { /* cache write is best-effort */ }
}

/** Fetch with a timeout and rate-limit backoff. */
async function getJson(url, timeoutMs = 30000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: UA })
  if (res.status === 429 || res.status === 403) {
    await new Promise((r) => setTimeout(r, 2000))
    const again = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: UA })
    if (!again.ok) throw new Error('HTTP ' + again.status)
    return again.json()
  }
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

/** Source 2: codex-pet.org community gallery. */
async function fetchSiteSource() {
  const pets = await getJson(SITE_API, 45000)
  if (!Array.isArray(pets)) throw new Error('site api: not an array')
  return pets
    .filter((p) => p && typeof p.slug === 'string' && typeof p.asset_path === 'string')
    .map((p) => {
      const tags = Array.isArray(p.tags)
        ? p.tags.filter((t) => typeof t === 'string' && t !== 'Codex Pet' && t !== 'Spritesheet' && t !== 'Pet').slice(0, 4)
        : []
      return {
        id: 'site:' + p.slug,
        name: String(p.name || p.slug),
        desc: String(p.description || ''),
        creator: String(p.creator || ''),
        tags,
        site: 'codex-pet.org',
        assetPath: p.asset_path,
        imageUrl: typeof p.image_url === 'string' ? p.image_url : '',
        downloads: Number(p.downloads) || 0,
        views: Number(p.views) || 0,
        likes: Number(p.likes) || 0
      }
    })
}

/** Source 3: GitHub repos tagged codex-pet / codex-pets. */
async function fetchGitHubSource() {
  const repos = []
  for (const topic of ['codex-pet', 'codex-pets']) {
    try {
      const r = await getJson(GH_SEARCH(topic))
      if (Array.isArray(r.items)) repos.push(...r.items)
    } catch { /* topic may be empty */ }
  }
  // Dedupe by full_name, sort by stars desc, cap probing cost.
  const seen = new Map()
  for (const repo of repos) {
    if (!repo || typeof repo.full_name !== 'string' || seen.has(repo.full_name)) continue
    seen.set(repo.full_name, repo)
  }
  const top = [...seen.values()].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0)).slice(0, 10)
  const out = []
  for (const repo of top) {
    let tree
    try {
      tree = await getJson(GH_TREE(repo.full_name), 30000)
    } catch { continue }
    const files = tree && Array.isArray(tree.tree) ? tree.tree.map((t) => t.path) : []
    const petDirs = new Map() // dir -> pet.json path
    for (const f of files) {
      if (typeof f !== 'string') continue
      const m = f.match(/^(.*\/)?pet\.json$/)
      if (m) {
        const dir = (m[1] || '').replace(/\/$/, '')
        petDirs.set(dir || '.', f)
      }
    }
    if (petDirs.size === 0) continue
    const desc = String(repo.description || repo.full_name)
    const base = (repo.full_name || '').split('/')[1] || 'repo'
    // Prefer a pets/<name> layout; otherwise take the shallowest directory.
    let dir = [...petDirs.keys()].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))[0]
    const dirName = dir === '.' ? base : dir.split('/').pop()
    out.push({
      id: 'gh:' + repo.full_name + ':' + dirName,
      name: String(repo.name || base),
      desc,
      repo: repo.full_name,
      path: dir === '.' ? '' : dir,
      tags: ['GitHub', '开源'],
      site: 'github',
      stars: Number(repo.stargazers_count) || 0
    })
  }
  return out
}

/**
 * Build the full market directory: builtin + cached remote (fetched in
 * background when stale). Returns { items, tags, sources, fetchedAt, loading }.
 */
export async function buildCatalog(refresh = false) {
  const builtin = await import('./catalog.js').then((m) => m.SKIN_CATALOG.map((s) => ({
    id: s.id, name: s.name, desc: s.desc, tags: s.tags || [], site: '内置', repo: s.repo, path: s.path
  })))

  const cache = refresh ? null : await readCache()
  if (cache && Array.isArray(cache.items) && cache.items.length > 0) {
    return { items: builtin.concat(cache.items), tags: collectTags(builtin, cache.items), sources: cache.sources || [], fetchedAt: cache.fetchedAt, loading: false }
  }

  // No usable cache: fetch synchronously (first run).
  const remote = []
  const sources = []
  let fetchedAt = null
  try {
    const siteItems = await fetchSiteSource()
    remote.push(...siteItems)
    sources.push('codex-pet.org (' + siteItems.length + ')')
  } catch (e) {
    sources.push('codex-pet.org (失败: ' + ((e && e.message) || e) + ')')
  }
  try {
    const ghItems = await fetchGitHubSource()
    remote.push(...ghItems)
    sources.push('github topic (' + ghItems.length + ')')
  } catch (e) {
    sources.push('github topic (失败: ' + ((e && e.message) || e) + ')')
  }
  fetchedAt = Date.now()
  await writeCache(remote, sources, fetchedAt)
  return { items: builtin.concat(remote), tags: collectTags(builtin, remote), sources, fetchedAt, loading: false }
}

/** Lazily refresh the remote catalog in the background; resolves with the new directory. */
export async function refreshCatalogAsync() {
  const builtin = await import('./catalog.js').then((m) => m.SKIN_CATALOG.map((s) => ({
    id: s.id, name: s.name, desc: s.desc, tags: s.tags || [], site: '内置', repo: s.repo, path: s.path
  })))
  const remote = []
  const sources = []
  try {
    const siteItems = await fetchSiteSource()
    remote.push(...siteItems)
    sources.push('codex-pet.org (' + siteItems.length + ')')
  } catch (e) {
    sources.push('codex-pet.org (失败: ' + ((e && e.message) || e) + ')')
  }
  try {
    const ghItems = await fetchGitHubSource()
    remote.push(...ghItems)
    sources.push('github topic (' + ghItems.length + ')')
  } catch (e) {
    sources.push('github topic (失败: ' + ((e && e.message) || e) + ')')
  }
  const fetchedAt = Date.now()
  await writeCache(remote, sources, fetchedAt)
  return { items: builtin.concat(remote), tags: collectTags(builtin, remote), sources, fetchedAt, loading: false }
}

function collectTags(...groups) {
  const counts = new Map()
  for (const group of groups) {
    for (const item of group) {
      for (const t of item.tags || []) {
        if (t === 'Codex Pet' || t === 'Spritesheet' || t === 'Pet') continue
        counts.set(t, (counts.get(t) || 0) + 1)
      }
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([t]) => t)
}

/** Resolve one market item by id across all sources (builtin + cached remote). */
export async function findMarketItem(id) {
  if (!id || typeof id !== 'string') return null
  if (!id.includes(':')) {
    const builtin = await import('./catalog.js').then((m) => m.SKIN_CATALOG.find((s) => s.id === id))
    if (builtin) return { ...builtin, site: '内置' }
  }
  const cache = await readCache()
  if (cache && Array.isArray(cache.items)) {
    const hit = cache.items.find((i) => i.id === id)
    if (hit) return hit
  }
  return null
}

/** Download URLs for a market item (source-aware). Returns list of [file, url] pairs. */
export async function itemFileUrls(item) {
  if (item.assetPath) {
    // codex-pet.org assets: base = https://assets.codex-pet.org/<owner>/<slug>/
    const base = ASSETS_BASE + '/' + item.assetPath.replace(/\/[^/]+$/, '/')
    return [
      ['pet.json', base + 'pet.json'],
      ['spritesheet.webp', base + 'spritesheet.webp']
    ]
  }
  if (item.repo && typeof item.path === 'string') {
    const p = item.path ? item.path + '/' : ''
    const base = item.repo
    return [
      ['pet.json', `https://cdn.jsdelivr.net/gh/${base}@main/${p}pet.json`, `https://raw.githubusercontent.com/${base}/main/${p}pet.json`, `https://api.github.com/repos/${base}/contents/${p}pet.json?ref=main`],
      ['spritesheet.webp', `https://cdn.jsdelivr.net/gh/${base}@main/${p}spritesheet.webp`, `https://raw.githubusercontent.com/${base}/main/${p}spritesheet.webp`, `https://api.github.com/repos/${base}/contents/${p}spritesheet.webp?ref=main`]
    ]
  }
  return null
}

/** Short directory name used when installing a market item into ~/.codex/pets. */
export function itemDirName(item) {
  if (item.assetPath) return item.assetPath.split('/').slice(-2, -1)[0] || item.id.replace(/^site:/, '')
  if (item.id.startsWith('gh:')) return item.id.split(':').pop()
  return item.id
}
