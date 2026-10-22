import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { useLivroDoMestreStore } from '../stores/livroDoMestreStore'
import { useMapStore } from '../stores/mapStore'
import type { Token } from '../types/map'
import { PropertiesPanel, type PisosWiring } from './PropertiesPanel'
import { propsDoPainel, type PainelProps } from './propertiesPanelTestProps'
import { RotinaDaFichaControls } from './RotinaDaFichaControls'
import { LEVAR_JUNTO_SEM_FICHA } from './TokenCarryControls'
import { TOKEN_NPC_HINT } from './TokenNpcControls'
import { PLAYER_CHARACTER_HINT } from './TokenPlayerCharacterControls'
import { CONDICOES_NOTA } from './TokenConditionControls'
import { CARRY_NOW_LABEL, CARRY_TO_LABEL } from './TokenSceneCarryControls'

/*
 * A FICHA DO TOKEN (fatia 9 do design consolidado), na costura com o
 * `PropertiesPanel` de verdade: o tipo de ficha logo abaixo da cabeça; as
 * fichas recolhíveis Nome e Condições (abertas), No mapa e Levar para outra
 * cena (fechadas, com o resumo); e os cartões de Comportamento, cada um com a
 * sua sub-ficha e o "voltar". Nenhum controle sumiu: cada um mudou de lugar. A
 * Vida saiu (D: vem da ficha do sistema na fatia 10).
 */

const GUARDA: Token = { id: 'guarda', characterId: null, name: 'Guarda', x: 320, y: 320, size: 1, image: null }
/** A mesma ficha com tudo o que os comportamentos guardam: marca, vigia, rota, veículo — e girada e oculta no editor. */
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

