import { describe, expect, it } from 'vitest'
import {
  FIM_DA_REVELACAO,
  FIM_DO_TEXTO,
  ORCAMENTO,
  ROTEIRO,
  ROTEIRO_SEM_IMAGEM,
  estadoNoTempo,
  faixaDaCamera,
  faixaDoAmbiente,
  filaDeSons,
  letrasEm,
  molaComTrava,
  planejarDatilografia,
  planoDaRevelacao,
  type EventoDeSom,
} from './tempo'

/** Os dois textos do protótipo aprovado (curto e longo) e um longo demais para o teto de velocidade. */
const CURTO = 'Muralhas brancas brotam da selva como um dente de pedra. O brasão azul da Marinha ainda vigia a trilha.'
const LONGO =
  'Muralhas brancas brotam da selva como um dente de pedra, e o brasão azul da Marinha ainda vigia a trilha. ' +
  'Raízes e musgo tomaram a escadaria. No alto, o canhão aponta para o mar, e o portão está entreaberto. ' +
  'Quem sobe ouve o vento nas ameias e, lá dentro, um sino velho que ninguém toca há muitos e muitos anos.'
const ENORME = LONGO.repeat(6)

const teclas = (sons: readonly EventoDeSom[]) => sons.filter((s) => s.tipo === 'tecla' || s.tipo === 'espaco')

describe('orçamento da datilografia', () => {
  it.each([
    ['curto', CURTO],
    ['longo', LONGO],
    ['enorme', ENORME],
  ])('texto %s: a última letra cai até 4,25 s e as letras nunca voltam no tempo', (_nome, texto) => {
    const plano = planoDaRevelacao(texto, false)
    expect(plano.letras).toHaveLength(Array.from(texto).length)
    expect(plano.fimS).toBeLessThanOrEqual(FIM_DO_TEXTO + 1e-9)
    expect(plano.tempos[0]).toBeGreaterThanOrEqual(ROTEIRO.texto)
    for (let i = 1; i < plano.tempos.length; i++) expect(plano.tempos[i]).toBeGreaterThanOrEqual(plano.tempos[i - 1])
    // O sino e o retorno do carro fecham antes dos 5 s da regra.
    const ultimo = plano.sons[plano.sons.length - 1]
    expect(ultimo.tipo).toBe('retorno')
    expect(ultimo.t + 0.3).toBeLessThan(5)
  })

  it('texto curto nunca fica mais lento que a mão de verdade: só acaba antes', () => {
    const plano = planejarDatilografia('Um baú.', 1.2, FIM_DO_TEXTO)
    expect(plano.escala).toBe(ORCAMENTO.escalaMaxima)
    expect(plano.fimS).toBeLessThan(2)
    expect(plano.onda).toBeNull()
  })

  it('texto longo acelera e agrupa sons: nunca mais que ~22 teclas por segundo', () => {
    const plano = planoDaRevelacao(LONGO, false)
    expect(plano.escala).toBeLessThan(1)
    const sons = teclas(plano.sons)
    expect(sons.length).toBeLessThan(plano.letras.length)
    expect(sons.some((s) => s.n >= 2)).toBe(true)
    for (let i = 1; i < sons.length; i++) expect(sons[i].t - sons[i - 1].t).toBeGreaterThanOrEqual(ORCAMENTO.somMinS - 1e-9)
  })

  it('texto além do teto de velocidade: o resto chega numa onda no fim, sem som de tecla', () => {
    const plano = planoDaRevelacao(ENORME, false)
    expect(plano.escala).toBe(ORCAMENTO.escalaMinima)
    expect(plano.onda).not.toBeNull()
    const de = plano.onda?.de ?? plano.letras.length
    expect(plano.tempos[de]).toBeGreaterThan(FIM_DO_TEXTO - ORCAMENTO.ondaS - 0.05)
    expect(teclas(plano.sons).every((s) => s.i < de)).toBe(true)
  })

  it('emoji não parte ao meio: a letra é o ponto de código', () => {
    const plano = planoDaRevelacao('Ouro 🪙 no baú', true)
    expect(plano.letras).toContain('🪙')
    expect(plano.letras).toHaveLength(Array.from('Ouro 🪙 no baú').length)
  })

  it('texto vazio: nenhuma letra e nenhum sino', () => {
    const plano = planoDaRevelacao('', false)
    expect(plano.letras).toHaveLength(0)
    expect(plano.sons).toHaveLength(0)
  })

  it('mesmo texto, mesma cadência (a tela e as provas tocam igual)', () => {
    expect(Array.from(planoDaRevelacao(CURTO, false).tempos)).toEqual(Array.from(planoDaRevelacao(CURTO, false).tempos))
  })

  it('letrasEm conta as letras que já caíram', () => {
    const plano = planoDaRevelacao(CURTO, false)
    expect(letrasEm(plano, 0)).toBe(0)
    expect(letrasEm(plano, plano.tempos[4])).toBe(5)
    expect(letrasEm(plano, 10)).toBe(plano.letras.length)
  })
})

