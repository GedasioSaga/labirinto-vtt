import type { Token } from '../../types/map'
import { temporariosDaCena } from '../batalha/invocacao'
import type { Personagem } from '../personagem'
import { EQUIPE_DO_LADO, type LadoDaArena } from './grade'
import type { SessaoDaArena } from './tipos'

/**
 * A INVOCAÇÃO NA ARENA DE TESTES (U4 do plano de unificação do combate,
 * 10/11/2026): o que a mesa da arena (`mesaDaArena`) faz quando a batalha
 * pede para pôr ou tirar um invocado. O contrato é o da mesa de verdade
 * (`MesaDaBatalha`, como `stores/mesaDaAventura.ts` faz no mapa); a diferença
 * é só onde mora: aqui o personagem temporário é mais uma cópia em memória e o
 * token mais uma ficha do palco, do lado de quem invocou. Nada toca em ficha
 * de verdade, e tudo some com a luta.
 *
 * Puro: sem store. Devolver a MESMA sessão = nada mudou.
 */

/** O lado de quem invocou: o do token do dono (`invocadoPor`); o boneco conta como o Lado B. `null` = o dono não está no palco. */
function ladoDoDono(sessao: SessaoDaArena, invocado: Personagem | undefined): LadoDaArena | null {
  const donoId = invocado?.combate?.invocadoPor
  const tokenDoDono = donoId === undefined ? undefined : sessao.tokens.find((token) => token.characterId === donoId)
  const lado = tokenDoDono === undefined ? undefined : sessao.ladoDe[tokenDoDono.id]
  if (lado === undefined) return null
  return lado === 'boneco' ? 'b' : lado
}

/**
 * O personagem temporário e o token do invocado entram juntos (o que já existe
 * com o mesmo id fica como está; `null` = só o outro, como no Desfazer). O
 * token entra do lado do dono, com a cor dele. `null` = não deu (o dono não
 * está no palco), e nada fica.
 */
export function comInvocadoNaArena(sessao: SessaoDaArena, personagem: Personagem | null, token: Token | null): SessaoDaArena | null {
  const copias = personagem === null || sessao.copias.some((copia) => copia.id === personagem.id) ? sessao.copias : [...sessao.copias, personagem]
  if (token === null || sessao.tokens.some((candidato) => candidato.id === token.id)) return copias === sessao.copias ? sessao : { ...sessao, copias }
  const lado = ladoDoDono(sessao, token.characterId === null ? undefined : copias.find((copia) => copia.id === token.characterId))
  if (lado === null) return null
  return { ...sessao, copias, tokens: [...sessao.tokens, { ...token, color: EQUIPE_DO_LADO[lado].cor }], ladoDe: { ...sessao.ladoDe, [token.id]: lado } }
}

/** Tira o token e o personagem temporário; devolve como estavam (`null` = já não existia), para o Desfazer. */
export function semInvocadoNaArena(sessao: SessaoDaArena, personagemId: string, tokenId: string): { sessao: SessaoDaArena; personagem: Personagem | null; token: Token | null } {
  const personagem = sessao.copias.find((copia) => copia.id === personagemId) ?? null
  const token = sessao.tokens.find((candidato) => candidato.id === tokenId) ?? null
  if (personagem === null && token === null) return { sessao, personagem, token }
  const { [tokenId]: _ladoQueSai, ...ladoDe } = sessao.ladoDe
  return {
    sessao: {
      ...sessao,
      copias: personagem === null ? sessao.copias : sessao.copias.filter((copia) => copia.id !== personagemId),
      tokens: token === null ? sessao.tokens : sessao.tokens.filter((candidato) => candidato.id !== tokenId),
      ladoDe,
    },
    personagem,
    token,
  }
}

/** Fim da batalha: saem todos os temporários nascidos na cena (`temporariosDaCena`) e os tokens ligados a eles. */
export function semInvocadosDaCena(sessao: SessaoDaArena, sceneKey: string): SessaoDaArena {
  const temporarios = new Set(temporariosDaCena(sessao.copias, sceneKey).map((personagem) => personagem.id))
  if (temporarios.size === 0) return sessao
  const saem = new Set(sessao.tokens.filter((token) => token.characterId !== null && temporarios.has(token.characterId)).map((token) => token.id))
  return {
    ...sessao,
    copias: sessao.copias.filter((copia) => !temporarios.has(copia.id)),
    tokens: sessao.tokens.filter((token) => !saem.has(token.id)),
    ladoDe: Object.fromEntries(Object.entries(sessao.ladoDe).filter(([tokenId]) => !saem.has(tokenId))),
  }
}
