import type { JudgeNaCena } from '../../batalha/judge'
import { opcoesDeAcao } from './acoes'
import { caEfetiva, casasDoDeslocamento, epTotal, temCondicao } from './contas'
import { ladosDerrotados, vitoriasAutomaticas, type VitoriaAutomaticaDBT } from './fim'
import type { FichaLida } from './leitura'
import { trabalhoDeLeitura } from './motor'
import { turnoNoM } from './ordem'
import { opcoesDaPendencia } from './pendencias'
import { linhasParaJogador, podeDesfazerDBT } from './registro'
import {
  ALVOS_MAX,
  DETALHES_MAX,
  EFEITOS_DBT_GUARDADOS,
  REGISTRO_DBT_JOGADOR_MAX,
  TEXTO_DBT_MAX,
  type AutorDBT,
  type CombatenteDBT,
  type ComandoDBT,
  type EfeitoDBT,
  type EstadoDBT,
  type Faixa,
  type IdDaCondicao,
  type Lado,
  type LinhaDBT,
  type ModoDaBatalha,
  type NivelDeVoo,
  type NucleoDBT,
  type OpcaoDaPendencia,
  type OpcaoDeAcao,
  type Pendencia,
  type SituacaoDeMorte,
  type TipoDaLinhaDBT,
  type TipoDaPendencia,
} from './tipos'
import { foraDeCombate, type Trabalho } from './trabalho'

/**
 * RECORTES DA BATALHA DBT (docs/planos/dbt-batalha.md, seções 16 e 17):
 * `vistaParaJogadorDBT` é o que vai pelo fio a cada jogador (`batalhaDBT.estado`):
 * só as fichas que a tela dele tem, PV e Ki só de "eu" e "aliado", nada do
 * que é só do mestre (texto da Ação Oculta, CA e Ki de NPC). `podeComandar`
 * é a conferência do host com a MESMA lista de opções que a vista mostrou.
 * `vistaDoMestreDBT` e `linhasDoMestre` são o view-model da tela do mestre.
 *
 * Puro: lê a cena, as fichas lidas (`ponte.fichasLidas`) e o contexto do
 * jogador montado pelo host. Nada aqui rola dado nem muda a batalha.
 */

/** Tetos do fio: a vista corta antes, o leitor do jogador recusa acima (mensagem forjada). */
export const ID_DBT_MAX = 128
export const NOME_DBT_MAX = 80
export const ROTULO_DBT_MAX = TEXTO_DBT_MAX
export const CHAVE_DBT_MAX = 200
export const CARTAS_DBT_MAX = 200
export const MEUS_DBT_MAX = 16
export const ACOES_DBT_MAX = 400
export const PENDENCIAS_DBT_MAX = 50
export const OPCOES_DBT_MAX = 400
export const CONDICOES_DBT_MAX = 40
export const FORMAS_DBT_MAX = 50
export const NUMERO_DBT_MAX = 1_000_000
/** O atacante ou o alvo que a tela dele não tem. */
export const FORA_DA_VISTA_DBT = 'Alguém fora da sua vista'

export type LadoNaVistaDBT = 'eu' | 'aliado' | 'outro'

export interface RecursoNaVistaDBT {
  atual: number
  max: number
}

export interface CondicaoNaVistaDBT {
  id: string
  condicao: IdDaCondicao
  nome: string
}

/** Uma carta da ordem como o jogador a vê: só ficha que a tela dele tem. */
export interface CartaDBT {
  tokenId: string
  /** O nome do token na tela dele (nunca o nome da ficha do NPC). */
  nome: string
  lado: LadoNaVistaDBT
  /**
   * Do mesmo lado da batalha que um combatente dele (a equipe; sem equipe,
   * PJ com PJ e NPC com NPC): o NPC que luta com ele é "outro" no `lado` mas
   * não é inimigo. Opcional: o leitor do fio que ainda não o conhece o deixa
   * de fora, e quem lê cai no `lado`.
   */
  mesmoLado?: boolean
  /**
   * O personagem da carta, só nas cartas "eu" e "aliado" (abre o perfil só
   * leitura dele); nunca na "outro". Opcional pelo mesmo motivo do `mesmoLado`.
   */
  personagemId?: string
  /** Total da iniciativa (público); null = ainda não rolou. */
  iniciativa: number | null
  /** Só "eu" e "aliado". */
  pv: RecursoNaVistaDBT | null
  pk: RecursoNaVistaDBT | null
  condicoes: readonly CondicaoNaVistaDBT[]
  /** Nome da transformação ativa (a forma se vê). */
  transformacao: string | null
  voo: NivelDeVoo
  situacao: SituacaoDeMorte
  /** Agarrado: quem agarra, se a tela dele tem a ficha; `agarrado` diz se está preso. */
  agarrado: boolean
  agarradoPor: string | null
}

