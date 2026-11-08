import { ehRegistro, proprio } from '../../lib/nuvem/json'
import type { Op } from '../../lib/nuvem/tipos'
import { personagensDoArquivo, type Personagem } from '../../lib/personagem'
import { mudancasDaPasta, opsDoLote, problemaNasOps } from './emissor'

/**
 * AS FICHAS MUDADAS NO DISCO COM O APP FECHADO (bug B1, docs/auditoria-fichas/vincent-g.md).
 * Puro.
 *
 * Numa pasta publicada, o `rpg.json` é acertado com a vista da nuvem ao abrir
 * (`acertarComAVista`): a vista vence, porque é por ela que chega o que o
 * jogador editou no site com o app fechado. Por isso, quem grava o `rpg.json`
 * por FORA do app (o conserto F0, `scripts/conserto-fichas-f0.cjs`) deixa
 * este arquivo na pasta da campanha (`nuvem/<campanhaId>/`) com a ficha de
 * ANTES da gravação. Ao abrir, o sincronizador compara a de antes com a do
 * `rpg.json` e põe a diferença na fila como mudança do mestre, ANTES do
 * acerto: a vista passa a ter a mudança (o acerto não a desfaz) e o ciclo a
 * manda ao Lobby. A base de cada op é a `revNoRpg` (a rev que o `rpg.json`
 * tinha): o que o site mudou no mesmo campo depois disso volta como conflito
 * em "Mudanças para decidir", nunca é passado por cima calado.
 *
 * O arquivo nunca é apagado: depois de lido, `feito` diz quando. O `loteId`
 * de cada ficha é gravado ANTES de a op entrar na fila: a queda no meio não
 * manda a mesma mudança duas vezes (a ficha cujo lote já está na fila é pulada).
 */

export const ARQUIVO_DAS_MUDADAS_NO_DISCO = 'mudadas-no-disco.json'

export interface FichaMudadaNoDisco {
  readonly id: string
  /** A ficha como estava no `rpg.json` antes da gravação de fora (crua, como no arquivo). */
  readonly antes: unknown
  readonly loteId?: string
}

export interface MudadasNoDisco {
  readonly versao: 1
  readonly id: string
  /** Quem gravou: "conserto-fichas-f0". */
  readonly origem: string
  readonly quando: number
  readonly fichas: readonly FichaMudadaNoDisco[]
  /** Quando o app pôs as mudanças na fila; ausente = ainda não. */
  readonly feito?: number
  /** As fichas que o Lobby recusou (nome: motivo), para quem conferir depois. */
  readonly recusadas?: readonly string[]
}

function fichaMudadaDoArquivo(valor: unknown): FichaMudadaNoDisco | null {
  if (!ehRegistro(valor)) return null
  const id = proprio(valor, 'id')
  const antes = proprio(valor, 'antes')
  const loteId = proprio(valor, 'loteId')
  if (typeof id !== 'string' || id.length === 0 || !ehRegistro(antes) || proprio(antes, 'id') !== id) return null
  if (loteId !== undefined && (typeof loteId !== 'string' || loteId.length === 0)) return null
  return loteId === undefined ? { id, antes } : { id, antes, loteId }
}

/** `null` = sem arquivo ou fora do formato (o app segue como sempre; nada é inventado). */
export function mudadasDoTexto(texto: string | null): MudadasNoDisco | null {
  if (texto === null) return null
  let valor: unknown
  try {
    valor = JSON.parse(texto)
  } catch {
    return null
  }
  if (!ehRegistro(valor) || proprio(valor, 'versao') !== 1) return null
  const id = proprio(valor, 'id')
  const origem = proprio(valor, 'origem')
  const quando = proprio(valor, 'quando')
  const fichas = proprio(valor, 'fichas')
  const feito = proprio(valor, 'feito')
  if (typeof id !== 'string' || typeof origem !== 'string' || typeof quando !== 'number' || !Array.isArray(fichas)) return null
  const lidas = fichas.map(fichaMudadaDoArquivo)
  if (lidas.some((ficha) => ficha === null)) return null
  const base = { versao: 1 as const, id, origem, quando, fichas: lidas.filter((ficha): ficha is FichaMudadaNoDisco => ficha !== null) }
  return typeof feito === 'number' ? { ...base, feito } : base
}

export function textoDasMudadas(mudadas: MudadasNoDisco): string {
  return JSON.stringify(mudadas, null, 2)
}

/** A ficha de antes lida pelo MESMO leitor do `rpg.json`: a diferença só vê o que mudou de fato, nunca a normalização. */
export function fichaDeAntes(mudada: FichaMudadaNoDisco): Personagem | null {
  return personagensDoArquivo([mudada.antes])?.find((ficha) => ficha.id === mudada.id) ?? null
}

export interface EnvelopeDasMudadas {
  clienteId: string
  quandoCliente: number
  baseRev: number
  loteId: string
}

export type OpsDaMudada = { ok: true; ops: Op[] } | { ok: false; problema: string }

/** As ops de antes → agora de uma ficha, como mudança do mestre, no lote dela. Vazio = nada mudou (ou a ficha não vai ao Lobby). */
export function opsDaMudadaNoDisco(antes: Personagem, agora: Personagem, envelope: EnvelopeDasMudadas, novoId: () => string): OpsDaMudada {
  const mudancas = mudancasDaPasta([antes], [agora])
  if (mudancas.length === 0) return { ok: true, ops: [] }
  const ops = opsDoLote(mudancas, { clienteId: envelope.clienteId, quandoCliente: envelope.quandoCliente }, () => envelope.baseRev, novoId).map((op) => ({ ...op, loteId: envelope.loteId }))
  const problema = problemaNasOps(ops)
  return problema === null ? { ok: true, ops } : { ok: false, problema }
}
