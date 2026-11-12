/**
 * OBJETO GRANDE BARRA A FICHA DO JOGADOR (`lib/obstaculosDeObjeto.ts`, pedido
 * do mestre de 12/11/2026): o jogador não atravessa o moinho, o clique para
 * andar contorna, a ficha que está dentro sai, o tapete nunca barra, o mestre
 * passa, e o que o mestre escondeu não vira parede invisível.
 *
 * Geometria (px de mundo, mapa 1000 x 1000, grade 40, sem Chão e sem parede):
 * o MOINHO (2 x 2 casas, redondo) ocupa as casas 11 e 12 nas duas direções,
 * centro (480, 480); a ficha do jogador fica na casa (7, 11), centro (300, 460),
 * à esquerda dele e na linha das casas de cima do moinho.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Prop, Region, RegionPoint, TipoMobilia, Token, Wall } from '../types/map'
import { latestActionNotice } from '../player/moveNotice'
import { paredesParaAndar } from './barranco'
import { previaDoPassoEmBatalha } from './batalha/previaDoPasso'
import { planejarCaminhada } from './cliqueParaAndar'
import { filterMapForPlayer } from './fogFilter'
import type { KnownArea } from './knownPath'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { ehMovelQueBarra } from './mobilia'
import { validateTokenMove } from './moveValidation'
import { barraPassagemEscolhida, comBarraPassagemNoMapa, ehParedeDeObjeto, objetoBarraPassagem, paredesParaAndarDoJogador } from './obstaculosDeObjeto'

const GRADE = 40
const POSSE = { p1: ['heroi'] }

function ficha(x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id: 'heroi', characterId: null, name: 'heroi', x, y, size: 1, image: null, ...extra }
}

function objeto(id: string, mobilia: Prop['mobilia'], x: number, y: number, casas: number, extra: Partial<Prop> = {}): Prop {
  return { id, src: '', x, y, width: casas * GRADE, height: casas * GRADE, linkedMapPath: null, ...(mobilia === undefined ? {} : { mobilia }), ...extra }
}

function retangulo(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

const HEROI = ficha(300, 460)
const MOINHO = objeto('moinho', 'moinho', 480, 480, 2)
/** No meio do moinho. */
const DENTRO = { x: 480, y: 480 }
/** Do outro lado do moinho, na mesma linha da ficha: o traço reto passa por dentro dele. */
const DO_OUTRO_LADO = { x: 700, y: 460 }

function cena(patch: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'M', 25, 25, GRADE), tokens: [HEROI], props: [MOINHO], ...patch }
}

const VE_TUDO: KnownArea = { explored: undefined, vision: [retangulo(0, 0, 1000, 1000)], concealed: [] }

function arrastar(map: MapData, para: { x: number; y: number }, opcoes: Parameters<typeof validateTokenMove>[3] = {}): ReturnType<typeof validateTokenMove> {
  return validateTokenMove(map, { playerId: 'p1', tokenId: 'heroi', x: para.x, y: para.y }, POSSE, opcoes)
}

const PASSOU = { ok: true, x: DO_OUTRO_LADO.x, y: DO_OUTRO_LADO.y }
const BARROU = { ok: false, reason: 'objeto' }

describe('quem barra', () => {
  it('a lista de saída: construções e objetos grandes de rua barram; chão, móvel de sala e imagem não', () => {
    const barram: TipoMobilia[] = ['moinho', 'cataVento', 'mausoleu', 'poco', 'chafariz', 'estatua', 'anjoDePedra', 'pilar', 'blocoDeInscricoesAzul', 'blocoDeInscricoesVermelho', 'blocoDeInscricoesDourado', 'pedrasERochas', 'arvoreSeca', 'carroca', 'carrocaQuebrada', 'tonelDeAdega', 'barraca']
    for (const tipo of barram) expect(ehMovelQueBarra(tipo), tipo).toBe(true)
    const passam: TipoMobilia[] = ['tapete', 'mesa', 'cerca', 'tendaDeAdivinha', 'ponte']
    for (const tipo of passam) expect(ehMovelQueBarra(tipo), tipo).toBe(false)
    expect(ehMovelQueBarra(undefined)).toBe(false)
    expect(objetoBarraPassagem(MOINHO)).toBe(true)
    expect(objetoBarraPassagem(objeto('imagem', undefined, 480, 480, 2))).toBe(false)
  })
})

