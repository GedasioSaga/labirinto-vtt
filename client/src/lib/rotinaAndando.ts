import type { PassoDaPatrulha, Periodo, PostoDaRotina, RotinaDoNpc, Token } from '../types/map'
import { TENTAR_DE_NOVO_MS } from './andarPeloCaminho'
import type { Andarilho } from './caminhamento/andarilho'
import { type AvisoDoNpc, avisoDepoisDeChegar, avisoDoFim, type MotorDosNpcs, motorImediato, type PortaDoNpc, TiqueDosNpcs } from './caminhamento/tiqueDosNpcs'
import { estaCongelada } from './congelar'
import type { EstadoDoMundo } from './estadoDoMundo'
import { type EfeitosDosPassos, type Execucao, executarPassos, segurada, soltarDoMestre, temEfeito } from './etapasDoNpc'
import { periodoDaCena } from './periodo'
import type { CenaDaRotina, MovimentoDaRotina } from './rotinaDoNpc'

/**
 * ROTINA ANDANDO — a rotina do NPC vira macro: ligada, a ficha anda sozinha
 * de posto em posto, um passo curto a cada tique, faz as ETAPAS do posto
 * (esperar, falar, olhar... — os passos da patrulha; sem etapas, espera 2 s)
 * e segue para o próximo; depois do último, volta ao primeiro. Até o mestre
 * desligar.
 *
 * O APITO (Caminhos F4) também passa por aqui: trocar o estado do mundo liga a
 * caminhada de cada ficha com posto no valor novo (`apitarRotina`) em vez de
 * levá-la de uma vez. Quem não andava vai até o posto, faz as etapas dele e
 * para; quem já andava sozinha vai ao posto do apito e segue o loop dali.
 *
 * Aqui só o agendador puro: quem anda, para onde e quando. Aplicar o passo é
 * do editor (`useRotinaAndandoStore`), com a mesma mecânica do apito: mudança
 * de mesa dentro da cena, `transferToken` entre cenas. O estado de quem está
 * andando vive só na memória do editor — não vai para o arquivo nem para o
 * jogador, que recebe apenas a ficha no lugar novo.
 */

/** Um tique a cada 200 ms: menor que o deslize do jogador (240 ms), que emenda um passo no outro. */
export const PASSO_DA_ROTINA_MS = 200
/** Duas casas por segundo: gente andando pelo mapa, sem correr. */
const CASAS_POR_SEGUNDO = 2
/** Parada em cada posto sem etapas antes de seguir para o próximo. */
export const ESPERA_NO_POSTO_MS = 2000
/** As etapas do posto de antes do campo (`PostoDaRotina.passos` ausente): esperar 2 s. */
const ETAPAS_PADRAO: readonly PassoDaPatrulha[] = [{ tipo: 'esperar', segundos: ESPERA_NO_POSTO_MS / 1000 }]

/** O que a ficha faz ao chegar ao posto: as etapas dele, ou esperar 2 s no posto sem lista. */
export function etapasDoPosto(posto: PostoDaRotina): readonly PassoDaPatrulha[] {
  return posto.passos ?? ETAPAS_PADRAO
}

/**
 * A caminhada que o APITO ligou: rumo ao posto de `valor`, esse posto e só ele
 * (mesmo fora do período: o apito é ordem do mestre, como o pulo).
 * `seguir`: ela já andava sozinha e, chegando, segue o loop; senão, para ao
 * terminar as etapas do posto e sai da rotina andando.
 */
export interface CaminhadaDoApito {
  valor: string
  seguir: boolean
}

