import { Graphics, type Container, type Sprite, type Text } from 'pixi.js'
import type { CampoDaBatalha } from '../lib/batalha/marcasNoCampo'
import { TOKEN_FRAME_WIDTH } from '../pixi/constants'
import { ALVO_PARADO_ALPHA, alphaDoPulso, BRASA, corDoLado, desenharAnel, desenharCantos, desenharLado, desenharSinalDoLado, raioDoAnel } from '../pixi/drawMarcasDoCampo'

/**
 * CAMPO DE BATALHA (protótipo aprovado em 19/11/2026) na tela do JOGADOR: as
 * mesmas marcas do mestre (`pixi/tokensRenderer.ts`), postas por fora do
 * desenho da ficha (`PlayerView.paintTokenView` não muda):
 *
 *   aro    o anel fino na cor do lado (por cima da moldura da foto) e o tracejado de quem espera o contra-ataque;
 *   cantos os cantos do alvo na casa, piscando enquanto ele decide a reação;
 *   sinal  o ponto (lado dos jogadores) ou o losango (o outro) à esquerda do nome.
 *
 * Só o que o recorte dele leva (`campoDoJogador`). Os Graphics nascem na
 * primeira marca de cada ficha e morrem quando a ficha sai do campo.
 */

/** O pedaço da vista da ficha que as marcas leem (a `TokenView` do PlayerView). */
export interface VistaDaFichaNoCampo {
  wrapper: Container
  photo: Sprite
  label: Text
  /** Raio do disco em px de mundo. */
  radius: number
}

interface MarcasDaFicha {
  aro: Graphics
  cantos: Graphics
  sinal: Graphics
  /** O que foi desenhado por último (raio, lado, anel, alvo): igual = nada a refazer. */
  chave: string
  piscando: boolean
}

const SINAL_RAIO = 3.5
const SINAL_VAO = 5
const DEGRAU_DO_PULSO_MS = 140

export interface CampoNoJogador {
  /** Põe as marcas do campo nas fichas à vista. `null` = fora da batalha. */
  sincronizar(campo: CampoDaBatalha | null, vistas: ReadonlyMap<string, VistaDaFichaNoCampo>, grid: number, reduzido: boolean): void
  /** O raio do meio do anel de quem age nesta ficha (com ou sem o anel do lado). */
  raioDoAnelDe(tokenId: string, raioDoDisco: number): number
  /** Um quadro: o sinal acompanha o nome (que desce com o vizinho e muda com o zoom) e o alvo que espera pisca. */
  passo(agora: number, reduzido: boolean): void
  destruir(): void
}

