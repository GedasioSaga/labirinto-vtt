import { describe, expect, it } from 'vitest'
import { aceitaVista, criarMovel, ehMovelRedondo, ehTipoMobilia, movelComOutraVista, NOME_COM_ARTIGO, ROTULO_MOBILIA, TIPOS_MOBILIA, tracosDoGlifo } from '../mobilia'
import { TIPOS_COM_TEXTURA } from '../../texturas/meioTermo/moveis'
import { acharObjetos, GRUPOS_DE_OBJETO, grupoDoObjeto } from './gruposDoObjeto'
import { ehPecaNova, PECAS_NOVAS, TIPOS_NO_CATALOGO, varianteDaLapide } from './pecasNovas'

/**
 * Registro das PEÇAS NOVAS do lote 1 (MT4): tamanho padrão em casas (o do
 * plano), nome e artigo da setinha, vista de lado só na barraca e na carroça,
 * silhueta redonda na mesa redonda, e o catálogo do painel, que só oferece a
 * peça cujo desenho já existe (nada de botão com rascunho).
 */
const GRADE = 50

const TAMANHOS: Readonly<Record<string, readonly [number, number]>> = {
  mesaQuadrada: [1, 1],
  mesaRedonda: [1.25, 1.25],
  lapide: [0.6, 0.35],
  vaso: [0.5, 0.5],
  lampiao: [0.5, 0.5],
  quadroDeAvisos: [1, 0.4],
  poco: [1.5, 1.5],
  barraca: [2, 2],
  carroca: [2, 1.25],
  sebe: [2, 0.5],
  jardineira: [1, 0.5],
  arcoDoPortao: [2, 0.5],
  placaDeSeta: [0.5, 0.5],
  tapeteLongo: [1, 4],
  // Objeto Fogo (27/10/2026): nasce na Chama; Fogaréu e Incêndio são escolhas do painel.
  fogo: [1, 1],
  // Móveis de casa (28/10/2026).
  fogao: [1, 1],
  geladeira: [1, 0.75],
  pia: [1, 0.6],
  balcao: [2, 0.6],
  pratos: [0.5, 0.5],
  privada: [0.5, 0.6],
  sofa: [2, 1],
  poltrona: [1, 1],
  // Lareira e oficina (29/10/2026).
  lareira: [2, 1],
  fornalha: [1.5, 1.5],
  bigorna: [1, 0.5],
  balde: [0.5, 0.5],
  // Troncos e feno (29/10/2026).
  troncos: [2, 1],
  feno: [1.5, 1],
  // Chafariz (02/11/2026): as duas formas nascem em 2 x 2.
  chafariz: [2, 2],
  // Objetos de vento (02/11/2026): a pegada é a base; as pás em pé passam dela.
  cataVento: [1, 1],
  moinho: [2, 2],
  cataVentoBrinquedo: [0.5, 0.5],
  // Ponte (03/11/2026): 4 casas de comprimento por 1 de largura, nas três formas.
  ponte: [4, 1],
  // Cemitério (07/11/2026): a cova e os dois caixões, 1 casa de largura por 2 de comprimento.
  cova: [1, 2],
  caixao: [1, 2],
  caixaoAberto: [1, 2],
  // Destroços e sucata (10/11/2026): as pilhas grandes em 2 x 2, a de engrenagens em 1 x 1.
  destrocosDeMadeira: [2, 2],
  sucataChapas: [2, 2],
  sucataEngrenagens: [1, 1],
  sucataTambores: [2, 2],
  // Campinho de futebol (10/11/2026): 10 casas de comprimento por 6 de largura.
  campinho: [10, 6],
  // Lote 1 dos 95 objetos novos (11/11/2026).
  bonecoDeTreino: [1, 1],
  pilar: [1, 1],
  altar: [2, 1],
  estanteDeLivros: [2, 0.5],
  sacosDeGrao: [1, 1],
  bancoDePraca: [2, 0.7],
  escombrosDePedra: [2, 2],
  canhao: [2, 1],
  // Lote 2 dos 95 objetos novos (11/11/2026).
  guardaRoupa: [1.5, 0.6],
  caldeirao: [1, 1],
  fornoDePao: [2, 2],
  prateleiraDeDeposito: [2, 0.6],
  estatua: [1, 1],
  pedrasERochas: [2, 1.5],
  mausoleu: [3, 4],
  alvoDeArcoEFlecha: [1, 1],
  // Lote 3 dos 95 objetos novos (11/11/2026).
  bancaDeFrutas: [2, 1],
  toldoListrado: [2, 2],
  bancadaDeFerramentas: [2, 1],
  pedraDeAmolar: [1, 1],
  suporteDeArmas: [2, 0.6],
  espantalho: [1, 1],
  cocho: [2, 0.7],
  ossos: [1.5, 1],
  antenaParabolica: [2, 2],
  // Lote 4 dos 95 objetos novos (11/11/2026).
  escrivaninha: [1.5, 0.8],
  criadoMudo: [0.6, 0.6],
  camaDeCasal: [2, 2],
  berco: [1, 0.7],
  banqueta: [0.5, 0.5],
  biombo: [2, 0.6],
  piano: [1.5, 1],
  candelabroDeChao: [0.6, 0.6],
  // Lote 5 dos 95 objetos novos (11/11/2026).
  banheira: [2, 1],
  tinaDeMadeira: [1.5, 1.5],
  lavatorioComJarro: [1, 0.6],
  prateleiraDePotes: [1.5, 0.4],
  mesaDeCorte: [1.5, 1],
  ganchoComCarne: [1.5, 0.5],
  // Lote 6 dos 95 objetos novos (11/11/2026).
  pilhaDeCaixas: [1.5, 1.5],
  barrisDeitados: [2, 1],
  tonelDeAdega: [2, 3],
  anforasDeBarro: [1, 1],
  cestoDeVime: [0.7, 0.7],
  cofre: [1, 1],
  // Lote 7 dos 95 objetos novos (11/11/2026).
  varalDeRoupa: [2, 0.5],
  horta: [2, 1.5],
  canteiroDeFlores: [1.5, 1],
  muroBaixoDePedra: [2, 0.5],
  tocoDeArvore: [1, 1],
  carrinhoDeMao: [1.5, 0.7],
  placaDeLoja: [1, 0.5],
  // Lote 8 dos 95 objetos novos (11/11/2026).
  cruzDeMadeira: [0.6, 0.6],
  anjoDePedra: [1, 1],
  cercaDeFerro: [2, 0.3],
  paCravada: [0.8, 0.8],
  velasEOferendas: [0.8, 0.8],
  arvoreSeca: [2, 2],
  // Lote 9 dos 95 objetos novos (11/11/2026).
  balancaDeMercador: [1, 0.7],
  tendaDeAdivinha: [2, 2],
  gaiolaComAves: [1, 1],
  rolosDeTecido: [1.5, 1],
  palcoDeBardo: [3, 2],
  barrilDePeixe: [1, 1],
  // Lote 10 dos 95 objetos novos (11/11/2026).
  fole: [1.5, 0.7],
  manequimComArmadura: [1, 1],
  pilhaDeLingotes: [1, 0.7],
  serra: [2, 1],
  galinheiro: [2, 1.5],
  colmeia: [0.8, 0.8],
  arado: [2, 1],
  tocoComMachado: [1, 1],
  plantacaoEmFileiras: [4, 3],
  // Lote 11 dos 95 objetos novos (11/11/2026).
  carrocaQuebrada: [2, 1.5],
  barrilQuebrado: [1, 1],
  vigaCaida: [2, 1],
  armaduraEnferrujada: [1.5, 1],
  mesaDeJogo: [1.5, 1.5],
  ringueDeLuta: [3, 3],
  balanco: [2, 1],
  mesaDeSinuca: [2, 1],
  // Lote 12 dos 95 objetos novos (11/11/2026) e o lote 15, as duas armaduras.
  ancora: [1.5, 1],
  cordasEnroladas: [1, 1],
  timao: [1, 1],
  bote: [3, 1.5],
  redeDePesca: [2, 1],
  pier: [2, 3],
  caixoteDePeixe: [1, 0.7],
  armaduraDespedacada: [1.5, 1],
  armadura: [1, 1],
  // Lotes 13 e 16 dos 95 objetos novos (11/11/2026), o templo e a masmorra.
  braseiro: [0.8, 0.8],
  celaComGrade: [2, 2],
  corrente: [1, 1],
  armadilhaDeEspinhos: [1, 1],
  circuloMagico: [2, 2],
  blocoDeInscricoesAzul: [2, 2],
  blocoDeInscricoesVermelho: [2, 2],
  blocoDeInscricoesDourado: [2, 2],
}

