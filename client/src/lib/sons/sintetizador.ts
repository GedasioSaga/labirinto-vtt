import type { BufferDeSom, ContextoDeSom, FiltroDeSom, ParametroDeSom, SaidaDeSom } from './contexto'
import type { FiltroDaVoz, Voz, VozOscilador } from './receitas'

/**
 * SINTETIZADOR DOS SONS DE CLIMA: monta cada voz de uma receita (oscilador ou
 * ruído -> filtro -> envelope -> ganho mestre) e agenda o começo e o fim.
 * Cada nó vive só o tempo da voz; nada fica tocando.
 */

/** Rampa exponencial não aceita 0: "silêncio" é um ganho desprezível (-80 dB). */
export const SILENCIO = 0.0001
/** Ruído branco num buffer só, criado uma vez por contexto e lido em trechos. */
export const SEGUNDOS_DE_RUIDO = 1
/**
 * Folga entre o comando e o som: o relógio do áudio anda em blocos, e voz
 * agendada no instante exato pode perder o começo do envelope (e estalar).
 */
const ANTECEDENCIA_S = 0.01
/** Pontos por segundo na curva de altura com vibrato; o navegador liga os pontos em reta. */
const PONTOS_POR_SEGUNDO = 200
/** Passo irracional pelo buffer de ruído: cliques seguidos não soam idênticos. */
const PASSO_NO_RUIDO = 0.618

const ruidoPorContexto = new WeakMap<object, BufferDeSom>()

function bufferDeRuido<N>(ctx: ContextoDeSom<N>): BufferDeSom {
  const pronto = ruidoPorContexto.get(ctx)
  if (pronto !== undefined) return pronto
  const quadros = Math.round(ctx.sampleRate * SEGUNDOS_DE_RUIDO)
  const buffer = ctx.createBuffer(1, quadros, ctx.sampleRate)
  const amostras = buffer.getChannelData(0)
  for (let i = 0; i < amostras.length; i += 1) amostras[i] = Math.random() * 2 - 1
  ruidoPorContexto.set(ctx, buffer)
  return buffer
}

/** Onde a voz de ruído começa a ler o buffer, sem passar do fim dele. */
function deslocamentoNoRuido(indice: number, duracao: number): number {
  const folga = Math.max(0, SEGUNDOS_DE_RUIDO - duracao)
  return ((indice * PASSO_NO_RUIDO) % 1) * folga
}

/** Altura ao longo da voz: glissando exponencial de `hzIni` a `hzFim` somado ao vibrato. */
export function curvaDeAltura(voz: VozOscilador): Float32Array {
  const pontos = Math.max(2, Math.ceil(voz.duracao * PONTOS_POR_SEGUNDO) + 1)
  const hzFim = voz.hzFim ?? voz.hzIni
  const curva = new Float32Array(pontos)
  for (let i = 0; i < pontos; i += 1) {
    const fracao = i / (pontos - 1)
    const segundos = fracao * voz.duracao
    const base = voz.hzIni * (hzFim / voz.hzIni) ** fracao
    const tremor = voz.vibrato === undefined ? 0 : voz.vibrato.profundidade * Math.sin(2 * Math.PI * voz.vibrato.hz * segundos)
    curva[i] = base + tremor
  }
  return curva
}

function programarAltura(frequencia: ParametroDeSom, voz: VozOscilador, inicio: number): void {
  if (voz.vibrato !== undefined) {
    // Curva única: o Web Audio recusa (NotSupportedError) qualquer outro evento no meio de uma curva.
    frequencia.setValueCurveAtTime(curvaDeAltura(voz), inicio, voz.duracao)
    return
  }
  frequencia.setValueAtTime(voz.hzIni, inicio)
  if (voz.hzFim !== undefined) frequencia.exponentialRampToValueAtTime(voz.hzFim, inicio + voz.duracao)
}

/** Sai do silêncio, sobe ao pico, segura (se pedido) e volta ao silêncio no fim exato da voz: sem clique. */
function programarEnvelope(ganho: ParametroDeSom, voz: Voz, inicio: number): void {
  const fimDoAtaque = inicio + voz.ataque
  ganho.setValueAtTime(SILENCIO, inicio)
  ganho.exponentialRampToValueAtTime(voz.pico, fimDoAtaque)
  if (voz.sustentar !== undefined && voz.sustentar > 0) ganho.setValueAtTime(voz.pico, fimDoAtaque + voz.sustentar)
  ganho.exponentialRampToValueAtTime(SILENCIO, inicio + voz.duracao)
}

function criarFiltro<N>(ctx: ContextoDeSom<N>, filtro: FiltroDaVoz, inicio: number, destino: N): FiltroDeSom<N> & N {
  const no = ctx.createBiquadFilter()
  no.type = filtro.tipo
  no.frequency.setValueAtTime(filtro.hz, inicio)
  if (filtro.q !== undefined) no.Q.setValueAtTime(filtro.q, inicio)
  no.connect(destino)
  return no
}

function tocarVoz<N>(saida: SaidaDeSom<N>, voz: Voz, indice: number, disparo: number): void {
  const { ctx } = saida
  const inicio = disparo + voz.inicio
  const fim = inicio + voz.duracao
  const envelope = ctx.createGain()
  programarEnvelope(envelope.gain, voz, inicio)
  envelope.connect(saida.mestre)
  const entrada = voz.filtro === undefined ? envelope : criarFiltro(ctx, voz.filtro, inicio, envelope)

  if (voz.fonte === 'ruido') {
    const ruido = ctx.createBufferSource()
    ruido.buffer = bufferDeRuido(ctx)
    ruido.connect(entrada)
    ruido.start(inicio, deslocamentoNoRuido(indice, voz.duracao))
    ruido.stop(fim)
    return
  }
  const oscilador = ctx.createOscillator()
  oscilador.type = voz.forma
  programarAltura(oscilador.frequency, voz, inicio)
  oscilador.connect(entrada)
  oscilador.start(inicio)
  oscilador.stop(fim)
}

/**
 * Toca as vozes de uma receita na saída. `volume` é o da barra (0..1); o
 * mestre recebe o quadrado, porque o ouvido ouve o ganho em escala log e a
 * barra linear deixaria quase tudo no último quarto. Nunca lança: sem áudio
 * devolve `false`.
 */
export function tocarReceita<N>(saida: SaidaDeSom<N>, vozes: readonly Voz[], volume: number): boolean {
  try {
    const disparo = saida.ctx.currentTime + ANTECEDENCIA_S
    saida.mestre.gain.setValueAtTime(volume * volume, disparo)
    vozes.forEach((voz, indice) => tocarVoz(saida, voz, indice, disparo))
    return true
  } catch {
    // Nó recusado ou contexto fechado no meio: o jogo segue sem esse som, nunca com erro.
    return false
  }
}
