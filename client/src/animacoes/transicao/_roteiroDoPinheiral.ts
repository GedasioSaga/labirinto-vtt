import { clamp01, easeInOutSine, easeOutCubic, span } from '../../transicoes/curvas'

/*
 * TRILHA DO PINHEIRAL: roteiro (segundos da cena), o mesmo no dia e nas chamas.
 *
 * Primeira pessoa, como o Campo ensolarado e as escadas: a câmera é os olhos
 * de quem anda, e o corpo não aparece. Anda pela trilha de terra rumo à boca
 * escura do pinheiral, que cresce à frente; freia a poucos metros da borda,
 * para e ergue o olhar para as copas (à direita, de onde vem o grito do corvo
 * no dia); as copas tomam o quadro e o escuro fecha a tela (o `fade` devolvido
 * ao motor, que sempre fecha em preto).
 */

export type VarianteDaTrilha = 'dia' | 'chamas'

export const DURACAO = 7
export const FADE_ENTRADA = 0.5
export const INICIO_DO_ESCURO = 5.8
export const FIM_DO_ESCURO = 6.85

// ---------------------------------------------------------------------------
// Passo: o do Campo ensolarado, passeio sem pressa na terra solta
// ---------------------------------------------------------------------------

/** Metros por segundo e passos por segundo: passada de 72,5 cm. */
export const VELOCIDADE = 1.45
export const CADENCIA = 2
const PASSADA = VELOCIDADE / CADENCIA
const INICIO_DA_FREADA = 4
export const PARADA = 4.6
/** O último pé assenta no meio da freada: o corpo ainda escorrega um palmo e para. */
const ULTIMO_PASSO = 4.35
const OLHO = 1.62
const BALANCO_VERTICAL = 0.018
const BALANCO_LATERAL = 0.012
const ROLAGEM = 0.005

// ---------------------------------------------------------------------------
// Olhar
// ---------------------------------------------------------------------------

/** Andando, os olhos ficam na mata à frente, um pouco acima do horizonte. */
const INCLINACAO_ANDANDO = 0.09
/** Parado, o olhar sobe até as copas, que passam a tomar o quadro. */
const INCLINACAO_FINAL = 0.5
/** E puxa um pouco para a direita (o corvo grita à direita aos 4,45 s). */
const GUINADA_FINAL = -0.1
/** Começa um tico antes de o corpo assentar: sem pausa morta entre parar e olhar. */
const INICIO_DO_OLHAR = 4.45
const FIM_DO_OLHAR = 5.65
/** Depois do olhar, os olhos ainda sobem devagar enquanto escurece: o quadro não congela. */
const DERIVA_DO_OLHAR = 0.05
/** Reduzir movimento: o olhar sobe menos e mais devagar, sem balanço de passo nem deriva. */
const FIM_DO_OLHAR_REDUZIDO = 6
const AMPLITUDE_DO_OLHAR_REDUZIDO = 0.6

// ---------------------------------------------------------------------------
// Lugar
// ---------------------------------------------------------------------------

/** z da primeira fileira do pinheiral (quem anda vai para -z). */
export const BORDA_DA_MATA = -22
/** Onde os olhos param: ~8,4 m da primeira fileira e a 4 m ou mais das sentinelas, longe o bastante para as copas (e o fogo nelas) caberem no olhar. */
export const Z_DA_PARADA = -13.6
/** O ponto da trilha que os olhos miram andando: a boca escura do corredor na mata. */
export const BOCA_DA_TRILHA = -24

/** Centro da trilha em x para cada z: uma curva mansa que entra na mata. */
export function trilhaX(z: number): number {
  return 0.9 * Math.sin(z * 0.11 + 0.4) - 0.35
}

/** Metros andados desde o início: velocidade cheia até a freada, que cai sem tranco. */
export function andadoEm(t: number): number {
  if (t <= INICIO_DA_FREADA) return VELOCIDADE * Math.max(0, t)
  const s = span(t, INICIO_DA_FREADA, PARADA)
  // Integral de 1 - smoothstep: a velocidade cai sem tranco no começo nem no fim da freada.
  return VELOCIDADE * (INICIO_DA_FREADA + (PARADA - INICIO_DA_FREADA) * (s - s ** 3 + s ** 4 / 2))
}

