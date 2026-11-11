/**
 * O FOGO É LUZ no recorte do jogador (pedido do mestre de 09/11/2026: "na
 * gameplay isso não ilumina nada os jogadores"). À noite a visão cai para o
 * raio do período; além dele só chega o claro das luzes na linha de visão.
 * Os objetos de luz (fogo, fogueira, lareira, fornalha, forno de pão, lampião
 * e as velas do criado-mudo e do candelabro de chão, `lib/luzDoFogo.ts`)
 * contam como luz, ATÉ O TETO: o claro deles só revela o
 * que está dentro da visão cheia do dia de quem olha. Sem o teto, um mapa
 * aberto cheio de fogos entregava de noite o mapa inteiro. Pacote forjado,
 * dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Prop, TipoMobilia, Token } from '../types/map'
import { filterMapForPlayer, raioDaNoite } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const GRID = 50
const HEROI = { x: 1000, y: 1000 }
/** A visão cheia do dia nesta cena: 6 casas. */
const DIA = 6 * GRID
/** 3 casas: o raio da noite da cena (sem `visaoPorPeriodo`, a noite é metade do dia). */
const noite = raioDaNoite(() => 3 * GRID)
const SO_ANA: Record<string, string[]> = { ana: ['heroi'] }

/** Ponto a `casasX`, `casasY` do herói. */
function a(casasX: number, casasY = 0): { x: number; y: number } {
  return { x: HEROI.x + casasX * GRID, y: HEROI.y + casasY * GRID }
}

function ficha(id: string, onde: { x: number; y: number }): Token {
  return { id, characterId: null, name: `ficha-${id}`, x: onde.x, y: onde.y, size: 1, image: null }
}

function fogo(id: string, onde: { x: number; y: number }, extra: Partial<Prop> = {}): Prop {
  return { id, src: '', x: onde.x, y: onde.y, width: GRID, height: GRID, linkedMapPath: null, mobilia: 'fogo', ...extra }
}

function cena(tokens: Token[], props: Prop[]): MapData {
  return { ...createEmptyMap('clareira', 'Clareira', 120, 40, GRID), externa: true, tokens: [ficha('heroi', HEROI), ...tokens], props }
}

/** A fogueira a 5 casas do herói e o guarda a 1,5 casa dela: fora do raio da noite, dentro da visão do dia. */
function clareira(fogueira: Prop): MapData {
  return cena([ficha('guarda', a(5, 1.5))], [fogueira])
}

function oQueChega(map: MapData, raio: number | ((id: string) => number)): { fichas: string[]; objetos: string[] } {
  const recorte = filterMapForPlayer(map, 'ana', SO_ANA, raio).map
  return { fichas: recorte.tokens.map((t) => t.id).sort(), objetos: recorte.props.map((p) => p.id).sort() }
}

describe('à noite o objeto Fogo clareia como um lampião', () => {
  it('o fogo fora do raio da noite e quem está no claro dele chegam ao jogador', () => {
    expect(oQueChega(clareira(fogo('fogueira', a(5))), noite)).toEqual({ fichas: ['guarda', 'heroi'], objetos: ['fogueira'] })
  })

  it('fogo escondido do jogador não clareia nada, e de dia curto a regra é a de antes', () => {
    expect(oQueChega(clareira(fogo('fogueira', a(5), { hidden: true })), noite)).toEqual({ fichas: ['heroi'], objetos: [] })
    // O mesmo raio sem a marca da noite: o fogo fora do raio não revela nada.
    expect(oQueChega(clareira(fogo('fogueira', a(5))), 3 * GRID)).toEqual({ fichas: ['heroi'], objetos: [] })
  })

  it('lampião, fogueira, lareira, fornalha, forno de pão e as velas (criado-mudo e candelabro de chão) também clareiam; lareira e forno apagados, caldeirão e móvel sem fogo não', () => {
    const outrasLuzes: readonly TipoMobilia[] = ['lampiao', 'fogueira', 'lareira', 'fornalha', 'fornoDePao', 'criadoMudo', 'candelabroDeChao']
    for (const mobilia of outrasLuzes) {
      expect(oQueChega(clareira(fogo('luz', a(5), { mobilia })), noite), mobilia).toEqual({ fichas: ['guarda', 'heroi'], objetos: ['luz'] })
    }
    expect(oQueChega(clareira(fogo('luz', a(5), { mobilia: 'lareira', mobiliaForma: 'apagado' })), noite)).toEqual({ fichas: ['heroi'], objetos: [] })
    expect(oQueChega(clareira(fogo('luz', a(5), { mobilia: 'fornoDePao', mobiliaForma: 'apagado' })), noite)).toEqual({ fichas: ['heroi'], objetos: [] })
    // O caldeirão (11/11/2026) tem a brasa só pintada: não é fonte de luz.
    expect(oQueChega(clareira(fogo('luz', a(5), { mobilia: 'caldeirao' })), noite)).toEqual({ fichas: ['heroi'], objetos: [] })
    expect(oQueChega(clareira(fogo('luz', a(5), { mobilia: 'mesa' })), noite)).toEqual({ fichas: ['heroi'], objetos: [] })
  })

  it('as velas (11/11/2026) clareiam menos que o lampião: a do criado-mudo não chega ao guarda a 2,6 casas dela; as cinco do candelabro de chão chegam', () => {
    // No tamanho de partida dos dois (0,6 casa): a vela do criado-mudo alcança 1,9 casa do meio e o candelabro, 2,9.
    const vela = (mobilia: TipoMobilia): MapData => cena([ficha('guarda', a(5, 2.6))], [fogo('luz', a(5), { mobilia, width: 0.6 * GRID, height: 0.6 * GRID })])
    expect(oQueChega(vela('criadoMudo'), noite)).toEqual({ fichas: ['heroi'], objetos: ['luz'] })
    expect(oQueChega(vela('candelabroDeChao'), noite)).toEqual({ fichas: ['guarda', 'heroi'], objetos: ['luz'] })
  })
})

describe('o teto da luz dos objetos: de noite o jogador nunca recebe mais do que de dia', () => {
  it('a ficha a 45 casas, junto de um fogo, não chega; a que está junto de um fogo dentro do teto chega', () => {
    const map = cena([ficha('guarda', a(5, 1.5)), ficha('vigia', a(45, 1.5))], [fogo('perto', a(5)), fogo('longe', a(45))])
    expect(oQueChega(map, noite)).toEqual({ fichas: ['guarda', 'heroi'], objetos: ['perto'] })
  })

  it('o fogo com o centro além do teto só clareia o pedaço de dentro, e tudo o que chega de noite chegaria de dia', () => {
    // O fogo a 7 casas (além das 6 do dia) clareia até 2,3 casas do herói: o batedor a 5,5 casas chega, o fogo e o vigia a 8 não.
    const map = cena([ficha('batedor', a(5.5)), ficha('vigia', a(8))], [fogo('beira', a(7))])
    const deNoite = oQueChega(map, noite)
    expect(deNoite).toEqual({ fichas: ['batedor', 'heroi'], objetos: [] })
    const deDia = oQueChega(map, DIA)
    expect(deNoite.fichas.filter((id) => !deDia.fichas.includes(id))).toEqual([])
    expect(deNoite.objetos.filter((id) => !deDia.objetos.includes(id))).toEqual([])
  })
})
