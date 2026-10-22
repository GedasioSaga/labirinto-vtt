import type { Point } from '../../pixi/world'
import type { Wall } from '../../types/map'
import { segmentsIntersect, wallBlocksToken } from '../collision'
import { AgendaDeCaminhos, CacheDeMalhas, type OpcoesDaAgenda } from './agenda'
import { type AcaoNaPorta, type FimDoTrecho, novoAndarilho, type Situacao, tiqueDoAndarilho } from './andarilho'
import { acharCaminhoNaMalha, type ConsultaDeCaminho, type FichaNoCaminho, type ResultadoDoCaminho, TOLERANCIA_ENTRE_FICHAS } from './busca'
import { distanciaAoTraco, type Malha, type MapaDoCaminho } from './malha'
import { avancarMalha } from './marcos'

/**
 * SIMULAÇÃO DE UM TRECHO — o mundo dos testes do andarilho e do robô: um
 * tique a cada 200 ms (o da rotina), a resposta ao pedido de caminho no tique
 * seguinte (ou `atrasoDaResposta` tiques depois, ou pela agenda de verdade, em
 * fatias), as portas abertas e fechadas como o editor faria, e cada passo
 * conferido (não cruza parede nem porta fechada, não encosta em ficha, não
 * abre porta trancada). Só teste importa este arquivo.
 */

export const TIQUE_MS = 200
/** A consulta é determinística: o menor de algumas medidas é o custo dela, sem o ruído de outros testes disputando a máquina. */
const MEDIDAS_POR_CONSULTA = 3
const ID_DO_NPC = 'npc'
/** Duas casas por segundo: o passo da rotina (`lib/rotinaAndando.ts`). */
export function passoDaRotina(grid: number): number {
  return (grid * 2 * TIQUE_MS) / 1000
}

export interface Trecho {
  mapa: MapaDoCaminho
  de: Point
  para: Point
  raio: number
  /** As outras fichas em cada tique (paradas, ou um intruso que aparece), sabendo onde o NPC está. */
  fichas?: (tique: number, aqui: Point) => readonly FichaNoCaminho[]
  /** O mundo mudando por fora (o mestre destranca a porta): paredes novas, ou `null`. */
  aoTique?: (tique: number, paredes: readonly Wall[]) => Wall[] | null
  maxTiques: number
  cache?: CacheDeMalhas
  /** Tiques do pedido até a resposta, que sai das paredes da hora do pedido. Padrão: 1, no tique seguinte. */
  atrasoDaResposta?: number
  /**
   * Responde pela agenda de verdade, com relógio falso: a malha NÃO vem pronta
   * (a agenda a monta em fatias, como no jogo) e a busca anda `fatiasPorTique`
   * fatias por tique. Ignora `cache` e `atrasoDaResposta`.
   */
  pelaAgenda?: OpcoesDaAgenda & { fatiasPorTique: number }
}

export interface ResultadoDoTrecho {
  /** `null`: não terminou em `maxTiques` — TRAVA. */
  fim: FimDoTrecho | null
  tiques: number
  acoes: { tique: number; acao: AcaoNaPorta }[]
  paredes: readonly Wall[]
  violacoes: string[]
  /** A primeira resposta da agenda (o caminho planejado na saída). */
  primeira: ResultadoDoCaminho | null
  /** Caminhos pedidos no trecho e o tempo da consulta mais lenta (só na resposta direta, sem agenda). */
  pedidos: number
  msDaConsultaMaisLenta: number
  /** Situação de cada tique, em ordem. */
  situacoes: Situacao[]
  /** Portas que o NPC abriu e que terminaram abertas. */
  deixouAbertas: string[]
  /** Onde o NPC terminou o trecho. */
  aqui: Point
  /** Os últimos tiques (situação, posição, próximo canto), para entender uma falha. */
  registro: string[]
}

const TIQUES_NO_REGISTRO = 12

function aplicar(paredes: readonly Wall[], acao: AcaoNaPorta, violacoes: string[], tique: number): Wall[] {
  return paredes.map((w) => {
    if (w.id !== acao.wallId || w.door === null) return w
    if (acao.tipo === 'abrir' && w.door.locked) violacoes.push(`t${tique}: abriu a porta trancada ${w.id}`)
    return { ...w, door: { ...w.door, open: acao.tipo === 'abrir' } }
  })
}

function conferirPasso(a: Point, b: Point, paredes: readonly Wall[], fichas: readonly FichaNoCaminho[], raio: number, grid: number, violacoes: string[], tique: number): void {
  if (a.x === b.x && a.y === b.y) return
  for (const w of paredes) {
    const barra = wallBlocksToken(w) || w.janela === true
    if (barra && segmentsIntersect(a, b, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })) violacoes.push(`t${tique}: cruzou ${w.id}`)
  }
  for (const f of fichas) {
    const alcance = raio + f.raio - grid * TOLERANCIA_ENTRE_FICHAS - 1e-6
    if (Math.hypot(f.x - a.x, f.y - a.y) < alcance) continue
    if (distanciaAoTraco(f.x, f.y, a.x, a.y, b.x, b.y) < alcance) violacoes.push(`t${tique}: encostou em ${f.id}`)
  }
}