/** Velocidade relativa (1 andando, 0 parado). */
function ritmoEm(t: number): number {
  const s = span(t, INICIO_DA_FREADA, PARADA)
  return 1 - s * s * (3 - 2 * s)
}

const Z_INICIAL = Z_DA_PARADA + andadoEm(PARADA)

/** Fase contínua do passo: cada inteiro é um pé assentando (presa à distância, os passos encurtam na freada). */
const FASE_INICIAL = Math.ceil(andadoEm(ULTIMO_PASSO) / PASSADA) - andadoEm(ULTIMO_PASSO) / PASSADA
export function faseEm(t: number): number {
  return andadoEm(t) / PASSADA + FASE_INICIAL
}

/** Quantos pés já assentaram: sobe 1 a cada contato, no vale do balanço. */
export function passoEm(t: number): number {
  return Math.floor(faseEm(t))
}

/** Último pé que assenta (o da freada). */
export const PASSOS = Math.floor(faseEm(PARADA))

export function fadeEm(t: number): number {
  if (t < FADE_ENTRADA) return 1 - easeOutCubic(clamp01(t / FADE_ENTRADA))
  return easeInOutSine(span(t, INICIO_DO_ESCURO, FIM_DO_ESCURO))
}

export interface EstadoDaTrilha {
  x: number
  y: number
  z: number
  rolagem: number
  inclinacao: number
  guinada: number
  /** 0 a 1: quanto do erguer do olhar já foi. */
  olhar: number
}

/** Tudo o que os olhos fazem no instante `t`. Puro: depende só de t. */
export function estadoDaTrilha(t: number, reduzirMovimento: boolean): EstadoDaTrilha {
  const fase = faseEm(t)
  const passo = reduzirMovimento ? 0 : ritmoEm(t)
  const lado = Math.sin(Math.PI * fase)
  const z = Z_INICIAL - andadoEm(t)
  const xDaTrilha = trilhaX(z)
  const fimDoOlhar = reduzirMovimento ? FIM_DO_OLHAR_REDUZIDO : FIM_DO_OLHAR
  const amplitude = reduzirMovimento ? AMPLITUDE_DO_OLHAR_REDUZIDO : 1
  const olhar = easeInOutSine(span(t, INICIO_DO_OLHAR, fimDoOlhar))
  const deriva = reduzirMovimento ? 0 : DERIVA_DO_OLHAR * easeInOutSine(span(t, FIM_DO_OLHAR - 0.4, DURACAO))
  // Os olhos miram a boca da trilha na mata; a trilha aqui é quase reta, então a guinada mal muda.
  const rumo = Math.atan2(-(trilhaX(BOCA_DA_TRILHA) - xDaTrilha), -(BOCA_DA_TRILHA - z))
  return {
    x: xDaTrilha + BALANCO_LATERAL * passo * lado,
    // Vale (-) quando o pé assenta (fase inteira), topo no meio do passo.
    y: OLHO - BALANCO_VERTICAL * passo * Math.cos(2 * Math.PI * fase),
    z,
    rolagem: ROLAGEM * passo * lado,
    inclinacao: INCLINACAO_ANDANDO + (INCLINACAO_FINAL - INCLINACAO_ANDANDO) * amplitude * olhar + deriva,
    guinada: rumo + GUINADA_FINAL * amplitude * olhar,
    olhar,
  }
}

/** Força do fogo: cresce um pouco até perto do fim. */
export function fogoEm(t: number): number {
  return 0.8 + 0.2 * easeInOutSine(span(t, 0, 5.5))
}

/** Tremor de uma luz de fogo (0,44 a 1); com movimento reduzido só respira devagar, sem pisca. */
export function tremorEm(t: number, s: number, reduzir: boolean): number {
  if (reduzir) return 0.9 + 0.1 * Math.sin(t * 1.7 + s)
  const v = 0.5 * Math.sin(t * 7.1 + s) + 0.3 * Math.sin(t * 12.7 + s * 2.3) + 0.2 * Math.sin(t * 21.3 + s * 4.1)
  return 0.72 + 0.28 * v
}

/** Rajada de vento (0 a 1), a mesma na neblina e no som. */
export function rajadaEm(t: number): number {
  return clamp01(0.45 + 0.35 * Math.sin(t * 1.1 - 0.6) + 0.2 * Math.sin(t * 2.7 + 1.3))
}
