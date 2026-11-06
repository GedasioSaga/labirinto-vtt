import { afterEach, describe, expect, it, vi } from 'vitest'
import { F_NAMI, MESTRE_NO_APP, op } from '../../lib/nuvem/campanha.fixture'
import { armazenamentoEmTexto, criarFila } from '../../lib/nuvem/fila'
import { arquivoDaFila, pastaNoDisco, SUFIXO_GRAVANDO, type PrimitivasDoDisco } from './discoDaNuvem'
import { estadoNovo, gravarEstado, lerEstado } from './estadoNoDisco'

/**
 * 8.1.1 item 5: a primeira execução fora da memória. O adaptador da A5 roda
 * contra um disco DE VERDADE (o `node:fs` numa pasta temporária, com as mesmas
 * primitivas que o plugin-fs do Tauri dá ao app): o append do `fila.jsonl` e
 * a troca segura por rename.
 */

/** O pedaço do Node que o teste usa, pelo `vi.importActual` (o molde de `animacoes/porta/pacoteCompilado.test.ts`): os tipos do Node não estão no tsconfig do app. */
const fs = await vi.importActual<{
  mkdtemp(prefixo: string): Promise<string>
  mkdir(caminho: string, opcoes: { recursive: true }): Promise<unknown>
  readdir(caminho: string): Promise<string[]>
  readFile(caminho: string, codificacao: 'utf8'): Promise<string>
  writeFile(caminho: string, texto: string, codificacao: 'utf8'): Promise<void>
  appendFile(caminho: string, texto: string, codificacao: 'utf8'): Promise<void>
  rename(de: string, para: string): Promise<void>
  rm(caminho: string, opcoes: { recursive?: true; force: true }): Promise<void>
  access(caminho: string): Promise<void>
}>('node:fs/promises')
const os = await vi.importActual<{ tmpdir(): string }>('node:os')
const path = await vi.importActual<{ join(...partes: string[]): string }>('node:path')

async function existe(caminho: string): Promise<boolean> {
  return fs.access(caminho).then(
    () => true,
    () => false,
  )
}

const primitivasDoNode: PrimitivasDoDisco = {
  juntar: async (pasta, nome) => path.join(pasta, nome),
  lerTexto: async (caminho) => ((await existe(caminho)) ? fs.readFile(caminho, 'utf8') : null),
  escreverTexto: (caminho, texto, acrescentar) => (acrescentar ? fs.appendFile(caminho, texto, 'utf8') : fs.writeFile(caminho, texto, 'utf8')),
  renomear: (de, para) => fs.rename(de, para),
  apagarSeExiste: (caminho) => fs.rm(caminho, { force: true }),
  listarArquivos: async (pasta) => ((await existe(pasta)) ? fs.readdir(pasta) : []),
  garantirPasta: async (pasta) => {
    await fs.mkdir(pasta, { recursive: true })
  },
}

const { appendFile, mkdtemp, readdir, rm } = fs
const { tmpdir } = os
const { join } = path

const temporarias: string[] = []

afterEach(async () => {
  for (const pasta of temporarias.splice(0)) await rm(pasta, { recursive: true, force: true })
})

async function pastaTemporaria(): Promise<string> {
  const raiz = await mkdtemp(join(tmpdir(), 'lobby-a5-'))
  temporarias.push(raiz)
  return join(raiz, 'nuvem', 'camp_teste')
}

describe('disco da nuvem no app (A5, 8.1.1 item 5)', () => {
  it('fila.jsonl de verdade: a linha cortada pela queda é ignorada ao reabrir, e a op seguinte começa numa linha nova', async () => {
    const caminho = await pastaTemporaria()
    const pasta = pastaNoDisco(primitivasDoNode, caminho)
    const fila = await criarFila(armazenamentoEmTexto(arquivoDaFila(pasta)))
    const a = op(MESTRE_NO_APP, F_NAMI, ['nome'], 'definir', { valor: 'Nami' })
    const b = op(MESTRE_NO_APP, F_NAMI, ['descricao'], 'definir', { valor: 'Navegadora' })
    expect(await fila.acrescentar([a, b])).toEqual({ ok: true })
    // A queda no meio do append: meia linha no fim do arquivo.
    await appendFile(join(caminho, 'fila.jsonl'), '{"t":"op","v":1,"opId":"op_cort', 'utf8')

    const depoisDaQueda = await criarFila(armazenamentoEmTexto(arquivoDaFila(pastaNoDisco(primitivasDoNode, caminho))))
    expect(depoisDaQueda.ignoradosAoAbrir).toBe(1)
    expect(depoisDaQueda.entradas().map((entrada) => entrada.op.opId)).toEqual([a.opId, b.opId])
    const c = op(MESTRE_NO_APP, F_NAMI, ['escolhas', 'classe'], 'definir', { valor: 'Navegadora' })
    expect(await depoisDaQueda.acrescentar([c])).toEqual({ ok: true })

    const terceira = await criarFila(armazenamentoEmTexto(arquivoDaFila(pastaNoDisco(primitivasDoNode, caminho))))
    expect(terceira.entradas().map((entrada) => entrada.op.opId)).toEqual([a.opId, b.opId, c.opId])
    expect(terceira.ignoradosAoAbrir).toBe(1)
  })

  it('estado.json pela troca segura (rename): grava duas vezes, lê a última e não sobra arquivo .gravando', async () => {
    const caminho = await pastaTemporaria()
    const pasta = pastaNoDisco(primitivasDoNode, caminho)
    const estado = estadoNovo('camp_teste', 'pasta_teste', 'cli_app')
    await gravarEstado(pasta, estado)
    await gravarEstado(pasta, { ...estado, revRecebida: 7, revNoRpg: 7 })
    expect(await lerEstado(pastaNoDisco(primitivasDoNode, caminho))).toEqual({ ...estado, revRecebida: 7, revNoRpg: 7 })
    expect((await readdir(caminho)).filter((nome) => nome.endsWith(SUFIXO_GRAVANDO))).toEqual([])
  })
})
