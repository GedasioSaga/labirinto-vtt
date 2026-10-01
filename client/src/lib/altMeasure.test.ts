import { describe, expect, it } from 'vitest'
import type { AreaBounds } from './areaSelection'
import { criarMedidorDoAlt, measureBetween, sameAltMeasure, type AltMeasure } from './altMeasure'
import {
  ALT_TOQUE_JANELA_MS,
  ALT_TOQUE_MOVIMENTO_MAX_PX,
  criarDetectorDeToqueDeAlt,
  type TeclaDoAlt,
} from './toqueDeAlt'

/**
 * Pedido 3, fatia 5: Alt SEGURADO mede, como no Figma. A geometria
 * (`measureBetween`) diz o que se mede entre a seleção e a peça sob o mouse;
 * o medidor diz QUANDO o Alt é do medir, pela régua de `lib/toqueDeAlt.ts`
 * (decisão d de `smartGuides.ts`): o toque curto é do endireitar (pedido 5),
 * e os dois nunca agem sobre o mesmo Alt.
 */

function caixa(minX: number, minY: number, maxX: number, maxY: number): AreaBounds {
  return { minX, minY, maxX, maxY }
}

function so(gaps: AltMeasure['gaps'], extensions: AltMeasure['extensions'] = []): AltMeasure {
  return { gaps, extensions }
}

describe('measureBetween — peça ao lado, com faixa em comum', () => {
  it('à direita: uma cota só, da borda da seleção à da peça, no meio da faixa em comum', () => {
    expect(measureBetween(caixa(0, 0, 100, 100), caixa(150, 20, 250, 80))).toEqual(so([{ axis: 'x', from: 100, to: 150, at: 50 }]))
  })

  it('à esquerda: a cota vai da borda da peça à da seleção (from antes de to, como o vão das guias)', () => {
    expect(measureBetween(caixa(300, 0, 400, 100), caixa(0, 40, 100, 200))).toEqual(so([{ axis: 'x', from: 100, to: 300, at: 70 }]))
  })

  it('embaixo: a cota fica em pé, no meio da faixa em comum na horizontal', () => {
    expect(measureBetween(caixa(0, 0, 100, 100), caixa(50, 180, 300, 260))).toEqual(so([{ axis: 'y', from: 100, to: 180, at: 75 }]))
  })

  it('uma luz (ponto) ao lado da sala mede do ponto até a parede', () => {
    expect(measureBetween(caixa(300, 50, 300, 50), caixa(0, 0, 200, 100))).toEqual(so([{ axis: 'x', from: 200, to: 300, at: 50 }]))
  })
})

describe('measureBetween — uma dentro da outra (as folgas)', () => {
  const sala = caixa(0, 0, 400, 300)
  const dentro = caixa(100, 50, 250, 200)
  const quatroFolgas = so([
    { axis: 'x', from: 0, to: 100, at: 125 },
    { axis: 'x', from: 250, to: 400, at: 125 },
    { axis: 'y', from: 0, to: 50, at: 175 },
    { axis: 'y', from: 200, to: 300, at: 175 },
  ])

  it('a peça sob o mouse dentro da seleção: as 4 folgas, passando pelo meio da de dentro', () => {
    expect(measureBetween(sala, dentro)).toEqual(quatroFolgas)
  })

  it('a seleção dentro da peça sob o mouse (a sala que contém a selecionada): as mesmas 4 folgas', () => {
    expect(measureBetween(dentro, sala)).toEqual(quatroFolgas)
  })

  it('encostada numa parede por dentro: a folga zero não ganha cota', () => {
    const naParede = caixa(0, 50, 250, 200)
    const { gaps } = measureBetween(sala, naParede)
    expect(gaps).toHaveLength(3)
    expect(gaps).not.toContainEqual(expect.objectContaining({ axis: 'x', from: 0, to: 0 }))
  })

  it('uma luz (ponto) no meio da sala: as 4 distâncias até as paredes', () => {
    expect(measureBetween(caixa(50, 30, 50, 30), caixa(0, 0, 200, 100))).toEqual(
      so([
        { axis: 'x', from: 0, to: 50, at: 30 },
        { axis: 'x', from: 50, to: 200, at: 30 },
        { axis: 'y', from: 0, to: 30, at: 50 },
        { axis: 'y', from: 30, to: 100, at: 50 },
      ]),
    )
  })
})

