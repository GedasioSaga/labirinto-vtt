// Buraco de parede ao TROCAR O TIPO de uma porta já criada.
//
// `setWallDoorKind` (mapFactory.ts:672) redimensiona SÓ o pedaço-porta e ignora
// os pedaços sólidos irmãos da mesma aresta (mesmo `regionId` +
// `regionEdgeIndex`) que `addDoorOnWall` (mapFactory.ts:761) criou junto.
// Consequências medidas:
//  - vão que ENCOLHE ('gate' 96 → 'normal' 32) deixa duas faixas da aresta sem
//    parede nenhuma: token atravessa e luz vaza por onde não há porta;
//  - vão que CRESCE ('normal' 32 → 'gate' 96) faz a porta cobrir os sólidos:
//    o desenho abre 96px e a colisão continua fechada em 64 deles;
//  - o vão não é limitado ao comprimento da aresta (mapFactory.ts:689): porta
//    colada no canto vira porta que sai para fora da sala.
//
// A INVARIANTE que estes testes cobram é uma só: depois de qualquer troca de
// tipo, os trechos da aresta (sólidos + vão) cobrem a aresta inteira, sem
// sobra e sem buraco — e a colisão e a visão concordam com esse desenho.
import { describe, expect, it } from 'vitest'
import { createEmptyMap, addRoom, addDoorOnWall, setWallDoorKind, setWallDoor, setDoorLocked } from './mapFactory'
import { buildRoomFromDraft } from './drawingFactory'
import { findTokenPath, resolveTokenMove } from './collision'
import { computeVisibility, visionSegments } from './visibility'
import type { DoorKind, MapData, Wall } from '../types/map'

/** Espelho de `DOOR_LENGTH_BY_KIND` (stores/mapStore.ts:658) — é o número que
 *  o store passa para `addDoorOnWall`/`setWallDoorKind`. Copiado aqui (mesma
 *  escolha de `lib/toolVariants.ts:95`) para o teste de lib não importar a
 *  store inteira. */
const VAO: Record<DoorKind, number> = { normal: 32, double: 64, gate: 96 }

const SALA = 'sala'
/** Aresta 0 da Sala retangular: de (0,0) a (512,0) — `buildRoomFromDraft` numera
 *  topo, direita, baixo, esquerda. Nela, a distância ao longo da aresta É o x. */
const ARESTA = 0
const ARESTA_COMPRIMENTO = 512
/** Folga do mapa: a sala cabe inteira e sobra espaço para o token do lado de fora. */
const GRADE = 64

const arred = (n: number): number => Math.round(n * 1e6) / 1e6

/** Sala retangular com UMA porta criada pela ferramenta Porta na aresta de cima. */
function salaComPorta(kind: DoorKind, cliqueX = 256): MapData {
  const { region, walls } = buildRoomFromDraft(SALA, ['e0', 'e1', 'e2', 'e3'], { x: 0, y: 0 }, { x: ARESTA_COMPRIMENTO, y: 320 })
  const map = addRoom(createEmptyMap('m_porta_tipo', 'Buraco de porta', 30, 20, GRADE), region, walls)
  return addDoorOnWall(map, 'e0', { x: cliqueX, y: 0 }, VAO[kind], kind)
}

function pedacosDaAresta(map: MapData): Wall[] {
  return map.walls.filter((w) => w.regionId === SALA && w.regionEdgeIndex === ARESTA)
}

function idDaPorta(map: MapData): string {
  const porta = pedacosDaAresta(map).find((w) => w.door !== null)
  if (!porta) throw new Error('a aresta ficou sem nenhum pedaço com porta')
  return porta.id
}

interface Trecho {
  de: number
  ate: number
  porta: boolean
}

/** Trechos que a aresta de cima tem cobertos, ordenados — cada parede pelo x que ocupa. */
function trechos(map: MapData): Trecho[] {
  return pedacosDaAresta(map)
    .map((w) => ({ de: arred(Math.min(w.x1, w.x2)), ate: arred(Math.max(w.x1, w.x2)), porta: w.door !== null }))
    .sort((a, b) => a.de - b.de)
}

function desenho(map: MapData): string {
  return trechos(map)
    .map((t) => `${t.porta ? 'PORTA' : 'sólido'} ${t.de}..${t.ate}`)
    .join(' | ')
}

