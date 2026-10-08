import { FORMATO_DO_SISTEMA, type SistemaDeRpg } from './sistemaDeRpg'

/**
 * ONE PIECE: o sistema da mesa do usuário, portado do projeto-rpg-v2
 * (C:/dev/projeto-rpg-v2). Embutido no app — está sempre na grade de sistemas,
 * mesmo sem nada na pasta da biblioteca — e escrito no MESMO formato de um
 * sistema importado, para a entrega 6 (editor de sistema) não ter caso especial.
 *
 * Fontes, para conferir:
 *  - atributos e abreviações: src/features/characters/atributos.ts;
 *  - tabelas de rank: src-tauri/src/domain/rank.rs (portadas do v1 Python).
 *    Cada `limiares` aqui é a lista dos `valor < N` de lá, em ordem: o rank
 *    começa em `inicial` e sobe um a cada N alcançado. Resistência e Espírito
 *    começam em R0 (valor < 1); Espírito e Determinação vão até R13;
 *  - raças e ofícios: src/features/characters/form/SecaoBase.tsx:18-30;
 *  - abas, campos e ordem dos campos da técnica (Ação, Efeito, Custo, Tempo,
 *    Dano, depois os extras): CharacterSheet.tsx e CamposTecnica.tsx.
 *
 * Os ids dos atributos, recursos, abas e campos são os nomes de coluna do
 * projeto-rpg-v2 (`forca`, `hp`, `habilidades`, `acao`...): é isso que deixa o
 * importador de fichas de lá (`lib/importarDoProjetoRpg.ts`) casar campo por
 * campo sem tabela de tradução.
 */
export const ID_ONE_PIECE = 'one-piece'

export const SISTEMA_ONE_PIECE: SistemaDeRpg = {
  formato: FORMATO_DO_SISTEMA,
  id: ID_ONE_PIECE,
  nome: 'One Piece',
  versao: '1',
  descricao: 'Fichas do projeto-rpg-v2: oito atributos com rank, HP, SP e Escudo, técnicas e transformações.',
  cor: '#b4493c',
  escolhas: [
    { id: 'raca', rotulo: 'Raça', opcoes: ['Humano', 'Skypean', 'Tritão', 'Lunariano', 'Ogro', 'Mink'] },
    {
      id: 'oficio',
      rotulo: 'Ofício',
      opcoes: ['Arqueólogo', 'Artista', 'Carpinteiro', 'Cientista', 'Cozinheiro', 'Ferreiro', 'Gatuno', 'Médico', 'Curandeiro', 'Navegador'],
    },
  ],
  recursos: [
    { id: 'hp', nome: 'HP', tom: 'vida' },
    { id: 'sp', nome: 'SP', tom: 'energia' },
    { id: 'escudo', nome: 'Escudo', tom: 'neutro' },
  ],
  atributos: [
    { id: 'forca', nome: 'Força', abreviacao: 'FOR', rank: { inicial: 1, limiares: [40, 90, 150, 320, 510, 765, 1725, 2200, 2700] } },
    { id: 'agilidade', nome: 'Agilidade', abreviacao: 'AGI', rank: { inicial: 1, limiares: [33, 60, 90, 140, 210, 315, 400, 600, 950] } },
    { id: 'percepcao', nome: 'Percepção', abreviacao: 'PER', rank: { inicial: 1, limiares: [30, 80, 130, 220, 330, 500, 750, 1125, 1500] } },
    { id: 'resistencia', nome: 'Resistência', abreviacao: 'RES', rank: { inicial: 0, limiares: [1, 40, 140, 240, 480, 720, 1620, 2430, 5500, 8250] } },
    { id: 'intuicao', nome: 'Intuição', abreviacao: 'INT', rank: { inicial: 1, limiares: [30, 80, 150, 240, 275, 360, 540, 810, 1215] } },
    {
      id: 'espirito',
      nome: 'Espírito',
      abreviacao: 'ESP',
      rank: { inicial: 0, limiares: [1, 35, 75, 115, 140, 210, 315, 472, 700, 1060, 1590, 2385, 2500] },
    },
    { id: 'carisma', nome: 'Carisma', abreviacao: 'CAR', rank: { inicial: 1, limiares: [20, 55, 100, 150, 200, 240, 315, 472, 700] } },
    {
      id: 'determinacao',
      nome: 'Determinação',
      abreviacao: 'DET',
      rank: { inicial: 1, limiares: [16, 40, 80, 130, 175, 195, 295, 440, 660, 1590, 2385, 2500] },
    },
  ],
  abas: [
    {
      id: 'habilidades',
      nome: 'Habilidades',
      item: 'Habilidade',
      vazio: 'Nenhuma habilidade.',
      campos: [
        { id: 'descricao', rotulo: 'Descrição', forma: 'paragrafo' },
        { id: 'acao', rotulo: 'Ação', forma: 'linha' },
        { id: 'efeito', rotulo: 'Efeito', forma: 'linha' },
        { id: 'custo', rotulo: 'Custo', forma: 'linha' },
        { id: 'tempo', rotulo: 'Tempo', forma: 'linha' },
        { id: 'dano', rotulo: 'Dano', forma: 'linha' },
      ],
      extras: true,
    },
    {
      id: 'pericias',
      nome: 'Perícias',
      item: 'Perícia',
      vazio: 'Nenhuma perícia.',
      campos: [{ id: 'descricao', rotulo: 'Descrição', forma: 'paragrafo' }],
      atributos: true,
    },
    {
      id: 'vantagens',
      nome: 'Vantagens',
      item: 'Vantagem',
      vazio: 'Nenhuma vantagem.',
      campos: [
        { id: 'descricao', rotulo: 'Descrição', forma: 'paragrafo' },
        { id: 'efeito', rotulo: 'Efeito', forma: 'destaque' },
      ],
    },
    {
      id: 'desvantagens',
      nome: 'Desvantagens',
      item: 'Desvantagem',
      vazio: 'Nenhuma desvantagem.',
      campos: [
        { id: 'descricao', rotulo: 'Descrição', forma: 'paragrafo' },
        { id: 'efeito', rotulo: 'Efeito', forma: 'destaque' },
      ],
    },
    {
      id: 'transformacoes',
      nome: 'Transformações',
      item: 'Transformação',
      vazio: 'Nenhuma transformação.',
      campos: [{ id: 'descricao', rotulo: 'Descrição', forma: 'paragrafo' }],
      imagem: true,
      modificadores: true,
      subcartoes: { aba: 'habilidades', rotulo: 'Técnicas da forma' },
    },
  ],
}

/** Os sistemas que o app traz de fábrica: sempre na grade, nunca gravados nem apagados. */
export const SISTEMAS_EMBUTIDOS: readonly SistemaDeRpg[] = [SISTEMA_ONE_PIECE]
