import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { SceneListItem } from '../stores/adventureStore'
import { MapSettingsDialog, type MapSettingsProps } from './MapSettingsDialog'
import { SceneOverviewDialog } from './SceneOverview'
import { SceneSettingsDialog, SECAO_MAPA_VIVO } from './SceneSettingsDialog'
import { ShortcutsDialog } from './ShortcutsDialog'

/**
 * Fatia 20: as quatro janelas (Configurações do mapa, Configurar cena, Atalhos,
 * Visão geral das cenas) na casca do Grimório. Em cada uma: Esc fecha, o foco
 * volta ao botão que abriu (e não ao `body`), o Tab não sai dela e nenhuma
 * tecla chega ao mapa atrás (`window`). Cada gatilho é um botão comum, sem
 * devolver o foco por conta própria: quem devolve é a casca.
 */

const vazio = () => {}

/** O mapa sem imagem de fundo, como em `MapSettingsDialog.entrada.test.tsx`. */
function mapSettingsTestProps(): MapSettingsProps {
  return {
    grid: {
      showGrid: true,
      onShowGridChange: vazio,
      gridShape: 'square',
      onGridShapeChange: vazio,
      snapTargets: { token: true, wall: true, prop: false },
      onSnapTargetChange: vazio,
      gridSettings: { color: '#ffffff', opacity: 0.3, lineWidth: 1, lineStyle: 'solid' },
      onGridSettingsChange: vazio,
    },
    gridAlign: {
      backgroundFilename: null,
      imageWidth: null,
      imageHeight: null,
      cellSize: 64,
      offset: { x: 0, y: 0 },
      onOffsetChange: vazio,
      onApply: vazio,
      onPreviewChange: vazio,
    },
    mapScale: {
      scale: { unitsPerCell: 1.5, unit: 'm', precision: 1 },
      onScaleChange: vazio,
      measurementMode: 'chessboard',
      onMeasurementModeChange: vazio,
      gridShape: 'square',
    },
    scenarioLink: { scenarioLink: null, onScenarioLinkChange: vazio },
    mapSize: { width: 30, height: 10, onApply: vazio },
  }
}

const CENAS: SceneListItem[] = [
  { id: 's-salao', name: 'Salão', active: true, available: true, renamable: true, tokenCount: 0 },
  { id: 's-cripta', name: 'Cripta', active: false, available: true, renamable: true, tokenCount: 0 },
]
const MAPAS = new Map([
  ['s-salao', createEmptyMap('m1', 'Salão', 10, 10, 50)],
  ['s-cripta', createEmptyMap('m2', 'Cripta', 10, 10, 50)],
])

const tipoDeMapa = {
  tipo: 'normal' as const,
  onTipoChange: vazio,
  caravana: false,
  onCaravanaChange: vazio,
  relevo: true,
  onRelevoChange: vazio,
  nomesDosLugares: false,
  onNomesDosLugaresChange: vazio,
  nuvens: false,
  onNuvensChange: vazio,
}

const configurarCena = (fechar: () => void, secaoInicial?: string) => (
  <SceneSettingsDialog
    sceneName="Mina"
    cellPx={50}
    vision={{ visionCells: 3, onVisionCellsChange: vazio, dark: false, onDarkChange: vazio }}
    mapType={tipoDeMapa}
    secaoInicial={secaoInicial}
    onClose={fechar}
  />
)

const JANELAS: { nome: string; titulo: string; abrir: (fechar: () => void) => ReactNode }[] = [
  { nome: 'Configurações do mapa', titulo: 'Configurações do mapa', abrir: (fechar) => <MapSettingsDialog {...mapSettingsTestProps()} onClose={fechar} /> },
  { nome: 'Configurar cena', titulo: 'Configurar Mina', abrir: (fechar) => configurarCena(fechar) },
  { nome: 'Atalhos', titulo: 'Atalhos do teclado', abrir: (fechar) => <ShortcutsDialog onClose={fechar} /> },
  {
    nome: 'Visão geral das cenas',
    titulo: 'Visão geral das cenas',
    abrir: (fechar) => <SceneOverviewDialog scenes={CENAS} maps={MAPAS} onPick={vazio} onClose={fechar} />,
  },
]

/** O editor em miniatura: o botão que abre e a janela montada enquanto aberta, como o App faz. */
function Editor({ abrir }: { abrir: (fechar: () => void) => ReactNode }) {
  const [aberta, setAberta] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAberta(true)}>
        abrir
      </button>
      {aberta && abrir(() => setAberta(false))}
    </>
  )
}

