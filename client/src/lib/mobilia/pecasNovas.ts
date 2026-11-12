/**
 * PEÇAS NOVAS do Meio-Termo, lote 1 (fatia MT4 do plano
 * `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`): mesa quadrada,
 * mesa redonda, lápide, vaso, lampião, quadro de avisos, poço, barraca de
 * feira e carroça. Aqui mora o registro de cada uma (nome, artigo, tamanho
 * padrão em casas, vista, silhueta e o desenho de linhas provisório) e o
 * CATÁLOGO que o painel oferece. `lib/mobilia.ts` junta este registro ao dos
 * 11 móveis de antes.
 *
 * As peças novas saem SEMPRE com o desenho de textura (a chave de obra só vale
 * para os 11 de antes, `pixi/drawPropSilhouettes.ts`). O desenho de linhas
 * daqui é o provisório que aparece enquanto a imagem não fica pronta.
 *
 * Sem import de `types/map.ts` (o tipo vem de `tipos.ts`), para não criar ciclo.
 */
import { TIPOS_MOBILIA, type TipoMobilia } from './tipos'

/**
 * As 9 peças do lote 1 (MT4) e as 5 do lote 2 (MT5: sebe, jardineira, arco do
 * portão, placa de seta e tapete longo), na ordem do plano.
 */
export const PECAS_NOVAS = [
  'mesaQuadrada', 'mesaRedonda', 'lapide', 'vaso', 'lampiao', 'quadroDeAvisos', 'poco', 'barraca', 'carroca',
  'sebe', 'jardineira', 'arcoDoPortao', 'placaDeSeta', 'tapeteLongo', 'fogo',
  'fogao', 'geladeira', 'pia', 'balcao', 'pratos', 'privada', 'sofa', 'poltrona',
  'lareira', 'fornalha', 'bigorna', 'balde',
  'troncos', 'feno',
  'chafariz',
  'cataVento', 'moinho', 'cataVentoBrinquedo',
  'ponte',
  'cova', 'caixao', 'caixaoAberto',
  'destrocosDeMadeira', 'sucataChapas', 'sucataEngrenagens', 'sucataTambores', 'campinho',
  'bonecoDeTreino', 'pilar', 'altar', 'estanteDeLivros', 'sacosDeGrao', 'bancoDePraca', 'escombrosDePedra', 'canhao',
  'guardaRoupa', 'caldeirao', 'fornoDePao', 'prateleiraDeDeposito', 'estatua', 'pedrasERochas', 'mausoleu', 'alvoDeArcoEFlecha',
  'bancaDeFrutas', 'toldoListrado', 'bancadaDeFerramentas', 'pedraDeAmolar', 'suporteDeArmas', 'espantalho', 'cocho', 'ossos', 'antenaParabolica',
  'escrivaninha', 'criadoMudo', 'camaDeCasal', 'berco', 'banqueta', 'biombo', 'piano', 'candelabroDeChao',
  'banheira', 'tinaDeMadeira', 'lavatorioComJarro', 'prateleiraDePotes', 'mesaDeCorte', 'ganchoComCarne',
  'pilhaDeCaixas', 'barrisDeitados', 'tonelDeAdega', 'anforasDeBarro', 'cestoDeVime', 'cofre',
  'varalDeRoupa', 'horta', 'canteiroDeFlores', 'muroBaixoDePedra', 'tocoDeArvore', 'carrinhoDeMao', 'placaDeLoja',
  'cruzDeMadeira', 'anjoDePedra', 'cercaDeFerro', 'paCravada', 'velasEOferendas', 'arvoreSeca',
  'balancaDeMercador', 'tendaDeAdivinha', 'gaiolaComAves', 'rolosDeTecido', 'palcoDeBardo', 'barrilDePeixe',
  'fole', 'manequimComArmadura', 'pilhaDeLingotes', 'serra', 'galinheiro', 'colmeia', 'arado', 'tocoComMachado', 'plantacaoEmFileiras',
  'carrocaQuebrada', 'barrilQuebrado', 'vigaCaida', 'armaduraEnferrujada', 'mesaDeJogo', 'ringueDeLuta', 'balanco', 'mesaDeSinuca',
  'ancora', 'cordasEnroladas', 'timao', 'bote', 'redeDePesca', 'pier', 'caixoteDePeixe', 'armaduraDespedacada', 'armadura',
] as const satisfies readonly TipoMobilia[]

export type PecaNova = (typeof PECAS_NOVAS)[number]

/** Peças novas com vista de lado (Frente | Lado): a barraca e a carroça. */
export type PecaNovaComVista = Extract<PecaNova, 'barraca' | 'carroca'>

export function ehPecaNova(tipo: TipoMobilia | undefined): tipo is PecaNova {
  return PECAS_NOVAS.some((peca) => peca === tipo)
}

interface Casas {
  readonly largura: number
  readonly altura: number
}

export interface FichaDaPecaNova {
  /** Nome na setinha e no seletor de tipo. */
  readonly rotulo: string
  /** Artigo + nome, para a dica ("Clique no mapa para pôr uma lápide."). */
  readonly artigo: string
  /** Tamanho padrão em casas (largura x altura, sem giro), de frente. */
  readonly tamanho: Casas
  /** Silhueta redonda (a elipse inscrita) vista de cima. */
  readonly redonda: boolean
}

/**
 * Tamanhos do plano. O vaso leva "de planta" no nome e a barraca "de feira":
 * "Vaso" e "Barraca" sozinhos não dizem o que são no meio dos móveis.
 */
