/**
 * A cena da batalha One Piece e o registro: a cena nova, a linha nova com `comMudanca`, os efeitos com
 * `seq`, os nomes que vão no texto das linhas. Puro: nada aqui grava na mesa.
 */
import type { Casa } from '../../lib/batalha/blocos'
import { EFEITOS_GUARDADOS, type EfeitoDaBatalha } from '../../lib/batalha/combate'
import { invocadoDoToken } from '../../lib/batalha/invocacao'
import type { TurnosComLembretes } from '../../lib/batalha/passivas'
import type { MesaDaBatalha } from '../../lib/batalha/mesa'
import {
  comLinha,
  nomeDoAutor,
  novoIdDeLinha,
  proximoSeq,
  textoDaLinha,
  type LinhaDoRegistro,
  type Reversao,
  type TipoDaLinha,
} from '../../lib/batalha/registro'
import type { RegrasDaBatalha } from '../../lib/batalha/regrasDoCampo'
import { turnosVazios, type AutorDaAcao, type CartaDaOrdem, type GastoDaVez, type TurnosDaCena } from '../../lib/batalha/turnos'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import type { BatalhaDaCena, BatalhaState } from './tipos'

export const SEM_CAMINHOS: Readonly<Record<string, number>> = {}

export const SEM_TRILHAS: Readonly<Record<string, readonly Casa[]>> = {}

const SEM_LINHAS: readonly LinhaDoRegistro[] = []

export const CENA_NOVA: BatalhaDaCena = {
  caminhos: SEM_CAMINHOS,
  trilhas: SEM_TRILHAS,
  zerados: 0,
  rev: 0,
  turnos: turnosVazios(),
  registro: SEM_LINHAS,
  regras: null,
  turnosRev: 0,
}

export const MESTRE: AutorDaAcao = { tipo: 'mestre' }

/** A vez que ainda não gastou nada. */
export const GASTO_ZERO: GastoDaVez = { simples: 0, movimento: 0, bonus: 0, blocos: 0 }

export function semACena(cenas: Readonly<Record<string, BatalhaDaCena>>, sceneKey: string): Record<string, BatalhaDaCena> {
  const resto: Record<string, BatalhaDaCena> = {}
  for (const [chave, cena] of Object.entries(cenas)) if (chave !== sceneKey) resto[chave] = cena
  return resto
}

/** O sistema e os personagens em uso na mesa (aventura ou pasta; na arena, as cópias). */
export interface FichasDaMesa {
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg | null
}

/** O sistema e os personagens em uso na mesa, lidos agora. */
export function fichasDaMesa(mesa: MesaDaBatalha): FichasDaMesa {
  return { personagens: mesa.personagens(), sistema: mesa.sistema() }
}

/** O nome que a linha usa para a carta: o do token, o do personagem, ou "Ficha". */
export function nomeDaCarta(carta: CartaDaOrdem | null | undefined, personagens: readonly Personagem[]): string {
  if (carta === null || carta === undefined) return 'ninguém'
  if (carta.nome !== undefined && carta.nome.trim().length > 0) return carta.nome.trim()
  const personagem = carta.personagemId === null ? undefined : personagens.find((candidato) => candidato.id === carta.personagemId)
  return personagem?.nome ?? 'Ficha'
}

export interface LinhaNova {
  /** Ausente = id novo. O golpe já nasce apontando para a linha que o atualiza. */
  id?: string
  tipo: TipoDaLinha
  texto: string
  tokenIds?: readonly string[]
  personagemIds?: readonly string[]
  reversao: Reversao
  autor?: AutorDaAcao
}

/** A cena com a ordem nova e a linha no registro; `turnosRev` sobe. */
export function comMudanca(cena: BatalhaDaCena, turnos: TurnosDaCena, linha: LinhaNova | null, regras: RegrasDaBatalha | null = cena.regras): BatalhaDaCena {
  const registro =
    linha === null
      ? cena.registro
      : comLinha(cena.registro, {
          id: linha.id ?? novoIdDeLinha(),
          seq: proximoSeq(cena.registro),
          quando: Date.now(),
          rodada: turnos.rodada,
          autor: linha.autor ?? MESTRE,
          tipo: linha.tipo,
          texto: textoDaLinha(linha.texto),
          envolve: { tokenIds: linha.tokenIds ?? [], personagemIds: linha.personagemIds ?? [] },
          reversao: linha.reversao,
        })
  return { ...cena, turnos, registro, regras, turnosRev: cena.turnosRev + 1 }
}

/** Ids das cartas na ordem: a reversão de "ordem". */
export function idsDaOrdem(turnos: TurnosDaCena): string[] {
  return turnos.cartas.map((carta) => carta.id)
}

/** As cenas em batalha em que o personagem tem carta, com os tokens dele na ordem. */
export function cenasComOPersonagem(cenas: Readonly<Record<string, BatalhaDaCena>>, personagemId: string): { chave: string; cena: BatalhaDaCena; tokenIds: string[] }[] {
  const achadas: { chave: string; cena: BatalhaDaCena; tokenIds: string[] }[] = []
  for (const [chave, cena] of Object.entries(cenas)) {
    const tokenIds = [...new Set(cena.turnos.cartas.filter((carta) => carta.personagemId === personagemId).map((carta) => carta.tokenId))]
    if (tokenIds.length > 0) achadas.push({ chave, cena, tokenIds })
  }
  return achadas
}

