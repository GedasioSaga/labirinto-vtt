import { maximoComposto } from '../../lib/ajusteDaFicha'
import { equipeDe, type Equipe } from '../../lib/batalha/equipes'
import { nomeDoAutor, podeDesfazer, type LinhaDoRegistro, type LinhaParaJogador } from '../../lib/batalha/registro'
import type { ModDoSelo, NaturezaDoSelo } from '../../lib/batalha/combate'
import { selosDoToken, textoDoSelo, textoDosMods } from '../../lib/batalha/selos'
import { aparenciaDaForma, nomeDaFormaLigada } from '../../lib/batalha/transformacao'
import { proximaCarta, tokensCaidos, turnoNoM, type DuracaoDaExtra, type TurnoNoM, type TurnosDaCena } from '../../lib/batalha/turnos'
import type { CartaParaJogador, EstadoParaJogador } from '../../lib/batalha/vistaDoJogador'
import { numeroDaFicha, type Personagem } from '../../lib/personagem'
import type { RecursoDoSistema, SistemaDeRpg, TomDoRecurso } from '../../lib/sistemaDeRpg'

/**
 * O QUE A FAIXA DA ORDEM MOSTRA (F1 da batalha One Piece, seção 4 do plano):
 * as cartas, a vez, a próxima, "Rodada R · Turno N/M" e o "Depois", já
 * recortados para quem olha. Puro: quem monta (App do mestre, Session do
 * jogador) lê a store ou a conexão e passa o resultado às telas de
 * `components/batalha/`, que só desenham.
 *
 * O recorte do jogador já veio do host (`vistaParaJogador`): aqui só se junta
 * o número da vida, que ele lê do personagem que já tem (o dele e o do
 * aliado). Carta "outro" nunca mostra número (decisão 1).
 */

/** Um recurso de atual e máximo na carta (HP, SP). */
export interface RecursoNaCarta {
  id: string
  rotulo: string
  tom: TomDoRecurso
  atual: number
  maximo: number
}

/** `numeros`: HP/SP com os pontos. `oculta`: "Vida oculta" (NPC ou outra equipe, para o jogador). `sem`: ficha sem personagem ou sistema sem vida. */
export type VidaNaCarta = 'numeros' | 'oculta' | 'sem'

export interface DadosDaCarta {
  /** Id da carta na ordem (a extra tem o seu). */
  id: string
  tokenId: string
  nome: string
  /** Foto pequena da ficha ou retrato do personagem; `null` = iniciais. */
  imagem: string | null
  /** Cor da equipe (`--lado`); `null` = sem equipe. */
  cor: string | null
  equipe: string | null
  vida: VidaNaCarta
  recursos: readonly RecursoNaCarta[]
  caiu: boolean
  extra: DuracaoDaExtra | null
  /** Só o mestre: o d20 do desempate. */
  d20: number | null
  /** Só o mestre: o grupo de empate do "Eu decido". */
  empate: number | null
  /** Abre o perfil; `null` = a carta não abre nada para quem olha. */
  personagemId: string | null
  /** A carta é do jogador que olha (o perfil dele é a ficha de sempre). */
  minha: boolean
  npc: boolean
  /** F2: a concentração guardada (0 a 3). Só o mestre e o dono veem. Ausente = 0. */
  carga?: number
  /** F3: o nome da forma ativada pelo menu e ainda ligada ("Punho Negro"): contorno roxo e o nome na carta. */
  forma?: string | null
  /** F3: os selos da ficha ("ATORDOADO 2"). Para todos que veem a carta (Q5). */
  selos?: readonly SeloNaCarta[]
}

/** F3: um selo como a carta o mostra. `id` só no mestre (clicar edita ou tira). */
export interface SeloNaCarta {
  id: string | null
  nome: string
  turnos: number | null
  /** "Atordoado 2"; "Cego" (até tirar). */
  texto: string
  /** Tipos de habilidade F2: a cor da pílula (buff verde, debuff roxo, passiva dourada); ausente = condição, a de sempre. */
  natureza?: Exclude<NaturezaDoSelo, 'condicao'>
  /** Tipos de habilidade F2: o que o selo soma ("FOR +20, Dano +30"); vazio = nada. */
  mods: string
}

/** Um selo como a store (mestre) ou o recorte (jogador) o guardam: só o que a pílula lê. */
interface SeloLido {
  id?: string
  nome: string
  turnos: number | null
  mods?: readonly ModDoSelo[]
  natureza?: NaturezaDoSelo
}

