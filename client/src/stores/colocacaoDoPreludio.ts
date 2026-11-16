import { create } from 'zustand'
import { avisarCamadaTravada } from '../lib/avisoCamadaTravada'
import { camadaTravadaDoItem } from '../lib/camadas/trava'
import { comFalas, FALAS_MAX, falasDoPino, idDeFalaNova, novaFala } from '../lib/falasDoPino'
import type { FalaDoPino } from '../types/cenarioEFalas'
import type { FonteNoPreludio, Pin, PinKind } from '../types/map'
import type { DrawingTool } from '../types/tools'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'

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
  /** No "?", o Personagem dono da seção (P5): a entrada nasce "Fala", dita por ele. Ausente = "Pista" sem dono. */
  readonly quem?: { readonly verbeteId: string; readonly nome: string }
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

/**
 * A entrada do "?" que a colocação vira (P5): oculta até o mestre dizer, com o
 * texto ligado à seção; da seção de um Personagem, "Fala" dita por ele.
 */
function falaDaColocacao(pendente: ColocacaoDoPreludio): FalaDoPino {
  const quem = pendente.quem
  if (quem === undefined) return novaFala(idDeFalaNova(), 'Pista', pendente.texto, { fonte: pendente.fonte })
  return novaFala(idDeFalaNova(), 'Fala', pendente.texto, { fonte: pendente.fonte, quem: quem.nome, quemVerbeteId: quem.verbeteId })
}

/**
 * O pino que o clique da ferramenta Pino vai cravar: com a colocação pendente,
 * já ligado ao Prelúdio. O "!" leva a seção no próprio pino (P3); o "?" nasce
 * com a seção como a primeira entrada, oculta (P5).
 */
export function pinoDaColocacao(pin: Pin): Pin {
  const pendente = useColocacaoDoPreludio.getState().pendente
  if (pendente === null) return pin
  const ligado: Pin =
    pendente.kind === 'interrogacao'
      ? { ...pin, kind: pendente.kind, description: '', falas: [falaDaColocacao(pendente)] }
      : { ...pin, kind: pendente.kind, description: pendente.texto, fonte: pendente.fonte }
  return pendente.nome === '' ? ligado : { ...ligado, nome: pendente.nome }
}

/**
 * A fala do Prelúdio clicada num "?" que JÁ existe (P5): junta-se a ele como
 * mais uma entrada oculta, em vez de nascer um "?" por cima; um "?" novo só
 * com o clique noutro lugar. Um passo do Ctrl+Z. Devolve `false` quando não é
 * o caso (nada esperando, colocação de "!", pino que não é "?"): o clique
 * segue o de sempre. Camada travada ou "?" cheio: o clique para aqui, com o
 * aviso, e a colocação continua esperando.
 */
export function juntarFalaDaColocacao(pin: Pin): boolean {
  const pendente = useColocacaoDoPreludio.getState().pendente
  if (pendente === null || pendente.kind !== 'interrogacao' || pin.kind !== 'interrogacao') return false
  const mapa = useMapStore.getState()
  const travada = camadaTravadaDoItem(mapa.map, 'pino', pin)
  if (travada !== null) {
    avisarCamadaTravada(travada)
    return true
  }
  const falas = falasDoPino(pin)
  if (falas.length >= FALAS_MAX) {
    useToastStore.getState().push('error', `Este ? já tem ${FALAS_MAX} entradas. Apague uma ou clique noutro lugar para um ? novo.`)
    return true
  }
  mapa.replacePins(mapa.map.pins.map((um) => (um.id === pin.id ? comFalas(um, [...falas, falaDaColocacao(pendente)]) : um)))
  // O clique num pino que já existe abre a ficha dele: a entrada nova aparece no fim da lista.
  mapa.setSelectedPin(pin.id)
  terminarColocacao('posto')
  const nome = pin.nome?.trim() ?? ''
  useToastStore.getState().push('info', `Fala juntada ao ? ${nome === '' ? 'existente' : nome}: fica oculta até você dizer.`)
  return true
}

// ─── A situação dos pinos ligados (para a ficha do pino) ─────────────────────

/** `ok` = o texto segue a seção; `segredo` = virou segredo (o jogador lê "Texto indisponível."); `sumiu` = verbete ou seção apagados (fica a cópia). */
export type SituacaoDoPinoLigado = 'ok' | 'segredo' | 'sumiu'

/** Um Personagem do Prelúdio que pode dizer uma entrada do "?" (P5): só o id e o nome, já limpo. */
export interface PersonagemQueDiz {
  readonly id: string
  readonly nome: string
}

interface EstadoDosPinosLigados {
  /** O Prelúdio foi lido nesta janela: sem isso, o jogador lê a cópia de reserva. */
  lido: boolean
  /** Por id de pino da cena aberta; a entrada ligada do "?", por `chaveDaFala(pinoId, falaId)` (P5). */
  porPino: ReadonlyMap<string, SituacaoDoPinoLigado>
  /** Os Personagens que podem dizer uma entrada do "?" (P5), por nome. Vazio até o Prelúdio ser lido. */
  personagens: readonly PersonagemQueDiz[]
}

/**
 * Quem mantém os pinos ligados em dia (`preludio/mesa/pinosLigados.ts`, que só
 * baixa com o Prelúdio) conta aqui a situação de cada um; a ficha do pino, no
 * pacote principal, só lê.
 */
export const useSituacaoDosPinosLigados = create<EstadoDosPinosLigados>()(() => ({ lido: false, porPino: new Map(), personagens: [] }))

function mesmosPersonagens(a: readonly PersonagemQueDiz[], b: readonly PersonagemQueDiz[]): boolean {
  return a.length === b.length && a.every((um, indice) => um.id === b[indice]?.id && um.nome === b[indice]?.nome)
}

export function contarSituacaoDosPinosLigados(lido: boolean, porPino: ReadonlyMap<string, SituacaoDoPinoLigado>, personagens: readonly PersonagemQueDiz[] = []): void {
  const atual = useSituacaoDosPinosLigados.getState()
  const igual =
    atual.lido === lido &&
    atual.porPino.size === porPino.size &&
    [...porPino].every(([id, situacao]) => atual.porPino.get(id) === situacao) &&
    mesmosPersonagens(atual.personagens, personagens)
  if (!igual) useSituacaoDosPinosLigados.setState({ lido, porPino, personagens })
}
