import { Container, Graphics, Text } from 'pixi.js'
import { sceneCellsLabel } from '../components/RoomPanel'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'
import type { AnelDaVisao } from '../lib/visaoDosJogadores'
import { curvaCubica } from './mapaDePenumbra'

/**
 * VISÃO DOS JOGADORES (pedido do mestre de 25/11/2026): o anel tracejado do
 * alcance de visão de cada ficha de jogador, na cor do pino do dono, com o
 * alcance em casas escrito no alto do anel. Só no editor do mestre, sem
 * receber toque, sem preencher a área e sem recorte de parede.
 *
 * Mora numa camada do palco (fora das faixas do `world`), com um container de
 * dentro que copia a posição e o zoom do `world`: arrastar a vista não redesenha
 * nada, a ficha arrastada só leva a posição do anel, e o tracejado só é refeito
 * quando muda o raio, a cor ou o zoom (a grossura e o passo do traço são de
 * TELA). Anel fora da vista fica escondido, sem desenhar.
 *
 * Um Graphics e um Text por ficha, criados uma vez e nunca destruídos durante a
 * vida do canvas (Text destruído antes do primeiro render derruba o Pixi 8.20,
 * ver `drawLaser.ts`); quem saiu só fica escondido.
 */

/** Retângulo da vista em px de mundo (`vistaDaCamera`). */
export interface VistaDosAneis {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

// Traço e vão em px de TELA: o anel parece o mesmo em qualquer zoom.
const TRACO_PX = 9
const VAO_PX = 6
// Ficha cega: pontilhado, o "não enxerga direito" que se lê de longe.
const PONTO_PX = 2
const VAO_DO_PONTO_PX = 5
const MIN_TRACOS = 12
const MAX_TRACOS = 160
const LINHA_PX = 1.5
const LINHA_ALPHA = 0.85
/** O contorno escuro por baixo do traço: lê em chão claro e escuro. */
const VEU = 0x111111
const VEU_PX = 3.5
const VEU_ALPHA = 0.35
const ROTULO_FONTE_PX = 11
const ROTULO_CONTORNO_PX = 3
/** Folga, em px de tela, entre o fim do traço e o rótulo. */
const FOLGA_DO_ROTULO_PX = 4
/** O traço nunca some mais que isto para dar lugar ao rótulo (anel pequeno no zoom baixo). */
const MAIOR_VAO_DO_ROTULO = Math.PI / 3
const COR_DE_RESERVA = 0xe0a44a
const TOPO = -Math.PI / 2
const VOLTA = Math.PI * 2

// O fade do botão: só a opacidade, saída forte (a `--ease-out` da casa); sair é mais rápido que entrar.
const ENTRADA_MS = 180
const SAIDA_MS = 140
const SAIDA_FORTE = curvaCubica(0.23, 1, 0.32, 1)

function corEmNumero(cor: string): number {
  return /^#[0-9a-f]{6}$/i.test(cor) ? Number.parseInt(cor.slice(1), 16) : COR_DE_RESERVA
}

/** "6 casas", "3,5 casas" — o mesmo rótulo do raio no painel do Grupo (`sceneCellsLabel`). */
export function rotuloDoAnel(anel: Pick<AnelDaVisao, 'raio' | 'cega'>, grid: number): string {
  const casas = sceneCellsLabel(anel.raio / grid, 1)
  return anel.cega ? `${casas} · cego` : casas
}

/**
 * O anel aparece na vista? Fora quando o círculo nem encosta na vista, e também
 * quando a vista inteira cabe dentro dele (o traço passa todo por fora da tela).
 */
function anelNaVista(anel: AnelDaVisao, vista: VistaDosAneis, folga: number): boolean {
  const pertoX = Math.max(vista.minX - anel.x, 0, anel.x - vista.maxX)
  const pertoY = Math.max(vista.minY - anel.y, 0, anel.y - vista.maxY)
  if (Math.hypot(pertoX, pertoY) > anel.raio + folga) return false
  const longeX = Math.max(Math.abs(anel.x - vista.minX), Math.abs(anel.x - vista.maxX))
  const longeY = Math.max(Math.abs(anel.y - vista.minY), Math.abs(anel.y - vista.maxY))
  return Math.hypot(longeX, longeY) >= anel.raio - folga
}

/** Os traços do anel, centrado na origem, deixando o vão do rótulo no alto. */
function tracarAnel(g: Graphics, raio: number, escala: number, cega: boolean, vaoDoRotulo: number): void {
  const traco = cega ? PONTO_PX : TRACO_PX
  const vao = cega ? VAO_DO_PONTO_PX : VAO_PX
  const inicio = TOPO + vaoDoRotulo
  const arco = VOLTA - vaoDoRotulo * 2
  const n = Math.min(MAX_TRACOS, Math.max(MIN_TRACOS, Math.round((arco * raio * escala) / (traco + vao))))
  const passo = arco / n
  const cheio = passo * (traco / (traco + vao))
  // O último traço termina no fim do arco: o vão do rótulo fica simétrico.
  for (let i = 0; i < n; i += 1) {
    const a0 = inicio + i * passo + (passo - cheio) / 2
    const a1 = a0 + cheio
    g.moveTo(Math.cos(a0) * raio, Math.sin(a0) * raio).arc(0, 0, raio, a0, a1)
  }
}

interface Peca {
  g: Graphics
  rotulo: Text
  /** O que o tracejado desenhado leva (raio, cor, cegueira, zoom, rótulo); `null` = nada desenhado. */
  chave: string | null
}

export function criarCamadaDaVisaoDosJogadores(palco: Container, indice: number) {
  const camada = new Container()
  camada.eventMode = 'none'
  camada.alpha = 0
  camada.visible = false
  const mundo = new Container()
  mundo.eventMode = 'none'
  camada.addChild(mundo)
  palco.addChildAt(camada, indice)
  const pecas = new Map<string, Peca>()

  // O fade: do alfa de agora até o alvo, então trocar no meio do caminho retoma de onde está.
  let alvo = 0
  let de = 0
  let inicio = 0
  let duracao = 0

  const novaPeca = (): Peca => {
    const g = new Graphics()
    g.eventMode = 'none'
    const rotulo = new Text({
      text: '',
      style: {
        fontFamily: DEFAULT_TEXT_FONT_FAMILY,
        fontSize: ROTULO_FONTE_PX,
        fontWeight: '600',
        fill: COR_DE_RESERVA,
        stroke: { color: VEU, width: ROTULO_CONTORNO_PX, join: 'round' },
      },
    })
    rotulo.eventMode = 'none'
    rotulo.anchor.set(0.5)
    mundo.addChild(g, rotulo)
    return { g, rotulo, chave: null }
  }

  const desenharPeca = (peca: Peca, anel: AnelDaVisao, texto: string, escala: number): void => {
    peca.g.position.set(anel.x, anel.y)
    peca.rotulo.position.set(anel.x, anel.y - anel.raio)
    peca.rotulo.scale.set(1 / escala)
    const chave = `${anel.raio}|${anel.cor}|${anel.cega ? 1 : 0}|${escala}|${texto}`
    if (chave === peca.chave) return
    peca.chave = chave
    const cor = corEmNumero(anel.cor)
    peca.rotulo.text = texto
    peca.rotulo.style.fill = cor
    // `width` já vem com a escala do rótulo: px de mundo, a mesma medida do raio.
    const meiaLargura = peca.rotulo.width / 2 + FOLGA_DO_ROTULO_PX / escala
    const vaoDoRotulo = Math.min(MAIOR_VAO_DO_ROTULO, meiaLargura / anel.raio)
    const g = peca.g
    g.clear()
    tracarAnel(g, anel.raio, escala, anel.cega, vaoDoRotulo)
    g.stroke({ width: VEU_PX / escala, color: VEU, alpha: VEU_ALPHA, cap: 'round' })
    tracarAnel(g, anel.raio, escala, anel.cega, vaoDoRotulo)
    g.stroke({ width: LINHA_PX / escala, color: cor, alpha: LINHA_ALPHA, cap: 'round' })
  }

  return {
    camada,

    /** Liga ou desliga com o fade curto; `naHora` troca sem fade (abertura do editor, reduzir movimento). */
    ligar(ligada: boolean, agora: number, naHora: boolean): void {
      alvo = ligada ? 1 : 0
      de = camada.alpha
      inicio = agora
      duracao = naHora ? 0 : ligada ? ENTRADA_MS : SAIDA_MS
    },

    /** Um quadro do fade. Devolve se a camada aparece (vale desenhar os anéis). */
    passo(agora: number): boolean {
      const t = duracao === 0 ? 1 : Math.min(1, (agora - inicio) / duracao)
      const alfa = t >= 1 ? alvo : de + (alvo - de) * SAIDA_FORTE(t)
      camada.alpha = alfa
      camada.visible = alfa > 0
      return camada.visible
    },

    /** Copia a posição e o zoom do `world`: os anéis andam com a vista sem redesenhar. */
    acompanhar(world: Container): void {
      mundo.position.set(world.position.x, world.position.y)
      mundo.scale.set(world.scale.x, world.scale.y)
    },

    /** Desenha os anéis que aparecem na vista e esconde o resto. Devolve quantos aparecem. */
    desenhar(aneis: readonly AnelDaVisao[], grid: number, vista: VistaDosAneis, escala: number): number {
      const presentes = new Set<string>()
      if (Number.isFinite(escala) && escala > 0 && grid > 0) {
        const folga = (VEU_PX + ROTULO_FONTE_PX + ROTULO_CONTORNO_PX) / escala
        for (const anel of aneis) {
          if (!anelNaVista(anel, vista, folga)) continue
          presentes.add(anel.tokenId)
          let peca = pecas.get(anel.tokenId)
          if (peca === undefined) {
            peca = novaPeca()
            pecas.set(anel.tokenId, peca)
          }
          desenharPeca(peca, anel, rotuloDoAnel(anel, grid), escala)
          peca.g.visible = true
          peca.rotulo.visible = true
        }
      }
      for (const [tokenId, peca] of pecas) {
        if (presentes.has(tokenId)) continue
        peca.g.visible = false
        peca.rotulo.visible = false
      }
      return presentes.size
    },
  }
}
