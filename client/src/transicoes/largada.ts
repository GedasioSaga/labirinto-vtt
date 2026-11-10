/**
 * LARGADA COMBINADA das cutscenes (pedido do mestre, 09/11/2026: "deixe tudo
 * carregado primeiro para aí sim tocar").
 *
 * O mestre dispara a abertura da batalha; cada tela (mestre, jogadores, TV)
 * prepara a cena (`motor.ts`) e avisa "pronta"; a animação larga para todo
 * mundo quando a última tela avisou. Quem ainda carrega avisa "carregando" a
 * cada batida, e a mesa espera por ela até `TETO_DA_TELA_CARREGANDO_MS`; a
 * tela MUDA (cliente antigo, aba travada, fio caído) só segura a mesa por
 * `PRAZO_DA_LARGADA_MS`. O mestre pode largar já ("Tocar agora"). Quem não
 * ficou pronto a tempo entra no ponto certo quando ficar (o motor adianta o
 * relógio dele).
 *
 * Aqui mora só a conta, sem rede: a ponte do mestre (`net/hostBridge.ts`) cria
 * um `Combinado` por abertura anunciada e manda `cutscene.tocar` no
 * `aoLargar`; a tela do mestre entra nos combinados em curso
 * (`entrarNaLargadaDoMestre`) para largar junto e mostra quantas telas faltam.
 */

/**
 * Prazo da tela MUDA: a que nunca disse nada, ou a que dizia "carregando" e
 * calou (contado da última batida). Vencido, ninguém espera mais por ela.
 */
export const PRAZO_DA_LARGADA_MS = 2500
/**
 * Teto da tela VIVA que ainda carrega (rede lenta, aparelho fraco): o mais que
 * a mesa espera antes de largar sem ela. DECISÃO de 09/11/2026 ("esperar um
 * pouco é aceitável; o jogador não ver é o defeito"): o número é do mestre,
 * para ajustar. Conta do anúncio da abertura.
 */
export const TETO_DA_TELA_CARREGANDO_MS = 8000
/** De quanto em quanto a tela que ainda carrega avisa "carregando". Vai no aviso da abertura (`batidaMs`). */
export const BATIDA_DE_CARREGANDO_MS = 1000
/**
 * Folga do jogador sobre o maior prazo do mestre: se a ordem de tocar não
 * chegar (o fio caiu no meio, mensagem perdida), ele toca sozinho depois de
 * `TETO_DA_TELA_CARREGANDO_MS + FOLGA_DA_LARGADA_MS`. Tela presa nunca.
 */
export const FOLGA_DA_LARGADA_MS = 1500

/** O nome da tela do mestre dentro de um combinado; nunca colide com `clientId` (que não tem dois-pontos). */
const TELA_DO_MESTRE = 'mestre:tela'

export interface Combinado {
  /** A tela avisou que está pronta. Desconhecida, repetida ou depois da largada: nada. */
  pronta(tela: string): void
  /**
   * A tela avisou que está viva e ainda carrega: o prazo curto dela recomeça
   * (até o teto). Vale também para a que já tinha saído da conta por silêncio.
   */
  carregando(tela: string): void
  /** A tela caiu ou desistiu (pulou): não se espera mais por ela. */
  saiu(tela: string): void
  /** Desiste sem largar (a sala fechou): `aoLargar` não é chamado. */
  cancelar(): void
}

export interface OpcoesDoCombinado {
  /** As telas de quem se espera a resposta. Vazio = larga na hora. */
  telas: readonly string[]
  /** Chamado uma vez: todas prontas (ou fora), os prazos venceram, ou o mestre largou. */
  aoLargar: () => void
  /** Prazo da tela muda. */
  prazoMs?: number
  /** Teto da tela viva que ainda carrega. */
  tetoMs?: number
}

interface CombinadoEmCurso extends Combinado {
  faltam: Set<string>
  /** Resolve com o instante (`performance.now()`) da largada, ou do cancelamento. */
  largou: Promise<number>
  /** Larga já, com quem estiver pronto ("Tocar agora"). */
  largarJa(): void
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
 * avisar "pronta" ou sair da conta; sem tela nenhuma, na hora. Cada tela sai
 * da conta sozinha depois de `prazoMs` de silêncio (a batida "carregando"
 * recomeça a contagem), e tudo larga em `tetoMs`, com quem estiver.
 */
export function combinarLargada({ telas, aoLargar, prazoMs = PRAZO_DA_LARGADA_MS, tetoMs = TETO_DA_TELA_CARREGANDO_MS }: OpcoesDoCombinado): Combinado {
  const faltam = new Set(telas)
  /** O prazo de silêncio de cada tela esperada. A do mestre não tem: é local, e vale só o teto. */
  const silencios = new Map<string, ReturnType<typeof setTimeout>>()
  /** Quem já respondeu "pronta" ou saiu: a batida atrasada dela não a põe de volta na conta. */
  const resolvidas = new Set<string>()
  let aberto = true
  let resolver: (instante: number) => void = () => undefined
  const largou = new Promise<number>((feito) => {
    resolver = feito
  })
  const fechar = (): boolean => {
    if (!aberto) return false
    aberto = false
    clearTimeout(teto)
    for (const silencio of silencios.values()) clearTimeout(silencio)
    silencios.clear()
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
  /** A tela deixa de ser esperada: larga se era a última. */
  const tirarDaConta = (tela: string): void => {
    clearTimeout(silencios.get(tela))
    silencios.delete(tela)
    if (!faltam.delete(tela)) return
    if (faltam.size === 0) largar()
    else avisarOuvintes()
  }
  const armarSilencio = (tela: string): void => {
    clearTimeout(silencios.get(tela))
    silencios.set(
      tela,
      setTimeout(() => tirarDaConta(tela), prazoMs),
    )
  }
  const resolvida = (tela: string): void => {
    if (!aberto) return
    resolvidas.add(tela)
    tirarDaConta(tela)
  }
  const carregando = (tela: string): void => {
    // Só quem foi chamado para esta abertura e ainda não respondeu: batida de conexão estranha não entra na conta.
    if (!aberto || resolvidas.has(tela) || !telas.includes(tela)) return
    const voltou = !faltam.has(tela)
    faltam.add(tela)
    armarSilencio(tela)
    if (voltou) avisarOuvintes()
  }
  const cancelar = (): void => {
    // A tela do mestre que esperava por este combinado segue sozinha: ninguém fica preso numa sala fechada.
    if (fechar()) resolver(performance.now())
  }
  const combinado: CombinadoEmCurso = { faltam, largou, pronta: resolvida, saiu: resolvida, carregando, cancelar, largarJa: largar }
  const teto = setTimeout(largar, tetoMs)
  for (const tela of faltam) armarSilencio(tela)
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

/**
 * "TOCAR AGORA" do mestre: larga já todas as largadas em curso, sem esperar
 * quem ainda carrega (essas telas entram no ponto certo quando ficarem
 * prontas). Sem largada em curso, nada.
 */
export function largarAgora(): void {
  for (const combinado of [...emCurso]) combinado.largarJa()
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
export function esperarLargadaDoJogador(tetoMs: number = TETO_DA_TELA_CARREGANDO_MS + FOLGA_DA_LARGADA_MS): EsperaDoJogador {
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
