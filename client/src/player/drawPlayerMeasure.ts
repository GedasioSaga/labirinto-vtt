import { Text, type Container, type Graphics } from 'pixi.js'
import type { Point } from '../pixi/world'
import type { Casa } from '../lib/batalha/blocos'
import { PASSO_DA_DIRECAO } from '../lib/batalha/medicao'
import type { LeituraDaMedida, MedidaCompartilhada } from '../lib/batalha/ferramentasDoJogador'

/**
 * Linha da régua do jogador, desenhada em espaço de TELA (acima do `world`,
 * como os sinais): a espessura fica a mesma em qualquer zoom, sem redesenho
 * por mudança de escala.
 *
 * Estilo do minimapa (Resident Evil): traço fino e claro, pontas pequenas.
 * O véu escuro e estreito por baixo só impede a linha de sumir em chão
 * claro; não é contorno.
 */
const LINE_COLOR = 0xf2ede4
const LINE_ALPHA = 0.95
const LINE_WIDTH = 1.5
const SHADOW_COLOR = 0x111111
const SHADOW_ALPHA = 0.35
const SHADOW_WIDTH = 3.5
/** Pontas discretas: ponto cheio onde a medida começou, anel pequeno onde o dedo está. */
const START_DOT_RADIUS = 2.5
const END_RING_RADIUS = 3.5

export function drawPlayerMeasure(g: Graphics, start: Point, end: Point): void {
  g.clear()
  g.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width: SHADOW_WIDTH, color: SHADOW_COLOR, alpha: SHADOW_ALPHA, cap: 'round' })
  g.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width: LINE_WIDTH, color: LINE_COLOR, alpha: LINE_ALPHA, cap: 'round' })
  g.circle(start.x, start.y, START_DOT_RADIUS).fill({ color: LINE_COLOR, alpha: LINE_ALPHA })
  g.circle(end.x, end.y, END_RING_RADIUS).stroke({ width: LINE_WIDTH, color: LINE_COLOR, alpha: LINE_ALPHA })
}

/** Contorno do alcance: a mesma linha clara, mais apagada, para não disputar com o trajeto. */
const REACH_ALPHA = 0.55

/**
 * Arrasto da própria ficha: o trajeto (mesma linha da régua) e, quando a cena
 * tem passo máximo, o contorno do alcance em volta de onde a ficha saiu. Tudo
 * em pontos de TELA. `reach` já vem com a forma da régua da cena (círculo na
 * euclidiana, quadrado no tabuleiro) — `lib/movementRules.ts#reachOutline`.
 */
export function drawPlayerTokenDrag(g: Graphics, start: Point, end: Point, reach: readonly Point[] | null): void {
  drawPlayerMeasure(g, start, end)
  const [first, ...rest] = reach ?? []
  if (first === undefined) return
  g.moveTo(first.x, first.y)
  for (const p of rest) g.lineTo(p.x, p.y)
  g.closePath()
  g.stroke({ width: SHADOW_WIDTH, color: SHADOW_COLOR, alpha: SHADOW_ALPHA })
  g.moveTo(first.x, first.y)
  for (const p of rest) g.lineTo(p.x, p.y)
  g.closePath()
  g.stroke({ width: LINE_WIDTH, color: LINE_COLOR, alpha: REACH_ALPHA })
}

/*
 * MODO BATALHA (B6): as ferramentas do jogador, com as cores do protótipo
 * aprovado (docs/design/batalha-ferramentas/prototipo.html): casas em latão
 * translúcido, traço de pergaminho, Visão em verde até a primeira parede que
 * ele conhece, X e o resto tracejado em brasa.
 */
const LATAO = 0xe0a44a
const LATAO_FUNDO_ALPHA = 0.4
const LATAO_BORDA = 0xa06822
const LATAO_BORDA_ALPHA = 0.85
const VERDE = 0x7fb48a
const BRASA = 0xe2645a
const TRACO_DO_TRACEJADO_PX = 5

/** As casas em espaço de tela: o canto de cima à esquerda e o lado (já com o zoom). */
export interface CasasNaTela {
  canto: (casa: Casa) => Point
  centro: (casa: Casa) => Point
  lado: number
}

function pintarCasas(g: Graphics, casas: readonly Casa[], tela: CasasNaTela, borda: boolean): void {
  if (casas.length === 0) return
  for (const casa of casas) {
    const p = tela.canto(casa)
    g.rect(p.x, p.y, tela.lado, tela.lado)
  }
  g.fill({ color: LATAO, alpha: LATAO_FUNDO_ALPHA })
  if (borda) g.stroke({ width: 1, color: LATAO_BORDA, alpha: LATAO_BORDA_ALPHA })
}