/** A ficha com a rotina ligada. */
export interface FichaAndando {
  /** Índice, em `postosEmOrdem`, do posto para onde ela anda agora. */
  destino: number
  /** Parada no posto (ou depois de desistir de um): não anda antes deste instante. */
  esperaAte: number
  /**
   * O trecho rumo ao posto, no motor (`lib/caminhamento/andarilho.ts`); o do
   * posto anterior enquanto ela espera, com as portas que ficou de fechar.
   * Ausente: começar no próximo passo.
   */
  andarilho?: Andarilho
  /** Desistiu de um posto e por quê (porta trancada, ficha no caminho): para o mestre ver. */
  aviso?: AvisoDoNpc
  /** Fazendo as etapas do posto `posto` (índice em `postosEmOrdem`): a próxima a fazer é `passo`. Ausente: andando. */
  noPosto?: { posto: number; passo: number }
  /** Parada na etapa "Esperar o mestre": só sai com `seguirRotina`. */
  esperandoMestre?: true
  /** Etapa "Velocidade": casas/s só no trecho seguinte; ao chegar ao próximo posto, volta às 2 de sempre. */
  velocidadeDoTrecho?: number
  /** Ligada pelo apito: o posto de `valor` manda no destino até ela chegar. */
  apito?: CaminhadaDoApito
}

export { TENTAR_DE_NOVO_MS } from './andarPeloCaminho'

/** Fichas com a rotina ligada, por id. */
export type RotinasAndando = ReadonlyMap<string, FichaAndando>

/** Quanto a ficha anda num tique, em px de mundo, num mapa de célula `grid` (a patrulha passa a velocidade dela). */
export function passoEmPx(grid: number, casasPorSegundo: number = CASAS_POR_SEGUNDO): number {
  return (grid * casasPorSegundo * PASSO_DA_ROTINA_MS) / 1000
}

/** O nome do pedido de caminho da rotina de `tokenId` na agenda do motor (a patrulha usa outro). */
export function chaveDaRotina(tokenId: string): string {
  return `rotina:${tokenId}`
}

/** O motor de quem não passa um: cada caminho sai no mesmo tique. */
const MOTOR_IMEDIATO = motorImediato()

/**
 * Retomar depois da PAUSA GERAL dos NPCs: cada espera anda para a frente o
 * tempo que ficou pausado — quem estava parado no posto termina a parada, em
 * vez de sair correndo porque o relógio de parede seguiu; a espera do trecho
 * (porta trancada, ficha no caminho) também. Mesmo mapa quando não há o que
 * adiar. Serve à rotina e à patrulha.
 */
export function adiarEsperas<T extends { esperaAte: number; andarilho?: Andarilho }>(andando: ReadonlyMap<string, T>, ms: number): ReadonlyMap<string, T> {
  if (ms <= 0 || andando.size === 0) return andando
  return new Map(
    [...andando].map(([id, ficha]): [string, T] => {
      const { andarilho } = ficha
      const trecho = andarilho === undefined ? {} : { andarilho: { ...andarilho, esperaAte: andarilho.esperaAte + ms } }
      return [id, { ...ficha, esperaAte: ficha.esperaAte + ms, ...trecho }]
    }),
  )
}

/**
 * Os postos na ordem do loop: a ordem dos valores do estado (Aurora, Meio,
 * Brasa), não a ordem em que foram gravados. Estado que sumiu da aventura:
 * a ordem gravada.
 */
export function postosEmOrdem(rotina: RotinaDoNpc, estados: readonly EstadoDoMundo[]): PostoDaRotina[] {
  const valores = estados.find((estado) => estado.id === rotina.estadoId)?.valores
  if (valores === undefined) return rotina.postos
  const ordem = (posto: PostoDaRotina) => {
    const i = valores.indexOf(posto.valor)
    return i === -1 ? valores.length : i
  }
  return [...rotina.postos].sort((a, b) => ordem(a) - ordem(b))
}

function acharFicha(cenas: readonly CenaDaRotina[], tokenId: string): { cena: CenaDaRotina; token: Token } | null {
  for (const cena of cenas) {
    const token = cena.map.tokens.find((t) => t.id === tokenId)
    if (token !== undefined) return { cena, token }
  }
  return null
}

function estaNoPosto(sceneId: string, token: Token, posto: PostoDaRotina): boolean {
  return posto.sceneId === sceneId && posto.x === token.x && posto.y === token.y
}

