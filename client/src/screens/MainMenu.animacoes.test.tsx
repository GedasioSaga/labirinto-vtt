import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { novaMemoriaDaAbertura, type PortaDoAtualizador } from '../lib/atualizacao'
import { esquecerPacoteCarregado, type OrigemDoPacote, type PortaDoPacote } from '../lib/pacoteDeAnimacoes'
import { listarEstilosDeCenario } from '../cenario/estilosDeCenario'
import { useToastStore } from '../stores/toastStore'
import { MainMenu } from './MainMenu'

/** PACOTE DE ANIMAÇÕES na tela inicial: procura ao abrir (aviso só com nome novo) e no botão. */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  for (const aviso of useToastStore.getState().toasts) useToastStore.getState().dismiss(aviso.id)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  esquecerPacoteCarregado()
  vi.restoreAllMocks()
})

const atualizadorEmDia: PortaDoAtualizador = {
  disponivel: () => true,
  procurar: async () => null,
  versaoAtual: async () => '0.4.21',
  salaAberta: async () => false,
  reiniciar: async () => {},
}

const CHUVA = { id: 'chuva', tipo: 'cenario', nome: 'Chuva', arquivo: 'cenario-chuva.js', duracaoNaturalS: 8 }
const INDICE_COM_CHUVA = JSON.stringify({
  formato: 1,
  versao: 1,
  motorMinimo: '0.4.21',
  arquivos: [{ nome: 'cenario-chuva.js', sha256: 'a'.repeat(64), tamanho: 10 }],
  animacoes: [CHUVA],
})

const origem: OrigemDoPacote = {
  lerIndice: async () => null,
  importar: async () => ({ default: () => ({ atualizar: () => {}, descartar: () => {} }) }),
}

function pacoteFalso(resposta: unknown): PortaDoPacote & { atualizar: ReturnType<typeof vi.fn> } {
  return { disponivel: () => true, atualizar: vi.fn(async () => resposta), origem }
}

async function abrir(pacote: PortaDoPacote, memoria = { jaProcurou: false }) {
  await act(async () => {
    root.render(
      <MainMenu
        onCreate={() => {}}
        onLoad={() => {}}
        onOptions={() => {}}
        onRoleplay={() => {}}
        atualizador={atualizadorEmDia}
        memoriaDaAtualizacao={novaMemoriaDaAbertura()}
        pacoteDeAnimacoes={pacote}
        memoriaDasAnimacoes={memoria}
      />,
    )
  })
}

const textosDosAvisos = () => useToastStore.getState().toasts.map((t) => t.text)

describe('animações na tela inicial', () => {
  it('ao abrir, pacote novo vira o aviso "Animações novas: <nomes>" e entra no registro', async () => {
    await abrir(pacoteFalso({ estado: 'novo', versao: 1, indice: INDICE_COM_CHUVA }))
    expect(textosDosAvisos()).toContain('Animações novas: Chuva')
    expect(listarEstilosDeCenario().map((e) => e.id)).toEqual(['chuva'])
  })

  it('ao abrir, em dia ou sem internet: nenhum aviso', async () => {
    await abrir(pacoteFalso({ estado: 'igual', versao: 1, indice: INDICE_COM_CHUVA }))
    act(() => root.unmount())
    root = createRoot(container)
    await abrir(pacoteFalso({ estado: 'sem_internet', versao: null, indice: null }))
    expect(textosDosAvisos().filter((t) => t.startsWith('Animações'))).toEqual([])
  })

  it('procura uma vez por abertura do app: voltar à tela inicial não procura de novo', async () => {
    const pacote = pacoteFalso({ estado: 'igual', versao: 1, indice: null })
    const memoria = { jaProcurou: false }
    await abrir(pacote, memoria)
    act(() => root.unmount())
    root = createRoot(container)
    await abrir(pacote, memoria)
    expect(pacote.atualizar).toHaveBeenCalledTimes(1)
  })

  it('"Procurar atualizações" também procura animações e diz o resultado', async () => {
    const pacote = pacoteFalso({ estado: 'igual', versao: 1, indice: null })
    await abrir(pacote, { jaProcurou: true })
    const botao = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Procurar atualizações')
    if (botao === undefined) throw new Error('sem o botão "Procurar atualizações"')
    await act(async () => {
      botao.click()
    })
    expect(pacote.atualizar).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Animações em dia')
    expect(container.textContent).toContain('Você está na versão mais nova')
  })
})
