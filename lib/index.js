/**
 * dsh-codex-petcenter — host half.
 *
 * A pet-skin center for DeepSeek Harness: migrates Codex desktop-pet skins
 * into the DSH home, serves the pet data to the browser half over HTTP, and
 * manages skin installs/uninstalls from a built-in open-source catalog:
 *   GET  /petcenter/api/pets          pet list (migrates on demand)
 *   GET  /petcenter/api/catalog       built-in skin catalog (+ installed flags)
 *   POST /petcenter/api/install       download a catalog skin ({id})
 *   POST /petcenter/api/uninstall     remove a skin ({id})
 *   POST /petcenter/api/refresh       force re-scan + migrate
 *   GET  /petcenter/api/config        saved pet config
 *   POST /petcenter/api/config        persist pet config (JSON body)
 *   POST /petcenter/api/stop          cancel an agent (body: {sessionId})
 *   GET  /petcenter/api/state         aggregated pet state (polled)
 *   GET  /petcenter/api/mode          display mode (web / desktop)
 *   POST /petcenter/api/mode          switch display mode
 *   GET  /petcenter/<dir>/spritesheet.webp   static sheet
 *
 * The host also listens to agent/tool/approval events and folds them into a
 * per-session state map the browser half renders as animation + dialogs.
 */
import { readFile, writeFile, mkdir, copyFile, readdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildCatalog, refreshCatalogAsync, findMarketItem, itemFileUrls, itemDirName } from './catalog-remote.js'

export const name = 'dsh-codex-petcenter'
export const inject = ['webServer', 'agents', 'sessionTitle']

/** The standalone desktop app ships beside this bundle (desktop/). */
const DESKTOP_DIR = fileURLToPath(new URL('../desktop/', import.meta.url))

/** Resolve the Electron executable if the desktop app's deps are installed. */
function electronExe() {
  const candidates = process.platform === 'win32'
    ? [join(DESKTOP_DIR, 'node_modules', 'electron', 'dist', 'electron.exe')]
    : [join(DESKTOP_DIR, 'node_modules', 'electron', 'dist', 'electron')]
  return candidates.find((p) => existsSync(p)) || null
}

/** Candidate Codex pet roots: CODEX_HOME, LOCALAPPDATA, APPDATA. */
function candidateRoots() {
  const roots = []
  const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex')
  roots.push(join(codexHome, 'pets'))
  const la = process.env.LOCALAPPDATA
  if (la) roots.push(join(la, 'Codex', 'pets'))
  const aa = process.env.APPDATA
  if (aa) roots.push(join(aa, 'Codex', 'pets'))
  return roots
}

/** Scan every candidate root, copy pet.json + spritesheet.webp into DSH home. */
async function migrateAndScan() {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  const dshPets = join(dshHome, 'pets')
  await mkdir(dshPets, { recursive: true })
  const seen = new Set()
  const pets = []
  for (const root of candidateRoots()) {
    let entries
    try {
      entries = await readdir(root, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const name = entry.name
      if (seen.has(name)) continue
      const dir = join(root, name)
      const pj = join(dir, 'pet.json')
      const sw = join(dir, 'spritesheet.webp')
      if (!existsSync(pj) || !existsSync(sw)) continue
      let meta = null
      try {
        meta = JSON.parse((await readFile(pj, 'utf8')).replace(/^\uFEFF/, ''))
      } catch { /* keep null */ }
      const id = meta && typeof meta.id === 'string' ? meta.id : name
      const displayName = meta && typeof meta.displayName === 'string' ? meta.displayName : name
      const description = meta && typeof meta.description === 'string' ? meta.description : ''
      const dest = join(dshPets, name)
      await mkdir(dest, { recursive: true })
      await copyFile(pj, join(dest, 'pet.json'))
      await copyFile(sw, join(dest, 'spritesheet.webp'))
      seen.add(name)
      pets.push({ id, dir: name, displayName, description, source: dir })
    }
  }
  return { codexHome: process.env.CODEX_HOME || join(homedir(), '.codex'), dshHome, dshPets, pets }
}

/** The Codex pets root the catalog installs into (shared with Codex itself). */
function codexPetsDir() {
  return join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'pets')
}

/** Read the persisted pet config (petcenter key) from $DSH_HOME/pet.json. */
async function readPetConfig() {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  try {
    const data = JSON.parse(await readFile(join(dshHome, 'pet.json'), 'utf8'))
    return data && typeof data === 'object' && data.petcenter ? data.petcenter : {}
  } catch {
    return {}
  }
}

