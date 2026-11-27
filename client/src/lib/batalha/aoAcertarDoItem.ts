import type { CondicaoPropria } from '../../types/map'
import { condicaoDoCatalogoPeloNome } from '../condicoes/catalogo'
import { curaComAsCondicoes, porCondicao, type DuracaoDaCondicao, type PedidoDeCondicao } from '../condicoes/naFicha'
import { danoExtraDobra, pecasDoItemLidas, type PecaDoItem } from '../itens/pecasDoItem'
import type { BlocosDoItem, GatilhoDaCondicao } from '../itens/modelo'
import type { Personagem } from '../personagem'
import { fraseDoGatilho } from '../condicoes/fraseDoGatilho'
import type { Casa } from './area'

/**
 * O "AO ACERTAR" DO ITEM NA BATALHA (sistema de itens refeito, PLANO §3 E6c; decisões 10, 11 e 14):
 * as peças que o editor do item guardou (`BlocosDoItem.aoAcertar`, as mesmas das técnicas) lidas
 * como a batalha as aplica em quem a arma, o arremesso ou a bala ACERTOU:
 *  - Condição: vai para a FICHA do alvo (o jogador: a ficha; o NPC: a cópia daquele token), pela
 *    regra pura de `lib/condicoes/naFicha.ts`; na mesa sem ficha de condições (o treino do Lobby, a
 *    Arena) ou no token sem ficha, vira selo da batalha e some com ela;
 *  - Dano extra: soma no dano do golpe, menos o que repete o dano de cima (decisão 14: o editor o
 *    pinta de vermelho e aqui ele não conta);
 *  - Empurrar: o alvo anda N casas para longe de quem bateu (A5), pela casa livre e sem atravessar
 *    parede (`casasDoEmpurrao`).
 *
 * O "Testar" do editor (`testeNoBoneco`) passa pelas MESMAS funções, num boneco sem nada.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/** Uma condição que o acerto põe: o nome do catálogo, por quanto tempo e o número próprio (vida por vez ou % da cura). */
export interface CondicaoDoAcerto {
  nome: string
  duracao: DuracaoDaCondicao
  n?: number
  /** Pedido de 26/11: o "depois de X turnos" da peça (vai junto para a ficha). */
  gatilho?: GatilhoDaCondicao
}

/** O que o acerto do item faz além do dano de cima. */
export interface EfeitosAoAcertar {
  condicoes: CondicaoDoAcerto[]
  /** O Dano extra que conta (o igual ao de cima fica de fora). */
  danoExtra: number
  /** As casas do empurrão; 0 = não empurra. */
  empurrar: number
}

/** O "Ao acertar" que o golpe guarda para a store aplicar em cada alvo acertado (o dano extra já entrou no dano). */
export interface AoAcertarDoGolpe {
  condicoes: readonly CondicaoDoAcerto[]
  empurrar?: number
  /** O nome do item que pôs ("Bala de Prata"), para a condição na ficha e a linha do registro. */
  origem: string
}

/** Teto do empurrão somado (arma e bala): o mesmo do editor. */
export const EMPURRAR_MAX = 12

const NENHUM: EfeitosAoAcertar = { condicoes: [], danoExtra: 0, empurrar: 0 }

function duracaoDaPeca(peca: Extract<PecaDoItem, { tipo: 'condicao' }>): DuracaoDaCondicao {
  return peca.duracao === 'fim' ? 'fim' : peca.duracao
}

/** As peças do "Ao acertar" de um item (os blocos do Acervo de agora, ou a `regra` da vaga). Sem bloco = nada. */
export function efeitosAoAcertar(blocos: BlocosDoItem | undefined): EfeitosAoAcertar {
  if (blocos?.aoAcertar === undefined) return NENHUM
  const efeitos: EfeitosAoAcertar = { condicoes: [], danoExtra: 0, empurrar: 0 }
  for (const peca of pecasDoItemLidas(blocos.aoAcertar)) {
    if (peca.tipo === 'condicao') efeitos.condicoes.push({ nome: peca.nome, duracao: duracaoDaPeca(peca), ...(peca.n === undefined ? {} : { n: peca.n }), ...(peca.gatilho === undefined ? {} : { gatilho: peca.gatilho }) })
    else if (peca.tipo === 'dano' && !danoExtraDobra(blocos, peca)) efeitos.danoExtra += peca.valor
    else if (peca.tipo === 'empurrar') efeitos.empurrar = Math.min(EMPURRAR_MAX, efeitos.empurrar + peca.casas)
  }
  return efeitos
}

