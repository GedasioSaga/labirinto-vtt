import {
  DANCA_DURACAO_MAX_S,
  DANCA_EVENTOS_MAX,
  DANCA_TOQUES_INTERVALO_MS,
  type DancaEvento,
  type DancaPlacarAoVivo,
  type DancaPlacarFinal,
} from '../../../net/protocoloDaDanca'
import type { DancaLoteDoColega } from '../../../player/estadoDaDanca'
import type { RitmoDaPista } from '../coreografia'
import { bordasDoControle, criarFontesDasTrilhas, lanesDoControle, startApertado } from '../entrada'
import {
  apertarTrilha,
  avancarPartida,
  encerrarPartida,
  fecharSeguradasNaPausa,
  notaAoVivoPassa,
  novaPartida,
  progressoDe,
  resultadoDaPartida,
  soltarTrilha,
  type EventoDaPartida,
  type MotivoDoFim,
  type PartidaDanca,
  type ResultadoDaDanca,
} from '../partida'
import {
  avancarPoeira,
  chaoDoNivel,
  COLEGAS_NO_PALCO,
  dancar,
  desenharPalco,
  estadoPorta,
  geometriaDoPalco,
  medidasDoPalco,
  nivelDoCombo,
  novoDancarino,
  PORTA_DUR,
  poseNoTempo,
  prepararCenario,
  runasAcesas,
  soltarPoeira,
  suavizarHolofote,
  type CenarioDoPalco,
  type Dancarino,
  type GraoDePoeira,
} from '../palco'
import { criarSpritesDaPista, desenharPista, medirPista, type EfeitoDaTrilha, type LayoutDaPista, type SpritesDaPista } from '../pista'
import { DIF, letraDe, pontosDe, precisaoDe } from '../regras'
import { posicaoNaMusica } from '../relogio'
import { BPM_DEMO, eventosDaDemo, GANHO_FAIXA, somDeAcerto, somDeErro } from '../som'
import type { DificuldadeDanca, LetraDanca, NotaDaDanca, TrilhaDanca } from '../tipos'
import { criarAgendadorDaFaixa, JANELA_DO_AGENDADOR_S, PASSO_DO_AGENDADOR_MS } from './agendadorDaFaixa'
import type { AudioDaDanca } from './audioDaDanca'
import { avancarColegas, criarPlateia, receberLotes, type PlateiaDosColegas } from './colegas'
import { PREFERENCIAS_PADRAO, type PreferenciasDaDanca } from './preferencias'
import { fmtInt, fmtPct, TEXTO_DO_JULGAMENTO, type TextoNaPista } from './textos'

/**
 * MOTOR DA PISTA: o laço de quadros da dança no aparelho do jogador. Liga os
 * módulos puros (partida, palco, pista, som, relógio, entrada) ao DOM e ao
 * áudio: julga cada toque no relógio do áudio, toca acerto e erro, mexe o
 * dançarino, desenha palco e pista a cada quadro e junta os toques num lote
 * para a rede a cada 250 ms. O React só troca de tela; o que muda a 60 Hz
 * (setas, barra, pontos) é escrito direto nos elementos.
 */

export type FaseDaPista = 'parada' | 'tocando' | 'pausada' | 'retomando' | 'fim'
export type OrigemDaPausa = 'jogador' | 'mestre'

export interface ConfigDaPartida {
  dif: DificuldadeDanca
  notas: readonly NotaDaDanca[]
  ritmo: RitmoDaPista
  duracaoS: number
  notaMin: LetraDanca
  musica: { tipo: 'demo' } | { tipo: 'buffer'; buffer: AudioBuffer }
  /** `performance.now()` em que a posição 0 da música soa — o mesmo instante em todo aparelho. */
  inicioMs: number
  /** 3-2-1 nas baquetas da faixa (a demo tem compasso de contagem) ou antes da música (importada). */
  contagem: 'faixa' | 'antes'
}

export interface SaidaDoMotor {
  enviarToques(lote: { eventos: DancaEvento[]; placar: DancaPlacarAoVivo }): void
  enviarFim(placar: DancaPlacarFinal): void
}

export interface ElementosDaPista {
  campo: HTMLElement
  canvas: HTMLCanvasElement
  contagem: HTMLElement
  aguarde: HTMLElement
  julg: HTMLElement
  combo: HTMLElement
  comboN: HTMLElement
  pontos: HTMLElement
  precisao: HTMLElement
  vida: HTMLElement | null
  vidaBarra: HTMLElement | null
  progresso: HTMLElement
}

export interface ElementosDoPalco {
  container: HTMLElement
  canvas: HTMLCanvasElement
  /** Precisão deste jogador na mesa-mini. */
  mesaEu: HTMLElement | null
}

