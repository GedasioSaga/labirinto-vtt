/**
 * ROBÔ DO "ANDAR ATÉ AQUI" (F1 de CAMINHOS, regra de teste de jogos: semente
 * fixa, metas com número escritas antes do código).
 *
 * 20 mapas do gerador do robô do motor (salas, corredores, portas fechadas,
 * abertas e trancadas, janelas, vãos, pilares tortos, fichas paradas) x 50
 * sementes de pedido em cada: a ficha numa sala, o destino em qualquer sala, e
 * o que o jogador conhece sorteado (salas lembradas, a visão da sala dele,
 * às vezes uma zona oculta do mestre).
 *
 * Metas:
 * - 0 trechos recusados por `validateTokenMove`, andando trecho a trecho como o host;
 * - 0 pontos (amostrados a cada 2 px) fora da área conhecida;
 * - todo "sem caminho" vem com motivo (`sem-caminho`, `porta-trancada`, `porta-fechada`);
 * - o robô não é vazio: pelo menos 30% dos pedidos acham caminho.
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../pixi/world'
import type { MapData, RegionPoint, Token } from '../types/map'
import { gerarMapaDoRobo, MAPAS_DO_ROBO, type Sala, sorteador, TRECHOS_POR_MAPA } from './caminhamento/robo.fixture'
import { createExploration, markRings } from './exploration'
import { caminhoConhecido, isPointKnown, type KnownArea } from './knownPath'
import { createEmptyMap } from './mapFactory'
import { validateTokenMove } from './moveValidation'

const GRID = 64
/** Distância entre as amostras do caminho na conferência da área conhecida, em px. */
const AMOSTRA_PX = 2
/** Fração mínima dos pedidos que acham caminho (o robô não pode passar por não andar). */
const MIN_COM_CAMINHO = 0.3
/** Chance de cada sala estar na memória do jogador. */
const CHANCE_DE_LEMBRAR = 0.9
/**
 * Chance de cada porta destrancada do gerador estar aberta: o jogador já passou
 * por ela. Fechada barra o passo dele (o host não abre porta no passo), e com
 * todas fechadas quase nenhum pedido teria caminho.
 */
const CHANCE_DE_ABERTA = 0.7
/** Chance de o mestre ter uma zona oculta ativa no pedido. */
const CHANCE_DE_OCULTA = 0.2

function anelDaSala(s: Sala): RegionPoint[] {
  return [
    { x: s.x0 * GRID, y: s.y0 * GRID },
    { x: s.x1 * GRID, y: s.y0 * GRID },
    { x: s.x1 * GRID, y: s.y1 * GRID },
    { x: s.x0 * GRID, y: s.y1 * GRID },
  ]
}

/** Um ponto dentro da sala, longe da parede dela: centro de casa com um desvio de até `desvio` casas. */
function pontoNaSala(s: Sala, sorte: () => number, desvio: number): Point {
  const cx = s.x0 + Math.floor(sorte() * (s.x1 - s.x0)) + 0.5
  const cy = s.y0 + Math.floor(sorte() * (s.y1 - s.y0)) + 0.5
  const dx = (sorte() * 2 - 1) * desvio
  const dy = (sorte() * 2 - 1) * desvio
  return { x: Math.round((cx + dx) * GRID), y: Math.round((cy + dy) * GRID) }
}

function amostras(de: Point, caminho: readonly Point[]): Point[] {
  const pontos: Point[] = []
  let a = de
  for (const b of caminho) {
    const passos = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / AMOSTRA_PX))
    for (let i = 0; i <= passos; i += 1) pontos.push({ x: a.x + ((b.x - a.x) * i) / passos, y: a.y + ((b.y - a.y) * i) / passos })
    a = b
  }
  return pontos
}

interface Numeros {
  pedidos: number
  comCaminho: number
  trechos: number
  recusados: string[]
  foraDoConhecido: string[]
  semMotivo: string[]
  motivos: Record<string, number>
}

