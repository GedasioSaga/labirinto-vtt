import { forEachExploredNotch, forEachExploredRun } from '../lib/exploration'
import {
  AJUSTE_DO_PENHASCO,
  AJUSTE_DO_RELEVO,
  corDaParede,
  perfilDoPenhasco,
  tamanhoDaTextura,
  type ConhecidoDoRelevo,
  type PerfilDoPenhasco,
  type PlanoDoRelevo,
} from '../lib/relevo'
import type { RegionPoint } from '../types/map'
import { meioTermoLigado } from '../lib/estiloDoMapa'
import { corDoBarranco, LARGURA_DO_CONTORNO, TONS_DO_BARRANCO } from '../texturas/meioTermo/barranco'

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
 * As etapas do relevo, na ordem, para medir no app: cada uma vira uma medida
 * `relevo:<etapa>` (`performance.measure`, aba Performance das ferramentas do
 * navegador), do fim da anterior ao fim dela, pausas incluídas. Só as da
 * última geração completa ficam (as de antes são apagadas), então gerar o
 * relevo a sessão inteira não acumula entrada nenhuma.
 */
const ETAPAS_DO_RELEVO = ['terra', 'parede', 'sombra', 'fronteiras', 'friso', 'juntar'] as const
type EtapaDoRelevo = (typeof ETAPAS_DO_RELEVO)[number]

/** Gerações medidas até agora: cada uma marca com nomes só dela (duas gerações juntas, a do palco e a da exportação, não se misturam). */
let geracoesMedidas = 0

/**
 * O relógio de uma geração: `marcar` no fim de cada etapa e `encerrar` sempre
 * no fim (cancelada ou não), que mede só a geração completa e apaga as
 * marcas dela. Medir nunca derruba o relevo: sem a API, ou com ela recusando,
 * fica sem medida.
 */
function relogioDoRelevo(): { marcar: (etapa: EtapaDoRelevo) => void; encerrar: () => void } {
  geracoesMedidas += 1
  const geracao = geracoesMedidas
  const marca = (etapa: EtapaDoRelevo | 'inicio') => `relevo:${etapa}#${geracao}`
  const feitas = new Set<string>()
  const marcar = (etapa: EtapaDoRelevo | 'inicio') => {
    try {
      performance.mark(marca(etapa))
      feitas.add(etapa)
    } catch {
      // Sem medida: o relevo segue.
    }
  }
  marcar('inicio')
  const encerrar = () => {
    try {
      if (ETAPAS_DO_RELEVO.every((etapa) => feitas.has(etapa))) {
        let anterior = marca('inicio')
        for (const etapa of ETAPAS_DO_RELEVO) {
          performance.clearMeasures(`relevo:${etapa}`)
          performance.measure(`relevo:${etapa}`, anterior, marca(etapa))
          anterior = marca(etapa)
        }
      }
      for (const etapa of ['inicio', ...ETAPAS_DO_RELEVO] as const) performance.clearMarks(marca(etapa))
    } catch {
      // Sem medida: o relevo segue.
    }
  }
  return { marcar, encerrar }
}

/**
 * Gera a tela do relevo do plano, ou `null` (canvas 2D indisponível, ou um
 * pedido mais novo cancelou este). A tela tem `tamanhoDaTextura(plano)` e
 * cobre `plano.retangulo` do mundo.
 */
export async function rasterizarRelevo(plano: PlanoDoRelevo, cancelado: () => boolean): Promise<HTMLCanvasElement | null> {
  const relogio = relogioDoRelevo()
  try {
    return await gerarRelevo(plano, cancelado, relogio.marcar)
  } finally {
    relogio.encerrar()
  }
}

