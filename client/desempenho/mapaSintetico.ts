// MAPA SINTÉTICO PARA O HARNESS DE DESEMPENHO (27/10/2026).
//
// O mapa real que travou (200 x 200, grade 64) é conteúdo
// do usuário e o repositório é público: ele NÃO entra aqui. Este gerador monta,
// com semente fixa, um mapa com as MESMAS contagens e formas dele, medidas no
// arquivo real em 27/10/2026:
//   - 13 salas: 3 de contorno livre (61, 31 e 273 vértices) e 10 retângulos,
//     405 paredes vindas das salas + 37 paredes soltas = 442;
//   - 152 desenhos: 47 polígonos preenchidos (média ~80 pontos) e 105 traços
//     livres (média ~100 pontos), ~15 mil pontos ao todo;
//   - 228 passos de textura: 107 borrachas, 87 pincéis (~8 pontos cada),
//     26 baldes (em desenhos e salas), 8 "sala";
//   - 434 carimbos (arbusto 187, árvore 83, pedras 72, pinheiro 41, juncos 20,
//     girassóis 21, poça 8, palmeira 2);
//   - 37 riscos de penhasco (raio ~250, um deles com 700 pontos);
//   - relevo, continente e área externa ligados; um chão grande; névoa 'none';
//   - fichas e zonas ocultas (o real não tem; servem ao
//     cenário "revelar névoa").
// Em tamanhos menores (50 x 50, 100 x 100) a DENSIDADE se mantém: as contagens
// caem com a área, para ver como o custo cresce com o tamanho do mapa.
import { buildFreeRoomFromPoints, buildFreehandDrawing, buildPolygonDrawing, buildRoomFromDraft, buildWallFromDraft } from '../src/lib/drawingFactory'
import { addDrawing, addRoom, addToken, addWall, createEmptyMap } from '../src/lib/mapFactory'
import type { Carimbo, ConcealZone, MapData, PinceladaDeTextura, RegionPoint, TracoDePenhasco } from '../src/types/map'

export const GRADE = 64
const LADO_DE_REFERENCIA = 200

/** Gerador pseudoaleatório de semente fixa (mulberry32): mesma semente, mesmo mapa. */
function aleatorio(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Contorno irregular fechado com `n` vértices em volta de (cx, cy). */
function contorno(sorte: () => number, cx: number, cy: number, raio: number, n: number): RegionPoint[] {
  const pontos: RegionPoint[] = []
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2
    const r = raio * (0.75 + 0.25 * Math.sin(ang * 3 + sorte()) + 0.1 * sorte())
    pontos.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r })
  }
  return pontos
}

/** Caminho que passeia a partir de (x, y), com `n` pontos a `passo` px. */
function caminho(sorte: () => number, x: number, y: number, n: number, passo: number, limite: number): RegionPoint[] {
  const pontos: RegionPoint[] = []
  let ang = sorte() * Math.PI * 2
  let px = x
  let py = y
  for (let i = 0; i < n; i++) {
    pontos.push({ x: px, y: py })
    ang += (sorte() - 0.5) * 0.6
    px = Math.min(limite, Math.max(0, px + Math.cos(ang) * passo))
    py = Math.min(limite, Math.max(0, py + Math.sin(ang) * passo))
  }
  return pontos
}

const CARIMBOS: ReadonlyArray<[string, number]> = [
  ['arbusto', 187],
  ['arvore', 83],
  ['pedras', 72],
  ['pinheiro', 41],
  ['juncos', 20],
  ['girassois', 17],
  ['girassol', 4],
  ['poca', 8],
  ['palmeira', 2],
]
const TEXTURAS_DE_PINCEL = ['grama-amarela', 'floresta', 'grama', 'chao-de-floresta', 'bosque'] as const
const TEXTURAS_DE_BALDE = ['grama', 'areia', 'duna', 'pedra', 'pantano', 'floresta', 'terra', 'neve', 'pinheiros', 'bosque'] as const
const CORES_DE_POLIGONO = ['#a68d5d', '#5f8f4a', '#3f6e8c', '#8c6a3f', '#6b7d52'] as const

export interface OpcoesDoMapaSintetico {
  /** Lado do mapa em casas (o real tem 200). */
  lado: number
  /** Quantas fichas (a primeira fica para o jogador). */
  fichas?: number
  /** Quantas zonas ocultas (para o cenário "revelar névoa"). */
  zonasOcultas?: number
  semente?: number
}