/** ROTINA POR PERÍODO: o posto vale em `periodo` (posto sem período vale em todos). */
export function postoNoPeriodo(posto: PostoDaRotina, periodo: Periodo): boolean {
  return posto.periodo === undefined || posto.periodo === periodo
}

/**
 * Liga a rotina de `tokenId`: a ficha sai rumo ao posto seguinte ao que ela
 * ocupa (ou ao primeiro, se não está em nenhum). Ficha que não está em cena
 * carregada, ou sem posto, não liga.
 */
export function ligarRotina(andando: RotinasAndando, cenas: readonly CenaDaRotina[], tokenId: string, estados: readonly EstadoDoMundo[], now: number): RotinasAndando {
  const achada = acharFicha(cenas, tokenId)
  const rotina = achada?.token.rotina
  if (achada === null || rotina === undefined || rotina.postos.length === 0) return andando
  const postos = postosEmOrdem(rotina, estados)
  const aqui = postos.findIndex((posto) => estaNoPosto(achada.cena.sceneId, achada.token, posto))
  const next = new Map(andando)
  next.set(tokenId, { destino: (aqui + 1) % postos.length, esperaAte: now })
  return next
}

export function desligarRotina(andando: RotinasAndando, tokenId: string): RotinasAndando {
  if (!andando.has(tokenId)) return andando
  const next = new Map(andando)
  next.delete(tokenId)
  return next
}

/** "Seguir": a ficha parada na etapa "Esperar o mestre" faz o resto das etapas e segue. Quem não espera: o mesmo mapa. */
export function seguirRotina(andando: RotinasAndando, tokenId: string, now: number): RotinasAndando {
  return soltarDoMestre(andando, tokenId, now)
}

/**
 * O APITO: `movimentos` são os de `planejarRotina` para `valor` (quem tem
 * posto nele, fora do posto e solta da mão de jogador). Cada ficha passa a
 * andar rumo a esse posto a partir do próximo tique: nenhuma sai do lugar
 * aqui. A que já andava sozinha mira o posto do apito e, chegando, segue o
 * loop dali; a que estava parada anda até ele, faz as etapas e para. O apito
 * interrompe as etapas em curso (espera, "Esperar o mestre") e esquece o aviso
 * do posto antigo; o trecho fica, para ela fechar as portas que deixou
 * abertas. Mesmo mapa quando ninguém anda.
 */
export function apitarRotina(
  andando: RotinasAndando,
  cenas: readonly CenaDaRotina[],
  movimentos: readonly MovimentoDaRotina[],
  valor: string,
  estados: readonly EstadoDoMundo[],
  now: number,
): RotinasAndando {
  let next: Map<string, FichaAndando> | null = null
  for (const m of movimentos) {
    const rotina = acharFicha(cenas, m.tokenId)?.token.rotina
    const destino = rotina === undefined ? -1 : postosEmOrdem(rotina, estados).findIndex((posto) => posto.valor === valor)
    if (destino === -1) continue
    const antes = andando.get(m.tokenId)
    const seguir = antes !== undefined && (antes.apito === undefined || antes.apito.seguir)
    next ??= new Map(andando)
    next.set(m.tokenId, { destino, esperaAte: now, ...(antes?.andarilho === undefined ? {} : { andarilho: antes.andarilho }), apito: { valor, seguir } })
  }
  return next ?? andando
}

/**
 * Depois do "Pular para o posto": as fichas `ids` já caíram no posto. A que só
 * andava pelo apito sai da rotina andando; a que anda sozinha recomeça o loop
 * a partir do posto onde caiu (`ligarRotina`), sem o trecho velho.
 */
export function depoisDoPulo(andando: RotinasAndando, cenas: readonly CenaDaRotina[], ids: Iterable<string>, estados: readonly EstadoDoMundo[], now: number): RotinasAndando {
  let next = andando
  for (const id of ids) {
    const antes = next.get(id)
    if (antes === undefined) continue
    next = desligarRotina(next, id)
    if (antes.apito === undefined || antes.apito.seguir) next = ligarRotina(next, cenas, id, estados, now)
  }
  return next
}

