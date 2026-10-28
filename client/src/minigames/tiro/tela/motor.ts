import { desenharPalco, type CenaDoTiro, type EfeitoNoPalco } from '../arte'
import { BALAS, criarRodada, DT, H, medalha, mult, passo, semear, TIPOS, W, type DificuldadeSim, type EventoDaRodada, type Rodada } from '../sim'
import type { NomeDoSom } from '../som'
import type { MedalhaTiro } from '../tipos'
import { DICA_CONTAGEM, DICA_PADRAO, DICA_VAZIO, fmtDec, fmtT, pctTxt } from './textos'

/**
 * MOTOR DA BARRACA DE TIRO no aparelho do jogador: a máquina do protótipo
 * aprovado (contagem, rodada, fim, resultado; `tick`, `efeito`, a fila de
 * tiros e a entrada por mouse, teclado e controle). Passo fixo `DT` (a mesma
 * semente dá a mesma rodada em qualquer aparelho), laço de quadros pelo
 * `AmbienteDoTiro` e um instantâneo imutável para o React, que só muda quando
 * um número do HUD muda — o palco, a barra do tempo e o tambor são pintados
 * a cada quadro sem passar pelo React.
 */

/** "Prontos…" antes do "Já!", em s. */
const CONTAGEM_S = 1.2
/** O sino toca e a rodada fica 1 s na tela antes do resultado. */
const FIM_ESPERA_S = 1.0
/** Um quadro lento não vira uma rajada de passos: no máximo 24 (0,2 s) por quadro. */
const PASSOS_MAX_POR_QUADRO = 24
/** Mira pelas setas, em pixels do palco por segundo. */
const MIRA_TECLADO = 110
/** Analógico: zona morta e velocidade máxima. */
const ZONA_MORTA = 0.18
const MIRA_ANALOGICO = 200
/** No máximo 2 tiros esperando na fila (clique duplo rápido não se perde, rajada não acumula). */
const FILA_MAX = 2
/** Quanto a dica de um evento fica na tela, em s. */
const DICA_S = 1.8
const FUROS_MAX = 40

export type FaseDoTiro = 'convite' | 'contagem' | 'rodada' | 'fim' | 'resultado'

/** `encerrado`: o mestre encerrou no meio; `desistiu`: o jogador saiu pela pausa. Nos dois, sem medalha. */
export type DesfechoDaRodada = 'fim' | 'encerrado' | 'desistiu'

export interface ResultadoDaRodada {
  tipo: DesfechoDaRodada
  /** A rodada (tentativa) que acabou, como o host a numerou. */
  rodada: number
  dif: DificuldadeSim
  pontos: number
  tiros: number
  acertos: number
  comboMax: number
  proibidos: number
  secos: number
  recargas: number
  derrubados: number
  medalha: MedalhaTiro | null
  /** Segundos de rodada jogados. */
  t: number
}

export interface AmbienteDoTiro {
  agora(): number
  quadro(f: (agora: number) => void): number
  cancelarQuadro(id: number): void
  controles(): readonly (Gamepad | null)[]
}

export const AMBIENTE_DO_NAVEGADOR: AmbienteDoTiro = {
  agora: () => performance.now(),
  quadro: (f) => requestAnimationFrame(f),
  cancelarQuadro: (id) => cancelAnimationFrame(id),
  controles: () => (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []),
}

export interface GanchosDoMotor {
  som(nome: NomeDoSom, v?: number): void
  /** A rodada acabou (fim, encerrada ou desistida): a tela manda à conexão na hora. */
  fimDaRodada(r: ResultadoDaRodada): void
  /** Depois de cada quadro: a tela pinta o que anda sozinho e manda o vivo ao mestre. */
  quadro(): void
  /** Botão A do controle fora da rodada: o mesmo que o botão principal da tela. */
  confirmar(): void
}

const GANCHOS_MUDOS: GanchosDoMotor = { som: () => undefined, fimDaRodada: () => undefined, quadro: () => undefined, confirmar: () => undefined }