describe('as quatro janelas na casca do Grimório', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const janela = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
  const gatilho = () => {
    const botao = container.querySelector<HTMLButtonElement>('button')
    if (botao === null) throw new Error('sem o botão de abrir')
    return botao
  }
  const tecla = (key: string, init: KeyboardEventInit = {}) =>
    act(() => {
      ;(document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
    })

  function abrir(conteudo: (fechar: () => void) => ReactNode): HTMLElement {
    act(() => root.render(<Editor abrir={conteudo} />))
    gatilho().focus()
    act(() => gatilho().click())
    const aberta = janela()
    if (aberta === null) throw new Error('a janela não abriu')
    return aberta
  }

  for (const { nome, titulo, abrir: conteudo } of JANELAS) {
    it(`${nome}: é o Dialogo do Grimório, com o título e o foco dentro`, () => {
      const aberta = abrir(conteudo)
      expect(aberta.classList.contains('gr-dlg')).toBe(true)
      expect(aberta.getAttribute('aria-modal')).toBe('true')
      expect(document.getElementById(aberta.getAttribute('aria-labelledby') ?? '')?.textContent).toBe(titulo)
      expect(aberta.contains(document.activeElement)).toBe(true)
    })

    it(`${nome}: Esc fecha e o foco volta ao botão que abriu`, () => {
      abrir(conteudo)
      tecla('Escape')
      expect(janela()).toBeNull()
      expect(document.activeElement).toBe(gatilho())
    })

    it(`${nome}: Tab e Shift+Tab não saem da janela, e tecla nenhuma chega ao mapa`, () => {
      const noMapa = vi.fn()
      window.addEventListener('keydown', noMapa)
      try {
        const aberta = abrir(conteudo)
        for (let i = 0; i < 6; i++) {
          tecla('Tab')
          expect(aberta.contains(document.activeElement), `Tab ${i + 1} saiu`).toBe(true)
        }
        for (let i = 0; i < 6; i++) {
          tecla('Tab', { shiftKey: true })
          expect(aberta.contains(document.activeElement), `Shift+Tab ${i + 1} saiu`).toBe(true)
        }
        tecla('w')
        tecla('Delete')
        expect(noMapa).not.toHaveBeenCalled()
      } finally {
        window.removeEventListener('keydown', noMapa)
      }
    })
  }

  it('Configurações do mapa e Configurar cena: navegação vertical à esquerda, com a seção da vez marcada', () => {
    for (const conteudo of [JANELAS[0].abrir, JANELAS[1].abrir]) {
      const aberta = abrir(conteudo)
      const nav = aberta.querySelector('nav.gr-nav-vertical')
      expect(nav).not.toBeNull()
      const secoes = Array.from(nav?.querySelectorAll('button') ?? [])
      expect(secoes.length).toBeGreaterThan(2)
      expect(secoes.filter((secao) => secao.getAttribute('aria-current') === 'true')).toHaveLength(1)
      // O foco entra no conteúdo, e não na lista de seções.
      expect(nav?.contains(document.activeElement)).toBe(false)
      act(() => secoes[secoes.length - 1].click())
      expect(secoes[secoes.length - 1].getAttribute('aria-current')).toBe('true')
      tecla('Escape')
    }
  })

  it('Configurações do mapa: as seções de antes, na mesma ordem, cada uma ligada ao seu trecho', () => {
    const aberta = abrir(JANELAS[0].abrir)
    const secoes = Array.from(aberta.querySelectorAll('nav.gr-nav-vertical button'))
    expect(secoes.map((secao) => secao.textContent)).toEqual(['Grade', 'Alinhar à imagem', 'Medição', 'Tamanho do mapa', 'Sistema de RPG'])
    for (const secao of secoes) expect(document.getElementById(secao.getAttribute('aria-controls') ?? '')).not.toBeNull()
  })

  it('Configurar cena: "Mapa vivo" com Relevo, Nomes dos lugares e Nuvens, e a janela pode abrir já nele', () => {
    const aberta = abrir((fechar) => configurarCena(fechar, SECAO_MAPA_VIVO))
    const secoes = Array.from(aberta.querySelectorAll<HTMLButtonElement>('nav.gr-nav-vertical button'))
    expect(secoes.map((secao) => secao.textContent)).toEqual(['Visão', 'Tipo de mapa', 'Mapa vivo'])
    const mapaVivo = secoes[2]
    expect(mapaVivo.getAttribute('aria-current')).toBe('true')
    const trecho = document.getElementById(mapaVivo.getAttribute('aria-controls') ?? '')
    const chaves = Array.from(trecho?.querySelectorAll('[role="switch"], input[type="checkbox"]') ?? []).map(
      (chave) => chave.closest('label')?.textContent ?? chave.getAttribute('aria-label'),
    )
    expect(chaves.join(' | ')).toMatch(/Relevo.*Nomes dos lugares.*Nuvens/)
    // O foco entra na primeira chave do Mapa vivo, a seção que se veio mexer.
    expect(trecho?.contains(document.activeElement)).toBe(true)
  })

  it('Configurar cena: sem nenhuma chave do Mapa vivo, a seção não aparece vazia', () => {
    const semChaves = { tipo: 'normal' as const, onTipoChange: vazio, caravana: false, onCaravanaChange: vazio }
    const aberta = abrir((fechar) => (
      <SceneSettingsDialog
        sceneName="Mina"
        cellPx={50}
        vision={{ visionCells: 3, onVisionCellsChange: vazio, dark: false, onDarkChange: vazio }}
        mapType={semChaves}
        secaoInicial={SECAO_MAPA_VIVO}
        onClose={fechar}
      />
    ))
    const secoes = Array.from(aberta.querySelectorAll('nav.gr-nav-vertical button')).map((secao) => secao.textContent)
    expect(secoes).toEqual(['Visão', 'Tipo de mapa'])
  })
})
