import { ALCANCE_DO_PINCEL, MIOLO_DO_PINCEL, type FormaDoPasso, type PlanoDasTexturas } from '../lib/planoDasTexturas'
import type { Caixa } from '../lib/texturas'
import type { RegionPoint } from '../types/map'

/**
 * TEXTURAS — as máscaras das camadas (`lib/planoDasTexturas.ts`) pintadas
 * numa tela 2D, uma por camada, uma vez por mudança. A tela do mapa
 * (`drawTexturas.ts`) põe a textura repetida de cada camada através da
 * máscara dela.
 *
 * Só operações nativas do canvas e a sombra borrada (o Safari não tem
 * `ctx.filter`, como o relevo já descobriu). Cada passo vai primeiro para uma
 * tela de rascunho do tamanho dele (para a força valer para o passo inteiro,
 * sem o traço se somar onde cruza consigo mesmo) e depois entra nas camadas.
 * Entre passos, cede a vez ao navegador.
 */

type Tela = HTMLCanvasElement
type Pincel = CanvasRenderingContext2D

/** A figura vai para longe; só a sombra borrada dela cai na tela (o mesmo truque do relevo). */
const LONGE = 16384

function novaTela(largura: number, altura: number): Tela {
  const tela = document.createElement('canvas')
  tela.width = largura
  tela.height = altura
  return tela
}

function descartar(tela: Tela): void {
  tela.width = 0
  tela.height = 0
}

function ceder(): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, 0))
}

function caminhoDoPoligono(g: Pincel, pontos: readonly RegionPoint[]): void {
  const [primeiro, ...resto] = pontos
  if (primeiro === undefined) return
  g.moveTo(primeiro.x, primeiro.y)
  for (const p of resto) g.lineTo(p.x, p.y)
  g.closePath()
}

function caminhoDaLinha(g: Pincel, pontos: readonly RegionPoint[], fechada: boolean): void {
  const [primeiro, ...resto] = pontos
  if (primeiro === undefined) return
  g.moveTo(primeiro.x, primeiro.y)
  for (const p of resto) g.lineTo(p.x, p.y)
  if (fechada) g.closePath()
}

/**
 * Pinta a forma do passo em branco no rascunho (`caixa` do passo = a tela
 * inteira), com a borda macia do pincel; o balde sai com a borda da forma.
 */
function pintarForma(g: Pincel, forma: FormaDoPasso, caixa: Caixa, escala: number): void {
  const ox = -caixa.minX * escala
  const oy = -caixa.minY * escala
  g.fillStyle = '#fff'
  g.strokeStyle = '#fff'
  if (forma.tipo === 'caminho') {
    // Miolo até 80% do raio, borrado até ~115%: o pincel macio dos programas de pintura.
    const borrao = (ALCANCE_DO_PINCEL - MIOLO_DO_PINCEL) * forma.raio * escala * 0.9
    const macio = borrao >= 0.75
    g.save()
    g.setTransform(escala, 0, 0, escala, ox - (macio ? LONGE : 0), oy)
    if (macio) {
      g.shadowColor = '#fff'
      g.shadowBlur = borrao
      g.shadowOffsetX = LONGE
      g.shadowOffsetY = 0
    }
    const miolo = forma.raio * MIOLO_DO_PINCEL
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.lineWidth = miolo * 2
    g.beginPath()
    if (forma.pontos.length === 1) {
      g.arc(forma.pontos[0].x, forma.pontos[0].y, miolo, 0, Math.PI * 2)
      g.fill()
    } else {
      caminhoDaLinha(g, forma.pontos, false)
      g.stroke()
    }
    g.restore()
    return
  }
  const { contorno, recortes } = forma.forma
  g.save()
  g.setTransform(escala, 0, 0, escala, ox, oy)
  g.beginPath()
  caminhoDoPoligono(g, contorno)
  g.fill('evenodd')
  // O que está desenhado por cima da forma fica de fora do balde.
  g.globalCompositeOperation = 'destination-out'
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const recorte of recortes) {
    g.beginPath()
    if (recorte.tipo === 'area') {
      caminhoDoPoligono(g, recorte.pontos)
      g.fill('evenodd')
    } else {
      g.lineWidth = recorte.largura
      caminhoDaLinha(g, recorte.pontos, recorte.fechada)
      g.stroke()
    }
  }
  g.restore()
}

/**
 * As máscaras do plano (uma tela por camada, na ordem), ou `null` (canvas 2D
 * indisponível, ou `cancelado()` — um pedido mais novo chegou).
 */
export async function rasterizarTexturas(plano: PlanoDasTexturas, cancelado: () => boolean): Promise<Tela[] | null> {
  const { escala } = plano
  const mascaras = plano.camadas.map((c) => novaTela(c.largura, c.altura))
  const pinceis: Pincel[] = []
  for (const tela of mascaras) {
    const g = tela.getContext('2d')
    if (g === null) {
      mascaras.forEach(descartar)
      return null
    }
    pinceis.push(g)
  }
  let rascunho: Tela | null = null
  let ultimaCessao = performance.now()
  for (const passo of plano.passos) {
    const largura = Math.max(1, Math.round((passo.caixa.maxX - passo.caixa.minX) * escala))
    const altura = Math.max(1, Math.round((passo.caixa.maxY - passo.caixa.minY) * escala))
    // O rascunho só cresce: um por geração, reaproveitado entre passos.
    if (rascunho === null || rascunho.width < largura || rascunho.height < altura) {
      if (rascunho !== null) descartar(rascunho)
      rascunho = novaTela(Math.max(largura, rascunho?.width ?? 0), Math.max(altura, rascunho?.height ?? 0))
    }
    const g = rascunho.getContext('2d')
    if (g === null) break
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'source-over'
    g.clearRect(0, 0, rascunho.width, rascunho.height)
    pintarForma(g, passo.forma, passo.caixa, escala)

    const alvos = passo.camada === null ? passo.apagaDe : [passo.camada]
    for (const indice of alvos) {
      const camada = plano.camadas[indice]
      const m = pinceis[indice]
      m.globalAlpha = passo.forca
      m.globalCompositeOperation = passo.camada === null ? 'destination-out' : 'source-over'
      const dx = Math.round((passo.caixa.minX - camada.caixa.minX) * escala)
      const dy = Math.round((passo.caixa.minY - camada.caixa.minY) * escala)
      m.drawImage(rascunho, 0, 0, largura, altura, dx, dy, largura, altura)
    }
    if (performance.now() - ultimaCessao > 8) {
      await ceder()
      if (cancelado()) {
        descartar(rascunho)
        mascaras.forEach(descartar)
        return null
      }
      ultimaCessao = performance.now()
    }
  }
  if (rascunho !== null) descartar(rascunho)
  for (const m of pinceis) {
    m.globalAlpha = 1
    m.globalCompositeOperation = 'source-over'
  }
  return mascaras
}
