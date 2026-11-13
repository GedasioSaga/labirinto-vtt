/**
 * A IMAGEM PARA OS JOGADORES PELA SILHUETA (caça de 12/11/2026, decisão 36 do
 * mestre): sem "Incluir objetos só do mestre", sala secreta, zona oculta e casa
 * de teto fechado levam junto o objeto com QUALQUER ponta lá dentro, como na
 * tela do jogador (`propSamplePoints`, `objetoEscondidoDosJogadores` em
 * `lib/fogFilter.ts`). Antes a imagem olhava só o centro: o armário com o
 * centro no corredor e a ponta na sala secreta saía no PNG. Vale também para o
 * desenho que encosta na zona oculta e para a luz presa numa ficha que não
 * sai. O DESENHO na sala secreta segue a tela do jogador (decisão 21): some o
 * que mora nela (a maioria das amostras); o que só atravessa sai inteiro.
 * Prova: a imagem é IGUAL à da cena sem a sala, a zona e o que elas escondem.
 */
import { describe, expect, it } from 'vitest'
import type { ConcealZone, Drawing, Light, MapData, PinceladaDeTextura, Prop, Region, Token, Wall } from '../types/map'
import { amostrasDaCercaCurva } from './cercaCurva'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { mapForImageExport } from './mapImageExport'
import { criarMovel } from './mobilia'
import { pointInPolygonInclusive } from './roomNesting'

const G = 50
const SEM_MESTRE = { grid: false, masterOnly: false }
const COM_MESTRE = { grid: false, masterOnly: true }

function retangulo(x1: number, y1: number, x2: number, y2: number) {
  return [
    { x: x1 * G, y: y1 * G },
    { x: x2 * G, y: y1 * G },
    { x: x2 * G, y: y2 * G },
    { x: x1 * G, y: y2 * G },
  ]
}

function sala(id: string, x1: number, y1: number, x2: number, y2: number, room: Region['room'], extra: Partial<Region> = {}): Region {
  return { id, points: retangulo(x1, y1, x2, y2), tag: '', fillColor: '#333', fillPattern: 'solid', data: {}, room, ...extra }
}

