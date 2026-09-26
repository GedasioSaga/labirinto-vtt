/** @vitest-environment node */
// Lógica pura (sem DOM nem Pixi): o agendador de quadros e as camadas são espiões.
import { describe, expect, it } from 'vitest'
import type { MapData } from '../types/map'
import { createEmptyMap } from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { SHAPES_LAYERS, createShapesRedrawer, type ShapesLayer, type ShapesSnapshot } from './shapesRedraw'
import { LIMIAR_CENA_DENSA, cenaDensa, createMontadorEmFatias } from './montagemEmFatias'

/** Andar com `salas` salas (1 região + 4 paredes cada), ids próprios por cena. */
function andar(id: string, salas: number): MapData {
  const regions: MapData['regions'] = []
  const walls: MapData['walls'] = []
  for (let i = 0; i < salas; i++) {
    const x = (i % 20) * 100
    const y = Math.floor(i / 20) * 100
    const room = buildRoomFromDraft(`${id}-r${i}`, [`${id}-t${i}`, `${id}-d${i}`, `${id}-b${i}`, `${id}-e${i}`], { x, y }, { x: x + 90, y: y + 90 }, undefined, undefined, `Sala ${i}`)
    regions.push(room.region)
    walls.push(...room.walls)
  }
  return { ...createEmptyMap(id, id, 40, 40, 50), regions, walls }
}

function foto(map: MapData): ShapesSnapshot {
  return {
    map,
    selection: EMPTY_SELECTION,
    activeTool: 'select',
    selectedConcealZoneId: null,
    selectedPinId: null,
    travel: [null, null, null],
    cameraScale: 1,
    rendererResolution: 1,
    rotatingRoom: false,
  }
}

const PRIMEIRA: readonly ShapesLayer[] = ['floor', 'gridMask', 'mapLines', 'mapFrame', 'regions', 'walls', 'stairs']
const ADIADAS: readonly ShapesLayer[] = SHAPES_LAYERS.filter((camada) => !PRIMEIRA.includes(camada))

/** Um espião por camada: anota em `pintadas`, na ordem em que o redesenho as chama. */
function espioes(pintadas: ShapesLayer[]): Record<ShapesLayer, () => void> {
  const spy = (camada: ShapesLayer) => () => {
    pintadas.push(camada)
  }
  return {
    floor: spy('floor'),
    gridMask: spy('gridMask'),
    floorSelection: spy('floorSelection'),
    mapLines: spy('mapLines'),
    mapFrame: spy('mapFrame'),
    regions: spy('regions'),
    perigos: spy('perigos'),
    drawings: spy('drawings'),
    hazards: spy('hazards'),
    areaTriggers: spy('areaTriggers'),
    faccoes: spy('faccoes'),
    conveyors: spy('conveyors'),
    roomNames: spy('roomNames'),
    walls: spy('walls'),
    stairs: spy('stairs'),
    lights: spy('lights'),
    watchCones: spy('watchCones'),
    patrolRoutes: spy('patrolRoutes'),
    concealZones: spy('concealZones'),
    pins: spy('pins'),
    textLabels: spy('textLabels'),
    handles: spy('handles'),
    areaOutline: spy('areaOutline'),
  }
}

function montar(mapaInicial: MapData) {
  const pintadas: ShapesLayer[] = []
  const redraw = createShapesRedrawer(espioes(pintadas))
  let atual = mapaInicial
  const fila: { tarefa: () => void; cancelada: boolean }[] = []
  let cancelamentos = 0
  const ocultas = new Set<ShapesLayer>()
  const avisos: boolean[] = []
  const montador = createMontadorEmFatias(redraw, {
    ler: () => foto(atual),
    agendar: (tarefa) => {
      const item = { tarefa, cancelada: false }
      fila.push(item)
      return () => {
        item.cancelada = true
        cancelamentos += 1
      }
    },
    esconder: (camada, oculta) => {
      if (oculta) ocultas.add(camada)
      else ocultas.delete(camada)
    },
    aoMudarMontagem: (montando) => avisos.push(montando),
  })
  /** Roda o próximo quadro agendado (e só ele). Devolve false se não havia nenhum vivo. */
  const quadro = (): boolean => {
    while (fila.length > 0) {
      const item = fila.shift()
      if (item === undefined || item.cancelada) continue
      item.tarefa()
      return true
    }
    return false
  }
  const quadrosAteAcabar = (): number => {
    let n = 0
    while (quadro()) n += 1
    return n
  }
  const trocarPara = (mapa: MapData) => {
    atual = mapa
    return montador.redesenhar(foto(mapa))
  }
  const take = () => pintadas.splice(0, pintadas.length)
  // Montagem do editor: a 1ª pintura é inteira, como sempre foi.
  montador.redesenhar(foto(mapaInicial))
  take()
  return { montador, quadro, quadrosAteAcabar, trocarPara, take, ocultas, avisos, cancelamentos: () => cancelamentos, fila, setAtual: (m: MapData) => (atual = m) }
}

