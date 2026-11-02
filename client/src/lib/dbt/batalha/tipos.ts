/**
 * BATALHA DRAGON BALL TALES — estado por cena (docs/planos/dbt-batalha.md,
 * seção 2). Só tipos e constantes: o motor (`motor.ts`) é puro, a store
 * (`stores/batalhaDBTStore.ts`) guarda e grava as fichas pela mesa.
 *
 * Ki e PV moram na ficha (recursos `pk` e `pv`); aqui fica só o que a ficha
 * não tem: débito do Choque, Ki bloqueado da transformação máxima,
 * transformação ativa, condições, voo, agarrão e morte.
 */

export type IdDoCombatente = string
/** equipe.id; sem equipe: 'npc' ou 'pj'. */
export type Lado = string
export type Atributo = 'for' | 'des' | 'con' | 'int' | 'sab' | 'pod' | 'pre'
export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'Z'
export type Faixa = 'erro' | 'minimo' | 'medio' | 'completo'
export type NivelDeVoo = 0 | 1 | 2 | 3
export type ModoDaBatalha = 'automatico' | 'manual'
/** Mesma forma do `AutorDaAcao` do One Piece (lib/batalha/turnos.ts), escrita aqui para não depender daquele arquivo. */
export type AutorDBT = { tipo: 'mestre' } | { tipo: 'jogador'; playerId: string; nome: string }
/** O motor só rola d20 (ataque, testes, queda: 1d20 por nível). */
export type LadosDoDado = 20

export type IdDaCondicao =
  | 'atordoado'
  | 'desnorteado'
  | 'quebrado'
  | 'enraizado'
  | 'envenenado'
  | 'sangrando'
  | 'silenciado'
  | 'sobrecarregado'
  | 'quebra-de-guarda'
  | 'caido'
  | 'desequilibrado'
  | 'exposto'
  | 'paralisado'
  | 'intimidado'
  | 'cego'
  | 'lacuna-mental'
  | 'instavel'
  | 'confusao-mental'
  | 'controle-mental'
  | 'alucinacao-sensorial'
  | 'personalizada'

export interface OpcoesDaBatalhaDBT {
  modo: ModoDaBatalha
  /** 8.5.1 (opcional no livro); padrão true, o mestre confirma no fim. */
  exaustao: boolean
  /** Padrão false: NPC a 0 PV fica fora de combate direto. */
  salvaguardaDeNpc: boolean
}

export type SituacaoDeMorte = 'de-pe' | 'salvaguarda' | 'inconsciente' | 'morto'

export interface UsosDaBatalha {
  /** Técnicas de Rank >= C e igual ao rank máximo pelo PDL (8.5.1.2). */
  tecnicaDeRankMaximo: number
  /** Estágio de cada uso de transformação que não é a máxima (8.5.1.3). */
  transfInferiores: readonly number[]
  transfMaxima: number
  choque: boolean
}

export interface CombatenteDBT {
  id: IdDoCombatente
  /** null, ou ficha sem `dbt` = combatente manual (o mestre resolve à mão). */
  personagemId: string | null
  nome: string
  lado: Lado
  npc: boolean
  iniciativa: RolagemDeIniciativa | null
  /** Sobe no INÍCIO de cada Turno de Ação dele. */
  turnosJogados: number
  /** 2º uso da transformação máxima (8.5.1.3): fora da recarga. */
  kiBloqueado: number
  /** Choque sem Ki (9.5.6): sai na próxima recarga e zera. */
  kiDebito: number
  transformacao: TransformacaoAtiva | null
  voo: NivelDeVoo
  agarrado: { porId: IdDoCombatente; acerto: number } | null
  condicoes: readonly CondicaoAtiva[]
  /** Envenenado vencido: imune àquela técnica. */
  imuneA: readonly { condicao: IdDaCondicao; tecnicaId: string }[]
  temporarios: readonly ModificadorTemporario[]
  morte: { sucessos: number; falhas: number; situacao: SituacaoDeMorte }
  /** Atordoado, Esforço Supremo. */
  perdeProximoTurno: { motivo: string } | null
  /** Iniciativa 20: imune na rodada 1, transformar de graça no 1º turno. */
  natural20: boolean
  /** Iniciativa 1: perde o Turno de Ação da rodada 1. */
  natural1: boolean
  /** Acumulação por rodada. */
  carga: { tecnicaId: string; cargas: number } | null
  /** Rajada Contínua mantida. */
  mantendo: { tecnicaId: string; alvos: readonly IdDoCombatente[]; total: number } | null
  /** O texto é só do mestre. */
  acaoOculta: { ki: number; texto: string; ateRodada: number } | null
  /** Livro do Narrador 5: reação defensiva não consome Ki. */
  reacaoEmDesvantagem: boolean
  usos: UsosDaBatalha
  /** Rodada em que entrou (incluído no meio): não age nela se a vez já passou. */
  entrouNaRodada: number
}

