import type { Personagem } from '../personagem'

/**
 * EQUIPES (decisão 1 de docs/planos/batalha-one-piece-2026-10-30.md; Q2 e Q5
 * do plano da F1): grupos com nome e cor, gravados junto dos personagens — na
 * aventura (`Adventure.equipes`) ou na pasta (`RpgDaPasta.equipes`), quem for
 * o dono dos personagens.
 *
 * O membro é o PERSONAGEM (jogador ou NPC), não o jogador da sala: fica
 * estável entre sessões e aparelhos. Um personagem fica numa equipe só.
 *
 * Quem é aliado de quem (`aliadosDe`) decide o que o jogador vê dos colegas:
 * vida, SP, habilidades e o perfil. NPC nunca é aliado, de equipe nenhuma — o
 * mestre ajusta NPC no meio da luta e o número dele não sai.
 *
 * Puro: sem store, sem disco.
 */

export interface Equipe {
  id: string
  nome: string
  /** `#rrggbb`, minúsculo. */
  cor: string
  /** Ids de personagem (jogador ou NPC), sem repetir. */
  membros: readonly string[]
}

export const EQUIPES_MAX = 12
export const NOME_DA_EQUIPE_MAX = 40
/** Id da equipe: o do app é `equipe_<uuid>` (43); folga para o que vier editado à mão. */
export const ID_DA_EQUIPE_MAX = 80
export const NOME_DA_EQUIPE_PADRAO = 'Equipe'
/** Cor da equipe sem cor (ou com cor torta) no arquivo. */
export const COR_DA_EQUIPE_PADRAO = '#8a7f6e'

const COR_HEX = /^#[0-9a-f]{6}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function novoIdDeEquipe(): string {
  return `equipe_${crypto.randomUUID()}`
}

/** `#RRGGBB` vira minúsculo; qualquer outra coisa vira a cor padrão. */
export function corDaEquipe(value: unknown): string {
  return typeof value === 'string' && COR_HEX.test(value) ? value.toLowerCase() : COR_DA_EQUIPE_PADRAO
}

/**
 * Leitura do arquivo (aventura ou pasta), campo a campo. Ausente ou não lista
 * = `undefined` (arquivo de antes, que continua sem a chave). Equipe sem id,
 * com id repetido ou além de `EQUIPES_MAX` sai; nome vazio vira o padrão; cor
 * torta vira a padrão. Personagem que aparece em duas equipes fica na
 * primeira, e o membro que não é texto sai.
 */
export function equipesDoArquivo(value: unknown): Equipe[] | undefined {
  if (!Array.isArray(value)) return undefined
  const equipes: Equipe[] = []
  const ids = new Set<string>()
  const comEquipe = new Set<string>()
  for (const bruta of value) {
    if (equipes.length >= EQUIPES_MAX) break
    if (!isRecord(bruta)) continue
    const { id, nome, cor, membros } = bruta
    if (typeof id !== 'string' || id.length === 0 || id.length > ID_DA_EQUIPE_MAX || ids.has(id)) continue
    ids.add(id)
    const limpos: string[] = []
    for (const membro of Array.isArray(membros) ? membros : []) {
      if (typeof membro !== 'string' || membro.length === 0 || comEquipe.has(membro)) continue
      comEquipe.add(membro)
      limpos.push(membro)
    }
    const nomeLimpo = typeof nome === 'string' ? nome.trim().slice(0, NOME_DA_EQUIPE_MAX) : ''
    equipes.push({ id, nome: nomeLimpo.length > 0 ? nomeLimpo : NOME_DA_EQUIPE_PADRAO, cor: corDaEquipe(cor), membros: limpos })
  }
  return equipes
}

/** A equipe do personagem, ou `null` (sem equipe, ou nenhuma equipe cadastrada). */
export function equipeDe(personagemId: string, equipes: readonly Equipe[] | undefined): Equipe | null {
  if (equipes === undefined) return null
  return equipes.find((equipe) => equipe.membros.includes(personagemId)) ?? null
}

