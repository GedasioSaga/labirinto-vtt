/**
 * O GESTO DO ABISMO no editor (`abismoNoEditor.ts`), fase do pincel
 * (17/11/2026): o traço mostra o buraco enquanto pinta e só grava ao soltar,
 * num passo do desfazer; Alt tapa e deixa ilha; o contorno à mão segue igual.
 *
 * Mapa de 25 x 25 casas de 40 px. O pincel Fino (raio 0,55 quadrado) cava só o
 * quadrado debaixo do ponteiro; o traço de (410, 420) a (590, 420) cava os
 * quadrados 10 a 14 da linha 10.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { useFerramentaDoAbismo } from '../stores/ferramentaDoAbismo'
import { useMapStore } from '../stores/mapStore'
import { AVISO_DE_BURACO_PINTADO, criarGestoDoAbismo } from './abismoNoEditor'

const GRADE = 40

function gestoNovo() {
  const avisos: string[] = []
  let redesenhos = 0
  const gesto = criarGestoDoAbismo({ rascunho: new Graphics(), aoMudarDesenho: () => (redesenhos += 1), avisar: (texto) => avisos.push(texto) })
  return { gesto, avisos, redesenhos: () => redesenhos }
}

const passos = () => useMapStore.getState().past.length
const cavados = () => useMapStore.getState().map.abismoPintado?.quadrados.length ?? 0

/** Um bloco de 5 x 5 quadrados, de (10, 10) a (14, 14), em cinco passadas do pincel Fino num traço só. */
function cavarBloco(gesto: ReturnType<typeof gestoNovo>['gesto']) {
  gesto.comecar({ x: 420, y: 420 }, false)
  for (let linha = 10; linha <= 14; linha += 1) {
    const y = (linha + 0.5) * GRADE
    gesto.mover({ x: 420, y })
    gesto.mover({ x: 580, y })
  }
  gesto.soltar({ x: 580, y: 580 })
}

beforeEach(() => {
  useMapStore.getState().loadMap(createEmptyMap('m', 'M', 25, 25, GRADE))
  useMapStore.getState().setActiveTool('abismo')
  useFerramentaDoAbismo.setState({ modo: 'pincel', pincel: 'fino', brilho: 'brasa', escolhido: null })
})

describe('abismo no editor: o pincel', () => {
  it('mostra o buraco enquanto pinta, grava UM passo ao soltar, e o Alt no meio deixa uma ilha', () => {
    const { gesto, redesenhos } = gestoNovo()
    const antes = passos()

    gesto.comecar({ x: 420, y: 420 }, false)
    gesto.mover({ x: 580, y: 420 })
    // No meio do traço: o desenho já tem o buraco, o mapa ainda não.
    expect(gesto.entrada().abismos?.length).toBe(1)
    expect(redesenhos()).toBeGreaterThan(0)
    expect(cavados()).toBe(0)
    expect(passos()).toBe(antes)
    gesto.soltar({ x: 580, y: 420 })
    expect(cavados()).toBe(5)
    expect(passos()).toBe(antes + 1)
    expect(useMapStore.getState().map.abismoPintado?.quadrados.every((q) => q.brilho === 'brasa')).toBe(true)

    useMapStore.getState().undo()
    expect(cavados()).toBe(0)
    cavarBloco(gesto)
    expect(cavados()).toBe(25)
    const comBloco = passos()

    // Alt no quadrado do meio: tapa só ele, e o buraco ganha uma ilha.
    gesto.comecar({ x: 500, y: 500 }, true)
    gesto.soltar({ x: 500, y: 500 })
    expect(cavados()).toBe(24)
    expect(passos()).toBe(comBloco + 1)
    const buracos = gesto.entrada().abismos ?? []
    expect(buracos.length).toBe(1)
    expect(buracos[0]?.ilhas?.length).toBe(1)

    // Um Ctrl+Z por traço: o primeiro devolve o quadrado do meio, o segundo tira o bloco inteiro.
    useMapStore.getState().undo()
    expect(cavados()).toBe(25)
    useMapStore.getState().undo()
    expect(cavados()).toBe(0)
  })

  it('largar o traço não grava; o buraco pintado não se escolhe, e o contorno à mão continua nascendo', () => {
    const { gesto, avisos } = gestoNovo()
    const antes = passos()
    gesto.comecar({ x: 420, y: 420 }, false)
    gesto.mover({ x: 580, y: 420 })
    gesto.cancelar()
    expect(gesto.entrada().abismos ?? []).toEqual([])
    gesto.soltar({ x: 580, y: 420 })
    expect(cavados()).toBe(0)
    expect(passos()).toBe(antes)

    cavarBloco(gesto)
    useFerramentaDoAbismo.getState().setModo('contornar')
    // Clique dentro do buraco pintado: nada fica escolhido, Delete não apaga, e o aviso diz por onde mexer.
    gesto.comecar({ x: 460, y: 460 }, false)
    gesto.soltar({ x: 460, y: 460 })
    expect(useFerramentaDoAbismo.getState().escolhido).toBeNull()
    expect(avisos).toContain(AVISO_DE_BURACO_PINTADO)
    expect(gesto.apagarEscolhido()).toBe(false)
    expect(cavados()).toBe(25)

    // O contorno à mão, longe do pintado: nasce um abismo contornado e fica escolhido.
    gesto.comecar({ x: 100, y: 100 }, false)
    for (const p of [{ x: 220, y: 100 }, { x: 220, y: 220 }, { x: 100, y: 220 }]) gesto.mover(p)
    gesto.soltar({ x: 100, y: 110 })
    const contornados = useMapStore.getState().map.abismos ?? []
    expect(contornados.length).toBe(1)
    expect(useFerramentaDoAbismo.getState().escolhido).toBe(contornados[0]?.id)
    expect(cavados()).toBe(25)
  })
})
