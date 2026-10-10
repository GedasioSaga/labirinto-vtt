/**
 * RELEVO no palco: a textura nasce uma vez quando a terra muda, espera a mão
 * parar durante o arrasto, sai NA HORA quando a cena troca (antes da nova
 * nascer) e quando o relevo desliga, e morre com o palco. A geração de verdade
 * (tela 2D) não roda no jsdom: aqui ela é trocada por uma falsa que conta as
 * chamadas e devolve texturas espionadas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Texture } from 'pixi.js'
import type { Drawing, Region, RegionPoint } from '../types/map'
import type { PlanoDoRelevo } from '../lib/relevo'
import { ESPERA_DO_RELEVO_MS, createRelevoRenderer, type EntradaDoRelevo } from './drawRelevo'

function quadrado(x: number): RegionPoint[] {
  return [
    { x, y: 0 },
    { x: x + 100, y: 0 },
    { x: x + 100, y: 100 },
    { x, y: 100 },
  ]
}

function regiao(id: string, x: number): Region {
  return { id, points: quadrado(x), tag: 'region', fillColor: '#76c577', fillPattern: 'solid', data: {} }
}

const MAPA = { width: 20, height: 20, grid: 50 }

function entrada(cena: string, regioes: Region[]): EntradaDoRelevo {
  return { cena, mapa: MAPA, regioes }
}

/** Gerador falso: cada chamada devolve uma textura nova, com `destroy` espionado. */
function geradorFalso() {
  const planos: PlanoDoRelevo[] = []
  const texturas: Texture[] = []
  const destruidas = new Set<Texture>()
  const gerarTextura = vi.fn(async (plano: PlanoDoRelevo) => {
    planos.push(plano)
    const textura = new Texture()
    const destroy = textura.destroy.bind(textura)
    vi.spyOn(textura, 'destroy').mockImplementation((destroySource?: boolean) => {
      destruidas.add(textura)
      destroy(destroySource)
    })
    texturas.push(textura)
    return textura
  })
  return { gerarTextura, planos, texturas, destruidas }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createRelevoRenderer', () => {
  it('primeira terra da cena: gera no próximo giro, sem esperar, e mostra a textura no lugar do plano', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar(entrada('cena-1', [regiao('a', 0)]))
    expect(relevo.camada.visible).toBe(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(falso.gerarTextura).toHaveBeenCalledTimes(1)
    expect(relevo.camada.visible).toBe(true)
    expect(relevo.camada.texture).toBe(falso.texturas[0])
    const plano = falso.planos[0]
    expect(relevo.camada.position.x).toBe(plano.retangulo.x)
    expect(relevo.camada.scale.x).toBeCloseTo(1 / plano.escala)
  })

  it('arrasto de vértice: a terra muda a cada movimento e só UMA geração sai, depois que a mão para', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar(entrada('cena-1', [regiao('a', 0)]))
    await vi.advanceTimersByTimeAsync(0)
    expect(falso.gerarTextura).toHaveBeenCalledTimes(1)

    for (let passo = 1; passo <= 10; passo += 1) {
      relevo.atualizar(entrada('cena-1', [regiao('a', passo)]))
      await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS / 5)
    }
    // Durante o arrasto: nada novo, e a textura velha continua no palco.
    expect(falso.gerarTextura).toHaveBeenCalledTimes(1)
    expect(relevo.camada.texture).toBe(falso.texturas[0])

    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS)
    expect(falso.gerarTextura).toHaveBeenCalledTimes(2)
    // Gerou a terra FINAL do arrasto, e a velha foi liberada.
    expect(falso.planos[1].terras[0][0].x).toBe(10)
    expect(falso.destruidas.has(falso.texturas[0])).toBe(true)
    expect(relevo.camada.texture).toBe(falso.texturas[1])
  })

  it('mesma terra em objetos novos (o pacote do jogador a cada passo de ficha): não gera de novo', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar(entrada('cena-1', [regiao('a', 0), regiao('b', 100)]))
    await vi.advanceTimersByTimeAsync(0)
    for (let i = 0; i < 5; i += 1) {
      relevo.atualizar(entrada('cena-1', [regiao('a', 0), regiao('b', 100)]))
      await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS * 2)
    }
    expect(falso.gerarTextura).toHaveBeenCalledTimes(1)
  })

  it('troca de cena: a textura da anterior é liberada NA HORA, antes de a nova nascer', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar(entrada('cena-1', [regiao('a', 0)]))
    await vi.advanceTimersByTimeAsync(0)
    const daCena1 = falso.texturas[0]

    relevo.atualizar(entrada('cena-2', [regiao('z', 500)]))
    expect(falso.destruidas.has(daCena1)).toBe(true)
    expect(relevo.camada.visible).toBe(false)
    expect(relevo.camada.texture).toBe(Texture.EMPTY)

    await vi.advanceTimersByTimeAsync(0)
    expect(falso.gerarTextura).toHaveBeenCalledTimes(2)
    expect(relevo.camada.texture).toBe(falso.texturas[1])
  })

  it('cena sem terra (ou com toda a terra apagada): nada no palco e a textura velha é liberada', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar(entrada('cena-1', [regiao('a', 0)]))
    await vi.advanceTimersByTimeAsync(0)
    relevo.atualizar(entrada('cena-1', []))
    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS)
    expect(falso.gerarTextura).toHaveBeenCalledTimes(1)
    expect(falso.destruidas.has(falso.texturas[0])).toBe(true)
    expect(relevo.camada.visible).toBe(false)
  })

  it('relevo desligado (chave, "Efeitos do mapa", modo leve): libera na hora e cancela a geração que esperava', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar(entrada('cena-1', [regiao('a', 0)]))
    await vi.advanceTimersByTimeAsync(0)
    relevo.atualizar(entrada('cena-1', [regiao('a', 5)]))
    relevo.atualizar(null)
    expect(falso.destruidas.has(falso.texturas[0])).toBe(true)
    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS * 2)
    expect(falso.gerarTextura).toHaveBeenCalledTimes(1)
    expect(relevo.camada.visible).toBe(false)
  })

  it('geração lenta passada por um pedido mais novo: a textura atrasada é jogada fora, nunca aparece', async () => {
    const soltar: (() => void)[] = []
    const lentas: Texture[] = []
    const gerarTextura = vi.fn(
      () =>
        new Promise<Texture | null>((resolver) => {
          const textura = new Texture()
          lentas.push(textura)
          vi.spyOn(textura, 'destroy')
          soltar.push(() => resolver(textura))
        }),
    )
    const relevo = createRelevoRenderer({ gerarTextura })
    relevo.atualizar(entrada('cena-1', [regiao('a', 0)]))
    await vi.advanceTimersByTimeAsync(0)
    expect(soltar).toHaveLength(1)
    // Chega outra cena antes de a primeira geração terminar.
    relevo.atualizar(entrada('cena-2', [regiao('b', 0)]))
    soltar[0]()
    await vi.advanceTimersByTimeAsync(0)
    expect(lentas[0].destroy).toHaveBeenCalled()
    expect(relevo.camada.texture).not.toBe(lentas[0])
  })

  it('destruir libera a textura do palco e para o que esperava', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar(entrada('cena-1', [regiao('a', 0)]))
    await vi.advanceTimersByTimeAsync(0)
    relevo.atualizar(entrada('cena-1', [regiao('a', 9)]))
    relevo.destruir()
    expect(falso.destruidas.has(falso.texturas[0])).toBe(true)
    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS * 2)
    expect(falso.gerarTextura).toHaveBeenCalledTimes(1)
    // Depois de destruído, pedidos novos não fazem nada.
    relevo.atualizar(entrada('cena-1', [regiao('a', 0)]))
    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS * 2)
    expect(falso.gerarTextura).toHaveBeenCalledTimes(1)
  })
})