describe('arrasto do jogador', () => {
  it('não entra no moinho nem o atravessa: a recusa é "Objeto no caminho" (com "Fora do Chão" livre também)', () => {
    for (const map of [cena(), cena({ offFloor: 'free' })]) {
      expect(arrastar(map, DENTRO)).toEqual(BARROU)
      expect(arrastar(map, DO_OUTRO_LADO)).toEqual(BARROU)
      // Ao lado do moinho, sem cruzar a forma dele: passa.
      expect(arrastar(map, { x: 300, y: 700 })).toEqual({ ok: true, x: 300, y: 700 })
    }
    expect(latestActionNotice(undefined, { id: 1, reason: 'objeto' })?.text).toBe('Objeto no caminho')
  })

  it('parede de verdade no mesmo traço: a recusa continua "wall" (o objeto só responde quando é ele que barra)', () => {
    expect(arrastar(cena({ walls: [parede('muro', 400, 0, 400, 1000)] }), DO_OUTRO_LADO)).toEqual({ ok: false, reason: 'wall' })
  })

  it('a ficha que está dentro do moinho sai (nunca fica presa) e anda lá dentro; de fora não volta a entrar', () => {
    const dentro = cena({ tokens: [ficha(DENTRO.x, DENTRO.y)] })
    expect(arrastar(dentro, { x: 300, y: 460 })).toEqual({ ok: true, x: 300, y: 460 })
    expect(arrastar(dentro, { x: 490, y: 470 })).toEqual({ ok: true, x: 490, y: 470 })
    expect(arrastar(cena(), DENTRO)).toEqual(BARROU)
  })

  it('tapete nunca barra; item no chão e objeto de outro piso também não', () => {
    const tapete = objeto('tapete', 'tapete', 480, 480, 2)
    expect(objetoBarraPassagem(tapete)).toBe(false)
    expect(arrastar(cena({ props: [tapete] }), DO_OUTRO_LADO)).toEqual(PASSOU)
    const item: Prop = { ...MOINHO, item: { nome: 'Espada' } }
    expect(arrastar(cena({ props: [item] }), DO_OUTRO_LADO)).toEqual(PASSOU)
    expect(arrastar(cena({ props: [{ ...MOINHO, piso: 1 }] }), DO_OUTRO_LADO)).toEqual(PASSOU)
  })

  it('o que o mestre escondeu não vira parede invisível: secreto, escondido, camada que os jogadores não veem, zona oculta e sala secreta', () => {
    expect(arrastar(cena({ props: [{ ...MOINHO, secret: true }] }), DO_OUTRO_LADO)).toEqual(PASSOU)
    expect(arrastar(cena({ props: [{ ...MOINHO, hidden: true }] }), DO_OUTRO_LADO)).toEqual(PASSOU)
    expect(arrastar(cena({ ocultasDoJogador: ['objetos'] }), DO_OUTRO_LADO)).toEqual(PASSOU)
    const emVolta = retangulo(420, 420, 540, 540)
    expect(arrastar(cena({ concealZones: [{ id: 'zona', name: 'Zona', revealed: false, points: emVolta }] }), DO_OUTRO_LADO)).toEqual(PASSOU)
    const salaSecreta: Region = { id: 'sala', points: emVolta, tag: '', fillColor: '#654', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Sala' }, secret: true }
    expect(arrastar(cena({ regions: [salaSecreta] }), DO_OUTRO_LADO)).toEqual(PASSOU)
    // Zona revelada: o jogador recebe o moinho, e ele barra.
    expect(arrastar(cena({ concealZones: [{ id: 'zona', name: 'Zona', revealed: true, points: emVolta }] }), DO_OUTRO_LADO)).toEqual(BARROU)
  })

  it('o mestre atravessa sempre: o passo dele passa e a lista de paredes do arrasto dele não tem objeto', () => {
    expect(arrastar(cena(), DO_OUTRO_LADO, { isHost: true })).toEqual(PASSOU)
    const map = cena()
    expect(paredesParaAndar(map.walls, map, 0).some((w) => ehParedeDeObjeto(w.id))).toBe(false)
    expect(paredesParaAndarDoJogador(map.walls, map, 0, HEROI).filter((w) => ehParedeDeObjeto(w.id))).toHaveLength(12)
  })
})

describe('clique para andar', () => {
  it('contorna o moinho em 2 ou mais trechos, e o host aceita cada trecho', () => {
    const plano = planejarCaminhada(cena(), HEROI, DO_OUTRO_LADO, VE_TUDO)
    expect(plano.tipo).toBe('andar')
    if (plano.tipo !== 'andar') return
    expect(plano.trechos.length).toBeGreaterThanOrEqual(2)
    expect(plano.trechos.at(-1)).toEqual(DO_OUTRO_LADO)
    let map = cena()
    for (const trecho of plano.trechos) {
      expect(arrastar(map, trecho)).toEqual({ ok: true, x: trecho.x, y: trecho.y })
      map = { ...map, tokens: [ficha(trecho.x, trecho.y)] }
    }
  })

  it('clique no próprio moinho: o aviso é "Objeto no caminho", não "Você não conhece o caminho"', () => {
    const plano = planejarCaminhada(cena(), HEROI, DENTRO, VE_TUDO)
    expect(plano).toEqual({ tipo: 'aviso', motivo: 'objeto' })
    if (plano.tipo === 'aviso') expect(latestActionNotice(undefined, { id: 1, reason: plano.motivo })?.text).toBe('Objeto no caminho')
  })

  it('corredor de 1 casa entre dois pilares continua passável, no arrasto e no clique', () => {
    // Um muro de ponta a ponta na linha 420, com os pilares das casas 10 e 12 no meio dele: só a casa 11 dá passagem.
    const pilares = [objeto('pilar-a', 'pilar', 420, 420, 1), objeto('pilar-b', 'pilar', 500, 420, 1)]
    const muro = [parede('muro-a', 0, 420, 400, 420), parede('muro-b', 520, 420, 1000, 420)]
    const map = cena({ tokens: [ficha(460, 540)], props: pilares, walls: muro })
    const alem = { x: 460, y: 300 }
    expect(arrastar(map, alem)).toEqual({ ok: true, x: alem.x, y: alem.y })
    expect(planejarCaminhada(map, ficha(460, 540), alem, VE_TUDO).tipo).toBe('andar')
    // De lado, sem linha reta pelo vão: o caminho tem de dobrar e passar pela malha entre os dois pilares.
    const deLado = ficha(300, 540)
    const plano = planejarCaminhada({ ...map, tokens: [deLado] }, deLado, { x: 700, y: 300 }, VE_TUDO)
    expect(plano.tipo).toBe('andar')
    if (plano.tipo === 'andar') expect(plano.trechos.length).toBeGreaterThanOrEqual(2)
    // Pelos pilares não passa.
    expect(arrastar(map, { x: 420, y: 300 }).ok).toBe(false)
    expect(arrastar(cena({ tokens: [ficha(420, 540)], props: pilares, walls: muro }), { x: 420, y: 300 })).toEqual(BARROU)
  })
})

describe('modo batalha', () => {
  it('a casa dentro do moinho recusa com "objeto"; a casa do outro lado é alcançada por fora dele', () => {
    const map = cena()
    expect(previaDoPassoEmBatalha(map, 'heroi', { x: 460, y: 460 })).toEqual(BARROU)
    const passo = previaDoPassoEmBatalha(map, 'heroi', DO_OUTRO_LADO)
    expect(passo.ok).toBe(true)
    if (!passo.ok) return
    expect({ x: passo.x, y: passo.y }).toEqual(DO_OUTRO_LADO)
    const dentroDoMoinho = (passo.caminho ?? []).filter((casa) => casa.col >= 11 && casa.col <= 12 && casa.row >= 11 && casa.row <= 12)
    expect(dentroDoMoinho).toEqual([])
  })
})

describe('o botão "Barra a passagem" (`Prop.barraPassagem`)', () => {
  const MESA = objeto('mesa', 'mesa', 480, 480, 2)
  const IMAGEM = objeto('imagem', undefined, 480, 480, 2)

  it('moinho com `barraPassagem: false` deixa passar; mesa e imagem com `true` barram; objeto de chão nunca', () => {
    expect(arrastar(cena({ props: [{ ...MOINHO, barraPassagem: false }] }), DO_OUTRO_LADO)).toEqual(PASSOU)
    expect(arrastar(cena({ props: [MESA] }), DO_OUTRO_LADO)).toEqual(PASSOU)
    expect(arrastar(cena({ props: [{ ...MESA, barraPassagem: true }] }), DO_OUTRO_LADO)).toEqual(BARROU)
    expect(arrastar(cena({ props: [{ ...IMAGEM, barraPassagem: true }] }), DO_OUTRO_LADO)).toEqual(BARROU)
    expect(arrastar(cena({ props: [{ ...objeto('tapete', 'tapete', 480, 480, 2), barraPassagem: true }] }), DO_OUTRO_LADO)).toEqual(PASSOU)
  })

  it('o campo só é gravado quando difere do padrão do tipo: voltar ao padrão apaga, e o mesmo valor devolve o mesmo mapa', () => {
    const map = cena({ props: [MOINHO, MESA] })
    const moinhoSolto = comBarraPassagemNoMapa(map, 'moinho', false)
    expect(moinhoSolto.props[0]).toEqual({ ...MOINHO, barraPassagem: false })
    expect(barraPassagemEscolhida(moinhoSolto.props[0] ?? MOINHO)).toBe(false)
    const deVolta = comBarraPassagemNoMapa(moinhoSolto, 'moinho', true)
    expect(deVolta.props[0]).toEqual(MOINHO)
    expect(Object.hasOwn(deVolta.props[0] ?? {}, 'barraPassagem')).toBe(false)
    expect(comBarraPassagemNoMapa(map, 'moinho', true)).toBe(map)
    expect(comBarraPassagemNoMapa(map, 'mesa', false)).toBe(map)
    expect(comBarraPassagemNoMapa(map, 'mesa', true).props[1]).toEqual({ ...MESA, barraPassagem: true })
    expect(comBarraPassagemNoMapa(map, 'ninguem', true)).toBe(map)
  })

  it('mapa salvo reabre igual; valor torto, igual ao padrão ou em objeto de chão some na leitura', () => {
    const map = cena({ props: [{ ...MOINHO, barraPassagem: false }, { ...MESA, barraPassagem: true }, IMAGEM] })
    const texto = serializeMap(map)
    const lido = deserializeMap(texto)
    expect(lido.props.map((p) => p.barraPassagem)).toEqual([false, true, undefined])
    expect(serializeMap(lido)).toBe(texto)
    const tortos = [
      { ...MOINHO, barraPassagem: 'nao' },
      { ...MOINHO, id: 'moinho-2', barraPassagem: true },
      { ...MESA, barraPassagem: 0 },
      { ...objeto('tapete', 'tapete', 480, 480, 2), barraPassagem: true },
    ]
    const consertado = deserializeMap(JSON.stringify({ ...JSON.parse(texto), props: tortos }))
    expect(consertado.props.map((p) => Object.hasOwn(p, 'barraPassagem'))).toEqual([false, false, false, false])
  })

  it('o jogador recebe o campo junto do objeto que ele vê, e a tela dele planeja com ele', () => {
    const map = cena({ props: [{ ...MOINHO, barraPassagem: false }, { ...MESA, id: 'mesa', x: 480, y: 700, barraPassagem: true }] })
    const { map: recorte } = filterMapForPlayer(map, 'p1', POSSE, 700)
    expect(recorte.props.map((p) => [p.id, p.barraPassagem])).toEqual([
      ['moinho', false],
      ['mesa', true],
    ])
    // O moinho solto: o clique passa reto por ele. A mesa que barra: o clique nela avisa.
    const heroi = recorte.tokens.find((t) => t.id === 'heroi') ?? HEROI
    const reto = planejarCaminhada(recorte, heroi, DO_OUTRO_LADO, VE_TUDO)
    expect(reto.tipo === 'andar' ? reto.trechos : null).toEqual([DO_OUTRO_LADO])
    expect(planejarCaminhada(recorte, heroi, { x: 480, y: 700 }, VE_TUDO)).toEqual({ tipo: 'aviso', motivo: 'objeto' })
  })
})

describe('cache', () => {
  it('a mesma lista de objetos devolve as MESMAS paredes; centenas de pilares entram uma vez só', () => {
    const pilares = Array.from({ length: 600 }, (_, k) => objeto(`pilar-${k}`, 'pilar', 20 + (k % 25) * GRADE, 620 + Math.floor(k / 25) * 12, 0.25))
    const map = cena({ props: [MOINHO, ...pilares] })
    const primeira = paredesParaAndarDoJogador(map.walls, map, 0, HEROI)
    expect(primeira.filter((w) => ehParedeDeObjeto(w.id))).toHaveLength(12 + 600 * 4)
    expect(paredesParaAndarDoJogador(map.walls, map, 0, { x: 310, y: 470 })).toBe(primeira)
    // Outra cópia do mapa com as mesmas listas (o pacote só mexeu nas fichas): a mesma resposta.
    const outraCopia: MapData = { ...map, tokens: [] }
    expect(paredesParaAndarDoJogador(map.walls, outraCopia, 0, HEROI)).toBe(primeira)
    for (let k = 0; k < 200; k += 1) expect(arrastar(map, { x: 300 + (k % 5), y: 300 })).toEqual({ ok: true, x: 300 + (k % 5), y: 300 })
  })
})
