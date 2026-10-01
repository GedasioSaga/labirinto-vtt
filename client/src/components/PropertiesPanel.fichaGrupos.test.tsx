import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { useMapStore } from '../stores/mapStore'
import type { Token } from '../types/map'
import { PropertiesPanel, type PisosWiring } from './PropertiesPanel'
import { propsDoPainel, type PainelProps } from './propertiesPanelTestProps'
import { RotinaDaFichaControls } from './RotinaDaFichaControls'
import { CARRY_TO_LABEL } from './TokenSceneCarryControls'

/*
 * A FICHA EM GRUPOS COM TÍTULO (peça ux-ficha-grupos), no molde do painel
 * Design do Figma UI3: cada grupo tem UM título, que não se repete, e os
 * opcionais de comportamento moram juntos sob o deles, com a linha "+" vazia
 * dentro. O grupo não se recolhe: nada que estava à vista passa a pedir um
 * clique novo.
 */

const GUARDA: Token = { id: 'guarda', characterId: null, name: 'Guarda', x: 320, y: 320, size: 1, image: null }
/** A mesma ficha com vigia, rota e veículo: os opcionais preenchidos continuam no grupo, abertos. */
const GUARDA_CHEIO: Token = {
  ...GUARDA,
  vigia: { direcao: 270, abertura: 60, alcance: 9 },
  patrulha: { pontos: [{ x: 320, y: 320 }, { x: 640, y: 320 }], atual: 0 },
  veiculo: { lugares: 2 },
}
const nada = (): void => {}
const PISOS: PisosWiring = { onTokenPisoChange: nada, onStairPisosChange: nada, pisoAtivo: 0, onEditarPiso: nada, onLevarSelecaoAoPiso: nada }

/** Como o App liga numa aventura: rotina (sem estado ainda), a tocha presa na ficha e outra cena para onde levar. */
function daAventura(ficha: Token): Partial<PainelProps> {
  return {
    rotinaDaFicha: <RotinaDaFichaControls token={ficha} estados={[]} cenas={[]} cenaAberta="capela" onChange={nada} />,
    tokenLights: { lights: [{ id: 'tocha', attached: true }], onSelectLight: nada, onDetach: nada },
    tokenSceneCarry: { destinations: [{ sceneId: 'porao', name: 'Porão', arrivals: [] }], ownedTokenIds: new Set(), onCarry: () => true },
  }
}