/**
 * Os aliados de quem tem os personagens `meusPersonagens` (ids de personagem):
 *  - nenhuma equipe cadastrada: todo personagem de tipo "jogador" é aliado (a
 *    equipe implícita: colega vê colega, como antes das equipes);
 *  - com equipes: os membros de tipo "jogador" das equipes dele. Sem equipe =
 *    sem aliados; com a equipe automática na lista, o jogador sem equipe conta
 *    como dela (`equipesNaLeitura`).
 * Nunca entra NPC, nem os próprios personagens.
 */
export function aliadosDe(meusPersonagens: ReadonlySet<string>, equipes: readonly Equipe[] | undefined, personagens: readonly Personagem[]): Set<string> {
  const jogadores = new Set(personagens.filter((personagem) => personagem.tipo === 'jogador').map((personagem) => personagem.id))
  const aliados = new Set<string>()
  if (equipes === undefined || equipes.length === 0) {
    for (const id of jogadores) if (!meusPersonagens.has(id)) aliados.add(id)
    return aliados
  }
  for (const equipe of equipesNaLeitura(equipes, personagens)) {
    if (!equipe.membros.some((id) => meusPersonagens.has(id))) continue
    for (const id of equipe.membros) if (jogadores.has(id) && !meusPersonagens.has(id)) aliados.add(id)
  }
  return aliados
}

/** O lado de todo NPC sem equipe: "contra os jogadores", o padrão. É o mesmo texto do lado por tipo (`tipo:npc`). */
const LADO_DOS_NPCS = 'tipo:npc'

/** O que `ladoNaBatalha` lê da mesa. */
export interface LadosDaBatalha {
  equipes: readonly Equipe[] | undefined
  personagens: readonly Personagem[]
  /** Os invocados em campo: a ficha temporária conta como a do dono. */
  invocados: readonly { personagemId: string; donoPersonagemId: string }[]
}

/**
 * Construtor C3 (revisão): o lado de um personagem NA LUTA, a regra única de
 * "aliado" da técnica montada. A mira do mestre marca a área "aliados" por
 * ela e o host confere o golpe por ela, para a mira não marcar quem o host
 * recusa:
 *  - o invocado conta como o dono (a ficha temporária não tem equipe);
 *  - com equipes cadastradas: a equipe dele. O JOGADOR sem equipe fica sem
 *    lado (com a equipe automática na lista, o lado dele é ela:
 *    `equipesNaLeitura`); o NPC sem equipe fica no lado padrão dos NPCs (conserto de 09/11:
 *    com o Tree na equipe dos jogadores, os Ursos sem equipe deixavam de ser
 *    aliados entre si);
 *  - sem equipes: o tipo (os jogadores de um lado, os NPCs do outro).
 * Não é `aliadosDe`, que decide o que o jogador VÊ dos colegas e nunca põe
 * NPC: na luta, o NPC tem aliados. `null` = sem lado (ninguém é aliado dele).
 */
export function ladoNaBatalha(personagemId: string | null, mesa: LadosDaBatalha): string | null {
  if (personagemId === null) return null
  const doInvocado = mesa.invocados.find((invocado) => invocado.personagemId === personagemId)
  const quemDaOLado = doInvocado === undefined ? personagemId : doInvocado.donoPersonagemId
  const tipo = mesa.personagens.find((personagem) => personagem.id === quemDaOLado)?.tipo
  if (mesa.equipes !== undefined && mesa.equipes.length > 0) {
    const equipe = equipeDe(quemDaOLado, equipesNaLeitura(mesa.equipes, mesa.personagens))
    if (equipe !== null) return equipe.id
    return tipo === 'npc' ? LADO_DOS_NPCS : null
  }
  return tipo === undefined ? null : `tipo:${tipo}`
}

/** Construtor C3 (revisão): `outro` está do lado de `deQuem` na luta (`ladoNaBatalha`). Quem não tem lado não tem aliado. */
export function mesmoLadoNaBatalha(deQuem: string | null, outro: string | null, mesa: LadosDaBatalha): boolean {
  const lado = ladoNaBatalha(deQuem, mesa)
  return lado !== null && ladoNaBatalha(outro, mesa) === lado
}