export interface TurnoAtual {
  combatenteId: IdDoCombatente
  /** O próximo básico rola com -basicosUsados. */
  basicosUsados: number
  /** Mais de 3 anunciados antes (9.2). */
  basicosAnunciados: number | null
  /** Técnica não básica: 1x por Turno de Ação. */
  tecnicasUsadas: readonly string[]
  /** Casas andadas no turno. */
  andou: number
  /** Casas além do deslocamento já cobradas (Correr). */
  casasCobradas: number
  desengajouDe: readonly IdDoCombatente[]
  barreiraUsada: boolean
  /** Esforço Supremo, Rajada mantida. */
  semTecnicas: boolean
}

export interface RolagemDeIniciativa {
  d20: number
  total: number
  destreza: number
  desempate: number | null
  transformou: string | null
  digitada: boolean
  /** Ki que a forma declarada bloqueou nesta rolagem (2º uso da máxima): rolar de novo devolve. Ausente = 0 (estado salvo antes do campo). */
  bloqueouNaForma?: number
}

export interface TransformacaoAtiva {
  id: string
  nome: string
  estagio: number
  epBonus: number
  maxima: boolean
  desdeRodada: number
}

export interface ModificadorTemporario {
  id: string
  rotulo: string
  acerto: number
  ca: number
  dano: number
  /** Some quando a rodada passa deste número; null = até alguém tirar. */
  ateRodada: number | null
  /** Barreira: some no início do turno de número `ateInicioDoTurno` do dono. */
  ateInicioDoTurno?: number
}

export type QuandoExpira =
  | { tipo: 'inicioDoTurno'; turno: number }
  | { tipo: 'fimDoTurno'; turno: number }
  | { tipo: 'fimDaRodada'; rodada: number }
  | { tipo: 'turnosDeAcao'; restantes: number }
  | { tipo: 'teste' }
  | { tipo: 'evento' }
  | { tipo: 'fimDoCombate' }

export interface OrigemDaCondicao {
  combatenteId: IdDoCombatente | null
  tecnicaId: string | null
  tecnicaNome: string
  kiDaTecnica: number
}

export interface CondicaoAtiva {
  id: string
  condicao: IdDaCondicao
  nome: string
  origem: OrigemDaCondicao
  cd: number | null
  expira: QuandoExpira
  /** Quebrado e Sangrando: o teste do início suprime. */
  suprimidaAte: QuandoExpira | null
  extra?: { atributo?: 'for' | 'des' | 'con'; intimidadorId?: string; tecnicaBloqueada?: string; controladorId?: string }
  aplicadaNaRodada: number
}

export interface OrdemDBT {
  cartas: readonly IdDoCombatente[]
  vez: IdDoCombatente | null
  rodada: number
}

export interface TesteAgendado {
  id: string
  combatenteId: IdDoCombatente
  motivo: 'agarrao' | 'soltar' | 'estabilizar'
  /** Atributos que ele pode usar; a escolha vem na resposta (agarrão: DES ou FOR). */
  atributos: readonly Atributo[]
  /** O número a vencer: total do adversário ou CD. */
  contra: number
  /** Teste resistido: empate fica como está. Contra CD: igualar passa. */
  resistido: boolean
  /** O agarrador (agarrão e soltar-se). */
  outroId: IdDoCombatente | null
}

export interface ApoioAoChoque {
  combatenteId: IdDoCombatente
  tecnicaId: string
  ki: number
}

export interface EfeitoPrevisto {
  tipo: 'condicao' | 'gatilho' | 'instavel' | 'quebraArmadura'
  texto: string
  condicao: IdDaCondicao | null
  cd: number | null
  /** Modo manual: o mestre desliga um efeito antes de aplicar. */
  aplicar: boolean
}

