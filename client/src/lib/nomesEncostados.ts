/**
 * NOMES ENCOSTADOS (achado V6 de 12/11/2026; caça 12/11, P32): fichas no
 * mesmo lugar tinham os nomes um por cima do outro ("VinceNav"). Uma regra
 * só, usada pelo editor (`pixi/tokensRenderer.ts`) e pela janela do jogador
 * (`player/PlayerView.tsx`): cada nome desce o menor número de linhas que o
 * tira de cima dos nomes que já ficaram. O da ficha MAIOR fica no lugar (mesmo
 * tamanho: o da que vem antes na lista); com três ou mais fichas empilhadas,
 * cada nome ganha uma linha própria, sem dois na mesma.
 *
 * A caixa do nome é ESTIMADA pelas letras, sem medir o texto (medir pede o
 * canvas do texto a cada passo do arrasto): a largura média de uma letra e a
 * altura da linha, em fração da fonte. Pouco a mais só faz um nome descer
 * quando os dois quase se tocam.
 */

const LARGURA_MEDIA_DA_LETRA = 0.6
const ALTURA_DA_LINHA_DO_NOME = 1.25

/** O nome de uma ficha à vista, no mundo. */
export interface NomeNoMapa {
  /** O meio do nome em x (o x da ficha). */
  readonly x: number
  /** O topo do nome em y, sem desvio nenhum. */
  readonly topo: number
  /** A linha mais comprida do bloco (o nome, ou o do companheiro embaixo dele): dá a largura. */
  readonly texto: string
  /** A fonte do nome em px de mundo, já com a escala do texto (o nome tem tamanho fixo na tela). */
  readonly fonte: number
  /** Quantas linhas o bloco do nome ocupa (o nome e, embaixo, o do companheiro). Ausente = 1. */
  readonly linhas?: number
  /** O tamanho da ficha: a maior fica no lugar. */
  readonly tamanho: number
}

interface Caixa {
  readonly x0: number
  readonly x1: number
  readonly y0: number
  readonly altura: number
}

function caixaDoNome(nome: NomeNoMapa): Caixa {
  const meiaLargura = (nome.texto.length * nome.fonte * LARGURA_MEDIA_DA_LETRA) / 2
  return { x0: nome.x - meiaLargura, x1: nome.x + meiaLargura, y0: nome.topo, altura: nome.fonte * ALTURA_DA_LINHA_DO_NOME * (nome.linhas ?? 1) }
}

/** Os índices dos nomes que se cruzam em x com cada um (varre pela beira esquerda). */
function vizinhosEmX(caixas: readonly Caixa[]): number[][] {
  const vizinhos = caixas.map((): number[] => [])
  const porX = caixas.map((_, i) => i).sort((a, b) => caixas[a].x0 - caixas[b].x0)
  for (let i = 0; i < porX.length; i += 1) {
    const a = porX[i]
    for (let j = i + 1; j < porX.length && caixas[porX[j]].x0 < caixas[a].x1; j += 1) {
      vizinhos[a].push(porX[j])
      vizinhos[porX[j]].push(a)
    }
  }
  return vizinhos
}

/**
 * Quanto cada nome desce, em px de mundo, na ordem da entrada: um múltiplo da
 * altura do próprio bloco; 0 = fica onde está. A ordem da entrada é a ordem de
 * desenho: no empate de tamanho, desce o nome da ficha que vem depois.
 */
export function descidaDosNomes(nomes: readonly NomeNoMapa[]): number[] {
  const caixas = nomes.map(caixaDoNome)
  return linhasQueOsNomesDescem(caixas, nomes).map((linhas, i) => linhas * caixas[i].altura)
}

/** Quantas linhas (da altura do próprio bloco) cada nome desce. */
function linhasQueOsNomesDescem(caixas: readonly Caixa[], nomes: readonly NomeNoMapa[]): number[] {
  const vizinhos = vizinhosEmX(caixas)
  const descidas = nomes.map(() => 0)
  const ficou = nomes.map(() => false)
  const prioridade = nomes.map((_, i) => i).sort((a, b) => nomes[b].tamanho - nomes[a].tamanho || a - b)
  for (const i of prioridade) {
    const c = caixas[i]
    ficou[i] = true
    if (!(c.altura > 0)) continue
    // Cada nome que já ficou barra um trecho de y: descendo de linha em linha, ele barra no máximo
    // (a altura dele / a deste, arredondada para cima) + 1 posições. Passado o teto, nada mais cruza.
    const teto = vizinhos[i].reduce((soma, j) => soma + Math.ceil(caixas[j].altura / c.altura) + 1, 0)
    for (let tentativa = 0; tentativa <= teto; tentativa += 1) {
      const y0 = c.y0 + descidas[i] * c.altura
      const cruza = vizinhos[i].some((j) => {
        if (!ficou[j] || j === i) return false
        const outro = caixas[j]
        const outroY0 = outro.y0 + descidas[j] * outro.altura
        return y0 < outroY0 + outro.altura && outroY0 < y0 + c.altura
      })
      if (!cruza) break
      descidas[i] += 1
    }
  }
  return descidas
}
