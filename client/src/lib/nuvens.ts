import type { MapData } from '../types/map'
import { CURVAS } from '../cenario/revelacao/tempo'
import { pieceBounds } from './floorSdf'
import { isContinente } from './marcadorDeContinente'
import { LADO_DO_PROTOTIPO, unidadeDoRelevo } from './relevo'

/**
 * NUVENS (fatia 6 do plano do relevo de 09/10/2026): três nuvens finas que
 * passam devagar sobre o mapa, cada uma com a SOMBRA no chão deslocada para
 * baixo e à direita (a luz do relevo vem de cima à esquerda), como no
 * protótipo "Diorama vivo" que o usuário aprovou. Passam sempre, em laço
 * (pedido do usuário: "passando sempre").
 *
 * Nada viaja pela sala a cada quadro: a nuvem sai do céu (que o host grava no
 * recorte do jogador, `ceuDasNuvensDoRecorte`) e do relógio de parede. Então a
 * mesma nuvem está no mesmo lugar na tela do mestre e na de cada jogador.
 *
 * A nuvem e a sombra ficam SEMPRE dentro do CÉU (`ceuDoMapa`: o retângulo do
 * chão pintado, dentro do retângulo do mapa): ela se forma na beira da
 * esquerda e se desfaz na da direita (`alfa` sobe e desce nas pontas da
 * travessia) em vez de entrar de fora. Assim nada aparece sobre o fundo vazio
 * do editor, e na tela do jogador o preto opaco da névoa (que cobre o
 * retângulo do mapa) esconde a nuvem sobre o que ele ainda não conhece, sem
 * máscara a mais pagando stencil a cada quadro.
 *
 * Puro: sem DOM, sem Pixi. Quem desenha é `pixi/drawNuvens.ts`.
 */

/** Uma nuvem do céu. Distâncias em px do protótipo (`LADO_DO_PROTOTIPO` do relevo), convertidas pela `unidade` do mapa. */
export interface DefinicaoDaNuvem {
  /** Onde ela passa: 0 = rente à beira de cima, 1 = rente à de baixo (do espaço que sobra para a nuvem e a sombra). */
  faixa: number
  /** Largura do corpo da nuvem. */
  largura: number
  /** Velocidade da deriva, em px do protótipo por segundo. */
  velocidade: number
  /**
   * Onde ela está no instante zero do relógio, de 0 (beira da esquerda) a 1
   * (da direita). É também onde ela fica PARADA no movimento reduzido, por isso
   * longe das pontas, onde a nuvem ainda está se formando.
   */
  fase: number
  /** Semente do sorteio das bolhas: corpo e sombra da mesma nuvem têm a mesma forma. */
  semente: number
}

/**
 * As três do protótipo. Lá cada uma cruzava 1,34 × a largura do mapa em
 * 110, 140 e 170 s; as velocidades abaixo são essas (1242 × 1,34 / duração).
 * A faixa é o `topo` de lá convertido para o espaço que sobra (a mesma altura
 * na tela do protótipo).
 */
export const NUVENS: readonly DefinicaoDaNuvem[] = [
  { faixa: 0.06, largura: 248, velocidade: 15.1, fase: 0.36, semente: 11 },
  { faixa: 0.56, largura: 199, velocidade: 11.9, fase: 0.78, semente: 23 },
  { faixa: 0.92, largura: 273, velocidade: 9.8, fase: 0.18, semente: 37 },
]

/** Os números das nuvens num lugar só, em px do protótipo. */
export const AJUSTE_DAS_NUVENS = {
  /** Altura do corpo sobre a largura. */
  proporcao: 0.42,
  /** Para onde a sombra cai: para baixo e à direita, longe da luz. */
  sombra: { dx: 38, dy: 50 },
  /** Opacidade de cada camada, a do protótipo (o degradê de dentro da textura soma com ela). */
  alfaDoCorpo: 0.6,
  alfaDaSombra: 0.4,
  /**
   * Fração da travessia em que a nuvem se forma na beira da esquerda (e se
   * desfaz na da direita). Na nuvem mais rápida dá ~8 s: devagar o bastante
   * para ninguém ver a nuvem "acender".
   */
  formacao: 0.12,
  /** Teto da largura, em fração da largura do mapa: no mapa estreito e alto a nuvem não vira uma faixa de beira a beira. */
  larguraMaxima: 0.45,
} as const

