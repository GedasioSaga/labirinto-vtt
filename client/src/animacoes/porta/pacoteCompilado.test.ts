// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { animacaoDePorta, esquecerAnimacoesDePortaDeFora, listarAnimacoesDePorta } from '../../portas/animacoesDePorta'
import { carregarPacoteDeAnimacoes, esquecerPacoteCarregado, type OrigemDoPacote } from '../../lib/pacoteDeAnimacoes'
import metaDupla from './dupla.json'
import metaGrade from './grade.json'
import metaArrombada from './arrombada.json'
import metaSanfona from './sanfona.json'
import metaCortina from './cortina.json'

/**
 * O PACOTE COMPILADO (22/10/2026): o índice publicado lista só as cinco do
 * pacote (Girar e Deslizar são embutidas), e as sete juntas só apareciam no
 * laboratório, que importa os módulos FONTE. Aqui o script de publicação de
 * verdade (`scripts/pacote-animacoes.cjs`, sem `--publicar`) compila as portas
 * numa pasta temporária, e o índice e os módulos compilados entram pelo
 * carregador do app (`carregarPacoteDeAnimacoes`). A pasta é apagada no fim.
 */

/**
 * O pedaço do Node que o teste usa, pelo `vi.importActual` (o molde de
 * Toggle.test.tsx): os tipos do Node não estão no tsconfig do app, então só
 * isto é descrito.
 */
async function nodeDoTeste() {
  const fs = await vi.importActual<{
    existsSync(caminho: string): boolean
    mkdtempSync(prefixo: string): string
    symlinkSync(alvo: string, caminho: string, tipo: 'junction'): void
    mkdirSync(caminho: string): void
    rmdirSync(caminho: string): void
    readFileSync(caminho: string, codificacao: 'utf8'): string
    rmSync(caminho: string, opcoes: { recursive: true; force: true }): void
  }>('node:fs')
  const os = await vi.importActual<{ tmpdir(): string; homedir(): string }>('node:os')
  const path = await vi.importActual<{ join(...partes: string[]): string; resolve(...partes: string[]): string }>('node:path')
  const url = await vi.importActual<{ pathToFileURL(caminho: string): { href: string } }>('node:url')
  const childProcess = await vi.importActual<{
    spawnSync(exe: string, args: string[], opcoes: { encoding: 'utf8'; timeout: number }): { status: number | null; stdout: string; stderr: string }
  }>('node:child_process')
  const processo = await vi.importActual<{ execPath: string; cwd(): string }>('node:process')
  return { fs, os, path, url, childProcess, existsSync: fs.existsSync, execPath: processo.execPath, cwd: () => processo.cwd() }
}

/** O `import()` do módulo compilado, pelo endereço do arquivo, como o app faz com a URL do Blob (`importarDeVerdade`). */
const importarArquivo = (url: string): Promise<unknown> => import(/* @vite-ignore */ url)

const DECLARADAS = { dupla: metaDupla, grade: metaGrade, arrombada: metaArrombada, sanfona: metaSanfona, cortina: metaCortina }
const node = await nodeDoTeste()
const RAIZ = node.path.resolve(node.cwd(), '..')
const SCRIPT = node.path.join(RAIZ, 'scripts', 'pacote-animacoes.cjs')
const CHAVE = node.path.join(node.os.homedir(), '.tauri', 'labirinto.key')

let pasta = ''
let indiceCompilado = ''

beforeAll(() => {
  if (!node.existsSync(CHAVE)) return
  pasta = node.fs.mkdtempSync(node.path.join(node.os.tmpdir(), 'pacote-portas-'))
  // Só as portas: a pasta de fontes do teste aponta (junção) para a de verdade,
  // e os imports relativos delas (`../../portas/...`) resolvem pelo caminho real.
  const fontes = node.path.join(pasta, 'fontes')
  node.fs.mkdirSync(fontes)
  node.fs.symlinkSync(node.path.join(RAIZ, 'client', 'src', 'animacoes', 'porta'), node.path.join(fontes, 'porta'), 'junction')
  const r = node.childProcess.spawnSync(node.execPath, [SCRIPT, '--fontes', fontes, '--versao', '1', '--saida', node.path.join(pasta, 'saida')], { encoding: 'utf8', timeout: 110_000 })
  if (r.status !== 0) throw new Error(`o script saiu com ${r.status}: ${r.stderr.slice(0, 600)}`)
  indiceCompilado = node.fs.readFileSync(node.path.join(pasta, 'saida', 'indice.json'), 'utf8')
}, 120_000)

afterAll(() => {
  esquecerPacoteCarregado()
  esquecerAnimacoesDePortaDeFora()
  if (pasta === '') return
  // A junção sai primeiro, sozinha: apagar recursivo atravessando junção já levou um node_modules compartilhado.
  const juncao = node.path.join(pasta, 'fontes', 'porta')
  if (node.existsSync(juncao)) node.fs.rmdirSync(juncao)
  node.fs.rmSync(pasta, { recursive: true, force: true })
})

describe.skipIf(!node.existsSync(CHAVE))('o pacote de portas compilado, carregado como o app carrega', () => {
  it('o índice compilado tem as cinco portas do pacote; carregado, o registro lista as 7 com os tempos e as curvas declarados', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const origem: OrigemDoPacote = {
      lerIndice: async () => indiceCompilado,
      importar: (arquivo) => importarArquivo(node.url.pathToFileURL(node.path.join(pasta, 'saida', arquivo)).href),
    }
    const resultado = await carregarPacoteDeAnimacoes(origem, indiceCompilado)
    // As cinco do índice compilado entraram todas: módulo e meta aceitos pelo carregador (a assinatura é do Rust).
    expect(resultado.versao).toBe(1)
    expect(resultado.registradas.map((e) => `${e.tipo}/${e.id}`).sort()).toEqual(['porta/arrombada', 'porta/cortina', 'porta/dupla', 'porta/grade', 'porta/sanfona'])

    // As embutidas primeiro; as do pacote na ordem do índice (o script lê as fontes em ordem alfabética).
    expect(listarAnimacoesDePorta().map((a) => a.id)).toEqual(['girar', 'deslizar', 'arrombada', 'cortina', 'dupla', 'grade', 'sanfona'])
    for (const [id, meta] of Object.entries(DECLARADAS)) {
      const animacao = animacaoDePorta(id)
      expect(animacao, id).not.toBeNull()
      expect(animacao?.nome, id).toBe(meta.nome)
      expect(animacao?.duracaoMs, id).toBe(meta.duracaoMs)
      expect(animacao?.duracaoFecharMs, id).toBe(meta.duracaoFecharMs)
      expect(animacao?.curvaAbrir, id).toEqual(meta.curvaAbrir)
      expect(animacao?.curvaFechar, id).toEqual(meta.curvaFechar)
      expect(animacao?.som, id).toBe(meta.som)
      // O módulo compilado é a função de desenho de verdade, não um embrulho vazio.
      expect(typeof animacao?.desenhar, id).toBe('function')
    }
  }, 60_000)
})
