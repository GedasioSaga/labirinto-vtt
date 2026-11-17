import type { BarrancoDoMapa, MapData, PinceladaDeTextura, QuadradoAlto, RegionPoint } from '../types/map'
import { materialDoChao, type MaterialDoBarranco } from '../texturas/meioTermo/barrancoPorChao'
import { geosDoBarranco, NIVEL_MAXIMO, type GeoDoBarranco } from './barranco'
import { consultaDoChaoPintado, type ConsultaDoChao } from './chaoPintado'
import { pisoDe } from './pisos'

/**
 * O MATERIAL DE CADA BARRANCO (pedido de 17/11/2026: "um relevo dependendo da
 * textura no chão"; tabela em `texturas/meioTermo/barrancoPorChao.ts`).
 *
 * Automático: o material sai do chão que a ferramenta Texturas pintou no lado
 * ALTO. Amostras ao longo da beira, meia casa para dentro do alto; o chão que
 * cobre mais vence (um material por barranco), e o ponto sem nada pintado vota
 * Terra, o barranco de hoje. Empate fica com a Terra.
 *
 * Forçado no painel: o risco guarda o dele (`RiscoDeBarranco.material`); na
 * Área alta cada quadrado guarda o do traço que o subiu
 * (`QuadradoAlto.material`) e vota com ele no lugar do chão.
 *
 * Na Área alta o barranco é o degrau inteiro: os quadrados vizinhos pelo lado
 * com o mesmo nível ou mais. A beira de fora e a do buraco de dentro dele saem
 * do mesmo material.
 *
 * Puro: sem Pixi nem store. O mestre desenha com isto; o recorte do jogador
 * leva o material já resolvido (`barrancoComMaterial`), porque ele só recebe as
 * texturas do que conhece e veria o barranco trocar de cor ao explorar.
 */

/** O que o desenho usa de cada barranco. */
export interface ChaoDoBarranco {
  material: MaterialDoBarranco
  /** A textura que mais cobre o lado alto (`null` = nada pintado): a linha da borda do Desenhado. */
  chao: string | null
}

/** Quanto a amostra entra no lado alto, e de quanto em quanto ao longo da beira (em casas). */
const RECUO_EM_CASAS = 0.5
const PASSO_EM_CASAS = 0.5
/** Teto de amostras por barranco (o passo cresce na beira comprida). */
const TETO_DE_AMOSTRAS = 96
/** A ordem do desempate: o primeiro com mais votos vence, e a Terra vem primeiro. */
const ORDEM: readonly MaterialDoBarranco[] = ['terra', 'pedra', 'areia', 'neve', 'grama']

const SEM_CHAO: ChaoDoBarranco = { material: 'terra', chao: null }

/** Os votos de um barranco: por material e pela textura que estava no ponto. */
interface Votos {
  material: Map<MaterialDoBarranco, number>
  chao: Map<string | null, number>
}

function votosVazios(): Votos {
  return { material: new Map(), chao: new Map() }
}

function votar<T>(votos: Map<T, number>, em: T): void {
  votos.set(em, (votos.get(em) ?? 0) + 1)
}

function vencedor(votos: Votos): ChaoDoBarranco {
  let material: MaterialDoBarranco = 'terra'
  let maior = 0
  for (const m of ORDEM) {
    const n = votos.material.get(m) ?? 0
    if (n > maior) {
      maior = n
      material = m
    }
  }
  let chao: string | null = null
  let maiorChao = 0
  for (const [id, n] of votos.chao) {
    if (n > maiorChao) {
      maiorChao = n
      chao = id
    }
  }
  return { material, chao }
}

/** Os pontos do lado alto de um barranco, `recuo` px para dentro, a cada meia casa da beira. */
function amostrasDoAlto(geo: GeoDoBarranco, grid: number, recuo: number): RegionPoint[] {
  const n = geo.lip.length
  if (n === 0 || grid <= 0) return []
  const entrePontos = Math.max(1e-6, geo.len / Math.max(1, geo.nSeg))
  const passo = Math.max(1, Math.round((PASSO_EM_CASAS * grid) / entrePontos), Math.ceil(n / TETO_DE_AMOSTRAS))
  const pontos: RegionPoint[] = []
  for (let i = Math.min(n - 1, passo >> 1); i < n; i += passo) pontos.push({ x: geo.lip[i][0] - geo.un[i][0] * recuo, y: geo.lip[i][1] - geo.un[i][1] * recuo })
  return pontos
}

