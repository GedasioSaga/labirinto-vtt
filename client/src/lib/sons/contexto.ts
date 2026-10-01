import type { SignalAudioContext } from '../signalSound'

/**
 * CONTEXTO DE ÁUDIO DOS SONS DE CLIMA: um só por página, criado e destravado
 * no primeiro gesto do usuário. Celular e navegador deixam suspenso o contexto
 * criado fora de gesto, e o resume() pedido depois, por evento de rede, falha:
 * por isso só o gesto cria, e nada toca antes dele.
 *
 * Os tipos são o subconjunto do Web Audio que os sons usam, para o teste
 * injetar um contexto falso; `N` é o tipo de nó (`AudioNode` no navegador).
 * Sem AudioContext (jsdom, navegador antigo) tudo vira no-op, nunca erro.
 */

export interface ParametroDeSom {
  setValueAtTime(valor: number, quando: number): unknown
  exponentialRampToValueAtTime(valor: number, quando: number): unknown
  setValueCurveAtTime(valores: Float32Array, quando: number, duracao: number): unknown
}

interface NoDeSom<N> {
  connect(destino: N): unknown
}

export interface GanhoDeSom<N> extends NoDeSom<N> {
  readonly gain: ParametroDeSom
}

export interface FiltroDeSom<N> extends NoDeSom<N> {
  type: BiquadFilterType
  readonly frequency: ParametroDeSom
  readonly Q: ParametroDeSom
}

export interface OsciladorDeSom<N> extends NoDeSom<N> {
  type: OscillatorType
  readonly frequency: ParametroDeSom
  start(quando: number): void
  stop(quando: number): void
}

export interface BufferDeSom {
  getChannelData(canal: number): Float32Array
}

export interface FonteDeBufferDeSom<N> extends NoDeSom<N> {
  buffer: BufferDeSom | null
  start(quando: number, deslocamento?: number): void
  stop(quando: number): void
}

/**
 * Estende o tipo do contexto do bipe do mestre (`signalSound.ts`): o bipe toca
 * neste mesmo contexto (`obterContexto`), destravado aqui no gesto. Ele liga
 * direto no `destination`, fora do ganho mestre e do passa-baixa dos sons de clima.
 */
export interface ContextoDeSom<N> extends SignalAudioContext<N> {
  readonly sampleRate: number
  createOscillator(): OsciladorDeSom<N>
  createGain(): GanhoDeSom<N> & N
  createBiquadFilter(): FiltroDeSom<N> & N
  createBuffer(canais: number, quadros: number, taxa: number): BufferDeSom
  createBufferSource(): FonteDeBufferDeSom<N>
}

export interface SaidaDeSom<N> {
  readonly ctx: ContextoDeSom<N>
  /**
   * Entrada comum a todos os sons: ganho mestre -> passa-baixa geral ->
   * destination. O mestre fica em 1; o volume da mesa vai num ganho de cada
   * toque (`tocarReceita`), porque mexer aqui mudaria também o som que ainda soa.
   */
  readonly mestre: GanhoDeSom<N> & N
}

export interface MotorDeSom<N> {
  /** O contexto já criado por um gesto (rodando ou não). Nunca cria: antes do 1º gesto é `null`. */
  obterContexto(): ContextoDeSom<N> | null
  obterSaida(): SaidaDeSom<N> | null
  /** Escuta os gestos que ativam o usuário em `alvo`; devolve a função que tira os ouvintes. */
  destravarNoPrimeiroGesto(alvo: EventTarget): () => void
}

/** Passa-baixa geral, em Hz: todo som sai abafado, o clima pede timbre fechado. */
export const ABAFADOR_HZ = 4000

/**
 * Eventos que ativam o usuário pela especificação HTML. `pointerdown` fica de
 * fora: no toque ele NÃO ativa, e o resume() feito nele falharia em silêncio
 * justamente no celular.
 */
const GESTOS_QUE_DESTRAVAM: readonly string[] = ['pointerup', 'touchend', 'keydown', 'click']

/** Em captura: um `stopPropagation` de algum componente não esconde o gesto. Passivo: nunca impede o padrão. */
const OUVIR: AddEventListenerOptions = { capture: true, passive: true }

function montarSaida<N>(ctx: ContextoDeSom<N>): SaidaDeSom<N> {
  const mestre = ctx.createGain()
  const abafador = ctx.createBiquadFilter()
  abafador.type = 'lowpass'
  abafador.frequency.setValueAtTime(ABAFADOR_HZ, ctx.currentTime)
  mestre.connect(abafador)
  abafador.connect(ctx.destination)
  return { ctx, mestre }
}

/** iOS só libera o áudio com um som começado dentro do gesto: 1 amostra muda basta. */
function tocarSilencio<N>(ctx: ContextoDeSom<N>): void {
  const fonte = ctx.createBufferSource()
  fonte.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
  fonte.connect(ctx.destination)
  fonte.start(0)
}

export function criarMotorDeSom<N>(fabrica: () => ContextoDeSom<N> | null): MotorDeSom<N> {
  let saida: SaidaDeSom<N> | null = null
  let semAudio = false

  /** Só roda dentro de gesto: é o único lugar que cria o contexto. */
  function saidaDoGesto(): SaidaDeSom<N> | null {
    if (saida !== null || semAudio) return saida
    try {
      const ctx = fabrica()
      if (ctx === null) {
        semAudio = true
        return null
      }
      saida = montarSaida(ctx)
      return saida
    } catch {
      // Construtor que lança (sem saída de áudio, limite de contextos): o app segue mudo.
      semAudio = true
      return null
    }
  }

  return {
    obterContexto: () => (saida === null ? null : saida.ctx),
    obterSaida: () => saida,
    destravarNoPrimeiroGesto(alvo) {
      let ouvindo = true
      function parar(): void {
        if (!ouvindo) return
        ouvindo = false
        for (const tipo of GESTOS_QUE_DESTRAVAM) alvo.removeEventListener(tipo, aoGesto, OUVIR)
      }
      function aoGesto(): void {
        const atual = saidaDoGesto()
        if (atual === null) {
          parar()
          return
        }
        const { ctx } = atual
        // Os ouvintes ficam: se o iOS suspender de novo (tela bloqueada, ligação), o próximo toque retoma.
        if (ctx.state === 'running') return
        try {
          // Recusado (gesto que não ativa, como Esc): fica suspenso e o próximo gesto tenta de novo.
          void ctx.resume().catch(() => undefined)
          tocarSilencio(ctx)
        } catch {
          // Contexto fechado ou nó recusado: sem som agora; o próximo gesto tenta de novo.
        }
      }
      for (const tipo of GESTOS_QUE_DESTRAVAM) alvo.addEventListener(tipo, aoGesto, OUVIR)
      return parar
    },
  }
}

function criarContextoDoNavegador(): ContextoDeSom<AudioNode> | null {
  const Construtor = globalThis.AudioContext
  return typeof Construtor === 'function' ? new Construtor() : null
}

const motorDoApp = criarMotorDeSom(criarContextoDoNavegador)

export const obterContexto = (): ContextoDeSom<AudioNode> | null => motorDoApp.obterContexto()
export const obterSaidaDeSom = (): SaidaDeSom<AudioNode> | null => motorDoApp.obterSaida()
export const destravarAudioNoPrimeiroGesto = (alvo: EventTarget): (() => void) => motorDoApp.destravarNoPrimeiroGesto(alvo)
