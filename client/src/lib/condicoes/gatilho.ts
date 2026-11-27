import type { CondicaoPropria } from '../../types/map'
import type { CondicaoNaFicha, GatilhoDaCondicao, PecaDoGatilho } from '../itens/modelo'
import type { Personagem } from '../personagem'
import { condicaoDoCatalogo, condicaoDoCatalogoPeloNome } from './catalogo'
import { fraseDaPecaDoGatilho } from './fraseDoGatilho'
import { comCondicoesNaFicha, condicoesDe, contarFimDaVez, curaComAsCondicoes, porCondicao, tirarCondicao, type CondicoesQueAcabaram } from './naFicha'

export { fraseDaPecaDoGatilho, fraseDoGatilho } from './fraseDoGatilho'

/**
 * O GATILHO DA CONDIÇÃO (pedido do dono, 26/11: "poder botar em condições algo assim: após X turnos,
 * dá esse efeito ou condição"). Uma condição pode levar "depois de X turnos → peças": as mesmas peças
 * do "Ao acertar" do item (dano, cura, outra condição com duração, tirar condição), sem regra nova.
 *
 *  - O gatilho mora na condição CRIADA do catálogo (`CondicaoPropria.gatilho`) ou na PEÇA que a pôs
 *    (`CondicaoNaFicha.gatilho`, que vence: o Envenenado de fábrica ganha gatilho pela bala que o põe).
 *  - A CONTA é a do prazo: um turno por FIM DA VEZ de quem está com ela (na batalha, a vez dele; fora,
 *    o "Passar turno"). Ao chegar a X, dispara.
 *  - "Uma vez": dispara e, se continua, não dispara de novo. "A cada X": a conta volta a 0.
 *  - "Some": a condição sai ao disparar; "continua": fica (com o prazo dela, se tiver).
 *  - As peças caem em quem está com ela, DEPOIS do desconto do prazo: o "Atordoado por 1 turno" que o
 *    gatilho põe vale a próxima vez inteira (não é descontado na mesma hora).
 *
 * Puro: devolve a ficha nova e o dano e a cura para quem chama aplicar na vida (a mesa pela ficha, com
 * Desfazer; fora da batalha, a perda do turno).
 */

/** Um disparo: a condição que disparou, as peças e se ela saiu. */
export interface DisparoDoGatilho {
  condicaoId: string
  nome: string
  pecas: readonly PecaDoGatilho[]
  saiu: boolean
}

/** O fim da vez com os gatilhos: o de sempre (`contarFimDaVez`) mais o que disparou e a vida que mexe. */
export interface FimDaVezComGatilhos extends CondicoesQueAcabaram {
  disparos: DisparoDoGatilho[]
  /** Vida que as peças de dano tiram, somada (direto, como a condição de regra `vida`). */
  dano: number
  /** Vida que as peças de cura dão, já cortada pelas condições de regra `cura` da ficha. */
  cura: number
}

/** O gatilho que vale para a condição posta: o da peça que a pôs, ou o da criada do catálogo. `null` = nenhum. */
export function gatilhoDe(condicao: CondicaoNaFicha, criadas: readonly CondicaoPropria[]): GatilhoDaCondicao | null {
  return condicao.gatilho ?? condicaoDoCatalogo(condicao.condId, criadas)?.gatilho ?? null
}

/** A ficha tem alguma condição com gatilho que ainda conta? (o "Passar turno" fora da batalha a inclui). */
export function temGatilhoQueConta(personagem: Pick<Personagem, 'condicoes'>, criadas: readonly CondicaoPropria[]): boolean {
  return condicoesDe(personagem).some((condicao) => condicao.gatilhoFeito !== true && gatilhoDe(condicao, criadas) !== null)
}

/** O que guarda a conta do gatilho: a condição da ficha e o selo da batalha (`SeloDaBatalha.gatilhoConta`). */
export interface ContaDoGatilho {
  gatilhoConta?: number
  gatilhoFeito?: true
}

/**
 * Um turno a mais na conta do gatilho, a MESMA conta para a condição da ficha e para o selo da batalha
 * (rework das condições, E5). `item: null` = ele sai (disparou e some); "uma vez" que continua fica com
 * `gatilhoFeito`; "a cada X" volta a conta a 0.
 */
