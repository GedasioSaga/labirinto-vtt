import type { Camera } from './world'

/**
 * D7 (decisão 6 do plano de unificação do combate, 10/11/2026): a CÂMERA DA
 * BATALHA. Na troca de vez, a ficha da vez só é trazida para a vista quando
 * está fora da tela ou encostada na borda; no miolo da tela a câmera fica onde
 * está. Nunca muda o zoom. O mestre desliga (`ligarCameraDaBatalha`), e a
 * escolha fica neste computador.
 *
 * Cada tela do mapa (o editor do mestre em `PixiCanvas.tsx`, o jogador em
 * `PlayerView.tsx`) registra como achar a ficha na tela e como deslizar a
 * câmera dela; os efeitos da batalha (`EfeitosDaBatalha.tsx`) pedem
 * `trazerFichaDaVez(tokenId)`.
 */

export interface TelaDaCamera {
  /** Onde a ficha está agora, em px da tela do mapa (o canvas); `null` = não está desenhada. */
  pontoDaFicha: (tokenId: string) => { x: number; y: number } | null
  /** A câmera de agora e o tamanho da tela do mapa (px). */
  camera: () => Camera
  tela: () => { width: number; height: number }
  /** Leva a câmera até `alvo` (deslizando; com menos movimento, de uma vez). Quem registra decide como. */
  irPara: (alvo: Camera) => void
  /**
   * T4 (10/11): o elemento do mapa (o canvas). Com ele, "à vista" quer dizer que nada da interface (os painéis, a
   * faixa da ordem, o menu da vez) está por cima da ficha. Sem ele, vale só a borda da tela.
   */
  elemento?: () => HTMLElement | null
}

/** O mapa aparece neste ponto (px da tela do mapa)? */
export type PontoLivre = (x: number, y: number) => boolean

/** A amostra da tela para achar onde o mapa aparece: colunas x linhas. */
const AMOSTRA_COLUNAS = 16
const AMOSTRA_LINHAS = 10
/** Entre as casas quase tão abertas quanto a mais aberta (esta fração da folga dela), vence a mais perto da ficha. */
const QUASE_TAO_ABERTA = 0.8

/**
 * T4 (10/11): medido no mapa do mestre em 1366x768, a câmera punha a ficha da vez no meio da tela, que é onde ficam
 * a faixa da ordem e o menu do centro: o golpe, o recuo e o tombo aconteciam embaixo deles. Aqui o mapa "aparece"
 * num ponto quando o elemento no topo ali é o próprio canvas (ou quem o contém).
 */
export function livreNaTela(canvas: HTMLElement): PontoLivre {
  const caixa = canvas.getBoundingClientRect()
  return (x, y) => {
    const topo = document.elementFromPoint(caixa.left + x, caixa.top + y)
    return topo !== null && (topo === canvas || topo.contains(canvas))
  }
}

/**
 * Para onde levar a ficha (px da tela do mapa) para ela ficar à vista de verdade: longe da borda e sem interface
 * por cima. `null` = já está. Amostra a tela numa grade; o alvo é a casa livre mais aberta (a mais longe de
 * interface e da beira) e, entre as quase tão abertas, a mais perto da ficha: o menor deslize. Nada livre (a
 * interface cobre tudo): o meio da tela, como antes.
 */
export function pontoAVista(ponto: { x: number; y: number }, tela: { width: number; height: number }, livre: PontoLivre): { x: number; y: number } | null {
  const margemX = tela.width * BORDA
  const margemY = tela.height * BORDA
  const longeDaBorda = ponto.x >= margemX && ponto.x <= tela.width - margemX && ponto.y >= margemY && ponto.y <= tela.height - margemY
  if (longeDaBorda && livre(ponto.x, ponto.y)) return null
  const passoX = tela.width / AMOSTRA_COLUNAS
  const passoY = tela.height / AMOSTRA_LINHAS
  const casas: { x: number; y: number; livre: boolean }[] = []
  for (let linha = 0; linha < AMOSTRA_LINHAS; linha += 1)
    for (let coluna = 0; coluna < AMOSTRA_COLUNAS; coluna += 1) {
      const x = (coluna + 0.5) * passoX
      const y = (linha + 0.5) * passoY
      casas.push({ x, y, livre: livre(x, y) })
    }
  const cobertas = casas.filter((casa) => !casa.livre)
  const abertas = casas
    .filter((casa) => casa.livre)
    .map((casa) => {
      let folga = Math.min(casa.x, tela.width - casa.x, casa.y, tela.height - casa.y)
      for (const outra of cobertas) folga = Math.min(folga, Math.hypot(outra.x - casa.x, outra.y - casa.y))
      return { ...casa, folga }
    })
  if (abertas.length === 0) return { x: tela.width / 2, y: tela.height / 2 }
  const maior = Math.max(...abertas.map((casa) => casa.folga))
  const distancia = (casa: { x: number; y: number }) => Math.hypot(casa.x - ponto.x, casa.y - ponto.y)
  const escolhida = abertas.filter((casa) => casa.folga >= maior * QUASE_TAO_ABERTA).sort((a, b) => distancia(a) - distancia(b))[0]
  return escolhida === undefined ? null : { x: escolhida.x, y: escolhida.y }
}

