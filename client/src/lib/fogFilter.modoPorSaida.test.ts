import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * MODO POR SAÍDA no recorte do jogador: cada escolha leva o modo DELA quando
 * ele difere do modo do pino — o cartão precisa saber se oferece "Passar",
 * "Pedir" ou "Trancada" naquela saída. Nunca o destino, a cena, o par, nem o
 * que o mestre esconde (pino na névoa não manda nada, nem o modo).
 */

const RAIO = 300
const POSSE = { p1: ['heroi'] }

function mapaCom(pins: Pin[]): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    tokens: [{ id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }],
    pins,
  }
}

const CRUZ: Pin = {
  id: 'cruz',
  x: 240,
  y: 200,
  kind: 'viagem',
  description: 'Encruzilhada',
  image: null,
  destino: { sceneId: 'scene_cripta_secreta', pinId: 'par_da_cripta' },
  rotulo: 'Porta da cripta',
  saidas: [
    { id: 'saida_torre', rotulo: 'Escada da torre', destino: { sceneId: 'scene_torre_secreta', pinId: 'par_da_torre' }, passagem: 'livre' },
    { id: 'saida_poco', rotulo: 'Poço', destino: { sceneId: 'scene_poco_secreto', pinId: 'par_do_poco' }, passagem: 'trancada' },
    { id: 'saida_ponte', rotulo: 'Ponte', destino: { sceneId: 'scene_ponte_secreta', pinId: 'par_da_ponte' } },
  ],
}

const SEGREDOS = [
  'scene_cripta_secreta',
  'scene_torre_secreta',
  'scene_poco_secreto',
  'scene_ponte_secreta',
  'par_da_cripta',
  'par_da_torre',
  'par_do_poco',
  'par_da_ponte',
  'destino',
  'saidas',
]

describe('fogFilter: modo por saída', () => {
  it('cada escolha leva o modo dela quando difere do pino; a que segue o pino vai sem o campo', () => {
    const { map } = filterMapForPlayer(mapaCom([CRUZ]), 'p1', POSSE, RAIO)
    expect(map.pins[0].escolhas).toEqual([
      { id: 'principal', rotulo: 'Porta da cripta' },
      { id: 'saida_torre', rotulo: 'Escada da torre', passagem: 'livre' },
      { id: 'saida_poco', rotulo: 'Poço', passagem: 'trancada' },
      { id: 'saida_ponte', rotulo: 'Ponte' },
    ])
    const recorte = JSON.stringify(map)
    for (const segredo of SEGREDOS) expect(recorte, `o recorte vazou "${segredo}"`).not.toContain(segredo)
  })

  it('modo igual ao do pino não viaja: o pacote fica o de sempre', () => {
    const igual: Pin = { ...CRUZ, passagem: 'livre', saidas: [{ id: 'saida_torre', rotulo: 'Escada', destino: { sceneId: 's_t', pinId: 'p_t' }, passagem: 'livre' }] }
    const { map } = filterMapForPlayer(mapaCom([igual]), 'p1', POSSE, RAIO)
    expect(map.pins[0].passagem).toBe('livre')
    expect(map.pins[0].escolhas).toEqual([
      { id: 'principal', rotulo: 'Porta da cripta' },
      { id: 'saida_torre', rotulo: 'Escada' },
    ])
  })

  it('saída trancada num pino mudo: a marca `mudo` vai, para o cartão não oferecer um pedido que o host recusa', () => {
    const { map } = filterMapForPlayer(mapaCom([{ ...CRUZ, mudo: true }]), 'p1', POSSE, RAIO)
    expect(map.pins[0].mudo).toBe(true)
    // Controle: sem saída trancada, `mudo` (sobra de quando trancava) fica de fora.
    const semTrancada: Pin = { ...CRUZ, mudo: true, saidas: CRUZ.saidas?.filter((s) => s.passagem !== 'trancada') }
    const outro = filterMapForPlayer(mapaCom([semTrancada]), 'p1', POSSE, RAIO).map
    expect(outro.pins).toHaveLength(1)
    expect('mudo' in outro.pins[0]).toBe(false)
  })

  it('placa lida de longe ("só de perto"): o modo vai com "Saída N", o rótulo não', () => {
    const { map } = filterMapForPlayer(mapaCom([{ ...CRUZ, x: 440, lerDePerto: 1 }]), 'p1', POSSE, RAIO)
    expect(map.pins[0].longe).toBe(true)
    expect(map.pins[0].escolhas).toEqual([
      { id: 'principal', rotulo: 'Saída 1' },
      { id: 'saida_torre', rotulo: 'Saída 2', passagem: 'livre' },
      { id: 'saida_poco', rotulo: 'Saída 3', passagem: 'trancada' },
      { id: 'saida_ponte', rotulo: 'Saída 4' },
    ])
    expect(JSON.stringify(map)).not.toContain('Escada da torre')
  })

  it('pino na névoa: nada chega — nem o pino, nem o modo de saída nenhuma', () => {
    const longe: Pin = { ...CRUZ, x: 900, y: 900 }
    const { map } = filterMapForPlayer(mapaCom([longe]), 'p1', POSSE, RAIO)
    expect(map.pins).toEqual([])
    const recorte = JSON.stringify(map)
    for (const segredo of [...SEGREDOS, 'Escada da torre', 'trancada', 'livre']) expect(recorte, `o recorte vazou "${segredo}"`).not.toContain(segredo)
  })

  it('pino secreto: o modo por saída também não sai', () => {
    const { map } = filterMapForPlayer(mapaCom([{ ...CRUZ, secret: true }]), 'p1', POSSE, RAIO)
    expect(map.pins).toEqual([])
    expect(JSON.stringify(map)).not.toContain('saida_torre')
  })
})