/** Um combatente DELE (token e personagem dele). */
export interface MeuCombatenteDBT {
  tokenId: string
  personagemId: string
  nome: string
  pv: RecursoNaVistaDBT
  pk: RecursoNaVistaDBT
  epBase: number
  epTotal: number
  ca: number
  deslocamento: { casas: number; andou: number }
  voo: NivelDeVoo
  transformacao: { id: string; nome: string; estagio: number } | null
  /** Na vez dele com a fila vazia: o que vai no `agir` e no `passar`. null = não age agora. */
  vez: { rodada: number; turno: number } | null
  /** As ações do turno com custo e bloqueio (`opcoesDeAcao`); vazio fora da vez. */
  acoes: readonly OpcaoDeAcao[]
}

/** "Transformar antes do 1º turno?" (fase iniciativa): responde com o comando `declarar`. */
export interface DeclaracaoDBT {
  combatenteId: string
  formas: readonly { id: string; nome: string; estagio: number; ki: number }[]
}

/** Uma pendência que um combatente dele responde (`responder`). */
export interface PendenciaDBTParaJogador {
  id: string
  tipo: TipoDaPendencia
  combatenteId: string
  /** Só a ativa (a primeira da fila) aceita resposta; as outras esperam. */
  ativa: boolean
  texto: string
  opcoes: readonly OpcaoDaPendencia[]
}

/** A janela de reação aberta, se ele vê o atacante ou o alvo. */
export interface JanelaDBTParaJogador {
  pendenciaId: string
  atacanteId: string | null
  atacante: string
  alvoId: string | null
  alvo: string
  tecnica: string
  faixa: Faixa
  critico: boolean
  /** Só quando o alvo é "eu" ou "aliado". */
  danoPrevisto: number | null
}

/** Linha do registro para o jogador: só o texto público, na ordem do registro (a mais velha primeiro). */
export interface LinhaDBTParaJogador {
  id: string
  rodada: number
  tipo: TipoDaLinhaDBT
  autor: string
  texto: string
  detalhes: readonly string[]
  desfeita: boolean
  podeDesfazer: boolean
}

/** O recorte da batalha DBT de um jogador (`batalhaDBT.estado`). */
export interface VistaDBT {
  fase: 'iniciativa' | 'combate'
  rodada: number
  modo: ModoDaBatalha
  /** Token da vez, só se a tela dele tem a ficha. */
  vez: string | null
  /** A vez é de um combatente dele. */
  minhaVez: boolean
  /**
   * `basicosUsados`: os básicos já usados no turno do combatente dele que tem a
   * vez (o próximo rola com -n; anunciar mais de 3 só antes do 1º, 9.2); 0 fora
   * da vez dele. Opcional pelo mesmo motivo do `mesmoLado`.
   * `ateMinhaVez`: quantas vezes passam até um combatente dele jogar (1 = o
   * próximo), contando também quem está fora da vista; `null` = é a vez dele,
   * ninguém tem a vez, ou nenhum dele está de pé. Opcional pelo mesmo motivo.
   */
  turno: { n: number; m: number; basicosUsados?: number; ateMinhaVez?: number | null }
  cartas: readonly CartaDBT[]
  meus: readonly MeuCombatenteDBT[]
  declaracoes: readonly DeclaracaoDBT[]
  pendencias: readonly PendenciaDBTParaJogador[]
  janela: JanelaDBTParaJogador | null
  /** "Aguardando o mestre confirmar" e afins; null = é com ele (ou nada a esperar). */
  aguardando: string | null
  registro: readonly LinhaDBTParaJogador[]
  judge?: JudgeNaCena
}

/** O que o host sabe do jogador para recortar e conferir. */
export interface ContextoDoJogadorDBT {
  playerId: string
  /** `ownership[playerId]`. */
  meusTokens: ReadonlySet<string>
  /** tokenId → nome, das fichas que a tela dele tem agora. */
  tokensNoRecorte: ReadonlyMap<string, string>
  /** Os personagens ligados às fichas dele de verdade. */
  meusPersonagens: ReadonlySet<string>
  /** Personagens aliados (equipe; `aliadosDe` de lib/batalha/equipes). */
  aliados: ReadonlySet<string>
  /** Escala do mapa da cena (`metrosPorCasa`): o deslocamento em casas. */
  metrosPorCasa: number
}

/** Para conferir um comando bastam a posse e o recorte. */
export type PosseDoJogadorDBT = Pick<ContextoDoJogadorDBT, 'playerId' | 'meusTokens' | 'tokensNoRecorte' | 'meusPersonagens'>

/** A cena como a ponte devolve (`PonteDaBatalhaDBT.cena`). */
export type CenaParaVistaDBT = EstadoDBT & { judge?: JudgeNaCena }

type Fichas = ReadonlyMap<string, FichaLida | null>

function cortar(texto: string, maximo: number): string {
  return texto.length <= maximo ? texto : `${texto.slice(0, maximo - 1)}…`
}

