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
 * (silhueta, chama, imagem e rótulo), escadas, desenhos e, desde a fatia 4b,
 * a porta (retângulo, halo e a cópia por cima do telhado), linhas e
 * marcadores do chão, luzes (perto e de longe), fichas e pinos. O resto
 * (salas, chão, carimbos, telhados, texto e o contorno "visto por último") com
 * camada escolhida fica no container de hoje: ordem e opacidade da camada
 * nativa (fixado como "LIMITACAO ATUAL" em `pilhaDoJogador.test.ts`).
 */
import type { CamadaId, Drawing, Light, MapData, Pin, Prop, Stair, Wall } from '../types/map'
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

/** As faixas da porta no jogador: o retângulo, o halo de alcance e a cópia por cima do telhado. */
const FAIXAS_DAS_PORTAS = ['doors', 'doorHints', 'portasNoTelhado'] as const

/** As faixas da luz no jogador: o halo e o ponto aceso de longe. */
const FAIXAS_DAS_LUZES = ['lights', 'farLights'] as const

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
export function criarParesDoJogador(): (
  map: Pick<MapData, 'camadasDoJogador' | 'walls' | 'props' | 'stairs' | 'drawings' | 'tokens' | 'pins' | 'lights' | 'lines' | 'markers'>,
) => ParDeFaixa[] {
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
      ...daLista(map.walls, map.camadasDoJogador, () => {
        const deParede = (w: Wall): CamadaId => camadas.camadaDe('parede', w)
        const portas = map.walls.filter((w) => w.door !== null)
        // `drawWalls` recebe toda parede, com porta ou sem: Paredes e Portas dividem a faixa `walls`.
        return [...paresDosItens('walls', map.walls, deParede), ...FAIXAS_DAS_PORTAS.flatMap((faixa) => paresDosItens(faixa, portas, deParede))]
      }),
      ...daLista(map.tokens, map.camadasDoJogador, () => paresDosItens('tokens', map.tokens, (t) => camadas.camadaDe('ficha', t))),
      // O pacote de um host antigo pode vir sem pinos (a tela lê `map.pins ?? []`).
      ...(map.pins === undefined ? [] : daLista(map.pins, map.camadasDoJogador, () => paresDosItens('pins', map.pins, (p: Pin) => camadas.camadaDe('pino', p)))),
      ...daLista(map.lights, map.camadasDoJogador, () => FAIXAS_DAS_LUZES.flatMap((faixa) => paresDosItens(faixa, map.lights, (l: Light) => camadas.camadaDe('luz', l)))),
      ...daLista(map.lines, map.camadasDoJogador, () => paresDosItens('mapLines', map.lines, (l) => camadas.camadaDe('linha', l))),
      ...daLista(map.markers, map.camadasDoJogador, () => paresDosItens('mapLines', map.markers, (m) => camadas.camadaDe('marcador', m))),
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
