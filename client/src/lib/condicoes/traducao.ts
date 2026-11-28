import {
  ALVO_DA_REACAO,
  MODS_POR_SELO_MAX,
  type AuraDoSelo,
  type ContraDoSelo,
  type DanoDeUmTipo,
  type ModDoSelo,
  type QuedaDoSelo,
  type RegraDoSeloNaBatalha,
  type RegrasDoSelo,
  type SeloDoGolpe,
  type ValorNoAtributo,
} from '../batalha/combate'
import { atributoNoMotor } from '../batalha/mecanica/pecas'
import { condicaoDaFabrica } from './fabrica'
import {
  A_PARTIR_DO_TURNO_PADRAO,
  AURA_DESTA_MESMA,
  BLOQUEIOS_DA_CONDICAO,
  MULT_DA_MARCA_MIN,
  PORCENTO_DO_DANO_MAX,
  PORCENTO_DO_DANO_MIN,
  tetoDePilhasDo,
  turnosDoPrazo,
  type BloqueioDaCondicao,
  type CondicaoMontada,
  type EfeitoNaVez,
  type PecaDaCondicaoDa,
  type TipoDoGolpe,
} from './modelo'

/**
 * EXECUTAR É TRADUZIR (rework das condições, PLANO.md D1, E1): a condição montada mais o pedido de quem
 * a põe viram o `SeloDoGolpe` que a batalha já sabe pôr (`criarSelo`, lib/batalha/selos.ts). O que o
 * motor de hoje já lê vai nos campos de hoje; o resto vai congelado em `regras` (`RegrasDoSelo`), e o
 * motor nunca lê a peça crua:
 *  - Efeito na vez: no começo, tira vida fixa direto na vida = `porVez` (o "Aplicar / pular" de hoje);
 *    no fim, dá vida ou SP fixo = `regenera`; no fim, tira SP fixo = `drenaSp` (o que quem pôs ganha
 *    com `rouba`); o resto (ao entrar, % , pelo Escudo, quem pôs ganha vida) = `regras.vez`;
 *  - Muda atributo: de uma vez e fixo = `mods`; em % ou com ritmo = `queda` (a 1ª; as outras em
 *    `regras.quedasAMais`); "fica em" e "no máximo" = `regras.ficaEm` e `regras.noMaximo`; o Alcance =
 *    `alcance`. A Velocidade é a Agilidade e a CA é o mod da reação (D10);
 *  - Bloqueio: "reage com desvantagem" = `regra.reageComDesvantagem`; os outros = `regras.bloqueios`;
 *  - Dano e cura: o recebido de qualquer tipo e a cura = `regra`; o de um tipo, o causado e a cura do
 *    dano = `regras`;
 *  - Marca: os campos da marca do selo (e `regras.esquivaComDesvantagem`);
 *  - Gatilho, Aura, Contra-condição, as saídas, o tipo e o "se ganhar de novo" = `regras`, com os ids
 *    do catálogo já em nomes (D5).
 * As pilhas (D7) multiplicam os números do Efeito na vez e do Muda atributo, nunca as % do Dano e cura.
 * A natureza do selo não se põe: a cor da pílula é a da condição ("condicao", a ausência).
 *
 * Puro: sem store, sem Tauri, sem `lib/batalha/condicoes.ts`.
 *
 * API pública: `PedidoDaCondicao`, `traduzirCondicao`, `alvoNoMotor`, `ATRIBUTO_DA_CA`, `ATRIBUTO_DO_ALCANCE`.
 */

/** O atributo "CA" das peças: no motor, o mod da reação (o sistema não tem CA; D10). */
export const ATRIBUTO_DA_CA = 'ca'
/** O atributo "Alcance" das peças: no selo, a mudança do alcance (`SeloDoGolpe.alcance`), não um mod. */
export const ATRIBUTO_DO_ALCANCE = 'alcance'

/** O que quem põe a condição escolhe e sabe (D6: só qual e por quantos turnos; o resto é da condição). */
export interface PedidoDaCondicao {
  /**
   * Por quantos turnos: ausente = o prazo da condição (os turnos dela, ou até o próximo golpe, até
   * tirarem, a batalha toda); um número = N turnos no lugar do prazo; `null` = até tirarem.
   */
  turnos?: number | null
  /** Com quantas pilhas o selo nasce (ausente = 1); acima do teto do prazo, fica no teto. */
  pilhas?: number
  /** Quem pôs: a Marca "só para quem pôs" guarda este personagem (`SeloDaBatalha.marcaDe`). Sem ele, a marca vale para todos. */
  quemPos?: { personagemId?: string }
  /** O nome do selo; ausente = o nome da condição. */
  nome?: string
  /**
   * O nome de uma condição do catálogo pelo id (a Aura e a Contra-condição apontam ids, D5); `null` = a
   * condição foi apagada (a peça fica de fora do selo). Ausente = só as de fábrica.
   */
  nomeDoId?: (id: string) => string | null
}

