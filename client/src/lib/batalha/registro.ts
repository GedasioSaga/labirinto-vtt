import {
  aplicarAjustes,
  JANELA_DO_REGISTRO_MS,
  maximoBase,
  NOME_DO_MESTRE,
  rotuloDaParte,
  temMaximo,
  valorDaParte,
  type Ajuste,
} from '../ajusteDaFicha'
import { numeroDaFicha, type ParteDoAjuste, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { combateVazio, type AlvoDoGolpe, type CombateDoPersonagem, type ContraAtaque, type FormaNaBatalha, type GolpeDaBatalha, type LembreteDaPassiva, type SeloDaBatalha } from './combate'
import { semEvoluida } from './escolhaEEvolucao'
import { passivasLigadas } from './passivas'
import type { RegrasDaBatalha } from './regrasDoCampo'
import { inserirCarta, removerCarta, type AcoesExtras, type AutorDaAcao, type CartaDaOrdem, type GastoDaVez, type TurnosDaCena } from './turnos'

/**
 * REGISTRO DA BATALHA (decisão 5 de docs/planos/batalha-one-piece-2026-10-30.md):
 * cada coisa que muda na batalha vira uma linha com Desfazer. O mestre desfaz
 * qualquer linha; o jogador, só a dele e só durante a vez dele. A linha
 * desfeita FICA, riscada, com quem desfez — e não se desfaz de novo.
 *
 * Cada linha guarda o que precisa para voltar (`Reversao`). A ficha volta por
 * DELTA sobre o valor de agora, nunca pelo personagem inteiro de antes: isso
 * apagaria o que mudou depois (outro golpe, a ficha editada pelo jogador).
 *
 * Mora na sessão do mestre (`stores/batalhaStore.ts`); ao jogador sai só o
 * recorte de `registroParaJogador`. Os tipos da F2 (golpe, reação, dano,
 * ações gastas e extras) já estão aqui para a tela e o Desfazer não mudarem
 * de forma quando ela chegar; a F1 só escreve os da primeira linha.
 *
 * Puro: sem store, sem rede.
 */

export type TipoDaLinha =
  // F1
  | 'vez' | 'ordem' | 'cartaExtra' | 'combatente' | 'equipe' | 'ficha' | 'regras' | 'desempate'
  // F2: a F1 nunca escreve; a tela já sabe mostrar.
  | 'acao' | 'golpe' | 'reacao' | 'dano' | 'habilidade' | 'acoesExtras' | 'transformacao'
  // F3 (fatia T): o mestre pôs, editou ou tirou um selo.
  | 'selo'

/** Um número da ficha que a linha mudou, de quanto para quanto. Cartão: 1 = ligado, 0 = desligado. */
export interface ParteDaFicha {
  parte: Extract<ParteDoAjuste, 'recurso' | 'maximo' | 'cartao'>
  chave: string
  de: number
  para: number
}

/** O que o Desfazer precisa para voltar a linha. */
export type Reversao =
  /** Passar a vez: a vez e a rodada de antes, as extras "só nesta rodada" que saíram (com o lugar) e os gastos zerados. */
  | {
      tipo: 'vez'
      antes: {
        vez: string | null
        rodada: number
        removidas: readonly { carta: CartaDaOrdem; indice: number }[]
        gastos: TurnosDaCena['gastos']
        /** F2: as ações extras de antes (as "rodada" somem ao passar). Ausente = a vez não mexeu nelas. */
        extras?: TurnosDaCena['extras']
        /** F2: o combate de antes (a recarga desce no começo da vez). Ausente = a vez não mexeu nele. */
        combate?: TurnosDaCena['combate']
        /** F3: os selos de antes (a carta que sai desconta). Ausente = a vez não mexeu neles. */
        selos?: TurnosDaCena['selos']
      }
    }
  /** Mover, Ordenar, desempate: os ids na ordem de antes. Desfazer reaplica às cartas que ainda existem. */
  | { tipo: 'ordem'; antes: readonly string[] }
  /** Carta extra ou combatente que entrou: desfazer = tirar. */
  | { tipo: 'cartaNova'; cartaId: string }
  /** Carta que saiu: desfazer = pôr de volta no mesmo lugar. */
  | { tipo: 'cartaRemovida'; carta: CartaDaOrdem; indice: number }
  | { tipo: 'equipe'; personagemId: string; antes: string | null; depois: string | null }
  | { tipo: 'ficha'; personagemId: string; partes: readonly ParteDaFicha[] }
  | { tipo: 'regras'; antes: RegrasDaBatalha | null }
  /** F2: ações gastas na vez (Simples, Movimento, Bônus). `null` = não tinha gasto nenhum. */
  | { tipo: 'gasto'; cartaId: string; antes: GastoDaVez | null }
  /** F2: ações extras dadas pelo mestre. `null` = não tinha extra. */
  | { tipo: 'acoesExtras'; cartaId: string; antes: AcoesExtras | null }
  /**
   * F2: recargas, usos, Overload, carga, armas, lembretes, lembradas ou
   * evoluídas de um personagem, antes e depois da linha. `antes` `null` = não
   * tinha combate. Desfazer volta SÓ o que a linha mudou (`combateSemALinha`).
   */
  | { tipo: 'combate'; personagemId: string; antes: CombateDoPersonagem | null; depois: CombateDoPersonagem }
  /**
   * "Zerar" a concentração: só a carga de antes. Desfazer volta SÓ a carga,
   * sem tocar recargas, usos e armas que mudaram depois (o `combate` inteiro
   * de antes apagaria isso).
   */
  | { tipo: 'carga'; personagemId: string; antes: CombateDoPersonagem['carga'] }
  /** F2: o golpe que nasceu na linha. Desfazer = tirá-lo dos pendentes (alvo que esperava não recebe mais nada) e o contra-ataque que ele deu. */
  | { tipo: 'golpe'; golpeId: string }
  /** F2 (Q6): o contra-ataque gasto na linha. Desfazer = devolvê-lo. */
  | { tipo: 'contra'; contra: ContraAtaque }
  /** F2: um golpe = a ficha de N alvos + o gasto de quem atacou, desfeitos juntos. */
  | { tipo: 'composta'; partes: readonly Reversao[] }
  /** F3: a forma (e a imagem) de um personagem antes da linha. `null` = não tinha. */
  | { tipo: 'forma'; personagemId: string; antes: FormaNaBatalha | null }
  /**
   * F3: um selo antes da linha (pôr = `null`; editar e tirar = o de antes).
   * `editado` = a linha trocou o selo sem tirá-lo: se ele sumiu depois
   * (desligado, desfeito, acabou), o Desfazer não o põe de volta.
   */
  | { tipo: 'selo'; seloId: string; antes: SeloDaBatalha | null; editado?: true }
  /**
   * Tipos de habilidade F1: a reação com técnica (`reagirComTecnica`).
   * `golpe` = o golpe logo DEPOIS da reação; `alvoAntes` = o alvo antes dela.
   * Desfazer = o alvo volta a esperar reação (e sai o contra-ataque que ela
   * deu). A store não volta o golpe cuja linha já foi desfeita.
   */
  | { tipo: 'reacaoComTecnica'; golpe: GolpeDaBatalha; tokenId: string; alvoAntes: AlvoDoGolpe }
  /**
   * Tipos de habilidade F4: a técnica que evoluiu na linha. Desfazer tira SÓ
   * ela de `evoluidas` (o combate inteiro de antes apagaria recarga e uso
   * posteriores).
   */
  | { tipo: 'evolucao'; personagemId: string; cartaoId: string }

export interface LinhaDoRegistro {
  id: string
  /** Sobe de 1 em 1 na batalha: a ordem das linhas, mesmo com o relógio igual. */
  seq: number
  /** `Date.now()` do host. */
  quando: number
  rodada: number
  autor: AutorDaAcao
  tipo: TipoDaLinha
  /** Montado com nomes, no máximo `REGISTRO_TEXTO_MAX`. O do mestre pode ter número de NPC: nunca sai a jogador sem passar pelo recorte. */
  texto: string
  /** Quem a linha toca, para o recorte do jogador. Vazio = a linha não fala de ninguém (regras). */
  envolve: { tokenIds: readonly string[]; personagemIds: readonly string[] }
  reversao: Reversao
  /** Desfeita: o nome de quem desfez ("Mestre" ou o do jogador) e quando. */
  desfeita?: { por: string; quando: number }
}

/** A linha como o jogador a recebe: sem reversão, sem ids de quem ele não vê. Desfazer só vale com `podeDesfazer`. */
export interface LinhaParaJogador {
  id: string
  rodada: number
  /** "Mestre" ou o nome do jogador na mesa. */
  autor: string
  texto: string
  desfeita?: { por: string }
  podeDesfazer: boolean
}

/** Linhas guardadas por batalha: passou, as mais velhas saem. */
export const REGISTRO_MAX = 300
/** Quantas linhas o jogador recebe: as mais novas. */
export const REGISTRO_PARA_JOGADOR_MAX = 50
/** Teto do texto de uma linha (cortado ao montar; o fio recusa acima disso). */
export const REGISTRO_TEXTO_MAX = 200
/** Teto do nome de quem fez ou desfez, no fio. */
export const AUTOR_NO_REGISTRO_MAX = 80

/** Os tipos de linha que o JOGADOR desfaz (na vez dele, só as dele). */
export const TIPOS_QUE_O_JOGADOR_DESFAZ: ReadonlySet<TipoDaLinha> = new Set<TipoDaLinha>(['ficha', 'acao', 'golpe', 'habilidade', 'dano', 'reacao', 'transformacao'])

/** Quem pede o Desfazer: o mestre, ou o jogador desta conexão. O nome não decide nada. */
export type QuemDesfaz = { tipo: 'mestre' } | { tipo: 'jogador'; playerId: string }

/**
 * A linha pode ser desfeita por `quem`? Desfeita nunca. O mestre, qualquer
 * outra. O jogador, só a que ele fez, de tipo permitido, e só quando é a vez
 * dele (`vezDoJogador`: a carta da vez é de ficha dele).
 */
export function podeDesfazer(linha: LinhaDoRegistro, quem: QuemDesfaz, vezDoJogador: boolean): boolean {
  if (linha.desfeita !== undefined) return false
  if (quem.tipo === 'mestre') return true
  return (
    vezDoJogador &&
    linha.autor.tipo === 'jogador' &&
    linha.autor.playerId === quem.playerId &&
    TIPOS_QUE_O_JOGADOR_DESFAZ.has(linha.tipo)
  )
}

/** Quem fez ou desfez sem nome (não deveria acontecer: a mesa exige nome na entrada). */
const AUTOR_SEM_NOME = 'Jogador'

/** O nome do autor como aparece na linha. */
export function nomeDoAutor(autor: AutorDaAcao): string {
  return autor.tipo === 'mestre' ? NOME_DO_MESTRE : autor.nome
}

/** O nome no teto do fio e nunca vazio: o fio recusa autor vazio e derrubaria o estado inteiro. */
function nomeNoFio(nome: string): string {
  return nome.trim().slice(0, AUTOR_NO_REGISTRO_MAX) || AUTOR_SEM_NOME
}

/** O que o recorte do registro precisa saber do jogador. */
export interface ContextoDoRegistro {
  playerId: string
  /** É a vez dele agora (acende o Desfazer). */
  minhaVez: boolean
  /** Os tokens que a tela dele tem agora. */
  tokensNoRecorte: ReadonlySet<string>
  /** Os personagens dele e os dos aliados (`aliadosDe`). */
  personagensVisiveis: ReadonlySet<string>
  /** Os personagens de tipo NPC: linha de ficha que toca um deles nunca sai. */
  npcs: ReadonlySet<string>
}

function linhaVisivel(linha: LinhaDoRegistro, ctx: ContextoDoRegistro): boolean {
  const { tokenIds, personagemIds } = linha.envolve
  if (!tokenIds.every((id) => ctx.tokensNoRecorte.has(id))) return false
  if (!personagemIds.every((id) => ctx.personagensVisiveis.has(id))) return false
  // Ficha de NPC é número que o jogador nunca vê (decisão 1), nem a do NPC que ele controla.
  return linha.tipo !== 'ficha' || !personagemIds.some((id) => ctx.npcs.has(id))
}

/**
 * O registro como o jogador o vê: só as linhas cujas fichas estão todas no
 * recorte dele e cujos personagens são dele ou de aliado; nunca a de ficha de
 * NPC. As `REGISTRO_PARA_JOGADOR_MAX` mais novas, na mesma ordem do registro
 * (da mais velha à mais nova): a tela inverte se quiser a mais nova em cima.
 */
export function registroParaJogador(linhas: readonly LinhaDoRegistro[], ctx: ContextoDoRegistro): LinhaParaJogador[] {
  const quem: QuemDesfaz = { tipo: 'jogador', playerId: ctx.playerId }
  const saem: LinhaParaJogador[] = []
  // De trás para a frente: para nas 50 mais novas sem varrer as 300.
  for (let i = linhas.length - 1; i >= 0 && saem.length < REGISTRO_PARA_JOGADOR_MAX; i -= 1) {
    const linha = linhas[i]
    if (linha === undefined || !linhaVisivel(linha, ctx)) continue
    const paraJogador: LinhaParaJogador = {
      id: linha.id,
      rodada: linha.rodada,
      autor: nomeNoFio(nomeDoAutor(linha.autor)),
      texto: linha.texto.slice(0, REGISTRO_TEXTO_MAX),
      podeDesfazer: podeDesfazer(linha, quem, ctx.minhaVez),
    }
    if (linha.desfeita !== undefined) paraJogador.desfeita = { por: nomeNoFio(linha.desfeita.por) }
    saem.push(paraJogador)
  }
  return saem.reverse()
}

// ───────────────────────────────────────────────────────────────────────────
// Escrever e desfazer (o lado da store)
// ───────────────────────────────────────────────────────────────────────────

export function novoIdDeLinha(): string {
  return `linha_${crypto.randomUUID()}`
}

/** O registro com a linha no fim; passou de `REGISTRO_MAX`, as mais velhas saem. */
export function comLinha(registro: readonly LinhaDoRegistro[], linha: LinhaDoRegistro): LinhaDoRegistro[] {
  return [...registro, linha].slice(-REGISTRO_MAX)
}

/** O próximo `seq`: um a mais que a última linha (o teto tira as velhas, nunca a última). */
export function proximoSeq(registro: readonly LinhaDoRegistro[]): number {
  return (registro[registro.length - 1]?.seq ?? 0) + 1
}

/** O texto da linha no teto do fio. */
export function textoDaLinha(texto: string): string {
  return texto.length <= REGISTRO_TEXTO_MAX ? texto : `${texto.slice(0, REGISTRO_TEXTO_MAX - 1)}…`
}

/** A linha riscada: `por` já é o nome que aparece ("Mestre", "Lia", "Mestre (em parte)"). Já desfeita: a mesma lista. */
export function marcarDesfeita(registro: readonly LinhaDoRegistro[], linhaId: string, por: string, quando: number): readonly LinhaDoRegistro[] {
  const indice = registro.findIndex((linha) => linha.id === linhaId)
  const linha = registro[indice]
  if (linha === undefined || linha.desfeita !== undefined) return registro
  const lista = [...registro]
  lista[indice] = { ...linha, desfeita: { por, quando } }
  return lista
}

/**
 * O golpe ou a reação que deu o contra-ataque foi desfeito: a linha que já
 * o gastou perde a parte "contra", e o Desfazer dela não o devolve mais (o
 * contra não expira: ficaria uma ação extra fantasma pelo resto da batalha).
 * `tokenId` `null` = todo contra do golpe. Nenhuma linha muda = a MESMA lista.
 */
export function semOContraGasto(registro: readonly LinhaDoRegistro[], golpeId: string, tokenId: string | null): readonly LinhaDoRegistro[] {
  const ehOContra = (parte: Reversao): boolean => parte.tipo === 'contra' && parte.contra.golpeId === golpeId && (tokenId === null || parte.contra.tokenId === tokenId)
  let mudou = false
  const lista = registro.map((linha) => {
    const { reversao } = linha
    if (linha.desfeita !== undefined || reversao.tipo !== 'composta' || !reversao.partes.some(ehOContra)) return linha
    mudou = true
    return { ...linha, reversao: { ...reversao, partes: reversao.partes.filter((parte) => !ehOContra(parte)) } }
  })
  return mudou ? lista : registro
}

/**
 * Tipos de habilidade F3: o Desligar logo depois do Ligar de graça (sem
 * custo, uso, recarga nem lembrete: a linha só pôs o selo `seloId`) do mesmo
 * autor tira a linha do Ligar em vez de escrever outra. Ida e volta não fica
 * no registro (como no ajuste da ficha), e o vaivém não empurra as linhas
 * velhas para fora do teto. `null` = a última linha não é esse Ligar.
 */
export function semOLigarDeGraca(registro: readonly LinhaDoRegistro[], autor: AutorDaAcao, seloId: string): readonly LinhaDoRegistro[] | null {
  const ultima = registro[registro.length - 1]
  if (ultima === undefined || ultima.desfeita !== undefined || ultima.tipo !== 'habilidade' || !mesmoAutor(ultima.autor, autor)) return null
  const { reversao } = ultima
  const parte = reversao.tipo === 'composta' && reversao.partes.length === 1 ? reversao.partes[0] : undefined
  return parte?.tipo === 'selo' && parte.seloId === seloId && parte.antes === null ? registro.slice(0, -1) : null
}

/** A ordem nos ids de `antes`; carta que não estava lá (entrou depois) vai ao fim, na ordem em que está. */
function naOrdemDe(cartas: readonly CartaDaOrdem[], antes: readonly string[]): CartaDaOrdem[] {
  const porId = new Map(cartas.map((carta) => [carta.id, carta]))
  const ordem: CartaDaOrdem[] = []
  for (const id of antes) {
    const carta = porId.get(id)
    if (carta === undefined) continue
    ordem.push(carta)
    porId.delete(id)
  }
  return [...ordem, ...cartas.filter((carta) => porId.has(carta.id))]
}

function comValor<T>(registro: Readonly<Record<string, T>>, chave: string, valor: T | null): Readonly<Record<string, T>> {
  const novo: Record<string, T> = { ...registro }
  if (valor === null) delete novo[chave]
  else novo[chave] = valor
  return novo
}

/** Os selos com o de `seloId` trocado por `selo` (no mesmo lugar); `null` tira. Ausente: o tirado volta no fim; o `editado` fica fora. */
function comSelo(selos: readonly SeloDaBatalha[], seloId: string, selo: SeloDaBatalha | null, editado: boolean): readonly SeloDaBatalha[] {
  const indice = selos.findIndex((guardado) => guardado.id === seloId)
  if (selo === null) return indice === -1 ? selos : selos.filter((guardado) => guardado.id !== seloId)
  if (indice === -1) return editado ? selos : [...selos, selo]
  const lista = [...selos]
  lista[indice] = selo
  return lista
}

/**
 * Desfaz a reação com técnica: o alvo volta a esperar reação.
 *  - Golpe ainda pendente: o alvo volta ao de antes, salvo se ele se
 *    resolveu DEPOIS por outro caminho (rolou com a técnica e escolheu a
 *    saída do dado: o dano dessa escolha mora na linha do golpe).
 *  - Golpe fora dos pendentes (a reação resolveu o último alvo): volta à
 *    lista com este alvo esperando e só os alvos que já estavam resolvidos
 *    (um alvo que esperava e se resolveu depois não volta a esperar). Se a
 *    reação só rolou o dado, o golpe não volta.
 *  - Golpe pendente SEM este alvo (outra reação desfeita antes o refez
 *    de uma foto em que este ainda esperava): o alvo volta a esperar, no
 *    lugar dele, se a ficha segue na ordem.
 *  - O contra-ataque que a reação deu ("contra") sai.
 */
function semAReacaoComTecnica(turnos: TurnosDaCena, reversao: Extract<Reversao, { tipo: 'reacaoComTecnica' }>): TurnosDaCena {
  const { golpe, tokenId, alvoAntes } = reversao
  const depois = golpe.alvos.find((alvo) => alvo.tokenId === tokenId)
  const resolveuNaReacao = depois?.danoFinal !== undefined
  const golpes = turnos.golpes ?? []
  const pendente = golpes.find((candidato) => candidato.id === golpe.id)
  let novosGolpes: readonly GolpeDaBatalha[] = golpes
  if (pendente !== undefined) {
    const agora = pendente.alvos.find((alvo) => alvo.tokenId === tokenId)
    const resolvidoDepois = !resolveuNaReacao && agora?.danoFinal !== undefined
    const lugar = (alvo: AlvoDoGolpe): number => golpe.alvos.findIndex((candidato) => candidato.tokenId === alvo.tokenId)
    const alvosDeVolta = (alvos: readonly AlvoDoGolpe[]): readonly AlvoDoGolpe[] =>
      agora === undefined ? [...alvos, alvoAntes].sort((a, b) => lugar(a) - lugar(b)) : alvos.map((alvo) => (alvo.tokenId === tokenId ? alvoAntes : alvo))
    const volta = agora === undefined ? turnos.cartas.some((carta) => carta.tokenId === tokenId) : !resolvidoDepois
    if (volta) novosGolpes = golpes.map((candidato) => (candidato.id !== golpe.id ? candidato : { ...candidato, alvos: alvosDeVolta(candidato.alvos) }))
  } else if (resolveuNaReacao) {
    const alvos = golpe.alvos.filter((alvo) => alvo.tokenId === tokenId || alvo.danoFinal !== undefined).map((alvo) => (alvo.tokenId === tokenId ? alvoAntes : alvo))
    novosGolpes = [...golpes, { ...golpe, alvos }]
  }
  const contras = turnos.contras ?? []
  const semOContra = depois?.saida === 'contra' ? contras.filter((contra) => !(contra.golpeId === golpe.id && contra.tokenId === tokenId)) : contras
  if (novosGolpes === golpes && semOContra.length === contras.length) return turnos
  return { ...turnos, golpes: novosGolpes, contras: semOContra }
}

/** O número do cartão no mapa; ausente = 0. Só as chaves do próprio objeto (o id vem da ficha). */
function numeroDe(mapa: Readonly<Record<string, number>>, chave: string): number {
  return Object.hasOwn(mapa, chave) ? (mapa[chave] ?? 0) : 0
}

/** Recargas ou usos de agora sem o que a linha somou: por delta, para não apagar o uso de outra linha; 0 ou menos sai. */
function numerosSemALinha(atual: Readonly<Record<string, number>>, antes: Readonly<Record<string, number>>, depois: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
  const volta: Record<string, number> = { ...atual }
  for (const chave of new Set([...Object.keys(antes), ...Object.keys(depois)])) {
    const somou = numeroDe(depois, chave) - numeroDe(antes, chave)
    if (somou === 0) continue
    const valor = numeroDe(volta, chave) - somou
    if (valor > 0) volta[chave] = valor
    else delete volta[chave]
  }
  return volta
}

/** O campo volta ao de antes só se a linha o mudou e ninguém mudou depois (o de agora ainda é o que ela deixou). */
function campoSemALinha<T>(atual: T, antes: T, depois: T, igual: (a: T, b: T) => boolean = Object.is): T {
  return !igual(antes, depois) && igual(atual, depois) ? antes : atual
}

function mesmasArmas(a: readonly string[] | null, b: readonly string[] | null): boolean {
  return a === b || (a !== null && b !== null && a.length === b.length && a.every((id, i) => id === b[i]))
}

/** A lista de agora sem o que a linha pôs e com o que ela tirou (o que já saiu ou já voltou fica como está). */
function listaSemALinha(atual: readonly string[], antes: readonly string[], depois: readonly string[]): readonly string[] {
  const pos = depois.filter((item) => !antes.includes(item))
  const tirou = antes.filter((item) => !depois.includes(item) && !atual.includes(item))
  if (pos.length === 0 && tirou.length === 0) return atual
  return [...atual.filter((item) => !pos.includes(item)), ...tirou]
}

function mesmoLembrete(a: LembreteDaPassiva | undefined, b: LembreteDaPassiva | undefined): boolean {
  return a === b || (a !== undefined && b !== undefined && a.tipo === b.tipo && a.chave === b.chave && a.rodada === b.rodada && a.tokenId === b.tokenId)
}

/**
 * O lembrete que o Desfazer devolve ainda vale? "A cada turno": só com a
 * passiva ligada. "Ativar": só desligada e com a chave em `lembradas` (o
 * Desfazer do dano que o pôs tira a chave: o lembrete não volta com a vida
 * acima do gatilho).
 */
function lembreteVale(lembrete: LembreteDaPassiva, lembradas: readonly string[], ligadas: ReadonlySet<string>): boolean {
  return lembrete.tipo === 'porTurno' ? ligadas.has(lembrete.cartaoId) : !ligadas.has(lembrete.cartaoId) && lembradas.includes(lembrete.chave)
}

/** Os lembretes de agora com os da linha desfeitos, passiva a passiva: o que ela pôs sai e o que ela tirou volta, se ninguém mexeu depois. */
function lembretesSemALinha(
  atual: readonly LembreteDaPassiva[],
  antes: readonly LembreteDaPassiva[],
  depois: readonly LembreteDaPassiva[],
  lembradas: readonly string[],
  ligadas: ReadonlySet<string>,
): readonly LembreteDaPassiva[] {
  const daPassiva = (lista: readonly LembreteDaPassiva[], cartaoId: string): LembreteDaPassiva | undefined => lista.find((lembrete) => lembrete.cartaoId === cartaoId)
  let volta = atual
  for (const cartaoId of new Set([...antes, ...depois].map((lembrete) => lembrete.cartaoId))) {
    const deAntes = daPassiva(antes, cartaoId)
    const deixou = daPassiva(depois, cartaoId)
    if (mesmoLembrete(deAntes, deixou) || !mesmoLembrete(daPassiva(volta, cartaoId), deixou)) continue
    const ficam = volta.filter((lembrete) => lembrete.cartaoId !== cartaoId)
    volta = deAntes !== undefined && lembreteVale(deAntes, lembradas, ligadas) ? [...ficam, deAntes] : ficam
  }
  return volta
}

/**
 * O combate de agora sem o que a linha mudou (`antes` → `depois`), e nada
 * mais: recargas e usos por delta; o resto campo a campo, só se ninguém o
 * mudou depois. O combate inteiro de antes apagaria a evolução, o lembrete ou
 * o uso de uma linha posterior, e devolveria o que outra linha já desfez.
 * Lista vazia e campo ausente saem do objeto.
 */
function combateSemALinha(atual: CombateDoPersonagem, antes: CombateDoPersonagem, depois: CombateDoPersonagem, ligadas: ReadonlySet<string>): CombateDoPersonagem {
  const { concentrouEm: _concentrou, lembradas: _lembradas, lembretes: _lembretes, evoluidas: _evoluidas, ...fixos } = atual
  const concentrouEm = campoSemALinha(atual.concentrouEm, antes.concentrouEm, depois.concentrouEm)
  const lembradas = listaSemALinha(atual.lembradas ?? [], antes.lembradas ?? [], depois.lembradas ?? [])
  const lembretes = lembretesSemALinha(atual.lembretes ?? [], antes.lembretes ?? [], depois.lembretes ?? [], lembradas, ligadas)
  const evoluidas = listaSemALinha(atual.evoluidas ?? [], antes.evoluidas ?? [], depois.evoluidas ?? [])
  return {
    ...fixos,
    recargas: numerosSemALinha(atual.recargas, antes.recargas, depois.recargas),
    usos: numerosSemALinha(atual.usos, antes.usos, depois.usos),
    overload: campoSemALinha(atual.overload, antes.overload, depois.overload),
    carga: campoSemALinha(atual.carga, antes.carga, depois.carga),
    armas: campoSemALinha(atual.armas, antes.armas, depois.armas, mesmasArmas),
    ...(concentrouEm === undefined ? {} : { concentrouEm }),
    ...(lembradas.length === 0 ? {} : { lembradas }),
    ...(lembretes.length === 0 ? {} : { lembretes }),
    ...(evoluidas.length === 0 ? {} : { evoluidas }),
  }
}

/**
 * Desfaz na ordem dos turnos o que a reversão guarda. Ficha, equipe e regras
 * não moram aqui (a store as volta por outro caminho): para elas, o MESMO
 * estado. A composta volta da última parte para a primeira.
 */
export function reverterTurnos(turnos: TurnosDaCena, reversao: Reversao): TurnosDaCena {
  switch (reversao.tipo) {
    case 'vez': {
      const { antes } = reversao
      let volta: TurnosDaCena = { ...turnos, vez: antes.vez, rodada: antes.rodada, gastos: antes.gastos }
      if (antes.extras !== undefined) volta = { ...volta, extras: antes.extras }
      if (antes.combate !== undefined) volta = { ...volta, combate: antes.combate }
      if (antes.selos !== undefined) volta = { ...volta, selos: antes.selos }
      // Em ordem crescente de lugar: cada uma volta ao índice que tinha antes de a rodada virar.
      for (const { carta, indice } of [...antes.removidas].sort((a, b) => a.indice - b.indice)) volta = inserirCarta(volta, carta, indice)
      // A vez de antes pode ter sido tirada depois: aí fica onde está.
      return volta.vez !== null && !volta.cartas.some((carta) => carta.id === volta.vez) ? { ...volta, vez: turnos.vez } : volta
    }
    case 'ordem':
      return { ...turnos, cartas: naOrdemDe(turnos.cartas, reversao.antes) }
    case 'cartaNova':
      return removerCarta(turnos, reversao.cartaId)?.turnos ?? turnos
    case 'cartaRemovida':
      return inserirCarta(turnos, reversao.carta, reversao.indice)
    case 'gasto':
      return { ...turnos, gastos: comValor(turnos.gastos, reversao.cartaId, reversao.antes) }
    case 'acoesExtras':
      return { ...turnos, extras: comValor(turnos.extras, reversao.cartaId, reversao.antes) }
    case 'combate': {
      const { personagemId } = reversao
      const volta = combateSemALinha(turnos.combate?.[personagemId] ?? combateVazio(), reversao.antes ?? combateVazio(), reversao.depois, passivasLigadas(turnos.selos, personagemId))
      return { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: volta } }
    }
    case 'carga': {
      const atual = turnos.combate?.[reversao.personagemId] ?? combateVazio()
      return { ...turnos, combate: { ...(turnos.combate ?? {}), [reversao.personagemId]: { ...atual, carga: reversao.antes } } }
    }
    case 'golpe': {
      const golpes = (turnos.golpes ?? []).filter((golpe) => golpe.id !== reversao.golpeId)
      const contras = (turnos.contras ?? []).filter((contra) => contra.golpeId !== reversao.golpeId)
      if (golpes.length === (turnos.golpes?.length ?? 0) && contras.length === (turnos.contras?.length ?? 0)) return turnos
      return { ...turnos, golpes, contras }
    }
    case 'contra': {
      const { contra } = reversao
      const contras = turnos.contras ?? []
      // Já está lá (desfeito duas vezes por caminhos diferentes): nada.
      if (contras.some((guardado) => guardado.golpeId === contra.golpeId && guardado.tokenId === contra.tokenId)) return turnos
      return { ...turnos, contras: [...contras, contra] }
    }
    case 'composta':
      return [...reversao.partes].reverse().reduce(reverterTurnos, turnos)
    case 'forma':
      return { ...turnos, formas: comValor(turnos.formas ?? {}, reversao.personagemId, reversao.antes) }
    case 'selo':
      return { ...turnos, selos: comSelo(turnos.selos ?? [], reversao.seloId, reversao.antes, reversao.editado === true) }
    case 'reacaoComTecnica':
      return semAReacaoComTecnica(turnos, reversao)
    case 'evolucao': {
      const atual = turnos.combate?.[reversao.personagemId]
      const depois = atual === undefined ? undefined : semEvoluida(atual, reversao.cartaoId)
      return atual === undefined || depois === undefined || depois === atual ? turnos : { ...turnos, combate: { ...(turnos.combate ?? {}), [reversao.personagemId]: depois } }
    }
    case 'equipe':
    case 'ficha':
    case 'regras':
      return turnos
  }
}

