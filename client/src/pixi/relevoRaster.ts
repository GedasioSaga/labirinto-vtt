import { forEachExploredNotch, forEachExploredRun } from '../lib/exploration'
import {
  AJUSTE_DO_PENHASCO,
  AJUSTE_DO_RELEVO,
  alturaDaParede,
  corDaParede,
  degrausDaParede,
  tamanhoDaTextura,
  type ConhecidoDoRelevo,
  type DegrauDaParede,
  type PlanoDoRelevo,
} from '../lib/relevo'
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

/** Cópias da caixa desenhadas entre uma pausa e outra (cada passo de profundidade de cada degrau é uma). */
const PASSOS_POR_PAUSA = 8

/** Um pedaço da textura, em texels: a caixa da parede inteira, ou a de um degrau dentro dela. */
interface Quadro {
  x: number
  y: number
  largura: number
  altura: number
}

/**
 * O quadro, na textura, dos riscos que põem penhasco com altura em `niveis`
 * (todos, sem filtro), mais a parede de `passos` texels embaixo. `null` sem
 * risco, ou fora da textura.
 */
function quadroDosRiscos(plano: PlanoDoRelevo, terra: Tela, passos: number, niveis?: readonly number[]): Quadro | null {
  const { escala, unidade, retangulo } = plano
  const riscos = niveis === undefined ? plano.penhascos : plano.penhascos.filter((t) => t.modo === 'riscar' && niveis.includes(alturaDaParede(t)))
  const caixa = caixaDosRiscos(riscos, AJUSTE_DO_PENHASCO.pontas * 1.5 * unidade)
  if (caixa === null) return null
  const x0 = Math.max(0, Math.floor((caixa.minX - retangulo.x) * escala))
  const y0 = Math.max(0, Math.floor((caixa.minY - retangulo.y) * escala))
  const x1 = Math.min(terra.width, Math.ceil((caixa.maxX - retangulo.x) * escala))
  const y1 = Math.min(terra.height, Math.ceil((caixa.maxY - retangulo.y) * escala) + passos + 1)
  return x1 <= x0 || y1 <= y0 ? null : { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0 }
}

/** Texels de profundidade de uma parede de `altura` px do protótipo. */
function passosDaAltura(altura: number, px: number): number {
  return Math.max(1, Math.round(altura * px))
}

/** Um degrau pronto para descer: o topo dele (`topoDoDegrau`) e onde ele fica dentro da caixa da parede. */
interface DegrauNaTela {
  topo: Tela
  x: number
  y: number
  passos: number
  altura: number
}

/**
 * A PAREDE DO PENHASCO (`lib/penhasco.ts`), como no protótipo: a terra debaixo
 * dos riscos repetida 1, 2, ... texels para baixo, do fundo para o lábio, cada
 * passo na cor da sua profundidade (`corDaParede`) — o mais raso cobre o mais
 * fundo, então cada ponto fica com a cor da distância até a costa logo acima.
 * Depois sai o que caiu sobre a terra: sobra só a faixa que desce para o mar,
 * e só debaixo da costa riscada ("gruda" na costa).
 *
 * ALTURA POR RISCO: a parede é feita de degraus (`degrausDaParede`), cada um
 * com o topo dos riscos que descem pelo menos a altura dele. Em cada
 * profundidade descem os degraus que chegam nela, do mais baixo ao mais alto,
 * cada um na cor da sua altura: o ponto fica com a cor da altura dele, e onde
 * um degrau acaba (a borda macia do topo) o de baixo continua por trás, sem
 * fresta. Só Médio (o mapa de antes): um degrau só, a parede de sempre.
 *
 * Tudo numa tela do tamanho da CAIXA dos riscos (mais a parede embaixo), não
 * da textura inteira: o mestre risca um trecho de costa, e cada passo copia
 * só aquele pedaço; o degrau mais alto, só a caixa dos riscos dele. No
 * jogador, o topo sai só da terra conhecida.
 */