describe('measureBetween — se cruzam, encostam ou coincidem', () => {
  it('se cruzam: a folga entre as bordas correspondentes, no meio da área em comum', () => {
    expect(measureBetween(caixa(0, 0, 200, 200), caixa(100, 50, 300, 150))).toEqual(
      so([
        { axis: 'x', from: 0, to: 100, at: 100 },
        { axis: 'x', from: 200, to: 300, at: 100 },
        { axis: 'y', from: 0, to: 50, at: 150 },
        { axis: 'y', from: 150, to: 200, at: 150 },
      ]),
    )
  })

  it('lado a lado, encostadas: no eixo em que encostam não há vão; no outro, as folgas das pontas na linha em comum', () => {
    expect(measureBetween(caixa(0, 0, 100, 100), caixa(100, 20, 200, 80))).toEqual(
      so([
        { axis: 'y', from: 0, to: 20, at: 100 },
        { axis: 'y', from: 80, to: 100, at: 100 },
      ]),
    )
  })

  it('a mesma caixa: nada a medir', () => {
    expect(measureBetween(caixa(0, 0, 100, 100), caixa(0, 0, 100, 100))).toEqual(so([]))
  })

  it('caixa que não serve (NaN, infinita) não mede: nada de cota no infinito', () => {
    expect(measureBetween(caixa(0, 0, Number.NaN, 100), caixa(200, 0, 300, 100))).toEqual(so([]))
    expect(measureBetween(caixa(0, 0, 100, 100), caixa(200, 0, Number.POSITIVE_INFINITY, 100))).toEqual(so([]))
  })
})

describe('measureBetween — na diagonal (sem faixa em comum)', () => {
  it('uma cota por eixo, saindo do meio da seleção, e um tracejado que leva a ponta da cota até a peça', () => {
    expect(measureBetween(caixa(0, 0, 100, 100), caixa(200, 200, 300, 300))).toEqual({
      gaps: [
        { axis: 'x', from: 100, to: 200, at: 50 },
        { axis: 'y', from: 100, to: 200, at: 50 },
      ],
      extensions: [
        // Em pé em x = 200 (a borda esquerda da peça), do meio da seleção até o topo da peça.
        { axis: 'y', from: 50, to: 200, at: 200 },
        // Deitado em y = 200 (o topo da peça), do meio da seleção até a borda esquerda dela.
        { axis: 'x', from: 50, to: 200, at: 200 },
      ],
    })
  })

  it('para cima e à esquerda: o tracejado vai até a borda de baixo e a da direita da peça', () => {
    expect(measureBetween(caixa(200, 200, 300, 300), caixa(0, 0, 100, 100))).toEqual({
      gaps: [
        { axis: 'x', from: 100, to: 200, at: 250 },
        { axis: 'y', from: 100, to: 200, at: 250 },
      ],
      extensions: [
        { axis: 'y', from: 100, to: 250, at: 100 },
        { axis: 'x', from: 100, to: 250, at: 100 },
      ],
    })
  })
})

describe('sameAltMeasure — não redesenhar a mesma medida a cada pointermove', () => {
  const medida = measureBetween(caixa(0, 0, 100, 100), caixa(200, 200, 300, 300))

  it('mesmas cotas e mesmos tracejados: igual', () => {
    expect(sameAltMeasure(medida, measureBetween(caixa(0, 0, 100, 100), caixa(200, 200, 300, 300)))).toBe(true)
  })

  it('uma cota ou um tracejado diferente: diferente', () => {
    expect(sameAltMeasure(medida, measureBetween(caixa(0, 0, 100, 100), caixa(210, 200, 300, 300)))).toBe(false)
    expect(sameAltMeasure(medida, { gaps: medida.gaps, extensions: [] })).toBe(false)
  })
})

function tecla(key: string, timeStamp: number, extra: Partial<TeclaDoAlt> = {}): TeclaDoAlt {
  return { key, timeStamp, repeat: false, ctrlKey: false, metaKey: false, shiftKey: false, ...extra }
}

const alt = (timeStamp: number, extra: Partial<TeclaDoAlt> = {}): TeclaDoAlt => tecla('Alt', timeStamp, extra)

