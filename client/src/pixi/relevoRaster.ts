import { forEachExploredNotch, forEachExploredRun } from '../lib/exploration'
import { AJUSTE_DO_PENHASCO, AJUSTE_DO_RELEVO, corDaParede, tamanhoDaTextura, type ConhecidoDoRelevo, type PlanoDoRelevo } from '../lib/relevo'
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

/** Dá a vez ao navegador (um giro do laço de eventos): o plano do relevo (`drawRelevo`) usa o mesmo. */
export function ceder(): Promise<void> {
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

  // PENHASCO: a parede de pedra debaixo da costa riscada (`montarParede`).
  const parede = plano.penhascos.length > 0 ? await montarParede(plano, terra, conhecido, cancelado) : null
  if (cancelado()) return descartarTudo(terra, ...opcional(conhecido), ...opcional(parede?.tela ?? null))

  // Fora da terra: a sombra dela no mar — só da terra já conhecida. Com
  // penhasco, a sombra sai do pé da parede: a silhueta é a terra mais ela.
  const saida = novaTela(largura, altura)
  const gs = saida.getContext('2d')
  if (gs === null) return descartarTudo(terra, ...opcional(conhecido), ...opcional(parede?.tela ?? null))
  const s = AJUSTE_DO_RELEVO.sombra
  const silhueta = copiar(terra)
  soConhecido(silhueta)
  if (parede !== null) silhueta.getContext('2d')?.drawImage(parede.tela, parede.x, parede.y)
  sombraDe(gs, silhueta, rgba(s.cor, s.alfa), s.borrao * px, s.dx * px, s.dy * px)
  descartar(silhueta)
  gs.globalCompositeOperation = 'destination-out'
  gs.drawImage(terra, 0, 0)
  gs.globalCompositeOperation = 'source-over'
  // A parede por cima da sombra (ela é a coisa que faz a sombra).
  if (parede !== null) {
    gs.drawImage(parede.tela, parede.x, parede.y)
    descartar(parede.tela)
  }
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
  // A costa não entra (`bordasDaTerra`): o mar não escurece a terra. As
  // divisas pintadas (borda de desenho entre duas cores, `divisasPintadas`)
  // entram na MESMA tela: um traço só, então onde as duas se cruzam a sombra
  // não dobra.
  const o = AJUSTE_DO_RELEVO.oclusao
  if (plano.fronteiras.length > 0 || plano.divisas.length > 0) {
    const linhas = novaTela(largura, altura)
    const gl = linhas.getContext('2d')
    if (gl !== null) {
      mundo(gl)
      gl.strokeStyle = '#000'
      gl.lineWidth = o.largura * unidade
      gl.lineCap = 'round'
      tracarSegmentos(gl, [...plano.fronteiras, ...plano.divisas])
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

/** A parede do penhasco: uma tela do tamanho da caixa dos riscos e onde ela fica na textura. */
interface ParedeDoPenhasco {
  tela: Tela
  x: number
  y: number
}

/** Passos de profundidade desenhados entre uma pausa e outra: cada um é uma cópia da caixa dos riscos. */
const PASSOS_POR_PAUSA = 8

/**
 * A PAREDE DO PENHASCO (`lib/penhasco.ts`), como no protótipo: a terra debaixo
 * dos riscos repetida 1, 2, ... texels para baixo, do fundo para o lábio, cada
 * passo na cor da sua profundidade (`corDaParede`) — o mais raso cobre o mais
 * fundo, então cada ponto fica com a cor da distância até a costa logo acima.
 * Depois sai o que caiu sobre a terra: sobra só a faixa que desce para o mar,
 * e só debaixo da costa riscada ("gruda" na costa).
 *
 * Tudo numa tela do tamanho da CAIXA dos riscos (mais a parede embaixo), não
 * da textura inteira: o mestre risca um trecho de costa, e cada passo copia
 * só aquele pedaço. No jogador, o topo sai só da terra conhecida.
 */
async function montarParede(
  plano: PlanoDoRelevo,
  terra: Tela,
  conhecido: Tela | null,
  cancelado: () => boolean,
): Promise<ParedeDoPenhasco | null> {
  const { escala, unidade, retangulo } = plano
  const px = unidade * escala
  const p = AJUSTE_DO_PENHASCO
  const caixa = caixaDosRiscos(plano.penhascos, p.pontas * 1.5 * unidade)
  if (caixa === null) return null
  const passos = Math.max(1, Math.round(p.altura * px))
  const x0 = Math.max(0, Math.floor((caixa.minX - retangulo.x) * escala))
  const y0 = Math.max(0, Math.floor((caixa.minY - retangulo.y) * escala))
  const x1 = Math.min(terra.width, Math.ceil((caixa.maxX - retangulo.x) * escala))
  const y1 = Math.min(terra.height, Math.ceil((caixa.maxY - retangulo.y) * escala) + passos + 1)
  if (x1 <= x0 || y1 <= y0) return null
  const largura = x1 - x0
  const altura = y1 - y0
  const local = (g: Pincel) => g.setTransform(escala, 0, 0, escala, -retangulo.x * escala - x0, -retangulo.y * escala - y0)

  // Os riscos na ordem: riscar soma, apagar tira só do que veio antes.
  const riscos = novaTela(largura, altura)
  const gr = riscos.getContext('2d')
  if (gr === null) return null
  local(gr)
  gr.fillStyle = '#fff'
  gr.strokeStyle = '#fff'
  gr.lineCap = 'round'
  gr.lineJoin = 'round'
  for (const traco of plano.penhascos) {
    gr.globalCompositeOperation = traco.modo === 'riscar' ? 'source-over' : 'destination-out'
    riscar(gr, traco.pontos, traco.raio)
  }

  // O topo: a BEIRA de baixo da terra debaixo dos riscos (os texels de terra
  // com mar logo abaixo), com a borda dos riscos macia (a parede some aos
  // poucos onde o risco acaba). Só a beira, e não a terra inteira: a cor de
  // cada ponto da parede sai da distância até a costa logo acima, e um topo
  // que começasse mais acima numa coluna (a terra do jogador cortada pela
  // névoa) desenharia uma listra de faixas fora do lugar. No jogador, só a
  // beira conhecida.
  const beira = Math.max(2, Math.ceil(px))
  const topo = novaTela(largura, altura)
  const gt = topo.getContext('2d')
  if (gt === null) return descartarTudo(riscos)
  sombraDe(gt, riscos, '#fff', p.pontas * px)
  descartar(riscos)
  gt.globalCompositeOperation = 'destination-out'
  gt.drawImage(terra, -x0, -y0 - beira)
  gt.globalCompositeOperation = 'destination-in'
  gt.drawImage(terra, -x0, -y0)
  if (conhecido !== null) {
    // O conhecido alargado uns texels em volta: quem vê a costa do mar (a
    // terra é uma Sala, fechada para quem está fora) conhece o mar até a
    // beira, não a terra logo acima dela; e o explorado de quem andou pela
    // terra para nas células, um pouco antes da beira. A parede sai da beira,
    // então ela conta como vista quando o conhecido passa a até `alcance`
    // dela. A faixa a mais é a da própria linha da costa, que ele já vê, e a
    // parede só aparece no mar conhecido (a máscara da névoa no `PlayerView`).
    const alcance = Math.max(2, Math.ceil(p.alcanceDoConhecido * px))
    const conhecidoDaBeira = alargar(conhecido, x0, y0, largura, altura, alcance)
    if (conhecidoDaBeira === null) return descartarTudo(riscos, topo)
    gt.drawImage(conhecidoDaBeira, 0, 0)
    descartar(conhecidoDaBeira)
  }
  gt.globalCompositeOperation = 'source-over'

  const tela = novaTela(largura, altura)
  const gp = tela.getContext('2d')
  if (gp === null) return descartarTudo(topo)
  for (let k = passos; k >= 1; k -= 1) {
    // O meio do texel k abaixo da costa, em px do protótipo.
    sombraDe(gp, topo, rgba(corDaParede((k - 0.5) / px), 1), 0, 0, k)
    if (k % PASSOS_POR_PAUSA === 0) {
      await ceder()
      if (cancelado()) return descartarTudo(topo, tela)
    }
  }
  descartar(topo)
  gp.globalCompositeOperation = 'destination-out'
  gp.drawImage(terra, -x0, -y0)
  gp.globalCompositeOperation = 'source-over'
  return { tela, x: x0, y: y0 }
}

/**
 * O pedaço (`x0`, `y0`, `largura` × `altura`) da tela `fonte` alargado
 * `alcance` texels para todo lado (uma dilatação quadrada): em duas passadas,
 * de lado e de pé, cada uma com cópias deslocadas — sem ler pixel.
 */
function alargar(fonte: Tela, x0: number, y0: number, largura: number, altura: number, alcance: number): Tela | null {
  const deLado = novaTela(largura, altura)
  const gl = deLado.getContext('2d')
  if (gl === null) return null
  for (let k = -alcance; k <= alcance; k += 1) gl.drawImage(fonte, -x0 + k, -y0)
  const tela = novaTela(largura, altura)
  const g = tela.getContext('2d')
  if (g === null) return descartarTudo(deLado)
  for (let k = -alcance; k <= alcance; k += 1) g.drawImage(deLado, 0, k)
  descartar(deLado)
  return tela
}

/** Caixa, em px de mundo, dos riscos que põem penhasco (a borracha só tira), com o raio e a `folga`. */
function caixaDosRiscos(
  penhascos: PlanoDoRelevo['penhascos'],
  folga: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const traco of penhascos) {
    if (traco.modo !== 'riscar') continue
    const r = traco.raio + folga
    for (const ponto of traco.pontos) {
      minX = Math.min(minX, ponto.x - r)
      minY = Math.min(minY, ponto.y - r)
      maxX = Math.max(maxX, ponto.x + r)
      maxY = Math.max(maxY, ponto.y + r)
    }
  }
  return minX <= maxX && minY <= maxY ? { minX, minY, maxX, maxY } : null
}

/** Lados do polígono do toque (risco de um ponto só): um traço de comprimento zero não pinta em todo navegador. */
const LADOS_DO_TOQUE = 32

/** Um risco do pincel: o caminho na largura do pincel, de pontas redondas. */
function riscar(g: Pincel, pontos: readonly RegionPoint[], raio: number): void {
  if (pontos.length === 0) return
  if (pontos.length === 1) {
    const { x, y } = pontos[0]
    preencher(
      g,
      Array.from({ length: LADOS_DO_TOQUE }, (_, i) => {
        const t = (i / LADOS_DO_TOQUE) * Math.PI * 2
        return { x: x + Math.cos(t) * raio, y: y + Math.sin(t) * raio }
      }),
    )
    return
  }
  g.lineWidth = raio * 2
  g.beginPath()
  g.moveTo(pontos[0].x, pontos[0].y)
  for (let i = 1; i < pontos.length; i += 1) g.lineTo(pontos[i].x, pontos[i].y)
  g.stroke()
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
