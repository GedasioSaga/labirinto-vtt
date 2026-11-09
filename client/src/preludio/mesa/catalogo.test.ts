/**
 * PRELÚDIO F4 (revisão): o estado dos links do roteiro para a mesa. O que não
 * abre fica neutro; o link de antes das cenas acha a cena da raiz; o mapa
 * aberto vale pela memória. No máximo 2 casos por situação; dados inventados
 * (o repositório é público).
 */
import { describe, expect, it } from 'vitest'
import { ADVENTURE_VERSION, type Adventure } from '../../lib/adventure'
import type { MapData } from '../../types/map'
import { cenaDoLinkNaAventura, chaveDosPinos, estadoDoLink, mapaNaMemoria, type ItemDoCatalogo, type Leitura, type MapaNoCatalogo } from './catalogo'

const RAIZ = 'C:/appdata/maps/ilha-velha'

function catalogoCom(mapas: MapaNoCatalogo[], pinos: [string, readonly ItemDoCatalogo[]][] = []) {
  return {
    mapas: { t: 'lido', valor: new Map(mapas.map((mapa) => [mapa.chave, mapa])) } as const,
    pastas: null,
    pinos: new Map<string, Leitura<readonly ItemDoCatalogo[]>>(pinos.map(([chave, valor]) => [chave, { t: 'lido', valor }])),
    fichas: new Map(),
  }
}

/** A Ilha Velha que ganhou cenas: a primeira continua no map.json da raiz, com id novo. */
const ILHA_COM_CENAS: MapaNoCatalogo = {
  chave: 'ilha-velha',
  nome: 'Ilha Velha',
  caminho: `${RAIZ}/map.json`,
  abriu: true,
  cenas: [
    { id: 'scene_raiz', nome: 'Ilha Velha', trilha: 'Ilha Velha', raiz: true, arquivo: `${RAIZ}/map.json` },
    { id: 'scene_gruta', nome: 'Gruta', trilha: 'Ilha Velha › Gruta', raiz: false, arquivo: `${RAIZ}/scenes/scene_gruta/map.json` },
  ],
}

describe('Links para a mesa: o que não abre e o link de antes das cenas', () => {
  it('o mapa que não abriu fica neutro; o que sumiu da lista "não existe mais"', () => {
    const danificado: MapaNoCatalogo = { chave: 'ilha-velha', nome: 'ilha-velha (arquivo danificado)', caminho: `${RAIZ}/map.json`, cenas: null, abriu: false }
    expect(estadoDoLink({ tipo: 'cena', chave: 'ilha-velha', sceneId: 'scene_gruta', pinoId: 'pino-1' }, catalogoCom([danificado]))).toEqual({ t: 'lendo' })
    expect(estadoDoLink({ tipo: 'cena', chave: 'outro-mapa', sceneId: '' }, catalogoCom([danificado]))).toEqual({ t: 'quebrado', aviso: 'O mapa deste link não existe mais.' })
  })

  it('o pino de quando o mapa não tinha cenas continua valendo na cena da raiz', () => {
    const catalogo = catalogoCom([ILHA_COM_CENAS], [[chaveDosPinos('ilha-velha', ''), [{ id: 'pino-farol', nome: 'Farol' }]]])
    expect(estadoDoLink({ tipo: 'cena', chave: 'ilha-velha', sceneId: '', pinoId: 'pino-farol' }, catalogo)).toEqual({ t: 'ok', nome: 'Farol', onde: 'Ilha Velha › Ilha Velha' })
    const cenas = [
      { id: 'scene_gruta', name: 'Gruta', file: 'scenes/scene_gruta/map.json' },
      { id: 'scene_raiz', name: 'Ilha Velha', file: 'map.json' },
    ]
    expect(cenaDoLinkNaAventura(cenas, '')).toBe('scene_raiz')
    expect(cenaDoLinkNaAventura(cenas.slice(0, 1), '')).toBeNull()
  })
})

describe('Links para a mesa: o mapa aberto vale pela memória', () => {
  const aventura: Adventure = { version: ADVENTURE_VERSION, id: 'adv-ilha', name: 'Ilha Velha', startSceneId: 'scene_raiz', scenes: [{ id: 'scene_raiz', name: 'Ilha Velha', file: 'map.json' }] }
  // Só os campos que o link lê; o resto do pino não importa aqui.
  const pinos = [{ id: 'pino-farol', nome: 'Farol', description: '' }] as unknown as MapData['pins']
  const naMemoria = mapaNaMemoria({ aventura: { pasta: null, dir: RAIZ, adventure: aventura, activeSceneId: 'scene_raiz', cache: {} }, aberto: { id: 'map_raiz', name: 'Ilha Velha', pins: pinos } })

  it('a cena apagada e ainda não salva já some, e o pino da cena aberta vem da memória, sem esperar o disco', () => {
    expect(naMemoria?.chave).toBe('ilha-velha')
    expect(estadoDoLink({ tipo: 'cena', chave: 'ilha-velha', sceneId: 'scene_gruta' }, catalogoCom([ILHA_COM_CENAS]), naMemoria)).toEqual({ t: 'quebrado', aviso: 'A cena deste link não existe mais.' })
    expect(estadoDoLink({ tipo: 'cena', chave: 'ilha-velha', sceneId: 'scene_raiz', pinoId: 'pino-farol' }, catalogoCom([ILHA_COM_CENAS]), naMemoria)).toEqual({ t: 'ok', nome: 'Farol', onde: 'Ilha Velha › Ilha Velha' })
  })

  it('o pino apagado na memória "não existe mais", mesmo que o disco ainda o tenha', () => {
    const catalogo = catalogoCom([ILHA_COM_CENAS], [[chaveDosPinos('ilha-velha', 'scene_raiz'), [{ id: 'pino-velho', nome: 'Cais' }]]])
    expect(estadoDoLink({ tipo: 'cena', chave: 'ilha-velha', sceneId: 'scene_raiz', pinoId: 'pino-velho' }, catalogo, naMemoria)).toEqual({ t: 'quebrado', aviso: 'O pino deste link não existe mais.' })
  })
})