/** Merge and persist the pet config under the petcenter key. */
async function writePetConfig(patch) {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  let whole = {}
  try {
    whole = JSON.parse(await readFile(join(dshHome, 'pet.json'), 'utf8'))
  } catch { /* keep {} */ }
  if (!whole || typeof whole !== 'object') whole = {}
  whole.petcenter = Object.assign({}, whole.petcenter, patch)
  await writeFile(join(dshHome, 'pet.json'), JSON.stringify(whole, null, 2), 'utf8')
}

/** Fetch one URL into a Buffer; GitHub API responses are base64 (or blob by sha). */
async function fetchUrlBuf(url, repo) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(45000),
    headers: { 'user-agent': 'dsh-codex-petcenter', 'accept': url.includes('api.github.com') ? 'application/vnd.github+json' : '*/*' }
  })
  if (res.status === 429 || res.status === 403) {
    // Rate-limited: back off briefly, then signal failure so the caller retries another source.
    await new Promise((r) => setTimeout(r, 1500))
    throw new Error('HTTP ' + res.status + ' (rate limited)')
  }
  if (!res.ok) throw new Error('HTTP ' + res.status)
  if (!url.includes('api.github.com')) return Buffer.from(await res.arrayBuffer())
  const j = await res.json()
  if (j && typeof j.content === 'string' && j.encoding === 'base64') return Buffer.from(j.content, 'base64')
  if (j && typeof j.sha === 'string') {
    // Large files (>1 MB) omit content; fetch the git blob by sha.
    const blob = await fetch(`https://api.github.com/repos/${repo}/git/blobs/${j.sha}`, {
      signal: AbortSignal.timeout(45000),
      headers: { 'user-agent': 'dsh-codex-petcenter', 'accept': 'application/vnd.github+json' }
    })
    if (!blob.ok) throw new Error('blob HTTP ' + blob.status)
    const bj = await blob.json()
    if (!bj || typeof bj.content !== 'string' || bj.encoding !== 'base64') throw new Error('bad blob response')
    return Buffer.from(bj.content, 'base64')
  }
  throw new Error('unexpected api response')
}

/** Download one market skin (pet.json + spritesheet.webp) into the Codex pets dir. */
async function downloadSkin(id) {
  const item = await findMarketItem(id)
  if (!item) throw new Error('市场中没有该皮肤: ' + id)
  const urls = await itemFileUrls(item)
  if (!urls) throw new Error('无法解析下载地址: ' + id)
  const dirName = itemDirName(item)
  const dest = join(codexPetsDir(), dirName)
  await mkdir(dest, { recursive: true })
  const errors = []
  for (const pair of urls) {
    const [file, ...fileUrls] = pair
    let lastErr = null
    for (const url of fileUrls) {
      try {
        const buf = await fetchUrlBuf(url, item.repo)
        if (file === 'pet.json') JSON.parse(buf.toString('utf8').replace(/^\uFEFF/, '')) // validate
        await writeFile(join(dest, file), buf)
        lastErr = null
        break
      } catch (e) {
        lastErr = e
      }
    }
    if (lastErr) errors.push(file + ': ' + ((lastErr && lastErr.message) || lastErr))
  }
  if (errors.length) throw new Error('下载失败: ' + errors.join('; '))
  return dest
}

/** Remove a skin from both the Codex pets dir and the DSH pets dir. */
async function uninstallSkin(id) {
  const removed = []
  const codexDir = join(codexPetsDir(), id)
  if (existsSync(codexDir)) {
    await rm(codexDir, { recursive: true, force: true })
    removed.push(codexDir)
  }
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  const dshDir = join(dshHome, 'pets', id)
  if (existsSync(dshDir)) {
    await rm(dshDir, { recursive: true, force: true })
    removed.push(dshDir)
  }
  // If the removed skin was active, clear the active selection.
  const cfg = await readPetConfig()
  if (cfg.name === id) await writePetConfig({ name: null })
  return removed
}

/** Read a JSON request body (max 64 KiB). */
async function readBody(req, maxBytes = 64 * 1024) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > maxBytes) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Send a JSON response. */
function sendJson(res, status, value) {
  const body = JSON.stringify(value ?? null)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  })
  res.end(body)
}

