import { CanvasSource, Container, Sprite, Texture, type Ticker } from 'pixi.js'
import type { MapData } from '../types/map'
import { CURVAS, mulberry32 } from '../cenario/revelacao/tempo'
import {
  AJUSTE_DAS_NUVENS,
  APARICAO_DAS_NUVENS_MS,
  NUVENS,
  ceuDoMapa,
  corpoPeloZoom,
  medidaDaNuvem,
  quadroDaNuvem,
  type CeuDoMapa,
  type DefinicaoDaNuvem,
  type MedidaDaNuvem,
} from '../lib/nuvens'

/**
 * NUVENS no palco (`lib/nuvens.ts`): seis sprites — a sombra e o corpo de cada
 * uma das três nuvens —, com as texturas feitas UMA vez. Por quadro só mudam
 * posição e opacidade; nada é redesenhado. A camada é um grupo de render
 * próprio: mexer nesses seis sprites não refaz as instruções do mapa.
 *
 * As sombras vêm todas antes dos corpos: a sombra de uma nuvem cai no chão,
 * nunca por cima do corpo de outra.
 *
 * O relógio só roda com as nuvens andando (ou na aparição, ≤ 1 s). Desligadas
 * ou paradas (movimento reduzido), nada roda por quadro.
 */

/** Texels da largura do corpo na textura: a nuvem é macia, então aguenta ser esticada no mapa grande. */
export const TEXELS_DO_CORPO = 320
/** A sombra é só um borrão escuro: metade disso basta. */
export const TEXELS_DA_SOMBRA = 160
/**
 * Folga em volta da nuvem na textura, em fração da largura e da altura dela:
 * a bolha da ponta passa um pouco da caixa (também no protótipo), e sem folga
 * a beira macia sairia cortada reta.
 */
export const FOLGA_DA_TEXTURA = { x: 0.08, y: 0.16 } as const
/** Quanto cada bolha da SOMBRA é mais larga que a do corpo: a beirada macia mais longa (cabe na folga acima). */
const ESPALHO_DA_SOMBRA = 1.3
/** De quanto em quanto tempo, com as nuvens andando, o renderer confere se a pessoa passou a pedir menos movimento. */
const CONFERIR_MOVIMENTO_MS = 1000

export type PapelDaNuvem = 'corpo' | 'sombra'

/** O que o renderer precisa para animar. */
export interface MovimentoDasNuvens {
  /** O relógio de quadros do Pixi (`app.ticker`): o renderer só se inscreve com as nuvens andando ou aparecendo. */
  ticker: Pick<Ticker, 'add' | 'remove'>
  /**
   * `prefers-reduced-motion`: ligado, as nuvens ficam PARADAS (inteiras, na
   * fase de cada uma). Lido a cada `atualizar` e, com elas andando, uma vez
   * por segundo.
   */
  reducedMotion: () => boolean
  /** Relógio de PAREDE, em ms. Padrão `Date.now()`: o mesmo em todas as telas, então a nuvem passa no mesmo lugar no mestre e no jogador. */
  agora?: () => number
}

export interface EntradaDasNuvens {
  /** Id da cena. Trocou (ou a chave religou): as nuvens aparecem de novo. */
  cena: string
  /** O tamanho do mapa e o chão pintado (o céu é o retângulo dele, `ceuDoMapa`); no jogador, o céu que o host gravou no recorte. */
  mapa: Pick<MapData, 'width' | 'height' | 'grid' | 'floor' | 'background' | 'ceuDasNuvens'>
}

/** O que a tela anota para a medida de desempenho e a conferência. */
export interface EstadoDasNuvens {
  /** Nuvens no palco agora (0 = desligadas, ou o aparelho não desenha no canvas). */
  nuvens: number
  movendo: boolean
}

export interface OpcoesDasNuvens {
  /** Faz a textura de uma nuvem; `null` = sem canvas 2d (a nuvem não aparece). O renderer é dono dela e a destrói no fim. */
  texturaDa?: (nuvem: DefinicaoDaNuvem, papel: PapelDaNuvem) => Texture | null
  aoMudar?: (estado: EstadoDasNuvens) => void
}

export interface NuvensRenderer {
  /** O contêiner das nuvens: vai no mundo, acima de chão, paredes e objetos, abaixo de nomes, pinos e fichas. */
  readonly camada: Container
  /** `null` = chave desligada (ou modo leve do jogador): tudo some e o relógio sai. */
  atualizar: (entrada: EntradaDasNuvens | null) => void
  /**
   * O zoom (ou a largura da tela) mudou: de perto o corpo da nuvem esmaece
   * (corpoPeloZoom), a sombra não. Só opacidade, nada é refeito.
   */
  setTela: (escala: number, larguraDaTela: number) => void
  destruir: () => void
}

