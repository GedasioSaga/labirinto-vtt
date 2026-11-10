import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import type { CondicaoPropria } from '../types/map'
import { lerCatalogoDeCondicoes } from './condicoesProprias'
import { ensureDir, writeTextFileSafely } from './mapFileIO'

/**
 * A LISTA DE CONDIÇÕES CRIADAS NO DISCO, junto dos dados da pasta: um
 * `condicoes.json` ao lado do arquivo das fichas — o `rpg.json` da pasta do
 * Carregar Mapa (`<appData>/pastas/<id>/`) ou o `adventure.json` da aventura
 * que está fora de pasta. Arquivo próprio, como o `sons.json` e a batalha em
 * andamento: quem grava as fichas (o Salvar, o Lobby) não precisa saber dele.
 *
 *   <pasta>/condicoes.json            a lista
 *   <pasta>/condicoes.json.anterior   a versão de antes da última gravação
 *   <pasta>/condicoes.json.invalido   o arquivo ilegível que a leitura achou
 *
 * Mesmas defesas do arquivo das fichas (`lib/pastasDeMapas.ts`): gravação
 * segura (`writeTextFileSafely`), cópia do de antes em `.anterior`, e toda
 * mudança é ler-mudar-gravar numa fila por pasta — vale sobre o que está no
 * disco, e não sobre a cópia que a tela leu antes. Arquivo danificado volta a
 * cópia anterior; sem ela, é posto de lado (`.invalido`) e a lista recomeça
 * vazia. O que não se leu nunca é regravado por cima.
 */

export const ARQUIVO_DAS_CONDICOES = 'condicoes.json'
const SUFIXO_ANTERIOR = '.anterior'
const SUFIXO_INVALIDO = '.invalido'
const VERSAO = 1

const NAO_LEU = 'Não foi possível ler a lista de condições desta pasta'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export type CondicoesDoTexto = { ok: true; condicoes: CondicaoPropria[] } | { ok: false; motivo: 'ilegivel' | 'versao-mais-nova' }

/**
 * O arquivo como texto. Cada condição passa pela leitura campo a campo
 * (`lerCatalogoDeCondicoes`): a que veio torta fica de fora, sem derrubar as
 * outras. O que não é JSON, ou não tem a lista, é `ilegivel`.
 */
export function condicoesDoTexto(texto: string): CondicoesDoTexto {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return { ok: false, motivo: 'ilegivel' }
  }
  if (!isRecord(bruto) || !Array.isArray(bruto.condicoes)) return { ok: false, motivo: 'ilegivel' }
  if (typeof bruto.versao === 'number' && bruto.versao > VERSAO) return { ok: false, motivo: 'versao-mais-nova' }
  return { ok: true, condicoes: lerCatalogoDeCondicoes(bruto.condicoes) }
}

export function serializarCondicoes(condicoes: readonly CondicaoPropria[]): string {
  return `${JSON.stringify({ versao: VERSAO, condicoes }, null, 2)}\n`
}

export interface CondicoesLidas {
  condicoes: CondicaoPropria[]
  /** A pasta já tem o arquivo? `false` = ainda não: é quando a lista deste computador migra para ela. */
  existe: boolean
  /** Frase pronta para a tela quando a leitura deu errado; `null` = leu limpo (ou não havia arquivo). */
  aviso: string | null
  /** `false` = há um arquivo que não foi lido; gravar agora passaria por cima dele. */
  podeGravar: boolean
}

/** O erro do disco em frase, sem o caminho absoluto (que traz o nome de usuário do Windows). */
function motivo(causa: unknown): string {
  const texto = causa instanceof Error ? causa.message : String(causa)
  if (/os error 5\b|denied|negado/i.test(texto)) return 'o Windows negou o acesso ao arquivo (outro programa pode estar com ele aberto)'
  if (/forbidden path|not allowed/i.test(texto)) return 'o app não tem permissão de usar essa pasta'
  const codigo = /os error (\d+)/i.exec(texto)
  return codigo === null ? 'o disco recusou a operação' : `o disco recusou a operação (os error ${codigo[1]})`
}

async function lerSeExiste(caminho: string): Promise<string | null> {
  if (!(await exists(caminho))) return null
  return readTextFile(caminho)
}

/** O que a leitura achou, mais o que só a gravação precisa saber. */
interface Leitura extends CondicoesLidas {
  /** O arquivo principal foi lido limpo: só então ele vale como cópia `.anterior` na próxima gravação. */
  principalLegivel: boolean
}

