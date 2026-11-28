import { NOME_DO_OCULTO, ocultoNaBatalha } from '../habilidadeOculta'
import type { CartaoDaFicha, Personagem } from '../personagem'
import { idValido, type SistemaDeRpg } from '../sistemaDeRpg'
import {
  ALVO_DA_REACAO,
  ALVO_DO_DANO,
  ALVO_DO_MOD_MAX,
  DANO_MAX,
  MODIFICADOR_DA_REACAO_MAX,
  MODS_POR_SELO_MAX,
  NOME_DO_SELO_MAX,
  partesDoBonus,
  SELOS_MAX,
  SELOS_POR_TOKEN_MAX,
  TURNOS_DO_SELO_MAX,
  type BonusDaBatalha,
  type ModDoSelo,
  type NaturezaDoSelo,
  type ParteDoBonus,
  type QuedaDoSelo,
  type RegrasDoSelo,
  type SaidaDaReacao,
  type SeloDaBatalha,
  type SeloDoGolpe,
  type SeloPedido,
} from './combate'
import { comportamentoDoSelo, nomeDaCondicaoDoSelo, regrasDoSelo } from './condicoes'
import { normalizar } from './formula'
import type { TurnosDaCena } from './turnos'

/**
 * SELOS DE DURAÇÃO, F3 fatia T (seção 3.3 de
 * docs/planos/batalha-one-piece-f3-plano.md; respostas Q4 a Q6): "Atordoado 2"
 * na carta. O mestre põe à mão; a habilidade que diz "por N turnos" sugere o
 * selo no golpe, que só pega se o golpe acerta (Q6). Conta pela vez do alvo
 * (Q4): desconta no fim da vez dele, no máximo 1 vez por rodada. Todos que
 * veem a carta veem o selo, também o de NPC (Q5).
 *
 * Puro: sem store, sem rede. O id entra por parâmetro.
 */

/** Os prontos do "Pôr selo...", em botões. */
export const SELOS_PRONTOS = ['Atordoado', 'Cego', 'Sangrando', 'Queimando', 'Envenenado', 'Paralisado', 'Lento', 'Preso', 'Confuso', 'Marcado'] as const

/** O nome quando nem a palavra-chave nem a técnica dão um. */
const NOME_DO_SELO_PADRAO = 'Selo'

/** O nome sem o que está entre parênteses, normalizado e sem espaço a mais (como o nome curto do selo da passiva). */
function nomeComparavel(nome: string): string {
  return normalizar(nome.replace(/\([^)]*\)/g, ' ')).replace(/\s+/g, ' ').trim()
}

/**
 * Fatia C7 (revisão): o nome do selo que um cartão põe na batalha (no alvo,
 * em quem usa, em quem atacou). O selo fica no token, à vista de todos: vira
 * "???" quando o cartão sai como "???" (`ocultoNaBatalha`) e o nome do selo
 * veio do nome dele (o da passiva, o da técnica sem palavra-chave no texto:
 * "Garra Lunar", "Fortaleza"). O selo pronto ou com regra ("Atordoado",
 * "Marcado") fica: ele é o efeito, a regra o lê pelo nome, e não é o segredo.
 */
export function nomeDoSeloNaBatalha(personagem: Pick<Personagem, 'abas'> | null, cartao: CartaoDaFicha, nomeDoSelo: string): string {
  if (!ocultoNaBatalha(personagem, cartao)) return nomeDoSelo
  if (SELOS_PRONTOS.some((pronto) => pronto === nomeDoSelo) || comportamentoDoSelo(nomeDoSelo) !== null) return nomeDoSelo
  const doSelo = nomeComparavel(nomeDoSelo)
  return doSelo.length > 0 && nomeComparavel(cartao.nome).startsWith(doSelo) ? NOME_DO_OCULTO : nomeDoSelo
}

/** Os campos da técnica que a leitura do selo olha, nesta ordem. */
const CAMPOS_DO_SELO = ['efeito', 'descricao'] as const

/** Nome de selo que o fio aceita: de 1 a `NOME_DO_SELO_MAX`, sem quebra de linha e não só espaço. */
export function ehNomeDeSelo(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= NOME_DO_SELO_MAX && !/[\r\n]/.test(value) && value.trim().length > 0
}

export function novoIdDeSelo(): string {
  return `selo_${crypto.randomUUID()}`
}

/**
 * O selo pedido dentro das regras (nome aparado no teto, turnos de 1 a 99 ou
 * até tirar); torto = `null`. Os mods passam por `modsValidos` (o que não
 * vale sai calado; o selo fica).
 */
export function seloPedidoValido(selo: SeloPedido, sistema: SistemaDeRpg | null): SeloPedido | null {
  const nome = selo.nome.replace(/\s+/g, ' ').trim().slice(0, NOME_DO_SELO_MAX).trim()
  if (!ehNomeDeSelo(nome)) return null
  if (selo.turnos !== null && (!Number.isInteger(selo.turnos) || selo.turnos < 1 || selo.turnos > TURNOS_DO_SELO_MAX)) return null
  const mods = modsValidos(selo.mods, sistema)
  return mods.length === 0 ? { nome, turnos: selo.turnos } : { nome, turnos: selo.turnos, mods }
}

/** "por 2 turnos", "durante 3 rodadas" (já sem acento e em minúsculas). */
const DURACAO = /\b(?:por|durante) (\d+) (?:turnos?|rodadas?)\b/

/** A palavra-chave e o selo que ela dá. A primeira que aparece no texto vence. */
const PALAVRAS_DO_SELO: readonly { sinal: RegExp; nome: (typeof SELOS_PRONTOS)[number] }[] = [
  { sinal: /atordo|\bstun/, nome: 'Atordoado' },
  { sinal: /\bceg[ao]/, nome: 'Cego' },
  { sinal: /sangra/, nome: 'Sangrando' },
  { sinal: /queima/, nome: 'Queimando' },
  { sinal: /envenena|veneno/, nome: 'Envenenado' },
  { sinal: /paralisa/, nome: 'Paralisado' },
  { sinal: /\blento\b|lentidao/, nome: 'Lento' },
  { sinal: /prende|imobiliza/, nome: 'Preso' },
  { sinal: /confunde/, nome: 'Confuso' },
  // Tipos de habilidade F1: a marca que a reação põe em quem atacou ("marca de tinta").
  { sinal: /\bmarca/, nome: 'Marcado' },
]

/**
 * O selo que um texto sugere: número + "turno(s)" ou "rodada(s)" depois de
 * "por" ou "durante" ("Atordoa o alvo por 1 turno" = Atordoado, 1). Nome: a
 * primeira palavra-chave do texto; nenhuma = o nome da técnica (no teto).
 * Sem número de turnos = `null` ("-15 (Por turno)" não é selo).
 */