export interface InstantaneoDoMotor {
  fase: FaseDaPista
  pausadaPeloMestre: boolean
  pausadaPeloJogador: boolean
  /** A música não pôde tocar sozinha (contexto parado): precisa de um toque. */
  precisaDeToque: boolean
  resultado: ResultadoDaDanca | null
  motivo: MotivoDoFim | null
}

/** O que o motor lê do mundo; o teste troca. */
export interface AmbienteDoMotor {
  agora(): number
  quadro(f: (t: number) => void): number
  cancelarQuadro(id: number): void
  controles(): readonly (Gamepad | null)[]
}

const AMBIENTE_DO_NAVEGADOR: AmbienteDoMotor = {
  agora: () => performance.now(),
  quadro: (f) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(f) : window.setTimeout(() => f(performance.now()), 16)),
  cancelarQuadro: (id) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : window.clearTimeout(id)),
  controles: () => (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []),
}

/** Cada número do 3-2-1 dura 450 ms (o mesmo do protótipo). */
export const PASSO_DA_CONTAGEM_MS = 450
/** Na importada, o 3-2-1 termina quando a música começa. */
const CONTAGEM_ANTES_S = [-1.35, -0.9, -0.45]
/** Número do 3-2-1 que ficou para trás mais que isso (entrou atrasado) não aparece. */
const CONTAGEM_VELHA_S = 0.3
/** A porta começa a abrir um pouco depois do resultado: o olho chega no palco primeiro. */
export const PORTA_ESPERA_MS = 350
/** Fim da música: some em 1,2 s; vida zerada ou encerrada: em 0,5 s. */
const QUEDA_NO_FIM_S = 1.2
const QUEDA_CORTADA_S = 0.5
/** O combo só aparece de 4 em diante; de 25, em latão. */
const COMBO_VISIVEL = 4
const COMBO_ALTO = 25
const VIDA_BAIXA = 25
/** A mesa-mini não precisa de 60 Hz. */
const MESA_MINI_MS = 200
const RITMO_DA_DEMO: RitmoDaPista = { batidaS: 60 / BPM_DEMO, grade0: 0, fase4: 0 }
/** Antes da música começar, a posição fica bem antes do começo (nada cai). */
const ANTES_DA_MUSICA_S = -10
const LANES_SOLTAS = (): boolean[] => [false, false, false, false]
/** Carimbo de evento a mais de 1 s do agora não é do relógio de `performance`. */
const CARIMBO_CONFIAVEL_MS = 1000

export class MotorDaDanca {
  private readonly saida: SaidaDoMotor
  private readonly ambiente: AmbienteDoMotor
  private readonly reduzido: () => boolean
  private audio: AudioDaDanca | null = null
  prefs: PreferenciasDaDanca = { ...PREFERENCIAS_PADRAO }
  /** Para onde vão os toques: a pista, o ajuste de atraso ou nenhum. */
  modo: 'pista' | 'calibra' | 'outro' = 'outro'
  aoToqueDaCalibracao: ((perfMs: number) => void) | null = null

  private config: ConfigDaPartida | null = null
  private partida: PartidaDanca | null = null
  private fase: FaseDaPista = 'parada'
  private ritmo: RitmoDaPista = RITMO_DA_DEMO
  private notaMin: LetraDanca = 'B'
  private t0 = 0
  private musicaAgendada = false
  private precisaDeToque = false
  private barramento: GainNode | null = null
  private fonte: AudioBufferSourceNode | null = null
  private intervaloDoAgendador: number | null = null
  private intervaloDosToques: number | null = null
  private readonly pausas = { jogador: false, mestre: false }
  private stPausa = ANTES_DA_MUSICA_S
  private timersDaRetomada: number[] = []
  private contagemFeita = new Set<number>()
  private resultado: ResultadoDaDanca | null = null

  private voce: Dancarino = novoDancarino()
  private plateia: PlateiaDosColegas = { colegas: [], ultimoSeq: 0 }
  private placares: Readonly<Record<string, DancaPlacarAoVivo>> = {}
  private poeira: GraoDePoeira[] = []
  private holofote = 0
  private efeitos: (EfeitoDaTrilha | null)[] = [null, null, null, null]
  private apertadas: boolean[] = LANES_SOLTAS()
  private readonly fontes = criarFontesDasTrilhas()
  private readonly controles = new Map<number, boolean[]>()
  private readonly starts = new Map<number, boolean>()
  private portaInicioMs: number | null = null

  private palco: { el: ElementosDoPalco; g: CanvasRenderingContext2D | null; S: CenarioDoPalco | null } | null = null
  private pista: { el: ElementosDaPista; g: CanvasRenderingContext2D | null; L: LayoutDaPista | null; spr: SpritesDaPista | null; cursor: number } | null = null
  private observador: ResizeObserver | null = null
  private sujoPalco = true
  private sujoPista = true
  private readonly hud = new Map<string, string>()
  private ultimaMesaMini = 0

  private pendentes: DancaEvento[] = []
  private placarEnviado = ''

