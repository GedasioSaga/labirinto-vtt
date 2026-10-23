/**
 * FATIA 6 (painel das 13 camadas): as ações do painel sobre o estado da cena
 * e a VIRADA para o mapa v2 (`docs/planos/camadas-fase3-2026-10-22.md`).
 *
 * A virada é a promessa central: no instante em que o mapa vira v2, NADA muda
 * na tela. A matriz confere `mestreVe`, `jogadorVe`, `travada` e `alfa` das 13
 * camadas antes e depois, em todo mapa de antes (as 512 combinações do olho).
 */
import { describe, expect, it } from 'vitest'
import type { CamadaId, LayerId, MapData, Region } from '../../types/map'
import { LAYER_IDS } from '../../types/map'
import { createEmptyMap } from '../mapFactory'
import { caminho, carimbo, ficha, parede, peca, rabisco, regiao, texto } from '../__fixtures__/itensDeCamada'
import { contextoDeCamadas } from './consulta'
import {
  alternarCadeado,
  alternarOlhoDoMestre,
  alternarOlhoDosJogadores,
  contarItensPorCamada,
  definirOpacidade,
  paraVersao2,
} from './estado'
import { CAMADAS_PADRAO } from './padrao'

function mapa(campos: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'Estado', 10, 10, 64), ...campos }
}

function subconjunto(bits: number): LayerId[] {
  return LAYER_IDS.filter((_, i) => (bits & (1 << i)) !== 0)
}

/** O que a tela pergunta de cada uma das 13 camadas. */
function retrato(map: MapData): string[] {
  const camadas = contextoDeCamadas(map)
  return CAMADAS_PADRAO.map((id) => `${id}:${camadas.mestreVe(id)}/${camadas.jogadorVe(id)}/${camadas.travada(id)}/${camadas.alfa(id)}`)
}

describe('paraVersao2: a virada não muda nada na tela', () => {
  it('matriz: as 512 combinações do olho, com cadeado e olho dos jogadores variando, dão o mesmo retrato antes e depois', () => {
    for (let bits = 0; bits < 512; bits += 1) {
      const ocultas = subconjunto(bits)
      const travadas = subconjunto((bits * 37) % 512)
      // Mapa de antes que já traz a lista dos jogadores (fatia 2), com entradas mudas de Chão e Desenhos.
      const doJogador: CamadaId[] | undefined = bits % 3 === 0 ? undefined : [...subconjunto((bits * 11) % 512), ...(bits % 2 === 0 ? (['chao'] as const) : (['desenhos'] as const))]
      const antes = mapa({ hiddenLayers: ocultas, lockedLayers: travadas, ...(doJogador === undefined ? {} : { ocultasDoJogador: doJogador }), opacidadeDasCamadas: { objetos: 0.5 } })
      const depois = paraVersao2(antes)
      expect(depois.versaoDasCamadas).toBe(2)
      expect(retrato(depois), `combinação ${bits}`).toEqual(retrato(antes))
    }
  })

  it('materializa: Salas oculta deixa Chão oculto explícito; Anotações travada deixa Desenhos travada; a lista dos jogadores nasce da do mestre', () => {
    const depois = paraVersao2(mapa({ hiddenLayers: ['salas'], lockedLayers: ['anotacoes'] }))
    expect(depois.hiddenLayers).toEqual(['salas', 'chao'])
    expect(depois.lockedLayers).toEqual(['anotacoes', 'desenhos'])
    expect(depois.ocultasDoJogador).toEqual(['salas', 'chao'])
  })

  it('é idempotente: mapa v2 volta o MESMO objeto, e virar duas vezes dá o mesmo que uma', () => {
    const uma = paraVersao2(mapa({ hiddenLayers: ['salas', 'anotacoes'] }))
    expect(paraVersao2(uma)).toBe(uma)
    const v2 = mapa({ versaoDasCamadas: 2, hiddenLayers: ['chao'] })
    expect(paraVersao2(v2)).toBe(v2)
  })
})