export function lerDuracao(texto: string, nomeDaTecnica: string): SeloPedido | null {
  const normal = normalizar(texto)
  const numero = DURACAO.exec(normal)?.[1]
  if (numero === undefined) return null
  const turnos = Math.min(TURNOS_DO_SELO_MAX, Number.parseInt(numero, 10))
  if (!(turnos >= 1)) return null
  return { nome: nomeDoSelo(normal, nomeDaTecnica), turnos }
}

/** O nome do selo: a primeira palavra-chave do texto (já normalizado); nenhuma = o nome da técnica no teto. */
function nomeDoSelo(normal: string, nomeDaTecnica: string): string {
  let achado: { indice: number; nome: string } | null = null
  for (const { sinal, nome } of PALAVRAS_DO_SELO) {
    const indice = normal.search(sinal)
    if (indice !== -1 && (achado === null || indice < achado.indice)) achado = { indice, nome }
  }
  const nome = achado?.nome ?? (nomeDaTecnica.replace(/\s+/g, ' ').trim().slice(0, NOME_DO_SELO_MAX).trim() || NOME_DO_SELO_PADRAO)
  return ehNomeDeSelo(nome) ? nome : NOME_DO_SELO_PADRAO
}

/** O selo que a técnica sugere: lê o Efeito e, sem nada lá, a Descrição. */
export function seloDaTecnica(cartao: CartaoDaFicha): SeloPedido | null {
  for (const campo of CAMPOS_DO_SELO) {
    const selo = lerDuracao(cartao.campos[campo] ?? '', cartao.nome)
    if (selo !== null) return selo
  }
  return null
}

/** O que a criação do selo precisa saber da cena. */
export interface OndeNasceOSelo {
  id: string
  rodada: number
  /** O token da carta da vez agora; `null` = nenhuma. */
  tokenDaVez: string | null
  /** P2: o id da carta da vez agora (o selo posto nela não desconta no fim DESTA vez). Ausente = 1 vez por rodada, como antes. */
  cartaIdDaVez?: string
  /** A técnica que o pôs. */
  origem?: string
}

/** P2: o token e a carta da vez de agora, para o `OndeNasceOSelo`. */
export function ondeNaVez(turnos: Pick<TurnosDaCena, 'cartas' | 'vez'>): Pick<OndeNasceOSelo, 'tokenDaVez' | 'cartaIdDaVez'> {
  const carta = turnos.vez === null ? undefined : turnos.cartas.find((candidata) => candidata.id === turnos.vez)
  return carta === undefined ? { tokenDaVez: null } : { tokenDaVez: carta.tokenId, cartaIdDaVez: carta.id }
}

/**
 * O selo novo. Posto na ficha DA VEZ, a vez de agora não conta (já marcado
 * nesta rodada): "Atordoado 1" vale a próxima vez inteira dela. Mods,
 * natureza (fora "condicao", que é a ausência) e cartaoId vêm do pedido.
 */
export function criarSelo(tokenId: string, pedido: SeloDoGolpe, onde: OndeNasceOSelo): SeloDaBatalha {
  const selo: SeloDaBatalha = { id: onde.id, tokenId, nome: pedido.nome, turnos: pedido.turnos, total: pedido.turnos }
  if (pedido.mods !== undefined && pedido.mods.length > 0) selo.mods = pedido.mods
  if (pedido.natureza !== undefined && pedido.natureza !== 'condicao') selo.natureza = pedido.natureza
  if (pedido.cartaoId !== undefined) selo.cartaoId = pedido.cartaoId
  if (pedido.porVez !== undefined) selo.porVez = pedido.porVez
  if (pedido.saiNoProximoGolpe === true) selo.saiNoProximoGolpe = true
  // Fase 5: a regra, a regeneração e o dreno da peça vão com o selo (só do host: a carta do jogador leva nome, turnos e mods).
  if (pedido.regra !== undefined) selo.regra = pedido.regra
  if (pedido.regenera !== undefined) selo.regenera = pedido.regenera
  if (pedido.drenaSp !== undefined) selo.drenaSp = pedido.drenaSp
  // Fase C do alcance: o que o selo da peça faz no alcance de quem o tem (a carta do jogador o leva para o aviso da mira).
  if (pedido.alcance !== undefined) selo.alcance = pedido.alcance
  // Rework das condições (D1, D2): a regra congelada da condição, as pilhas, a conta do gatilho, a aura e a marca da peça (só do host).
  if (pedido.regras !== undefined) selo.regras = pedido.regras
  if (pedido.pilhas !== undefined && pedido.pilhas > 1) selo.pilhas = pedido.pilhas
  if (pedido.gatilhoConta !== undefined && pedido.gatilhoConta > 0) selo.gatilhoConta = pedido.gatilhoConta
  if (pedido.gatilhoFeito === true) selo.gatilhoFeito = true
  if (pedido.daAura !== undefined) selo.daAura = pedido.daAura
  if (pedido.marca === true) {
    selo.marca = true
    if (pedido.marcaVezes !== undefined) selo.marcaVezes = pedido.marcaVezes
    if (pedido.marcaFica === true) selo.marcaFica = true
    if (pedido.marcaDe !== undefined) selo.marcaDe = pedido.marcaDe
  }
  if (onde.tokenDaVez === tokenId) {
    selo.contadoNaRodada = onde.rodada
    if (onde.cartaIdDaVez !== undefined) selo.contadoNaCarta = onde.cartaIdDaVez
    // Bug de 28/11/2026: o gatilho "depois de X turnos" também não conta a vez em que nasceu (o selo sem turnos não passa pelo prazo).
    if (regrasDoSelo(selo)?.gatilho !== undefined) {
      selo.gatilhoNaRodada = onde.rodada
      if (onde.cartaIdDaVez !== undefined) selo.gatilhoNaCarta = onde.cartaIdDaVez
    }
  }
  if (onde.origem !== undefined && onde.origem.trim().length > 0) selo.origem = onde.origem.trim()
  // Rework das habilidades (PLANO.md D10, Diminui atributo): a queda vai com o selo; `desde` 0 já dá o primeiro passo no acerto.
  // A queda em % já chega em números (`quedaEmNumeros`, na store, com o atributo do alvo); a que ainda vier em % não desce.
  const comQueda = pedido.queda === undefined || pedido.queda.emPorcento === true ? selo : pedido.queda.desde === 0 ? comPassoDaQueda({ ...selo, queda: pedido.queda }) : { ...selo, queda: pedido.queda }
  // Nº 5 das pendências do rework: as quedas a mais da condição (`regras.quedasAMais`) dão o primeiro passo no acerto também.
  return comAsQuedasAMais(comQueda, false)
}

// ─── Rework das habilidades (PLANO.md D10): o selo que desce com o tempo (Diminui atributo) ───

/**
 * Um passo da queda: cada mod do `passo` soma no mod do mesmo alvo do selo (sem passar do `teto`, em
 * módulo) e as `vezes` contam um; acabadas as vezes, a queda sai (os mods ficam até o selo acabar).
 * Sem queda: o MESMO selo.
 */
