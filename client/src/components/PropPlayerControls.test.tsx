import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { PROP_PLAYER_LABEL_MAX } from '../lib/propPlayerLook'
import { useMapStore } from '../stores/mapStore'
import { setPropLabelForPlayers, setPropImageShownToPlayers } from '../stores/propPlayerLook'
import type { Prop } from '../types/map'
import { PropPlayerControls } from './PropPlayerControls'

/**
 * OBJETO COM RÓTULO OU IMAGEM, no PAINEL do mestre. "Rótulo para jogadores" e
 * "Mostrar imagem ao jogador" moram na seção do objeto selecionado e gravam no
 * mapa com desfazer — é de lá que o recorte (`lib/fogFilter.ts`) os lê.
 */

const IMAGEM_DO_PIANO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const PIANO: Prop = { id: 'piano', src: 'C:/mapas/mansao/piano.png', x: 300, y: 300, width: 80, height: 60, linkedMapPath: null }

function pianoNoStore(): Prop | undefined {
  return useMapStore.getState().map.props.find((p) => p.id === 'piano')
}

function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('PropPlayerControls — o que o jogador fica sabendo do objeto', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    useMapStore.setState({ map: { ...createEmptyMap('m1', 'Mansão', 20, 20, 40), props: [PIANO] }, selection: [], past: [], future: [] })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function renderDoStore(onShowImageChange: (show: boolean) => void = vi.fn()): void {
    const prop = pianoNoStore()
    if (prop === undefined) throw new Error('o piano sumiu do mapa')
    act(() =>
      root.render(
        <PropPlayerControls
          label={prop.playerLabel ?? ''}
          showImage={prop.playerImage !== undefined}
          onLabelChange={(label) => setPropLabelForPlayers(prop.id, label)}
          onShowImageChange={onShowImageChange}
        />,
      ),
    )
  }

  function campoDoRotulo(): HTMLInputElement {
    const campo = Array.from(container.querySelectorAll('label')).find((l) => l.textContent === 'Rótulo para jogadores')
    const alvo = campo?.htmlFor ? document.getElementById(campo.htmlFor) : null
    if (!(alvo instanceof HTMLInputElement)) throw new Error('sem o campo "Rótulo para jogadores" ligado a um label')
    return alvo
  }

  function interruptorDaImagem(): HTMLInputElement {
    const rotulo = Array.from(container.querySelectorAll('label')).find((l) => (l.textContent ?? '').includes('Mostrar imagem ao jogador'))
    const caixa = rotulo?.querySelector('input[type="checkbox"]')
    if (!(caixa instanceof HTMLInputElement)) throw new Error('sem o interruptor "Mostrar imagem ao jogador"')
    return caixa
  }

  it('digitar "Guarda-roupa" grava o rótulo no objeto, com desfazer, e o campo mostra o que foi gravado', () => {
    renderDoStore()
    const campo = campoDoRotulo()
    expect(campo.value).toBe('')
    expect(campo.maxLength).toBe(PROP_PLAYER_LABEL_MAX)

    digitar(campo, 'Guarda-roupa')
    expect(pianoNoStore()?.playerLabel).toBe('Guarda-roupa')
    expect(useMapStore.getState().past.length).toBe(1)

    renderDoStore()
    expect(campoDoRotulo().value).toBe('Guarda-roupa')
  })

  it('o espaço digitado entre as palavras não é comido no meio da digitação', () => {
    renderDoStore()
    digitar(campoDoRotulo(), 'Piano ')
    expect(pianoNoStore()?.playerLabel).toBe('Piano ')
  })

  it('apagar o rótulo tira o campo do objeto (o jogador volta a ver só a silhueta)', () => {
    renderDoStore()
    digitar(campoDoRotulo(), 'Guarda-roupa')
    renderDoStore()
    digitar(campoDoRotulo(), '')
    expect(pianoNoStore()?.playerLabel).toBeUndefined()
    expect(pianoNoStore()?.id).toBe('piano')
  })

  it('"Mostrar imagem ao jogador" começa desligado e o clique pede para ligar', () => {
    const onShowImageChange = vi.fn()
    renderDoStore(onShowImageChange)
    const caixa = interruptorDaImagem()
    expect(caixa.checked).toBe(false)
    act(() => caixa.click())
    expect(onShowImageChange).toHaveBeenCalledWith(true)
  })

  it('ligar monta a cópia pequena a partir da imagem do objeto e grava; desligar apaga a cópia', async () => {
    const montar = vi.fn(async () => IMAGEM_DO_PIANO)
    await setPropImageShownToPlayers('piano', true, montar)
    expect(montar).toHaveBeenCalledWith('C:/mapas/mansao/piano.png')
    expect(pianoNoStore()?.playerImage).toBe(IMAGEM_DO_PIANO)

    renderDoStore()
    expect(interruptorDaImagem().checked).toBe(true)

    await setPropImageShownToPlayers('piano', false, montar)
    expect(pianoNoStore()?.playerImage).toBeUndefined()
    expect(montar).toHaveBeenCalledTimes(1)
  })

  it('cópia que não sai na forma auto-contida não é gravada e o erro sobe para o aviso do app', async () => {
    const montar = vi.fn(async () => 'C:/mapas/mansao/piano.png')
    await expect(setPropImageShownToPlayers('piano', true, montar)).rejects.toThrow()
    expect(pianoNoStore()?.playerImage).toBeUndefined()
    expect(pianoNoStore()?.id).toBe('piano')
  })
})
