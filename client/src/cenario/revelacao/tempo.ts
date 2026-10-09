/**
 * TEMPO DA REVELAÇÃO DO LOCAL — a parte pura (sem DOM, sem som): curvas, o
 * roteiro da moldura com dobradiça, o orçamento da datilografia e o plano de
 * sons. A tela desenha a partir daqui, e os testes amostram as mesmas funções.
 * Porte do protótipo v3 aprovado pelo usuário em 09/10/2026.
 *
 * Regra do usuário (09/10/2026): animação de ambiente dura 4-5 s. A abertura
 * (imagem, porta e título) assenta em ~1,2 s; a última letra cai até 4,25 s;
 * tudo para em 4,6 s. A câmera dentro da moldura segue a duração que o mestre
 * escolheu no pino (padrão 5 s): com duração maior só ela continua andando.
 */

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

/** Intervalo em segundos desde o começo da revelação. */
export type Faixa = readonly [number, number]

/** Fração (0 a 1) já percorrida de `faixa` no instante `t`. */
export function progresso(t: number, [a, b]: Faixa): number {
  return clamp01((t - a) / (b - a))
}

/** cubic-bezier igual ao do CSS (Newton e, se falhar, bissecção). */
export function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const curvaX = (t: number) => ((ax * t + bx) * t + cx) * t
  const curvaY = (t: number) => ((ay * t + by) * t + cy) * t
  const derivadaX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  function tDeX(x: number): number {
    let t = x
    for (let i = 0; i < 8; i++) {
      const erro = curvaX(t) - x
      if (Math.abs(erro) < 1e-7) return t
      const d = derivadaX(t)
      if (Math.abs(d) < 1e-7) break
      t -= erro / d
    }
    let baixo = 0
    let alto = 1
    t = x
    while (alto - baixo > 1e-7) {
      if (curvaX(t) < x) baixo = t
      else alto = t
      t = (baixo + alto) / 2
    }
    return t
  }
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : curvaY(tDeX(x)))
}

/** Velocidade de uma curva em relação à velocidade com que ela começa (1 no começo, 0 parada). */
function velocidadeRelativa(f: (x: number) => number): (u: number) => number {
  const h = 1e-4
  const inicial = (f(h) - f(0)) / h
  return (u) => {
    if (u <= 0) return 1
    if (u >= 1) return 0
    return clamp01((f(Math.min(1, u + h)) - f(Math.max(0, u - h))) / (2 * h) / inicial)
  }
}

const ENTRADA = bezier(0.33, 1, 0.68, 1)

export const CURVAS = {
  /**
   * easeOutCubic (easings.net): a imagem já entra no máximo da velocidade
   * (ainda fora da tela) e daí só desacelera; nunca acelera na frente do
   * jogador nem fica rastejando no fim.
   */
  entrada: { css: 'cubic-bezier(0.33, 1, 0.68, 1)', f: ENTRADA, vel: velocidadeRelativa(ENTRADA) },
  /** Ease-out forte: o que só aparece (título, véu do fundo). */
  saida: { css: 'cubic-bezier(0.23, 1, 0.32, 1)', f: bezier(0.23, 1, 0.32, 1) },
  /** easeInOutSine (easings.net): névoa, partículas e balanço assentam sem tranco. */
  onda: { css: 'cubic-bezier(0.37, 0, 0.63, 1)', f: bezier(0.37, 0, 0.63, 1) },
}

/** A grua da panorâmica: começa devagar, acelera no meio e assenta. */
export function grua(x: number): number {
  const u = clamp01(x)
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}

/**
 * Mola criticamente amortecida que sai do repouso mirando 5% além do fim de
 * curso; a trava a segura em 1. Chega com ~11% da velocidade de pico (é isso
 * que faz o "clunk" soar verdadeiro) e para ali, sem quique.
 */
const ALVO_DA_MOLA = 1.05
const X_DA_TRAVA = (() => {
  const alvo = 1 - 1 / ALVO_DA_MOLA // (1 + x)·e^-x = alvo
  let x = 4
  for (let i = 0; i < 40; i++) x -= ((1 + x) * Math.exp(-x) - alvo) / (-x * Math.exp(-x))
  return x
})()