/** O HUD da rodada, em texto: só muda quando um número muda. */
export interface HudDoTiro {
  tempo: string
  pouco: boolean
  pontos: number
  combo: number
  /** "×1", "×1,5"… */
  mult: string
  prec: string
  balas: number
  recarregando: boolean
  /** "12 de 12 balas no tambor" ou "Girando o tambor: 0,8 s". */
  balasTxt: string
  podeRecarregar: boolean
  dica: string
  dicaRuim: boolean
  /** "Prontos…", "Já!" ou nada. */
  contagem: string | null
  /** Quantas vezes o tambor girou (um tiro, um giro). */
  giro: number
  /** O tambor treme vermelho no clique seco. */
  nega: boolean
}

export interface InstantaneoDoTiro {
  fase: FaseDoTiro
  dif: DificuldadeSim
  rodada: number
  pausado: boolean
  pausaDoMestre: boolean
  encerrado: boolean
  hud: HudDoTiro
  resultado: ResultadoDaRodada | null
}

/** O que anda a cada quadro e a tela pinta sem o React: barra do tempo e arco da recarga, 0..1. */
export interface VivoDoQuadro {
  tempo: number
  recarga: number
}

interface EstadoDoJogo extends CenaDoTiro {
  fase: FaseDoTiro
  dif: DificuldadeSim
  tFase: number
  rodada: number
  evIdx: number
  fx: EfeitoNoPalco[]
  furos: [number, number][]
  giro: number
  nega: number
  ja: number
  dicaT: number
  dicaMsg: string
  dicaRuim: boolean
}

interface Controle {
  tiro: boolean
  x: boolean
  start: boolean
  a: boolean
}

const SETAS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))

/** Que sons cada evento da simulação toca (a mesma tabela do protótipo). */
export function sonsDoEvento(e: EventoDaRodada): (readonly [NomeDoSom, number?])[] {
  switch (e.nome) {
    case 'acerto':
    case 'proibido':
      return [['tiro'], [e.mat === 'vidro' ? 'vidro' : e.mat === 'moeda' ? 'moeda' : 'madeira'], ...(e.nome === 'proibido' ? [['proibido'] as const] : [])]
    case 'erro':
      return [['tiro'], ['ricochete']]
    case 'seco':
      return [['seco']]
    case 'travado':
      return [['seco', 0.5]]
    case 'recarga':
      return [['tambor', e.dura]]
    case 'pronto':
      return [['engatilhar']]
    case 'fim':
      return [['sino']]
  }
}

export class MotorDoTiro {
  readonly J: EstadoDoJogo
  ganchos: GanchosDoMotor = GANCHOS_MUDOS
  palco: CanvasRenderingContext2D | null = null

  private readonly ambiente: AmbienteDoTiro
  private readonly setas = new Set<string>()
  private readonly pads = new Map<number, Controle>()
  private readonly ouvintes = new Set<() => void>()
  private readonly eixo = { x: 0, y: 0 }
  private readonly fila = { atirar: 0, recarregar: false }
  private pausado = false
  private pausaDoMestre = false
  private encerrado = false
  private resultado: ResultadoDaRodada | null = null
  private acum = 0
  private ultimo = 0
  private idQuadro = 0
  private rodando = false
  private chave = ''
  private inst: InstantaneoDoTiro

  constructor(ambiente: AmbienteDoTiro = AMBIENTE_DO_NAVEGADOR, reduzido = false) {
    this.ambiente = ambiente
    this.J = {
      R: null, tela: 'convite', mira: { x: W / 2, y: 76 }, coice: 0, flash: 0, tremor: 0, alvoFlash: null, fx: [], furos: [], reduzido,
      fase: 'convite', dif: 'normal', tFase: 0, rodada: 0, evIdx: 0, giro: 0, nega: 0, ja: 0, dicaT: 0, dicaMsg: '', dicaRuim: false,
    }
    this.inst = this.montar()
    this.chave = this.chaveDe(this.inst)
  }

  // ------------------------------------------------------------ React

  assinar = (ouvinte: () => void): (() => void) => {
    this.ouvintes.add(ouvinte)
    return () => this.ouvintes.delete(ouvinte)
  }

  lerInstantaneo = (): InstantaneoDoTiro => this.inst

  set reduzido(v: boolean) {
    this.J.reduzido = v
  }

  get rodada(): Rodada | null {
    return this.J.R
  }

  /** A barra do tempo e o arco da recarga, a cada quadro. */
  vivoDoQuadro(): VivoDoQuadro {
    const R = this.J.R
    if (R === null) return { tempo: 1, recarga: 0 }
    const resta = this.J.fase === 'contagem' ? R.D.tempo : R.D.tempo - R.t
    return { tempo: clamp(resta / R.D.tempo, 0, 1), recarga: R.recarga > 0 ? R.recarga / R.D.recarga : 0 }
  }

