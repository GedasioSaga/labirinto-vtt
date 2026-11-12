import { FORMATO_DO_SISTEMA, type AtributoDoSistema, type CapituloDoLivro, type RecursoDoSistema, type SistemaDeRpg } from '../sistemaDeRpg'
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
  // `livro`: entra por `registrarLivroDragonBall` (abaixo), só no app do mestre.
  // Sem `catalogos`: raça, perícia e técnica vêm de lib/dbt/dados pela ficha
  // própria, não pelo "Escolher do livro" das abas do motor padrão.
}

/**
 * O LIVRO do Dragon Ball Tales (85 capítulos, ~648 mil caracteres, o maior com
 * ~33 mil: dentro dos tetos do formato, 200 / 1,2 milhão / 100 mil, e ~15
 * partes de 48 KiB no fio, teto 64) entra no sistema por aqui, chamado por
 * `livroDoApp.ts`, que só o app do mestre importa (`src/main.tsx`).
 *
 * Caça 12/11/2026 (O7): com o `import` do livro aqui, ele ia para o pedaço de
 * código comum que a página do jogador e a "Visão de jogador" também carregam
 * antes de abrir (~670 kB de texto). O jogador nunca lê o livro deste objeto:
 * recebe do mestre pela rede (`livro.parte`, `net/hostSession.ts`).
 */
export function registrarLivroDragonBall(livro: CapituloDoLivro[]): void {
  SISTEMA_DRAGON_BALL.livro = livro
}