/**
 * Quanto a camada inteira leva para aparecer quando o mapa abre ou a chave
 * liga, com o ease-out forte do projeto (`CURVAS.saida`). Bem abaixo dos 5 s
 * da regra de animação de ambiente: é só para as nuvens não surgirem de golpe.
 */
export const APARICAO_DAS_NUVENS_MS = 900

/**
 * DE PERTO, a nuvem vira névoa: o protótipo mostra o continente inteiro, onde
 * a nuvem tem um quinto da tela; com o jogador perto da ficha (ou no celular)
 * a mesma nuvem passa da largura da tela e lavaria de branco o lugar onde ele
 * joga (conferido a 1280 e a 390 px). Então o CORPO esmaece pelo tamanho dele
 * na tela, como quem desce abaixo das nuvens; a sombra no chão fica inteira.
 * Larguras em fração da largura da tela.
 */
export const NUVEM_DE_PERTO = {
  /** Até aqui (a nuvem com até 1/4 da tela), o corpo inteiro. */
  inteiraAte: 0.25,
  /** Daqui em diante (a nuvem com 80% da tela ou mais), só o mínimo. */
  minimoDesde: 0.8,
  /** O que sobra do corpo de perto: o bastante para a nuvem ainda se ler sobre a sombra. */
  minimo: 0.25,
} as const

/**
 * Quanto do CORPO da nuvem aparece neste zoom (1 = inteiro), pela largura dela
 * na tela. Entre os dois limites, a curva de névoa do projeto (`CURVAS.onda`):
 * o zoom não dá degrau. Tela sem medida (0) = inteiro.
 */
export function corpoPeloZoom(larguraNaTela: number, larguraDaTela: number): number {
  if (!(larguraDaTela > 0)) return 1
  const { inteiraAte, minimoDesde, minimo } = NUVEM_DE_PERTO
  const fracao = larguraNaTela / larguraDaTela
  if (fracao <= inteiraAte) return 1
  if (fracao >= minimoDesde) return minimo
  return 1 - (1 - minimo) * CURVAS.onda.f((fracao - inteiraAte) / (minimoDesde - inteiraAte))
}

/**
 * A chave "Nuvens" está ligada nesta cena? A escolha do mestre, quando ele
 * escolheu; sem ela, o padrão do tipo de mapa: ligada no Continente, desligada
 * no Normal (masmorra não tem céu) — o mesmo molde de `relevoLigado`.
 */
export function nuvensLigadas(map: Pick<MapData, 'nuvens' | 'continente' | 'worldMap'>): boolean {
  return map.nuvens ?? isContinente(map)
}

/** O céu de um mapa: o retângulo por onde as nuvens passam, em px de mundo, e a unidade do protótipo. */
export interface CeuDoMapa {
  x: number
  y: number
  largura: number
  altura: number
  /** Px de mundo por px do protótipo (`unidadeDoRelevo`): a nuvem tem o mesmo tamanho na tela do mestre e na do jogador. */
  unidade: number
}

/**
 * O céu: o retângulo do CHÃO pintado (as peças de chão visíveis,
 * `MapData.floor`), dentro do retângulo do mapa. No continente o mar costuma
 * ser uma peça de chão, e fora dela fica o fundo vazio do editor, onde nuvem
 * nenhuma deve passar (achado na conferência com o Tasmaturi Village: o mar
 * cobre só a faixa do meio do mapa). Sem peça de chão, ou com imagem de fundo
 * (que cobre o retângulo todo), vale o retângulo do mapa.
 *
 * NA TELA DO JOGADOR vale o céu que o host gravou no recorte
 * (`MapData.ceuDasNuvens`, `ceuDasNuvensDoRecorte`), tirado só do chão que
 * o recorte manda: o chão escondido dele (zona oculta, sala secreta, névoa)
 * não estica a caixa. Peça oculta para os jogadores (`hidden`) fica de fora.
 */
