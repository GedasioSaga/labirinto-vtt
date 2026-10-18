import { desenharInstr, desenharLago, DUR, type CenaDaPesca, type FaseDaPesca } from '../arte'
import { DIF, DT, estrelas, faixa, forcaNoTempo, novaPuxada, passo, sortear, type DificuldadeSim, type FaixaDoLance, type Peixe, type Politica, type Sorteio } from '../sim'
import type { NomeDoSom } from '../som'
import { itensDoBau, textoDoHud, type TextoDoHud } from './textos'

/**
 * MOTOR DA PESCA no aparelho do jogador: a máquina de fases do protótipo
 * aprovado (`passoJogo`, `terminar`, `tick`, entrada por fontes) com N lances
 * por chamada. Passo fixo `DT` (a mesma semente dá a mesma puxada em qualquer
 * aparelho), laço de quadros pelo `AmbienteDaPesca` (o teste e a vitrine
 * trocam) e um instantâneo imutável para o React, que só muda quando a fase,
 * o texto da coluna, a pausa ou o "segurando" mudam — nunca a cada quadro.
 */

export const FASES_NA_AGUA: ReadonlySet<FaseDaPesca> = new Set<FaseDaPesca>(['lance', 'voo', 'espera', 'cedo', 'fisgada', 'puxada', 'final'])

/** Quanto o "Puxou cedo" fica na tela antes de voltar ao lance (protótipo). */
const CEDO_S = 1.1
/** Durante a puxada o texto do medidor muda no máximo a cada 100 ms. */
const HUD_PUXADA_MS = 100
/** Um quadro lento não vira uma rajada de passos: no máximo 24 (0,2 s) por quadro. */
const PASSOS_MAX_POR_QUADRO = 24

export type DesfechoNoMotor = 'pegou' | 'escapou' | 'fugiu'
/** `perdido`: segurou o baú, mas ele foi junto com o peixe que escapou. */
export type BauDoLance = 'pego' | 'perdido' | 'sumiu'

export interface ResultadoDoLance {
  tipo: DesfechoNoMotor
  /** O lance que acabou (1..N). */
  lance: number
  dif: DificuldadeSim
  peixe: Peixe
  cm: number
  dist: number
  faixa: FaixaDoLance
  /** Tempo até apertar depois do "!", em s. */
  reacao: number
  /** Duração da puxada, em s (0 sem puxada). */
  tempo: number
  perfeito: boolean
  /** 0 fora do pegou. */
  estrelas: number
  bau: BauDoLance | null
  itens: [string, string] | null
}

export interface AmbienteDaPesca {
  agora(): number
  quadro(f: (agora: number) => void): number
  cancelarQuadro(id: number): void
  controles(): readonly (Gamepad | null)[]
}

export const AMBIENTE_DO_NAVEGADOR: AmbienteDaPesca = {
  agora: () => performance.now(),
  quadro: (f) => requestAnimationFrame(f),
  cancelarQuadro: (id) => cancelAnimationFrame(id),
  controles: () => (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []),
}

export interface GanchosDoMotor {
  som(nome: NomeDoSom, v?: number): void
  /** O lance acabou (pegou, escapou ou fugiu): a tela manda à conexão na hora. */
  fimDoLance(r: ResultadoDoLance): void
  /** Depois de cada quadro: a tela manda o vivo ao mestre. */
  quadro(): void
  /** Botão A do controle fora da água: o mesmo que o botão principal da tela. */
  confirmar(): void
}

const GANCHOS_MUDOS: GanchosDoMotor = { som: () => undefined, fimDoLance: () => undefined, quadro: () => undefined, confirmar: () => undefined }

export interface InstantaneoDaPesca {
  fase: FaseDaPesca
  /** O lance de agora (1..N); no resultado, o que acabou. */
  lance: number
  lances: number
  pausado: boolean
  pausaDoMestre: boolean
  segurando: boolean
  hud: TextoDoHud
  /** Os lances que acabaram, na ordem. */
  resultados: readonly ResultadoDoLance[]
  encerrado: boolean
}

interface EstadoDoJogo extends CenaDaPesca {
  tCarga: number
  semente: string
  sorteio: Sorteio | null
  belIdx: number
  reacao: number
  carretel: number
}

interface Controle {
  seg: boolean
  a: boolean
  start: boolean
}

export class MotorDaPesca {
  readonly J: EstadoDoJogo
  /** Medida do quadro durante a puxada (intervalo entre quadros e trabalho do quadro, em ms). */
  readonly amostras: { intervalos: number[]; trabalho: number[] } = { intervalos: [], trabalho: [] }
  ganchos: GanchosDoMotor = GANCHOS_MUDOS
  telas: { lago: CanvasRenderingContext2D | null; instr: CanvasRenderingContext2D | null } = { lago: null, instr: null }

