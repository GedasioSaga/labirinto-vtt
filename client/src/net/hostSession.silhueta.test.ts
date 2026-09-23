/**
 * OBJETOS COMO SILHUETA, no FIO. `lib/fogFilter.silhueta.test.ts` prova o
 * recorte; aqui a prova é o pacote de verdade (`snapshot`) que a sessão do
 * mestre entrega ao transporte: a Ana recebe a cama como retângulo, o Bruno
 * não recebe nada dela, e o que o mestre esconde não vai para ninguém.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Prop, Region, Token, Wall } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const CAMINHO_DA_IMAGEM = 'C:\\Users\\mestre\\AppData\\Roaming\\labirinto\\props\\cama.png'
const CAMINHO_DO_MAPA_LIGADO = 'C:\\Users\\mestre\\mapas\\porao-secreto.json'

const SILHUETA_DA_CAMA: Prop = { id: 'cama', x: 250, y: 180, width: 80, height: 40, rotation: 90, src: '', linkedMapPath: null }

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function quarto(roof?: boolean): Region {
  return {
    id: 'quarto',
    points: [
      { x: 100, y: 100 },
      { x: 400, y: 100 },
      { x: 400, y: 400 },
      { x: 100, y: 400 },
    ],
    tag: '',
    fillColor: '#654',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Quarto do prefeito', roof },
  }
}

/** A cama do mestre: imagem e mapa ligado no disco dele, trava de edição e uma anotação que nenhuma tela usa. */
function cama(extra: Partial<Prop> = {}): Prop {
  const doMestre = {
    id: 'cama',
    src: CAMINHO_DA_IMAGEM,
    x: 250,
    y: 180,
    width: 80,
    height: 40,
    rotation: 90,
    linkedMapPath: CAMINHO_DO_MAPA_LIGADO,
    locked: true,
    anotacao: 'veneno debaixo do colchão',
    ...extra,
  }
  return doMestre as Prop
}

/** Quarto do prefeito à esquerda da parede cega em x=500 (Ana), corredor à direita (Bruno). */
function prefeitura(extraDaCama: Partial<Prop> = {}, extra: Partial<MapData> = {}): MapData {
  return {
    // 25 x 25 casas de 40 px: 1000 x 1000 px de mundo.
    ...createEmptyMap('m-prefeitura', 'Prefeitura', 25, 25, 40),
    walls: [parede('divisoria', 500, 0, 500, 1000)],
    regions: [quarto()],
    tokens: [ficha('ficha-ana', 250, 350), ficha('ficha-bruno', 800, 350)],
    props: [cama(extraDaCama)],
    ...extra,
  }
}

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string, map: MapData): string {
  const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, map).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

/** Ana (c1) com a ficha dela, Bruno (c2) com a dele. */
function mesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  s.assignToken(entra(s, 'c1', 'Ana', map), 'ficha-ana')
  s.assignToken(entra(s, 'c2', 'Bruno', map), 'ficha-bruno')
  return s
}

