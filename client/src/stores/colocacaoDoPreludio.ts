import { create } from 'zustand'
import type { FonteNoPreludio, Pin, PinKind } from '../types/map'
import type { DrawingTool } from '../types/tools'
import { useMapStore } from './mapStore'

/**
 * "PÔR NO MAPA" PELO PRELÚDIO (P3 do estudo de 15/11): a seção que o mestre
 * escolheu na janela do Prelúdio espera aqui o clique dele no mapa. Enquanto
 * espera, a ferramenta Pino fica na mão, com o tipo pedido ("!" ou "?"); o
 * clique crava o pino já ligado (`pinoDaColocacao`, chamado pelo
 * `PixiCanvas`), e a ferramenta de antes volta. Trocar de ferramenta, Esc ou
 * "Cancelar" desistem. Pequeno de propósito: mora no pacote principal, e quem
 * fala com a janela do Prelúdio (`preludio/janela/mesaDoPreludio.ts`) só
 * baixa quando ela abre.
 */

export interface ColocacaoDoPreludio {
  /** O número do pedido da janela do Prelúdio: a resposta leva o mesmo. */
  readonly pedido: number
  readonly fonte: FonteNoPreludio
  readonly kind: Extract<PinKind, 'exclamacao' | 'interrogacao'>
  /** O texto da seção, já limpo (`lib/preparo/pinoLigado.ts`): a primeira cópia de reserva. */
  readonly texto: string
  /** O "Nome do local" que o pino nasce com (o nome do verbete). */
  readonly nome: string
}

export type FimDaColocacao = 'posto' | 'cancelado'

interface EstadoDaColocacao {
  pendente: ColocacaoDoPreludio | null
}

export const useColocacaoDoPreludio = create<EstadoDaColocacao>()(() => ({ pendente: null }))

let aoTerminar: ((pedido: number, fim: FimDaColocacao) => void) | null = null
/** A ferramenta e o tipo de pino de antes, que voltam quando a colocação acaba. */
let antes: { tool: DrawingTool; pinKind: PinKind } | null = null
let pararDeVigiar: (() => void) | null = null

/** Quem conta à janela do Prelúdio que o pino nasceu ou que o mestre desistiu. */
export function definirFimDaColocacao(funcao: ((pedido: number, fim: FimDaColocacao) => void) | null): void {
  aoTerminar = funcao
}

export function terminarColocacao(fim: FimDaColocacao): void {
  const pendente = useColocacaoDoPreludio.getState().pendente
  if (pendente === null) return
  // Primeiro sai de "pendente": a troca de ferramenta abaixo não pode contar como desistência.
  useColocacaoDoPreludio.setState({ pendente: null })
  pararDeVigiar?.()
  pararDeVigiar = null
  const voltar = antes
  antes = null
  if (voltar !== null) {
    const mapa = useMapStore.getState()
    mapa.setPinKind(voltar.pinKind)
    if (mapa.activeTool === 'pin') mapa.setActiveTool(voltar.tool)
  }
  aoTerminar?.(pendente.pedido, fim)
}

/** Começa a esperar o clique. Uma colocação de cada vez: a anterior conta como desistência. */
export function comecarColocacao(colocacao: ColocacaoDoPreludio): void {
  terminarColocacao('cancelado')
  const mapa = useMapStore.getState()
  antes = { tool: mapa.activeTool === 'pin' ? 'select' : mapa.activeTool, pinKind: mapa.pinKind }
  mapa.setPinKind(colocacao.kind)
  mapa.setActiveTool('pin')
  useColocacaoDoPreludio.setState({ pendente: colocacao })
  // Trocou de ferramenta (barra, atalho, Esc que volta ao Selecionar): desistiu.
  pararDeVigiar = useMapStore.subscribe((estado, anterior) => {
    if (estado.activeTool !== anterior.activeTool && estado.activeTool !== 'pin') terminarColocacao('cancelado')
  })
}

/** O pino que o clique da ferramenta Pino vai cravar: com a colocação pendente, já ligado ao Prelúdio. */
export function pinoDaColocacao(pin: Pin): Pin {
  const pendente = useColocacaoDoPreludio.getState().pendente
  if (pendente === null) return pin
  const ligado: Pin = { ...pin, kind: pendente.kind, description: pendente.texto, fonte: pendente.fonte }
  return pendente.nome === '' ? ligado : { ...ligado, nome: pendente.nome }
}

// ─── A situação dos pinos ligados (para a ficha do pino) ─────────────────────

/** `ok` = o texto segue a seção; `segredo` = virou segredo (o jogador lê "Texto indisponível."); `sumiu` = verbete ou seção apagados (fica a cópia). */
export type SituacaoDoPinoLigado = 'ok' | 'segredo' | 'sumiu'

interface EstadoDosPinosLigados {
  /** O Prelúdio foi lido nesta janela: sem isso, o jogador lê a cópia de reserva. */
  lido: boolean
  /** Por id de pino da cena aberta. */
  porPino: ReadonlyMap<string, SituacaoDoPinoLigado>
}

/**
 * Quem mantém os pinos ligados em dia (`preludio/mesa/pinosLigados.ts`, que só
 * baixa com o Prelúdio) conta aqui a situação de cada um; a ficha do pino, no
 * pacote principal, só lê.
 */
export const useSituacaoDosPinosLigados = create<EstadoDosPinosLigados>()(() => ({ lido: false, porPino: new Map() }))

export function contarSituacaoDosPinosLigados(lido: boolean, porPino: ReadonlyMap<string, SituacaoDoPinoLigado>): void {
  const atual = useSituacaoDosPinosLigados.getState()
  const igual = atual.lido === lido && atual.porPino.size === porPino.size && [...porPino].every(([id, situacao]) => atual.porPino.get(id) === situacao)
  if (!igual) useSituacaoDosPinosLigados.setState({ lido, porPino })
}
