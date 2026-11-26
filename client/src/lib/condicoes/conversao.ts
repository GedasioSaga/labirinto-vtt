import type { CondicaoPropria, Token } from '../../types/map'
import { condicoesPropriasOf } from '../condicoesProprias'
import type { Personagem } from '../personagem'
import { prazoDaCondicao } from '../prazoDaCondicao'
import { TOKEN_CONDITION_LABELS, tokenConditionsOf } from '../tokenConditions'
import { condicaoDoCatalogo } from './catalogo'
import { condicoesDe, porCondicao, type DuracaoDaCondicao } from './naFicha'

/**
 * CONVERSÃO DAS CONDIÇÕES DO TOKEN PARA A FICHA (PLANO §2.2, linha "Token.conditions,
 * condicoesProprias e prazosDasCondicoes em token com ficha"; etapa E4a). Pura: quem liga, junto
 * com o menu do token que passa a gravar na ficha, é a E4b; antes disso o menu de hoje ainda lê o
 * token, e mover as condições deixaria o mestre sem como tirá-las.
 *
 * Regras:
 *  - de fábrica: o id da pastilha vira o `condId`; a criada: o id dela (a marca do mestre fica);
 *  - o prazo do mesmo nome vira `turnos`; a vida por turno vira `n`. Sem vida por turno, a de regra
 *    `vida` entra com `n: 0`: a pastilha que só marcava continua sem tirar vida;
 *  - IDEMPOTENTE PELO ESTADO: o `condId` que a ficha já leva não entra de novo (a ficha vence);
 *  - vários tokens da mesma ficha de jogador com condições diferentes: une as listas e marca
 *    Confira (A11); a cópia de NPC tem um token só;
 *  - a criada que só existia dentro do token (o mestre a apagou da lista) volta para o catálogo
 *    (`criadasNovas`, quem chama grava), para a ficha poder apontar para ela;
 *  - nada se perde: o que não coube na ficha vira Confira.
 *
 * Quem chama limpa as três chaves dos tokens depois de gravar a ficha (`comCondicoes(token, {})`,
 * `lib/turnoForaDaBatalha.ts`).
 */

export interface CondicoesDosTokensNaFicha {
  personagem: Personagem
  /** Criadas que estavam só dentro de algum token: entram no catálogo do mestre. */
  criadasNovas: CondicaoPropria[]
  /** Os avisos "Confira" da conversão, em português, um por caso. */
  confira: string[]
}

/** Uma condição lida de um token: o `condId`, o nome que a pessoa lê e o prazo do mesmo nome. */
interface CondicaoDoToken {
  condId: string
  nome: string
  duracao: DuracaoDaCondicao
  porVez?: number
}

function condicoesDoToken(token: Token): CondicaoDoToken[] {
  const lidas: CondicaoDoToken[] = []
  const comPrazo = (condId: string, nome: string): CondicaoDoToken => {
    const prazo = prazoDaCondicao(token, nome)
    if (prazo === null) return { condId, nome, duracao: 'tirar' }
    return prazo.porVez === undefined ? { condId, nome, duracao: prazo.turnos } : { condId, nome, duracao: prazo.turnos, porVez: prazo.porVez }
  }
  for (const condicao of tokenConditionsOf(token)) lidas.push(comPrazo(condicao, TOKEN_CONDITION_LABELS[condicao]))
  for (const propria of condicoesPropriasOf(token)) lidas.push(comPrazo(propria.id, propria.nome))
  return lidas
}

/** O conjunto de `condId` de um token, em texto, para comparar tokens da mesma ficha. */
function chaveDoConjunto(condicoes: readonly CondicaoDoToken[]): string {
  return condicoes
    .map((condicao) => condicao.condId)
    .sort()
    .join('\n')
}

/**
 * As condições gravadas nos `tokens` ligados a `personagem`, levadas para a ficha. A MESMA ficha
 * (e listas vazias) quando nenhum token tem condição nova para ela.
 */
export function condicoesDosTokensNaFicha(personagem: Personagem, tokens: readonly Token[], criadas: readonly CondicaoPropria[], novoId?: () => string): CondicoesDosTokensNaFicha {
  const confira: string[] = []
  const criadasNovas: CondicaoPropria[] = []
  const porToken = tokens.map(condicoesDoToken).filter((lista) => lista.length > 0)
  if (porToken.length === 0) return { personagem, criadasNovas, confira }
  if (new Set(porToken.map(chaveDoConjunto)).size > 1) confira.push(`As fichas de ${personagem.nome.trim() || 'um personagem'} no mapa tinham condições diferentes: ficaram todas juntas na ficha.`)
  // As criadas de dentro dos tokens que o catálogo não tem mais voltam para ele.
  for (const token of tokens) {
    for (const propria of condicoesPropriasOf(token)) {
      if (condicaoDoCatalogo(propria.id, criadas) === null && !criadasNovas.some((nova) => nova.id === propria.id)) criadasNovas.push(propria)
    }
  }
  const catalogo = criadasNovas.length === 0 ? criadas : [...criadas, ...criadasNovas]
  let ficha = personagem
  const postas = new Set(condicoesDe(personagem).map((condicao) => condicao.condId))
  for (const condicao of porToken.flat()) {
    if (postas.has(condicao.condId)) continue
    postas.add(condicao.condId)
    const regra = condicaoDoCatalogo(condicao.condId, catalogo)?.regra
    const n = condicao.porVez ?? (regra === 'narra' ? undefined : 0)
    const pedido = n === undefined ? { condId: condicao.condId, duracao: condicao.duracao } : { condId: condicao.condId, duracao: condicao.duracao, n }
    const depois = porCondicao(ficha, pedido, catalogo, novoId)
    if (depois === ficha) confira.push(`A condição ${condicao.nome} de ${personagem.nome.trim() || 'um personagem'} não coube na ficha: confira à mão.`)
    ficha = depois
  }
  return { personagem: ficha, criadasNovas, confira }
}
