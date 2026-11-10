/**
 * LARGADA COMBINADA das cutscenes (pedido do mestre, 09/11/2026: "deixe tudo
 * carregado primeiro para aí sim tocar").
 *
 * O mestre dispara a abertura da batalha; cada tela (mestre, jogadores, TV)
 * prepara a cena (`motor.ts`) e avisa "pronta"; a animação larga para todo
 * mundo quando a última tela avisou OU quando vence `PRAZO_DA_LARGADA_MS`.
 * Quem não ficou pronto a tempo não segura ninguém: entra no ponto certo
 * quando ficar pronto (o motor adianta o relógio dele).
 *
 * Aqui mora só a conta, sem rede: a ponte do mestre (`net/hostBridge.ts`) cria
 * um `Combinado` por abertura anunciada e manda `cutscene.tocar` no
 * `aoLargar`; a tela do mestre entra nos combinados em curso
 * (`entrarNaLargadaDoMestre`) para largar junto e mostra quantas telas faltam.
 */

/** Prazo para as telas responderem "pronta"; vencido, a cutscene larga sem quem falta. */
export const PRAZO_DA_LARGADA_MS = 2500
/**
 * Folga do jogador sobre o prazo do mestre: se a ordem de tocar não chegar
 * (o fio caiu no meio, mensagem perdida), ele toca sozinho depois de
 * `PRAZO_DA_LARGADA_MS + FOLGA_DA_LARGADA_MS`. Tela presa nunca.
 */
export const FOLGA_DA_LARGADA_MS = 1500

/** O nome da tela do mestre dentro de um combinado; nunca colide com `clientId` (que não tem dois-pontos). */
const TELA_DO_MESTRE = 'mestre:tela'

export interface Combinado {
  /** A tela avisou que está pronta. Desconhecida, repetida ou depois da largada: nada. */
  pronta(tela: string): void
  /** A tela caiu ou desistiu (pulou): não se espera mais por ela. */
  saiu(tela: string): void
  /** Desiste sem largar (a sala fechou): `aoLargar` não é chamado. */
  cancelar(): void
}

export interface OpcoesDoCombinado {
  /** As telas de quem se espera a resposta. Vazio = larga na hora. */
  telas: readonly string[]
  /** Chamado uma vez: todas prontas (ou fora), ou o prazo venceu. */
  aoLargar: () => void
  prazoMs?: number
}

interface CombinadoEmCurso extends Combinado {
  faltam: Set<string>
  /** Resolve com o instante (`performance.now()`) da largada, ou do cancelamento. */
  largou: Promise<number>
}

const emCurso = new Set<CombinadoEmCurso>()
const ouvintes = new Set<() => void>()
let telasPendentes = 0

function avisarOuvintes(): void {
  const faltando = new Set<string>()
  for (const combinado of emCurso) for (const tela of combinado.faltam) if (tela !== TELA_DO_MESTRE) faltando.add(tela)
  if (faltando.size === telasPendentes) return
  telasPendentes = faltando.size
  for (const ouvinte of ouvintes) ouvinte()
}

/**
 * Abre a espera pelas `telas`. Larga (chama `aoLargar`) quando a última
 * avisar ou sair, ou no prazo, o que vier antes; sem tela nenhuma, na hora.
 */
export function combinarLargada({ telas, aoLargar, prazoMs = PRAZO_DA_LARGADA_MS }: OpcoesDoCombinado): Combinado {
  const faltam = new Set(telas)
  let aberto = true
  let resolver: (instante: number) => void = () => undefined
  const largou = new Promise<number>((feito) => {
    resolver = feito
  })
  const fechar = (): boolean => {
    if (!aberto) return false
    aberto = false
    clearTimeout(prazo)
    emCurso.delete(combinado)
    faltam.clear()
    avisarOuvintes()
    return true
  }
  const largar = (): void => {
    if (!fechar()) return
    resolver(performance.now())
    aoLargar()
  }
  const tirar = (tela: string): void => {
    if (!aberto || !faltam.delete(tela)) return
    if (faltam.size === 0) largar()
    else avisarOuvintes()
  }
  const cancelar = (): void => {
    // A tela do mestre que esperava por este combinado segue sozinha: ninguém fica preso numa sala fechada.
    if (fechar()) resolver(performance.now())
  }
  const combinado: CombinadoEmCurso = { faltam, largou, pronta: tirar, saiu: tirar, cancelar }
  const prazo = setTimeout(largar, prazoMs)
  emCurso.add(combinado)
  if (faltam.size === 0) largar()
  else avisarOuvintes()
  return combinado
}

/** Quantas telas (jogadores e TV) ainda não avisaram "pronta" nas largadas em curso. Serve de `getSnapshot`. */
export function telasQueFaltam(): number {
  return telasPendentes
}

/** Avisa quando `telasQueFaltam` muda. Devolve o cancelamento. */
export function assinarTelasQueFaltam(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export interface EsperaDoJogador {
  /** O instante (`performance.now()`) em que a ordem de tocar chegou a esta tela, ou o do teto. */
  largada: Promise<number>
  /** A ordem de tocar chegou. Repetida ou depois do teto: nada. */
  largou(instante: number): void
  /** A tela saiu antes: solta o teto armado. */
  cancelar(): void
}

/**
 * O lado do JOGADOR (e da TV): espera a ordem de tocar do mestre. Se ela não
 * chegar (o fio caiu no meio), o teto solta a tela sozinha.
 */
export function esperarLargadaDoJogador(tetoMs: number = PRAZO_DA_LARGADA_MS + FOLGA_DA_LARGADA_MS): EsperaDoJogador {
  let resolver: (instante: number) => void = () => undefined
  const largada = new Promise<number>((feito) => {
    resolver = feito
  })
  const teto = setTimeout(() => resolver(performance.now()), tetoMs)
  return {
    largada,
    largou: (instante) => {
      clearTimeout(teto)
      resolver(instante)
    },
    cancelar: () => clearTimeout(teto),
  }
}

export interface LugarNaLargada {
  /** O instante (`performance.now()`) em que a mesa largou: a tela do mestre começa junto. */
  largada: Promise<number>
  /** A tela do mestre terminou de preparar. */
  pronta(): void
  /** A tela do mestre saiu antes (pulou, desmontou): os jogadores não esperam por ela. */
  sair(): void
}

/**
 * A tela do MESTRE entra nas largadas em curso: os jogadores também esperam
 * por ela, e ela larga com eles. `null` = nenhuma largada em curso (sem sala,
 * sem jogador na cena, ou página de jogador): toca assim que estiver pronta.
 */
export function entrarNaLargadaDoMestre(): LugarNaLargada | null {
  const combinados = [...emCurso]
  if (combinados.length === 0) return null
  for (const combinado of combinados) combinado.faltam.add(TELA_DO_MESTRE)
  return {
    // Mais de uma ponte (a sala e a Visão de jogador): larga quando a última largou.
    largada: Promise.all(combinados.map((combinado) => combinado.largou)).then((instantes) => Math.max(...instantes)),
    pronta: () => {
      for (const combinado of combinados) combinado.pronta(TELA_DO_MESTRE)
    },
    sair: () => {
      for (const combinado of combinados) combinado.saiu(TELA_DO_MESTRE)
    },
  }
}
