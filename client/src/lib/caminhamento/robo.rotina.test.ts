/**
 * O ROBÔ DO CAMINHAMENTO PELA ROTINA DE VERDADE — os mesmos 20 mapas, os
 * mesmos postos e o mesmo intruso do robô do motor (`robo.test.ts`), agora
 * andados pelo agendador da rotina (`lib/rotinaAndando.ts`): a ficha de NPC
 * no mapa, a rotina ligada, um tique de 200 ms, os passos e as portas
 * aplicados no mapa como o editor aplica, a espera de 2 s em cada posto.
 *
 * Metas (as da etapa anterior, escritas antes do código):
 * - 0 travas permanentes (trecho que não termina, em chegada ou desistência);
 * - 100% dos trechos com caminho (pelo oráculo independente) CHEGAM em no
 *   máximo 1,5 vez o tempo do ótimo (com intruso, o ótimo de quando ele
 *   apareceu); a espera no posto não conta, a espera dentro do trecho conta;
 * - trecho sem caminho termina em desistência com motivo, e o motivo fica no
 *   estado da rotina (`aviso`);
 * - nenhum passo cruza parede, janela ou porta fechada, encosta em ficha, abre
 *   porta trancada, nem anda mais que o passo do tique (sem teleporte);
 * - no fim de cada mapa, nenhuma porta que o NPC abriu ficou aberta;
 * - (22/10/2026) nenhum tique >= 50 ms (tarefa longa). O maior de 90 mil tiques
 *   medidos é ruído de quem divide a máquina (chegava a 42 ms com a suíte da
 *   área rodando): os `TIQUES_PARA_MEDIR_DE_NOVO` mais lentos são medidos de
 *   novo no fim, o menor de `MEDIDAS_DO_TIQUE` cada, com um motor imediato
 *   novo — a malha, montada de novo, conta junto: a medida nova nunca é mais
 *   barata que o trabalho do tique de verdade.
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../../pixi/world'
import type { MapData, Token } from '../../types/map'
import type { EstadoDoMundo } from '../estadoDoMundo'
import { createEmptyMap } from '../mapFactory'
import { darPassoDaRotina, ligarRotina, PASSO_DA_ROTINA_MS, passoEmPx, type RotinasAndando } from '../rotinaAndando'
import { moverNaCena } from '../rotinaDoNpc'
import { caminhoAgora } from './agenda'
import type { FichaNoCaminho } from './busca'
import { GRID } from './caminho.fixture'
import { escolherPostos, gerarMapaDoRobo, lugarDoIntruso, MAPAS_DO_ROBO, Oraculo, percentil, RAZAO_MAXIMA, TIQUE_DO_INTRUSO, TRECHOS_POR_MAPA } from './robo.fixture'
import { conferirPasso } from './simulacao.fixture'
import { comPortasDoNpc, motorImediato } from './tiqueDosNpcs'

const CENA = 'robo'
const NPC = 'npc'
const ESTADO = 'turno'
const SEM_CAMINHO_MAX_TIQUES = 400
const TAREFA_LONGA_MS = 50
const TIQUES_PARA_MEDIR_DE_NOVO = 5
const MEDIDAS_DO_TIQUE = 3

interface TiqueLento {
  ms: number
  /** O mesmo tique de novo, com um motor imediato novo: os ms dele. */
  deNovo: () => number
}

interface Numeros {
  trechos: number
  comCaminho: number
  chegaram: number
  travas: string[]
  naoChegaram: string[]
  semCaminho: number
  desistiramComMotivo: number
  motivos: Record<string, number>
  razoes: number[]
  lentos: string[]
  violacoes: string[]
  teleportes: string[]
  portasAbertasPeloNpc: number
  ficaramAbertas: string[]
  intrusos: number
  tiques: number
  msDoTiqueMaisLento: number
  /** Os `TIQUES_PARA_MEDIR_DE_NOVO` tiques mais lentos medidos, do mais lento ao menos. */
  maisLentos: TiqueLento[]
}

/** Guarda o tique entre os mais lentos, se ele for um deles. */
function guardarSeLento(lentos: TiqueLento[], tique: TiqueLento): void {
  const ultimo = lentos[lentos.length - 1]
  if (lentos.length >= TIQUES_PARA_MEDIR_DE_NOVO && ultimo !== undefined && tique.ms <= ultimo.ms) return
  lentos.push(tique)
  lentos.sort((a, b) => b.ms - a.ms)
  if (lentos.length > TIQUES_PARA_MEDIR_DE_NOVO) lentos.pop()
}

