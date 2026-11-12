import { describe, expect, it } from 'vitest'
import type { AlvoDoBalde, CamadaId, MapData, Region, RegionPoint, Token, Wall } from '../types/map'
import { areaFechadaPorParedes } from './baldeDeTinta'
import { createExploration, markRings } from './exploration'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { mapForImageExport } from './mapImageExport'

/**
 * TEXTURA NA ÁREA FECHADA POR PAREDES (balde de um clique, 30f2b315): o passo
 * guarda o contorno da área, só os cantos. Num salão grande de paredes soltas,
 * o jogador no meio com visão curta não via nenhum canto, e o chão saía sem a
 * textura. Agora a área sai quando a visão dele ENTRA nela, ou quando ele já
 * explorou um ponto de dentro — a mesma régua do desenho com área.
 *
 * Geometria (px de mundo, mapa 3000x1000, grade 40): salão 100..2900 x
 * 100..900 de quatro paredes soltas; a ficha em (2200, 500), visão de 150.
 */
const SALAO: AlvoDoBalde = {
  tipo: 'area',
  pontos: [
    { x: 100, y: 100 },
    { x: 2900, y: 100 },
    { x: 2900, y: 900 },
    { x: 100, y: 900 },
  ],
}
const parede = (id: string, x1: number, y1: number, x2: number, y2: number): Wall => ({ id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null })
const PAREDES = [parede('n', 100, 100, 2900, 100), parede('l', 2900, 100, 2900, 900), parede('s', 2900, 900, 100, 900), parede('o', 100, 900, 100, 100)]
const RAIO = 150
const POSSE = { p1: ['heroi'] }
const heroi = (x: number, y: number): Token => ({ id: 'heroi', characterId: null, name: 'heroi', x, y, size: 1, image: null })

function cena(ficha: Token, alvo: AlvoDoBalde = SALAO, extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m', 'M', 3000, 1000, 40),
    walls: PAREDES,
    texturas: [{ id: 'lajotas', tipo: 'balde', textura: 'lajotas', forca: 1, alvo }],
    tokens: [ficha],
    ...extra,
  }
}

const passos = (m: MapData): string[] => (m.texturas ?? []).map((t) => t.id)

describe('textura na área de paredes soltas', () => {
  it('o jogador no meio do salão, sem ver canto nenhum, recebe a textura da área; o explorado de dentro também a traz', () => {
    expect(passos(filterMapForPlayer(cena(heroi(2200, 500)), 'p1', POSSE, RAIO).map), 'a visão está dentro da área e a textura não veio').toEqual(['lajotas'])

    // Explorou um pedaço do meio e agora está fora do salão, sem ver nada dele.
    const explorado = createExploration(cena(heroi(0, 0)))
    markRings(explorado, [[{ x: 1800, y: 400 }, { x: 2000, y: 400 }, { x: 2000, y: 600 }, { x: 1800, y: 600 }]])
    expect(passos(filterMapForPlayer(cena(heroi(1500, 980)), 'p1', POSSE, 10, explorado).map)).toEqual(['lajotas'])
  })

  it('SEGURANÇA: fora do salão sem ter explorado não sai; a área que contorna sala secreta não sai pela regra nova', () => {
    expect(passos(filterMapForPlayer(cena(heroi(1500, 980)), 'p1', POSSE, 10).map)).toEqual([])

    // O contorno da área segue as paredes da sala secreta no pé do salão: levaria a silhueta dela.
    const cofre: Region = {
      id: 'cofre',
      points: [
        { x: 1400, y: 820 },
        { x: 1600, y: 820 },
        { x: 1600, y: 900 },
        { x: 1400, y: 900 },
      ],
      tag: '',
      fillColor: '#123',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'cofre' },
      secret: true,
    }
    const comEntalhe: AlvoDoBalde = {
      tipo: 'area',
      pontos: [{ x: 100, y: 100 }, { x: 2900, y: 100 }, { x: 2900, y: 900 }, { x: 1600, y: 900 }, { x: 1600, y: 820 }, { x: 1400, y: 820 }, { x: 1400, y: 900 }, { x: 100, y: 900 }],
    }
    expect(passos(filterMapForPlayer(cena(heroi(2200, 500), comEntalhe, { regions: [cofre] }), 'p1', POSSE, RAIO).map)).toEqual([])
    // Controle: a mesma sala, não secreta, deixa a regra nova valer.
    expect(passos(filterMapForPlayer(cena(heroi(2200, 500), comEntalhe, { regions: [{ ...cofre, secret: false }] }), 'p1', POSSE, RAIO).map)).toEqual(['lajotas'])
  })
})

