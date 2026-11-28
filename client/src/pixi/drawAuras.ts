import { Container, Graphics, type Ticker } from 'pixi.js'
import { raiosDasAuras, type RaioDaAura } from '../lib/batalha/aura'
import type { SeloDaBatalha } from '../lib/batalha/combate'
import { pegadaDaFichaEm } from '../lib/batalha/movimentoEmBatalha'
import { condicaoDaFabrica } from '../lib/condicoes/fabrica'
import type { CondicaoPropria, Token } from '../types/map'
import { CONTORNO_DO_CAMPO } from './drawMarcasDoCampo'

/**
 * REWORK DAS CONDIÇÕES, D9 (PENDENCIAS nº 1): O RAIO DA AURA no mapa do mestre. Em volta de cada portador
 * (`raiosDasAuras`), o quadrado das casas que a aura alcança: a distância da batalha é a do xadrez, então "a até
 * N casas" é um quadrado de lado `tamanho + 2N`, e o desenho mostra exatamente quem pega (um círculo mentiria nos
 * cantos). Discreto: um véu leve na cor da condição e uma borda fina, no chão da grade da batalha (por baixo do
 * alcance de andar, dos fios e das fichas). Só com a batalha ligada (a camada da grade) e só no mestre (D9).
 *
 * Movimento: o raio novo aparece em 200 ms (ease-out), sem pular; com `prefers-reduced-motion`, aparece
 * pronto. Nada pisca nem respira: o raio fica no mapa a batalha inteira, e o que fica não deve chamar o olho.
 * Traço em px de TELA: o zoom refaz; sem mudança (os mesmos raios, a mesma escala), nada é desenhado.
 */

/** O véu: leve o bastante para o chão aparecer por baixo. */
const VEU_ALPHA = 0.08
/** A borda na cor da condição, por cima de um contorno escuro (lê em chão claro e escuro). */
const BORDA_PX = 1.5
const BORDA_ALPHA = 0.8
const CONTORNO_PX = 3.5
const CONTORNO_ALPHA = 0.35
/** O canto arredondado, em casas: o quadrado lê como área, não como parede. */
const CANTO_EM_CASAS = 0.3
/** A entrada do raio novo (ease-out cúbico). */
const ENTRADA_MS = 200
/** Sem cor achada: a positiva em latão claro, a negativa em vermelho suave (as da paleta das condições). */
const COR_POSITIVA = 0xf0d35c
const COR_NEGATIVA = 0xef6f6c

/** Um raio pronto para desenhar, em px do mundo. */
export interface AuraNoMapa {
  chave: string
  x: number
  y: number
  lado: number
  /** O lado de uma casa da grade, em px do mundo (o canto arredondado). */
  casa: number
  cor: number
}

export interface MovimentoDasAuras {
  ticker: Pick<Ticker, 'add' | 'remove'>
  reducedMotion: () => boolean
  /** Agora, em ms. Padrão `performance.now()`. */
  agora?: () => number
}

export interface AurasDaBatalha {
  readonly camada: Container
  /** Os raios (`aurasNoMapa`) e o zoom; a mesma lista e a mesma escala não refazem nada. */
  desenhar(auras: readonly AuraNoMapa[], escala: number): void
  destruir(): void
}