/** As cartas do mesmo token mostram os mesmos selos (a extra também). */
function selosNaCarta(selos: readonly SeloLido[] | undefined, sistema: SistemaDeRpg | null): SeloNaCarta[] {
  return (selos ?? []).map((selo) => {
    const naCarta: SeloNaCarta = { id: selo.id ?? null, nome: selo.nome, turnos: selo.turnos, texto: textoDoSelo(selo), mods: textoDosMods(selo.mods, sistema) }
    if (selo.natureza !== undefined && selo.natureza !== 'condicao') naCarta.natureza = selo.natureza
    return naCarta
  })
}

const NOME_DA_NATUREZA: Record<Exclude<NaturezaDoSelo, 'condicao'>, string> = { buff: 'Buff', debuff: 'Debuff', passiva: 'Passiva' }

/** "Buff · Fúria: FOR +20, 2 turnos"; "Cego: até o mestre tirar". O título da pílula e o que o leitor de tela diz. */
export function textoLongoDoSelo(selo: SeloNaCarta): string {
  // Tipos de habilidade F3: a pílula dourada sem turnos fica até o dono desligar a passiva.
  const ateTirar = selo.natureza === 'passiva' ? 'até desligar' : 'até o mestre tirar'
  const duracao = selo.turnos === null ? ateTirar : `${selo.turnos} ${selo.turnos === 1 ? 'turno' : 'turnos'}`
  const corpo = `${selo.nome}: ${selo.mods === '' ? duracao : `${selo.mods}, ${duracao}`}`
  return selo.natureza === undefined ? corpo : `${NOME_DA_NATUREZA[selo.natureza]} · ${corpo}`
}

export interface DadosDaFaixa {
  cartas: readonly DadosDaCarta[]
  vez: string | null
  proxima: string | null
  rodada: number
  turno: TurnoNoM
  minhaVez: boolean
  /** Jogador: a vez é de uma carta que ele não vê. */
  vezForaDaVista: boolean
  /** "Depois: Bruno" (mestre) ou "Você joga em 2 turnos" (jogador); `null` = nada a dizer. */
  depois: string | null
}

/** A ficha como a faixa a lê: o pedaço do `Token` que importa. */
export interface FichaNaFaixa {
  id: string
  name: string
  imageData?: string | null
  characterId?: string | null
}

/** Quantos recursos a carta mostra: HP e SP, como no protótipo. */
const RECURSOS_NA_CARTA = 2
const ORDEM_DO_TOM: Record<TomDoRecurso, number> = { vida: 0, energia: 1, neutro: 2 }
const NOME_SEM_FICHA = 'Ficha'

/** Os recursos de atual e máximo do sistema, vida primeiro, energia depois. */
function recursosQueAparecem(sistema: SistemaDeRpg | null): RecursoDoSistema[] {
  if (sistema === null) return []
  return sistema.recursos
    .filter((recurso) => recurso.atualEMaximo === true)
    .sort((a, b) => ORDEM_DO_TOM[a.tom] - ORDEM_DO_TOM[b.tom])
    .slice(0, RECURSOS_NA_CARTA)
}

/** HP/SP do personagem com o máximo efetivo (base + modificador + cartões), a mesma conta da ficha. */
export function recursosDaCarta(personagem: Personagem, sistema: SistemaDeRpg | null): RecursoNaCarta[] {
  const saida: RecursoNaCarta[] = []
  for (const recurso of recursosQueAparecem(sistema)) {
    const maximo = maximoComposto(personagem, recurso.id).total
    if (!Number.isFinite(maximo) || maximo < 1) continue
    const lido = numeroDaFicha(personagem.recursos, recurso.id)
    const atual = Math.min(maximo, Math.max(0, Number.isFinite(lido) ? lido : 0))
    saida.push({ id: recurso.id, rotulo: recurso.nome, tom: recurso.tom, atual, maximo })
  }
  return saida
}

function porId<T extends { id: string }>(lista: readonly T[]): Map<string, T> {
  const mapa = new Map<string, T>()
  for (const item of lista) if (!mapa.has(item.id)) mapa.set(item.id, item)
  return mapa
}

export interface EntradaDoMestre {
  turnos: TurnosDaCena
  /** As fichas da cena aberta. */
  fichas: readonly FichaNaFaixa[]
  personagens: readonly Personagem[]
  equipes: readonly Equipe[] | undefined
  sistema: SistemaDeRpg | null
}

