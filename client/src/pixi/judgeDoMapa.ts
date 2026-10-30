/// <reference types="vite/client" />
import { Assets, Container, Rectangle, Sprite, Texture, type Ticker } from 'pixi.js'
import urlDaFolha from '../assets/judge/judge-folha.webp'
import {
  DIRECAO_INICIAL,
  FOLHA_DO_JUDGE,
  CARTA_REDUZIDA_MS,
  SEGURA_A_CARTA_MS,
  colunaDoJudge,
  direcaoNaVirada,
  direcaoSeguinte,
  type DirecaoDoJudge,
  type GestoDoJudge,
  type JudgeNaCena,
} from '../lib/batalha/judge'
import type { CaixaDaVista } from './fogosDoMapa'

/**
 * O JUDGE NO MAPA (fatia J da F3, seção 5.1 de
 * docs/planos/batalha-one-piece-f3-plano.md; Q7 e Q8 no fim do plano), o
 * mesmo módulo no editor (`PixiCanvas.tsx`) e no jogador (`PlayerView.tsx`):
 *
 *   camada (faixa fixa própria, por cima das fichas, da névoa e dos telhados)
 *     └ sprite (um quadro da folha `assets/judge/judge-folha.webp`)
 *
 * A folha (8 direções x 20 quadros de 192 x 240, `FOLHA_DO_JUDGE`) é baixada
 * UMA vez, só quando a primeira batalha põe o Judge na tela, e cortada em 160
 * texturas que dividem a mesma imagem. Por quadro só troca a textura do sprite,
 * e só quando a coluna ou a direção mudam (12 vezes por segundo, não 60).
 *
 * O relógio (`app.ticker`) só fica inscrito com a folha pronta, o Judge na
 * batalha e na vista. "Menos movimento": parado na coluna 0, vira de uma vez e
 * a carta aparece erguida por `CARTA_REDUZIDA_MS`; aí o relógio só roda
 * enquanto a carta está no ar.
 *
 * A regra (direção, coluna, virada) é toda de `lib/batalha/judge.ts`; aqui só
 * o desenho, o tempo e o toque.
 */

/** O relógio de quadros e a preferência de movimento da tela. */
export interface MovimentoDoJudge {
  ticker: Pick<Ticker, 'add' | 'remove'>
  /** `prefers-reduced-motion`, relido a cada `definir` e, com o relógio vivo, uma vez por segundo. */
  reducedMotion: () => boolean
  /** Agora, em ms. Padrão `performance.now()`. */
  agora?: () => number
}

/** O que a tela anota para a conferência (dataset do canvas). */
export interface EstadoDoJudge {
  /** Na batalha, com a folha pronta. */
  visivel: boolean
  /** Inscrito no relógio. */
  animando: boolean
  /** Para onde ele vai olhar (a virada pode estar no meio). */
  direcao: DirecaoDoJudge
}

export interface OpcoesDoJudge {
  movimento: MovimentoDoJudge
  /** Quem baixa a folha. Padrão: `Assets.load` do arquivo do build. */
  carregarFolha?: () => Promise<Texture>
  aoMudar?: (estado: EstadoDoJudge) => void
}

export interface DadosDoJudge {
  /** Onde ele está (o centro da casa dos pés); `null` = fora de batalha: some e sai do relógio. */
  judge: JudgeNaCena | null
  /** Px de mundo por casa: a folha tem `FOLHA_DO_JUDGE.pxPorCasa` por casa. */
  tamanhoDaCasa: number
  /** A ficha da vez que ESTA tela vê; `null` = fica olhando para onde estava (Q8). */
  alvo: { x: number; y: number } | null
}

export interface JudgeDoMapa {
  /** A camada inteira: quem chama a põe na pilha, na faixa do Judge. */
  readonly camada: Container
  definir: (dados: DadosDoJudge) => void
  /** Ergue a carta agora (gesto novo no meio recomeça do zero). */
  gesto: () => void
  /**
   * O `seq` do último efeito "judge" da fila (`ultimoGestoDoJudge`). A
   * primeira leitura é só a base (sem reprise ao entrar); depois, `seq` maior
   * ergue a carta; `null` (fila vazia, batalha acabou) zera a base.
   */
  lerFila: (seq: number | null) => void
  /** Prévia do arrasto do mestre: o sprite segue `ponto`; `null` volta à posição da batalha. */
  arrastar: (ponto: { x: number; y: number } | null) => void
  /** Onde ele aparece agora (o arrasto vale), em px do mundo; `null` = escondido. */
  posicao: () => JudgeNaCena | null
  /** O corpo dele (1 casa de largura, dos pés até `ALTURA_DO_CORPO_EM_CASAS` acima) cobre `ponto`? */
  acertou: (ponto: { x: number; y: number }) => boolean
  /** A câmera andou: fora da vista ele sai do relógio (`null` = sem recorte). */
  ajustarAVista: (vista: CaixaDaVista | null) => void
  destruir: () => void
}