export function molaComTrava(t: number, [inicio, fim]: Faixa): number {
  if (t <= inicio) return 0
  if (t >= fim) return 1
  const x = (X_DA_TRAVA / (fim - inicio)) * (t - inicio)
  return Math.min(1, ALVO_DA_MOLA * (1 - (1 + x) * Math.exp(-x)))
}

// ---- linha do tempo comum (segundos desde o começo)

/** A tela escurece por cima do mapa. */
export const FUNDO: Faixa = [0, 0.3]
/** Última letra; o sino e o retorno do carro fecham até ~4,75 s. */
export const FIM_DO_TEXTO = 4.25
/** Tudo parado daqui em diante (só espera o jogador fechar). */
export const FIM_DA_REVELACAO = 4.6
/** "Pular" vira "Fechar" quando tudo parou. */
export const FECHAR_EM_S = FIM_DA_REVELACAO + 0.2
/** Depois disso nada da moldura e do painel muda: o relógio dorme. */
export const PARA_O_RELOGIO_S = 5.4
/** O cursor sai logo depois da última letra (com 180 ms de fade, antes dos 4,6 s). */
export const CURSOR_SOME_DEPOIS_S = 0.12
/** Movimento reduzido: só fades curtos, tudo já no lugar. */
export const REDUZIDO: { readonly imagem: Faixa; readonly painel: Faixa } = { imagem: [0, 0.2], painel: [0.1, 0.3] }

/**
 * A câmera dentro da moldura anda junto com a entrada e assenta meio segundo
 * antes da duração do pino (5 s → 0,1 a 4,5 s, igual ao protótipo).
 */
export function faixaDaCamera(duracaoS: number): Faixa {
  return [0.1, Math.max(0.6, duracaoS - 0.5)]
}

/** Partículas, névoa e balanço param antes do fim da duração (5 s → 3,7 a 4,6 s). */
export function faixaDoAmbiente(duracaoS: number): Faixa {
  const fim = Math.max(0.6, duracaoS - 0.4)
  return [Math.max(0.1, fim - 0.9), fim]
}

interface RoteiroComImagem {
  /** easeOutCubic: entra no máximo da velocidade e só desacelera. */
  readonly imagem: Faixa
  /** No celular a porta não pode abrir com a imagem ainda fora da borda direita. */
  readonly imagemCelular: Faixa
  /** Começa com a imagem ainda deslizando; mola com trava. */
  readonly porta: Faixa
  /** Graus: dobrada atrás da imagem (só aparece abaixo de 90°). */
  readonly anguloInicial: number
  readonly titulo: Faixa
  /** Primeira letra pode cair a partir daqui. */
  readonly texto: number
  /** Vão entre a borda da moldura e o postigo: é onde ficam os canos da dobradiça. */
  readonly gap: number
  readonly gapCelular: number
}

/** O roteiro com imagem: a moldura de madeira e metal + o postigo na dobradiça. */
export const ROTEIRO: RoteiroComImagem = {
  imagem: [0, 1.0],
  imagemCelular: [0, 0.75],
  porta: [0.45, 1.15],
  anguloInicial: 100,
  titulo: [0.98, 1.26],
  texto: 1.2,
  gap: 10,
  gapCelular: 8,
}

interface RoteiroSemImagem {
  readonly painel: Faixa
  readonly painelCelular: Faixa
  readonly titulo: Faixa
  readonly texto: number
}

/**
 * O roteiro SEM imagem: o painel chega sozinho pela direita, com a mesma curva
 * e o mesmo desfoque da imagem. Sem moldura de imagem não há onde pendurar a
 * dobradiça (porta girando no ar parece defeito), e entrar pela direita mantém
 * o "o local chega pela direita" dos pinos com imagem. Mais curto: o texto
 * começa antes e ganha mais tempo dentro do mesmo orçamento.
 */