/** O resultado de um tique da rotina: o que aplicar no mapa e o estado novo de quem anda. */
export interface TiqueDaRotina {
  movimentos: MovimentoDaRotina[]
  /** Portas que os NPCs abriram e fecharam, cena a cena (`comPortaDoNpc`), fora do Ctrl+Z como o passo. */
  portas: PortaDoNpc[]
  andando: RotinasAndando
}

/** A ficha mirando o posto seguinte, depois de chegar a este ou de desistir dele. */
function rumoAoSeguinte(destino: number, total: number, esperaAte: number, andarilho: Andarilho | undefined, aviso: AvisoDoNpc | undefined): FichaAndando {
  return { destino: (destino + 1) % total, esperaAte, ...(andarilho === undefined ? {} : { andarilho }), ...(aviso === undefined ? {} : { aviso }) }
}

/** O apito que só leva a ficha até o posto e para (ela não andava sozinha antes dele). */
function apitoQuePara(ficha: FichaAndando): boolean {
  return ficha.apito !== undefined && !ficha.apito.seguir
}

function semApito(ficha: FichaAndando): FichaAndando {
  const { apito: _apito, ...resto } = ficha
  return resto
}

/**
 * A ficha depois de um pedaço das etapas do posto `posto` (com `total`
 * etapas). `null`: a do apito que para acabou as etapas e sai da rotina
 * andando — a espera final dela não segura nada, então não conta.
 */
function depoisDasEtapas(ficha: FichaAndando, posto: number, total: number, ex: Execucao): FichaAndando | null {
  const parar = apitoQuePara(ficha)
  if (parar && ex.proximo === null && !ex.esperandoMestre) return null
  const { noPosto: _antes, esperandoMestre: _parou, velocidadeDoTrecho: _velocidade, ...resto } = ficha
  const velocidadeDoTrecho = ex.velocidade ?? ficha.velocidadeDoTrecho
  // A do apito guarda o posto até a última etapa: solta pelo "Seguir" no fim da lista, sai em vez de andar até ele de novo.
  const proximo = ex.proximo ?? (parar ? total : null)
  return {
    ...resto,
    esperaAte: ex.esperaAte,
    ...(proximo === null ? {} : { noPosto: { posto, passo: proximo } }),
    ...(ex.esperandoMestre ? { esperandoMestre: true as const } : {}),
    ...(velocidadeDoTrecho === undefined ? {} : { velocidadeDoTrecho }),
  }
}

/**
 * Chegou ao posto `passo` (de `total` postos) e começou as etapas dele (`ex`,
 * de `etapas` no total). A do apito que para fica nele até acabar as etapas;
 * as outras miram o posto seguinte, como no loop (o apito que segue acaba
 * aqui). A velocidade do trecho acaba com ele. `null` = saiu da rotina andando.
 */
function chegouAoPosto(
  ficha: FichaAndando,
  passo: number,
  total: number,
  andarilho: Andarilho | undefined,
  aviso: AvisoDoNpc | undefined,
  ex: Execucao,
  etapas: number,
  now: number,
): FichaAndando | null {
  const { apito } = ficha
  const base: FichaAndando =
    apito !== undefined && !apito.seguir
      ? { destino: passo, esperaAte: now, ...(andarilho === undefined ? {} : { andarilho }), ...(aviso === undefined ? {} : { aviso }), apito }
      : rumoAoSeguinte(passo, total, now, andarilho, aviso)
  return depoisDasEtapas(base, passo, etapas, ex)
}