  private raf: number | null = null
  private ultimoQuadro = 0
  private instantaneo: InstantaneoDoMotor | null = null
  private readonly ouvintes = new Set<() => void>()

  constructor(saida: SaidaDoMotor, reduzido: () => boolean, ambiente: AmbienteDoMotor = AMBIENTE_DO_NAVEGADOR) {
    this.saida = saida
    this.reduzido = reduzido
    this.ambiente = ambiente
  }

  // ---------------------------------------------------------------- React

  assinar = (ouvinte: () => void): (() => void) => {
    this.ouvintes.add(ouvinte)
    return () => this.ouvintes.delete(ouvinte)
  }

  lerInstantaneo = (): InstantaneoDoMotor => {
    if (this.instantaneo === null) {
      this.instantaneo = {
        fase: this.fase,
        pausadaPeloMestre: this.pausas.mestre,
        pausadaPeloJogador: this.pausas.jogador,
        precisaDeToque: this.precisaDeToque,
        resultado: this.resultado,
        motivo: this.partida?.motivo ?? null,
      }
    }
    return this.instantaneo
  }

  private notificar(): void {
    this.instantaneo = null
    for (const ouvinte of this.ouvintes) ouvinte()
  }

  // ---------------------------------------------------------------- ligações

  iniciar(): void {
    if (this.raf !== null) return
    this.raf = this.ambiente.quadro(this.quadro)
    if (typeof ResizeObserver === 'function') {
      this.observador = new ResizeObserver(() => {
        this.medirPalco()
        this.medirPista()
      })
      if (this.palco !== null) this.observador.observe(this.palco.el.container)
      if (this.pista !== null) this.observador.observe(this.pista.el.campo)
    }
  }

  destruir(): void {
    if (this.raf !== null) this.ambiente.cancelarQuadro(this.raf)
    this.raf = null
    this.observador?.disconnect()
    this.observador = null
    this.pararIntervalos()
    this.cancelarRetomada()
    this.desligarMusica()
    this.ouvintes.clear()
  }

  definirAudio(audio: AudioDaDanca | null): void {
    this.audio = audio
  }

  ligarPalco(el: ElementosDoPalco | null): void {
    if (this.palco !== null) this.observador?.unobserve(this.palco.el.container)
    if (el === null) {
      this.palco = null
      return
    }
    let g: CanvasRenderingContext2D | null = null
    try {
      g = el.canvas.getContext('2d')
    } catch {
      g = null
    }
    this.palco = { el, g, S: null }
    this.observador?.observe(el.container)
    this.medirPalco()
  }

  ligarPista(el: ElementosDaPista | null): void {
    if (this.pista !== null) this.observador?.unobserve(this.pista.el.campo)
    if (el === null) {
      this.pista = null
      return
    }
    let g: CanvasRenderingContext2D | null = null
    try {
      g = el.canvas.getContext('2d')
    } catch {
      g = null
    }
    this.pista = { el, g, L: null, spr: null, cursor: 0 }
    this.hud.clear()
    this.observador?.observe(el.campo)
    this.medirPista()
    this.atualizarHud()
  }

  /** Quem dança ao lado (até 4 no palco). Os dançarinos de quem já estava ficam. */
  definirColegas(participantes: readonly { playerId: string; nome: string; dificuldade?: DificuldadeDanca }[], euId: string | undefined): void {
    const nova = criarPlateia(participantes, euId)
    for (const c of nova.colegas) {
      const antes = this.plateia.colegas.find((a) => a.playerId === c.playerId)
      if (antes !== undefined) c.dancarino = antes.dancarino
    }
    nova.ultimoSeq = this.plateia.ultimoSeq
    this.plateia = nova
    this.sujoPalco = true
  }

  receberColegas(lotes: readonly DancaLoteDoColega[], placares: Readonly<Record<string, DancaPlacarAoVivo>>): void {
    receberLotes(this.plateia, lotes)
    this.placares = placares
  }

  definirNotaMin(nota: LetraDanca): void {
    this.notaMin = nota
  }

  // ---------------------------------------------------------------- partida

  get dificuldade(): DificuldadeDanca | null {
    return this.config?.dif ?? null
  }

  comecar(config: ConfigDaPartida): void {
    if (this.partida !== null) return
    this.config = config
    this.ritmo = config.ritmo
    this.notaMin = config.notaMin
    this.partida = novaPartida(config.notas, config.dif, config.duracaoS)
    this.voce = novoDancarino()
    this.efeitos = [null, null, null, null]
    this.apertadas = LANES_SOLTAS()
    this.fontes.limpar()
    this.poeira = []
    this.contagemFeita = new Set()
    this.fase = 'tocando'
    this.hud.clear()
    this.atualizarHud()
    this.entrarNaMusica()
    this.intervaloDosToques = window.setInterval(() => this.enviarLote(), DANCA_TOQUES_INTERVALO_MS)
    this.notificar()
  }