/**
 * Os números que mudaram de `antes` para `depois`: o atual de cada recurso,
 * o máximo BASE (gravar o máximo de uma ficha de antes não conta) e as
 * transformações ligadas ou desligadas. Na ordem recurso, máximo, cartão.
 */
export function partesDoAjuste(antes: Personagem, depois: Personagem, sistema: SistemaDeRpg | null): ParteDaFicha[] {
  const partes: ParteDaFicha[] = []
  const recursos = sistema === null ? [...new Set([...Object.keys(antes.recursos), ...Object.keys(depois.recursos)])] : sistema.recursos.map((recurso) => recurso.id)
  for (const chave of recursos) {
    const de = numeroDaFicha(antes.recursos, chave)
    const para = numeroDaFicha(depois.recursos, chave)
    if (de !== para) partes.push({ parte: 'recurso', chave, de, para })
  }
  for (const chave of recursos) {
    if (sistema !== null && !temMaximo(sistema, chave)) continue
    const de = maximoBase(antes, chave)
    const para = maximoBase(depois, chave)
    if (de !== para) partes.push({ parte: 'maximo', chave, de, para })
  }
  for (const chave of new Set([...antes.cartoesAtivos, ...depois.cartoesAtivos])) {
    const de = antes.cartoesAtivos.includes(chave) ? 1 : 0
    const para = depois.cartoesAtivos.includes(chave) ? 1 : 0
    if (de !== para) partes.push({ parte: 'cartao', chave, de, para })
  }
  return partes
}