export function apply(ctx) {
  const agentState = {
    phase: 'idle',
    phrase: '',
    project: '',
    text: '',
    lastEvent: '',
    at: 0,
    lastFailed: false,
    agentRef: null,
    lastActive: null,
    sessions: new Map()
  }
  let migration = null
  /** Handle of the standalone desktop pet process, if the host launched it. */
  let desktopChild = null
  /** Current market directory snapshot (builtin + remote sources). */
  let catalogDir = null
  // Warm the remote catalog in the background so the first market view is fast.
  refreshCatalogAsync().then((d) => { catalogDir = d }).catch(() => { /* keep null; catalog API falls back to buildCatalog */ })

  /** Terminate the desktop pet process tree (Windows: taskkill /T, else child.kill). */
  async function killDesktopPet() {
    const child = desktopChild
    desktopChild = null
    if (!child || typeof child.pid !== 'number') return
    try {
      if (process.platform === 'win32') {
        const { execFile } = await import('node:child_process')
        await new Promise((resolve) => {
          execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => resolve())
        })
      } else {
        child.kill()
      }
    } catch { /* ignore */ }
  }

  function sessionOf(agent) {
    return agent && agent.id ? agent.id : null
  }

  function touchSession(sid) {
    if (!sid) return null
    let e = agentState.sessions.get(sid)
    if (!e) {
      e = { id: sid, phase: 'idle', phrase: '', project: '', text: '', lastFailed: false, at: 0 }
      agentState.sessions.set(sid, e)
    }
    return e
  }

  /** Timers that move a 'starting' session back to idle if it never runs. */
  const startingTimers = new Map()

  function clearStartingTimer(sid) {
    const t = startingTimers.get(sid)
    if (t) { clearTimeout(t); startingTimers.delete(sid) }
  }

  function armStartingTimer(sid) {
    clearStartingTimer(sid)
    const t = setTimeout(() => {
      startingTimers.delete(sid)
      const e = agentState.sessions.get(sid)
      // Only fall back if it's still stuck in 'starting' (never went running).
      if (e && e.phase === 'starting') {
        setSession(sid, 'idle', '')
      }
    }, 15000)
    startingTimers.set(sid, t)
  }

  function setSession(sid, phase, phrase) {
    const e = touchSession(sid)
    if (!e) return
    e.phase = phase
    e.phrase = phrase
    e.at = Date.now()
    agentState.lastActive = sid
    aggregate()
  }

  function aggregate() {
    const PRIO = { failed: 4, thinking: 3, tool: 3, working: 3, starting: 3, waiting: 2, idle: 1 }
    let phase = 'idle'
    let phrase = ''
    let bestAt = -1
    let best = null
    agentState.sessions.forEach((e) => {
      const p = PRIO[e.phase] || 1
      if (p > (PRIO[phase] || 1)) {
        phase = e.phase
        phrase = e.phrase
      }
      if (e.at > bestAt) {
        bestAt = e.at
        best = e
      }
    })
    agentState.phase = phase
    agentState.phrase = phrase
    if (best) agentState.project = best.project
  }

  function noteAgent(agent) {
    if (!agent) return
    agentState.agentRef = agent
    const sid = sessionOf(agent)
    const e = touchSession(sid)
    try {
      const sess = agent.session || null
      if (sess) {
        let title = ''
        const st = ctx.get('sessionTitle')
        if (st) {
          try {
            const snap = st.get(sess)
            if (snap && snap.title) title = String(snap.title)
          } catch { /* ignore */ }
        }
        if (title) {
          if (e) e.project = title
          agentState.project = title
          return
        }
        const cwd = (sess.meta && sess.meta.cwd) || sess.cwd
        if (typeof cwd === 'string' && cwd) {
          const parts = String(cwd).split(/[\\/]+/).filter(Boolean)
          const base = parts[parts.length - 1] || cwd
          if (e) e.project = base
          agentState.project = base
        }
      }
    } catch { /* ignore */ }
  }

  ctx.effect(() => {
    const disposers = []

    disposers.push(ctx.on('agent/session-start', (payload) => {
      noteAgent(payload && payload.agent)
      const sid = sessionOf(payload && payload.agent)
      setSession(sid, 'starting', '启动中')
      armStartingTimer(sid)
      agentState.lastEvent = 'agent/session-start'
    }))
    disposers.push(ctx.on('agent/status', (payload) => {
      noteAgent(payload && payload.agent)
      const sid = sessionOf(payload && payload.agent)
      const st = payload && payload.status
      const e = touchSession(sid)
      if (st === 'running') {
        clearStartingTimer(sid)
        setSession(sid, 'thinking', '思考中')
      } else if (st === 'idle') {
        clearStartingTimer(sid)
        setSession(sid, (e && e.lastFailed) ? 'failed' : 'done', (e && e.lastFailed) ? '出错了' : '完成')
        if (e) e.lastFailed = false
      }
      agentState.lastEvent = 'agent/status:' + st
      agentState.at = Date.now()
    }))
    disposers.push(ctx.on('tools/pre-execute', (exec, next) => {
      return Promise.resolve(next()).then((gate) => {
        if (gate && gate.kind === 'ask') {
          setSession((exec && exec.agent) ? sessionOf(exec.agent) : agentState.lastActive, 'waiting', '等待用户批准')
          agentState.lastEvent = 'tools/pre-execute:ask'
        }
        return gate
      })
    }))
    disposers.push(ctx.on('tools/execute', (exec, next) => {
      const tname = exec && exec.name
      const sid = (exec && exec.agent) ? sessionOf(exec.agent) : agentState.lastActive
      const e = touchSession(sid)
      if (tname === 'ask_user_question') {
        setSession(sid, 'waiting', '等待用户输入')
      } else if (!e || e.phase !== 'waiting') {
        setSession(sid, 'tool', tname ? ('正在使用 ' + tname) : '正在使用工具')
      }
      agentState.lastEvent = 'tools/execute:' + (tname || '?')
      agentState.at = Date.now()
      return next()
    }))
    disposers.push(ctx.on('tools/result', (exec, result) => {
      const tname = exec && exec.name
      const sid = (exec && exec.agent) ? sessionOf(exec.agent) : agentState.lastActive
      const e = touchSession(sid)
      // A failed tool result (e.g. tool call aborted / error) is a failure for
      // this session even though the agent loop ends "idle" — remember it so the
      // pet shows the red "!" instead of a green check.
      if (result && result.isError) {
        if (e) e.lastFailed = true
      }
      if (e && e.phase === 'waiting') {
        setSession(sid, 'thinking', '思考中')
      }
      agentState.lastEvent = 'tools/result:' + (tname || '?') + (result && result.isError ? ':error' : '')
      agentState.at = Date.now()
    }))
    disposers.push(ctx.on('internal/dispatch', (mode, eventName, args) => {
      if (eventName === 'approval/request') {
        const req = args && args[0]
        setSession((req && req.agent) ? sessionOf(req.agent) : agentState.lastActive, 'waiting', '等待用户批准')
        agentState.lastEvent = 'approval/request(dispatch)'
      }
    }, { global: true }))
    disposers.push(ctx.on('approval/request', (req, next) => {
      const sid = req && req.agent ? sessionOf(req.agent) : agentState.lastActive
      setSession(sid, 'waiting', '等待用户批准')
      agentState.lastEvent = 'approval/request'
      return next().then((outcome) => {
        const e = touchSession(sid)
        if (e && e.phase === 'waiting') {
          setSession(sid, 'thinking', '思考中')
        }
        return outcome
      })
    }))
    disposers.push(ctx.on('agent/error', (payload) => {
      const sid = sessionOf(payload && payload.agent) || agentState.lastActive
      const e = touchSession(sid)
      if (e) e.lastFailed = true
      setSession(sid, 'failed', '出错了')
      agentState.lastEvent = 'agent/error'
      agentState.at = Date.now()
    }))
    disposers.push(ctx.on('workflow/phase', (info, title) => {
      if (title) {
        setSession(agentState.lastActive, 'working', String(title))
        agentState.lastEvent = 'workflow/phase'
        agentState.at = Date.now()
      }
    }))
    disposers.push(ctx.on('llm/stream', (options, next) => {
      const stream = next()
      // Only enrich the currently-last-active session's text; never force its
      // phase (that belongs to agent/status), so a stream from another session
      // cannot mark an unrelated session as "thinking" (the stale-starting bug).
      const sid = agentState.lastActive
      return (async function* () {
        const e = touchSession(sid)
        if (e) e.text = ''
        agentState.lastEvent = 'llm/stream'
        agentState.at = Date.now()
        try {
          for await (const chunk of stream) {
            if (chunk && chunk.type === 'text-delta' && typeof chunk.text === 'string' && chunk.text) {
              const cur = touchSession(sid)
              if (cur) {
                const t = (cur.text || '') + chunk.text
                cur.text = t.length > 150 ? t.slice(-150) : t
              }
            }
            yield chunk
          }
        } catch (err) {
          throw err
        }
      })()
    }))

    disposers.push(ctx.webServer.register({
      kind: 'prefix',
      path: '/petcenter',
      handler: async (req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://x')
          const pathname = url.pathname
          const method = req.method || 'GET'

          if (pathname === '/petcenter/api/pets' && method === 'GET') {
            if (!migration) migration = migrateAndScan()
            const data = await migration
            return sendJson(res, 200, { ...data, rev: Date.now() })
          }
          if (pathname === '/petcenter/api/refresh' && method === 'POST') {
            migration = migrateAndScan()
            const data = await migration
            return sendJson(res, 200, { ...data, rev: Date.now() })
          }
          if (pathname === '/petcenter/api/config' && method === 'GET') {
            const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
            let cfg = {}
            try {
              const text = await readFile(join(dshHome, 'pet.json'), 'utf8')
              const data = JSON.parse(text)
              if (data && data.petcenter) cfg = data.petcenter
              else if (data && data.codexPet) cfg = data.codexPet // legacy
            } catch { /* keep {} */ }
            return sendJson(res, 200, cfg)
          }
          if (pathname === '/petcenter/api/config' && method === 'POST') {
            const body = await readBody(req)
            const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
            let whole = {}
            try {
              whole = JSON.parse(await readFile(join(dshHome, 'pet.json'), 'utf8'))
            } catch { /* keep {} */ }
            whole.petcenter = body || {}
            await writeFile(join(dshHome, 'pet.json'), JSON.stringify(whole, null, 2), 'utf8')
            return sendJson(res, 200, { ok: true })
          }
          if (pathname === '/petcenter/api/catalog' && method === 'GET') {
            const refresh = url.searchParams.get('refresh') === '1'
            let dir
            if (refresh) {
              dir = await refreshCatalogAsync()
              catalogDir = dir
            } else if (catalogDir) {
              dir = catalogDir
            } else {
              dir = await buildCatalog()
              catalogDir = dir
            }
            const data = migration ? await migration : await migrateAndScan()
            const installed = new Set(data.pets.map((p) => p.dir))
            const list = (dir.items || []).map((s) => Object.assign({}, s, { installed: installed.has(itemDirName(s)) }))
            return sendJson(res, 200, {
              items: list,
              tags: dir.tags || [],
              sources: dir.sources || [],
              fetchedAt: dir.fetchedAt || null,
              total: list.length,
              codexPets: codexPetsDir()
            })
          }
          if (pathname === '/petcenter/api/install' && method === 'POST') {
            const body = await readBody(req)
            const id = body && body.id
            if (!id || typeof id !== 'string') return sendJson(res, 200, { ok: false, error: 'missing id' })
            try {
              const dest = await downloadSkin(id)
              migration = migrateAndScan()
              const data = await migration
              return sendJson(res, 200, { ok: true, dest, pets: data.pets, rev: Date.now() })
            } catch (e) {
              return sendJson(res, 200, { ok: false, error: String((e && e.message) || e) })
            }
          }
          if (pathname === '/petcenter/api/uninstall' && method === 'POST') {
            const body = await readBody(req)
            const id = body && body.id
            if (!id || typeof id !== 'string') return sendJson(res, 200, { ok: false, error: 'missing id' })
            try {
              const removed = await uninstallSkin(id)
              migration = migrateAndScan()
              const data = await migration
              return sendJson(res, 200, { ok: true, removed, pets: data.pets, rev: Date.now() })
            } catch (e) {
              return sendJson(res, 200, { ok: false, error: String((e && e.message) || e) })
            }
          }
          if (pathname === '/petcenter/api/stop' && method === 'POST') {
            const body = await readBody(req)
            const sid = body && body.sessionId
            const agents = ctx.get('agents')
            const agent = (sid && agents && agents.get(sid)) || agentState.agentRef
            if (!agent) return sendJson(res, 200, { ok: false, reason: 'no-agent' })
            try {
              agent.cancel({ kind: 'user' })
              return sendJson(res, 200, { ok: true })
            } catch (e) {
              return sendJson(res, 200, { ok: false, error: String((e && e.message) || e) })
            }
          }
          if (pathname === '/petcenter/api/state' && method === 'GET') {
            noteAgent(agentState.agentRef)
            aggregate()
            const sessions = []
            agentState.sessions.forEach((e) => {
              sessions.push({ id: e.id, phase: e.phase, phrase: e.phrase, project: e.project, text: e.text, at: e.at })
            })
            return sendJson(res, 200, {
              phase: agentState.phase,
              phrase: agentState.phrase,
              project: agentState.project,
              text: agentState.text,
              lastEvent: agentState.lastEvent,
              sessions,
              at: agentState.at
            })
          }
          if (pathname === '/petcenter/api/mode' && method === 'GET') {
            const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
            let mode = 'web'
            try {
              const data = JSON.parse(await readFile(join(dshHome, 'pet.json'), 'utf8'))
              if (data && data.petcenter && typeof data.petcenter.mode === 'string') mode = data.petcenter.mode
              else if (data && data.codexPet && typeof data.codexPet.mode === 'string') mode = data.codexPet.mode // legacy
            } catch { /* keep web */ }
            return sendJson(res, 200, {
              mode,
              desktopReady: electronExe() !== null,
              desktopDir: DESKTOP_DIR
            })
          }
          if (pathname === '/petcenter/api/mode' && method === 'POST') {
            const body = await readBody(req)
            const nextMode = body && body.mode === 'desktop' ? 'desktop' : 'web'
            const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
            let whole = {}
            try {
              whole = JSON.parse(await readFile(join(dshHome, 'pet.json'), 'utf8'))
            } catch { /* keep {} */ }
            if (!whole.petcenter || typeof whole.petcenter !== 'object') whole.petcenter = {}
            whole.petcenter.mode = nextMode
            await writeFile(join(dshHome, 'pet.json'), JSON.stringify(whole, null, 2), 'utf8')
            if (nextMode === 'desktop') {
              const exe = electronExe()
              if (!exe) return sendJson(res, 200, { ok: false, reason: 'electron-missing', desktopDir: DESKTOP_DIR })
              try {
                const child = spawn(exe, ['.'], { cwd: DESKTOP_DIR, detached: true, stdio: 'ignore', windowsHide: true })
                desktopChild = child
                child.on('exit', () => { if (desktopChild === child) desktopChild = null })
                child.unref()
                return sendJson(res, 200, { ok: true, mode: nextMode })
              } catch (e) {
                return sendJson(res, 200, { ok: false, error: String((e && e.message) || e) })
              }
            }
            // Switching back to web: stop the standalone desktop pet.
            await killDesktopPet()
            return sendJson(res, 200, { ok: true, mode: nextMode })
          }

          // Static spritesheet: /petcenter/<dir>/spritesheet.webp
          const parts = pathname.split('/').filter(Boolean)
          if (parts.length === 3 && parts[0] === 'petcenter' && parts[2] === 'spritesheet.webp') {
            let dir = ''
            try { dir = decodeURIComponent(parts[1]) } catch { dir = '' }
            if (!/^[A-Za-z0-9._-]+$/.test(dir)) {
              res.writeHead(404, { 'content-type': 'text/plain' })
              return res.end('unknown pet')
            }
            if (!migration) migration = migrateAndScan()
            const data = await migration
            if (!data.pets.some((p) => p.dir === dir)) {
              res.writeHead(404, { 'content-type': 'text/plain' })
              return res.end('unknown pet')
            }
            const bytes = await readFile(join(data.dshPets, dir, 'spritesheet.webp'))
            res.writeHead(200, {
              'content-type': 'image/webp',
              'content-length': bytes.byteLength,
              'cache-control': 'public, max-age=31536000, immutable'
            })
            return res.end(bytes)
          }

          res.writeHead(404, { 'content-type': 'text/plain' })
          res.end('not found')
        } catch (err) {
          try {
            sendJson(res, 500, { error: String((err && err.message) || err) })
          } catch { /* ignore */ }
        }
      }
    }), 'dsh-codex-petcenter: routes')

    // Warm the migration so the first browser poll is fast.
    migration = migrateAndScan().catch((e) => {
      console.error('dsh-codex-petcenter initial migration failed:', (e && e.message) || e)
    })

    return () => {
      for (const d of disposers) {
        if (typeof d === 'function') d()
      }
    }
  }, 'dsh-codex-petcenter: host')
}