export function ceuDoMapa(mapa: Pick<MapData, 'width' | 'height' | 'grid' | 'floor' | 'background' | 'ceuDasNuvens'>): CeuDoMapa | null {
  const doHost = mapa.ceuDasNuvens
  if (doHost !== undefined && caixaValida(doHost)) {
    const unidade = unidadeDoRelevo(mapa)
    if (!(unidade > 0) || !(mapa.width * mapa.grid > 0) || !(mapa.height * mapa.grid > 0)) return null
    return { x: doHost.x, y: doHost.y, largura: doHost.largura, altura: doHost.altura, unidade }
  }
  return ceuDoChao(mapa)
}

/** Caixa que veio pela rede: números finitos e com área (senão vale a conta pelo chão recebido). */
function caixaValida(caixa: NonNullable<MapData['ceuDasNuvens']>): boolean {
  return [caixa.x, caixa.y, caixa.largura, caixa.altura].every(Number.isFinite) && caixa.largura > 0 && caixa.altura > 0
}

/**
 * O céu que o host grava no recorte do jogador: o do chão que `mapa.floor`
 * traz — quem chama passa o chão do RECORTE (`lib/fogFilter.ts`), nunca o
 * inteiro do mestre. `undefined` com as nuvens desligadas (a masmorra não
 * leva caixa nenhuma) ou mapa sem tamanho.
 */
export function ceuDasNuvensDoRecorte(
  mapa: Pick<MapData, 'width' | 'height' | 'grid' | 'floor' | 'background' | 'nuvens' | 'continente' | 'worldMap'>,
): MapData['ceuDasNuvens'] {
  if (!nuvensLigadas(mapa)) return undefined
  const ceu = ceuDoChao(mapa)
  return ceu === null ? undefined : { x: ceu.x, y: ceu.y, largura: ceu.largura, altura: ceu.altura }
}

/** O retângulo do chão pintado, dentro do mapa (ver `ceuDoMapa`). */
function ceuDoChao(mapa: Pick<MapData, 'width' | 'height' | 'grid' | 'floor' | 'background'>): CeuDoMapa | null {
  const largura = mapa.width * mapa.grid
  const altura = mapa.height * mapa.grid
  if (!(largura > 0) || !(altura > 0)) return null
  const unidade = unidadeDoRelevo(mapa)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  if (mapa.background.type !== 'image') {
    for (const peca of mapa.floor) {
      if (peca.op !== 'add' || peca.hidden === true) continue
      const caixa = pieceBounds(peca)
      minX = Math.min(minX, caixa.minX)
      minY = Math.min(minY, caixa.minY)
      maxX = Math.max(maxX, caixa.maxX)
      maxY = Math.max(maxY, caixa.maxY)
    }
  }
  const x0 = Math.max(0, minX)
  const y0 = Math.max(0, minY)
  const x1 = Math.min(largura, maxX)
  const y1 = Math.min(altura, maxY)
  // Sem chão (ou chão todo fora do mapa): o retângulo do mapa.
  if (!(x1 > x0) || !(y1 > y0)) return { x: 0, y: 0, largura, altura, unidade }
  return { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0, unidade }
}

/** A medida de uma nuvem num céu: muda só com o tamanho do mapa, não a cada quadro. */
export interface MedidaDaNuvem {
  /** Corpo, em px de mundo. */
  largura: number
  altura: number
  /** Deslocamento da sombra em relação ao corpo, em px de mundo. */
  sombraDx: number
  sombraDy: number
  /** Px de mundo que o canto do corpo percorre da beira da esquerda à da direita. */
  percurso: number
  /** Onde a travessia começa (a beira da esquerda do céu), em px de mundo. */
  x0: number
  /** Altura do canto do corpo, fixa durante a travessia. */
  y: number
  /** Segundos de uma travessia: fixos por nuvem, nada do céu (`travessiaDaNuvem`). */
  travessia: number
}