export function comPassoDaQueda(selo: SeloDaBatalha): SeloDaBatalha {
  const queda = selo.queda
  if (queda === undefined) return selo
  const { mods, sobra } = passoNosMods(selo.mods ?? [], queda)
  const { queda: _queda, ...semQueda } = selo
  const comMods: SeloDaBatalha = { ...semQueda, mods }
  return sobra === undefined ? comMods : { ...comMods, queda: sobra }
}

/** Um passo de `queda` nos `mods` (a conta de `comPassoDaQueda`): os mods depois e a queda que sobra (`undefined` = acabaram as vezes). */
function passoNosMods(antes: readonly ModDoSelo[], queda: QuedaDoSelo): { mods: ModDoSelo[]; sobra: QuedaDoSelo | undefined } {
  const mods: ModDoSelo[] = [...antes]
  for (const passo of queda.passo) {
    const onde = mods.findIndex((mod) => mod.alvo === passo.alvo)
    const deAntes = onde < 0 ? 0 : (mods[onde]?.delta ?? 0)
    const somado = deAntes + passo.delta
    const delta = queda.teto === undefined || Math.abs(somado) <= queda.teto ? somado : Math.sign(somado) * queda.teto
    const mod: ModDoSelo = { alvo: passo.alvo, delta: Math.max(-DANO_MAX, Math.min(DANO_MAX, delta)) }
    if (onde < 0) mods.push(mod)
    else mods[onde] = mod
  }
  const vezes = queda.vezes === undefined ? undefined : queda.vezes - 1
  return { mods: mods.slice(0, MODS_POR_SELO_MAX), sobra: vezes !== undefined && vezes <= 0 ? undefined : vezes === undefined ? queda : { ...queda, vezes } }
}

/**
 * Nº 5 das pendências do rework das condições: as quedas que não couberam na `queda` do selo
 * (`regras.quedasAMais`: ritmo, teto ou % diferentes da primeira) andam pela MESMA conta, cada uma com o
 * seu relógio. `naVez` = a vez de quem tem passou (antes do turno `desde`, só conta); sem ela = o acerto
 * (só as de `desde` 0 dão o passo). A que ainda vier em % não desce, como a `queda`. Nada andou: o MESMO selo.
 */
function comAsQuedasAMais(selo: SeloDaBatalha, naVez: boolean): SeloDaBatalha {
  const regras = selo.regras
  const quedas = regras?.quedasAMais
  if (regras === undefined || quedas === undefined || quedas.length === 0) return selo
  let mods: readonly ModDoSelo[] = selo.mods ?? []
  const ficam: QuedaDoSelo[] = []
  let andou = false
  for (const queda of quedas) {
    if (queda.emPorcento === true || (!naVez && queda.desde !== 0)) {
      ficam.push(queda)
      continue
    }
    andou = true
    if (naVez && queda.desde > 1) {
      ficam.push({ ...queda, desde: queda.desde - 1 })
      continue
    }
    const passo = passoNosMods(mods, queda)
    mods = passo.mods
    if (passo.sobra !== undefined) ficam.push({ ...passo.sobra, desde: 0 })
  }
  if (!andou) return selo
  const { quedasAMais: _quedas, ...semQuedas } = regras
  return { ...selo, mods: [...mods], regras: ficam.length === 0 ? semQuedas : { ...semQuedas, quedasAMais: ficam } }
}

/** O selo ainda tem queda andando: a `queda` ou alguma das `regras.quedasAMais`. */
function temQueda(selo: SeloDaBatalha): boolean {
  return selo.queda !== undefined || (selo.regras?.quedasAMais?.length ?? 0) > 0
}

/**
 * A vez de quem tem o selo com queda passou: antes do turno `desde`, só conta (`desde` − 1); dali em
 * diante, um passo por vez (`comPassoDaQueda`). As quedas a mais andam junto (`comAsQuedasAMais`). Sem
 * queda: o MESMO selo.
 */
function quedaNaVez(selo: SeloDaBatalha): SeloDaBatalha {
  const queda = selo.queda
  const daPrimeira = queda === undefined ? selo : queda.desde > 1 ? { ...selo, queda: { ...queda, desde: queda.desde - 1 } } : comPassoDaQueda(queda.desde === 0 ? selo : { ...selo, queda: { ...queda, desde: 0 } })
  return comAsQuedasAMais(daPrimeira, true)
}

/**
 * D10 ("% do atributo, fixado no acerto"): a queda em % vira números com o `valor` do atributo de
 * quem leva o selo agora (para baixo; o teto também), por alvo do mod. O atributo sem valor (o token
 * sem ficha) perde 0. Sem queda em %: o MESMO pedido.
 */
export function quedaEmNumeros(pedido: SeloDoGolpe, valorDoAtributo: (alvo: string) => number): SeloDoGolpe {
  const queda = pedido.queda
  const comAPrimeira = queda === undefined || queda.emPorcento !== true ? pedido : { ...pedido, queda: quedaFixada(queda, valorDoAtributo) }
  // Nº 5 das pendências do rework: as quedas a mais da condição em % viram números do mesmo jeito.
  const regras = comAPrimeira.regras
  const aMais = regras?.quedasAMais
  if (regras === undefined || aMais === undefined || !aMais.some((outra) => outra.emPorcento === true)) return comAPrimeira
  return { ...comAPrimeira, regras: { ...regras, quedasAMais: aMais.map((outra) => (outra.emPorcento === true ? quedaFixada(outra, valorDoAtributo) : outra)) } }
}

/** O pedido traz alguma queda em % (a `queda` ou uma das `regras.quedasAMais`): a store a passa a números no acerto. */
export function temQuedaEmPorcento(pedido: Pick<SeloDoGolpe, 'queda' | 'regras'>): boolean {
  return pedido.queda?.emPorcento === true || (pedido.regras?.quedasAMais ?? []).some((queda) => queda.emPorcento === true)
}

/** Uma queda em % com os números do atributo agora (para baixo; o teto também). */
function quedaFixada(queda: QuedaDoSelo, valorDoAtributo: (alvo: string) => number): QuedaDoSelo {
  const emNumero = (alvo: string, porcento: number): number => Math.trunc((Math.max(0, valorDoAtributo(alvo)) * porcento) / 100)
  const passo = queda.passo.map((mod) => ({ alvo: mod.alvo, delta: emNumero(mod.alvo, mod.delta) })).filter((mod) => mod.delta !== 0)
  const primeiro = queda.passo[0]
  const { emPorcento: _emPorcento, teto, ...semPorcento } = queda
  const fixa: QuedaDoSelo = { ...semPorcento, passo }
  if (teto !== undefined && primeiro !== undefined) fixa.teto = Math.abs(emNumero(primeiro.alvo, teto))
  return fixa
}

/**
 * D10 (decisão 12: "golpe novo não soma, só recomeça o prazo"): o selo com queda que o token já tem,
 * da mesma técnica e com o mesmo nome. `undefined` = não tem (o golpe põe o selo novo).
 */
