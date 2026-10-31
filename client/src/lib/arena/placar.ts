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
 * quando ele reage. Desfazer tira o golpe do placar sozinho (linha desfeita
 * não conta). As linhas que saem do teto do registro (`REGISTRO_MAX`) são
 * guardadas antes (`placarCongelado` da sessão) e continuam contando.
 *
 * Média por rodada = total / rodada atual (conta as rodadas em que errou).
 *
 * Puro: sem store.
 */

/** O nome do golpe e de quem bateu, guardados quando o golpe nasceu (o efeito "golpe"). */
export interface NomeDoGolpe {
  nome: string
  atacanteTokenId: string
}

export interface ContextoDoPlacar {
  bonecoPersonagemId: string
  /** O recurso de vida do sistema; `null` = não tem. */
  idDaVida: string | null
  /** O Escudo do sistema; `null` = não tem. */
  idDoEscudo: string | null
  /** golpeId → nome e atacante (o golpe resolvido some dos pendentes: o nome fica aqui). */
  golpes: ReadonlyMap<string, NomeDoGolpe>
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

/** O golpe no placar de uma linha, ou `null` (desfeita, ou não tirou nada do boneco). */
export function golpeNoPlacar(linha: LinhaDoRegistro, ctx: ContextoDoPlacar): GolpeNoPlacar | null {
  if (linha.desfeita !== undefined) return null
  const partes = partesDoPersonagem(linha.reversao, ctx.bonecoPersonagemId)
  if (partes.length === 0) return null
  const escudo = desceu(partes, ctx.idDoEscudo)
  const hp = desceu(partes, ctx.idDaVida)
  if (escudo + hp <= 0) return null
  const golpeId = golpeDaReversao(linha.reversao)
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

/** O placar: os congelados primeiro (mais velhos), depois os do registro; média = total / rodada atual. */
export function placarDoBoneco(registro: readonly LinhaDoRegistro[], ctx: ContextoDoPlacar, congelado: readonly GolpeNoPlacar[], rodada: number): ContaDoPlacar {
  const golpes = [...congelado, ...golpesDoRegistro(registro, ctx)]
  const total = golpes.reduce((soma, golpe) => soma + golpe.total, 0)
  const rodadas = Number.isFinite(rodada) && rodada >= 1 ? Math.trunc(rodada) : 1
  return { golpes, total, mediaPorRodada: total / rodadas }
}