  // ------------------------------------------------------------ laço

  iniciar(): void {
    if (this.rodando) return
    this.rodando = true
    this.ultimo = 0
    this.idQuadro = this.ambiente.quadro(this.aoQuadro)
  }

  destruir(): void {
    this.rodando = false
    this.ambiente.cancelarQuadro(this.idQuadro)
    this.ouvintes.clear()
  }

  private aoQuadro = (agora: number): void => {
    if (!this.rodando) return
    this.idQuadro = this.ambiente.quadro(this.aoQuadro)
    const intervalo = this.ultimo ? agora - this.ultimo : 0
    this.ultimo = agora
    this.lerControles()
    this.avancar(intervalo / 1000)
    this.desenhar()
    this.atualizar()
    this.ganchos.quadro()
  }

  /** Passos fixos pelo tempo real que passou (até 0,1 s por quadro). */
  avancar(segundos: number): void {
    this.acum += Math.min(0.1, Math.max(0, segundos))
    let n = 0
    while (this.acum >= DT && n < PASSOS_MAX_POR_QUADRO) {
      this.acum -= DT
      this.tick()
      n++
    }
  }

  desenhar(): void {
    if (this.palco !== null) desenharPalco(this.palco, this.J)
  }

  /** Um passo fixo. A pausa do mestre e a do jogador param tudo. */
  tick(): void {
    if (this.pausaDoMestre || this.pausado) return
    const J = this.J
    this.efeitosTick()
    if (J.fase === 'contagem') {
      J.tFase += DT
      if (J.tFase >= CONTAGEM_S) {
        J.fase = 'rodada'
        J.tFase = 0
        J.ja = 0.45
        this.ganchos.som('engatilhar')
      }
      return
    }
    const R = J.R
    if (J.fase === 'rodada' && R !== null) {
      const vx = this.eixo.x + (this.setas.has('ArrowRight') ? MIRA_TECLADO : 0) - (this.setas.has('ArrowLeft') ? MIRA_TECLADO : 0)
      const vy = this.eixo.y + (this.setas.has('ArrowDown') ? MIRA_TECLADO : 0) - (this.setas.has('ArrowUp') ? MIRA_TECLADO : 0)
      if (vx || vy) {
        J.mira.x = clamp(J.mira.x + vx * DT, 0, W)
        J.mira.y = clamp(J.mira.y + vy * DT, 0, H)
      }
      const atirar = this.fila.atirar > 0
      if (atirar) this.fila.atirar--
      const recarregar = this.fila.recarregar
      this.fila.recarregar = false
      passo(R, { x: J.mira.x, y: J.mira.y, atirar, recarregar })
      for (; J.evIdx < R.ev.length; J.evIdx++) {
        const e = R.ev[J.evIdx]
        if (e !== undefined) this.efeito(e)
      }
      if (R.fim) {
        J.fase = 'fim'
        J.tFase = 0
      }
      return
    }
    if (J.fase === 'fim') {
      J.tFase += DT
      if (J.tFase >= FIM_ESPERA_S) this.terminar('fim')
    }
  }

  // ------------------------------------------------------------ partida

  /** O host mandou o início: a rodada `rodada` na dificuldade `dif`, com a semente dele. */
  comecar(dif: DificuldadeSim, semente: string, rodada: number): void {
    const J = this.J
    this.encerrado = false
    this.pausado = false
    this.resultado = null
    this.setas.clear()
    this.fila.atirar = 0
    this.fila.recarregar = false
    J.dif = dif
    J.rodada = rodada
    J.R = criarRodada(dif, semente)
    J.fase = 'contagem'
    J.tela = 'jogo'
    J.tFase = 0
    J.evIdx = 0
    J.fx = []
    J.furos = []
    J.giro = 0
    J.coice = 0
    J.flash = 0
    J.tremor = 0
    J.nega = 0
    J.ja = 0
    J.dicaT = 0
    J.alvoFlash = null
    J.mira.x = W / 2
    J.mira.y = 76
    this.ganchos.som('realejo')
    this.atualizar()
  }

  /** "Voltar ao convite" do resultado, ou o convite de outra sessão. */
  voltarAoConvite(): void {
    const J = this.J
    J.fase = 'convite'
    J.tela = 'convite'
    J.R = null
    this.pausado = false
    this.resultado = null
    this.atualizar()
  }

