import { Graphics } from 'pixi.js'
import type { Prop, RegionPoint } from '../types/map'
import { rotationToRadians } from '../lib/itemTransform'
import { desenharSeloDoObjeto, SELO_DO_OBJETO_MEIA_DIAGONAL } from './drawPins'

/*
 * O SELO DO OBJETO QUE ABRE na tela do jogador (pedido de 16/11/2026: "tem que
 * ter um indicativo que dá para fazer o minigame"). Baú, caixa e barril com o
 * minigame ligado e ainda fechados chegam no recorte com `abrivel: 'fechado'`
 * (`lib/conteudoDoObjeto.ts`); o selo vai em cima deles, mas só onde o jogador
 * enxerga AGORA: o objeto lembrado na névoa pode ter sido aberto por outro e
 * o selo mentiria. Aberto, o recorte troca para `'aberto'` e o selo some.
 */

/** Quanto da meia diagonal desce sobre o objeto (o quarto de baixo do losango): o selo lê como "deste objeto". */
const FRACAO_SOBRE_O_OBJETO = 0.5

export interface SeloDoObjeto {
  id: string
  x: number
  y: number
}

/** O ponto está dentro de algum anel da visão (par-ímpar em cada anel, como a máscara pinta). */
function naVisao(ponto: { x: number; y: number }, visao: readonly (readonly RegionPoint[])[]): boolean {
  return visao.some((anel) => {
    if (anel.length < 3) return false
    let dentro = false
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
      const a = anel[i]
      const b = anel[j]
      if (a.y > ponto.y !== b.y > ponto.y && ponto.x < ((b.x - a.x) * (ponto.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro
    }
    return dentro
  })
}

/**
 * Onde vai cada selo: os objetos fechados que se abrem, com o meio na visão de
 * agora, o selo logo acima da borda de cima (girada) do objeto. `k` é o fator
 * de tela dos pinos (`pinSizeScale`): de longe o selo não vira um ponto.
 */
export function selosDosObjetos(props: readonly Prop[], visao: readonly (readonly RegionPoint[])[], k: number): SeloDoObjeto[] {
  const selos: SeloDoObjeto[] = []
  for (const prop of props) {
    if (prop.abrivel !== 'fechado' || !naVisao(prop, visao)) continue
    const angulo = rotationToRadians(prop.rotation)
    const meiaAltura = (Math.abs(prop.width * Math.sin(angulo)) + Math.abs(prop.height * Math.cos(angulo))) / 2
    const meiaDiagonal = SELO_DO_OBJETO_MEIA_DIAGONAL * k
    selos.push({ id: prop.id, x: prop.x, y: prop.y - meiaAltura - meiaDiagonal * (1 - FRACAO_SOBRE_O_OBJETO) })
  }
  return selos
}

export interface SelosDosObjetos {
  /** O desenho de todos os selos, num `Graphics` só (posto pela tela na faixa dos pinos). */
  camada: Graphics
  /** Repinta só se mudou o que se vê (lista e tamanho); devolve quantos selos há na tela. */
  desenhar: (selos: readonly SeloDoObjeto[], k: number) => number
}

export function criarSelosDosObjetos(): SelosDosObjetos {
  const camada = new Graphics()
  camada.label = 'selos-dos-objetos'
  // O toque no objeto é por conta (`objetoAbrivelAtScreen`); o selo não pega o ponteiro.
  camada.eventMode = 'none'
  let ultimaChave = ''
  return {
    camada,
    desenhar(selos, k) {
      const chave = `${k}|${selos.map((selo) => `${selo.id}:${selo.x}:${selo.y}`).join(';')}`
      if (chave === ultimaChave) return selos.length
      ultimaChave = chave
      camada.clear()
      for (const selo of selos) desenharSeloDoObjeto(camada, selo.x, selo.y, k)
      return selos.length
    },
  }
}