const TIPOS: DoorKind[] = ['normal', 'double', 'gate']
const PARES: [DoorKind, DoorKind][] = TIPOS.flatMap((de) => TIPOS.filter((para) => para !== de).map((para) => [de, para] as [DoorKind, DoorKind]))

describe('setWallDoorKind — a aresta continua inteira depois da troca de tipo', () => {
  it.each(PARES)('%s → %s: sólidos + vão cobrem a aresta exatamente, sem sobra e sem buraco', (de, para) => {
    // Arrange: porta do tipo `de` criada pela ferramenta no meio da aresta.
    const antes = salaComPorta(de)

    // Act: o painel troca o tipo para `para` (App.handleDoorKindChange → store → setWallDoorKind).
    const depois = setWallDoorKind(antes, idDaPorta(antes), para, VAO[para])

    // Assert: a aresta 0..512 está coberta de ponta a ponta, e os trechos se
    // encostam exatamente (buraco E sobreposição reprovam).
    const t = trechos(depois)
    const mapa = `${de}→${para}: ${desenho(depois)}`
    expect(t.length, mapa).toBeGreaterThan(0)
    expect(t[0].de, `${mapa} — a aresta começa descoberta`).toBe(0)
    expect(t[t.length - 1].ate, `${mapa} — a aresta termina descoberta`).toBe(ARESTA_COMPRIMENTO)
    for (let i = 1; i < t.length; i += 1) {
      const buraco = arred(t[i].de - t[i - 1].ate)
      expect(buraco, `${mapa} — ${buraco > 0 ? 'BURACO' : 'SOBREPOSIÇÃO'} de ${Math.abs(buraco)}px entre ${t[i - 1].ate} e ${t[i].de}`).toBe(0)
    }
  })

  it('o vão continua sendo o do tipo novo (a troca não pode "consertar" encolhendo a porta)', () => {
    const antes = salaComPorta('gate')

    const depois = setWallDoorKind(antes, idDaPorta(antes), 'normal', VAO.normal)

    const porta = pedacosDaAresta(depois).find((w) => w.door !== null)!
    expect(porta.door?.kind).toBe('normal')
    expect(arred(Math.hypot(porta.x2 - porta.x1, porta.y2 - porta.y1)), desenho(depois)).toBe(VAO.normal)
  })
})

describe('setWallDoorKind — colisão coerente com o desenho', () => {
  /** Traço curto e reto cruzando a aresta de cima em `x`. */
  const atravessa = (x: number) => ({ de: { x, y: 30 }, para: { x, y: -30 } })

  it('vão que encolhe (portão → normal): a faixa que voltou a ser parede NÃO deixa o token passar', () => {
    // Arrange: portão (vão 96) de 208 a 304; ao virar normal (vão 32) a porta
    // fica em 240..272 e as faixas 208..240 e 272..304 ficam sem parede.
    const antes = salaComPorta('gate')
    const depois = setWallDoorKind(antes, idDaPorta(antes), 'normal', VAO.normal)

    // Act: token tenta cruzar em x=224, no meio da faixa 208..240.
    const { de, para } = atravessa(224)
    const destino = resolveTokenMove(de, para, depois.walls, GRADE)

    // Assert: fora do vão de 32px da porta normal, a aresta é parede.
    expect(destino, `token atravessou a 224 — parede da aresta: ${desenho(depois)}`).toEqual(de)
  })

  it('vão que encolhe: a porta TRANCADA continua barrando a extensão inteira do vão antigo', () => {
    const antes = salaComPorta('gate')
    const comPorta = setWallDoorKind(antes, idDaPorta(antes), 'normal', VAO.normal)
    const trancada = setDoorLocked(comPorta, idDaPorta(comPorta), true)

    const { de, para } = atravessa(288) // faixa 272..304, do outro lado do vão novo
    const destino = resolveTokenMove(de, para, trancada.walls, GRADE)

    expect(destino, `porta trancada e o token passou a 288 — aresta: ${desenho(trancada)}`).toEqual(de)
  })

  it('a porta fechada continua barrando no meio do vão novo (guarda de regressão)', () => {
    const antes = salaComPorta('gate')
    const depois = setWallDoorKind(antes, idDaPorta(antes), 'normal', VAO.normal)

    const { de, para } = atravessa(256) // centro: dentro do vão de 32px
    expect(resolveTokenMove(de, para, depois.walls, GRADE)).toEqual(de)
  })

  it('vão que cresce (normal → portão): o token passa por todo o vão que a porta aberta desenha', () => {
    // Arrange: normal (32) em 240..272; ao virar portão (96) a porta desenha
    // 208..304, mas os sólidos 0..240 e 272..512 continuam onde estavam.
    const antes = salaComPorta('normal')
    const comPortao = setWallDoorKind(antes, idDaPorta(antes), 'gate', VAO.gate)
    const aberta = setWallDoor(comPortao, idDaPorta(comPortao), { open: true, locked: false, kind: 'gate' })

    // Act: token entra pela beirada do vão desenhado (224 está dentro de 208..304).
    const { de, para } = atravessa(224)
    const caminho = findTokenPath(de, para, aberta.walls, GRADE)

    // Assert: o desenho abre 96px; a colisão tem de abrir os mesmos 96px.
    expect(caminho, `porta aberta de 96px e o token barrado a 224 — aresta: ${desenho(aberta)}`).not.toBeNull()
  })
})