  /** "Desistir desta rodada" da pausa: a tentativa já contou no host e sai sem medalha. */
  desistir(): void {
    if (this.J.fase === 'contagem' || this.J.fase === 'rodada' || this.J.fase === 'fim') this.terminar('desistiu')
  }

  /** O mestre encerrou (ou a conexão caiu): a rodada para onde está e nada mais sai dela. */
  encerrar(): void {
    if (this.encerrado) return
    this.encerrado = true
    this.pausado = false
    this.setas.clear()
    if (this.J.fase === 'contagem' || this.J.fase === 'rodada' || this.J.fase === 'fim') this.terminar('encerrado')
    else this.atualizar()
  }

  /** Reaberto pelo mestre: nada some da tela, só deixa jogar de novo. */
  reabrir(): void {
    if (!this.encerrado) return
    this.encerrado = false
    this.atualizar()
  }

  private terminar(tipo: DesfechoDaRodada): void {
    const J = this.J
    const R = J.R
    if (R === null) return
    const r: ResultadoDaRodada = {
      tipo,
      rodada: J.rodada,
      dif: J.dif,
      pontos: R.pontos,
      tiros: R.tiros,
      acertos: R.acertos,
      comboMax: R.comboMax,
      proibidos: R.proibidos,
      secos: R.secos,
      recargas: R.recargas,
      derrubados: Object.values(R.derrubados).reduce((a, b) => a + b, 0),
      medalha: tipo === 'fim' ? medalha(J.dif, R.pontos) : null,
      t: Math.round(Math.min(R.t, R.D.tempo) * 1000) / 1000,
    }
    this.resultado = r
    J.fase = 'resultado'
    J.tela = 'resultado'
    this.pausado = false
    this.setas.clear()
    this.atualizar()
    this.ganchos.fimDaRodada(r)
  }

  // ------------------------------------------------------------ efeitos

  private fxTexto(x: number, y: number, ganho: number): void {
    this.J.fx.push({ tipo: 'txt', s: (ganho > 0 ? '+' : '-') + Math.abs(ganho), x, y, y0: y, vida: 0.7, cor: ganho > 0 ? '#f2c14e' : '#e2645a' })
  }

  private fxParticulas(x: number, y: number, cores: readonly string[], n: number, forca: number): void {
    const r = semear(`fx|${x}|${y}|${this.J.fx.length}`)
    for (let i = 0; i < n; i++) {
      const vx = (r() - 0.5) * forca
      const vy = -r() * forca * 0.8
      this.J.fx.push({ tipo: 'p', x, y, vx, vy, vida: 0.35 + r() * 0.25, cor: cores[i % cores.length] ?? '#ffffff' })
    }
  }

  private efeitosTick(): void {
    const J = this.J
    for (const f of J.fx) {
      f.vida -= DT
      if (f.tipo === 'txt') {
        if (!J.reduzido) f.y = f.y0 - (0.7 - f.vida) * 10
      } else {
        f.vy += 160 * DT
        f.x += f.vx * DT
        f.y += f.vy * DT
      }
    }
    J.fx = J.fx.filter((f) => f.vida > 0)
    J.coice = Math.max(0, J.coice - DT / 0.12)
    J.flash = Math.max(0, J.flash - DT)
    J.tremor = Math.max(0, J.tremor - DT)
    J.nega = Math.max(0, J.nega - DT)
    J.ja = Math.max(0, J.ja - DT)
    J.dicaT = Math.max(0, J.dicaT - DT)
  }

  private dica(msg: string, ruim = false): void {
    this.J.dicaMsg = msg
    this.J.dicaRuim = ruim
    this.J.dicaT = DICA_S
  }