describe('painel de propriedades — a ficha em grupos com título', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    useMapStore.setState({
      map: { ...createEmptyMap('m1', 'Casa', 30, 20, 64), tokens: [GUARDA] },
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

  function renderFicha(ficha: Token = GUARDA, extra: Partial<PainelProps> = {}): void {
    act(() =>
      root.render(
        <PropertiesPanel
          {...propsDoPainel(ficha, {
            selection: { selection: { kind: 'token', count: 1 }, defaultTokenName: 'Token 1', onAddToken: nada, onRemoveSelected: nada },
            tokenTransform: { onRotationChange: nada, onLockedChange: nada, onHiddenChange: nada, onSecretChange: nada },
            // Como o App liga: pisos e veículo presentes.
            pisos: PISOS,
            tokenVehicle: { options: [], onSeatsChange: nada, onPassengerChange: nada },
            ...extra,
          })}
        />,
      ),
    )
  }

  const corpo = () => container.querySelector<HTMLElement>('.lb-inspector__body')
  const texto = (el: Element | null | undefined) => (el?.textContent ?? '').trim()
  /**
   * Os títulos do bloco da ficha, em ordem de DOM: os `h2` do corpo fora dos
   * grupos Aventura e Esta cena (`.lb-zona`) e fora do Acervo — o que está na
   * mão, e só ele.
   */
  function titulosDaFicha(): string[] {
    return Array.from(corpo()?.querySelectorAll('h2') ?? [])
      .filter((h) => h.closest('.lb-zona') === null && h.closest('.lb-acervo-painel') === null)
      .map(texto)
  }
  const h2 = (nome: string) => Array.from(corpo()?.querySelectorAll('h2') ?? []).find((h) => texto(h) === nome) ?? null
  const interruptor = (rotulo: string) => Array.from(container.querySelectorAll('label.lb-switch')).find((l) => texto(l) === rotulo) ?? null
  const botao = (nome: string) => Array.from(container.querySelectorAll('button')).find((b) => texto(b) === nome) ?? null
  const rotulo = (nome: string) => Array.from(container.querySelectorAll('.lb-label')).find((l) => texto(l) === nome) ?? null
  const campo = (nome: string) => {
    const label = Array.from(container.querySelectorAll('label')).find((l) => texto(l) === nome)
    return label?.htmlFor ? document.getElementById(label.htmlFor) : null
  }
  /** O grupo de um título: a seção que ele abre. */
  const grupoDe = (titulo: string) => h2(titulo)?.closest('section') ?? null
  /** As linhas dos opcionais de comportamento, como a ficha nova as mostra. */
  const linhasDeComportamento = (): [string, Element | null][] => [
    ['Ficha de NPC', interruptor('Ficha de NPC')],
    ['Ficha de jogador', interruptor('Ficha de jogador')],
    ['Esta ficha vigia', interruptor('Esta ficha vigia')],
    ['Patrulha', botao('Patrulha')],
    ['Vai junto de', rotulo('Vai junto de')],
    ['Esta ficha é um veículo', interruptor('Esta ficha é um veículo')],
  ]

  it('cada título de seção da ficha aparece uma vez só, e o primeiro continua "Token"', () => {
    renderFicha(GUARDA, daAventura(GUARDA))
    const titulos = titulosDaFicha()
    // A jornada `ferramentas-mudas` procura o `heading "Token"` com `.first()`.
    expect(titulos[0]).toBe('Token')
    expect(titulos.filter((titulo, i) => titulos.indexOf(titulo) !== i)).toEqual([])
  })

  it('Travado e "Oculto para jogadores" ficam sob um título que diz o que eles fazem', () => {
    renderFicha()
    const secao = interruptor('Travado')?.closest('section')
    expect(texto(secao?.querySelector('h2'))).toBe('Trava e visibilidade')
    expect(interruptor('Oculto para jogadores')?.closest('section')).toBe(secao)
  })

  it('os opcionais de comportamento moram num grupo só, o "Comportamento", depois da imagem e antes do piso', () => {
    renderFicha(GUARDA, daAventura(GUARDA))
    const grupo = grupoDe('Comportamento')
    expect(grupo, 'sem o grupo "Comportamento"').not.toBeNull()
    // O título abre o grupo, e é o único título dentro dele.
    expect(grupo?.firstElementChild).toBe(h2('Comportamento'))
    expect(grupo?.querySelectorAll('h2')).toHaveLength(1)
    const dentro: [string, Element | null][] = [...linhasDeComportamento(), ['Rotina', rotulo('Rotina')], ['Ajustar a luz', botao('Ajustar a luz')]]
    for (const [nome, el] of dentro) {
      expect(el, `sem "${nome}" no painel`).not.toBeNull()
      expect(grupo?.contains(el ?? null), `"${nome}" fora do grupo`).toBe(true)
    }
    // Os fixos de antes e o lugar da ficha continuam fora, cada um no seu.
    for (const [nome, el] of [
      ['Escolher imagem...', botao('Escolher imagem...')],
      ['Piso', campo('Piso')],
      [CARRY_TO_LABEL, botao(CARRY_TO_LABEL)],
    ] as const) {
      expect(el, `sem "${nome}" no painel`).not.toBeNull()
      expect(grupo?.contains(el), `"${nome}" dentro do grupo`).toBe(false)
    }
    const titulos = titulosDaFicha()
    expect(titulos.indexOf('Comportamento')).toBe(titulos.indexOf('Imagem do token') + 1)
    expect(titulos.indexOf('Piso')).toBe(titulos.indexOf('Comportamento') + 1)
  })

  it('o grupo não se recolhe: cada linha à vista, e a linha "+" vazia fechada lá dentro com o controle real', () => {
    renderFicha()
    const grupo = grupoDe('Comportamento')
    // Nenhum botão de abrir e fechar o grupo: o título é só título.
    expect(h2('Comportamento')?.querySelector('button')).toBeNull()
    for (const [nome, el] of linhasDeComportamento()) {
      expect(el?.closest('[hidden]'), `"${nome}" atrás de um clique`).toBeNull()
    }
    const patrulha = botao('Patrulha')
    expect(grupo?.contains(patrulha)).toBe(true)
    expect(patrulha?.getAttribute('aria-expanded')).toBe('false')
    const corpoDaPatrulha = document.getElementById(patrulha?.getAttribute('aria-controls') ?? 'sem-id')
    expect(corpoDaPatrulha?.hidden).toBe(true)
    expect(corpoDaPatrulha?.querySelector('button')).not.toBeNull()
  })

  it('opcional preenchido fica aberto no mesmo grupo: vigia, rota e veículo', () => {
    renderFicha(GUARDA_CHEIO)
    const grupo = grupoDe('Comportamento')
    for (const [nome, el] of [
      ['Para onde olha', container.querySelector('[role="radiogroup"][aria-label="Para onde olha"]')],
      ['Avançar patrulha', botao('Avançar patrulha')],
      ['Lugares', rotulo('Lugares')],
    ] as const) {
      expect(el, `sem "${nome}" no painel`).not.toBeNull()
      expect(grupo?.contains(el), `"${nome}" fora do grupo`).toBe(true)
      expect(el?.closest('[hidden]'), `"${nome}" atrás de um clique`).toBeNull()
    }
  })
})