export function seloComQuedaNoToken(selos: readonly SeloDaBatalha[] | undefined, tokenId: string, pedido: Pick<SeloDoGolpe, 'nome' | 'cartaoId' | 'queda'>): SeloDaBatalha | undefined {
  if (pedido.queda === undefined) return undefined
  const nome = normalizar(pedido.nome).trim()
  return (selos ?? []).find((selo) => selo.tokenId === tokenId && selo.cartaoId === pedido.cartaoId && normalizar(selo.nome).trim() === nome && (selo.queda !== undefined || (selo.mods ?? []).length > 0))
}

/** A lista com o selo no fim; acima do teto da ficha ou da cena = `null`. */
export function comSeloNovo(selos: readonly SeloDaBatalha[] | undefined, selo: SeloDaBatalha): SeloDaBatalha[] | null {
  const lista = selos ?? []
  if (lista.length >= SELOS_MAX || selosDoToken(lista, selo.tokenId).length >= SELOS_POR_TOKEN_MAX) return null
  return [...lista, selo]
}

// ─── Rework das condições (PLANO.md D2, D4, E3): o selo que nasce de uma condição ───

/**
 * D4 ("o de antes roda como hoje"): o pedido de quem põe com a tradução da condição (`traduzirCondicao`).
 * Por campo, o número próprio do pedido (os mods e a regra da técnica, o `porVez` do item, a queda do
 * Diminui, a marca da peça) vence o da condição; o que o pedido não traz vem dela. O nome, os turnos, a
 * natureza, o cartão e o teste são sempre do pedido; a regra congelada (`regras`) e as pilhas, da condição.
 */
export function seloComACondicao(pedido: SeloDoGolpe, traduzido: SeloDoGolpe): SeloDoGolpe {
  const selo: SeloDoGolpe = { ...pedido }
  // O Muda atributo é um campo só (os mods e a queda): o do pedido (a técnica com "AGI -10") vence o da condição inteiro, sem somar.
  const atributoProprio = (pedido.mods?.length ?? 0) > 0 || pedido.queda !== undefined
  if (!atributoProprio && traduzido.mods !== undefined && traduzido.mods.length > 0) selo.mods = traduzido.mods
  if (!atributoProprio && traduzido.queda !== undefined) selo.queda = traduzido.queda
  if (selo.porVez === undefined && traduzido.porVez !== undefined) selo.porVez = traduzido.porVez
  // A regra em % é campo a campo (o corte de cura próprio do item vence; o dano recebido da condição fica).
  if (traduzido.regra !== undefined) selo.regra = { ...traduzido.regra, ...pedido.regra }
  if (selo.regenera === undefined && traduzido.regenera !== undefined) selo.regenera = traduzido.regenera
  if (selo.drenaSp === undefined && traduzido.drenaSp !== undefined) selo.drenaSp = traduzido.drenaSp
  if (selo.alcance === undefined && traduzido.alcance !== undefined) selo.alcance = traduzido.alcance
  if (selo.saiNoProximoGolpe === undefined && traduzido.saiNoProximoGolpe === true) selo.saiNoProximoGolpe = true
  if (traduzido.regras !== undefined) {
    // A vida por vez própria (o `n` do item, o "tira X por vez" da peça) vence a da condição: a dela sai da regra congelada.
    const vez = pedido.porVez === undefined ? traduzido.regras.vez : traduzido.regras.vez?.filter((efeito) => !(efeito.quando === 'comeco' && efeito.faz === 'tira' && efeito.recurso === 'vida'))
    const { vez: _vez, quedasAMais, ...semVez } = traduzido.regras
    const regras: RegrasDoSelo = { ...semVez }
    if (vez !== undefined && vez.length > 0) regras.vez = vez
    if (!atributoProprio && quedasAMais !== undefined) regras.quedasAMais = quedasAMais
    selo.regras = regras
  }
  if (selo.marca === undefined && traduzido.marca === true) {
    selo.marca = true
    if (traduzido.marcaVezes !== undefined) selo.marcaVezes = traduzido.marcaVezes
    if (traduzido.marcaFica === true) selo.marcaFica = true
    if (traduzido.marcaDe !== undefined) selo.marcaDe = traduzido.marcaDe
  }
  if (traduzido.pilhas !== undefined) selo.pilhas = traduzido.pilhas
  return selo
}

/**
 * D7 (pilhas): o selo de antes com os números da condição traduzidos com `pilhas` pilhas. `antigo` e `novo`
 * = a mesma condição traduzida com as pilhas de antes e com as novas; o número que o selo traz igual ao
 * `antigo` veio da condição e passa ao `novo`; o que difere é próprio (D4) e fica. O prazo não recomeça.
 */
export function seloComPilhas(antes: SeloDaBatalha, pilhas: number, antigo: SeloDoGolpe, novo: SeloDoGolpe): SeloDaBatalha {
  const igual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
  const depois: SeloDaBatalha = { ...antes, pilhas }
  if (igual(antes.mods, antigo.mods)) {
    if (novo.mods === undefined) delete depois.mods
    else depois.mods = novo.mods
  }
  if (igual(antes.porVez, antigo.porVez)) {
    if (novo.porVez === undefined) delete depois.porVez
    else depois.porVez = novo.porVez
  }
  if (novo.regenera !== undefined && igual(antes.regenera, antigo.regenera)) depois.regenera = novo.regenera
  if (novo.drenaSp !== undefined && igual(antes.drenaSp, antigo.drenaSp)) depois.drenaSp = novo.drenaSp
  if (antes.regras !== undefined && novo.regras !== undefined) {
    const regras: RegrasDoSelo = { ...antes.regras }
    if (igual(antes.regras.vez, antigo.regras?.vez) && novo.regras.vez !== undefined) regras.vez = novo.regras.vez
    depois.regras = regras
  }
  return depois
}

/** Como o selo novo entrou ("ao entrar": a Contra-condição, o "se ganhar de novo" e as pilhas). */
export type EntradaDoSelo =
  /** Entrou como selo novo; `apagados` = os que a Contra-condição dele tirou do token. */
  | { tipo: 'entrou'; selos: SeloDaBatalha[]; selo: SeloDaBatalha; apagados: SeloDaBatalha[] }
  /** A mesma condição já estava: o prazo recomeçou ("renova") ou ela ganhou uma pilha. */
  | { tipo: 'renovou' | 'pilha'; selos: SeloDaBatalha[]; antes: SeloDaBatalha; depois: SeloDaBatalha }
  /** A mesma condição já estava e nada muda (o "nada muda", ou já no teto de pilhas). */
  | { tipo: 'igual'; antes: SeloDaBatalha }
  /** Uma condição que o token tem impede esta (Molhado barra o Queimando). */
  | { tipo: 'barrado'; por: SeloDaBatalha }
  /** O token ou a cena já estão no teto de selos. */
  | { tipo: 'cheio' }