function chaveDoQuadrado(x: number, y: number): string {
  return `${x},${y}`
}

const LADOS: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, -1], [0, 1]]

/** O degrau de cada quadrado do nível `k`: quadrados vizinhos pelo lado com `k` degraus ou mais ganham o mesmo número. */
function degrausDoNivel(quadrados: readonly QuadradoAlto[], k: number): Map<string, number> {
  const doNivel = new Map<string, QuadradoAlto>()
  for (const q of quadrados) if (q.alturas.length >= k) doNivel.set(chaveDoQuadrado(q.x, q.y), q)
  const degrau = new Map<string, number>()
  let proximo = 0
  for (const [chave, inicio] of doNivel) {
    if (degrau.has(chave)) continue
    degrau.set(chave, proximo)
    const fila = [inicio]
    for (let i = 0; i < fila.length; i += 1) {
      for (const [dx, dy] of LADOS) {
        const vizinha = chaveDoQuadrado(fila[i].x + dx, fila[i].y + dy)
        const q = doNivel.get(vizinha)
        if (q !== undefined && !degrau.has(vizinha)) {
          degrau.set(vizinha, proximo)
          fila.push(q)
        }
      }
    }
    proximo += 1
  }
  return degrau
}

interface Resolvido {
  porGeo: Map<string, ChaoDoBarranco>
  /** O material de cada quadrado alto do piso: o do degrau mais alto dele. */
  porQuadrado: Map<QuadradoAlto, MaterialDoBarranco>
}

function resolver(b: BarrancoDoMapa, piso: number, grid: number, geos: readonly GeoDoBarranco[], chao: ConsultaDoChao | null): Resolvido {
  const porGeo = new Map<string, ChaoDoBarranco>()
  const porQuadrado = new Map<QuadradoAlto, MaterialDoBarranco>()
  const noPonto = (p: RegionPoint): string | null => (chao === null ? null : chao(p))

  const riscos = new Map(b.riscos.map((r) => [r.id, r]))
  for (const geo of geos) {
    if (geo.tipo !== 'risco') continue
    const votos = votosVazios()
    for (const p of amostrasDoAlto(geo, grid, RECUO_EM_CASAS * grid)) {
      const textura = noPonto(p)
      votar(votos.chao, textura)
      votar(votos.material, materialDoChao(textura))
    }
    const venceu = vencedor(votos)
    porGeo.set(geo.id, { material: riscos.get(geo.id)?.material ?? venceu.material, chao: venceu.chao })
  }

  const q = b.quadrado
  const doPiso = q > 0 ? b.quadrados.filter((c) => pisoDe(c) === piso) : []
  if (doPiso.length === 0) return { porGeo, porQuadrado }
  const porChave = new Map(doPiso.map((c) => [chaveDoQuadrado(c.x, c.y), c]))
  for (let k = 1; k <= NIVEL_MAXIMO; k += 1) {
    const doNivel = geos.filter((geo) => geo.tipo === 'area' && geo.nivel === k)
    if (doNivel.length === 0) continue
    const degrau = degrausDoNivel(doPiso, k)
    const votos = new Map<number, Votos>()
    const degrauDoGeo = new Map<string, number>()
    for (const geo of doNivel) {
      const vezes = new Map<number, number>()
      for (const p of amostrasDoAlto(geo, grid, RECUO_EM_CASAS * q)) {
        const chave = chaveDoQuadrado(Math.floor((p.x - b.origem.x) / q), Math.floor((p.y - b.origem.y) / q))
        const n = degrau.get(chave)
        // A amostra que caiu fora do degrau (quina arredondada) não vota.
        if (n === undefined) continue
        votar(vezes, n)
        let doDegrau = votos.get(n)
        if (doDegrau === undefined) {
          doDegrau = votosVazios()
          votos.set(n, doDegrau)
        }
        const textura = noPonto(p)
        votar(doDegrau.chao, textura)
        votar(doDegrau.material, porChave.get(chave)?.material ?? materialDoChao(textura))
      }
      let melhor: number | undefined
      let maior = 0
      for (const [n, quantas] of vezes) {
        if (quantas > maior) {
          maior = quantas
          melhor = n
        }
      }
      if (melhor !== undefined) degrauDoGeo.set(geo.id, melhor)
    }
    const venceu = new Map<number, ChaoDoBarranco>()
    for (const [n, doDegrau] of votos) venceu.set(n, vencedor(doDegrau))
    for (const geo of doNivel) {
      const n = degrauDoGeo.get(geo.id)
      porGeo.set(geo.id, (n === undefined ? undefined : venceu.get(n)) ?? SEM_CHAO)
    }
    // O quadrado fica com o material do degrau mais alto dele (os níveis sobem em ordem).
    for (const c of doPiso) {
      if (c.alturas.length !== k) continue
      const n = degrau.get(chaveDoQuadrado(c.x, c.y))
      const doDegrau = n === undefined ? undefined : venceu.get(n)
      if (doDegrau !== undefined) porQuadrado.set(c, doDegrau.material)
    }
  }
  return { porGeo, porQuadrado }
}

