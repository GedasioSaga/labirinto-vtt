import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import * as mapFactory from '../lib/mapFactory'
import { segmentosDasParedesPresas } from '../lib/paredesDoDesenho'
import { idDaParedePresa } from '../lib/paredesPresas'
import type { Drawing, MapData, ParedesDoDesenho, Wall } from '../types/map'

/**
 * PAREDES AO REDOR na store: as paredes presas acompanham o desenho por
 * QUALQUER caminho que o mude — ligar, mover (ao vivo), alça, borracha que
 * divide, apagar, duplicar, desfazer, soltar — e cada gesto do painel é UM
 * Ctrl+Z. Pedido de 08/10/2026 (ver `lib/paredesPresas.ts`).
 */

const LIGADAS: ParedesDoDesenho = { ativo: true, invisivel: false, passagem: 'bloqueia' }

const traco: Drawing = {
  id: 't1',
  kind: 'freehand',
  points: Array.from({ length: 101 }, (_, i) => ({ x: 100 + i * 2, y: 200 + 10 * Math.sin(i / 10) })),
  color: '#222',
  width: 4,
}

const retangulo: Drawing = { id: 'r1', kind: 'rect', x: 400, y: 100, w: 120, h: 80, color: '#222', width: 4, filled: false, fillAlpha: 0 }

const comum: Wall = { id: 'w1', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null }

const mapa = (): MapData => useMapStore.getState().map
const desenho = (id: string): Drawing | undefined => mapa().drawings.find((d) => d.id === id)
const presas = (id: string): Wall[] => mapa().walls.filter((w) => w.desenhoId === id)
const pontas = (paredes: readonly Wall[]) => paredes.map(({ x1, y1, x2, y2 }) => ({ x1, y1, x2, y2 }))

function contornoAtual(id: string) {
  const d = desenho(id)
  if (d === undefined) throw new Error(`sem o desenho ${id}`)
  return segmentosDasParedesPresas(d)
}