export const FICHAS_DAS_PECAS_NOVAS: Readonly<Record<PecaNova, FichaDaPecaNova>> = {
  mesaQuadrada: { rotulo: 'Mesa quadrada', artigo: 'uma mesa quadrada', tamanho: { largura: 1, altura: 1 }, redonda: false },
  mesaRedonda: { rotulo: 'Mesa redonda', artigo: 'uma mesa redonda', tamanho: { largura: 1.25, altura: 1.25 }, redonda: true },
  lapide: { rotulo: 'Lápide', artigo: 'uma lápide', tamanho: { largura: 0.6, altura: 0.35 }, redonda: false },
  vaso: { rotulo: 'Vaso de planta', artigo: 'um vaso de planta', tamanho: { largura: 0.5, altura: 0.5 }, redonda: true },
  lampiao: { rotulo: 'Lampião', artigo: 'um lampião', tamanho: { largura: 0.5, altura: 0.5 }, redonda: false },
  quadroDeAvisos: { rotulo: 'Quadro de avisos', artigo: 'um quadro de avisos', tamanho: { largura: 1, altura: 0.4 }, redonda: false },
  poco: { rotulo: 'Poço', artigo: 'um poço', tamanho: { largura: 1.5, altura: 1.5 }, redonda: true },
  barraca: { rotulo: 'Barraca de feira', artigo: 'uma barraca de feira', tamanho: { largura: 2, altura: 2 }, redonda: false },
  carroca: { rotulo: 'Carroça', artigo: 'uma carroça', tamanho: { largura: 2, altura: 1.25 }, redonda: false },
  // Lote 2 (MT5). A sebe tem a geometria da cerca (estica e curva); o tapete longo corre em pé e estica à vontade.
  sebe: { rotulo: 'Sebe', artigo: 'uma sebe', tamanho: { largura: 2, altura: 0.5 }, redonda: false },
  jardineira: { rotulo: 'Jardineira', artigo: 'uma jardineira', tamanho: { largura: 1, altura: 0.5 }, redonda: false },
  arcoDoPortao: { rotulo: 'Arco do portão', artigo: 'um arco do portão', tamanho: { largura: 2, altura: 0.5 }, redonda: false },
  placaDeSeta: { rotulo: 'Placa de seta', artigo: 'uma placa de seta', tamanho: { largura: 0.5, altura: 0.5 }, redonda: false },
  tapeteLongo: { rotulo: 'Tapete longo', artigo: 'um tapete longo', tamanho: { largura: 1, altura: 4 }, redonda: false },
  // Objeto Fogo (27/10/2026): o tamanho padrão é o da Chama; o painel troca para Fogaréu e Incêndio (`TAMANHOS_DO_FOGO`).
  fogo: { rotulo: 'Fogo', artigo: 'um fogo', tamanho: { largura: 1, altura: 1 }, redonda: false },
  // Móveis de casa (28/10/2026), época "Fantasia, como os de hoje". A cozinha: o fogão de ferro a lenha,
  // a geladeira de madeira (a caixa de gelo), a pia de pedra e o balcão, esticável como o aparador.
  fogao: { rotulo: 'Fogão', artigo: 'um fogão', tamanho: { largura: 1, altura: 1 }, redonda: false },
  geladeira: { rotulo: 'Geladeira', artigo: 'uma geladeira', tamanho: { largura: 1, altura: 0.75 }, redonda: false },
  pia: { rotulo: 'Pia', artigo: 'uma pia', tamanho: { largura: 1, altura: 0.6 }, redonda: false },
  balcao: { rotulo: 'Balcão', artigo: 'um balcão', tamanho: { largura: 2, altura: 0.6 }, redonda: false },
  // A mesa posta: desenhada por cima da mesa e do balcão (`ehMovelDeCimaDaMesa`), com a forma cheio, vazio ou pilha.
  pratos: { rotulo: 'Pratos', artigo: 'uns pratos', tamanho: { largura: 0.5, altura: 0.5 }, redonda: false },
  // O banheiro e a sala: a privada de madeira e louça, o sofá estofado (estica, uma almofada por casa) e a poltrona, o par dele.
  privada: { rotulo: 'Privada', artigo: 'uma privada', tamanho: { largura: 0.5, altura: 0.6 }, redonda: false },
  sofa: { rotulo: 'Sofá', artigo: 'um sofá', tamanho: { largura: 2, altura: 1 }, redonda: false },
  poltrona: { rotulo: 'Poltrona', artigo: 'uma poltrona', tamanho: { largura: 1, altura: 1 }, redonda: false },
  // Lareira e oficina (29/10/2026), soltos como o fogão: o mestre encosta na parede e gira. A lareira e a
  // fornalha têm a chama da fogueira e o fogo aceso ou apagado (`lib/mobilia/fogoDeCasa.ts`).
  lareira: { rotulo: 'Lareira', artigo: 'uma lareira', tamanho: { largura: 2, altura: 1 }, redonda: false },
  fornalha: { rotulo: 'Fornalha de ferreiro', artigo: 'uma fornalha de ferreiro', tamanho: { largura: 1.5, altura: 1.5 }, redonda: false },
  bigorna: { rotulo: 'Bigorna', artigo: 'uma bigorna', tamanho: { largura: 1, altura: 0.5 }, redonda: false },
  balde: { rotulo: 'Balde de água', artigo: 'um balde de água', tamanho: { largura: 0.5, altura: 0.5 }, redonda: true },
  // Troncos e feno (29/10/2026): uma forma de partida cada (a pilha de toras e os fardos), a outra no painel
  // com a pegada dela (`lib/mobilia/pilhas.ts`). O tamanho daqui é o da forma de partida.
  troncos: { rotulo: 'Troncos', artigo: 'uns troncos', tamanho: { largura: 2, altura: 1 }, redonda: false },
  // "Clique no mapa para pôr feno.": o feno é de monte, não se conta (sem artigo).
  feno: { rotulo: 'Feno', artigo: 'feno', tamanho: { largura: 1.5, altura: 1 }, redonda: false },
  // O chafariz (02/11/2026): as duas formas (Redondo, Quadrado) têm a mesma pegada de partida. A silhueta
  // redonda depende da forma (`lib/mobilia/chafariz.ts`), não da ficha: `redonda` fica falso aqui.
  chafariz: { rotulo: 'Chafariz', artigo: 'um chafariz', tamanho: { largura: 2, altura: 2 }, redonda: false },
  // Os objetos de vento (02/11/2026): a pegada é a BASE (a torre, a construção, o palito); as pás em pé
  // passam dela para os lados, na camada animada (`lib/mobilia/cataVento.ts`).
  cataVento: { rotulo: 'Cata-vento de fazenda', artigo: 'um cata-vento de fazenda', tamanho: { largura: 1, altura: 1 }, redonda: false },
  moinho: { rotulo: 'Moinho de vento', artigo: 'um moinho de vento', tamanho: { largura: 2, altura: 2 }, redonda: true },
  cataVentoBrinquedo: { rotulo: 'Cata-vento de brinquedo', artigo: 'um cata-vento de brinquedo', tamanho: { largura: 0.5, altura: 0.5 }, redonda: false },
  // A ponte (03/11/2026): corre ao longo da largura (x), 4 casas de comprimento por 1 de largura nas três formas
  // (`lib/mobilia/ponte.ts`); estica nos dois sentidos e gira.
  ponte: { rotulo: 'Ponte', artigo: 'uma ponte', tamanho: { largura: 4, altura: 1 }, redonda: false },
  // O cemitério (07/11/2026), com a arte do estúdio (`godot/desenhado/exportado/movel-cova`, `movel-caixao`,
  // `movel-caixao-aberto`): de pé, 1 casa de largura por 2 de comprimento. A cova estica (a imagem acompanha a
  // pegada); os caixões giram (o fechado é simétrico na meia volta, o aberto não).
  cova: { rotulo: 'Cova', artigo: 'uma cova', tamanho: { largura: 1, altura: 2 }, redonda: false },
  caixao: { rotulo: 'Caixão', artigo: 'um caixão', tamanho: { largura: 1, altura: 2 }, redonda: false },
  caixaoAberto: { rotulo: 'Caixão aberto', artigo: 'um caixão aberto', tamanho: { largura: 1, altura: 2 }, redonda: false },
  // Destroços e sucata (10/11/2026): pilhas soltas, cada uma com o próprio desenho. As pilhas grandes nascem
  // em 2 x 2 casas; a de engrenagens, um monte pequeno de peças, em 1 x 1. Esticam e giram como todo objeto.
  destrocosDeMadeira: { rotulo: 'Destroços de madeira', artigo: 'uns destroços de madeira', tamanho: { largura: 2, altura: 2 }, redonda: false },
  // "de metal" vai no nome das três: o mestre pediu "sucatas de metal", e a busca da ficha só lê o nome e o
  // título do grupo (quem digita "metal" tem de achá-las).
  sucataChapas: { rotulo: 'Sucata de metal: chapas', artigo: 'uma sucata de chapas', tamanho: { largura: 2, altura: 2 }, redonda: false },
  sucataEngrenagens: { rotulo: 'Sucata de metal: engrenagens', artigo: 'uma sucata de engrenagens', tamanho: { largura: 1, altura: 1 }, redonda: false },
  sucataTambores: { rotulo: 'Sucata de metal: tambores', artigo: 'uma sucata de tambores', tamanho: { largura: 2, altura: 2 }, redonda: false },
  // O campinho de futebol (10/11/2026): 10 x 6 casas, deitado; cabe um bate-bola de 3 contra 3. Mora no chão
  // (`ehMovelDoChao`): as fichas e os outros objetos ficam por cima dele.
  campinho: { rotulo: 'Campinho de futebol', artigo: 'um campinho de futebol', tamanho: { largura: 10, altura: 6 }, redonda: false },
  // Lote 1 dos 95 objetos novos (11/11/2026), cada um com o próprio desenho; esticam e giram como todo objeto.
  // O boneco de treino é desenhado em pé, de frente, como a lápide. A estante é rasa (meia casa), de encostar
  // na parede; a frente dela, do altar e do banco é o lado de baixo. O cano do canhão corre ao longo da
  // largura, com a boca para a direita.
  bonecoDeTreino: { rotulo: 'Boneco de treino', artigo: 'um boneco de treino', tamanho: { largura: 1, altura: 1 }, redonda: false },
  pilar: { rotulo: 'Pilar', artigo: 'um pilar', tamanho: { largura: 1, altura: 1 }, redonda: false },
  altar: { rotulo: 'Altar', artigo: 'um altar', tamanho: { largura: 2, altura: 1 }, redonda: false },
  estanteDeLivros: { rotulo: 'Estante de livros', artigo: 'uma estante de livros', tamanho: { largura: 2, altura: 0.5 }, redonda: false },
  sacosDeGrao: { rotulo: 'Sacos de grão', artigo: 'uns sacos de grão', tamanho: { largura: 1, altura: 1 }, redonda: false },
  bancoDePraca: { rotulo: 'Banco de praça', artigo: 'um banco de praça', tamanho: { largura: 2, altura: 0.7 }, redonda: false },
  escombrosDePedra: { rotulo: 'Escombros de pedra', artigo: 'uns escombros de pedra', tamanho: { largura: 2, altura: 2 }, redonda: false },
  canhao: { rotulo: 'Canhão', artigo: 'um canhão', tamanho: { largura: 2, altura: 1 }, redonda: false },
  // Lote 2 dos 95 objetos novos (11/11/2026), cada um com o próprio desenho; esticam e giram como todo objeto.
  // A frente do guarda-roupa, do forno de pão, da prateleira, da estátua e do mausoléu é o lado de baixo (no
  // mausoléu, um dos lados menores: a porta e os degraus). O caldeirão é redondo, como o barril, e a brasa
  // debaixo dele é só pintura (sem chama nem luz); o forno de pão tem o fogo de casa, aceso ou apagado, como
  // a lareira (`lib/mobilia/fogoDeCasa.ts`). O alvo é desenhado em pé, de frente, como o boneco de treino.
  guardaRoupa: { rotulo: 'Guarda-roupa', artigo: 'um guarda-roupa', tamanho: { largura: 1.5, altura: 0.6 }, redonda: false },
  caldeirao: { rotulo: 'Caldeirão', artigo: 'um caldeirão', tamanho: { largura: 1, altura: 1 }, redonda: true },
  fornoDePao: { rotulo: 'Forno de pão', artigo: 'um forno de pão', tamanho: { largura: 2, altura: 2 }, redonda: false },
  prateleiraDeDeposito: { rotulo: 'Prateleira de depósito', artigo: 'uma prateleira de depósito', tamanho: { largura: 2, altura: 0.6 }, redonda: false },
  estatua: { rotulo: 'Estátua', artigo: 'uma estátua', tamanho: { largura: 1, altura: 1 }, redonda: false },
  pedrasERochas: { rotulo: 'Pedras e rochas', artigo: 'umas pedras e rochas', tamanho: { largura: 2, altura: 1.5 }, redonda: false },
  mausoleu: { rotulo: 'Mausoléu', artigo: 'um mausoléu', tamanho: { largura: 3, altura: 4 }, redonda: false },
  alvoDeArcoEFlecha: { rotulo: 'Alvo de arco e flecha', artigo: 'um alvo de arco e flecha', tamanho: { largura: 1, altura: 1 }, redonda: false },
  // Lote 3 dos 95 objetos novos (11/11/2026), cada um com o próprio desenho; esticam e giram como todo objeto.
  // A frente da banca de frutas (o lado da freguesia), da bancada (a morsa), da pedra de amolar (a manivela)
  // e do suporte de armas (o escudo) é o lado de baixo. O toldo é só o pano no ar, entre quatro estacas, sem
  // balcão (a barraca é outra peça). O espantalho é desenhado em pé, de frente, como o boneco de treino. Os
  // ossos são rentes ao chão, mas não moram nele (não são `ehMovelDoChao`). Nenhum tem luz nem chama.
  bancaDeFrutas: { rotulo: 'Banca de frutas', artigo: 'uma banca de frutas', tamanho: { largura: 2, altura: 1 }, redonda: false },
  toldoListrado: { rotulo: 'Toldo listrado', artigo: 'um toldo listrado', tamanho: { largura: 2, altura: 2 }, redonda: false },
  bancadaDeFerramentas: { rotulo: 'Bancada de ferramentas', artigo: 'uma bancada de ferramentas', tamanho: { largura: 2, altura: 1 }, redonda: false },
  pedraDeAmolar: { rotulo: 'Pedra de amolar', artigo: 'uma pedra de amolar', tamanho: { largura: 1, altura: 1 }, redonda: false },
  suporteDeArmas: { rotulo: 'Suporte de armas', artigo: 'um suporte de armas', tamanho: { largura: 2, altura: 0.6 }, redonda: false },
  espantalho: { rotulo: 'Espantalho', artigo: 'um espantalho', tamanho: { largura: 1, altura: 1 }, redonda: false },
  cocho: { rotulo: 'Cocho', artigo: 'um cocho', tamanho: { largura: 2, altura: 0.7 }, redonda: false },
  ossos: { rotulo: 'Ossos', artigo: 'uns ossos', tamanho: { largura: 1.5, altura: 1 }, redonda: false },
  antenaParabolica: { rotulo: 'Antena parabólica', artigo: 'uma antena parabólica', tamanho: { largura: 2, altura: 2 }, redonda: false },
  // Lote 4 dos 95 objetos novos (11/11/2026), a sala e o quarto, cada um com o próprio desenho; esticam e giram
  // como todo objeto. A frente da escrivaninha e do criado-mudo (as gavetas), do biombo (o bordado) e do piano
  // (o teclado e o banquinho, que contam na pegada) é o lado de baixo. A cama de casal tem a cabeceira em
  // cima, como a de solteiro, e as três cores dela (`ehCama` em `lib/mobilia.ts`); o berço tem a cabeça à
  // esquerda. A banqueta e o candelabro são redondos. A vela do criado-mudo e as cinco do candelabro só
  // iluminam em volta (`lib/luzDoFogo.ts`): a chama é pintura, sem animação nem Aceso/Apagado.
  escrivaninha: { rotulo: 'Escrivaninha', artigo: 'uma escrivaninha', tamanho: { largura: 1.5, altura: 0.8 }, redonda: false },
  criadoMudo: { rotulo: 'Criado-mudo com vela', artigo: 'um criado-mudo com vela', tamanho: { largura: 0.6, altura: 0.6 }, redonda: false },
  camaDeCasal: { rotulo: 'Cama de casal', artigo: 'uma cama de casal', tamanho: { largura: 2, altura: 2 }, redonda: false },
  berco: { rotulo: 'Berço', artigo: 'um berço', tamanho: { largura: 1, altura: 0.7 }, redonda: false },
  banqueta: { rotulo: 'Banqueta', artigo: 'uma banqueta', tamanho: { largura: 0.5, altura: 0.5 }, redonda: true },
  biombo: { rotulo: 'Biombo', artigo: 'um biombo', tamanho: { largura: 2, altura: 0.6 }, redonda: false },
  piano: { rotulo: 'Piano', artigo: 'um piano', tamanho: { largura: 1.5, altura: 1 }, redonda: false },
  candelabroDeChao: { rotulo: 'Candelabro de chão', artigo: 'um candelabro de chão', tamanho: { largura: 0.6, altura: 0.6 }, redonda: true },
  // Lote 5 dos 95 objetos novos (11/11/2026), a cozinha e o banheiro, cada um com o próprio desenho; esticam e
  // giram como todo objeto. A frente da banheira (a toalha na borda), do lavatório (a barra da toalha), da mesa
  // de corte (o pano) e do gancho (onde as peças pendem) é o lado de baixo; a prateleira de potes é de parede
  // (o lado de cima encosta nela) e não toca o chão. A tina é redonda, mas o banquinho dela ocupa o canto da
  // pegada: por isso não é `redonda`. Nenhum tem luz nem chama.
  banheira: { rotulo: 'Banheira', artigo: 'uma banheira', tamanho: { largura: 2, altura: 1 }, redonda: false },
  tinaDeMadeira: { rotulo: 'Tina de madeira', artigo: 'uma tina de madeira', tamanho: { largura: 1.5, altura: 1.5 }, redonda: false },
  lavatorioComJarro: { rotulo: 'Lavatório com jarro', artigo: 'um lavatório com jarro', tamanho: { largura: 1, altura: 0.6 }, redonda: false },
  prateleiraDePotes: { rotulo: 'Prateleira de potes', artigo: 'uma prateleira de potes', tamanho: { largura: 1.5, altura: 0.4 }, redonda: false },
  mesaDeCorte: { rotulo: 'Mesa de corte', artigo: 'uma mesa de corte', tamanho: { largura: 1.5, altura: 1 }, redonda: false },
  ganchoComCarne: { rotulo: 'Gancho com carne pendurada', artigo: 'um gancho com carne pendurada', tamanho: { largura: 1.5, altura: 0.5 }, redonda: false },
  // Lote 6 dos 95 objetos novos (11/11/2026), a armazenagem, cada um com o próprio desenho; esticam e giram
  // como todo objeto. Na pilha de caixas o caixote comprido fica no fundo e a lona no canto da frente à direita.
  // A frente dos barris deitados (as torneiras e a caneca), do tonel (um dos lados menores: a torneira e a
  // escadinha), das ânforas (a tombada), do cesto (por onde o pano sai) e do cofre (a porta, a roda de segredo
  // e a alavanca) é o lado de baixo. Só o cesto é `redonda`: estica em oval com a pegada. Nenhum tem luz nem chama.
  pilhaDeCaixas: { rotulo: 'Pilha de caixas', artigo: 'uma pilha de caixas', tamanho: { largura: 1.5, altura: 1.5 }, redonda: false },
  barrisDeitados: { rotulo: 'Barris deitados', artigo: 'uns barris deitados', tamanho: { largura: 2, altura: 1 }, redonda: false },
  tonelDeAdega: { rotulo: 'Tonel de adega', artigo: 'um tonel de adega', tamanho: { largura: 2, altura: 3 }, redonda: false },
  anforasDeBarro: { rotulo: 'Ânforas de barro', artigo: 'umas ânforas de barro', tamanho: { largura: 1, altura: 1 }, redonda: false },
  cestoDeVime: { rotulo: 'Cesto de vime', artigo: 'um cesto de vime', tamanho: { largura: 0.7, altura: 0.7 }, redonda: true },
  cofre: { rotulo: 'Cofre', artigo: 'um cofre', tamanho: { largura: 1, altura: 1 }, redonda: false },
  // Lote 7 dos 95 objetos novos (11/11/2026), a rua e o jardim, cada um com o próprio desenho; esticam e giram
  // como todo objeto. No varal a corda corre ao longo da largura, no fundo da pegada, e a roupa cai para a
  // frente (o lado de baixo); esticado, ganha mais roupa, nunca roupa esticada. Na horta as leiras correm ao
  // longo da largura e o regador fica à direita; esticada, ganha mais leiras. A horta e o canteiro moram no
  // chão (`ehMovelDoChao` em `lib/mobilia.ts`), como o campinho: o que o mestre põe dentro deles fica por
  // cima. O muro corre pelo lado maior da pegada (em pé, 0,5 x 2, é o trecho em pé sem girar) e é reto: o
  // trecho esticado ganha mais pedras. No carrinho a roda fica à direita e os cabos à esquerda; na placa o
  // poste fica à esquerda e a frente é o lado de baixo. Só o canteiro (um feijão sem quina) e o toco são
  // `redonda`. Nenhum tem luz nem chama.
  varalDeRoupa: { rotulo: 'Varal de roupa', artigo: 'um varal de roupa', tamanho: { largura: 2, altura: 0.5 }, redonda: false },
  horta: { rotulo: 'Horta', artigo: 'uma horta', tamanho: { largura: 2, altura: 1.5 }, redonda: false },
  canteiroDeFlores: { rotulo: 'Canteiro de flores', artigo: 'um canteiro de flores', tamanho: { largura: 1.5, altura: 1 }, redonda: true },
  muroBaixoDePedra: { rotulo: 'Muro baixo de pedra', artigo: 'um muro baixo de pedra', tamanho: { largura: 2, altura: 0.5 }, redonda: false },
  tocoDeArvore: { rotulo: 'Toco de árvore', artigo: 'um toco de árvore', tamanho: { largura: 1, altura: 1 }, redonda: true },
  carrinhoDeMao: { rotulo: 'Carrinho de mão', artigo: 'um carrinho de mão', tamanho: { largura: 1.5, altura: 0.7 }, redonda: false },
  placaDeLoja: { rotulo: 'Placa de loja pendurada', artigo: 'uma placa de loja pendurada', tamanho: { largura: 1, altura: 0.5 }, redonda: false },
  // Lote 8 dos 95 objetos novos (11/11/2026), o cemitério, cada um com o próprio desenho; esticam e giram como
  // todo objeto. A cruz, o anjo e a pá são desenhados de frente nas duas vistas, como a lápide: girados, a
  // imagem deita. A cerca de ferro é um trecho reto que corre pelo lado maior da pegada (em pé, 0,3 x 2, é o
  // trecho em pé sem girar), com um pilarete em cada ponta: esticada, ganha mais barras, nunca barras mais
  // largas, e dois trechos encostados dividem o pilarete da emenda. Nas velas o pano fica no meio, com as
  // oferendas, e as sete velas em roda; elas só iluminam em volta (`LUZ_DOS_OBJETOS` em `lib/luzDoFogo.ts`),
  // sem chama animada e sem Aceso/Apagado. A árvore seca é vista de cima de verdade: a copa de galhos é uma
  // estrela dentro do círculo da pegada, por isso é a única `redonda`.
  cruzDeMadeira: { rotulo: 'Cruz de madeira', artigo: 'uma cruz de madeira', tamanho: { largura: 0.6, altura: 0.6 }, redonda: false },
  anjoDePedra: { rotulo: 'Anjo de pedra', artigo: 'um anjo de pedra', tamanho: { largura: 1, altura: 1 }, redonda: false },
  cercaDeFerro: { rotulo: 'Cerca de ferro', artigo: 'uma cerca de ferro', tamanho: { largura: 2, altura: 0.3 }, redonda: false },
  paCravada: { rotulo: 'Pá cravada na terra', artigo: 'uma pá cravada na terra', tamanho: { largura: 0.8, altura: 0.8 }, redonda: false },
  velasEOferendas: { rotulo: 'Velas e oferendas', artigo: 'umas velas e oferendas', tamanho: { largura: 0.8, altura: 0.8 }, redonda: false },
  arvoreSeca: { rotulo: 'Árvore seca', artigo: 'uma árvore seca', tamanho: { largura: 2, altura: 2 }, redonda: true },
  // Lote 9 dos 95 objetos novos (11/11/2026), a feira, cada um com o próprio desenho; esticam e giram como todo
  // objeto. A balança de mercador é a balança grande de dois pratos sobre um caixote, com pesos e moedas (a
  // banca de frutas só tem uma balancinha num canto). A porta da tenda de adivinha e o tapete que sai dela ficam
  // no lado de baixo; vista de cima, a tenda é o círculo do telhado em cone, por isso é `redonda`, como o
  // moinho (as cordas e as estacas dos cantos saem da elipse). A gaiola tem as ripas da frente no lado de
  // baixo e a gaiolinha dos pombos no canto de trás. Nos rolos de tecido a mesa fica à esquerda e o caixote com
  // os rolos em pé à direita. O palco de bardo mora no chão (`ehMovelDoChao` em `lib/mobilia.ts`), como a
  // horta: o que o mestre põe em cima do tablado fica por cima; a cortina fica no fundo e o degrau na frente. O
  // barril de peixe é o barril aberto, com a tampa encostada e o puçá fora do círculo: por isso não é
  // `redonda`. Nenhum tem luz nem chama (o palco não tem lanterna).
  balancaDeMercador: { rotulo: 'Balança de mercador', artigo: 'uma balança de mercador', tamanho: { largura: 1, altura: 0.7 }, redonda: false },
  tendaDeAdivinha: { rotulo: 'Tenda de adivinha', artigo: 'uma tenda de adivinha', tamanho: { largura: 2, altura: 2 }, redonda: true },
  gaiolaComAves: { rotulo: 'Gaiola com aves', artigo: 'uma gaiola com aves', tamanho: { largura: 1, altura: 1 }, redonda: false },
  rolosDeTecido: { rotulo: 'Rolos de tecido', artigo: 'uns rolos de tecido', tamanho: { largura: 1.5, altura: 1 }, redonda: false },
  palcoDeBardo: { rotulo: 'Palco de bardo', artigo: 'um palco de bardo', tamanho: { largura: 3, altura: 2 }, redonda: false },
  barrilDePeixe: { rotulo: 'Barril de peixe', artigo: 'um barril de peixe', tamanho: { largura: 1, altura: 1 }, redonda: false },
  // Lote 10 dos 95 objetos novos (11/11/2026), a oficina e a fazenda, cada um com o próprio desenho; esticam e
  // giram como todo objeto. O bico do fole aponta para a direita, com o cabo da alavanca na ponta larga, à
  // esquerda. O manequim é desenhado de frente, como o boneco de treino, e passa um pouco da pegada em cima (o
  // alto do elmo). Na pilha de lingotes o estrado fica à esquerda e a barra caída à direita dele. Na serra a
  // tora corre pelo lado maior. A casinha do galinheiro fica no fundo à esquerda, com a rampa na frente dela e o
  // terreiro cercado em volta. A colmeia é `redonda`: o banco redondo leva o cortiço e o favo dentro da roda. O
  // arado tem o balancim numa ponta curta e a relha, as rabiças e o sulco na outra. O toco com machado cravado
  // (o nome da lista do mestre, acertado na auditoria do lote 10) não é
  // `redonda` (o toco de árvore é): as achas, as lascas e os cavacos vão até os cantos da pegada. A plantação em
  // fileiras mora no chão, rente como o campinho (`ehMovelDoChao` em `lib/mobilia.ts`): as leiras correm ao
  // longo do lado maior e, esticada, ganha leiras e pés. Nenhum tem luz nem chama.
  fole: { rotulo: 'Fole', artigo: 'um fole', tamanho: { largura: 1.5, altura: 0.7 }, redonda: false },
  manequimComArmadura: { rotulo: 'Manequim com armadura', artigo: 'um manequim com armadura', tamanho: { largura: 1, altura: 1 }, redonda: false },
  pilhaDeLingotes: { rotulo: 'Pilha de lingotes', artigo: 'uma pilha de lingotes', tamanho: { largura: 1, altura: 0.7 }, redonda: false },
  serra: { rotulo: 'Serra', artigo: 'uma serra', tamanho: { largura: 2, altura: 1 }, redonda: false },
  galinheiro: { rotulo: 'Galinheiro', artigo: 'um galinheiro', tamanho: { largura: 2, altura: 1.5 }, redonda: false },
  colmeia: { rotulo: 'Colmeia', artigo: 'uma colmeia', tamanho: { largura: 0.8, altura: 0.8 }, redonda: true },
  arado: { rotulo: 'Arado', artigo: 'um arado', tamanho: { largura: 2, altura: 1 }, redonda: false },
  tocoComMachado: { rotulo: 'Toco com machado cravado', artigo: 'um toco com machado cravado', tamanho: { largura: 1, altura: 1 }, redonda: false },
  plantacaoEmFileiras: { rotulo: 'Plantação em fileiras', artigo: 'uma plantação em fileiras', tamanho: { largura: 4, altura: 3 }, redonda: false },
  // Lote 11 dos 95 objetos novos (11/11/2026), os destroços e o esporte, cada um com o próprio desenho; esticam
  // e giram como todo objeto. A carroça quebrada é maior que a carroça (2 x 1,5 contra 2 x 1,25): a carga caída
  // e a roda deitada pedem mais fundo; os varais apontam para a esquerda, como na carroça, a caçamba arriou para
  // baixo e o lado de cima ficou no ar, com a roda presa. No barril quebrado a meia-lua de pé fica no alto à
  // esquerda e o leque das aduelas, a tampa e a poça saem para baixo e para a direita; não é `redonda` (as
  // metades da tampa e os aros soltos vão até os cantos). A viga caída cai do alto à esquerda para baixo à
  // direita, com a trave cruzada por cima da metade da direita. A armadura enferrujada é espalhada no chão,
  // sem ossos e sem sangue. Na mesa de jogo os dois banquinhos ficam puxados, um de cada lado. O ringue de luta
  // mora no chão (`ehMovelDoChao` em `lib/mobilia.ts`), como o palco de bardo: a ficha no meio da lona sai por
  // cima da corda e dos postes. O balanço tem a trave de ponta a ponta e os dois assentos parados em pontos
  // diferentes do vaivém. A mesa de sinuca tem o comprido em x: o triângulo das bolas no pé, à direita, e a
  // branca e os tacos na cabeceira, à esquerda. Nenhum tem luz nem chama.
  carrocaQuebrada: { rotulo: 'Carroça quebrada', artigo: 'uma carroça quebrada', tamanho: { largura: 2, altura: 1.5 }, redonda: false },
  barrilQuebrado: { rotulo: 'Barril quebrado', artigo: 'um barril quebrado', tamanho: { largura: 1, altura: 1 }, redonda: false },
  vigaCaida: { rotulo: 'Viga caída', artigo: 'uma viga caída', tamanho: { largura: 2, altura: 1 }, redonda: false },
  armaduraEnferrujada: { rotulo: 'Armadura enferrujada', artigo: 'uma armadura enferrujada', tamanho: { largura: 1.5, altura: 1 }, redonda: false },
  mesaDeJogo: { rotulo: 'Mesa de jogo', artigo: 'uma mesa de jogo', tamanho: { largura: 1.5, altura: 1.5 }, redonda: false },
  ringueDeLuta: { rotulo: 'Ringue de luta', artigo: 'um ringue de luta', tamanho: { largura: 3, altura: 3 }, redonda: false },
  balanco: { rotulo: 'Balanço', artigo: 'um balanço', tamanho: { largura: 2, altura: 1 }, redonda: false },
  mesaDeSinuca: { rotulo: 'Mesa de sinuca', artigo: 'uma mesa de sinuca', tamanho: { largura: 2, altura: 1 }, redonda: false },
  // Lote 12 dos 95 objetos novos (11/11/2026), o porto e o navio, cada um com o próprio desenho; esticam e giram
  // como todo objeto. A âncora fica deitada no chão, a argola à esquerda e as unhas à direita, com o cepo
  // atravessado perto da argola. O timão é desenhado de frente, como o alvo de arco e flecha, e passa um pouco da
  // pegada em cima (a malagueta de cima). O bote é deitado de propósito, com a proa à direita: a 3/4 sem giro
  // mostra o costado; esticado de pé, ele mesmo se gira e fica com a proa para baixo. Na rede de pesca a vara
  // corre pelo comprido, as estacas repartem os vãos e o monte de rede fica no canto de baixo. O píer mora no
  // chão (`ehMovelDoChao` em `lib/mobilia.ts`), como a ponte, mas não é ela: sem guarda-corpo, as tábuas sempre
  // de través ao lado menor e as estacas redondas nas duas bordas compridas; esticado, ganha tábuas e estacas. O
  // caixote de peixe é raso, com as duas fileiras de cavalinhas e o pargo atravessado no meio.
  ancora: { rotulo: 'Âncora', artigo: 'uma âncora', tamanho: { largura: 1.5, altura: 1 }, redonda: false },
  cordasEnroladas: { rotulo: 'Cordas enroladas', artigo: 'umas cordas enroladas', tamanho: { largura: 1, altura: 1 }, redonda: false },
  timao: { rotulo: 'Timão', artigo: 'um timão', tamanho: { largura: 1, altura: 1 }, redonda: false },
  bote: { rotulo: 'Bote', artigo: 'um bote', tamanho: { largura: 3, altura: 1.5 }, redonda: false },
  redeDePesca: { rotulo: 'Rede de pesca', artigo: 'uma rede de pesca', tamanho: { largura: 2, altura: 1 }, redonda: false },
  pier: { rotulo: 'Píer', artigo: 'um píer', tamanho: { largura: 2, altura: 3 }, redonda: false },
  caixoteDePeixe: { rotulo: 'Caixote de peixe', artigo: 'um caixote de peixe', tamanho: { largura: 1, altura: 0.7 }, redonda: false },
  // Lote 15 (11/11/2026), as duas armaduras que o mestre pediu. A despedaçada é desfeita na forma de um corpo
  // caído, do tamanho dos ossos e feita do mesmo jeito que eles. A armadura é desenhada de frente, de pé no
  // pedestal com a espada de ponta, como o manequim, e passa um pouco da pegada em cima (o elmo e a pluma).
  // Nenhum dos nove tem luz nem chama.
  armaduraDespedacada: { rotulo: 'Armadura despedaçada', artigo: 'uma armadura despedaçada', tamanho: { largura: 1.5, altura: 1 }, redonda: false },
  armadura: { rotulo: 'Armadura', artigo: 'uma armadura', tamanho: { largura: 1, altura: 1 }, redonda: false },
}