describe('criarMedidorDoAlt — quando o Alt é do medir', () => {
  it('Alt parado: só mede a partir da janela do toque; antes dela o Alt ainda pode ser o toque que endireita', () => {
    const m = criarMedidorDoAlt()
    m.teclaDesceu(alt(1000))
    expect(m.medindo(1000)).toBe(false)
    expect(m.medindo(1000 + ALT_TOQUE_JANELA_MS - 1)).toBe(false)
    expect(m.medindo(1000 + ALT_TOQUE_JANELA_MS)).toBe(true)
    expect(m.medePeloTempoEm()).toBe(1000 + ALT_TOQUE_JANELA_MS)
  })

  it('mexer o mouse mais de 3 px com o Alt apertado mede na hora: quem mexe está medindo', () => {
    const m = criarMedidorDoAlt()
    m.ponteiroMoveu(100, 100, 0)
    m.teclaDesceu(alt(0))
    m.ponteiroMoveu(100 + ALT_TOQUE_MOVIMENTO_MAX_PX, 100, 0)
    expect(m.medindo(50)).toBe(false)
    m.ponteiroMoveu(110, 100, 0)
    expect(m.medindo(60)).toBe(true)
  })

  it('soltar o Alt apaga a medida, e o próximo Alt começa do zero', () => {
    const m = criarMedidorDoAlt()
    m.teclaDesceu(alt(0))
    expect(m.medindo(ALT_TOQUE_JANELA_MS)).toBe(true)
    m.teclaSubiu(alt(ALT_TOQUE_JANELA_MS + 10))
    expect(m.medindo(ALT_TOQUE_JANELA_MS + 20)).toBe(false)
    expect(m.medePeloTempoEm()).toBeNull()
    m.teclaDesceu(alt(5000))
    expect(m.medindo(5100)).toBe(false)
    expect(m.medindo(5000 + ALT_TOQUE_JANELA_MS)).toBe(true)
  })

  it('clique durante o Alt cancela a medida até o Alt ser solto (é o Alt+clique que duplica)', () => {
    const m = criarMedidorDoAlt()
    m.teclaDesceu(alt(0))
    expect(m.medindo(700)).toBe(true)
    m.ponteiroDesceu()
    m.ponteiroSubiu()
    expect(m.medindo(800)).toBe(false)
    expect(m.medindo(5000)).toBe(false)
    expect(m.medePeloTempoEm()).toBeNull()
    m.teclaSubiu(alt(900))
    m.teclaDesceu(alt(1000))
    expect(m.medindo(1000 + ALT_TOQUE_JANELA_MS)).toBe(true)
  })

  it('arrasto já em andamento quando o Alt desce: nunca mede (ali o Alt inverte a grade)', () => {
    const m = criarMedidorDoAlt()
    m.ponteiroDesceu()
    m.teclaDesceu(alt(0))
    expect(m.medindo(2000)).toBe(false)
  })

  it('arrastar com o Alt apertado (botão no pointermove) cancela', () => {
    const m = criarMedidorDoAlt()
    m.teclaDesceu(alt(0))
    m.ponteiroMoveu(10, 10, 1)
    expect(m.medindo(2000)).toBe(false)
  })

  it('outra tecla, rolagem, AltGr (Ctrl+Alt) ou Alt+Shift: o Alt é modificador, não mede', () => {
    const comSeta = criarMedidorDoAlt()
    comSeta.teclaDesceu(alt(0))
    comSeta.teclaDesceu(tecla('ArrowLeft', 30))
    expect(comSeta.medindo(2000)).toBe(false)

    const comRolagem = criarMedidorDoAlt()
    comRolagem.teclaDesceu(alt(0))
    comRolagem.interromper()
    expect(comRolagem.medindo(2000)).toBe(false)

    const altGr = criarMedidorDoAlt()
    altGr.teclaDesceu(alt(0, { ctrlKey: true }))
    expect(altGr.medindo(2000)).toBe(false)

    const idioma = criarMedidorDoAlt()
    idioma.teclaDesceu(alt(0))
    idioma.teclaDesceu(tecla('Shift', 20, { shiftKey: true }))
    expect(idioma.medindo(2000)).toBe(false)
  })

  it('a repetição do Alt segurado não rearma a janela', () => {
    const m = criarMedidorDoAlt()
    m.teclaDesceu(alt(0))
    m.teclaDesceu(alt(500, { repeat: true }))
    expect(m.medindo(ALT_TOQUE_JANELA_MS)).toBe(true)
    expect(m.medePeloTempoEm()).toBe(ALT_TOQUE_JANELA_MS)
  })

  it('perda de foco (Alt+Tab): esquece o Alt, nada fica preso na tela', () => {
    const m = criarMedidorDoAlt()
    m.teclaDesceu(alt(0))
    m.zerar()
    expect(m.medindo(2000)).toBe(false)
    expect(m.medePeloTempoEm()).toBeNull()
  })

  it('instante que não serve (NaN, antes do Alt descer) não mede', () => {
    const m = criarMedidorDoAlt()
    m.teclaDesceu(alt(1000))
    expect(m.medindo(Number.NaN)).toBe(false)
    expect(m.medindo(500)).toBe(false)
  })
})

