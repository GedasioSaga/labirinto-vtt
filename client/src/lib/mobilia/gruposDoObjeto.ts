import type { TipoMobilia } from './tipos'

/**
 * OS GRUPOS DO OBJETO (pedido do mestre de 10/11/2026: "organizar essa parte",
 * a grade comprida da ficha da ferramenta Objeto). Um lugar só para os dois
 * caminhos até a mesma escolha: a ficha (`components/livro/EscolhaDoObjeto.tsx`)
 * e o cantinho da barra (`PARTES_DO_MENU_DE_OBJETO` em `lib/toolVariants.ts`,
 * que sai daqui).
 *
 * PEÇA NOVA NO CATÁLOGO: uma linha em `GRUPO_DO_OBJETO` (`tipo: 'idDoGrupo'`),
 * no bloco do grupo dela. A ordem das linhas é a ordem da peça dentro do grupo.
 * Sem a linha ela não some: cai em "Outros" (`GRUPO_PADRAO`), no fim, na ordem
 * do catálogo. Grupo sem peça não aparece em lugar nenhum.
 *
 * Só a ARRUMAÇÃO muda: o id de cada tipo (`lib/mobilia/tipos.ts`) é o que o
 * mapa salvo guarda e continua igual.
 */
export const GRUPOS_DE_OBJETO = [
  { id: 'salaEQuarto', titulo: 'Sala e quarto' },
  { id: 'cozinhaEBanheiro', titulo: 'Cozinha e banheiro' },
  { id: 'armazenagem', titulo: 'Armazenagem' },
  { id: 'ruaEJardim', titulo: 'Rua e jardim' },
  { id: 'cemiterio', titulo: 'Cemitério' },
  { id: 'feira', titulo: 'Feira' },
  { id: 'oficina', titulo: 'Oficina' },
  { id: 'fazenda', titulo: 'Fazenda' },
  { id: 'destrocosESucata', titulo: 'Destroços e sucata' },
  { id: 'esporteELazer', titulo: 'Esporte e lazer' },
  { id: 'portoENavio', titulo: 'Porto e navio' },
  { id: 'temploEMasmorra', titulo: 'Templo e masmorra' },
  { id: 'outros', titulo: 'Outros' },
] as const

export type IdDoGrupoDeObjeto = (typeof GRUPOS_DE_OBJETO)[number]['id']

/** Onde cai o tipo do catálogo que ainda não tem linha em `GRUPO_DO_OBJETO`. */
export const GRUPO_PADRAO: IdDoGrupoDeObjeto = 'outros'

/**
 * O grupo de cada objeto. "Banheiro" sozinho teria só a privada: vai com a
 * cozinha (as peças de água da casa). O balde de água fica na oficina, com a
 * fornalha e a bigorna (a água da têmpera), como já estava no menu.
 */
