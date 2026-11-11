import type { MaterialDaParede } from '../../types/map'

/**
 * O CATÁLOGO DOS MATERIAIS DA PAREDE (pedido de 07/11/2026) e o LUGAR ÚNICO das
 * imagens deles: `texturas/paredes/imagens/<material>.png`. Material novo é uma
 * linha no catálogo abaixo e um PNG com o id dele.
 *
 * A PAREDE EM PEÇAS (pedido de 10/11/2026: "parece mais chão do que uma parede"):
 * a imagem deixou de ser um desenho de fachada esticado na tira. Agora o app
 * monta a parede vista de cima peça por peça (`pixi/paredeEmPecas.ts`: blocos em
 * fiadas ao longo da parede, pilar no canto, tampa na ponta, luz e sombra na
 * direção do mapa) e a imagem é a FOLHA DE PEÇAS do material: só a matéria de
 * cada peça e as cores dele. A RECEITA de cada material (quantas fiadas, o
 * tamanho do bloco, a junta, o bisel) mora aqui, no catálogo.
 *
 * O formato da folha (`FORMATO_DA_IMAGEM`), PNG de 512 x 512 px com alfa, 1 texel
 * = 1 px do mundo a 64 px por casa:
 *  - 7 FAIXAS de tom de 40 px (linhas 0 a 279): a face de um bloco é uma janela
 *    numa faixa; o x repete (a janela começa em qualquer x);
 *  - 12 TAMPAS de 40 x 40 (linhas 280 a 319): a peça do canto e da ponta (laje,
 *    pilar, esteio, mourão, chapa);
 *  - RAMPAS de 64 px (linhas 320 a 383): cor fixa com o alfa de 0 (em cima) a 1
 *    (embaixo), para a luz, o escuro do bisel, a sombra no chão e os detalhes;
 *  - CORES chapadas (linhas 384 a 447): contorno, junta, detalhe claro e escuro;
 *  - PONTOS (linhas 448 a 511): disco de borda macia (prego, rebite).
 * O gerador (Python, determinístico) fica no estúdio, como o das texturas de
 * 07/11: `jogos/texturas-labirinto/prova/paredes/gerar_paredes_v2.py`.
 *
 * As imagens vão dentro do app pelo Vite (arquivo próprio em `assets/` com hash
 * no nome), como as do Desenhado: o jogador as recebe pela mesma rota.
 */
export const FORMATO_DA_IMAGEM = {
  /** Lado da folha em texels. */
  lado: 512,
  /** A casa em que 1 texel vale 1 px do mundo; noutra grade a peça escala junto. */
  casa: 64,
  /** Altura de uma faixa de tom e lado de uma tampa, em texels. */
  faixa: 40,
  faixas: 7,
  /** A sobra de cada lado da faixa: a face usa no máximo o miolo (`faixa - 2 * sobra`). */
  sobraDaFaixa: 4,
  tampasY: 280,
  tampas: 12,
  /** As células de 64 px das rampas, das cores e dos pontos. */
  cela: 64,
  rampasY: 320,
  /** Dentro da célula da rampa, o alfa vai de 0 (nesta linha) a 1 (em `rampaFim`). */
  rampaInicio: 8,
  rampaFim: 56,
  coresY: 384,
  pontosY: 448,
} as const

/** As colunas das rampas (alfa de 0 a 1 numa cor fixa). */
export const RAMPA = { luz: 0, bisel: 1, sombra: 2, junta: 3, claro: 4, escuro: 5, contorno: 6 } as const
/** As colunas das cores chapadas. */
export const COR = { contorno: 0, junta: 1, claro: 2, escuro: 3 } as const
/** As colunas dos pontos (discos). */
export const PONTO = { claro: 0, escuro: 1, luz: 2 } as const

/** O enfeite por cima dos blocos: nenhum, pregos na ponta da tábua, rebites na chapa, nós e amarras no bambu, barbante no feixe. */
export type DetalheDaParede = 'nenhum' | 'pregos' | 'rebites' | 'amarras' | 'barbante'

/** Como a parede do material é montada. Medidas em px do mundo a 64 px por casa. */
export interface ReceitaDaParede {
  /** A espessura a partir da qual entra mais uma fiada: `[15, 44]` = 1 até 15 px, 2 até 44, 3 acima. */
  readonly fiadasAte: readonly number[]
  /** O comprimento médio do bloco: a fundura da fiada vezes isto, dentro de `[min, max]`. */
  readonly passo: { readonly porFundura: number; readonly min: number; readonly max: number }
  /** Quanto a junta sai do lugar (fração do passo, até 0,4: acima disso a amarração entre fiadas se perde). */
  readonly varia: number
  /** A chance de uma junta sumir e os dois blocos virarem um mais comprido. */
  readonly funde: number
  /** A largura da junta entre as peças. */
  readonly junta: number
  /** Quanto a pedra irregular come da junta, peça a peça (0 = aparelhada). */
  readonly tremor: number
  /** A largura do bisel e a força da luz e do escuro nele (0 a 1). */
  readonly bisel: number
  readonly luz: number
  readonly sombra: number
  /** `reta`: a face é a matéria na escala do mundo. `rolica`: a faixa inteira atravessa a peça (colmo, feixe). */
  readonly face: 'reta' | 'rolica'
  /** A tampa (canto e ponta) leva bisel nas arestas? A redonda (mourão, feixe) não. */
  readonly tampaComBisel: boolean
  readonly detalhe: DetalheDaParede
}