describe('createRelevoRenderer — terra que encolhe, conhecido que cresce, visibilidade', () => {
  it('terra que ENCOLHE na mesma cena (o mestre ocultou uma região): o relevo dela sai NA HORA, sem esperar a nova', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar(entrada('cena-1', [regiao('a', 0), regiao('b', 100)]))
    await vi.advanceTimersByTimeAsync(0)
    relevo.atualizar(entrada('cena-1', [regiao('a', 0)]))
    // Antes de qualquer espera: nada do formato de B no palco.
    expect(relevo.camada.visible).toBe(false)
    expect(falso.destruidas.has(falso.texturas[0])).toBe(true)
    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS)
    expect(falso.gerarTextura).toHaveBeenCalledTimes(2)
    expect(relevo.camada.texture).toBe(falso.texturas[1])
  })

  it('região que vira "só contorno" também é terra que encolhe', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar(entrada('cena-1', [regiao('a', 0), regiao('b', 100)]))
    await vi.advanceTimersByTimeAsync(0)
    relevo.atualizar(entrada('cena-1', [regiao('a', 0), { ...regiao('b', 100), filled: false }]))
    expect(relevo.camada.visible).toBe(false)
  })

  it('terra que só se MOVE (ou cresce) mantém a textura velha até a nova', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar(entrada('cena-1', [regiao('a', 0)]))
    await vi.advanceTimersByTimeAsync(0)
    relevo.atualizar(entrada('cena-1', [regiao('a', 40)]))
    relevo.atualizar(entrada('cena-1', [regiao('a', 40), regiao('b', 140)]))
    expect(relevo.camada.visible).toBe(true)
    expect(falso.destruidas.has(falso.texturas[0])).toBe(false)
  })

  it('conhecido que cresce: regera com espera (a velha fica); o mesmo conhecido em objeto novo não regera', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    const visao = [quadrado(0)]
    relevo.atualizar({ ...entrada('cena-1', [regiao('a', 0)]), conhecido: { visao } })
    await vi.advanceTimersByTimeAsync(0)
    expect(falso.planos[0].conhecido?.visao).toBe(visao)
    // Pacote novo, mesmo conteúdo.
    relevo.atualizar({ ...entrada('cena-1', [regiao('a', 0)]), conhecido: { visao: [quadrado(0)] } })
    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS)
    expect(falso.gerarTextura).toHaveBeenCalledTimes(1)
    // Ele andou: o conhecido cresceu.
    const maior = [quadrado(0), quadrado(100)]
    relevo.atualizar({ ...entrada('cena-1', [regiao('a', 0)]), conhecido: { visao: maior } })
    expect(relevo.camada.visible).toBe(true)
    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS)
    expect(falso.gerarTextura).toHaveBeenCalledTimes(2)
    expect(falso.planos[1].conhecido?.visao).toBe(maior)
  })

  it('avisa quando a camada aparece e some (o jogador esconde junto o contêiner com a máscara)', async () => {
    const falso = geradorFalso()
    const avisos: boolean[] = []
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura, aoMudarVisibilidade: (v) => avisos.push(v) })
    relevo.atualizar(entrada('cena-1', [regiao('a', 0)]))
    await vi.advanceTimersByTimeAsync(0)
    expect(avisos.at(-1)).toBe(true)
    relevo.atualizar(null)
    expect(avisos.at(-1)).toBe(false)
  })
})