  private efeito(e: EventoDaRodada): void {
    const J = this.J
    for (const [nome, v] of sonsDoEvento(e)) this.ganchos.som(nome, v)
    switch (e.nome) {
      case 'acerto':
      case 'proibido':
      case 'erro': {
        J.giro++
        J.coice = 1
        J.flash = 0.06
        J.alvoFlash = [Math.round(e.x), Math.round(e.y)]
        J.dicaT = 0
        if (!J.reduzido) J.tremor = e.nome === 'proibido' ? 0.16 : 0.07
        if (e.nome === 'erro') {
          J.furos.push([e.x, e.y])
          if (J.furos.length > FUROS_MAX) J.furos.shift()
          this.fxParticulas(e.x, e.y, ['#8a6a46', '#c9a77a'], 4, 50)
          return
        }
        if (e.mat === 'vidro') this.fxParticulas(e.x, e.y, ['#3f8a63', '#9fe0b8', '#2f6b4c'], 8, 70)
        else if (e.mat === 'moeda') this.fxParticulas(e.x, e.y, ['#fff3c4', '#f2c14e'], 5, 60)
        else this.fxParticulas(e.x, e.y, ['#c9a77a', '#8a6a46'], 3, 40)
        if (e.nome === 'proibido') this.dica(`${TIPOS[e.tipo].nome}: −50 pontos e o combo zerou.`, true)
        this.fxTexto(e.x, e.y - 12, e.ganho)
        return
      }
      case 'seco':
        J.nega = 0.35
        this.dica(DICA_VAZIO, true)
        return
      case 'travado':
        this.dica('Recarregando: o tiro sai quando o tambor fechar.')
        return
      case 'recarga':
        this.dica('Recarregando…')
        return
      case 'pronto':
        this.dica(`${BALAS} balas no tambor.`)
        return
      case 'fim':
        this.dica('Fim da rodada.')
        return
    }
  }

  // ------------------------------------------------------------ entrada

  private podeAgir(): boolean {
    return !this.pausado && !this.pausaDoMestre && !this.encerrado
  }

  get emJogo(): boolean {
    return this.J.fase === 'contagem' || this.J.fase === 'rodada' || this.J.fase === 'fim'
  }

  /** Clique, toque, Espaço, A ou RT. Na contagem, só avisa. */
  pedirTiro(): void {
    if (this.J.fase === 'rodada' && this.podeAgir()) this.fila.atirar = Math.min(FILA_MAX, this.fila.atirar + 1)
    else if (this.J.fase === 'contagem') {
      this.dica('Espere o "Já!".')
      this.atualizar()
    }
  }

  /** R, botão direito, X ou o botão Recarregar. */
  pedirRecarga(): void {
    if (this.J.fase === 'rodada' && this.podeAgir()) this.fila.recarregar = true
  }

  /** Mouse e toque: a mira vai para o ponto do palco (em pixels de arte). */
  mirarEm(x: number, y: number): void {
    if (!this.emJogo || !this.podeAgir()) return
    this.J.mira.x = clamp(x, 0, W)
    this.J.mira.y = clamp(y, 0, H)
  }

  /**
   * Os atalhos do tiro, todos aqui: Esc pausa; R recarrega; Espaço atira;
   * setas miram. Devolve `true` quando a tecla é do jogo (a tela chama
   * `preventDefault`). Fora da rodada nenhuma tecla é do jogo.
   */
  tecla(code: string, apertou: boolean, repetida: boolean): boolean {
    if (!apertou) {
      if (SETAS.has(code)) this.setas.delete(code)
      return code === 'Space' && this.emJogo
    }
    if (!this.emJogo || this.encerrado) return false
    if (code === 'Escape') {
      this.alternarPausa()
      return true
    }
    if (this.pausado || this.pausaDoMestre) return false
    if (code === 'KeyR') {
      this.pedirRecarga()
      return true
    }
    if (code === 'Space') {
      if (!repetida) this.pedirTiro()
      return true
    }
    if (SETAS.has(code)) {
      this.setas.add(code)
      return true
    }
    return false
  }

  /** A janela perdeu o foco: nenhuma seta fica apertada sozinha. */
  soltarTudo(): void {
    this.setas.clear()
  }

  /** Esc, Start ou o botão Pausar: pausa (ou volta) só este jogador. */
  alternarPausa(): void {
    if (this.pausaDoMestre || this.encerrado || this.J.fase === 'fim' || !this.emJogo) return
    this.pausado = !this.pausado
    this.setas.clear()
    this.atualizar()
  }

  pausar(): void {
    if (!this.pausado) this.alternarPausa()
  }

  retomar(): void {
    if (this.pausado) this.alternarPausa()
  }

  definirPausaDoMestre(pausada: boolean): void {
    if (this.pausaDoMestre === pausada) return
    this.pausaDoMestre = pausada
    this.setas.clear()
    this.atualizar()
  }