/**
 * Um tique do relógio: o movimento de cada ficha com a rotina ligada.
 * - posto na mesma cena: um passo rumo a ele pelo motor de caminhos
 *   (`lib/caminhamento/`): contorna parede e as outras fichas (o jogador
 *   inclusive, que nunca é empurrado), abre a porta destrancada diante de si
 *   e a fecha atrás; nunca pula;
 * - sem caminho (porta trancada, ficha tapando, sala sem saída): espera e
 *   tenta de novo; sem jeito, DESISTE do posto com o motivo (`aviso`), espera
 *   `TENTAR_DE_NOVO_MS` e segue para o próximo — no loop seguinte tenta de novo;
 *   a caminhada do apito não desiste: espera e tenta o mesmo posto, com o aviso;
 * - posto noutra cena carregada: vai de uma vez para lá (`transferToken`),
 *   fechando antes a porta que deixou aberta nesta (com alguém no vão, fica);
 * - posto em cena fora do ar: fica de fora do loop, a ficha não some;
 * - ficha em `fixas` (um jogador segura), congelada pelo mestre, esperando ou
 *   à espera do mestre: não anda;
 * - ficha que sumiu ou perdeu a rotina: desliga.
 * Ao chegar ao posto, faz as ETAPAS dele (`etapasDoPosto`: sem lista, espera
 * `ESPERA_NO_POSTO_MS`) e mira o próximo; o que as etapas mudam na ficha
 * (frente, fala, oculta) vai no movimento, e a fala acaba quando ela volta a
 * andar.
 * ROTINA POR PERÍODO: só contam os postos do período da cena onde a ficha está
 * (`periodoDaCena` com a sessão em `sessao`; posto sem período conta sempre).
 * Na troca, o posto que deixou de valer sai do loop e ela mira o seguinte que
 * vale, andando pelo motor como em qualquer trecho; sem nenhum que valha, fica
 * onde está até o período mudar. O posto do apito vale em qualquer período.
 * `motor`: a agenda de caminhos do editor; sem ele, cada caminho sai no mesmo tique.
 */
