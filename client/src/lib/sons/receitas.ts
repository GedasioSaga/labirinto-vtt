/**
 * RECEITAS DOS SONS DE CLIMA (pedido: "sons baixos para dar imersão, tipo
 * Resident Evil"). Dado puro: cada som é uma lista de vozes, e cada voz é um
 * oscilador ou um trecho de ruído, com filtro e envelope. Clima de survival
 * horror: graves, abafados e curtos; nenhum som passa de 1,2 s.
 *
 * Os níveis foram equilibrados medindo no Web Audio real (Chrome), também na
 * banda de alto-falante de celular (acima de ~300 Hz): o grave puro some no
 * celular, então todo baque leva uma batida de madeira audível lá.
 *
 * Quem toca é `tocarSom(id)` (`tocarSom.ts`). Trocar um som por gravação CC0
 * depois muda só como aquele id é produzido, nunca quem chama.
 */

export type SomId = 'item' | 'passagem' | 'portaAbre' | 'portaFecha' | 'trancada' | 'dado' | 'aviso'

export interface FiltroDaVoz {
  tipo: 'lowpass' | 'highpass' | 'bandpass'
  hz: number
  /**
   * No passa-banda é a largura (Q de verdade: banda = hz / q). No passa-baixa
   * e no passa-alta é a ressonância em dB, como no Web Audio. Ausente = o
   * padrão do navegador.
   */
  q?: number
}

interface VozBase {
  /** Segundos desde o disparo do som. */
  inicio: number
  /** Subida do silêncio ao pico, em segundos. */
  ataque: number
  /** Segundos parado no pico antes de cair. Ausente = percussivo: cai logo depois do ataque. */
  sustentar?: number
  /** Do início da voz até ela voltar ao silêncio, em segundos (ataque incluído). */
  duracao: number
  /** Ganho no pico, antes do volume da mesa. */
  pico: number
  filtro?: FiltroDaVoz
}

export interface VozOscilador extends VozBase {
  fonte: 'osc'
  forma: 'sine' | 'triangle' | 'sawtooth' | 'square'
  hzIni: number
  /** Glissando exponencial até aqui, ao longo da voz. Ausente = altura parada. */
  hzFim?: number
  /** Tremor da altura: `hz` vezes por segundo, `profundidade` Hz para cima e para baixo. */
  vibrato?: { hz: number; profundidade: number }
}

export interface VozRuido extends VozBase {
  fonte: 'ruido'
}

export type Voz = VozOscilador | VozRuido

/** Sol 3 e a quinta acima (Ré 4): sino grave, que não copia nenhum jingle. */
const SOL_3 = 196
const RE_4 = 293.66

/**
 * Parciais de sino: razão da altura, peso no pico e fração da duração em que
 * cada um soa. O agudo morre antes, como no metal; o 2.76 e o 5.4 desafinados
 * de propósito são o que faz soar sino e não órgão. O 2.0 forte leva a nota
 * ao alto-falante de celular, que quase não toca o Sol 3.
 */
const PARCIAIS_DO_SINO = [
  { razao: 1, peso: 1, vida: 1 },
  { razao: 2, peso: 0.6, vida: 0.75 },
  { razao: 2.76, peso: 0.3, vida: 0.5 },
  { razao: 5.4, peso: 0.12, vida: 0.3 },
]

function notaDeSino(hz: number, inicio: number, duracao: number, pico: number): VozOscilador[] {
  return PARCIAIS_DO_SINO.map(
    ({ razao, peso, vida }): VozOscilador => ({
      fonte: 'osc',
      forma: 'sine',
      hzIni: hz * razao,
      inicio,
      ataque: 0.005,
      duracao: duracao * vida,
      pico: pico * peso,
    }),
  )
}

/**
 * Um quique do dado na mesa: o estalo do plástico (ruído) e o "toc" da
 * madeira, que cai um pouco de altura. Cada quique bate num ponto diferente,
 * por isso cada um tem a sua altura.
 */
function quiqueDeDado(inicio: number, pico: number, hz: number): Voz[] {
  return [
    { fonte: 'ruido', inicio, ataque: 0.002, duracao: 0.03, pico, filtro: { tipo: 'bandpass', hz: 2500, q: 1.2 } },
    { fonte: 'osc', forma: 'sine', hzIni: hz, hzFim: hz * 0.85, inicio, ataque: 0.002, duracao: 0.04, pico: pico * 0.75 },
  ]
}

/**
 * Maçaneta forçada contra a porta trancada: a lingueta estala e tilinta no
 * batente (ruído + dois parciais de metal) e a porta dá um baque curto.
 */
function chacoalhada(inicio: number, pico: number): Voz[] {
  return [
    { fonte: 'ruido', inicio, ataque: 0.002, duracao: 0.05, pico, filtro: { tipo: 'bandpass', hz: 2200, q: 1.5 } },
    { fonte: 'osc', forma: 'sine', hzIni: 1650, inicio, ataque: 0.002, duracao: 0.06, pico: pico * 0.35 },
    { fonte: 'osc', forma: 'sine', hzIni: 2380, inicio, ataque: 0.002, duracao: 0.045, pico: pico * 0.25 },
    { fonte: 'osc', forma: 'sine', hzIni: 260, hzFim: 180, inicio, ataque: 0.003, duracao: 0.07, pico: pico * 0.5 },
  ]
}

