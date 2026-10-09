import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CENARIO_PADRAO } from '../cenario/catalogo'
import { CenarioSection } from '../cenario/CenarioSection'
import { esquecerPacoteCarregado } from '../lib/pacoteDeAnimacoes'
import { TransicaoSection } from '../transicoes/TransicaoSection'
import { WallDoorControls } from './WallDoorControls'

/**
 * "Procurar animações novas" nas três galerias: só no app (Tauri), e o
 * clique pergunta ao Rust e responde em português simples. O módulo do Tauri
 * é trocado: aqui ele diz que está no app e o `animacoes_atualizar` responde
 * o que cada teste quiser.
 */
const tauri = vi.hoisted(() => {
  const estado: { noApp: boolean; resposta: unknown } = { noApp: true, resposta: null }
  return estado
})

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => tauri.noApp,
  invoke: vi.fn(async (comando: string) => {
    if (comando === 'animacoes_atualizar') return tauri.resposta
    return null
  }),
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  tauri.noApp = true
  tauri.resposta = { estado: 'igual', versao: 1, indice: null }
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  esquecerPacoteCarregado()
  vi.restoreAllMocks()
})

const PROCURAR = 'Procurar animações novas'
const botoesDeProcurar = () => Array.from(container.querySelectorAll('button')).filter((b) => b.textContent === PROCURAR)

const galerias = {
  transicao: () => <TransicaoSection transicao={undefined} onChange={() => {}} origem="pino" />,
  porta: () => (
    <WallDoorControls
      door={{ open: false, locked: false, kind: 'normal' }}
      onToggleDoor={() => {}}
      onToggleOpen={() => {}}
      onToggleLocked={() => {}}
      onToggleSemEspiar={() => {}}
      onToggleSecret={() => {}}
      onRevealPassage={() => {}}
      onOpensFromChange={() => {}}
      onAnimacaoChange={() => {}}
    />
  ),
  cenario: () => <CenarioSection cenario={CENARIO_PADRAO} imagem="data:image/png;base64,AAAA" onChange={() => {}} />,
}

describe('botão "Procurar animações novas" nas galerias', () => {
  for (const [nome, galeria] of Object.entries(galerias)) {
    it(`${nome}: aparece no app e responde "Animações em dia"`, async () => {
      act(() => root.render(galeria()))
      const [botao] = botoesDeProcurar()
      if (botao === undefined) throw new Error(`sem o botão na galeria de ${nome}`)
      await act(async () => {
        botao.click()
      })
      expect(container.textContent).toContain('Animações em dia')
    })

    it(`${nome}: some fora do app`, () => {
      tauri.noApp = false
      act(() => root.render(galeria()))
      expect(botoesDeProcurar()).toHaveLength(0)
    })
  }

  it('sem internet: diz que não deu para procurar', async () => {
    tauri.resposta = { estado: 'sem_internet', versao: null, indice: null }
    act(() => root.render(galerias.transicao()))
    await act(async () => {
      botoesDeProcurar()[0]?.click()
    })
    expect(container.textContent).toContain('Não deu para procurar animações agora')
  })

  it('pacote novo sem animação nova (só versão): "Animações atualizadas"', async () => {
    // Com módulo de verdade (nomes novos, registro) o caminho é testado em
    // lib/pacoteDeAnimacoes.test.ts: aqui não há `import()` de Blob (jsdom).
    tauri.resposta = { estado: 'novo', versao: 2, indice: JSON.stringify({ formato: 1, versao: 2, motorMinimo: '0.4.21', arquivos: [], animacoes: [] }) }
    act(() => root.render(galerias.transicao()))
    await act(async () => {
      botoesDeProcurar()[0]?.click()
    })
    expect(container.textContent).toContain('Animações atualizadas')
  })
})
