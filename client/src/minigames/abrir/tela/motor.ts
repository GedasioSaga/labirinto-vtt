import { desenharFlash, desenharSusto, tremorDoSusto } from '../../armadilha/arte'
import { criarSusto, passoSusto, type Bicho, type Susto } from '../../armadilha/sim'
import { COR, H, W } from '../desenho'
import { DT, LIMITE_S, SEM_ENTRADA, type Dificuldade, type Entrada, type Evento } from '../tipos'
import type { JogoNaTela, Tentativa } from './jogos'

/**
 * MOTOR DOS JOGOS DE ABRIR no aparelho do jogador: o motor da vitrine aprovada
 * (~/jogos/bau-e-armadilhas/vitrine/motor.ts) com a armadilha vinda do host.
 * Passo fixo DT com acumulador (teto de 24 passos e 0,1 s por quadro), laço
 * pelo `AmbienteDoMotor` (o teste troca) e um instantâneo imutável para o
 * React, que só muda com a fase, o segundo da vela ou o progresso.
 *
 * Fases: parado -> jogando -> abrindo -> (aguardando) -> (susto) -> abriu,
 * ou jogando -> naoAbriu (teto de 20 s). Ao abrir, o motor avisa `venceu` e
 * espera o desfecho do host; a armadilha é surpresa: nada no jogo avisa.
 */

export type FaseDoMotor = 'parado' | 'jogando' | 'abrindo' | 'aguardando' | 'susto' | 'abriu' | 'naoAbriu'

/** O que o motor precisa do desfecho do host: o bicho (ou nenhum) e se o susto pode saltar. */
export interface DesfechoNoMotor {
  armadilha: Bicho | null
  /** false = o mapa desligou o susto: a versão parada, como no movimento reduzido, com som. */
  jumpscare: boolean
}

export interface GanchosDoMotor {
  /** Um som do jogo ou do susto, para tocar agora. */
  som(ev: Evento, origem: 'jogo' | 'susto'): void
  /** A fase mudou (já trocada). */
  fase(f: FaseDoMotor): void
  /** O jogo abriu: uma vez por tentativa vencida, antes da animação de abrir. */
  venceu(): void
  /** Primeiro toque ou primeiro segurar da tentativa (a dica de objetivo some). */
  primeiraEntrada(): void
}

const GANCHOS_MUDOS: GanchosDoMotor = { som: () => undefined, fase: () => undefined, venceu: () => undefined, primeiraEntrada: () => undefined }

/** Relógio e quadro, trocáveis no teste. */
export interface AmbienteDoMotor {
  agora(): number
  quadro(f: (t: number) => void): number
  cancelarQuadro(id: number): void
}

export const AMBIENTE_DO_NAVEGADOR: AmbienteDoMotor = {
  agora: () => performance.now(),
  quadro: (f) => requestAnimationFrame(f),
  cancelarQuadro: (id) => cancelAnimationFrame(id),
}

export interface InstantaneoDoMotor {
  fase: FaseDoMotor
  /** Segundos inteiros que a vela ainda tem (o HUD). */
  restaS: number
  /** 0..100, até abrir. */
  progresso: number
  /** Em quanto tempo a tentativa acabou, em s; null enquanto anda. */
  tempoDoFim: number | null
}

/** Teto de passos por quadro: depois de um engasgo, o jogo não corre para alcançar. */
const MAX_PASSOS_POR_QUADRO = 24
/** Toques guardados no máximo (um por passo de 1/120 s): mais que isso é rajada, não jogada. */
const MAX_TOQUES_NA_FILA = 4
/** Sem armadilha, quanto o recipiente fica aberto antes do cartão de resultado, em s. */
const PAUSA_ANTES_DO_RESULTADO = 0.35

export class MotorDeAbrir {
  ganchos: GanchosDoMotor = GANCHOS_MUDOS
  /** Movimento reduzido vale na hora; o susto lê o valor de quando começa. */
  reduzido: boolean

