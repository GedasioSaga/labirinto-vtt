import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AlavancaFimMessage, AlavancaVivoMessage } from '../../../net/protocoloDaAlavanca'
import type { AlavancaDoJogador } from '../../../player/estadoDaAlavanca'
import { COR_DA_PRACA, CORES_J, desenharCena, desenharIcone, pontoDaPonte, SARILHO, type Poeira } from '../arte'
import { criarRng, DENTES, regras, VOLTAS, type Regras } from '../sim'
import { cadeia, CONTAGEM, continuo, evento, final, QUEDA, VOLUME, type CadeiaDeSom, type EventoDeSom } from '../som'
import { NOME_DA_DIFICULDADE_ALAVANCA } from '../tipos'
import './alavanca.css'

/**
 * A TELA DA ALAVANCA DA PONTE (jogador), fiel ao protótipo aprovado em
 * 20/11/2026: a cena no palco e, na coluna, o convite, a rodada e o
 * resultado. O HOST roda a partida: esta tela manda cada aperto
 * (`giroAlavanca`) e desenha a ponte que chega (`ouvirAlavanca`, 20 por
 * segundo), suavizada quadro a quadro. O retorno de cada aperto é só brilho
 * (a manivela e a marca de quem girou) e o baque do som.
 *
 * O laço do quadro escreve direto nos elementos (como o protótipo): a página
 * não redesenha em React a cada quadro.
 */

export interface AcoesDaAlavanca {
  prontoAlavanca(): boolean
  giroAlavanca(): boolean
  pausarAlavanca(): boolean
  continuarAlavanca(): boolean
  fecharAlavanca(): void
  pedirAlavanca(pinId: string): boolean
  ouvirAlavanca(ouvinte: (msg: AlavancaVivoMessage) => void): () => void
}

export interface AlavancaOverlayProps {
  alavanca: AlavancaDoJogador
  /** `undefined` antes de entrar na mesa: a tela só olha (ninguém é "Você"). */
  playerId: string | undefined
  acoes: AcoesDaAlavanca
}

type Tela = 'convite' | 'contagem' | 'rodada' | 'fim' | 'resultado'

const FIM_BAIXOU = 1.5
const FIM_SUBIU = QUEDA + 1.3
const CONGELA = 0.07
/** Quanto a ponte desenhada corre atrás da que chega do host (1/s). */
const SEGUE_A_PONTE = 25
/** Quanto do tempo local pode se afastar do relógio do host antes de saltar para ele. */
const TOLERANCIA_DO_RELOGIO_S = 0.15
const POEIRA_MAX = 90
const PREFS = 'labirinto.alavanca.prefs'

const virg = (v: number, c = 1): string => v.toFixed(c).replace('.', ',')

function lerSom(): boolean {
  try {
    const lido: unknown = JSON.parse(window.localStorage.getItem(PREFS) ?? 'null')
    return typeof lido === 'object' && lido !== null && 'som' in lido && typeof lido.som === 'boolean' ? lido.som : true
  } catch {
    return true
  }
}

function gravarSom(som: boolean): void {
  try {
    window.localStorage.setItem(PREFS, JSON.stringify({ som }))
  } catch {
    // Sem armazenamento (aba privada, cota cheia): segue sem lembrar.
  }
}

function movimentoReduzido(): MediaQueryList | null {
  return typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
}

interface Jogo {
  tela: Tela
  tFase: number
  R: Regras | null
  /** O índice deste jogador na rodada; -1 = só olha. */
  eu: number
  pAlvo: number
  pVis: number
  vel: number
  tensao: number
  solta: number
  tLocal: number
  giros: number[]
  pausado: boolean
  fimTipo: AlavancaFimMessage['tipo'] | null
  pFim: number
  bateu: boolean
  flash: number[]
  poeira: Poeira[]
  trauma: number
  congela: number
  tReal: number
  tCena: number
  tGiros: number[][]
  relogioDado: number
  dente: number
  contagemOn: boolean
}

function jogoNovo(): Jogo {
  return {
    tela: 'convite',
    tFase: 0,
    R: null,
    eu: -1,
    pAlvo: 0,
    pVis: 0,
    vel: 0,
    tensao: 0,
    solta: 0,
    tLocal: 0,
    giros: [],
    pausado: false,
    fimTipo: null,
    pFim: 0,
    bateu: false,
    flash: [0, 0, 0, 0],
    poeira: [],
    trauma: 0,
    congela: 0,
    tReal: 0,
    tCena: 0,
    tGiros: [[], [], [], []],
    relogioDado: 0,
    dente: 0,
    contagemOn: false,
  }
}

function textoDesfecho(ok: boolean, abrePorta: boolean): string {
  if (!ok) return 'No mapa, nada muda: a ponte continua erguida.'
  return abrePorta ? 'No mapa: uma porta se abre.' : 'No mapa: a ponte levadiça desce e o fosso pode ser atravessado.'
}