describe('mola com trava (a porta)', () => {
  it('sai do repouso, chega em 1 no fim da faixa e não passa de 1 (trava, sem quique)', () => {
    const faixa = ROTEIRO.porta
    expect(molaComTrava(faixa[0], faixa)).toBe(0)
    expect(molaComTrava(faixa[1], faixa)).toBe(1)
    let anterior = 0
    for (let t = faixa[0]; t <= faixa[1]; t += 0.01) {
      const v = molaComTrava(t, faixa)
      expect(v).toBeLessThanOrEqual(1)
      expect(v).toBeGreaterThanOrEqual(anterior)
      anterior = v
    }
  })

  it('bate no batente ainda andando (é isso que faz o "clunk" soar verdadeiro)', () => {
    const [, fim] = ROTEIRO.porta
    const velocidadeNoFim = (molaComTrava(fim - 0.001, ROTEIRO.porta) - molaComTrava(fim - 0.011, ROTEIRO.porta)) / 0.01
    expect(velocidadeNoFim).toBeGreaterThan(0.2)
  })

  it('a porta começa dobrada atrás da imagem e termina aberta', () => {
    expect(estadoNoTempo(0).angulo).toBe(ROTEIRO.anguloInicial)
    expect(estadoNoTempo(ROTEIRO.porta[1]).angulo).toBe(0)
  })
})

describe('roteiro', () => {
  it('a imagem entra no máximo da velocidade e assenta parada em 1 s', () => {
    const inicio = estadoNoTempo(0)
    expect(inicio.entrada).toBe(0)
    expect(inicio.velocidade).toBe(1)
    const assentado = estadoNoTempo(ROTEIRO.imagem[1])
    expect(assentado.entrada).toBe(1)
    expect(assentado.velocidade).toBe(0)
  })

  it('tudo parado até 4,6 s: entrada, porta e título assentados', () => {
    const fim = estadoNoTempo(FIM_DA_REVELACAO)
    expect(fim).toMatchObject({ entrada: 1, angulo: 0, titulo: 1, fundo: 1 })
  })

  it('sem imagem: o painel entra pela direita, sem porta, e o texto começa antes', () => {
    const meio = estadoNoTempo(0.3, { semImagem: true })
    expect(meio.entrada).toBeGreaterThan(0)
    expect(meio.entrada).toBeLessThan(1)
    expect(meio.angulo).toBe(0)
    expect(estadoNoTempo(ROTEIRO_SEM_IMAGEM.painel[1], { semImagem: true }).entrada).toBe(1)
    expect(planoDaRevelacao(CURTO, true).tempos[0]).toBeLessThan(planoDaRevelacao(CURTO, false).tempos[0])
    expect(filaDeSons(planoDaRevelacao(CURTO, true), { semImagem: true, temPainel: true }).some((s) => s.tipo === 'clunk')).toBe(false)
    expect(filaDeSons(planoDaRevelacao(CURTO, false), { semImagem: false, temPainel: true }).filter((s) => s.tipo === 'clunk')).toHaveLength(1)
  })

  it('com imagem e sem painel (pino longe, sem nome nem descrição): não há porta, a fila sai vazia', () => {
    expect(filaDeSons(planoDaRevelacao('', false), { semImagem: false, temPainel: false })).toEqual([])
  })

  it('movimento reduzido: sem deslocamento nem porta, texto inteiro e fades de até 0,3 s', () => {
    const plano = planoDaRevelacao(LONGO, false)
    const comeco = estadoNoTempo(0, { reduzir: true, plano })
    expect(comeco).toMatchObject({ entrada: 1, angulo: 0, letras: plano.letras.length, imagemOpac: 0, painelOpac: 0 })
    expect(estadoNoTempo(0.3, { reduzir: true, plano })).toMatchObject({ imagemOpac: 1, painelOpac: 1, fundo: 1 })
  })
})

describe('câmera dentro da moldura', () => {
  it('na duração padrão de 5 s anda de 0,1 a 4,5 s e o ambiente assenta de 3,7 a 4,6 s (o protótipo)', () => {
    expect(faixaDaCamera(5)).toEqual([0.1, 4.5])
    const [de, ate] = faixaDoAmbiente(5)
    expect(de).toBeCloseTo(3.7, 9)
    expect(ate).toBeCloseTo(4.6, 9)
  })

  it('duração maior: a câmera continua andando depois que o texto acabou', () => {
    expect(faixaDaCamera(12)[1]).toBeGreaterThan(FIM_DO_TEXTO)
  })

  it('duração mínima (3 s): as faixas continuam em ordem', () => {
    const [c0, c1] = faixaDaCamera(3)
    const [a0, a1] = faixaDoAmbiente(3)
    expect(c0).toBeLessThan(c1)
    expect(a0).toBeLessThan(a1)
    expect(a1).toBeLessThan(3)
  })
})