/**
 * SILHUETA DA SALA SECRETA (12/11/2026): o cofre secreto solto no meio de um
 * salão de paredes soltas. O contorno da área do salão, feito pela enchente de
 * verdade, tem um BURACO no formato do cofre. Enquanto o cofre é secreto, nem a
 * tela do jogador (pelo canto que ele conhece ou por dentro) nem a imagem
 * exportada podem levar esse buraco. As paredes do cofre ficam em cima da borda
 * dele (a ferramenta de sala) ou a 3 px para fora (desenhadas à mão: o furo).
 *
 * Geometria (mapa 35x25 de 40 px): salão 140..1260 x 140..860; cofre
 * 560..840 x 420..630; o clique do balde em (300, 300).
 */
const SEM_O_MESTRE = { grid: false, masterOnly: false }

function salaoComCofre(afastamento: number, secreto: boolean): MapData {
  const cofre: Region = {
    id: 'cofre',
    points: [
      { x: 560, y: 420 },
      { x: 840, y: 420 },
      { x: 840, y: 630 },
      { x: 560, y: 630 },
    ],
    tag: '',
    fillColor: '#123',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'cofre' },
    secret: secreto,
  }
  const a = afastamento
  const cantos: RegionPoint[] = [
    { x: 560 - a, y: 420 - a },
    { x: 840 + a, y: 420 - a },
    { x: 840 + a, y: 630 + a },
    { x: 560 - a, y: 630 + a },
  ]
  const paredesDoCofre = cantos.map((p, i): Wall => ({ ...parede(`c${i}`, p.x, p.y, cantos[(i + 1) % 4].x, cantos[(i + 1) % 4].y), regionId: 'cofre' }))
  const salao = [parede('n', 140, 140, 1260, 140), parede('l', 1260, 140, 1260, 860), parede('s', 1260, 860, 140, 860), parede('o', 140, 860, 140, 140)]
  const base: MapData = { ...createEmptyMap('m', 'M', 35, 25, 40), walls: [...salao, ...paredesDoCofre], regions: [cofre] }
  const area = areaFechadaPorParedes(base, { x: 300, y: 300 })
  if (area === null) throw new Error('o salão não fechou')
  return { ...base, texturas: [{ id: 'lajotas', tipo: 'balde', textura: 'lajotas', forca: 1, alvo: { tipo: 'area', pontos: area } }] }
}

describe('textura na área em volta de sala secreta', () => {
  it('SEGURANÇA: com o cofre secreto, a área com o buraco dele não sai para o jogador (canto conhecido ou por dentro) nem na imagem exportada', () => {
    const vazou = [0, 3].flatMap((afastamento) => {
      const m = salaoComCofre(afastamento, true)
      const saidas: [string, MapData][] = [
        ['imagem', mapForImageExport(m, SEM_O_MESTRE)],
        // Vê o canto (140, 140) do salão: a regra antiga.
        ['canto', filterMapForPlayer({ ...m, tokens: [heroi(200, 200)] }, 'p1', POSSE, 300).map],
        // No meio do salão, sem canto nenhum: a regra nova (`knownFromInside`).
        ['meio', filterMapForPlayer({ ...m, tokens: [heroi(400, 500)] }, 'p1', POSSE, 120).map],
      ]
      return saidas.filter(([, saida]) => passos(saida).length > 0).map(([onde]) => `${onde}, parede a ${afastamento} px`)
    })
    expect(vazou, 'a textura levou o buraco no formato do cofre secreto').toEqual([])
  })

  it('controle: o cofre não secreto, ou o secreto já descoberto pelo jogador, leva a área com o buraco certo', () => {
    for (const afastamento of [0, 3]) {
      const comum = salaoComCofre(afastamento, false)
      const a = afastamento
      // O buraco do cofre está no contorno (o canto de baixo à direita dele).
      expect(comum.texturas?.[0]).toMatchObject({ alvo: { pontos: expect.arrayContaining([{ x: 840 + a, y: 630 + a }]) } })
      expect(mapForImageExport(comum, SEM_O_MESTRE).texturas, `imagem, parede a ${a} px`).toEqual(comum.texturas)
      expect(filterMapForPlayer({ ...comum, tokens: [heroi(200, 200)] }, 'p1', POSSE, 300).map.texturas, `jogador, parede a ${a} px`).toEqual(comum.texturas)

      // Secreto, mas descoberto por ele: volta ao normal, com o mesmo contorno.
      const secreto = salaoComCofre(afastamento, true)
      const descoberto = new Set(['cofre'])
      const recorte = filterMapForPlayer({ ...secreto, tokens: [heroi(200, 200)] }, 'p1', POSSE, 300, undefined, undefined, undefined, undefined, undefined, undefined, undefined, descoberto)
      expect(recorte.map.texturas, `descoberto, parede a ${a} px`).toEqual(secreto.texturas)
    }
  })
})

