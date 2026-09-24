/**
 * PASSAR O MAPA no fio: `map.share` (jogador -> mestre) leva só o NOME do
 * colega; `map.shared` e `map.share.result` (mestre -> jogador) levam só
 * nomes e o sim/não. Campo a mais sai; campo fora do formato recusa tudo.
 */
import { describe, expect, it } from 'vitest'
import { parseMapShareMessage, parsePlayerMessage } from './protocol'

describe('map.share — jogador pede para mostrar o mapa', () => {
  it('aceita o nome do colega e joga fora o resto (nada de cena, posição ou mapa inventado)', () => {
    expect(parsePlayerMessage({ type: 'map.share', to: 'Bruno' })).toEqual({ type: 'map.share', to: 'Bruno' })
    expect(parsePlayerMessage({ type: 'map.share', to: 'Bruno', sceneId: 's-x', explored: { bits: 'AAAA' } })).toEqual({ type: 'map.share', to: 'Bruno' })
  })

  it('recusa sem nome, nome vazio, longo demais ou que não é texto', () => {
    expect(parsePlayerMessage({ type: 'map.share' })).toBeNull()
    expect(parsePlayerMessage({ type: 'map.share', to: '' })).toBeNull()
    expect(parsePlayerMessage({ type: 'map.share', to: 'x'.repeat(200) })).toBeNull()
    expect(parsePlayerMessage({ type: 'map.share', to: 7 })).toBeNull()
  })
})

describe('parseMapShareMessage — o que o jogador recebe', () => {
  it('map.shared: quem passou o mapa, e nada mais', () => {
    expect(parseMapShareMessage({ type: 'map.shared', from: 'Ana', sceneName: 'Cripta' })).toEqual({ type: 'map.shared', from: 'Ana' })
    expect(parseMapShareMessage({ type: 'map.shared', from: '' })).toBeNull()
    expect(parseMapShareMessage({ type: 'map.shared' })).toBeNull()
  })

  it('map.share.result: ok, recusa comum e too_soon; motivo desconhecido vira a recusa comum', () => {
    expect(parseMapShareMessage({ type: 'map.share.result', to: 'Bruno', ok: true })).toEqual({ type: 'map.share.result', to: 'Bruno', ok: true })
    expect(parseMapShareMessage({ type: 'map.share.result', to: 'Bruno', ok: false, reason: 'too_soon' })).toEqual({
      type: 'map.share.result',
      to: 'Bruno',
      ok: false,
      reason: 'too_soon',
    })
    expect(parseMapShareMessage({ type: 'map.share.result', to: 'Bruno', ok: false, reason: 'outro' })).toEqual({ type: 'map.share.result', to: 'Bruno', ok: false })
    expect(parseMapShareMessage({ type: 'map.share.result', to: 'Bruno', ok: 'sim' })).toBeNull()
    expect(parseMapShareMessage({ type: 'clue.shown', from: 'Ana' })).toBeNull()
  })
})