/** `null` = a nuvem (com a sombra) não cabe neste mapa: ela não aparece. */
export function medidaDaNuvem(nuvem: DefinicaoDaNuvem, ceu: CeuDoMapa): MedidaDaNuvem | null {
  const u = ceu.unidade
  const largura = Math.min(nuvem.largura * u, ceu.largura * AJUSTE_DAS_NUVENS.larguraMaxima)
  const altura = largura * AJUSTE_DAS_NUVENS.proporcao
  const sombraDx = AJUSTE_DAS_NUVENS.sombra.dx * u
  const sombraDy = AJUSTE_DAS_NUVENS.sombra.dy * u
  const percurso = ceu.largura - largura - sombraDx
  const sobraY = ceu.altura - altura - sombraDy
  if (!(percurso > 0) || !(sobraY > 0) || !(u > 0)) return null
  return {
    largura,
    altura,
    sombraDx,
    sombraDy,
    percurso,
    x0: ceu.x,
    y: ceu.y + nuvem.faixa * sobraY,
    travessia: travessiaDaNuvem(nuvem),
  }
}

/**
 * Segundos de uma travessia: FIXOS por nuvem, os do protótipo (o lado dele
 * menos a nuvem e a sombra, na velocidade dela), sem nada do céu. A fase sai
 * de `relógio de parede / travessia`, e o relógio vale ~1,8e9 s: se a
 * travessia viesse da largura do céu, alargar o chão em 1 px numa pincelada
 * sorteava outro lugar para cada nuvem (achado da revisão: 63 s → 0,13 da
 * travessia, 63,001 s → 0,74). Assim o céu que muda só estica o caminho, e a
 * nuvem anda no máximo o quanto ele mudou. No céu do tamanho do mapa (o
 * Continente comum) a velocidade é exatamente a do protótipo; num céu mais
 * estreito ela fica um pouco mais lenta, na mesma travessia.
 */
function travessiaDaNuvem(nuvem: DefinicaoDaNuvem): number {
  return (LADO_DO_PROTOTIPO - nuvem.largura - AJUSTE_DAS_NUVENS.sombra.dx) / nuvem.velocidade
}

/** Onde a nuvem está num instante, e quanto dela já se formou. */
export interface QuadroDaNuvem {
  /** Canto de cima à esquerda do corpo, em px de mundo. A sombra fica em `x + sombraDx`, `y + sombraDy`. */
  x: number
  y: number
  /** 0 a 1: a nuvem se formando na beira da esquerda e se desfazendo na da direita. */
  alfa: number
}

/** Parte fracionária, também para número negativo (relógio atrasado). */
function fracao(x: number): number {
  return x - Math.floor(x)
}

/**
 * Formar e desfazer com a curva de névoa do projeto (`CURVAS.onda`,
 * easeInOutSine): começa e termina sem tranco, que numa nuvem de vários
 * segundos é o que não deixa ela "acender" nem "apagar".
 */
function formacao(progresso: number): number {
  const borda = AJUSTE_DAS_NUVENS.formacao
  if (progresso < borda) return CURVAS.onda.f(progresso / borda)
  if (progresso > 1 - borda) return CURVAS.onda.f((1 - progresso) / borda)
  return 1
}

/**
 * O quadro de uma nuvem no instante `segundos` do relógio de parede. A deriva
 * é LINEAR (movimento constante, como o vento). `null` = movimento reduzido:
 * a nuvem fica parada na `fase` dela, inteira.
 */
export function quadroDaNuvem(nuvem: DefinicaoDaNuvem, medida: MedidaDaNuvem, segundos: number | null): QuadroDaNuvem {
  if (segundos === null) return { x: medida.x0 + nuvem.fase * medida.percurso, y: medida.y, alfa: 1 }
  const progresso = fracao(segundos / medida.travessia + nuvem.fase)
  return { x: medida.x0 + progresso * medida.percurso, y: medida.y, alfa: formacao(progresso) }
}
