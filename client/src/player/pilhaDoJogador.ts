/**
 * A PILHA DE CAMADAS da tela do jogador (fatia 4 de `docs/planos/camadas-fase3-2026-10-22.md`,
 * "Ordem e render"). A mesma pilha do editor (`pixi/pilhaDeCamadas.ts`) sobre
 * `FAIXAS_JOGADOR`, que tem DUAS ZONAS FIXAS: a planta sob a névoa e, por
 * cima dela, luz de longe, telhados, porta no telhado, pílulas, marcas, pinos
 * e fichas. `ordemDeRender` ordena cada zona sozinha: reordenar a lista só
 * permuta dentro da zona, e as faixas da névoa (fixas) nunca saem do lugar.
 *
 * O modelo e as opacidades vêm de `camadasDoJogador` (o host manda só ids e
 * alfa, já sem o que o jogador não vê); ausente = a ordem padrão, tudo a 100%:
 * um nó de hoje por faixa, na ordem de hoje, e nada repinta.
 *
 * Itens que dividem por nó aqui: traço das paredes (`walls`), móveis
 * (silhueta, chama, imagem e rótulo), escadas e desenhos. O resto (retângulo
 * da porta e o halo, linhas e marcadores do chão, luzes, fichas, pinos, salas,
 * chão, carimbos, telhados) com camada escolhida fica no container de hoje,
 * como no editor antes da fatia 3b: ordem e opacidade da camada nativa.
 */
import type { CamadaId, Drawing, MapData, Prop, Stair, Wall } from '../types/map'
import { contextoDoJogador, modeloDoJogador } from '../lib/camadas/doJogador'
import { FAIXAS_JOGADOR, type ParDeFaixa } from '../lib/camadas/ordem'
import { desenhoFicaSobAsSalas } from '../lib/desenhoSobAsSalas'
import { criarPilha, paresDosItens, type EntradaDaPilha, type NoDaFaixa, type NoPlanejado, type PaiDaPilha, type Pilha } from '../pixi/pilhaDeCamadas'

/** As faixas dos móveis: a mesma partição nas quatro (silhueta, chama, imagem, rótulo). */
export const FAIXAS_DOS_MOVEIS = ['props', 'chamasCamada', 'propImages', 'propLabels'] as const

export interface OpcoesDaPilhaDoJogador<N> {
  readonly pai: PaiDaPilha<N>
  readonly base: (faixa: string) => N
  readonly criar: (plano: NoPlanejado) => N
  readonly descartar: (no: N, plano: NoPlanejado) => void
  readonly lerAlfa: (no: N) => number
  readonly definirAlfa: (no: N, alfa: number) => void
}

/** Nenhuma faixa do jogador tem opacidade própria antes da camada (o esmaecido do secreto e o "Transparente" são do mestre). */
const SEM_ALFA_PROPRIO = (): number => 1

export function criarPilhaDoJogador<N>(opcoes: OpcoesDaPilhaDoJogador<N>): Pilha<N> {
  return criarPilha({ ...opcoes, faixas: FAIXAS_JOGADOR, alfaProprio: SEM_ALFA_PROPRIO })
}

/** O que decide a pilha do jogador: a lista dele, as opacidades dela e os pares com itens. */
export function entradaDoJogador(map: Pick<MapData, 'camadasDoJogador'>, pares: readonly ParDeFaixa[]): EntradaDaPilha {
  return { modelo: modeloDoJogador(map), alfa: contextoDoJogador(map).alfa, pares }
}

/**
 * Os pares (faixa, camada) com itens das faixas que dividem por nó. Memorizados
 * pela referência de cada lista e da lista de camadas (o patch mantém a mesma
 * quando não muda): o passo da ficha não recalcula nada.
 */
export function criarParesDoJogador(): (map: Pick<MapData, 'camadasDoJogador' | 'walls' | 'props' | 'stairs' | 'drawings'>) => ParDeFaixa[] {
  const memo = new WeakMap<readonly object[], { camadas: MapData['camadasDoJogador']; pares: ParDeFaixa[] }>()
  const daLista = (lista: readonly object[], camadas: MapData['camadasDoJogador'], calcular: () => ParDeFaixa[]): ParDeFaixa[] => {
    const pronto = memo.get(lista)
    if (pronto !== undefined && pronto.camadas === camadas) return pronto.pares
    const pares = calcular()
    memo.set(lista, { camadas, pares })
    return pares
  }
  return (map) => {
    const camadas = contextoDoJogador(map)
    const deObjeto = (p: Prop): CamadaId => camadas.camadaDe('objeto', p)
    const deDesenho = (d: Drawing): CamadaId => camadas.camadaDe('desenho', d)
    return [
      // `drawWalls` recebe toda parede, com porta ou sem: Paredes e Portas dividem a faixa `walls`.
      ...daLista(map.walls, map.camadasDoJogador, () => paresDosItens('walls', map.walls, (w: Wall) => camadas.camadaDe('parede', w))),
      ...daLista(map.props, map.camadasDoJogador, () => FAIXAS_DOS_MOVEIS.flatMap((faixa) => paresDosItens(faixa, map.props, deObjeto))),
      ...daLista(map.stairs, map.camadasDoJogador, () => paresDosItens('stairs', map.stairs, (s: Stair) => camadas.camadaDe('escada', s))),
      ...daLista(map.drawings, map.camadasDoJogador, () => {
        // O Texto tem renderer próprio (`textLabels`): `drawDrawings` o pula.
        const tracos = map.drawings.filter((d) => d.kind !== 'text')
        return [
          ...paresDosItens('drawings', tracos.filter(desenhoFicaSobAsSalas), deDesenho),
          ...paresDosItens('paths', tracos.filter((d) => !desenhoFicaSobAsSalas(d)), deDesenho),
        ]
      }),
    ]
  }
}

/**
 * Imagem e rótulo do móvel saem do MESMO renderer: o nó de imagem e o de
 * rótulo de cada camada andam em par. As duas faixas recebem os mesmos pares,
 * então têm os mesmos nós; se um dia não tiverem, tudo vai para os de hoje.
 */
export function nosEmPar<N>(imagens: readonly NoDaFaixa<N>[], rotulos: readonly NoDaFaixa<N>[]): { imagem: NoDaFaixa<N>; rotulo: NoDaFaixa<N> }[] {
  const mesmos = imagens.length === rotulos.length && imagens.every((n, i) => n.camadas.join('+') === rotulos[i].camadas.join('+'))
  if (mesmos) return imagens.map((imagem, i) => ({ imagem, rotulo: rotulos[i] }))
  const imagem = imagens.find((n) => n.base) ?? imagens[0]
  const rotulo = rotulos.find((n) => n.base) ?? rotulos[0]
  return [{ imagem: { ...imagem, camadas: [] }, rotulo: { ...rotulo, camadas: [] } }]
}
