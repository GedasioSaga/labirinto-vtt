import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { addRoom, createEmptyMap } from '../lib/mapFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { relevantPropertyGroups } from '../lib/toolProperties'
import { useLivroDoMestreStore, type PaginaDoMestre } from '../stores/livroDoMestreStore'
import { useMapStore } from '../stores/mapStore'
import { CollapsibleSection } from './CollapsibleSection'
import { PropertiesPanel } from './PropertiesPanel'
import { propsDoPainel, type PainelProps } from './propertiesPanelTestProps'
import type { TerritorioControlsProps } from './TerritorioControls'

/*
 * AS PÁGINAS DO LIVRO DO MESTRE (fatia 2 do design consolidado). Os grupos que
 * a coluna única empilhava viraram páginas, cada uma atrás do seu marcador: a
 * Ficha (o que está na mão ou selecionado), a Cena (Objetos do mapa, Marcas,
 * Locais, Território, Chão do mapa, Camadas), a Aventura (Cenas, Pinos,
 * Agenda, Estado do mundo) e o Acervo. Todas ficam montadas; só a aberta fica
 * à vista.
 *
 * As seções da aventura são montadas pelo App: aqui entram linhas com o mesmo
 * título no lugar delas, porque o que se prova é ONDE o painel as põe.
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

describe('livro do mestre — cada grupo na sua página', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    useLivroDoMestreStore.setState({ pagina: 'ficha', recolhido: false, novoTokenAberto: false })
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
  /** O cabeçalho (botão que abre e fecha) de uma linha. */
  const cabecalho = (titulo: string): HTMLButtonElement | null =>
    [...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((b) => texto(b) === titulo) ?? null
  const h2 = (nome: string) => [...container.querySelectorAll('h2')].find((h) => texto(h) === nome) ?? null
  const primeiroTitulo = () => texto(container.querySelector('.lb-inspector__body h2'))

  /** A folha de uma página do livro (aberta ou não). */
  const folha = (pagina: PaginaDoMestre) => container.querySelector<HTMLElement>(`.gr-folha[data-pagina="${pagina}"]`)
  const naFolha = (pagina: PaginaDoMestre, titulo: string) => folha(pagina)?.contains(cabecalho(titulo)) === true

  it('cada grupo mora na sua página: Aventura, Cena e Acervo; a Ficha não carrega nenhum deles', () => {
    renderPainel(SEM_SELECAO)
    for (const titulo of ['Cenas', 'Pinos', 'Estado do mundo']) expect(naFolha('aventura', titulo), titulo).toBe(true)
    for (const titulo of ['Objetos do mapa', 'Locais', 'Território', 'Chão do mapa', 'Camadas']) expect(naFolha('cena', titulo), titulo).toBe(true)
    expect(folha('acervo')?.contains(h2('Acervo de tokens'))).toBe(true)
    for (const titulo of ['Cenas', 'Objetos do mapa', 'Chão do mapa', 'Camadas']) expect(naFolha('ficha', titulo), titulo).toBe(false)
    expect(folha('ficha')?.contains(h2('Acervo de tokens'))).toBe(false)
  })

  it('só a página aberta fica à vista; trocar de página não desmonta as outras', () => {
    renderPainel(SEM_SELECAO)
    const abertas = () => (['ficha', 'cena', 'aventura', 'acervo'] as const).filter((p) => folha(p)?.hidden === false)
    expect(abertas()).toEqual(['ficha'])
    act(() => useLivroDoMestreStore.getState().abrirPagina('cena'))
    expect(abertas()).toEqual(['cena'])
    expect(cabecalho('Cenas'), 'a Aventura continua montada, só escondida').not.toBeNull()
  })

  it('a página Cena abre com o título e a linha do mapa: nome, casas e tamanho da casa', () => {
    renderPainel(SEM_SELECAO)
    expect(folha('cena')?.querySelector('h2')?.textContent).toBe('Esta cena')
    expect(folha('cena')?.textContent).toContain('Cripta do Farol, 30 × 20 casas de 64 px')
    expect(folha('aventura')?.querySelector('h2')?.textContent).toBe('Aventura')
    expect(folha('acervo')?.querySelector('h2')?.textContent).toBe('Acervo')
  })

  it('a página Cena mostra Chão do mapa e Camadas com qualquer ferramenta: sem o "momento de mapa"', () => {
    renderPainel({ ...PAREDE_ARMADA, objects: OBJETOS })
    for (const titulo of ['Objetos do mapa', 'Chão do mapa', 'Camadas']) expect(naFolha('cena', titulo), titulo).toBe(true)
  })

  it('com a ferramenta Chão na mão, a Ficha leva ao "Chão do mapa" da página Cena pela nota, sem repetir o bloco (fatia 7)', () => {
    renderPainel({ activeTool: 'floor', groups: relevantPropertyGroups('floor') })
    expect(naFolha('ficha', 'Chão do mapa')).toBe(false)
    expect(naFolha('cena', 'Chão do mapa')).toBe(true)
    const irParaCena = [...(folha('ficha')?.querySelectorAll('button') ?? [])].find((b) => texto(b) === 'Ir para Cena')
    expect(irParaCena, 'a nota do Chão leva à página Cena').toBeDefined()
    act(() => irParaCena?.click())
    expect(useLivroDoMestreStore.getState().pagina).toBe('cena')
  })

  it('GUARDA: com a Parede armada, o primeiro título da Ficha é o da ficha da Parede', () => {
    renderPainel({ ...PAREDE_ARMADA, scenes: CENAS_E_PINOS, objects: OBJETOS })
    expect(primeiroTitulo()).toBe('Ferramenta · Parede')
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

  it('o Avançado da Sala mora no fim da ficha Aparência; Perigo saiu da Sala (07/10/2026)', () => {
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
    expect(avancado?.closest('.gr-ficha')?.querySelector('.gr-ficha__tit')?.textContent).toBe('Aparência')
  })

  it('o Avançado da Sala é o subgrupo do protótipo e guarda a Espessura do contorno e o "Criar parede na borda"', () => {
    const { region, walls } = buildRoomFromDraft('sala', ['s0', 's1', 's2', 's3'], { x: 0, y: 0 }, { x: 320, y: 256 }, undefined, undefined, 'Sala 1')
    const map = addRoom(createEmptyMap('m_sala', 'Casa', 30, 20, 64), region, walls)
    useMapStore.setState({ map })
    renderPainel({
      ...SEM_SELECAO,
      groups: relevantPropertyGroups('select', { region: true, regionIsRoom: true }),
      selectedRegion: map.regions.find((r) => r.id === 'sala') ?? null,
      regionStyle: {
        color: '#ffffff',
        onColorChange: nada,
        pattern: 'solid',
        onPatternChange: nada,
        strokeWidth: 2,
        onStrokeWidthChange: nada,
        strokeJoin: 'round',
        onStrokeJoinChange: nada,
        onLinkWalls: nada,
      },
    })
    const avancado = cabecalho('Avançado')
    expect(avancado?.closest('section')?.classList.contains('lb-advanced--subgrupo')).toBe(true)
    const dentro = document.getElementById(avancado?.getAttribute('aria-controls') ?? '')
    expect(dentro?.querySelector('[aria-label="Espessura do contorno"]'), 'Fino/Médio/Grosso no Avançado').not.toBeNull()
    expect(dentro?.querySelector('#lb-region-strokewidth'), 'o Ajuste fino no Avançado').not.toBeNull()
    expect([...(dentro?.querySelectorAll('button') ?? [])].some((b) => texto(b) === 'Criar parede na borda')).toBe(true)
    // Uma vez só na ficha: nada disso sobra fora do Avançado.
    const aparencia = avancado?.closest('.gr-ficha')
    expect(aparencia?.querySelectorAll('[aria-label="Espessura do contorno"]').length).toBe(1)
    expect([...(aparencia?.querySelectorAll('button') ?? [])].filter((b) => texto(b) === 'Criar parede na borda').length).toBe(1)
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