/** Os ms de `darPassoDaRotina` neste mundo, com um motor imediato novo. */
function medirTique(map: MapData, andando: RotinasAndando, estados: readonly EstadoDoMundo[], agora: number): number {
  const inicio = performance.now()
  darPassoDaRotina([{ sceneId: CENA, map }], andando, estados, agora, new Set(), motorImediato())
  return performance.now() - inicio
}

function ficha(id: string, p: Point, size: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: p.x, y: p.y, size, image: null, ...extra }
}

function ondeEsta(map: MapData): Point {
  const t = map.tokens.find((token) => token.id === NPC)
  if (t === undefined) throw new Error('o NPC sumiu do mapa')
  return { x: t.x, y: t.y }
}

/** As outras fichas, como o motor as vê (todas de uma casa no robô). */
function outrasFichas(map: MapData): FichaNoCaminho[] {
  return map.tokens.filter((t) => t.id !== NPC).map((t) => ({ id: t.id, x: t.x, y: t.y, raio: GRID / 2 }))
}

function rodarRobo(): Numeros {
  const n: Numeros = {
    trechos: 0,
    comCaminho: 0,
    chegaram: 0,
    travas: [],
    naoChegaram: [],
    semCaminho: 0,
    desistiramComMotivo: 0,
    motivos: {},
    razoes: [],
    lentos: [],
    violacoes: [],
    teleportes: [],
    portasAbertasPeloNpc: 0,
    ficaramAbertas: [],
    intrusos: 0,
    tiques: 0,
    msDoTiqueMaisLento: 0,
    maisLentos: [],
  }
  for (let s = 0; s < MAPAS_DO_ROBO; s += 1) {
    const semente = 1000 + s
    const tamanho = s % 4 === 3 ? 2 : 1
    const gerado = gerarMapaDoRobo(semente, GRID, s % 5 === 0, tamanho)
    const raio = (tamanho * GRID) / 2
    const oraculo = new Oraculo(gerado.mapa, raio)
    const postos = escolherPostos(semente + 77, gerado.salas, tamanho, oraculo, gerado.fichas, gerado.isolada, GRID)
    expect(postos.length, `mapa ${s}: postos`).toBeGreaterThanOrEqual(3)
    const valores = postos.map((_, i) => `p${i}`)
    const estados: EstadoDoMundo[] = [{ id: ESTADO, nome: 'Turno', valores, atual: valores[0] ?? '' }]
    const rotina = { estadoId: ESTADO, postos: postos.map((p, i) => ({ valor: valores[i] ?? '', sceneId: CENA, x: p.x, y: p.y })) }
    const inicio = postos[0] ?? { x: GRID / 2, y: GRID / 2 }
    const parados = gerado.fichas.map((f) => ficha(f.id, f, 1))
    let map: MapData = {
      ...createEmptyMap(CENA, CENA, gerado.mapa.width, gerado.mapa.height, GRID),
      walls: [...gerado.mapa.walls],
      tokens: [ficha(NPC, inicio, tamanho, { npc: true, rotina }), ...parados],
    }
    const motor = motorImediato()
    const passo = passoEmPx(GRID)
    const abertasPeloNpc = new Set<string>()
    let andando: RotinasAndando = ligarRotina(new Map(), [{ sceneId: CENA, map }], NPC, estados, 0)
    let agora = 0

    /** Um tique da rotina, aplicado como o editor aplica, com cada passo conferido. */
    const tique = (rotulo: string) => {
      const antes = ondeEsta(map)
      const [mapaDoTique, andandoDoTique, agoraDoTique] = [map, andando, agora]
      const inicioDoTique = performance.now()
      const r = darPassoDaRotina([{ sceneId: CENA, map }], andando, estados, agora, new Set(), motor)
      const msDoTique = performance.now() - inicioDoTique
      n.msDoTiqueMaisLento = Math.max(n.msDoTiqueMaisLento, msDoTique)
      guardarSeLento(n.maisLentos, { ms: msDoTique, deNovo: () => medirTique(mapaDoTique, andandoDoTique, estados, agoraDoTique) })
      n.tiques += 1
      const depois = moverNaCena(map, r.movimentos)
      const para = ondeEsta(depois)
      conferirPasso(antes, para, map.walls, outrasFichas(map), raio, GRID, n.violacoes, n.tiques)
      if (Math.hypot(para.x - antes.x, para.y - antes.y) > passo + 1e-9) n.teleportes.push(`${rotulo}: ${JSON.stringify(antes)} -> ${JSON.stringify(para)}`)
      for (const p of r.portas) {
        const porta = map.walls.find((w) => w.id === p.wallId)?.door
        if (p.aberta && porta?.locked === true) n.violacoes.push(`${rotulo}: abriu a porta trancada ${p.wallId}`)
        if (p.aberta) {
          n.portasAbertasPeloNpc += 1
          abertasPeloNpc.add(p.wallId)
        }
      }
      map = comPortasDoNpc(depois, r.portas)
      andando = r.andando
      agora += PASSO_DA_ROTINA_MS
    }

    for (let t = 0, feitos = 0; feitos < TRECHOS_POR_MAPA && t < 2 * TRECHOS_POR_MAPA; t += 1) {
      const antes = andando.get(NPC)
      if (antes === undefined) throw new Error(`mapa ${s}: a rotina desligou`)
      // A espera no posto (ou depois de desistir) não é do trecho: o relógio pula para o fim dela.
      agora = Math.max(agora, antes.esperaAte)
      const indice = antes.destino
      const destino = postos[indice] ?? inicio
      const aqui = ondeEsta(map)
      if (destino.x === aqui.x && destino.y === aqui.y) {
        tique(`mapa ${s} trecho ${t}`)
        continue
      }
      feitos += 1
      n.trechos += 1
      const fichasParadas = outrasFichas(map)
      // O intruso entra no meio do caminho que o NPC vai planejar (o motor é determinístico: é o mesmo).
      const consulta = { de: aqui, para: destino, fichas: fichasParadas }
      const planejado = t % 10 === 7 ? caminhoAgora(motor.agenda.cache, { walls: map.walls, grid: GRID, width: map.width, height: map.height }, raio, consulta) : null
      const intruso = planejado?.tipo === 'caminho' ? lugarDoIntruso(planejado.pontos, aqui, destino, GRID) : null
      const otimoNaSaida = oraculo.otimo(aqui, destino, fichasParadas)
      const maxTiques = otimoNaSaida === null ? SEM_CAMINHO_MAX_TIQUES : Math.ceil((4 * otimoNaSaida) / passo) + 150
      let otimoTiques: number | null = otimoNaSaida === null ? null : otimoNaSaida / passo
      let tiques = 0
      let fim: 'chegou' | 'desistiu' | null = null
      for (; tiques < maxTiques && fim === null; tiques += 1) {
        if (intruso !== null && tiques === TIQUE_DO_INTRUSO) {
          map = { ...map, tokens: [...map.tokens, ficha('intruso', intruso, 1)] }
          n.intrusos += 1
          const depois = oraculo.otimo(ondeEsta(map), destino, outrasFichas(map))
          otimoTiques = depois === null ? null : TIQUE_DO_INTRUSO + depois / passo
        }
        tique(`mapa ${s} trecho ${t} tique ${tiques}`)
        const agoraFicha = andando.get(NPC)
        if (agoraFicha !== undefined && agoraFicha.destino !== indice) fim = agoraFicha.andarilho?.fim?.tipo ?? 'chegou'
      }
      if (intruso !== null) map = { ...map, tokens: map.tokens.filter((t2) => t2.id !== 'intruso') }
      const rotulo = `mapa ${s} trecho ${t} ${JSON.stringify(aqui)}->${JSON.stringify(destino)}`
      if (fim === null) {
        n.travas.push(rotulo)
        break
      }
      if (otimoTiques === null) {
        n.semCaminho += 1
        const aviso = andando.get(NPC)?.aviso
        if (fim === 'desistiu' && aviso !== undefined && aviso.x === destino.x && aviso.y === destino.y) {
          n.desistiramComMotivo += 1
          n.motivos[aviso.motivo] = (n.motivos[aviso.motivo] ?? 0) + 1
        }
        continue
      }
      n.comCaminho += 1
      if (fim !== 'chegou') {
        n.naoChegaram.push(`${rotulo}: ${JSON.stringify(andando.get(NPC)?.aviso)}`)
        continue
      }
      n.chegaram += 1
      const razao = tiques / Math.max(1, otimoTiques)
      n.razoes.push(razao)
      if (razao > RAZAO_MAXIMA) n.lentos.push(`${rotulo} razao ${razao.toFixed(2)} tiques ${tiques} otimo ${otimoTiques.toFixed(1)} intruso ${intruso !== null}`)
    }
    for (const id of abertasPeloNpc) if (map.walls.find((w) => w.id === id)?.door?.open === true) n.ficaramAbertas.push(`mapa ${s}: ${id}`)
  }
  return n
}