/**
 * U3 (plano de 10/11): a regra única de "quem pode ajudar quem". Os aliados de
 * `personagemId` NA LUTA, entre `candidatos` (os personagens da batalha): quem
 * está do lado dele (`ladoNaBatalha`), jogador ou NPC, o invocado pelo dono;
 * nunca ele mesmo. A regra do golpe (`ContextoDoGolpe.aliados`) lê daqui para
 * toda técnica. Antes a de texto e a à mão liam `aliadosDe` (que nunca põe
 * NPC) e só a montada lia o lado: a cura da ficha de jogador não valia no NPC
 * aliado. Quem não tem lado não tem aliado.
 */
export function aliadosNaLuta(personagemId: string | null, candidatos: Iterable<string | null>, mesa: LadosDaBatalha): Set<string> {
  const aliados = new Set<string>()
  const lado = ladoNaBatalha(personagemId, mesa)
  if (lado === null) return aliados
  for (const id of candidatos) if (id !== null && id !== personagemId && ladoNaBatalha(id, mesa) === lado) aliados.add(id)
  return aliados
}

/**
 * Conserto de 09/11/2026 (a Bolha do Tree "não curou nada"): o NPC que luta ao
 * lado dos jogadores era inimigo deles para o app, porque sem equipe todo NPC
 * fica do lado dos NPCs. O mestre escolhe o lado de cada NPC em "Quem entra" e
 * no menu da carta; por baixo é a equipe de sempre (nenhum sistema novo):
 * "do lado dos jogadores" = na equipe que tem jogador.
 */
export type LadoDoNpc = 'jogadores' | 'contra'

/** O nome e a cor da equipe criada quando o mestre põe o primeiro NPC do lado dos jogadores e nenhuma equipe tem jogador. */
export const NOME_DA_EQUIPE_DOS_JOGADORES = 'Jogadores'
export const COR_DA_EQUIPE_DOS_JOGADORES = '#3f7fbf'
/**
 * O id FIXO da equipe automática, que é a marca dela (segunda auditoria,
 * 09/11/2026, achado 2): separa a equipe que o app criou das que o mestre fez
 * em "Equipes", sem campo novo no arquivo. Só ela tem as duas regras abaixo
 * (`equipesNaLeitura`, `semEquipeAutomaticaVazia`); as do mestre seguem como eram.
 */
export const ID_DA_EQUIPE_DOS_JOGADORES = 'equipe_dos_jogadores'

export function ehEquipeAutomatica(equipe: Equipe): boolean {
  return equipe.id === ID_DA_EQUIPE_DOS_JOGADORES
}

/** A equipe automática como nasce: os jogadores de agora (os que chegarem depois entram pela leitura, `equipesNaLeitura`). */
export function equipeAutomatica(personagens: readonly Personagem[]): Equipe {
  const jogadores = personagens.filter((personagem) => personagem.tipo === 'jogador').map((personagem) => personagem.id)
  return { id: ID_DA_EQUIPE_DOS_JOGADORES, nome: NOME_DA_EQUIPE_DOS_JOGADORES, cor: COR_DA_EQUIPE_DOS_JOGADORES, membros: jogadores }
}

/**
 * A regra de LEITURA da equipe automática: todo personagem de tipo jogador sem
 * equipe conta como membro dela. A lista gravada só tem os jogadores do dia em
 * que ela nasceu; o jogador criado depois ficava sem equipe, os colegas
 * deixavam de ver a vida dele e a cura de jogador nele era recusada. Vale na
 * leitura para não depender de regravar a lista a cada ficha nova.
 * Sem equipe automática, devolve a MESMA lista (as equipes do mestre valem como antes).
 */
export function equipesNaLeitura(equipes: readonly Equipe[], personagens: readonly Personagem[]): readonly Equipe[] {
  if (!equipes.some(ehEquipeAutomatica)) return equipes
  const comEquipe = new Set(equipes.flatMap((equipe) => equipe.membros))
  const soltos = personagens.filter((personagem) => personagem.tipo === 'jogador' && !comEquipe.has(personagem.id)).map((personagem) => personagem.id)
  if (soltos.length === 0) return equipes
  return equipes.map((equipe) => (ehEquipeAutomatica(equipe) ? { ...equipe, membros: [...equipe.membros, ...soltos] } : equipe))
}

