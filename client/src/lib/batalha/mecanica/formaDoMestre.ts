import { normalizar } from '../formula'
import { CAMPO_DO_EFEITO } from '../leituraDaFicha'
import { ativarForma, type FormaNoMenu } from '../transformacao'
import { temMaximo } from '../../ajusteDaFicha'
import { novoCartao, type CartaoDaFicha, type Modificador, type Personagem } from '../../personagem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import { DANO_MAX, MODS_DA_DECISAO_MAX, NOME_DA_HABILIDADE_MAX, TEXTO_DA_HABILIDADE_MAX, type DecisaoDaForma, type FormaPendente, type NumeroDaForma } from '../combate'
import type { LinhaDoRegistro, Reversao } from '../registro'
import type { AlvoDeMod } from '../selos'
import type { TurnosDaCena } from '../turnos'

/**
 * A TELA DO MESTRE AO TRANSFORMAR (construtor de mecânicas, fatia C6; decisão
 * 4 do mestre em docs/planos/construtor-de-mecanicas-2026-11-08.md). O Sulong
 * da May e da Aira (respostas-do-grilling.md): "quando ela se transformar vai
 * abrir uma tela para mim pergunta quais modificadores vão somar e se ela vai
 * ganhar alguma habilidade".
 *
 * A peça mora no `mecanica` do cartão da FORMA (o mesmo campo opaco que viaja
 * pela LAN e pela nuvem, só o mestre grava): `{ versao: 1, numeros: 'mestre' }`.
 * Com ela, Ativar não liga a forma: nasce uma pendência e o mestre escolhe os
 * números. A decisão vira os `modificadores` do próprio cartão (e a habilidade,
 * um subcartão dele): assim tudo o que já lê a forma (ficha, prévia, máximos,
 * fórmulas, a ordem pela Agilidade) segue igual, e desligar a forma tira tudo.
 * O cartão guarda a última decisão; a tela a sugere da próxima vez.
 *
 * A habilidade vale só naquela transformação ("se ela vai ganhar alguma
 * habilidade", a cada vez): a peça guarda o id do subcartão que a decisão
 * criou (`habilidade`), e a decisão seguinte o tira (ou o reescreve, com o
 * mesmo nome). As habilidades que o cartão já tinha ficam.
 *
 * Forma sem a peça, ou com peça de outro formato: liga como sempre.
 *
 * Puro: sem store, sem rede.
 */

/** A peça como o cartão a guarda (sem a habilidade da última decisão). */
export const PECA_DO_MESTRE_NA_FORMA = { versao: 1, numeros: 'mestre' } as const

/** A forma tem a peça "o mestre decide os números"? Só o formato exato vale (o resto liga como sempre): a versão, os números e, se houver, o id da habilidade da última decisão. */
export function formaDecididaPeloMestre(cartao: Pick<CartaoDaFicha, 'mecanica'>): boolean {
  const peca = cartao.mecanica
  if (peca === undefined) return false
  if (peca.versao !== PECA_DO_MESTRE_NA_FORMA.versao || peca.numeros !== PECA_DO_MESTRE_NA_FORMA.numeros) return false
  return Object.keys(peca).every((chave) => chave === 'versao' || chave === 'numeros' || (chave === 'habilidade' && typeof peca.habilidade === 'string'))
}

/** O subcartão que a última decisão do mestre deu à forma; `null` = não deu, ou ele já saiu da ficha. */
export function habilidadeDaUltimaDecisao(cartao: Pick<CartaoDaFicha, 'mecanica' | 'subcartoes'>): CartaoDaFicha | null {
  if (!formaDecididaPeloMestre(cartao)) return null
  const id = cartao.mecanica?.habilidade
  return typeof id === 'string' ? (cartao.subcartoes.find((subcartao) => subcartao.id === id) ?? null) : null
}

/** O nome e o texto da habilidade da última decisão, para a tela oferecer de novo (desmarcada). */
export function textoDaHabilidade(subcartao: CartaoDaFicha): { nome: string; texto: string } {
  return { nome: subcartao.nome, texto: subcartao.campos[CAMPO_DO_EFEITO] ?? '' }
}