describe('olhos, cadeado e opacidade', () => {
  it('olho do mestre nas 9 de antes, mapa de antes: o sentido antigo (some para todos), o mapa fica v1', () => {
    const depois = alternarOlhoDoMestre(mapa(), 'paredes')
    expect(depois.versaoDasCamadas).toBeUndefined()
    expect(depois.hiddenLayers).toEqual(['paredes'])
    expect(contextoDeCamadas(depois).jogadorVe('paredes')).toBe(false)
    expect(alternarOlhoDoMestre(depois, 'paredes').hiddenLayers).toEqual([])
  })

  it('olho do mestre de Telhados (camada nova) vira o mapa v2: só o mestre deixa de ver', () => {
    const depois = alternarOlhoDoMestre(mapa(), 'telhados')
    expect(depois.versaoDasCamadas).toBe(2)
    const camadas = contextoDeCamadas(depois)
    expect(camadas.mestreVe('telhados')).toBe(false)
    expect(camadas.jogadorVe('telhados')).toBe(true)
  })

  it('olho do mestre de Chão com Salas oculta (mapa de antes): vira v2 e mostra SÓ o Chão', () => {
    const depois = alternarOlhoDoMestre(mapa({ hiddenLayers: ['salas'] }), 'chao')
    const camadas = contextoDeCamadas(depois)
    expect(camadas.mestreVe('chao')).toBe(true)
    expect(camadas.mestreVe('salas')).toBe(false)
  })

  it('olho dos jogadores: vira v2 e mexe só no dos jogadores; de novo, volta', () => {
    const antes = mapa({ hiddenLayers: ['portas'] })
    const depois = alternarOlhoDosJogadores(antes, 'tokens')
    const camadas = contextoDeCamadas(depois)
    expect(depois.versaoDasCamadas).toBe(2)
    expect(camadas.jogadorVe('tokens')).toBe(false)
    expect(camadas.mestreVe('tokens')).toBe(true)
    // A oculta de antes continua oculta para os dois.
    expect(camadas.jogadorVe('portas')).toBe(false)
    expect(camadas.mestreVe('portas')).toBe(false)
    expect(contextoDeCamadas(alternarOlhoDosJogadores(depois, 'tokens')).jogadorVe('tokens')).toBe(true)
  })

  it('depois da virada, o olho do mestre de Paredes não mexe no dos jogadores', () => {
    const v2 = alternarOlhoDosJogadores(mapa(), 'tokens')
    const camadas = contextoDeCamadas(alternarOlhoDoMestre(v2, 'paredes'))
    expect(camadas.mestreVe('paredes')).toBe(false)
    expect(camadas.jogadorVe('paredes')).toBe(true)
  })

  it('cadeado de Chão com Salas travada (mapa de antes): vira v2 e solta SÓ o Chão', () => {
    const depois = alternarCadeado(mapa({ lockedLayers: ['salas'] }), 'chao')
    const camadas = contextoDeCamadas(depois)
    expect(camadas.travada('chao')).toBe(false)
    expect(camadas.travada('salas')).toBe(true)
    expect(alternarCadeado(mapa(), 'tokens')).toMatchObject({ lockedLayers: ['tokens'] })
    expect(alternarCadeado(mapa(), 'tokens').versaoDasCamadas).toBeUndefined()
  })

  it('opacidade: vira v2, arredonda em 1%, limita a 0..1; 100% tira a chave; valor igual devolve o MESMO mapa', () => {
    const antes = mapa()
    expect(definirOpacidade(antes, 'objetos', 1)).toBe(antes)
    expect(definirOpacidade(antes, 'objetos', Number.NaN)).toBe(antes)
    const meio = definirOpacidade(antes, 'objetos', 0.4567)
    expect(meio.versaoDasCamadas).toBe(2)
    expect(meio.opacidadeDasCamadas).toEqual({ objetos: 0.46 })
    expect(definirOpacidade(meio, 'objetos', 0.46)).toBe(meio)
    expect(definirOpacidade(meio, 'telhados', -3).opacidadeDasCamadas).toEqual({ objetos: 0.46, telhados: 0 })
    expect(definirOpacidade(meio, 'objetos', 7).opacidadeDasCamadas).toEqual({})
  })

  it('contextoDeCamadas respeita hiddenLayers e lockedLayers com os ids novos no mapa v2', () => {
    const camadas = contextoDeCamadas(mapa({ versaoDasCamadas: 2, hiddenLayers: ['chao', 'telhados'], lockedLayers: ['terreno', 'desenhos'], ocultasDoJogador: [] }))
    expect(camadas.mestreVe('chao')).toBe(false)
    expect(camadas.mestreVe('salas')).toBe(true)
    expect(camadas.mestreVe('telhados')).toBe(false)
    expect(camadas.travada('terreno')).toBe(true)
    expect(camadas.travada('desenhos')).toBe(true)
    expect(camadas.travada('anotacoes')).toBe(false)
    expect(camadas.jogadorVe('chao')).toBe(true)
  })
})

describe('contarItensPorCamada', () => {
  it('conta pelo ponto único: Chão, Desenhos separado de Anotações, Telhados das salas com teto, pino de escada fora', () => {
    const comTeto: Region = { ...regiao, id: 'r-teto', room: { shape: 'polygon', name: 'Sala', roof: true } }
    const map = mapa({
      walls: [parede],
      regions: [regiao, comTeto],
      tokens: [ficha],
      drawings: [rabisco, texto, caminho],
      floor: [peca],
      carimbos: [carimbo],
    })
    const contas = contarItensPorCamada(map)
    expect(contas.paredes).toBe(1)
    expect(contas.salas).toBe(2)
    expect(contas.tokens).toBe(1)
    expect(contas.desenhos).toBe(1)
    expect(contas.anotacoes).toBe(2)
    expect(contas.chao).toBe(1)
    expect(contas.terreno).toBe(1)
    expect(contas.telhados).toBe(1)
    expect(contas.escadas ?? 0).toBe(0)
  })
})
