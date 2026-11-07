/**
 * O RECORTE DA FOTO DE PERFIL (07/11/2026), sem tela: a conta do palco
 * quadrado (o círculo é o inscrito nele), o zoom que mantém o centro e a
 * imagem final, reduzida no navegador para 256 x 256.
 *
 * O palco mede `LADO_DO_PALCO` px; a imagem começa cobrindo o quadrado (o
 * lado menor dela = o lado do palco) e `x`/`y` são o quanto ela saiu do
 * centro, em px do palco. Nunca sobra fundo: `limitar` segura a imagem.
 */

export const LADO_DO_PALCO = 240
export const LADO_DA_FOTO = 256
export const ZOOM_MAX = 4
/** O teto do servidor (lobby/nuvem/src/fotoDePerfil.ts). */
export const FOTO_MAX_BYTES = 256 * 1024
/** O arquivo de origem: acima disto o navegador sofre para abrir e não vale a pena. */
export const ORIGEM_MAX_BYTES = 20 * 1024 * 1024

export interface Recorte {
  zoom: number
  x: number
  y: number
}

export const RECORTE_INICIAL: Recorte = { zoom: 1, x: 0, y: 0 }

interface Caixa {
  esquerda: number
  topo: number
  largura: number
  altura: number
}

const entre = (valor: number, minimo: number, maximo: number): number => Math.min(Math.max(valor, minimo), maximo)

/** Onde a imagem fica no palco de `lado` px. */
export function caixaDoRecorte(recorte: Recorte, largura: number, altura: number, lado: number = LADO_DO_PALCO): Caixa {
  const escala = (LADO_DO_PALCO / Math.min(largura, altura)) * recorte.zoom
  const fator = lado / LADO_DO_PALCO
  const w = largura * escala
  const h = altura * escala
  return { esquerda: ((LADO_DO_PALCO - w) / 2 + recorte.x) * fator, topo: ((LADO_DO_PALCO - h) / 2 + recorte.y) * fator, largura: w * fator, altura: h * fator }
}

/** O zoom entre 1 e o máximo e a imagem sempre cobrindo o quadrado. */
export function limitar(recorte: Recorte, largura: number, altura: number): Recorte {
  const zoom = entre(Number.isFinite(recorte.zoom) ? recorte.zoom : 1, 1, ZOOM_MAX)
  const escala = (LADO_DO_PALCO / Math.min(largura, altura)) * zoom
  const folgaX = (largura * escala - LADO_DO_PALCO) / 2
  const folgaY = (altura * escala - LADO_DO_PALCO) / 2
  return { zoom, x: entre(recorte.x, -folgaX, folgaX), y: entre(recorte.y, -folgaY, folgaY) }
}

/** Outro zoom com o mesmo ponto no centro do círculo. */
export function comZoom(recorte: Recorte, zoom: number, largura: number, altura: number): Recorte {
  const novo = entre(zoom, 1, ZOOM_MAX)
  const razao = novo / recorte.zoom
  return limitar({ zoom: novo, x: recorte.x * razao, y: recorte.y * razao }, largura, altura)
}

function paraBlob(tela: HTMLCanvasElement, tipo: string, qualidade?: number): Promise<Blob | null> {
  return new Promise((pronto) => tela.toBlob(pronto, tipo, qualidade))
}

/** Qualidades do WebP, da melhor para a menor: 256 x 256 cabe com folga já na primeira. */
const QUALIDADES_DO_WEBP = [0.86, 0.72, 0.58] as const

/**
 * A foto final: o quadrado do círculo em 256 x 256, WebP (ou PNG, se o
 * navegador não faz WebP; JPG por último, se o PNG passar do teto). `null` =
 * não coube no teto de jeito nenhum.
 */
export async function fotoRecortada(imagem: HTMLImageElement, recorte: Recorte, fundo: string): Promise<Blob | null> {
  const tela = document.createElement('canvas')
  tela.width = LADO_DA_FOTO
  tela.height = LADO_DA_FOTO
  const contexto = tela.getContext('2d')
  if (contexto === null) return null
  contexto.imageSmoothingEnabled = true
  contexto.imageSmoothingQuality = 'high'
  const caixa = caixaDoRecorte(recorte, imagem.naturalWidth, imagem.naturalHeight, LADO_DA_FOTO)
  contexto.drawImage(imagem, caixa.esquerda, caixa.topo, caixa.largura, caixa.altura)
  for (const qualidade of QUALIDADES_DO_WEBP) {
    const webp = await paraBlob(tela, 'image/webp', qualidade)
    // O navegador sem WebP devolve PNG no lugar: segue para o PNG.
    if (webp === null || webp.type !== 'image/webp') break
    if (webp.size <= FOTO_MAX_BYTES) return webp
  }
  const png = await paraBlob(tela, 'image/png')
  if (png !== null && png.size <= FOTO_MAX_BYTES) return png
  // JPG não tem transparência: o fundo da página por baixo, para o canto transparente não virar preto.
  const opaca = document.createElement('canvas')
  opaca.width = LADO_DA_FOTO
  opaca.height = LADO_DA_FOTO
  const daOpaca = opaca.getContext('2d')
  if (daOpaca === null) return null
  daOpaca.fillStyle = fundo
  daOpaca.fillRect(0, 0, LADO_DA_FOTO, LADO_DA_FOTO)
  daOpaca.drawImage(tela, 0, 0)
  const jpg = await paraBlob(opaca, 'image/jpeg', 0.82)
  return jpg !== null && jpg.size <= FOTO_MAX_BYTES ? jpg : null
}