const NOMES: Readonly<Record<string, readonly [string, string]>> = {
  mesaQuadrada: ['Mesa quadrada', 'uma mesa quadrada'],
  mesaRedonda: ['Mesa redonda', 'uma mesa redonda'],
  lapide: ['Lápide', 'uma lápide'],
  vaso: ['Vaso de planta', 'um vaso de planta'],
  lampiao: ['Lampião', 'um lampião'],
  quadroDeAvisos: ['Quadro de avisos', 'um quadro de avisos'],
  poco: ['Poço', 'um poço'],
  barraca: ['Barraca de feira', 'uma barraca de feira'],
  carroca: ['Carroça', 'uma carroça'],
  sebe: ['Sebe', 'uma sebe'],
  jardineira: ['Jardineira', 'uma jardineira'],
  arcoDoPortao: ['Arco do portão', 'um arco do portão'],
  placaDeSeta: ['Placa de seta', 'uma placa de seta'],
  tapeteLongo: ['Tapete longo', 'um tapete longo'],
  fogo: ['Fogo', 'um fogo'],
  fogao: ['Fogão', 'um fogão'],
  geladeira: ['Geladeira', 'uma geladeira'],
  pia: ['Pia', 'uma pia'],
  balcao: ['Balcão', 'um balcão'],
  pratos: ['Pratos', 'uns pratos'],
  privada: ['Privada', 'uma privada'],
  sofa: ['Sofá', 'um sofá'],
  poltrona: ['Poltrona', 'uma poltrona'],
  lareira: ['Lareira', 'uma lareira'],
  fornalha: ['Fornalha de ferreiro', 'uma fornalha de ferreiro'],
  bigorna: ['Bigorna', 'uma bigorna'],
  balde: ['Balde de água', 'um balde de água'],
  troncos: ['Troncos', 'uns troncos'],
  feno: ['Feno', 'feno'],
  chafariz: ['Chafariz', 'um chafariz'],
  cataVento: ['Cata-vento de fazenda', 'um cata-vento de fazenda'],
  moinho: ['Moinho de vento', 'um moinho de vento'],
  cataVentoBrinquedo: ['Cata-vento de brinquedo', 'um cata-vento de brinquedo'],
  ponte: ['Ponte', 'uma ponte'],
  cova: ['Cova', 'uma cova'],
  caixao: ['Caixão', 'um caixão'],
  caixaoAberto: ['Caixão aberto', 'um caixão aberto'],
  destrocosDeMadeira: ['Destroços de madeira', 'uns destroços de madeira'],
  sucataChapas: ['Sucata de metal: chapas', 'uma sucata de chapas'],
  sucataEngrenagens: ['Sucata de metal: engrenagens', 'uma sucata de engrenagens'],
  sucataTambores: ['Sucata de metal: tambores', 'uma sucata de tambores'],
  campinho: ['Campinho de futebol', 'um campinho de futebol'],
  bonecoDeTreino: ['Boneco de treino', 'um boneco de treino'],
  pilar: ['Pilar', 'um pilar'],
  altar: ['Altar', 'um altar'],
  estanteDeLivros: ['Estante de livros', 'uma estante de livros'],
  sacosDeGrao: ['Sacos de grão', 'uns sacos de grão'],
  bancoDePraca: ['Banco de praça', 'um banco de praça'],
  escombrosDePedra: ['Escombros de pedra', 'uns escombros de pedra'],
  canhao: ['Canhão', 'um canhão'],
  guardaRoupa: ['Guarda-roupa', 'um guarda-roupa'],
  caldeirao: ['Caldeirão', 'um caldeirão'],
  fornoDePao: ['Forno de pão', 'um forno de pão'],
  prateleiraDeDeposito: ['Prateleira de depósito', 'uma prateleira de depósito'],
  estatua: ['Estátua', 'uma estátua'],
  pedrasERochas: ['Pedras e rochas', 'umas pedras e rochas'],
  mausoleu: ['Mausoléu', 'um mausoléu'],
  alvoDeArcoEFlecha: ['Alvo de arco e flecha', 'um alvo de arco e flecha'],
  bancaDeFrutas: ['Banca de frutas', 'uma banca de frutas'],
  toldoListrado: ['Toldo listrado', 'um toldo listrado'],
  bancadaDeFerramentas: ['Bancada de ferramentas', 'uma bancada de ferramentas'],
  pedraDeAmolar: ['Pedra de amolar', 'uma pedra de amolar'],
  suporteDeArmas: ['Suporte de armas', 'um suporte de armas'],
  espantalho: ['Espantalho', 'um espantalho'],
  cocho: ['Cocho', 'um cocho'],
  ossos: ['Ossos', 'uns ossos'],
  antenaParabolica: ['Antena parabólica', 'uma antena parabólica'],
  escrivaninha: ['Escrivaninha', 'uma escrivaninha'],
  criadoMudo: ['Criado-mudo com vela', 'um criado-mudo com vela'],
  camaDeCasal: ['Cama de casal', 'uma cama de casal'],
  berco: ['Berço', 'um berço'],
  banqueta: ['Banqueta', 'uma banqueta'],
  biombo: ['Biombo', 'um biombo'],
  piano: ['Piano', 'um piano'],
  candelabroDeChao: ['Candelabro de chão', 'um candelabro de chão'],
  banheira: ['Banheira', 'uma banheira'],
  tinaDeMadeira: ['Tina de madeira', 'uma tina de madeira'],
  lavatorioComJarro: ['Lavatório com jarro', 'um lavatório com jarro'],
  prateleiraDePotes: ['Prateleira de potes', 'uma prateleira de potes'],
  mesaDeCorte: ['Mesa de corte', 'uma mesa de corte'],
  ganchoComCarne: ['Gancho com carne pendurada', 'um gancho com carne pendurada'],
  pilhaDeCaixas: ['Pilha de caixas', 'uma pilha de caixas'],
  barrisDeitados: ['Barris deitados', 'uns barris deitados'],
  tonelDeAdega: ['Tonel de adega', 'um tonel de adega'],
  anforasDeBarro: ['Ânforas de barro', 'umas ânforas de barro'],
  cestoDeVime: ['Cesto de vime', 'um cesto de vime'],
  cofre: ['Cofre', 'um cofre'],
  varalDeRoupa: ['Varal de roupa', 'um varal de roupa'],
  horta: ['Horta', 'uma horta'],
  canteiroDeFlores: ['Canteiro de flores', 'um canteiro de flores'],
  muroBaixoDePedra: ['Muro baixo de pedra', 'um muro baixo de pedra'],
  tocoDeArvore: ['Toco de árvore', 'um toco de árvore'],
  carrinhoDeMao: ['Carrinho de mão', 'um carrinho de mão'],
  placaDeLoja: ['Placa de loja pendurada', 'uma placa de loja pendurada'],
  cruzDeMadeira: ['Cruz de madeira', 'uma cruz de madeira'],
  anjoDePedra: ['Anjo de pedra', 'um anjo de pedra'],
  cercaDeFerro: ['Cerca de ferro', 'uma cerca de ferro'],
  paCravada: ['Pá cravada na terra', 'uma pá cravada na terra'],
  velasEOferendas: ['Velas e oferendas', 'umas velas e oferendas'],
  arvoreSeca: ['Árvore seca', 'uma árvore seca'],
  balancaDeMercador: ['Balança de mercador', 'uma balança de mercador'],
  tendaDeAdivinha: ['Tenda de adivinha', 'uma tenda de adivinha'],
  gaiolaComAves: ['Gaiola com aves', 'uma gaiola com aves'],
  rolosDeTecido: ['Rolos de tecido', 'uns rolos de tecido'],
  palcoDeBardo: ['Palco de bardo', 'um palco de bardo'],
  barrilDePeixe: ['Barril de peixe', 'um barril de peixe'],
  fole: ['Fole', 'um fole'],
  manequimComArmadura: ['Manequim com armadura', 'um manequim com armadura'],
  pilhaDeLingotes: ['Pilha de lingotes', 'uma pilha de lingotes'],
  serra: ['Serra', 'uma serra'],
  galinheiro: ['Galinheiro', 'um galinheiro'],
  colmeia: ['Colmeia', 'uma colmeia'],
  arado: ['Arado', 'um arado'],
  tocoComMachado: ['Toco com machado cravado', 'um toco com machado cravado'],
  plantacaoEmFileiras: ['Plantação em fileiras', 'uma plantação em fileiras'],
  carrocaQuebrada: ['Carroça quebrada', 'uma carroça quebrada'],
  barrilQuebrado: ['Barril quebrado', 'um barril quebrado'],
  vigaCaida: ['Viga caída', 'uma viga caída'],
  armaduraEnferrujada: ['Armadura enferrujada', 'uma armadura enferrujada'],
  mesaDeJogo: ['Mesa de jogo', 'uma mesa de jogo'],
  ringueDeLuta: ['Ringue de luta', 'um ringue de luta'],
  balanco: ['Balanço', 'um balanço'],
  mesaDeSinuca: ['Mesa de sinuca', 'uma mesa de sinuca'],
  ancora: ['Âncora', 'uma âncora'],
  cordasEnroladas: ['Cordas enroladas', 'umas cordas enroladas'],
  timao: ['Timão', 'um timão'],
  bote: ['Bote', 'um bote'],
  redeDePesca: ['Rede de pesca', 'uma rede de pesca'],
  pier: ['Píer', 'um píer'],
  caixoteDePeixe: ['Caixote de peixe', 'um caixote de peixe'],
  armaduraDespedacada: ['Armadura despedaçada', 'uma armadura despedaçada'],
  armadura: ['Armadura', 'uma armadura'],
  braseiro: ['Braseiro', 'um braseiro'],
  celaComGrade: ['Cela com grade', 'uma cela com grade'],
  corrente: ['Corrente', 'uma corrente'],
  armadilhaDeEspinhos: ['Armadilha de espinhos', 'uma armadilha de espinhos'],
  circuloMagico: ['Círculo mágico', 'um círculo mágico'],
  blocoDeInscricoesAzul: ['Bloco de inscrições azul', 'um bloco de inscrições azul'],
  blocoDeInscricoesVermelho: ['Bloco de inscrições vermelho', 'um bloco de inscrições vermelho'],
  blocoDeInscricoesDourado: ['Bloco de inscrições dourado', 'um bloco de inscrições dourado'],
}