type MudancaDoAlcanceDoSelo = NonNullable<SeloDoGolpe['alcance']>

/** O alvo do mod no motor: a CA é a reação; a Velocidade, a Agilidade; o resto passa igual. */
export function alvoNoMotor(atributo: string): string {
  return atributo === ATRIBUTO_DA_CA ? ALVO_DA_REACAO : atributoNoMotor(atributo)
}

function nomePeloId(pedido: PedidoDaCondicao, id: string): string | null {
  if (pedido.nomeDoId !== undefined) return pedido.nomeDoId(id)
  return condicaoDaFabrica(id)?.nome ?? null
}

function entre(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor))
}

/** O que as peças juntam antes de virar selo. */
interface Juntado {
  mods: Map<string, number>
  quedas: QuedaDoSelo[]
  ficaEm: ValorNoAtributo[]
  noMaximo: ValorNoAtributo[]
  alcance?: MudancaDoAlcanceDoSelo
  danoRecebido?: number
  danoPorTipo: Map<TipoDoGolpe, number>
  danoCausado?: number
  curaRecebida?: number
  curaDoDano?: number
  bloqueios: Set<BloqueioDaCondicao>
  reageComDesvantagem: boolean
  porVez?: number
  regenera?: SeloDoGolpe['regenera']
  drenaSp?: SeloDoGolpe['drenaSp']
  vez: EfeitoNaVez[]
}

function somado(antes: number | undefined, mais: number): number {
  return (antes ?? 0) + mais
}

function juntarVez(peca: PecaDaCondicaoDa<'vez'>, pilhas: number, juntado: Juntado): void {
  const { tipo: _tipo, ...efeito } = peca
  const quanto = peca.v * pilhas
  const fixo = peca.conta === 'fixo' && quanto > 0
  if (fixo && peca.quando === 'comeco' && peca.faz === 'tira' && peca.recurso === 'vida' && peca.direto === true && peca.rouba !== true && juntado.porVez === undefined) {
    juntado.porVez = quanto
    return
  }
  if (fixo && peca.quando === 'fim' && peca.faz === 'da' && peca.recurso !== 'escudo' && juntado.regenera === undefined) {
    juntado.regenera = { recurso: peca.recurso === 'vida' ? 'hp' : 'sp', quanto }
    return
  }
  if (fixo && peca.quando === 'fim' && peca.faz === 'tira' && peca.recurso === 'sp' && juntado.drenaSp === undefined) {
    juntado.drenaSp = { quanto, paraQuemUsa: peca.rouba === true ? quanto : 0 }
    return
  }
  juntado.vez.push({ ...efeito, v: quanto })
}

function juntarAlcance(peca: PecaDaCondicaoDa<'atributo'>, pilhas: number, juntado: Juntado): void {
  // Só a 1ª peça no Alcance vale (o selo tem uma mudança só); o aviso do editor conta as outras.
  if (juntado.alcance !== undefined) return
  if (peca.faz === 'fica' || peca.faz === 'maximo') {
    juntado.alcance = { mexe: 'teto', n: peca.v, vale: 'tudo' }
    return
  }
  // O alcance só soma de uma vez e em casas: o ritmo e a % não têm onde morar (o aviso do editor diz).
  if (peca.ritmo !== 'umaVez' || peca.conta !== 'fixo') return
  juntado.alcance = { mexe: 'soma', n: (peca.faz === 'tira' ? -1 : 1) * peca.v * pilhas, vale: 'tudo' }
}

function juntarAtributo(peca: PecaDaCondicaoDa<'atributo'>, pilhas: number, juntado: Juntado): void {
  if (peca.atr === ATRIBUTO_DO_ALCANCE) {
    juntarAlcance(peca, pilhas, juntado)
    return
  }
  const alvo = alvoNoMotor(peca.atr)
  if (peca.faz === 'fica') {
    juntado.ficaEm.push({ alvo, v: peca.v })
    return
  }
  if (peca.faz === 'maximo') {
    juntado.noMaximo.push({ alvo, v: peca.v })
    return
  }
  const delta = (peca.faz === 'tira' ? -1 : 1) * peca.v * pilhas
  if (peca.ritmo === 'umaVez' && peca.conta === 'fixo') {
    juntado.mods.set(alvo, somado(juntado.mods.get(alvo), delta))
    return
  }
  // Em % ou com ritmo: a queda do selo (a mesma da peça Diminui). De uma vez em % = um passo só, já no
  // acerto (`desde` 0), que a store passa a números com o atributo de quem leva (`quedaEmNumeros`).
  const queda: QuedaDoSelo = { passo: [{ alvo, delta }], desde: peca.ritmo === 'umaVez' ? 0 : peca.ritmo === 'cada' ? 1 : (peca.aPartirN ?? A_PARTIR_DO_TURNO_PADRAO) }
  if (peca.ritmo === 'umaVez') queda.vezes = 1
  else if (peca.tetoN !== undefined) queda.teto = peca.tetoN
  if (peca.conta === 'pct') queda.emPorcento = true
  juntado.quedas.push(queda)
}