/**
 * PAREDE ESCONDIDA DE PROPÓSITO (12/11/2026): a divisa no meio do salão está
 * numa camada escondida dos jogadores, ou é parede invisível (`hidden`). O
 * jogador não a recebe, e a área da metade esquerda acaba em cima dela: a borda
 * da textura desenharia a parede na tela dele (com a camada escondida, a visão
 * enviada até passa pela parede). O mesmo na imagem, que tira a parede invisível.
 *
 * Geometria (mapa 35x25 de 40 px, camadas v2): salão 140..1260 x 140..860; a
 * divisa em x = 700; o clique do balde em (300, 300); a ficha em (400, 500).
 */
const LIVRE: CamadaId = 'livre_16bcc5fe'

function salaoComDivisa(divisa: Partial<Wall>, ocultasDoJogador: CamadaId[] = []): MapData {
  const salao = [parede('n', 140, 140, 1260, 140), parede('l', 1260, 140, 1260, 860), parede('s', 1260, 860, 140, 860), parede('o', 140, 860, 140, 140)]
  const walls = [...salao, { ...parede('divisa', 700, 140, 700, 860), ...divisa }]
  const base: MapData = { ...createEmptyMap('m', 'M', 35, 25, 40), versaoDasCamadas: 2, ocultasDoJogador, walls, tokens: [heroi(400, 500)] }
  const area = areaFechadaPorParedes(base, { x: 300, y: 300 })
  if (area === null) throw new Error('a metade do salão não fechou')
  return { ...base, texturas: [{ id: 'lajotas', tipo: 'balde', textura: 'lajotas', forca: 1, alvo: { tipo: 'area', pontos: area } }] }
}

describe('textura na área fechada por parede escondida de propósito', () => {
  it('SEGURANÇA: a área que acaba numa parede de camada escondida dos jogadores, ou numa parede invisível, não sai para o jogador; a da invisível, nem na imagem exportada', () => {
    const naCamada = filterMapForPlayer(salaoComDivisa({ camada: LIVRE }, [LIVRE]), 'p1', POSSE, 300).map
    const invisivel = filterMapForPlayer(salaoComDivisa({ hidden: true }), 'p1', POSSE, 300).map
    const imagem = mapForImageExport(salaoComDivisa({ hidden: true }), SEM_O_MESTRE)
    // A premissa: a parede não vai em nenhum dos três.
    for (const saida of [naCamada, invisivel, imagem]) expect(saida.walls.map((w) => w.id)).not.toContain('divisa')

    const saidas: [string, MapData][] = [['jogador, camada escondida', naCamada], ['jogador, parede invisível', invisivel], ['imagem, parede invisível', imagem]]
    const vazou = saidas.filter(([, saida]) => passos(saida).length > 0).map(([onde]) => onde)
    expect(vazou, 'a borda da textura desenhou a parede que quem recebe não ganha').toEqual([])
  })

  it('controle: a mesma divisa numa camada à mostra dos jogadores, ou parede comum, leva a área como hoje', () => {
    const naCamada = salaoComDivisa({ camada: LIVRE })
    expect(filterMapForPlayer(naCamada, 'p1', POSSE, 300).map.texturas, 'camada à mostra').toEqual(naCamada.texturas)

    const comum = salaoComDivisa({})
    expect(filterMapForPlayer(comum, 'p1', POSSE, 300).map.texturas, 'jogador, parede comum').toEqual(comum.texturas)
    expect(mapForImageExport(comum, SEM_O_MESTRE).texturas, 'imagem, parede comum').toEqual(comum.texturas)
  })
})
