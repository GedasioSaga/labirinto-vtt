/**
 * F4 (otimização do mapa grande, 27/10/2026): a malha do "Andar até aqui" do
 * jogador era refeita do zero a cada pacote do mestre quando uma parede
 * andava com a ficha (19 montagens em 3 s no Tasmaturi). O preparo agora
 * espera o mapa sossegar (ou no máximo `ESPERA_MAXIMA_MS`) e não interrompe a
 * montagem começada. O caminho tem de sair o MESMO.
 */
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { createExploration, markAll } from './exploration'
import type { KnownArea, PathMap } from './knownPath'
import { criarPreparoDoCaminho, ESPERA_MAXIMA_MS, QUIETO_MS, type MontagemDoPreparo, type RelogioDoPreparo } from './preparoDoCaminho'
import type { MapData, Wall } from '../types/map'

/** Relógio de mentira: as tarefas agendadas só rodam quando o teste anda o tempo. */
function relogioDeTeste() {
  let agora = 0
  let proximo = 1
  const tarefas = new Map<number, { quando: number; fazer: () => void }>()
  const relogio: RelogioDoPreparo = {
    agora: () => agora,
    agendar: (fazer, ms) => {
      const id = proximo++
      tarefas.set(id, { quando: agora + ms, fazer })
      return id
    },
    cancelar: (alca) => {
      tarefas.delete(alca as number)
    },
  }
  const andar = (ms: number) => {
    const fim = agora + ms
    for (;;) {
      const prontas = [...tarefas].filter(([, t]) => t.quando <= fim).sort((a, b) => a[1].quando - b[1].quando || a[0] - b[0])
      if (prontas.length === 0) break
      const [id, t] = prontas[0]
      tarefas.delete(id)
      agora = Math.max(agora, t.quando)
      t.fazer()
    }
    agora = fim
  }
  return { relogio, andar }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Praça de 20 x 12 casas de 50 px com um prédio no meio e uma carroça (parede 0) que anda com o NPC. */
function praca(xDaCarroca: number): MapData {
  const walls = [
    parede('carroca', xDaCarroca, 520, xDaCarroca + 60, 520),
    parede('n', 400, 150, 600, 150),
    parede('l', 600, 150, 600, 450),
    parede('s', 600, 450, 400, 450),
    parede('o', 400, 450, 400, 150),
  ]
  return { ...createEmptyMap('capital', 'Capital', 20, 12, 50), walls }
}

/** Montagem de mentira: N fatias por mapa, conta quantas montagens começaram. */
function montagemContada(fatiasPorMontagem: number) {
  let malhaDe: PathMap | null = null
  let estrutura: number | null = null
  let restante = 0
  const comecadas: PathMap[] = []
  const chave = (m: PathMap) => m.walls[0]?.x1 ?? -1
  const montagem: MontagemDoPreparo = {
    pronta: (m) => malhaDe !== null && estrutura === chave(m) && restante === 0,
    jaMontou: () => malhaDe !== null,
    avancar: (m) => {
      if (malhaDe === null || estrutura !== chave(m)) {
        malhaDe = m
        estrutura = chave(m)
        restante = fatiasPorMontagem
        comecadas.push(m)
      }
      restante = Math.max(0, restante - 1)
      return restante === 0
    },
  }
  return { montagem, comecadas }
}

describe('preparo da malha do jogador: quando montar', () => {
  it('primeira cena: monta na hora, em fatias', () => {
    const { relogio, andar } = relogioDeTeste()
    const { montagem, comecadas } = montagemContada(3)
    const preparo = criarPreparoDoCaminho(relogio, montagem)
    preparo.atualizar(praca(100))
    andar(0)
    expect(comecadas).toHaveLength(1)
    expect(montagem.pronta(praca(100))).toBe(true)
  })

  it('parede andando a cada 200 ms por 6 s: no máximo uma montagem a cada ESPERA_MAXIMA_MS (antes: uma por pacote)', () => {
    const { relogio, andar } = relogioDeTeste()
    const { montagem, comecadas } = montagemContada(5)
    const preparo = criarPreparoDoCaminho(relogio, montagem)
    preparo.atualizar(praca(100))
    andar(50)
    expect(comecadas).toHaveLength(1)
    const pacotes = 6000 / 200
    for (let k = 1; k <= pacotes; k += 1) {
      preparo.atualizar(praca(100 + k * 10))
      andar(200)
    }
    // 30 pacotes; antes eram 30 montagens começadas.
    expect(comecadas.length - 1).toBeLessThanOrEqual(Math.ceil(6000 / ESPERA_MAXIMA_MS))
    expect(comecadas.length - 1).toBeGreaterThanOrEqual(1)
    // Parou de andar: depois de QUIETO_MS a malha é a do último mapa.
    andar(QUIETO_MS + 100)
    expect(montagem.pronta(praca(100 + pacotes * 10))).toBe(true)
  })

  it('mapa sem mudança de parede (ficha andando): não monta de novo', () => {
    const { relogio, andar } = relogioDeTeste()
    const { montagem, comecadas } = montagemContada(2)
    const preparo = criarPreparoDoCaminho(relogio, montagem)
    preparo.atualizar(praca(100))
    andar(10)
    for (let k = 0; k < 10; k += 1) {
      preparo.atualizar(praca(100))
      andar(200)
    }
    expect(comecadas).toHaveLength(1)
  })

  it('parar: nada mais roda', () => {
    const { relogio, andar } = relogioDeTeste()
    const { montagem, comecadas } = montagemContada(2)
    const preparo = criarPreparoDoCaminho(relogio, montagem)
    preparo.atualizar(praca(100))
    preparo.parar()
    andar(ESPERA_MAXIMA_MS * 2)
    expect(comecadas).toHaveLength(0)
  })
})

describe('preparo da malha do jogador: o caminho sai o mesmo (20 pares)', () => {
  const area = (): KnownArea => {
    const explored = createExploration({ width: 1000, height: 600, grid: 50 })
    markAll(explored)
    return { explored, vision: [], concealed: [] }
  }
  const PARES: Array<[{ x: number; y: number }, { x: number; y: number }]> = []
  for (let k = 0; k < 20; k += 1) {
    const de = { x: 60 + ((k * 137) % 880), y: 60 + ((k * 89) % 80) }
    const para = { x: 60 + ((k * 211 + 400) % 880), y: 470 + ((k * 53) % 90) }
    PARES.push([de, para])
  }

  it('malha montada pelo preparo depois da carroça andar = malha montada do zero no mapa final', async () => {
    // Do zero: módulo novo, nenhuma malha guardada.
    vi.resetModules()
    const zero = await import('./knownPath')
    const final = praca(100 + 30 * 10)
    const esperado = PARES.map(([de, para]) => zero.findKnownPath(final, de, para, area()))
    // Pelo preparo: outro módulo novo, a carroça andando 30 pacotes antes.
    vi.resetModules()
    const knownPath = await import('./knownPath')
    const { criarPreparoDoCaminho: criar } = await import('./preparoDoCaminho')
    const { relogio, andar } = relogioDeTeste()
    const preparo = criar(relogio, { pronta: knownPath.caminhoConhecidoPronto, jaMontou: knownPath.temMalhaDoJogador, avancar: (m, ms) => knownPath.prepararCaminhoConhecido(m, ms) })
    preparo.atualizar(praca(100))
    andar(1000)
    for (let k = 1; k <= 30; k += 1) {
      preparo.atualizar(praca(100 + k * 10))
      andar(200)
    }
    andar(ESPERA_MAXIMA_MS)
    expect(knownPath.caminhoConhecidoPronto(final)).toBe(true)
    const obtido = PARES.map(([de, para]) => knownPath.findKnownPath(final, de, para, area()))
    expect(obtido.filter((c) => c !== null).length).toBeGreaterThanOrEqual(15)
    expect(obtido).toEqual(esperado)
  })
})