  /** Agenda a música (ou tenta de novo, num gesto, quando o contexto não quis rodar sozinho). */
  entrarNaMusica(): void {
    const audio = this.audio
    const config = this.config
    if (config === null || this.musicaAgendada || this.fase === 'fim') return
    if (audio === null) {
      this.marcarToque(true)
      return
    }
    if (audio.ctx.state !== 'running') {
      void audio.retomar().then((ok) => {
        if (ok) this.entrarNaMusica()
        else this.marcarToque(true)
      })
      return
    }
    this.marcarToque(false)
    const ctx = audio.ctx
    this.t0 = audio.relogio.ouvidoEm(config.inicioMs)
    const bus = audio.novoBarramento()
    this.barramento = bus
    const agora = ctx.currentTime
    if (config.musica.tipo === 'buffer') {
      const fonte = ctx.createBufferSource()
      fonte.buffer = config.musica.buffer
      fonte.connect(bus)
      // Entrou atrasado (a página voltou, o toque demorou): começa do ponto em que os outros estão.
      const quando = Math.max(this.t0, agora + 0.02)
      const desde = quando - this.t0
      if (desde < config.musica.buffer.duration) fonte.start(quando, desde)
      this.fonte = fonte
    } else {
      bus.gain.value = GANHO_FAIXA
      const agendador = criarAgendadorDaFaixa(ctx, bus, eventosDaDemo(), this.t0)
      agendador.agendarAte(agora + JANELA_DO_AGENDADOR_S, agora)
      this.intervaloDoAgendador = window.setInterval(() => {
        const t = ctx.currentTime
        agendador.agendarAte(t + JANELA_DO_AGENDADOR_S, t)
      }, PASSO_DO_AGENDADOR_MS)
    }
    this.musicaAgendada = true
    audio.relogio.reiniciar()
  }

  private marcarToque(precisa: boolean): void {
    if (this.precisaDeToque === precisa) return
    this.precisaDeToque = precisa
    this.notificar()
  }

  /** Posição da música que este jogador ouve em `perfMs`, já com o atraso dele. */
  private stEm(perfMs: number): number {
    if (this.audio === null || !this.musicaAgendada) return ANTES_DA_MUSICA_S
    return posicaoNaMusica(this.audio.relogio, perfMs, this.t0, this.prefs.ajusteMs)
  }

  // ---------------------------------------------------------------- entrada

  /** Tecla, dedo ou controle apertou a trilha. `id` diz quem ('k' + code, 'p' + pointerId, 'g' + índice). */
  apertar(lane: TrilhaDanca, id: string, perfMs: number): void {
    const quando = this.instanteDoEvento(perfMs)
    if (this.modo === 'calibra') {
      this.aoToqueDaCalibracao?.(quando)
      return
    }
    if (this.modo !== 'pista' || !this.fontes.apertou(lane, id)) return
    this.apertadas[lane] = true
    this.sujoPista = true
    const p = this.partida
    if (p === null || this.fase !== 'tocando' || !this.musicaAgendada) return
    const st = this.stEm(quando)
    this.tratar(apertarTrilha(p, lane, st), st)
  }

  soltar(lane: TrilhaDanca, id: string, perfMs: number): void {
    if (!this.fontes.soltou(lane, id)) return
    this.apertadas[lane] = false
    this.sujoPista = true
    const p = this.partida
    if (p === null || this.fase !== 'tocando' || !this.musicaAgendada) return
    const st = this.stEm(this.instanteDoEvento(perfMs))
    this.tratar(soltarTrilha(p, lane, st), st)
  }

  /**
   * O carimbo do evento no relógio de `performance.now()`. Navegador antigo
   * (e o jsdom) carimba em ms de calendário: longe demais do agora, vale o agora.
   */
  private instanteDoEvento(perfMs: number): number {
    const agora = this.ambiente.agora()
    return Number.isFinite(perfMs) && Math.abs(perfMs - agora) < CARIMBO_CONFIAVEL_MS ? perfMs : agora
  }

  /** A janela perdeu o foco: tudo que estava apertado solta agora. */
  soltarTudo(perfMs: number): void {
    for (const lane of this.fontes.limpar()) {
      this.apertadas[lane] = false
      const p = this.partida
      if (p !== null && this.fase === 'tocando' && this.musicaAgendada) {
        const st = this.stEm(perfMs)
        this.tratar(soltarTrilha(p, lane, st), st)
      }
    }
    this.sujoPista = true
  }

  /** Esc, o botão Pausar ou o Start do controle. Durante a pausa do mestre não faz nada. */
  alternarPausa(): void {
    if (this.fase === 'pausada') {
      if (this.pausas.jogador && !this.pausas.mestre) this.retomar('jogador')
      return
    }
    if (this.fase === 'tocando' || this.fase === 'retomando') this.pausar('jogador')
  }

