import type { Point } from '../../pixi/world'
import type { Wall } from '../../types/map'
import { segmentsIntersect, wallBlocksToken } from '../collision'
import { CacheDeMalhas } from './agenda'
import { type AcaoNaPorta, type FimDoTrecho, novoAndarilho, tiqueDoAndarilho } from './andarilho'
import { acharCaminhoNaMalha, type FichaNoCaminho, type ResultadoDoCaminho, TOLERANCIA_ENTRE_FICHAS } from './busca'
import { distanciaAoTraco, type MapaDoCaminho } from './malha'
import { avancarMalha } from './marcos'

/**
 * SIMULAÇÃO DE UM TRECHO — o mundo dos testes do andarilho e do robô: um
 * tique a cada 200 ms (o da rotina), a agenda respondendo no tique seguinte
 * ao pedido, as portas abertas e fechadas como o editor faria, e cada passo
 * conferido (não cruza parede nem porta fechada, não encosta em ficha, não
 * abre porta trancada). Só teste importa este arquivo.
 */

export const TIQUE_MS = 200
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
  /** Caminhos pedidos no trecho e o tempo da consulta mais lenta. */
  pedidos: number
  msDaConsultaMaisLenta: number
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

export function simularTrecho(t: Trecho): ResultadoDoTrecho {
  const cache = t.cache ?? new CacheDeMalhas()
  const passo = passoDaRotina(t.mapa.grid)
  const violacoes: string[] = []
  const acoes: { tique: number; acao: AcaoNaPorta }[] = []
  const abertasPeloNpc = new Set<string>()
  let paredes: readonly Wall[] = t.mapa.walls
  let aqui = t.de
  let andarilho = novoAndarilho(t.para, t.de)
  let resposta: ResultadoDoCaminho | undefined
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
    while (!avancarMalha(malha, Number.POSITIVE_INFINITY));
    const fichas = t.fichas?.(tique, aqui) ?? []
    const tiqueDado = tiqueDoAndarilho(andarilho, { aqui, agora: tique * TIQUE_MS, passo, malha, paredes, fichas }, resposta)
    const alvo = andarilho.pontos?.[0]
    registro.push(`t${tique} ${tiqueDado.situacao} (${aqui.x.toFixed(1)},${aqui.y.toFixed(1)})->(${tiqueDado.para.x.toFixed(1)},${tiqueDado.para.y.toFixed(1)}) alvo=${alvo === undefined ? '-' : `${alvo.x},${alvo.y}`} resp=${resposta?.tipo ?? '-'}`)
    if (registro.length > TIQUES_NO_REGISTRO) registro.shift()
    resposta = undefined
    conferirPasso(aqui, tiqueDado.para, paredes, fichas, t.raio, t.mapa.grid, violacoes, tique)
    aqui = tiqueDado.para
    andarilho = tiqueDado.andarilho
    for (const acao of tiqueDado.acoes) {
      acoes.push({ tique, acao })
      if (acao.tipo === 'abrir') abertasPeloNpc.add(acao.wallId)
      paredes = aplicar(paredes, acao, violacoes, tique)
    }
    if (tiqueDado.pedido !== null) {
      pedidos += 1
      const inicio = performance.now()
      resposta = acharCaminhoNaMalha(malha, paredes, tiqueDado.pedido)
      msDaConsultaMaisLenta = Math.max(msDaConsultaMaisLenta, performance.now() - inicio)
      primeira ??= resposta
    }
    if (andarilho.fim !== null) return resultado(andarilho.fim, tique + 1)
  }
  return resultado(null, t.maxTiques)
}