  private readonly ambiente: AmbienteDaPesca
  private readonly fontes = new Set<string>()
  private readonly pads = new Map<string, Controle>()
  private readonly ouvintes = new Set<() => void>()
  private resultados: ResultadoDoLance[] = []
  private pausado = false
  private pausaDoMestre = false
  private encerrado = false
  private lances = 1
  private base = ''
  private arremessos = 0
  private acum = 0
  private ultimo = 0
  private idQuadro = 0
  private rodando = false
  private hud: TextoDoHud
  private hudEm = -Infinity
  private chave = ''
  private inst: InstantaneoDaPesca

  constructor(ambiente: AmbienteDaPesca = AMBIENTE_DO_NAVEGADOR, reduzido = false) {
    this.ambiente = ambiente
    this.J = {
      fase: 'convite', dif: 'normal', n: 0, t: 0, tFase: 0, carregando: false, forca: 0, dist: 0, beliscou: -9, giro: 0, reduzido,
      puxada: null, resultado: null, tCarga: 0, semente: '', sorteio: null, belIdx: 0, reacao: 0, carretel: 0,
    }
    this.hud = textoDoHud(this.J)
    this.inst = this.montar()
    this.chave = this.chaveDe(this.inst)
  }

  // ------------------------------------------------------------ React

  assinar = (ouvinte: () => void): (() => void) => {
    this.ouvintes.add(ouvinte)
    return () => this.ouvintes.delete(ouvinte)
  }

  lerInstantaneo = (): InstantaneoDaPesca => this.inst

  /** O lance de agora: o próximo a acabar, ou o último que acabou (no resultado). */
  get lanceAtual(): number {
    const feitos = this.resultados.length
    return this.J.fase === 'resultado' ? Math.max(1, feitos) : Math.min(this.lances, feitos + 1)
  }

  get segurando(): boolean {
    return this.fontes.size > 0
  }

