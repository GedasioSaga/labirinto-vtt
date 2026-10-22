/**
 * ROBÔ DE PROVA DO CAMINHAMENTO (regra de teste de jogos: semente fixa, metas
 * com número escritas antes do código).
 *
 * 20 mapas gerados (salas, corredores, portas, janelas, vãos, pilares tortos,
 * fichas paradas), 50 trechos de rotina em cada (1000 ao todo), um NPC
 * andando posto a posto no tique da rotina. Um trecho em cada dez tem um
 * INTRUSO: uma ficha que aparece no meio do caminho planejado e fica.
 *
 * Metas:
 * - 0 travas (trecho que não termina) em todos os mapas;
 * - 100% dos trechos com caminho (pelo oráculo independente) CHEGAM, em no
 *   máximo 1,5 vez o tempo do caminho ótimo (do intruso em diante, o ótimo é o
 *   de quando ele apareceu);
 * - trecho sem caminho termina em desistência com motivo, e a consulta que diz
 *   "sem caminho" leva menos de 50 ms;
 * - nenhum passo cruza parede, janela ou porta fechada, encosta em ficha ou
 *   abre porta trancada.
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../../pixi/world'
import { CacheDeMalhas, caminhoAgora } from './agenda'
import type { FichaNoCaminho } from './busca'
import { GRID } from './caminho.fixture'
import { gerarMapaDoRobo, Oraculo, type Sala, sorteador } from './robo.fixture'
import { passoDaRotina, simularTrecho } from './simulacao.fixture'

const MAPAS = 20
const TRECHOS_POR_MAPA = 50
const POSTOS = 5
const TIQUE_DO_INTRUSO = 3
const RAZAO_MAXIMA = 1.5
const MS_SEM_CAMINHO = 50

interface Numeros {
  trechos: number
  comCaminho: number
  chegaram: number
  travas: number
  naoChegaram: string[]
  semCaminho: number
  desistiramComMotivo: number
  motivos: Record<string, number>
  razoes: number[]
  lentos: string[]
  abertas: string[]
  msSemCaminho: number[]
  violacoes: string[]
  portasAbertas: number
  deixouAbertas: number
  intrusos: number
}

function percentil(valores: readonly number[], p: number): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  return ordenados[Math.min(ordenados.length - 1, Math.floor((p / 100) * ordenados.length))] ?? 0
}

/** Um ponto de parada do NPC: centro de casa (ficha de 1) ou canto de casa (ficha de 2), longe das paredes da sala. */
function pontoNaSala(sala: Sala, tamanho: number, inteiro: (a: number, b: number) => number): Point | null {
  if (tamanho === 1) return { x: (inteiro(sala.x0, sala.x1 - 1) + 0.5) * GRID, y: (inteiro(sala.y0, sala.y1 - 1) + 0.5) * GRID }
  if (sala.x1 - sala.x0 < 2 || sala.y1 - sala.y0 < 2) return null
  return { x: inteiro(sala.x0 + 1, sala.x1 - 1) * GRID, y: inteiro(sala.y0 + 1, sala.y1 - 1) * GRID }
}

function escolherPostos(semente: number, salas: readonly Sala[], tamanho: number, oraculo: Oraculo, fichas: readonly FichaNoCaminho[], isolada: number | null): Point[] {
  const sorte = sorteador(semente)
  const inteiro = (a: number, b: number) => a + Math.floor(sorte() * (b - a + 1))
  const livre = (p: Point) => oraculo.otimo(p, p, fichas) !== null
  const postos: Point[] = []
  for (let tentativa = 0; tentativa < 4000 && postos.length < POSTOS; tentativa += 1) {
    const sala = salas[inteiro(0, salas.length - 1)]
    const p = sala === undefined ? null : pontoNaSala(sala, tamanho, inteiro)
    if (p === null || !livre(p) || postos.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 4 * GRID)) continue
    const primeiro = postos[0]
    if (primeiro !== undefined && oraculo.otimo(primeiro, p, fichas) === null) continue
    postos.push(p)
  }
  // No mapa com a sala isolada, um dos postos fica lá dentro: o trecho até ele não tem caminho.
  const sala = isolada === null ? undefined : salas[isolada]
  if (sala !== undefined) {
    for (let tentativa = 0; tentativa < 100; tentativa += 1) {
      const p = pontoNaSala(sala, tamanho, inteiro)
      if (p !== null && livre(p)) {
        postos[2] = p
        break
      }
    }
  }
  return postos
}