export interface TecnicaDoAtaque {
  id: string
  nome: string
  rank: Rank
  tipo: 'fisica' | 'ki' | 'magica' | 'hibrida'
  ki: number
}

export interface RolagemDoAtaque {
  d20: number
  dados: readonly number[]
  vantagem: -1 | 0 | 1
  fontes: readonly string[]
  partes: readonly ParteDaConta[]
  total: number
  digitada: boolean
}

export interface AtaqueResolvido {
  id: string
  /** Os ataques da mesma ação (técnica de área): uma rolagem, um pagamento. */
  grupo: string
  atacanteId: IdDoCombatente
  alvoId: IdDoCombatente
  tecnica: TecnicaDoAtaque
  modo: 'dano' | 'agarrar'
  /** 1, ou n condensados. */
  basicos: number
  rolagem: RolagemDoAtaque | null
  /** Técnica com Adicionar Salvaguarda. */
  salvaguarda: { cd: number; d20: number; total: number } | null
  ca: number | null
  difEP: number
  margem: number
  faixa: Faixa
  critico: boolean
  erroCritico: boolean
  danoCompleto: number
  danoPrevisto: number
  efeitos: readonly EfeitoPrevisto[]
  kiPago: boolean
  /** Ação gratuita: o alvo não reage. O cartão do manual parte daqui. */
  semJanela: boolean
  /** Reativa sobre reativa: teto em PROFUNDIDADE_DE_REACAO_MAX. */
  profundidade: number
  /** Cargas da Acumulação que entraram no dano. */
  cargas: number
  /** Mitigação somada na resolução (defensivas, talentos). */
  mitigacao: number
}

/** "INT +3", "EP +2", "Dif. EP -1", "Básico -1". */
export interface ParteDaConta {
  rotulo: string
  valor: number
}

export interface ReacaoEscolhida {
  chave: string
  tipo: 'defensiva' | 'barreira' | 'reativa' | 'choque' | 'movimento' | 'livre'
  tecnicaId: string | null
  ki: number
}

export interface JanelaDeReacao {
  ataque: AtaqueResolvido
  /** [alvo] + quem entrou com "Reagir também". */
  convidados: readonly IdDoCombatente[]
  respostas: Readonly<Record<IdDoCombatente, 'nao' | readonly ReacaoEscolhida[]>>
  profundidade: number
}

export interface ChoqueEmCurso {
  ataqueId: string
  atacanteId: IdDoCombatente
  defensorId: IdDoCombatente
  tecnicaAtacante: string
  tecnicaDefensor: string
  bonusDefensor: number
  placar: { atacante: number; defensor: number }
  /** Pontos de +1 (5 Ki cada). */
  apostas: { atacante: number | null; defensor: number | null }
  rolagens: readonly { atacante: number; defensor: number }[]
  /** O ataque que o Choque substituiu (o perdedor sofre o dano das duas técnicas). */
  ataque: AtaqueResolvido
}

export type RespondePor = { tipo: 'mestre' } | { tipo: 'combatente'; id: IdDoCombatente }

interface PendenciaBase {
  id: string
  responde: RespondePor
}

export type Pendencia = PendenciaBase &
  (
    | { tipo: 'declaracao'; faltam: readonly IdDoCombatente[] }
    | { tipo: 'confirmar'; etapa: 'ataque' | 'resolucao' | 'teste' | 'especial'; ataque?: AtaqueResolvido; teste?: TesteAgendado }
    | { tipo: 'reacao'; janela: JanelaDeReacao }
    | { tipo: 'teste'; teste: TesteAgendado }
    | { tipo: 'salvaguarda'; combatenteId: IdDoCombatente }
    | { tipo: 'choque'; choque: ChoqueEmCurso }
    | { tipo: 'apoioAoChoque'; ataqueId: string; defensorId: IdDoCombatente; faltaEP: number; apoios: readonly ApoioAoChoque[] }
    | { tipo: 'acaoGratuita'; combatenteId: IdDoCombatente; contra: IdDoCombatente; motivo: 'erroCritico' | 'oportunidade' | 'previsivel' }
    | { tipo: 'inicioDoTurno'; combatenteId: IdDoCombatente; escolhas: readonly ('manterRajada' | 'continuarCarga' | 'tentarSoltar')[] }
    | { tipo: 'queda'; combatenteId: IdDoCombatente; podeEstabilizar: boolean }
    | { tipo: 'ataqueForcado'; combatenteId: IdDoCombatente; alvoSugerido: IdDoCombatente | null }
  )