describe('setWallDoorKind — porta perto do canto', () => {
  it.each(TIPOS.filter((k) => k !== 'normal'))('porta colada no fim da aresta virando %s não ultrapassa o canto', (para) => {
    // Arrange: clique a 12px do canto de 512 — `addDoorOnWall` clampa o vão em
    // 484..512 (a porta encosta no canto).
    const antes = salaComPorta('normal', ARESTA_COMPRIMENTO - 12)

    const depois = setWallDoorKind(antes, idDaPorta(antes), para, VAO[para])

    const porta = pedacosDaAresta(depois).find((w) => w.door !== null)!
    expect(arred(Math.max(porta.x1, porta.x2)), `porta saiu ${arred(Math.max(porta.x1, porta.x2) - ARESTA_COMPRIMENTO)}px para fora do canto — aresta: ${desenho(depois)}`)
      .toBeLessThanOrEqual(ARESTA_COMPRIMENTO)
  })

  it.each(TIPOS.filter((k) => k !== 'normal'))('porta colada no início da aresta virando %s não ultrapassa o canto', (para) => {
    const antes = salaComPorta('normal', 12)

    const depois = setWallDoorKind(antes, idDaPorta(antes), para, VAO[para])

    const porta = pedacosDaAresta(depois).find((w) => w.door !== null)!
    expect(arred(Math.min(porta.x1, porta.x2)), `porta saiu ${arred(-Math.min(porta.x1, porta.x2))}px para fora do canto — aresta: ${desenho(depois)}`)
      .toBeGreaterThanOrEqual(0)
  })
})

describe('setWallDoorKind — a luz não vaza onde a aresta deveria estar coberta', () => {
  it('portão → normal: a faixa que voltou a ser parede ainda barra a visão', () => {
    // Arrange: mesma sala do teste de colisão. Observador dentro da sala, em
    // x=224 (faixa 208..240), 64px abaixo da aresta.
    const antes = salaComPorta('gate')
    const depois = setWallDoorKind(antes, idDaPorta(antes), 'normal', VAO.normal)
    const origem = { x: 224, y: 64 }
    const alcance = 256

    // Act: o raio exatamente para cima (-π/2) é um dos raios uniformes da
    // varredura (CIRCLE_RAYS = 64), então sai no polígono.
    const poligono = computeVisibility(origem, visionSegments(depois), alcance)
    const paraCima = poligono.filter((p) => Math.abs(p.x - origem.x) < 1e-6 && p.y < origem.y).map((p) => p.y)

    // Assert: a visão para no y=0 da aresta, não segue até o alcance cheio.
    expect(paraCima.length, 'nenhum vértice do polígono na direção de cima').toBeGreaterThan(0)
    const maisLonge = arred(Math.min(...paraCima))
    expect(maisLonge, `a luz vazou ${arred(-maisLonge)}px além da aresta — aresta: ${desenho(depois)}`).toBe(0)
  })
})
