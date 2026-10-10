import { forEachExploredNotch, forEachExploredRun } from '../lib/exploration'
import { AJUSTE_DO_RELEVO, tamanhoDaTextura, type ConhecidoDoRelevo, type PlanoDoRelevo } from '../lib/relevo'
import type { RegionPoint } from '../types/map'

/**
 * RELEVO — rasterização do plano (`lib/relevo.ts`) numa tela 2D, uma vez por
 * mudança de terra. Sai UMA textura que mora acima do chão das regiões:
 * - fora da terra, a sombra da terra no mar (no protótipo ela ficava POR BAIXO
 *   da terra; como é a sombra da própria terra, o pedaço sob ela some de
 *   qualquer jeito — aqui ele é apagado, e uma textura só basta);
 * - dentro da terra, o degradê da luz, a sombra das fronteiras e o friso/sombra
 *   da beira, recortados pela união.
 *
 * Só operações nativas do canvas (desenhar, compor, a sombra borrada do
 * canvas — que o Safari tem; `ctx.filter` ele não tem). Nenhum laço lê pixel.
 * Entre as etapas cede a vez ao navegador, para nenhuma tarefa travar a tela,
 * e para quando `cancelado()` diz que um pedido mais novo chegou.
 */

type Tela = HTMLCanvasElement
type Pincel = CanvasRenderingContext2D

function novaTela(largura: number, altura: number): Tela {
  const tela = document.createElement('canvas')
  tela.width = largura
  tela.height = altura
  return tela
}

/** Libera a memória de uma tela temporária sem esperar o coletor de lixo. */
function descartar(...telas: Tela[]): void {
  for (const tela of telas) {
    tela.width = 0
    tela.height = 0
  }
}

function ceder(): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, 0))
}

function rgba(cor: readonly number[], alfa: number): string {
  return `rgba(${cor[0]}, ${cor[1]}, ${cor[2]}, ${alfa})`
}

/**
 * A figura vai para longe da tela; só a sombra dela cai dentro. Deslocamento e
 * borrão da sombra são em pixels da tela (o canvas não os transforma). Bem
 * mais que o teto da textura (`TETO_DA_TEXTURA`) mais o borrão, e pequeno o
 * bastante para o deslocamento não perder precisão.
 */
const LONGE = 8192
function sombraDe(g: Pincel, fonte: Tela, cor: string, borrao: number, dx = 0, dy = 0): void {
  g.save()
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.shadowColor = cor
  g.shadowBlur = borrao
  g.shadowOffsetX = dx + LONGE
  g.shadowOffsetY = dy
  g.drawImage(fonte, -LONGE, 0)
  g.restore()
}

/** O que está em `a` e não está em `b` deslocada de (bx, by) pixels. */
function menos(a: Tela, b: Tela, bx: number, by: number): Tela | null {
  const tela = novaTela(a.width, a.height)
  const g = tela.getContext('2d')
  if (g === null) return null
  g.drawImage(a, 0, 0)
  g.globalCompositeOperation = 'destination-out'
  g.drawImage(b, bx, by)
  return tela
}

/**
 * Gera a tela do relevo do plano, ou `null` (canvas 2D indisponível, ou um
 * pedido mais novo cancelou este). A tela tem `tamanhoDaTextura(plano)` e
 * cobre `plano.retangulo` do mundo.
 */