/** A cor de cada um na marca: a variável da lista, sem passar pelo estilo do React. */
function pintarCor(cor: string) {
  return (el: HTMLLIElement | null) => {
    el?.style.setProperty('--cor', cor)
  }
}

export function AlavancaOverlay(props: AlavancaOverlayProps) {
  return createPortal(<TelaDaAlavanca key={props.alavanca.sessao} {...props} />, document.body)
}

function TelaDaAlavanca({ alavanca, playerId, acoes }: AlavancaOverlayProps) {
  const { convite, comecar, fim, encerrada, estado } = alavanca
  const [tela, setTela] = useState<Tela>('convite')
  const [som, setSom] = useState(lerSom)
  const J = useRef<Jogo>(jogoNovo())
  const somRef = useRef(som)
  const audio = useRef<CadeiaDeSom | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const icone = useRef<HTMLCanvasElement>(null)
  const contagem = useRef<HTMLDivElement>(null)
  const anuncio = useRef<HTMLParagraphElement>(null)
  const hud = {
    tempo: useRef<HTMLElement>(null),
    tempoBarra: useRef<HTMLElement>(null),
    relogio: useRef<HTMLDivElement>(null),
    ponte: useRef<HTMLElement>(null),
    ponteBarra: useRef<HTMLElement>(null),
    medidorPonte: useRef<HTMLDivElement>(null),
    corrente: useRef<HTMLElement>(null),
    correnteBarra: useRef<HTMLElement>(null),
    medidorCorrente: useRef<HTMLDivElement>(null),
    dica: useRef<HTMLParagraphElement>(null),
    equipe: useRef<HTMLUListElement>(null),
  }
  const hudRefs = useRef(hud)
  hudRefs.current = hud
  const titulo = useRef<HTMLHeadingElement>(null)
  const fimRef = useRef(fim)
  fimRef.current = fim
  const ordem = comecar?.ordem ?? []
  const n = Math.max(1, ordem.length)

  const nomeDe = useCallback((j: number): string => {
    const quem = ordem[j]
    if (quem === undefined) return ''
    return quem.playerId === playerId ? 'Você' : quem.nome
  }, [ordem, playerId])
  const marcaDe = (j: number): string => (ordem[j]?.playerId === playerId ? 'X' : (ordem[j]?.nome.trim().charAt(0).toUpperCase() ?? '?'))

  // ---- áudio
  const garantirAudio = useCallback((): CadeiaDeSom | null => {
    const C = audio.current
    if (C !== null) {
      if (C.ctx instanceof AudioContext && C.ctx.state === 'suspended') void C.ctx.resume()
      return C
    }
    if (typeof AudioContext !== 'function') return null
    const ctx = new AudioContext()
    const nova = cadeia(ctx, ctx.destination, ctx.currentTime)
    nova.mestre.gain.value = somRef.current ? VOLUME : 0
    audio.current = nova
    return nova
  }, [])
  const tocar = useCallback((nome: EventoDeSom) => {
    const C = audio.current
    if (C === null || !somRef.current) return
    evento(C, nome, C.ctx.currentTime + 0.004)
  }, [])
  useEffect(
    () => () => {
      const C = audio.current
      if (C !== null && C.ctx instanceof AudioContext) void C.ctx.close()
      audio.current = null
    },
    [],
  )
  const alternarSom = () => {
    const novo = !somRef.current
    somRef.current = novo
    setSom(novo)
    gravarSom(novo)
    const C = audio.current
    if (C !== null) C.mestre.gain.setTargetAtTime(novo ? VOLUME : 0, C.ctx.currentTime, 0.02)
  }

  const anunciar = useCallback((txt: string) => {
    const el = anuncio.current
    if (el === null) return
    el.textContent = ''
    requestAnimationFrame(() => {
      el.textContent = txt
    })
  }, [])
  const mostrarContagem = (txt: string) => {
    const el = contagem.current
    J.current.contagemOn = txt !== ''
    if (el === null) return
    el.textContent = txt
    el.dataset.on = txt === '' ? '0' : '1'
  }
  const irPara = (nova: Tela) => {
    J.current.tela = nova
    setTela(nova)
  }

  const soltarPoeira = (x: number, y: number, quantos: number, forca: number, cor: string) => {
    const jogo = J.current
    const rng = criarRng(`${x}|${y}|${jogo.poeira.length}|${jogo.tReal.toFixed(3)}`)
    for (let i = 0; i < quantos && jogo.poeira.length < POEIRA_MAX; i++) {
      const vida = 0.5 + rng() * 0.6
      jogo.poeira.push({ x: x + (rng() - 0.5) * 6, y, vx: (rng() - 0.5) * 60 * forca, vy: -(10 + rng() * 26) * forca, r: 1.6 + rng() * 2.6, vida, max: vida, cor })
    }
  }

  /** Só brilho, sem escala: o X chega a 7 por segundo e uma escala reiniciando tremeria. */
  const pulsar = (j: number) => {
    const li = hudRefs.current.equipe.current?.children[j]
    const marca = li?.firstElementChild
    if (marca instanceof HTMLElement && typeof marca.animate === 'function') {
      marca.animate([{ filter: 'brightness(1.35)' }, { filter: 'brightness(1)' }], { duration: 120, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' })
    }
  }

  // ---- a rodada começa (o host mandou quem gira): "Prontos…"
  useEffect(() => {
    if (comecar === undefined) return
    const jogo = J.current
    const novo = jogoNovo()
    novo.R = regras({ dif: comecar.dificuldade, jogadores: comecar.ordem.length, tempo: comecar.tempo })
    novo.eu = comecar.ordem.findIndex((p) => p.playerId === playerId)
    novo.giros = comecar.ordem.map(() => 0)
    novo.tReal = jogo.tReal
    novo.tCena = jogo.tCena
    J.current = novo
    irPara('contagem')
    mostrarContagem('Prontos…')
    garantirAudio()
    tocar('prontos')
    // Só a mensagem nova de começo reinicia a rodada.
  }, [comecar])

  // ---- a pausa vem do host (de quem gira, ou do mestre)
  const pausaPor = estado?.fase === 'pausa' ? (estado.pausaPor ?? 'mestre') : null
  useEffect(() => {
    J.current.pausado = pausaPor !== null
    const C = audio.current
    if (pausaPor !== null && C !== null) continuo(C, C.ctx.currentTime, 0, 0, 0)
  }, [pausaPor])

  // ---- a ponte que chega do host
  useEffect(
    () =>
      acoes.ouvirAlavanca((msg) => {
        const jogo = J.current
        if (msg.sessao !== alavanca.sessao || (jogo.tela !== 'rodada' && jogo.tela !== 'contagem')) return
        jogo.pAlvo = msg.p
        jogo.vel = msg.vel
        jogo.tensao = msg.tensao
        if (Math.abs(jogo.tLocal - msg.t) > TOLERANCIA_DO_RELOGIO_S) jogo.tLocal = msg.t
        for (let j = 0; j < msg.giros.length; j++) {
          const antes = jogo.giros[j] ?? 0
          const agora = msg.giros[j]
          // Os apertos deste jogador já brilharam na hora; os dos outros brilham quando chegam.
          if (agora > antes && j !== jogo.eu) {
            jogo.flash[j] = 1
            for (let k = antes; k < agora; k++) jogo.tGiros[j].push(jogo.tLocal)
            if (jogo.tGiros[j].length > 40) jogo.tGiros[j].splice(0, jogo.tGiros[j].length - 40)
            pulsar(j)
            tocar('giro')
          }
          jogo.giros[j] = agora
        }
        if (msg.solta > 0 && jogo.solta === 0) {
          tocar('soltou')
          anunciar('A catraca soltou! Gire de novo.')
          if (!(movimentoReduzido()?.matches ?? false)) soltarPoeira(SARILHO.x + SARILHO.cx + 40, SARILHO.y + SARILHO.cy - 34, 4, 0.5, '#c9c2b4')
        } else if (msg.solta === 0 && jogo.solta > 0) tocar('pegou')
        jogo.solta = msg.solta
      }),
    // Um ouvinte por sessão.
    [acoes, alavanca.sessao],
  )

  // ---- o fim que o host decidiu
  useEffect(() => {
    if (fim === undefined) return
    const jogo = J.current
    const reduz = movimentoReduzido()?.matches ?? false
    mostrarContagem('')
    if (fim.tipo === 'encerrado') {
      irPara('resultado')
      return
    }
    jogo.fimTipo = fim.tipo
    jogo.tFase = 0
    jogo.solta = 0
    jogo.pAlvo = fim.p
    jogo.pFim = jogo.pVis
    const C = audio.current
    if (C !== null && somRef.current) final(C, C.ctx.currentTime + 0.004, fim.tipo)
    if (fim.tipo === 'baixou') {
      jogo.pVis = 1
      jogo.congela = CONGELA
      if (!reduz) jogo.trauma = Math.min(1, jogo.trauma + 0.62)
      const rng = criarRng('pouso')
      for (let i = 0; i < 26; i++) {
        const l = -1 + 2 * rng()
        const [x, y] = pontoDaPonte(1, 1, l * 1.05)
        soltarPoeira(x, y + 6, 1, reduz ? 0.2 : 1.1, COR_DA_PRACA)
      }
      anunciar('A ponte desceu!')
    } else anunciar('O tempo acabou. A corrente puxou a ponte de volta.')
    irPara('fim')
    // Só a mensagem de fim muda a tela.
  }, [fim])

  useEffect(() => {
    if (tela === 'resultado') titulo.current?.focus({ preventScroll: true })
  }, [tela])

  useEffect(() => {
    const c = icone.current
    if (c !== null) desenharIcone(c)
  }, [])

  // ---- apertos
  const apertar = useCallback(() => {
    const jogo = J.current
    if (jogo.tela !== 'rodada' || jogo.pausado || jogo.eu < 0) return
    garantirAudio()
    if (!acoes.giroAlavanca()) return
    jogo.flash[jogo.eu] = 1
    jogo.tGiros[jogo.eu].push(jogo.tLocal)
    if (jogo.tGiros[jogo.eu].length > 40) jogo.tGiros[jogo.eu].shift()
    pulsar(jogo.eu)
    tocar('giro')
  }, [acoes, garantirAudio, tocar])

  const alternarPausa = useCallback(() => {
    const jogo = J.current
    if (jogo.tela !== 'contagem' && jogo.tela !== 'rodada') return
    if (jogo.pausado) acoes.continuarAlavanca()
    else acoes.pausarAlavanca()
  }, [acoes])

  useEffect(() => {
    const desceu = (e: KeyboardEvent) => {
      const jogo = J.current
      if (e.code === 'Escape') {
        if (jogo.tela === 'contagem' || jogo.tela === 'rodada') {
          e.preventDefault()
          e.stopPropagation()
          alternarPausa()
        }
        return
      }
      if (e.code !== 'KeyX') return
      const alvo = e.target
      if (alvo instanceof HTMLInputElement || alvo instanceof HTMLTextAreaElement || alvo instanceof HTMLSelectElement) return
      if (jogo.tela !== 'rodada' && jogo.tela !== 'contagem') return
      e.preventDefault()
      e.stopPropagation()
      // Segurar o X não gira: cada aperto conta uma vez.
      if (e.repeat) return
      apertar()
    }
    window.addEventListener('keydown', desceu, true)
    return () => window.removeEventListener('keydown', desceu, true)
  }, [apertar, alternarPausa])

  // Sozinho, a aba que some pausa (em equipe, a aba de um não para a rodada de todos).
  useEffect(() => {
    const mudou = () => {
      const jogo = J.current
      if (document.hidden && jogo.tela === 'rodada' && !jogo.pausado && n === 1) acoes.pausarAlavanca()
    }
    document.addEventListener('visibilitychange', mudou)
    return () => document.removeEventListener('visibilitychange', mudou)
  }, [acoes, n])

  // ---- o laço do quadro
  useEffect(() => {
    let raf = 0
    let ultimo = 0
    let padAntes = { x: false, start: false }
    const hudCache: Record<string, string> = {}
    const definir = (el: HTMLElement | null, chave: string, valor: string) => {
      if (el === null || hudCache[chave] === valor) return
      hudCache[chave] = valor
      el.textContent = valor
    }
    const atributo = (el: HTMLElement | null, chave: string, nome: string, valor: string) => {
      if (el === null || hudCache[chave] === valor) return
      hudCache[chave] = valor
      el.setAttribute(nome, valor)
    }

    const lerControle = () => {
      const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []
      const pad = Array.from(pads).find((p) => p !== null)
      if (pad === undefined || pad === null) return
      const x = pad.buttons[2]?.pressed === true || pad.buttons[0]?.pressed === true
      const st = pad.buttons[9]?.pressed === true
      if (x && !padAntes.x) apertar()
      if (st && !padAntes.start) alternarPausa()
      padAntes = { x, start: st }
    }

    const avancar = (dt: number) => {
      const jogo = J.current
      const reduz = movimentoReduzido()?.matches ?? false
      if (jogo.pausado && (jogo.tela === 'contagem' || jogo.tela === 'rodada')) return
      jogo.tReal += dt
      if (!reduz) jogo.tCena += dt // água e tocha param no movimento reduzido
      for (let j = 0; j < 4; j++) jogo.flash[j] = Math.max(0, jogo.flash[j] - dt / 0.16)
      jogo.trauma = Math.max(0, jogo.trauma - dt * 1.3)
      for (const q of jogo.poeira) {
        q.vida -= dt
        q.x += q.vx * dt
        q.y += q.vy * dt
        q.vx *= Math.exp(-3 * dt)
        q.vy = q.vy * Math.exp(-3 * dt) + 14 * dt
      }
      if (jogo.poeira.length > 0 && jogo.poeira[0].vida <= 0) jogo.poeira = jogo.poeira.filter((q) => q.vida > 0)
      if (jogo.tela === 'contagem') {
        jogo.tFase += dt
        if (jogo.tFase >= CONTAGEM - 1e-9) {
          jogo.tela = 'rodada'
          jogo.tFase = 0
          setTela('rodada')
          mostrarContagem('Já!')
          tocar('ja')
          anunciar('Já! Gire a alavanca.')
        }
        return
      }
      if (jogo.tela === 'rodada') {
        jogo.tFase += dt
        if (jogo.tFase > 0.5 && jogo.contagemOn) mostrarContagem('')
        if (jogo.R !== null) jogo.tLocal = Math.min(jogo.R.tempo, jogo.tLocal + dt)
        // A ponte desenhada segue a do host, com o passo que ela vinha dando.
        const alvo = Math.max(0, Math.min(1, jogo.pAlvo + jogo.vel * 0.05))
        jogo.pVis += (alvo - jogo.pVis) * (1 - Math.exp(-dt * SEGUE_A_PONTE))
        const d = Math.floor(Math.min(1, jogo.pVis) * VOLTAS * DENTES + 1e-9)
        if (d > jogo.dente) tocar('dente')
        else if (d < jogo.dente && jogo.solta > 0.25) tocar('volta')
        jogo.dente = d
        const resta = jogo.R === null ? 0 : jogo.R.tempo - jogo.tLocal
        if (resta <= 3 && resta > 0 && Math.ceil(resta) !== jogo.relogioDado) {
          jogo.relogioDado = Math.ceil(resta)
          tocar('relogio')
        }
        return
      }
      if (jogo.tela === 'fim') {
        if (jogo.congela > 0) {
          jogo.congela -= dt
          return
        }
        jogo.tFase += dt
        if (jogo.fimTipo === 'subiu') {
          const k = Math.min(1, jogo.tFase / QUEDA)
          jogo.pVis = jogo.pFim * (1 - k * k)
          if (k >= 1 && !jogo.bateu) {
            jogo.bateu = true
            if (!reduz) jogo.trauma = Math.min(1, jogo.trauma + 0.45)
            for (let i = 0; i < 10; i++) {
              const [x, y] = pontoDaPonte(0, 1, -1 + i / 4.5)
              soltarPoeira(x, y, 1, reduz ? 0.2 : 0.7, '#cfc9bb')
            }
          }
          if (jogo.tFase >= FIM_SUBIU) {
            jogo.tela = 'resultado'
            setTela('resultado')
          }
        } else if (jogo.tFase >= FIM_BAIXOU) {
          jogo.tela = 'resultado'
          setTela('resultado')
        }
      }
    }

    const pintarHud = () => {
      const jogo = J.current
      const R = jogo.R
      const h = hudRefs.current
      if (R === null || (jogo.tela !== 'contagem' && jogo.tela !== 'rodada' && jogo.tela !== 'fim')) return
      const resta = Math.max(0, R.tempo - jogo.tLocal)
      definir(h.tempo.current, 'tempo', virg(resta))
      atributo(h.relogio.current, 'pouco', 'data-pouco', resta <= 3 && jogo.tela === 'rodada' ? '1' : '0')
      if (h.tempoBarra.current !== null) h.tempoBarra.current.style.transform = `scaleX(${(resta / R.tempo).toFixed(4)})`
      const pct = Math.round(jogo.pVis * 100)
      definir(h.ponte.current, 'ponte', `${pct}%`)
      atributo(h.medidorPonte.current, 'ponteAria', 'aria-valuenow', String(pct))
      if (h.ponteBarra.current !== null) h.ponteBarra.current.style.transform = `scaleX(${jogo.pVis.toFixed(4)})`
      const emRodada = jogo.tela === 'rodada'
      const solta = emRodada && jogo.solta > 0
      if (h.correnteBarra.current !== null) h.correnteBarra.current.style.transform = `scaleX(${(emRodada ? jogo.tensao : 0).toFixed(4)})`
      definir(h.corrente.current, 'corrente', solta ? 'soltou!' : emRodada ? (jogo.tensao > 0.62 ? 'pesada' : 'puxando') : 'parada')
      atributo(h.medidorCorrente.current, 'soltaAttr', 'data-solta', solta ? '1' : '0')
      let dica = 'Aperte X sem parar. A corrente puxa a ponte de volta o tempo todo.'
      let tomDica = ''
      if (jogo.tela === 'contagem') dica = 'Prepare o dedo no X.'
      else if (jogo.tela === 'fim') dica = jogo.fimTipo === 'baixou' ? 'A ponte desceu! A catraca trava.' : 'O tempo acabou: a corrente puxa a ponte de volta.'
      else if (solta) {
        dica = 'A catraca soltou! Gire de novo para a lingueta pegar.'
        tomDica = 'alerta'
      } else if (resta <= 3) {
        dica = 'Últimos segundos!'
        tomDica = 'alerta'
      } else if (jogo.pVis > 0.78) dica = 'Falta pouco: perto do chão a corrente pesa mais.'
      definir(h.dica.current, 'dica', dica)
      atributo(h.dica.current, 'tomDica', 'data-tom', tomDica)
      const ul = h.equipe.current
      if (ul !== null) {
        const janela = Math.min(1.5, Math.max(0.5, jogo.tLocal))
        for (let j = 0; j < R.n; j++) {
          const ts = jogo.tGiros[j]
          let quantos = 0
          for (let i = ts.length - 1; i >= 0 && ts[i] > jogo.tLocal - janela; i--) quantos++
          const ritmo = ul.children[j]?.lastElementChild
          if (ritmo instanceof HTMLElement) definir(ritmo, `ritmo${j}`, `${virg(quantos / janela)}/s`)
        }
      }
      const p = jogo.pVis
      const rotulo = p >= 1 ? 'A ponte levadiça desceu e está assentada na margem.' : p <= 0.01 ? 'A ponte levadiça está erguida diante do portão.' : `A ponte levadiça está ${Math.round(p * 10) * 10}% baixada.`
      atributo(canvas.current, 'rotulo', 'aria-label', rotulo)
    }

    const quadro = (agora: number) => {
      const dt = ultimo !== 0 ? Math.min(0.1, (agora - ultimo) / 1000) : 1 / 60
      ultimo = agora
      lerControle()
      avancar(dt)
      const jogo = J.current
      const c = canvas.current
      const g = c?.getContext('2d') ?? null
      if (c !== null && g !== null) {
        const ret = c.getBoundingClientRect()
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        const w = Math.max(1, Math.round(ret.width * dpr))
        const h = Math.max(1, Math.round(ret.height * dpr))
        if (c.width !== w || c.height !== h) {
          c.width = w
          c.height = h
        }
        const reduz = movimentoReduzido()?.matches ?? false
        const emRodada = jogo.tela === 'rodada'
        const p = jogo.tela === 'resultado' && fimRef.current !== undefined ? (fimRef.current.tipo === 'baixou' ? 1 : fimRef.current.tipo === 'subiu' ? 0 : jogo.pVis) : jogo.pVis
        const tensao = emRodada ? jogo.tensao : 0
        const solta = emRodada ? jogo.solta : 0
        desenharCena(g, w, h, {
          p,
          solta,
          tensao,
          vib: reduz ? 0 : emRodada ? 0.5 + 1.6 * tensao + 1.4 * solta : 0,
          flash: jogo.flash,
          poeira: jogo.poeira,
          tremor: reduz ? 0 : jogo.trauma * jogo.trauma,
          t: jogo.tCena,
          tReal: jogo.tReal,
        })
      }
      pintarHud()
      const C = audio.current
      if (C !== null && somRef.current) {
        if (jogo.tela === 'rodada' && !jogo.pausado) continuo(C, C.ctx.currentTime, jogo.vel, jogo.tensao, jogo.solta)
        else if (jogo.tela !== 'fim') continuo(C, C.ctx.currentTime, 0, 0, 0)
      }
      raf = requestAnimationFrame(quadro)
    }
    raf = requestAnimationFrame(quadro)
    return () => cancelAnimationFrame(raf)
    // O laço lê tudo por referência.
  }, [apertar, alternarPausa])

  const sozinho = convite.sozinho
  const meu = estado?.participantes.find((p) => p.playerId === playerId)
  const prontos = estado?.participantes.filter((p) => p.status === 'pronto').length ?? (alavanca.pronto ? 1 : 0)
  const seguem = estado?.participantes.filter((p) => p.status !== 'fora').length ?? convite.participantes.length
  const quemGira = convite.participantes.map((p) => (p.playerId === playerId ? 'Você' : p.nome))
  const desfechoDoConvite = textoDesfecho(true, convite.abrePorta).replace(/^No mapa: /, '').replace(/^./, (c) => c.toUpperCase())
  const emJogo = tela === 'contagem' || tela === 'rodada' || tela === 'fim'
  const fecharTudo = () => acoes.fecharAlavanca()

  const resultado = fim === undefined ? null : textoDoResultado(fim, convite.tempo, NOME_DA_DIFICULDADE_ALAVANCA[convite.dificuldade])

  return (
    <div className="lb-alavanca" role="dialog" aria-modal="true" aria-label="Alavanca da ponte">
      <header className="al-topo">
        <div className="al-topo__marca">
          <span className="al-wordmark">Labirinto</span>
          <nav className="al-migalhas" aria-label="Onde você está">
            {convite.lugar !== '' && (
              <>
                {convite.lugar} <span aria-hidden="true">›</span>{' '}
              </>
            )}
            <b>Alavanca da ponte</b>
          </nav>
        </div>
        <button type="button" className="al-btn al-btn--sm" aria-pressed={som} onClick={alternarSom}>
          {som ? 'Som ligado' : 'Som desligado'}
        </button>
      </header>

      <main className="al-jogador">
        <div className="al-palco">
          <canvas ref={canvas} role="img" aria-label="A ponte levadiça está erguida diante do portão." />
          <div className="al-contagem" ref={contagem} aria-hidden="true" />
          {pausaPor !== null && (tela === 'contagem' || tela === 'rodada') && (
            <div className="al-pausa">
              <div className="al-pausa__caixa" role="dialog" aria-modal="false" aria-label="Pausado">
                <h2>Pausado</h2>
                <p className="al-nota">{pausaPor === 'mestre' ? 'O mestre pausou para todos. Só ele continua.' : pausaPor === playerId ? 'A corrente espera. Esc ou o botão continua.' : `${convite.participantes.find((p) => p.playerId === pausaPor)?.nome ?? 'Alguém'} pausou. Esc ou o botão continua.`}</p>
                <button type="button" className="al-btn al-btn--primary" disabled={pausaPor === 'mestre'} onClick={() => acoes.continuarAlavanca()}>
                  Continuar
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="al-coluna" aria-label="Minigame">
          {tela === 'convite' && encerrada === undefined && (
            <section className="al-tela" aria-labelledby="al-titulo">
              <div className="al-cabeca">
                <canvas ref={icone} width={96} height={96} aria-hidden="true" />
                <div>
                  <h1 id="al-titulo">Alavanca da ponte</h1>
                  {convite.lugar !== '' && <p>{convite.lugar}</p>}
                </div>
              </div>
              {convite.fala !== '' && <p className="al-fala">{convite.fala}</p>}
              <dl className="al-ficha">
                <div>
                  <dt className="al-rotulo">Dificuldade</dt>
                  <dd>{NOME_DA_DIFICULDADE_ALAVANCA[convite.dificuldade]}</dd>
                </div>
                <div>
                  <dt className="al-rotulo">Tempo</dt>
                  <dd>{convite.tempo} s</dd>
                </div>
                <div className="al-larga">
                  <dt className="al-rotulo">Quem gira</dt>
                  <dd>{quemGira.join(', ')}</dd>
                </div>
                <div className="al-larga">
                  <dt className="al-rotulo">Se a ponte descer</dt>
                  <dd>{desfechoDoConvite}</dd>
                </div>
              </dl>
              <ul className="al-teclas" aria-label="Teclas">
                <li>
                  <kbd>X</kbd> girar a alavanca (cada aperto, um pouco)
                </li>
                <li>
                  <kbd>Esc</kbd> pausa · no toque, o botão Girar
                </li>
              </ul>
              <button
                type="button"
                className="al-btn al-btn--primary al-btn--block"
                disabled={alavanca.pronto}
                onClick={() => {
                  garantirAudio()
                  acoes.prontoAlavanca()
                }}
              >
                {alavanca.pronto ? 'Esperando a equipe…' : 'Começar'}
              </button>
              <button type="button" className="al-btn al-btn--block" onClick={fecharTudo}>
                Agora não
              </button>
              <p className="al-nota">
                {sozinho || seguem <= 1 ? 'O mestre escolheu a dificuldade e o tempo.' : `Prontos: ${prontos} de ${seguem}. A rodada começa quando todos estiverem prontos.`}
                {meu?.status === 'fora' ? ' Você ficou de fora.' : ''}
              </p>
            </section>
          )}

          {emJogo && (
            <section className="al-tela al-tela--jogo" aria-label="Rodada">
              <div className="al-relogio" ref={hud.relogio}>
                <b ref={hud.tempo}>{virg(convite.tempo)}</b>
                <span>segundos</span>
              </div>
              <div className="al-tempo-trilho" aria-hidden="true">
                <i ref={hud.tempoBarra} />
              </div>
              <div className="al-medidor" role="meter" aria-label="Ponte baixada" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} ref={hud.medidorPonte}>
                <div className="al-medidor__topo">
                  <span className="al-rotulo">Ponte</span>
                  <b ref={hud.ponte}>0%</b>
                </div>
                <div className="al-medidor__trilho">
                  <i ref={hud.ponteBarra} />
                </div>
              </div>
              <div className="al-medidor al-medidor--corrente" ref={hud.medidorCorrente}>
                <div className="al-medidor__topo">
                  <span className="al-rotulo">Força da corrente</span>
                  <b ref={hud.corrente}>puxando</b>
                </div>
                <div className="al-medidor__trilho" aria-hidden="true">
                  <i ref={hud.correnteBarra} />
                </div>
              </div>
              <ul className="al-equipe" aria-label="Quem gira" ref={hud.equipe}>
                {ordem.map((p, j) => (
                  <li key={p.playerId} ref={pintarCor(CORES_J[j])}>
                    <span className="al-marca" aria-hidden="true">
                      {marcaDe(j)}
                    </span>
                    <span className="al-nome">{nomeDe(j)}</span>
                    <span className="al-ritmo">0,0/s</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="al-btn al-btn--primary al-btn--block al-girar"
                onPointerDown={(e) => {
                  if (e.button !== 0 && e.pointerType === 'mouse') return
                  e.preventDefault()
                  apertar()
                }}
                onClick={(e) => {
                  // Enter ou espaço no botão (sem ponteiro): também gira.
                  if (e.detail === 0) apertar()
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                Girar a alavanca <kbd>X</kbd>
              </button>
              <p className="al-dica" ref={hud.dica} aria-hidden="true">
                Aperte X sem parar. A corrente puxa a ponte de volta o tempo todo.
              </p>
              <div className="al-linha">
                <button type="button" className="al-btn al-btn--sm" onClick={() => acoes.pausarAlavanca()}>
                  Pausar <kbd>Esc</kbd>
                </button>
              </div>
            </section>
          )}

          {tela === 'resultado' && resultado !== null && fim !== undefined && (
            <section className="al-tela" aria-labelledby="al-res-titulo">
              <div className="al-veredito" data-tipo={fim.tipo}>
                <h2 id="al-res-titulo" tabIndex={-1} ref={titulo}>
                  {resultado.titulo}
                </h2>
                <p>{resultado.sub}</p>
              </div>
              <dl className="al-numeros">
                {resultado.numeros.map(([k, v]) => (
                  <div key={k}>
                    <dt className="al-rotulo">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <ul className="al-equipe" aria-label="Quem girou">
                {ordem.map((p, j) => (
                  <li key={p.playerId} ref={pintarCor(CORES_J[j])}>
                    <span className="al-marca" aria-hidden="true">
                      {marcaDe(j)}
                    </span>
                    <span className="al-nome">{nomeDe(j)}</span>
                    <span className="al-ritmo">
                      {fim.giros[j] ?? 0} giros · {virg((fim.giros[j] ?? 0) / Math.max(0.1, fim.tFim))}/s
                    </span>
                  </li>
                ))}
              </ul>
              <p className="al-desfecho" data-ok={fim.tipo === 'baixou' ? '1' : '0'}>
                {fim.tipo === 'baixou' && convite.abrePorta && !fim.portaAberta ? textoDesfecho(true, false) : textoDesfecho(fim.tipo === 'baixou', fim.portaAberta)}
              </p>
              <div className="al-botoes">
                {sozinho && (
                  <button type="button" className="al-btn al-btn--primary al-btn--block" onClick={() => acoes.pedirAlavanca(convite.pinId)}>
                    Tentar de novo
                  </button>
                )}
                <button type="button" className={`al-btn al-btn--block${sozinho ? '' : ' al-btn--primary'}`} onClick={fecharTudo}>
                  Fechar
                </button>
              </div>
            </section>
          )}

          {encerrada !== undefined && fim === undefined && (
            <section className="al-tela" aria-labelledby="al-enc-titulo">
              <div className="al-veredito">
                <h2 id="al-enc-titulo">{encerrada === 'mestre' ? 'Encerrada pelo mestre' : 'A rodada começou sem você'}</h2>
                <p>{encerrada === 'mestre' ? 'A ponte continua erguida.' : 'Quem estava pronto já está girando.'}</p>
              </div>
              <div className="al-botoes">
                <button type="button" className="al-btn al-btn--primary al-btn--block" onClick={fecharTudo}>
                  Fechar
                </button>
              </div>
            </section>
          )}
        </aside>
      </main>
      <p className="al-sr" ref={anuncio} aria-live="polite" />
    </div>
  )
}

/** O veredito, a linha de baixo e os quatro números do resultado (os textos do protótipo). */
function textoDoResultado(fim: AlavancaFimMessage, tempo: number, dificuldade: string): { titulo: string; sub: string; numeros: [string, string][] } {
  const total = fim.giros.reduce((a, b) => a + b, 0)
  const dur = Math.max(0.1, fim.tFim)
  const titulo = fim.tipo === 'baixou' ? 'A ponte desceu!' : fim.tipo === 'subiu' ? 'A corrente venceu' : 'Encerrada pelo mestre'
  const sub =
    fim.tipo === 'baixou'
      ? `Em ${virg(dur)} s de ${tempo} s (${dificuldade}).`
      : fim.tipo === 'subiu'
        ? `A ponte chegou a ${Math.round(fim.pMax * 100)}% e voltou a subir (${dificuldade}, ${tempo} s).`
        : `A rodada parou em ${virg(dur)} s, com a ponte a ${Math.round(fim.p * 100)}%.`
  return {
    titulo,
    sub,
    numeros: [
      ['Giros', String(total)],
      ['Ritmo', `${virg(total / dur)}/s`],
      ['Maior pausa', `${virg(fim.maiorPausa)} s`],
      ['Catraca soltou', `${fim.soltou}×`],
    ],
  }
}