export const ROTEIRO_SEM_IMAGEM: RoteiroSemImagem = {
  painel: [0, 0.8],
  painelCelular: [0, 0.65],
  titulo: [0.5, 0.78],
  texto: 0.75,
}

export interface EstadoDaRevelacao {
  t: number
  /** Opacidade do véu escuro (0 a 1). */
  fundo: number
  /** Quanto do percurso de entrada já foi feito (imagem, ou o painel sem imagem). */
  entrada: number
  /** Velocidade da entrada em relação à do começo (0 a 1): vira desfoque de movimento. */
  velocidade: number
  imagemOpac: number
  painelOpac: number
  /** Graus da porta (0 = aberta, encostada no batente). */
  angulo: number
  /** Título: 0 escondido, 1 no lugar. */
  titulo: number
  /** Quantas letras da descrição já caíram. */
  letras: number
}

export interface OpcoesDoEstado {
  reduzir?: boolean
  plano?: PlanoDeDatilografia | null
  /** Celular: painel embaixo da imagem e entrada mais curta. */
  coluna?: boolean
  semImagem?: boolean
}

/** O estado da revelação no instante `t`, em frações e graus; quem desenha converte em px. */
export function estadoNoTempo(t: number, { reduzir = false, plano = null, coluna = false, semImagem = false }: OpcoesDoEstado = {}): EstadoDaRevelacao {
  const e: EstadoDaRevelacao = {
    t,
    fundo: CURVAS.saida.f(progresso(t, FUNDO)),
    entrada: 1,
    velocidade: 0,
    imagemOpac: 1,
    painelOpac: 1,
    angulo: 0,
    titulo: 1,
    letras: plano ? letrasEm(plano, t) : 0,
  }
  if (reduzir) {
    // Só fades curtos: sem 3D, sem desfoque, sem deslocamento; o texto aparece inteiro.
    e.fundo = CURVAS.saida.f(progresso(t, REDUZIDO.imagem))
    e.imagemOpac = CURVAS.saida.f(progresso(t, REDUZIDO.imagem))
    e.painelOpac = CURVAS.saida.f(progresso(t, semImagem ? REDUZIDO.imagem : REDUZIDO.painel))
    e.letras = plano ? plano.letras.length : 0
    return e
  }
  if (semImagem) {
    const faixa = coluna ? ROTEIRO_SEM_IMAGEM.painelCelular : ROTEIRO_SEM_IMAGEM.painel
    const u = progresso(t, faixa)
    e.entrada = CURVAS.entrada.f(u)
    e.velocidade = t < faixa[0] ? 1 : CURVAS.entrada.vel(u)
    e.titulo = CURVAS.saida.f(progresso(t, ROTEIRO_SEM_IMAGEM.titulo))
    return e
  }
  const faixa = coluna ? ROTEIRO.imagemCelular : ROTEIRO.imagem
  const u = progresso(t, faixa)
  e.entrada = CURVAS.entrada.f(u)
  e.velocidade = t < faixa[0] ? 1 : CURVAS.entrada.vel(u)
  e.angulo = ROTEIRO.anguloInicial * (1 - molaComTrava(t, ROTEIRO.porta))
  e.titulo = CURVAS.saida.f(progresso(t, ROTEIRO.titulo))
  return e
}

// ---- datilografia com orçamento de tempo fixo

