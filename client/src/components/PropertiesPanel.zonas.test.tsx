import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { addRoom, createEmptyMap } from '../lib/mapFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { relevantPropertyGroups } from '../lib/toolProperties'
import { useMapStore } from '../stores/mapStore'
import { CollapsibleSection } from './CollapsibleSection'
import { PropertiesPanel } from './PropertiesPanel'
import { propsDoPainel, type PainelProps } from './propertiesPanelTestProps'
import type { TerritorioControlsProps } from './TerritorioControls'

/*
 * GRUPOS DA COLUNA (pedido painel-acervo, fatia 3). Abaixo do que está na mão
 * (a seleção, senão a ferramenta), o que é da AVENTURA (Cenas, Pinos, Agenda,
 * Estado do mundo) e o que é DESTA CENA (Objetos do mapa, Marcas, Locais,
 * Território, Chão do mapa, Camadas), cada um com a sua legenda; o Acervo por
 * último, fora dos dois. A ordem já era essa: faltava dizer, para o mestre
 * saber onde procurar sem decorar.
 *
 * As seções da aventura são montadas pelo App: aqui entram linhas com o mesmo
 * título no lugar delas, porque o que se prova é ONDE o painel as põe.
 *
 * A legenda é um `<p>`, não um `h2`: o primeiro `h2` visível do corpo é o nome
 * do que está na mão (task-jornada-painel-com-nome-certo, sala-livre), e
 * task-panel-sections lê os `h2` das seções.
 */

const nada = (): void => {}

/** Uma linha que abre e fecha, como as seções que o App monta. */
function linha(id: string, titulo: string) {
  return (
    <CollapsibleSection id={id} title={titulo} defaultOpen={false}>
      <p>{`Dentro de ${titulo}`}</p>
    </CollapsibleSection>
  )
}

const CENAS_E_PINOS = (
  <>
    {linha('scenes', 'Cenas')}
    {linha('pins', 'Pinos')}
  </>
)
const ESTADO_DO_MUNDO = linha('world-state', 'Estado do mundo')
const OBJETOS = (
  <>
    {linha('objects', 'Objetos do mapa')}
    {linha('locais', 'Locais')}
  </>
)
const TERRITORIO: TerritorioControlsProps = { filtroLigado: false, onFiltroChange: nada, legenda: [], alerta: 'calmo', onAlertaChange: nada }

/** Selecionar e nada selecionado, numa aventura: como o App monta a primeira tela. */
const SEM_SELECAO: Partial<PainelProps> = {
  groups: relevantPropertyGroups('select'),
  scenes: CENAS_E_PINOS,
  worldState: ESTADO_DO_MUNDO,
  objects: OBJETOS,
  territorio: TERRITORIO,
}
/** A Parede na mão, nada selecionado. */
const PAREDE_ARMADA: Partial<PainelProps> = { activeTool: 'wall', groups: relevantPropertyGroups('wall') }