  private lerControles(): void {
    let ax = 0
    let ay = 0
    for (const pad of this.ambiente.controles()) {
      if (pad === null) continue
      const b = pad.buttons
      const ant = this.pads.get(pad.index) ?? { tiro: false, x: false, start: false, a: false }
      const apertado = (i: number): boolean => {
        const botao = b[i]
        return botao !== undefined && (botao.pressed || botao.value > 0.5)
      }
      const a = apertado(0)
      const tiro = a || apertado(7)
      const x = apertado(2)
      const start = apertado(9)
      const eixoX = pad.axes[0] ?? 0
      const eixoY = pad.axes[1] ?? 0
      const mag = Math.hypot(eixoX, eixoY)
      if (mag > ZONA_MORTA) {
        const k = (mag - ZONA_MORTA) / (1 - ZONA_MORTA)
        const v = (k * k * MIRA_ANALOGICO) / mag
        ax += eixoX * v
        ay += eixoY * v
      }
      if (tiro && !ant.tiro && this.emJogo) this.pedirTiro()
      if (a && !ant.a && !this.emJogo) this.ganchos.confirmar()
      if (x && !ant.x) this.pedirRecarga()
      if (start && !ant.start) this.alternarPausa()
      this.pads.set(pad.index, { tiro, x, start, a })
    }
    this.eixo.x = ax
    this.eixo.y = ay
  }

  // ------------------------------------------------------------ instantâneo

  private hud(): HudDoTiro {
    const J = this.J
    const R = J.R
    const contagem = J.fase === 'contagem' ? 'Prontos…' : J.ja > 0 ? 'Já!' : null
    if (R === null) {
      return { tempo: '0:00', pouco: false, pontos: 0, combo: 0, mult: '×1', prec: '—', balas: BALAS, recarregando: false, balasTxt: `${BALAS} de ${BALAS} balas no tambor`, podeRecarregar: false, dica: DICA_PADRAO, dicaRuim: false, contagem, giro: 0, nega: false }
    }
    const resta = J.fase === 'contagem' ? R.D.tempo : R.D.tempo - R.t
    const vazio = R.balas === 0 && R.recarga <= 0
    const dica = J.fase === 'contagem' ? DICA_CONTAGEM : J.dicaT > 0 ? J.dicaMsg : J.fase === 'fim' ? 'Fim da rodada.' : vazio ? DICA_VAZIO : DICA_PADRAO
    return {
      tempo: fmtT(resta),
      pouco: resta <= 5 && J.fase === 'rodada',
      pontos: R.pontos,
      combo: R.combo,
      mult: `×${fmtDec(mult(R.combo)).replace(',0', '')}`,
      prec: pctTxt(R.acertos, R.tiros),
      balas: R.balas,
      recarregando: R.recarga > 0,
      balasTxt: R.recarga > 0 ? `Girando o tambor: ${fmtDec(R.recarga)} s` : `${R.balas} de ${BALAS} balas no tambor`,
      podeRecarregar: J.fase === 'rodada' && R.recarga <= 0 && R.balas < BALAS,
      dica,
      dicaRuim: (J.dicaT > 0 && J.dicaRuim) || vazio,
      contagem,
      giro: J.giro,
      nega: J.nega > 0,
    }
  }

  /** Refaz o instantâneo se algo que a tela mostra mudou. */
  atualizar(): void {
    const novo = this.montar()
    const chave = this.chaveDe(novo)
    if (chave === this.chave) return
    this.chave = chave
    this.inst = novo
    for (const o of this.ouvintes) o()
  }

  private montar(): InstantaneoDoTiro {
    return {
      fase: this.J.fase,
      dif: this.J.dif,
      rodada: this.J.rodada,
      pausado: this.pausado,
      pausaDoMestre: this.pausaDoMestre,
      encerrado: this.encerrado,
      hud: this.hud(),
      resultado: this.resultado,
    }
  }

  private chaveDe(i: InstantaneoDoTiro): string {
    const h = i.hud
    return [i.fase, i.dif, i.rodada, i.pausado, i.pausaDoMestre, i.encerrado, i.resultado === null ? '' : i.resultado.tipo, h.tempo, h.pouco, h.pontos, h.combo, h.prec, h.balas, h.balasTxt, h.podeRecarregar, h.dica, h.dicaRuim, h.contagem, h.giro, h.nega].join('|')
  }
}
