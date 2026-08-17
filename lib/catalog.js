/**
 * dsh-codex-petcenter — built-in skin catalog.
 *
 * Each entry describes one open-source Codex desktop-pet skin. Skins are
 * downloaded as two files (pet.json + spritesheet.webp) straight from the
 * repo via jsDelivr CDN (fallback: raw.githubusercontent.com) — no zip, no
 * build. `repo` is the GitHub `owner/name`, `path` the directory inside the
 * repo that holds the skin files.
 */
export const SKIN_CATALOG = [
  // ── 米哈游 / HoYoverse ────────────────────────────────────────────────
  { id: 'firefly', name: '流萤', desc: '崩坏：星穹铁道 · 「我将，点燃星海！」Codex v2 图集（9 动作 + 16 视线）', repo: 'RagnarokChan/firefly-codex-pets', path: 'pets/firefly', tags: ['米哈游', '崩铁', 'v2'] },
  { id: 'firefly-bride', name: '流萤·花嫁', desc: '崩坏：星穹铁道 · 花嫁限定，Codex v2 图集', repo: 'RagnarokChan/firefly-codex-pets', path: 'pets/firefly-bride', tags: ['米哈游', '崩铁', 'v2'] },

  // ── DeepSeek ───────────────────────────────────────────────────────────
  { id: 'deepseek-whale-girl', name: '鲸鱼娘', desc: 'DeepSeek 风格的像素鲸鱼娘桌宠，会陪你一起写代码', repo: 'chenthreegold/deepseek-whale-pet', path: 'codex-package/deepseek-whale-girl', tags: ['DeepSeek', '像素'] },

  // ── 猫猫合集（D-Cats）────────────────────────────────────────────────
  { id: 'cat-d', name: '小猫 D', desc: '像素猫猫合集 · D', repo: 'GrShin5/D-Cats-Codex-Pets', path: 'pets/cat-d', tags: ['猫咪', '像素'] },
  { id: 'cat-k', name: '小猫 K', desc: '像素猫猫合集 · K', repo: 'GrShin5/D-Cats-Codex-Pets', path: 'pets/cat-k', tags: ['猫咪', '像素'] },
  { id: 'cat-p', name: '小猫 P', desc: '像素猫猫合集 · P', repo: 'GrShin5/D-Cats-Codex-Pets', path: 'pets/cat-p', tags: ['猫咪', '像素'] },
  { id: 'cat-t', name: '小猫 T', desc: '像素猫猫合集 · T', repo: 'GrShin5/D-Cats-Codex-Pets', path: 'pets/cat-t', tags: ['猫咪', '像素'] },
  { id: 'cat-u', name: '小猫 U', desc: '像素猫猫合集 · U', repo: 'GrShin5/D-Cats-Codex-Pets', path: 'pets/cat-u', tags: ['猫咪', '像素'] },

  // ── Pokémon 合集 ──────────────────────────────────────────────────────
  { id: 'pikachu', name: '皮卡丘', desc: 'Pokémon · 十万伏特！', repo: 'dnnyngyen/codex-pokepets', path: 'pets/pikachu', tags: ['宝可梦'] },
  { id: 'eevee', name: '伊布', desc: 'Pokémon · 进化之星', repo: 'dnnyngyen/codex-pokepets', path: 'pets/eevee', tags: ['宝可梦'] },
  { id: 'mew', name: '梦幻', desc: 'Pokémon · 神秘幻之宝可梦', repo: 'dnnyngyen/codex-pokepets', path: 'pets/mew', tags: ['宝可梦'] },
  { id: 'charmander', name: '小火龙', desc: 'Pokémon · 尾巴上的火焰是它的生命', repo: 'dnnyngyen/codex-pokepets', path: 'pets/charmander', tags: ['宝可梦'] },
  { id: 'squirtle', name: '杰尼龟', desc: 'Pokémon · 水枪小队', repo: 'dnnyngyen/codex-pokepets', path: 'pets/squirtle', tags: ['宝可梦'] },
  { id: 'bulbasaur', name: '妙蛙种子', desc: 'Pokémon · 背上种子的草系御三家', repo: 'dnnyngyen/codex-pokepets', path: 'pets/bulbasaur', tags: ['宝可梦'] },
  { id: 'jigglypuff', name: '胖丁', desc: 'Pokémon · 唱首歌你就睡着啦', repo: 'dnnyngyen/codex-pokepets', path: 'pets/jigglypuff', tags: ['宝可梦'] },
  { id: 'psyduck', name: '可达鸭', desc: 'Pokémon · 头痛鸭鸭，呆萌担当', repo: 'dnnyngyen/codex-pokepets', path: 'pets/psyduck', tags: ['宝可梦'] },
  { id: 'magikarp', name: '鲤鱼王', desc: 'Pokémon · 跃起！水溅跃！', repo: 'dnnyngyen/codex-pokepets', path: 'pets/magikarp', tags: ['宝可梦'] },
  { id: 'snorlax', name: '卡比兽', desc: 'Pokémon · 睡觉就是最强的战术', repo: 'dnnyngyen/codex-pokepets', path: 'pets/snorlax', tags: ['宝可梦'] },
  { id: 'gengar', name: '耿鬼', desc: 'Pokémon · 幽灵系捣蛋鬼', repo: 'dnnyngyen/codex-pokepets', path: 'pets/gengar', tags: ['宝可梦'] },
  { id: 'lucario', name: '路卡利欧', desc: 'Pokémon · 波导的勇者', repo: 'dnnyngyen/codex-pokepets', path: 'pets/lucario', tags: ['宝可梦'] },
  { id: 'umbreon', name: '月亮伊布', desc: 'Pokémon · 月光下的伊布进化', repo: 'dnnyngyen/codex-pokepets', path: 'pets/umbreon', tags: ['宝可梦'] },
  { id: 'espeon', name: '太阳伊布', desc: 'Pokémon · 沐浴阳光的伊布进化', repo: 'dnnyngyen/codex-pokepets', path: 'pets/espeon', tags: ['宝可梦'] },
  { id: 'vulpix', name: '六尾', desc: 'Pokémon · 火焰尾巴的可爱狐狸', repo: 'dnnyngyen/codex-pokepets', path: 'pets/vulpix', tags: ['宝可梦'] },
  { id: 'slowpoke', name: '呆呆兽', desc: 'Pokémon · 慢慢来，比较快', repo: 'dnnyngyen/codex-pokepets', path: 'pets/slowpoke', tags: ['宝可梦'] },
  { id: 'togepi', name: '波克比', desc: 'Pokémon · 带来好运的蛋宝', repo: 'dnnyngyen/codex-pokepets', path: 'pets/togepi', tags: ['宝可梦'] },
  { id: 'wooper', name: '乌波', desc: 'Pokémon · 水中的快乐小泥鳅', repo: 'dnnyngyen/codex-pokepets', path: 'pets/wooper', tags: ['宝可梦'] }
]

/** Resolve the two source URLs for one catalog skin file. */
export function skinFileUrls(item, file) {
  return [
    `https://cdn.jsdelivr.net/gh/${item.repo}@main/${item.path}/${file}`,
    `https://raw.githubusercontent.com/${item.repo}/main/${item.path}/${file}`
  ]
}

/** All unique tags across the catalog, sorted by count desc. */
export function catalogTags() {
  const counts = new Map()
  for (const s of SKIN_CATALOG) {
    for (const t of s.tags) counts.set(t, (counts.get(t) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
}