export function criarCampoNoJogador(): CampoNoJogador {
  const marcas = new Map<string, MarcasDaFicha>()
  const vistasAgora = new Map<string, VistaDaFichaNoCampo>()
  let campoAgora: CampoDaBatalha | null = null

  function soltar(tokenId: string): void {
    const m = marcas.get(tokenId)
    if (m === undefined) return
    for (const g of [m.aro, m.cantos, m.sinal]) {
      g.removeFromParent()
      g.destroy()
    }
    marcas.delete(tokenId)
  }

  function marcasDe(tokenId: string, vista: VistaDaFichaNoCampo): MarcasDaFicha {
    let m = marcas.get(tokenId)
    if (m === undefined || m.aro.destroyed) {
      m = { aro: new Graphics(), cantos: new Graphics(), sinal: new Graphics(), chave: '', piscando: false }
      m.aro.label = 'aro-do-lado'
      m.cantos.label = 'cantos-do-alvo'
      m.sinal.label = 'sinal-do-lado'
      marcas.set(tokenId, m)
    }
    // Por cima do disco e da foto, por baixo do nome; o sinal por cima de tudo, ao lado do nome.
    const w = vista.wrapper
    if (m.aro.parent !== w) w.addChildAt(m.aro, w.getChildIndex(vista.label))
    if (m.cantos.parent !== w) w.addChildAt(m.cantos, w.getChildIndex(vista.label))
    if (m.sinal.parent !== w) w.addChild(m.sinal)
    return m
  }

  function baseDoLado(vista: VistaDaFichaNoCampo): number {
    return vista.photo.visible ? Math.max(1, vista.radius - TOKEN_FRAME_WIDTH) : vista.radius
  }

  return {
    sincronizar(campo, vistas, grid, reduzido) {
      campoAgora = campo
      vistasAgora.clear()
      const fichas = campo?.fichas
      for (const tokenId of [...marcas.keys()]) {
        if (fichas === undefined || !fichas.has(tokenId) || !vistas.has(tokenId)) soltar(tokenId)
      }
      if (fichas === undefined) return
      for (const [tokenId, marca] of fichas) {
        const vista = vistas.get(tokenId)
        if (vista === undefined || vista.wrapper.destroyed) continue
        vistasAgora.set(tokenId, vista)
        const m = marcasDe(tokenId, vista)
        const cor = corDoLado(marca.lado)
        const base = baseDoLado(vista)
        const meiaCasa = Math.max(vista.radius, grid / 2)
        const chave = `${base}|${meiaCasa}|${cor}|${marca.lado?.forma}|${marca.anel}|${marca.alvo}|${campo?.quemAge === tokenId}`
        m.piscando = marca.alvo === 'reagindo' && !reduzido
        if (chave === m.chave) continue
        m.chave = chave
        m.aro.clear()
        if (cor !== null) desenharLado(m.aro, base, cor)
        // O anel cheio de quem age é o anel da vez (PlayerView, que pulsa); aqui só o tracejado de quem espera.
        if (marca.anel === 'espera' && campo?.quemAge !== tokenId) desenharAnel(m.aro, raioDoAnel(base, cor !== null), true)
        m.cantos.clear()
        if (marca.alvo !== null) desenharCantos(m.cantos, meiaCasa, BRASA)
        m.cantos.alpha = marca.alvo === 'reagindo' && reduzido ? ALVO_PARADO_ALPHA : 1
        m.sinal.visible = cor !== null && marca.lado !== null
        if (cor !== null && marca.lado !== null) desenharSinalDoLado(m.sinal, marca.lado.forma, cor, SINAL_RAIO)
      }
    },
    raioDoAnelDe(tokenId, raioDoDisco) {
      const vista = vistasAgora.get(tokenId)
      const temLado = corDoLado(campoAgora?.fichas.get(tokenId)?.lado ?? null) !== null
      const base = vista === undefined ? raioDoDisco : baseDoLado(vista)
      return raioDoAnel(base, temLado)
    },
    passo(agora, reduzido) {
      if (marcas.size === 0) return
      const alpha = reduzido ? ALVO_PARADO_ALPHA : alphaDoPulso(Math.floor(agora / DEGRAU_DO_PULSO_MS) * DEGRAU_DO_PULSO_MS)
      for (const [tokenId, m] of marcas) {
        const vista = vistasAgora.get(tokenId)
        if (vista === undefined || vista.wrapper.destroyed) continue
        if (m.piscando && m.cantos.alpha !== alpha) m.cantos.alpha = alpha
        if (!m.sinal.visible && !vista.label.visible) continue
        // O nome escala com o zoom (px de tela): o sinal vai junto, à esquerda dele.
        const escala = vista.label.scale.y
        const raio = SINAL_RAIO * escala
        const vao = SINAL_VAO * escala
        const mostra = vista.label.visible && vista.label.text !== '' && m.chave !== '' && corDoLado(campoAgora?.fichas.get(tokenId)?.lado ?? null) !== null
        if (m.sinal.visible !== mostra) m.sinal.visible = mostra
        if (!mostra) continue
        m.sinal.scale.set(escala)
        m.sinal.position.set(vista.label.x - vista.label.width / 2 - vao - raio, vista.label.y + vista.label.height / 2)
      }
    },
    destruir() {
      for (const tokenId of [...marcas.keys()]) soltar(tokenId)
      vistasAgora.clear()
    },
  }
}