/** A faixa como o MESTRE a vê: tudo, com d20, empate e os números de todos. */
export function faixaDoMestre({ turnos, fichas, personagens, equipes, sistema }: EntradaDoMestre): DadosDaFaixa {
  const fichaPorId = porId(fichas)
  const personagemPorId = porId(personagens)
  const caidos = tokensCaidos(turnos.cartas, personagens, sistema)
  const cartas = turnos.cartas.map((carta): DadosDaCarta => {
    const ficha = fichaPorId.get(carta.tokenId)
    const personagem = carta.personagemId === null ? undefined : personagemPorId.get(carta.personagemId)
    const equipe = carta.personagemId === null ? null : equipeDe(carta.personagemId, equipes)
    const recursos = personagem === undefined ? [] : recursosDaCarta(personagem, sistema)
    // F3: a forma ativada pelo menu (só enquanto o cartão segue ligado) e a imagem dela, que vence a foto.
    const forma = carta.personagemId === null ? undefined : turnos.formas?.[carta.personagemId]
    return {
      id: carta.id,
      tokenId: carta.tokenId,
      nome: ficha?.name.trim() || carta.nome?.trim() || personagem?.nome || NOME_SEM_FICHA,
      imagem: aparenciaDaForma(forma, personagem) ?? ficha?.imageData ?? personagem?.retrato ?? null,
      forma: nomeDaFormaLigada(forma, personagem),
      selos: selosNaCarta(selosDoToken(turnos.selos, carta.tokenId), sistema),
      cor: equipe?.cor ?? null,
      equipe: equipe?.nome ?? null,
      vida: recursos.length > 0 ? 'numeros' : 'sem',
      recursos,
      caiu: caidos.has(carta.tokenId),
      extra: carta.extra?.duracao ?? null,
      d20: turnos.d20[carta.id] ?? null,
      empate: turnos.empates[carta.id] ?? null,
      personagemId: personagem === undefined ? null : personagem.id,
      minha: false,
      npc: personagem?.tipo === 'npc',
      carga: carta.personagemId === null ? 0 : (turnos.combate?.[carta.personagemId]?.carga ?? 0),
    }
  })
  const proxima = proximaCarta(turnos, caidos)
  const daProxima = proxima === null || proxima.id === turnos.vez ? null : (cartas.find((carta) => carta.id === proxima.id) ?? null)
  return {
    cartas,
    vez: turnos.vez,
    proxima: daProxima?.id ?? null,
    rodada: turnos.rodada,
    turno: turnoNoM(turnos),
    minhaVez: false,
    vezForaDaVista: false,
    depois: daProxima === null ? null : `Depois: ${daProxima.nome}`,
  }
}

export interface EntradaDoJogador {
  estado: EstadoParaJogador
  /** As fichas da tela dele (só a foto pequena atravessa o recorte). */
  fichas: readonly FichaNaFaixa[]
  /** Os personagens dele e os dos aliados (`batalha.aliados`). */
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg | null
}

/** Quantos turnos faltam para a próxima carta dele que não caiu, contando só as que ele vê. */
function turnosAteAMinha(estado: EstadoParaJogador): number | null {
  const { cartas } = estado
  if (cartas.length === 0) return null
  const daVez = estado.vez === null ? -1 : cartas.findIndex((carta) => carta.id === estado.vez)
  // Vez escondida: a última carta que ele vê e que já jogou é a de número `turno.n`.
  const base = daVez >= 0 ? daVez : estado.turno.n - 1
  for (let passo = 1; passo <= cartas.length; passo += 1) {
    const carta = cartas[(((base + passo) % cartas.length) + cartas.length) % cartas.length]
    if (carta !== undefined && carta.lado === 'eu' && carta.caiu !== true) return passo
  }
  return null
}