export interface MaterialDoCatalogo {
  readonly id: MaterialDaParede
  readonly nome: string
  readonly descricao: string
  readonly receita: ReceitaDaParede
}

/** A ordem é a da tela: o castelo primeiro (o pedido do usuário), as pedras, o barro, as fibras, o metal. */
export const MATERIAIS_DA_PAREDE: readonly MaterialDoCatalogo[] = [
  {
    id: 'castelo',
    nome: 'Castelo',
    descricao: 'Pedra aparelhada em fiadas, com pilar nos cantos.',
    receita: { fiadasAte: [15, 44], passo: { porFundura: 2.2, min: 16, max: 40 }, varia: 0.4, funde: 0.2, junta: 1.4, tremor: 0, bisel: 2.2, luz: 0.46, sombra: 0.4, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
  },
  {
    id: 'pedra-rustica',
    nome: 'Pedra rústica',
    descricao: 'Pedras irregulares, fenda escura entre elas.',
    receita: { fiadasAte: [15, 36], passo: { porFundura: 1.5, min: 11, max: 30 }, varia: 0.4, funde: 0.12, junta: 1.6, tremor: 1.7, bisel: 2.4, luz: 0.4, sombra: 0.44, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
  },
  {
    id: 'tijolo',
    nome: 'Tijolo',
    descricao: 'Tijolos de barro em fiadas amarradas, pilar de pedra nos cantos.',
    receita: { fiadasAte: [15, 27, 44], passo: { porFundura: 2.05, min: 14, max: 26 }, varia: 0.16, funde: 0, junta: 1.2, tremor: 0, bisel: 1.4, luz: 0.32, sombra: 0.34, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
  },
  {
    id: 'madeira',
    nome: 'Madeira',
    descricao: 'Tábuas ao longo da parede, com emendas, pregos e esteio nos cantos.',
    receita: { fiadasAte: [15, 27], passo: { porFundura: 0, min: 118, max: 118 }, varia: 0.4, funde: 0.25, junta: 0.9, tremor: 0, bisel: 1.2, luz: 0.3, sombra: 0.32, face: 'reta', tampaComBisel: true, detalhe: 'pregos' },
  },
  {
    id: 'bambu',
    nome: 'Bambu',
    descricao: 'Colmos de bambu deitados lado a lado, com os nós e as amarras.',
    receita: { fiadasAte: [9, 15, 23, 29], passo: { porFundura: 0, min: 42, max: 42 }, varia: 0.4, funde: 0.1, junta: 1, tremor: 0, bisel: 0, luz: 0.22, sombra: 0.26, face: 'rolica', tampaComBisel: false, detalhe: 'amarras' },
  },
  {
    id: 'palha',
    nome: 'Palha',
    descricao: 'Feixes de palha amarrados com barbante.',
    receita: { fiadasAte: [15, 36], passo: { porFundura: 0, min: 40, max: 40 }, varia: 0.3, funde: 0, junta: 1.2, tremor: 0, bisel: 0, luz: 0.16, sombra: 0.22, face: 'rolica', tampaComBisel: false, detalhe: 'barbante' },
  },
  {
    id: 'ferro',
    nome: 'Ferro',
    descricao: 'Chapas de ferro rebitadas.',
    receita: { fiadasAte: [], passo: { porFundura: 0, min: 78, max: 78 }, varia: 0.35, funde: 0.15, junta: 1, tremor: 0, bisel: 1.3, luz: 0.4, sombra: 0.46, face: 'reta', tampaComBisel: true, detalhe: 'rebites' },
  },
]

/** O material que a ferramenta lembra antes de qualquer escolha. */
export const MATERIAL_PADRAO: MaterialDaParede = 'castelo'

const POR_ID = new Map<string, MaterialDoCatalogo>(MATERIAIS_DA_PAREDE.map((m) => [m.id, m]))

/** Texto do map.json (editado à mão, versão nova com material que esta não conhece) é material do catálogo? */
export function ehMaterialDaParede(valor: unknown): valor is MaterialDaParede {
  return typeof valor === 'string' && POR_ID.has(valor)
}

export function materialDoCatalogo(material: MaterialDaParede): MaterialDoCatalogo {
  return POR_ID.get(material) ?? MATERIAIS_DA_PAREDE[0]
}