/** O que a tela pode somar: os atributos do sistema e o máximo dos recursos de atual e máximo (o "HP +300" da forma). */
export function alvosDaDecisao(sistema: SistemaDeRpg | null): AlvoDeMod[] {
  if (sistema === null) return []
  const atributos = sistema.atributos.map((atributo): AlvoDeMod => ({ id: atributo.id, rotulo: atributo.nome, curto: atributo.abreviacao || atributo.nome }))
  const recursos = sistema.recursos.filter((recurso) => temMaximo(sistema, recurso.id)).map((recurso): AlvoDeMod => ({ id: recurso.id, rotulo: `${recurso.nome} máximo`, curto: `${recurso.nome} máx` }))
  return [...atributos, ...recursos]
}

/**
 * A decisão que o host aceita, ou o porquê de recusar. Os modificadores: alvo
 * de `alvosDaDecisao`, inteiro e não 0 até ±`DANO_MAX`, sem repetir, até
 * `MODS_DA_DECISAO_MAX`. A habilidade: nome de 1 a `NOME_DA_HABILIDADE_MAX` e
 * texto até `TEXTO_DA_HABILIDADE_MAX` (aparados).
 */
export function decisaoValida(decisao: DecisaoDaForma, sistema: SistemaDeRpg): { decisao: DecisaoDaForma } | { motivo: string } {
  const alvos = new Set(alvosDaDecisao(sistema).map((alvo) => alvo.id))
  if (decisao.mods.length > MODS_DA_DECISAO_MAX) return { motivo: `No máximo ${MODS_DA_DECISAO_MAX} modificadores` }
  const mods: Modificador[] = []
  for (const mod of decisao.mods) {
    if (!alvos.has(mod.atributo)) return { motivo: 'Modificador fora do sistema' }
    if (!Number.isInteger(mod.delta) || mod.delta === 0 || Math.abs(mod.delta) > DANO_MAX) return { motivo: 'Modificador com número torto' }
    if (mods.some((outro) => outro.atributo === mod.atributo)) return { motivo: 'O mesmo atributo em dois modificadores' }
    mods.push({ atributo: mod.atributo, delta: mod.delta })
  }
  if (decisao.habilidade === null) return { decisao: { mods, habilidade: null } }
  const nome = decisao.habilidade.nome.replace(/[\r\n]/g, ' ').trim()
  const texto = decisao.habilidade.texto.trim()
  if (nome.length === 0 || nome.length > NOME_DA_HABILIDADE_MAX) return { motivo: `O nome da habilidade vai de 1 a ${NOME_DA_HABILIDADE_MAX} letras` }
  if (texto.length > TEXTO_DA_HABILIDADE_MAX) return { motivo: `O que a habilidade faz cabe em ${TEXTO_DA_HABILIDADE_MAX} letras` }
  return { decisao: { mods, habilidade: { nome, texto } } }
}

const mesmoNome = (a: string, b: string): boolean => normalizar(a).trim() === normalizar(b).trim()

/**
 * O cartão da forma com a decisão: os modificadores TROCAM pelos do mestre, e
 * a habilidade entra como subcartão à mão (o número dela é digitado na
 * batalha). A habilidade da decisão anterior sai; com o mesmo nome, o
 * subcartão dela é reescrito (o mesmo id). Habilidade com o nome de um
 * subcartão que o cartão já tinha atualiza o texto dele em vez de repetir (e
 * ele segue sendo do cartão). A peça passa a guardar o id da habilidade nova.
 */