  private tratar(eventos: readonly EventoDaPartida[], st: number): void {
    if (eventos.length === 0) return
    const p = this.partida
    const audio = this.audio
    if (p === null) return
    const gentil = !DIF[p.dif].vida
    const agora = this.ambiente.agora()
    for (const e of eventos) {
      if (e.tipo === 'julgou') {
        this.efeitos[e.lane] = { inicio: agora, julg: e.julg }
        this.pendentes.push({ lane: e.lane, j: e.julg, t: Math.min(DANCA_DURACAO_MAX_S, Math.max(0, st)) })
        if (e.julg === 'errou') {
          const tropecou = dancar(this.voce, e.lane, st, this.ritmo.batidaS, gentil ? 'ops' : 'tropeco')
          if (tropecou && !this.reduzido() && this.palco?.S) this.poeira.push(...soltarPoeira(this.palco.S))
          if (audio !== null) somDeErro(audio.ctx, audio.efeitos, audio.ctx.currentTime, gentil)
          this.mostrarJulg('errou', gentil)
        } else {
          dancar(this.voce, e.lane, st, this.ritmo.batidaS)
          if (audio !== null && this.prefs.somAcerto) somDeAcerto(audio.ctx, audio.efeitos, audio.ctx.currentTime, e.julg === 'perfeito')
          this.mostrarJulg(e.julg, false)
        }
      } else if (e.tipo === 'segurada') {
        if (e.inteira) this.mostrarJulg('segurou', false)
        else {
          dancar(this.voce, e.lane, st, this.ritmo.batidaS, 'ops')
          this.mostrarJulg('soltou', false)
        }
      } else this.terminar(e.motivo)
    }
    this.atualizarHud()
    this.sujoPalco = true
    this.sujoPista = true
  }

  // ---------------------------------------------------------------- pausa

  pausar(origem: OrigemDaPausa): void {
    const p = this.partida
    if (p === null || this.fase === 'fim' || this.fase === 'parada') return
    this.pausas[origem] = true
    if (this.fase !== 'pausada') {
      if (this.fase === 'tocando') this.stPausa = this.stEm(this.ambiente.agora())
      this.cancelarRetomada()
      this.fase = 'pausada'
      void this.audio?.suspender()
      // Segurada no instante da pausa conta como inteira: a pausa não pode punir.
      this.tratar(fecharSeguradasNaPausa(p), this.stPausa)
      this.fontes.limpar()
      this.apertadas = LANES_SOLTAS()
      this.esconderContagem()
    }
    this.sujoPalco = true
    this.sujoPista = true
    this.notificar()
  }

  /** Volta com 3, 2, 1 contados de `desdeMs` (a retomada do mestre conta de quando chegou). */
  retomar(origem: OrigemDaPausa, desdeMs: number = this.ambiente.agora()): void {
    this.pausas[origem] = false
    if (this.fase !== 'pausada' || this.pausas.jogador || this.pausas.mestre) {
      this.notificar()
      return
    }
    this.fase = 'retomando'
    const agora = this.ambiente.agora()
    for (let i = 0; i < 3; i += 1) {
      this.timersDaRetomada.push(window.setTimeout(() => this.mostrarContagem(String(3 - i)), Math.max(0, desdeMs + i * PASSO_DA_CONTAGEM_MS - agora)))
    }
    this.timersDaRetomada.push(
      window.setTimeout(() => {
        if (this.fase !== 'retomando') return
        const audio = this.audio
        void (audio === null ? Promise.resolve(false) : audio.retomar()).then((ok) => {
          if (this.fase !== 'retomando') return
          this.fase = 'tocando'
          if (!ok) this.marcarToque(true)
          this.notificar()
        })
      }, Math.max(0, desdeMs + 3 * PASSO_DA_CONTAGEM_MS - agora)),
    )
    this.notificar()
  }

  private cancelarRetomada(): void {
    for (const id of this.timersDaRetomada) window.clearTimeout(id)
    this.timersDaRetomada = []
  }

  // ---------------------------------------------------------------- fim

  /** O mestre encerrou para todos: a música some e não há resultado. */
  encerrar(): void {
    const p = this.partida
    if (p === null || this.fase === 'fim') return
    this.tratar(encerrarPartida(p, 'mestre'), this.stPausa)
  }

  /** Sair no meio: termina como se o jogador parasse de tocar (as setas que faltam contam como erro). */
  desistir(): void {
    const p = this.partida
    if (p === null || this.fase === 'fim') return
    this.tratar(encerrarPartida(p, 'fim'), this.stPausa)
  }

  abrirPorta(): void {
    if (this.portaInicioMs === null) this.portaInicioMs = this.ambiente.agora() + PORTA_ESPERA_MS
  }