function contorno(regionId: string, x1: number, y1: number, x2: number, y2: number): Wall[] {
  const p = retangulo(x1, y1, x2, y2)
  return p.map((a, i) => {
    const b = p[(i + 1) % p.length]
    return { id: `${regionId}-${i}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, blocksLight: true, blocksMove: true, door: null, regionId }
  })
}

function movel(id: string, mobilia: Prop['mobilia'], x: number, y: number, largura: number, altura: number, extra: Partial<Prop> = {}): Prop {
  return { id, src: '', x: x * G, y: y * G, width: largura * G, height: altura * G, linkedMapPath: null, mobilia, ...extra }
}

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: x * G, y: y * G, size: 1, image: null, ...extra }
}

function luz(id: string, x: number, y: number, extra: Partial<Light> = {}): Light {
  return { id, x: x * G, y: y * G, radius: 3 * G, color: '#ffcc66', intensity: 0.8, ...extra }
}

function cena(patch: Partial<MapData>): MapData {
  return { ...createEmptyMap('m', 'Cripta do Farol', 30, 20, G), ...patch }
}

/** O cofre: sala secreta de (10,2) a (14,6), com as paredes dela. */
const COFRE = sala('cofre', 10, 2, 14, 6, { shape: 'rect', name: 'Cofre' }, { secret: true })
const PAREDES_DO_COFRE = contorno('cofre', 10, 2, 14, 6)
/** A emboscada: zona oculta ativa de (20,2) a (24,6). */
const ZONA: ConcealZone = { id: 'emboscada', name: 'Emboscada', revealed: false, points: retangulo(20, 2, 24, 6) }
/** A casa de teto fechado de (2,12) a (7,16): ela fica (telhado cheio), o interior não. */
const CASA = sala('casa', 2, 12, 7, 16, { shape: 'rect', name: 'Casa', roof: true })
const PAREDES_DA_CASA = contorno('casa', 2, 12, 7, 16)

describe('imagem para os jogadores pela silhueta', () => {
  it('objeto com o centro fora e só uma ponta na sala secreta, na zona oculta ou sob o teto fechado não sai; o encostado por fora fica', () => {
    // Encostada na parede oeste do cofre pelo corredor (a borda leste em cima da parede): fica, como na tela do jogador.
    const estante = movel('estante-encostada', 'estanteDeLivros', 9, 3, 2, 1)
    // Centro em x = 9,5 (corredor); a ponta leste entra meia casa no cofre.
    const armario = movel('armario-ponta', 'armario', 9.5, 4.5, 2, 1)
    // Centro em x = 19,7 (fora da zona); a ponta leste entra 0,2 casa nela.
    const barril = movel('barril-ponta', 'barril', 19.7, 4, 1, 1)
    // Centro em x = 7,5 (fora da casa); a ponta oeste entra 0,2 casa sob o telhado.
    const banco = movel('banco-ponta', 'bancoDePraca', 7.5, 14, 1.4, 1)
    // CERCA CURVA ao sul da casa: a caixa reta fica toda fora; a barriga do arco entra sob o telhado.
    const cercaReta = { ...criarMovel('cerca', { x: 4.5 * G, y: 16.6 * G }, G, 'cerca-curva'), width: 4 * G }
    const cerca = [90, -90]
      .map((volta): Prop => ({ ...cercaReta, mobiliaCurva: volta }))
      .find((c) => (amostrasDaCercaCurva(c)[2]?.y ?? Infinity) < 16 * G)
    if (cerca === undefined) throw new Error('a cerca não curvou para dentro da casa')
    const meiaEspessura = cerca.height / 2
    expect([cerca.y - meiaEspessura, cerca.y + meiaEspessura].every((y) => y > 16 * G)).toBe(true)
    expect(amostrasDaCercaCurva(cerca).some((p) => pointInPolygonInclusive(p, CASA.points))).toBe(true)
    // Nenhum dos de ponta tem o centro no lugar escondido: a regra antiga (só o centro) os deixava sair.
    for (const p of [armario, barril, banco, cerca]) {
      expect([COFRE.points, ZONA.points, CASA.points].some((anel) => pointInPolygonInclusive({ x: p.x, y: p.y }, anel)), p.id).toBe(false)
    }

    const sem = cena({ regions: [CASA], walls: PAREDES_DA_CASA, props: [estante] })
    const com = cena({
      regions: [CASA, COFRE],
      walls: [...PAREDES_DA_CASA, ...PAREDES_DO_COFRE],
      concealZones: [ZONA],
      props: [estante, armario, barril, banco, cerca],
    })
    const imagem = mapForImageExport(com, SEM_MESTRE)
    expect(imagem).toEqual(mapForImageExport(sem, SEM_MESTRE))
    expect(imagem.props.map((p) => p.id)).toEqual(['estante-encostada'])
    // A imagem do mestre leva tudo.
    expect(mapForImageExport(com, COM_MESTRE).props.map((p) => p.id)).toEqual(['estante-encostada', 'armario-ponta', 'barril-ponta', 'banco-ponta', 'cerca-curva'])
  })

  it('desenho que mora na sala secreta ou encosta na zona oculta e luz presa em ficha que não sai também não saem; o resto fica', () => {
    const desenho = (d: Drawing): Drawing => d
    // Fica: longe de tudo.
    const rua = desenho({ id: 'rua', kind: 'rect', x: 2 * G, y: 8 * G, w: 6 * G, h: G, color: '#776655', width: 1, filled: true, fillAlpha: 1 })
    // Fica (decisão 21, a régua da tela do jogador): retângulo com o centro no corredor e o canto nordeste meia casa
    // dentro do cofre. Só 2 das 5 amostras estão lá: ele não mora no cofre.
    const tapete = desenho({ id: 'tapete-canto', kind: 'rect', x: 8 * G, y: 4.5 * G, w: 2.5 * G, h: G, color: '#aa3333', width: 1, filled: true, fillAlpha: 1 })
    // Círculo com o centro fora da zona e a borda leste 0,2 casa dentro dela: a zona leva o que encosta.
    const mancha = desenho({ id: 'mancha-zona', kind: 'circle', cx: 19 * G, cy: 4 * G, radius: 1.2 * G, color: '#335533', width: 1, filled: true, fillAlpha: 1 })
    // Fica: linha que atravessa o cofre, as duas pontas no corredor e o meio dentro.
    const trilha = desenho({ id: 'trilha', kind: 'line', x1: 9 * G, y1: 3 * G, x2: 15 * G, y2: 3 * G, color: '#000', width: 2 })
    // O piso do cofre desenhado 2 px maior que ele: nenhum vértice dentro, mas todas as amostras: mora no cofre.
    const piso = desenho({
      id: 'piso-do-cofre',
      kind: 'polygon',
      points: [
        { x: 10 * G - 2, y: 2 * G - 2 },
        { x: 14 * G + 2, y: 2 * G - 2 },
        { x: 14 * G + 2, y: 6 * G + 2 },
        { x: 10 * G - 2, y: 6 * G + 2 },
      ],
      color: '#554433',
      width: 1,
      filled: true,
      fillAlpha: 1,
    })
    const heroi = ficha('heroi', 3, 9)
    const lanterna = luz('lanterna-do-heroi', 3, 9, { attachedTokenId: 'heroi' })
    const lampiao = luz('lampiao-solto', 5, 9)
    // O guarda está no cofre; a tocha dele foi empurrada pelas setas para o corredor.
    const guarda = ficha('guarda', 12, 4)
    const tochaDoGuarda = luz('tocha-do-guarda', 9, 4, { attachedTokenId: 'guarda' })
    // A espiã é "Oculta para jogadores" no corredor; o lampião dela, ao lado.
    const espia = ficha('espia', 25, 10, { secret: true })
    const lampiaoDaEspia = luz('lampiao-da-espia', 25.4, 10, { attachedTokenId: 'espia' })
    // O fantasma é "Oculto no editor"; a vela dele, afastada.
    const fantasma = ficha('fantasma', 27, 14, { hidden: true })
    const velaDoFantasma = luz('vela-do-fantasma', 27.5, 14, { attachedTokenId: 'fantasma' })
    // Vínculo com ficha que não existe mais (mapa antigo): a luz fica.
    const orfa = luz('luz-orfa', 6, 18, { attachedTokenId: 'ficha-apagada' })

    const sem = cena({ tokens: [heroi], lights: [lanterna, lampiao, orfa], drawings: [rua, tapete, trilha] })
    const com = cena({
      regions: [COFRE],
      walls: PAREDES_DO_COFRE,
      concealZones: [ZONA],
      tokens: [heroi, guarda, espia, fantasma],
      lights: [lanterna, lampiao, tochaDoGuarda, lampiaoDaEspia, velaDoFantasma, orfa],
      drawings: [rua, tapete, mancha, trilha, piso],
    })
    const imagem = mapForImageExport(com, SEM_MESTRE)
    expect(imagem).toEqual(mapForImageExport(sem, SEM_MESTRE))
    expect(imagem.drawings.map((d) => d.id)).toEqual(['rua', 'tapete-canto', 'trilha'])
    expect(imagem.lights.map((l) => l.id)).toEqual(['lanterna-do-heroi', 'lampiao-solto', 'luz-orfa'])
    const doMestre = mapForImageExport(com, COM_MESTRE)
    expect(doMestre.drawings.map((d) => d.id)).toEqual(['rua', 'tapete-canto', 'mancha-zona', 'trilha', 'piso-do-cofre'])
    expect(doMestre.lights.map((l) => l.id)).toEqual(['lanterna-do-heroi', 'lampiao-solto', 'tocha-do-guarda', 'lampiao-da-espia', 'vela-do-fantasma', 'luz-orfa'])
  })

  it('a estrada que só atravessa a sala secreta sai inteira, como na tela do jogador; o tapete que mora nela não sai', () => {
    // Caminho de oeste a leste pelo meio do cofre (x de 10 a 14): 2 dos 5 pontos lá dentro.
    const estrada: Drawing = {
      id: 'estrada',
      kind: 'path',
      points: [4, 8, 11, 13, 18].map((x) => ({ x: x * G, y: 4 * G })),
      color: '#8a7350',
      width: 0.8 * G,
    }
    // Faixa de terra pintada que cruza o cofre: só o centróide das 5 amostras cai lá.
    const faixa: Drawing = { id: 'faixa', kind: 'polygon', points: retangulo(6, 3.6, 18, 4.4), color: '#6b5a3a', width: 1, filled: true, fillAlpha: 1 }
    // O tapete MORA no cofre e passa meia casa da parede leste: 3 das 5 amostras lá dentro.
    const tapete: Drawing = { id: 'tapete', kind: 'rect', x: 11 * G, y: 3 * G, w: 3.5 * G, h: 2 * G, color: '#aa3333', width: 1, filled: true, fillAlpha: 1 }
    const baldeNaFaixa: PinceladaDeTextura = { id: 'b-faixa', tipo: 'balde', textura: 'terra', forca: 1, alvo: { tipo: 'desenho', id: 'faixa' } }
    const baldeNoTapete: PinceladaDeTextura = { id: 'b-tapete', tipo: 'balde', textura: 'campo', forca: 1, alvo: { tipo: 'desenho', id: 'tapete' } }
    const heroi = ficha('heroi', 12, 9)

    const sem = cena({ tokens: [heroi], drawings: [estrada, faixa], texturas: [baldeNaFaixa] })
    const com = cena({ regions: [COFRE], walls: PAREDES_DO_COFRE, tokens: [heroi], drawings: [estrada, faixa, tapete], texturas: [baldeNaFaixa, baldeNoTapete] })
    const imagem = mapForImageExport(com, SEM_MESTRE)
    expect(imagem).toEqual(mapForImageExport(sem, SEM_MESTRE))
    // Inteiras, sem corte na borda do cofre, e com a textura da faixa.
    expect(imagem.drawings).toEqual([estrada, faixa])
    expect(imagem.texturas?.map((p) => p.id)).toEqual(['b-faixa'])
    // A tela do jogador, com o herói vendo o corredor, recebe os mesmos desenhos.
    const tela = filterMapForPlayer(com, 'p1', { p1: ['heroi'] }, 20 * G).map
    expect(tela.drawings.map((d) => d.id)).toEqual(['estrada', 'faixa'])
    // O mestre leva o tapete.
    expect(mapForImageExport(com, COM_MESTRE).drawings.map((d) => d.id)).toEqual(['estrada', 'faixa', 'tapete'])
  })
})