/** A resposta e o menor tempo de `MEDIDAS_POR_CONSULTA` medidas dela. */
function consultarMedindo(malha: Malha, paredes: readonly Wall[], pedido: ConsultaDeCaminho): { resposta: ResultadoDoCaminho; ms: number } {
  let inicio = performance.now()
  const resposta = acharCaminhoNaMalha(malha, paredes, pedido)
  let ms = performance.now() - inicio
  for (let vez = 1; vez < MEDIDAS_POR_CONSULTA; vez += 1) {
    inicio = performance.now()
    acharCaminhoNaMalha(malha, paredes, pedido)
    ms = Math.min(ms, performance.now() - inicio)
  }
  return { resposta, ms }
}

/** Uma agenda de relógio falso: cada leitura anda 1 ms (cada fatia custa 1 ms), então `rodar(n)` dá n fatias. */
export function agendaDeFatias(opcoes: OpcoesDaAgenda): AgendaDeCaminhos {
  let ms = 0
  return new AgendaDeCaminhos(() => {
    ms += 1
    return ms
  }, opcoes)
}

export function simularTrecho(t: Trecho): ResultadoDoTrecho {
  const pelaAgenda = t.pelaAgenda === undefined ? null : { agenda: agendaDeFatias(t.pelaAgenda), fatias: t.pelaAgenda.fatiasPorTique }
  const cache = pelaAgenda?.agenda.cache ?? t.cache ?? new CacheDeMalhas()
  const atraso = Math.max(1, t.atrasoDaResposta ?? 1)
  const passo = passoDaRotina(t.mapa.grid)
  const violacoes: string[] = []
  const acoes: { tique: number; acao: AcaoNaPorta }[] = []
  const abertasPeloNpc = new Set<string>()
  const situacoes: Situacao[] = []
  let paredes: readonly Wall[] = t.mapa.walls
  let aqui = t.de
  let andarilho = novoAndarilho(t.para, t.de)
  let entrega: { resposta: ResultadoDoCaminho; noTique: number } | null = null
  let primeira: ResultadoDoCaminho | null = null
  let pedidos = 0
  let msDaConsultaMaisLenta = 0
  const resultado = (fim: FimDoTrecho | null, tiques: number): ResultadoDoTrecho => ({
    fim,
    tiques,
    acoes,
    paredes,
    violacoes,
    primeira,
    pedidos,
    msDaConsultaMaisLenta,
    situacoes,
    deixouAbertas: [...abertasPeloNpc].filter((id) => paredes.find((w) => w.id === id)?.door?.open === true),
    aqui,
    registro,
  })
  const registro: string[] = []
  for (let tique = 0; tique < t.maxTiques; tique += 1) {
    const mudou = t.aoTique?.(tique, paredes) ?? null
    if (mudou !== null) paredes = mudou
    const mapa = { ...t.mapa, walls: paredes }
    const malha = cache.malhaPara(mapa, t.raio)
    if (pelaAgenda === null) while (!avancarMalha(malha, Number.POSITIVE_INFINITY));
    const resposta = entrega !== null && entrega.noTique === tique ? entrega.resposta : undefined
    if (resposta !== undefined) entrega = null
    const fichas = t.fichas?.(tique, aqui) ?? []
    const tiqueDado = tiqueDoAndarilho(andarilho, { aqui, agora: tique * TIQUE_MS, passo, malha, paredes, fichas }, resposta)
    situacoes.push(tiqueDado.situacao)
    const alvo = andarilho.pontos?.[0]
    registro.push(`t${tique} ${tiqueDado.situacao} (${aqui.x.toFixed(1)},${aqui.y.toFixed(1)})->(${tiqueDado.para.x.toFixed(1)},${tiqueDado.para.y.toFixed(1)}) alvo=${alvo === undefined ? '-' : `${alvo.x},${alvo.y}`} resp=${resposta?.tipo ?? '-'}`)
    if (registro.length > TIQUES_NO_REGISTRO) registro.shift()
    conferirPasso(aqui, tiqueDado.para, paredes, fichas, t.raio, t.mapa.grid, violacoes, tique)
    aqui = tiqueDado.para
    andarilho = tiqueDado.andarilho
    for (const acao of tiqueDado.acoes) {
      acoes.push({ tique, acao })
      if (acao.tipo === 'abrir') abertasPeloNpc.add(acao.wallId)
      paredes = aplicar(paredes, acao, violacoes, tique)
    }
    if (tiqueDado.pedido !== null) pedidos += 1
    if (pelaAgenda !== null) {
      const { agenda, fatias } = pelaAgenda
      if (tiqueDado.pedido !== null) agenda.pedir(ID_DO_NPC, { ...t.mapa, walls: paredes }, t.raio, tiqueDado.pedido)
      agenda.rodar(fatias)
      const pronta = agenda.pegar(ID_DO_NPC)
      if (pronta !== undefined) entrega = { resposta: pronta, noTique: tique + 1 }
    } else if (tiqueDado.pedido !== null) {
      const { resposta: planejada, ms } = consultarMedindo(malha, paredes, tiqueDado.pedido)
      msDaConsultaMaisLenta = Math.max(msDaConsultaMaisLenta, ms)
      entrega = { resposta: planejada, noTique: tique + atraso }
    }
    if (entrega !== null) primeira ??= entrega.resposta
    if (andarilho.fim !== null) return resultado(andarilho.fim, tique + 1)
  }
  return resultado(null, t.maxTiques)
}