/** Posse, como o One Piece: token dele E personagem dele (nunca a ficha emprestada nem o NPC que ele move). */
function ehMeu(c: CombatenteDBT, posse: PosseDoJogadorDBT): boolean {
  return posse.meusTokens.has(c.id) && c.personagemId !== null && posse.meusPersonagens.has(c.personagemId)
}

function ladoDe(c: CombatenteDBT, ctx: ContextoDoJogadorDBT): LadoNaVistaDBT {
  if (ctx.meusTokens.has(c.id)) return 'eu'
  if (c.personagemId === null) return 'outro'
  if (ctx.meusPersonagens.has(c.personagemId)) return 'eu'
  return ctx.aliados.has(c.personagemId) ? 'aliado' : 'outro'
}

function fichaDoCombatente(c: CombatenteDBT, fichas: Fichas): FichaLida | null {
  return c.personagemId === null ? null : (fichas.get(c.personagemId) ?? null)
}

function meusCombatentes(cena: NucleoDBT, posse: PosseDoJogadorDBT): CombatenteDBT[] {
  return Object.values(cena.combatentes).filter((c) => ehMeu(c, posse))
}

/** As opções que o fio aguenta: chave longa demais sai, rótulo e motivo cortados. */
function noFio<T extends { chave: string; rotulo: string; bloqueio: string | null }>(opcoes: readonly T[], teto: number): T[] {
  return opcoes
    .filter((opcao) => opcao.chave.length > 0 && opcao.chave.length <= CHAVE_DBT_MAX)
    .slice(0, teto)
    .map((opcao) => ({ ...opcao, rotulo: cortar(opcao.rotulo, ROTULO_DBT_MAX), bloqueio: opcao.bloqueio === null ? null : cortar(opcao.bloqueio, ROTULO_DBT_MAX) }))
}

// ───────────────────────────────────────────────────────────────────────────
// Pendências (as mesmas para a vista e para a conferência do host)
// ───────────────────────────────────────────────────────────────────────────

/**
 * As respostas de um combatente dele a uma pendência; null = não é com ele.
 * Mesmo endereçamento do motor (`pendencias.ts`): reação pelo convite,
 * Choque pelos dois lados, o resto pelo `responde`. "Reagir também" só na
 * janela ativa e só com reação pagável (bloqueada, nem aparece).
 */
function opcoesDoCombatente(t: Trabalho, pendencia: Pendencia, c: CombatenteDBT, ativa: boolean): OpcaoDaPendencia[] | null {
  switch (pendencia.tipo) {
    case 'declaracao':
    case 'confirmar':
      return null
    case 'reacao': {
      const { janela } = pendencia
      if (c.id === janela.ataque.atacanteId || Object.hasOwn(janela.respostas, c.id)) return null
      const opcoes = opcoesDaPendencia(t, pendencia, c.id)
      if (janela.convidados.includes(c.id)) return opcoes
      return ativa && opcoes.some((opcao) => opcao.chave === 'entrar' && opcao.bloqueio === null) ? opcoes : null
    }
    case 'choque': {
      const { choque } = pendencia
      const lado = choque.atacanteId === c.id ? 'atacante' : choque.defensorId === c.id ? 'defensor' : null
      if (lado === null || choque.apostas[lado] !== null) return null
      return opcoesDaPendencia(t, pendencia, c.id)
    }
    default:
      return pendencia.responde.tipo === 'combatente' && pendencia.responde.id === c.id ? opcoesDaPendencia(t, pendencia, c.id) : null
  }
}

interface PendenciaDoJogador {
  pendencia: Pendencia
  combatenteId: string
  ativa: boolean
  opcoes: OpcaoDaPendencia[]
}

function pendenciasDoJogador(t: Trabalho, cena: NucleoDBT, meus: readonly CombatenteDBT[]): PendenciaDoJogador[] {
  const saida: PendenciaDoJogador[] = []
  cena.pendencias.forEach((pendencia, i) => {
    for (const c of meus) {
      const opcoes = opcoesDoCombatente(t, pendencia, c, i === 0)
      if (opcoes !== null) saida.push({ pendencia, combatenteId: c.id, ativa: i === 0, opcoes })
    }
  })
  return saida
}