describe('painel de propriedades — os grupos Aventura e Esta cena', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    useMapStore.setState({
      map: createEmptyMap('m1', 'Cripta do Farol', 30, 20, 64),
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

  function renderPainel(extra: Partial<PainelProps>): void {
    act(() => root.render(<PropertiesPanel {...propsDoPainel(null, extra)} />))
  }

  const texto = (el: Element | null | undefined) => (el?.textContent ?? '').trim()
  /** O grupo pelo nome acessível: `role=group` nomeado pela legenda (`aria-labelledby`). */
  const grupo = (nome: string): HTMLElement | null =>
    [...container.querySelectorAll<HTMLElement>('[role="group"]')].find(
      (g) => texto(document.getElementById(g.getAttribute('aria-labelledby') ?? '')) === nome,
    ) ?? null
  /** O cabeçalho (botão que abre e fecha) de uma linha. */
  const cabecalho = (titulo: string): HTMLButtonElement | null =>
    [...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((b) => texto(b) === titulo) ?? null
  const h2 = (nome: string) => [...container.querySelectorAll('h2')].find((h) => texto(h) === nome) ?? null
  /** `a` vem antes de `b` no documento. */
  const antes = (a: Node | null, b: Node | null) => a !== null && b !== null && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  const primeiroTitulo = () => texto(container.querySelector('.lb-inspector__body h2'))

  it('AVENTURA reúne as linhas da aventura: Cenas, Pinos e Estado do mundo', () => {
    renderPainel(SEM_SELECAO)
    const aventura = grupo('Aventura')
    expect(aventura, 'o painel não tem o grupo "Aventura"').not.toBeNull()
    for (const titulo of ['Cenas', 'Pinos', 'Estado do mundo']) {
      expect(cabecalho(titulo), titulo).not.toBeNull()
      expect(aventura?.contains(cabecalho(titulo)), titulo).toBe(true)
    }
  })

  it('ESTA CENA reúne o que é da cena aberta, e o Acervo vem depois dos dois grupos, fora deles', () => {
    renderPainel(SEM_SELECAO)
    const cena = grupo('Esta cena')
    expect(cena, 'o painel não tem o grupo "Esta cena"').not.toBeNull()
    for (const titulo of ['Objetos do mapa', 'Locais', 'Território', 'Chão do mapa', 'Camadas']) {
      expect(cabecalho(titulo), titulo).not.toBeNull()
      expect(cena?.contains(cabecalho(titulo)), titulo).toBe(true)
    }
    // Cenas é a lista da aventura inteira, não desta cena; e a aventura vem antes.
    expect(cena?.contains(cabecalho('Cenas'))).toBe(false)
    expect(antes(grupo('Aventura'), cena)).toBe(true)
    // O Acervo de tokens não é da aventura nem da cena: é a estante do app.
    const acervo = h2('Acervo de tokens')
    expect(acervo).not.toBeNull()
    expect(acervo?.closest('[role="group"]')).toBeNull()
    expect(antes(cena, acervo)).toBe(true)
  })

  it('a legenda do grupo é texto e não título: nenhum h2 a mais no corpo', () => {
    renderPainel(SEM_SELECAO)
    for (const nome of ['Aventura', 'Esta cena']) {
      const legenda = document.getElementById(grupo(nome)?.getAttribute('aria-labelledby') ?? '')
      expect(legenda?.tagName, nome).toBe('P')
    }
    const titulos = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(texto)
    expect(titulos).not.toContain('Aventura')
    expect(titulos).not.toContain('Esta cena')
  })

  it('sem cenas nem estado do mundo (painel sem aventura) não há grupo "Aventura", nem a legenda solta', () => {
    renderPainel({ ...SEM_SELECAO, scenes: undefined, worldState: undefined })
    expect(grupo('Aventura')).toBeNull()
    expect(container.textContent).not.toContain('Aventura')
    expect(grupo('Esta cena')).not.toBeNull()
  })

  it('só com o Estado do mundo, o grupo "Aventura" existe e tem ele', () => {
    renderPainel({ ...SEM_SELECAO, scenes: undefined })
    expect(grupo('Aventura')?.contains(cabecalho('Estado do mundo'))).toBe(true)
  })

  it('com a Parede armada e sem os objetos da cena, não sobra a legenda "Esta cena" sem linha embaixo', () => {
    renderPainel(PAREDE_ARMADA)
    expect(grupo('Esta cena')).toBeNull()
    expect(container.textContent).not.toContain('Esta cena')
  })

  it('com a Parede armada, os objetos continuam no grupo da cena (Chão do mapa e Camadas não aparecem)', () => {
    renderPainel({ ...PAREDE_ARMADA, scenes: CENAS_E_PINOS, objects: OBJETOS })
    expect(grupo('Esta cena')?.contains(cabecalho('Objetos do mapa'))).toBe(true)
    expect(cabecalho('Chão do mapa')).toBeNull()
    expect(cabecalho('Camadas')).toBeNull()
  })

  it('esconderCategorias (opção de 07/10/2026): com a Parede armada somem Aventura, Objetos do mapa e Locais', () => {
    renderPainel({ ...PAREDE_ARMADA, scenes: CENAS_E_PINOS, objects: OBJETOS, esconderCategorias: true })
    expect(grupo('Aventura')).toBeNull()
    expect(grupo('Esta cena')).toBeNull()
    for (const titulo of ['Cenas', 'Pinos', 'Objetos do mapa', 'Locais']) expect(cabecalho(titulo), titulo).toBeNull()
    expect(h2('Parede')).not.toBeNull()
  })

  it('GUARDA: com a Parede armada, o primeiro título continua "Parede", acima dos dois grupos', () => {
    renderPainel({ ...PAREDE_ARMADA, scenes: CENAS_E_PINOS, objects: OBJETOS })
    expect(primeiroTitulo()).toBe('Parede')
    expect(antes(h2('Parede'), grupo('Aventura'))).toBe(true)
  })

  it('o Avançado da Parede mora DENTRO do bloco Parede (é dele: Ponta e canto), como o da ficha', () => {
    renderPainel({ ...PAREDE_ARMADA, scenes: CENAS_E_PINOS, objects: OBJETOS })
    const avancado = cabecalho('Avançado')
    expect(avancado, 'com a Parede armada o painel tem o Avançado').not.toBeNull()
    const blocoParede = h2('Parede')?.closest('section')
    expect(blocoParede?.contains(avancado), 'o Avançado da parede é a última linha do bloco Parede').toBe(true)
    // Ainda é o mesmo Avançado: h3, fechado, com o campo "Ponta e canto" dentro.
    expect(avancado?.closest('h3')).not.toBeNull()
    expect(avancado?.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById(avancado?.getAttribute('aria-controls') ?? '')?.querySelector('[aria-label="Ponta e canto da parede"]')).not.toBeNull()
  })

  it('o Avançado da Região continua linha do item; Perigo saiu da Sala (07/10/2026)', () => {
    const { region, walls } = buildRoomFromDraft('sala', ['s0', 's1', 's2', 's3'], { x: 0, y: 0 }, { x: 320, y: 256 }, undefined, undefined, 'Sala 1')
    const map = addRoom(createEmptyMap('m_sala', 'Casa', 30, 20, 64), region, walls)
    useMapStore.setState({ map })
    renderPainel({
      ...SEM_SELECAO,
      groups: relevantPropertyGroups('select', { region: true, regionIsRoom: true }),
      selectedRegion: map.regions.find((r) => r.id === 'sala') ?? null,
      regionStyle: { color: '#ffffff', onColorChange: nada, pattern: 'solid', onPatternChange: nada, strokeJoin: 'round', onStrokeJoinChange: nada },
      perigoDaSala: (
        <section className="lb-section">
          <h2 className="lb-eyebrow">Perigo</h2>
        </section>
      ),
    })
    const avancado = cabecalho('Avançado')
    expect(avancado).not.toBeNull()
    expect(h2('Perigo')).toBeNull()
    expect(avancado?.closest('.lb-collapsible')?.parentElement?.classList.contains('lb-inspector__body')).toBe(true)
  })

  it('GUARDA: com uma Sala selecionada, o primeiro título continua "Sala"', () => {
    const { region, walls } = buildRoomFromDraft('sala', ['s0', 's1', 's2', 's3'], { x: 0, y: 0 }, { x: 320, y: 256 }, undefined, undefined, 'Sala 1')
    const map = addRoom(createEmptyMap('m_sala', 'Casa', 30, 20, 64), region, walls)
    useMapStore.setState({ map })
    const sala = map.regions.find((r) => r.id === 'sala') ?? null
    expect(sala).not.toBeNull()
    renderPainel({
      ...SEM_SELECAO,
      groups: relevantPropertyGroups('select', { region: true, regionIsRoom: true }),
      selection: { selection: { kind: 'region', count: 1 }, defaultTokenName: 'Token 1', onAddToken: nada, onRemoveSelected: nada },
      selectedRegion: sala,
    })
    expect(primeiroTitulo()).toBe('Sala')
  })
})

/** Um CSS como está no disco, relativo a esta pasta (ver `PropertiesPanel.moldura.test.ts`: `?raw` e `new URL` não leem o arquivo). */
async function lerCss(relativo: string): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), relativo), 'utf8')
}