export const GRUPO_DO_OBJETO: Readonly<Partial<Record<TipoMobilia, IdDoGrupoDeObjeto>>> = {
  // Sala e quarto: as mesas, os assentos, a cama, os tapetes e a lareira; a estante e o guarda-roupa (11/11/2026);
  // e o lote 4 dos objetos novos (11/11/2026), da escrivaninha ao candelabro de chão.
  mesa: 'salaEQuarto',
  cadeira: 'salaEQuarto',
  mesaQuadrada: 'salaEQuarto',
  mesaRedonda: 'salaEQuarto',
  sofa: 'salaEQuarto',
  poltrona: 'salaEQuarto',
  catre: 'salaEQuarto',
  aparador: 'salaEQuarto',
  tapete: 'salaEQuarto',
  tapeteLongo: 'salaEQuarto',
  lareira: 'salaEQuarto',
  estanteDeLivros: 'salaEQuarto',
  guardaRoupa: 'salaEQuarto',
  escrivaninha: 'salaEQuarto',
  criadoMudo: 'salaEQuarto',
  camaDeCasal: 'salaEQuarto',
  berco: 'salaEQuarto',
  banqueta: 'salaEQuarto',
  biombo: 'salaEQuarto',
  piano: 'salaEQuarto',
  candelabroDeChao: 'salaEQuarto',
  // Cozinha e banheiro; o caldeirão e o forno de pão (11/11/2026); e o lote 5 dos objetos novos (11/11/2026),
  // da banheira ao gancho com carne pendurada.
  armario: 'cozinhaEBanheiro',
  balcao: 'cozinhaEBanheiro',
  fogao: 'cozinhaEBanheiro',
  geladeira: 'cozinhaEBanheiro',
  pia: 'cozinhaEBanheiro',
  pratos: 'cozinhaEBanheiro',
  privada: 'cozinhaEBanheiro',
  caldeirao: 'cozinhaEBanheiro',
  fornoDePao: 'cozinhaEBanheiro',
  banheira: 'cozinhaEBanheiro',
  tinaDeMadeira: 'cozinhaEBanheiro',
  lavatorioComJarro: 'cozinhaEBanheiro',
  prateleiraDePotes: 'cozinhaEBanheiro',
  mesaDeCorte: 'cozinhaEBanheiro',
  ganchoComCarne: 'cozinhaEBanheiro',
  // Armazenagem; e o lote 6 dos objetos novos (11/11/2026), da pilha de caixas ao cofre.
  barril: 'armazenagem',
  caixa: 'armazenagem',
  bau: 'armazenagem',
  sacosDeGrao: 'armazenagem',
  prateleiraDeDeposito: 'armazenagem',
  pilhaDeCaixas: 'armazenagem',
  barrisDeitados: 'armazenagem',
  tonelDeAdega: 'armazenagem',
  anforasDeBarro: 'armazenagem',
  cestoDeVime: 'armazenagem',
  cofre: 'armazenagem',
  // Rua e jardim (no cantinho da barra, o atalho da árvore fecha esta parte); e o lote 7 dos objetos novos
  // (11/11/2026), do varal de roupa à placa de loja pendurada.
  cerca: 'ruaEJardim',
  sebe: 'ruaEJardim',
  jardineira: 'ruaEJardim',
  vaso: 'ruaEJardim',
  arcoDoPortao: 'ruaEJardim',
  placaDeSeta: 'ruaEJardim',
  poco: 'ruaEJardim',
  chafariz: 'ruaEJardim',
  lampiao: 'ruaEJardim',
  fogueira: 'ruaEJardim',
  fogo: 'ruaEJardim',
  ponte: 'ruaEJardim',
  bancoDePraca: 'ruaEJardim',
  estatua: 'ruaEJardim',
  pedrasERochas: 'ruaEJardim',
  antenaParabolica: 'ruaEJardim',
  varalDeRoupa: 'ruaEJardim',
  horta: 'ruaEJardim',
  canteiroDeFlores: 'ruaEJardim',
  muroBaixoDePedra: 'ruaEJardim',
  tocoDeArvore: 'ruaEJardim',
  carrinhoDeMao: 'ruaEJardim',
  placaDeLoja: 'ruaEJardim',
  // Cemitério; e o lote 8 dos objetos novos (11/11/2026), da cruz de madeira à árvore seca.
  lapide: 'cemiterio',
  cova: 'cemiterio',
  caixao: 'cemiterio',
  caixaoAberto: 'cemiterio',
  mausoleu: 'cemiterio',
  cruzDeMadeira: 'cemiterio',
  anjoDePedra: 'cemiterio',
  cercaDeFerro: 'cemiterio',
  paCravada: 'cemiterio',
  velasEOferendas: 'cemiterio',
  arvoreSeca: 'cemiterio',
  // Feira; a banca de frutas e o toldo listrado (11/11/2026); e o lote 9 dos objetos novos (11/11/2026), da
  // balança de mercador ao barril de peixe.
  barraca: 'feira',
  carroca: 'feira',
  quadroDeAvisos: 'feira',
  cataVentoBrinquedo: 'feira',
  bancaDeFrutas: 'feira',
  toldoListrado: 'feira',
  balancaDeMercador: 'feira',
  tendaDeAdivinha: 'feira',
  gaiolaComAves: 'feira',
  rolosDeTecido: 'feira',
  palcoDeBardo: 'feira',
  barrilDePeixe: 'feira',
  // Oficina; a bancada de ferramentas, a pedra de amolar e o suporte de armas (11/11/2026); e o lote 10 dos
  // objetos novos (11/11/2026), do fole à serra.
  fornalha: 'oficina',
  bigorna: 'oficina',
  balde: 'oficina',
  bancadaDeFerramentas: 'oficina',
  pedraDeAmolar: 'oficina',
  suporteDeArmas: 'oficina',
  fole: 'oficina',
  manequimComArmadura: 'oficina',
  pilhaDeLingotes: 'oficina',
  serra: 'oficina',
  // Fazenda; o espantalho e o cocho (11/11/2026); e o lote 10 dos objetos novos (11/11/2026), do galinheiro à
  // plantação em fileiras.
  troncos: 'fazenda',
  feno: 'fazenda',
  cataVento: 'fazenda',
  moinho: 'fazenda',
  espantalho: 'fazenda',
  cocho: 'fazenda',
  galinheiro: 'fazenda',
  colmeia: 'fazenda',
  arado: 'fazenda',
  tocoComMachado: 'fazenda',
  plantacaoEmFileiras: 'fazenda',
  // Destroços e sucata (10/11/2026): a madeira quebrada e as três sucatas de metal; os escombros de pedra e os ossos (11/11/2026);
  // o lote 11 dos objetos novos (11/11/2026), da carroça quebrada à armadura enferrujada; e a armadura despedaçada
  // do lote 15 (11/11/2026).
  destrocosDeMadeira: 'destrocosESucata',
  sucataChapas: 'destrocosESucata',
  sucataEngrenagens: 'destrocosESucata',
  sucataTambores: 'destrocosESucata',
  escombrosDePedra: 'destrocosESucata',
  ossos: 'destrocosESucata',
  carrocaQuebrada: 'destrocosESucata',
  barrilQuebrado: 'destrocosESucata',
  vigaCaida: 'destrocosESucata',
  armaduraEnferrujada: 'destrocosESucata',
  armaduraDespedacada: 'destrocosESucata',
  // Esporte e lazer (10/11/2026); o boneco de treino e o alvo de arco e flecha (11/11/2026); e o lote 11 dos
  // objetos novos (11/11/2026), da mesa de jogo à mesa de sinuca.
  campinho: 'esporteELazer',
  bonecoDeTreino: 'esporteELazer',
  alvoDeArcoEFlecha: 'esporteELazer',
  mesaDeJogo: 'esporteELazer',
  ringueDeLuta: 'esporteELazer',
  balanco: 'esporteELazer',
  mesaDeSinuca: 'esporteELazer',
  // Porto e navio (11/11/2026): o canhão e o lote 12 dos objetos novos (11/11/2026), da âncora ao caixote de peixe.
  canhao: 'portoENavio',
  ancora: 'portoENavio',
  cordasEnroladas: 'portoENavio',
  timao: 'portoENavio',
  bote: 'portoENavio',
  redeDePesca: 'portoENavio',
  pier: 'portoENavio',
  caixoteDePeixe: 'portoENavio',
  // Templo e masmorra (11/11/2026): o pilar e o altar; a armadura de pé do lote 15 (11/11/2026); e os do lote 13
  // e do lote 16 dos objetos novos (11/11/2026), do braseiro aos três blocos de inscrições.
  pilar: 'temploEMasmorra',
  altar: 'temploEMasmorra',
  armadura: 'temploEMasmorra',
  braseiro: 'temploEMasmorra',
  celaComGrade: 'temploEMasmorra',
  corrente: 'temploEMasmorra',
  armadilhaDeEspinhos: 'temploEMasmorra',
  circuloMagico: 'temploEMasmorra',
  blocoDeInscricoesAzul: 'temploEMasmorra',
  blocoDeInscricoesVermelho: 'temploEMasmorra',
  blocoDeInscricoesDourado: 'temploEMasmorra',
}