export interface OpcoesDaEntrada {
  /** O selo de antes com `pilhas` pilhas e os números traduzidos de novo (a store tem o catálogo). Ausente = só a conta das pilhas muda. */
  comPilhas?: (antes: SeloDaBatalha, pilhas: number) => SeloDaBatalha
}

/** O selo é da mesma condição: o mesmo `condId` quando os dois a conhecem, senão o mesmo nome de condição (sem acento nem caixa). */
function mesmaCondicao(a: SeloDaBatalha, b: SeloDaBatalha): boolean {
  const [ra, rb] = [regrasDoSelo(a), regrasDoSelo(b)]
  if (ra !== null && rb !== null) return ra.condId === rb.condId
  return normalizar(nomeDaCondicaoDoSelo(a)).trim() === normalizar(nomeDaCondicaoDoSelo(b)).trim()
}

function nomesNaChave(nomes: readonly string[]): Set<string> {
  return new Set(nomes.map((nome) => normalizar(nome).trim()))
}

/**
 * Rework das condições (E3, "ao entrar"): o selo novo `novo` entra nos selos da cena. Na ordem:
 *  1. uma condição do token que o impede (a Contra-condição com "impede") barra a entrada;
 *  2. a mesma condição já no token (fora o espelho da ficha): o "se ganhar de novo" dela decide entre
 *     recomeçar o prazo (os turnos do pedido novo), somar uma pilha até o teto (sem recomeçar o prazo,
 *     decisão 3) ou nada mudar; selo sem condição entra de novo, como sempre;
 *  3. entra, e a Contra-condição dele apaga do token as que ela lista (fora o espelho da ficha, que mora nela).
 * Puro: a reversão é de quem chama.
 */
export function entradaDoSelo(selos: readonly SeloDaBatalha[] | undefined, novo: SeloDaBatalha, opcoes: OpcoesDaEntrada = {}): EntradaDoSelo {
  const lista = selos ?? []
  const doToken = lista.filter((selo) => selo.tokenId === novo.tokenId)
  const nomeDoNovo = normalizar(nomeDaCondicaoDoSelo(novo)).trim()
  const barrador = doToken.find((selo) => selo.id !== novo.id && nomesNaChave(regrasDoSelo(selo)?.contra?.impede ?? []).has(nomeDoNovo))
  if (barrador !== undefined) return { tipo: 'barrado', por: barrador }
  const regras = regrasDoSelo(novo)
  const antes = regras === null ? undefined : doToken.find((selo) => selo.daPastilha !== true && mesmaCondicao(selo, novo))
  if (regras !== null && antes !== undefined) {
    // Bug de 28/11/2026: a condição própria em quem só tem a pega da aura (`daAura`) vira a própria, no lugar da pega
    // (mesmo id, o Desfazer volta a pega): dura o prazo dela, irradia e não sai quando a ficha deixa o raio.
    if (antes.daAura !== undefined && novo.daAura === undefined) {
      const depois: SeloDaBatalha = { ...novo, id: antes.id }
      return { tipo: 'renovou', selos: lista.map((selo) => (selo.id === antes.id ? depois : selo)), antes, depois }
    }
    if (regras.deNovo === 'nada') return { tipo: 'igual', antes }
    if (regras.deNovo === 'pilha') {
      const teto = regras.tetoDePilhas ?? 1
      const pilhas = Math.min(teto, (antes.pilhas ?? 1) + (novo.pilhas ?? 1))
      if (pilhas <= (antes.pilhas ?? 1)) return { tipo: 'igual', antes }
      const depois = opcoes.comPilhas?.(antes, pilhas) ?? { ...antes, pilhas }
      return { tipo: 'pilha', selos: lista.map((selo) => (selo.id === antes.id ? depois : selo)), antes, depois }
    }
    // Construtor C5 (revisão): a duração vem toda do pedido novo, o "até o próximo golpe" junto com os turnos.
    const { saiNoProximoGolpe: _anterior, ...semADuracao } = antes
    const depois: SeloDaBatalha = { ...semADuracao, turnos: novo.turnos, total: novo.turnos }
    if (novo.porVez !== undefined) depois.porVez = novo.porVez
    if (novo.saiNoProximoGolpe === true) depois.saiNoProximoGolpe = true
    return { tipo: 'renovou', selos: lista.map((selo) => (selo.id === antes.id ? depois : selo)), antes, depois }
  }
  const apaga = nomesNaChave(regras?.contra?.apaga ?? [])
  const apagados = apaga.size === 0 ? [] : doToken.filter((selo) => selo.daPastilha !== true && apaga.has(normalizar(nomeDaCondicaoDoSelo(selo)).trim()))
  const ficam = apagados.length === 0 ? lista : lista.filter((selo) => !apagados.includes(selo))
  const comEle = comSeloNovo(ficam, novo)
  return comEle === null ? { tipo: 'cheio' } : { tipo: 'entrou', selos: comEle, selo: novo, apagados }
}

/**
 * O espelho de uma condição da ficha que já passou `vezes` vezes com quem a tem (`CondicaoNaFicha.vezes`):
 * a queda dele desce o mesmo que desceria na batalha (o espelho não desconta sozinho). Sem queda ou sem
 * vezes: o MESMO selo.
 */
export function seloDepoisDasVezes(selo: SeloDaBatalha, vezes: number): SeloDaBatalha {
  let depois = selo
  for (let vez = 0; vez < vezes && temQueda(depois); vez += 1) depois = quedaNaVez(depois)
  return depois
}

/**
 * A carta de `tokenIdQueSai` passou a vez na `rodada`: os selos dela
 * descontam 1; os que chegam a 0 saem e vêm em `acabaram`. Selo sem turnos
 * nunca desconta. P2 do grilling: com `cartaIdQueSai`, desconta uma vez por
 * VEZ (a carta extra do mesmo token desconta de novo na rodada; a MESMA
 * carta de novo na rodada, pelo "Dar a vez", não). Selo sem `contadoNaCarta`
 * (o de antes) e chamada sem a carta: 1 vez por rodada, como antes. Nada
 * mudou = a MESMA lista em `selos`.
 */
export function contarSelos(selos: readonly SeloDaBatalha[], tokenIdQueSai: string, rodada: number, cartaIdQueSai?: string): { selos: readonly SeloDaBatalha[]; acabaram: SeloDaBatalha[] } {
  const acabaram: SeloDaBatalha[] = []
  let mudou = false
  const ficam: SeloDaBatalha[] = []
  const marca = (selo: SeloDaBatalha, turnos: number | null): SeloDaBatalha => (cartaIdQueSai === undefined ? { ...selo, turnos, contadoNaRodada: rodada } : { ...selo, turnos, contadoNaRodada: rodada, contadoNaCarta: cartaIdQueSai })
  for (const selo of selos) {
    // Nº 3 do levantamento: o espelho da pastilha não desconta; o prazo da ficha é o relógio dele (`espelhosDasPastilhas`).
    // Rework das habilidades (D10): o selo com queda desce na vez de quem o tem, com turnos ou sem (o "até o fim da batalha").
    if (selo.tokenId !== tokenIdQueSai || (selo.turnos === null && !temQueda(selo)) || selo.daPastilha === true || jaContouNestaVez(selo, rodada, cartaIdQueSai)) {
      ficam.push(selo)
      continue
    }
    mudou = true
    const descido = quedaNaVez(selo)
    if (descido.turnos === null) {
      ficam.push(marca(descido, null))
      continue
    }
    const turnos = descido.turnos - 1
    if (turnos <= 0) acabaram.push(marca(descido, 0))
    else ficam.push(marca(descido, turnos))
  }
  return { selos: mudou ? ficam : selos, acabaram }
}