/**
 * A nuvem do protótipo "Diorama", desenhada no espaço da textura: nove bolhas
 * em arco com corpo e só a beirada macia (lê como nuvem, não como mancha) e,
 * no corpo, cinco reflexos do lado de cima à esquerda, de onde vem a luz. A
 * mesma semente dá a mesma forma à sombra e ao corpo.
 */
function telaDaNuvem(nuvem: DefinicaoDaNuvem, papel: PapelDaNuvem): HTMLCanvasElement | null {
  const largura = papel === 'corpo' ? TEXELS_DO_CORPO : TEXELS_DA_SOMBRA
  const altura = largura * AJUSTE_DAS_NUVENS.proporcao
  const tela = document.createElement('canvas')
  tela.width = Math.round(largura * (1 + 2 * FOLGA_DA_TEXTURA.x))
  tela.height = Math.round(altura * (1 + 2 * FOLGA_DA_TEXTURA.y))
  const g = tela.getContext('2d')
  if (g === null) return null
  g.translate(largura * FOLGA_DA_TEXTURA.x, altura * FOLGA_DA_TEXTURA.y)
  const sorteio = mulberry32(nuvem.semente)
  const ehSombra = papel === 'sombra'
  // Sombra azul-noite (não preto puro: a do protótipo, que não suja o verde do chão).
  const cor = ehSombra ? '6, 20, 34' : '255, 255, 255'
  const BOLHAS = 9
  for (let k = 0; k < BOLHAS; k++) {
    const t = (k + 0.5) / BOLHAS
    const arco = Math.sin(t * Math.PI)
    const cx = largura * (0.17 + 0.66 * t + (sorteio() - 0.5) * 0.05)
    const cy = altura * (0.55 - arco * 0.08 + (sorteio() - 0.5) * 0.1)
    const raio = altura * (0.18 + arco * 0.17 + sorteio() * 0.06)
    // A sombra é a mesma forma, mais larga e com a beirada bem mais longa: no
    // protótipo o corpo cobre metade dela, mas aqui a nuvem passa sobre o mar
    // e a sombra cai inteira na terra clara, onde a beirada curta virava uma
    // mancha escura de contorno marcado (conferido no Tasmaturi Village).
    const r = ehSombra ? raio * ESPALHO_DA_SOMBRA : raio
    const degrade = g.createRadialGradient(cx, cy, 0, cx, cy, r)
    if (ehSombra) {
      degrade.addColorStop(0, `rgba(${cor}, 0.36)`)
      degrade.addColorStop(0.4, `rgba(${cor}, 0.26)`)
    } else {
      degrade.addColorStop(0, `rgba(${cor}, 0.8)`)
      degrade.addColorStop(0.68, `rgba(${cor}, 0.66)`)
    }
    degrade.addColorStop(1, `rgba(${cor}, 0)`)
    g.fillStyle = degrade
    g.beginPath()
    g.arc(cx, cy, r, 0, Math.PI * 2)
    g.fill()
  }
  if (!ehSombra) {
    const REFLEXOS = 5
    for (let k = 0; k < REFLEXOS; k++) {
      const t = (k + 0.5) / REFLEXOS
      const cx = largura * (0.25 + 0.5 * t)
      const cy = altura * (0.42 - Math.sin(t * Math.PI) * 0.06)
      const r = altura * (0.12 + Math.sin(t * Math.PI) * 0.1)
      const brilho = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r)
      brilho.addColorStop(0, 'rgba(255, 255, 255, 0.55)')
      brilho.addColorStop(1, 'rgba(255, 255, 255, 0)')
      g.fillStyle = brilho
      g.beginPath()
      g.arc(cx, cy, r, 0, Math.PI * 2)
      g.fill()
    }
  }
  return tela
}

function texturaPadrao(nuvem: DefinicaoDaNuvem, papel: PapelDaNuvem): Texture | null {
  const tela = telaDaNuvem(nuvem, papel)
  // Mipmap: com o continente inteiro na tela (zoom de 7%), a nuvem encolhe
  // muito e, sem ele, a beirada macia piscaria ao andar.
  return tela === null ? null : new Texture({ source: new CanvasSource({ resource: tela, autoGenerateMipmaps: true, scaleMode: 'linear' }) })
}

interface NuvemNoPalco {
  definicao: DefinicaoDaNuvem
  corpo: Sprite
  sombra: Sprite
  /** `null` = não cabe neste mapa: os dois sprites ficam escondidos. */
  medida: MedidaDaNuvem | null
  /** Quanto do corpo aparece neste zoom (corpoPeloZoom): muda com o zoom, não a cada quadro. */
  doZoom: number
}

