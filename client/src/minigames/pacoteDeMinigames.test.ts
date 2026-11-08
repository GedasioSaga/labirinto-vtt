import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  esquecerPacotesDeMinigames,
  faseDoPacote,
  ouvirPacote,
  prepararMinigame,
  type FaseDoPacote,
  type PortaDoPacoteDeMinigames,
} from './pacoteDeMinigames'

const INDICE_V1 = JSON.stringify({
  formato: 1,
  jogo: 'fogo',
  nome: 'Fogo na Floresta',
  versao: 1,
  motorMinimo: '0.5.37',
  entrada: 'index.html',
  arquivos: [{ nome: 'fogo.index.wasm.gz', sha256: 'a'.repeat(64), tamanho: 200 }],
})

function portaFalsa(lerIndice: () => Promise<unknown>, atualizar: (aoProgredir: (valor: unknown) => void) => Promise<unknown>) {
  const porta: PortaDoPacoteDeMinigames = {
    disponivel: () => true,
    lerIndice: vi.fn(lerIndice),
    atualizar: vi.fn((_jogo, aoProgredir) => atualizar(aoProgredir)),
  }
  return porta
}

/** Todas as fases por onde o pacote passou, na ordem. */
function gravarFases(): FaseDoPacote[] {
  const fases: FaseDoPacote[] = []
  ouvirPacote('fogo', () => fases.push(faseDoPacote('fogo')))
  return fases
}

beforeEach(() => {
  esquecerPacotesDeMinigames()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('pacote de minigames', () => {
  it('primeira vez: baixa com a barra e fica pronto; depois abre sem internet com o instalado e só procura sem partida aberta', async () => {
    const primeira = portaFalsa(
      async () => null,
      async (aoProgredir) => {
        aoProgredir({ baixado: 0, total: 200 })
        aoProgredir({ baixado: 999, total: 200 }) // fora da forma: ignorado
        aoProgredir({ baixado: 200, total: 200 })
        return { estado: 'novo', versao: 1, indice: INDICE_V1 }
      },
    )
    const fases = gravarFases()
    await prepararMinigame('fogo', { porta: primeira })
    expect(fases).toEqual([
      { tipo: 'baixando', primeiraVez: true, baixado: 0, total: null },
      { tipo: 'baixando', primeiraVez: true, baixado: 0, total: 200 },
      { tipo: 'baixando', primeiraVez: true, baixado: 200, total: 200 },
      { tipo: 'pronto', versao: 1 },
    ])
    // Reabrir o painel no mesmo processo não pergunta de novo ao GitHub.
    await prepararMinigame('fogo', { porta: primeira })
    expect(primeira.atualizar).toHaveBeenCalledTimes(1)

    // App reaberto, sem internet, com partida aberta: pronto na hora e sem procurar.
    esquecerPacotesDeMinigames()
    const offline = portaFalsa(
      async () => INDICE_V1,
      async () => ({ estado: 'sem_internet', versao: 1, indice: INDICE_V1 }),
    )
    const depois = gravarFases()
    await prepararMinigame('fogo', { porta: offline, ocupado: true })
    expect(offline.atualizar).not.toHaveBeenCalled()
    // A partida acabou: procura agora; sem internet, continua o instalado, sem barra.
    await prepararMinigame('fogo', { porta: offline, ocupado: false })
    expect(offline.atualizar).toHaveBeenCalledTimes(1)
    expect(depois).toEqual([{ tipo: 'pronto', versao: 1 }, { tipo: 'pronto', versao: 1 }])
  })

  it('falhas: sem internet na primeira vez pede para tentar de novo; app sem o lado Rust fica sem suporte', async () => {
    let comInternet = false
    const porta = portaFalsa(
      async () => null,
      async () => (comInternet ? { estado: 'novo', versao: 1, indice: INDICE_V1 } : { estado: 'sem_internet', versao: null, indice: null }),
    )
    await prepararMinigame('fogo', { porta })
    expect(faseDoPacote('fogo')).toEqual({ tipo: 'falhou', motivo: 'sem_internet' })
    comInternet = true
    await prepararMinigame('fogo', { porta }) // o "Tentar de novo"
    expect(faseDoPacote('fogo')).toEqual({ tipo: 'pronto', versao: 1 })

    esquecerPacotesDeMinigames()
    const velho = portaFalsa(
      () => Promise.reject('Command minigames_ler_indice not found'),
      async () => ({}),
    )
    await prepararMinigame('fogo', { porta: velho })
    expect(faseDoPacote('fogo')).toEqual({ tipo: 'sem_suporte' })
    expect(velho.atualizar).not.toHaveBeenCalled()
  })
})