describe('painel de propriedades — a ficha do token (fatia 9)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    useLivroDoMestreStore.setState({ subFicha: null })
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
    useLivroDoMestreStore.setState({ subFicha: null })
  })

  function renderFicha(ficha: Token = GUARDA, extra: Partial<PainelProps> = {}): void {
    act(() =>
      root.render(
        <PropertiesPanel
          {...propsDoPainel(ficha, {
            selection: { selection: { kind: 'token', count: 1 }, defaultTokenName: 'Token 1', onAddToken: nada, onRemoveSelected: nada },
            tokenTransform: { onRotationChange: nada, onLockedChange: nada, onCongeladoChange: nada, onHiddenChange: nada, onSecretChange: nada },
            // Como o App liga: pisos e veículo presentes.
            pisos: PISOS,
            tokenVehicle: { options: [], onSeatsChange: nada, onPassengerChange: nada },
            ...extra,
          })}
        />,
      ),
    )
  }

  const texto = (el: Element | null | undefined) => (el?.textContent ?? '').trim()
  const botoes = (nome: string) =>
    Array.from(container.querySelectorAll('button')).filter((b) => b.getAttribute('aria-label') === nome || texto(b) === nome)
  const botao = (nome: string) => botoes(nome)[0] ?? null
  const caixa = (nome: string) =>
    Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find((c) => texto(c.closest('label')) === nome) ?? null
  /** O cabeçalho de cada ficha recolhível da página Ficha, na ordem do documento (Cena e Aventura também são fichas, fatia 18). */
  const cabecalhos = () => Array.from(container.querySelectorAll<HTMLButtonElement>('.gr-folha[data-pagina="ficha"] .gr-ficha__cab'))
  const cabecalho = (titulo: string) => cabecalhos().find((b) => texto(b.querySelector('.gr-ficha__tit')) === titulo) ?? null
  const corpoDa = (titulo: string) => document.getElementById(cabecalho(titulo)?.getAttribute('aria-controls') ?? 'sem-id')
  const cartoes = () => Array.from(container.querySelectorAll<HTMLButtonElement>('.gr-cartao'))
  const cartao = (rotulo: string) => cartoes().find((c) => texto(c.querySelector('.gr-cartao__rot')) === rotulo) ?? null
  const resumoDo = (rotulo: string) => texto(cartao(rotulo)?.querySelector('.gr-cartao__resumo'))
  const grupo = (nome: string) => container.querySelector(`[aria-label="${nome}"]`)
  /** `a` vem antes de `b` no documento. */
  const antes = (a: Node | null, b: Node | null) => a !== null && b !== null && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  const abrirCartao = (rotulo: string) => act(() => cartao(rotulo)?.click())

  it('na ordem do protótipo: tipo de ficha, Nome, Condições, No mapa, Levar para outra cena e, por último, os cartões de Comportamento', () => {
    renderFicha(GUARDA, daAventura(GUARDA))
    expect(cabecalhos().map((b) => texto(b.querySelector('.gr-ficha__tit')))).toEqual(['Nome', 'Condições', 'No mapa', 'Levar para outra cena'])
    expect(antes(grupo('Tipo de ficha'), cabecalho('Nome'))).toBe(true)
    const titulo = Array.from(container.querySelectorAll('h3')).find((h) => h.classList.contains('gr-titulo-secao'))
    expect(texto(titulo)).toContain('Comportamento')
    expect(antes(cabecalho('Levar para outra cena'), titulo ?? null)).toBe(true)
    expect(cartoes().map((c) => texto(c.querySelector('.gr-cartao__rot')))).toEqual(['Vigia', 'Patrulha', 'Levar junto', 'Veículo', 'Rotina', 'Luzes', 'Piso'])
  })

  it('a Vida saiu da ficha (D): sem "Vida atual", "Vida máxima" nem "Jogadores veem a barra"', () => {
    renderFicha(GUARDA, daAventura(GUARDA))
    for (const nome of ['Vida atual', 'Vida máxima', 'Jogadores veem a barra', 'Vida']) {
      expect(Array.from(container.querySelectorAll('label, h2, h3, .gr-ficha__tit')).filter((l) => texto(l) === nome), nome).toHaveLength(0)
    }
  })

  it('Nome e Condições nascem abertas; No mapa e Levar, fechadas com o resumo; a escolha vale para o próximo token', () => {
    renderFicha(GUARDA, daAventura(GUARDA))
    expect(cabecalhos().map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'true', 'false', 'false'])
    expect(texto(cabecalho('No mapa')?.querySelector('.gr-ficha__resumo'))).toBe('1 quadrado')
    expect(corpoDa('No mapa')?.hasAttribute('inert')).toBe(true)
    act(() => cabecalho('No mapa')?.click())
    expect(cabecalho('No mapa')?.getAttribute('aria-expanded')).toBe('true')
    act(() => root.unmount())
    root = createRoot(container)
    renderFicha({ ...GUARDA, id: 'outro', name: 'Outro' })
    expect(cabecalho('No mapa')?.getAttribute('aria-expanded')).toBe('true')
  })

  it('No mapa: Trava e visibilidade, Tamanho, Cor e Imagem; Rotação e "Oculto no editor" no Avançado, aberto só na ficha girada', () => {
    renderFicha()
    const noMapa = corpoDa('No mapa')
    // Trava e visibilidade: três botões de ícone (cadeado, floco, olho fechado) que ligam e desligam, como no protótipo.
    const trava = noMapa?.querySelector('[role="group"][aria-label="Trava e visibilidade"]')
    expect(Array.from(trava?.querySelectorAll('button.gr-icone-tg') ?? []).map(texto)).toEqual(['Travado', 'Congelado', 'Oculto para jogadores'])
    for (const nome of ['Travado', 'Congelado', 'Oculto para jogadores']) {
      expect(botao(nome)?.getAttribute('aria-pressed'), nome).toBe('false')
      expect(botao(nome)?.querySelector('svg'), nome).not.toBeNull()
    }
    expect(caixa('Travado')).toBeNull()
    for (const nome of ['Tamanho da ficha', 'Cor da ficha']) expect(noMapa?.querySelector(`[role="radiogroup"][aria-label="${nome}"]`), nome).not.toBeNull()
    for (const nome of ['Escolher imagem...', 'Salvar no acervo']) expect(noMapa?.contains(botao(nome)), nome).toBe(true)
    const avancado = () => Array.from(noMapa?.querySelectorAll<HTMLButtonElement>('button') ?? []).find((b) => texto(b) === 'Avançado') ?? null
    expect(avancado()?.getAttribute('aria-expanded')).toBe('false')
    // O Avançado é o último grupo de "No mapa", depois da Imagem.
    const imagem = botao('Salvar no acervo')
    const ultimo = avancado()
    if (imagem === null || ultimo === null || trava === null || trava === undefined) throw new Error('faltam a Trava, a Imagem ou o Avançado')
    expect(trava.compareDocumentPosition(imagem) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(imagem.compareDocumentPosition(ultimo) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    act(() => root.unmount())
    root = createRoot(container)
    renderFicha(GUARDA_CHEIO)
    expect(Array.from(corpoDa('No mapa')?.querySelectorAll('button') ?? []).find((b) => texto(b) === 'Avançado')?.getAttribute('aria-expanded')).toBe('true')
  })

  it('Tipo de ficha: "Ficha de NPC" e "Ficha de jogador" lado a lado, independentes, cada uma com a dica como descrição', () => {
    const onNpcChange = vi.fn()
    const onPlayerCharacterChange = vi.fn()
    renderFicha(GUARDA, { tokenNpc: { onNpcChange }, tokenPlayerCharacter: { onPlayerCharacterChange } })
    const tipo = grupo('Tipo de ficha')
    const npc = caixa('Ficha de NPC')
    const jogador = caixa('Ficha de jogador')
    expect(tipo?.contains(npc)).toBe(true)
    expect(tipo?.contains(jogador)).toBe(true)
    expect(texto(document.getElementById(npc?.getAttribute('aria-describedby') ?? 'x'))).toBe(TOKEN_NPC_HINT)
    expect(texto(document.getElementById(jogador?.getAttribute('aria-describedby') ?? 'x'))).toBe(PLAYER_CHARACTER_HINT)
    act(() => npc?.click())
    act(() => jogador?.click())
    expect(onNpcChange).toHaveBeenCalledWith(true)
    expect(onPlayerCharacterChange).toHaveBeenCalledWith(true)
  })

  it('cartões: o resumo diz o estado, e o que a ficha já tem fica marcado (vigia, rota, veículo)', () => {
    renderFicha(GUARDA_CHEIO)
    expect(resumoDo('Vigia')).toBe('Olha norte')
    expect(resumoDo('Patrulha')).toBe('2 pontos · no ponto 1')
    expect(resumoDo('Veículo')).toBe('2 lugares')
    for (const rotulo of ['Vigia', 'Patrulha', 'Veículo']) expect(cartao(rotulo)?.classList.contains('gr-e-ligado'), rotulo).toBe(true)
    act(() => root.unmount())
    root = createRoot(container)
    renderFicha()
    expect([resumoDo('Vigia'), resumoDo('Patrulha'), resumoDo('Veículo')]).toEqual(['Desligada', 'Sem rota', 'Não é veículo'])
    expect(cartoes().some((c) => c.classList.contains('gr-e-ligado'))).toBe(false)
  })

  it('o cartão abre a sub-ficha: a cabeça do item sai, o controle de verdade aparece, e voltar devolve a ficha com o foco no cartão', () => {
    renderFicha()
    expect(botao('Apagar token selecionado')).not.toBeNull()
    abrirCartao('Vigia')
    const voltar = botao('Voltar para Guarda')
    expect(voltar).not.toBeNull()
    expect(document.activeElement).toBe(voltar)
    expect(botao('Apagar token selecionado')).toBeNull()
    expect(texto(container.querySelector('.gr-subficha .gr-cabeca__tipo'))).toBe('Comportamento de Guarda')
    expect(caixa('Esta ficha vigia')).not.toBeNull()
    act(() => voltar?.click())
    expect(caixa('Esta ficha vigia')).toBeNull()
    expect(botao('Apagar token selecionado')).not.toBeNull()
    expect(document.activeElement).toBe(cartao('Vigia'))
  })

  it('Patrulha, Veículo e Piso: a sub-ficha mostra os controles de antes, sem a linha "+" repetindo o título', () => {
    renderFicha(GUARDA_CHEIO)
    abrirCartao('Patrulha')
    expect(botao('Marcar ponto aqui')).not.toBeNull()
    expect(Array.from(container.querySelectorAll('button[aria-expanded]')).filter((b) => texto(b).startsWith('Patrulha'))).toHaveLength(0)
    act(() => botao('Voltar para Guarda')?.click())
    abrirCartao('Veículo')
    expect(caixa('Esta ficha é um veículo')?.checked).toBe(true)
    act(() => botao('Voltar para Guarda')?.click())
    abrirCartao('Piso')
    expect(container.querySelector('input[aria-label="Piso"], label + input')).not.toBeNull()
  })

  it('Esc na sub-ficha volta à ficha do token, sem largar a seleção', () => {
    renderFicha()
    abrirCartao('Patrulha')
    expect(botao('Voltar para Guarda')).not.toBeNull()
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(botao('Voltar para Guarda')).toBeNull()
    expect(cartao('Patrulha')).not.toBeNull()
    expect(document.activeElement).toBe(cartao('Patrulha'))
  })

  it('selecionar de novo (o gesto que puxa a página Ficha) fecha a sub-ficha, como no protótipo', () => {
    renderFicha()
    abrirCartao('Vigia')
    act(() => useLivroDoMestreStore.getState().abrirPagina('ficha'))
    expect(botao('Voltar para Guarda')).toBeNull()
    expect(cartao('Vigia')).not.toBeNull()
  })

  it('sem o que mostrar, o cartão fica apagado com o motivo: "Levar junto" sem outra ficha na cena, "Luzes" sem luz', () => {
    renderFicha()
    expect(cartao('Levar junto')?.disabled).toBe(true)
    expect(resumoDo('Levar junto')).toBe(LEVAR_JUNTO_SEM_FICHA)
    expect(cartao('Luzes')?.disabled).toBe(true)
    expect(resumoDo('Luzes')).toBe('Nenhuma luz na ficha')
  })

  it('Rotina sem estado do mundo: a sub-ficha diz por quê, sem controle falso; a tocha presa abre "Ajustar a luz"', () => {
    renderFicha(GUARDA, daAventura(GUARDA))
    abrirCartao('Rotina')
    const vazia = container.querySelector('.lb-token-par--vazio')
    expect(vazia?.textContent).toContain('Estado do mundo')
    expect(vazia?.querySelector('button, select, input')).toBeNull()
    act(() => botao('Voltar para Guarda')?.click())
    expect(resumoDo('Luzes')).toBe('Presa, vai junto')
    abrirCartao('Luzes')
    expect(botao('Ajustar a luz')).not.toBeNull()
  })

  it('o cartão aberto que deixa de valer (as luzes zeraram) fecha a sub-ficha de verdade: a cabeça volta, e uma luz nova não a reabre', () => {
    renderFicha(GUARDA, daAventura(GUARDA))
    abrirCartao('Luzes')
    expect(botao('Ajustar a luz')).not.toBeNull()
    // O token foi arrastado para longe da luz solta (ou um Ctrl+Z): nenhuma luz.
    renderFicha(GUARDA)
    expect(useLivroDoMestreStore.getState().subFicha).toBeNull()
    expect(botao('Apagar token selecionado')).not.toBeNull()
    expect(cartao('Luzes')?.disabled).toBe(true)
    // A luz volta para baixo do token: a ficha continua a do token.
    renderFicha(GUARDA, daAventura(GUARDA))
    expect(botao('Voltar para Guarda')).toBeNull()
    expect(botao('Apagar token selecionado')).not.toBeNull()
  })

  it('Condições: chips do protótipo e a nota à vista, com os mesmos botões de ligar e desligar', () => {
    const onToggleCondition = vi.fn()
    renderFicha(GUARDA, { tokenCondition: { onToggleCondition } })
    const grupoDeCondicoes = container.querySelector('[role="group"][aria-label="Condições da ficha"]')
    expect(grupoDeCondicoes?.classList.contains('gr-chips')).toBe(true)
    const caido = Array.from(grupoDeCondicoes?.querySelectorAll('button') ?? []).find((b) => texto(b) === 'Caído')
    expect(caido?.classList.contains('gr-chip')).toBe(true)
    expect(caido?.getAttribute('aria-pressed')).toBe('false')
    act(() => caido?.click())
    expect(onToggleCondition).toHaveBeenCalledWith('caido')
    const nota = corpoDa('Condições')?.querySelector('.gr-nota')
    expect(texto(nota)).toBe(CONDICOES_NOTA)
    expect(grupoDeCondicoes?.getAttribute('aria-describedby')).toBe(nota?.id)
  })

  it('Levar para outra cena: o destino e o "Levar agora" já à vista quando a ficha abre, sem o botão de abrir', () => {
    renderFicha(GUARDA, daAventura(GUARDA))
    const levar = corpoDa('Levar para outra cena')
    expect(levar?.querySelector('form select')).not.toBeNull()
    expect(Array.from(levar?.querySelectorAll('label') ?? []).map(texto)).toContain('Destino')
    expect(levar?.contains(botao(CARRY_NOW_LABEL))).toBe(true)
    expect(botao(CARRY_TO_LABEL)).toBeNull()
    expect(botao('Cancelar')).toBeNull()
  })

  it('contrato das jornadas: cada nome da ficha existe uma vez, no lugar novo', () => {
    renderFicha(GUARDA, daAventura(GUARDA))
    expect(container.querySelectorAll('#lb-token-name')).toHaveLength(1)
    const nomePublico = container.querySelector('[role="radiogroup"][aria-label="Nome para os jogadores"]')
    expect(Array.from(nomePublico?.querySelectorAll('[role="radio"]') ?? []).map(texto)).toEqual(['O mesmo', 'Outro', 'Nenhum'])
    expect(container.querySelectorAll('[role="radiogroup"][aria-label="Cor da ficha"] [role="radio"][aria-label="Roxo"]')).toHaveLength(1)
    for (const nome of ['Escolher imagem...', 'Salvar no acervo', 'Apagar token selecionado', CARRY_NOW_LABEL, 'Travado', 'Congelado', 'Oculto para jogadores']) {
      expect(botoes(nome), nome).toHaveLength(1)
    }
    // As condições à vista com a ficha aberta (a jornada condicao-na-ficha só abre "Condições" se não as vê).
    expect(container.querySelector('[role="group"][aria-label="Condições da ficha"]')).not.toBeNull()
    for (const nome of ['Ficha de NPC', 'Ficha de jogador']) {
      expect(Array.from(container.querySelectorAll('label')).filter((l) => texto(l) === nome), nome).toHaveLength(1)
    }
  })
})