export function grupoDoObjeto(tipo: TipoMobilia): IdDoGrupoDeObjeto {
  return GRUPO_DO_OBJETO[tipo] ?? GRUPO_PADRAO
}

export interface ParteDoObjeto {
  readonly id: IdDoGrupoDeObjeto
  readonly titulo: string
  readonly tipos: readonly TipoMobilia[]
}

/** A ordem das linhas de `GRUPO_DO_OBJETO`, que é a ordem dentro de cada grupo. */
const ORDEM_NO_GRUPO: ReadonlyMap<string, number> = new Map(Object.keys(GRUPO_DO_OBJETO).map((tipo, indice) => [tipo, indice]))

/**
 * O catálogo em grupos, na ordem de `GRUPOS_DE_OBJETO`, só os que têm peça.
 * Cada tipo do catálogo cai em exatamente um grupo; quem não tem linha vai
 * para "Outros", no fim, na ordem do catálogo.
 */
export function partesDoObjeto(catalogo: readonly TipoMobilia[]): ParteDoObjeto[] {
  const porGrupo = new Map<IdDoGrupoDeObjeto, TipoMobilia[]>()
  for (const tipo of catalogo) {
    const grupo = grupoDoObjeto(tipo)
    const lista = porGrupo.get(grupo) ?? []
    lista.push(tipo)
    porGrupo.set(grupo, lista)
  }
  const fimDaLista = ORDEM_NO_GRUPO.size
  const ordem = (tipo: TipoMobilia) => ORDEM_NO_GRUPO.get(tipo) ?? fimDaLista
  return GRUPOS_DE_OBJETO.flatMap((grupo) => {
    const tipos = porGrupo.get(grupo.id)
    if (tipos === undefined) return []
    // `sort` é estável: os sem linha ficam na ordem do catálogo, depois dos com linha.
    return [{ id: grupo.id, titulo: grupo.titulo, tipos: [...tipos].sort((a, b) => ordem(a) - ordem(b)) }]
  })
}