/** `#rrggbb` em número; o que não for essa forma ("Outra cor" com nome de CSS) = `null`. */
function corEmNumero(cor: string | undefined): number | null {
  if (cor === undefined || !/^#[0-9a-f]{6}$/i.test(cor)) return null
  return Number.parseInt(cor.slice(1), 16)
}

/** A cor do raio: a da condição (a de fábrica pelo id, a criada da mesa), senão a do tipo. */
function corDoRaio(raio: RaioDaAura, criadas: readonly CondicaoPropria[]): number {
  const condId = raio.condId
  const cor = condId === undefined ? undefined : (condicaoDaFabrica(condId)?.cor ?? criadas.find((criada) => criada.id === condId)?.cor)
  return corEmNumero(cor) ?? (raio.positiva ? COR_POSITIVA : COR_NEGATIVA)
}

/**
 * Os raios das auras da batalha em px do mundo: a ficha pelo lugar dela no mapa (`pegadaDaFichaEm`, a mesma
 * conta do host) e o quadrado das casas que a aura alcança. Ficha fora do mapa, ou grade sem casa: sem raio.
 */
export function aurasNoMapa(selos: readonly SeloDaBatalha[] | undefined, tokens: readonly Pick<Token, 'id' | 'x' | 'y' | 'size'>[], grid: number, criadas: readonly CondicaoPropria[]): AuraNoMapa[] {
  if (!(grid > 0)) return []
  const porId = new Map(tokens.map((token) => [token.id, token]))
  const vistas = new Map<string, number>()
  return raiosDasAuras(selos).flatMap((raio): AuraNoMapa[] => {
    const token = porId.get(raio.tokenId)
    if (token === undefined) return []
    const pegada = pegadaDaFichaEm({ x: token.x, y: token.y }, token.size, grid)
    // Duas auras no mesmo selo (duas peças): a chave conta as repetidas, para cada uma ter o seu desenho.
    const base = `${raio.seloId}|${raio.casas}`
    const vez = vistas.get(base) ?? 0
    vistas.set(base, vez + 1)
    return [{ chave: `${base}|${vez}`, x: (pegada.col - raio.casas) * grid, y: (pegada.row - raio.casas) * grid, lado: (pegada.tamanho + 2 * raio.casas) * grid, casa: grid, cor: corDoRaio(raio, criadas) }]
  })
}

function geometria(aura: AuraNoMapa, escala: number): string {
  return `${aura.x},${aura.y},${aura.lado},${aura.casa},${aura.cor},${escala}`
}

function pintar(grafico: Graphics, aura: AuraNoMapa, escala: number): void {
  const px = 1 / (escala > 0 ? escala : 1)
  const raio = Math.min(CANTO_EM_CASAS * aura.casa, aura.lado / 2)
  grafico.clear()
  grafico.roundRect(aura.x, aura.y, aura.lado, aura.lado, raio).fill({ color: aura.cor, alpha: VEU_ALPHA })
  grafico.roundRect(aura.x, aura.y, aura.lado, aura.lado, raio).stroke({ width: CONTORNO_PX * px, color: CONTORNO_DO_CAMPO, alpha: CONTORNO_ALPHA })
  grafico.roundRect(aura.x, aura.y, aura.lado, aura.lado, raio).stroke({ width: BORDA_PX * px, color: aura.cor, alpha: BORDA_ALPHA })
}

interface RaioDesenhado {
  grafico: Graphics
  geometria: string
  /** Quando a entrada começou; `null` = já entrou. */
  desde: number | null
}

export function criarAurasDaBatalha(movimento: MovimentoDasAuras): AurasDaBatalha {
  const camada = new Container()
  camada.label = 'auras-da-batalha'
  camada.eventMode = 'none'
  camada.interactiveChildren = false
  const desenhados = new Map<string, RaioDesenhado>()
  const agora = movimento.agora ?? (() => performance.now())
  let andando = false

  const passo = (): void => {
    const instante = agora()
    let falta = false
    for (const raio of desenhados.values()) {
      if (raio.desde === null) continue
      const t = Math.min(1, (instante - raio.desde) / ENTRADA_MS)
      raio.grafico.alpha = 1 - (1 - t) ** 3
      if (t >= 1) raio.desde = null
      else falta = true
    }
    if (!falta) parar()
  }
  const parar = (): void => {
    if (!andando) return
    movimento.ticker.remove(passo)
    andando = false
  }
  const andar = (): void => {
    if (andando) return
    movimento.ticker.add(passo)
    andando = true
  }

  return {
    camada,
    desenhar(auras, escala) {
      const ficam = new Set(auras.map((aura) => aura.chave))
      for (const [chave, raio] of desenhados) {
        if (ficam.has(chave)) continue
        raio.grafico.destroy()
        desenhados.delete(chave)
      }
      let entrou = false
      for (const aura of auras) {
        const nova = geometria(aura, escala)
        const antes = desenhados.get(aura.chave)
        if (antes !== undefined) {
          if (antes.geometria === nova) continue
          pintar(antes.grafico, aura, escala)
          antes.geometria = nova
          continue
        }
        const grafico = new Graphics()
        pintar(grafico, aura, escala)
        const parado = movimento.reducedMotion()
        grafico.alpha = parado ? 1 : 0
        camada.addChild(grafico)
        desenhados.set(aura.chave, { grafico, geometria: nova, desde: parado ? null : agora() })
        if (!parado) entrou = true
      }
      if (entrou) andar()
      if (desenhados.size === 0) parar()
    },
    destruir() {
      parar()
      for (const raio of desenhados.values()) raio.grafico.destroy()
      desenhados.clear()
      camada.destroy({ children: true })
    },
  }
}
