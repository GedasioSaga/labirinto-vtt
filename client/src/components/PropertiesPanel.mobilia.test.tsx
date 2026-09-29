import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { criarMovel, TIPOS_MOBILIA } from '../lib/mobilia'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { relevantPropertyGroups } from '../lib/toolProperties'
import { useMapStore } from '../stores/mapStore'
import type { Prop } from '../types/map'
import type { MobiliaControlsProps } from './MobiliaControls'
import { PropertiesPanel } from './PropertiesPanel'
import { propsDoPainel } from './propertiesPanelTestProps'

/*
 * PROPRIEDADES DO MÓVEL, na costura com o `PropertiesPanel` de verdade: com um
 * móvel desenhado selecionado, o cabeçalho diz o que ele é ("Mesa") e a seção
 * "Móvel" (Tipo, Vista na cadeira e no baú, Preencher, Cor, Cor da linha) vem antes de "Objeto". Objeto de
 * imagem continua como estava: "Peça", sem seção "Móvel".
 */

const MESA: Prop = criarMovel('mesa', { x: 300, y: 200 }, 64, 'm1')
const DE_IMAGEM: Prop = { id: 'img', src: 'x.png', x: 100, y: 100, width: 64, height: 64, linkedMapPath: null }
const nada = (): void => {}