export type TipoDaPendencia = Pendencia['tipo']

/** Tudo que o Desfazer volta. */
export interface NucleoDBT {
  fase: 'iniciativa' | 'combate'
  opcoes: OpcoesDaBatalhaDBT
  combatentes: Readonly<Record<IdDoCombatente, CombatenteDBT>>
  ordem: OrdemDBT
  turno: TurnoAtual | null
  /** [0] = a ativa. */
  pendencias: readonly Pendencia[]
}

export type TipoDaLinhaDBT =
  | 'inicio'
  | 'iniciativa'
  | 'vez'
  | 'acao'
  | 'tecnica'
  | 'reacao'
  | 'dano'
  | 'cura'
  | 'condicao'
  | 'teste'
  | 'transformacao'
  | 'movimento'
  | 'voo'
  | 'choque'
  | 'morte'
  | 'ficha'
  | 'mestre'

/** Um número da ficha que a linha mudou, de quanto para quanto. */
export interface ParteDaFichaDBT {
  parte: 'recurso' | 'maximo'
  chave: string
  de: number
  para: number
}

export interface LinhaDBT {
  id: string
  seq: number
  quando: number
  rodada: number
  autor: AutorDBT
  tipo: TipoDaLinhaDBT
  /** Mestre, com todos os números. */
  texto: string
  detalhes: readonly string[]
  /** Jogador: sem PV, CA e Ki de quem ele não vê. */
  textoPublico: string
  detalhesPublicos: readonly string[]
  envolve: { tokenIds: readonly string[]; personagemIds: readonly string[] }
  comD20: boolean
  reversao: { nucleo: NucleoDBT; fichas: readonly { personagemId: string; partes: readonly ParteDaFichaDBT[] }[] }
  desfeita?: { por: string; quando: number }
}

export interface EfeitoDBT {
  seq: number
  tipo: 'rolagem' | 'dano' | 'cura' | 'condicao' | 'transformacao'
  tokenIds: readonly string[]
  d20: number | null
  faixa: Faixa | null
  numero: number | null
}

export interface EstadoDBT extends NucleoDBT {
  /** Até REGISTRO_DBT_MAX. */
  registro: readonly LinhaDBT[]
  /** Fora do núcleo: efeito não se desfaz. */
  efeitos: readonly EfeitoDBT[]
}

/** Quem entra na batalha (`inicio.ts`). */
export interface EntranteDBT {
  tokenId: string
  personagemId: string | null
  nome: string
  lado: Lado
  npc: boolean
}

// ───────────────────────────────────────────────────────────────────────────
// Comandos e opções
// ───────────────────────────────────────────────────────────────────────────

export interface ExtrasDaAcao {
  modo?: 'dano' | 'agarrar'
  cargasKi?: number
  basicos?: number
  nivelDeVoo?: NivelDeVoo
  textoOculto?: string
  kiOculto?: number
}

/** O que o mestre muda no cartão do modo manual (seção 15). */
export interface EdicoesDoMestre {
  d20?: number
  vantagem?: -1 | 0 | 1
  ca?: number
  faixa?: Faixa
  critico?: boolean
  dano?: number
  mitigacao?: number
  gastarKi?: boolean
  abrirReacoes?: boolean
  aplicarDano?: boolean
  /** Um por `EfeitoPrevisto`, na mesma ordem. */
  aplicarEfeitos?: readonly boolean[]
  passou?: boolean
}

