import type { CarriedItem } from '../../types/map'
import { quantidadeDe } from '../items'
import type { BalaNoPente, PenteDaVaga, RecargaDoItem } from '../itens/modelo'
import { balasParaOPente, ehRecusa, recarregarForaDaBatalha } from '../mochila/armaNaMochila'
import type { AcaoDaTecnica } from './combate'
import { lerAcao } from './leituraDaFicha'
import { ACERVO_DA_BATALHA } from './municoesDoAcervo'

/**
 * O PENTE NA BATALHA (docs/design/itens-rework/PLANO.md, etapa E6a; decisões 2, 3 e 11). Puras: a
 * mochila entra e sai; quem grava é a mesa (`stores/batalha/recargaDoPente.ts`).
 *
 * - O tiro da arma de pente tira 1 do pente, nunca da vaga da munição (as do pente não contam nela).
 * - Pente zerado: a mesa recarrega da mochila até onde der, com a mesma bala se ainda houver, senão a
 *   primeira que a arma aceita. A ação e a espera vêm do "Tipo" e do "Tempo de recarga" do item.
 * - No fim da batalha nada sai do pente (decisão 11): o pente mora na vaga, não na batalha.
 */

/** O tiro: a mochila com 1 a menos no pente, a bala que saiu e quantas ficaram. `null` = a arma não tem bala no pente. */
export interface TiroDoPente {
  mochila: CarriedItem[]
  balaId: string
  restam: number
  /** A cópia da bala que o pente levava (rodada 3): o Desfazer do último tiro a devolve junto. */
  daBala?: BalaNoPente
}

/** A regra e o nome da bala que o pente leva; nada copiado = `undefined`. */
function daBalaNoPente(pente: PenteDaVaga): BalaNoPente | undefined {
  if (pente.regra === undefined && pente.nome === undefined) return undefined
  return { ...(pente.regra === undefined ? {} : { regra: pente.regra }), ...(pente.nome === undefined ? {} : { nome: pente.nome }) }
}

/** A vaga sem o pente (vazio = sem o campo, como o leitor do disco o quer). */
function semPente(vaga: CarriedItem): CarriedItem {
  const { pente: _pente, ...resto } = vaga
  return resto
}

/** Tira 1 do pente da arma `armaVagaId`; o último tira o campo. */
export function mochilaComTiroDoPente(mochila: readonly CarriedItem[], armaVagaId: string): TiroDoPente | null {
  const arma = mochila.find((vaga) => vaga.id === armaVagaId)
  const pente = arma?.pente
  if (arma === undefined || pente === undefined || pente.n < 1) return null
  const restam = pente.n - 1
  // Rodada 3: a regra da bala fica no pente até a última (sem o Acervo, é dela que o tiro lê).
  const nova = restam < 1 ? semPente(arma) : { ...arma, pente: { ...pente, n: restam } }
  const daBala = daBalaNoPente(pente)
  return { mochila: mochila.map((vaga) => (vaga === arma ? nova : vaga)), balaId: pente.balaId, restam, ...(daBala === undefined ? {} : { daBala }) }
}

/**
 * O DESFAZER do tiro: `n` balas `balaId` voltam ao pente da arma, sobre a mochila de AGORA (o que mudou
 * depois fica). `null` = a arma saiu da mochila ou o pente tem outra bala agora (a troca já as devolveu).
 * `daBala` = a cópia da bala que o tiro levou (o último tiro tirou o pente inteiro, e a cópia junto).
 */
export function mochilaComBalasNoPente(mochila: readonly CarriedItem[], armaVagaId: string, balaId: string, n: number, daBala?: BalaNoPente): CarriedItem[] | null {
  const arma = mochila.find((vaga) => vaga.id === armaVagaId)
  if (arma === undefined || n < 1) return null
  const atual = arma.pente
  if (atual !== undefined && atual.balaId !== balaId) return null
  const pente: PenteDaVaga = { ...(atual ?? daBala ?? {}), balaId, n: (atual?.n ?? 0) + n }
  return mochila.map((vaga) => (vaga === arma ? { ...vaga, pente } : vaga))
}

/** A recarga feita: a mochila nova, quantas entraram, que bala e quantas dela a mochila tinha antes e tem depois. */
export interface RecargaFeita {
  mochila: CarriedItem[]
  entraram: number
  balaId: string
  nome: string
  antes: number
  depois: number
}

/** Quantas balas `balaId` a mochila tem (as vagas dela; as dos pentes não contam). */
function balasDe(mochila: readonly CarriedItem[], balaId: string): number {
  return mochila.reduce((soma, vaga) => soma + (vaga.itemId === balaId ? quantidadeDe(vaga) : 0), 0)
}

/**
 * Recarrega o pente da arma `armaVagaId` da mochila até onde der (decisão 3), com a bala `preferida`
 * se a mochila ainda a tem, senão a primeira que a arma aceita. `null` = nenhuma bala que sirva, ou o
 * pente já cheio. `novoId` = a vaga nova, se a bala de antes do pente precisar voltar (troca).
 */
export function recargaDoPente(mochila: readonly CarriedItem[], armaVagaId: string, preferida: string | undefined, novoId: string): RecargaFeita | null {
  const opcoes = balasParaOPente(mochila, armaVagaId, ACERVO_DA_BATALHA).filter((vaga) => quantidadeDe(vaga) > 0)
  const bala = opcoes.find((vaga) => vaga.itemId === preferida) ?? opcoes[0]
  const balaId = bala?.itemId
  if (bala === undefined || balaId === undefined) return null
  const antes = balasDe(mochila, balaId)
  const feita = recarregarForaDaBatalha(mochila, armaVagaId, bala.id, ACERVO_DA_BATALHA, novoId)
  if (ehRecusa(feita) || feita.entraram < 1) return null
  return { mochila: feita.mochila, entraram: feita.entraram, balaId, nome: bala.nome, antes, depois: balasDe(feita.mochila, balaId) }
}

/** A ação que a recarga gasta, lida do "Tipo de recarga" ("Ação Simples", "Ação Livre"); o texto torto = Simples. */
export function acaoDaRecarga(recarga: RecargaDoItem): AcaoDaTecnica {
  const lida = lerAcao(recarga.acao).acao
  return lida === null || lida === 'passiva' ? 'simples' : lida
}

/** "Ação Simples" gasta; "Ação Livre" não diz nada: o pedaço da frase da recarga. */
export function textoDoGastoDaRecarga(recarga: RecargaDoItem): string {
  return acaoDaRecarga(recarga) === 'livre' ? 'Ação Livre' : `gastou ${recarga.acao}`
}
