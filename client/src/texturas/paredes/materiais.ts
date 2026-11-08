import type { MaterialDaParede } from '../../types/map'

/**
 * As IMAGENS dos materiais da parede (o catálogo e o formato estão em
 * `catalogo.ts`): o lugar único é `texturas/paredes/imagens/<material>.png`.
 * Separado do catálogo porque o glob só existe no Vite; quem lê o mapa (e o
 * teste) usa o catálogo sem baixar nada.
 */

// Só a URL (string) entra no JS; o PNG é baixado quando a primeira parede daquele material aparece.
const URLS = import.meta.glob<string>('./imagens/*.png', { eager: true, query: '?url', import: 'default' })

/** A URL do PNG do material (`imagens/<material>.png`); `null` se o arquivo não está lá. */
export function urlDoMaterial(material: MaterialDaParede): string | null {
  return URLS[`./imagens/${material}.png`] ?? null
}

const prontas = new Map<MaterialDaParede, HTMLImageElement>()
const pedidas = new Set<MaterialDaParede>()
const ouvintes = new Set<() => void>()

/**
 * A imagem do material, se já chegou; `null` enquanto baixa (o primeiro pedido
 * começa o download, e quem ouve `assinarMateriais` repinta quando ela chega).
 * Enquanto isso a parede sai como linha: nunca some da tela.
 */
export function imagemDoMaterial(material: MaterialDaParede): HTMLImageElement | null {
  const pronta = prontas.get(material)
  if (pronta !== undefined) return pronta
  const url = urlDoMaterial(material)
  if (url === null || pedidas.has(material)) return null
  pedidas.add(material)
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    prontas.set(material, img)
    for (const ouvir of ouvintes) ouvir()
  }
  // PNG que não abre: a parede continua de linha, sem tentar de novo a cada quadro.
  img.onerror = () => undefined
  img.src = url
  return null
}

/** Avisa quando a imagem de algum material chega. Devolve o "parar de ouvir". */
export function assinarMateriais(ouvir: () => void): () => void {
  ouvintes.add(ouvir)
  return () => {
    ouvintes.delete(ouvir)
  }
}