async function montarParede(
  plano: PlanoDoRelevo,
  terra: Tela,
  conhecido: Tela | null,
  cancelado: () => boolean,
): Promise<ParedeDoPenhasco | null> {
  const px = plano.unidade * plano.escala
  const degraus = degrausDaParede(plano.penhascos, plano.unidade)
  if (degraus.length === 0) return null
  const quadro = quadroDosRiscos(plano, terra, passosDaAltura(degraus[degraus.length - 1].altura, px))
  if (quadro === null) return null

  const prontos = await topoDosDegraus(plano, degraus, quadro, terra, conhecido, cancelado)
  if (prontos === null) return null

  const tela = novaTela(quadro.largura, quadro.altura)
  const gp = tela.getContext('2d')
  const topos = prontos.map((d) => d.topo)
  if (gp === null) return descartarTudo(...topos)
  // Com mais de um degrau, cada profundidade é somada aqui antes de ir à parede.
  const soma = prontos.length > 1 ? novaTela(quadro.largura, quadro.altura) : null
  const gs = soma === null ? null : soma.getContext('2d')
  if (soma !== null && gs === null) return descartarTudo(...topos, tela, soma)
  const descer = (g: Pincel, degrau: DegrauNaTela, k: number) =>
    // O meio do texel k abaixo da costa, em px do protótipo, na cor da altura do degrau.
    sombraDe(g, degrau.topo, rgba(corDaParede((k - 0.5) / px, degrau.altura), 1), 0, degrau.x, degrau.y + k)
  let copias = 0
  for (let k = prontos[prontos.length - 1].passos; k >= 1; k -= 1) {
    // Os degraus que ainda chegam a esta profundidade. Cada texel é de UM
    // degrau só (`topoDosDegraus`): somados (`lighter`), a emenda macia entre
    // dois fecha em 1, e cada ponto fica com a cor da altura dele — nada da
    // cor de outra altura vaza pela beira antialiasada da costa. A soma então
    // cobre o que veio de mais fundo, como o degrau único cobria.
    const chegam = prontos.filter((d) => d.passos >= k)
    if (chegam.length === 1 || soma === null || gs === null) {
      for (const degrau of chegam) descer(gp, degrau, k)
    } else {
      gs.clearRect(0, 0, soma.width, soma.height)
      gs.globalCompositeOperation = 'lighter'
      for (const degrau of chegam) descer(gs, degrau, k)
      gp.drawImage(soma, 0, 0)
    }
    // Conta em caixas inteiras: o anel de um degrau de rampa é uma fração da
    // caixa, e pausar por ele como por uma caixa inteira só somaria espera
    // (cada pausa custa uns 4 ms do relógio do navegador). A soma é uma caixa.
    for (const degrau of chegam) copias += (degrau.topo.width * degrau.topo.height) / (quadro.largura * quadro.altura)
    if (chegam.length > 1) copias += 1
    if (copias >= PASSOS_POR_PAUSA) {
      copias = 0
      await ceder()
      if (cancelado()) return descartarTudo(...topos, tela, ...opcional(soma))
    }
  }
  descartar(...topos, ...opcional(soma))
  gp.globalCompositeOperation = 'destination-out'
  gp.drawImage(terra, -quadro.x, -quadro.y)
  gp.globalCompositeOperation = 'source-over'
  return { tela, x: quadro.x, y: quadro.y }
}

/** A forma de um degrau ainda sem o anel cortado: a do degrau seguinte sai dela. */
interface FormaAberta {
  forma: Tela
  daqui: Quadro
  passos: number
  altura: number
  /** A forma é uma das máscaras por altura (o degrau único): não é desta etapa descartar nem cortar. */
  emprestada: boolean
}

/**
 * O topo de cada degrau, do mais baixo ao mais alto (a ordem em que descem).
 * Primeiro as máscaras de cada altura de risco (o último risco vale onde dois
 * se sobrepõem, a borracha tira de todas); depois a forma de cada degrau é a
 * união das alturas que chegam nele, menos o recuo da rampa. As formas são
 * encaixadas (a de cima cabe na de baixo); o topo de cada degrau sai do ANEL,
 * a forma dele menos a do seguinte, então cada texel é de um degrau só e os
 * anéis borrados somam exatamente o borrão da união.
 */
