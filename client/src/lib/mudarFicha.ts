import { ABA_DAS_TECNICAS } from './batalha/leituraDaFicha'
import { ativarForma, desfazerFormasNoFim } from './batalha/transformacao'
import { ativarTransformacao, desativarTransformacao } from './dbt/regras/transformacoes'
import { ehImagemDaMesa } from './midia'
import { MOTOR_DRAGON_BALL, motorDoSistema } from './motores'
import type { CartaoDaFicha, Personagem } from './personagem'
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

/**
 * Os cartões de TRANSFORMAÇÃO do sistema padrão: os das abas que ligam
 * (`cartoesQueLigam`) menos a das técnicas, que o editor de sistema também
 * deixa somar atributos (a mesma regra de "aba de forma" dos requisitos,
 * `ehAbaDeForma`). Só a transformação troca a imagem do token: a técnica
 * ligada com imagem não vira a cara do boneco.
 */
function transformacoesDaFicha(personagem: Personagem, sistema: SistemaDeRpg): CartaoDaFicha[] {
  return sistema.abas.filter((aba) => aba.modificadores === true && aba.id !== ABA_DAS_TECNICAS).flatMap((aba) => personagem.abas[aba.id] ?? [])
}

/** As transformações da ficha que têm imagem, na ordem da ficha. Sem sistema, ou ficha sem transformação com imagem: lista vazia. */
export function formasParaMudar(personagem: Personagem, sistema: SistemaDeRpg | null | undefined): FormaParaMudar[] {
  if (sistema === null || sistema === undefined) return []
  if (ehDragonBall(sistema)) {
    return (personagem.dbt?.transformacoes ?? []).flatMap((forma) => (ehImagemDaMesa(forma.imagem) ? [{ id: forma.id, nome: forma.nome, imagem: forma.imagem }] : []))
  }
  return transformacoesDaFicha(personagem, sistema).flatMap((cartao) => (ehImagemDaMesa(cartao.imagem) ? [{ id: cartao.id, nome: cartao.nome, imagem: cartao.imagem }] : []))
}

/**
 * A transformação `formaId` está Ativa na ficha agora? Sistema padrão: o cartão
 * em `cartoesAtivos`; Dragon Ball Tales: a forma ligada (`transformacaoAtiva`).
 */
export function formaAtivaNaFicha(personagem: Personagem, sistema: SistemaDeRpg | null | undefined, formaId: string): boolean {
  if (ehDragonBall(sistema)) return personagem.dbt?.transformacaoAtiva === formaId
  return personagem.cartoesAtivos.includes(formaId)
}

/**
 * A forma Ativa na ficha que tem imagem: a ligada por último (o fim de
 * `cartoesAtivos`, onde o Ativar põe o cartão); no Dragon Ball Tales há uma
 * só (`transformacaoAtiva`). `null` = nenhuma forma ligada com imagem.
 */
function ultimaFormaAtiva(personagem: Personagem, sistema: SistemaDeRpg | null | undefined): FormaParaMudar | null {
  if (ehDragonBall(sistema)) {
    const ativa = personagem.dbt?.transformacaoAtiva ?? null
    return ativa === null ? null : (formasParaMudar(personagem, sistema).find((forma) => forma.id === ativa) ?? null)
  }
  // Ficha sem nada ligado (quase toda ficha) nem monta a lista de formas: isto roda a cada passo do arrasto.
  if (personagem.cartoesAtivos.length === 0) return null
  const formas = formasParaMudar(personagem, sistema)
  for (let i = personagem.cartoesAtivos.length - 1; i >= 0; i -= 1) {
    const forma = formas.find((uma) => uma.id === personagem.cartoesAtivos[i])
    if (forma !== undefined) return forma
  }
  return null
}

/**
 * A forma que o token mostra fora da batalha: a que o "Mudar ficha ›"
 * escolheu (`formaVisivel`) enquanto ela está Ativa; senão, a forma Ativa na
 * ficha. Levantamento de 25/11/2026, achado 15: a ficha é a fonte, então ligar
 * a forma pela ficha ou pelo site troca a imagem de TODO boneco dela, e não só
 * do que passou pelo "Mudar ficha ›". O menu marca esta mesma forma. Desligar
 * a forma por qualquer caminho (a ficha, o fim da batalha, a forma que acaba
 * sozinha, o jogador pelo site) volta o token à base sem mexer no token.
 * `null` = a foto de sempre.
 */