/** Gerador previsível (mulberry32): a tela e os testes tocam a mesma cadência. */
export function mulberry32(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A mão de verdade: é a proporção entre tecla, palavra, vírgula e ponto que se mantém. */
export const CADENCIA: Readonly<Record<'base' | 'inicioDePalavra' | 'virgula' | 'doisPontos' | 'ponto' | 'maiuscula' | 'acento', number> & { variacao: Faixa }> = {
  base: 0.046,
  variacao: [0.68, 1.3],
  inicioDePalavra: 0.03,
  virgula: 0.19,
  doisPontos: 0.24,
  ponto: 0.42,
  maiuscula: 0.05,
  acento: 0.035,
}

export const ORCAMENTO = {
  /** Teto de velocidade: tecla-base de ~7 ms (~145 letras/s fora das pausas). */
  escalaMinima: 0.15,
  /** Texto curto nunca fica mais lento que a mão de verdade (só acaba antes). */
  escalaMaxima: 1,
  /** Texto além do teto: o resto chega numa onda rápida, sem som de tecla. */
  ondaS: 0.3,
  /** No máximo ~22 sons de tecla por segundo; o que vier mais rápido vira rajada. */
  somMinS: 0.045,
  /** Abaixo dessa escala o "shift" não soa (seria ruído). */
  maiusculaAte: 0.4,
  dingDepois: 0.08,
  retornoDepois: 0.16,
}

/** A semente da cadência: a mesma em toda tela, para o mesmo texto soar igual. */
export const SEMENTE = 20261009

export type TipoDeSom = 'tecla' | 'espaco' | 'maiuscula' | 'ding' | 'retorno' | 'clunk'

export interface EventoDeSom {
  /** Segundos desde o começo da revelação. */
  t: number
  tipo: TipoDeSom
  forca: number
  /** Índice da letra; -1 = som do mecanismo (a porta). */
  i: number
  /** Quantas letras caíram juntas neste som (2+ = rajada). */
  n: number
}

export interface PlanoDeDatilografia {
  /** O texto em letras (pontos de código: emoji não parte ao meio). */
  letras: readonly string[]
  /** Instante (s) em que cada letra cai. */
  tempos: Float64Array
  sons: EventoDeSom[]
  inicioS: number
  fimS: number
  escala: number
  escalaPedida: number
  naturalS: number
  /** Letras que chegam juntas numa onda no fim (texto longo demais para o teto). */
  onda: { de: number; letras: number } | null
  letrasPorSegundo: number
  sonsPorSegundo: number
}

const MAIUSCULA = /[A-ZÀ-Ý]/
const ACENTUADA = /[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/
const PONTUACAO_FORTE = /[.,:;]/

/**
 * Quando cada letra cai e quais sons tocam, cabendo entre `inicioS` e `fimS`.
 * Todas as pausas são escaladas pelo mesmo fator (o ritmo relativo fica);
 * abaixo do teto de velocidade, a parte que não cabe chega numa onda no fim.
 */
export function planejarDatilografia(texto: string, inicioS: number, fimS: number, semente: number = SEMENTE): PlanoDeDatilografia {
  const c = CADENCIA
  const rnd = mulberry32(semente)
  const letras = Array.from(texto)
  const n = letras.length
  const natural = new Float64Array(n)
  const forca = new Float64Array(n)
  let soma = 0
  for (let i = 0; i < n; i++) {
    const letra = letras[i]
    const antes = i > 0 ? letras[i - 1] : ''
    if (i > 0) {
      let dt = c.base * (c.variacao[0] + rnd() * (c.variacao[1] - c.variacao[0]))
      if (antes === ' ') dt += c.inicioDePalavra
      if (antes === ',' || antes === ';') dt += c.virgula
      if (antes === ':') dt += c.doisPontos
      if (antes === '.' || antes === '!' || antes === '?') dt += c.ponto
      if (MAIUSCULA.test(letra)) dt += c.maiuscula
      if (ACENTUADA.test(letra)) dt += c.acento
      natural[i] = dt
      soma += dt
    }
    forca[i] = 0.86 + rnd() * 0.26
  }
  const orcamento = fimS - inicioS
  const escalaPedida = soma > 0 ? orcamento / soma : 1
  const escala = Math.min(ORCAMENTO.escalaMaxima, Math.max(ORCAMENTO.escalaMinima, escalaPedida))
  const tempos = new Float64Array(n)
  let t = inicioS
  let corte = n // letras a partir daqui entram na onda
  for (let i = 0; i < n; i++) {
    t += natural[i] * escala
    if (escalaPedida < ORCAMENTO.escalaMinima && t > fimS - ORCAMENTO.ondaS) {
      corte = i
      break
    }
    tempos[i] = t
  }
  if (corte < n) {
    const de = corte > 0 ? tempos[corte - 1] : inicioS
    for (let i = corte; i < n; i++) tempos[i] = de + ((fimS - de) * (i - corte + 1)) / (n - corte)
  }
  const fim = n > 0 ? tempos[n - 1] : inicioS

  // Sons: no máximo um a cada somMinS; teclas que caem antes juntam-se numa rajada.
  const ganho = Math.min(1, Math.max(0.55, Math.sqrt(escala / 0.45)))
  const sons: EventoDeSom[] = []
  let ultimo = -Infinity
  let juntas = 0
  for (let i = 0; i < corte; i++) {
    juntas++
    if (tempos[i] - ultimo < ORCAMENTO.somMinS) continue
    const letra = letras[i]
    if (escala >= ORCAMENTO.maiusculaAte && MAIUSCULA.test(letra) && i > 0) sons.push({ t: tempos[i] - 0.03, tipo: 'maiuscula', forca: ganho, i, n: 1 })
    const tipo: TipoDeSom = letra === ' ' ? 'espaco' : 'tecla'
    sons.push({ t: tempos[i], tipo, forca: forca[i] * ganho * (PONTUACAO_FORTE.test(letra) ? 1.08 : 1), i, n: juntas })
    ultimo = tempos[i]
    juntas = 0
  }
  // Sem letra nenhuma não há linha para fechar: nada de sino nem de carro voltando.
  if (n > 0) {
    sons.push({ t: fim + ORCAMENTO.dingDepois, tipo: 'ding', forca: 1, i: n, n: 1 })
    sons.push({ t: fim + ORCAMENTO.retornoDepois, tipo: 'retorno', forca: 1, i: n, n: 1 })
  }
  sons.sort((a, b) => a.t - b.t)
  const teclas = sons.filter((s) => s.tipo === 'tecla' || s.tipo === 'espaco').length
  return {
    letras,
    tempos,
    sons,
    inicioS,
    fimS: fim,
    escala,
    escalaPedida,
    naturalS: soma,
    onda: corte < n ? { de: corte, letras: n - corte } : null,
    letrasPorSegundo: n > 1 ? (n - 1) / Math.max(1e-6, fim - inicioS) : 0,
    sonsPorSegundo: teclas / Math.max(1e-6, fim - inicioS),
  }
}

/** O plano da descrição de um pino: começa quando o painel termina de abrir e acaba até 4,25 s. */
export function planoDaRevelacao(descricao: string, semImagem: boolean): PlanoDeDatilografia {
  return planejarDatilografia(descricao, semImagem ? ROTEIRO_SEM_IMAGEM.texto : ROTEIRO.texto, FIM_DO_TEXTO, SEMENTE)
}

/** Quantas letras já caíram no instante `t` (busca binária nos tempos). */
export function letrasEm(plano: PlanoDeDatilografia, t: number): number {
  const v = plano.tempos
  let baixo = 0
  let alto = v.length
  while (baixo < alto) {
    const meio = (baixo + alto) >> 1
    if (v[meio] <= t) baixo = meio + 1
    else alto = meio
  }
  return baixo
}

/** O som do mecanismo: a porta bate no batente quando a trava a segura. Sem porta, silêncio. */
export function sonsDoMecanismo(comPorta: boolean): EventoDeSom[] {
  return comPorta ? [{ t: ROTEIRO.porta[1], tipo: 'clunk', forca: 1, i: -1, n: 1 }] : []
}

/** O que está na tela: a porta só existe com a imagem (onde se prender) e com o painel (que é a porta). */
export interface PecasEmCena {
  semImagem: boolean
  temPainel: boolean
}

/** Teclas e mecanismo numa fila só, na ordem em que tocam. */
export function filaDeSons(plano: PlanoDeDatilografia, { semImagem, temPainel }: PecasEmCena): EventoDeSom[] {
  return plano.sons.concat(sonsDoMecanismo(!semImagem && temPainel)).sort((a, b) => a.t - b.t)
}
