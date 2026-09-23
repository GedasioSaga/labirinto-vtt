/**
 * O painel do pino de viagem enquanto as cenas de fundo ainda chegam do
 * disco (abrir aventura rápido): "carregando" não é "não abriu".
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PinTravel, TravelSceneOption } from '../lib/pinTravel'
import { SAIDA_PRINCIPAL } from '../lib/pinTravel'
import { PinTravelControls } from './PinTravelControls'

const nada = () => undefined

function html(travel: PinTravel, scenes: readonly TravelSceneOption[]): string {
  return renderToStaticMarkup(
    <PinTravelControls
      exits={[{ id: SAIDA_PRINCIPAL, rotulo: '', travel }]}
      scenes={scenes}
      pinsIn={() => []}
      onLinkNew={nada}
      onLinkExisting={nada}
      onUnlink={nada}
      onRename={nada}
      onGo={nada}
      passage="pede"
      onPassageChange={nada}
      onOneWayChange={nada}
      arrivalOnly={false}
    />,
  )
}

describe('PinTravelControls: destino ainda vindo do disco', () => {
  it('pino ligado a uma cena carregando diz que ela está sendo lida, e não que o arquivo sumiu', () => {
    const markup = html({ status: 'indisponivel', sceneId: 's_cripta', sceneName: 'Cripta', loading: true }, [
      { id: 's_cripta', name: 'Cripta', available: false, loading: true },
    ])
    expect(markup).toContain('Leva a <strong class="lb-travel__scene">Cripta</strong>')
    expect(markup).toContain('A cena ainda está sendo lida do disco.')
    expect(markup).not.toContain('não foi encontrado')
  })

  it('pino ligado a uma cena que não abriu continua dizendo que o arquivo não foi encontrado', () => {
    const markup = html({ status: 'indisponivel', sceneId: 's_cripta', sceneName: 'Cripta' }, [{ id: 's_cripta', name: 'Cripta', available: false }])
    expect(markup).toContain('A cena não abriu: o arquivo dela não foi encontrado.')
  })

  it('pino sem destino, com as outras cenas ainda carregando, não diz que elas não abriram', () => {
    const markup = html({ status: 'sem-destino' }, [
      { id: 's_cripta', name: 'Cripta', available: false, loading: true },
      { id: 's_torre', name: 'Torre', available: false },
    ])
    expect(markup).toContain('As outras cenas ainda estão sendo lidas do disco.')
    expect(markup).not.toContain('As outras cenas não abriram.')
  })

  it('pino sem destino, com todas as outras cenas sem abrir, continua dizendo que não abriram', () => {
    const markup = html({ status: 'sem-destino' }, [{ id: 's_torre', name: 'Torre', available: false }])
    expect(markup).toContain('As outras cenas não abriram.')
  })
})
