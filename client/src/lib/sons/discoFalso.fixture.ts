import { vi } from 'vitest'

/**
 * DISCO DE MENTIRA para os testes da biblioteca de sons e do áudio que viaja
 * com a aventura: arquivos (texto ou binário) e pastas na memória, com a forma
 * de `@tauri-apps/plugin-fs` e `@tauri-apps/api/path` que o código usa. Cada
 * função é um espião, para o teste conferir o que foi (ou não foi) lido.
 *
 * Uso: `vi.mock('@tauri-apps/plugin-fs', async () => (await import('./discoFalso.fixture')).fsFalso)`
 * e o mesmo com `pathFalso`; `limparDisco()` no `beforeEach`.
 */

export const APPDATA = 'C:/appdata'
export const MIDIA_DO_APP = `${APPDATA}/midia`

export const arquivos = new Map<string, string | Uint8Array>()
export const pastas = new Set<string>()

export function pai(caminho: string): string {
  return caminho.slice(0, caminho.lastIndexOf('/'))
}

export function criarPastasAte(caminho: string): void {
  for (let pasta = caminho; pasta.includes('/'); pasta = pai(pasta)) pastas.add(pasta)
}

export function bytesDe(caminho: string): Uint8Array {
  const conteudo = arquivos.get(caminho)
  if (!(conteudo instanceof Uint8Array)) throw new Error(`arquivo binário não existe: ${caminho}`)
  return conteudo
}

export function textoDe(caminho: string): string {
  const conteudo = arquivos.get(caminho)
  if (typeof conteudo !== 'string') throw new Error(`arquivo de texto não existe: ${caminho}`)
  return conteudo
}

function tamanhoDe(conteudo: string | Uint8Array): number {
  return typeof conteudo === 'string' ? new TextEncoder().encode(conteudo).length : conteudo.length
}

export const fsFalso = {
  mkdir: vi.fn(async (caminho: string) => criarPastasAte(caminho)),
  exists: vi.fn(async (caminho: string) => arquivos.has(caminho) || pastas.has(caminho)),
  readDir: vi.fn(async (caminho: string) => {
    if (!pastas.has(caminho)) throw new Error(`pasta não existe: ${caminho}`)
    const nomes = [...arquivos.keys()].filter((c) => pai(c) === caminho)
    const subpastas = [...pastas].filter((c) => pai(c) === caminho)
    return [
      ...nomes.map((c) => ({ name: c.slice(caminho.length + 1), isFile: true, isDirectory: false, isSymlink: false })),
      ...subpastas.map((c) => ({ name: c.slice(caminho.length + 1), isFile: false, isDirectory: true, isSymlink: false })),
    ]
  }),
  readFile: vi.fn(async (caminho: string) => bytesDe(caminho).slice()),
  readTextFile: vi.fn(async (caminho: string) => textoDe(caminho)),
  writeFile: vi.fn(async (caminho: string, bytes: Uint8Array) => {
    if (!pastas.has(pai(caminho))) throw new Error(`pasta não existe: ${pai(caminho)}`)
    arquivos.set(caminho, bytes.slice())
  }),
  writeTextFile: vi.fn(async (caminho: string, texto: string) => {
    if (!pastas.has(pai(caminho))) throw new Error(`pasta não existe: ${pai(caminho)}`)
    arquivos.set(caminho, texto)
  }),
  copyFile: vi.fn(async (de: string, para: string) => {
    if (!pastas.has(pai(para))) throw new Error(`pasta não existe: ${pai(para)}`)
    arquivos.set(para, bytesDe(de).slice())
  }),
  rename: vi.fn(async (de: string, para: string) => {
    const conteudo = arquivos.get(de)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${de}`)
    arquivos.set(para, conteudo)
    arquivos.delete(de)
  }),
  remove: vi.fn(async (caminho: string) => {
    arquivos.delete(caminho)
  }),
  stat: vi.fn(async (caminho: string) => {
    const conteudo = arquivos.get(caminho)
    if (conteudo !== undefined) return { size: tamanhoDe(conteudo), isFile: true, isDirectory: false, isSymlink: false }
    if (pastas.has(caminho)) return { size: 0, isFile: false, isDirectory: true, isSymlink: false }
    throw new Error(`não existe: ${caminho}`)
  }),
}

export const pathFalso = {
  appDataDir: vi.fn(async () => APPDATA),
  join: vi.fn(async (...partes: string[]) => partes.join('/')),
  dirname: vi.fn(async (caminho: string) => pai(caminho)),
}

export function limparDisco(): void {
  arquivos.clear()
  pastas.clear()
  for (const espiao of Object.values(fsFalso)) espiao.mockClear()
}

/** Um WAV de `tamanho` bytes (cabeçalho RIFF....WAVE); `marca` no último byte muda o hash. */
export function wav(tamanho: number, marca = 0): Uint8Array {
  const bytes = new Uint8Array(tamanho)
  bytes.set([0x52, 0x49, 0x46, 0x46], 0)
  bytes.set([0x57, 0x41, 0x56, 0x45], 8)
  bytes[tamanho - 1] = marca
  return bytes
}

/** Um PNG pequeno; `marca` muda o conteúdo (e com ele o hash). */
export function png(marca: number): Uint8Array {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, marca])
}