async function topoDosDegraus(
  plano: PlanoDoRelevo,
  degraus: readonly DegrauDaParede[],
  quadro: Quadro,
  terra: Tela,
  conhecido: Tela | null,
  cancelado: () => boolean,
): Promise<DegrauNaTela[] | null> {
  const px = plano.unidade * plano.escala
  const mascaras = mascarasPorAltura(plano, quadro)
  if (mascaras === null) return null
  const todas = [...mascaras.values()]
  const conhecidoDaBeira = conhecido === null ? null : alargarConhecido(conhecido, quadro, px)
  if (conhecido !== null && conhecidoDaBeira === null) return descartarTudo(...todas)
  const recuos = new Map<number, { tela: Tela; alcance: number }>()
  const prontos: DegrauNaTela[] = []
  let aberta: FormaAberta | null = null
  const desistir = (): null =>
    descartarTudo(
      ...todas,
      ...[...recuos.values()].map((r) => r.tela),
      ...prontos.map((d) => d.topo),
      ...(aberta === null || aberta.emprestada ? [] : [aberta.forma]),
      ...opcional(conhecidoDaBeira),
    )
  // O anel da forma aberta (menos a `seguinte`, se houver) vira o topo pronto.
  const fechar = (atual: FormaAberta, seguinte: FormaAberta | null): boolean => {
    if (seguinte !== null) {
      const g = atual.forma.getContext('2d')
      if (g === null) return false
      g.globalCompositeOperation = 'destination-out'
      g.drawImage(seguinte.forma, seguinte.daqui.x - atual.daqui.x, seguinte.daqui.y - atual.daqui.y)
      g.globalCompositeOperation = 'source-over'
    }
    const topo = topoDoDegrau(atual.forma, atual.daqui, terra, conhecidoDaBeira, quadro, px)
    if (!atual.emprestada) descartar(atual.forma)
    if (topo === null) return false
    prontos.push({ topo, x: atual.daqui.x - quadro.x, y: atual.daqui.y - quadro.y, passos: atual.passos, altura: atual.altura })
    return true
  }
  for (const degrau of degraus) {
    const passos = passosDaAltura(degrau.altura, px)
    const daqui = quadroDosRiscos(plano, terra, passos, degrau.niveis)
    if (daqui === null) continue
    // Degrau único (só Médio, o mapa de antes): a máscara é a forma, a mesma conta de sempre.
    const emprestada = degraus.length === 1
    const forma = emprestada ? (mascaras.get(degrau.niveis[0]) ?? null) : formaDoDegrau(degrau, daqui, quadro, mascaras, recuos, plano.escala)
    if (forma === null) return desistir()
    const nova: FormaAberta = { forma, daqui, passos, altura: degrau.altura, emprestada }
    if (aberta !== null && !fechar(aberta, nova)) {
      aberta = nova
      return desistir()
    }
    aberta = nova
    await ceder()
    if (cancelado()) return desistir()
  }
  if (aberta !== null && !fechar(aberta, null)) return desistir()
  aberta = null
  descartar(...todas, ...[...recuos.values()].map((r) => r.tela), ...opcional(conhecidoDaBeira))
  return prontos.length === 0 ? null : prontos
}

/**
 * Uma máscara por altura de risco, do tamanho do `quadro`: os riscos na ordem,
 * riscar soma na máscara da altura dele e TIRA das outras (o último vale),
 * apagar tira de todas — só do que veio antes. Só Médio: uma máscara, a mesma
 * conta de sempre.
 */
function mascarasPorAltura(plano: PlanoDoRelevo, quadro: Quadro): Map<number, Tela> | null {
  const { escala, retangulo } = plano
  const mascaras = new Map<number, Tela>()
  for (const traco of plano.penhascos) {
    if (traco.modo === 'riscar' && !mascaras.has(alturaDaParede(traco))) mascaras.set(alturaDaParede(traco), novaTela(quadro.largura, quadro.altura))
  }
  const pinceis: [number, Pincel][] = []
  for (const [nivel, tela] of mascaras) {
    const g = tela.getContext('2d')
    if (g === null) return descartarTudo(...mascaras.values())
    g.setTransform(escala, 0, 0, escala, -retangulo.x * escala - quadro.x, -retangulo.y * escala - quadro.y)
    g.fillStyle = '#fff'
    g.strokeStyle = '#fff'
    g.lineCap = 'round'
    g.lineJoin = 'round'
    pinceis.push([nivel, g])
  }
  for (const traco of plano.penhascos) {
    const nivel = traco.modo === 'riscar' ? alturaDaParede(traco) : null
    for (const [alturaDaMascara, g] of pinceis) {
      g.globalCompositeOperation = alturaDaMascara === nivel ? 'source-over' : 'destination-out'
      riscar(g, traco.pontos, traco.raio)
    }
  }
  return mascaras
}

/**
 * A forma de um degrau no quadro dele (`daqui`): a união das máscaras das
 * alturas que chegam nele, menos cada altura mais baixa que encosta alargada
 * de lado pelo alcance da rampa. As máscaras alargadas (`recuos`) crescem aos
 * poucos de um degrau para o seguinte: cada uma só é alargada o que falta.
 */