/** P2: o selo já descontou (ou nasceu) nesta vez. Sem carta dos dois lados: nesta rodada. */
function jaContouNestaVez(selo: SeloDaBatalha, rodada: number, cartaIdQueSai: string | undefined): boolean {
  if (selo.contadoNaRodada !== rodada) return false
  return selo.contadoNaCarta === undefined || cartaIdQueSai === undefined || selo.contadoNaCarta === cartaIdQueSai
}

/** Os selos de uma ficha, na ordem em que foram postos. */
export function selosDoToken(selos: readonly SeloDaBatalha[] | undefined, tokenId: string): SeloDaBatalha[] {
  return (selos ?? []).filter((selo) => selo.tokenId === tokenId)
}

/** Q6: o selo sugerido pega quando o golpe acerta (Receber, Defender, Crítico, Não reagir, Passar, sem reação); não em Esquivar nem Contra-atacar. */
export function pegaOSelo(saida: SaidaDaReacao): boolean {
  return saida !== 'esquiva' && saida !== 'contra'
}

/** "Atordoado 2"; sem turnos (até tirar), só o nome: "Cego". */
export function textoDoSelo(selo: Pick<SeloDaBatalha, 'nome' | 'turnos'>): string {
  return selo.turnos === null ? selo.nome : `${selo.nome} ${selo.turnos}`
}

/** "Atordoado acabou em Ilo · Cego acabou em Ilo": o pedaço que vai no fim da linha da vez. */
export function textoDosQueAcabaram(acabaram: readonly SeloDaBatalha[], nomeDe: (tokenId: string) => string): string {
  return acabaram.map((selo) => `${selo.nome} acabou em ${nomeDe(selo.tokenId)}`).join(' · ')
}

// ───────────────────────────────────────────────────────────────────────────
// Tipos de habilidade F2: o que os selos somam (Buff/Debuff, seção 4c)
// ───────────────────────────────────────────────────────────────────────────

/** Alvo de mod que o fio aceita: a forma de um id de atributo (letras, números, - e _), no teto. */
export function ehAlvoDeMod(value: unknown): value is string {
  return typeof value === 'string' && value.length <= ALVO_DO_MOD_MAX && idValido(value)
}

/** O que um selo precisa ter para somar: de quem é, o nome (que a conta mostra) e os mods. */
export type SeloQueSoma = Pick<SeloDaBatalha, 'tokenId' | 'nome' | 'mods'> & Partial<Pick<SeloDaBatalha, 'regras'>>

/**
 * O bônus dos selos da ficha `tokenId`: por alvo, as partes "+20 (Fúria)" na
 * ordem em que os selos foram postos; delta 0 não entra (fora a parte que
 * zera, `ParteDoBonus.zera`, sempre a última do alvo). A MESMA conta em
 * todas as telas (menu, mira, painel do NPC, caixa de reação). O jogador
 * passa `selosParaOBonus(estado.cartas)`.
 */
export function bonusDaBatalha(selos: readonly SeloQueSoma[] | undefined, tokenId: string): BonusDaBatalha {
  // Map e não objeto: o alvo veio do fio, e "constructor" num objeto já existe.
  const porAlvo = new Map<string, ParteDoBonus[]>()
  const comParte = (alvo: string, parte: ParteDoBonus): void => {
    porAlvo.set(alvo, [...(porAlvo.get(alvo) ?? []), parte])
  }
  const doToken = (selos ?? []).filter((selo) => selo.tokenId === tokenId)
  for (const selo of doToken) {
    for (const mod of selo.mods ?? []) {
      if (mod.delta !== 0) comParte(mod.alvo, { nome: selo.nome, delta: mod.delta })
    }
  }
  // F2 (fatia A): o selo que zera um atributo (Cego: Percepção) entra por último, e quem lê (`valorComAsPartes`) deixa em 0 enquanto ele existe.
  // Rework das condições: o "fica em 0" da condição (Cego: Percepção), da regra congelada ou da de fábrica pelo nome; a redoma, pela tabela.
  for (const selo of doToken) {
    const regras = regrasDoSelo(selo)
    const zeram = new Set((regras?.ficaEm ?? []).filter((fica) => fica.v === 0).map((fica) => fica.alvo))
    const daTabela = selo.regras === undefined ? comportamentoDoSelo(selo.nome)?.zera : undefined
    if (daTabela !== undefined) zeram.add(daTabela)
    for (const zera of zeram) comParte(zera, { nome: selo.nome, delta: 0, zera: true })
    // Nº 5 das pendências do rework: o "fica em N" (N ≠ 0) e o "no máximo N" da condição, lidos na hora como o que zera.
    for (const fica of regras?.ficaEm ?? []) if (fica.v !== 0) comParte(fica.alvo, { nome: selo.nome, delta: 0, fica: fica.v })
    for (const teto of regras?.noMaximo ?? []) comParte(teto.alvo, { nome: selo.nome, delta: 0, teto: teto.v })
  }
  return Object.fromEntries(porAlvo)
}

/** A soma de um alvo do bônus; sem selo, 0. As partes com o nome de cada selo: `partesDoBonus` (combate.ts). */
export function totalDoBonus(bonus: BonusDaBatalha | undefined, alvo: string): number {
  return partesDoBonus(bonus, alvo).reduce((soma, parte) => soma + parte.delta, 0)
}

/** O modificador inicial da caixa de reação: a soma do "reacao", no teto do modificador (o campo segue editável). */
export function bonusDaReacao(bonus: BonusDaBatalha | undefined): number {
  return Math.max(-MODIFICADOR_DA_REACAO_MAX, Math.min(MODIFICADOR_DA_REACAO_MAX, totalDoBonus(bonus, ALVO_DA_REACAO)))
}

/** Um alvo que a linha "atributo / delta" oferece. `curto` = o da pílula ("FOR +20"). */
export interface AlvoDeMod {
  id: string
  rotulo: string
  curto: string
}