describe('mapStore — paredes ao redor do desenho', () => {
  beforeEach(() => {
    useMapStore.getState().loadMap({ ...mapFactory.createEmptyMap('m', 'M', 20, 12, 64), drawings: [traco, retangulo], walls: [comum] })
  })

  it('ligar cria uma parede presa por segmento, com desenhoId e ids determinísticos; é UM Ctrl+Z', () => {
    useMapStore.getState().setParedesDoDesenho('t1', LIGADAS)
    const minhas = presas('t1')
    expect(minhas.length).toBe(contornoAtual('t1').length)
    expect(minhas.map((p) => p.id)).toEqual(minhas.map((_, i) => idDaParedePresa('t1', i)))
    expect(minhas.every((p) => p.blocksMove && p.blocksLight && p.thickness === 'thin')).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(mapa().walls).toEqual([comum])
    useMapStore.getState().redo()
    expect(presas('t1')).toEqual(minhas)
  })

  it('desligar e religar volta com os mesmos ids', () => {
    const store = useMapStore.getState()
    store.setParedesDoDesenho('t1', LIGADAS)
    const ids = presas('t1').map((p) => p.id)
    store.setParedesDoDesenho('t1', { ativo: false })
    expect(presas('t1')).toEqual([])
    expect(desenho('t1')?.paredes).toEqual({ ...LIGADAS, ativo: false })
    store.setParedesDoDesenho('t1', { ativo: true })
    expect(presas('t1').map((p) => p.id)).toEqual(ids)
  })

  it('escolher Invisível esconde as presas do jogador e passa para "Vê mas não passa" no mesmo passo', () => {
    const store = useMapStore.getState()
    store.setParedesDoDesenho('t1', LIGADAS)
    store.setParedesDoDesenho('t1', { invisivel: true })
    expect(desenho('t1')?.paredes).toEqual({ ativo: true, invisivel: true, passagem: 'janela' })
    expect(presas('t1').every((p) => p.hidden === true && p.blocksLight === false && p.blocksMove)).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(2)
  })

  it('a cor no seletor contínuo (um evento por quadro) é UM Ctrl+Z; "Padrão" é outro', () => {
    const store = useMapStore.getState()
    store.setParedesDoDesenho('t1', LIGADAS)
    store.setParedesDoDesenho('t1', { cor: '#110000' })
    store.setParedesDoDesenho('t1', { cor: '#220000' })
    store.setParedesDoDesenho('t1', { cor: '#330000' })
    expect(presas('t1').every((p) => p.color === '#330000')).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(2)
    store.setParedesDoDesenho('t1', { cor: undefined })
    expect(presas('t1').every((p) => p.color === undefined)).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(3)
    useMapStore.getState().undo()
    useMapStore.getState().undo()
    expect(presas('t1').every((p) => p.color === undefined)).toBe(true)
    expect(presas('t1').length).toBeGreaterThan(0)
  })

  it('mexer na opção sem mudar nada não gasta Ctrl+Z', () => {
    const store = useMapStore.getState()
    store.setParedesDoDesenho('t1', LIGADAS)
    store.setParedesDoDesenho('t1', { passagem: 'bloqueia' })
    expect(useMapStore.getState().past).toHaveLength(1)
  })

  it('mover ao vivo leva as presas junto, sem nenhuma no lugar antigo; desfazer volta as de antes', () => {
    const store = useMapStore.getState()
    store.setParedesDoDesenho('t1', LIGADAS)
    const antes = mapa()
    const velhas = presas('t1')
    store.moveDrawingLive('t1', 10, 0)
    store.moveDrawingLive('t1', 10, 5)
    store.moveDrawingLive('t1', 12.5, 5)
    store.commitDragHistory(antes)
    const novas = presas('t1')
    expect(novas).toHaveLength(velhas.length)
    novas.forEach((p, i) => {
      expect(p.x1).toBeCloseTo(velhas[i].x1 + 32.5, 1)
      expect(p.y1).toBeCloseTo(velhas[i].y1 + 10, 1)
    })
    expect(mapa().walls).toHaveLength(velhas.length + 1)
    useMapStore.getState().undo()
    expect(presas('t1')).toEqual(velhas)
  })

  it('mover pela seleção (setas) leva as presas', () => {
    const store = useMapStore.getState()
    store.setParedesDoDesenho('r1', LIGADAS)
    const velhas = presas('r1')
    store.setSelection([{ kind: 'drawing', id: 'r1' }])
    store.moveSelectionBy(64, 0)
    expect(pontas(presas('r1'))).toEqual(pontas(velhas).map((s) => ({ x1: s.x1 + 64, y1: s.y1, x2: s.x2 + 64, y2: s.y2 })))
  })

  it('arrastar uma alça refaz as presas pelo contorno novo', () => {
    const store = useMapStore.getState()
    store.setParedesDoDesenho('t1', LIGADAS)
    const antes = mapa()
    store.updateDrawingKeyPointLive(antes, 't1', 1, 200, 320)
    expect(pontas(presas('t1'))).toEqual(contornoAtual('t1'))
    store.commitDragHistory(antes)
    expect(store.insertDrawingKeyPoint('t1', 0)).not.toBeNull()
    expect(pontas(presas('t1'))).toEqual(contornoAtual('t1'))
  })

  it('canto do retângulo e espessura ao vivo refazem as presas', () => {
    const store = useMapStore.getState()
    store.setParedesDoDesenho('r1', LIGADAS)
    store.resizeDrawingCornerLive('r1', 2, 600, 300, { shift: false, alt: false })
    expect(pontas(presas('r1'))).toEqual(contornoAtual('r1'))
    store.setDrawingWidthLive('r1', 16)
    expect(pontas(presas('r1'))).toEqual(contornoAtual('r1'))
  })

  it('a borracha que divide o traço: cada pedaço herda as paredes e ganha as próprias presas', () => {
    const store = useMapStore.getState()
    store.setParedesDoDesenho('t1', { ...LIGADAS, cor: '#00ff00' })
    // Em cima do ponto do meio do traço (i = 50).
    store.erasePartOfDrawing('t1', { x: 200, y: 200 + 10 * Math.sin(5) }, 8)
    const pedacos = mapa().drawings.filter((d) => d.kind === 'freehand')
    expect(pedacos).toHaveLength(2)
    expect(presas('t1')).toEqual([])
    for (const pedaco of pedacos) {
      expect(pedaco.paredes).toEqual({ ...LIGADAS, cor: '#00ff00' })
      const minhas = presas(pedaco.id)
      expect(minhas.length).toBe(segmentosDasParedesPresas(pedaco).length)
      expect(minhas.every((p) => p.color === '#00ff00')).toBe(true)
    }
  })

  it('apagar o desenho apaga as presas (e só elas)', () => {
    const store = useMapStore.getState()
    store.setParedesDoDesenho('t1', LIGADAS)
    store.setParedesDoDesenho('r1', LIGADAS)
    store.setSelection([{ kind: 'drawing', id: 't1' }])
    store.removeSelected()
    expect(presas('t1')).toEqual([])
    expect(presas('r1').length).toBeGreaterThan(0)
    store.removeDrawing('r1')
    expect(mapa().walls).toEqual([comum])
  })

  it('duplicar o desenho: a cópia ganha presas próprias', () => {
    const store = useMapStore.getState()
    store.setParedesDoDesenho('r1', LIGADAS)
    store.setSelection([{ kind: 'drawing', id: 'r1' }])
    store.duplicateSelected()
    const copia = mapa().drawings.find((d) => d.kind === 'rect' && d.id !== 'r1')
    expect(copia).toBeDefined()
    if (copia === undefined) return
    expect(presas(copia.id).length).toBe(presas('r1').length)
    expect(presas(copia.id)[0].id).toBe(idDaParedePresa(copia.id, 0))
  })

  it('soltar: as presas viram paredes comuns, o desenho desliga as paredes; é UM Ctrl+Z', () => {
    const store = useMapStore.getState()
    store.setParedesDoDesenho('t1', { ...LIGADAS, cor: '#123456' })
    const quantas = presas('t1').length
    store.soltarParedesDoDesenho('t1')
    expect(presas('t1')).toEqual([])
    expect(mapa().walls).toHaveLength(quantas + 1)
    expect(mapa().walls.filter((w) => w.color === '#123456' && w.desenhoId === undefined)).toHaveLength(quantas)
    expect(desenho('t1')?.paredes).toEqual({ ...LIGADAS, ativo: false, cor: '#123456' })
    // Soltas, mover o desenho não leva as paredes.
    const soltas = mapa().walls
    store.moveDrawing('t1', 50, 50)
    expect(mapa().walls).toBe(soltas)
    store.undo()
    store.undo()
    expect(presas('t1')).toHaveLength(quantas)
  })

  it('presa apagada ou arrastada sozinha volta: ela é parte do desenho', () => {
    const store = useMapStore.getState()
    store.setParedesDoDesenho('t1', LIGADAS)
    const certas = presas('t1')
    store.removeWall(certas[0].id)
    expect(presas('t1')).toEqual(certas)
    store.moveWall(certas[1].id, 30, 30)
    expect(presas('t1')).toEqual(certas)
  })

  it('abrir mapa e trocar de cena por setState: desenho com paredes ligadas e sem presas ganha as presas', () => {
    const cena: MapData = { ...mapFactory.createEmptyMap('cena2', 'Cena 2', 20, 12, 64), drawings: [{ ...retangulo, paredes: LIGADAS }] }
    useMapStore.setState({ map: cena })
    expect(presas('r1')).toHaveLength(8)
    useMapStore.getState().loadMap({ ...cena, id: 'cena3' })
    expect(presas('r1')).toHaveLength(8)
  })
})
