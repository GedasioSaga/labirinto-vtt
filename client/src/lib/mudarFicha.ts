import { cartoesQueLigam } from './ajusteDaFicha'
import { ativarForma, desfazerFormasNoFim } from './batalha/transformacao'
import { ativarTransformacao, desativarTransformacao } from './dbt/regras/transformacoes'
import { ehImagemDaMesa } from './midia'
import { MOTOR_DRAGON_BALL, motorDoSistema } from './motores'
import type { Personagem } from './personagem'
import type { SistemaDeRpg } from './sistemaDeRpg'
import type { Token } from '../types/map'

/**
 * MUDAR FICHA (pedido de 14/11/2026): o mestre troca a imagem do token por
 * uma das transformações da ficha de personagem ligada (botão direito, "Mudar
 * ficha ›"). A escolha grava o id do cartão em `Token.formaVisivel` e marca a
 * transformação como Ativa na ficha, sem custo, também fora da batalha; a
 * imagem base desmarca. Regras puras da FICHA; o lado do token está em
 * `lib/formaVisivel.ts` e quem grava é `stores/mudarFichaDoToken.ts`.
 *
 * Vale para os dois motores: as transformações do sistema padrão (os cartões
 * das abas que ligam, One Piece) e as do Dragon Ball Tales (`FichaDBT.transformacoes`).
 */

/** Uma transformação que o "Mudar ficha ›" oferece: só as que têm imagem. */
export interface FormaParaMudar {
  /** O id do cartão (padrão) ou da transformação (Dragon Ball Tales). */
  id: string
  nome: string
  /** Referência de mídia ou a embutida (`lib/midia.ts`). */
  imagem: string
}

const ehDragonBall = (sistema: SistemaDeRpg | null | undefined): boolean => motorDoSistema(sistema) === MOTOR_DRAGON_BALL

/** As transformações da ficha que têm imagem, na ordem da ficha. Sem sistema, ou ficha sem transformação com imagem: lista vazia. */
export function formasParaMudar(personagem: Personagem, sistema: SistemaDeRpg | null | undefined): FormaParaMudar[] {
  if (sistema === null || sistema === undefined) return []
  if (ehDragonBall(sistema)) {
    return (personagem.dbt?.transformacoes ?? []).flatMap((forma) => (ehImagemDaMesa(forma.imagem) ? [{ id: forma.id, nome: forma.nome, imagem: forma.imagem }] : []))
  }
  return cartoesQueLigam(personagem, sistema).flatMap((cartao) => (ehImagemDaMesa(cartao.imagem) ? [{ id: cartao.id, nome: cartao.nome, imagem: cartao.imagem }] : []))
}

/** A imagem que o token mostra fora da batalha: a do cartão `formaVisivel` da ficha ligada. `null` = a foto de sempre. */
export function imagemDaFormaVisivel(formaVisivel: string | undefined, personagem: Personagem | undefined, sistema: SistemaDeRpg | null | undefined): string | null {
  if (formaVisivel === undefined || personagem === undefined) return null
  return formasParaMudar(personagem, sistema).find((forma) => forma.id === formaVisivel)?.imagem ?? null
}

/** Por tokenId, a imagem da forma que o token mostra (referência de mídia ou a embutida). */
export type FormasVisiveis = ReadonlyMap<string, string>

/**
 * As imagens de forma dos tokens do mapa, pela ficha ligada a cada um.
 * `undefined` = nenhum token mostra forma (o caso de quase todo mapa: nada é
 * montado). Quem resolve para `src` (mestre) ou manda no recorte (host) é quem chama.
 */
export function formasVisiveisDoMapa(tokens: readonly Token[], personagens: readonly Personagem[], sistema: SistemaDeRpg | null | undefined): FormasVisiveis | undefined {
  let formas: Map<string, string> | undefined
  for (const token of tokens) {
    if (token.formaVisivel === undefined || token.characterId === null) continue
    const imagem = imagemDaFormaVisivel(
      token.formaVisivel,
      personagens.find((personagem) => personagem.id === token.characterId),
      sistema,
    )
    if (imagem === null) continue
    formas ??= new Map()
    formas.set(token.id, imagem)
  }
  return formas
}

/** Mesmo conteúdo (o host compara para saber se o recorte do jogador sairia igual). */
export function mesmasFormasVisiveis(a: FormasVisiveis | undefined, b: FormasVisiveis | undefined): boolean {
  if (a === b) return true
  if (a === undefined || b === undefined || a.size !== b.size) return false
  for (const [tokenId, imagem] of a) if (b.get(tokenId) !== imagem) return false
  return true
}

/**
 * A ficha com a transformação `formaId` Ativa, SEM custo (resposta do mestre:
 * "Mudar ficha" marca a transformação como Ativa, também fora da batalha).
 * `null` = voltar ao normal: toda forma ligada desliga. Nada a mudar devolve
 * o MESMO personagem.
 *
 * Sistema padrão: pelo ajuste da ficha (`ativarForma`), com o histórico em
 * nome de `quem` — a forma do mesmo Grupo sai, as outras continuam, e o atual
 * do HP/SP acompanha o máximo, como no Ativar da ficha. Dragon Ball Tales: só
 * a forma ligada (`transformacaoAtiva`); o Ki de ligar não é cobrado.
 */
export function personagemComFormaAtiva(personagem: Personagem, sistema: SistemaDeRpg, formaId: string | null, quem: string, quando: number): Personagem {
  if (ehDragonBall(sistema)) {
    const ficha = personagem.dbt
    if (ficha === undefined) return personagem
    const proxima = formaId === null ? desativarTransformacao(ficha) : ativarTransformacao(ficha, formaId)
    return proxima === ficha || proxima.transformacaoAtiva === ficha.transformacaoAtiva ? personagem : { ...personagem, dbt: proxima }
  }
  if (formaId === null) return desfazerFormasNoFim(personagem, sistema, quem, quando) ?? personagem
  return ativarForma(personagem, sistema, formaId, quem, quando)?.personagem ?? personagem
}