  private terminar(motivo: MotivoDoFim): void {
    const p = this.partida
    if (p === null || this.fase === 'fim') return
    this.fase = 'fim'
    this.cancelarRetomada()
    this.esconderContagem()
    if (this.intervaloDoAgendador !== null) window.clearInterval(this.intervaloDoAgendador)
    this.intervaloDoAgendador = null
    this.desligarMusica(motivo === 'fim' ? QUEDA_NO_FIM_S : QUEDA_CORTADA_S)
    this.fontes.limpar()
    this.apertadas = LANES_SOLTAS()
    if (motivo !== 'mestre') {
      const r = resultadoDaPartida(p, this.notaMin)
      this.resultado = r
      this.enviarLote()
      this.saida.enviarFim({
        precisao: Math.min(1, Math.max(0, r.precisao)),
        letra: r.letra ?? letraDe(r.precisao),
        falhou: motivo === 'falhou',
        perfeito: r.contagem.perfeito,
        bom: r.contagem.bom,
        ok: r.contagem.ok,
        errou: r.contagem.errou,
        comboMax: r.comboMax,
        segOk: r.seguradas.inteiras,
        segTotal: r.seguradas.total,
      })
    }
    if (this.intervaloDosToques !== null) window.clearInterval(this.intervaloDosToques)
    this.intervaloDosToques = null
    this.notificar()
  }

  /** A música some em `quedaS` (ou na hora, com o contexto parado) e o barramento sai do áudio. */
  private desligarMusica(quedaS = 0): void {
    const audio = this.audio
    const bus = this.barramento
    const fonte = this.fonte
    this.barramento = null
    this.fonte = null
    if (audio === null || bus === null) return
    const ctx = audio.ctx
    if (quedaS > 0 && ctx.state === 'running') {
      const agora = ctx.currentTime
      bus.gain.cancelScheduledValues(agora)
      bus.gain.setValueAtTime(bus.gain.value, agora)
      bus.gain.linearRampToValueAtTime(0, agora + quedaS)
      try {
        fonte?.stop(agora + quedaS + 0.05)
      } catch {
        // Já parou.
      }
      window.setTimeout(() => bus.disconnect(), (quedaS + 0.1) * 1000)
      return
    }
    try {
      fonte?.stop()
    } catch {
      // Nunca começou ou já parou.
    }
    bus.disconnect()
    // Parado na pausa: volta a rodar para o palco seguir (os colegas ainda dançam no relógio dele).
    if (ctx.state === 'suspended') void audio.retomar()
  }

  private pararIntervalos(): void {
    if (this.intervaloDoAgendador !== null) window.clearInterval(this.intervaloDoAgendador)
    if (this.intervaloDosToques !== null) window.clearInterval(this.intervaloDosToques)
    this.intervaloDoAgendador = null
    this.intervaloDosToques = null
  }

  // ---------------------------------------------------------------- rede

  /** Manda o lote: os toques desde o último e o placar, só quando há algo novo. */
  private enviarLote(): void {
    const p = this.partida
    if (p === null) return
    const placar: DancaPlacarAoVivo = {
      precisao: Math.min(1, Math.max(0, precisaoDe(p.placar))),
      combo: p.placar.combo,
      vida: p.placar.vida,
      julgadas: p.placar.julgadas,
    }
    const chave = `${placar.julgadas}|${placar.combo}|${placar.vida}|${placar.precisao}`
    if (this.pendentes.length === 0 && chave === this.placarEnviado) return
    while (this.pendentes.length > 0 || chave !== this.placarEnviado) {
      const eventos = this.pendentes.splice(0, DANCA_EVENTOS_MAX)
      this.saida.enviarToques({ eventos, placar })
      this.placarEnviado = chave
    }
  }

  // ---------------------------------------------------------------- tela

