/**
 * GRADE "Ícone no mapa" x tipo do pino. A grade só aparece no painel do
 * mestre (`PropertiesPanel`) para o tipo que DESENHA o ícone escolhido. Na
 * alavanca e na viagem ela gravaria `icon` e abriria um passo no desfazer sem
 * mudar nada na tela — controle morto.
 */
import { describe, expect, it } from 'vitest'
import type { PinKind } from '../types/map'
import { buildPin } from './mapFactory'
import { PIN_KIND_ORDER, pinKindShowsIcon, pinSummary } from './pins'

describe('pinKindShowsIcon', () => {
  it('alavanca e viagem não mostram a grade; "!" e "?" mostram', () => {
    const mostra = PIN_KIND_ORDER.filter((kind) => pinKindShowsIcon(kind))
    expect(mostra).toEqual(['exclamacao', 'interrogacao'])
    expect(pinKindShowsIcon('alavanca')).toBe(false)
    expect(pinKindShowsIcon('viagem')).toBe(false)
  })

  it('a grade aparece exatamente onde o ícone muda o que o mestre lê do pino', () => {
    const efeito = (kind: PinKind): boolean => {
      const semIcone = buildPin('p', { x: 0, y: 0 }, kind)
      return pinSummary({ ...semIcone, icon: 'bau' }) !== pinSummary(semIcone)
    }
    for (const kind of PIN_KIND_ORDER) {
      expect(pinKindShowsIcon(kind), kind).toBe(efeito(kind))
    }
  })
})
