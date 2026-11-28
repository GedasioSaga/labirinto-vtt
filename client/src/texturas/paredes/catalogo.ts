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

/**
 * A ordem é a da tela: o castelo primeiro (o pedido do usuário), as pedras, o barro, as madeiras (a nova, a velha e
 * os troncos), as fibras, o metal e, no fim, a base militar (concreto e sacos de areia). As quatro de 14/11/2026 (a
 * pedra com musgo, a madeira velha, os troncos e as duas da base militar) são do pedido "texturas novas de madeira,
 * pedra, base militar". As três do lote L3 das referências de 15/11/2026 (o mármore preto, a rocha de caverna e o
 * azulejo de hospital) entram no FIM, e não junto das pedras e do barro: a posição do material na lista entra na
 * semente das juntas (`pixi/paredeEmPecas.ts`, `topoDoTrecho`), e um material no meio mudaria os blocos de toda
 * parede já desenhada dos que vêm depois dele.
 */
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
  // A Pedra com musgo (14/11/2026) parte da Pedra rústica: a laje é mais chata, a pedra um pouco maior e menos torta.
  {
    id: 'pedra-musgo',
    nome: 'Pedra com musgo',
    descricao: 'Pedras cinza e frias, com musgo nas juntas e em manchas no topo.',
    receita: { fiadasAte: [15, 36], passo: { porFundura: 1.7, min: 13, max: 34 }, varia: 0.4, funde: 0.15, junta: 1.8, tremor: 1.3, bisel: 2.2, luz: 0.38, sombra: 0.42, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
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
  // A Madeira velha (14/11/2026, a parede do chão `madeira-gasta`) parte da Madeira: as mesmas tábuas com pregos e o
  // esteio serrado no canto, a tábua um pouco mais curta e mais desencontrada (a parede remendada de celeiro e ruína).
  {
    id: 'madeira-gasta',
    nome: 'Madeira velha',
    descricao: 'Tábuas acinzentadas pelo tempo, com rachas, nós escuros e uma ou outra úmida.',
    receita: { fiadasAte: [15, 27], passo: { porFundura: 0, min: 96, max: 96 }, varia: 0.4, funde: 0.2, junta: 1, tremor: 0, bisel: 1.2, luz: 0.28, sombra: 0.32, face: 'reta', tampaComBisel: true, detalhe: 'pregos' },
  },
  // Os Troncos (14/11/2026, a parede do chão `troncos`): a cabana de TRONCOS DEITADOS, vista de cima. Roliça como o
  // bambu, mas um tronco só na grossura toda, comprido e emendado de ponta a ponta; na ponta e no canto, a tampa é o
  // topo serrado (o corte com os anéis e o anel de casca), sem bisel. A paliçada em pé lia como lajota sem um detalhe
  // novo na montagem, e detalhe novo não entra (briefing do integrador de texturas).
  {
    id: 'troncos',
    nome: 'Troncos',
    descricao: 'Troncos deitados com casca, a ponta serrada à mostra nos cantos.',
    receita: { fiadasAte: [], passo: { porFundura: 0, min: 170, max: 250 }, varia: 0.25, funde: 0.1, junta: 1.2, tremor: 0, bisel: 0, luz: 0.3, sombra: 0.36, face: 'rolica', tampaComBisel: false, detalhe: 'nenhum' },
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
  // O Concreto (14/11/2026) parte do Ferro: uma fiada de painéis compridos, sem enfeite por cima.
  {
    id: 'concreto',
    nome: 'Concreto',
    descricao: 'Painéis de concreto moldado, junta fina e pilar de concreto nos cantos.',
    receita: { fiadasAte: [], passo: { porFundura: 0, min: 72, max: 72 }, varia: 0.2, funde: 0.1, junta: 1, tremor: 0, bisel: 1.2, luz: 0.32, sombra: 0.38, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
  },
  // Os Sacos de areia (14/11/2026) partem da Palha (face roliça, sem bisel), com um pouco de tremor porque o saco não
  // assenta reto; o amarrado das pontas é o barbante, o detalhe mais parecido que existe.
  {
    id: 'sacos-de-areia',
    nome: 'Sacos de areia',
    descricao: 'Sacos de juta cor de areia empilhados em fiadas desencontradas, amarrados nas pontas.',
    receita: { fiadasAte: [15, 36], passo: { porFundura: 0, min: 32, max: 32 }, varia: 0.3, funde: 0, junta: 1.4, tremor: 1, bisel: 0, luz: 0.2, sombra: 0.26, face: 'rolica', tampaComBisel: false, detalhe: 'barbante' },
  },
  // O Mármore preto (lote L3, 15/11/2026) parte do Castelo: blocos aparelhados, o bloco um pouco mais comprido (o
  // mármore é serrado em placa), a junta fina e o bisel curto e brilhante da pedra polida.
  {
    id: 'marmore-preto',
    nome: 'Mármore preto',
    descricao: 'Blocos de mármore negro polido, com veios claros e junta fina.',
    receita: { fiadasAte: [15, 44], passo: { porFundura: 2.4, min: 18, max: 44 }, varia: 0.35, funde: 0.15, junta: 1, tremor: 0, bisel: 1.4, luz: 0.42, sombra: 0.3, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
  },
  // A Rocha de caverna (lote L3, 15/11/2026, a parede do chão `rocha-de-caverna`) parte da Pedra rústica, mas em
  // massas maiores: menos fiadas, a pedra mais comprida e mais fundida com a vizinha, torta, e a luz mais fraca da
  // rocha escura. Com a pedra menor e a fenda mais larga (a primeira folha, 16/11/2026) a parede lia como cascalho
  // assentado, não como rocha.
  {
    id: 'rocha-de-caverna',
    nome: 'Rocha de caverna',
    descricao: 'Rocha bruta e escura, em massas tortas com fendas fundas entre elas.',
    receita: { fiadasAte: [18, 44], passo: { porFundura: 2, min: 16, max: 44 }, varia: 0.4, funde: 0.3, junta: 1.6, tremor: 1.8, bisel: 2.6, luz: 0.3, sombra: 0.5, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
  },
  // O Azulejo de hospital (lote L3, 15/11/2026): azulejo de metro, peças pequenas de 2 por 1 em fiadas desencontradas
  // (como o Bambu, até cinco fiadas na parede grossa), junta fina e reta, sem tremor, e o vidrado que brilha no bisel.
  {
    id: 'azulejo-de-hospital',
    nome: 'Azulejo de hospital',
    descricao: 'Azulejos verde-claros e gastos, com rejunte branco.',
    receita: { fiadasAte: [9, 17, 26, 35], passo: { porFundura: 2, min: 12, max: 22 }, varia: 0.03, funde: 0, junta: 1, tremor: 0, bisel: 0.9, luz: 0.5, sombra: 0.3, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
  },
  // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md). Os três no fim, na ordem da lista.
  {
    id: 'tijolo-com-chapas',
    nome: 'Tijolo com chapas',
    descricao: 'Tijolo cor de vinho encardido, com chapa de ferro aparafusada nas quinas e nas pontas e cinta de ferro atravessando a parede.',
    receita: { fiadasAte: [15, 27, 44], passo: { porFundura: 2.05, min: 14, max: 26 }, varia: 0.16, funde: 0, junta: 1.2, tremor: 0, bisel: 1.4, luz: 0.3, sombra: 0.36, face: 'reta', tampaComBisel: true, detalhe: 'amarras' },
  },
  {
    id: 'tabuas-remendadas',
    nome: 'Tábuas remendadas',
    descricao: 'Tábuas de reaproveitamento, cada uma de uma cor e largura, com remendos e pregos à vista.',
    receita: { fiadasAte: [15, 27], passo: { porFundura: 0, min: 64, max: 64 }, varia: 0.4, funde: 0.2, junta: 1.1, tremor: 0, bisel: 1.2, luz: 0.28, sombra: 0.32, face: 'reta', tampaComBisel: true, detalhe: 'pregos' },
  },
  {
    id: 'pedra-de-fortaleza',
    nome: 'Pedra de fortaleza',
    descricao: 'Blocos de basalto quase preto, aparelhados, de junta fina.',
    receita: { fiadasAte: [15, 44], passo: { porFundura: 7, min: 40, max: 70 }, varia: 0.4, funde: 0, junta: 1, tremor: 0, bisel: 2, luz: 0.48, sombra: 0.34, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
  },
  // O plano de arte por tema de 28/11/2026 (L02 e L03), no FIM pela semente das juntas. O Ossuário, com a receita do
  // desenhista: uma fiada só até 24 px, para os crânios saírem 1:1.
  {
    id: 'ossuario',
    nome: 'Ossuário',
    descricao: 'Ossos e crânios empilhados, a parede das catacumbas vista de cima, com um crânio sobre os ossos nas pontas.',
    receita: { fiadasAte: [24, 48], passo: { porFundura: 0, min: 90, max: 140 }, varia: 0.3, funde: 0.3, junta: 1, tremor: 1.2, bisel: 0, luz: 0.2, sombra: 0.3, face: 'reta', tampaComBisel: false, detalhe: 'nenhum' },
  },
  // A muralha de calcário do L03. As AMEIAS (o merlão e a seteira alternados na fiada de fora) são geometria de
  // `pixi/paredeEmPecas.ts` que ainda não existe: até lá ela é a muralha lisa, e o nome não promete as ameias. O id já
  // é o da muralha com ameias, para o mapa salvo ganhar as ameias quando elas chegarem. Receita das medidas da amostra
  // do estúdio (`prova/paredes/materiais/muralha-com-ameias.py`), em blocos de muralha.
  {
    id: 'muralha-com-ameias',
    nome: 'Muralha de calcário',
    descricao: 'Calcário cinza-mel gasto pela chuva, em fiadas aparelhadas de blocos grandes, com líquen nas juntas.',
    receita: { fiadasAte: [15, 44], passo: { porFundura: 2.5, min: 22, max: 48 }, varia: 0.36, funde: 0.2, junta: 1.5, tremor: 0, bisel: 2.2, luz: 0.44, sombra: 0.38, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
  },
  // A onda 2 do plano (28/11/2026, L04 a L06), no FIM pela semente das juntas, cada uma com a montagem que o desenhista
  // apontou no estúdio. A Rocha com veios (L04) monta como a Rocha de caverna: a mesma pedra, com o veio de minério.
  {
    id: 'rocha-com-veios',
    nome: 'Rocha com veios',
    descricao: 'Rocha bruta e escura da mina, em massas tortas, cortada por veios de minério.',
    receita: { fiadasAte: [18, 44], passo: { porFundura: 2, min: 16, max: 44 }, varia: 0.4, funde: 0.3, junta: 1.6, tremor: 1.8, bisel: 2.6, luz: 0.3, sombra: 0.5, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
  },
  // O Tijolo com limo (L05) é uma versão do Tijolo: a mesma amarração, a junta tomada pelo limo.
  {
    id: 'tijolo-com-limo',
    nome: 'Tijolo com limo',
    descricao: 'Tijolo velho e molhado do esgoto, encardido de verde, com limo nas juntas.',
    receita: { fiadasAte: [15, 27, 44], passo: { porFundura: 2.05, min: 14, max: 26 }, varia: 0.16, funde: 0, junta: 1.2, tremor: 0, bisel: 1.4, luz: 0.32, sombra: 0.34, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
  },
  // A Parede caiada (L06) monta como o Concreto: uma fiada de painéis compridos (o reboco é corrido), sem enfeite.
  {
    id: 'parede-caiada',
    nome: 'Parede caiada',
    descricao: 'Reboco branco de cal, gasto, com a pedra aparecendo onde a cal caiu.',
    receita: { fiadasAte: [], passo: { porFundura: 0, min: 72, max: 72 }, varia: 0.2, funde: 0.1, junta: 1, tremor: 0, bisel: 1.2, luz: 0.32, sombra: 0.38, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
  },
  // A Taipa (L07, a onda 3) monta como a Parede caiada: uma fiada de panos compridos, emenda fraca, e o esteio de
  // madeira nas tampas dos cantos.
  {
    id: 'taipa',
    nome: 'Taipa',
    descricao: 'Pau a pique: barro com palha alisado à mão, rachado, com a trama de varas onde o barro caiu e esteio de madeira nos cantos.',
    receita: { fiadasAte: [], passo: { porFundura: 0, min: 72, max: 72 }, varia: 0.2, funde: 0.1, junta: 1, tremor: 0, bisel: 1.2, luz: 0.3, sombra: 0.36, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
  },
  // A Pedra nevada (L08) monta como a Pedra com musgo: a mesma receita, a neve em colchão no meio de cada faixa.
  {
    id: 'pedra-nevada',
    nome: 'Pedra nevada',
    descricao: 'Pedras de granito frio com neve no alto de cada bloco.',
    receita: { fiadasAte: [15, 36], passo: { porFundura: 1.7, min: 13, max: 34 }, varia: 0.4, funde: 0.15, junta: 1.8, tremor: 1.3, bisel: 2.2, luz: 0.38, sombra: 0.42, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
  },
  // A Obsidiana (L09) monta como o Mármore preto, com o bloco mais curto e mais variado (obsidiana se lasca em bloco,
  // não se serra em placa) e a junta, o bisel, a luz e a sombra da amostra do estúdio (`prova/paredes/materiais/obsidiana.py`).
  {
    id: 'obsidiana',
    nome: 'Obsidiana',
    descricao: 'Vidro vulcânico negro-violeta em blocos lascados, com a fratura em conchas e o brilho frio do polido.',
    receita: { fiadasAte: [15, 44], passo: { porFundura: 1.9, min: 15, max: 34 }, varia: 0.45, funde: 0.15, junta: 1, tremor: 0, bisel: 1.6, luz: 0.5, sombra: 0.32, face: 'reta', tampaComBisel: true, detalhe: 'nenhum' },
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