describe('robô do caminhamento pela rotina andando', () => {
  it('20 mapas, 1000 trechos pela rotina real: sem trava, todos chegam em até 1,5x o ótimo, sem teleporte, sem caminho desiste com motivo', () => {
    const n = rodarRobo()
    const medidosDeNovo = n.maisLentos.map((lento) => Math.min(...Array.from({ length: MEDIDAS_DO_TIQUE }, () => lento.deNovo())))
    const resumo = {
      trechos: n.trechos,
      comCaminho: n.comCaminho,
      chegaram: n.chegaram,
      travas: n.travas.length,
      naoChegaram: n.naoChegaram.length,
      semCaminho: n.semCaminho,
      desistiramComMotivo: n.desistiramComMotivo,
      motivos: n.motivos,
      intrusos: n.intrusos,
      razaoP50: Number(percentil(n.razoes, 50).toFixed(3)),
      razaoP95: Number(percentil(n.razoes, 95).toFixed(3)),
      razaoMax: Number(Math.max(0, ...n.razoes).toFixed(3)),
      dentroDe1_5: n.razoes.filter((r) => r <= RAZAO_MAXIMA).length,
      violacoes: n.violacoes.length,
      teleportes: n.teleportes.length,
      portasAbertasPeloNpc: n.portasAbertasPeloNpc,
      portasQueFicaramAbertas: n.ficaramAbertas.length,
      tiques: n.tiques,
      msDoTiqueMaisLentoMedido: Number(n.msDoTiqueMaisLento.toFixed(2)),
      msDoTiqueMaisLento: Number(Math.max(0, ...medidosDeNovo).toFixed(2)),
    }
    console.log(`ROBO-ROTINA ${JSON.stringify(resumo)}`)
    if (n.travas.length > 0) console.log(`ROBO-ROTINA travas ${n.travas.slice(0, 3).join(' | ')}`)
    if (n.naoChegaram.length > 0) console.log(`ROBO-ROTINA naoChegaram ${n.naoChegaram.slice(0, 3).join(' | ')}`)
    if (n.violacoes.length > 0) console.log(`ROBO-ROTINA violacoes ${n.violacoes.slice(0, 10).join(' | ')}`)
    if (n.teleportes.length > 0) console.log(`ROBO-ROTINA teleportes ${n.teleportes.slice(0, 5).join(' | ')}`)
    if (n.lentos.length > 0) console.log(`ROBO-ROTINA lentos ${n.lentos.length}: ${n.lentos.slice(0, 4).join(' | ')}`)
    expect(n.trechos).toBeGreaterThanOrEqual(MAPAS_DO_ROBO * TRECHOS_POR_MAPA - 10)
    expect(n.travas).toEqual([])
    expect(n.naoChegaram).toEqual([])
    expect(resumo.dentroDe1_5).toBe(n.comCaminho)
    expect(resumo.razaoMax).toBeLessThanOrEqual(RAZAO_MAXIMA)
    expect(n.desistiramComMotivo).toBe(n.semCaminho)
    expect(n.semCaminho).toBeGreaterThan(0)
    expect(n.intrusos).toBeGreaterThan(0)
    expect(n.violacoes).toEqual([])
    expect(n.teleportes).toEqual([])
    expect(n.ficaramAbertas).toEqual([])
    expect(n.portasAbertasPeloNpc).toBeGreaterThan(0)
    expect(medidosDeNovo).toHaveLength(TIQUES_PARA_MEDIR_DE_NOVO)
    expect(resumo.msDoTiqueMaisLento).toBeLessThan(TAREFA_LONGA_MS)
  }, 300_000)
})