/** Do chão até o alto da cabeça, em casas: a área que o mestre agarra. */
export const ALTURA_DO_CORPO_EM_CASAS = 2.3
/** Nome (`Container.label`) da camada: é por ele que um teste a acha. */
export const JUDGE_LABEL = 'judge'
const CONFERIR_MOVIMENTO_MS = 1000
const QUADRO_MS = 1000 / FOLHA_DO_JUDGE.fps
const SOBE_MS = FOLHA_DO_JUDGE.erguer.quadros * QUADRO_MS
/** Sobe, segura e desce: depois disso a carta acabou e volta a respiração. */
const GESTO_MS = SOBE_MS + SEGURA_A_CARTA_MS + SOBE_MS

/**
 * O `seq` do último efeito "judge" (o mestre desfez uma linha) na fila da
 * batalha; nenhum = `null`. Seletor estável: o mesmo número enquanto não
 * chega outro gesto.
 */
export function ultimoGestoDoJudge(efeitos: readonly { seq: number; tipo: string }[] | undefined): number | null {
  if (efeitos === undefined) return null
  let ultimo: number | null = null
  for (const efeito of efeitos) if (efeito.tipo === 'judge' && (ultimo === null || efeito.seq > ultimo)) ultimo = efeito.seq
  return ultimo
}

function cortarFolha(folha: Texture): Texture[] {
  const { largura, altura } = FOLHA_DO_JUDGE.quadro
  const quadros: Texture[] = []
  for (let direcao = 0; direcao < FOLHA_DO_JUDGE.linhas; direcao += 1) {
    for (let coluna = 0; coluna < FOLHA_DO_JUDGE.colunas; coluna += 1) {
      quadros.push(new Texture({ source: folha.source, frame: new Rectangle(coluna * largura, direcao * altura, largura, altura), label: `judge ${direcao}:${coluna}` }))
    }
  }
  return quadros
}