async function lerAgora(pasta: string): Promise<Leitura> {
  let caminho: string
  let texto: string | null
  try {
    caminho = await join(pasta, ARQUIVO_DAS_CONDICOES)
    texto = await lerSeExiste(caminho)
  } catch (erro) {
    return { condicoes: [], existe: false, aviso: `${NAO_LEU}: ${motivo(erro)}.`, podeGravar: false, principalLegivel: false }
  }
  if (texto === null) return { condicoes: [], existe: false, aviso: null, podeGravar: true, principalLegivel: false }
  const lido = condicoesDoTexto(texto)
  if (lido.ok) return { condicoes: lido.condicoes, existe: true, aviso: null, podeGravar: true, principalLegivel: true }
  if (lido.motivo === 'versao-mais-nova') {
    return { condicoes: [], existe: true, aviso: 'A lista de condições desta pasta foi gravada por uma versão mais nova do app: atualize para usá-la.', podeGravar: false, principalLegivel: false }
  }
  try {
    const anterior = await lerSeExiste(`${caminho}${SUFIXO_ANTERIOR}`)
    const daCopia = anterior === null ? null : condicoesDoTexto(anterior)
    if (daCopia !== null && daCopia.ok) {
      return { condicoes: daCopia.condicoes, existe: true, aviso: 'O arquivo das condições desta pasta estava danificado: voltou a cópia anterior.', podeGravar: true, principalLegivel: false }
    }
    await writeTextFile(`${caminho}${SUFIXO_INVALIDO}`, texto)
  } catch {
    // Sem a cópia, a lista NÃO recomeça: gravar agora passaria por cima do único exemplar.
    return { condicoes: [], existe: true, aviso: `${NAO_LEU}: o arquivo estava ilegível e não deu para guardar uma cópia dele.`, podeGravar: false, principalLegivel: false }
  }
  return {
    condicoes: [],
    existe: true,
    aviso: `${NAO_LEU}: o arquivo estava ilegível. A lista começa vazia, e o antigo ficou guardado como ${ARQUIVO_DAS_CONDICOES}${SUFIXO_INVALIDO}, na mesma pasta.`,
    podeGravar: true,
    principalLegivel: false,
  }
}

/** Uma cadeia por pasta: a próxima operação só começa quando a anterior terminou (deu certo ou não). */
const filas = new Map<string, Promise<unknown>>()

function naFila<T>(pasta: string, operacao: () => Promise<T>): Promise<T> {
  const resultado = (filas.get(pasta) ?? Promise.resolve()).then(operacao)
  const fim = resultado.catch(() => undefined)
  filas.set(pasta, fim)
  // A cadeia que terminou e ninguém seguiu sai do mapa (não acumula uma por pasta aberta na vida do app).
  void fim.then(() => {
    if (filas.get(pasta) === fim) filas.delete(pasta)
  })
  return resultado
}

function soOQueATelaLe({ condicoes, existe, aviso, podeGravar }: Leitura): CondicoesLidas {
  return { condicoes, existe, aviso, podeGravar }
}

/** Lê a lista da pasta. Nunca lança: o erro vira `aviso`, e `podeGravar: false` barra quem grava. */
export function lerCondicoesDaPasta(pasta: string): Promise<CondicoesLidas> {
  return naFila(pasta, async () => soOQueATelaLe(await lerAgora(pasta)))
}

/**
 * Lê, muda e grava a lista numa ida só. `mudar` recebe o que está no disco
 * agora (e se o arquivo já existia) e devolve a lista nova, ou `null` para
 * deixar como está — aí nada é gravado. Devolve o que ficou no disco. Lança
 * com a frase pronta quando o disco recusa, e quando há um arquivo que não foi
 * lido (gravar por cima dele apagaria a lista de verdade).
 */
export function mudarCondicoesDaPasta(
  pasta: string,
  mudar: (condicoes: readonly CondicaoPropria[], existe: boolean) => readonly CondicaoPropria[] | null,
): Promise<CondicoesLidas> {
  return naFila(pasta, async () => {
    const lidas = await lerAgora(pasta)
    if (!lidas.podeGravar) throw new Error(lidas.aviso ?? `${NAO_LEU}.`)
    const novas = mudar(lidas.condicoes, lidas.existe)
    if (novas === null) return soOQueATelaLe(lidas)
    try {
      await ensureDir(pasta)
      const caminho = await join(pasta, ARQUIVO_DAS_CONDICOES)
      // Cópia do de antes: melhor esforço, e só do arquivo que abriu — o danificado não passa por cima da cópia boa.
      if (lidas.principalLegivel) {
        try {
          await writeTextFile(`${caminho}${SUFIXO_ANTERIOR}`, await readTextFile(caminho))
        } catch {
          // Sem cópia desta vez; a gravação segura logo abaixo continua valendo.
        }
      }
      await writeTextFileSafely(caminho, serializarCondicoes(novas))
    } catch (erro) {
      throw new Error(`Não foi possível gravar a lista de condições na pasta: ${motivo(erro)}.`)
    }
    return { condicoes: [...novas], existe: true, aviso: lidas.aviso, podeGravar: true }
  })
}