function tracejado(g: Graphics, de: Point, ate: Point, cor: number, largura: number, alpha: number): void {
  const dx = ate.x - de.x
  const dy = ate.y - de.y
  const comprimento = Math.hypot(dx, dy)
  if (comprimento === 0) return
  const passos = Math.max(1, Math.floor(comprimento / TRACO_DO_TRACEJADO_PX))
  for (let i = 0; i < passos; i += 2) {
    const t0 = i / passos
    const t1 = Math.min(1, (i + 1) / passos)
    g.moveTo(de.x + dx * t0, de.y + dy * t0).lineTo(de.x + dx * t1, de.y + dy * t1)
  }
  g.stroke({ width: largura, color: cor, alpha })
}

function linhaComVeu(g: Graphics, de: Point, ate: Point, cor: number, largura: number): void {
  g.moveTo(de.x, de.y).lineTo(ate.x, ate.y).stroke({ width: largura + 2, color: SHADOW_COLOR, alpha: SHADOW_ALPHA, cap: 'round' })
  g.moveTo(de.x, de.y).lineTo(ate.x, ate.y).stroke({ width: largura, color: cor, alpha: LINE_ALPHA, cap: 'round' })
}

function pontas(g: Graphics, inicio: Point, fim: Point | null): void {
  g.circle(inicio.x, inicio.y, START_DOT_RADIUS + 1).fill({ color: LINE_COLOR, alpha: LINE_ALPHA })
  if (fim !== null) g.circle(fim.x, fim.y, END_RING_RADIUS + 1.5).stroke({ width: 2, color: LINE_COLOR, alpha: LINE_ALPHA })
}

function marcarX(g: Graphics, p: Point, tamanho: number): void {
  for (const [cor, largura, alpha] of [
    [SHADOW_COLOR, 5, SHADOW_ALPHA],
    [BRASA, 2.5, 1],
  ] as const) {
    g.moveTo(p.x - tamanho, p.y - tamanho).lineTo(p.x + tamanho, p.y + tamanho)
    g.moveTo(p.x + tamanho, p.y - tamanho).lineTo(p.x - tamanho, p.y + tamanho)
    g.stroke({ width: largura, color: cor, alpha })
  }
}

/** Desenha uma medida de batalha (casas, traço e pontas) em espaço de TELA. `ponto`: px de mundo → px de tela. */
export function drawMedidaEmBatalha(g: Graphics, medida: MedidaCompartilhada, leitura: LeituraDaMedida, tela: CasasNaTela, ponto: (p: Point) => Point): void {
  g.clear()
  switch (medida.ferramenta) {
    case 'regua': {
      pintarCasas(g, leitura.casas, tela, true)
      const de = ponto(medida.de)
      const ate = ponto(medida.ate)
      linhaComVeu(g, de, ate, LINE_COLOR, 2)
      pontas(g, de, ate)
      return
    }
    case 'circulo': {
      pintarCasas(g, leitura.casas, tela, false)
      const primeira = leitura.casas[0]
      const ultima = leitura.casas[leitura.casas.length - 1]
      if (primeira !== undefined && ultima !== undefined) {
        const a = tela.canto(primeira)
        const b = tela.canto(ultima)
        g.rect(a.x + 1, a.y + 1, b.x - a.x + tela.lado - 2, b.y - a.y + tela.lado - 2).stroke({ width: 2, color: LATAO_BORDA, alpha: LATAO_BORDA_ALPHA })
      }
      pontas(g, tela.centro(medida.centro), null)
      return
    }
    case 'cone': {
      pintarCasas(g, leitura.casas, tela, true)
      const [ux, uy] = PASSO_DA_DIRECAO[medida.direcao]
      const centro = tela.centro(medida.origem)
      const saida = 0.5 / Math.max(Math.abs(ux), Math.abs(uy))
      const inicio = { x: centro.x + ux * saida * tela.lado, y: centro.y + uy * saida * tela.lado }
      const fim = { x: centro.x + ux * medida.comprimento * tela.lado, y: centro.y + uy * medida.comprimento * tela.lado }
      if (medida.comprimento > 0) tracejado(g, inicio, fim, LINE_COLOR, 1.5, LINE_ALPHA)
      const canto = tela.canto(medida.origem)
      g.rect(canto.x + 2, canto.y + 2, tela.lado - 4, tela.lado - 4).stroke({ width: 2, color: LINE_COLOR, alpha: LINE_ALPHA })
      return
    }
    case 'visao': {
      const de = tela.centro(medida.de)
      const para = tela.centro(medida.para)
      const visao = leitura.visao
      if (visao === null || visao.livre) {
        if (visao !== null) linhaComVeu(g, de, para, VERDE, 2.5)
      } else {
        const barrou = ponto(visao.ponto)
        linhaComVeu(g, de, barrou, VERDE, 2.5)
        tracejado(g, barrou, para, BRASA, 2, 0.8)
        marcarX(g, barrou, Math.max(5, tela.lado * 0.16))
      }
      pontas(g, de, para)
      return
    }
  }
}