/**
 * A equipe automática some quando o último NPC sai dela: sem NPC ela só repete
 * a regra de sempre (jogador é aliado de jogador) e ficava esquecida na pasta.
 * Nada para tirar = a MESMA lista.
 */
export function semEquipeAutomaticaVazia(equipes: readonly Equipe[], personagens: readonly Personagem[]): readonly Equipe[] {
  const npcs = new Set(personagens.filter((personagem) => personagem.tipo === 'npc').map((personagem) => personagem.id))
  const ficam = equipes.filter((equipe) => !ehEquipeAutomatica(equipe) || equipe.membros.some((id) => npcs.has(id)))
  return ficam.length === equipes.length ? equipes : ficam
}

/**
 * A equipe dos jogadores: a que tem mais personagens de tipo "jogador" (empate:
 * a primeira), contando na automática os jogadores sem equipe. `null` = nenhuma
 * equipe tem jogador.
 */
export function equipeDosJogadores(equipes: readonly Equipe[] | undefined, personagens: readonly Personagem[]): Equipe | null {
  const lista = equipes ?? []
  const jogadores = new Set(personagens.filter((personagem) => personagem.tipo === 'jogador').map((personagem) => personagem.id))
  let melhor: { id: string; quantos: number } | null = null
  for (const equipe of equipesNaLeitura(lista, personagens)) {
    const quantos = equipe.membros.filter((id) => jogadores.has(id)).length
    if (quantos > 0 && (melhor === null || quantos > melhor.quantos)) melhor = { id: equipe.id, quantos }
  }
  // A equipe como está gravada (a da leitura é uma cópia com os jogadores sem equipe).
  const idDaMelhor = melhor?.id
  return lista.find((equipe) => equipe.id === idDaMelhor) ?? null
}

/** O lado do NPC para a tela: "jogadores" quando a equipe dele tem jogador (a automática é sempre a deles); senão "contra" (o padrão). */
export function ladoDoNpc(personagemId: string, equipes: readonly Equipe[] | undefined, personagens: readonly Personagem[]): LadoDoNpc {
  const equipe = equipeDe(personagemId, equipes)
  if (equipe === null) return 'contra'
  if (ehEquipeAutomatica(equipe)) return 'jogadores'
  const jogadores = new Set(personagens.filter((personagem) => personagem.tipo === 'jogador').map((personagem) => personagem.id))
  return equipe.membros.some((id) => jogadores.has(id)) ? 'jogadores' : 'contra'
}

/**
 * As equipes com o NPC do lado pedido:
 *  - "jogadores": entra na equipe dos jogadores (`equipeDosJogadores`); se
 *    nenhuma equipe tem jogador, nasce a equipe automática "Jogadores" com os
 *    personagens de tipo jogador e ele (os colegas seguem se vendo como antes);
 *  - "contra": sai da equipe que tem jogador (fica sem equipe, com os NPCs). A
 *    automática some quando o último NPC sai; a feita pelo mestre fica.
 * A MESMA lista = nada mudou. `null` = não cabe mais uma equipe (`EQUIPES_MAX`).
 */
export function equipesComOLado(equipes: readonly Equipe[] | undefined, personagens: readonly Personagem[], personagemId: string, lado: LadoDoNpc): readonly Equipe[] | null {
  const lista = equipes ?? []
  if (ladoDoNpc(personagemId, lista, personagens) === lado) return lista
  const semEle = lista.map((equipe) => (equipe.membros.includes(personagemId) ? { ...equipe, membros: equipe.membros.filter((id) => id !== personagemId) } : equipe))
  if (lado === 'contra') return semEquipeAutomaticaVazia(semEle, personagens)
  const destino = equipeDosJogadores(lista, personagens) ?? lista.find(ehEquipeAutomatica) ?? null
  if (destino !== null) return semEle.map((equipe) => (equipe.id === destino.id ? { ...equipe, membros: [...equipe.membros, personagemId] } : equipe))
  if (lista.length >= EQUIPES_MAX) return null
  const nova = equipeAutomatica(personagens)
  return [...semEle, { ...nova, membros: [...nova.membros, personagemId] }]
}