/** As opções da linha "atributo / delta" (mira e "Pôr selo..."): os atributos do sistema, Dano e Reação. */
export function alvosDeMod(sistema: SistemaDeRpg | null): AlvoDeMod[] {
  const atributos = (sistema?.atributos ?? []).map((atributo): AlvoDeMod => ({ id: atributo.id, rotulo: atributo.nome, curto: atributo.abreviacao || atributo.nome }))
  return [...atributos, { id: ALVO_DO_DANO, rotulo: 'Dano', curto: 'Dano' }, { id: ALVO_DA_REACAO, rotulo: 'Reação', curto: 'Reação' }]
}

/** Os mods que valem: alvo de `alvosDeMod`, delta inteiro e não 0 dentro de ±`DANO_MAX`, até `MODS_POR_SELO_MAX`. O resto sai calado. */
export function modsValidos(mods: readonly ModDoSelo[] | undefined, sistema: SistemaDeRpg | null): ModDoSelo[] {
  const alvos = new Set(alvosDeMod(sistema).map((alvo) => alvo.id))
  return (mods ?? [])
    .filter((mod) => alvos.has(mod.alvo) && Number.isInteger(mod.delta) && mod.delta !== 0 && Math.abs(mod.delta) <= DANO_MAX)
    .slice(0, MODS_POR_SELO_MAX)
    .map((mod) => ({ alvo: mod.alvo, delta: mod.delta }))
}

function comSinal(numero: number): string {
  return numero < 0 ? String(numero) : `+${numero}`
}

/** "FOR +20", "Dano +30", "Reação -2". Alvo fora do sistema: o próprio id. */
export function textoDoMod(mod: ModDoSelo, sistema: SistemaDeRpg | null): string {
  const alvo = alvosDeMod(sistema).find((candidato) => candidato.id === mod.alvo)
  return `${alvo?.curto ?? mod.alvo} ${comSinal(mod.delta)}`
}

/** "FOR +20, Dano +30" (o título da pílula); sem mods, vazio. */
export function textoDosMods(mods: readonly ModDoSelo[] | undefined, sistema: SistemaDeRpg | null): string {
  return (mods ?? []).map((mod) => textoDoMod(mod, sistema)).join(', ')
}

/** "Fúria 2 (FOR +20)", "Cego" (sem mods, como `textoDoSelo`): o selo na linha do registro. */
export function textoDoSeloComMods(selo: Pick<SeloDaBatalha, 'nome' | 'turnos' | 'mods'>, sistema: SistemaDeRpg | null): string {
  const mods = textoDosMods(selo.mods, sistema)
  return mods.length === 0 ? textoDoSelo(selo) : `${textoDoSelo(selo)} (${mods})`
}

/** Os mesmos mods, na mesma ordem (ausente = lista vazia). */
export function modsIguais(a: readonly ModDoSelo[] | undefined, b: readonly ModDoSelo[] | undefined): boolean {
  const [x, y] = [a ?? [], b ?? []]
  return x.length === y.length && x.every((mod, i) => mod.alvo === y[i]?.alvo && mod.delta === y[i]?.delta)
}

/**
 * O selo editado pelo mestre: nome, turnos e mods novos (o `total` passa a
 * ser os turnos novos; a marca "já contou nesta rodada" fica). O selo de
 * técnica guarda a cor do Tipo; o posto à mão segue o sinal dos mods novos.
 */
export function seloEditado(antes: SeloDaBatalha, pedido: SeloPedido): SeloDaBatalha {
  const depois: SeloDaBatalha = { ...antes, nome: pedido.nome, turnos: pedido.turnos, total: pedido.turnos }
  delete depois.mods
  delete depois.natureza
  // Nº 3 do levantamento: o espelho da pastilha editado na batalha passa a ser selo dela (os turnos digitados descontam como os de todo selo).
  delete depois.daPastilha
  if (pedido.mods !== undefined && pedido.mods.length > 0) depois.mods = pedido.mods
  const natureza = antes.cartaoId !== undefined ? antes.natureza : naturezaDosMods(pedido.mods)
  if (natureza !== undefined && natureza !== 'condicao') depois.natureza = natureza
  // Rework das condições (D2): outro nome é outra condição. A regra congelada da de antes sai (com as pilhas, a conta do gatilho
  // e a aura dela): o selo passa a valer pelo nome novo, como o selo sem regra ("Atordoado" virou "Fúria": não trava mais).
  if (normalizar(nomeDaCondicaoDoSelo(antes)).trim() !== normalizar(nomeDaCondicaoDoSelo(depois)).trim()) {
    delete depois.regras
    delete depois.pilhas
    delete depois.gatilhoConta
    delete depois.gatilhoFeito
    delete depois.daAura
  }
  return depois
}

/**
 * A cor do selo que o MESTRE põe à mão: só somas = buff, só perdas = debuff;
 * sem mods ou misturado = condição (ausente). O selo de técnica leva a do
 * Tipo (`naturezaDoTipo`).
 */
export function naturezaDosMods(mods: readonly ModDoSelo[] | undefined): NaturezaDoSelo | undefined {
  if (mods === undefined || mods.length === 0) return undefined
  if (mods.every((mod) => mod.delta > 0)) return 'buff'
  if (mods.every((mod) => mod.delta < 0)) return 'debuff'
  return undefined
}

// ---- lerMods: o texto do Efeito vira linhas "atributo / delta" (sugestão editável, nunca aplicada escondida) ----

/** Entre o número e o alvo: "+20 de Força", "+3 na reação", "+8 em reação", "+20 pontos de Força". */
const LIGA_DO_ALVO = String.raw`(?: pontos?)? (?:(?:de|em|na|no|nos|nas|a|ao|do|da) )?`
/** Número inteiro sem porcentagem logo depois ("+20%" e "+1,5" não são mod). */
const INTEIRO = String.raw`(\d+)(?![.,]\d)(?! ?%)`
/** "ganha", "ganhando", "recebe", "aumenta", "soma", "perde", "reduz", "diminui", "tira". */
const VERBO = '(ganh|receb|aument|soma|adicion|perd|reduz|diminu|tira|subtra)'
const VERBO_QUE_TIRA = /^(?:perd|reduz|diminu|tira|subtra)/

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** O alvo como o texto (normalizado) o escreve e o id dele: nome, abreviação ou id do atributo; "dano"; "reação" ou "dado de reação". */
interface AlvosDoTexto {
  padrao: string
  idDe: (escrito: string) => string | null
}

function alvosDoTexto(sistema: SistemaDeRpg): AlvosDoTexto {
  const porEscrita = new Map<string, string>()
  for (const atributo of sistema.atributos) {
    for (const escrita of [atributo.nome, atributo.abreviacao, atributo.id]) {
      const normal = normalizar(escrita)
      if (normal.length > 0 && !porEscrita.has(normal)) porEscrita.set(normal, atributo.id)
    }
  }
  // O mais comprido primeiro: "forca" antes de "for".
  const escritas = [...porEscrita.keys()].sort((a, b) => b.length - a.length).map(escaparRegex)
  const padrao = ['(?:(?:o |no |do )?dado de )?reac(?:ao|oes)', 'danos?', ...escritas].join('|')
  return {
    padrao,
    idDe: (escrito) => (/reac/.test(escrito) ? ALVO_DA_REACAO : /^danos?$/.test(escrito) ? ALVO_DO_DANO : (porEscrita.get(escrito) ?? null)),
  }
}

