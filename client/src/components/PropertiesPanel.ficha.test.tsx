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
 * A FICHA EM ORDEM DE TAREFA (peça ficha-em-ordem-de-tarefa), na costura com o
 * `PropertiesPanel` de verdade, no molde do painel Design do Figma UI3 com uma
 * camada selecionada: os FIXOS primeiro (quem é, vida, tamanho, condições,
 * Travado e "Oculto para jogadores", cor, foto, NPC | jogador), os OPCIONAIS de
 * comportamento depois (vigia, patrulha, levar junto, veículo, rotina, luzes),
 * uma linha cada enquanto vazios, e Piso e "Levar para…" por último. Rotação e
 * "Oculto no editor" moram no Avançado recolhido da própria seção. O que a
 * ficha já tem nasce aberto no lugar dele.
 */

const GUARDA: Token = { id: 'guarda', characterId: null, name: 'Guarda', x: 320, y: 320, size: 1, image: null }
/** A mesma ficha com tudo o que os opcionais guardam: marca, vigia, rota, veículo — e girada e oculta no editor. */
const GUARDA_CHEIO: Token = {
  ...GUARDA,
  conditions: ['envenenado'],
  vigia: { direcao: 270, abertura: 60, alcance: 9 },
  patrulha: { pontos: [{ x: 320, y: 320 }, { x: 640, y: 320 }], atual: 0 },
  veiculo: { lugares: 2 },
  rotation: 90,
  hidden: true,
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

describe('painel de propriedades — a ficha em ordem de tarefa', () => {
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
  /** Os títulos do bloco da ficha: do primeiro `h2` até "Seleção", em ordem de DOM. */
  function titulosDaFicha(): string[] {
    const todos = Array.from(corpo()?.querySelectorAll('h2') ?? []).map(texto)
    return todos.slice(0, todos.indexOf('Seleção'))
  }
  const interruptor = (rotulo: string) => Array.from(container.querySelectorAll('label.lb-switch')).find((l) => texto(l) === rotulo) ?? null
  const botoes = (nome: string) => Array.from(container.querySelectorAll('button')).filter((b) => texto(b) === nome)
  const botao = (nome: string) => botoes(nome)[0] ?? null
  const rotulo = (nome: string) => Array.from(container.querySelectorAll('.lb-label')).find((l) => texto(l) === nome) ?? null
  /** O controle ligado ao `<label>` de texto `nome`. */
  const campo = (nome: string) => {
    const label = Array.from(container.querySelectorAll('label')).find((l) => texto(l) === nome)
    return label?.htmlFor ? document.getElementById(label.htmlFor) : null
  }
  const grupo = (nome: string) => container.querySelector(`[role="radiogroup"][aria-label="${nome}"]`)
  const avancado = () => Array.from(container.querySelectorAll<HTMLButtonElement>('h3 > button')).find((b) => texto(b) === 'Avançado') ?? null
  const h2 = (nome: string) => Array.from(corpo()?.querySelectorAll('h2') ?? []).find((h) => texto(h) === nome) ?? null
  /** `a` vem antes de `b` no documento. */
  const antes = (a: Node | null, b: Node | null) => a !== null && b !== null && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  /** O corpo que a linha "+" (ou o cabeçalho) abre, pelo `aria-controls`. */
  const corpoDe = (linha: Element | null) => document.getElementById(linha?.getAttribute('aria-controls') ?? 'sem-id')

  it('fixos primeiro, opcionais depois: a ordem da ficha, de "Nome" a "Levar para…"', () => {
    renderFicha(GUARDA, daAventura(GUARDA))
    const marcos: [string, Element | null][] = [
      ['Nome', campo('Nome')],
      ['Vida atual', campo('Vida atual')],
      ['Tamanho da ficha', grupo('Tamanho da ficha')],
      ['Condições', botao('Condições')],
      ['Travado', interruptor('Travado')],
      ['Oculto para jogadores', interruptor('Oculto para jogadores')],
      ['Avançado', avancado()],
      ['Cor da ficha', grupo('Cor da ficha')],
      ['Escolher imagem...', botao('Escolher imagem...')],
      ['Ficha de NPC', interruptor('Ficha de NPC')],
      ['Ficha de jogador', interruptor('Ficha de jogador')],
      ['Esta ficha vigia', interruptor('Esta ficha vigia')],
      ['Patrulha', botao('Patrulha')],
      ['Vai junto de', rotulo('Vai junto de')],
      ['Esta ficha é um veículo', interruptor('Esta ficha é um veículo')],
      ['Rotina', rotulo('Rotina')],
      ['Ajustar a luz', botao('Ajustar a luz')],
      ['Piso', campo('Piso')],
      [CARRY_TO_LABEL, botao(CARRY_TO_LABEL)],
      ['Seleção', h2('Seleção')],
    ]
    for (const [nome, el] of marcos) expect(el, `sem "${nome}" no painel`).not.toBeNull()
    const foraDeOrdem = marcos.slice(1).filter(([, el], i) => !antes(marcos[i][1], el)).map(([nome], i) => `${marcos[i][0]} → ${nome}`)
    expect(foraDeOrdem).toEqual([])
  })

  it('título de bloco só onde há grupo de campos: 6 na ficha nova (eram 12)', () => {
    renderFicha()
    expect(titulosDaFicha()).toEqual(['Token', 'Vida', 'Tamanho da ficha', 'Token', 'Imagem do token', 'Piso'])
    for (const sumiu of ['Condições', 'Vigia', 'Patrulha', 'Levar junto', 'Veículo', 'Cor da ficha']) {
      expect(titulosDaFicha()).not.toContain(sumiu)
    }
  })

  it('opcional vazio fechado: Condições, Patrulha e o Avançado com aria-expanded="false" e o controle de verdade dentro', () => {
    renderFicha()
    const fechados = [botao('Condições'), botao('Patrulha'), avancado()]
    expect(fechados.map(texto)).toEqual(['Condições', 'Patrulha', 'Avançado'])
    for (const linha of fechados) {
      expect(linha?.getAttribute('aria-expanded')).toBe('false')
      const aberto = corpoDe(linha)
      expect(aberto?.hidden).toBe(true)
      expect(aberto?.querySelector('button, input')).not.toBeNull()
    }
    // O Avançado guarda justamente os raros da ficha.
    const doAvancado = corpoDe(avancado())
    expect(doAvancado?.contains(campo('Rotação'))).toBe(true)
    expect(doAvancado?.contains(interruptor('Oculto no editor'))).toBe(true)
  })

  it('o "+" e o Avançado abrem no clique: as pastilhas e a Rotação aparecem no lugar', () => {
    renderFicha()
    act(() => botao('Condições')?.click())
    expect(botao('Condições')?.getAttribute('aria-expanded')).toBe('true')
    expect(corpoDe(botao('Condições'))?.hidden).toBe(false)
    expect(botao('Envenenado')).not.toBeNull()

    act(() => avancado()?.click())
    expect(avancado()?.getAttribute('aria-expanded')).toBe('true')
    expect(corpoDe(avancado())?.hidden).toBe(false)
    expect(campo('Rotação')).not.toBeNull()
  })

  it('Travado e "Oculto para jogadores" à vista na seção da transformação; Rotação e "Oculto no editor" só no Avançado', () => {
    renderFicha()
    const transformacao = interruptor('Travado')?.closest('section')
    expect(transformacao?.querySelector('h2')?.textContent).toBe('Token')
    expect(interruptor('Oculto para jogadores')?.closest('section')).toBe(transformacao)
    // Visíveis: fora de qualquer corpo recolhido.
    expect(interruptor('Travado')?.closest('[hidden]')).toBeNull()
    expect(interruptor('Oculto para jogadores')?.closest('[hidden]')).toBeNull()
    // Raros: dentro do Avançado fechado, que é a última linha da mesma seção.
    expect(campo('Rotação')?.closest('[hidden]')).not.toBeNull()
    expect(interruptor('Oculto no editor')?.closest('[hidden]')).not.toBeNull()
    expect(transformacao?.contains(avancado())).toBe(true)
  })

  it('o que a ficha já tem nasce aberto no lugar dele: marca, vigia, rota, veículo e o Avançado da ficha girada', () => {
    renderFicha(GUARDA_CHEIO)
    // Condições com marca: as pastilhas à vista, a linha vira cabeçalho parado.
    expect(container.querySelector('[aria-label="Condições da ficha"]')?.closest('[hidden]')).toBeNull()
    expect(botao('Condições')).toBeNull()
    // Vigia ligada: as escolhas embaixo do interruptor.
    expect(grupo('Para onde olha')?.closest('section')).toBe(interruptor('Esta ficha vigia')?.closest('section'))
    // Rota: o resumo no cabeçalho e os botões à vista.
    expect(botao('Patrulha')).toBeNull()
    expect(botao('Avançar patrulha')?.closest('[hidden]')).toBeNull()
    // Veículo: os lugares embaixo do interruptor.
    expect(rotulo('Lugares')?.closest('section')).toBe(interruptor('Esta ficha é um veículo')?.closest('section'))
    // Girada e oculta no editor: o Avançado nasce aberto.
    expect(avancado()?.getAttribute('aria-expanded')).toBe('true')
    expect(campo('Rotação')?.closest('[hidden]')).toBeNull()
    // E cada um continua no lugar dele na ordem.
    expect(antes(interruptor('Ficha de jogador'), interruptor('Esta ficha vigia'))).toBe(true)
    expect(antes(grupo('Para onde olha'), botao('Avançar patrulha'))).toBe(true)
    expect(antes(botao('Avançar patrulha'), interruptor('Esta ficha é um veículo'))).toBe(true)
  })

  it('outra ficha selecionada: o Avançado nasce de novo, fechado', () => {
    renderFicha()
    act(() => avancado()?.click())
    expect(avancado()?.getAttribute('aria-expanded')).toBe('true')
    renderFicha({ ...GUARDA, id: 'ogro', name: 'Ogro' })
    expect(avancado()?.getAttribute('aria-expanded')).toBe('false')
  })

  it('os opcionais de comportamento vazios são uma linha cada, sem título e sem nada embaixo', () => {
    renderFicha(GUARDA, daAventura(GUARDA))
    for (const nome of ['Esta ficha vigia', 'Esta ficha é um veículo']) {
      const secao = interruptor(nome)?.closest('section')
      expect(secao?.classList.contains('lb-token-linha'), nome).toBe(true)
      expect(secao?.querySelector('h2'), nome).toBeNull()
      expect(secao?.children, nome).toHaveLength(1)
    }
    for (const nome of ['Vai junto de', 'Rotina']) {
      const secao = rotulo(nome)?.closest('section')
      expect(secao?.classList.contains('lb-token-linha'), nome).toBe(true)
      expect(secao?.querySelector('h2'), nome).toBeNull()
    }
    const patrulha = botao('Patrulha')?.closest('section')
    expect(patrulha?.classList.contains('lb-token-opt')).toBe(true)
    expect(patrulha?.querySelector('h2')).toBeNull()
  })

  it('"Vai junto de" e "Rotina" sem o que escolher: linhas apagadas com o motivo, sem controle falso', () => {
    renderFicha(GUARDA, daAventura(GUARDA))
    const linhas = Array.from(container.querySelectorAll('.lb-token-par--vazio'))
    expect(linhas.map((linha) => texto(linha.querySelector('.lb-label')))).toEqual(['Vai junto de', 'Rotina'])
    expect(linhas[0]?.textContent).toContain('Sem outra ficha na cena')
    expect(linhas[1]?.textContent).toContain('Estado do mundo')
    for (const linha of linhas) expect(linha.querySelector('button, select, input')).toBeNull()
  })

  it('contrato das jornadas: nenhum nome da ficha sumiu nem dobrou', () => {
    renderFicha()
    expect(texto(corpo()?.querySelector('h2'))).toBe('Token')
    expect(campo('Nome')).not.toBeNull()
    const nomePublico = grupo('Nome para os jogadores')
    expect(Array.from(nomePublico?.querySelectorAll('[role="radio"]') ?? []).map(texto)).toEqual(['O mesmo', 'Outro', 'Nenhum'])
    for (const nome of ['Vida atual', 'Vida máxima']) {
      expect(Array.from(container.querySelectorAll('label')).filter((l) => texto(l) === nome), nome).toHaveLength(1)
    }
    expect(container.querySelectorAll('[role="radiogroup"][aria-label="Cor da ficha"]')).toHaveLength(1)
    expect(grupo('Cor da ficha')?.querySelectorAll('[role="radio"][aria-label="Roxo"]')).toHaveLength(1)
    for (const nome of ['Escolher imagem...', 'Salvar no acervo', 'Apagar token selecionado', 'Adicionar token']) {
      expect(botoes(nome), nome).toHaveLength(1)
    }
    // A jornada condicao-na-ficha abre as condições pelo botão cujo nome começa por "Condições".
    const abrirCondicoes = /^\s*condi[çc](ão|ao|ões|oes)\b/i
    expect(Array.from(container.querySelectorAll('button')).filter((b) => abrirCondicoes.test(texto(b)))).toHaveLength(1)
    for (const nome of ['Travado', 'Oculto para jogadores']) {
      expect(Array.from(container.querySelectorAll('label.lb-switch')).filter((l) => texto(l) === nome), nome).toHaveLength(1)
    }
  })

  it('a Cor é uma linha de seis amostras no grupo "Cor da ficha", com "Roxo" pelo nome', () => {
    renderFicha()
    const cores = grupo('Cor da ficha')
    expect(cores?.querySelectorAll('[role="radio"]')).toHaveLength(6)
    expect(cores?.querySelector('[role="radio"][aria-label="Roxo"]')).not.toBeNull()
    expect(cores?.closest('section')?.querySelector('h2')).toBeNull()
  })

  it('"Ficha de NPC" e "Ficha de jogador" formam um par de chaves, uma logo depois da outra', () => {
    renderFicha()
    const npc = interruptor('Ficha de NPC')?.closest('section')
    expect(npc?.classList.contains('lb-token-chaves')).toBe(true)
    expect(npc?.nextElementSibling).toBe(interruptor('Ficha de jogador')?.closest('section'))
  })
})