export async function rasterizarRelevo(plano: PlanoDoRelevo, cancelado: () => boolean): Promise<HTMLCanvasElement | null> {
  const { largura, altura } = tamanhoDaTextura(plano)
  const { escala, unidade, retangulo } = plano
  // Px do protótipo → pixels desta tela.
  const px = unidade * escala
  const mundo = (g: Pincel) => g.setTransform(escala, 0, 0, escala, -retangulo.x * escala, -retangulo.y * escala)

  // A união da terra: cada polígono preenchido sozinho (num caminho só, a regra
  // "nonzero" abriria buraco onde duas regiões de sentidos opostos se cruzam).
  const terra = novaTela(largura, altura)
  const gt = terra.getContext('2d')
  if (gt === null) return null
  mundo(gt)
  gt.fillStyle = '#fff'
  for (const poligono of plano.terras) preencher(gt, poligono)
  // A fresta (ou a costura do antialias de dois preenchimentos) que
  // `bordasDaTerra` chamou de fronteira é fechada com a MESMA folga: senão o
  // mar sobrevive na fresta, e a divisa entre duas terras ganha sombra no mar
  // e friso de costa.
  if (plano.fronteiras.length > 0) {
    gt.strokeStyle = '#fff'
    gt.lineWidth = 2 * plano.folgaDaFronteira
    gt.lineCap = 'round'
    tracarSegmentos(gt, plano.fronteiras)
  }

  // O conhecido do jogador, na escala da textura: a origem de cada efeito é
  // cortada por ele (ver `ConhecidoDoRelevo`). Sem ele (o mestre), tudo vale.
  const conhecido = plano.conhecido === undefined ? null : rasterizarConhecido(plano.conhecido, largura, altura, mundo)
  const soConhecido = (tela: Tela): void => {
    if (conhecido === null) return
    const g = tela.getContext('2d')
    if (g === null) return
    g.save()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'destination-in'
    g.drawImage(conhecido, 0, 0)
    g.restore()
  }

  // Fora da terra: a sombra dela no mar — só da terra já conhecida.
  const saida = novaTela(largura, altura)
  const gs = saida.getContext('2d')
  if (gs === null) return descartarTudo(terra, ...opcional(conhecido))
  const s = AJUSTE_DO_RELEVO.sombra
  const silhueta = copiar(terra)
  soConhecido(silhueta)
  sombraDe(gs, silhueta, rgba(s.cor, s.alfa), s.borrao * px, s.dx * px, s.dy * px)
  descartar(silhueta)
  gs.globalCompositeOperation = 'destination-out'
  gs.drawImage(terra, 0, 0)
  gs.globalCompositeOperation = 'source-over'
  await ceder()
  if (cancelado()) return descartarTudo(terra, saida, ...opcional(conhecido))

  // Dentro da terra: degradê da luz, do canto de cima à esquerda do MAPA ao de
  // baixo à direita (o mesmo degradê na tela do mestre e na do jogador).
  const dentro = novaTela(largura, altura)
  const gd = dentro.getContext('2d')
  if (gd === null) return descartarTudo(terra, saida)
  const l = AJUSTE_DO_RELEVO.luz
  mundo(gd)
  const degrade = gd.createLinearGradient(0, 0, plano.mapa.largura * 0.8, plano.mapa.altura)
  degrade.addColorStop(0, `rgba(255, 255, 255, ${l.claro})`)
  degrade.addColorStop(0.5, 'rgba(128, 128, 128, 0)')
  degrade.addColorStop(1, `rgba(0, 0, 0, ${l.escuro})`)
  gd.fillStyle = degrade
  gd.fillRect(retangulo.x, retangulo.y, retangulo.largura, retangulo.altura)
  gd.setTransform(1, 0, 0, 1, 0, 0)

  // Sombra nas fronteiras: uma faixa sobre cada divisa entre terras, borrada.
  // A costa não entra (`bordasDaTerra`): o mar não escurece a terra.
  const o = AJUSTE_DO_RELEVO.oclusao
  if (plano.fronteiras.length > 0) {
    const linhas = novaTela(largura, altura)
    const gl = linhas.getContext('2d')
    if (gl !== null) {
      mundo(gl)
      gl.strokeStyle = '#000'
      gl.lineWidth = o.largura * unidade
      gl.lineCap = 'round'
      tracarSegmentos(gl, plano.fronteiras)
      // Divisa na névoa não escurece nada: a faixa borrada dela alcançaria a terra já vista.
      soConhecido(linhas)
      sombraDe(gd, linhas, rgba(o.cor, o.alfa), o.borrao * px)
    }
    descartar(linhas)
    await ceder()
    if (cancelado()) return descartarTudo(terra, saida, dentro, ...opcional(conhecido))
  }

  // Friso claro na beira virada para a luz e sombra fina na oposta: a terra
  // menos ela mesma deslocada para baixo-direita (e para cima-esquerda).
  const bisel = l.bisel * px
  // Sai da terra INTEIRA (cortar a terra pelo conhecido inventaria uma costa
  // na beira da névoa); só a beira já conhecida acende.
  const claro = menos(terra, terra, bisel, bisel)
  if (claro !== null) {
    soConhecido(claro)
    sombraDe(gd, claro, rgba(l.friso.cor, l.friso.alfa), l.friso.borrao * px)
    descartar(claro)
  }
  const escuro = menos(terra, terra, -bisel, -bisel)
  if (escuro !== null) {
    soConhecido(escuro)
    sombraDe(gd, escuro, rgba(l.sombraBorda.cor, l.sombraBorda.alfa), l.sombraBorda.borrao * px)
    descartar(escuro)
  }
  await ceder()
  if (cancelado()) return descartarTudo(terra, saida, dentro, ...opcional(conhecido))

  gd.globalCompositeOperation = 'destination-in'
  gd.drawImage(terra, 0, 0)
  gs.drawImage(dentro, 0, 0)
  descartar(terra, dentro, ...opcional(conhecido))
  return saida
}