/** O item tem algum efeito no acerto? */
export function temEfeitoAoAcertar(efeitos: EfeitosAoAcertar | undefined): boolean {
  return efeitos !== undefined && (efeitos.condicoes.length > 0 || efeitos.danoExtra > 0 || efeitos.empurrar > 0)
}

/** A arma e a bala juntas: as condições das duas (a da bala por último), os danos extras somados, o maior empurrão somado. */
export function juntarEfeitos(...lista: readonly (EfeitosAoAcertar | undefined)[]): EfeitosAoAcertar {
  const juntos: EfeitosAoAcertar = { condicoes: [], danoExtra: 0, empurrar: 0 }
  for (const efeitos of lista) {
    if (efeitos === undefined) continue
    juntos.condicoes.push(...efeitos.condicoes)
    juntos.danoExtra += efeitos.danoExtra
    juntos.empurrar = Math.min(EMPURRAR_MAX, juntos.empurrar + efeitos.empurrar)
  }
  return juntos
}

/**
 * A PRÉVIA do "Ao acertar" na mira (conserto de 27/11/2026, Bala de Prata: a condição não aparecia):
 * "Ao acertar: Cura reduzida 50% por 1 turno", pelas mesmas peças que o golpe aplica. '' = nada a dizer.
 */
export function textoDoAoAcertar(efeitos: EfeitosAoAcertar | undefined): string {
  if (efeitos === undefined) return ''
  const partes = efeitos.condicoes.map((condicao) => {
    const regra = condicaoDoCatalogoPeloNome(condicao.nome, [])?.regra
    const numero = condicao.n === undefined ? '' : regra === 'cura' ? ` ${condicao.n}%` : regra === 'vida' ? ` (${condicao.n} por vez)` : ` (${condicao.n})`
    return `${condicao.nome}${numero} ${textoDaDuracao(condicao.duracao)}`
  })
  if (efeitos.danoExtra > 0) partes.push(`+${efeitos.danoExtra} de dano extra`)
  if (efeitos.empurrar > 0) partes.push(`empurra ${efeitos.empurrar} ${efeitos.empurrar === 1 ? 'casa' : 'casas'}`)
  return partes.length === 0 ? '' : `Ao acertar: ${partes.join('; ')}`
}

/** O que o golpe guarda; `null` = nada além do dano. */
export function aoAcertarDoGolpe(efeitos: EfeitosAoAcertar, origem: string): AoAcertarDoGolpe | null {
  if (efeitos.condicoes.length === 0 && efeitos.empurrar === 0) return null
  return { condicoes: efeitos.condicoes, ...(efeitos.empurrar > 0 ? { empurrar: efeitos.empurrar } : {}), origem: origem.trim() || 'o item' }
}

/** A condição do acerto como o pedido da ficha a quer (o `condId` do catálogo); `null` = nome fora do catálogo. */
export function pedidoDaCondicao(condicao: CondicaoDoAcerto, origem: string, criadas: readonly CondicaoPropria[]): PedidoDeCondicao | null {
  const doCatalogo = condicaoDoCatalogoPeloNome(condicao.nome, criadas)
  if (doCatalogo === null) return null
  return { condId: doCatalogo.id, duracao: condicao.duracao, ...(condicao.n === undefined ? {} : { n: condicao.n }), origem, ...(condicao.gatilho === undefined ? {} : { gatilho: condicao.gatilho }) }
}

/** Põe as condições do acerto na ficha, uma depois da outra (a mesma de novo renova). A MESMA ficha quando nenhuma entra. */
export function fichaComAsCondicoesDoAcerto(personagem: Personagem, aoAcertar: Pick<AoAcertarDoGolpe, 'condicoes' | 'origem'>, criadas: readonly CondicaoPropria[]): Personagem {
  return aoAcertar.condicoes.reduce((ficha, condicao) => {
    const pedido = pedidoDaCondicao(condicao, aoAcertar.origem, criadas)
    return pedido === null ? ficha : porCondicao(ficha, pedido, criadas)
  }, personagem)
}

// ─── O empurrão ─────────────────────────────────────────────────────────────

/** Para que lado o alvo vai: para longe de quem bateu, uma casa por vez (diagonal quando estão na diagonal). `null` = na mesma casa. */
export function ladoDoEmpurrao(deQuem: Casa, alvo: Casa): { col: number; row: number } | null {
  const col = Math.sign(alvo.col - deQuem.col)
  const row = Math.sign(alvo.row - deQuem.row)
  return col === 0 && row === 0 ? null : { col, row }
}