const MARCA_DE_ACENTO = /\p{M}/gu

/** Sem acento, minúsculo e com os espaços juntados: "armario" acha "Armário de cozinha". */
export function nomeParaBusca(texto: string): string {
  return texto.normalize('NFD').replace(MARCA_DE_ACENTO, '').toLowerCase().replace(/\s+/gu, ' ').trim()
}

/**
 * O que a busca da ficha acha, na ordem em que o Enter escolhe: primeiro os
 * nomes que COMEÇAM com o que foi digitado (ou têm uma palavra que começa),
 * depois os que só o contêm, e por fim os do grupo cujo título casa ("cozinha"
 * traz o fogão). Dentro de cada leva, a ordem de quem chamou.
 */
export function acharObjetos<T extends { readonly rotulo: string; readonly grupo: string }>(itens: readonly T[], consulta: string): T[] {
  const alvo = nomeParaBusca(consulta)
  if (alvo === '') return [...itens]
  const comeco: T[] = []
  const meio: T[] = []
  const doGrupo: T[] = []
  for (const item of itens) {
    const nome = nomeParaBusca(item.rotulo)
    if (nome.startsWith(alvo) || nome.includes(` ${alvo}`)) comeco.push(item)
    else if (nome.includes(alvo)) meio.push(item)
    else if (nomeParaBusca(item.grupo).includes(alvo)) doGrupo.push(item)
  }
  return [...comeco, ...meio, ...doGrupo]
}
