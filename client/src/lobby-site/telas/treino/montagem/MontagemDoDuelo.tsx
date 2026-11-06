import { useEffect, useMemo, useRef } from 'react'
import type { DueloNoFio } from '../../../../lib/treino/duelo'
import type { LadoDoTreino } from '../../../../lib/treino/mesaEmMemoria'
import type { FichaDoSite } from '../../../dados/sessaoDaCampanha'
import { useDoSite, useSite } from '../../contexto'
import { MontagemNaGrade } from './MontagemNaGrade'
import { ladoDaCasa, soAsQueExistem, type PecaDaMontagem, type PecaNaGrade } from './regrasDaMontagem'
import { alvosDaMontagem, fichasDaMontagem, proximaMontagem, regrasDoDuelo } from './regrasDoDuelo'

/**
 * A MONTAGEM POR ARRASTO NO DUELO (pendência da fatia J): a mesma lista e a
 * mesma grade do treino, com as regras do duelo (`regrasDoDuelo.ts`): só os
 * seus personagens, só na sua metade, cada um uma vez, na casa onde for solto.
 * A ordem das fichas vai no pedido (`fichasDoPedido`); a casa de cada uma vai
 * pela jogada `montar`: quem desafia ou aceita guarda a montagem
 * (`lembrarMontagemDoDuelo`) e, quando o duelo começa, a tela leva cada ficha
 * à casa escolhida enquanto ninguém agiu (`useMontagemNoServidor`).
 */

function pecasDoDuelo(minhas: readonly FichaDoSite[]): PecaDaMontagem[] {
  return minhas.map((ficha) => ({
    id: ficha.doc.id,
    nome: ficha.doc.nome,
    retrato: ficha.doc.retrato,
    selo: ficha.doc.tipo === 'npc' ? 'npc' : 'jogador',
    origem: 'minha',
    detalhe: 'seu personagem',
  }))
}

/** A montagem com que o desafio (ou o aceite) abre: o seu primeiro personagem na largada. */
export function montagemInicialDoDuelo(minhas: readonly FichaDoSite[], lado: LadoDoTreino): PecaNaGrade[] {
  const primeira = pecasDoDuelo(minhas)[0]
  if (primeira === undefined) return []
  const feito = regrasDoDuelo(lado, '').porSemArrasto([], primeira)
  return feito.ok ? feito.lista : []
}

/**
 * As fichas que vão ao servidor, na ordem da montagem: só as que ainda são
 * suas, estão na mesa (uma que saiu da mesa no meio seria recusada) e estão na
 * sua metade (o servidor recusa o `montar` na metade do outro).
 */
export function fichasDoPedido(lista: readonly PecaNaGrade[], minhas: readonly FichaDoSite[], lado: LadoDoTreino): { lista: PecaNaGrade[]; fichas: string[] } {
  const valida = soAsQueExistem(lista, pecasDoDuelo(minhas)).filter((peca) => ladoDaCasa(peca.casa) === lado)
  return { lista: valida, fichas: fichasDaMontagem(valida) }
}

/**
 * A montagem que saiu com o desafio (Lado A) ou com o aceite (Lado B), até o
 * duelo dela ficar montado. Recarregar a página a esquece: aí cada ficha fica
 * na casa de largada da Arena.
 */
const montagensQueSairam = new Map<LadoDoTreino, readonly PecaNaGrade[]>()

export function lembrarMontagemDoDuelo(lado: LadoDoTreino, lista: readonly PecaNaGrade[]): void {
  montagensQueSairam.set(lado, lista)
}

/**
 * Enquanto o duelo está na montagem, manda um `montar` por vez, sobre o `seq`
 * que a tela vê, até as minhas fichas estarem nas casas escolhidas. Uma
 * tentativa por `seq`: a recusa não repete sozinha, e a jogada do outro (um
 * `seq` novo) deixa tentar de novo. Montado, montagem fechada (alguém agiu) ou
 * montagem de outras fichas: a guardada some.
 */
export function useMontagemNoServidor(duelo: DueloNoFio | undefined, meuLado: LadoDoTreino | null, ocupado: boolean): void {
  const site = useSite()
  const tentadoEm = useRef<string | null>(null)
  useEffect(() => {
    if (duelo === undefined || meuLado === null) return
    const lista = montagensQueSairam.get(meuLado)
    if (lista === undefined) return
    const alvos = duelo.montagem && duelo.fim === null ? alvosDaMontagem(duelo.lutadores.vagas, lista, meuLado) : null
    const proxima = alvos === null ? null : proximaMontagem(duelo.posicoes, alvos, meuLado)
    if (proxima === null) {
      montagensQueSairam.delete(meuLado)
      return
    }
    const chave = `${duelo.id}#${duelo.seq}`
    if (ocupado || tentadoEm.current === chave) return
    if (site.duelo()?.jogar(duelo.id, { tipo: 'montar', seq: duelo.seq, tokenId: proxima.tokenId, col: proxima.casa.col, row: proxima.casa.row })) tentadoEm.current = chave
  }, [duelo, meuLado, ocupado, site])
}

export function MontagemDoDuelo({ minhas, lado, nomeDoOutro, lista, onMudar }: { minhas: readonly FichaDoSite[]; lado: LadoDoTreino; nomeDoOutro: string; lista: readonly PecaNaGrade[]; onMudar(lista: PecaNaGrade[]): void }) {
  const demo = useDoSite((site) => site.demo)
  const pecas = useMemo(() => pecasDoDuelo(minhas), [minhas])
  const regras = useMemo(() => regrasDoDuelo(lado, nomeDoOutro), [lado, nomeDoOutro])
  return <MontagemNaGrade pecas={pecas} lista={lista} onMudar={onMudar} demo={demo} regras={regras} />
}