export function contarUmTurnoDoGatilho<T extends ContaDoGatilho>(item: T, gatilho: Pick<GatilhoDaCondicao, 'turnos' | 'vezes' | 'aoDisparar'>): { item: T | null; dispara: boolean } {
  const conta = (item.gatilhoConta ?? 0) + 1
  if (conta < gatilho.turnos) return { item: { ...item, gatilhoConta: conta }, dispara: false }
  if (gatilho.aoDisparar === 'some') return { item: null, dispara: true }
  // Sem a conta (a chave é opcional em T: sem ela ainda é um T).
  const zerado: T = { ...item }
  delete zerado.gatilhoConta
  return { item: gatilho.vezes === 'cada' ? zerado : { ...zerado, gatilhoFeito: true }, dispara: true }
}

/** Um turno a mais na conta do gatilho. `condicao: null` = ela sai (disparou e some). */
function contarUmTurno(condicao: CondicaoNaFicha, gatilho: GatilhoDaCondicao): { condicao: CondicaoNaFicha | null; dispara: boolean } {
  const contado = contarUmTurnoDoGatilho(condicao, gatilho)
  return { condicao: contado.item, dispara: contado.dispara }
}

/** Tira pelo nome do catálogo; "as condições ruins" (`null`) tira todas menos a que disparou. */
function fichaSemAsTiradas(ficha: Personagem, nome: string | null, quemDisparou: string, criadas: readonly CondicaoPropria[]): Personagem {
  if (nome === null) {
    const ficam = condicoesDe(ficha).filter((condicao) => condicao.id === quemDisparou)
    return ficam.length === condicoesDe(ficha).length ? ficha : comCondicoesNaFicha(ficha, ficam)
  }
  const doCatalogo = condicaoDoCatalogoPeloNome(nome, criadas)
  return doCatalogo === null ? ficha : tirarCondicao(ficha, doCatalogo.id)
}

/**
 * FIM DA VEZ de quem tem a ficha, com os gatilhos: cada condição com gatilho conta 1 turno e, ao chegar
 * a X, dispara; depois o desconto do prazo de sempre (`contarFimDaVez`); por último as peças dos
 * disparos, na ordem da ficha. Nada a contar = a MESMA ficha.
 */
export function fimDaVezComGatilhos(personagem: Personagem, criadas: readonly CondicaoPropria[]): FimDaVezComGatilhos {
  const atuais = condicoesDe(personagem)
  const disparos: DisparoDoGatilho[] = []
  const ficam: CondicaoNaFicha[] = []
  let contou = false
  for (const condicao of atuais) {
    const gatilho = condicao.gatilhoFeito === true ? null : gatilhoDe(condicao, criadas)
    if (gatilho === null) {
      ficam.push(condicao)
      continue
    }
    contou = true
    const contado = contarUmTurno(condicao, gatilho)
    if (contado.dispara) disparos.push({ condicaoId: condicao.id, nome: condicaoDoCatalogo(condicao.condId, criadas)?.nome ?? 'Condição', pecas: gatilho.pecas, saiu: contado.condicao === null })
    if (contado.condicao !== null) ficam.push(contado.condicao)
  }
  const fim = contarFimDaVez(contou ? comCondicoesNaFicha(personagem, ficam) : personagem)
  let ficha = fim.personagem
  let dano = 0
  let curaPedida = 0
  for (const disparo of disparos) {
    for (const peca of disparo.pecas) {
      if (peca.tipo === 'dano') dano += peca.valor
      else if (peca.tipo === 'curar') curaPedida += peca.fixo
      else if (peca.tipo === 'tirar') ficha = fichaSemAsTiradas(ficha, peca.nome, disparo.condicaoId, criadas)
      else {
        const doCatalogo = condicaoDoCatalogoPeloNome(peca.nome, criadas)
        if (doCatalogo !== null) ficha = porCondicao(ficha, { condId: doCatalogo.id, duracao: peca.duracao, ...(peca.n === undefined ? {} : { n: peca.n }), origem: disparo.nome }, criadas)
      }
    }
  }
  const cura = curaPedida === 0 ? 0 : curaComAsCondicoes(curaPedida, ficha, criadas).cura
  return { personagem: ficha, acabaram: fim.acabaram, disparos, dano, cura }
}

// ─── A linha do registro ─────────────────────────────────────────────────────

/** A linha do registro de um disparo: "Envenenado de Hector disparou: Atordoado por 1 turno; Envenenado saiu". */
export function textoDoDisparo(disparo: DisparoDoGatilho, deQuem: string): string {
  return `${disparo.nome} de ${deQuem} disparou: ${disparo.pecas.map(fraseDaPecaDoGatilho).join(', ')}${disparo.saiu ? `; ${disparo.nome} saiu` : ''}`
}
