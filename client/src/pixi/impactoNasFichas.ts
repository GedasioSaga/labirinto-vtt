import type { Container, Ticker } from 'pixi.js'

/**
 * D4 (plano de unificação do combate, 10/11/2026): o IMPACTO NA FICHA do
 * mapa, o mesmo módulo no editor do mestre (`PixiCanvas.tsx`) e na tela do
 * jogador (`PlayerView.tsx`). Quem desenha as fichas registra uma busca
 * (tokenId -> o invólucro da ficha, `TokensRenderer.involucroDe`) e o relógio
 * da tela; os efeitos da batalha (`EfeitosDaBatalha.tsx`, DOM) pedem:
 *
 *   recuarFicha  a ficha atingida recua ~10 px (na direção do golpe) em 90 ms
 *                e volta em 180 ms (o clarão de ~90 ms é do DOM, por cima);
 *   tombarFicha  a ficha que caiu tomba 12° em 320 ms e fica esmaecida até
 *                levantar (`levantarFicha`, `levantarTodas`).
 *
 * Mexe só no `pivot`, na `rotation` e no `tint` do invólucro: o desenho das
 * fichas escreve a posição e o alpha dele a cada quadro, e nenhum dos três.
 * Movimento reduzido: sem recuo nem giro; a queda só esmaece.
 */

export type BuscaDaFicha = (tokenId: string) => Container | null
type Relogio = Pick<Ticker, 'add' | 'remove'>

interface TelaDasFichas {
  buscar: BuscaDaFicha
  relogio: Relogio
}

const telas = new Set<TelaDasFichas>()
const caidas = new Set<string>()

const RECUO_PX = 10
const RECUO_IDA_MS = 90
const RECUO_VOLTA_MS = 180
const TOMBO_RAD = (12 * Math.PI) / 180
const TOMBO_MS = 320
/** A ficha caída: o disco escurece (o tint multiplica), sem sumir. */
const TINTA_DA_CAIDA = 0x8a8a8a
const SEM_TINTA = 0xffffff

/** Saída forte (a mesma intenção da `cubic-bezier(0.23, 1, 0.32, 1)` do DOM). */
const saida = (t: number) => 1 - Math.pow(1 - t, 5)

/** Registra as fichas de uma tela. Devolve o "desregistrar" (chame ao desmontar). */
export function registrarFichasDoImpacto(buscar: BuscaDaFicha, relogio: Relogio): () => void {
  const tela: TelaDasFichas = { buscar, relogio }
  telas.add(tela)
  return () => {
    telas.delete(tela)
  }
}

/** A escala da tela no invólucro (o zoom do mapa): 10 px na tela, não no mundo. */
function escalaNaTela(ficha: Container): number {
  const pai = ficha.parent
  if (pai === null) return 1
  const { a, b } = pai.worldTransform
  return Math.hypot(a, b) || 1
}

/** Toca `passo(0..1)` no relógio da tela por `ms`; termina chamando `passo(1)`. */
function tocar(relogio: Relogio, ms: number, passo: (t: number) => void, fim?: () => void) {
  const inicio = performance.now()
  const quadro = () => {
    const t = Math.min(1, (performance.now() - inicio) / ms)
    passo(t)
    if (t >= 1) {
      relogio.remove(quadro)
      fim?.()
    }
  }
  relogio.add(quadro)
}

/**
 * A ficha atingida recua. `direcao` = de onde veio o golpe para o alvo (px da
 * tela, qualquer tamanho); `null` = para a direita.
 */
export function recuarFicha(tokenId: string, direcao: { x: number; y: number } | null, reduzido: boolean) {
  if (reduzido) return
  const comprimento = direcao === null ? 0 : Math.hypot(direcao.x, direcao.y)
  const ux = comprimento > 0 && direcao !== null ? direcao.x / comprimento : 1
  const uy = comprimento > 0 && direcao !== null ? direcao.y / comprimento : 0
  for (const tela of telas) {
    const ficha = tela.buscar(tokenId)
    if (ficha === null || ficha.destroyed) continue
    const escala = escalaNaTela(ficha)
    const dx = (RECUO_PX * ux) / escala
    const dy = (RECUO_PX * uy) / escala
    // O pivot ao contrário empurra o desenho para o lado do recuo.
    const por = (k: number) => {
      if (!ficha.destroyed) ficha.pivot.set(-dx * k, -dy * k)
    }
    tocar(tela.relogio, RECUO_IDA_MS, (t) => por(saida(t)), () =>
      tocar(tela.relogio, RECUO_VOLTA_MS, (t) => por(1 - saida(t))),
    )
  }
}

/** A ficha caiu: tomba 12° e fica esmaecida até levantar. */
export function tombarFicha(tokenId: string, reduzido: boolean) {
  caidas.add(tokenId)
  for (const tela of telas) {
    const ficha = tela.buscar(tokenId)
    if (ficha === null || ficha.destroyed) continue
    ficha.tint = TINTA_DA_CAIDA
    if (reduzido) continue
    const de = ficha.rotation
    tocar(tela.relogio, TOMBO_MS, (t) => {
      if (!ficha.destroyed && caidas.has(tokenId)) ficha.rotation = de + (TOMBO_RAD - de) * saida(t)
    })
  }
}

/** A ficha voltou (curada, ou é a vez dela): de pé e com a cor de volta, na hora. */
export function levantarFicha(tokenId: string) {
  if (!caidas.delete(tokenId)) return
  for (const tela of telas) {
    const ficha = tela.buscar(tokenId)
    if (ficha === null || ficha.destroyed) continue
    ficha.rotation = 0
    ficha.tint = SEM_TINTA
  }
}

/** A batalha acabou: todas de pé. */
export function levantarTodas() {
  for (const tokenId of [...caidas]) levantarFicha(tokenId)
}

/** Está tombada por este módulo? */
export function estaTombada(tokenId: string): boolean {
  return caidas.has(tokenId)
}