/** "Lia: HP 450 → 380, ativou Forma Híbrida". */
export function textoDaFicha(personagem: Personagem, partes: readonly ParteDaFicha[], sistema: SistemaDeRpg | null): string {
  const rotulo = (parte: ParteDaFicha): string => (sistema === null ? parte.chave : rotuloDaParte(sistema, personagem, parte.parte, parte.chave))
  const pedacos = partes.map((parte) => {
    if (parte.parte === 'cartao') return `${parte.para === 1 ? 'ativou' : 'desativou'} ${rotulo(parte)}`
    const nome = parte.parte === 'maximo' ? `${rotulo(parte)} máx.` : rotulo(parte)
    return `${nome} ${parte.de} → ${parte.para}`
  })
  return textoDaLinha(`${personagem.nome}: ${pedacos.join(', ')}`)
}

function mesmoAutor(a: AutorDaAcao, b: AutorDaAcao): boolean {
  return a.tipo === 'mestre' ? b.tipo === 'mestre' : b.tipo === 'jogador' && a.playerId === b.playerId
}

/** Um ajuste rápido aceito, como a store o passa ao registro. */
export interface AjusteNoRegistro {
  antes: Personagem
  depois: Personagem
  autor: AutorDaAcao
  sistema: SistemaDeRpg | null
  quando: number
  rodada: number
  /** As fichas da ordem ligadas ao personagem: o recorte do jogador olha por elas. */
  tokenIds: readonly string[]
}