/** PRNG pequeno e determinístico (mulberry32): a mesma sequência a cada rodada do teste. */
function sorteador(semente: number): () => number {
  let estado = semente >>> 0
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('criarMedidorDoAlt × detector do toque (lib/toqueDeAlt.ts): nunca os dois no mesmo Alt', () => {
  it('em 3000 sequências sorteadas, a medida no ar implica soltura que não é toque, e medir na soltura é exatamente o "segurado" do detector', () => {
    const sorteio = sorteador(20261001)
    const escolher = <T,>(opcoes: readonly T[]): T => opcoes[Math.floor(sorteio() * opcoes.length)]
    let soltasConferidas = 0
    let mediuAlgumaVez = 0
    let toques = 0

    for (let rodada = 0; rodada < 3000; rodada += 1) {
      const detector = criarDetectorDeToqueDeAlt()
      const medidor = criarMedidorDoAlt()
      let agora = 0
      let x = 100
      let y = 100
      let botoes = 0
      let mediuNesteAlt = false

      for (let passo = 0; passo < 14; passo += 1) {
        agora += Math.floor(sorteio() * 260)
        const sorte = sorteio()
        if (sorte < 0.22) {
          const extra = escolher<Partial<TeclaDoAlt>>([{}, {}, {}, { repeat: true }, { ctrlKey: true }, { shiftKey: true }])
          detector.teclaDesceu(alt(agora, extra))
          medidor.teclaDesceu(alt(agora, extra))
        } else if (sorte < 0.42) {
          const medindoAntes = medidor.medindo(agora)
          const soltura = detector.teclaSubiu(alt(agora))
          medidor.teclaSubiu(alt(agora))
          if (soltura === null) {
            expect(medindoAntes).toBe(false)
          } else {
            soltasConferidas += 1
            if (soltura === 'toque') toques += 1
            // Medir na soltura ⟺ o detector diz 'segurado' (a mesma régua).
            expect(medindoAntes).toBe(soltura === 'segurado')
            // A medida apareceu em algum instante deste Alt: o endireitar não age nele.
            if (mediuNesteAlt) expect(soltura).not.toBe('toque')
          }
          mediuNesteAlt = false
          expect(medidor.medindo(agora + 10_000)).toBe(false)
        } else if (sorte < 0.5) {
          const outra = tecla(escolher(['ArrowLeft', 'z', 'Shift', 'AltGraph']), agora)
          if (sorteio() < 0.5) {
            detector.teclaDesceu(outra)
            medidor.teclaDesceu(outra)
          } else {
            detector.teclaSubiu(outra)
            medidor.teclaSubiu(outra)
          }
        } else if (sorte < 0.56) {
          botoes = 1
          detector.ponteiroDesceu()
          medidor.ponteiroDesceu()
        } else if (sorte < 0.62) {
          botoes = 0
          detector.ponteiroSubiu()
          medidor.ponteiroSubiu()
        } else if (sorte < 0.94) {
          x += Math.floor(sorteio() * 9) - 4
          y += Math.floor(sorteio() * 9) - 4
          detector.ponteiroMoveu(x, y, botoes)
          medidor.ponteiroMoveu(x, y, botoes)
        } else if (sorte < 0.97) {
          detector.interromper()
          medidor.interromper()
        } else {
          detector.zerar()
          medidor.zerar()
          botoes = 0
          mediuNesteAlt = false
        }
        if (medidor.medindo(agora)) {
          mediuNesteAlt = true
          mediuAlgumaVez += 1
        }
      }
    }

    // O sorteio cobriu os três desfechos: não é um teste que passa por não exercitar nada.
    expect(soltasConferidas).toBeGreaterThan(1000)
    expect(mediuAlgumaVez).toBeGreaterThan(200)
    expect(toques).toBeGreaterThan(100)
  })
})
