import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MensagemDoChat } from '../../lib/nuvem/chatDoLobby'
import { abrirCopiaDaSala, ARQUIVO_DA_SALA, copiaDoArquivo, lerPaginaDaSala, type FonteDaSala, type ResultadoDaPaginaDaSala } from './chatSala'
import { pastaNoDisco, type PrimitivasDoDisco } from './discoDaNuvem'

/**
 * C3: a cópia da sala no disco de verdade (o `node:fs` numa pasta temporária,
 * as mesmas primitivas que o plugin-fs dá ao app, como em `discoDaNuvem.test.ts`).
 */

/** O pedaço do Node que o teste usa, pelo `vi.importActual`: os tipos do Node não estão no tsconfig do app. */
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

const temporarias: string[] = []

afterEach(async () => {
  for (const pasta of temporarias.splice(0)) await fs.rm(pasta, { recursive: true, force: true })
})

async function pastaTemporaria(): Promise<string> {
  const raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'lobby-c3-'))
  temporarias.push(raiz)
  return path.join(raiz, 'nuvem', 'camp_teste')
}

function msg(id: number, mudou: number, texto: string, autorContaId = 'conta_nami', apagadaEm: number | null = null): MensagemDoChat {
  return { id, autorContaId, autorNome: autorContaId === 'mestre' ? 'Mestre' : 'Nami', texto, mencoes: [], criadaEm: 1_000 + id, apagadaEm, mudou }
}

/** O servidor falso: uma resposta por chamada, na ordem; guarda o `desde` de cada pedido. */
function fonteComPaginas(paginas: readonly unknown[]): FonteDaSala & { pedidos: number[] } {
  const pedidos: number[] = []
  let proxima = 0
  return {
    pedidos,
    async pagina(_campanhaId, desde): Promise<ResultadoDaPaginaDaSala> {
      pedidos.push(desde)
      const corpo = paginas[proxima]
      proxima += 1
      // O mesmo leitor do corpo que a fonte de verdade (`fonteDaSalaSobre`) usa.
      const pagina = lerPaginaDaSala(corpo)
      return typeof pagina === 'string' ? { t: 'erro', detalhe: pagina } : { t: 'ok', ...pagina }
    },
  }
}

describe('cópia da sala do chat no app (C3)', () => {
  it('a lápide tira o texto apagado do arquivo, e uma página com conversa privada não grava nada', async () => {
    const caminho = await pastaTemporaria()
    const arquivo = path.join(caminho, ARQUIVO_DA_SALA)
    const fonte = fonteComPaginas([
      { desde: 0, ate: 2, lista: [msg(1, 1, 'segredo do mapa'), msg(2, 2, 'bom dia', 'mestre')], temMais: false, cursorAtual: 2 },
      // A Nami apagou a 1 no site (lápide, `mudou` novo) e o mestre falou de novo.
      { desde: 2, ate: 5, lista: [msg(1, 4, '', 'conta_nami', 9_000), msg(3, 5, 'até amanhã', 'mestre')], temMais: false, cursorAtual: 5 },
      // Servidor torto: uma dm do par Nami-Zoro no meio da sala.
      { desde: 5, ate: 7, lista: [msg(4, 6, 'oi sala'), { ...msg(5, 7, 'só entre nós'), contaA: 'conta_nami', contaB: 'conta_zoro', par: 'conta_nami:conta_zoro' }], temMais: false, cursorAtual: 7 },
    ])
    const sala = abrirCopiaDaSala('camp_teste', pastaNoDisco(primitivasDoNode, caminho), fonte)

    expect(await sala.atualizar()).toEqual({ t: 'ok', mensagens: 2, gravadas: 2 })
    expect(await sala.atualizar()).toEqual({ t: 'ok', mensagens: 3, gravadas: 2 })
    const depoisDaLapide = await fs.readFile(arquivo, 'utf8')
    expect(depoisDaLapide).not.toContain('segredo do mapa')
    expect([...copiaDoArquivo(depoisDaLapide).copia.values()]).toEqual([msg(1, 4, '', 'conta_nami', 9_000), msg(2, 2, 'bom dia', 'mestre'), msg(3, 5, 'até amanhã', 'mestre')])

    const comDm = await sala.atualizar()
    expect(comDm.t).toBe('erro')
    // Nada da página com a dm entra: nem a dm, nem a mensagem da sala que veio junto.
    expect(await fs.readFile(arquivo, 'utf8')).toBe(depoisDaLapide)
    expect(fonte.pedidos).toEqual([0, 2, 5])
  })
})
