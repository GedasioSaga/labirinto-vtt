import { create } from 'zustand'
import { avisarCamadaTravada } from '../lib/avisoCamadaTravada'
import { camadaTravadaDoItem } from '../lib/camadas/trava'
import { comFalas, FALAS_MAX, falasDoPino, idDeFalaNova, novaFala } from '../lib/falasDoPino'
import type { FalaDoPino } from '../types/cenarioEFalas'
import { estrelaDeItem, formaAoSoltar, ladoNoChao, pinoDeItem } from '../lib/itemNoMapa'
import { pinoDoLugar } from '../lib/preparo/pinoDoLugar'
import { snapPointForTarget } from '../pixi/tokenInteraction'
import type { FonteNoPreludio, Pin, PinItem, PinKind, Prop } from '../types/map'
import type { DrawingTool } from '../types/tools'
import { criarToken } from './criarToken'
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

/**
 * O VERBETE INTEIRO no mapa (E3, 16/11): já preparado pela mesa
 * (`preludio/janela/verbeteNaMesa.ts`), espera só o clique.
 * - `token`: o Personagem, ligado à ficha de NPC (`characterId`) ou sem ficha.
 * - `item`: o pino de item pegável com o item do Acervo (criado ou o de mesmo nome);
 *   sem imagem, a estrela brilhando no chão (`estrelaDaColocacao`).
 * - `lugar`: o "!" com o texto do verbete e a imagem que pode ir ao jogador.
 */
export type CoisaDoVerbete =
  | { readonly o: 'token'; readonly characterId: string | null; readonly npc: boolean; readonly foto: string | null }
  | { readonly o: 'item'; readonly item: PinItem; readonly novoNoAcervo: boolean }
  | { readonly o: 'lugar'; readonly texto: string; readonly imagem: string | null }

export interface ColocacaoDoVerbete {
  readonly pedido: number
  /** A ferramenta Pino fica na mão com o "!" (o clique é o mesmo); o que nasce sai de `coisa`. */
  readonly kind: 'exclamacao'
  /** O nome do verbete: o do token, o do "!" ou o do item. */
  readonly nome: string
  readonly coisa: CoisaDoVerbete
}

export type ColocacaoDoPreludio = ColocacaoDaSecao | ColocacaoDoVerbete

/** É o verbete inteiro (E3), e não uma seção (P3/P5). */
export function ehDoVerbete(colocacao: ColocacaoDoPreludio): colocacao is ColocacaoDoVerbete {
  return 'coisa' in colocacao
}

export interface ColocacaoDaSecao {
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
function falaDaColocacao(pendente: ColocacaoDaSecao): FalaDoPino {
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
  if (ehDoVerbete(pendente)) {
    const { coisa } = pendente
    // O token não é pino: nasce no `cravarPinoPeloGesto` (`porTokenDaColocacao`), e o pino volta igual.
    if (coisa.o === 'token') return pin
    if (coisa.o === 'item') {
      const deItem = pinoDeItem(pin.id, { x: pin.x, y: pin.y }, coisa.item)
      return pin.piso === undefined ? deItem : { ...deItem, piso: pin.piso }
    }
    return pinoDoLugar(pin, { nome: pendente.nome, texto: coisa.texto, imagem: coisa.imagem })
  }
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
  if (pendente === null || ehDoVerbete(pendente) || pendente.kind !== 'interrogacao' || pin.kind !== 'interrogacao') return false
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

/**
 * A ESTRELA DO ITEM (17/11/2026): o pino de item que a colocação de um item
 * SEM IMAGEM acabou de montar (`pinoDaColocacao`, com o MESMO item) nasce como
 * a estrela brilhando no chão, como o soltar do Acervo (`formaAoSoltar`), no
 * lugar e no piso do clique. `null` = não é o caso, e o pino segue o de sempre:
 * outro pino, item com imagem, ou o item solto do Acervo com Alt no meio da espera.
 */
export function estrelaDaColocacao(pin: Pin): Prop | null {
  const pendente = useColocacaoDoPreludio.getState().pendente
  if (pendente === null || !ehDoVerbete(pendente) || pendente.coisa.o !== 'item') return null
  const { item } = pendente.coisa
  if (pin.item !== item || formaAoSoltar(item, false) !== 'estrela') return null
  const estrela = estrelaDeItem(pin.id, { x: pin.x, y: pin.y }, ladoNoChao(useMapStore.getState().map.grid), item)
  return pin.piso === undefined ? estrela : { ...estrela, piso: pin.piso }
}

/**
 * O TOKEN DO PERSONAGEM (E3): com um token esperando, o clique da ferramenta
 * Pino (que chega aqui pelo `cravarPinoPeloGesto`) põe o token na casa do
 * clique, ligado à ficha de NPC, por `criarToken`: um passo do Ctrl+Z, e ele
 * nasce selecionado. Devolve `false` quando não há token esperando (o pino
 * segue o de sempre). O pino de item que o Acervo solta nunca chega aqui
 * (`pin.item`): soltar um item com um token esperando continua pondo o item.
 */
export function porTokenDaColocacao(pin: Pin): boolean {
  const pendente = useColocacaoDoPreludio.getState().pendente
  if (pendente === null || !ehDoVerbete(pendente) || pendente.coisa.o !== 'token' || pin.item !== undefined) return false
  const { coisa } = pendente
  const { map, pisoAtivo } = useMapStore.getState()
  const at = snapPointForTarget('token', map.gridShape, pin.x, pin.y, map.grid)
  const id = criarToken(pendente.nome.trim() || 'Personagem', { at, imageData: coisa.foto, npc: coisa.npc, piso: pisoAtivo, ...(coisa.characterId === null ? {} : { characterId: coisa.characterId }) }, null)
  if (id === null) return true
  terminarColocacao('posto')
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