async function gerarRelevo(plano: PlanoDoRelevo, cancelado: () => boolean, marcarEtapa: (etapa: EtapaDoRelevo) => void): Promise<HTMLCanvasElement | null> {
  const { largura, altura } = tamanhoDaTextura(plano)
  const { escala, unidade, retangulo } = plano
  // CHAVE DE OBRA do Meio-Termo, lida uma vez por geração: a parede inteira sai num estilo só.
  const barrancoLiso = meioTermoLigado()
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

  marcarEtapa('terra')

  // PENHASCO: a parede de pedra debaixo da costa riscada (`montarParede`).
  // No jogador, o perfil já vem cortado pelo conhecido (`perfilDoPenhasco`).
  const parede = plano.penhascos.length > 0 ? await montarParede(plano, terra, cancelado, barrancoLiso) : null
  if (cancelado()) return descartarTudo(terra, ...opcional(conhecido), ...opcional(parede?.tela ?? null))
  marcarEtapa('parede')

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
  marcarEtapa('sombra')

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
  marcarEtapa('fronteiras')

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
  marcarEtapa('friso')

  gd.globalCompositeOperation = 'destination-in'
  gd.drawImage(terra, 0, 0)
  gs.drawImage(dentro, 0, 0)
  descartar(terra, dentro, ...opcional(conhecido))
  marcarEtapa('juntar')
  return saida
}

function opcional(tela: Tela | null): Tela[] {
  return tela === null ? [] : [tela]
}

/** A parede do penhasco: uma tela do tamanho da caixa dela e onde ela fica na textura. */
interface ParedeDoPenhasco {
  tela: Tela
  x: number
  y: number
}

/** Faixas pintadas entre uma pausa e outra (cada faixa é um caminho com um quadrilátero por pedaço de parede). */
const FAIXAS_POR_PAUSA = 8

/** Um pedaço da textura, em texels. */
interface Quadro {
  x: number
  y: number
  largura: number
  altura: number
}

/** Texels de profundidade de uma parede de `altura` px do protótipo. */
function passosDaAltura(altura: number, px: number): number {
  return Math.max(1, Math.round(altura * px))
}

/** Números por amostra de `fitasDaParede`: x e y da costa e a altura, em texels da textura. */
const POR_AMOSTRA = 3

/**
 * A PAREDE DO PENHASCO (`lib/penhasco.ts`), extrudada do perfil
 * (`perfilDoPenhasco`: a altura de cada amostra da costa, já com a rampa). Ela
 * é pintada em N faixas, do pé ao lábio: a faixa t vai de t/N a (t+1)/N da
 * altura de cada amostra, numa cor só, a da profundidade dela
 * (`corDaParede`). A cor depende só da fração da altura, então numa parede
 * mais alta as faixas esticam na proporção (lábio, veio e base molhada
 * continuam lá), e na rampa elas descem junto com ela. Cada faixa sobe um
 * texel por baixo da seguinte, que vem depois e a cobre: a borda antialiasada
 * de uma cai sobre a cor cheia da outra, sem fresta, e a do lábio cobre a
 * linha da costa, que a terra apaga no fim. Sobra só a faixa que desce para o
 * mar.
 *
 * Na parede Média do mapa antigo, N é a altura em texels de sempre e cada
 * faixa é uma linha de texels na cor de antes: o meio sai como o da v0.4.24.
 *
 * Uma tela só, do tamanho da parede, sem ler pixel; no jogador o perfil já vem
 * cortado pelo que ele conhece.
 *
 * BARRANCO LISO (Meio-Termo, `barrancoLiso`, atrás da chave de obra): as
 * mesmas faixas e as mesmas pausas, só a cor muda — o perfil liso de
 * `corDoBarranco` (realce em cima, sombra embaixo, sem as 6 faixas) — e uma
 * faixa a mais no fim, o contorno do pé. Nenhuma tela a mais, nenhum sorteio.
 */
