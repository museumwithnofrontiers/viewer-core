import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

/**
 * What is wrong with a site's chrome taken from legacy (decision D7,
 * inventory-app#2233): `sources` is the folder's SOURCES.json, whose `files`
 * name each file by its path from the site's root with the sha256 of the
 * bytes legacy serves. Every listed file must be there, byte for byte, and the
 * folder must hold nothing the list does not name.
 *
 * Returns one line per problem, so a site's test reads
 * `expect(checkChromeSources(sources)).toEqual([])` and a failure names every
 * file at once. Paths resolve from `root`, the site's own directory (where
 * Vitest runs).
 */
export function checkChromeSources(sources, { folder = 'theme/assets/legacy', root = process.cwd() } = {}) {
  const problems = []
  const listed = new Set(Object.keys(sources.files ?? {}))
  for (const [path, { sha256 }] of Object.entries(sources.files ?? {})) {
    const file = resolve(root, path)
    if (!existsSync(file)) {
      problems.push(`${path}: missing`)
      continue
    }
    if (createHash('sha256').update(readFileSync(file)).digest('hex') !== sha256) {
      problems.push(`${path}: not the file legacy serves`)
    }
  }
  const present = readdirSync(resolve(root, folder), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== 'SOURCES.json')
    .map((entry) => `${relative(root, entry.parentPath).split(sep).join('/')}/${entry.name}`)
  for (const path of present.filter((p) => !listed.has(p))) problems.push(`${path}: not listed in SOURCES.json`)
  return problems
}