function juntarDanoCura(peca: PecaDaCondicaoDa<'danoCura'>, juntado: Juntado): void {
  if (peca.recV !== undefined) {
    if (peca.recTipo === undefined || peca.recTipo === 'qualquer') juntado.danoRecebido = somado(juntado.danoRecebido, peca.recV)
    else juntado.danoPorTipo.set(peca.recTipo, somado(juntado.danoPorTipo.get(peca.recTipo), peca.recV))
  }
  if (peca.cauV !== undefined) juntado.danoCausado = somado(juntado.danoCausado, peca.cauV)
  if (peca.curaV !== undefined) juntado.curaRecebida = somado(juntado.curaRecebida, peca.curaV)
  if (peca.cddV !== undefined) juntado.curaDoDano = somado(juntado.curaDoDano, peca.cddV)
}

function juntarBloqueio(peca: PecaDaCondicaoDa<'bloqueio'>, juntado: Juntado): void {
  for (const bloqueio of BLOQUEIOS_DA_CONDICAO) {
    if (peca.itens[bloqueio] !== true) continue
    if (bloqueio === 'reageDesv') juntado.reageComDesvantagem = true
    else juntado.bloqueios.add(bloqueio)
  }
}

/** A regra de hoje do selo (o dano e a cura que quem tem recebe, a reação com desvantagem); `undefined` = nenhuma. */
function regraDoSelo(juntado: Juntado): RegraDoSeloNaBatalha | undefined {
  const regra: RegraDoSeloNaBatalha = {}
  if (juntado.danoRecebido !== undefined && juntado.danoRecebido !== 0) regra.danoRecebido = entre(juntado.danoRecebido, PORCENTO_DO_DANO_MIN, PORCENTO_DO_DANO_MAX)
  if (juntado.curaRecebida !== undefined && juntado.curaRecebida !== 0) regra.curaRecebida = entre(juntado.curaRecebida, PORCENTO_DO_DANO_MIN, PORCENTO_DO_DANO_MAX)
  if (juntado.reageComDesvantagem) regra.reageComDesvantagem = true
  return Object.keys(regra).length === 0 ? undefined : regra
}

/** Os nomes de uma lista de ids, sem os apagados e sem repetir. */
function nomesDosIds(pedido: PedidoDaCondicao, ids: readonly string[]): string[] {
  const nomes: string[] = []
  for (const id of ids) {
    const nome = nomePeloId(pedido, id)
    if (nome !== null && !nomes.includes(nome)) nomes.push(nome)
  }
  return nomes
}

/**
 * O selo da condição para o pedido. As 35 de fábrica e toda criada lida traduzem sem erro: peça que
 * aponta condição apagada fica de fora, número fora do teto do motor fica no teto.
 */