describe('painel de propriedades — o móvel selecionado', () => {
  let container: HTMLDivElement
  let root: Root
  const onTipoChange = vi.fn<MobiliaControlsProps['onTipoChange']>()
  const onAparenciaChange = vi.fn<MobiliaControlsProps['onAparenciaChange']>()
  const onVistaChange = vi.fn<MobiliaControlsProps['onVistaChange']>()

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    onTipoChange.mockClear()
    onAparenciaChange.mockClear()
    onVistaChange.mockClear()
    useMapStore.setState({
      map: { ...createEmptyMap('m1', 'Casa', 30, 20, 64), props: [MESA, DE_IMAGEM] },
      camera: { x: 0, y: 0, scale: 1 },
      selection: EMPTY_SELECTION,
      past: [],
      future: [],
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    window.localStorage.clear()
  })

  /** Como o App liga com a ferramenta Selecionar e UM objeto selecionado. */
  function renderObjeto(prop: Prop): void {
    act(() =>
      root.render(
        <PropertiesPanel
          {...propsDoPainel(null, {
            groups: relevantPropertyGroups('select', { prop: true }),
            selection: { selection: { kind: 'prop', count: 1 }, defaultTokenName: 'Token 1', onAddToken: nada, onRemoveSelected: nada },
            selectedProp: prop,
            propMobilia: { onTipoChange, onAparenciaChange, onVistaChange },
          })}
        />,
      ),
    )
  }

  const corpo = () => container.querySelector<HTMLElement>('.lb-inspector__body')
  const texto = (el: Element | null | undefined) => (el?.textContent ?? '').trim()
  const h2 = (nome: string) => Array.from(corpo()?.querySelectorAll('h2') ?? []).find((h) => texto(h) === nome) ?? null
  const cabecalho = () => texto(container.querySelector('.lb-selhead__name'))
  /** O controle ligado ao `<label>` de texto `nome`. */
  const campo = (nome: string) => {
    const label = Array.from(container.querySelectorAll('label')).find((l) => texto(l) === nome)
    return label?.htmlFor ? document.getElementById(label.htmlFor) : null
  }
  const interruptor = (rotulo: string) =>
    Array.from(container.querySelectorAll('label.lb-switch')).find((l) => texto(l) === rotulo)?.querySelector('input') ?? null
  const botoes = (nome: string) => Array.from(container.querySelectorAll('button')).filter((b) => texto(b) === nome)
  /** `a` vem antes de `b` no documento. */
  const antes = (a: Node | null, b: Node | null) => a !== null && b !== null && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  /** O grupo "Vista" (Frente | Lado) e uma opção dele pelo texto. */
  const vista = () => container.querySelector<HTMLElement>('[role="radiogroup"][aria-label="Vista"]')
  const opcao = (nome: string) => Array.from(vista()?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []).find((b) => texto(b) === nome) ?? null

  /** Troca o valor como a pessoa troca: setter nativo + o evento que o React ouve em cada controle. */
  function escolhe(alvo: HTMLElement | null, valor: string): void {
    if (!(alvo instanceof HTMLSelectElement) && !(alvo instanceof HTMLInputElement)) throw new Error('esperava select ou input')
    const proto = alvo instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    act(() => {
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(alvo, valor)
      alvo.dispatchEvent(new Event(alvo instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
    })
  }

  it('a mesa: o cabeçalho diz "Mesa" e a seção "Móvel" vem antes de "Objeto"', () => {
    renderObjeto(MESA)
    expect(cabecalho()).toBe('Mesa')
    expect(h2('Móvel')).not.toBeNull()
    expect(antes(h2('Móvel'), h2('Objeto'))).toBe(true)
  })

  it('"Tipo" oferece o catálogo, marca o tipo de agora e troca pelo id do móvel', () => {
    renderObjeto(MESA)
    const tipo = campo('Tipo')
    if (!(tipo instanceof HTMLSelectElement)) throw new Error('"Tipo" devia ser um select')
    expect(Array.from(tipo.options).map((o) => texto(o))).toEqual(['Barril', 'Caixa', 'Baú', 'Cama', 'Mesa', 'Cadeira'])
    expect(tipo.value).toBe('mesa')

    escolhe(tipo, 'bau')
    expect(onTipoChange).toHaveBeenCalledWith('m1', 'bau')
  })

  it('"Preencher" nasce ligado e o clique manda desligar; desligado, o clique manda ligar', () => {
    renderObjeto(MESA)
    const ligado = interruptor('Preencher')
    expect(ligado?.checked).toBe(true)
    act(() => ligado?.click())
    expect(onAparenciaChange).toHaveBeenLastCalledWith('m1', { preenchido: false })

    renderObjeto({ ...MESA, mobiliaPreenchido: false })
    const desligado = interruptor('Preencher')
    expect(desligado?.checked).toBe(false)
    act(() => desligado?.click())
    expect(onAparenciaChange).toHaveBeenLastCalledWith('m1', { preenchido: true })
  })

  it('sem cor própria: o seletor mostra a cor de hoje, não há "Padrão", e escolher manda a cor', () => {
    renderObjeto(MESA)
    const cor = campo('Cor')
    const corDaLinha = campo('Cor da linha')
    expect(cor instanceof HTMLInputElement && cor.type === 'color' ? cor.value : null).toBe('#000000')
    expect(corDaLinha instanceof HTMLInputElement && corDaLinha.type === 'color' ? corDaLinha.value : null).toBe('#d8d2c4')
    expect(botoes('Padrão')).toHaveLength(0)

    escolhe(cor, '#8b4513')
    expect(onAparenciaChange).toHaveBeenLastCalledWith('m1', { cor: '#8b4513' })
    escolhe(corDaLinha, '#c0392b')
    expect(onAparenciaChange).toHaveBeenLastCalledWith('m1', { corDaLinha: '#c0392b' })
  })

  it('com cor própria: o seletor mostra a cor do móvel e "Padrão" de cada uma volta ao padrão', () => {
    renderObjeto({ ...MESA, mobiliaCor: '#8b4513', mobiliaCorDaLinha: '#c0392b' })
    const cor = campo('Cor')
    expect(cor instanceof HTMLInputElement ? cor.value : null).toBe('#8b4513')
    expect(botoes('Padrão')).toHaveLength(2)

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Padrão da cor"]')?.click())
    expect(onAparenciaChange).toHaveBeenLastCalledWith('m1', { cor: null })
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Padrão da cor da linha"]')?.click())
    expect(onAparenciaChange).toHaveBeenLastCalledWith('m1', { corDaLinha: null })
  })

  it('sem "Preencher" a "Cor" fica inerte e guarda a cor; a "Cor da linha" segue valendo', () => {
    renderObjeto({ ...MESA, mobiliaPreenchido: false, mobiliaCor: '#8b4513' })
    const cor = campo('Cor')
    expect(cor instanceof HTMLInputElement ? [cor.disabled, cor.value] : null).toEqual([true, '#8b4513'])
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Padrão da cor"]')?.disabled).toBe(true)
    const corDaLinha = campo('Cor da linha')
    expect(corDaLinha instanceof HTMLInputElement ? corDaLinha.disabled : null).toBe(false)
  })

  it('"Vista" só aparece para cadeira e baú', () => {
    const comVista = TIPOS_MOBILIA.filter((tipo) => {
      renderObjeto(criarMovel(tipo, { x: 300, y: 200 }, 64, 'c1'))
      return vista() !== null
    })
    expect(comVista).toEqual(['bau', 'cadeira'])
  })

  it('a cadeira: "Vista" vem entre "Tipo" e "Preencher", marca Frente e o clique em Lado manda a vista', () => {
    renderObjeto(criarMovel('cadeira', { x: 300, y: 200 }, 64, 'c1'))
    expect(antes(campo('Tipo'), vista())).toBe(true)
    expect(antes(vista(), interruptor('Preencher'))).toBe(true)
    expect(opcao('Frente')?.getAttribute('aria-checked')).toBe('true')
    expect(opcao('Lado')?.getAttribute('aria-checked')).toBe('false')

    act(() => opcao('Lado')?.click())
    expect(onVistaChange).toHaveBeenCalledWith('c1', 'lado')
  })

  it('a cadeira de lado: "Vista" marca Lado', () => {
    renderObjeto({ ...criarMovel('cadeira', { x: 300, y: 200 }, 64, 'c1'), mobiliaVista: 'lado' })
    expect(opcao('Lado')?.getAttribute('aria-checked')).toBe('true')
    expect(opcao('Frente')?.getAttribute('aria-checked')).toBe('false')
  })

  it('objeto de imagem: cabeçalho "Peça" e nada de seção "Móvel"', () => {
    renderObjeto(DE_IMAGEM)
    expect(cabecalho()).toBe('Peça')
    expect(h2('Objeto')).not.toBeNull()
    expect(h2('Móvel')).toBeNull()
    expect(campo('Tipo')).toBeNull()
    expect(interruptor('Preencher')).toBeNull()
    expect(vista()).toBeNull()
  })
})