function opcional(tela: Tela | null): Tela[] {
  return tela === null ? [] : [tela]
}

function preencher(g: Pincel, poligono: readonly RegionPoint[]): void {
  if (poligono.length < 3) return
  g.beginPath()
  g.moveTo(poligono[0].x, poligono[0].y)
  for (let i = 1; i < poligono.length; i += 1) g.lineTo(poligono[i].x, poligono[i].y)
  g.closePath()
  g.fill()
}

function tracarSegmentos(g: Pincel, segmentos: readonly { a: RegionPoint; b: RegionPoint }[]): void {
  g.beginPath()
  for (const { a, b } of segmentos) {
    g.moveTo(a.x, a.y)
    g.lineTo(b.x, b.y)
  }
  g.stroke()
}

/** Cópia de uma tela (a original segue intacta para as etapas seguintes). */
function copiar(fonte: Tela): Tela {
  const tela = novaTela(fonte.width, fonte.height)
  tela.getContext('2d')?.drawImage(fonte, 0, 0)
  return tela
}

/**
 * O conhecido em branco numa tela do tamanho da textura: a mesma geometria
 * da `knownMask` da névoa (visão, contornos lembrados, células exploradas e os
 * dentes da borda delas). Cada polígono preenchido sozinho, como a terra.
 */
function rasterizarConhecido(conhecido: ConhecidoDoRelevo, largura: number, altura: number, mundo: (g: Pincel) => void): Tela | null {
  const tela = novaTela(largura, altura)
  const g = tela.getContext('2d')
  if (g === null) return null
  mundo(g)
  g.fillStyle = '#fff'
  for (const poligono of conhecido.visao) preencher(g, poligono)
  const explorado = conhecido.explorado
  if (explorado !== undefined) {
    for (const anel of explorado.rings) preencher(g, anel.points)
    const celula = explorado.cell
    forEachExploredRun(explorado, (linha, inicio, fim) => g.fillRect(inicio * celula, linha * celula, (fim - inicio) * celula, celula))
    forEachExploredNotch(explorado, (ax, ay, bx, by, cx, cy) =>
      preencher(g, [
        { x: ax, y: ay },
        { x: bx, y: by },
        { x: cx, y: cy },
      ]),
    )
  }
  return tela
}

function descartarTudo(...telas: Tela[]): null {
  descartar(...telas)
  return null
}