  private readonly jogo: JogoNaTela
  private readonly dif: Dificuldade
  private readonly ambiente: AmbienteDoMotor
  private readonly robo: boolean
  private readonly fontes = new Set<string>()
  /** Toques que ainda não chegaram ao jogo, um por passo (dois no mesmo quadro não viram um). */
  private readonly toques: number[] = []
  private readonly ouvintes = new Set<() => void>()
  private g: CanvasRenderingContext2D | null = null
  private tentativa: Tentativa
  private fase: FaseDoMotor = 'parado'
  private susto: Susto | null = null
  private desfecho: DesfechoNoMotor | null = null
  private tempoDoFim: number | null = null
  private acum = 0
  private ultimo = 0
  private idQuadro = 0
  private rodando = false
  private pausado = false
  private depois = 0
  /** Já houve entrada nesta tentativa (o gancho `primeiraEntrada` sai uma vez só). */
  private entrou = false
  private inst: InstantaneoDoMotor
  private chave = ''

  constructor(jogo: JogoNaTela, dif: Dificuldade, semente: string, opcoes: { ambiente?: AmbienteDoMotor; reduzido?: boolean; robo?: boolean } = {}) {
    this.jogo = jogo
    this.dif = dif
    this.ambiente = opcoes.ambiente ?? AMBIENTE_DO_NAVEGADOR
    this.reduzido = opcoes.reduzido === true
    this.robo = opcoes.robo === true
    this.tentativa = jogo.nova(semente, dif, this.robo)
    this.inst = this.montar()
    this.chave = this.chaveDe(this.inst)
  }

  // ------------------------------------------------------------ React

  assinar = (ouvinte: () => void): (() => void) => {
    this.ouvintes.add(ouvinte)
    return () => this.ouvintes.delete(ouvinte)
  }

  lerInstantaneo = (): InstantaneoDoMotor => this.inst

  get faseAtual(): FaseDoMotor {
    return this.fase
  }

  /** O canvas onde o motor desenha (null ao desmontar). */
  definirTela(g: CanvasRenderingContext2D | null): void {
    this.g = g
    if (g !== null) {
      g.imageSmoothingEnabled = false
      this.desenhar()
    }
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
    this.g = null
  }

  private aoQuadro = (t: number): void => {
    if (!this.rodando) return
    this.idQuadro = this.ambiente.quadro(this.aoQuadro)
    const dt = this.ultimo && !this.pausado ? Math.min(0.1, Math.max(0, (t - this.ultimo) / 1000)) : 0
    this.ultimo = t
    this.acum += dt
    let n = 0
    while (this.acum >= DT && n < MAX_PASSOS_POR_QUADRO) {
      this.tick()
      this.acum -= DT
      n++
    }
    if (n === MAX_PASSOS_POR_QUADRO) this.acum = 0
    this.desenhar()
    this.atualizar()
  }

  // ------------------------------------------------------------ partida

  /** Começa a tentativa. Fora do "parado" (o "Tentar de novo"), troca antes por uma nova com `semente`. */
  comecar(semente: string): void {
    if (this.fase !== 'parado') this.tentativa = this.jogo.nova(semente, this.dif, this.robo)
    this.fontes.clear()
    this.toques.length = 0
    this.susto = null
    this.tempoDoFim = null
    this.acum = 0
    this.ultimo = 0
    this.depois = 0
    this.entrou = false
    this.mudarFase('jogando')
    this.desenhar()
    this.atualizar()
  }

  /** O desfecho chegou do host (ou saiu: null). Só é lido depois da vitória. */
  definirDesfecho(d: DesfechoNoMotor | null): void {
    this.desfecho = d
  }

  /** Uma fonte (dedo, tecla) apertou mirando `alvo`. Fora do jogo, ou com o robô jogando, não conta. */
  apertar(fonte: string, alvo: number): void {
    if (this.fase !== 'jogando' || this.robo || alvo < 0) return
    if (!this.fontes.has(fonte) && this.toques.length < MAX_TOQUES_NA_FILA) this.toques.push(alvo)
    this.fontes.add(fonte)
  }

  soltar(fonte: string): void {
    this.fontes.delete(fonte)
  }

  /** A janela perdeu o foco: nada fica preso apertado. */
  soltarTudo(): void {
    this.fontes.clear()
  }

  /** Aba escondida: o relógio do jogo para. */
  pausar(): void {
    this.pausado = true
    this.soltarTudo()
  }

  retomar(): void {
    this.pausado = false
    this.ultimo = 0
  }