/** Um valor por peça nova, lido da ficha (o nome, o artigo, o tamanho), para juntar às tabelas de `lib/mobilia.ts`. */
export function porPecaNova<T>(valor: (ficha: FichaDaPecaNova) => T): Readonly<Record<PecaNova, T>> {
  const f = FICHAS_DAS_PECAS_NOVAS
  return {
    mesaQuadrada: valor(f.mesaQuadrada),
    mesaRedonda: valor(f.mesaRedonda),
    lapide: valor(f.lapide),
    vaso: valor(f.vaso),
    lampiao: valor(f.lampiao),
    quadroDeAvisos: valor(f.quadroDeAvisos),
    poco: valor(f.poco),
    barraca: valor(f.barraca),
    carroca: valor(f.carroca),
    sebe: valor(f.sebe),
    jardineira: valor(f.jardineira),
    arcoDoPortao: valor(f.arcoDoPortao),
    placaDeSeta: valor(f.placaDeSeta),
    tapeteLongo: valor(f.tapeteLongo),
    fogo: valor(f.fogo),
    fogao: valor(f.fogao),
    geladeira: valor(f.geladeira),
    pia: valor(f.pia),
    balcao: valor(f.balcao),
    pratos: valor(f.pratos),
    privada: valor(f.privada),
    sofa: valor(f.sofa),
    poltrona: valor(f.poltrona),
    lareira: valor(f.lareira),
    fornalha: valor(f.fornalha),
    bigorna: valor(f.bigorna),
    balde: valor(f.balde),
    troncos: valor(f.troncos),
    feno: valor(f.feno),
    chafariz: valor(f.chafariz),
    cataVento: valor(f.cataVento),
    moinho: valor(f.moinho),
    cataVentoBrinquedo: valor(f.cataVentoBrinquedo),
    ponte: valor(f.ponte),
    cova: valor(f.cova),
    caixao: valor(f.caixao),
    caixaoAberto: valor(f.caixaoAberto),
    destrocosDeMadeira: valor(f.destrocosDeMadeira),
    sucataChapas: valor(f.sucataChapas),
    sucataEngrenagens: valor(f.sucataEngrenagens),
    sucataTambores: valor(f.sucataTambores),
    campinho: valor(f.campinho),
    bonecoDeTreino: valor(f.bonecoDeTreino),
    pilar: valor(f.pilar),
    altar: valor(f.altar),
    estanteDeLivros: valor(f.estanteDeLivros),
    sacosDeGrao: valor(f.sacosDeGrao),
    bancoDePraca: valor(f.bancoDePraca),
    escombrosDePedra: valor(f.escombrosDePedra),
    canhao: valor(f.canhao),
    guardaRoupa: valor(f.guardaRoupa),
    caldeirao: valor(f.caldeirao),
    fornoDePao: valor(f.fornoDePao),
    prateleiraDeDeposito: valor(f.prateleiraDeDeposito),
    estatua: valor(f.estatua),
    pedrasERochas: valor(f.pedrasERochas),
    mausoleu: valor(f.mausoleu),
    alvoDeArcoEFlecha: valor(f.alvoDeArcoEFlecha),
    bancaDeFrutas: valor(f.bancaDeFrutas),
    toldoListrado: valor(f.toldoListrado),
    bancadaDeFerramentas: valor(f.bancadaDeFerramentas),
    pedraDeAmolar: valor(f.pedraDeAmolar),
    suporteDeArmas: valor(f.suporteDeArmas),
    espantalho: valor(f.espantalho),
    cocho: valor(f.cocho),
    ossos: valor(f.ossos),
    antenaParabolica: valor(f.antenaParabolica),
    escrivaninha: valor(f.escrivaninha),
    criadoMudo: valor(f.criadoMudo),
    camaDeCasal: valor(f.camaDeCasal),
    berco: valor(f.berco),
    banqueta: valor(f.banqueta),
    biombo: valor(f.biombo),
    piano: valor(f.piano),
    candelabroDeChao: valor(f.candelabroDeChao),
    banheira: valor(f.banheira),
    tinaDeMadeira: valor(f.tinaDeMadeira),
    lavatorioComJarro: valor(f.lavatorioComJarro),
    prateleiraDePotes: valor(f.prateleiraDePotes),
    mesaDeCorte: valor(f.mesaDeCorte),
    ganchoComCarne: valor(f.ganchoComCarne),
    pilhaDeCaixas: valor(f.pilhaDeCaixas),
    barrisDeitados: valor(f.barrisDeitados),
    tonelDeAdega: valor(f.tonelDeAdega),
    anforasDeBarro: valor(f.anforasDeBarro),
    cestoDeVime: valor(f.cestoDeVime),
    cofre: valor(f.cofre),
    varalDeRoupa: valor(f.varalDeRoupa),
    horta: valor(f.horta),
    canteiroDeFlores: valor(f.canteiroDeFlores),
    muroBaixoDePedra: valor(f.muroBaixoDePedra),
    tocoDeArvore: valor(f.tocoDeArvore),
    carrinhoDeMao: valor(f.carrinhoDeMao),
    placaDeLoja: valor(f.placaDeLoja),
    cruzDeMadeira: valor(f.cruzDeMadeira),
    anjoDePedra: valor(f.anjoDePedra),
    cercaDeFerro: valor(f.cercaDeFerro),
    paCravada: valor(f.paCravada),
    velasEOferendas: valor(f.velasEOferendas),
    arvoreSeca: valor(f.arvoreSeca),
    balancaDeMercador: valor(f.balancaDeMercador),
    tendaDeAdivinha: valor(f.tendaDeAdivinha),
    gaiolaComAves: valor(f.gaiolaComAves),
    rolosDeTecido: valor(f.rolosDeTecido),
    palcoDeBardo: valor(f.palcoDeBardo),
    barrilDePeixe: valor(f.barrilDePeixe),
    fole: valor(f.fole),
    manequimComArmadura: valor(f.manequimComArmadura),
    pilhaDeLingotes: valor(f.pilhaDeLingotes),
    serra: valor(f.serra),
    galinheiro: valor(f.galinheiro),
    colmeia: valor(f.colmeia),
    arado: valor(f.arado),
    tocoComMachado: valor(f.tocoComMachado),
    plantacaoEmFileiras: valor(f.plantacaoEmFileiras),
    carrocaQuebrada: valor(f.carrocaQuebrada),
    barrilQuebrado: valor(f.barrilQuebrado),
    vigaCaida: valor(f.vigaCaida),
    armaduraEnferrujada: valor(f.armaduraEnferrujada),
    mesaDeJogo: valor(f.mesaDeJogo),
    ringueDeLuta: valor(f.ringueDeLuta),
    balanco: valor(f.balanco),
    mesaDeSinuca: valor(f.mesaDeSinuca),
    ancora: valor(f.ancora),
    cordasEnroladas: valor(f.cordasEnroladas),
    timao: valor(f.timao),
    bote: valor(f.bote),
    redeDePesca: valor(f.redeDePesca),
    pier: valor(f.pier),
    caixoteDePeixe: valor(f.caixoteDePeixe),
    armaduraDespedacada: valor(f.armaduraDespedacada),
    armadura: valor(f.armadura),
  }
}

/** Pegada de LADO em casas: a barraca de lado é o perfil do toldo sobre o balcão; a carroça, a roda e a caixa. */
export const TAMANHO_DE_LADO_DAS_PECAS_NOVAS: Readonly<Record<PecaNovaComVista, Casas>> = {
  barraca: { largura: 2, altura: 2 },
  carroca: { largura: 2, altura: 1.25 },
}

export const PECAS_NOVAS_COM_VISTA: readonly PecaNovaComVista[] = ['barraca', 'carroca']

/**
 * As peças novas PRONTAS: desenho com textura feito e medido. Só elas entram
 * na setinha e no seletor de tipo; a que não está aqui ainda abre de um
 * arquivo (o tipo existe), mas o painel não a oferece. As 9 do lote 1 passaram
 * nos testes de pixel (`moveisMt4.test.ts`) e na semente do app com a
 * varredura das 1000 (`pixi/rasterDosMoveis.sementesMt4.test.ts`); as 5 do
 * lote 2, em `moveisMt5.test.ts` e `pixi/rasterDosMoveis.sementesMt5.test.ts`.
 */
export const PECAS_NOVAS_PRONTAS: readonly PecaNova[] = [
  // O chafariz (02/11/2026) entra logo depois do poço: no seletor de tipo, a água da praça fica junta.
  // A ponte (03/11/2026) logo depois do chafariz: o caminho por cima da água.
  // A cova e os caixões (07/11/2026) logo depois da lápide: o cemitério junto.
  'mesaQuadrada', 'mesaRedonda', 'lapide', 'cova', 'caixao', 'caixaoAberto', 'vaso', 'lampiao', 'quadroDeAvisos', 'poco', 'chafariz', 'ponte', 'barraca', 'carroca',
  'sebe', 'jardineira', 'tapeteLongo', 'arcoDoPortao', 'placaDeSeta', 'fogo',
  'fogao', 'geladeira', 'pia', 'balcao', 'pratos', 'privada', 'sofa', 'poltrona',
  'lareira', 'fornalha', 'bigorna', 'balde',
  'troncos', 'feno',
  // Os objetos de vento (02/11/2026), sem parente antigo.
  'cataVento', 'moinho', 'cataVentoBrinquedo',
  // Destroços, sucata e o campinho (10/11/2026), sem parente antigo.
  'destrocosDeMadeira', 'sucataChapas', 'sucataEngrenagens', 'sucataTambores', 'campinho',
  // Lotes 1 a 12 e 15 dos 95 objetos novos (11/11/2026), sem parente antigo: fecham o catálogo. A ordem em que
  // o mestre os acha é a dos grupos (`gruposDoObjeto.ts`), não esta.
  'bonecoDeTreino', 'pilar', 'altar', 'estanteDeLivros', 'sacosDeGrao', 'bancoDePraca', 'escombrosDePedra', 'canhao',
  'guardaRoupa', 'caldeirao', 'fornoDePao', 'prateleiraDeDeposito', 'estatua', 'pedrasERochas', 'mausoleu', 'alvoDeArcoEFlecha',
  'bancaDeFrutas', 'toldoListrado', 'bancadaDeFerramentas', 'pedraDeAmolar', 'suporteDeArmas', 'espantalho', 'cocho', 'ossos', 'antenaParabolica',
  'escrivaninha', 'criadoMudo', 'camaDeCasal', 'berco', 'banqueta', 'biombo', 'piano', 'candelabroDeChao',
  'banheira', 'tinaDeMadeira', 'lavatorioComJarro', 'prateleiraDePotes', 'mesaDeCorte', 'ganchoComCarne',
  'pilhaDeCaixas', 'barrisDeitados', 'tonelDeAdega', 'anforasDeBarro', 'cestoDeVime', 'cofre',
  'varalDeRoupa', 'horta', 'canteiroDeFlores', 'muroBaixoDePedra', 'tocoDeArvore', 'carrinhoDeMao', 'placaDeLoja',
  'cruzDeMadeira', 'anjoDePedra', 'cercaDeFerro', 'paCravada', 'velasEOferendas', 'arvoreSeca',
  'balancaDeMercador', 'tendaDeAdivinha', 'gaiolaComAves', 'rolosDeTecido', 'palcoDeBardo', 'barrilDePeixe',
  'fole', 'manequimComArmadura', 'pilhaDeLingotes', 'serra', 'galinheiro', 'colmeia', 'arado', 'tocoComMachado', 'plantacaoEmFileiras',
  'carrocaQuebrada', 'barrilQuebrado', 'vigaCaida', 'armaduraEnferrujada', 'mesaDeJogo', 'ringueDeLuta', 'balanco', 'mesaDeSinuca',
  'ancora', 'cordasEnroladas', 'timao', 'bote', 'redeDePesca', 'pier', 'caixoteDePeixe', 'armaduraDespedacada', 'armadura',
]

/**
 * Peças novas que entram logo depois de um parente antigo no catálogo, e não
 * no fim: quem procura mesa acha as três juntas, a sebe e a jardineira ficam
 * com a cerca, e o tapete longo com o tapete (MT5).
 */
const DEPOIS_DE: Readonly<Partial<Record<TipoMobilia, readonly PecaNova[]>>> = {
  // A mesa posta (os Pratos) com as mesas, onde ela vai.
  mesa: ['mesaQuadrada', 'mesaRedonda', 'pratos'],
  // A cozinha fica junto do armário de cozinha, e o balcão com o aparador, o parente esticável dele.
  armario: ['fogao', 'geladeira', 'pia', 'privada'],
  // O sofá e a poltrona com a cadeira, os outros assentos.
  cadeira: ['sofa', 'poltrona'],
  aparador: ['balcao'],
  cerca: ['sebe', 'jardineira'],
  tapete: ['tapeteLongo'],
  // O fogo de casa fica com a fogueira e o fogo (a mesma chama), a bigorna com a fornalha e o balde com o barril.
  fogueira: ['fogo', 'lareira', 'fornalha', 'bigorna'],
  barril: ['balde'],
}
const COM_PARENTE: readonly PecaNova[] = Object.values(DEPOIS_DE).flat()

/**
 * O catálogo do painel de Objetos: os 11 de antes, na ordem de sempre, com as
 * peças novas prontas que têm parente logo depois dele, e as outras peças
 * novas prontas no fim.
 */
export const TIPOS_NO_CATALOGO: readonly TipoMobilia[] = [
  ...TIPOS_MOBILIA.filter((tipo) => !ehPecaNova(tipo)).flatMap((tipo) => [tipo, ...(DEPOIS_DE[tipo] ?? []).filter((p) => PECAS_NOVAS_PRONTAS.includes(p))]),
  ...PECAS_NOVAS_PRONTAS.filter((tipo) => !COM_PARENTE.includes(tipo)),
]

/** O catálogo e, se não estiver nele, o tipo do móvel selecionado (o seletor sempre mostra o que o móvel é). */
export function catalogoComOTipo(tipo: TipoMobilia): readonly TipoMobilia[] {
  return TIPOS_NO_CATALOGO.includes(tipo) ? TIPOS_NO_CATALOGO : [...TIPOS_NO_CATALOGO, tipo]
}

// ---------- variação da lápide ----------

const FNV_BASE = 2166136261
const FNV_PRIMO = 16777619
export const VARIANTES_DA_LAPIDE = 3

/**
 * A lápide tem 3 desenhos (arco, reta com quina partida e cruz). O desenho
 * sai do id do objeto: o mesmo objeto sempre igual, no editor e no jogador
 * (o recorte leva o id), e lápides vizinhas diferentes sem o mestre escolher.
 */
export function varianteDaLapide(id: string | undefined): number {
  if (id === undefined || id === '') return 0
  let h = FNV_BASE
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), FNV_PRIMO)
  return (h >>> 0) % VARIANTES_DA_LAPIDE
}

// ---------- desenho de linhas (o provisório) ----------

/** Um traço reto, em px de mundo, centro do objeto na origem (o `TracoDoGlifo` de `lib/mobilia.ts`). */
interface Traco {
  x1: number
  y1: number
  x2: number
  y2: number
}

const LADOS_DO_ARO = 24

function aro(largura: number, altura: number, cx = 0, cy = 0): Traco[] {
  const tracos: Traco[] = []
  for (let i = 0; i < LADOS_DO_ARO; i += 1) {
    const a0 = (2 * Math.PI * i) / LADOS_DO_ARO
    const a1 = (2 * Math.PI * (i + 1)) / LADOS_DO_ARO
    tracos.push({ x1: cx + (largura / 2) * Math.cos(a0), y1: cy + (altura / 2) * Math.sin(a0), x2: cx + (largura / 2) * Math.cos(a1), y2: cy + (altura / 2) * Math.sin(a1) })
  }
  return tracos
}

function quadro(x0: number, y0: number, x1: number, y1: number): Traco[] {
  return [
    { x1: x0, y1: y0, x2: x1, y2: y0 },
    { x1: x1, y1: y0, x2: x1, y2: y1 },
    { x1: x1, y1: y1, x2: x0, y2: y1 },
    { x1: x0, y1: y1, x2: x0, y2: y0 },
  ]
}

function linha(x0: number, y: number, x1: number): Traco {
  return { x1: x0, y1: y, x2: x1, y2: y }
}

/** Os traços que ligam os pontos em volta (o último volta ao primeiro). */
function fechado(pontos: readonly (readonly [number, number])[]): Traco[] {
  return pontos.map(([x1, y1], i) => {
    const [x2, y2] = pontos[(i + 1) % pontos.length]
    return { x1, y1, x2, y2 }
  })
}

/** O ombro do caixão: a fração do comprimento, a partir da cabeça, onde ele é mais largo. */
const OMBRO_DO_CAIXAO = 0.26

/**
 * O caixão de cima (07/11/2026), ao longo do lado maior da pegada: o hexágono da tampa (a cabeça estreita, o
 * ombro largo a um quarto do comprimento, o pé estreito), a emenda das duas tábuas no meio e, no aberto, a
 * tampa da cabeça e o forro por dentro.
 */
function tracosDoCaixao(largura: number, altura: number, aberto: boolean): Traco[] {
  const deitado = largura > altura
  const meioC = (deitado ? largura : altura) / 2
  const meiaL = (deitado ? altura : largura) / 2
  const pt = (u: number, v: number): readonly [number, number] => (deitado ? [u, v] : [v, u])
  const traco = (u1: number, v1: number, u2: number, v2: number): Traco => {
    const [x1, y1] = pt(u1, v1)
    const [x2, y2] = pt(u2, v2)
    return { x1, y1, x2, y2 }
  }
  const ombro = -meioC + 2 * meioC * OMBRO_DO_CAIXAO
  const casco = (k: number): Traco[] => fechado([
    pt(-meioC * k, -meiaL * 0.62 * k), pt(ombro, -meiaL * 0.94 * k), pt(meioC * k, -meiaL * 0.55 * k),
    pt(meioC * k, meiaL * 0.55 * k), pt(ombro, meiaL * 0.94 * k), pt(-meioC * k, meiaL * 0.62 * k),
  ])
  if (!aberto) return [...casco(0.96), traco(-meioC * 0.96, 0, meioC * 0.96, 0)]
  // A tampa da cabeça vai até um pouco depois do ombro; o forro é o casco de dentro.
  const tampa = -meioC + 2 * meioC * 0.36
  return [...casco(0.96), traco(tampa, -meiaL * 0.9, tampa, meiaL * 0.9), ...casco(0.78)]
}

/**
 * Glifo de frente (de cima) da peça nova: poucos traços que dizem o que ela é.
 * `variante` só vale nos troncos e no feno: a forma (0 a de partida, 1 a outra).
 */