export function darPassoDaRotina(
  cenas: readonly CenaDaRotina[],
  andando: RotinasAndando,
  estados: readonly EstadoDoMundo[],
  now: number,
  fixas: ReadonlySet<string> = new Set(),
  motor: MotorDosNpcs = MOTOR_IMEDIATO,
  sessao: Periodo | null = null,
): TiqueDaRotina {
  const movimentos: MovimentoDaRotina[] = []
  const next = new Map<string, FichaAndando>()
  const carregadas = new Set(cenas.map((cena) => cena.sceneId))
  const mundo = new TiqueDosNpcs(motor, now)
  for (const [tokenId, ficha] of andando) {
    const achada = acharFicha(cenas, tokenId)
    const rotina = achada?.token.rotina
    if (achada === null || rotina === undefined || rotina.postos.length === 0) {
      motor.agenda.cancelar(chaveDaRotina(tokenId))
      continue
    }
    if (fixas.has(tokenId) || estaCongelada(achada.token) || segurada(ficha, now)) {
      next.set(tokenId, ficha)
      continue
    }
    const { cena, token } = achada
    const aqui = { tokenId, de: cena.sceneId, para: cena.sceneId, x: token.x, y: token.y }
    const postos = postosEmOrdem(rotina, estados)
    let estado = ficha
    let efeitos: EfeitosDosPassos = {}

    // O resto das etapas do posto onde ela está.
    if (estado.noPosto !== undefined) {
      const { posto: i, passo: desde } = estado.noPosto
      const alvo = postos[i]
      const etapas = alvo === undefined ? [] : etapasDoPosto(alvo)
      const ex = executarPassos(etapas, desde, now)
      efeitos = ex.efeitos
      const depois = depoisDasEtapas(estado, i, etapas.length, ex)
      if ((depois === null || segurada(depois, now)) && temEfeito(efeitos)) movimentos.push({ ...aqui, ...efeitos })
      if (depois === null) {
        motor.agenda.cancelar(chaveDaRotina(tokenId))
        continue
      }
      if (segurada(depois, now)) {
        next.set(tokenId, depois)
        continue
      }
      estado = depois
    }

    // O posto do apito, enquanto ela não chega; senão o primeiro a partir do
    // destino que está numa cena carregada e vale no período da cena dela.
    let passo: number | undefined
    if (estado.apito !== undefined) {
      const { valor } = estado.apito
      const i = postos.findIndex((p) => p.valor === valor)
      if (i !== -1 && carregadas.has(postos[i].sceneId)) passo = i
      else if (apitoQuePara(estado)) {
        // O posto do apito sumiu (o mestre o tirou, a cena saiu do ar): ela fica onde está.
        if (temEfeito(efeitos)) movimentos.push({ ...aqui, ...efeitos })
        motor.agenda.cancelar(chaveDaRotina(tokenId))
        continue
      } else estado = semApito(estado)
    }
    const periodo = periodoDaCena(cena.map, sessao)
    const destino = estado.destino
    passo ??= postos.map((_, i) => (destino + i) % postos.length).find((i) => carregadas.has(postos[i].sceneId) && postoNoPeriodo(postos[i], periodo))
    if (passo === undefined) {
      if (temEfeito(efeitos)) movimentos.push({ ...aqui, ...efeitos })
      next.set(tokenId, estado)
      continue
    }
    const posto = postos[passo]
    const etapas = etapasDoPosto(posto)
    // Voltou a andar: a fala acaba (a das etapas novas vem depois e fica).
    const calar = token.fala !== undefined || efeitos.fala !== undefined

    if (posto.sceneId !== cena.sceneId) {
      // O trecho fica nesta cena: o que ele deixou aberto aqui fecha antes de ela ir.
      mundo.sair(chaveDaRotina(tokenId), cena.sceneId, cena.map, tokenId, estado.andarilho)
      // As etapas começam na chegada; o que mudam na ficha vai com ela pela travessia (`moverNaCena`).
      const ex = executarPassos(etapas, 0, now)
      efeitos = { ...efeitos, ...(calar ? { fala: null } : {}), ...ex.efeitos }
      movimentos.push({ tokenId, de: cena.sceneId, para: posto.sceneId, x: posto.x, y: posto.y, ...efeitos })
      const chegada = chegouAoPosto(estado, passo, postos.length, undefined, avisoDepoisDeChegar(estado.aviso, posto), ex, etapas.length, now)
      if (chegada !== null) next.set(tokenId, chegada)
      continue
    }

    const velocidade = estado.velocidadeDoTrecho ?? CASAS_POR_SEGUNDO
    const tique = mundo.andar(chaveDaRotina(tokenId), cena.sceneId, cena.map, tokenId, posto, estado.andarilho, passoEmPx(cena.map.grid, velocidade))
    if (tique === null) {
      if (temEfeito(efeitos)) movimentos.push({ ...aqui, ...efeitos })
      next.set(tokenId, estado)
      continue
    }
    const { para, andarilho } = tique
    const andou = para.x !== token.x || para.y !== token.y
    if (andou && calar) efeitos = { ...efeitos, fala: null }
    if (tique.situacao === 'chegou') {
      const ex = executarPassos(etapas, 0, now)
      efeitos = { ...efeitos, ...ex.efeitos }
      if (andou || temEfeito(efeitos)) movimentos.push({ ...aqui, x: para.x, y: para.y, ...efeitos })
      const chegada = chegouAoPosto(estado, passo, postos.length, andarilho, avisoDepoisDeChegar(estado.aviso, posto), ex, etapas.length, now)
      if (chegada === null) motor.agenda.cancelar(chaveDaRotina(tokenId))
      else next.set(tokenId, chegada)
      continue
    }
    if (andou || temEfeito(efeitos)) movimentos.push({ ...aqui, x: para.x, y: para.y, ...efeitos })
    if (tique.situacao === 'desistiu') {
      const aviso = avisoDoFim(andarilho.fim, posto, now) ?? estado.aviso
      // O apito insiste no posto dele (o mestre vê o aviso e destranca); o loop segue para o próximo.
      if (estado.apito !== undefined) next.set(tokenId, { ...estado, esperaAte: now + TENTAR_DE_NOVO_MS, andarilho, ...(aviso === undefined ? {} : { aviso }) })
      else next.set(tokenId, rumoAoSeguinte(passo, postos.length, now + TENTAR_DE_NOVO_MS, andarilho, aviso))
      continue
    }
    next.set(tokenId, { ...estado, destino: passo, andarilho })
  }
  return { movimentos, portas: mundo.portas, andando: next }
}