/**
 * DANO PELA FICHA (levantamento das mecânicas duplicadas, Nº 4): o "-50" da vida no ajuste rápido do mestre,
 * com o personagem numa batalha, vai pelo "Dar dano" dela (Escudo, redução, registro com Desfazer, lembrete de
 * vida baixa, queda), na primeira cena que o aceita. `false` = fora de batalha (ou recusado): quem chama segue
 * o caminho de sempre. O jogador vem pelo host (`batalhaNoHost`, `danoPelaFicha`).
 */
export function darDanoPelaFicha(batalha: Pick<BatalhaState, 'cenas' | 'darDano'>, personagemId: string, dano: number, autor: AutorDaAcao): boolean {
  return cenasComOPersonagem(batalha.cenas, personagemId).some(({ chave, tokenIds }) => tokenIds.some((tokenId) => batalha.darDano(chave, autor, tokenId, dano)))
}

// ───────────────────────────────────────────────────────────────────────────
// F2: golpe, reação, dano — o lado que mexe na ficha e solta os efeitos
// ───────────────────────────────────────────────────────────────────────────

/** Um efeito antes de ganhar o `seq`. */
export type EfeitoNovo = EfeitoDaBatalha extends infer E ? (E extends EfeitoDaBatalha ? Omit<E, 'seq'> : never) : never

/**
 * O último `seq` de efeito da sessão. Um contador só para todas as cenas e
 * batalhas: sobe sempre, então a conexão que guardou o último `seq` tocado
 * nunca vê um número velho de novo (nem depois de a batalha acabar e outra
 * começar). Só `comEfeitos` mexe nele.
 */
let ultimoSeqDeEfeito = 0

export function comEfeitos(efeitos: readonly EfeitoDaBatalha[] | undefined, novos: readonly EfeitoNovo[]): readonly EfeitoDaBatalha[] | undefined {
  if (novos.length === 0) return efeitos
  const lista: EfeitoDaBatalha[] = [...(efeitos ?? [])]
  for (const novo of novos) {
    ultimoSeqDeEfeito += 1
    lista.push({ ...novo, seq: ultimoSeqDeEfeito })
  }
  return lista.slice(-EFEITOS_GUARDADOS)
}

/** O nome que vai no histórico da ficha quando a batalha mexe nela. */
export function quemNaFicha(autor: AutorDaAcao): string {
  return nomeDoAutor(autor)
}

/** O personagem de cada ficha na ordem (alvo possível) e de cada invocado em campo; `undefined` = fora da ordem. */
export function personagemDoTokenNa(turnos: TurnosDaCena): (tokenId: string) => string | null | undefined {
  return (tokenId) => turnos.cartas.find((carta) => carta.tokenId === tokenId)?.personagemId ?? invocadoDoToken(turnos, tokenId)?.personagemId
}

/** O nome da ficha para o texto, pela carta dela na ordem (o invocado, pelo nome dele). */
export function nomeDoTokenNa(turnos: TurnosDaCena, personagens: readonly Personagem[]): (tokenId: string) => string {
  return (tokenId) => {
    const carta = turnos.cartas.find((candidata) => candidata.tokenId === tokenId)
    return carta === undefined ? (invocadoDoToken(turnos, tokenId)?.nome ?? nomeDaCarta(carta, personagens)) : nomeDaCarta(carta, personagens)
  }
}

/** Invocação: o texto da carta do bando ("Bando de Ryoko"), pelo nome do dono na ordem. */
export function nomeDoBandoNa(turnos: TurnosDaCena, personagens: readonly Personagem[]): (donoTokenId: string) => string {
  const nomeDoToken = nomeDoTokenNa(turnos, personagens)
  return (donoTokenId) => `Bando de ${nomeDoToken(donoTokenId)}`
}

/** A linha do registro com outro texto e mais partes na reversão (o golpe que se resolve alvo a alvo). */
export function linhaAtualizada(registro: readonly LinhaDoRegistro[], linhaId: string, texto: string, maisPartes: readonly Reversao[]): readonly LinhaDoRegistro[] {
  const indice = registro.findIndex((linha) => linha.id === linhaId)
  const linha = registro[indice]
  if (linha === undefined) return registro
  const reversao: Reversao = maisPartes.length === 0 ? linha.reversao : { tipo: 'composta', partes: [...(linha.reversao.tipo === 'composta' ? linha.reversao.partes : [linha.reversao]), ...maisPartes] }
  const lista = [...registro]
  lista[indice] = { ...linha, texto: textoDaLinha(texto), reversao }
  return lista
}

/**
 * Tipos de habilidade F3: as partes "combate" dos lembretes que um gancho
 * pôs (Iniciar, virada da rodada, dano), para o Desfazer da linha tirar SÓ
 * eles e a chave deles em `lembradas`.
 */
export function partesDosLembretes(feito: TurnosComLembretes): Reversao[] {
  return feito.mudaram.flatMap(({ personagemId, antes }): Reversao[] => {
    const depois = feito.turnos.combate?.[personagemId]
    return depois === undefined ? [] : [{ tipo: 'combate', personagemId, antes, depois }]
  })
}
