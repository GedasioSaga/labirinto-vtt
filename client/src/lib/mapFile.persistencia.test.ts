/**
 * Perdas de trabalho na ida e volta do disco (`lib/mapFile.ts`).
 *
 * Dois buracos medidos, ambos VERMELHOS ao escrever este arquivo:
 *
 *  1. `deserializeMapFields` (mapFile.ts:38) lista campo por campo e ESQUECE
 *     `gridOffset` (`types/map.ts:516`). `serializeMap` grava o campo no
 *     disco — quem alinha a grade a uma imagem de fundo, salva e reabre,
 *     recebe o mapa com a grade de volta em (0,0). O trabalho de alinhamento
 *     some sem mensagem nenhuma.
 *
 *  2. O mesmo `deserializeMapFields` confia no `map.json` como se ele sempre
 *     viesse do próprio app: `parsed.grid ?? 64` aceita `-8`,
 *     `parsed.width ?? 30` aceita `"30"` (string) e `(parsed.walls ?? [])`
 *     aceita `[null]`. Arquivo editado à mão, truncado ou de versão futura
 *     entra no editor como geometria impossível, em silêncio — ou estoura um
 *     `TypeError` cru de dentro do `.map()`, que para o usuário é a mesma
 *     coisa que "o mapa sumiu".
 *
 * O que os testes de validação exigem NÃO é uma implementação específica: ou
 * o arquivo é recusado com erro CLARO (a casa já usa o prefixo
 * `map.json inválido:` em mapFile.ts:31 e :35), ou o valor impossível é
 * descartado e o mapa que chega ao app é geometricamente válido. O que não
 * pode acontecer é o que acontece hoje: passar direto.
 */
import { describe, expect, it } from 'vitest'
import { serializeMap, deserializeMap } from './mapFile'
import { createEmptyMap } from './mapFactory'
import { computeAlignedGridLines } from './gridAlign'
import type { MapData } from '../types/map'

const VIEWPORT = { left: 0, top: 0, right: 256, bottom: 256 }

function mapaComOffset(offset: { x: number; y: number }): MapData {
  return { ...createEmptyMap('map_offset', 'Mapa alinhado', 30, 20, 64), gridOffset: offset }
}

/** Uma volta completa pelo disco: exatamente o que Salvar + Abrir fazem. */
function idaEVolta(map: MapData): MapData {
  return deserializeMap(serializeMap(map))
}

describe('gridOffset sobrevive a salvar e reabrir', () => {
  it('o offset gravado no map.json volta igual ao reabrir o mapa', () => {
    const salvo = mapaComOffset({ x: 12, y: -7 })

    const reaberto = idaEVolta(salvo)

    expect(reaberto.gridOffset).toEqual({ x: 12, y: -7 })
  })

  it('offset fracionário (encaixe fino na imagem) não é arredondado nem perdido', () => {
    const salvo = mapaComOffset({ x: -0.5, y: 37.25 })

    const reaberto = idaEVolta(salvo)

    expect(reaberto.gridOffset).toEqual({ x: -0.5, y: 37.25 })
  })

  it('a grade reaberta cai nas MESMAS linhas que o usuário alinhou à imagem', () => {
    const salvo = mapaComOffset({ x: 20, y: 5 })
    const linhasAntes = computeAlignedGridLines(salvo.grid, salvo.gridOffset ?? { x: 0, y: 0 }, VIEWPORT)

    const reaberto = idaEVolta(salvo)
    const linhasDepois = computeAlignedGridLines(reaberto.grid, reaberto.gridOffset ?? { x: 0, y: 0 }, VIEWPORT)

    expect(linhasDepois).toEqual(linhasAntes)
  })

  it('mapa salvo com gridOffset não volta como mapa sem alinhamento nenhum', () => {
    const reaberto = idaEVolta(mapaComOffset({ x: 33, y: 11 }))

    expect(reaberto.gridOffset).not.toBeUndefined()
  })
})

/**
 * Aceita as DUAS saídas honestas para um `map.json` impossível — recusar com
 * erro claro, ou descartar o valor ruim e entregar um mapa válido — e reprova
 * a terceira, que é a de hoje: aceitar calado, ou estourar erro cru de
 * runtime (`TypeError: Cannot read properties of null`), que não diz ao
 * usuário o que aconteceu com o arquivo dele.
 */
function exigeRecusaClaraOuDescarte(json: string, mapaSaneado: (map: MapData) => boolean): void {
  let recebido: MapData | undefined
  try {
    recebido = deserializeMap(json)
  } catch (error) {
    const mensagem = (error as Error).message
    expect(mensagem, `erro cru em vez de mensagem clara: "${mensagem}"`).toMatch(/map\.json inválido/i)
    return
  }
  expect(mapaSaneado(recebido), `aceitou em silêncio: ${JSON.stringify(recebido)}`).toBe(true)
}

describe('map.json com valor impossível não entra no app em silêncio', () => {
  it('grid negativo (-8) é recusado com erro claro ou descartado — grade de célula negativa não existe', () => {
    const json = serializeMap({ ...createEmptyMap('map_ruim', 'Ruim', 30, 20, 64), grid: -8 } as MapData)

    exigeRecusaClaraOuDescarte(json, (map) => map.grid > 0)
  })

  it('grid zero é recusado ou descartado — cada divisão por célula vira Infinity', () => {
    const json = serializeMap({ ...createEmptyMap('map_ruim', 'Ruim', 30, 20, 64), grid: 0 } as MapData)

    exigeRecusaClaraOuDescarte(json, (map) => map.grid > 0)
  })

  it('width como string ("30") é recusado ou convertido — número de texto contamina todo cálculo de mundo', () => {
    const base = createEmptyMap('map_ruim', 'Ruim', 30, 20, 64)
    const json = JSON.stringify({ ...base, width: '30' })

    exigeRecusaClaraOuDescarte(json, (map) => typeof map.width === 'number' && Number.isFinite(map.width) && map.width > 0)
  })

  it('height 0 é recusado ou descartado — mapa de zero linhas não é mapa', () => {
    const base = createEmptyMap('map_ruim', 'Ruim', 30, 20, 64)
    const json = JSON.stringify({ ...base, height: 0 })

    exigeRecusaClaraOuDescarte(json, (map) => typeof map.height === 'number' && Number.isFinite(map.height) && map.height > 0)
  })

  it('walls: [null] é recusado com erro claro ou a parede quebrada é descartada', () => {
    const base = createEmptyMap('map_ruim', 'Ruim', 30, 20, 64)
    const json = JSON.stringify({ ...base, walls: [null] })

    exigeRecusaClaraOuDescarte(json, (map) => map.walls.every((wall) => wall !== null && typeof wall === 'object'))
  })

  it('regions que não é lista ("nenhuma") é recusado com erro claro ou descartado', () => {
    const base = createEmptyMap('map_ruim', 'Ruim', 30, 20, 64)
    const json = JSON.stringify({ ...base, regions: 'nenhuma' })

    exigeRecusaClaraOuDescarte(json, (map) => Array.isArray(map.regions))
  })
})
