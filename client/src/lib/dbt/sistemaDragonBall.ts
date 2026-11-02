import { FORMATO_DO_SISTEMA, type AtributoDoSistema, type RecursoDoSistema, type SistemaDeRpg } from '../sistemaDeRpg'
import { ID_SISTEMA_DBT, IDS_DOS_ATRIBUTOS, IDS_DOS_RECURSOS, type IdAtributoDBT, type IdRecursoDBT } from './modelo'

/**
 * DRAGON BALL TALES embutido (plano docs/planos/sistema-dragon-ball.md, item 2):
 * sempre na grade de sistemas, como o One Piece, e rodado pelo motor próprio
 * (`motor: 'dragon-ball-tales'`, lib/motores.ts).
 *
 * Só os campos GENÉRICOS do sistema: os 7 atributos e os recursos PV e PK
 * com atual e máximo. Com eles a barra de vida do token (tom vida), o ajuste
 * rápido com histórico, o disco e a rede funcionam sem saber de Dragon Ball.
 * Raça, perícias, técnicas e transformações moram em `Personagem.dbt`
 * (lib/dbt/modelo.ts), e não em escolhas ou abas: por isso `escolhas` e
 * `abas` vazias, e nenhum id de aba do One Piece (armas, balas, habilidades),
 * que a ficha e a batalha padrão leem por id.
 */

/** Nomes do livro (2.1.1 a 2.1.7, p. 6-7), na ordem de `IDS_DOS_ATRIBUTOS`. */
const ATRIBUTOS: Readonly<Record<IdAtributoDBT, Omit<AtributoDoSistema, 'id'>>> = {
  for: { nome: 'Força', abreviacao: 'FOR' },
  des: { nome: 'Destreza', abreviacao: 'DES' },
  con: { nome: 'Constituição', abreviacao: 'CON' },
  int: { nome: 'Inteligência', abreviacao: 'INT' },
  sab: { nome: 'Sabedoria', abreviacao: 'SAB' },
  pod: { nome: 'Poder', abreviacao: 'POD' },
  pre: { nome: 'Presença', abreviacao: 'PRE' },
}

/** PV gasta e volta como o HP do One Piece; PK é o Ki (tom energia). */
const RECURSOS: Readonly<Record<IdRecursoDBT, Omit<RecursoDoSistema, 'id'>>> = {
  pv: { nome: 'PV', tom: 'vida', atualEMaximo: true },
  pk: { nome: 'PK', tom: 'energia', atualEMaximo: true },
}

export const SISTEMA_DRAGON_BALL: SistemaDeRpg = {
  formato: FORMATO_DO_SISTEMA,
  id: ID_SISTEMA_DBT,
  nome: 'Dragon Ball Tales',
  versao: '0.5',
  descricao: 'Livro do Jogador V0.5: sete atributos, PV e PK, Escala de Poder, técnicas montadas por rótulos e transformações.',
  cor: '#d9661f',
  motor: 'dragon-ball-tales',
  escolhas: [],
  recursos: IDS_DOS_RECURSOS.map((id) => ({ id, ...RECURSOS[id] })),
  atributos: IDS_DOS_ATRIBUTOS.map((id) => ({ id, ...ATRIBUTOS[id] })),
  abas: [],
  // TODO-INTEGRAR: livro (lib/dbt/livro/) e catálogos entram quando o gerador
  // dos dados terminar; até lá o sistema não traz livro (sem botão "Livro").
}