/** O mapa sintético parecido com o mapa real, na densidade dele. */
export function mapaSintetico({ lado, fichas = 5, zonasOcultas = 6, semente = 20261027 }: OpcoesDoMapaSintetico): MapData {
  const sorte = aleatorio(semente)
  const mundo = lado * GRADE
  const fator = (lado / LADO_DE_REFERENCIA) ** 2
  const quantos = (n: number): number => Math.max(1, Math.round(n * fator))
  const ponto = (margem = 0.05): RegionPoint => ({ x: mundo * (margem + sorte() * (1 - 2 * margem)), y: mundo * (margem + sorte() * (1 - 2 * margem)) })
  let id = 0
  const novoId = (prefixo: string): string => `${prefixo}-${++id}`

  let map = createEmptyMap(`sintetico-${lado}`, `Sintético ${lado}x${lado}`, lado, lado, GRADE)
  map = {
    ...map,
    showGrid: false,
    background: { type: 'color', src: '#2b2b2b' },
    floorStyle: { fillColor: '#d6c286', strokeColor: null, strokeWidth: 1 },
    floor: [{ id: 'chao', shape: { kind: 'rect', cx: mundo / 2, cy: mundo * 0.6, w: mundo * 1.08, h: mundo * 0.71 }, op: 'add', modifiers: {}, fillColor: '#00375c', locked: true }],
    relevo: true,
    continente: true,
    externa: true,
  }

  // Salas: 3 de contorno livre (as que dão quase todas as paredes) e 10 retângulos.
  const salasLivres = lado >= LADO_DE_REFERENCIA ? [61, 31, 273] : [61, 31, 273].map((n) => Math.max(8, Math.round(n * Math.sqrt(fator))))
  const idsDasSalas: string[] = []
  for (const vertices of salasLivres) {
    const centro = ponto(0.2)
    const regiao = novoId('sala')
    const pontos = contorno(sorte, centro.x, centro.y, mundo * 0.08, vertices)
    const sala = buildFreeRoomFromPoints(regiao, pontos.map(() => novoId('parede')), pontos, '#0da54a', 'solid', '')
    map = addRoom(map, sala.region, sala.walls)
    idsDasSalas.push(regiao)
  }
  for (let i = 0; i < quantos(10); i++) {
    const inicio = ponto(0.1)
    const regiao = novoId('sala')
    const lados: [string, string, string, string] = [novoId('parede'), novoId('parede'), novoId('parede'), novoId('parede')]
    const sala = buildRoomFromDraft(regiao, lados, inicio, { x: inicio.x + GRADE * (4 + Math.floor(sorte() * 6)), y: inicio.y + GRADE * (4 + Math.floor(sorte() * 6)) }, undefined, undefined, `Casa ${i + 1}`)
    map = addRoom(map, sala.region, sala.walls)
    idsDasSalas.push(regiao)
  }
  // Paredes soltas, em cercas de 3 a 5 lances.
  let soltas = quantos(37)
  while (soltas > 0) {
    const trecho = caminho(sorte, ponto().x, ponto().y, Math.min(soltas, 3 + Math.floor(sorte() * 3)) + 1, GRADE * 3, mundo)
    for (let i = 1; i < trecho.length && soltas > 0; i++, soltas--) map = addWall(map, buildWallFromDraft(novoId('cerca'), trecho[i - 1], trecho[i]))
  }

  // Desenhos: polígonos preenchidos (os alvos dos baldes) e traços livres.
  const poligonos: string[] = []
  for (let i = 0; i < quantos(47); i++) {
    const c = ponto()
    const desenho = buildPolygonDrawing(novoId('poligono'), contorno(sorte, c.x, c.y, mundo * (0.01 + sorte() * 0.04), 20 + Math.floor(sorte() * 120)), CORES_DE_POLIGONO[i % CORES_DE_POLIGONO.length], 0, true, 1)
    map = addDrawing(map, desenho)
    poligonos.push(desenho.id)
  }
  for (let i = 0; i < quantos(105); i++) {
    const c = ponto()
    map = addDrawing(map, buildFreehandDrawing(novoId('traco'), caminho(sorte, c.x, c.y, 10 + Math.floor(sorte() * 190), 4, mundo), '#3b2f1e', 3 + Math.floor(sorte() * 6)))
  }

  // Texturas, na ordem em que um mestre pinta: baldes, pincéis e borrachas misturados, salas no meio.
  const texturas: PinceladaDeTextura[] = []
  const raio = 165
  const passos: Array<'pincel' | 'borracha' | 'balde' | 'sala'> = [
    ...Array<'pincel'>(quantos(87)).fill('pincel'),
    ...Array<'borracha'>(quantos(107)).fill('borracha'),
    ...Array<'balde'>(quantos(26)).fill('balde'),
    ...Array<'sala'>(Math.min(idsDasSalas.length, quantos(8))).fill('sala'),
  ]
  for (let i = passos.length - 1; i > 0; i--) {
    const j = Math.floor(sorte() * (i + 1))
    ;[passos[i], passos[j]] = [passos[j], passos[i]]
  }
  let salaDaVez = 0
  for (const tipo of passos) {
    const c = ponto()
    if (tipo === 'pincel') texturas.push({ id: novoId('tx'), tipo, textura: TEXTURAS_DE_PINCEL[Math.floor(sorte() * TEXTURAS_DE_PINCEL.length)], forca: 0.8, raio, pontos: caminho(sorte, c.x, c.y, 4 + Math.floor(sorte() * 9), 40, mundo) })
    else if (tipo === 'borracha') texturas.push({ id: novoId('tx'), tipo, forca: 0.8, raio, pontos: caminho(sorte, c.x, c.y, 4 + Math.floor(sorte() * 9), 40, mundo) })
    else if (tipo === 'balde') {
      const naSala = sorte() < 0.25
      const alvo = naSala ? { tipo: 'regiao' as const, id: idsDasSalas[Math.floor(sorte() * idsDasSalas.length)] } : { tipo: 'desenho' as const, id: poligonos[Math.floor(sorte() * poligonos.length)] }
      texturas.push({ id: novoId('tx'), tipo, textura: TEXTURAS_DE_BALDE[Math.floor(sorte() * TEXTURAS_DE_BALDE.length)], forca: 0.8, alvo })
    } else texturas.push({ id: novoId('tx'), tipo, regiao: idsDasSalas[salaDaVez++ % idsDasSalas.length] })
  }

  // Carimbos espalhados, na proporção do real.
  const carimbos: Carimbo[] = []
  for (const [tipo, n] of CARIMBOS) {
    for (let i = 0; i < quantos(n); i++) {
      const c = ponto(0.02)
      carimbos.push({ id: novoId('carimbo'), tipo, x: Math.round(c.x), y: Math.round(c.y), tamanho: 80 + Math.round(sorte() * 120), giro: Math.floor(sorte() * 360) })
    }
  }

  // Penhascos: muitos riscos curtos e um comprido (o real tem um de 700 pontos).
  const penhascos: TracoDePenhasco[] = []
  for (let i = 0; i < quantos(37); i++) {
    const c = ponto()
    const n = i === 0 ? Math.max(40, Math.round(700 * Math.sqrt(fator))) : 1 + Math.floor(sorte() * 40)
    penhascos.push({ id: novoId('penhasco'), modo: 'riscar', raio: 200 + sorte() * 100, pontos: caminho(sorte, c.x, c.y, n, 45, mundo) })
  }

  // Zonas ocultas (névoa que o mestre revela) e fichas.
  const zonas: ConcealZone[] = []
  for (let i = 0; i < zonasOcultas; i++) {
    const c = ponto(0.15)
    zonas.push({ id: novoId('zona'), points: contorno(sorte, c.x, c.y, mundo * 0.06, 12), name: `Zona ${i + 1}`, revealed: false })
  }
  map = { ...map, texturas, carimbos, penhascos, concealZones: zonas, fog: { mode: 'none', revealed: [] } }
  for (let i = 0; i < fichas; i++) {
    const c = ponto(0.3)
    map = addToken(map, { id: `ficha-${i + 1}`, characterId: null, name: i === 0 ? 'Heroi' : `Ficha ${i + 1}`, x: Math.round(c.x / GRADE) * GRADE + GRADE / 2, y: Math.round(c.y / GRADE) * GRADE + GRADE / 2, size: 1, image: null })
  }
  return map
}

/** Zonas ocultas para o mapa REAL (que não tem nenhuma): mesmo desenho das do sintético. */
export function zonasOcultasPara(map: MapData, quantas = 6, semente = 7): ConcealZone[] {
  const sorte = aleatorio(semente)
  const mundoX = map.width * map.grid
  const mundoY = map.height * map.grid
  return Array.from({ length: quantas }, (_, i) => ({
    id: `zona-medida-${i + 1}`,
    points: contorno(sorte, mundoX * (0.2 + sorte() * 0.6), mundoY * (0.2 + sorte() * 0.6), Math.min(mundoX, mundoY) * 0.06, 12),
    name: `Zona ${i + 1}`,
    revealed: false,
  }))
}
