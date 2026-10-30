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
import type { CombateDoPersonagem, ContraAtaque } from './combate'
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
  /** F2: recargas, usos, Overload, carga ou armas de um personagem. `null` = não tinha combate. */
  | { tipo: 'combate'; personagemId: string; antes: CombateDoPersonagem | null }
  /** F2: o golpe que nasceu na linha. Desfazer = tirá-lo dos pendentes (alvo que esperava não recebe mais nada) e o contra-ataque que ele deu. */
  | { tipo: 'golpe'; golpeId: string }
  /** F2 (Q6): o contra-ataque gasto na linha. Desfazer = devolvê-lo. */
  | { tipo: 'contra'; contra: ContraAtaque }
  /** F2: um golpe = a ficha de N alvos + o gasto de quem atacou, desfeitos juntos. */
  | { tipo: 'composta'; partes: readonly Reversao[] }

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
export const TIPOS_QUE_O_JOGADOR_DESFAZ: ReadonlySet<TipoDaLinha> = new Set<TipoDaLinha>(['ficha', 'acao', 'golpe', 'habilidade', 'dano', 'reacao'])

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
    case 'combate':
      return { ...turnos, combate: comValor(turnos.combate ?? {}, reversao.personagemId, reversao.antes) }
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