const SALAS_DENSAS = 80

describe('cenaDensa', () => {
  it('andar com muitas salas é denso; sala avulsa não', () => {
    expect(cenaDensa(andar('a09', SALAS_DENSAS))).toBe(true)
    expect(cenaDensa(andar('cozinha', 3))).toBe(false)
    // 80 salas = 80 regiões + 320 paredes, acima do limiar.
    expect(SALAS_DENSAS * 5).toBeGreaterThanOrEqual(LIMIAR_CENA_DENSA)
  })
})

describe('troca de cena em fatias', () => {
  it('trocar para um andar denso pinta só paredes e salas no clique; o resto chega nos quadros seguintes', () => {
    const t = montar(andar('a03', SALAS_DENSAS))
    t.trocarPara(andar('a09', SALAS_DENSAS))
    const noClique = t.take()
    expect(noClique).toEqual(expect.arrayContaining(['floor', 'regions', 'walls']))
    expect(noClique).not.toContain('roomNames')
    expect(noClique).not.toContain('lights')
    expect(noClique).not.toContain('pins')
    for (const camada of noClique) expect(PRIMEIRA).toContain(camada)
    // Camada adiada escondida: não mostra os nomes e pinos do andar anterior por cima do novo.
    expect([...t.ocultas].sort()).toEqual([...ADIADAS].sort())
    expect(t.montador.montando()).toBe(true)
    expect(t.avisos).toEqual([true])

    const quadros = t.quadrosAteAcabar()
    expect(quadros).toBeGreaterThanOrEqual(2)
    const depois = t.take()
    expect(depois).toContain('roomNames')
    expect(depois).toContain('lights')
    expect(depois).toContain('pins')
    for (const camada of depois) expect(ADIADAS).toContain(camada)
    expect(t.ocultas.size).toBe(0)
    expect(t.montador.montando()).toBe(false)
    expect(t.avisos).toEqual([true, false])
  })

  it('nomes de sala e luzes ficam em quadros diferentes (a tarefa longa se divide)', () => {
    const t = montar(andar('a03', SALAS_DENSAS))
    t.trocarPara(andar('a09', SALAS_DENSAS))
    t.take()
    const porQuadro: ShapesLayer[][] = []
    while (t.quadro()) porQuadro.push(t.take())
    const quadroDosNomes = porQuadro.findIndex((q) => q.includes('roomNames'))
    const quadroDasLuzes = porQuadro.findIndex((q) => q.includes('lights'))
    expect(quadroDosNomes).toBeGreaterThanOrEqual(0)
    expect(quadroDasLuzes).toBeGreaterThanOrEqual(0)
    expect(quadroDosNomes).not.toBe(quadroDasLuzes)
  })

  it('cena pequena troca inteira no clique, sem agendar nada', () => {
    const t = montar(andar('cozinha', 3))
    const noClique = t.trocarPara(andar('porao', 3))
    expect(noClique).toEqual(expect.arrayContaining(['regions', 'walls', 'roomNames']))
    expect(t.fila).toHaveLength(0)
    expect(t.ocultas.size).toBe(0)
    expect(t.montador.montando()).toBe(false)
    expect(t.avisos).toEqual([])
  })

  it('redesenho comum durante a montagem não pinta camada adiada com a cena velha nem a mostra antes da hora', () => {
    const t = montar(andar('a03', SALAS_DENSAS))
    const a09 = andar('a09', SALAS_DENSAS)
    t.trocarPara(a09)
    t.take()
    // Ex.: a assinatura das fichas ou dos pinos pede um redesenho no mesmo quadro.
    expect(t.montador.redesenhar(foto(a09), ['pins', 'roomNames'])).toEqual([])
    expect(t.ocultas.has('pins')).toBe(true)
    t.montador.redesenhar(foto(a09))
    expect(t.take()).not.toContain('roomNames')
    t.quadrosAteAcabar()
    expect(t.take()).toEqual(expect.arrayContaining(['roomNames', 'pins']))
    expect(t.ocultas.size).toBe(0)
  })

  it('a fatia seguinte desenha o estado de agora, não o do clique', () => {
    const t = montar(andar('a03', SALAS_DENSAS))
    t.trocarPara(andar('a09', SALAS_DENSAS))
    t.take()
    // Entre o clique e o quadro, o mestre já renomeou uma sala (regiões novas).
    const renomeado = andar('a09', SALAS_DENSAS)
    t.setAtual(renomeado)
    t.quadrosAteAcabar()
    t.take()
    // Se a fatia tivesse usado a foto do clique, o portão veria 'regions' novo agora e repintaria os nomes.
    t.montador.redesenhar(foto(renomeado))
    const depois = t.take()
    expect(depois).toContain('regions')
    expect(depois).not.toContain('roomNames')
  })

  it('trocar de novo no meio da montagem recomeça pela cena nova e cancela o quadro pendente', () => {
    const t = montar(andar('a03', SALAS_DENSAS))
    t.trocarPara(andar('a09', SALAS_DENSAS))
    t.take()
    t.trocarPara(andar('a11', SALAS_DENSAS))
    expect(t.cancelamentos()).toBe(1)
    expect(t.take()).toEqual(expect.arrayContaining(['regions', 'walls']))
    expect([...t.ocultas].sort()).toEqual([...ADIADAS].sort())
    t.quadrosAteAcabar()
    expect(t.take()).toEqual(expect.arrayContaining(['roomNames', 'lights', 'pins']))
    expect(t.ocultas.size).toBe(0)
    expect(t.montador.montando()).toBe(false)
  })

  it('trocar para uma cena pequena no meio da montagem pinta tudo o que faltava no clique', () => {
    const t = montar(andar('a03', SALAS_DENSAS))
    t.trocarPara(andar('a09', SALAS_DENSAS))
    t.take()
    const noClique = t.trocarPara(andar('cozinha', 3))
    expect(noClique).toEqual(expect.arrayContaining(['regions', 'roomNames']))
    expect(t.cancelamentos()).toBe(1)
    expect(t.ocultas.size).toBe(0)
    expect(t.montador.montando()).toBe(false)
    expect(t.quadro()).toBe(false)
    expect(t.avisos).toEqual([true, false])
  })

  it('concluir (exportar imagem) pinta na hora tudo o que faltava', () => {
    const t = montar(andar('a03', SALAS_DENSAS))
    t.trocarPara(andar('a09', SALAS_DENSAS))
    t.take()
    const agora = t.montador.concluir()
    expect(agora).toEqual(expect.arrayContaining(['roomNames', 'lights', 'pins']))
    expect(t.ocultas.size).toBe(0)
    expect(t.montador.montando()).toBe(false)
    expect(t.cancelamentos()).toBe(1)
    expect(t.quadro()).toBe(false)
    // Sem montagem em curso, concluir não pinta nada.
    expect(t.montador.concluir()).toEqual([])
  })

  it('cancelar (editor fechando) desliga o quadro agendado', () => {
    const t = montar(andar('a03', SALAS_DENSAS))
    t.trocarPara(andar('a09', SALAS_DENSAS))
    t.take()
    t.montador.cancelar()
    expect(t.cancelamentos()).toBe(1)
    expect(t.quadro()).toBe(false)
    expect(t.take()).toEqual([])
  })

  it('a primeira pintura do editor (montagem) é inteira mesmo num andar denso', () => {
    const pintadas: ShapesLayer[] = []
    const denso = andar('a09', SALAS_DENSAS)
    let agendados = 0
    const montador = createMontadorEmFatias(createShapesRedrawer(espioes(pintadas)), {
      ler: () => foto(denso),
      agendar: () => {
        agendados += 1
        return () => {}
      },
      esconder: () => {},
    })
    montador.redesenhar(foto(denso))
    expect(pintadas).toEqual(expect.arrayContaining(['regions', 'walls', 'roomNames', 'lights', 'pins']))
    expect(agendados).toBe(0)
  })
})