export function formaNoToken(token: Pick<Token, 'formaVisivel'>, personagem: Personagem, sistema: SistemaDeRpg | null | undefined): FormaParaMudar | null {
  const escolhida = token.formaVisivel !== undefined && formaAtivaNaFicha(personagem, sistema, token.formaVisivel) ? formasParaMudar(personagem, sistema).find((forma) => forma.id === token.formaVisivel) : undefined
  return escolhida ?? ultimaFormaAtiva(personagem, sistema)
}

/** A imagem da forma que o token mostra (`formaNoToken`); `null` = a foto de sempre. */
export function imagemDaFormaNoToken(token: Pick<Token, 'formaVisivel'>, personagem: Personagem, sistema: SistemaDeRpg | null | undefined): string | null {
  return formaNoToken(token, personagem, sistema)?.imagem ?? null
}

/**
 * A FOTO SEGUE A FICHA (levantamento de 25/11/2026, achado 13): o retrato da
 * ficha ligada no lugar da foto que o token copiou dela quando nasceu, então
 * trocar o retrato na ficha ou pelo Lobby troca o mapa e a batalha. Fica a
 * foto do token quando o mestre escolheu um ARQUIVO para ele (`image`, a
 * mesma exceção do "Ligar ficha", `tokenSemImagem`) ou quando a ficha não tem
 * retrato que a mesa mostre. Retrato embutido igual à foto do token = a mesma
 * cara: `null`, e o recorte não leva a mesma imagem duas vezes.
 */
export function retratoNoToken(token: { image?: string | null; imageData?: string | null }, personagem: Pick<Personagem, 'retrato'> | undefined): string | null {
  const retrato = personagem?.retrato ?? null
  if (!ehImagemDaMesa(retrato) || (typeof token.image === 'string' && token.image !== '')) return null
  return retrato === token.imageData ? null : retrato
}

/** Por tokenId, a imagem da forma que o token mostra (referência de mídia ou a embutida). */
export type FormasVisiveis = ReadonlyMap<string, string>

/**
 * As imagens que a ficha ligada dá a cada token do mapa, no lugar da foto
 * dele: a da forma (`imagemDaFormaNoToken`) e, sem forma, o retrato
 * (`retratoNoToken`). `undefined` = nenhum token mostra imagem da ficha (nada
 * é montado). Quem resolve para `src` (mestre) ou manda no recorte (host) é quem chama.
 */
export function formasVisiveisDoMapa(tokens: readonly Token[], personagens: readonly Personagem[], sistema: SistemaDeRpg | null | undefined): FormasVisiveis | undefined {
  let formas: Map<string, string> | undefined
  let porId: ReadonlyMap<string, Personagem> | undefined
  for (const token of tokens) {
    if (token.characterId === null) continue
    porId ??= new Map(personagens.map((personagem) => [personagem.id, personagem]))
    const personagem = porId.get(token.characterId)
    if (personagem === undefined) continue
    const imagem = imagemDaFormaNoToken(token, personagem, sistema) ?? retratoNoToken(token, personagem)
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
 * O que "Mudar ficha" lê das batalhas da mesa: quem está em cada uma, por
 * cena. One Piece: as cartas da ordem; Dragon Ball Tales: os combatentes. Só
 * a forma, para esta regra não puxar as stores da batalha.
 */
export interface BatalhasDaMesa {
  onePiece: Readonly<Record<string, { turnos: { cartas: readonly { personagemId: string | null }[] } }>>
  dragonBall: Readonly<Record<string, { combatentes: Readonly<Record<string, { personagemId: string | null }>> }>>
}

/**
 * O token está na batalha? A cena dele está numa batalha ligada (One Piece ou
 * Dragon Ball Tales), ou a ficha ligada (`personagemId`) tem carta ou
 * combatente numa batalha de outra cena. Lá, "Mudar ficha" fica apagado
 * (decisão de 14/11/2026): o "Normal" desligaria as formas pagas na batalha e
 * tiraria o HP/SP que elas deram (`desfazerFormasNoFim`); a forma se troca
 * pelo menu da batalha.
 */
export function tokenNaBatalha(sceneKey: string, personagemId: string | null, batalhas: BatalhasDaMesa): boolean {
  if (Object.hasOwn(batalhas.onePiece, sceneKey) || Object.hasOwn(batalhas.dragonBall, sceneKey)) return true
  if (personagemId === null) return false
  return (
    Object.values(batalhas.onePiece).some((cena) => cena.turnos.cartas.some((carta) => carta.personagemId === personagemId)) ||
    Object.values(batalhas.dragonBall).some((cena) => Object.values(cena.combatentes).some((combatente) => combatente.personagemId === personagemId))
  )
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
