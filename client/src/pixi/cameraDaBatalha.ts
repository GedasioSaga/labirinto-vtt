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
const apertar = (evento: PointerEvent) => apertados.add(evento.pointerId)
const soltar = (evento: PointerEvent) => apertados.delete(evento.pointerId)
const OUVIR_PONTEIRO: AddEventListenerOptions = { capture: true, passive: true }

function vigiarPonteiros(ligar: boolean) {
  const acao = ligar ? window.addEventListener.bind(window) : window.removeEventListener.bind(window)
  acao('pointerdown', apertar, OUVIR_PONTEIRO)
  acao('pointerup', soltar, OUVIR_PONTEIRO)
  acao('pointercancel', soltar, OUVIR_PONTEIRO)
  if (!ligar) apertados.clear()
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
  if (sessaoDesligada || !cameraDaBatalhaLigada()) return
  // Quem arrasta o mapa ou uma ficha agora não tem a câmera roubada no meio do gesto.
  if (arrastandoAgora()) return
  for (const tela of telas) {
    const ponto = tela.pontoDaFicha(tokenId)
    if (ponto === null) continue
    const alvo = alvoParaAFicha(tela.camera(), ponto, tela.tela())
    if (alvo !== null) tela.irPara(alvo)
  }
}