/** O intruso: o centro de casa no meio do caminho planejado, longe do NPC e do destino. */
function lugarDoIntruso(pontos: readonly Point[], de: Point, para: Point): Point | null {
  let total = 0
  for (let i = 1; i < pontos.length; i += 1) total += Math.hypot((pontos[i]?.x ?? 0) - (pontos[i - 1]?.x ?? 0), (pontos[i]?.y ?? 0) - (pontos[i - 1]?.y ?? 0))
  let falta = total / 2
  for (let i = 1; i < pontos.length; i += 1) {
    const a = pontos[i - 1]
    const b = pontos[i]
    if (a === undefined || b === undefined) continue
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    if (falta <= d && d > 0) {
      const p = { x: a.x + ((b.x - a.x) * falta) / d, y: a.y + ((b.y - a.y) * falta) / d }
      const c = { x: (Math.floor(p.x / GRID) + 0.5) * GRID, y: (Math.floor(p.y / GRID) + 0.5) * GRID }
      const longe = Math.hypot(c.x - de.x, c.y - de.y) >= 4 * GRID && Math.hypot(c.x - para.x, c.y - para.y) >= 2 * GRID
      return longe ? c : null
    }
    falta -= d
  }
  return null
}

function rodarRobo(): Numeros {
  const numeros: Numeros = {
    trechos: 0,
    comCaminho: 0,
    chegaram: 0,
    travas: 0,
    naoChegaram: [],
    semCaminho: 0,
    desistiramComMotivo: 0,
    motivos: {},
    razoes: [],
    lentos: [],
    abertas: [],
    msSemCaminho: [],
    violacoes: [],
    portasAbertas: 0,
    deixouAbertas: 0,
    intrusos: 0,
  }
  for (let s = 0; s < MAPAS; s += 1) {
    const semente = 1000 + s
    const tamanho = s % 4 === 3 ? 2 : 1
    const gerado = gerarMapaDoRobo(semente, GRID, s % 5 === 0, tamanho)
    const raio = (tamanho * GRID) / 2
    const oraculo = new Oraculo(gerado.mapa, raio)
    const postos = escolherPostos(semente + 77, gerado.salas, tamanho, oraculo, gerado.fichas, gerado.isolada)
    const cache = new CacheDeMalhas()
    const passo = passoDaRotina(GRID)
    let mapa = gerado.mapa
    let aqui = postos[0] ?? { x: GRID / 2, y: GRID / 2 }
    // Ficha de 2 casas acha menos cantos livres: a rotina roda com o que houver, a partir de 3 postos.
    expect(postos.length, `mapa ${s}: postos`).toBeGreaterThanOrEqual(3)
    for (let t = 0, feitos = 0; feitos < TRECHOS_POR_MAPA && t < 2 * TRECHOS_POR_MAPA; t += 1) {
      const destino = postos[(t + 1) % postos.length] ?? aqui
      if (destino.x === aqui.x && destino.y === aqui.y) continue
      feitos += 1
      numeros.trechos += 1
      // O intruso entra no meio do caminho que o NPC vai planejar (o motor é determinístico: é o mesmo).
      const planejado = t % 10 === 7 ? caminhoAgora(cache, mapa, raio, { de: aqui, para: destino, fichas: gerado.fichas }) : null
      const intruso = planejado?.tipo === 'caminho' ? lugarDoIntruso(planejado.pontos, aqui, destino) : null
      let ondeEstavaNoIntruso: Point | null = null
      const fichasNoTique = (tique: number, npc: Point): readonly FichaNoCaminho[] => {
        if (intruso === null || tique < TIQUE_DO_INTRUSO) return gerado.fichas
        if (tique === TIQUE_DO_INTRUSO) ondeEstavaNoIntruso = npc
        return [...gerado.fichas, { id: 'intruso', x: intruso.x, y: intruso.y, raio: GRID / 2 }]
      }
      const otimoNaSaida = oraculo.otimo(aqui, destino, gerado.fichas)
      const maxTiques = otimoNaSaida === null ? 400 : Math.ceil((4 * otimoNaSaida) / passo) + 150
      const r = simularTrecho({ mapa, de: aqui, para: destino, raio, fichas: fichasNoTique, maxTiques, cache })
      numeros.violacoes.push(...r.violacoes.map((v) => `mapa ${s} trecho ${t}: ${v}`))
      numeros.portasAbertas += r.acoes.filter((a) => a.acao.tipo === 'abrir').length
      numeros.deixouAbertas += r.deixouAbertas.length
      if (r.deixouAbertas.length > 0) {
        const acoes = r.acoes.map((a) => `t${a.tique} ${a.acao.tipo} ${a.acao.wallId}`).join(', ')
        numeros.abertas.push(`mapa ${s} trecho ${t} ${JSON.stringify(aqui)}->${JSON.stringify(destino)} abertas ${r.deixouAbertas.join(',')} fim ${JSON.stringify(r.fim)} acoes [${acoes}] :: ${r.registro.join(' ; ')}`)
      }
      if (r.fim === null) numeros.travas += 1
      let otimoTiques: number | null = otimoNaSaida === null ? null : otimoNaSaida / passo
      const onde: Point | null = ondeEstavaNoIntruso
      if (intruso !== null && onde !== null) {
        numeros.intrusos += 1
        const depois = oraculo.otimo(onde, destino, [...gerado.fichas, { id: 'intruso', x: intruso.x, y: intruso.y, raio: GRID / 2 }])
        otimoTiques = depois === null ? null : TIQUE_DO_INTRUSO + depois / passo
      }
      if (otimoTiques === null) {
        numeros.semCaminho += 1
        numeros.msSemCaminho.push(r.msDaConsultaMaisLenta)
        if (r.fim?.tipo === 'desistiu') {
          numeros.desistiramComMotivo += 1
          numeros.motivos[r.fim.motivo] = (numeros.motivos[r.fim.motivo] ?? 0) + 1
        }
      } else {
        numeros.comCaminho += 1
        if (r.fim?.tipo === 'chegou') {
          numeros.chegaram += 1
          const razao = r.tiques / Math.max(1, otimoTiques)
          numeros.razoes.push(razao)
          if (razao > RAZAO_MAXIMA) numeros.lentos.push(`mapa ${s} trecho ${t} razao ${razao.toFixed(2)} tiques ${r.tiques} otimo ${otimoTiques.toFixed(1)} pedidos ${r.pedidos} intruso ${intruso !== null} :: ${r.registro.join(' ; ')}`)
        } else {
          numeros.naoChegaram.push(`mapa ${s} trecho ${t} ${JSON.stringify(aqui)}->${JSON.stringify(destino)}: ${JSON.stringify(r.fim)} :: ${r.registro.join(' ; ')}`)
        }
      }
      mapa = { ...mapa, walls: r.paredes }
      aqui = r.aqui
    }
  }
  return numeros
}

