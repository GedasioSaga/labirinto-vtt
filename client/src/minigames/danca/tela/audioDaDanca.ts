import { estaCalado, type PreferenciaDeSom } from '../../../stores/somStore'
import { criarRelogio, type RelogioDoAudio } from '../relogio'
import { GANHO_EFEITOS } from '../som'

/**
 * ÁUDIO DA DANÇA: um AudioContext só da dança, criado e destravado num gesto
 * dentro da tela ("Estou pronto", "Começar a medir"). Não é o contexto dos sons
 * de clima (`lib/sons/contexto.ts`): aquele passa por um abafador de 4 kHz que
 * abafaria a música, e pausar a dança suspende o contexto inteiro — o clima e o
 * bipe do mestre não podem parar junto. Fecha quando a tela da dança sai.
 *
 *   música (um barramento por partida) ─┐
 *   efeitos (acerto, erro, metrônomo) ──┴─> mestre (volume da mesa) -> destination
 */

export interface AudioDaDanca {
  readonly ctx: AudioContext
  /** O volume da mesa: ganho = volume², como os sons de clima; 0 com a mesa calada. */
  readonly mestre: GainNode
  readonly efeitos: GainNode
  /** O único relógio do jogo (`relogio.ts`): toque -> tempo do som ouvido. */
  readonly relogio: RelogioDoAudio
  /** Barramento novo da música, no mestre. Cada partida tem o seu; sair é desligá-lo. */
  novoBarramento(): GainNode
  definirGanho(ganho: number): void
  /** `true` se o contexto ficou rodando. Chame dentro de gesto quando puder (o iOS exige). */
  retomar(): Promise<boolean>
  suspender(): Promise<void>
  fechar(): void
}

export type CriarAudioDaDanca = (ganhoInicial: number) => AudioDaDanca | null

/** O ganho do volume da mesa: o mesmo quadrado de `tocarReceita`, e silêncio quando a mesa está calada. */
export function ganhoDaMesa(pref: PreferenciaDeSom): number {
  return estaCalado(pref) ? 0 : pref.volume * pref.volume
}

/** Troca de volume sem degrau (estalo): o ganho chega lá em ~30 ms. */
const SUAVIZAR_GANHO_S = 0.01

/** iOS só libera o áudio com um som começado dentro do gesto: 1 amostra muda basta. */
function tocarSilencio(ctx: AudioContext): void {
  const fonte = ctx.createBufferSource()
  fonte.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
  fonte.connect(ctx.destination)
  fonte.start(0)
}

/** Monta o áudio num contexto já criado. Separado para o teste montar num contexto de mentira. */
export function montarAudioDaDanca(ctx: AudioContext, ganhoInicial: number): AudioDaDanca {
  const mestre = ctx.createGain()
  mestre.gain.value = ganhoInicial
  mestre.connect(ctx.destination)
  const efeitos = ctx.createGain()
  efeitos.gain.value = GANHO_EFEITOS
  efeitos.connect(mestre)
  const relogio = criarRelogio(ctx)
  return {
    ctx,
    mestre,
    efeitos,
    relogio,
    novoBarramento() {
      const bus = ctx.createGain()
      bus.connect(mestre)
      return bus
    },
    definirGanho(ganho) {
      mestre.gain.setTargetAtTime(ganho, ctx.currentTime, SUAVIZAR_GANHO_S)
    },
    async retomar() {
      try {
        if (ctx.state !== 'running') await ctx.resume()
      } catch {
        return false
      }
      relogio.reiniciar()
      return ctx.state === 'running'
    },
    async suspender() {
      try {
        if (ctx.state === 'running') await ctx.suspend()
      } catch {
        // Contexto fechado: não há o que suspender.
      }
    },
    fechar() {
      void ctx.close().catch(() => undefined)
    },
  }
}

/**
 * O áudio de verdade. CHAME DENTRO DO GESTO: só assim o celular deixa o
 * contexto rodar. `null` sem Web Audio (navegador antigo) ou se o construtor
 * recusar (sem saída de som): a tela avisa e a dança segue sem música.
 */
export function criarAudioDoNavegador(ganhoInicial: number): AudioDaDanca | null {
  const Construtor = globalThis.AudioContext
  if (typeof Construtor !== 'function') return null
  try {
    const ctx = new Construtor({ latencyHint: 'interactive' })
    void ctx.resume().catch(() => undefined)
    tocarSilencio(ctx)
    return montarAudioDaDanca(ctx, ganhoInicial)
  } catch {
    return null
  }
}