function cartaDoJogador(carta: CartaParaJogador, ficha: FichaNaFaixa | undefined, personagem: Personagem | undefined, sistema: SistemaDeRpg | null, aparencia: string | undefined): DadosDaCarta {
  const recursos = carta.lado !== 'outro' && personagem !== undefined ? recursosDaCarta(personagem, sistema) : []
  const vida: VidaNaCarta = carta.lado === 'outro' ? 'oculta' : recursos.length > 0 ? 'numeros' : 'sem'
  return {
    id: carta.id,
    tokenId: carta.tokenId,
    nome: carta.nome.trim() || NOME_SEM_FICHA,
    // F3: a imagem da forma (o host só manda a de cartão ligado) vence a foto e o retrato.
    imagem: aparencia ?? ficha?.imageData ?? (carta.lado === 'outro' ? null : (personagem?.retrato ?? null)),
    forma: carta.forma ?? null,
    selos: selosNaCarta(carta.selos, sistema),
    cor: carta.equipe?.cor ?? null,
    equipe: carta.equipe?.nome ?? null,
    vida,
    recursos,
    caiu: carta.caiu === true,
    extra: carta.extra ?? null,
    d20: null,
    empate: null,
    personagemId: carta.lado === 'outro' ? null : (carta.personagemId ?? null),
    minha: carta.lado === 'eu',
    npc: false,
  }
}

/** A faixa como o JOGADOR a vê: o recorte do host com a vida dele e a dos aliados. */
export function faixaDoJogador({ estado, fichas, personagens, sistema }: EntradaDoJogador): DadosDaFaixa {
  const fichaPorId = porId(fichas)
  const personagemPorId = porId(personagens)
  const cartas = estado.cartas.map((carta) => {
    const dados = cartaDoJogador(
      carta,
      fichaPorId.get(carta.tokenId),
      carta.personagemId === undefined ? undefined : personagemPorId.get(carta.personagemId),
      sistema,
      estado.aparencias?.[carta.tokenId],
    )
    // F2: a carga só do que é dele (o recorte não manda a dos outros).
    const meu = carta.lado === 'eu' ? estado.meus?.find((combate) => combate.personagemId === carta.personagemId) : undefined
    return meu === undefined ? dados : { ...dados, carga: meu.carga }
  })
  let depois: string | null = null
  if (!estado.minhaVez) {
    const faltam = turnosAteAMinha(estado)
    if (faltam !== null) depois = `Você joga em ${faltam} ${faltam === 1 ? 'turno' : 'turnos'}`
    else if (cartas.some((carta) => carta.minha && carta.caiu)) depois = 'Você caiu'
  }
  return {
    cartas,
    vez: estado.vez,
    proxima: estado.proxima,
    rodada: estado.rodada,
    turno: estado.turno,
    minhaVez: estado.minhaVez,
    vezForaDaVista: estado.vezForaDaVista,
    depois,
  }
}

/** O token da carta da vez que o jogador vê (o anel no mapa dele); `null` fora de batalha, sem vez ou vez fora da vista. */
export function vezTokenIdDoJogador(estado: EstadoParaJogador | undefined): string | null {
  if (estado === undefined || estado.vez === null) return null
  return estado.cartas.find((carta) => carta.id === estado.vez)?.tokenId ?? null
}

/** Uma linha do registro como a tela mostra, igual para os dois lados. */
export interface LinhaNaTela {
  id: string
  rodada: number
  autor: string
  texto: string
  /** Quem desfez; `null` = a linha vale. */
  desfeitaPor: string | null
  podeDesfazer: boolean
}

/** O registro inteiro do mestre, a mais nova em cima. O mestre desfaz qualquer linha que ainda vale. */
export function linhasDoMestre(registro: readonly LinhaDoRegistro[]): LinhaNaTela[] {
  const saida: LinhaNaTela[] = []
  for (let i = registro.length - 1; i >= 0; i -= 1) {
    const linha = registro[i]
    if (linha === undefined) continue
    saida.push({
      id: linha.id,
      rodada: linha.rodada,
      autor: nomeDoAutor(linha.autor),
      texto: linha.texto,
      desfeitaPor: linha.desfeita?.por ?? null,
      podeDesfazer: podeDesfazer(linha, { tipo: 'mestre' }, false),
    })
  }
  return saida
}

/** O recorte do jogador (da mais velha à mais nova, como o host manda), virado: a mais nova em cima. */
export function linhasDoJogador(registro: readonly LinhaParaJogador[]): LinhaNaTela[] {
  const saida: LinhaNaTela[] = []
  for (let i = registro.length - 1; i >= 0; i -= 1) {
    const linha = registro[i]
    if (linha === undefined) continue
    saida.push({ id: linha.id, rodada: linha.rodada, autor: linha.autor, texto: linha.texto, desfeitaPor: linha.desfeita?.por ?? null, podeDesfazer: linha.podeDesfazer })
  }
  return saida
}