interface ModAchado {
  inicio: number
  fim: number
  mod: ModDoSelo
}

/** Um mod achado, se o número cabe no teto e o alvo existe. */
function achado(alvos: AlvosDoTexto, inicio: number, fim: number, escrito: string, numero: string, negativo: boolean): ModAchado | null {
  const alvo = alvos.idDe(escrito)
  const valor = Number.parseInt(numero, 10)
  if (alvo === null || !(valor > 0) || valor > DANO_MAX) return null
  return { inicio, fim, mod: { alvo, delta: negativo ? -valor : valor } }
}

/** Todas as ocorrências de `regex` (com /g) em `texto`. */
function ocorrencias(regex: RegExp, texto: string): RegExpExecArray[] {
  const lista: RegExpExecArray[] = []
  for (let achou = regex.exec(texto); achou !== null; achou = regex.exec(texto)) lista.push(achou)
  return lista
}

/** "+20 de Força", "-15 de Agilidade", "+3 na reação", "+30 de dano". Depois de atributo, número ou ")" é conta ("Força + 45 de dano"): não é mod. */
function comSinalAntes(normal: string, alvos: AlvosDoTexto): ModAchado[] {
  const conta = new RegExp(String.raw`(?:\d|\)|\b(?:${alvos.padrao}))$`)
  const regex = new RegExp(String.raw`([+-]) ?${INTEIRO}${LIGA_DO_ALVO}\b(${alvos.padrao})\b`, 'g')
  return ocorrencias(regex, normal).flatMap((m) => {
    const [, sinal = '+', numero = '', escrito = ''] = m
    if (conta.test(normal.slice(0, m.index).trimEnd())) return []
    return achado(alvos, m.index, m.index + m[0].length, escrito, numero, sinal === '-') ?? []
  })
}

/** "perde 15 de Agilidade", "ganhando 10 de força". "Recebe 40 de dano" é tomar dano, não mod. */
function comVerbo(normal: string, alvos: AlvosDoTexto): ModAchado[] {
  const regex = new RegExp(String.raw`\b${VERBO}\w* (?:(?:mais|menos|ate|em) )?${INTEIRO}${LIGA_DO_ALVO}\b(${alvos.padrao})\b`, 'g')
  return ocorrencias(regex, normal).flatMap((m) => {
    const [, verbo = '', numero = '', escrito = ''] = m
    if (verbo === 'receb' && alvos.idDe(escrito) === ALVO_DO_DANO) return []
    return achado(alvos, m.index, m.index + m[0].length, escrito, numero, VERBO_QUE_TIRA.test(verbo)) ?? []
  })
}

/** "FOR +20", "Agilidade: -15": o sinal colado no número. Seguido de outro alvo ("FOR +20 de dano") é conta. */
function comAlvoAntes(normal: string, alvos: AlvosDoTexto): ModAchado[] {
  const regex = new RegExp(String.raw`\b(${alvos.padrao}):? ?([+-])${INTEIRO}(?! ?(?:(?:de|em|na|no) )?\b(?:${alvos.padrao})\b)`, 'g')
  return ocorrencias(regex, normal).flatMap((m) => {
    const [, escrito = '', sinal = '+', numero = ''] = m
    return achado(alvos, m.index, m.index + m[0].length, escrito, numero, sinal === '-') ?? []
  })
}

/** "reduz a Agilidade em 10", "aumenta o dano em 30". */
function comAlvoNoMeio(normal: string, alvos: AlvosDoTexto): ModAchado[] {
  const regex = new RegExp(String.raw`\b(aument|reduz|diminu|soma)\w* (?:(?:o|a|os|as|sua|seu|suas|seus) )?\b(${alvos.padrao})\b em ${INTEIRO}`, 'g')
  return ocorrencias(regex, normal).flatMap((m) => {
    const [, verbo = '', escrito = '', numero = ''] = m
    return achado(alvos, m.index, m.index + m[0].length, escrito, numero, VERBO_QUE_TIRA.test(verbo)) ?? []
  })
}

/**
 * Os mods que um texto sugere, na ordem do texto, um por alvo (o primeiro),
 * até `MODS_POR_SELO_MAX`. Atributo pelo nome ou pela abreviação do sistema
 * (sem acento nem caixa).
 * Ex. (aceite, seção 4c): "Ganha +20 de Força por 2 turnos" = [forca +20];
 * "O alvo perde 15 de Agilidade durante 3 rodadas" = [agilidade -15]; "+3 na
 * reação" = [reacao +3]; "FOR +20" = [forca +20]; "+30 de dano" = [dano
 * +30]; "Causa 40 de dano" = [] (é dano, não mod). Porcentagem, fração e
 * recurso (SP, HP) ficam de fora. A duração é de `lerDuracao`.
 */
export function lerMods(texto: string, sistema: SistemaDeRpg): ModDoSelo[] {
  const normal = normalizar(texto)
  if (normal.length === 0) return []
  const alvos = alvosDoTexto(sistema)
  const todos = [...comSinalAntes(normal, alvos), ...comVerbo(normal, alvos), ...comAlvoAntes(normal, alvos), ...comAlvoNoMeio(normal, alvos)].sort((a, b) => a.inicio - b.inicio)
  // O mesmo trecho lido por duas regras conta uma vez só (a que começa antes).
  // Um alvo uma vez só: tabela de níveis ("Nível 1: + 10 de dano / Nível 2: + 20...") não vira soma.
  const mods: ModDoSelo[] = []
  let fim = -1
  for (const item of todos) {
    if (item.inicio < fim || mods.some((mod) => mod.alvo === item.mod.alvo)) continue
    mods.push(item.mod)
    fim = item.fim
  }
  return mods.slice(0, MODS_POR_SELO_MAX)
}

/**
 * Buff/Debuff: o selo sugerido com mods. Mods do primeiro campo (Efeito,
 * Descrição) que tem algum; turnos e nome de `seloDaTecnica` ("por N
 * turnos"); sem duração, até tirar com o nome da palavra-chave ou da técnica.
 * Sempre há selo: o Buff sem número ainda marca quem o recebeu.
 */
export function seloComMods(cartao: CartaoDaFicha, sistema: SistemaDeRpg): SeloPedido {
  const textos = CAMPOS_DO_SELO.map((campo) => cartao.campos[campo] ?? '')
  const comMods = textos.find((texto) => lerMods(texto, sistema).length > 0) ?? textos[0] ?? ''
  const mods = lerMods(comMods, sistema)
  const duracao = seloDaTecnica(cartao)
  const selo: SeloPedido = duracao ?? { nome: nomeDoSelo(normalizar(comMods), cartao.nome), turnos: null }
  return mods.length === 0 ? selo : { ...selo, mods }
}
