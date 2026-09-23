import { describe, expect, it } from 'vitest'
import type { Pin } from '../types/map'
import { deserializeMap, serializeMap } from './mapFile'
import { createEmptyMap } from './mapFactory'

/**
 * ENCRUZILHADA no disco: o formato antigo (só `destino`) abre igual, o novo
 * (`rotulo` + `saidas`) faz ida e volta, e saída fora da forma é descartada
 * sozinha — as boas ficam.
 */
describe('mapFile: encruzilhada', () => {
  it('formato antigo: pino de viagem só com `destino` abre igual e regravar não inventa campo', () => {
    const antigo =
      '{"id": "antigo", "pins": [' +
      '{"id": "a", "x": 1, "y": 2, "kind": "viagem", "description": "Escada", "image": null, "destino": {"sceneId": "scene_b", "pinId": "b"}}]}'
    const pins = deserializeMap(antigo).pins
    expect(pins).toEqual([{ id: 'a', x: 1, y: 2, kind: 'viagem', description: 'Escada', image: null, destino: { sceneId: 'scene_b', pinId: 'b' } }])
    const regravado = serializeMap(deserializeMap(antigo))
    expect(regravado).not.toContain('saidas')
    expect(regravado).not.toContain('rotulo')
    expect(regravado).not.toContain('escolhas')
  })

  it('formato novo: rótulo e saídas fazem ida e volta', () => {
    const cruz: Pin = {
      id: 'cruz',
      x: 64,
      y: 64,
      kind: 'viagem',
      description: 'Encruzilhada',
      image: null,
      destino: { sceneId: 'scene_b', pinId: 'b' },
      rotulo: 'Porta da cripta',
      saidas: [{ id: 'saida_torre', rotulo: 'Escada da torre', destino: { sceneId: 'scene_c', pinId: 'c' } }],
    }
    const map = { ...createEmptyMap('map_v', 'V', 5, 5, 64), pins: [cruz] }
    expect(deserializeMap(serializeMap(map)).pins).toEqual([cruz])
  })

  it('saída inválida é descartada e as boas ficam; nada bom sobrando = campo ausente', () => {
    const boa = { id: 'saida_boa', rotulo: 'Boa', destino: { sceneId: 'scene_c', pinId: 'c' } }
    const saidas = [
      boa,
      { id: 'saida_sem_destino', rotulo: 'X', destino: null },
      { id: 'saida_destino_torto', rotulo: 'X', destino: { sceneId: '', pinId: 'c' } },
      { id: '', rotulo: 'X', destino: { sceneId: 'scene_c', pinId: 'c' } },
      { id: 'principal', rotulo: 'X', destino: { sceneId: 'scene_c', pinId: 'c' } },
      { id: 'saida_boa', rotulo: 'repetida', destino: { sceneId: 'scene_d', pinId: 'd' } },
      { id: 'x'.repeat(65), rotulo: 'X', destino: { sceneId: 'scene_c', pinId: 'c' } },
      'lixo',
      null,
      { id: 'saida_rotulo_torto', rotulo: 42, destino: { sceneId: 'scene_e', pinId: 'e' } },
    ]
    const texto = JSON.stringify({
      id: 'misto',
      pins: [
        { id: 'a', x: 1, y: 2, kind: 'viagem', description: '', image: null, destino: { sceneId: 'scene_b', pinId: 'b' }, saidas },
        { id: 'z', x: 1, y: 2, kind: 'viagem', description: '', image: null, saidas: [{ id: 'q', destino: 'Torre' }], rotulo: 7 },
        { id: 'y', x: 1, y: 2, kind: 'viagem', description: '', image: null, saidas: 'Torre' },
      ],
    })
    const [a, z, y] = deserializeMap(texto).pins
    // Rótulo que não é texto volta vazio (o jogador lê "Saída N"), sem derrubar a saída.
    expect(a.saidas).toEqual([boa, { id: 'saida_rotulo_torto', rotulo: '', destino: { sceneId: 'scene_e', pinId: 'e' } }])
    expect(z.saidas).toBeUndefined()
    expect(z.rotulo).toBeUndefined()
    expect(y.saidas).toBeUndefined()
  })

  it('`escolhas` (só do recorte do jogador) nunca entra no mapa do mestre pelo disco', () => {
    const texto = JSON.stringify({
      id: 'forjado',
      pins: [{ id: 'a', x: 1, y: 2, kind: 'viagem', description: '', image: null, escolhas: [{ id: 'principal', rotulo: 'X' }] }],
    })
    expect(deserializeMap(texto).pins[0].escolhas).toBeUndefined()
    expect(serializeMap(deserializeMap(texto))).not.toContain('escolhas')
  })
})