export const RECEITAS: Record<SomId, readonly Voz[]> = {
  // Item obtido: sino de duas notas subindo uma quinta.
  item: [...notaDeSino(SOL_3, 0, 0.85, 0.14), ...notaDeSino(RE_4, 0.1, 1, 0.14)],

  // Passagem / troca de cena: a porta pesada range e bate atrás de você.
  passagem: [
    // Rangido: serra grave raspando em duas ressonâncias da madeira, com a altura tremendo.
    {
      fonte: 'osc',
      forma: 'sawtooth',
      hzIni: 105,
      hzFim: 72,
      vibrato: { hz: 13, profundidade: 9 },
      inicio: 0,
      ataque: 0.07,
      sustentar: 0.22,
      duracao: 0.5,
      pico: 0.35,
      filtro: { tipo: 'bandpass', hz: 750, q: 1.2 },
    },
    {
      fonte: 'osc',
      forma: 'sawtooth',
      hzIni: 108,
      hzFim: 74,
      vibrato: { hz: 8, profundidade: 6 },
      inicio: 0.02,
      ataque: 0.07,
      sustentar: 0.2,
      duracao: 0.46,
      pico: 0.3,
      filtro: { tipo: 'bandpass', hz: 1400, q: 2 },
    },
    // Baque: o corpo da porta caindo de altura (grave) e a batida da madeira (o que o celular toca).
    { fonte: 'osc', forma: 'sine', hzIni: 110, hzFim: 50, inicio: 0.5, ataque: 0.005, duracao: 0.3, pico: 0.22 },
    { fonte: 'ruido', inicio: 0.5, ataque: 0.003, duracao: 0.16, pico: 0.28, filtro: { tipo: 'lowpass', hz: 900 } },
    { fonte: 'osc', forma: 'sine', hzIni: 330, hzFim: 250, inicio: 0.5, ataque: 0.003, duracao: 0.1, pico: 0.14 },
  ],

  // Porta abrindo: o trinco solta e a dobradiça range curto.
  portaAbre: [
    { fonte: 'ruido', inicio: 0, ataque: 0.002, duracao: 0.035, pico: 0.35, filtro: { tipo: 'highpass', hz: 1800 } },
    {
      fonte: 'osc',
      forma: 'sawtooth',
      hzIni: 240,
      hzFim: 170,
      vibrato: { hz: 14, profundidade: 10 },
      inicio: 0.04,
      ataque: 0.05,
      sustentar: 0.12,
      duracao: 0.34,
      pico: 0.35,
      filtro: { tipo: 'bandpass', hz: 1000, q: 1.8 },
    },
    {
      fonte: 'osc',
      forma: 'sawtooth',
      hzIni: 243,
      hzFim: 172,
      vibrato: { hz: 9, profundidade: 7 },
      inicio: 0.05,
      ataque: 0.05,
      sustentar: 0.1,
      duracao: 0.3,
      pico: 0.22,
      filtro: { tipo: 'bandpass', hz: 1900, q: 3 },
    },
  ],

  // Porta fechando: baque surdo da madeira e o trinco encaixando.
  portaFecha: [
    { fonte: 'osc', forma: 'sine', hzIni: 120, hzFim: 55, inicio: 0, ataque: 0.004, duracao: 0.22, pico: 0.22 },
    { fonte: 'ruido', inicio: 0, ataque: 0.002, duracao: 0.14, pico: 0.35, filtro: { tipo: 'lowpass', hz: 800 } },
    { fonte: 'osc', forma: 'sine', hzIni: 380, hzFim: 300, inicio: 0, ataque: 0.003, duracao: 0.08, pico: 0.2 },
    { fonte: 'ruido', inicio: 0.05, ataque: 0.002, duracao: 0.035, pico: 0.3, filtro: { tipo: 'highpass', hz: 2000 } },
  ],

  // Porta trancada: a maçaneta chacoalha duas vezes e não abre.
  trancada: [...chacoalhada(0, 0.35), ...chacoalhada(0.1, 0.28)],

  // Dado: quatro quiques perdendo força.
  dado: [
    ...quiqueDeDado(0, 0.35, 1250),
    ...quiqueDeDado(0.07, 0.27, 1100),
    ...quiqueDeDado(0.15, 0.2, 1350),
    ...quiqueDeDado(0.26, 0.14, 1180),
  ],

  // Aviso do mestre: ferroada grave de suspense, duas notas quase iguais batendo entre si.
  aviso: [
    { fonte: 'osc', forma: 'sawtooth', hzIni: 110, inicio: 0, ataque: 0.15, sustentar: 0.3, duracao: 1.1, pico: 0.14, filtro: { tipo: 'lowpass', hz: 700 } },
    { fonte: 'osc', forma: 'sawtooth', hzIni: 116.5, inicio: 0, ataque: 0.15, sustentar: 0.3, duracao: 1.1, pico: 0.14, filtro: { tipo: 'lowpass', hz: 700 } },
    { fonte: 'osc', forma: 'sine', hzIni: 55, inicio: 0, ataque: 0.15, sustentar: 0.3, duracao: 1.05, pico: 0.08 },
  ],
}
