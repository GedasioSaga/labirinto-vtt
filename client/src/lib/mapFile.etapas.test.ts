/**
 * ETAPAS DO POSTO no disco (Caminhos F4). Os passos da patrulha viram etapas
 * do posto da rotina (`PostoDaRotina.passos`), lidos pela mesma regra
 * (`readPassos`). Metas:
 * - mapa antigo com patrulha (pontos com e sem passos, velocidade, modo) e
 *   rotina sem etapas volta IGUAL no round-trip, sem campo novo;
 * - posto com etapas guarda as boas e perde a torta; lista vazia fica vazia;
 * - "Gravar aqui" de novo (`gravarPosto` sem `passos`) mantém as etapas.
 */
import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { gravarPosto, rotinaDoArquivo } from './rotinaDoNpc'

const guarda: Token = {
  id: 'guarda',
  characterId: null,
  name: 'Guarda',
  x: 100,
  y: 100,
  size: 1,
  image: null,
  npc: true,
  patrulha: {
    pontos: [
      { x: 100, y: 100 },
      { x: 300, y: 100, passos: [{ tipo: 'esperar', segundos: 5 }, { tipo: 'falar', texto: 'Alto!' }, { tipo: 'olhar', graus: 90 }] },
      { x: 300, y: 300, passos: [] },
    ],
    atual: 1,
    velocidade: 3,
    modo: 'vai-e-volta',
  },
}

const tobias: Token = {
  id: 'tobias',
  characterId: null,
  name: 'Irmão Tobias',
  x: 200,
  y: 200,
  size: 1,
  image: null,
  npc: true,
  rotina: {
    estadoId: 'apito',
    postos: [
      { valor: 'Aurora', sceneId: 's1', x: 200, y: 200 },
      { valor: 'Meio', sceneId: 's1', x: 400, y: 200, periodo: 'noite' },
    ],
  },
}

function idaEVolta(tokens: Token[]): Token[] {
  const original = { ...createEmptyMap('m', 'Mapa', 20, 20, 50), tokens }
  return deserializeMap(serializeMap(original)).tokens
}

describe('mapFile: etapas do posto e patrulha antiga', () => {
  it('mapa antigo com patrulha e rotina sem etapas volta igual', () => {
    const volta = idaEVolta([guarda, tobias])
    expect(volta).toEqual([guarda, tobias])
    const postos = volta.find((t) => t.id === 'tobias')?.rotina?.postos ?? []
    expect(postos.some((p) => 'passos' in p)).toBe(false)
    // Depois da primeira volta, salvar e abrir de novo dá o mesmo texto: nada muda a cada salvar.
    const uma = serializeMap(deserializeMap(serializeMap({ ...createEmptyMap('m', 'Mapa', 20, 20, 50), tokens: [guarda, tobias] })))
    expect(serializeMap(deserializeMap(uma))).toBe(uma)
  })

  it('posto com etapas: as boas ficam, a torta sai, a lista vazia fica vazia', () => {
    const comEtapas: Token = {
      ...tobias,
      rotina: {
        estadoId: 'apito',
        postos: [
          { valor: 'Aurora', sceneId: 's1', x: 200, y: 200, passos: [] },
          { valor: 'Meio', sceneId: 's1', x: 400, y: 200, passos: [{ tipo: 'falar', texto: 'Bom dia' }, { tipo: 'esperar', segundos: 3 }] },
        ],
      },
    }
    expect(idaEVolta([comEtapas])).toEqual([comEtapas])
    const lida = rotinaDoArquivo({
      estadoId: 'apito',
      postos: [{ valor: 'Meio', sceneId: 's1', x: 1, y: 2, passos: [{ tipo: 'voar' }, { tipo: 'esperar', segundos: 9999 }, 'texto'] }],
    })
    // Passo desconhecido e texto solto saem; a espera fica presa ao teto da patrulha (600 s).
    expect(lida?.postos[0]?.passos).toEqual([{ tipo: 'esperar', segundos: 600 }])
    // `passos` que não é lista: o posto fica, sem etapas (esperar 2 s, como antes do campo).
    const semLista = rotinaDoArquivo({ estadoId: 'apito', postos: [{ valor: 'Meio', sceneId: 's1', x: 1, y: 2, passos: 'falar' }] })
    expect(semLista?.postos[0]).toEqual({ valor: 'Meio', sceneId: 's1', x: 1, y: 2 })
  })

  it('"Gravar aqui" de novo muda o lugar e mantém as etapas e o período', () => {
    const rotina = { estadoId: 'apito', postos: [{ valor: 'Meio', sceneId: 's1', x: 1, y: 2, periodo: 'noite' as const, passos: [{ tipo: 'falar' as const, texto: 'Oi' }] }] }
    const regravada = gravarPosto(rotina, { valor: 'Meio', sceneId: 's2', x: 5, y: 6 })
    expect(regravada.postos).toEqual([{ valor: 'Meio', sceneId: 's2', x: 5, y: 6, periodo: 'noite', passos: [{ tipo: 'falar', texto: 'Oi' }] }])
  })
})
