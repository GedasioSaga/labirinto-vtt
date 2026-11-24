import { Container, Graphics, type Ticker } from 'pixi.js'
import type { RegionPoint } from '../types/map'
import {
  anelDaOnda,
  casarOndas,
  entradaDaOnda,
  ONDA_ANEIS,
  ONDA_DIAMETRO_CASAS,
  ONDA_PARADA,
  type OndaViva,
} from './ondasDaCegueira'

/**
 * CEGUEIRA na tela do jogador: uma onda por ponto de `snapshot.ondas`, no chão, acima da névoa e abaixo
 * das fichas. Cada onda é desenhada UMA vez (miolo e três anéis); por quadro só mudam escala e alfa dos
 * anéis — o equivalente do `transform`/`opacity` do protótipo. Sem onda, o ticker não faz nada.
 */

/** Pergaminho (`--lb-gr-gravado-forte`, o `--onda` do protótipo): não é latão, que já é "vez" e "escolhido". */
const COR_DA_ONDA = 0xead6ae
/** Espessura do anel e do brilho, em casas (1,5 px e o halo de 8 px do protótipo numa casa de ~50 px). */
const ANEL_LARGURA_CASAS = 0.03
const BRILHO_LARGURA_CASAS = 0.14
const BRILHO_ALFA = 0.14
/** Miolo parado: 34% do diâmetro, com o centro mais claro (o gradiente do protótipo em quatro discos). */
const MIOLO_FRACAO = 0.17
const MIOLO_DISCOS = 4
const MIOLO_ALFA_DO_DISCO = 0.14
const MIOLO_ALFA = 0.7
const MIOLO_ALFA_PARADO = 0.6

/**
 * O nome do container das ondas. Ele mora DENTRO da camada do último avistamento (`LAST_SEEN_LAYER_LABEL`):
 * mesma faixa da camada Tokens (ordem e opacidade dela), por baixo dos contornos, escondido na foto do telhado.
 * Quem conta os contornos dessa camada pula este filho.
 */
export const ONDAS_DA_CEGUEIRA_LABEL = 'ondas-da-cegueira'

interface VistaDaOnda {
  raiz: Container
  aneis: Graphics[]
}

export interface CamadaDasOndas {
  readonly container: Container
  /** As ondas do recorte atual (`[]` ou ausente = nenhuma); `casa` em px de mundo. */
  mostrar(ondas: readonly RegionPoint[] | undefined, casa: number): void
  destruir(): void
}

function desenharOnda(casa: number): VistaDaOnda {
  const raiz = new Container()
  const raio = (ONDA_DIAMETRO_CASAS * casa) / 2
  const miolo = new Graphics()
  for (let i = 0; i < MIOLO_DISCOS; i += 1) {
    miolo.circle(0, 0, raio * 2 * MIOLO_FRACAO * (1 - i / MIOLO_DISCOS)).fill({ color: COR_DA_ONDA, alpha: MIOLO_ALFA_DO_DISCO })
  }
  miolo.alpha = MIOLO_ALFA
  raiz.addChild(miolo)
  const aneis: Graphics[] = []
  for (let i = 0; i < ONDA_ANEIS; i += 1) {
    const anel = new Graphics()
    anel.circle(0, 0, raio).stroke({ width: BRILHO_LARGURA_CASAS * casa, color: COR_DA_ONDA, alpha: BRILHO_ALFA })
    anel.circle(0, 0, raio).stroke({ width: ANEL_LARGURA_CASAS * casa, color: COR_DA_ONDA, alpha: 1 })
    anel.alpha = 0
    raiz.addChild(anel)
    aneis.push(anel)
  }
  return { raiz, aneis }
}

export function criarCamadaDasOndas(opcoes: { ticker: Ticker; reducedMotion: () => boolean; agora?: () => number }): CamadaDasOndas {
  const agora = opcoes.agora ?? (() => performance.now())
  const container = new Container()
  container.label = ONDAS_DA_CEGUEIRA_LABEL
  container.eventMode = 'none'
  let vivas: OndaViva[] = []
  let casaDesenhada = 0
  const vistas = new Map<number, VistaDaOnda>()
  let chaves = 0

  const pintar = (instante: number): void => {
    const parado = opcoes.reducedMotion()
    for (const onda of vivas) {
      const vista = vistas.get(onda.chave)
      if (vista === undefined) continue
      const entrada = parado ? 1 : entradaDaOnda(instante, onda.nasceu)
      vista.aneis.forEach((anel, indice) => {
        const { escala, alfa } = parado ? (ONDA_PARADA[indice] ?? { escala: 1, alfa: 0 }) : anelDaOnda(instante, onda.fase, indice)
        anel.scale.set(escala)
        anel.alpha = alfa * entrada
      })
      const miolo = vista.raiz.children[0]
      if (miolo !== undefined) miolo.alpha = (parado ? MIOLO_ALFA_PARADO : MIOLO_ALFA) * entrada
    }
  }

  // Movimento reduzido ligado no meio: pinta os anéis parados uma vez e o ticker volta a não fazer nada.
  let estavaParado = false
  const tick = (): void => {
    if (vivas.length === 0) return
    const parado = opcoes.reducedMotion()
    if (parado && estavaParado) return
    estavaParado = parado
    pintar(agora())
  }
  opcoes.ticker.add(tick)

  const limpar = (): void => {
    for (const vista of vistas.values()) vista.raiz.destroy({ children: true })
    vistas.clear()
  }

  return {
    container,
    mostrar(ondas, casa) {
      const instante = agora()
      // Casa de outro tamanho (outro mapa): redesenha tudo.
      if (casa !== casaDesenhada) {
        limpar()
        vivas = []
        casaDesenhada = casa
      }
      vivas = casarOndas(vivas, ondas ?? [], casa, instante, () => (chaves += 1))
      const ficam = new Set(vivas.map((onda) => onda.chave))
      // Quem deixou de ser sentido some na hora.
      for (const [chave, vista] of vistas) {
        if (ficam.has(chave)) continue
        vista.raiz.destroy({ children: true })
        vistas.delete(chave)
      }
      for (const onda of vivas) {
        let vista = vistas.get(onda.chave)
        if (vista === undefined) {
          vista = desenharOnda(casa)
          vistas.set(onda.chave, vista)
          container.addChild(vista.raiz)
        }
        vista.raiz.position.set(onda.x, onda.y)
      }
      pintar(instante)
    },
    destruir() {
      opcoes.ticker.remove(tick)
      limpar()
      container.destroy({ children: true })
    },
  }
}