export type AcaoDoMestreDBT =
  | { tipo: 'modo'; modo: ModoDaBatalha }
  | { tipo: 'opcoes'; exaustao?: boolean; salvaguardaDeNpc?: boolean }
  | { tipo: 'porCondicao'; combatenteId: IdDoCombatente; condicao: IdDaCondicao; nome?: string; cd?: number }
  | { tipo: 'tirarCondicao'; combatenteId: IdDoCombatente; condicaoId: string }
  | { tipo: 'temporario'; combatenteId: IdDoCombatente; rotulo: string; acerto: number; ca: number; dano: number; rodadas: number | null }
  | { tipo: 'tirarTemporario'; combatenteId: IdDoCombatente; temporarioId: string }
  | { tipo: 'lado'; combatenteId: IdDoCombatente; lado: Lado }
  | { tipo: 'desvantagem'; combatenteId: IdDoCombatente; ligada: boolean }
  | { tipo: 'derrubar'; combatenteId: IdDoCombatente }
  | { tipo: 'acaoGratuita'; combatenteId: IdDoCombatente; contra: IdDoCombatente; motivo: 'oportunidade' | 'previsivel' }
  | { tipo: 'dispararOculta'; combatenteId: IdDoCombatente }
  | { tipo: 'darAVez'; combatenteId: IdDoCombatente }
  | { tipo: 'moverCarta'; combatenteId: IdDoCombatente; posicao: number }
  | { tipo: 'incluir'; entrante: EntranteDBT; total?: number }
  | { tipo: 'tirar'; combatenteId: IdDoCombatente }
  | { tipo: 'resolverReacoes' }
  | { tipo: 'descartarPendencia'; pendenciaId: string }
  | { tipo: 'situacao'; combatenteId: IdDoCombatente; situacao: SituacaoDeMorte }

export type ComandoDBT =
  | { tipo: 'declarar'; combatenteId: string; transformacaoId: string | null }
  | { tipo: 'rolarIniciativa'; digitados?: Readonly<Record<string, number>> }
  | { tipo: 'ordenar'; ordem: readonly string[] }
  | { tipo: 'comecar' }
  | { tipo: 'agir'; combatenteId: string; vez: { rodada: number; turno: number }; opcao: string; alvos: readonly string[]; extras?: ExtrasDaAcao }
  | { tipo: 'responder'; pendenciaId: string; combatenteId: string | null; opcao: string; aposta?: number; atributo?: 'des' | 'for'; edicoes?: EdicoesDoMestre }
  | { tipo: 'passar'; vez: { combatenteId: string; rodada: number; turno: number } }
  | { tipo: 'andou'; tokenId: string; blocos: number }
  | { tipo: 'mestre'; acao: AcaoDoMestreDBT }

/** Uma ação do turno como o cliente vê: a opção aparece com o motivo, nunca some (6.2). */
export interface OpcaoDeAcao {
  chave: string
  rotulo: string
  ki: number
  gratis: boolean
  bloqueio: string | null
  alvo: 'nenhum' | 'inimigo' | 'aliado' | 'qualquer'
  alvosMax: number
  tecnicaId: string | null
}

/** Uma resposta possível a uma pendência. */
export interface OpcaoDaPendencia {
  chave: string
  rotulo: string
  ki: number
  gratis: boolean
  bloqueio: string | null
  pede: 'aposta' | 'atributo' | null
}

// ───────────────────────────────────────────────────────────────────────────
// Constantes (seção 2)
// ───────────────────────────────────────────────────────────────────────────

export const REGISTRO_DBT_MAX = 300
export const REGISTRO_DBT_JOGADOR_MAX = 50
export const TEXTO_DBT_MAX = 200
export const DETALHES_MAX = 8
export const EFEITOS_DBT_GUARDADOS = 20
export const ALVOS_MAX = 12
export const PROFUNDIDADE_DE_REACAO_MAX = 3
export const DESLOCAMENTO_M = 9
export const PASSO_DE_CORRIDA_M = 1.5
export const CD_ESTABILIZAR = 15
export const KI_DECOLAR = 4
export const KI_MUDAR_NIVEL = 2
export const KI_ESTABILIZAR = 1
export const KI_POR_PONTO_DE_CHOQUE = 5
/** Salvaguarda contra a morte: d20 >= 10, 3 sucessos ou 3 falhas (9.5.10). */
export const SALVAGUARDA_CD = 10
export const SALVAGUARDAS_PARA_DECIDIR = 3
/** Choque de Poder: o primeiro a 3 vence (9.5.6). */
export const PONTOS_DO_CHOQUE = 3
export const APOSTA_DO_CHOQUE_MAX = 10
export const CARGAS_KI_MAX = 5
export const BASICOS_ANUNCIADOS_MIN = 4
export const BASICOS_ANUNCIADOS_MAX = 10
export const KI_OCULTO_MAX = 200
/** Exaustão: 5% por uso de técnica de rank máximo, 5% por estágio de transformação inferior (8.5.1). */
export const PCT_POR_USO = 5