function tracosDeFrente(tipo: PecaNova, largura: number, altura: number, variante: number): Traco[] {
  const hw = largura / 2
  const hh = altura / 2
  switch (tipo) {
    case 'mesaQuadrada': {
      const recuo = Math.min(largura, altura) * 0.12
      return quadro(-hw + recuo, -hh + recuo, hw - recuo, hh - recuo)
    }
    case 'mesaRedonda':
      return aro(largura * 0.78, altura * 0.78)
    case 'lapide':
      return [linha(-hw, -hh + altura * 0.45, hw)]
    case 'vaso':
      return aro(largura * 0.66, altura * 0.66)
    case 'lampiao':
      return quadro(-hw * 0.55, -hh * 0.55, hw * 0.55, hh * 0.55)
    case 'quadroDeAvisos':
      // Os três papéis pregados: duas divisas de pé.
      return [
        { x1: -hw / 3, y1: -hh * 0.6, x2: -hw / 3, y2: hh * 0.6 },
        { x1: hw / 3, y1: -hh * 0.6, x2: hw / 3, y2: hh * 0.6 },
      ]
    case 'poco':
      return [...aro(largura * 0.62, altura * 0.62), linha(-hw, 0, hw)]
    case 'barraca':
      return [linha(-hw, -hh * 0.15, hw), linha(-hw, hh * 0.62, hw)]
    case 'carroca':
      return quadro(-hw * 0.4, -hh * 0.75, hw * 0.98, hh * 0.75)
    // Lote 2 (MT5). A sebe sai pela faixa da cerca em `lib/mobilia.ts` (segue o arco); aqui fica a reta.
    case 'sebe':
      return quadro(-hw, -hh, hw, hh)
    case 'jardineira':
      return quadro(-hw * 0.8, -hh * 0.55, hw * 0.8, hh * 0.55)
    case 'arcoDoPortao':
      // A trave de ponta a ponta e os dois postes.
      return [linha(-hw, 0, hw), ...quadro(-hw, -hh * 0.6, -hw * 0.8, hh * 0.6), ...quadro(hw * 0.8, -hh * 0.6, hw, hh * 0.6)]
    case 'placaDeSeta':
      // A seta aponta para a direita do objeto: o giro dá a direção.
      return [linha(-hw * 0.6, 0, hw * 0.8), { x1: hw * 0.8, y1: 0, x2: hw * 0.4, y2: -hh * 0.45 }, { x1: hw * 0.8, y1: 0, x2: hw * 0.4, y2: hh * 0.45 }]
    case 'tapeteLongo': {
      const recuo = Math.min(largura, altura) * 0.14
      return quadro(-hw + recuo, -hh + recuo, hw - recuo, hh - recuo)
    }
    case 'fogo':
      // O chão queimado: um aro por dentro da pegada (as línguas são a camada animada, `pixi/fogosDoMapa.ts`).
      return aro(largura * 0.8, altura * 0.8)
    // Móveis de casa (28/10/2026): a frente do móvel é o lado de baixo, como no armário.
    case 'fogao':
      // As duas bocas no fundo da chapa e a portinha da lenha na frente.
      return [...aro(largura * 0.3, altura * 0.3, -hw * 0.42, -hh * 0.22), ...aro(largura * 0.3, altura * 0.3, hw * 0.42, -hh * 0.22), linha(-hw * 0.4, hh * 0.62, hw * 0.4)]
    case 'geladeira':
      // A tampa de zinco da caixa de gelo e o fecho da frente.
      return [...quadro(-hw * 0.62, -hh * 0.62, hw * 0.62, hh * 0.3), { x1: 0, y1: hh * 0.3, x2: 0, y2: hh }]
    case 'pia': {
      // A cuba de pedra à esquerda e o balde à direita. O balde tem teto pela
      // largura: na pia esticada estreita e alta ele não sai da caixa (centro
      // 0,26 + raio 0,22 da largura = 0,48); no tamanho padrão manda a altura.
      const balde = Math.min(altura * 0.62, largura * 0.44)
      return [...quadro(-hw * 0.86, -hh * 0.66, hw * 0.08, hh * 0.66), ...aro(balde, balde, hw * 0.52, 0)]
    }
    case 'balcao':
      // A moldura da frente do tampo e a barra de pé, de ponta a ponta.
      return [linha(-hw, hh * 0.4, hw), linha(-hw * 0.96, hh * 0.86, hw * 0.96)]
    case 'pratos':
      // O prato e a caneca no canto.
      return [...aro(largura * 0.62, altura * 0.62, -hw * 0.15, hh * 0.08), ...aro(largura * 0.24, altura * 0.24, hw * 0.6, -hh * 0.6)]
    case 'privada':
      // A caixa de descarga no fundo e o assento oval na frente.
      return [linha(-hw, -hh * 0.4, hw), ...aro(largura * 0.86, altura * 0.62, 0, hh * 0.3)]
    case 'sofa':
    case 'poltrona': {
      // O encosto no fundo e os dois braços: o "U" em volta do assento (a poltrona tem os braços mais largos).
      const braco = largura * (tipo === 'sofa' ? 0.11 : 0.2)
      const encosto = -hh + altura * 0.3
      return [linha(-hw + braco, encosto, hw - braco), { x1: -hw + braco, y1: encosto, x2: -hw + braco, y2: hh }, { x1: hw - braco, y1: encosto, x2: hw - braco, y2: hh }]
    }
    // Lareira e oficina (29/10/2026): a frente é o lado de baixo, como no fogão.
    case 'lareira':
      // O consolo de ponta a ponta e a boca entre as ombreiras, aberta para a soleira.
      return [linha(-hw * 0.94, -hh * 0.36, hw * 0.94), ...quadro(-hw * 0.54, -hh * 0.28, hw * 0.54, hh * 0.6)]
    case 'fornalha':
      // A cova das brasas na bancada e o fole à esquerda, soprando nela.
      return [...aro(Math.min(largura, altura) * 0.3, Math.min(largura, altura) * 0.3, hw * 0.2, hh * 0.2), linha(-hw * 0.96, hh * 0.2, -hw * 0.46)]
    case 'bigorna':
      // A mesa da bigorna e o chifre afinando para a esquerda.
      return [...quadro(-hw * 0.36, -hh * 0.4, hw * 0.86, hh * 0.4), { x1: -hw * 0.36, y1: -hh * 0.4, x2: -hw * 0.96, y2: 0 }, { x1: -hw * 0.36, y1: hh * 0.4, x2: -hw * 0.96, y2: 0 }]
    case 'balde':
      // A boca do balde e a alça atravessada.
      return [...aro(largura * 0.72, altura * 0.72), linha(-hw * 0.86, 0, hw * 0.86)]
    // Troncos e feno (29/10/2026), cada um nas duas formas.
    case 'troncos': {
      if (variante === 1) {
        // A lenha empilhada: as divisas entre as achas, de pé, da parede à frente.
        return [1, 2, 3, 4, 5].map((k) => {
          const x = -hw + (largura * k) / 6
          return { x1: x, y1: -hh * 0.7, x2: x, y2: hh * 0.7 }
        })
      }
      // A pilha de toras: a tora de cima de ponta a ponta, com o corte (o anel) nas duas pontas.
      // O anel tem teto pela largura (0,42 + 0,08 = 0,5 dela): nos troncos estreitos e altos não sai da caixa.
      const corte = Math.min(altura * 0.2, largura * 0.16)
      return [
        linha(-hw * 0.84, -hh / 3, hw * 0.84),
        linha(-hw * 0.84, hh / 3, hw * 0.84),
        ...aro(corte, altura * 0.6, -hw * 0.84, 0),
        ...aro(corte, altura * 0.6, hw * 0.84, 0),
      ]
    }
    case 'feno':
      if (variante === 1) {
        // O monte de feno: a roda do monte e o alto dele, um pouco para trás.
        return [...aro(largura * 0.8, altura * 0.8), ...aro(largura * 0.3, altura * 0.3, -hw * 0.08, -hh * 0.1)]
      }
      // Os fardos: o fardo de cima, atravessado no fundo, e as divisas dos três de baixo na frente.
      return [
        ...quadro(-hw * 0.94, -hh * 0.9, hw * 0.3, hh * 0.02),
        { x1: -hw / 3, y1: hh * 0.02, x2: -hw / 3, y2: hh * 0.92 },
        { x1: hw / 3, y1: -hh * 0.92, x2: hw / 3, y2: hh * 0.92 },
      ]
    // O chafariz (02/11/2026): a borda de dentro da bacia, o prato no meio e o bico. A silhueta (a elipse no
    // Redondo, a caixa no Quadrado) é a borda de fora; no Quadrado a borda de dentro é o oitavado.
    case 'chafariz': {
      const menor = Math.min(hw, hh)
      const prato = aro(menor * 0.8, menor * 0.8)
      const bico = aro(menor * 0.15, menor * 0.15)
      if (variante === 1) {
        const x = hw * 0.97 - menor * 0.15
        const y = hh * 0.97 - menor * 0.15
        const c = Math.min(menor * 0.36, x, y)
        const oito: [number, number][] = [[-x + c, -y], [x - c, -y], [x, -y + c], [x, y - c], [x - c, y], [-x + c, y], [-x, y - c], [-x, -y + c]]
        const borda = oito.map(([x1, y1], i) => {
          const [x2, y2] = oito[(i + 1) % oito.length]
          return { x1, y1, x2, y2 }
        })
        return [...borda, ...prato, ...bico]
      }
      return [...aro(largura * 0.97 - menor * 0.3, altura * 0.97 - menor * 0.3), ...prato, ...bico]
    }
    // Os objetos de vento (02/11/2026): a base vista de cima. As pás em pé são da camada animada.
    case 'cataVento':
      // Os quatro pés da torre, as travessas em X e a plataforma no meio.
      return [
        ...quadro(-hw * 0.8, -hh * 0.8, hw * 0.8, hh * 0.8),
        { x1: -hw * 0.8, y1: -hh * 0.8, x2: hw * 0.8, y2: hh * 0.8 },
        { x1: hw * 0.8, y1: -hh * 0.8, x2: -hw * 0.8, y2: hh * 0.8 },
        ...aro(largura * 0.3, altura * 0.3),
      ]
    case 'moinho':
      // O moinho de torre (variante 1): a varanda em anel, a torre e a cúpula do alto.
      if (variante === 1) return [...aro(largura * 0.9, altura * 0.9), ...aro(largura * 0.62, altura * 0.62), ...aro(largura * 0.3, altura * 0.3)]
      // O Clássico: a torre redonda e o telhado em cone, a beira e o pino do alto.
      return [...aro(largura * 0.86, altura * 0.86), ...aro(largura * 0.12, altura * 0.12)]
    case 'cataVentoBrinquedo':
      // O furinho do palito no chão.
      return aro(largura * 0.3, altura * 0.3)
    // A ponte (03/11/2026), ao longo do lado maior (como a imagem): o corrimão (madeira), a mureta (pedra) ou
    // as cordas (corda) dos dois lados, e as tábuas de través (a madeira a cada meia casa, a corda com vão) ou o
    // fecho do arco (pedra).
    case 'ponte': {
      const deitada = largura >= altura
      const meioC = deitada ? hw : hh
      const meiaL = deitada ? hh : hw
      const traco = (u1: number, v1: number, u2: number, v2: number): Traco => (deitada ? { x1: u1, y1: v1, x2: u2, y2: v2 } : { x1: -v1, y1: u1, x2: -v2, y2: u2 })
      const lado = meiaL * (variante === 2 ? 0.78 : 0.82)
      const bordas = [traco(-meioC, -lado, meioC, -lado), traco(-meioC, lado, meioC, lado)]
      if (variante === 1) return [...bordas, traco(0, -lado, 0, lado)]
      const passo = Math.min(largura, altura) * (variante === 2 ? 0.4 : 0.5)
      const n = Math.max(1, Math.floor((2 * meioC) / passo))
      const tabuas: Traco[] = []
      for (let i = 1; i < n; i += 1) {
        const u = -meioC + (2 * meioC * i) / n
        tabuas.push(traco(u, -lado * 0.8, u, lado * 0.8))
      }
      return [...bordas, ...tabuas]
    }
    // O cemitério (07/11/2026). A cova: o monte de terra por dentro da pegada e a beira da terra mais escura,
    // de través no meio; os caixões, o hexágono da tampa (`tracosDoCaixao`).
    case 'cova': {
      const deitada = largura > altura
      const meio = deitada ? { x1: 0, y1: -hh * 0.86, x2: 0, y2: hh * 0.86 } : linha(-hw * 0.86, 0, hw * 0.86)
      return [...aro(largura * 0.88, altura * 0.92), meio]
    }
    case 'caixao':
      return tracosDoCaixao(largura, altura, false)
    case 'caixaoAberto':
      return tracosDoCaixao(largura, altura, true)
    // Destroços e sucata (10/11/2026): poucos traços que dizem a pilha.
    case 'destrocosDeMadeira':
      // As tábuas cruzadas, cada uma num ângulo.
      return [
        { x1: -hw * 0.9, y1: hh * 0.2, x2: hw * 0.86, y2: hh * 0.5 },
        { x1: -hw * 0.6, y1: -hh * 0.8, x2: hw * 0.1, y2: hh * 0.84 },
        { x1: -hw * 0.3, y1: hh * 0.7, x2: hw * 0.8, y2: -hh * 0.76 },
        { x1: -hw * 0.8, y1: -hh * 0.44, x2: hw * 0.6, y2: -hh * 0.3 },
      ]
    case 'sucataChapas':
      // A chapa torta e as duas vigas cruzadas por cima.
      return [
        ...fechado([[-hw * 0.8, -hh * 0.3], [hw * 0.36, -hh * 0.62], [hw * 0.56, hh * 0.5], [-hw * 0.62, hh * 0.8]]),
        { x1: -hw * 0.86, y1: -hh * 0.76, x2: hw * 0.7, y2: hh * 0.66 },
        { x1: -hw * 0.6, y1: hh * 0.3, x2: hw * 0.9, y2: -hh * 0.5 },
      ]
    case 'sucataEngrenagens': {
      // A engrenagem grande com o furo do eixo e a pequena encostada.
      const menor = Math.min(largura, altura)
      return [...aro(menor * 0.56, menor * 0.56, -hw * 0.16, hh * 0.12), ...aro(menor * 0.14, menor * 0.14, -hw * 0.16, hh * 0.12), ...aro(menor * 0.34, menor * 0.34, hw * 0.4, -hh * 0.38)]
    }
    case 'sucataTambores': {
      // O tambor em pé (a roda), o deitado (a caixa) e a tampa solta.
      const menor = Math.min(largura, altura)
      return [
        ...aro(menor * 0.42, menor * 0.42, -hw * 0.4, -hh * 0.36),
        ...quadro(-hw * 0.5, hh * 0.12, hw * 0.7, hh * 0.8),
        ...aro(menor * 0.2, menor * 0.2, hw * 0.5, -hh * 0.4),
      ]
    }
    // O campinho (10/11/2026), ao longo do lado maior: as linhas de fora, a do meio e o círculo central.
    case 'campinho': {
      const deitado = largura >= altura
      const recuo = Math.min(largura, altura) * 0.06
      const circulo = Math.min(largura, altura) * 0.3
      const meio = deitado ? { x1: 0, y1: -hh + recuo, x2: 0, y2: hh - recuo } : linha(-hw + recuo, 0, hw - recuo)
      return [...quadro(-hw + recuo, -hh + recuo, hw - recuo, hh - recuo), meio, ...aro(circulo, circulo)]
    }
    // Lote 1 dos 95 objetos novos (11/11/2026): os traços que cada desenhista entregou com o desenho.
    case 'bonecoDeTreino':
      // Em pé, de frente: a cabeça, a travessa dos braços, o poste e a base em cruz.
      return [
        ...aro(largura * 0.26, altura * 0.26, 0, -hh * 0.7),
        linha(-hw * 0.84, -hh * 0.3, hw * 0.84),
        { x1: 0, y1: -hh * 0.44, x2: 0, y2: hh * 0.7 },
        { x1: -hw * 0.62, y1: hh * 0.88, x2: hw * 0.62, y2: hh * 0.52 },
        { x1: -hw * 0.62, y1: hh * 0.52, x2: hw * 0.62, y2: hh * 0.88 },
      ]
    case 'pilar': {
      // O toro e o capitel, redondos, dentro do plinto quadrado (a silhueta), o furo de içar no meio e a quina partida.
      const menor = Math.min(largura, altura)
      const furo = menor * 0.035
      return [
        ...aro(menor * 0.74, menor * 0.74),
        ...aro(menor * 0.5, menor * 0.5),
        ...quadro(-furo, -furo, furo, furo),
        { x1: hw, y1: hh * 0.6, x2: hw * 0.6, y2: hh },
      ]
    }
    case 'altar': {
      // O tampo sobre o degrau (os dois lados e a beira da frente), o pano atravessado no meio, a tigela e um castiçal de cada lado.
      const menor = Math.min(largura, altura)
      const tampo = hw - menor * 0.12
      const pano = Math.min(menor * 0.34, hw * 0.37)
      return [
        { x1: -tampo, y1: -hh, x2: -tampo, y2: hh * 0.68 },
        { x1: tampo, y1: -hh, x2: tampo, y2: hh * 0.68 },
        linha(-tampo, hh * 0.68, tampo),
        { x1: -pano, y1: -hh, x2: -pano, y2: hh * 0.68 },
        { x1: pano, y1: -hh, x2: pano, y2: hh * 0.68 },
        ...aro(menor * 0.25, menor * 0.25, 0, -hh * 0.16),
        ...aro(menor * 0.16, menor * 0.16, -(pano + tampo) / 2, -hh * 0.16),
        ...aro(menor * 0.16, menor * 0.16, (pano + tampo) / 2, -hh * 0.16),
      ]
    }
    case 'estanteDeLivros':
      // A beira do tampo e, na frente, as lombadas em pé, de alturas desiguais.
      return [
        linha(-hw, -hh * 0.1, hw),
        ...[-0.75, -0.45, -0.15, 0.15, 0.45, 0.75].map((f, i) => ({ x1: hw * f, y1: hh * 0.84, x2: hw * f, y2: hh * (i % 2 === 0 ? 0.08 : 0.3) })),
      ]
    case 'sacosDeGrao': {
      // Os dois sacos deitados (as elipses achatadas, com o risco da amarra numa ponta) e o aberto em pé, com a boca à mostra.
      const menor = Math.min(largura, altura)
      return [
        ...aro(largura * 0.62, altura * 0.36, -hw * 0.2, -hh * 0.3),
        { x1: hw * 0.26, y1: -hh * 0.5, x2: hw * 0.26, y2: -hh * 0.1 },
        ...aro(largura * 0.62, altura * 0.36, -hw * 0.24, hh * 0.44),
        { x1: -hw * 0.7, y1: hh * 0.22, x2: -hw * 0.7, y2: hh * 0.66 },
        ...aro(menor * 0.42, menor * 0.42, hw * 0.5, hh * 0.44),
        ...aro(menor * 0.22, menor * 0.22, hw * 0.5, hh * 0.44),
      ]
    }
    case 'bancoDePraca':
      // As ripas do encosto e do assento, ao comprido, entre os dois braços de ferro.
      return [
        { x1: -hw * 0.92, y1: -hh * 0.9, x2: -hw * 0.92, y2: hh * 0.9 },
        { x1: hw * 0.92, y1: -hh * 0.9, x2: hw * 0.92, y2: hh * 0.9 },
        linha(-hw * 0.92, -hh * 0.54, hw * 0.92),
        linha(-hw * 0.92, hh * 0.02, hw * 0.92),
        linha(-hw * 0.92, hh * 0.48, hw * 0.92),
      ]
    case 'escombrosDePedra':
      // Três blocos tombados, cada um num ângulo, e uma lasca solta ao lado.
      return [
        ...fechado([[-hw * 0.78, -hh * 0.5], [-hw * 0.3, -hh * 0.8], [-hw * 0.12, -hh * 0.46], [-hw * 0.6, -hh * 0.16]]),
        ...fechado([[hw * 0.02, -hh * 0.56], [hw * 0.62, -hh * 0.44], [hw * 0.54, -hh * 0.04], [-hw * 0.06, -hh * 0.16]]),
        ...fechado([[-hw * 0.56, hh * 0.14], [hw * 0.34, hh * 0.3], [hw * 0.26, hh * 0.74], [-hw * 0.64, hh * 0.58]]),
        ...fechado([[hw * 0.58, hh * 0.3], [hw * 0.84, hh * 0.52], [hw * 0.62, hh * 0.7]]),
      ]
    case 'canhao':
      // O cano afinando até a boca, o botão do cascavel atrás, a carreta por baixo e as quatro rodas de fora dela.
      return [
        ...fechado([[-hw * 0.8, -hh * 0.3], [hw * 0.9, -hh * 0.22], [hw * 0.9, hh * 0.22], [-hw * 0.8, hh * 0.3]]),
        ...aro(largura * 0.07, largura * 0.07, -hw * 0.88, 0),
        ...quadro(-hw * 0.76, -hh * 0.48, hw * 0.3, hh * 0.48),
        ...quadro(-hw * 0.7, -hh * 0.72, -hw * 0.44, -hh * 0.48),
        ...quadro(-hw * 0.04, -hh * 0.72, hw * 0.24, -hh * 0.48),
        ...quadro(-hw * 0.7, hh * 0.48, -hw * 0.44, hh * 0.72),
        ...quadro(-hw * 0.04, hh * 0.48, hw * 0.24, hh * 0.72),
      ]
    // Lote 2 dos 95 objetos novos (11/11/2026): os traços que cada desenhista entregou com o desenho.
    case 'guardaRoupa': {
      // A moldura da cornija no tampo, a frente das portas, o encontro das duas folhas e os dois puxadores na beira.
      const frente = -hh + altura * 0.46
      const puxador = Math.min(largura, altura) * 0.14
      return [
        ...quadro(-hw * 0.86, -hh * 0.72, hw * 0.86, frente - altura * 0.12),
        linha(-hw, frente, hw),
        { x1: 0, y1: frente, x2: 0, y2: hh },
        ...aro(puxador, puxador, -puxador * 0.8, hh * 0.72),
        ...aro(puxador, puxador, puxador * 0.8, hh * 0.72),
      ]
    }
    case 'caldeirao': {
      // O bojo e o caldo (os dois aros, um nada para o fundo), a concha saindo pela beira da frente e as pontas das toras do fogo.
      const menor = Math.min(largura, altura)
      return [
        ...aro(menor * 0.66, menor * 0.66, 0, -hh * 0.05),
        ...aro(menor * 0.4, menor * 0.4, 0, -hh * 0.08),
        { x1: hw * 0.04, y1: 0, x2: hw * 0.6, y2: hh * 0.42 },
        { x1: hw * 0.7, y1: hh * 0.04, x2: hw * 0.95, y2: hh * 0.05 },
        { x1: -hw * 0.7, y1: -hh * 0.04, x2: -hw * 0.95, y2: -hh * 0.05 },
        { x1: hw * 0.32, y1: hh * 0.62, x2: hw * 0.41, y2: hh * 0.8 },
        { x1: -hw * 0.33, y1: hh * 0.62, x2: -hw * 0.42, y2: hh * 0.8 },
      ]
    }
    case 'fornoDePao': {
      // A cúpula redonda com a chaminé no fundo, o bloco da boca na frente com o vão em arco, e a soleira.
      const chamine = Math.min(largura, altura) * 0.058
      return [
        ...aro(largura * 0.77, altura * 0.77, 0, -altura * 0.105),
        ...quadro(-chamine, -altura * 0.33 - chamine, chamine, -altura * 0.33 + chamine),
        ...quadro(-hw * 0.5, hh * 0.43, hw * 0.5, hh * 0.83),
        ...aro(largura * 0.24, altura * 0.12, 0, altura * 0.365),
        linha(-hw * 0.54, hh * 0.9, hw * 0.54),
      ]
    }
    case 'prateleiraDeDeposito': {
      // A beira do tampo, os três montantes da frente e a carga entre eles: um pote redondo e um caixote em cada vão.
      const beira = -hh * 0.24
      const carga = Math.min(altura * 0.4, largura * 0.14)
      const naTabua = hh * 0.44
      return [
        linha(-hw, beira, hw),
        ...[-0.94, 0, 0.94].map((f) => ({ x1: hw * f, y1: beira, x2: hw * f, y2: hh })),
        ...[-1, 1].flatMap((lado) => [
          ...aro(carga, carga, lado * hw * 0.66, naTabua),
          ...quadro(lado * hw * 0.3 - carga / 2, naTabua - carga / 2, lado * hw * 0.3 + carga / 2, naTabua + carga / 2),
        ]),
      ]
    }
    case 'estatua': {
      // A moldura do pedestal e, dentro, a figura de cima: os ombros, a roda do elmo e a espada na frente dela (a lâmina e a guarda em cruz).
      const menor = Math.min(largura, altura)
      return [
        ...quadro(-hw * 0.72, -hh * 0.72, hw * 0.72, hh * 0.72),
        ...aro(menor * 0.34, menor * 0.16),
        ...aro(menor * 0.17, menor * 0.17, 0, -menor * 0.03),
        { x1: 0, y1: menor * 0.1, x2: 0, y2: menor * 0.2 },
        linha(-menor * 0.1, menor * 0.14, menor * 0.1),
      ]
    }
    case 'pedrasERochas':
      // A rocha grande, com a rachadura que desce do alto dela, e as duas médias, ao lado e na frente.
      return [
        ...fechado([[-hw * 0.72, -hh * 0.86], [-hw * 0.2, -hh * 0.94], [hw * 0.2, -hh * 0.56], [hw * 0.22, hh * 0.1], [-hw * 0.12, hh * 0.56], [-hw * 0.66, hh * 0.44], [-hw * 0.92, -hh * 0.2]]),
        { x1: -hw * 0.46, y1: -hh * 0.7, x2: -hw * 0.36, y2: -hh * 0.2 },
        { x1: -hw * 0.36, y1: -hh * 0.2, x2: -hw * 0.3, y2: hh * 0.3 },
        ...fechado([[hw * 0.14, -hh * 0.5], [hw * 0.56, -hh * 0.78], [hw * 0.96, -hh * 0.5], [hw * 0.92, -hh * 0.06], [hw * 0.5, hh * 0.1]]),
        ...fechado([[-hw * 0.04, hh * 0.24], [hw * 0.34, hh * 0.1], [hw * 0.66, hh * 0.46], [hw * 0.5, hh * 0.9], [hw * 0.06, hh * 0.9], [-hw * 0.14, hh * 0.58]]),
      ]
    case 'mausoleu': {
      // O telhado de duas águas (a beira e a cumeeira no meio), os capitéis das quatro colunas dos cantos e os dois degraus da frente.
      const capitel = Math.min(largura, altura) * 0.045
      const [norte, sul] = [-hh * 0.93, hh * 0.64]
      const capiteis = [[-1, norte], [1, norte], [-1, sul], [1, sul]].flatMap(([lado, y]) => quadro(lado * hw * 0.9 - capitel, y - capitel, lado * hw * 0.9 + capitel, y + capitel))
      return [
        ...quadro(-hw * 0.8, norte, hw * 0.8, sul),
        { x1: 0, y1: norte, x2: 0, y2: sul },
        ...capiteis,
        linha(-hw * 0.4, hh * 0.78, hw * 0.4),
        linha(-hw * 0.48, hh * 0.93, hw * 0.48),
      ]
    }
    case 'alvoDeArcoEFlecha': {
      // Em pé, de frente: o disco com dois anéis e a mosca, os dois pés abertos do cavalete e a travessa.
      const menor = Math.min(largura, altura)
      const meio = -hh * 0.2
      return [
        ...aro(menor * 0.74, menor * 0.74, 0, meio),
        ...aro(menor * 0.44, menor * 0.44, 0, meio),
        ...aro(menor * 0.14, menor * 0.14, 0, meio),
        { x1: -hw * 0.5, y1: hh * 0.46, x2: -hw * 0.8, y2: hh * 0.92 },
        { x1: hw * 0.5, y1: hh * 0.46, x2: hw * 0.8, y2: hh * 0.92 },
        linha(-hw * 0.66, hh * 0.62, hw * 0.66),
      ]
    }
    // Lote 3 dos 95 objetos novos (11/11/2026): os traços que cada desenhista entregou com o desenho.
    case 'bancaDeFrutas': {
      // A divisa dos dois degraus, as divisas dos três caixotes do fundo, as duas abóboras na frente e a balança (os dois pratos e o travessão).
      const abobora = Math.min(altura * 0.36, largura * 0.17)
      const prato = Math.min(altura * 0.2, largura * 0.09)
      return [
        linha(-hw, -hh * 0.02, hw),
        { x1: -hw * 0.34, y1: -hh, x2: -hw * 0.34, y2: -hh * 0.02 },
        { x1: hw * 0.36, y1: -hh, x2: hw * 0.36, y2: -hh * 0.02 },
        ...aro(abobora, abobora, -hw * 0.78, hh * 0.46),
        ...aro(abobora, abobora, -hw * 0.42, hh * 0.5),
        ...aro(prato, prato, hw * 0.5, hh * 0.44),
        ...aro(prato, prato, hw * 0.84, hh * 0.44),
        linha(hw * 0.5, hh * 0.44, hw * 0.84),
      ]
    }
    case 'toldoListrado': {
      // As quatro estacas nos cantos, a beira do pano e as emendas das cinco listras, de cima a baixo.
      const estaca = Math.min(largura, altura) * 0.09
      return [
        ...[-1, 1].flatMap((sx) => [-1, 1].flatMap((sy) => aro(estaca, estaca, sx * hw * 0.88, sy * hh * 0.88))),
        ...quadro(-hw * 0.84, -hh * 0.78, hw * 0.84, hh * 0.78),
        ...[-0.5, -0.17, 0.17, 0.5].map((f) => ({ x1: hw * f, y1: -hh * 0.78, x2: hw * f, y2: hh * 0.78 })),
      ]
    }
    case 'bancadaDeFerramentas': {
      // As duas testeiras do tampo e a beira da frente, a morsa nela (os mordentes e a manivela) e o martelo largado em cima.
      const morsa = Math.min(largura, altura) * 0.16
      const beira = hh * 0.78
      return [
        { x1: -hw * 0.9, y1: -hh, x2: -hw * 0.9, y2: beira },
        { x1: hw * 0.9, y1: -hh, x2: hw * 0.9, y2: beira },
        linha(-hw, beira, hw),
        ...quadro(-hw * 0.5 - morsa, beira - morsa * 0.9, -hw * 0.5 + morsa, beira + morsa * 0.5),
        linha(-hw * 0.5 - morsa * 0.8, hh * 0.97, -hw * 0.5 + morsa * 0.8),
        { x1: hw * 0.02, y1: hh * 0.1, x2: hw * 0.5, y2: -hh * 0.42 },
        { x1: hw * 0.42, y1: -hh * 0.6, x2: hw * 0.6, y2: -hh * 0.26 },
      ]
    }
    case 'pedraDeAmolar':
      // O quadro do cavalete, a roda vista do alto (a tira atravessada), o eixo de ponta a ponta e a manivela na frente.
      return [
        ...quadro(-hw * 0.94, -hh * 0.62, hw * 0.94, hh * 0.62),
        ...quadro(-hw * 0.82, -hh * 0.18, hw * 0.82, hh * 0.18),
        { x1: 0, y1: -hh * 0.76, x2: 0, y2: -hh * 0.18 },
        { x1: 0, y1: hh * 0.18, x2: 0, y2: hh * 0.74 },
        linha(0, hh * 0.74, hw * 0.3),
        { x1: hw * 0.3, y1: hh * 0.74, x2: hw * 0.3, y2: hh * 0.98 },
      ]
    case 'suporteDeArmas': {
      // O quadro do cavalete, a espada (a lâmina e a guarda atravessada), a lança, o machado (o cabo e a lâmina de lado) e o escudo no pé.
      const escudo = Math.min(altura * 0.9, largura * 0.26)
      return [
        ...quadro(-hw * 0.96, -hh * 0.9, hw * 0.96, hh * 0.9),
        { x1: -hw * 0.62, y1: -hh * 0.7, x2: -hw * 0.62, y2: hh * 0.6 },
        linha(-hw * 0.74, -hh * 0.2, -hw * 0.5),
        { x1: -hw * 0.2, y1: -hh * 0.7, x2: -hw * 0.2, y2: hh * 0.6 },
        { x1: hw * 0.16, y1: -hh * 0.7, x2: hw * 0.16, y2: hh * 0.6 },
        ...fechado([[hw * 0.16, -hh * 0.6], [hw * 0.34, -hh * 0.7], [hw * 0.34, 0], [hw * 0.16, -hh * 0.14]]),
        ...aro(escudo, escudo * 0.4, hw * 0.64, hh * 0.56),
      ]
    }
    case 'espantalho':
      // Em pé, de frente: a copa e a aba larga do chapéu, a cabeça, a travessa dos braços, a camisa abrindo para baixo e o poste fincado no chão.
      return [
        ...quadro(-hw * 0.24, -hh * 0.98, hw * 0.24, -hh * 0.72),
        linha(-hw * 0.52, -hh * 0.72, hw * 0.52),
        ...aro(largura * 0.28, altura * 0.28, 0, -hh * 0.42),
        linha(-hw * 0.92, -hh * 0.1, hw * 0.92),
        { x1: -hw * 0.28, y1: -hh * 0.1, x2: -hw * 0.42, y2: hh * 0.46 },
        { x1: hw * 0.28, y1: -hh * 0.1, x2: hw * 0.42, y2: hh * 0.46 },
        linha(-hw * 0.42, hh * 0.46, hw * 0.42),
        { x1: 0, y1: hh * 0.46, x2: 0, y2: hh * 0.94 },
      ]
    case 'cocho':
      // A água na cova (a roda comprida), as duas beiras do tronco e as pontas dos dois pés saindo dos lados.
      return [
        ...aro(largura * 0.82, altura * 0.46),
        linha(-hw * 0.96, -hh * 0.74, hw * 0.96),
        linha(-hw * 0.96, hh * 0.74, hw * 0.96),
        ...[-0.6, 0.6].flatMap((f) => [
          { x1: hw * f, y1: -hh, x2: hw * f, y2: -hh * 0.74 },
          { x1: hw * f, y1: hh * 0.74, x2: hw * f, y2: hh },
        ]),
      ]
    case 'ossos': {
      // O crânio no canto, com as duas órbitas; a coluna saindo dele, com três costelas atravessadas; e dois ossos compridos soltos.
      const menor = Math.min(largura, altura)
      const [cx, cy] = [-hw + menor * 0.2, -hh + menor * 0.29]
      return [
        ...aro(menor * 0.36, menor * 0.4, cx, cy),
        ...aro(menor * 0.09, menor * 0.09, cx - menor * 0.07, cy + menor * 0.02),
        ...aro(menor * 0.09, menor * 0.09, cx + menor * 0.07, cy + menor * 0.02),
        { x1: cx + menor * 0.2, y1: cy + menor * 0.14, x2: hw * 0.36, y2: hh * 0.2 },
        ...[0.3, 0.44, 0.58].map((f) => ({ x1: cx + menor * f, y1: -hh * 0.46, x2: cx + menor * f, y2: hh * 0.34 })),
        { x1: hw * 0.5, y1: hh * 0.08, x2: hw * 0.9, y2: -hh * 0.68 },
        { x1: -hw * 0.5, y1: hh * 0.82, x2: hw * 0.2, y2: hh * 0.74 },
      ]
    }
    case 'antenaParabolica': {
      // O prato inclinado (a elipse torta), as quatro hastes que se encontram no receptor, fora do meio, a base com o mastro atrás do aro e o cabo.
      const menor = Math.min(largura, altura)
      const naBoca = (m: number, n: number): [number, number] => [menor * (0.02 + 0.386 * m - 0.161 * n), menor * (-0.12 + 0.223 * m + 0.278 * n)]
      const [fx, fy] = naBoca(0, -0.43)
      const [bx, by] = naBoca(0, 1.26)
      const base = menor * 0.12
      return [
        ...fechado(Array.from({ length: 16 }, (_v, i) => naBoca(Math.cos((Math.PI * i) / 8), Math.sin((Math.PI * i) / 8)))),
        ...[0.87, 2.27, 4.01, 5.41].map((a) => {
          const [x1, y1] = naBoca(Math.cos(a), Math.sin(a))
          return { x1, y1, x2: fx, y2: fy }
        }),
        ...aro(menor * 0.08, menor * 0.08, fx, fy),
        ...quadro(bx - base, by - base, bx + base, by + base),
        { x1: bx + base, y1: by + base * 0.5, x2: menor * 0.46, y2: menor * 0.46 },
      ]
    }
    // Lote 4 dos 95 objetos novos (11/11/2026): os traços que cada desenhista entregou com o desenho.
    case 'escrivaninha': {
      // O forro de couro por dentro da moldura do tampo, o livro aberto (as duas páginas e a lombada) e o tinteiro com a pena no canto.
      const menor = Math.min(largura, altura)
      return [
        ...quadro(-hw + menor * 0.16, -hh + menor * 0.16, hw - menor * 0.16, hh - menor * 0.16),
        ...quadro(-hw * 0.58, -hh * 0.28, hw * 0.02, hh * 0.44),
        { x1: -hw * 0.28, y1: -hh * 0.28, x2: -hw * 0.28, y2: hh * 0.44 },
        ...aro(menor * 0.16, menor * 0.16, hw * 0.5, -hh * 0.34),
        { x1: hw * 0.5, y1: -hh * 0.34, x2: hw * 0.74, y2: -hh * 0.56 },
      ]
    }
    case 'criadoMudo': {
      // O pires com a vela (os dois aros) no canto do fundo, o livro fechado, torto, no da frente e o puxador da gaveta na beira.
      const menor = Math.min(largura, altura)
      return [
        ...aro(menor * 0.36, menor * 0.36, -hw * 0.36, -hh * 0.34),
        ...aro(menor * 0.14, menor * 0.14, -hw * 0.36, -hh * 0.34),
        ...fechado([[hw * 0.02, hh * 0.2], [hw * 0.74, hh * 0.04], [hw * 0.84, hh * 0.56], [hw * 0.12, hh * 0.72]]),
        linha(-hw * 0.14, hh * 0.9, hw * 0.14),
      ]
    }
    case 'camaDeCasal': {
      // A cabeceira no fundo, os dois travesseiros lado a lado, a dobra do lençol (as duas beiras dela) e a peseira na frente.
      const cabeceira = -hh + altura * 0.09
      const fimDosTravesseiros = cabeceira + altura * 0.22
      return [
        linha(-hw, cabeceira, hw),
        ...quadro(-hw * 0.86, cabeceira + altura * 0.02, -hw * 0.04, fimDosTravesseiros),
        ...quadro(hw * 0.04, cabeceira + altura * 0.02, hw * 0.86, fimDosTravesseiros),
        linha(-hw * 0.94, fimDosTravesseiros + altura * 0.05, hw * 0.94),
        linha(-hw * 0.94, fimDosTravesseiros + altura * 0.16, hw * 0.94),
        linha(-hw, hh - altura * 0.07, hw),
      ]
    }
    case 'berco': {
      // A cabeceira à esquerda, o travesseiro junto dela, a dobra da manta e as ripas das duas grades.
      const cabeceira = -hw + largura * 0.16
      const ripa = altura * 0.14
      return [
        { x1: cabeceira, y1: -hh * 0.8, x2: cabeceira, y2: hh * 0.8 },
        ...quadro(cabeceira + largura * 0.05, -hh * 0.42, cabeceira + largura * 0.2, hh * 0.42),
        { x1: hw * 0.1, y1: -hh * 0.62, x2: hw * 0.1, y2: hh * 0.62 },
        ...[-0.25, 0.15, 0.55].flatMap((f) => [
          { x1: hw * f, y1: -hh * 0.8, x2: hw * f, y2: -hh * 0.8 + ripa },
          { x1: hw * f, y1: hh * 0.8 - ripa, x2: hw * f, y2: hh * 0.8 },
        ]),
      ]
    }
    case 'banqueta': {
      // O assento no meio, os três pés saindo por baixo dele (um para a frente, dois para trás) e as travessas em triângulo.
      const R = Math.min(largura, altura) / 2
      const pes = [Math.PI / 2, -Math.PI / 6, (7 * Math.PI) / 6].map((a): readonly [number, number] => [Math.cos(a), Math.sin(a)])
      return [
        ...aro(R * 0.92, R * 0.92),
        ...pes.map(([x, y]) => ({ x1: x * R * 0.46, y1: y * R * 0.46, x2: x * R * 0.96, y2: y * R * 0.96 })),
        ...fechado(pes.map(([x, y]): readonly [number, number] => [x * R * 0.78, y * R * 0.78])),
      ]
    }
    case 'biombo': {
      // As quatro folhas em ziguezague, de ponta a ponta, e a pinha do montante de cada ponta.
      const dobras = [0, 1, 2, 3, 4].map((j): readonly [number, number] => [-hw * 0.94 + (largura * 0.94 * j) / 4, (j % 2 === 0 ? -1 : 1) * hh * 0.8])
      // A pinha tem teto pela largura: no biombo esticado estreito e alto ela não sai da caixa (a ponta fica a
      // 0,03 da largura da beira); no tamanho de partida manda o lado menor.
      const pinha = Math.min(Math.min(largura, altura) * 0.16, largura * 0.05)
      return [
        ...dobras.slice(1).map(([x2, y2], j) => ({ x1: dobras[j][0], y1: dobras[j][1], x2, y2 })),
        ...aro(pinha, pinha, dobras[0][0], dobras[0][1]),
        ...aro(pinha, pinha, dobras[4][0], dobras[4][1]),
      ]
    }
    case 'piano': {
      // A beira da tampa e a do teclado, as teclas pretas em grupos de duas e de três penduradas na primeira, e o banquinho redondo na frente.
      const tampa = -hh + altura * 0.42
      const teclado = -hh + altura * 0.62
      const banquinho = Math.min(altura * 0.3, largura * 0.4)
      return [
        linha(-hw, tampa, hw),
        linha(-hw, teclado, hw),
        ...[-0.66, -0.42, -0.02, 0.22, 0.46].map((f) => ({ x1: hw * f, y1: tampa, x2: hw * f, y2: tampa + altura * 0.12 })),
        ...aro(banquinho, banquinho, 0, hh - banquinho / 2),
      ]
    }
    case 'candelabroDeChao': {
      // O mastro no meio, as cinco velas em anel em volta dele e os dois pés da frente, abertos, saindo por baixo.
      const menor = Math.min(largura, altura)
      const anel = menor * 0.32
      return [
        ...aro(menor * 0.12, menor * 0.12),
        ...[0, 1, 2, 3, 4].flatMap((i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
          return aro(menor * 0.2, menor * 0.2, anel * Math.cos(a), anel * Math.sin(a))
        }),
        { x1: menor * 0.06, y1: menor * 0.02, x2: menor * 0.44, y2: menor * 0.16 },
        { x1: -menor * 0.06, y1: menor * 0.02, x2: -menor * 0.44, y2: menor * 0.16 },
      ]
    }
    case 'banheira':
      // A beira da água (o oval por dentro da borda), a bica da torneira na ponta direita e a toalha dobrada na borda da frente.
      return [
        ...aro(largura * 0.8, altura * 0.62),
        linha(hw * 0.58, 0, hw * 0.94),
        ...quadro(-hw * 0.5, hh * 0.68, -hw * 0.18, hh * 0.98),
      ]
    case 'tinaDeMadeira': {
      // A tina redonda no canto do fundo (a boca e a beira da água), a escova atravessada na borda e o banquinho de dois degraus colado nela, do lado do canto da frente.
      const menor = Math.min(largura, altura)
      const raio = menor * 0.43
      const cx = -hw + raio + menor * 0.01
      const cy = -hh + raio + menor * 0.01
      const ate = Math.hypot(hw - cx, hh - cy) || 1
      const ux = (hw - cx) / ate
      const uy = (hh - cy) / ate
      const perto = raio + menor * 0.035
      const longe = perto + menor * 0.176
      const meio = menor * 0.107
      const noBanco = (ao: number, lado: number): [number, number] => [cx + ux * ao - uy * lado, cy + uy * ao + ux * lado]
      const [dx1, dy1] = noBanco((perto + longe) / 2, -meio)
      const [dx2, dy2] = noBanco((perto + longe) / 2, meio)
      return [
        ...aro(raio * 2, raio * 2, cx, cy),
        ...aro(raio * 1.4, raio * 1.4, cx, cy),
        { x1: cx + raio * 0.3, y1: cy - raio * 0.24, x2: cx + raio * 0.72, y2: cy - raio * 0.56 },
        ...fechado([noBanco(perto, -meio), noBanco(perto, meio), noBanco(longe, meio), noBanco(longe, -meio)]),
        { x1: dx1, y1: dy1, x2: dx2, y2: dy2 },
      ]
    }
    case 'lavatorioComJarro': {
      // O espaldar no fundo, a bacia à esquerda (a borda e a água), o jarro à direita com a asa e a barra da toalha na frente.
      const bacia = Math.min(altura * 0.66, largura * 0.42)
      const jarro = bacia * 0.62
      const xJarro = hw * 0.43
      const yJarro = -hh * 0.18
      return [
        linha(-hw, -hh * 0.8, hw),
        ...aro(bacia, bacia, -hw * 0.5, -hh * 0.06),
        ...aro(bacia * 0.6, bacia * 0.6, -hw * 0.5, -hh * 0.06),
        ...aro(jarro, jarro, xJarro, yJarro),
        { x1: xJarro + jarro * 0.46, y1: yJarro + jarro * 0.2, x2: xJarro + jarro * 0.72, y2: yJarro + jarro * 0.3 },
        linha(-hw * 0.54, hh * 0.86, hw * 0.54),
      ]
    }
    case 'prateleiraDePotes': {
      // A ripa de fundo, rente à parede, e a fileira de potes vistos pela boca, um maior e um menor.
      const pote = Math.min(altura * 0.56, largura * 0.14)
      return [
        linha(-hw, -hh * 0.62, hw),
        ...[-0.76, -0.38, 0, 0.38, 0.76].flatMap((f, i) => aro(pote * (i % 2 === 0 ? 1 : 0.7), pote * (i % 2 === 0 ? 1 : 0.7), hw * f, hh * 0.16)),
      ]
    }
    case 'mesaDeCorte': {
      // A beira do bloco, o peixe no meio (o corpo e o rabo em V), o cutelo cravado no canto (a lâmina e o cabo) e o pano na quina da frente.
      const menor = Math.min(largura, altura)
      return [
        ...quadro(-hw * 0.94, -hh * 0.92, hw * 0.94, hh * 0.92),
        ...aro(largura * 0.4, menor * 0.2, -hw * 0.1, -hh * 0.18),
        { x1: -hw * 0.5, y1: -hh * 0.18, x2: -hw * 0.66, y2: -hh * 0.36 },
        { x1: -hw * 0.5, y1: -hh * 0.18, x2: -hw * 0.66, y2: 0 },
        ...fechado([[hw * 0.3, -hh * 0.52], [hw * 0.62, -hh * 0.72], [hw * 0.68, -hh * 0.56], [hw * 0.36, -hh * 0.36]]),
        { x1: hw * 0.65, y1: -hh * 0.64, x2: hw * 0.88, y2: -hh * 0.8 },
        ...quadro(-hw * 0.86, hh * 0.38, -hw * 0.44, hh * 0.84),
      ]
    }
    case 'ganchoComCarne': {
      // A trave de ponta a ponta entre as duas sapatas atravessadas e, pendurados na frente dela, o presunto, os gomos da linguiça e a ave.
      const peca = Math.min(altura * 0.44, largura * 0.16)
      return [
        ...quadro(-hw * 0.96, -hh * 0.2, hw * 0.96, hh * 0.06),
        { x1: -hw * 0.9, y1: -hh * 0.94, x2: -hw * 0.9, y2: hh * 0.94 },
        { x1: hw * 0.9, y1: -hh * 0.94, x2: hw * 0.9, y2: hh * 0.94 },
        ...aro(peca * 1.3, peca, -hw * 0.5, hh * 0.5),
        ...[-0.14, 0.04, 0.22].flatMap((f) => aro(peca * 0.5, peca * 0.5, hw * f, hh * 0.36)),
        ...aro(peca, peca * 0.8, hw * 0.56, hh * 0.46),
      ]
    }
    case 'pilhaDeCaixas':
      // O caixote comprido do fundo, o grande da frente com o amarrado torto em cima dele e o da direita com os sarrafos em cruz.
      return [
        ...quadro(-hw * 0.62, -hh * 0.9, hw * 0.76, -hh * 0.28),
        ...quadro(-hw * 0.92, -hh * 0.16, hw * 0.04, hh * 0.86),
        ...fechado([[-hw * 0.84, hh * 0.18], [-hw * 0.3, hh * 0.02], [-hw * 0.14, hh * 0.56], [-hw * 0.68, hh * 0.72]]),
        ...quadro(hw * 0.14, -hh * 0.1, hw * 0.88, hh * 0.62),
        { x1: hw * 0.14, y1: -hh * 0.1, x2: hw * 0.88, y2: hh * 0.62 },
        { x1: hw * 0.88, y1: -hh * 0.1, x2: hw * 0.14, y2: hh * 0.62 },
      ]
    case 'barrisDeitados': {
      // Os três barris lado a lado (o dorso bojudo de cada um), o aro perto de cada ponta e a torneira saindo da frente.
      const meio = largura / 3
      return [-1, 0, 1].flatMap((k) => [
        ...aro(meio * 0.9, altura * 0.8, k * meio, -hh * 0.12),
        linha(k * meio - meio * 0.36, -hh * 0.56, k * meio + meio * 0.36),
        linha(k * meio - meio * 0.36, hh * 0.32, k * meio + meio * 0.36),
        { x1: k * meio, y1: hh * 0.68, x2: k * meio, y2: hh * 0.96 },
      ])
    }
    case 'tonelDeAdega':
      // O bojo comprido, os aros largos atravessados (quatro riscos), o batoque no alto e, na frente, a torneira e a escadinha.
      return [
        ...aro(largura * 0.86, altura * 0.86, 0, -hh * 0.1),
        ...[-0.66, -0.36, 0.16, 0.46].map((f) => linha(-hw * 0.62, hh * f, hw * 0.62)),
        ...aro(largura * 0.1, largura * 0.1, 0, -hh * 0.1),
        { x1: 0, y1: hh * 0.76, x2: 0, y2: hh * 0.96 },
        ...quadro(hw * 0.28, hh * 0.8, hw * 0.56, hh * 0.98),
      ]
    case 'anforasDeBarro': {
      // As três em pé (a roda do bojo e a boca no meio de cada uma) e a tombada na frente: o pé em ponta, o bojo, o pescoço fino e a boca.
      const menor = Math.min(largura, altura)
      const emPe: readonly (readonly [number, number, number])[] = [[-0.44, -0.42, 0.5], [0.47, -0.52, 0.4], [0.66, 0.13, 0.3]]
      return [
        ...emPe.flatMap(([x, y, r]) => [...aro(menor * r, menor * r, hw * x, hh * y), ...aro(menor * r * 0.36, menor * r * 0.36, hw * x, hh * y)]),
        ...fechado([[-hw * 0.9, hh * 0.62], [-hw * 0.24, hh * 0.3], [hw * 0.18, hh * 0.5], [hw * 0.66, hh * 0.52], [hw * 0.66, hh * 0.64], [hw * 0.18, hh * 0.68], [-hw * 0.24, hh * 0.9]]),
      ]
    }
    case 'cestoDeVime': {
      // A borda por dentro da parede, as duas alças em orelha (três traços de cada lado) e três maçãs no meio.
      const maca = Math.min(largura, altura) * 0.2
      return [
        ...aro(largura * 0.54, altura * 0.54),
        ...[-1, 1].flatMap((lado) => [
          { x1: lado * hw * 0.78, y1: -hh * 0.36, x2: lado * hw * 0.96, y2: -hh * 0.2 },
          { x1: lado * hw * 0.96, y1: -hh * 0.2, x2: lado * hw * 0.96, y2: hh * 0.2 },
          { x1: lado * hw * 0.96, y1: hh * 0.2, x2: lado * hw * 0.78, y2: hh * 0.36 },
        ]),
        ...aro(maca, maca, -maca * 0.46, -maca * 0.3),
        ...aro(maca, maca, maca * 0.5, -maca * 0.26),
        ...aro(maca, maca, 0, maca * 0.52),
      ]
    }
    case 'cofre': {
      // A moldura rebitada do tampo, a frente do corpo e a da porta saliente, a roda de segredo vista de cutelo (o eixo e a barra) e a bola da alavanca.
      const corpo = hh - altura * 0.19
      const porta = hh - altura * 0.105
      const bola = Math.min(largura, altura) * 0.07
      return [
        ...quadro(-hw * 0.8, -hh * 0.8, hw * 0.8, corpo - altura * 0.1),
        linha(-hw, corpo, hw),
        linha(-hw * 0.87, porta, hw * 0.87),
        { x1: hw * 0.09, y1: porta, x2: hw * 0.09, y2: hh * 0.95 },
        linha(-hw * 0.26, hh * 0.95, hw * 0.44),
        ...aro(bola, bola, -hw * 0.72, hh * 0.87),
      ]
    }
    case 'varalDeRoupa': {
      // Os dois postes nas pontas, a corda entre eles e as quatro roupas penduradas nela, de tamanhos desiguais (a calça com o vão das pernas).
      const corda = -hh * 0.5
      const poste = Math.min(altura * 0.36, largura * 0.08)
      return [
        ...aro(poste, poste, -hw + poste / 2, corda),
        ...aro(poste, poste, hw - poste / 2, corda),
        linha(-hw + poste, corda, hw - poste),
        ...quadro(-hw * 0.74, corda, -hw * 0.34, hh * 0.3),
        ...quadro(-hw * 0.26, corda, hw * 0.2, hh * 0.9),
        ...quadro(hw * 0.28, corda, hw * 0.5, hh * 0.72),
        { x1: hw * 0.39, y1: hh * 0.1, x2: hw * 0.39, y2: hh * 0.72 },
        ...quadro(hw * 0.58, corda, hw * 0.8, hh * 0.24),
      ]
    }
    case 'horta': {
      // A beira direita do canteiro (o resto é a silhueta), os sulcos entre as leiras, os repolhos na leira do fundo e o regador ao lado, com o bico para o fundo.
      const beira = hw * 0.7
      const repolho = Math.min(altura * 0.2, largura * 0.14)
      const regador = Math.min(altura * 0.16, largura * 0.11)
      return [
        { x1: beira, y1: -hh, x2: beira, y2: hh },
        ...[-0.5, 0, 0.5].map((f) => linha(-hw, hh * f, beira)),
        ...[-0.72, -0.3, 0.12].flatMap((f) => aro(repolho, repolho, hw * f, -hh * 0.75)),
        ...aro(regador, regador, hw * 0.85, hh * 0.42),
        { x1: hw * 0.85, y1: hh * 0.42 - regador / 2, x2: hw * 0.85, y2: -hh * 0.05 },
      ]
    }
    case 'canteiroDeFlores': {
      // A beira de dentro da borda de pedras (a de fora é a silhueta, em elipse) e quatro moitas redondas, de tamanhos desiguais, espalhadas na terra.
      const menor = Math.min(largura, altura)
      return [
        ...aro(largura * 0.8, altura * 0.74),
        ...aro(menor * 0.3, menor * 0.3, -hw * 0.42, -hh * 0.2),
        ...aro(menor * 0.28, menor * 0.28, hw * 0.34, -hh * 0.22),
        ...aro(menor * 0.3, menor * 0.3, hw * 0.1, hh * 0.3),
        ...aro(menor * 0.22, menor * 0.22, -hw * 0.34, hh * 0.36),
      ]
    }
    case 'muroBaixoDePedra': {
      // Ao longo do lado maior (como a imagem): as duas beiras da capa de lajes, de ponta a ponta, e as juntas entre as lajes, cada uma inclinada para um lado (a ponte de pedra tem as bordas rentes à beira e um fecho só, a prumo; o banco tem os braços e três ripas).
      const deitado = largura >= altura
      const meioC = deitado ? hw : hh
      const meiaL = deitado ? hh : hw
      const traco = (u1: number, v1: number, u2: number, v2: number): Traco => (deitado ? { x1: u1, y1: v1, x2: u2, y2: v2 } : { x1: v1, y1: u1, x2: v2, y2: u2 })
      const capa = meiaL * 0.5
      const lajes = Math.max(2, Math.round((2 * meioC) / (Math.min(largura, altura) * 0.8)))
      const juntas: Traco[] = []
      for (let i = 1; i < lajes; i += 1) {
        const u = -meioC + (2 * meioC * i) / lajes
        const inclina = (i % 2 === 0 ? 1 : -1) * capa * 0.3
        juntas.push(traco(u - inclina, -capa, u + inclina, capa))
      }
      return [traco(-meioC, -capa, meioC, -capa), traco(-meioC, capa, meioC, capa), ...juntas]
    }
    case 'tocoDeArvore': {
      // A casca e o topo serrado (os dois aros, um dentro do outro), o anel do miolo um pouco fora do centro com a rachadura saindo dele, e quatro raízes abrindo da casca para o chão (o moinho de torre são três aros certinhos, sem raiz nem rachadura).
      const menor = Math.min(largura, altura)
      const raiz = (ang: number): Traco => ({ x1: Math.cos(ang) * menor * 0.29, y1: Math.sin(ang) * menor * 0.29, x2: Math.cos(ang + 0.12) * menor * 0.47, y2: Math.sin(ang + 0.12) * menor * 0.47 })
      return [
        ...aro(menor * 0.57, menor * 0.57),
        ...aro(menor * 0.45, menor * 0.45),
        ...aro(menor * 0.2, menor * 0.2, -menor * 0.02, menor * 0.02),
        { x1: -menor * 0.02, y1: menor * 0.02, x2: menor * 0.11, y2: menor * 0.2 },
        ...[-2.55, -0.2, 1, 2.55].map((ang) => raiz(ang)),
      ]
    }
    case 'carrinhoDeMao':
      // A caçamba (mais larga atrás), os dois cabos saindo para trás, os varais fechando na frente e, entre eles, a roda atravessada pelo eixo.
      return [
        ...fechado([[-hw * 0.55, -hh * 0.93], [hw * 0.45, -hh * 0.74], [hw * 0.45, hh * 0.74], [-hw * 0.55, hh * 0.93]]),
        { x1: -hw * 0.98, y1: -hh * 0.72, x2: -hw * 0.55, y2: -hh * 0.62 },
        { x1: -hw * 0.98, y1: hh * 0.72, x2: -hw * 0.55, y2: hh * 0.62 },
        { x1: hw * 0.45, y1: -hh * 0.4, x2: hw * 0.82, y2: -hh * 0.33 },
        { x1: hw * 0.45, y1: hh * 0.4, x2: hw * 0.82, y2: hh * 0.33 },
        ...quadro(hw * 0.5, -hh * 0.16, hw * 0.98, hh * 0.16),
        { x1: hw * 0.74, y1: -hh * 0.44, x2: hw * 0.74, y2: hh * 0.44 },
      ]
    case 'placaDeLoja':
      // De frente: o poste numa ponta, o braço saindo do alto dele com a mão-francesa, as duas correntes e a tabuleta pendurada, de cantos de baixo chanfrados.
      return [
        { x1: -hw * 0.8, y1: -hh, x2: -hw * 0.8, y2: hh },
        linha(-hw * 0.8, -hh * 0.72, hw * 0.92),
        { x1: -hw * 0.8, y1: hh * 0.1, x2: -hw * 0.3, y2: -hh * 0.72 },
        { x1: 0, y1: -hh * 0.72, x2: 0, y2: -hh * 0.36 },
        { x1: hw * 0.7, y1: -hh * 0.72, x2: hw * 0.7, y2: -hh * 0.36 },
        ...fechado([[-hw * 0.14, -hh * 0.36], [hw * 0.84, -hh * 0.36], [hw * 0.84, hh * 0.6], [hw * 0.68, hh * 0.9], [hw * 0.02, hh * 0.9], [-hw * 0.14, hh * 0.6]]),
      ]
    case 'cruzDeMadeira': {
      // Em pé, de frente: o poste e a travessa larga no alto (a cruz em T), a coroa de flores pendurada no cruzamento e o monte de terra no pé (o espantalho tem o chapéu e a cabeça; a lápide é um risco só).
      const menor = Math.min(largura, altura)
      return [
        ...quadro(-hw * 0.12, -hh * 0.94, hw * 0.12, hh * 0.62),
        ...quadro(-hw * 0.86, -hh * 0.84, hw * 0.86, -hh * 0.6),
        ...aro(menor * 0.36, menor * 0.36, 0, -hh * 0.24),
        ...aro(largura * 0.92, altura * 0.28, 0, hh * 0.72),
      ]
    }
    case 'anjoDePedra': {
      // Em pé, de frente: as duas asas fechadas subindo acima da cabeça baixa, o manto abrindo até o pé e o pedestal com a placa (a estátua é vista de cima, com a espada e sem asas).
      const menor = Math.min(largura, altura)
      return [
        ...fechado([[-hw * 0.18, -hh * 0.36], [-hw * 0.42, -hh * 0.98], [-hw * 0.8, -hh * 0.62], [-hw * 0.62, hh * 0.22]]),
        ...fechado([[hw * 0.18, -hh * 0.36], [hw * 0.42, -hh * 0.98], [hw * 0.8, -hh * 0.62], [hw * 0.62, hh * 0.22]]),
        ...aro(menor * 0.2, menor * 0.2, 0, -hh * 0.5),
        ...fechado([[-hw * 0.18, -hh * 0.34], [hw * 0.18, -hh * 0.34], [hw * 0.32, hh * 0.26], [-hw * 0.32, hh * 0.26]]),
        ...quadro(-hw * 0.72, hh * 0.26, hw * 0.72, hh * 0.96),
        linha(-hw * 0.36, hh * 0.6, hw * 0.36),
      ]
    }
    case 'cercaDeFerro': {
      // Ao longo do lado maior (como a imagem): um pilarete quadrado em cada ponta, a travessa entre eles e as barras atravessadas nela (o arco do portão tem postes compridos e a trave sem barras; o muro baixo, as duas beiras da capa com as juntas tortas).
      const deitada = largura >= altura
      const meioC = deitada ? hw : hh
      const meiaL = deitada ? hh : hw
      const traco = (u1: number, v1: number, u2: number, v2: number): Traco => (deitada ? { x1: u1, y1: v1, x2: u2, y2: v2 } : { x1: v1, y1: u1, x2: v2, y2: u2 })
      const p = meiaL * 0.9
      const pilarete = (u: number): Traco[] => [traco(u - p, -p, u + p, -p), traco(u + p, -p, u + p, p), traco(u + p, p, u - p, p), traco(u - p, p, u - p, -p)]
      const barras = Math.max(3, Math.round((2 * meioC - 4 * p) / (meiaL * 1.2)))
      const vao = (2 * meioC - 4 * p) / (barras + 1)
      return [
        ...pilarete(-meioC + p),
        ...pilarete(meioC - p),
        traco(-meioC + 2 * p, 0, meioC - 2 * p, 0),
        ...Array.from({ length: barras }, (_, i) => -meioC + 2 * p + vao * (i + 1)).map((u) => traco(u, -meiaL * 0.55, u, meiaL * 0.55)),
      ]
    }
    case 'paCravada': {
      // De frente, como a imagem: a meia-lua do monte de terra sobre a linha do chão, a lâmina saindo do alto dele, o cabo e o punho em D (a cova é um oval com o risco no meio; a lápide, uma linha só).
      const chao = hh * 0.72
      const monte = aro(largura * 0.88, altura * 0.66, 0, chao).filter((t) => Math.max(t.y1, t.y2) <= chao + 0.5)
      return [
        linha(-hw * 0.95, chao, hw * 0.95),
        ...monte,
        ...quadro(-hw * 0.15, -hh * 0.3, hw * 0.15, hh * 0.08),
        { x1: 0, y1: -hh * 0.3, x2: 0, y2: -hh * 0.72 },
        ...fechado([[-hw * 0.16, -hh * 0.95], [hw * 0.16, -hh * 0.95], [0, -hh * 0.72]]),
      ]
    }
    case 'velasEOferendas': {
      // O pano no meio com a tigela e o pão, e as sete velas em roda, cada uma um aro pequeno (o candelabro de chão tem o mastro no meio e cinco velas iguais em anel; o altar, o tampo, o degrau e o pano atravessado).
      const menor = Math.min(largura, altura)
      const velas: readonly (readonly [number, number])[] = [[-0.71, -0.56], [0.03, -0.71], [0.67, -0.54], [0.76, 0.19], [0.45, 0.69], [-0.32, 0.73], [-0.76, 0.15]]
      return [
        ...quadro(-hw * 0.61, -hh * 0.49, hw * 0.59, hh * 0.57),
        ...aro(menor * 0.21, menor * 0.21, -hw * 0.2, -hh * 0.14),
        ...aro(menor * 0.2, menor * 0.17, hw * 0.22, hh * 0.06),
        ...velas.flatMap(([fx, fy]) => aro(menor * 0.08, menor * 0.08, fx * hw, fy * hh)),
      ]
    }
    case 'arvoreSeca': {
      // De cima: o nó do tronco no meio, com o oco, cinco galhos abrindo em estrela desigual até a borda, cada um com a forquilha na ponta, e um sexto quebrado, curto (o toco de árvore tem os aros do topo serrado e quatro raízes curtas).
      // A estrela inteira em 0,89 do menor lado: a forquilha do galho mais longo chega a 0,56 dele e passava da pegada (0,15 px na pegada estreita de 40 x 80; até 4 px no tamanho de partida); assim cabe no círculo inscrito.
      const menor = Math.min(largura, altura) * 0.89
      const em = (ang: number, r: number): [number, number] => [Math.cos(ang) * menor * r, Math.sin(ang) * menor * r]
      const galho = (ang: number, alcance: number): Traco[] => {
        const [[x0, y0], [x1, y1]] = [em(ang, 0.1), em(ang, alcance)]
        const dente = (lado: number): Traco => ({ x1, y1, x2: x1 + em(ang + lado * 0.5, 0.1)[0], y2: y1 + em(ang + lado * 0.5, 0.1)[1] })
        return [{ x1: x0, y1: y0, x2: x1, y2: y1 }, dente(-1), dente(1)]
      }
      return [
        ...aro(menor * 0.2, menor * 0.2),
        ...aro(menor * 0.07, menor * 0.07),
        ...[[-1.95, 0.44], [-0.8, 0.47], [0.25, 0.42], [1.3, 0.46], [2.2, 0.41]].flatMap(([ang, alcance]) => galho(ang, alcance)),
        galho(2.95, 0.24)[0],
      ]
    }
    case 'balancaDeMercador': {
      // A beira do caixote, os dois pratos grandes com o travessão de um gancho ao outro, o pé redondo da coluna no meio e a escadinha de quatro pesos, do maior ao menor, na frente (a balancinha da banca de frutas é um detalhe pequeno num canto dela, sem pé nem pesos).
      const prato = Math.min(largura * 0.29, altura * 0.42)
      const peso = Math.min(largura * 0.118, altura * 0.168)
      return [
        ...quadro(-hw * 0.96, -hh * 0.92, hw * 0.96, hh * 0.92),
        ...aro(prato, prato, -hw * 0.57, -hh * 0.13),
        ...aro(prato, prato, hw * 0.57, -hh * 0.13),
        linha(-hw * 0.57, -hh * 0.13, hw * 0.57),
        ...aro(prato * 0.63, prato * 0.63, 0, -hh * 0.13),
        ...[1, 0.85, 0.7, 0.55].flatMap((f, i) => aro(peso * f, peso * f, -hw * (0.63 - i * 0.23), hh * 0.61)),
      ]
    }
    case 'tendaDeAdivinha': {
      // A beira redonda do telhado, as emendas dos doze gomos até o mastro no meio, as quatro cordas até as estacas dos cantos e o tapete que sai da porta, ao sul (o toldo é um quadro listrado com as estacas nos cantos, sem círculo).
      const emenda = (i: number): number => Math.PI / 2 + Math.PI / 12 + (i * Math.PI) / 6
      return [
        ...aro(largura * 0.86, altura * 0.86),
        ...Array.from({ length: 12 }, (_, i) => ({ x1: 0, y1: 0, x2: hw * 0.86 * Math.cos(emenda(i)), y2: hh * 0.86 * Math.sin(emenda(i)) })),
        ...[-1, 1].flatMap((sx) => [-1, 1].map((sy) => ({ x1: sx * hw * 0.61, y1: sy * hh * 0.61, x2: sx * hw * 0.92, y2: sy * hh * 0.92 }))),
        ...quadro(-hw * 0.11, hh * 0.84, hw * 0.11, hh * 0.97),
      ]
    }
    case 'gaiolaComAves': {
      // A beira da gaiola, as duas ripas compridas e a travessa do teto (seis vãos), as três galinhas vistas de cima nos vãos, a gaiolinha dos pombos no canto de trás e o cocho comprido na frente (a grade sem as aves e a gaiolinha lia como um engradado).
      const galinhas: readonly (readonly [number, number])[] = [[-0.44, 0], [0.44, 0], [-0.41, 0.55]]
      return [
        ...quadro(-hw * 0.93, -hh * 0.88, hw * 0.93, hh * 0.88),
        linha(-hw * 0.93, -hh * 0.29, hw * 0.93),
        linha(-hw * 0.93, hh * 0.29, hw * 0.93),
        { x1: 0, y1: -hh * 0.88, x2: 0, y2: hh * 0.88 },
        ...galinhas.flatMap(([fx, fy]) => aro(hw * 0.5, hh * 0.33, hw * fx, hh * fy)),
        ...quadro(hw * 0.11, -hh * 0.86, hw * 0.82, -hh * 0.16),
        ...quadro(hw * 0.19, hh * 0.44, hw * 0.67, hh * 0.59),
      ]
    }
    case 'rolosDeTecido': {
      // A mesa baixa com a pilha (as divisas de três rolos), o pano que cai da beira e se amontoa no chão, o caixote com os dois rolos em pé de trás e os panos dobrados no canto.
      const rolo = Math.min(largura * 0.12, altura * 0.18)
      return [
        ...quadro(-hw * 0.98, -hh * 0.98, hw * 0.28, hh * 0.24),
        linha(-hw * 0.94, -hh * 0.6, 0),
        linha(-hw * 0.94, -hh * 0.24, 0),
        ...fechado([[-hw * 0.84, hh * 0.24], [-hw * 0.2, hh * 0.24], [-hw * 0.12, hh * 0.94], [-hw * 0.96, hh * 0.94]]),
        ...quadro(hw * 0.39, -hh * 0.9, hw * 0.98, 0),
        ...aro(rolo, rolo, hw * 0.54, -hh * 0.66),
        ...aro(rolo, rolo, hw * 0.83, -hh * 0.66),
        ...quadro(hw * 0.33, hh * 0.24, hw * 0.93, hh * 0.94),
      ]
    }
    case 'palcoDeBardo': {
      // O tablado com as linhas dos cavaletes de lado, a cortina franzida no fundo (a beira em zigue-zague), a trave de poste a poste, o degrau na frente e o banquinho no canto de trás.
      const banquinho = Math.min(largura, altura) * 0.1
      const pregas = [-0.92, -0.69, -0.46, -0.23, 0, 0.23, 0.46, 0.69, 0.92]
      return [
        ...quadro(-hw * 0.95, -hh * 0.775, hw * 0.95, hh * 0.6),
        linha(-hw * 0.95, -hh * 0.95, hw * 0.95),
        ...pregas.slice(1).map((f, i) => ({ x1: hw * pregas[i], y1: -hh * (i % 2 === 0 ? 0.8 : 0.88), x2: hw * f, y2: -hh * (i % 2 === 0 ? 0.88 : 0.8) })),
        { x1: -hw * 0.68, y1: -hh * 0.775, x2: -hw * 0.68, y2: hh * 0.6 },
        { x1: hw * 0.68, y1: -hh * 0.775, x2: hw * 0.68, y2: hh * 0.6 },
        ...quadro(-hw * 0.2, hh * 0.6, hw * 0.2, hh * 0.8),
        ...aro(banquinho, banquinho, -hw * 0.7, -hh * 0.52),
      ]
    }
    case 'barrilDePeixe': {
      // O aro do barril aberto e a boca, os peixes em roda (um traço por peixe, da parede para o meio), a tampa encostada e o puçá com o cabo.
      const menor = Math.min(largura, altura)
      const cx = -hw * 0.12
      const cy = -hh * 0.14
      return [
        ...aro(largura * 0.7, altura * 0.7, cx, cy),
        ...aro(largura * 0.5, altura * 0.5, cx, cy),
        ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const a = (i * Math.PI) / 4 + 0.35
          return { x1: cx + Math.cos(a) * largura * 0.22, y1: cy + Math.sin(a) * altura * 0.22, x2: cx + Math.cos(a) * largura * 0.08, y2: cy + Math.sin(a) * altura * 0.08 }
        }),
        ...fechado([[hw * 0.67, -hh * 0.1], [hw * 0.95, hh * 0.17], [hw * 0.19, hh * 0.93], [-hw * 0.08, hh * 0.66]]),
        ...aro(menor * 0.22, menor * 0.22, -hw * 0.62, hh * 0.7),
        { x1: -hw * 0.72, y1: hh * 0.5, x2: -hw * 0.95, y2: -hh * 0.2 },
      ]
    }
    case 'fole':
      // De cima: a orla do couro em volta da tábua em pera, a cabeça, o bico afinando para a direita e a alavanca atravessada.
      return [
        ...fechado([[-hw * 0.97, 0], [-hw * 0.8, -hh * 0.66], [-hw * 0.43, -hh * 0.76], [-hw * 0.05, -hh * 0.58], [hw * 0.36, -hh * 0.29], [hw * 0.36, hh * 0.29], [-hw * 0.05, hh * 0.58], [-hw * 0.43, hh * 0.76], [-hw * 0.8, hh * 0.66]]),
        ...fechado([[-hw * 0.84, 0], [-hw * 0.72, -hh * 0.43], [-hw * 0.43, -hh * 0.52], [-hw * 0.05, -hh * 0.41], [hw * 0.36, -hh * 0.23], [hw * 0.36, hh * 0.23], [-hw * 0.05, hh * 0.41], [-hw * 0.43, hh * 0.52], [-hw * 0.72, hh * 0.43]]),
        ...fechado([[hw * 0.3, -hh * 0.32], [hw * 0.5, -hh * 0.25], [hw * 0.5, hh * 0.25], [hw * 0.3, hh * 0.32]]),
        { x1: hw * 0.5, y1: -hh * 0.17, x2: hw * 0.96, y2: -hh * 0.09 },
        { x1: hw * 0.5, y1: hh * 0.17, x2: hw * 0.96, y2: hh * 0.09 },
        { x1: -hw * 0.95, y1: hh * 0.02, x2: hw * 0.08, y2: -hh * 0.42 },
      ]
    case 'manequimComArmadura':
      // De frente: o elmo, a travessa dos ombros com as duas ombreiras, o peitoral afinando na cintura, o poste na base e o escudo encostado.
      return [
        ...aro(largura * 0.24, altura * 0.26, 0, -hh * 0.74),
        linha(-hw * 0.78, -hh * 0.42, hw * 0.78),
        ...aro(largura * 0.24, altura * 0.18, -hw * 0.42, -hh * 0.42),
        ...aro(largura * 0.24, altura * 0.18, hw * 0.42, -hh * 0.42),
        ...fechado([[-hw * 0.38, -hh * 0.5], [hw * 0.38, -hh * 0.5], [hw * 0.32, hh * 0.04], [hw * 0.34, hh * 0.3], [-hw * 0.34, hh * 0.3], [-hw * 0.32, hh * 0.04]]),
        { x1: 0, y1: hh * 0.3, x2: 0, y2: hh * 0.62 },
        ...quadro(-hw * 0.52, hh * 0.62, hw * 0.52, hh * 0.86),
        ...fechado([[hw * 0.18, hh * 0.32], [hw * 0.64, hh * 0.38], [hw * 0.58, hh * 0.68], [hw * 0.36, hh * 0.86], [hw * 0.2, hh * 0.62]]),
      ]
    case 'pilhaDeLingotes':
      // De cima: o estrado, as duas barras de cima com a emenda no meio, as duas de través da camada do meio, a fileira de cobre na frente e a barra caída ao lado.
      return [
        ...quadro(-hw * 0.98, -hh * 0.96, hw * 0.5, hh * 0.96),
        ...quadro(-hw * 0.53, -hh * 0.32, hw * 0.06, hh * 0.32),
        linha(-hw * 0.53, 0, hw * 0.06),
        ...quadro(-hw * 0.83, -hh * 0.42, -hw * 0.63, hh * 0.42),
        ...quadro(hw * 0.15, -hh * 0.42, hw * 0.35, hh * 0.42),
        ...quadro(-hw * 0.85, hh * 0.56, hw * 0.38, hh * 0.84),
        ...fechado([[hw * 0.7, -hh * 0.36], [hw * 0.97, hh * 0.39], [hw * 0.79, hh * 0.52], [hw * 0.52, -hh * 0.23]]),
      ]
    case 'serra':
      // A tora deitada (as duas beiras), os dois cavaletes em X cruzando por baixo dela com os pés abertos para fora, e o traçador de través perto da ponta da frente, com o cabo em cada ponta (os troncos são toras soltas, sem cavalete; o cocho é a roda comprida entre duas beiras).
      return [
        linha(-hw * 0.89, -hh * 0.49, hw * 0.8),
        linha(-hw * 0.89, hh * 0.13, hw * 0.8),
        ...[[-0.43, -1], [0.14, 1]].flatMap(([x, fora]) => [
          { x1: hw * (x + fora * 0.13), y1: hh * 0.61, x2: hw * (x - fora * 0.1), y2: -hh * 0.77 },
          { x1: hw * (x + fora * 0.13), y1: -hh * 0.97, x2: hw * (x - fora * 0.1), y2: hh * 0.41 },
        ]),
        { x1: hw * 0.48, y1: -hh * 0.86, x2: hw * 0.48, y2: hh * 0.96 },
        linha(hw * 0.45, -hh * 0.86, hw * 0.64),
        linha(hw * 0.45, hh * 0.96, hw * 0.64),
      ]
    case 'galinheiro': {
      // De cima: a casinha no fundo à esquerda (o telhado, com a cumeeira de lado a lado), a rampa saindo da frente dela, o ninho no canto do fundo à direita e as três galinhas soltas no terreiro (a cerca é a silhueta; a gaiola com aves é a grade de seis vãos com a gaiolinha e o cocho).
      const galinha = Math.min(largura * 0.1, altura * 0.12)
      const galinhas: readonly (readonly [number, number])[] = [[0.12, -0.2], [0.6, 0.32], [-0.28, 0.68]]
      return [
        ...quadro(-hw * 0.93, -hh * 0.86, -hw * 0.12, 0),
        linha(-hw * 0.93, -hh * 0.43, -hw * 0.12),
        ...quadro(-hw * 0.59, 0, -hw * 0.46, hh * 0.56),
        ...aro(galinha * 1.3, galinha * 1.3, hw * 0.74, -hh * 0.6),
        ...galinhas.flatMap(([x, y]) => aro(galinha * 1.6, galinha, hw * x, hh * y)),
      ]
    }
    case 'colmeia': {
      // De cima: a espiral do cortiço (duas voltas e meia, da beira da base até o pegador), fora do meio do banco redondo (a silhueta), e o favo cortado na frente, à direita (a mesa redonda e o vaso são uma roda só, no meio).
      const raio = Math.min(largura, altura) * 0.3
      const espira = (t: number): readonly [number, number] => [-hw * 0.16 + raio * (1 - 0.8 * t) * Math.cos(t * 5 * Math.PI), -hh * 0.19 + raio * (1 - 0.8 * t) * Math.sin(t * 5 * Math.PI)]
      return [
        ...Array.from({ length: 40 }, (_, i): Traco => {
          const [x1, y1] = espira(i / 40)
          const [x2, y2] = espira((i + 1) / 40)
          return { x1, y1, x2, y2 }
        }),
        ...aro(largura * 0.22, altura * 0.14, hw * 0.44, hh * 0.42),
      ]
    }
    case 'arado':
      // O balancim de través na frente, a corrente e o timão numa linha só até o corpo, a relha com a aiveca abrindo para um lado e as duas rabiças abrindo para trás, com a travessa entre elas (o carrinho de mão tem a caçamba e a roda).
      return [
        { x1: -hw * 0.92, y1: -hh * 0.54, x2: -hw * 0.92, y2: hh * 0.68 },
        linha(-hw * 0.92, hh * 0.07, hw * 0.38),
        ...fechado([[hw * 0.07, hh * 0.16], [hw * 0.27, -hh * 0.25], [hw * 0.64, -hh * 0.56], [hw * 0.65, -hh * 0.48], [hw * 0.31, hh * 0.18]]),
        { x1: hw * 0.3, y1: hh * 0.03, x2: hw * 0.95, y2: -hh * 0.52 },
        { x1: hw * 0.34, y1: hh * 0.17, x2: hw * 0.97, y2: hh * 0.7 },
        { x1: hw * 0.69, y1: -hh * 0.3, x2: hw * 0.72, y2: hh * 0.49 },
      ]
    case 'tocoComMachado': {
      // O cepo (um aro só: sem o aro da casca, o miolo, a rachadura e as raízes do toco de árvore), a cabeça do machado cravada nele com o fio para o alto à esquerda, o cabo comprido saindo do cepo para baixo à esquerda e três achas em volta.
      const R = Math.min(hw, hh)
      const cx = hw * 0.1
      const cy = -hh * 0.12
      const acha = (x: number, y: number, comp: number, ang: number): Traco => ({ x1: hw * x - Math.cos(ang) * R * comp * 0.5, y1: hh * y - Math.sin(ang) * R * comp * 0.5, x2: hw * x + Math.cos(ang) * R * comp * 0.5, y2: hh * y + Math.sin(ang) * R * comp * 0.5 })
      return [
        ...aro(R * 1.16, R * 1.16, cx, cy),
        ...fechado([[cx + R * 0.1, cy], [cx - R * 0.06, cy + R * 0.14], [cx - R * 0.22, cy - R * 0.05], [cx - R * 0.41, cy - R * 0.13], [cx - R * 0.12, cy - R * 0.36], [cx - R * 0.05, cy - R * 0.18]]),
        { x1: cx - R * 0.16, y1: cy + R * 0.02, x2: cx - R * 0.95, y2: cy + R * 0.64 },
        acha(0.41, 0.71, 0.66, -0.18),
        acha(0.84, -0.07, 0.55, 1.42),
        acha(-0.66, -0.64, 0.5, 0.6),
      ]
    }
    case 'plantacaoEmFileiras': {
      // Ao longo do lado maior (como a imagem): os sulcos entre as cinco leiras, quase de beira a beira, e as mudas de cada leira em xis, desencontradas de uma leira para a outra (a horta tem a beira do canteiro, os repolhos e o regador; o campinho, a linha e o círculo do meio).
      const deitado = largura >= altura
      const meioC = (deitado ? hw : hh) * 0.92
      const meiaL = (deitado ? hh : hw) * 0.92
      const traco = (u1: number, v1: number, u2: number, v2: number): Traco => (deitado ? { x1: u1, y1: v1, x2: u2, y2: v2 } : { x1: v1, y1: u1, x2: v2, y2: u2 })
      const leiras = 5
      const pes = 7
      const passo = (2 * meiaL) / leiras
      const muda = passo * 0.22
      return [
        ...Array.from({ length: leiras - 1 }, (_, i) => traco(-meioC, -meiaL + (i + 1) * passo, meioC, -meiaL + (i + 1) * passo)),
        ...Array.from({ length: leiras * pes }, (_, k) => k).flatMap((k) => {
          const v = -meiaL + (Math.floor(k / pes) + 0.5) * passo
          const u = -meioC + (((k % pes) + 0.5 + (Math.floor(k / pes) % 2) * 0.5) * 2 * meioC) / (pes + 0.5)
          return [traco(u - muda, v - muda, u + muda, v + muda), traco(u - muda, v + muda, u + muda, v - muda)]
        }),
      ]
    }
    case 'carrocaQuebrada':
      // De cima: a caçamba arriada com a face do lado alto, a roda presa de viés por cima da borda, a roda solta deitada, o varal inteiro com a travessa, o toco do que rachou e o caixote.
      return [
        ...fechado([[-hw * 0.51, -hh * 0.88], [hw * 0.78, -hh * 0.78], [hw * 0.73, hh * 0.34], [-hw * 0.56, hh * 0.23]]),
        { x1: -hw * 0.51, y1: -hh * 0.76, x2: hw * 0.77, y2: -hh * 0.66 },
        ...aro(hw * 0.54, hh * 0.34, hw * 0.18, -hh * 0.74),
        ...aro(hw * 0.54, hh * 0.71, -hw * 0.59, hh * 0.5),
        { x1: -hw * 0.97, y1: -hh * 0.5, x2: -hw * 0.53, y2: -hh * 0.47 },
        { x1: -hw * 0.97, y1: -hh * 0.61, x2: -hw * 0.93, y2: -hh * 0.12 },
        { x1: -hw * 0.54, y1: -hh * 0.07, x2: -hw * 0.76, y2: -hh * 0.08 },
        ...fechado([[hw * 0.67, hh * 0.32], [hw * 0.99, hh * 0.46], [hw * 0.9, hh * 0.82], [hw * 0.58, hh * 0.68]]),
      ]
    case 'barrilQuebrado':
      // De cima: o bojo do barril de pé, o aro amassado no alto à direita e as cinco aduelas caídas em leque.
      return [
        ...aro(hw * 0.94, hh * 0.94, -hw * 0.36, -hh * 0.32),
        ...aro(hw * 0.72, hh * 0.72, hw * 0.56, -hh * 0.6),
        { x1: -hw * 0.02, y1: -hh * 0.43, x2: hw * 0.79, y2: -hh * 0.67 },
        { x1: -hw * 0.01, y1: -hh * 0.24, x2: hw * 0.86, y2: -hh * 0.02 },
        { x1: -hw * 0.11, y1: -hh * 0.06, x2: hw * 0.38, y2: hh * 0.44 },
        { x1: -hw * 0.29, y1: hh * 0.03, x2: -hw * 0.11, y2: hh * 0.87 },
        { x1: -hw * 0.49, y1: hh * 0.02, x2: -hw * 0.75, y2: hh * 0.69 },
      ]
    case 'vigaCaida':
      // De cima: as duas metades da viga, cada uma acabando nas lascas que se cruzam no meio, e a trave cruzada por cima da da direita.
      return [
        ...fechado([[-hw * 0.92, -hh * 0.84], [-hw * 0.2, -hh * 0.33], [hw * 0.04, hh * 0.04], [-hw * 0.26, hh * 0.03], [-hw * 0.98, -hh * 0.48]]),
        ...fechado([[hw * 0.96, hh * 0.11], [hw * 0.22, -hh * 0.07], [-hw * 0.04, hh * 0.06], [hw * 0.19, hh * 0.31], [hw * 0.94, hh * 0.49]]),
        ...fechado([[hw * 0.14, -hh * 0.89], [hw * 0.49, hh * 0.6], [hw * 0.62, hh * 0.84], [hw * 0.61, hh * 0.49], [hw * 0.26, -hh]]),
      ]
    case 'armaduraEnferrujada': {
      // Espalhada no chão: o peitoral de ombros largos, o elmo redondo tombado com a fresta em T, a ombreira solta no canto e a espada partida em dois pedaços embaixo.
      // A ombreira fica a 0,73 da meia largura (a ficha dava 0,78): esticada em pé, a roda dela, medida pelo lado
      // menor, chega a 0,26 da meia largura e passava da beira da pegada (`mobilia.test.ts`, todo traço cabe).
      const menor = Math.min(largura, altura)
      return [
        ...fechado([[-hw * 0.5, -hh * 0.5], [hw * 0.1, -hh * 0.5], [hw * 0.02, hh * 0.35], [-hw * 0.42, hh * 0.35]]),
        ...aro(menor * 0.36, menor * 0.36, hw * 0.52, -hh * 0.36),
        linha(hw * 0.44, -hh * 0.36, hw * 0.6),
        { x1: hw * 0.52, y1: -hh * 0.36, x2: hw * 0.52, y2: -hh * 0.12 },
        ...aro(menor * 0.26, menor * 0.16, -hw * 0.73, -hh * 0.62),
        { x1: -hw * 0.7, y1: hh * 0.72, x2: -hw * 0.34, y2: hh * 0.78 },
        { x1: -hw * 0.24, y1: hh * 0.82, x2: hw * 0.1, y2: hh * 0.86 },
      ]
    }
    case 'mesaDeJogo': {
      // O tampo da mesa, o tabuleiro quadrado no meio dividido em quatro casas grandes e os dois banquinhos redondos puxados, um de cada lado, em alturas diferentes.
      const menor = Math.min(largura, altura)
      const t = menor * 0.19
      return [
        ...quadro(-hw * 0.6, -hh * 0.7, hw * 0.6, hh * 0.62),
        ...quadro(-t, -hh * 0.1 - t, t, -hh * 0.1 + t),
        linha(-t, -hh * 0.1, t),
        { x1: 0, y1: -hh * 0.1 - t, x2: 0, y2: -hh * 0.1 + t },
        ...aro(menor * 0.2, menor * 0.2, -hw * 0.78, hh * 0.14),
        ...aro(menor * 0.2, menor * 0.2, hw * 0.78, -hh * 0.24),
      ]
    }
    case 'ringueDeLuta': {
      // De cima: o tablado, o quadro das cordas de poste a poste, os quatro postes nos cantos e o círculo pintado no meio da lona.
      const poste = Math.min(largura, altura) * 0.06
      const cantos: readonly (readonly [number, number])[] = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
      return [
        ...quadro(-hw * 0.97, -hh * 0.97, hw * 0.97, hh * 0.97),
        ...quadro(-hw * 0.76, -hh * 0.76, hw * 0.76, hh * 0.76),
        ...cantos.flatMap(([sx, sy]) => aro(poste, poste, sx * hw * 0.76, sy * hh * 0.76)),
        ...aro(largura * 0.28, altura * 0.28),
      ]
    }
    case 'balanco': {
      // De cima: a trave de ponta a ponta, os dois cavaletes abertos nas pontas (um pé para a frente, outro para trás) e as duas tábuas puxadas para a frente da trave, cada uma presa por duas cordas.
      const assentos: readonly (readonly [number, number])[] = [[-0.32, 0.63], [0.32, 0.36]]
      return [
        linha(-hw * 0.92, 0, hw * 0.92),
        ...[-1, 1].flatMap((l): Traco[] => [{ x1: l * hw * 0.82, y1: 0, x2: l * hw * 0.93, y2: hh * 0.8 }, { x1: l * hw * 0.82, y1: 0, x2: l * hw * 0.71, y2: -hh * 0.8 }]),
        ...assentos.flatMap(([x, y]): Traco[] => [
          ...quadro(hw * (x - 0.15), hh * (y - 0.1), hw * (x + 0.15), hh * (y + 0.1)),
          { x1: hw * (x - 0.12), y1: 0, x2: hw * (x - 0.12), y2: hh * (y - 0.1) },
          { x1: hw * (x + 0.12), y1: 0, x2: hw * (x + 0.12), y2: hh * (y - 0.1) },
        ]),
      ]
    }
    case 'mesaDeSinuca': {
      // De cima: a moldura e o pano, as seis caçapas (nos cantos e no meio das bordas compridas), o triângulo das bolas no pé e um taco em diagonal na cabeceira.
      const boca = Math.min(largura, altura) * 0.11
      const bocas: readonly (readonly [number, number])[] = [[-0.79, -0.74], [0, -0.77], [0.79, -0.74], [-0.79, 0.74], [0, 0.77], [0.79, 0.74]]
      return [
        ...quadro(-hw * 0.9, -hh * 0.94, hw * 0.9, hh * 0.94),
        ...quadro(-hw * 0.78, -hh * 0.71, hw * 0.78, hh * 0.71),
        ...bocas.flatMap(([fx, fy]) => aro(boca, boca, hw * fx, hh * fy)),
        ...fechado([[hw * 0.37, 0], [hw * 0.56, -hh * 0.19], [hw * 0.56, hh * 0.19]]),
        { x1: -hw * 0.72, y1: hh * 0.55, x2: -hw * 0.02, y2: -hh * 0.1 },
      ]
    }
    case 'ancora': {
      // De cima, deitada: a haste do olho à cruz, a argola na ponta de trás, o cepo atravessado logo depois dela, o arco dos braços e as duas unhas em ponta de pá (a corrente fica de fora: o glifo é a âncora).
      const menor = Math.min(altura, largura / 1.5)
      const raio = altura * 0.37
      const cx = largura * 0.4 - raio
      const abre = 1.4
      const passos = 6
      return [
        linha(-largura * 0.3, 0, largura * 0.4),
        ...aro(menor * 0.25, menor * 0.25, -largura * 0.3 - menor * 0.089, 0),
        { x1: -largura * 0.16, y1: -altura * 0.47, x2: -largura * 0.16, y2: altura * 0.47 },
        ...Array.from({ length: passos }, (_, i) => {
          const a0 = -abre + (2 * abre * i) / passos
          const a1 = -abre + (2 * abre * (i + 1)) / passos
          return { x1: cx + Math.cos(a0) * raio, y1: Math.sin(a0) * raio, x2: cx + Math.cos(a1) * raio, y2: Math.sin(a1) * raio }
        }),
        ...[-1, 1].flatMap((lado) => {
          const ex = cx + Math.cos(abre) * raio
          const ey = lado * Math.sin(abre) * raio
          const fx = -Math.sin(abre)
          const fy = lado * Math.cos(abre)
          const ox = Math.cos(abre)
          const oy = lado * Math.sin(abre)
          return fechado([
            [ex + fx * menor * 0.118, ey + fy * menor * 0.118],
            [ex - fx * menor * 0.1 + ox * menor * 0.098, ey - fy * menor * 0.1 + oy * menor * 0.098],
            [ex - fx * menor * 0.1 - ox * menor * 0.098, ey - fy * menor * 0.1 - oy * menor * 0.098],
          ])
        }),
      ]
    }
    case 'cordasEnroladas': {
      // A espiral do rolo grande, a corda dele até o cabeço (o chapéu e a chapa), o rolo menor em duas voltas desencontradas e a ponta solta com o nó (o alvo tem anéis fechados; aqui é uma espiral aberta).
      const menor = Math.min(largura, altura)
      const cx = -hw * 0.29
      const cy = -hh * 0.07
      const passos = 36
      const voltas = 3
      return [
        ...Array.from({ length: passos }, (_, i) => {
          const t0 = i / passos
          const t1 = (i + 1) / passos
          const r0 = menor * (0.07 + 0.22 * t0)
          const r1 = menor * (0.07 + 0.22 * t1)
          const a0 = t0 * voltas * 2 * Math.PI
          const a1 = t1 * voltas * 2 * Math.PI
          return { x1: cx + Math.cos(a0) * r0, y1: cy + Math.sin(a0) * r0, x2: cx + Math.cos(a1) * r1, y2: cy + Math.sin(a1) * r1 }
        }),
        { x1: cx + menor * 0.24, y1: cy - menor * 0.17, x2: hw * 0.68 - menor * 0.12, y2: -hh * 0.66 + menor * 0.08 },
        ...aro(menor * 0.2, menor * 0.2, hw * 0.68, -hh * 0.66),
        ...quadro(hw * 0.68 - menor * 0.14, -hh * 0.66 - menor * 0.14, hw * 0.68 + menor * 0.14, -hh * 0.66 + menor * 0.14),
        ...aro(menor * 0.34, menor * 0.34, hw * 0.5, hh * 0.52),
        ...aro(menor * 0.3, menor * 0.32, hw * 0.46, hh * 0.47),
        { x1: hw * 0.33, y1: hh * 0.72, x2: -hw * 0.5, y2: hh * 0.82 },
        ...aro(menor * 0.1, menor * 0.1, -hw * 0.57, hh * 0.82),
        { x1: -hw * 0.62, y1: hh * 0.8, x2: -hw * 0.82, y2: hh * 0.74 },
      ]
    }
    case 'timao': {
      // Em pé, de frente: o aro e o cubo, os oito raios que passam do aro até a ponta das malaguetas, a coluna do pedestal e a base de dois degraus (o alvo tem anéis cheios e pés em A; o cofre, a roda dentro da caixa).
      const menor = Math.min(largura, altura)
      const cy = -menor * 0.17
      return [
        ...aro(menor * 0.68, menor * 0.68, 0, cy),
        ...aro(menor * 0.24, menor * 0.24, 0, cy),
        ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const a = (i * Math.PI) / 4 - Math.PI / 2
          return { x1: Math.cos(a) * menor * 0.12, y1: cy + Math.sin(a) * menor * 0.12, x2: Math.cos(a) * menor * 0.47, y2: cy + Math.sin(a) * menor * 0.47 }
        }),
        { x1: -menor * 0.08, y1: menor * 0.17, x2: -menor * 0.1, y2: menor * 0.3 },
        { x1: menor * 0.08, y1: menor * 0.17, x2: menor * 0.1, y2: menor * 0.3 },
        ...quadro(-menor * 0.154, menor * 0.3, menor * 0.154, menor * 0.36),
        ...quadro(-menor * 0.214, menor * 0.36, menor * 0.214, menor * 0.44),
      ]
    }
    case 'bote': {
      // De cima, a proa à direita (de pé na pegada mais alta que larga, a proa para baixo): o casco de popa reta, mais largo a 40% e afinando em ponta, e os três bancos de través.
      const deitado = largura >= altura
      const comprido = deitado ? hw : hh
      const boca = (deitado ? hh : hw) * 0.92
      const ponto = (t: number, lado: number): [number, number] => {
        const v = lado * boca * (t <= 0.4 ? 0.74 + 0.26 * Math.sin((Math.PI / 2) * (t / 0.4)) : 1 - ((t - 0.4) / 0.6) ** 1.7)
        const u = -comprido + 2 * comprido * t
        return deitado ? [u, v] : [-v, u]
      }
      const ida = Array.from({ length: 13 }, (_, i) => ponto(i / 12, -1))
      const volta = Array.from({ length: 12 }, (_, i) => ponto(1 - (i + 1) / 12, 1))
      const banco = (t: number): Traco => {
        const [x1, y1] = ponto(t, -0.78)
        const [x2, y2] = ponto(t, 0.78)
        return { x1, y1, x2, y2 }
      }
      return [...fechado([...ida, ...volta]), banco(0.2), banco(0.47), banco(0.72)]
    }
    case 'redeDePesca': {
      // De cima: a vara ao comprido com as estacas redondas embaixo dela, a faixa do pano caído para trás riscada em xis (a malha) e o monte de rede no canto de baixo.
      // A meia largura do xis e a grossura das estacas saem do lado MENOR (a ficha dava `hh` e `altura`, que são
      // o menor na pegada deitada, e o desenho de partida não muda): esticada em pé, o xis da ponta chegava a
      // 1,22 da meia largura e a estaca da ponta, a 1,08, fora da pegada (`mobilia.test.ts`, todo traço cabe).
      const yv = -hh * 0.14
      const ponta = largura * 0.44
      const estacas = Math.max(2, Math.round(largura / (altura * 0.9)) + 1)
      const passo = (2 * ponta) / (estacas - 1)
      const meioXis = Math.min(hw, hh) * 0.28
      const estaca = Math.min(largura, altura) * 0.1
      const malha = Array.from({ length: 4 }, (_, i): Traco[] => {
        const x = -ponta + (2 * ponta * (i + 0.5)) / 4
        return [{ x1: x - meioXis, y1: yv - hh * 0.57, x2: x + meioXis, y2: yv }, { x1: x + meioXis, y1: yv - hh * 0.57, x2: x - meioXis, y2: yv }]
      }).flat()
      return [
        linha(-ponta - largura * 0.04, yv, ponta + largura * 0.04),
        ...quadro(-ponta, yv - hh * 0.57, ponta, yv),
        ...malha,
        ...Array.from({ length: estacas }, (_, i) => aro(estaca, estaca, -ponta + i * passo, yv)).flat(),
        ...aro(largura * 0.27, altura * 0.34, -hw * 0.63, hh * 0.57),
      ]
    }
    case 'pier': {
      // De cima: as tábuas de través ao lado menor, de ponta a ponta e sem as bordas da ponte, e as estacas redondas a intervalos nas duas bordas compridas.
      const deitado = largura > altura
      const comprido = deitado ? hw : hh
      const meia = deitado ? hh : hw
      const em = (u: number, v: number): [number, number] => (deitado ? [u, v] : [v, u])
      const tabuas = Math.max(3, Math.round(comprido / (meia * 0.18)))
      const estacas = Math.max(1, Math.round(comprido / (meia * 0.5)))
      return [
        ...Array.from({ length: tabuas - 1 }, (_, i): Traco => {
          const u = -comprido + ((i + 1) * 2 * comprido) / tabuas
          const [x1, y1] = em(u, -meia * 0.94)
          const [x2, y2] = em(u, meia * 0.94)
          return { x1, y1, x2, y2 }
        }),
        ...Array.from({ length: estacas }, (_, k) => [-1, 1].flatMap((lado) => aro(meia * 0.28, meia * 0.28, ...em(-comprido + ((k + 0.5) * 2 * comprido) / estacas, lado * meia * 0.86)))).flat(),
      ]
    }
    case 'caixoteDePeixe': {
      // A beira e o lado de dentro das paredes, as cabeças das duas fileiras de peixe junto das paredes compridas, o peixe grande atravessado (o corpo e o rabo em V), o caranguejo no canto e a faca na borda de baixo (o barril de peixe é redondo, com os peixes em roda).
      // O caranguejo tem o tamanho do lado MENOR (a ficha dava `altura`, que é o menor na pegada deitada, e o
      // desenho de partida não muda): esticado em pé, ele chegava a 1,05 da meia largura, fora da pegada
      // (`mobilia.test.ts`, todo traço cabe).
      const caranguejo = Math.min(largura, altura)
      return [
        ...quadro(-hw * 0.97, -hh * 0.96, hw * 0.97, hh * 0.96),
        ...quadro(-hw * 0.88, -hh * 0.83, hw * 0.88, hh * 0.83),
        ...Array.from({ length: 8 }, (_, i) => -hw * 0.77 + (hw * 1.54 * i) / 7).flatMap((x) => [
          { x1: x, y1: -hh * 0.76, x2: x, y2: -hh * 0.42 },
          { x1: x, y1: hh * 0.42, x2: x, y2: hh * 0.76 },
        ]),
        ...fechado([[-hw * 0.68, hh * 0.02], [-hw * 0.45, -hh * 0.36], [hw * 0.3, -hh * 0.32], [hw * 0.6, hh * 0.02], [hw * 0.3, hh * 0.36], [-hw * 0.45, hh * 0.38]]),
        ...fechado([[hw * 0.6, hh * 0.02], [hw * 0.8, -hh * 0.32], [hw * 0.8, hh * 0.36]]),
        ...aro(caranguejo * 0.22, caranguejo * 0.2, -hw * 0.61, -hh * 0.45),
        { x1: hw * 0.17, y1: hh * 0.77, x2: hw * 0.86, y2: hh * 0.9 },
      ]
    }
    case 'armaduraDespedacada': {
      // Desfeita na forma de um corpo caído: o elmo redondo no canto com a viseira levantada, o peitoral rachado em duas metades abertas em V, as duas pernas (a de cima dobrada) em traços e o escudo partido embaixo.
      // O elmo fica a 0,7 da meia largura, como na ficha, e só chega para dentro quando a roda dele, medida pelo
      // lado menor, não cabe ali (no quadrado e em pé, onde ia a 1,04 da meia largura, fora da pegada:
      // `mobilia.test.ts`, todo traço cabe). No tamanho de partida, 1,5 x 1, nada muda.
      const menor = Math.min(largura, altura)
      const xDoElmo = -Math.min(hw * 0.7, hw - menor * 0.19)
      return [
        ...aro(menor * 0.34, menor * 0.38, xDoElmo, -hh * 0.3),
        linha(xDoElmo - menor * 0.15, -hh * 0.42, xDoElmo + menor * 0.15),
        ...fechado([[-hw * 0.44, -hh * 0.44], [hw * 0.1, -hh * 0.34], [hw * 0.1, -hh * 0.04], [-hw * 0.44, -hh * 0.12]]),
        ...fechado([[-hw * 0.44, hh * 0.12], [hw * 0.1, hh * 0.04], [hw * 0.1, hh * 0.34], [-hw * 0.44, hh * 0.44]]),
        { x1: hw * 0.16, y1: -hh * 0.2, x2: hw * 0.66, y2: -hh * 0.42 },
        { x1: hw * 0.66, y1: -hh * 0.42, x2: hw * 0.7, y2: -hh * 0.86 },
        { x1: hw * 0.16, y1: hh * 0.3, x2: hw * 0.86, y2: hh * 0.66 },
        ...fechado([[-hw * 0.16, hh * 0.58], [hw * 0.12, hh * 0.58], [hw * 0.04, hh * 0.86], [-hw * 0.06, hh * 0.96]]),
      ]
    }
    case 'armadura':
      // De frente, em pé no pedestal: o elmo, as duas ombreiras, o peito afinando na cintura, as duas pernas, a espada de ponta no meio com a guarda e o pedestal baixo.
      return [
        ...aro(largura * 0.2, altura * 0.22, 0, -hh * 0.76),
        ...aro(largura * 0.2, altura * 0.16, -hw * 0.34, -hh * 0.5),
        ...aro(largura * 0.2, altura * 0.16, hw * 0.34, -hh * 0.5),
        ...fechado([[-hw * 0.28, -hh * 0.54], [hw * 0.28, -hh * 0.54], [hw * 0.22, -hh * 0.1], [hw * 0.26, hh * 0.1], [-hw * 0.26, hh * 0.1], [-hw * 0.22, -hh * 0.1]]),
        { x1: -hw * 0.14, y1: hh * 0.1, x2: -hw * 0.14, y2: hh * 0.7 },
        { x1: hw * 0.14, y1: hh * 0.1, x2: hw * 0.14, y2: hh * 0.7 },
        { x1: 0, y1: -hh * 0.18, x2: 0, y2: hh * 0.72 },
        ...quadro(-hw * 0.4, hh * 0.72, hw * 0.4, hh * 0.9),
      ]
  }
}