/** A frase da pendência; `nome` decide o que cada um vê (o mestre, todos os nomes; o jogador, os do recorte). */
function textoDaPendencia(pendencia: Pendencia, nome: (id: string) => string): string {
  switch (pendencia.tipo) {
    case 'declaracao':
      return 'Transformar antes do primeiro turno?'
    case 'confirmar':
      return pendencia.ataque === undefined ? 'O mestre confirma' : `O mestre confirma ${pendencia.ataque.tecnica.nome} de ${nome(pendencia.ataque.atacanteId)}`
    case 'reacao': {
      const { ataque } = pendencia.janela
      return `${nome(ataque.atacanteId)} usou ${ataque.tecnica.nome} em ${nome(ataque.alvoId)}`
    }
    case 'teste':
      return pendencia.teste.motivo === 'agarrao'
        ? `${nome(pendencia.teste.combatenteId)}: escape do agarrão (DES ou FOR)`
        : pendencia.teste.motivo === 'soltar'
          ? `${nome(pendencia.teste.combatenteId)}: tentar se soltar`
          : `${nome(pendencia.teste.combatenteId)}: estabilizar o voo`
    case 'salvaguarda':
      return `${nome(pendencia.combatenteId)}: salvaguarda contra a morte`
    case 'choque':
      return `Choque de Poder: ${nome(pendencia.choque.atacanteId)} ${pendencia.choque.placar.atacante} x ${pendencia.choque.placar.defensor} ${nome(pendencia.choque.defensorId)}`
    case 'apoioAoChoque':
      return `Apoio ao Choque de ${nome(pendencia.defensorId)} (falta +${pendencia.faltaEP} EP)`
    case 'acaoGratuita':
      return `${nome(pendencia.combatenteId)}: ação gratuita contra ${nome(pendencia.contra)}`
    case 'inicioDoTurno':
      return `${nome(pendencia.combatenteId)}: escolhas do início do turno`
    case 'queda':
      return `${nome(pendencia.combatenteId)} está caindo`
    case 'ataqueForcado':
      return `${nome(pendencia.combatenteId)} está confuso: ataque forçado`
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Vista do jogador
// ───────────────────────────────────────────────────────────────────────────

function recursoDe(valor: { atual: number; max: number }): RecursoNaVistaDBT {
  return { atual: valor.atual, max: valor.max }
}

/** `meusLados`: os lados da batalha dos combatentes dele (posse de verdade, `ehMeu`). */
function cartasDaVista(cena: NucleoDBT, fichas: Fichas, ctx: ContextoDoJogadorDBT, meusLados: ReadonlySet<Lado>): CartaDBT[] {
  const cartas: CartaDBT[] = []
  for (const id of cena.ordem.cartas) {
    const c = Object.hasOwn(cena.combatentes, id) ? cena.combatentes[id] : undefined
    const nome = ctx.tokensNoRecorte.get(id)
    if (c === undefined || nome === undefined || id.length > ID_DBT_MAX) continue
    const lado = ladoDe(c, ctx)
    const f = lado === 'outro' ? null : fichaDoCombatente(c, fichas)
    const agarrador = c.agarrado?.porId
    // O personagem só de "eu" e "aliado": o do inimigo (e o do NPC do lado dele) não sai do host.
    const personagemId = lado !== 'outro' && c.personagemId !== null && c.personagemId.length <= ID_DBT_MAX ? c.personagemId : null
    cartas.push({
      tokenId: id,
      nome: cortar(nome, NOME_DBT_MAX),
      lado,
      mesmoLado: meusLados.has(c.lado),
      ...(personagemId === null ? {} : { personagemId }),
      iniciativa: c.iniciativa?.total ?? null,
      pv: f === null ? null : recursoDe(f.pv),
      pk: f === null ? null : recursoDe(f.pk),
      condicoes: c.condicoes
        .filter((condicao) => condicao.id.length <= ID_DBT_MAX)
        .slice(0, CONDICOES_DBT_MAX)
        .map((condicao) => ({ id: condicao.id, condicao: condicao.condicao, nome: cortar(condicao.nome, NOME_DBT_MAX) })),
      transformacao: c.transformacao === null ? null : cortar(c.transformacao.nome, NOME_DBT_MAX),
      voo: c.voo,
      situacao: c.morte.situacao,
      agarrado: c.agarrado !== null,
      agarradoPor: agarrador !== undefined && ctx.tokensNoRecorte.has(agarrador) ? agarrador : null,
    })
    if (cartas.length >= CARTAS_DBT_MAX) break
  }
  return cartas
}

/**
 * Quantas vezes passam até um combatente dele jogar, pela ordem INTEIRA (quem
 * está fora da vista também joga antes): o mesmo passo de `proximaVez`, que
 * pula inconsciente e morto. `null` = é a vez dele, ninguém tem a vez, ou
 * nenhum dele joga.
 */
function ateMinhaVezDe(cena: NucleoDBT, meus: ReadonlySet<string>): number | null {
  const { cartas, vez } = cena.ordem
  if (cena.fase !== 'combate' || vez === null || meus.has(vez)) return null
  const indice = cartas.indexOf(vez)
  if (indice < 0) return null
  let passos = 0
  for (let passo = 1; passo < cartas.length; passo += 1) {
    const id = cartas[(indice + passo) % cartas.length]
    const c = Object.hasOwn(cena.combatentes, id) ? cena.combatentes[id] : undefined
    if (c === undefined || foraDeCombate(c)) continue
    passos += 1
    if (meus.has(id)) return passos
  }
  return null
}

function vezDoCombatente(cena: NucleoDBT, c: CombatenteDBT): { rodada: number; turno: number } | null {
  return cena.fase === 'combate' && cena.ordem.vez === c.id && cena.pendencias.length === 0 ? { rodada: cena.ordem.rodada, turno: c.turnosJogados } : null
}

function meusDaVista(t: Trabalho, cena: NucleoDBT, fichas: Fichas, ctx: ContextoDoJogadorDBT, meus: readonly CombatenteDBT[]): MeuCombatenteDBT[] {
  const saida: MeuCombatenteDBT[] = []
  for (const c of meus) {
    const f = fichaDoCombatente(c, fichas)
    // Combatente manual (ficha sem `dbt`): o mestre resolve tudo; não há o que mostrar nem pedir.
    if (f === null || c.personagemId === null || c.id.length > ID_DBT_MAX) continue
    const vez = vezDoCombatente(cena, c)
    saida.push({
      tokenId: c.id,
      personagemId: c.personagemId,
      nome: cortar(ctx.tokensNoRecorte.get(c.id) ?? c.nome, NOME_DBT_MAX),
      pv: recursoDe(f.pv),
      pk: recursoDe(f.pk),
      epBase: f.epBase,
      epTotal: epTotal(c, f),
      ca: caEfetiva(c, f),
      deslocamento: {
        casas: casasDoDeslocamento(ctx.metrosPorCasa, f.deslocamentoM, temCondicao(c, 'caido')),
        andou: cena.turno?.combatenteId === c.id ? cena.turno.andou : 0,
      },
      voo: c.voo,
      transformacao: c.transformacao === null ? null : { id: c.transformacao.id, nome: cortar(c.transformacao.nome, NOME_DBT_MAX), estagio: c.transformacao.estagio },
      vez,
      acoes: vez === null ? [] : noFio(opcoesDeAcao(t, c.id), ACOES_DBT_MAX),
    })
    if (saida.length >= MEUS_DBT_MAX) break
  }
  return saida
}

function declaracoesDaVista(cena: NucleoDBT, fichas: Fichas, meus: readonly CombatenteDBT[]): DeclaracaoDBT[] {
  if (cena.fase !== 'iniciativa') return []
  const pendencia = cena.pendencias.find((candidata) => candidata.tipo === 'declaracao')
  if (pendencia === undefined || pendencia.tipo !== 'declaracao') return []
  const saida: DeclaracaoDBT[] = []
  for (const c of meus) {
    const f = fichaDoCombatente(c, fichas)
    if (f === null || !pendencia.faltam.includes(c.id)) continue
    const formas = f.transformacoes
      .filter((forma) => forma.id.length <= ID_DBT_MAX)
      .slice(0, FORMAS_DBT_MAX)
      .map((forma) => ({ id: forma.id, nome: cortar(forma.nome, NOME_DBT_MAX), estagio: forma.estagio, ki: forma.ki }))
    saida.push({ combatenteId: c.id, formas })
  }
  return saida.slice(0, MEUS_DBT_MAX)
}

function janelaDaVista(cena: NucleoDBT, ctx: ContextoDoJogadorDBT): JanelaDBTParaJogador | null {
  const ativa = cena.pendencias[0]
  if (ativa === undefined || ativa.tipo !== 'reacao') return null
  const { ataque } = ativa.janela
  const atacante = ctx.tokensNoRecorte.get(ataque.atacanteId)
  const alvo = ctx.tokensNoRecorte.get(ataque.alvoId)
  if (atacante === undefined && alvo === undefined) return null
  const alvoCombatente = Object.hasOwn(cena.combatentes, ataque.alvoId) ? cena.combatentes[ataque.alvoId] : undefined
  const alvoVisivel = alvoCombatente !== undefined && ladoDe(alvoCombatente, ctx) !== 'outro'
  return {
    pendenciaId: ativa.id,
    atacanteId: atacante === undefined ? null : ataque.atacanteId,
    atacante: atacante === undefined ? FORA_DA_VISTA_DBT : cortar(atacante, NOME_DBT_MAX),
    alvoId: alvo === undefined ? null : ataque.alvoId,
    alvo: alvo === undefined ? FORA_DA_VISTA_DBT : cortar(alvo, NOME_DBT_MAX),
    tecnica: cortar(ataque.tecnica.nome, NOME_DBT_MAX),
    faixa: ataque.faixa,
    critico: ataque.critico,
    danoPrevisto: alvoVisivel ? ataque.danoPrevisto : null,
  }
}

function nomeDoAutor(autor: AutorDBT): string {
  return autor.tipo === 'mestre' ? 'Mestre' : cortar(autor.nome, NOME_DBT_MAX)
}

function registroDaVista(registro: readonly LinhaDBT[], ctx: ContextoDoJogadorDBT): LinhaDBTParaJogador[] {
  // Linha que só fala de fichas fora da tela dele não sai (o nome do NPC que ele não vê).
  const vistas = registro.filter((linha) => linha.envolve.tokenIds.length === 0 || linha.envolve.tokenIds.some((id) => ctx.tokensNoRecorte.has(id)))
  const porId = new Map(registro.map((linha) => [linha.id, linha]))
  const quem: AutorDBT = { tipo: 'jogador', playerId: ctx.playerId, nome: '' }
  return linhasParaJogador(vistas)
    .filter((linha) => linha.id.length <= ID_DBT_MAX)
    .slice(-REGISTRO_DBT_JOGADOR_MAX)
    .map((linha) => {
      const original = porId.get(linha.id)
      return {
        id: linha.id,
        rodada: linha.rodada,
        tipo: linha.tipo,
        autor: original === undefined ? '' : nomeDoAutor(original.autor),
        texto: cortar(linha.texto, TEXTO_DBT_MAX),
        detalhes: linha.detalhes.slice(0, DETALHES_MAX).map((detalhe) => cortar(detalhe, TEXTO_DBT_MAX)),
        desfeita: linha.desfeita,
        podeDesfazer: original !== undefined && !linha.desfeita && podeDesfazerDBT(original, quem, registro),
      }
    })
}

function aguardandoDe(cena: NucleoDBT, ctx: ContextoDoJogadorDBT, meus: ReadonlySet<string>, delas: readonly PendenciaDoJogador[], declaracoes: number): string | null {
  const nomeNaTela = (id: string): string | null => ctx.tokensNoRecorte.get(id) ?? null
  if (cena.fase === 'iniciativa') return declaracoes > 0 ? null : 'Aguardando a iniciativa'
  const ativa = cena.pendencias[0]
  if (ativa !== undefined) {
    if (delas.some((pendencia) => pendencia.ativa)) return null
    if (ativa.tipo === 'confirmar') return 'Aguardando o mestre confirmar'
    if (ativa.tipo === 'reacao') return 'Aguardando as reações'
    if (ativa.responde.tipo === 'mestre') return 'Aguardando o mestre'
    const nome = nomeNaTela(ativa.responde.id)
    return nome === null ? 'Aguardando outro jogador' : `Aguardando ${cortar(nome, NOME_DBT_MAX)}`
  }
  const vez = cena.ordem.vez
  if (vez !== null && meus.has(vez)) return null
  const nome = vez === null ? null : nomeNaTela(vez)
  return nome === null ? 'Aguardando a vez' : `Vez de ${cortar(nome, NOME_DBT_MAX)}`
}

/** O recorte da batalha para um jogador (`batalhaDBT.estado`). */
export function vistaParaJogadorDBT(cena: CenaParaVistaDBT, fichas: Fichas, ctx: ContextoDoJogadorDBT): VistaDBT {
  const t = trabalhoDeLeitura(cena, fichas)
  const meus = meusCombatentes(cena, ctx)
  const meusIds = new Set(meus.map((c) => c.id))
  const delas = pendenciasDoJogador(t, cena, meus)
  const declaracoes = declaracoesDaVista(cena, fichas, meus)
  const nomeNaTela = (id: string): string => ctx.tokensNoRecorte.get(id) ?? FORA_DA_VISTA_DBT
  const vez = cena.ordem.vez
  // Os básicos do turno só quando o turno é de um combatente dele: o de NPC não interessa ao menu dele.
  const basicosUsados = cena.turno !== null && meusIds.has(cena.turno.combatenteId) ? cena.turno.basicosUsados : 0
  const vista: VistaDBT = {
    fase: cena.fase,
    rodada: cena.ordem.rodada,
    modo: cena.opcoes.modo,
    vez: vez !== null && ctx.tokensNoRecorte.has(vez) && vez.length <= ID_DBT_MAX ? vez : null,
    minhaVez: vez !== null && meusIds.has(vez),
    turno: { ...turnoNoM(cena), basicosUsados, ateMinhaVez: ateMinhaVezDe(cena, meusIds) },
    cartas: cartasDaVista(cena, fichas, ctx, new Set(meus.map((c) => c.lado))),
    meus: meusDaVista(t, cena, fichas, ctx, meus),
    declaracoes,
    pendencias: delas
      .filter(({ pendencia }) => pendencia.id.length <= ID_DBT_MAX)
      .slice(0, PENDENCIAS_DBT_MAX)
      .map(({ pendencia, combatenteId, ativa, opcoes }) => ({
        id: pendencia.id,
        tipo: pendencia.tipo,
        combatenteId,
        ativa,
        texto: cortar(textoDaPendencia(pendencia, nomeNaTela), TEXTO_DBT_MAX),
        opcoes: noFio(opcoes, OPCOES_DBT_MAX),
      })),
    janela: janelaDaVista(cena, ctx),
    aguardando: aguardandoDe(cena, ctx, meusIds, delas, declaracoes.length),
    registro: registroDaVista(cena.registro, ctx),
  }
  if (cena.judge !== undefined) vista.judge = cena.judge
  return vista
}

/**
 * Os efeitos novos (`seq` > `depoisDe`) para um jogador: só com fichas que a
 * tela dele tem; o número (dano, cura) só quando todas as fichas do efeito
 * são "eu" ou "aliado" (`numerosVisiveis`). NPC: só a faixa, se houver.
 */
export function efeitosParaJogadorDBT(efeitos: readonly EfeitoDBT[], depoisDe: number, noRecorte: ReadonlySet<string>, numerosVisiveis: ReadonlySet<string>): EfeitoDBT[] {
  const saida: EfeitoDBT[] = []
  for (const efeito of efeitos) {
    if (efeito.seq <= depoisDe) continue
    const tokenIds = efeito.tokenIds.filter((id) => noRecorte.has(id) && id.length <= ID_DBT_MAX)
    if (tokenIds.length === 0) continue
    const numeroVisivel = efeito.tokenIds.every((id) => numerosVisiveis.has(id))
    const { alvoId, ...resto } = efeito
    // O alvo fora da vista não vai (seria o id de uma ficha que a tela dele não tem): o aviso não cai em ninguém.
    const alvoNaVista = alvoId !== undefined && tokenIds.includes(alvoId)
    saida.push({ ...resto, tokenIds, numero: numeroVisivel ? efeito.numero : null, ...(alvoNaVista ? { alvoId } : {}) })
  }
  return saida.slice(-EFEITOS_DBT_GUARDADOS)
}

/** Fichas cujos números (PV, dano, cura) o jogador vê: as dele e as dos aliados. */
export function numerosVisiveisDBT(cena: NucleoDBT, ctx: ContextoDoJogadorDBT): Set<string> {
  const visiveis = new Set<string>()
  for (const c of Object.values(cena.combatentes)) if (ladoDe(c, ctx) !== 'outro') visiveis.add(c.id)
  return visiveis
}

// ───────────────────────────────────────────────────────────────────────────
// Conferência do host
// ───────────────────────────────────────────────────────────────────────────

/**
 * O jogador pode mandar este comando? Posse (token E personagem dele), vez
 * e rodada que a vista mostrou, a chave entre as opções que a vista mostrou
 * (`opcoesDeAcao`/`opcoesDaPendencia`, a mesma função do motor) e alvos só
 * entre as fichas da tela dele. Iniciativa, ordem, começar, andar e o menu do
 * mestre nunca vêm do jogador. O motor confere tudo de novo.
 */
export function podeComandar(cena: NucleoDBT, fichas: Fichas, posse: PosseDoJogadorDBT, comando: ComandoDBT): boolean {
  switch (comando.tipo) {
    case 'declarar': {
      const c = Object.hasOwn(cena.combatentes, comando.combatenteId) ? cena.combatentes[comando.combatenteId] : undefined
      if (c === undefined || !ehMeu(c, posse) || cena.fase !== 'iniciativa') return false
      const pendencia = cena.pendencias.find((candidata) => candidata.tipo === 'declaracao')
      if (pendencia === undefined || pendencia.tipo !== 'declaracao' || !pendencia.faltam.includes(c.id)) return false
      const f = fichaDoCombatente(c, fichas)
      return f !== null && (comando.transformacaoId === null || f.transformacoes.some((forma) => forma.id === comando.transformacaoId))
    }
    case 'agir': {
      const c = Object.hasOwn(cena.combatentes, comando.combatenteId) ? cena.combatentes[comando.combatenteId] : undefined
      if (c === undefined || !ehMeu(c, posse)) return false
      const vez = vezDoCombatente(cena, c)
      if (vez === null || vez.rodada !== comando.vez.rodada || vez.turno !== comando.vez.turno) return false
      if (comando.alvos.length > ALVOS_MAX || new Set(comando.alvos).size !== comando.alvos.length) return false
      if (comando.alvos.some((alvo) => !posse.tokensNoRecorte.has(alvo) || !Object.hasOwn(cena.combatentes, alvo))) return false
      const opcao = opcoesDeAcao(trabalhoDeLeitura(cena, fichas), c.id).find((candidata) => candidata.chave === comando.opcao)
      return opcao !== undefined && opcao.bloqueio === null && comando.alvos.length <= Math.max(opcao.alvosMax, 0)
    }
    case 'passar': {
      const c = Object.hasOwn(cena.combatentes, comando.vez.combatenteId) ? cena.combatentes[comando.vez.combatenteId] : undefined
      if (c === undefined || !ehMeu(c, posse)) return false
      const vez = vezDoCombatente(cena, c)
      return vez !== null && vez.rodada === comando.vez.rodada && vez.turno === comando.vez.turno
    }
    case 'responder': {
      if (comando.combatenteId === null || comando.edicoes !== undefined) return false
      const c = Object.hasOwn(cena.combatentes, comando.combatenteId) ? cena.combatentes[comando.combatenteId] : undefined
      if (c === undefined || !ehMeu(c, posse)) return false
      const dela = pendenciasDoJogador(trabalhoDeLeitura(cena, fichas), cena, [c]).find((candidata) => candidata.pendencia.id === comando.pendenciaId)
      if (dela === undefined || !dela.ativa) return false
      const opcao = dela.opcoes.find((candidata) => candidata.chave === comando.opcao)
      if (opcao === undefined || opcao.bloqueio !== null) return false
      // Aposta e atributo só onde a opção pede.
      if (comando.aposta !== undefined && opcao.pede !== 'aposta') return false
      return comando.atributo === undefined || opcao.pede === 'atributo'
    }
    case 'rolarIniciativa':
    case 'ordenar':
    case 'comecar':
    case 'andou':
    case 'mestre':
      return false
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Mestre
// ───────────────────────────────────────────────────────────────────────────

/** A linha como `components/batalha/RegistroDaBatalha.tsx` a mostra (mesma forma de `LinhaNaTela`). */
export interface LinhaNaTelaDBT {
  id: string
  rodada: number
  autor: string
  texto: string
  desfeitaPor: string | null
  podeDesfazer: boolean
}

/** O registro inteiro do mestre, a mais nova em cima; Desfazer só na última de pé (LIFO). */
export function linhasDoMestre(registro: readonly LinhaDBT[]): LinhaNaTelaDBT[] {
  const mestre: AutorDBT = { tipo: 'mestre' }
  const saida: LinhaNaTelaDBT[] = []
  for (let i = registro.length - 1; i >= 0; i -= 1) {
    const linha = registro[i]
    saida.push({
      id: linha.id,
      rodada: linha.rodada,
      autor: nomeDoAutor(linha.autor),
      texto: linha.texto,
      desfeitaPor: linha.desfeita?.por ?? null,
      podeDesfazer: linha.desfeita === undefined && podeDesfazerDBT(linha, mestre, registro),
    })
  }
  return saida
}

/** O registro do jogador (`VistaDBT.registro`) na forma da tela, a mais nova em cima. */
export function linhasDoJogadorNaTela(registro: readonly LinhaDBTParaJogador[]): LinhaNaTelaDBT[] {
  return [...registro].reverse().map((linha) => ({
    id: linha.id,
    rodada: linha.rodada,
    autor: linha.autor,
    texto: linha.texto,
    desfeitaPor: linha.desfeita ? 'desfeita' : null,
    podeDesfazer: linha.podeDesfazer,
  }))
}

export interface PendenciaNoMestreDBT {
  pendencia: Pendencia
  ativa: boolean
  texto: string
  /** As respostas do mestre (por ele mesmo; reação: pelo alvo, mais "Resolver reações"). */
  opcoes: readonly OpcaoDaPendencia[]
}

/** O view-model do painel do mestre (todos os números, todos os nomes). */
export interface VistaDoMestreDBT {
  turno: { n: number; m: number }
  vez: CombatenteDBT | null
  /** As ações do combatente da vez (fila vazia, fase combate); vazio fora disso. */
  acoesDaVez: readonly OpcaoDeAcao[]
  pendencias: readonly PendenciaNoMestreDBT[]
  vitorias: readonly VitoriaAutomaticaDBT[]
  ladosDerrotados: readonly Lado[]
  linhas: readonly LinhaNaTelaDBT[]
}

export function vistaDoMestreDBT(cena: EstadoDBT, fichas: Fichas): VistaDoMestreDBT {
  const t = trabalhoDeLeitura(cena, fichas)
  const nome = (id: string): string => (Object.hasOwn(cena.combatentes, id) ? cena.combatentes[id].nome : '?')
  const vezId = cena.ordem.vez
  const vez = vezId !== null && Object.hasOwn(cena.combatentes, vezId) ? cena.combatentes[vezId] : null
  const lados = new Set(Object.values(cena.combatentes).map((c) => c.lado))
  return {
    turno: turnoNoM(cena),
    vez,
    acoesDaVez: vez !== null && vezDoCombatente(cena, vez) !== null ? opcoesDeAcao(t, vez.id) : [],
    pendencias: cena.pendencias.map((pendencia, i) => ({ pendencia, ativa: i === 0, texto: textoDaPendencia(pendencia, nome), opcoes: opcoesDaPendencia(t, pendencia, null) })),
    vitorias: vitoriasAutomaticas(cena, fichas),
    ladosDerrotados: lados.size > 1 ? ladosDerrotados(cena) : [],
    linhas: linhasDoMestre(cena.registro),
  }
}

/** As respostas de um combatente (o mestre "Responder por ele"); `null` = as do mestre. */
export function opcoesDaPendenciaNoMestre(cena: NucleoDBT, fichas: Fichas, pendenciaId: string, combatenteId: string | null): OpcaoDaPendencia[] {
  const pendencia = cena.pendencias.find((candidata) => candidata.id === pendenciaId)
  return pendencia === undefined ? [] : opcoesDaPendencia(trabalhoDeLeitura(cena, fichas), pendencia, combatenteId)
}

/** As ações de um combatente agora (o mestre age pelo NPC da vez ou pelo controlado). */
export function opcoesDeAcaoNoMestre(cena: NucleoDBT, fichas: Fichas, combatenteId: string): OpcaoDeAcao[] {
  return opcoesDeAcao(trabalhoDeLeitura(cena, fichas), combatenteId)
}