function snapshotPara(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

describe('hostSession — objetos como silhueta no pacote do jogador', () => {
  it('o pacote da Ana leva a cama como silhueta; o do Bruno, sem visão do quarto, não leva nada dela', () => {
    const map = prefeitura()
    const r = mesa(map).broadcast(map)

    expect(snapshotPara(r, 'c1').map.props).toEqual([SILHUETA_DA_CAMA])
    // `.map` e não a mensagem inteira: o explorado viaja em base64, e um
    // pedaço dele poderia soletrar 'cama' por acaso sem nada ter vazado.
    const doBruno = snapshotPara(r, 'c2').map
    expect(doBruno.props).toEqual([])
    expect(JSON.stringify(doBruno)).not.toContain('cama')
  })

  it('nenhum pacote leva a imagem, o mapa ligado, a trava ou a anotação do mestre', () => {
    const map = prefeitura()
    const fio = JSON.stringify(mesa(map).broadcast(map).outbound)

    expect(fio).not.toContain('C:\\\\')
    expect(fio).not.toContain('porao-secreto')
    expect(fio).not.toContain('veneno')
    expect(fio).not.toContain('"locked"')
  })

  it('"Oculto para jogadores": a cama sai do pacote da Ana no envio seguinte', () => {
    const map = prefeitura()
    const s = mesa(map)
    expect(snapshotPara(s.broadcast(map), 'c1').map.props).toEqual([SILHUETA_DA_CAMA])

    const escondida = snapshotPara(s.broadcast(prefeitura({ secret: true })), 'c1').map
    expect(escondida.props).toEqual([])
    expect(JSON.stringify(escondida)).not.toContain('cama')
  })

  it('teto fechado com a Ana fora: o pacote não tem a cama; ela entra e a silhueta chega', () => {
    // Sem a parede: de fora a Ana enxerga o quarto, e só o teto pode esconder a cama.
    const comTeto = (ana: { x: number; y: number }): MapData =>
      prefeitura({}, { walls: [], regions: [quarto(true)], tokens: [ficha('ficha-ana', ana.x, ana.y), ficha('ficha-bruno', 800, 900)] })
    const fora = comTeto({ x: 250, y: 600 })
    const s = mesa(fora)

    const deFora = snapshotPara(s.broadcast(fora), 'c1').map
    expect(deFora.props).toEqual([])
    expect(JSON.stringify(deFora)).not.toContain('cama')

    expect(snapshotPara(s.broadcast(comTeto({ x: 250, y: 300 })), 'c1').map.props).toEqual([SILHUETA_DA_CAMA])
  })

  it('sala secreta: o baú do cofre sai do pacote da Ana, mesmo com a porta aberta deixando a lanterna dela alcançá-lo', () => {
    // Cofre (300..600 x 100..400) com as paredes ligadas a ele e a porta aberta a oeste; a Ana no corredor, de frente para ela.
    const doCofre = (id: string, x1: number, y1: number, x2: number, y2: number): Wall => ({ ...parede(id, x1, y1, x2, y2), regionId: 'sala-secreta' })
    const bau: Prop = { id: 'bau-do-cofre', src: CAMINHO_DA_IMAGEM, x: 450, y: 250, width: 60, height: 40, linkedMapPath: null }
    const cofre = (secret: boolean): MapData => ({
      ...createEmptyMap('m-cofre', 'Prefeitura', 25, 25, 40),
      walls: [
        doCofre('cofre-norte', 300, 100, 600, 100),
        doCofre('cofre-leste', 600, 100, 600, 400),
        doCofre('cofre-sul', 600, 400, 300, 400),
        doCofre('cofre-oeste-1', 300, 100, 300, 220),
        { ...doCofre('cofre-porta', 300, 220, 300, 280), door: { open: true, locked: false, kind: 'normal' } },
        doCofre('cofre-oeste-2', 300, 280, 300, 400),
      ],
      regions: [{ ...quarto(), id: 'sala-secreta', points: [{ x: 300, y: 100 }, { x: 600, y: 100 }, { x: 600, y: 400 }, { x: 300, y: 400 }], room: { shape: 'rect', name: 'Cofre' }, secret }],
      tokens: [ficha('ficha-ana', 150, 250), ficha('ficha-bruno', 800, 900)],
      props: [bau],
    })
    const s = mesa(cofre(false))

    // Sem o segredo, a porta aberta mostra o baú: o cenário mede o que diz medir.
    expect(snapshotPara(s.broadcast(cofre(false)), 'c1').map.props).toEqual([{ ...bau, src: '' }])

    const secreta = snapshotPara(s.broadcast(cofre(true)), 'c1').map
    expect(secreta.props).toEqual([])
    expect(JSON.stringify(secreta)).not.toContain('bau-do-cofre')
  })
})