/** Glifo de lado da barraca (a beira do toldo e o tampo do balcão) e da carroça (a roda). */
function tracosDaVistaDeLado(tipo: PecaNovaComVista, largura: number, altura: number): Traco[] {
  const hw = largura / 2
  const hh = altura / 2
  if (tipo === 'barraca') return [linha(-hw, -hh + altura * 0.4, hw), linha(-hw * 0.9, hh - altura * 0.3, hw * 0.9)]
  // A roda cabe na caixa em qualquer proporção: o diâmetro é o menor entre 62% da altura e 60% da largura.
  const roda = Math.min(altura * 0.62, largura * 0.6)
  return aro(roda, roda, hw * 0.12, hh - roda / 2)
}

export function tracosDaPecaNova(tipo: PecaNova, largura: number, altura: number, deLado: boolean, variante = 0): Traco[] {
  if (deLado && (tipo === 'barraca' || tipo === 'carroca')) return tracosDaVistaDeLado(tipo, largura, altura)
  return tracosDeFrente(tipo, largura, altura, variante)
}

/** Contorno de lado (barraca e carroça): o retângulo do objeto, no sentido horário a partir do canto de cima à esquerda. */
export function contornoDaPecaNovaDeLado(largura: number, altura: number): { x: number; y: number }[] {
  const hw = largura / 2
  const hh = altura / 2
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ]
}