export function cartaoComADecisao(cartao: CartaoDaFicha, decisao: DecisaoDaForma): CartaoDaFicha {
  const anterior = habilidadeDaUltimaDecisao(cartao)
  const habilidade = decisao.habilidade
  let subcartoes = anterior === null ? cartao.subcartoes : cartao.subcartoes.filter((subcartao) => subcartao.id !== anterior.id)
  let marcada: string | null = null
  if (habilidade !== null) {
    const doCartao = subcartoes.find((subcartao) => mesmoNome(subcartao.nome, habilidade.nome))
    if (doCartao !== undefined) {
      const atualizado: CartaoDaFicha = { ...doCartao, campos: { ...doCartao.campos, [CAMPO_DO_EFEITO]: habilidade.texto } }
      subcartoes = subcartoes.map((subcartao) => (subcartao.id === doCartao.id ? atualizado : subcartao))
    } else if (anterior !== null && mesmoNome(anterior.nome, habilidade.nome)) {
      const reescrita: CartaoDaFicha = { ...anterior, nome: habilidade.nome, campos: { ...anterior.campos, [CAMPO_DO_EFEITO]: habilidade.texto } }
      subcartoes = cartao.subcartoes.map((subcartao) => (subcartao.id === anterior.id ? reescrita : subcartao))
      marcada = anterior.id
    } else {
      const nova: CartaoDaFicha = { ...novoCartao(habilidade.nome), campos: { [CAMPO_DO_EFEITO]: habilidade.texto }, aMao: true }
      subcartoes = [...subcartoes, nova]
      marcada = nova.id
    }
  }
  const comDecisao: CartaoDaFicha = { ...cartao, modificadores: decisao.mods.map((mod) => ({ ...mod })), subcartoes }
  // Sem a peça (o mestre a tirou enquanto a forma esperava): a habilidade entra, mas não há onde marcar.
  if (!formaDecididaPeloMestre(cartao)) return comDecisao
  return { ...comDecisao, mecanica: marcada === null ? { ...PECA_DO_MESTRE_NA_FORMA } : { ...PECA_DO_MESTRE_NA_FORMA, habilidade: marcada } }
}

/** O que a decisão deixou no cartão (o Desfazer confere antes de voltar o cartão): os modificadores e o id da habilidade marcada na peça. */
export interface EscritoPelaDecisao {
  mods: readonly Modificador[]
  habilidade: string | null
}

export function escritoNoCartao(cartao: Pick<CartaoDaFicha, 'modificadores' | 'mecanica'>): EscritoPelaDecisao {
  const habilidade = cartao.mecanica?.habilidade
  return { mods: cartao.modificadores.map((mod) => ({ atributo: mod.atributo, delta: mod.delta })), habilidade: typeof habilidade === 'string' ? habilidade : null }
}

/** O cartão ainda tem o que a decisão escreveu? Outra decisão por cima (outros números ou outra habilidade) = não. */
export function cartaoAindaComADecisao(cartao: Pick<CartaoDaFicha, 'modificadores' | 'mecanica'>, escrito: EscritoPelaDecisao): boolean {
  const agora = escritoNoCartao(cartao)
  return (
    agora.habilidade === escrito.habilidade &&
    agora.mods.length === escrito.mods.length &&
    agora.mods.every((mod, indice) => mod.atributo === escrito.mods[indice]?.atributo && mod.delta === escrito.mods[indice]?.delta)
  )
}

/** O personagem com o cartão (de mesmo id, em qualquer aba) trocado. Sem o cartão = o mesmo personagem. */
export function comCartaoTrocado(personagem: Personagem, cartao: CartaoDaFicha): Personagem {
  let achou = false
  const abas: Record<string, CartaoDaFicha[]> = {}
  for (const [aba, cartoes] of Object.entries(personagem.abas)) {
    abas[aba] = cartoes.map((candidato) => {
      if (candidato.id !== cartao.id) return candidato
      achou = true
      return cartao
    })
  }
  return achou ? { ...personagem, abas } : personagem
}

/** O cartão de forma pelo id, em qualquer aba (o de cima, não subcartão); `null` = não há. */
export function cartaoPorId(personagem: Personagem, cartaoId: string): CartaoDaFicha | null {
  for (const cartoes of Object.values(personagem.abas)) {
    const achado = cartoes.find((cartao) => cartao.id === cartaoId)
    if (achado !== undefined) return achado
  }
  return null
}

/** A prévia da tela do mestre: "FOR 160 → 190", com a forma ligada com os números escolhidos (a ficha de agora não muda). */
export function previaDaDecisao(personagem: Personagem, sistema: SistemaDeRpg, cartaoId: string, decisao: DecisaoDaForma): NumeroDaForma[] {
  const cartao = cartaoPorId(personagem, cartaoId)
  if (cartao === null) return []
  const comDecisao = comCartaoTrocado(personagem, cartaoComADecisao(cartao, { mods: decisao.mods, habilidade: null }))
  return ativarForma(comDecisao, sistema, cartaoId, '', 0)?.numeros ?? []
}