export function traduzirCondicao(condicao: CondicaoMontada, pedido: PedidoDaCondicao = {}): SeloDoGolpe {
  const nome = pedido.nome ?? condicao.nome
  const tetoDePilhas = tetoDePilhasDo(condicao.prazo)
  const pedidas = pedido.pilhas
  const pilhas = pedidas !== undefined && Number.isInteger(pedidas) ? entre(pedidas, 1, tetoDePilhas) : 1
  const turnos = pedido.turnos !== undefined ? pedido.turnos : turnosDoPrazo(condicao.prazo)
  const selo: SeloDoGolpe = { nome, turnos }
  if (pedido.turnos === undefined && condicao.prazo.modo === 'proximoGolpe') selo.saiNoProximoGolpe = true

  const juntado: Juntado = { mods: new Map(), quedas: [], ficaEm: [], noMaximo: [], danoPorTipo: new Map(), bloqueios: new Set(), reageComDesvantagem: false, vez: [] }
  const regras: RegrasDoSelo = { condId: condicao.id, tipo: condicao.tipo, deNovo: condicao.prazo.deNovo }
  if (condicao.prazo.deNovo === 'pilha') regras.tetoDePilhas = tetoDePilhas
  const auras: AuraDoSelo[] = []
  const apaga: string[] = []
  const impede: string[] = []

  for (const peca of condicao.pecas) {
    switch (peca.tipo) {
      case 'vez':
        juntarVez(peca, pilhas, juntado)
        break
      case 'atributo':
        juntarAtributo(peca, pilhas, juntado)
        break
      case 'bloqueio':
        juntarBloqueio(peca, juntado)
        break
      case 'danoCura':
        juntarDanoCura(peca, juntado)
        break
      case 'gatilho':
        // Um gatilho por selo (a conta dele mora no selo): o aviso do editor diz quando há mais de um.
        if (regras.gatilho === undefined) regras.gatilho = peca.gatilho
        break
      case 'marca': {
        if (selo.marca === true) break
        selo.marca = true
        if (peca.mult !== MULT_DA_MARCA_MIN) selo.marcaVezes = peca.mult
        if (!peca.sai) selo.marcaFica = true
        const dono = pedido.quemPos?.personagemId
        if (peca.quem === 'quemPos' && dono !== undefined) selo.marcaDe = dono
        if (peca.desvDesv) regras.esquivaComDesvantagem = true
        break
      }
      case 'aura': {
        const daAura = peca.cond === AURA_DESTA_MESMA ? nome : nomePeloId(pedido, peca.cond)
        if (daAura === null) break
        const aura: AuraDoSelo = { casas: peca.casas, quem: peca.quem, nome: daAura }
        if (peca.espalha === true) aura.espalha = true
        auras.push(aura)
        break
      }
      case 'contra':
        for (const apagada of nomesDosIds(pedido, peca.apaga)) {
          if (!apaga.includes(apagada)) apaga.push(apagada)
          if (peca.impede && !impede.includes(apagada)) impede.push(apagada)
        }
        break
      case 'anula':
        // Pedido de 27/11/2026: uma peça Intangível vale (a primeira); a exceção vai junto.
        if (regras.anula === undefined) regras.anula = peca.exceto === undefined ? {} : { exceto: peca.exceto }
        break
    }
  }

  const mods: ModDoSelo[] = [...juntado.mods].filter(([, delta]) => delta !== 0).map(([alvo, delta]) => ({ alvo, delta }))
  if (mods.length > 0) selo.mods = mods.slice(0, MODS_POR_SELO_MAX)
  const [queda, ...quedasAMais] = juntado.quedas
  if (queda !== undefined) selo.queda = queda
  if (quedasAMais.length > 0) regras.quedasAMais = quedasAMais
  if (juntado.alcance !== undefined) selo.alcance = juntado.alcance
  if (juntado.porVez !== undefined) selo.porVez = juntado.porVez
  if (juntado.regenera !== undefined) selo.regenera = juntado.regenera
  if (juntado.drenaSp !== undefined) selo.drenaSp = juntado.drenaSp
  const regra = regraDoSelo(juntado)
  if (regra !== undefined) selo.regra = regra
  if (pilhas > 1) selo.pilhas = pilhas

  if (juntado.bloqueios.size > 0) regras.bloqueios = [...juntado.bloqueios]
  if (juntado.ficaEm.length > 0) regras.ficaEm = juntado.ficaEm
  if (juntado.noMaximo.length > 0) regras.noMaximo = juntado.noMaximo
  const danoPorTipo: DanoDeUmTipo[] = [...juntado.danoPorTipo].filter(([, porcento]) => porcento !== 0).map(([tipo, porcento]) => ({ tipo, porcento: entre(porcento, PORCENTO_DO_DANO_MIN, PORCENTO_DO_DANO_MAX) }))
  if (danoPorTipo.length > 0) regras.danoPorTipo = danoPorTipo
  if (juntado.danoCausado !== undefined && juntado.danoCausado !== 0) regras.danoCausado = entre(juntado.danoCausado, PORCENTO_DO_DANO_MIN, PORCENTO_DO_DANO_MAX)
  if (juntado.curaDoDano !== undefined && juntado.curaDoDano > 0) regras.curaDoDano = Math.min(juntado.curaDoDano, PORCENTO_DO_DANO_MAX)
  if (juntado.vez.length > 0) regras.vez = juntado.vez
  if (condicao.saidas.length > 0) regras.saidas = condicao.saidas
  if (auras.length > 0) regras.auras = auras
  if (apaga.length > 0) {
    const contra: ContraDoSelo = { apaga, impede }
    regras.contra = contra
  }
  selo.regras = regras
  return selo
}