/**
 * As casas por onde o empurrão leva o alvo, da primeira à última, parando antes da casa que não dá
 * (fora do mapa, ocupada, ou atrás de parede: `passa(de, para)` falso). Lista vazia = não tinha para
 * onde ser empurrado.
 */
export function casasDoEmpurrao(deQuem: Casa, alvo: Casa, casas: number, passa: (de: Casa, para: Casa) => boolean): Casa[] {
  const lado = ladoDoEmpurrao(deQuem, alvo)
  if (lado === null) return []
  const caminho: Casa[] = []
  let atual = alvo
  for (let passo = 0; passo < Math.min(casas, EMPURRAR_MAX); passo += 1) {
    const proxima = { col: atual.col + lado.col, row: atual.row + lado.row }
    if (!passa(atual, proxima)) break
    caminho.push(proxima)
    atual = proxima
  }
  return caminho
}

// ─── O "Testar" do editor ──────────────────────────────────────────────────

/** A vida de partida do boneco e a cura de prova (uma Poção de 40): números redondos para ler o corte na hora. */
export const VIDA_DO_BONECO = 100
export const CURA_DE_PROVA = 40

/** O resultado do tiro no boneco, frase por frase. */
export interface TesteNoBoneco {
  linhas: string[]
}

function textoDaDuracao(duracao: DuracaoDaCondicao): string {
  if (duracao === 'fim') return 'até o fim da batalha'
  if (duracao === 'tirar') return 'até alguém tirar'
  return duracao === 1 ? 'por 1 turno' : `por ${duracao} turnos`
}

/**
 * O "TESTAR" do editor: o item acerta um boneco sem nada (100 de vida), pelas mesmas funções da
 * batalha: o dano de cima e o Dano extra que conta (`efeitosAoAcertar`), as condições postas na
 * ficha dele (`fichaComAsCondicoesDoAcerto`) e uma cura de prova cortada por elas
 * (`curaComAsCondicoes`). `boneco` = uma ficha nova do sistema em uso (quem chama a cria, sem
 * condição); `bala` = a munição que a arma usa no teste (os blocos dela), se houver.
 */
export function testeNoBoneco(boneco: Personagem, nome: string, blocos: BlocosDoItem, criadas: readonly CondicaoPropria[], bala?: { nome: string; blocos: BlocosDoItem }): TesteNoBoneco {
  const doItem = efeitosAoAcertar(blocos)
  const daBala = bala === undefined ? undefined : efeitosAoAcertar(bala.blocos)
  const juntos = juntarEfeitos(doItem, daBala)
  const linhas: string[] = []
  const deCima = blocos.ataque?.dano ?? blocos.golpe?.dano ?? 0
  const dano = deCima + juntos.danoExtra
  if (dano > 0) linhas.push(`Dano: ${deCima}${juntos.danoExtra > 0 ? ` + ${juntos.danoExtra} de Dano extra` : ''} = ${dano}. O boneco fica com ${Math.max(0, VIDA_DO_BONECO - dano)} de ${VIDA_DO_BONECO}.`)
  const ignorados = pecasDoItemLidas(blocos.aoAcertar).filter((peca) => danoExtraDobra(blocos, peca))
  if (ignorados.length > 0) linhas.push('O Dano extra igual ao dano de cima não conta (contaria duas vezes).')
  const origem = (bala?.nome ?? nome).trim() || 'o item'
  const ficha = fichaComAsCondicoesDoAcerto(boneco, { condicoes: juntos.condicoes, origem }, criadas)
  for (const condicao of juntos.condicoes) {
    const pedido = pedidoDaCondicao(condicao, origem, criadas)
    if (pedido === null) linhas.push(`${condicao.nome}: fora do catálogo de condições, não entra.`)
    else linhas.push(`Fica com ${condicao.nome}${condicao.n === undefined ? '' : ` (${condicao.n})`} ${textoDaDuracao(condicao.duracao)}${condicao.gatilho === undefined ? '' : `; ${fraseDoGatilho(condicao.gatilho)}`}.`)
  }
  const cura = curaComAsCondicoes(CURA_DE_PROVA, ficha, criadas)
  if (cura.corte > 0) linhas.push(`Uma cura de ${CURA_DE_PROVA} nele cura ${cura.cura} (${cura.nome ?? 'condição'} corta ${cura.corte}%).`)
  if (juntos.empurrar > 0) linhas.push(`É empurrado ${juntos.empurrar} ${juntos.empurrar === 1 ? 'casa' : 'casas'} para longe de quem acertou (sem atravessar parede).`)
  if (linhas.length === 0) linhas.push('Acertou: nada além do dano de cima (nenhum dano nem peça no "Ao acertar").')
  return { linhas }
}