interface Estado {
  cena: string
  /**
   * Tamanho do céu: mudou, as nuvens são medidas de novo (sem aparecer de
   * novo). A travessia não depende dele (`travessiaDaNuvem`), então cada nuvem
   * segue de onde estava, no máximo o quanto o céu mudou.
   */
  ceu: string
  reduzido: boolean
}

export function createNuvensRenderer(movimento: MovimentoDasNuvens, opcoes: OpcoesDasNuvens = {}): NuvensRenderer {
  const agora = movimento.agora ?? Date.now
  const texturaDa = opcoes.texturaDa ?? texturaPadrao
  const camada = new Container()
  camada.label = 'nuvens'
  camada.eventMode = 'none'
  camada.visible = false
  // Grupo de render próprio: as seis posições por quadro ficam nele, e o
  // mundo (milhares de Graphics) não refaz nada por causa delas.
  camada.enableRenderGroup()
  const sombras = new Container()
  const corpos = new Container()
  camada.addChild(sombras, corpos)

  const texturas: Texture[] = []
  let nuvens: NuvemNoPalco[] | null = null
  let atual: Estado | null = null
  let noRelogio = false
  let movendo = false
  let aparicaoDesde: number | null = null
  let conferidoEm = 0
  let escalaDaCamera = 1
  /**
   * Onde as nuvens paradas estão: null = na fase de cada uma (abriu já com
   * movimento reduzido); um instante = congeladas onde estavam quando a pessoa
   * passou a pedir menos movimento, em vez de pularem para a fase.
   */
  let paradasEm: number | null = null
  let larguraDaTela = 0
  let avisado = ''

  /** As texturas nascem na primeira vez que alguma cena liga as nuvens, e ficam até o fim. */
  function montar(): NuvemNoPalco[] {
    if (nuvens !== null) return nuvens
    const montadas: NuvemNoPalco[] = []
    for (const definicao of NUVENS) {
      const deCorpo = texturaDa(definicao, 'corpo')
      const deSombra = texturaDa(definicao, 'sombra')
      if (deCorpo === null || deSombra === null) {
        deCorpo?.destroy(true)
        deSombra?.destroy(true)
        continue
      }
      texturas.push(deCorpo, deSombra)
      const corpo = new Sprite(deCorpo)
      const sombra = new Sprite(deSombra)
      corpo.label = `nuvem:${definicao.semente}`
      sombra.label = `sombraDaNuvem:${definicao.semente}`
      corpos.addChild(corpo)
      sombras.addChild(sombra)
      montadas.push({ definicao, corpo, sombra, medida: null, doZoom: 1 })
    }
    nuvens = montadas
    return montadas
  }

  /**
   * O céu do último mapa, pelas referências do que ele lê: o jogador chama
   * `atualizar` a cada pacote, e o chão quase nunca muda entre eles.
   */
  let ceuGuardado: { mapa: EntradaDasNuvens['mapa']; ceu: CeuDoMapa | null } | null = null
  function ceuDe(mapa: EntradaDasNuvens['mapa']): CeuDoMapa | null {
    const g = ceuGuardado
    if (
      g !== null &&
      g.mapa.floor === mapa.floor &&
      g.mapa.background === mapa.background &&
      g.mapa.ceuDasNuvens === mapa.ceuDasNuvens &&
      g.mapa.width === mapa.width &&
      g.mapa.height === mapa.height &&
      g.mapa.grid === mapa.grid
    ) {
      return g.ceu
    }
    const ceu = ceuDoMapa(mapa)
    ceuGuardado = { mapa, ceu }
    return ceu
  }

  function avisar(estado: EstadoDasNuvens): void {
    const chave = `${estado.nuvens}:${estado.movendo}`
    if (chave === avisado) return
    avisado = chave
    opcoes.aoMudar?.(estado)
  }

  /** O tamanho de cada sprite: muda só com o mapa. A textura tem folga em volta da caixa da nuvem. */
  function medir(lista: readonly NuvemNoPalco[], ceu: CeuDoMapa): number {
    let cabem = 0
    for (const nuvem of lista) {
      nuvem.medida = medidaDaNuvem(nuvem.definicao, ceu)
      const cabe = nuvem.medida !== null
      nuvem.corpo.visible = cabe
      nuvem.sombra.visible = cabe
      if (nuvem.medida === null) continue
      cabem++
      const largura = nuvem.medida.largura * (1 + 2 * FOLGA_DA_TEXTURA.x)
      const altura = nuvem.medida.altura * (1 + 2 * FOLGA_DA_TEXTURA.y)
      nuvem.corpo.setSize(largura, altura)
      nuvem.sombra.setSize(largura, altura)
      nuvem.doZoom = corpoPeloZoom(nuvem.medida.largura * escalaDaCamera, larguraDaTela)
    }
    return cabem
  }

  /** Só posição e opacidade. `segundos` null = paradas na fase de cada uma (movimento reduzido). */
  function posicionar(segundos: number | null): void {
    if (nuvens === null) return
    for (const nuvem of nuvens) {
      const medida = nuvem.medida
      if (medida === null) continue
      const quadro = quadroDaNuvem(nuvem.definicao, medida, segundos)
      const x = quadro.x - medida.largura * FOLGA_DA_TEXTURA.x
      const y = quadro.y - medida.altura * FOLGA_DA_TEXTURA.y
      nuvem.corpo.position.set(x, y)
      nuvem.sombra.position.set(x + medida.sombraDx, y + medida.sombraDy)
      nuvem.corpo.alpha = AJUSTE_DAS_NUVENS.alfaDoCorpo * quadro.alfa * nuvem.doZoom
      nuvem.sombra.alpha = AJUSTE_DAS_NUVENS.alfaDaSombra * quadro.alfa
    }
  }

  function entrarNoRelogio(): void {
    if (noRelogio) return
    noRelogio = true
    movimento.ticker.add(passo)
  }

  function sairDoRelogio(): void {
    if (!noRelogio) return
    noRelogio = false
    movimento.ticker.remove(passo)
  }

  function parar(t: number): void {
    movendo = false
    paradasEm = t / 1000
    posicionar(paradasEm)
    if (atual !== null) atual = { ...atual, reduzido: true }
    avisar({ nuvens: nuvens?.filter((n) => n.medida !== null).length ?? 0, movendo: false })
  }

  function passo(): void {
    const t = agora()
    if (aparicaoDesde !== null) {
      const feito = (t - aparicaoDesde) / APARICAO_DAS_NUVENS_MS
      // Relógio que voltou (o de parede pode ser acertado): a aparição termina.
      if (feito >= 1 || feito < 0) {
        aparicaoDesde = null
        camada.alpha = 1
      } else {
        camada.alpha = CURVAS.saida.f(feito)
      }
    }
    if (movendo) {
      if (Math.abs(t - conferidoEm) >= CONFERIR_MOVIMENTO_MS) {
        conferidoEm = t
        if (movimento.reducedMotion()) parar(t)
      }
      if (movendo) posicionar(t / 1000)
    }
    if (!movendo && aparicaoDesde === null) sairDoRelogio()
  }

  function desligar(): void {
    atual = null
    movendo = false
    aparicaoDesde = null
    camada.visible = false
    sairDoRelogio()
    avisar({ nuvens: 0, movendo: false })
  }

  return {
    camada,
    atualizar(entrada) {
      if (entrada === null) {
        desligar()
        return
      }
      const ceu = ceuDe(entrada.mapa)
      if (ceu === null) {
        desligar()
        return
      }
      const reduzido = movimento.reducedMotion()
      const proximo: Estado = { cena: entrada.cena, ceu: `${ceu.x},${ceu.y},${ceu.largura}x${ceu.altura}`, reduzido }
      if (atual !== null && atual.cena === proximo.cena && atual.ceu === proximo.ceu && atual.reduzido === proximo.reduzido) return
      const lista = montar()
      const cabem = lista.length === 0 ? 0 : medir(lista, ceu)
      if (cabem === 0) {
        // Sem canvas 2d, ou mapa pequeno demais para a nuvem e a sombra.
        desligar()
        return
      }
      // Cena nova (ou chave religada): as nuvens aparecem de leve, em vez de surgir de golpe.
      const aparecer = atual === null || atual.cena !== proximo.cena
      atual = proximo
      movendo = !reduzido
      const t = agora()
      conferidoEm = t
      paradasEm = null
      posicionar(movendo ? t / 1000 : null)
      if (aparecer) {
        aparicaoDesde = t
        camada.alpha = 0
      }
      camada.visible = true
      if (movendo || aparicaoDesde !== null) entrarNoRelogio()
      else sairDoRelogio()
      avisar({ nuvens: cabem, movendo })
    },
    setTela(escala, largura) {
      if (escala === escalaDaCamera && largura === larguraDaTela) return
      escalaDaCamera = escala
      larguraDaTela = largura
      if (nuvens === null) return
      for (const nuvem of nuvens) {
        if (nuvem.medida !== null) nuvem.doZoom = corpoPeloZoom(nuvem.medida.largura * escala, largura)
      }
      // Andando, o próximo quadro já usa o novo valor; parada, a opacidade muda agora.
      if (atual !== null && !movendo) posicionar(paradasEm)
    },
    destruir() {
      sairDoRelogio()
      camada.destroy({ children: true })
      for (const textura of texturas) textura.destroy(true)
      texturas.length = 0
      nuvens = null
    },
  }
}
