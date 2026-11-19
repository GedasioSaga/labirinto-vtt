/**
 * REGISTRO DO ESTADO POR JOGADOR (e por conexão) da sessão do host.
 *
 * Cada Map/Set chaveado por playerId nasce dizendo até quando vive
 * (`registrar`), e a queda, o kick e o "esquecer" apagam a chave de todos de
 * uma vez (`esquecer`). Recurso novo com estado por jogador não precisa
 * lembrar de mexer em `disconnect`, `kick` e `forgetPlayer`: a vida declarada
 * na criação já diz em quais deles o estado sai.
 *
 * Só para coleção em que apagar é tirar a chave. Limpeza com regra (estado de
 * outro id que aponta para o jogador, apagar que conta, ordem que importa)
 * continua explícita em quem esquece.
 */

/** Coleção chaveada por id (Map ou Set): o registro só precisa tirar a chave. */
export interface ApagavelPorChave {
  delete(chave: string): boolean
}

export interface RegistroDeEstado<Vida extends string, Motivo extends string> {
  /** Guarda a coleção com a vida dela e a devolve (o tipo da coleção não muda). */
  registrar<C extends ApagavelPorChave>(vida: Vida, colecao: C): C
  /** Tira a chave de toda coleção registrada cuja vida acaba neste motivo. */
  esquecer(chave: string, motivo: Motivo): void
}

/** `apagaEm`: para cada vida, os motivos em que a coleção perde a chave. */
export function criarRegistroDeEstado<Vida extends string, Motivo extends string>(
  apagaEm: Readonly<Record<Vida, readonly Motivo[]>>,
): RegistroDeEstado<Vida, Motivo> {
  const colecoes: { vida: Vida; colecao: ApagavelPorChave }[] = []
  return {
    registrar(vida, colecao) {
      colecoes.push({ vida, colecao })
      return colecao
    },
    esquecer(chave, motivo) {
      for (const { vida, colecao } of colecoes) if (apagaEm[vida].includes(motivo)) colecao.delete(chave)
    },
  }
}

/** Por que o host esquece o jogador agora. */
export type MotivoDoEsquecer =
  /** `disconnect`: a conexão caiu; o registro do jogador fica para o resume. */
  | 'queda'
  /** `forgetPlayer` fora do kick: "Dispensar", "Passar para…", a "Ana (2)" que virou Ana. Não mexe em conexão. */
  | 'esquecido'
  /** `kick`: o mestre expulsou; sai o jogador e o que a tela dele tinha. */
  | 'kick'

/** Até quando vive um estado chaveado por playerId. */
export type VidaPorJogador =
  /** Pedido à espera do mestre e o que a tela da conexão tinha: morre na queda e com o jogador. */
  | 'conexao'
  /** Memória, limites, caderno…: sobrevive à queda e ao resume; morre com o jogador. */
  | 'jogador'
  /** O recorte da conexão (`lastViews`): a conexão nova começa do zero; o esquecer fora do kick não mexe em conexão. */
  | 'recorte'
  /** Tetos e filas da tela que sobrevivem à queda e ao esquecer: só o kick apaga. */
  | 'kick'

const APAGA_POR_JOGADOR: Readonly<Record<VidaPorJogador, readonly MotivoDoEsquecer[]>> = {
  conexao: ['queda', 'esquecido', 'kick'],
  jogador: ['esquecido', 'kick'],
  recorte: ['queda', 'kick'],
  kick: ['kick'],
}

/** O estado por playerId da sessão (`disconnect`, `kick`, `forgetPlayer`). */
export function criarEstadoPorJogador(): RegistroDeEstado<VidaPorJogador, MotivoDoEsquecer> {
  return criarRegistroDeEstado(APAGA_POR_JOGADOR)
}

/** Por clientId: o que só vale para esta conexão, apagado na queda e no kick. */
export type MotivoDoEsquecerConexao = Exclude<MotivoDoEsquecer, 'esquecido'>

const APAGA_POR_CONEXAO: Readonly<Record<'conexao', readonly MotivoDoEsquecerConexao[]>> = {
  conexao: ['queda', 'kick'],
}

/** O estado por clientId da sessão (`disconnect`, `kick`). */
export function criarEstadoPorConexao(): RegistroDeEstado<'conexao', MotivoDoEsquecerConexao> {
  return criarRegistroDeEstado(APAGA_POR_CONEXAO)
}