/**
 * O material e o chão do alto de cada barranco de `geos` (os de
 * `geosDoBarranco` deste barranco e piso), pelo id. `chao`: a consulta do chão
 * pintado do piso (`chaoPintadoDoPiso`); `null` = nada pintado, e só o forçado
 * no painel muda a Terra de hoje.
 */
export function chaoDosBarrancos(b: BarrancoDoMapa, piso: number, grid: number, geos: readonly GeoDoBarranco[], chao: ConsultaDoChao | null): ReadonlyMap<string, ChaoDoBarranco> {
  return resolver(b, piso, grid, geos, chao).porGeo
}

type MapaComChao = Pick<MapData, 'texturas' | 'regions' | 'drawings'>

const consultas = new WeakMap<readonly PinceladaDeTextura[], Map<number, { regions: MapData['regions']; drawings: MapData['drawings']; consulta: ConsultaDoChao | null }>>()

/**
 * A consulta do chão pintado de um piso: os passos da ferramenta Texturas
 * desse piso (`lib/chaoPintado.ts`). `null` sem nenhum. Guardada pelas listas
 * do mapa: as mesmas listas devolvem a MESMA consulta (o desenho compara por
 * referência).
 */
export function chaoPintadoDoPiso(map: MapaComChao, piso: number): ConsultaDoChao | null {
  const passos = map.texturas
  if (passos === undefined || passos.length === 0) return null
  let porPiso = consultas.get(passos)
  if (porPiso === undefined) {
    porPiso = new Map()
    consultas.set(passos, porPiso)
  }
  const guardada = porPiso.get(piso)
  if (guardada !== undefined && guardada.regions === map.regions && guardada.drawings === map.drawings) return guardada.consulta
  const doPiso = passos.filter((p) => pisoDe(p) === piso)
  const consulta = doPiso.length === 0 ? null : consultaDoChaoPintado(doPiso, map.regions, map.drawings)
  porPiso.set(piso, { regions: map.regions, drawings: map.drawings, consulta })
  return consulta
}

const comMaterial = new WeakMap<BarrancoDoMapa, { piso: number; grid: number; chao: ConsultaDoChao; saida: BarrancoDoMapa }>()

/**
 * O barranco com o material de cada risco e de cada quadrado alto do piso já
 * ESCRITO: o que vai no recorte do jogador. Sem chão pintado no piso é o
 * PRÓPRIO barranco (o Automático dele dá Terra nas duas telas, e o forçado já
 * está escrito). As mesmas entradas devolvem o MESMO barranco.
 */
export function barrancoComMaterial(b: BarrancoDoMapa | undefined, piso: number, grid: number, map: MapaComChao): BarrancoDoMapa | undefined {
  if (b === undefined) return undefined
  const chao = chaoPintadoDoPiso(map, piso)
  if (chao === null) return b
  const guardado = comMaterial.get(b)
  if (guardado !== undefined && guardado.piso === piso && guardado.grid === grid && guardado.chao === chao) return guardado.saida
  const { porGeo, porQuadrado } = resolver(b, piso, grid, geosDoBarranco(b, piso, grid), chao)
  const riscos = b.riscos.map((r) => {
    const material = r.material === undefined && pisoDe(r) === piso ? porGeo.get(r.id)?.material : undefined
    return material === undefined ? r : { ...r, material }
  })
  const quadrados = b.quadrados.map((c) => {
    const material = porQuadrado.get(c)
    return material === undefined || material === c.material ? c : { ...c, material }
  })
  const saida = { ...b, riscos, quadrados }
  comMaterial.set(b, { piso, grid, chao, saida })
  return saida
}