/**
 * O ajuste vira linha "ficha". Dentro de `JANELA_DO_REGISTRO_MS` da última
 * linha do MESMO autor e personagem (não desfeita), funde com ela — dez
 * cliques no "−" são uma linha, como o histórico da ficha; ida e volta tira a
 * linha. Nada mudou = a MESMA lista.
 */
export function registrarAjuste(registro: readonly LinhaDoRegistro[], ajuste: AjusteNoRegistro): readonly LinhaDoRegistro[] {
  const novas = partesDoAjuste(ajuste.antes, ajuste.depois, ajuste.sistema)
  if (novas.length === 0) return registro
  const personagemId = ajuste.depois.id
  let indice = -1
  for (let i = registro.length - 1; i >= 0; i -= 1) {
    const linha = registro[i]
    if (linha !== undefined && linha.reversao.tipo === 'ficha' && linha.reversao.personagemId === personagemId) {
      indice = i
      break
    }
  }
  const anterior = registro[indice]
  const passou = anterior === undefined ? Infinity : ajuste.quando - anterior.quando
  if (anterior !== undefined && anterior.reversao.tipo === 'ficha' && anterior.desfeita === undefined && mesmoAutor(anterior.autor, ajuste.autor) && passou >= 0 && passou < JANELA_DO_REGISTRO_MS) {
    const juntas = juntarPartes(anterior.reversao.partes, novas)
    const lista = [...registro]
    if (juntas.length === 0) {
      lista.splice(indice, 1)
      return lista
    }
    lista[indice] = { ...anterior, quando: ajuste.quando, texto: textoDaFicha(ajuste.depois, juntas, ajuste.sistema), reversao: { tipo: 'ficha', personagemId, partes: juntas } }
    return lista
  }
  return comLinha(registro, {
    id: novoIdDeLinha(),
    seq: proximoSeq(registro),
    quando: ajuste.quando,
    rodada: ajuste.rodada,
    autor: ajuste.autor,
    tipo: 'ficha',
    texto: textoDaFicha(ajuste.depois, novas, ajuste.sistema),
    envolve: { tokenIds: [...ajuste.tokenIds], personagemIds: [personagemId] },
    reversao: { tipo: 'ficha', personagemId, partes: novas },
  })
}