describe('createRelevoRenderer — desenhos que pintam o chão (fatia 1b)', () => {
  /** Bioma dentro da região `a` (0 a 100): cor diferente do chão, grande o bastante para dividir. */
  function bioma(id: string, cor = '#0aa148'): Extract<Drawing, { kind: 'polygon' }> {
    return { id, kind: 'polygon', points: [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }], color: cor, width: 0, filled: true, fillAlpha: 1 }
  }
  const comDesenhos = (desenhos: Drawing[]): EntradaDoRelevo => ({ ...entrada('cena-1', [regiao('a', 0)]), desenhos })

  it('o plano leva as divisas do bioma; bioma de outra cor regera', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar(comDesenhos([bioma('b1')]))
    await vi.advanceTimersByTimeAsync(0)
    expect(falso.planos[0].divisas.length).toBeGreaterThan(0)
    relevo.atualizar(comDesenhos([bioma('b1', '#47948c')]))
    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS)
    expect(falso.gerarTextura).toHaveBeenCalledTimes(2)
  })

  it('rabisco novo por cima (Pincel, Linha) não regera: não muda nenhuma divisa', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar(comDesenhos([bioma('b1')]))
    await vi.advanceTimersByTimeAsync(0)
    const rabisco: Drawing = { id: 'r1', kind: 'freehand', points: quadrado(0), color: '#000000', width: 8 }
    relevo.atualizar(comDesenhos([bioma('b1'), rabisco]))
    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS)
    expect(falso.gerarTextura).toHaveBeenCalledTimes(1)
  })

  it('o conhecido muda e a terra não: o plano da terra é reaproveitado, só o conhecido é novo', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar({ ...comDesenhos([bioma('b1')]), conhecido: { visao: [quadrado(0)] } })
    await vi.advanceTimersByTimeAsync(0)
    // Pacote novo do host: objetos novos com o mesmo conteúdo, e ele andou.
    relevo.atualizar({ ...entrada('cena-1', [regiao('a', 0)]), desenhos: [bioma('b1')], conhecido: { visao: [quadrado(0), quadrado(100)] } })
    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS)
    expect(falso.gerarTextura).toHaveBeenCalledTimes(2)
    expect(falso.planos[1].divisas).toBe(falso.planos[0].divisas)
    expect(falso.planos[1].conhecido?.visao).toHaveLength(2)
  })

  it('bioma que SOME (o mestre o tornou secreto ou o ocultou): a divisa dele sai NA HORA', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar(comDesenhos([bioma('b1')]))
    await vi.advanceTimersByTimeAsync(0)
    relevo.atualizar(comDesenhos([]))
    expect(relevo.camada.visible).toBe(false)
    expect(falso.destruidas.has(falso.texturas[0])).toBe(true)
    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS)
    expect(falso.planos[1].divisas).toEqual([])
  })

  it('bioma que perde o fundo também sai NA HORA: a divisa dele já não tem cor que a sustente', async () => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar(comDesenhos([bioma('b1')]))
    await vi.advanceTimersByTimeAsync(0)
    relevo.atualizar(comDesenhos([{ ...bioma('b1'), filled: false }]))
    expect(relevo.camada.visible).toBe(false)
  })

  /** Desenhos com fundo que NUNCA dão divisa: a borda deles não está na textura. */
  const semDivisa: [string, Drawing][] = [
    ['detalhe (menor que o tamanho mínimo)', { id: 'pedra', kind: 'polygon', points: [{ x: 40, y: 40 }, { x: 46, y: 40 }, { x: 46, y: 46 }, { x: 40, y: 46 }], color: '#3a2a1a', width: 0, filled: true, fillAlpha: 1 }],
    ['desenho sobre o mar', { id: 'anotacao', kind: 'circle', cx: 600, cy: 600, radius: 80, color: '#d23c3c', width: 0, filled: true, fillAlpha: 1 }],
    ['tinta a 30%', { id: 'tinta', kind: 'rect', x: 20, y: 20, w: 60, h: 60, color: '#d23c3c', width: 0, filled: true, fillAlpha: 0.3 }],
  ]

  it.each(semDivisa)('%s que some NÃO esconde a camada: o relevo segue no palco até a textura nova', async (_nome, desenho) => {
    const falso = geradorFalso()
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura })
    relevo.atualizar(comDesenhos([bioma('b1'), desenho]))
    await vi.advanceTimersByTimeAsync(0)
    // O mestre apaga (ou desfaz) o desenho, ou ele sai do recorte do jogador.
    relevo.atualizar(comDesenhos([bioma('b1')]))
    expect(relevo.camada.visible).toBe(true)
    expect(falso.destruidas.has(falso.texturas[0])).toBe(false)
    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS)
    expect(relevo.camada.texture).toBe(falso.texturas[1])
    // Só o bioma deu divisa: é ele que o palco vigia.
    expect(falso.planos[0].divisores).toEqual(['b1'])
  })

  it('a classificação das divisas DÁ A VEZ ao navegador, e para quando a terra muda no meio', async () => {
    const falso = geradorFalso()
    // Fatia de 0 ms: cede a cada pedaço, como num celular lento em que todo pedaço estoura a fatia.
    const relevo = createRelevoRenderer({ gerarTextura: falso.gerarTextura, fatiaMs: 0 })
    relevo.atualizar(comDesenhos([bioma('b1'), bioma('b2', '#47948c')]))
    // Só o giro que começa a geração: o plano ainda não acabou, então a textura não começou.
    await vi.advanceTimersToNextTimerAsync()
    expect(falso.gerarTextura).not.toHaveBeenCalled()
    // A terra muda no meio da classificação (o mestre arrastou um vértice).
    relevo.atualizar({ ...comDesenhos([bioma('b1')]), regioes: [regiao('a', 0), regiao('c', 100)] })
    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELEVO_MS * 2)
    // O plano interrompido nunca chegou à textura: só o da terra nova.
    expect(falso.gerarTextura).toHaveBeenCalledTimes(1)
    expect(falso.planos[0].terras).toHaveLength(2)
    expect(falso.planos[0].divisores).toEqual(['b1'])
  })
})
