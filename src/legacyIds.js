// The inventory id of a legacy record, from its legacy key (inventory-app#2544).
// The importer gives every legacy record the same id on every import: a
// UUIDv5 of `<entity>:<backward_compatibility, lowercased>` in one frozen
// namespace (inventory-app scripts/importer/src/utils/deterministic-uuid.ts,
// whose header makes the namespace and the name's shape a contract). A link
// to a legacy record's page can therefore name the new page's record without
// reading the other site's package. Synchronous on purpose: a link is
// rewritten as it is drawn.

/** The importer's namespace (`IMPORTER_UUID_NAMESPACE`), frozen there. */
export const IMPORTER_UUID_NAMESPACE = 'bc112041-0784-4475-80b2-0c96425ac5ea'

function utf8(text) {
  return new TextEncoder().encode(text)
}

// SHA-1 (FIPS 180-4) of `bytes`, as 20 bytes. Only UUIDv5 needs it here.
function sha1(bytes) {
  const length = bytes.length
  const blocks = ((length + 8) >> 6) + 1
  const words = new Uint32Array(blocks * 16)
  for (let i = 0; i < length; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8)
  words[length >> 2] |= 0x80 << (24 - (length % 4) * 8)
  words[blocks * 16 - 1] = length * 8
  words[blocks * 16 - 2] = Math.floor((length * 8) / 0x100000000)
  let [a, b, c, d, e] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]
  const w = new Uint32Array(80)
  const rotl = (x, n) => (x << n) | (x >>> (32 - n))
  for (let block = 0; block < blocks; block++) {
    for (let t = 0; t < 16; t++) w[t] = words[block * 16 + t]
    for (let t = 16; t < 80; t++) w[t] = rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1)
    let [h0, h1, h2, h3, h4] = [a, b, c, d, e]
    for (let t = 0; t < 80; t++) {
      let f, k
      if (t < 20) [f, k] = [(h1 & h2) | (~h1 & h3), 0x5a827999]
      else if (t < 40) [f, k] = [h1 ^ h2 ^ h3, 0x6ed9eba1]
      else if (t < 60) [f, k] = [(h1 & h2) | (h1 & h3) | (h2 & h3), 0x8f1bbcdc]
      else [f, k] = [h1 ^ h2 ^ h3, 0xca62c1d6]
      const next = (rotl(h0, 5) + f + h4 + k + w[t]) >>> 0
      ;[h4, h3, h2, h1, h0] = [h3, h2, rotl(h1, 30) >>> 0, h0, next]
    }
    a = (a + h0) >>> 0
    b = (b + h1) >>> 0
    c = (c + h2) >>> 0
    d = (d + h3) >>> 0
    e = (e + h4) >>> 0
  }
  const out = new Uint8Array(20)
  ;[a, b, c, d, e].forEach((word, i) => {
    for (let j = 0; j < 4; j++) out[i * 4 + j] = (word >>> (24 - j * 8)) & 0xff
  })
  return out
}

/** RFC 4122 UUIDv5 of `name` in `namespace`. */
export function uuidV5(name, namespace = IMPORTER_UUID_NAMESPACE) {
  const ns = namespace.replace(/-/g, '').match(/../g).map((hex) => parseInt(hex, 16))
  const nameBytes = utf8(name)
  const input = new Uint8Array(16 + nameBytes.length)
  input.set(ns, 0)
  input.set(nameBytes, 16)
  const hash = sha1(input).slice(0, 16)
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * The inventory id the importer gives the legacy record `key` (its
 * `backward_compatibility`) of `entity` (`publication`, `collection`…).
 */
export function legacyRecordId(entity, key) {
  return uuidV5(`${entity}:${String(key).toLowerCase()}`)
}
