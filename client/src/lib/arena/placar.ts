import { nomeDoAutor, type LinhaDoRegistro, type ParteDaFicha, type Reversao } from '../batalha/registro'
import type { ContaDoPlacar, GolpeNoPlacar } from './tipos'

/**
 * O PLACAR DO BONECO (seção 4.3 do plano; decisão 2 do usuário): quanto cada
 * golpe tirou do boneco, o total e a média por rodada, lidos SÓ do registro
 * da batalha da arena.
 *
 * Cada linha NÃO desfeita cuja reversão (composta inclusive) mexeu na ficha
 * do boneco conta o que DESCEU do Escudo e da vida (de - para, nas partes
 * "recurso"). Uma linha = um golpe: o dano do alvo entra na linha do golpe
 * quando ele reage. O golpe no boneco que ele já resolveu sem perder nada
 * (esquivou) entra com 0; o que ainda espera a reação dele, não. Desfazer
 * tira o golpe do placar sozinho (linha desfeita não conta). As linhas que
 * saem do teto do registro (`REGISTRO_MAX`) são guardadas antes
 * (`placarCongelado` da sessão) e continuam contando.
 *
 * Média por rodada = dano por rodada: total / as rodadas que já contam — as
 * completas (as em que errou inclusive) e a atual só depois que um golpe dela
 * entrou no placar. A rodada recém-aberta, sem golpe, ainda não teve como dar
 * dano: contá-la puxaria a média para baixo a cada virada.
 *
 * Puro: sem store.
 */

/** O nome do golpe e de quem bateu, guardados quando o golpe nasceu (o efeito "golpe"). */
export interface NomeDoGolpe {
  nome: string
  atacanteTokenId: string
  /** Os tokens dos alvos (o golpe esquivado pelo boneco entra no placar com 0). */
  alvos: readonly string[]
}

export interface ContextoDoPlacar {
  bonecoPersonagemId: string
  bonecoTokenId: string
  /** O recurso de vida do sistema; `null` = não tem. */
  idDaVida: string | null
  /** O Escudo do sistema; `null` = não tem. */
  idDoEscudo: string | null
  /** golpeId → nome e atacante (o golpe resolvido some dos pendentes: o nome fica aqui). */
  golpes: ReadonlyMap<string, NomeDoGolpe>
  /** Os golpes que ainda esperam a reação do boneco: sem número ainda, fora do placar. */
  esperando: ReadonlySet<string>
  /** O nome da ficha pelo token (o atacante). */
  nomeDoToken: (tokenId: string) => string
}

/** O golpe da linha (a parte "golpe" da reversão); `null` = linha sem golpe (dano direto do mestre). */
function golpeDaReversao(reversao: Reversao): string | null {
  if (reversao.tipo === 'golpe') return reversao.golpeId
  if (reversao.tipo !== 'composta') return null
  for (const parte of reversao.partes) {
    const achado = golpeDaReversao(parte)
    if (achado !== null) return achado
  }
  return null
}

/** As partes de ficha do personagem na reversão (composta inclusive). */
function partesDoPersonagem(reversao: Reversao, personagemId: string): ParteDaFicha[] {
  if (reversao.tipo === 'ficha') return reversao.personagemId === personagemId ? [...reversao.partes] : []
  if (reversao.tipo !== 'composta') return []
  return reversao.partes.flatMap((parte) => partesDoPersonagem(parte, personagemId))
}

/** Quanto desceu do recurso nas partes (só o que desceu). */
function desceu(partes: readonly ParteDaFicha[], recursoId: string | null): number {
  if (recursoId === null) return 0
  let soma = 0
  for (const parte of partes) {
    if (parte.parte === 'recurso' && parte.chave === recursoId && parte.de > parte.para) soma += parte.de - parte.para
  }
  return soma
}

/** O golpe da linha mirou o boneco e ele já reagiu (sem dano, a linha nem traz a ficha dele). */
function resolvidoNoBoneco(golpeId: string | null, ctx: ContextoDoPlacar): boolean {
  if (golpeId === null || ctx.esperando.has(golpeId)) return false
  return ctx.golpes.get(golpeId)?.alvos.includes(ctx.bonecoTokenId) === true
}

/** O golpe no placar de uma linha, ou `null` (desfeita, sem golpe que tirou algo ou que o boneco já resolveu). */
export function golpeNoPlacar(linha: LinhaDoRegistro, ctx: ContextoDoPlacar): GolpeNoPlacar | null {
  if (linha.desfeita !== undefined) return null
  const partes = partesDoPersonagem(linha.reversao, ctx.bonecoPersonagemId)
  const escudo = desceu(partes, ctx.idDoEscudo)
  const hp = desceu(partes, ctx.idDaVida)
  const golpeId = golpeDaReversao(linha.reversao)
  if (escudo + hp <= 0 && !resolvidoNoBoneco(golpeId, ctx)) return null
  const nome = golpeId === null ? undefined : ctx.golpes.get(golpeId)
  return {
    linhaId: linha.id,
    rodada: linha.rodada,
    // Sem golpe: o dano direto do mestre ("Dar dano").
    atacante: nome === undefined ? nomeDoAutor(linha.autor) : ctx.nomeDoToken(nome.atacanteTokenId),
    golpe: nome?.nome ?? (golpeId === null ? 'Dano direto' : 'Golpe'),
    escudo,
    hp,
    total: escudo + hp,
  }
}

/** Os golpes das linhas, na ordem do registro. */
export function golpesDoRegistro(registro: readonly LinhaDoRegistro[], ctx: ContextoDoPlacar): GolpeNoPlacar[] {
  const golpes: GolpeNoPlacar[] = []
  for (const linha of registro) {
    const golpe = golpeNoPlacar(linha, ctx)
    if (golpe !== null) golpes.push(golpe)
  }
  return golpes
}

/** As rodadas que a média divide: as completas antes da `rodada` atual, mais a atual se já tem golpe no placar. */
function rodadasQueContam(golpes: readonly GolpeNoPlacar[], rodada: number): number {
  const atual = Number.isFinite(rodada) && rodada >= 1 ? Math.trunc(rodada) : 1
  return golpes.some((golpe) => golpe.rodada >= atual) ? atual : atual - 1
}

/** O placar: os congelados primeiro (mais velhos), depois os do registro; média = total / rodadas que contam (0 rodadas = média 0). */
export function placarDoBoneco(registro: readonly LinhaDoRegistro[], ctx: ContextoDoPlacar, congelado: readonly GolpeNoPlacar[], rodada: number): ContaDoPlacar {
  const golpes = [...congelado, ...golpesDoRegistro(registro, ctx)]
  const total = golpes.reduce((soma, golpe) => soma + golpe.total, 0)
  const rodadas = rodadasQueContam(golpes, rodada)
  return { golpes, total, rodadas, mediaPorRodada: rodadas === 0 ? 0 : total / rodadas }
}