/** As declarações da PRIMEIRA regra que tem `seletor` na lista de seletores: propriedade → valor. */
function regra(css: string, seletor: string): Map<string, string> {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, seletores, corpo] of semComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!seletores.split(',').some((s) => s.replace(/\s+/g, ' ').trim() === seletor)) continue
    return new Map(
      corpo
        .split(';')
        .map((declaracao) => declaracao.split(':'))
        .filter((partes) => partes.length >= 2)
        .map(([propriedade, ...valor]) => [propriedade.trim(), valor.join(':').trim()]),
    )
  }
  return new Map()
}

const FIO = '1px solid var(--lb-color-line)'

/*
 * O jsdom não faz layout nem aplica folha: os testes leem as regras que dão o
 * desenho, e a tela (Vite) é a outra metade da prova. O main.css entra DEPOIS
 * desta folha (main.tsx importa o App antes), então cada regra que corrige uma
 * de lá precisa de seletor mais específico — `.lb-zona >` na frente.
 */
describe('PropertiesPanel.css — o desenho dos grupos', () => {
  it('o grupo é uma coluna com o fio de cima, só depois de uma seção ou de outro grupo (a faixa do topo já tem o dela)', async () => {
    const css = await lerCss('./PropertiesPanel.css')
    expect(regra(css, '.lb-zona').get('flex-direction')).toBe('column')
    expect(regra(css, '.lb-section + .lb-zona').get('border-top')).toBe(FIO)
    expect(regra(css, '.lb-zona + .lb-zona').get('border-top')).toBe(FIO)
    // O Acervo, depois do último grupo, ganha o fio que `.lb-section + .lb-section` dava.
    expect(regra(css, '.lb-zona + .lb-section').get('border-top')).toBe(FIO)
  })

  it('a legenda fica na vertical dos 16 px do conteúdo', async () => {
    const legenda = regra(await lerCss('./PropertiesPanel.css'), '.lb-zona__rotulo')
    expect(legenda.get('padding')).toMatch(/^var\(--lb-space-\d\) var\(--lb-space-4\)/)
  })

  it('dentro do grupo as linhas se seguem sem fio, que só volta depois de uma seção aberta', async () => {
    const css = await lerCss('./PropertiesPanel.css')
    expect(regra(css, '.lb-zona > .lb-section + .lb-collapsible').get('box-shadow')).toBe('none')
    expect(regra(css, '.lb-zona > .lb-section + .lb-section').get('border-top')).toBe('0')
    const depoisDaAberta = regra(
      css,
      ".lb-zona > .lb-collapsible:has(> .lb-collapsible__heading > .lb-collapsible__toggle[aria-expanded='true']) + .lb-section",
    )
    expect(depoisDaAberta.get('box-shadow')).toBe('inset 0 1px 0 var(--lb-color-line)')
  })

  it('só tokens do tema: nenhuma cor solta na folha', async () => {
    const semComentarios = (await lerCss('./PropertiesPanel.css')).replace(/\/\*[\s\S]*?\*\//g, '')
    expect(semComentarios).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i)
  })
})