describe('peças novas: registro', () => {
  it('os 14 tipos dos lotes 1 e 2, o Fogo e as 14 peças de 28 e 29/10 estão no catálogo de tipos, depois dos 11 de antes', () => {
    expect(PECAS_NOVAS).toEqual(Object.keys(TAMANHOS))
    expect(TIPOS_MOBILIA.slice(0, 11)).toEqual(['barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira', 'cerca', 'armario', 'aparador', 'fogueira', 'tapete'])
    for (const tipo of PECAS_NOVAS) {
      expect(ehTipoMobilia(tipo), tipo).toBe(true)
      expect(ehPecaNova(tipo), tipo).toBe(true)
    }
    expect(ehPecaNova('mesa')).toBe(false)
    expect(ehPecaNova(undefined)).toBe(false)
  })

  it('cada peça nasce no tamanho do plano, centrada no clique', () => {
    for (const tipo of PECAS_NOVAS) {
      const [w, h] = TAMANHOS[tipo]
      const movel = criarMovel(tipo, { x: 100, y: 80 }, GRADE, `id-${tipo}`)
      expect([movel.width / GRADE, movel.height / GRADE], tipo).toEqual([w, h])
      expect(movel.x).toBe(100)
      expect(movel.mobilia).toBe(tipo)
    }
  })

  it('nome e artigo de cada peça (a setinha e a dica do clique)', () => {
    for (const tipo of PECAS_NOVAS) {
      expect(ROTULO_MOBILIA[tipo], tipo).toBe(NOMES[tipo][0])
      expect(NOME_COM_ARTIGO[tipo], tipo).toBe(NOMES[tipo][1])
    }
  })

  it('vista de lado só na barraca e na carroça; a de lado tem pegada própria', () => {
    for (const tipo of PECAS_NOVAS) expect(aceitaVista(tipo), tipo).toBe(tipo === 'barraca' || tipo === 'carroca')
    const barraca = movelComOutraVista(criarMovel('barraca', { x: 0, y: 0 }, GRADE, 'b'), 'lado', GRADE)
    expect([barraca.width / GRADE, barraca.height / GRADE]).toEqual([2, 2])
    expect(barraca.mobiliaVista).toBe('lado')
    const carroca = movelComOutraVista(criarMovel('carroca', { x: 0, y: 0 }, GRADE, 'c'), 'lado', GRADE)
    expect([carroca.width / GRADE, carroca.height / GRADE]).toEqual([2, 1.25])
  })

  it('silhueta redonda: a mesa redonda, o poço, o vaso, o balde de água, o moinho, o caldeirão, a banqueta, o candelabro de chão, o cesto de vime, o canteiro de flores, o toco de árvore, a árvore seca, a tenda de adivinha, a colmeia, o braseiro e o círculo mágico; o resto é retângulo', () => {
    const redondos = PECAS_NOVAS.filter((tipo) => ehMovelRedondo(tipo))
    expect(redondos).toEqual(['mesaRedonda', 'vaso', 'poco', 'balde', 'moinho', 'caldeirao', 'banqueta', 'candelabroDeChao', 'cestoDeVime', 'canteiroDeFlores', 'tocoDeArvore', 'arvoreSeca', 'tendaDeAdivinha', 'colmeia', 'braseiro', 'circuloMagico'])
  })

  it('cada peça tem desenho de linhas (o provisório antes da imagem), nas duas vistas quando tem vista', () => {
    for (const tipo of PECAS_NOVAS) {
      const [w, h] = TAMANHOS[tipo]
      expect(tracosDoGlifo(tipo, w * GRADE, h * GRADE).length, tipo).toBeGreaterThan(0)
      if (aceitaVista(tipo)) expect(tracosDoGlifo(tipo, w * GRADE, h * GRADE, 'lado').length, `${tipo} de lado`).toBeGreaterThan(0)
      // Tamanho torto não tem traço nem derruba o desenho.
      expect(tracosDoGlifo(tipo, 0, h * GRADE)).toEqual([])
    }
  })

  it('lápide: a variação sai do id, com valor fixo (as lápides salvas não mudam), e ids diferentes dão as 3 variações', () => {
    // Valores FIXOS de 3 ids: trocar o hash ou VARIANTES_DA_LAPIDE mudaria as lápides já salvas.
    expect([varianteDaLapide('lapide-0'), varianteDaLapide('lapide-1'), varianteDaLapide('lapide-3'), varianteDaLapide('a3f9c2e1-0b44-4c1d-9e2a-5d6f7a8b9c0d')]).toEqual([0, 1, 2, 0])
    const vistas = new Set(Array.from({ length: 30 }, (_, i) => varianteDaLapide(`p${i}`)))
    expect([...vistas].sort()).toEqual([0, 1, 2])
    expect(varianteDaLapide(undefined)).toBe(0)
  })
})