  private mostrarJulg(texto: TextoNaPista, gentil: boolean): void {
    const el = this.pista?.el.julg
    if (el === undefined) return
    el.textContent = TEXTO_DO_JULGAMENTO[texto]
    el.dataset.j = texto === 'errou' && gentil ? 'gentil' : texto
    if (typeof el.animate !== 'function') {
      el.style.opacity = '1'
      return
    }
    for (const a of el.getAnimations()) a.cancel()
    const r = this.reduzido()
    el.animate(
      [
        { opacity: 1, transform: r ? 'none' : 'scale(1.06)' },
        { opacity: 1, transform: 'scale(1)', offset: 0.14 },
        { opacity: 1, transform: 'scale(1)', offset: 0.7 },
        { opacity: 0, transform: 'scale(1)' },
      ],
      { duration: 650, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' },
    )
  }

  private mostrarContagem(texto: string): void {
    const el = this.pista?.el.contagem
    if (el === undefined) return
    el.textContent = texto
    if (typeof el.animate !== 'function') {
      el.style.opacity = '1'
      return
    }
    for (const a of el.getAnimations()) a.cancel()
    el.animate(
      this.reduzido()
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [{ opacity: 1, transform: 'scale(1.08)' }, { opacity: 1, transform: 'scale(1)', offset: 0.3 }, { opacity: 0, transform: 'scale(1)' }],
      { duration: 440, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' },
    )
  }

  private esconderContagem(): void {
    const el = this.pista?.el.contagem
    if (el === undefined) return
    if (typeof el.getAnimations === 'function') for (const a of el.getAnimations()) a.cancel()
    el.textContent = ''
  }

  private escrever(chave: string, el: HTMLElement, valor: string): void {
    if (this.hud.get(chave) === valor) return
    this.hud.set(chave, valor)
    el.textContent = valor
  }

  private atualizarHud(): void {
    const p = this.partida
    const el = this.pista?.el
    if (p === null || el === undefined) return
    this.escrever('pontos', el.pontos, fmtInt(pontosDe(p.placar, p.totalItens)))
    this.escrever('precisao', el.precisao, p.placar.julgadas ? fmtPct(precisaoDe(p.placar)) : '—')
    const combo = p.placar.combo
    el.combo.hidden = combo < COMBO_VISIVEL
    if (combo >= COMBO_VISIVEL) {
      this.escrever('combo', el.comboN, String(combo))
      el.combo.dataset.alto = combo >= COMBO_ALTO ? '1' : '0'
    }
    if (DIF[p.dif].vida && el.vida !== null && el.vidaBarra !== null) {
      el.vidaBarra.style.transform = `scaleX(${p.placar.vida / 100})`
      el.vidaBarra.dataset.baixa = p.placar.vida < VIDA_BAIXA ? '1' : '0'
      el.vida.setAttribute('aria-valuenow', String(Math.round(p.placar.vida)))
    }
  }

  private medirPalco(): void {
    const palco = this.palco
    if (palco === null) return
    const caixa = palco.el.container.getBoundingClientRect()
    const m = medidasDoPalco(caixa.width, caixa.height)
    if (m === null || palco.g === null) return
    if (palco.S !== null && palco.S.w === m.w && palco.S.h === m.h && palco.el.canvas.dataset.esc === String(m.esc)) return
    const cv = palco.el.canvas
    cv.width = m.w
    cv.height = m.h
    cv.style.width = `${m.w * m.esc}px`
    cv.style.height = `${m.h * m.esc}px`
    cv.dataset.esc = String(m.esc)
    palco.g.imageSmoothingEnabled = false
    try {
      palco.S = prepararCenario(geometriaDoPalco(m.w, m.h))
    } catch {
      palco.S = null
      return
    }
    const S = palco.S
    const pos = (el: Element | null, x: number, y: number): void => {
      if (!(el instanceof HTMLElement)) return
      el.style.left = `${((x / S.w) * 100).toFixed(2)}%`
      el.style.top = `${((y / S.h) * 100).toFixed(2)}%`
    }
    pos(palco.el.container.querySelector('[data-lugar="voce"]'), S.w / 2, S.peY + 4)
    for (let i = 0; i < COLEGAS_NO_PALCO; i += 1) pos(palco.el.container.querySelector(`[data-lugar="${i}"]`), S.colegas[i].x, S.colegas[i].y + 3)
    this.sujoPalco = true
  }

  private medirPista(): void {
    const pista = this.pista
    if (pista === null || pista.g === null) return
    const caixa = pista.el.campo.getBoundingClientRect()
    const L = medirPista(caixa.width, caixa.height, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1)
    if (L === null) return
    if (pista.L !== null && pista.L.larguraPx === L.larguraPx && pista.L.alturaPx === L.alturaPx) return
    pista.el.canvas.width = L.larguraPx
    pista.el.canvas.height = L.alturaPx
    pista.L = L
    try {
      pista.spr = criarSpritesDaPista(L)
    } catch {
      pista.spr = null
    }
    this.sujoPista = true
  }

  /** Reposiciona as etiquetas quando a lista de colegas muda (o React acabou de montar as novas). */
  remedir(): void {
    if (this.palco !== null) this.palco.S = null
    this.medirPalco()
    this.medirPista()
  }

  private quadro = (agora: number): void => {
    this.raf = this.ambiente.quadro(this.quadro)
    const dt = this.ultimoQuadro ? Math.min(0.05, (agora - this.ultimoQuadro) / 1000) : 0
    this.ultimoQuadro = agora
    this.lerControles(agora)
    const p = this.partida
    const rodando = this.musicaAgendada && (this.fase === 'tocando' || this.fase === 'fim')
    const st = rodando ? this.stEm(agora) : this.stPausa
    if (p !== null && this.fase === 'tocando' && this.musicaAgendada) {
      this.tratar(avancarPartida(p, st), st)
      this.conferirContagem(st)
    }
    if (rodando) avancarColegas(this.plateia, st, this.ritmo.batidaS, this.placares)
    const reduzido = this.reduzido()
    const emJogo = p !== null && (this.fase === 'tocando' || this.fase === 'retomando' || this.fase === 'pausada')
    const alvo = emJogo && p !== null ? nivelDoCombo(p.placar.combo) : 0
    const holofoteAntes = this.holofote
    this.holofote = suavizarHolofote(this.holofote, alvo, dt)
    if (this.poeira.length > 0) this.poeira = avancarPoeira(this.poeira, dt)
    const portaS = this.portaInicioMs !== null ? (agora - this.portaInicioMs) / 1000 : null
    const portaAnda = portaS !== null && portaS < PORTA_DUR + 0.2
    const animando = rodando || this.fase === 'retomando' || portaAnda || this.poeira.length > 0 || Math.abs(this.holofote - holofoteAntes) > 0.001
    if (this.palco !== null && this.palco.S !== null && this.palco.g !== null && (animando || this.sujoPalco)) {
      this.sujoPalco = false
      const balanca = this.fase === 'tocando' && !reduzido
      const prog = p !== null ? progressoDe(p, st) : 0
      const passando = p !== null && notaAoVivoPassa(p.placar, this.notaMin)
      desenharPalco(this.palco.g, this.palco.S, {
        porta: estadoPorta(portaS, reduzido),
        runas: emJogo ? runasAcesas(passando, prog) : [0, 0, 0, 0],
        chao: emJogo ? chaoDoNivel(alvo) : 0,
        batida: this.ritmo.batidaS > 0 ? (st - this.ritmo.grade0) / this.ritmo.batidaS : 0,
        reduzido,
        holofote: this.holofote,
        voce: poseNoTempo(this.voce, st, this.ritmo, balanca),
        colegas: this.plateia.colegas.slice(0, COLEGAS_NO_PALCO).map((c, i) => ({ visual: i, ...poseNoTempo(c.dancarino, st, this.ritmo, balanca) })),
        poeira: this.poeira,
      })
    }
    const pista = this.pista
    if (pista !== null && pista.g !== null && pista.L !== null && pista.spr !== null && p !== null) {
      const efeitoVivo = this.efeitos.some((e) => e !== null && agora - e.inicio < 200)
      if (rodando || this.fase === 'retomando' || efeitoVivo || this.sujoPista) {
        this.sujoPista = false
        pista.cursor = desenharPista(
          pista.g,
          pista.L,
          pista.spr,
          { st, dif: p.dif, notas: p.notas, ritmo: this.ritmo, apertadas: this.apertadas, efeitos: this.efeitos, cursorDesenho: pista.cursor, reduzido },
          agora,
        )
        pista.el.progresso.style.transform = `scaleX(${progressoDe(p, st)})`
        pista.el.aguarde.hidden = !(this.fase === 'tocando' && st < this.primeiroMarco() - 0.25)
      }
    }
    if (p !== null && this.palco?.el.mesaEu && agora - this.ultimaMesaMini > MESA_MINI_MS) {
      this.ultimaMesaMini = agora
      this.palco.el.mesaEu.textContent = p.placar.julgadas ? fmtPct(precisaoDe(p.placar)) : '—'
    }
  }

  private primeiroMarco(): number {
    return this.config?.contagem === 'faixa' ? this.ritmo.batidaS : CONTAGEM_ANTES_S[0]
  }

  private conferirContagem(st: number): void {
    const marcos = this.config?.contagem === 'faixa' ? [1, 2, 3].map((k) => this.ritmo.grade0 + k * this.ritmo.batidaS) : CONTAGEM_ANTES_S
    marcos.forEach((t, i) => {
      if (st < t || this.contagemFeita.has(i)) return
      this.contagemFeita.add(i)
      if (st - t < CONTAGEM_VELHA_S) this.mostrarContagem(String(3 - i))
    })
  }

  private lerControles(agora: number): void {
    let pads: readonly (Gamepad | null)[]
    try {
      pads = this.ambiente.controles()
    } catch {
      return
    }
    for (const pad of pads) {
      if (pad === null) continue
      const agoraLanes = lanesDoControle(pad)
      const antes = this.controles.get(pad.index) ?? LANES_SOLTAS()
      // O carimbo do controle vale se for recente; senão, o do quadro.
      const ts = pad.timestamp && Math.abs(agora - pad.timestamp) < 100 ? pad.timestamp : agora
      const { apertou, soltou } = bordasDoControle(antes, agoraLanes)
      for (const lane of apertou) this.apertar(lane, `g${pad.index}`, ts)
      for (const lane of soltou) this.soltar(lane, `g${pad.index}`, ts)
      this.controles.set(pad.index, agoraLanes)
      const start = startApertado(pad)
      if (start && !this.starts.get(pad.index) && this.modo === 'pista') this.alternarPausa()
      this.starts.set(pad.index, start)
    }
  }
}