  /** Alvo no ponto (x, y) da tela lógica de 240x135; -1 = nada. */
  alvoEm(x: number, y: number): number {
    return this.tentativa.alvoEm(x, y)
  }

  private mudarFase(f: FaseDoMotor): void {
    if (this.fase === f) return
    this.fase = f
    this.ganchos.fase(f)
  }

  private entrada(): Entrada {
    const ent = { segurando: this.fontes.size > 0, toque: this.toques.shift() ?? -1 }
    if (!this.entrou && (ent.toque >= 0 || ent.segurando)) {
      this.entrou = true
      this.ganchos.primeiraEntrada()
    }
    return ent
  }

  private emitir(eventos: readonly Evento[], origem: 'jogo' | 'susto'): void {
    for (const ev of eventos) this.ganchos.som(ev, origem)
  }

  /** O recipiente acabou de abrir: espera o desfecho, solta o bicho ou mostra o resultado. */
  private resolver(): void {
    const d = this.desfecho
    if (d === null) {
      this.mudarFase('aguardando')
      return
    }
    if (d.armadilha !== null) {
      this.susto = criarSusto(d.armadilha, this.reduzido || !d.jumpscare, this.jogo.boca)
      this.mudarFase('susto')
      return
    }
    this.depois += DT
    if (this.depois >= PAUSA_ANTES_DO_RESULTADO) this.mudarFase('abriu')
  }

  /** Um passo de DT da fase atual. */
  private tick(): void {
    const t = this.tentativa
    switch (this.fase) {
      case 'jogando': {
        const fim = t.passo(this.entrada())
        this.emitir(t.eventos(), 'jogo')
        if (fim === null) return
        this.tempoDoFim = t.tempo()
        this.fontes.clear()
        this.toques.length = 0
        if (fim === 'tempo') {
          this.mudarFase('naoAbriu')
          return
        }
        this.mudarFase('abrindo')
        this.ganchos.venceu()
        return
      }
      case 'abrindo':
      case 'aguardando': {
        t.passo(SEM_ENTRADA)
        this.emitir(t.eventos(), 'jogo')
        if (t.abertura() >= 1) this.resolver()
        return
      }
      case 'susto': {
        t.passo(SEM_ENTRADA)
        const s = this.susto
        if (s === null) return
        const acabou = passoSusto(s)
        this.emitir(s.eventos, 'susto')
        if (acabou) this.mudarFase('abriu')
        return
      }
      case 'abriu':
      case 'naoAbriu':
        // Com o cartão na tela, o jogo segue só para a vela e a luz respirarem.
        t.passo(SEM_ENTRADA)
        return
      case 'parado':
        return
    }
  }

  /** Desenha o quadro: cena (deslocada pelo tremor do susto), bicho e flash. */
  desenhar(): void {
    const g = this.g
    if (g === null) return
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.fillStyle = COR.sombra
    g.fillRect(0, 0, W, H)
    const susto = this.fase === 'susto' ? this.susto : null
    const [dx, dy] = susto === null ? [0, 0] : tremorDoSusto(susto)
    g.save()
    g.translate(dx, dy)
    this.tentativa.desenhar(g, { reduzido: this.reduzido })
    if (susto !== null) desenharSusto(g, susto)
    g.restore()
    if (susto !== null) desenharFlash(g, susto)
  }

  // ------------------------------------------------------------ instantâneo

  private montar(): InstantaneoDoMotor {
    // Depois do fim a vela fica onde parou (o jogo segue só para a luz respirar).
    const tempo = this.tempoDoFim ?? this.tentativa.tempo()
    return {
      fase: this.fase,
      restaS: Math.max(0, Math.ceil(LIMITE_S - tempo - 1e-9)),
      progresso: Math.round(Math.max(0, Math.min(1, this.tentativa.progresso())) * 100),
      tempoDoFim: this.tempoDoFim,
    }
  }

  private chaveDe(i: InstantaneoDoMotor): string {
    return `${i.fase}|${i.restaS}|${i.progresso}|${i.tempoDoFim ?? ''}`
  }

  private atualizar(): void {
    const novo = this.montar()
    const chave = this.chaveDe(novo)
    if (chave === this.chave) return
    this.chave = chave
    this.inst = novo
    for (const o of this.ouvintes) o()
  }
}