async function montarParede(plano: PlanoDoRelevo, terra: Tela, cancelado: () => boolean, barrancoLiso: boolean): Promise<ParedeDoPenhasco | null> {
  // O perfil (a costa amostrada a cada texel) numa tarefa só dele, longe da terra e das faixas.
  await ceder()
  if (cancelado()) return null
  const perfil = perfilDoPenhasco(plano)
  if (perfil.maisAlta <= 0) return null
  await ceder()
  if (cancelado()) return null
  const px = plano.unidade * plano.escala
  const { altura } = AJUSTE_DO_PENHASCO
  // A parede Média tem a altura em texels de sempre (arredondada); as outras, na mesma proporção.
  const passosDaMedia = passosDaAltura(altura, px)
  const fitas = fitasDaParede(perfil, plano, passosDaMedia / altura)
  const quadro = quadroDasFitas(fitas, terra)
  if (quadro === null) return null
  // Uma faixa por texel na parede mais alta (na Média de sempre, uma por linha).
  const faixas = passosDaMedia * Math.max(1, Math.ceil(perfil.maisAlta / altura - 1e-9))
  const corDaFaixa = barrancoLiso
    ? (t: number) => corDoBarranco((t + 0.5) / faixas)
    : (t: number) => corDaParede(((t + 0.5) / faixas) * (passosDaMedia / px))
  // O contorno do pé tem espessura fixa (px do protótipo), não fração da altura: na parede Alta ele não engrossa.
  const contorno = barrancoLiso ? { cor: TONS_DO_BARRANCO.contorno, texels: Math.max(1, LARGURA_DO_CONTORNO * px) } : null
  return extrudarParede(fitas, quadro, faixas, corDaFaixa, contorno, terra, cancelado)
}

/** O contorno do pé do barranco liso: a cor e a espessura, em texels. */
interface ContornoDoPe {
  cor: readonly number[]
  texels: number
}

/**
 * Os trechos de parede em FITAS: cada uma, as amostras seguidas de uma cadeia
 * com parede, sempre da esquerda para a direita (`POR_AMOSTRA` números cada,
 * em texels da textura). A fita vira um polígono só por faixa: milhares de
 * quadriláteros num caminho custavam ~40 vezes mais para o canvas pintar
 * (medido no Edge em 15/10/2026). Onde a costa volta para trás na
 * horizontal, a fita é cortada: um polígono dobrado sobre si mesmo furaria no
 * `nonzero` do canvas; duas fitas no mesmo sentido só somam.
 */
function fitasDaParede(perfil: PerfilDoPenhasco, plano: PlanoDoRelevo, texelsPorPx: number): Float64Array[] {
  const { escala, retangulo } = plano
  const fitas: Float64Array[] = []
  for (const cadeia of perfil.cadeias) {
    const { x, y, altura, fechada } = cadeia
    const n = x.length
    const lados = fechada ? n : n - 1
    // O lado i vai da amostra i à seguinte: entra se alguma das duas tem parede.
    const desenha = (i: number) => altura[i % n] > 0 || altura[(i + 1) % n] > 0
    // Na fechada, começa logo depois de um lado sem parede: a fita não fica partida na emenda do laço.
    let inicio = 0
    if (fechada) {
      for (let i = 0; i < lados; i += 1) {
        if (!desenha(i)) {
          inicio = i + 1
          break
        }
      }
    }
    let atual: number[] = []
    let sentido = 0
    const fechar = () => {
      if (atual.length >= 2 && sentido !== 0) {
        const ordem = sentido > 0 ? atual : [...atual].reverse()
        const fita = new Float64Array(ordem.length * POR_AMOSTRA)
        ordem.forEach((i, k) => fita.set([(x[i] - retangulo.x) * escala, (y[i] - retangulo.y) * escala, altura[i] * texelsPorPx], k * POR_AMOSTRA))
        fitas.push(fita)
      }
      atual = []
      sentido = 0
    }
    for (let q = 0; q < lados; q += 1) {
      const i = (inicio + q) % n
      const j = (i + 1) % n
      if (!desenha(i)) {
        fechar()
        continue
      }
      const sinal = Math.sign(x[j] - x[i])
      if (sinal !== 0 && sentido !== 0 && sinal !== sentido) {
        // Voltou para trás: a fita acaba em i, e a próxima começa nele.
        fechar()
        atual = [i]
      }
      if (sinal !== 0) sentido = sinal
      if (atual.length === 0) atual.push(i)
      atual.push(j)
    }
    fechar()
  }
  return fitas
}