const telas = new Set<TelaDaCamera>()
const CHAVE = 'labirinto:batalha:cameraSegue'
/** "Na borda": a ficha a menos de 12% da largura (ou da altura) da tela da beira. */
const BORDA = 0.12
/** Desligada nesta sessão (vale mesmo sem armazenamento). */
let sessaoDesligada = false

/**
 * T3 (10/11): os ponteiros apertados agora. Com um apertado, alguém arrasta (o mapa, uma ficha, uma régua): a
 * câmera da batalha não puxa a tela dele no meio do gesto. Contados na janela, em captura, enquanto houver tela.
 */
const apertados = new Set<number>()
/**
 * T4 (10/11): a ficha da vez que trocou no meio de um arrasto. Medido no mapa: o Urso fora da vista ficava fora
 * depois de soltar. A câmera espera o arrasto acabar e então a traz (a vez seguinte troca a ficha esperada).
 */
let esperando: string | null = null
const apertar = (evento: PointerEvent) => apertados.add(evento.pointerId)
const soltar = (evento: PointerEvent) => {
  apertados.delete(evento.pointerId)
  if (apertados.size > 0 || esperando === null) return
  const tokenId = esperando
  esperando = null
  trazerFichaDaVez(tokenId)
}
const OUVIR_PONTEIRO: AddEventListenerOptions = { capture: true, passive: true }

function vigiarPonteiros(ligar: boolean) {
  const acao = ligar ? window.addEventListener.bind(window) : window.removeEventListener.bind(window)
  acao('pointerdown', apertar, OUVIR_PONTEIRO)
  acao('pointerup', soltar, OUVIR_PONTEIRO)
  acao('pointercancel', soltar, OUVIR_PONTEIRO)
  if (ligar) return
  apertados.clear()
  esperando = null
}

/** Alguém está arrastando agora (um ponteiro apertado)? */
export function arrastandoAgora(): boolean {
  return apertados.size > 0
}

export function registrarCameraDaBatalha(tela: TelaDaCamera): () => void {
  if (telas.size === 0 && typeof window !== 'undefined') vigiarPonteiros(true)
  telas.add(tela)
  return () => {
    telas.delete(tela)
    if (telas.size === 0 && typeof window !== 'undefined') vigiarPonteiros(false)
  }
}

/** Ligada por padrão; desligada fica guardada neste computador. */
export function cameraDaBatalhaLigada(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) !== 'nao'
  } catch {
    return true
  }
}

export function ligarCameraDaBatalha(ligada: boolean) {
  try {
    if (ligada) window.localStorage.removeItem(CHAVE)
    else window.localStorage.setItem(CHAVE, 'nao')
  } catch {
    // Sem armazenamento (janela privada): vale só nesta sessão do app.
  }
  sessaoDesligada = !ligada
}

/**
 * Para onde a câmera vai para a ficha (em `ponto`, px da tela) ficar à vista:
 * `null` = já está à vista, longe da borda. Só translada: a escala é a de agora.
 */
export function alvoParaAFicha(camera: Camera, ponto: { x: number; y: number }, tela: { width: number; height: number }): Camera | null {
  const margemX = tela.width * BORDA
  const margemY = tela.height * BORDA
  const aVista = ponto.x >= margemX && ponto.x <= tela.width - margemX && ponto.y >= margemY && ponto.y <= tela.height - margemY
  if (aVista) return null
  return { ...camera, x: camera.x + (tela.width / 2 - ponto.x), y: camera.y + (tela.height / 2 - ponto.y) }
}

/** A vez trocou: traz a ficha da vez para a vista em toda tela registrada (se a câmera da batalha está ligada). */
export function trazerFichaDaVez(tokenId: string) {
  if (sessaoDesligada || !cameraDaBatalhaLigada()) {
    esperando = null
    return
  }
  // Quem arrasta o mapa ou uma ficha agora não tem a câmera roubada no meio do gesto: ela espera soltar.
  if (arrastandoAgora()) {
    esperando = tokenId
    return
  }
  esperando = null
  for (const tela of telas) {
    const ponto = tela.pontoDaFicha(tokenId)
    if (ponto === null) continue
    const elemento = tela.elemento?.() ?? null
    if (elemento === null) {
      const alvo = alvoParaAFicha(tela.camera(), ponto, tela.tela())
      if (alvo !== null) tela.irPara(alvo)
      continue
    }
    const destino = pontoAVista(ponto, tela.tela(), livreNaTela(elemento))
    if (destino === null) continue
    const camera = tela.camera()
    tela.irPara({ ...camera, x: camera.x + (destino.x - ponto.x), y: camera.y + (destino.y - ponto.y) })
  }
}