/** Abaixo disto (px de tela por casa) o número do bloco não cabe na casa: a régua fica sem ele, como no protótipo. */
export const LADO_MINIMO_DO_NUMERO_PX = 22

/**
 * Os números dos blocos nas casas da régua. Text do Pixi criado uma vez e
 * reaproveitado (nunca destruído no meio da sessão: o Pixi 8.20 cai com Text
 * destruído antes do primeiro render, ver `pixi/drawLaser.ts`); os que sobram
 * só ficam escondidos.
 */
export function criarNumerosDasCasas(camada: Container) {
  const textos: Text[] = []
  return {
    mostrar(itens: readonly { readonly centro: Point; readonly numero: number }[]): void {
      itens.forEach((item, i) => {
        let texto = textos[i]
        if (texto === undefined) {
          texto = new Text({ text: '', style: { fontFamily: 'Bahnschrift, "Segoe UI", system-ui, sans-serif', fontSize: 11, fontWeight: '600', fill: LINE_COLOR, stroke: { color: 0x1c1608, width: 3 } } })
          texto.anchor.set(0.5)
          texto.eventMode = 'none'
          textos.push(texto)
          camada.addChild(texto)
        }
        const rotulo = String(item.numero)
        if (texto.text !== rotulo) texto.text = rotulo
        texto.position.set(Math.round(item.centro.x), Math.round(item.centro.y))
        texto.visible = true
      })
      for (let i = itens.length; i < textos.length; i += 1) {
        const sobra = textos[i]
        if (sobra !== undefined) sobra.visible = false
      }
    },
  }
}

/**
 * MODO BATALHA (B6): o arrasto da própria ficha mostra o caminho que a
 * prévia achou (casa a casa, dando a volta nas paredes que ele conhece), e
 * não a reta. Pontos de TELA, centros das casas.
 */
export function drawPlayerTokenDragCaminho(g: Graphics, caminho: readonly Point[]): void {
  g.clear()
  const [primeiro, ...resto] = caminho
  if (primeiro === undefined) return
  for (const [cor, largura, alpha] of [
    [SHADOW_COLOR, SHADOW_WIDTH + 1, SHADOW_ALPHA],
    [LATAO, 2, LINE_ALPHA],
  ] as const) {
    g.moveTo(primeiro.x, primeiro.y)
    for (const p of resto) g.lineTo(p.x, p.y)
    g.stroke({ width: largura, color: cor, alpha, cap: 'round', join: 'round' })
  }
  for (const p of resto) g.circle(p.x, p.y, 2.5).fill({ color: LATAO, alpha: LINE_ALPHA })
  g.circle(primeiro.x, primeiro.y, START_DOT_RADIUS).fill({ color: LINE_COLOR, alpha: LINE_ALPHA })
}

/** MODO BATALHA (B6): o caminho andado de uma ficha, em pontos de TELA (centros das casas), por trecho contínuo. */
export interface TrilhaNaTela {
  readonly trechos: readonly (readonly Point[])[]
  /** A cor da ficha do colega; `null` = a ficha dele, em latão. */
  readonly cor: number | null
}

/** O caminho do colega mais apagado: é contexto, não a jogada dele. */
const ALPHA_DO_COLEGA = 0.75
const LARGURA_DO_CAMINHO = 2

/**
 * MODO BATALHA (B6): o caminho andado, como no protótipo aprovado — traço de
 * 2 px com véu escuro por baixo; o do colega na cor dele, mais apagado; o dele
 * em latão, por cima (os números dos blocos vêm de `criarNumerosDasCasas`).
 */
export function drawCaminhosAndados(g: Graphics, trilhas: readonly TrilhaNaTela[]): void {
  g.clear()
  const ordem = [...trilhas.filter((t) => t.cor !== null), ...trilhas.filter((t) => t.cor === null)]
  for (const trilha of ordem) {
    const cor = trilha.cor ?? LATAO
    const alpha = trilha.cor === null ? LINE_ALPHA : ALPHA_DO_COLEGA
    for (const trecho of trilha.trechos) {
      const [primeiro, ...resto] = trecho
      if (primeiro === undefined || resto.length === 0) continue
      for (const [tinta, largura, opacidade] of [
        [SHADOW_COLOR, LARGURA_DO_CAMINHO + 2, SHADOW_ALPHA * alpha],
        [cor, LARGURA_DO_CAMINHO, alpha],
      ] as const) {
        g.moveTo(primeiro.x, primeiro.y)
        for (const p of resto) g.lineTo(p.x, p.y)
        g.stroke({ width: largura, color: tinta, alpha: opacidade, cap: 'round', join: 'round' })
      }
    }
  }
}
