/**
 * SEGURANÇA do "Fora do Chão: livre" (`MapData.offFloor`), no recorte.
 *
 * Com a cena livre a visão do jogador passa da borda do Chão e chega aonde o
 * mestre escondeu coisa. A regra: a cena livre se comporta como a MESMA cena
 * sem nenhuma peça de Chão, e é assim que ela herda, inteiro, o jeito de a
 * cena sem Chão esconder zona oculta, sala secreta e teto fechado (nenhum dos
 * três depende de haver peça de Chão: são contas de ponto dentro de polígono).
 * Por isso a régua aqui é a própria cena sem Chão: o recorte tem de sair
 * IGUAL, fora a pintura do Chão que o jogador pode ver. O pacote de verdade e
 * a memória do explorado estão em `net/hostSession.foraDoChao.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { DENTRO, ESCONDERIJOS, LA_FORA, POSSE, RAIO, cenaLivreComEsconderijo, semChao } from './__fixtures__/foraDoChao'
import { pointInRing } from './floorContour'
import { filterMapForPlayer, type PlayerMapView } from './fogFilter'

/** O recorte sem a pintura do Chão: as peças enviadas, a lembrança delas (`plan.floor`) e a opção da cena. */
function semPintura(view: PlayerMapView): PlayerMapView {
  return { ...view, plan: { ...view.plan, floor: new Map() }, map: { ...view.map, floor: [], offFloor: undefined } }
}

describe('cena com Chão e Fora do Chão LIVRE: o recorte é o da mesma cena sem nenhuma peça de Chão', () => {
  it.each(ESCONDERIJOS)('%s', (tipo) => {
    const cena = cenaLivreComEsconderijo(tipo)
    const visto = filterMapForPlayer(cena, 'p1', POSSE, RAIO)
    expect(semPintura(visto)).toEqual(semPintura(filterMapForPlayer(semChao(cena), 'p1', POSSE, RAIO)))
    // A prova de que a cena está livre: a visão passa da borda do Chão.
    expect(visto.vision.some((anel) => pointInRing(LA_FORA, anel))).toBe(true)
    // O Chão continua pintura: só a peça que o jogador pode ver chega (e só ela é lembrada).
    expect(visto.map.floor.map((f) => f.id)).toEqual(['chao'])
    expect([...visto.plan.floor.keys()]).toEqual(['chao'])
    // O que impede a memória de marcar o esconderijo continua indo ao host.
    const veto = tipo === 'teto fechado' ? visto.roofs : visto.blocked
    expect(veto.some((anel) => pointInRing(DENTRO, anel))).toBe(true)
  })
})