  set reduzido(v: boolean) {
    this.J.reduzido = v
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
    const t0 = this.ambiente.agora()
    const intervalo = this.ultimo ? agora - this.ultimo : 0
    this.ultimo = agora
    this.lerControles()
    this.avancar(intervalo / 1000)
    this.desenhar()
    this.atualizar(agora)
    this.ganchos.quadro()
    if (this.J.fase === 'puxada' && !this.pausado && !this.pausaDoMestre && intervalo > 0) {
      const { intervalos, trabalho } = this.amostras
      if (intervalos.length > 6000) {
        intervalos.splice(0, 3000)
        trabalho.splice(0, 3000)
      }
      intervalos.push(intervalo)
      trabalho.push(this.ambiente.agora() - t0)
    }
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

  /** Para o teste e a vitrine: N segundos em passos fixos; a política (robô) segura pela fonte "robo" na puxada. */
  rodar(segundos: number, politica?: Politica): void {
    const n = Math.round(segundos / DT)
    for (let i = 0; i < n; i++) {
      const e = this.J.puxada
      if (politica !== undefined && this.J.fase === 'puxada' && e !== null) {
        const quer = politica(e)
        if (quer && !this.fontes.has('robo')) this.apertar('robo')
        else if (!quer && this.fontes.has('robo')) this.soltar('robo')
      }
      this.tick()
    }
    this.atualizar(this.ambiente.agora())
  }

  desenhar(): void {
    const { lago, instr } = this.telas
    if (lago !== null) desenharLago(lago, this.J, this.segurando)
    if (instr !== null && FASES_NA_AGUA.has(this.J.fase)) desenharInstr(instr, this.J)
  }

  /** Um passo fixo. A pausa do mestre para tudo (a água também); a do jogador, só o relógio dele. */
  tick(): void {
    if (this.pausaDoMestre) return
    if (this.pausado) return
    this.J.t += DT
    if (FASES_NA_AGUA.has(this.J.fase)) this.passoJogo(DT)
  }

  // ------------------------------------------------------------ partida

  /** O Pronto saiu: N lances na dificuldade `dif`. `base` separa a semente desta pesca, deste jogador. */
  comecar(dif: DificuldadeSim, lances: number, base: string): void {
    this.J.dif = dif
    this.lances = Math.max(1, Math.round(lances))
    this.base = base
    this.resultados = []
    this.arremessos = 0
    this.encerrado = false
    this.novoLance()
  }

  /** "Próximo lance" do resultado. `false` = acabaram os lances, ou a pesca acabou. */
  proximoLance(): boolean {
    if (this.J.fase !== 'resultado' || this.encerrado || this.resultados.length >= this.lances) return false
    this.novoLance()
    return true
  }

  /** O mestre encerrou (ou a conexão caiu): o lance na água para onde está e nada mais sai. */
  encerrar(): void {
    if (this.encerrado) return
    this.encerrado = true
    this.fontes.clear()
    this.pausado = false
    const J = this.J
    if (FASES_NA_AGUA.has(J.fase)) {
      J.carregando = false
      J.resultado = { tipo: 'encerrado', peixe: J.sorteio?.peixe ?? null }
      this.entrarFase('resultado')
    }
    this.atualizar(this.ambiente.agora())
  }

  private novoLance(): void {
    const J = this.J
    this.fontes.clear()
    this.pausado = false
    J.carregando = false
    J.forca = 0
    J.puxada = null
    J.resultado = null
    this.entrarFase('lance')
    this.atualizar(this.ambiente.agora())
  }

  private entrarFase(f: FaseDaPesca): void {
    this.J.fase = f
    this.J.tFase = 0
  }

  private tocar(nome: NomeDoSom, v?: number): void {
    this.ganchos.som(nome, v)
  }

  private apertou(): void {
    const J = this.J
    if (J.fase === 'lance') {
      J.carregando = true
      J.tCarga = 0
      J.forca = 0
    } else if (J.fase === 'espera') {
      this.tocar('splash', 0.35)
      this.entrarFase('cedo')
    } else if (J.fase === 'fisgada') this.fisgar()
  }

  private soltou(): void {
    if (this.J.fase === 'lance' && this.J.carregando) this.lancar()
  }

  private lancar(): void {
    const J = this.J
    J.carregando = false
    J.dist = Math.max(0.05, J.forca)
    J.n++
    this.arremessos++
    J.semente = `${this.base}|${J.dif}|${this.arremessos}`
    J.sorteio = sortear(J.dif, J.dist, J.semente)
    J.belIdx = 0
    J.beliscou = -9
    J.puxada = null
    this.tocar('lance')
    this.entrarFase('voo')
  }

  private fisgar(): void {
    const J = this.J
    if (J.sorteio === null) return
    J.reacao = J.tFase
    J.puxada = novaPuxada(J.dif, J.sorteio.peixe, J.semente)
    J.carretel = 0
    this.entrarFase('puxada')
  }

  private passoJogo(dt: number): void {
    const J = this.J
    J.tFase += dt
    const d = DIF[J.dif]
    switch (J.fase) {
      case 'lance':
        if (J.carregando) {
          J.tCarga += dt
          J.forca = forcaNoTempo(J.tCarga, d.ciclo)
        }
        return
      case 'voo':
        if (J.tFase >= DUR.voo(J.reduzido)) {
          this.tocar('splash', 0.6 + J.dist * 0.4)
          this.entrarFase('espera')
        }
        return
      case 'espera': {
        const s = J.sorteio
        if (s === null) return
        const b = s.beliscadas[J.belIdx]
        if (b !== undefined && J.tFase >= b) {
          J.belIdx++
          J.beliscou = J.tFase
          this.tocar('beliscada')
        }
        if (J.tFase >= s.espera) {
          this.entrarFase('fisgada')
          this.tocar('fisgada')
        }
        return
      }
      case 'fisgada':
        if (J.tFase >= d.janela) this.terminar('fugiu')
        return
      case 'puxada': {
        const e = J.puxada
        if (e === null) return
        const bauAntes = e.bau?.estado
        const yAntes = e.b.y
        passo(e, this.segurando)
        const subiu = e.b.y - yAntes
        J.giro += subiu * 40
        if (subiu > 0) {
          J.carretel += subiu
          if (J.carretel >= 0.06) {
            J.carretel = 0
            this.tocar('catraca', 0.6 + Math.min(0.4, e.b.v * 0.3))
          }
        }
        if (e.bau !== null && bauAntes !== 'pego' && e.bau.estado === 'pego') this.tocar('bau')
        if (e.fim !== null) this.terminar(e.fim)
        return
      }
      case 'cedo':
        if (J.tFase >= CEDO_S) this.entrarFase('lance')
        return
      case 'final':
        if (J.tFase >= DUR.final(J.reduzido)) this.entrarFase('resultado')
        return
      default:
        return
    }
  }

  private terminar(tipo: DesfechoNoMotor): void {
    const J = this.J
    const s = J.sorteio
    if (s === null) return
    const e = J.puxada
    const perfeito = e !== null && e.fim === 'pegou' && e.perfeito
    let bau: BauDoLance | null = null
    if (e !== null && e.bau !== null && (e.bau.estado === 'pego' || e.bau.estado === 'sumiu')) bau = e.bau.estado === 'pego' ? (tipo === 'pegou' ? 'pego' : 'perdido') : 'sumiu'
    const r: ResultadoDoLance = {
      tipo,
      lance: this.resultados.length + 1,
      dif: J.dif,
      peixe: s.peixe,
      cm: s.cm,
      dist: J.dist,
      faixa: faixa(J.dist),
      reacao: J.reacao,
      tempo: e === null ? 0 : e.t,
      perfeito,
      estrelas: tipo === 'pegou' ? estrelas(J.dist, perfeito) : 0,
      bau,
      itens: bau === 'pego' ? itensDoBau(J.semente) : null,
    }
    this.resultados = [...this.resultados, r]
    this.tocar(tipo === 'pegou' ? 'pegou' : 'escapou')
    J.resultado = tipo === 'pegou' ? { tipo, peixe: s.peixe } : { tipo, peixe: s.peixe }
    J.carregando = false
    this.entrarFase('final')
    this.ganchos.fimDoLance(r)
  }

  // ------------------------------------------------------------ entrada

  private podeSegurar(): boolean {
    return FASES_NA_AGUA.has(this.J.fase) && !this.pausado && !this.pausaDoMestre && !this.encerrado
  }

  /** Uma fonte (tecla, dedo, botão do controle, robô) começou a segurar. */
  apertar(id: string): void {
    if (!this.podeSegurar()) return
    const primeiro = this.fontes.size === 0
    this.fontes.add(id)
    if (primeiro) this.apertou()
    this.atualizar(this.ambiente.agora())
  }

  soltar(id: string): void {
    if (!this.fontes.delete(id)) return
    if (this.fontes.size === 0) this.soltou()
    this.atualizar(this.ambiente.agora())
  }

  /** A janela perdeu o foco: nada fica segurado sozinho. */
  soltarTudo(): void {
    if (this.fontes.size === 0) return
    this.fontes.clear()
    this.soltou()
    this.atualizar(this.ambiente.agora())
  }

  /** Esc ou Start: pausa (ou volta) só este jogador. Fora da água, ou com o mestre pausando, não faz nada. */
  alternarPausa(): void {
    if (this.pausaDoMestre || this.encerrado) return
    if (this.pausado) {
      this.retomar()
      return
    }
    if (!FASES_NA_AGUA.has(this.J.fase)) return
    this.soltarTudo()
    this.pausado = true
    this.atualizar(this.ambiente.agora())
  }

  pausar(): void {
    if (!this.pausado) this.alternarPausa()
  }

  retomar(): void {
    if (!this.pausado) return
    this.pausado = false
    this.atualizar(this.ambiente.agora())
  }

  definirPausaDoMestre(pausada: boolean): void {
    if (this.pausaDoMestre === pausada) return
    if (pausada) this.soltarTudo()
    this.pausaDoMestre = pausada
    this.atualizar(this.ambiente.agora())
  }

  private lerControles(): void {
    for (const pad of this.ambiente.controles()) {
      if (pad === null) continue
      const b = pad.buttons
      const id = `g${pad.index}`
      const ant = this.pads.get(id) ?? { seg: false, a: false, start: false }
      const a = b[0]?.pressed === true
      const rt = b[7]
      const seg = a || (rt !== undefined && (rt.pressed || rt.value > 0.35))
      const start = b[9]?.pressed === true
      if (seg && !ant.seg) this.apertar(id)
      else if (!seg && ant.seg) this.soltar(id)
      if (a && !ant.a && !FASES_NA_AGUA.has(this.J.fase)) this.ganchos.confirmar()
      if (start && !ant.start) this.alternarPausa()
      this.pads.set(id, { seg, a, start })
    }
  }

  // ------------------------------------------------------------ instantâneo

  /** Refaz o instantâneo se algo que a tela mostra mudou; o texto do medidor anda a 10 por segundo. */
  atualizar(agora: number): void {
    const puxando = this.J.fase === 'puxada'
    if (!puxando || agora - this.hudEm >= HUD_PUXADA_MS || this.inst.fase !== 'puxada') {
      this.hud = textoDoHud(this.J)
      this.hudEm = agora
    }
    const novo = this.montar()
    const chave = this.chaveDe(novo)
    if (chave === this.chave) return
    this.chave = chave
    this.inst = novo
    for (const o of this.ouvintes) o()
  }

  private montar(): InstantaneoDaPesca {
    return {
      fase: this.J.fase,
      lance: this.lanceAtual,
      lances: this.lances,
      pausado: this.pausado,
      pausaDoMestre: this.pausaDoMestre,
      segurando: this.segurando,
      hud: this.hud,
      resultados: this.resultados,
      encerrado: this.encerrado,
    }
  }

  private chaveDe(i: InstantaneoDaPesca): string {
    return [i.fase, i.lance, i.lances, i.pausado, i.pausaDoMestre, i.segurando, i.hud.titulo, i.hud.dica, i.hud.tom, i.resultados.length, i.encerrado].join('|')
  }
}