/** A caixa das fitas na textura (com o texel que a faixa sobe e o do antialias), ou `null` sem nada dentro dela. */
function quadroDasFitas(fitas: readonly Float64Array[], terra: Tela): Quadro | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const fita of fitas) {
    for (let k = 0; k < fita.length; k += POR_AMOSTRA) {
      minX = Math.min(minX, fita[k])
      maxX = Math.max(maxX, fita[k])
      minY = Math.min(minY, fita[k + 1])
      maxY = Math.max(maxY, fita[k + 1] + fita[k + 2])
    }
  }
  const x0 = Math.max(0, Math.floor(minX) - 1)
  const y0 = Math.max(0, Math.floor(minY) - 2)
  const x1 = Math.min(terra.width, Math.ceil(maxX) + 1)
  const y1 = Math.min(terra.height, Math.ceil(maxY) + 1)
  return x1 <= x0 || y1 <= y0 ? null : { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0 }
}

/** As faixas, da mais funda à do lábio (a de cima cobre a de baixo), e a terra apagada por cima. */
async function extrudarParede(
  fitas: readonly Float64Array[],
  quadro: Quadro,
  faixas: number,
  corDaFaixa: (t: number) => readonly number[],
  contorno: ContornoDoPe | null,
  terra: Tela,
  cancelado: () => boolean,
): Promise<ParedeDoPenhasco | null> {
  const tela = novaTela(quadro.largura, quadro.altura)
  const g = tela.getContext('2d')
  if (g === null) return descartarTudo(tela)
  g.setTransform(1, 0, 0, 1, -quadro.x, -quadro.y)
  // O topo de cada amostra na faixa sobe um texel, só onde há parede (na altura 0 nenhuma linha se pinta).
  const topo = (fita: Float64Array, k: number, de: number) => fita[k + 1] + fita[k + 2] * de - Math.min(1, fita[k + 2])
  for (let t = faixas - 1; t >= 0; t -= 1) {
    const de = t / faixas
    const ate = (t + 1) / faixas
    g.beginPath()
    for (const fita of fitas) {
      g.moveTo(fita[0], topo(fita, 0, de))
      for (let k = POR_AMOSTRA; k < fita.length; k += POR_AMOSTRA) g.lineTo(fita[k], topo(fita, k, de))
      for (let k = fita.length - POR_AMOSTRA; k >= 0; k -= POR_AMOSTRA) g.lineTo(fita[k], fita[k + 1] + fita[k + 2] * ate)
      g.closePath()
    }
    g.fillStyle = rgba(corDaFaixa(t), 1)
    g.fill()
    if (t > 0 && t % FAIXAS_POR_PAUSA === 0) {
      await ceder()
      if (cancelado()) return descartarTudo(tela)
    }
  }
  if (contorno !== null) pintarContornoDoPe(g, fitas, contorno)
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.globalCompositeOperation = 'destination-out'
  g.drawImage(terra, -quadro.x, -quadro.y)
  g.globalCompositeOperation = 'source-over'
  return { tela, x: quadro.x, y: quadro.y }
}

/**
 * O contorno do pé: uma faixa da espessura dele subindo do pé de cada
 * amostra, por cima das faixas. Onde a parede é mais baixa que o contorno (a
 * ponta da rampa), ela vira contorno inteira: a ponta fecha como a do
 * protótipo, sem o lábio claro sobrar solto.
 */
function pintarContornoDoPe(g: Pincel, fitas: readonly Float64Array[], contorno: ContornoDoPe): void {
  const w = contorno.texels
  g.beginPath()
  for (const fita of fitas) {
    g.moveTo(fita[0], fita[1] + Math.max(0, fita[2] - w))
    for (let k = POR_AMOSTRA; k < fita.length; k += POR_AMOSTRA) g.lineTo(fita[k], fita[k + 1] + Math.max(0, fita[k + 2] - w))
    for (let k = fita.length - POR_AMOSTRA; k >= 0; k -= POR_AMOSTRA) g.lineTo(fita[k], fita[k + 1] + fita[k + 2])
    g.closePath()
  }
  g.fillStyle = rgba(contorno.cor, 1)
  g.fill()
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