function formaDoDegrau(
  degrau: DegrauDaParede,
  daqui: Quadro,
  quadro: Quadro,
  mascaras: ReadonlyMap<number, Tela>,
  recuos: Map<number, { tela: Tela; alcance: number }>,
  escala: number,
): Tela | null {
  const forma = novaTela(daqui.largura, daqui.altura)
  const g = forma.getContext('2d')
  if (g === null) return null
  const dx = quadro.x - daqui.x
  const dy = quadro.y - daqui.y
  // As máscaras se repartem a terra riscada (onde uma perde, a outra ganha):
  // somadas, a emenda antialiasada entre duas fecha em 1, sem fresta.
  g.globalCompositeOperation = 'lighter'
  for (const nivel of degrau.niveis) {
    const mascara = mascaras.get(nivel)
    if (mascara !== undefined) g.drawImage(mascara, dx, dy)
  }
  g.globalCompositeOperation = 'destination-out'
  for (const { nivel, alcance } of degrau.recuos) {
    const mascara = mascaras.get(nivel)
    if (mascara === undefined) continue
    let recuo = recuos.get(nivel)
    if (recuo === undefined) {
      recuo = { tela: copiar(mascara), alcance: 0 }
      recuos.set(nivel, recuo)
    }
    const texels = Math.round(alcance * escala)
    alargarDeLado(recuo.tela, recuo.alcance, texels)
    recuo.alcance = Math.max(recuo.alcance, texels)
    g.drawImage(recuo.tela, dx, dy)
  }
  return forma
}

/**
 * Alarga a tela de lado, no lugar, de `de` para `ate` texels para cada lado
 * (uma dilatação horizontal), sem ler pixel: cópias dela mesma deslocadas. Uma
 * tela já alargada `c` texels, somada às cópias a ±s com s ≤ 2c + 1, fica
 * alargada c + s sem buraco: o passo dobra a cada rodada.
 */
function alargarDeLado(tela: Tela, de: number, ate: number): void {
  const g = tela.getContext('2d')
  if (g === null) return
  let feito = de
  while (feito < ate) {
    const passo = Math.min(2 * feito + 1, ate - feito)
    g.drawImage(tela, passo, 0)
    g.drawImage(tela, -passo, 0)
    feito += passo
  }
}

/**
 * O conhecido do jogador no `quadro`, alargado uns texels em volta: quem vê a
 * costa do mar (a terra é uma Sala, fechada para quem está fora) conhece o mar
 * até a beira, não a terra logo acima dela; e o explorado de quem andou pela
 * terra para nas células, um pouco antes da beira. A parede sai da beira,
 * então ela conta como vista quando o conhecido passa a até `alcance` dela. A
 * faixa a mais é a da própria linha da costa, que ele já vê, e a parede só
 * aparece no mar conhecido (a máscara da névoa no `PlayerView`).
 */
function alargarConhecido(conhecido: Tela, quadro: Quadro, px: number): Tela | null {
  const alcance = Math.max(2, Math.ceil(AJUSTE_DO_PENHASCO.alcanceDoConhecido * px))
  return alargar(conhecido, quadro.x, quadro.y, quadro.largura, quadro.altura, alcance)
}

/**
 * O topo de um degrau: a BEIRA de baixo da terra debaixo da `forma` (os texels
 * de terra com mar logo abaixo), com a borda da forma macia (a parede some aos
 * poucos onde o risco acaba, e o degrau se funde no de baixo). Só a beira, e
 * não a terra inteira: a cor de cada ponto da parede sai da distância até a
 * costa logo acima, e um topo que começasse mais acima numa coluna (a terra do
 * jogador cortada pela névoa) desenharia uma listra de faixas fora do lugar.
 * No jogador, só a beira conhecida (`conhecidoDaBeira`, no `quadro` da parede).
 */
function topoDoDegrau(forma: Tela, daqui: Quadro, terra: Tela, conhecidoDaBeira: Tela | null, quadro: Quadro, px: number): Tela | null {
  const beira = Math.max(2, Math.ceil(px))
  const topo = novaTela(daqui.largura, daqui.altura)
  const gt = topo.getContext('2d')
  if (gt === null) return null
  sombraDe(gt, forma, '#fff', AJUSTE_DO_PENHASCO.pontas * px)
  gt.globalCompositeOperation = 'destination-out'
  gt.drawImage(terra, -daqui.x, -daqui.y - beira)
  gt.globalCompositeOperation = 'destination-in'
  gt.drawImage(terra, -daqui.x, -daqui.y)
  if (conhecidoDaBeira !== null) gt.drawImage(conhecidoDaBeira, quadro.x - daqui.x, quadro.y - daqui.y)
  gt.globalCompositeOperation = 'source-over'
  return topo
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