/** As partes da linha velha com as novas por cima: o `de` fica o de quando começou, o `para` é o último. Ida e volta sai. */
function juntarPartes(velhas: readonly ParteDaFicha[], novas: readonly ParteDaFicha[]): ParteDaFicha[] {
  const juntas = velhas.map((parte) => ({ ...parte }))
  for (const nova of novas) {
    const igual = juntas.find((parte) => parte.parte === nova.parte && parte.chave === nova.chave)
    if (igual === undefined) juntas.push({ ...nova })
    else igual.para = nova.para
  }
  return juntas.filter((parte) => parte.de !== parte.para)
}

/**
 * Os ajustes que desfazem as partes sobre o personagem de AGORA, da última
 * para a primeira: número = o valor de agora menos o que a linha mudou
 * (delta, para não apagar o que mudou depois); cartão = como estava.
 */
export function ajustesParaDesfazer(partes: readonly ParteDaFicha[], atual: Personagem): Ajuste[] {
  return [...partes].reverse().map((parte): Ajuste => {
    if (parte.parte === 'cartao') return { parte: 'cartao', chave: parte.chave, valor: parte.de }
    return { parte: parte.parte, chave: parte.chave, valor: valorDaParte(atual, parte.parte, parte.chave) - (parte.para - parte.de) }
  })
}

/**
 * Desfaz a linha de ficha sobre `atual`, pelas regras do ajuste (limite entre
 * 0 e o máximo) e com linha nova no histórico da ficha em nome de `quem` (o
 * histórico só cresce). `emParte` = algum número bateu no limite e não voltou
 * todo o caminho.
 */
export function desfazerFicha(
  atual: Personagem,
  sistema: SistemaDeRpg,
  partes: readonly ParteDaFicha[],
  quem: string,
  quando: number,
): { personagem: Personagem; emParte: boolean } {
  const ajustes = ajustesParaDesfazer(partes, atual)
  const personagem = aplicarAjustes(atual, sistema, ajustes, quem, quando)
  const emParte = ajustes.some((ajuste) => valorDaParte(personagem, ajuste.parte, ajuste.chave) !== ajuste.valor)
  return { personagem, emParte }
}