function comSinal(numero: number): string {
  return numero < 0 ? String(numero) : `+${numero}`
}

/** "FOR +30, AGI +20 · ganha Garras de Lua", para o registro e a fila. Sem nada: "sem modificadores". */
export function textoDaDecisao(decisao: DecisaoDaForma, sistema: SistemaDeRpg | null): string {
  const alvos = alvosDaDecisao(sistema)
  const mods = decisao.mods.map((mod) => `${alvos.find((alvo) => alvo.id === mod.atributo)?.curto ?? mod.atributo} ${comSinal(mod.delta)}`).join(', ')
  const partes = [mods.length > 0 ? mods : 'sem modificadores']
  if (decisao.habilidade !== null) partes.push(`ganha ${decisao.habilidade.nome}`)
  return partes.join(' · ')
}

/** C6: o motivo do Ativar apagado enquanto o mestre decide (o host também recusa o segundo pedido). */
export const MOTIVO_DO_MESTRE_DECIDINDO = 'O mestre está decidindo os números'

/**
 * C6: a tira Transformação com a peça do mestre: a forma desligada com a peça
 * não mostra a prévia (os números são os da última vez, e o mestre decide de
 * novo), e a que já espera o mestre fica apagada com o motivo.
 */
export function formasComODecidirDoMestre(formas: readonly FormaNoMenu[], esperando: readonly { cartaoId: string }[] | undefined): FormaNoMenu[] {
  return formas.map((forma) => {
    if (forma.ligada || !formaDecididaPeloMestre(forma.cartao)) return forma
    const espera = (esperando ?? []).some((item) => item.cartaoId === forma.cartao.id)
    return espera ? { ...forma, numeros: [], motivo: MOTIVO_DO_MESTRE_DECIDINDO, motivoDosUsos: MOTIVO_DO_MESTRE_DECIDINDO } : { ...forma, numeros: [] }
  })
}

function partesDe(reversao: Reversao): Reversao[] {
  return reversao.tipo === 'composta' ? reversao.partes.flatMap(partesDe) : [reversao]
}

function emLista(itens: readonly string[]): string {
  return itens.length <= 1 ? (itens[0] ?? '') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

/**
 * C6: a frase da confirmação de Recusar, pelo que o Desfazer do pedido devolve
 * de fato: a ação só se ainda é a vez do pedido (o gasto é "só na vez"), o uso
 * e o Overload só se o pedido os gastou, e nada se a linha do pedido já saiu
 * do registro (a store só tira a pendência).
 */
export function fraseDoRecusar(pendente: FormaPendente, quem: string, turnos: Pick<TurnosDaCena, 'vez' | 'rodada'>, registro: readonly LinhaDoRegistro[]): string {
  const linha = registro.find((candidata) => candidata.id === pendente.linhaId)
  if (linha === undefined) return `O pedido já saiu do registro: nada volta para ${quem}.`
  const partes = partesDe(linha.reversao)
  const gasto = partes.find((parte) => parte.tipo === 'gasto')
  const naVez = gasto !== undefined && (gasto.vez === undefined || (turnos.vez === gasto.vez.cartaId && turnos.rodada === gasto.vez.rodada))
  const voltam: string[] = naVez ? ['a ação'] : []
  for (const parte of partes) {
    if (parte.tipo !== 'combate' || parte.personagemId !== pendente.personagemId) continue
    if ((parte.depois.usos[pendente.cartaoId] ?? 0) !== (parte.antes?.usos[pendente.cartaoId] ?? 0)) voltam.push('o uso')
    if (parte.depois.overload && parte.antes?.overload !== true) voltam.push('o Overload')
  }
  const frases: string[] = []
  if (voltam.length > 0) {
    const lista = emLista(voltam)
    frases.push(`${lista.charAt(0).toUpperCase()}${lista.slice(1)} ${voltam.length === 1 ? 'volta' : 'voltam'} para ${quem}.`)
  }
  if (gasto !== undefined && !naVez) frases.push('A ação não volta: a vez já passou.')
  if (frases.length === 0) frases.push(`${pendente.nome} não gastou nada.`)
  return frases.join(' ')
}

/** C6: o id da pendência. */
export function novoIdDeDecisao(): string {
  return `decisao_${crypto.randomUUID()}`
}