describe('catálogo do painel: só peça com desenho pronto', () => {
  it('os 11 de antes na ordem de sempre, as mesas novas logo depois da Mesa, e cada peça nova do catálogo tem desenho com textura', () => {
    expect(TIPOS_NO_CATALOGO.filter((tipo) => TIPOS_MOBILIA.slice(0, 11).includes(tipo))).toEqual(TIPOS_MOBILIA.slice(0, 11))
    const mesa = TIPOS_NO_CATALOGO.indexOf('mesa')
    expect(TIPOS_NO_CATALOGO.slice(mesa, mesa + 3)).toEqual(['mesa', 'mesaQuadrada', 'mesaRedonda'])
    const cerca = TIPOS_NO_CATALOGO.indexOf('cerca')
    expect(TIPOS_NO_CATALOGO.slice(cerca, cerca + 3)).toEqual(['cerca', 'sebe', 'jardineira'])
    const tapete = TIPOS_NO_CATALOGO.indexOf('tapete')
    expect(TIPOS_NO_CATALOGO.slice(tapete, tapete + 2)).toEqual(['tapete', 'tapeteLongo'])
    // O Fogo logo depois da Fogueira (o móvel continua como estava).
    const fogueira = TIPOS_NO_CATALOGO.indexOf('fogueira')
    expect(TIPOS_NO_CATALOGO.slice(fogueira, fogueira + 2)).toEqual(['fogueira', 'fogo'])
    // Os troncos e o feno (29/10/2026), sem parente antigo, fecham o catálogo logo depois do arco e da placa.
    // Os objetos de vento (02/11/2026) depois deles, os destroços, as sucatas e o campinho (10/11/2026) em
    // seguida, e os lotes 1 a 13, 15 e 16 dos 95 objetos novos (11/11/2026) no fim.
    expect(TIPOS_NO_CATALOGO.slice(-110, -103)).toEqual(['arcoDoPortao', 'placaDeSeta', 'troncos', 'feno', 'cataVento', 'moinho', 'cataVentoBrinquedo'])
    expect(TIPOS_NO_CATALOGO.slice(-103, -98)).toEqual(['destrocosDeMadeira', 'sucataChapas', 'sucataEngrenagens', 'sucataTambores', 'campinho'])
    expect(TIPOS_NO_CATALOGO.slice(-98, -90)).toEqual(['bonecoDeTreino', 'pilar', 'altar', 'estanteDeLivros', 'sacosDeGrao', 'bancoDePraca', 'escombrosDePedra', 'canhao'])
    expect(TIPOS_NO_CATALOGO.slice(-90, -82)).toEqual(['guardaRoupa', 'caldeirao', 'fornoDePao', 'prateleiraDeDeposito', 'estatua', 'pedrasERochas', 'mausoleu', 'alvoDeArcoEFlecha'])
    expect(TIPOS_NO_CATALOGO.slice(-82, -73)).toEqual(['bancaDeFrutas', 'toldoListrado', 'bancadaDeFerramentas', 'pedraDeAmolar', 'suporteDeArmas', 'espantalho', 'cocho', 'ossos', 'antenaParabolica'])
    expect(TIPOS_NO_CATALOGO.slice(-73, -65)).toEqual(['escrivaninha', 'criadoMudo', 'camaDeCasal', 'berco', 'banqueta', 'biombo', 'piano', 'candelabroDeChao'])
    expect(TIPOS_NO_CATALOGO.slice(-65, -59)).toEqual(['banheira', 'tinaDeMadeira', 'lavatorioComJarro', 'prateleiraDePotes', 'mesaDeCorte', 'ganchoComCarne'])
    expect(TIPOS_NO_CATALOGO.slice(-59, -53)).toEqual(['pilhaDeCaixas', 'barrisDeitados', 'tonelDeAdega', 'anforasDeBarro', 'cestoDeVime', 'cofre'])
    expect(TIPOS_NO_CATALOGO.slice(-53, -46)).toEqual(['varalDeRoupa', 'horta', 'canteiroDeFlores', 'muroBaixoDePedra', 'tocoDeArvore', 'carrinhoDeMao', 'placaDeLoja'])
    expect(TIPOS_NO_CATALOGO.slice(-46, -40)).toEqual(['cruzDeMadeira', 'anjoDePedra', 'cercaDeFerro', 'paCravada', 'velasEOferendas', 'arvoreSeca'])
    expect(TIPOS_NO_CATALOGO.slice(-40, -34)).toEqual(['balancaDeMercador', 'tendaDeAdivinha', 'gaiolaComAves', 'rolosDeTecido', 'palcoDeBardo', 'barrilDePeixe'])
    expect(TIPOS_NO_CATALOGO.slice(-34, -25)).toEqual(['fole', 'manequimComArmadura', 'pilhaDeLingotes', 'serra', 'galinheiro', 'colmeia', 'arado', 'tocoComMachado', 'plantacaoEmFileiras'])
    expect(TIPOS_NO_CATALOGO.slice(-25, -17)).toEqual(['carrocaQuebrada', 'barrilQuebrado', 'vigaCaida', 'armaduraEnferrujada', 'mesaDeJogo', 'ringueDeLuta', 'balanco', 'mesaDeSinuca'])
    expect(TIPOS_NO_CATALOGO.slice(-17, -8)).toEqual(['ancora', 'cordasEnroladas', 'timao', 'bote', 'redeDePesca', 'pier', 'caixoteDePeixe', 'armaduraDespedacada', 'armadura'])
    expect(TIPOS_NO_CATALOGO.slice(-8)).toEqual(['braseiro', 'celaComGrade', 'corrente', 'armadilhaDeEspinhos', 'circuloMagico', 'blocoDeInscricoesAzul', 'blocoDeInscricoesVermelho', 'blocoDeInscricoesDourado'])
    // 26 de antes, os 8 móveis de casa de 28/10/2026 (fogão, geladeira, pia, balcão, pratos, privada, sofá, poltrona)
    // e os 6 de 29/10/2026 (lareira, fornalha, bigorna, balde, troncos, feno).
    // E o chafariz de 02/11/2026, logo depois do poço, e os 3 objetos de vento no fim; a ponte de 03/11/2026
    // logo depois do chafariz. A cova e os dois caixões de 07/11/2026 logo depois da lápide.
    const lapide = TIPOS_NO_CATALOGO.indexOf('lapide')
    expect(TIPOS_NO_CATALOGO.slice(lapide, lapide + 4)).toEqual(['lapide', 'cova', 'caixao', 'caixaoAberto'])
    expect(TIPOS_NO_CATALOGO).toHaveLength(151)
    for (const tipo of TIPOS_NO_CATALOGO) expect(TIPOS_COM_TEXTURA.some((t) => t === tipo), tipo).toBe(true)
    expect(new Set(TIPOS_NO_CATALOGO).size).toBe(TIPOS_NO_CATALOGO.length)
  })

  it('a busca da ficha acha as três sucatas por "metal" (o mestre pediu "sucatas de metal") e por "sucata"', () => {
    const itens = TIPOS_NO_CATALOGO.map((tipo) => ({ tipo, rotulo: ROTULO_MOBILIA[tipo], grupo: GRUPOS_DE_OBJETO.find((g) => g.id === grupoDoObjeto(tipo))?.titulo ?? '' }))
    expect(acharObjetos(itens, 'metal').map((item) => item.tipo)).toEqual(['sucataChapas', 'sucataEngrenagens', 'sucataTambores'])
    // Por "sucata": as três pelo nome e, depois, os destroços, os escombros de pedra, os ossos, os quatro do
    // lote 11 (11/11/2026: a carroça quebrada, o barril quebrado, a viga caída e a armadura enferrujada) e a
    // armadura despedaçada do lote 15 (11/11/2026) pelo título do grupo.
    expect(acharObjetos(itens, 'sucata').map((item) => item.tipo)).toEqual([
      'sucataChapas', 'sucataEngrenagens', 'sucataTambores', 'destrocosDeMadeira', 'escombrosDePedra', 'ossos',
      'carrocaQuebrada', 'barrilQuebrado', 'vigaCaida', 'armaduraEnferrujada', 'armaduraDespedacada',
    ])
  })

  it('a busca da ficha acha os objetos dos dois grupos novos de 11/11/2026 pelo título do grupo: "navio" traz o canhão e o lote 12, e "templo", o pilar, o altar, a armadura do lote 15 e os dos lotes 13 e 16', () => {
    const itens = TIPOS_NO_CATALOGO.map((tipo) => ({ tipo, rotulo: ROTULO_MOBILIA[tipo], grupo: GRUPOS_DE_OBJETO.find((g) => g.id === grupoDoObjeto(tipo))?.titulo ?? '' }))
    expect(acharObjetos(itens, 'navio').map((item) => item.tipo)).toEqual(['canhao', 'ancora', 'cordasEnroladas', 'timao', 'bote', 'redeDePesca', 'pier', 'caixoteDePeixe'])
    expect(acharObjetos(itens, 'templo').map((item) => item.tipo)).toEqual([
      'pilar', 'altar', 'armadura',
      'braseiro', 'celaComGrade', 'corrente', 'armadilhaDeEspinhos', 'circuloMagico', 'blocoDeInscricoesAzul', 'blocoDeInscricoesVermelho', 'blocoDeInscricoesDourado',
    ])
    // Os grupos novos entram antes de "Outros", que continua no fim.
    expect(GRUPOS_DE_OBJETO.slice(-3).map((g) => g.titulo)).toEqual(['Porto e navio', 'Templo e masmorra', 'Outros'])
  })
})