describe('robô do caminhamento', () => {
  it('20 mapas, 1000 trechos: sem trava, todos chegam em até 1,5x o ótimo, sem caminho responde em < 50 ms', () => {
    const n = rodarRobo()
    const resumo = {
      trechos: n.trechos,
      comCaminho: n.comCaminho,
      chegaram: n.chegaram,
      travas: n.travas,
      naoChegaram: n.naoChegaram.length,
      semCaminho: n.semCaminho,
      desistiramComMotivo: n.desistiramComMotivo,
      motivos: n.motivos,
      intrusos: n.intrusos,
      razaoP50: Number(percentil(n.razoes, 50).toFixed(3)),
      razaoP95: Number(percentil(n.razoes, 95).toFixed(3)),
      razaoMax: Number(Math.max(0, ...n.razoes).toFixed(3)),
      msSemCaminhoMax: Number(Math.max(0, ...n.msSemCaminho).toFixed(2)),
      violacoes: n.violacoes.length,
      portasAbertasPeloNpc: n.portasAbertas,
      portasQueFicaramAbertas: n.deixouAbertas,
    }
    console.log(`ROBO ${JSON.stringify(resumo)}`)
    if (n.naoChegaram.length > 0) console.log(`ROBO naoChegaram ${n.naoChegaram.slice(0, 3).join('\n | ')}`)
    if (n.violacoes.length > 0) console.log(`ROBO violacoes ${n.violacoes.slice(0, 10).join(' | ')}`)
    if (n.lentos.length > 0) console.log(`ROBO lentos ${n.lentos.length}: ${n.lentos.slice(0, 4).join('\n | ')}`)
    if (n.abertas.length > 0) console.log(`ROBO abertas ${n.abertas.slice(0, 3).join('\n | ')}`)
    expect(n.trechos).toBeGreaterThanOrEqual(MAPAS * TRECHOS_POR_MAPA - 10)
    expect(n.travas).toBe(0)
    expect(n.naoChegaram).toEqual([])
    expect(n.desistiramComMotivo).toBe(n.semCaminho)
    expect(resumo.razaoMax).toBeLessThanOrEqual(RAZAO_MAXIMA)
    expect(resumo.msSemCaminhoMax).toBeLessThan(MS_SEM_CAMINHO)
    expect(n.violacoes).toEqual([])
    expect(n.abertas).toEqual([])
    expect(n.semCaminho).toBeGreaterThan(0)
    expect(n.intrusos).toBeGreaterThan(0)
  }, 300_000)
})