export function createJudgeDoMapa(opcoes: OpcoesDoJudge): JudgeDoMapa {
  const { movimento, aoMudar } = opcoes
  const agora = movimento.agora ?? (() => performance.now())
  const carregarFolha = opcoes.carregarFolha ?? (() => Assets.load<Texture>(urlDaFolha))

  const camada = new Container()
  camada.label = JUDGE_LABEL
  // Q7 + plano 5.1: no jogador o clique passa para a ficha de trás; no editor o arrasto é testado à mão (`acertou`).
  camada.eventMode = 'none'
  const sprite = new Sprite()
  sprite.anchor.set(FOLHA_DO_JUDGE.chao.x / FOLHA_DO_JUDGE.quadro.largura, FOLHA_DO_JUDGE.chao.y / FOLHA_DO_JUDGE.quadro.altura)
  sprite.visible = false
  camada.addChild(sprite)

  let quadros: Texture[] | null = null
  let carregando = false
  let falhou = false
  let destruido = false
  let judge: JudgeNaCena | null = null
  let arrasto: JudgeNaCena | null = null
  let casa: number = FOLHA_DO_JUDGE.pxPorCasa
  let direcaoAlvo: DirecaoDoJudge = DIRECAO_INICIAL
  let virada: { de: DirecaoDoJudge; para: DirecaoDoJudge; inicio: number } | null = null
  let gestoAtual: GestoDoJudge = null
  let reduzido = movimento.reducedMotion()
  let vista: CaixaDaVista | null = null
  let naVista = true
  let noRelogio = false
  let conferidoEm = 0
  let mostrado = -1
  /** A base da fila de efeitos: `undefined` antes da primeira leitura. */
  let vistoNaFila: number | undefined

  function posicaoMostrada(): JudgeNaCena | null {
    return arrasto ?? judge
  }

  function avisar(): void {
    aoMudar?.({ visivel: judge !== null && quadros !== null, animando: noRelogio, direcao: direcaoAlvo })
  }

  /** A direção neste instante: a virada em curso, passo a passo; acabada, a de destino. */
  function direcaoAgora(t: number): DirecaoDoJudge {
    if (virada === null) return direcaoAlvo
    const direcao = direcaoNaVirada(virada.de, virada.para, virada.inicio, t, reduzido)
    if (direcao === virada.para) virada = null
    return direcao
  }

  function pintar(t: number): void {
    if (quadros === null || judge === null) return
    if (gestoAtual !== null && t - gestoAtual.inicio >= (reduzido ? CARTA_REDUZIDA_MS : GESTO_MS)) gestoAtual = null
    const indice = direcaoAgora(t) * FOLHA_DO_JUDGE.colunas + colunaDoJudge(t, gestoAtual, reduzido)
    if (indice === mostrado) return
    const textura = quadros[indice]
    if (textura === undefined) return
    sprite.texture = textura
    mostrado = indice
  }

  function querRelogio(): boolean {
    return quadros !== null && judge !== null && naVista && (!reduzido || gestoAtual !== null || virada !== null)
  }

  function acertarRelogio(): void {
    const quer = querRelogio()
    if (quer && !noRelogio) {
      noRelogio = true
      conferidoEm = agora()
      movimento.ticker.add(passo)
    } else if (!quer && noRelogio) {
      noRelogio = false
      movimento.ticker.remove(passo)
    }
    avisar()
  }

  function passo(): void {
    const t = agora()
    if (Math.abs(t - conferidoEm) >= CONFERIR_MOVIMENTO_MS) {
      conferidoEm = t
      reduzido = movimento.reducedMotion()
    }
    pintar(t)
    // A carta desceu (ou a virada acabou) com menos movimento: nada mais a animar.
    if (!querRelogio()) acertarRelogio()
  }

  /** Fora da vista sai do relógio; volta já no quadro certo. */
  function recortar(): void {
    const pos = posicaoMostrada()
    if (pos === null || vista === null) {
      naVista = true
      return
    }
    const escala = casa / FOLHA_DO_JUDGE.pxPorCasa
    const meiaLargura = (FOLHA_DO_JUDGE.quadro.largura / 2) * escala
    const acima = FOLHA_DO_JUDGE.chao.y * escala
    const abaixo = (FOLHA_DO_JUDGE.quadro.altura - FOLHA_DO_JUDGE.chao.y) * escala
    naVista = pos.x + meiaLargura >= vista.minX && pos.x - meiaLargura <= vista.maxX && pos.y + abaixo >= vista.minY && pos.y - acima <= vista.maxY
  }

  function posicionar(): void {
    const pos = posicaoMostrada()
    sprite.visible = pos !== null && quadros !== null
    if (pos === null) return
    sprite.position.set(pos.x, pos.y)
    sprite.scale.set(casa / FOLHA_DO_JUDGE.pxPorCasa)
  }

  function carregar(): void {
    if (quadros !== null || carregando || falhou) return
    carregando = true
    carregarFolha()
      .then((folha) => {
        if (destruido) return
        quadros = cortarFolha(folha)
        mostrado = -1
        posicionar()
        recortar()
        pintar(agora())
        acertarRelogio()
      })
      .catch((erro: unknown) => {
        // R2 do plano: sem a folha o Judge some sem erro na tela.
        falhou = true
        console.warn('Judge: a folha não carregou', erro)
      })
      .finally(() => {
        carregando = false
      })
  }

  function gesto(): void {
    if (judge === null) return
    gestoAtual = { inicio: agora() }
    pintar(gestoAtual.inicio)
    acertarRelogio()
  }

  return {
    camada,
    definir(dados) {
      const t = agora()
      reduzido = movimento.reducedMotion()
      if (Number.isFinite(dados.tamanhoDaCasa) && dados.tamanhoDaCasa > 0) casa = dados.tamanhoDaCasa
      if (dados.judge === null) {
        // Encerrar: some e sai do relógio; a folha fica no cache para a próxima batalha.
        judge = null
        arrasto = null
        gestoAtual = null
        virada = null
        direcaoAlvo = DIRECAO_INICIAL
        mostrado = -1
        sprite.visible = false
        acertarRelogio()
        return
      }
      judge = { x: dados.judge.x, y: dados.judge.y }
      carregar()
      const nova = direcaoSeguinte(direcaoAlvo, judge, dados.alvo)
      if (nova !== direcaoAlvo) {
        // A virada parte de onde ele está olhando AGORA (a anterior pode estar no meio).
        const de = direcaoAgora(t)
        virada = reduzido || de === nova ? null : { de, para: nova, inicio: t }
        direcaoAlvo = nova
      }
      posicionar()
      recortar()
      pintar(t)
      acertarRelogio()
    },
    gesto,
    lerFila(seq) {
      if (vistoNaFila === undefined) {
        vistoNaFila = seq ?? -1
        return
      }
      if (seq === null) {
        vistoNaFila = -1
        return
      }
      if (seq <= vistoNaFila) return
      vistoNaFila = seq
      gesto()
    },
    arrastar(ponto) {
      arrasto = ponto === null ? null : { x: ponto.x, y: ponto.y }
      posicionar()
      recortar()
      acertarRelogio()
    },
    posicao() {
      const pos = posicaoMostrada()
      return pos === null || quadros === null ? null : { x: pos.x, y: pos.y }
    },
    acertou(ponto) {
      const pos = posicaoMostrada()
      if (pos === null || quadros === null) return false
      const meia = casa / 2
      return Math.abs(ponto.x - pos.x) <= meia && ponto.y <= pos.y + meia && ponto.y >= pos.y - ALTURA_DO_CORPO_EM_CASAS * casa
    },
    ajustarAVista(nova) {
      vista = nova
      const antes = naVista
      recortar()
      // Volta à vista com o quadro de agora, antes do primeiro passo do relógio.
      if (naVista && !antes) pintar(agora())
      acertarRelogio()
    },
    destruir() {
      destruido = true
      if (noRelogio) movimento.ticker.remove(passo)
      noRelogio = false
      // As 160 texturas são recortes: a imagem (`source`) fica no cache do `Assets`.
      if (quadros !== null) for (const quadro of quadros) quadro.destroy(false)
      quadros = null
      if (!camada.destroyed) camada.destroy({ children: true })
    },
  }
}