function rodarRobo(): Numeros {
  const n: Numeros = { pedidos: 0, comCaminho: 0, trechos: 0, recusados: [], foraDoConhecido: [], semMotivo: [], motivos: {} }
  for (let s = 0; s < MAPAS_DO_ROBO; s += 1) {
    const semente = 1000 + s
    const gerado = gerarMapaDoRobo(semente, GRID, s % 5 === 0, 1)
    const sorteDasPortas = sorteador(semente + 31)
    const walls = gerado.mapa.walls.map((w) => (w.door !== null && !w.door.locked && sorteDasPortas() < CHANCE_DE_ABERTA ? { ...w, door: { ...w.door, open: true } } : w))
    const base: MapData = { ...createEmptyMap(`robo-${s}`, 'Robô', gerado.mapa.width, gerado.mapa.height, GRID), walls }
    const outras: Token[] = gerado.fichas.map((f) => ({ id: f.id, characterId: null, name: f.id, x: f.x, y: f.y, size: 1, image: null }))
    const salasLigadas = gerado.salas.filter((_, i) => i !== gerado.isolada)
    for (let k = 0; k < TRECHOS_POR_MAPA; k += 1) {
      const sorte = sorteador(semente * 1000 + k)
      const salaDaFicha = salasLigadas[Math.floor(sorte() * salasLigadas.length)]
      const salaDoDestino = gerado.salas[Math.floor(sorte() * gerado.salas.length)]
      if (salaDaFicha === undefined || salaDoDestino === undefined) continue
      const de = pontoNaSala(salaDaFicha, sorte, 0.2)
      const para = pontoNaSala(salaDoDestino, sorte, 0.4)
      const lembradas = gerado.salas.filter((sala) => sala === salaDaFicha || sorte() < CHANCE_DE_LEMBRAR).map(anelDaSala)
      // Em px de mundo, como o host monta a memória.
      const explored = createExploration({ width: base.width * GRID, height: base.height * GRID, grid: GRID })
      markRings(explored, lembradas)
      const oculta = sorte() < CHANCE_DE_OCULTA ? gerado.salas[Math.floor(sorte() * gerado.salas.length)] : undefined
      const area: KnownArea = { explored, vision: [anelDaSala(salaDaFicha)], concealed: oculta === undefined || oculta === salaDaFicha ? [] : [anelDaSala(oculta)] }
      const mapa: MapData = { ...base, tokens: [{ id: 'enzo', characterId: null, name: 'Enzo', x: de.x, y: de.y, size: 1, image: null }, ...outras] }
      n.pedidos += 1
      const r = caminhoConhecido(mapa, de, para, area)
      const rotulo = `mapa ${s} pedido ${k} ${JSON.stringify(de)}->${JSON.stringify(para)}`
      if (r.tipo === 'sem-caminho') {
        n.motivos[r.motivo] = (n.motivos[r.motivo] ?? 0) + 1
        if (!['sem-caminho', 'porta-trancada', 'porta-fechada'].includes(r.motivo)) n.semMotivo.push(rotulo)
        continue
      }
      n.comCaminho += 1
      const fora = amostras(de, r.trechos).filter((p) => !isPointKnown(area, p))
      if (fora.length > 0) n.foraDoConhecido.push(`${rotulo}: ${fora.length} pontos, o primeiro ${JSON.stringify(fora[0])}`)
      let atual = mapa
      for (const trecho of r.trechos) {
        n.trechos += 1
        const resultado = validateTokenMove(atual, { playerId: 'p1', tokenId: 'enzo', x: trecho.x, y: trecho.y }, { p1: ['enzo'] })
        if (!resultado.ok || resultado.x !== trecho.x || resultado.y !== trecho.y) {
          n.recusados.push(`${rotulo} trecho ${JSON.stringify(trecho)}: ${JSON.stringify(resultado)} caminho ${JSON.stringify(r.trechos)}`)
          break
        }
        atual = { ...atual, tokens: atual.tokens.map((t) => (t.id === 'enzo' ? { ...t, x: trecho.x, y: trecho.y } : t)) }
      }
    }
  }
  return n
}

describe('robô do "Andar até aqui" (motor + máscara do conhecido)', () => {
  it('20 mapas x 50 sementes: 0 trechos recusados pelo host, 0 pontos fora do conhecido, todo "sem caminho" com motivo', () => {
    const n = rodarRobo()
    console.log(`ROBO-JOGADOR ${JSON.stringify({ pedidos: n.pedidos, comCaminho: n.comCaminho, trechos: n.trechos, recusados: n.recusados.length, foraDoConhecido: n.foraDoConhecido.length, motivos: n.motivos })}`)
    if (n.recusados.length > 0) console.log(`ROBO-JOGADOR recusados ${n.recusados.slice(0, 3).join('\n | ')}`)
    if (n.foraDoConhecido.length > 0) console.log(`ROBO-JOGADOR fora ${n.foraDoConhecido.slice(0, 3).join('\n | ')}`)
    expect(n.pedidos).toBe(MAPAS_DO_ROBO * TRECHOS_POR_MAPA)
    expect(n.recusados).toEqual([])
    expect(n.foraDoConhecido).toEqual([])
    expect(n.semMotivo).toEqual([])
    expect(n.comCaminho).toBeGreaterThanOrEqual(MIN_COM_CAMINHO * n.pedidos)
  }, 300_000)
})
