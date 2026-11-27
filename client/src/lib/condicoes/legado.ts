import type { CondicaoPropria, RegraDaCondicao } from '../../types/map'
import type { EscopoDoAlcance } from '../batalha/alcance/condicoes'
import { ALVO_DA_REACAO } from '../batalha/combate'
import type { AlcanceDoSelo, DuracaoDoSelo, Efeito, ModDaPeca, PorTurnoDoSelo, RegraDoSelo } from '../batalha/mecanica/modelo'
import { nomeDoAtributoDaPeca, type ModDaForma, type PecaTransformacao } from '../batalha/mecanica/pecas'
import { CONDICAO_NOME_MAX, CORES_DE_CONDICAO, limparNomeDeCondicao, SIMBOLO_ORDEM, type RascunhoDeCondicao } from '../condicoesProprias'
import type { CondicaoNaFicha, DuracaoDaPeca, GatilhoDaCondicao } from '../itens/modelo'
import type { PecaDoItem } from '../itens/pecasDoItem'
import type { CondicaoDoCatalogo } from './catalogo'
import { condicaoDaFabrica, IDS_DE_HOJE } from './fabrica'
import { ehIdDeAtributo } from './leitura'
import {
  ATRIBUTOS_DA_CONDICAO_MAX,
  chaveDaCondicao,
  PECAS_DA_CONDICAO_MAX,
  PORCENTO_DO_DANO_MAX,
  PORCENTO_DO_DANO_MIN,
  PORCENTO_MAX,
  PRAZO_PADRAO,
  TIPO_PADRAO_DA_CONDICAO,
  TURNOS_DO_PRAZO_MAX,
  VALOR_DA_VEZ_MAX,
  VALOR_DO_ATRIBUTO_MAX,
  type BloqueioDaCondicao,
  type PecaDaCondicao,
  type PecaDaCondicaoDa,
  type PrazoDaCondicao,
  type TipoDaCondicao,
} from './modelo'
import { pecasDaRegraDeAntes } from './montadaDaAntiga'
import { ATRIBUTO_DA_CA, ATRIBUTO_DO_ALCANCE } from './traducao'

/**
 * O NÚMERO DE ANTES DE CADA LUGAR, EM PEÇAS (rework das condições, docs/design/condicoes-rework/PLANO.md
 * D4, etapa E2). Antes do rework, quem punha a condição podia levar números próprios: o selo da técnica
 * (v1 a v4: `mods`, `regra`, `porTurno`, `alcance`, e o `gatilho` do item), o `n` e o `gatilho` da peça
 * do item e da condição posta na ficha, os `fadigaMods` da forma, e a `regra`, o `n` e o `gatilho` da
 * criada. Eles continuam valendo como estão (o motor lê "por campo, o próprio vence o da condição"); a
 * tela os mostra como "Regra própria (de antes)", com:
 *  - "Virar condição nova": o número de antes vira peça (`legadoDo...`), junto com as peças da condição
 *    que o lugar nomeia, campo a campo (`pecasComOProprio`), e abre o editor já preenchido
 *    (`rascunhoDoLegado`);
 *  - "Usar só a condição": o lugar sem os números próprios (`...SoComACondicao`).
 * Todo número de antes vira peça ou uma linha de "Confira" (o que a condição não sabe guardar: fórmula,
 * número acima do teto, alcance só de um grupo, o 5º atributo).
 *
 * Puro: nada grava; a mesma entrada dá o mesmo resultado; o lugar sem número próprio volta `null` (o
 * legado) ou a MESMA referência (o "só com a condição").
 *
 * API pública: `LegadoDaCondicao`, `SeloDosEfeitos`, `PecaDoItemQuePoe`, `PecasComOProprio`,
 * `RascunhoDoLegado`, `temRegraPropriaNoSelo`, `legadoDoSelo`, `legadoDaPecaDoItem`,
 * `legadoDaCondicaoNaFicha`, `legadoDaFadiga`, `legadoDaCriada`, `seloSoComACondicao`,
 * `pecaDoItemSoComACondicao`, `condicaoNaFichaSoComACondicao`, `pecasComOProprio`, `nomesQueImpedem`,
 * `rascunhoDoLegado`.
 */

/** O selo dos Efeitos (técnica v1 a v4, e o "Ao acertar" e o "Ao usar" do item, que se guardam como ele). */
export type SeloDosEfeitos = Extract<Efeito, { tipo: 'selo' }>

/** A peça do item que põe uma condição (`PecaDoItem`, lib/itens/pecasDoItem.ts). */
export type PecaDoItemQuePoe = Extract<PecaDoItem, { tipo: 'condicao' }>

/**
 * O que o número de antes de um lugar vira: as peças, o prazo e o tipo quando o lugar os diz (o selo diz
 * a duração e a natureza), e as linhas de "Confira" do que não coube numa peça.
 */
export interface LegadoDaCondicao {
  pecas: PecaDaCondicao[]
  prazo?: PrazoDaCondicao
  tipo?: TipoDaCondicao
  confira: string[]
}

/** O que a conversão vai juntando. */
interface Montagem {
  pecas: PecaDaCondicao[]
  confira: string[]
}

function novaMontagem(): Montagem {
  return { pecas: [], confira: [] }
}

/** O nome do alvo de um número do selo na frase do "Confira". */
function rotuloDoAlvo(alvo: string): string {
  if (alvo === ALVO_DA_REACAO) return 'Reação'
  if (alvo === ATRIBUTO_DO_ALCANCE) return 'Alcance'
  return nomeDoAtributoDaPeca(alvo)
}

/** O atributo da peça para o alvo do número do selo: a reação é a CA das peças (D10); o dano e o id do sistema passam iguais. */
function atributoDoAlvo(alvo: string): string {
  return alvo === ALVO_DA_REACAO ? ATRIBUTO_DA_CA : alvo
}

/** O número no teto da condição; acima dele, fica no teto e o "Confira" diz quanto era. */
function noTeto(montagem: Montagem, valor: number, teto: number, rotulo: string): number {
  if (valor <= teto) return valor
  montagem.confira.push(`${rotulo} ${valor} passava do teto da condição (${teto}): ficou ${teto}. Confira.`)
  return teto
}

/** Põe a peça Muda atributo no teto de 4 por condição: a 5ª vira "Confira". */
function porAtributo(montagem: Montagem, peca: PecaDaCondicaoDa<'atributo'>, rotulo: string): void {
  if (montagem.pecas.filter((ja) => ja.tipo === 'atributo').length >= ATRIBUTOS_DA_CONDICAO_MAX) {
    montagem.confira.push(`${rotulo}: a condição guarda até ${ATRIBUTOS_DA_CONDICAO_MAX} números de atributo, e este ficou de fora. Confira.`)
    return
  }
  montagem.pecas.push(peca)
}

/** Um número fixo de atributo (positivo soma, negativo tira); 0 não faz nada e não vira peça. */
function porNumeroDeAtributo(montagem: Montagem, alvo: string, valor: number): void {
  const rotulo = rotuloDoAlvo(alvo)
  if (!Number.isInteger(valor)) {
    montagem.confira.push(`${rotulo} ${valor}: a condição guarda só número inteiro. Confira.`)
    return
  }
  if (valor === 0) return
  const atr = atributoDoAlvo(alvo)
  if (!ehIdDeAtributo(atr)) {
    montagem.confira.push(`O número "${alvo}" não é de um atributo que a condição conheça. Confira.`)
    return
  }
  const v = noTeto(montagem, Math.abs(valor), VALOR_DO_ATRIBUTO_MAX, rotulo)
  porAtributo(montagem, { tipo: 'atributo', atr, faz: valor < 0 ? 'tira' : 'soma', v, conta: 'fixo', ritmo: 'umaVez' }, rotulo)
}

/** Os números do selo ("Força +20", Dano, Reação): Muda atributo de uma vez. A fórmula não tem onde morar. */
function pecasDosMods(montagem: Montagem, mods: readonly ModDaPeca[]): void {
  for (const mod of mods) {
    if ('formula' in mod.delta) {
      montagem.confira.push(`${rotuloDoAlvo(mod.alvo)} pela fórmula "${mod.delta.formula}": a condição guarda só número fixo. Confira.`)
      continue
    }
    porNumeroDeAtributo(montagem, mod.alvo, mod.delta.fixo)
  }
}

/** Para quem o alcance valia, na frase do "Confira". */
const ESCOPO_NA_FRASE: Readonly<Record<Exclude<EscopoDoAlcance, 'tudo'>, string>> = {
  armas: 'para as armas',
  habilidades: 'para as habilidades',
  itens: 'para os itens',
}

/** O alcance do selo: Muda atributo no Alcance (soma ou tira casas; o teto é "fica no máximo em"). */
function pecaDoAlcance(montagem: Montagem, alcance: AlcanceDoSelo): void {
  const rotulo = rotuloDoAlvo(ATRIBUTO_DO_ALCANCE)
  if (alcance.vale !== 'tudo') montagem.confira.push(`O alcance valia só ${ESCOPO_NA_FRASE[alcance.vale]}; na condição, vale para tudo. Confira.`)
  if (!Number.isInteger(alcance.n) || alcance.n === 0) return
  const v = noTeto(montagem, Math.abs(alcance.n), VALOR_DO_ATRIBUTO_MAX, rotulo)
  const faz = alcance.mexe === 'teto' ? 'maximo' : alcance.n < 0 ? 'tira' : 'soma'
  porAtributo(montagem, { tipo: 'atributo', atr: ATRIBUTO_DO_ALCANCE, faz, v, conta: 'fixo', ritmo: 'umaVez' }, rotulo)
}

/**
 * O "por vez" do selo: tirar HP é no começo, direto na vida (o lembrete Aplicar / pular de hoje); tirar SP
 * é no fim, com quem usou ganhando (o dreno das Chamas Celestes); regenerar HP ou SP é no fim.
 */
function pecaDoPorTurno(montagem: Montagem, porTurno: PorTurnoDoSelo): void {
  const da = porTurno.sinal === 'da'
  const recurso = porTurno.recurso === 'hp' ? 'vida' : 'sp'
  const rotulo = `${da ? 'Ganha' : 'Perde'} ${recurso === 'vida' ? 'vida' : 'SP'} por vez`
  const fixo = porTurno.quanto.fixo
  if (!Number.isInteger(fixo) || fixo < 0) {
    montagem.confira.push(`${rotulo} ${fixo}: a condição guarda só número inteiro. Confira.`)
    return
  }
  const v = noTeto(montagem, fixo, VALOR_DA_VEZ_MAX, rotulo)
  if (!da && recurso === 'vida') {
    montagem.pecas.push({ tipo: 'vez', quando: 'comeco', faz: 'tira', v, conta: 'fixo', recurso, direto: true })
    return
  }
  const peca: PecaDaCondicaoDa<'vez'> = { tipo: 'vez', quando: 'fim', faz: da ? 'da' : 'tira', v, conta: 'fixo', recurso }
  const paraQuemUsa = porTurno.paraQuemUsa ?? 0
  if (!da && paraQuemUsa > 0) {
    peca.rouba = true
    if (paraQuemUsa !== v) montagem.confira.push(`Quem usou ganhava ${paraQuemUsa} de SP por vez; a peça dá a quem pôs o mesmo que tira (${v}). Confira.`)
  }
  montagem.pecas.push(peca)
}

/** O dano e a cura recebidos, em % (−20 = toma 20% a menos), no teto das peças. */
function porcentoNoTeto(montagem: Montagem, valor: number, rotulo: string): number | undefined {
  if (!Number.isInteger(valor) || valor === 0) return undefined
  const dentro = Math.min(PORCENTO_DO_DANO_MAX, Math.max(PORCENTO_DO_DANO_MIN, valor))
  if (dentro !== valor) montagem.confira.push(`${rotulo} ${valor}% passava do teto da condição: ficou ${dentro}%. Confira.`)
  return dentro
}

/**
 * A regra do selo: travar = perde a vez E não reage (D3: hoje são um só); tirar a Esquiva ou o Contra =
 * não pode desviar (o Aéreo de sempre tira os dois); reagir com desvantagem; o dano e a cura recebidos.
 */
function pecasDaRegraDoSelo(montagem: Montagem, regra: RegraDoSelo): void {
  const itens: Partial<Record<BloqueioDaCondicao, true>> = {}
  if (regra.trava === true) {
    itens.perdeVez = true
    itens.naoReage = true
  }
  const saidas = regra.tiraSaidas ?? []
  if (saidas.length > 0) {
    itens.naoDesvia = true
    if (!saidas.includes('esquiva') || !saidas.includes('contra')) {
      montagem.confira.push(`O selo tirava só ${saidas.includes('esquiva') ? 'a Esquiva' : 'o Contra-ataque'}; o bloqueio "não pode desviar" tira os dois. Confira.`)
    }
  }
  if (regra.reageComDesvantagem === true) itens.reageDesv = true
  if (Object.keys(itens).length > 0) montagem.pecas.push({ tipo: 'bloqueio', itens })
  const recV = regra.danoRecebido === undefined ? undefined : porcentoNoTeto(montagem, regra.danoRecebido, 'Dano recebido')
  const curaV = regra.curaRecebida === undefined ? undefined : porcentoNoTeto(montagem, regra.curaRecebida, 'Cura recebida')
  if (recV !== undefined || curaV !== undefined) montagem.pecas.push({ tipo: 'danoCura', ...(recV === undefined ? {} : { recV }), ...(curaV === undefined ? {} : { curaV }) })
}

/** Os turnos no prazo da condição (de 1 a 20); fora disso, o mais perto, com "Confira". */
function turnosNoTeto(montagem: Montagem, turnos: number): number {
  if (Number.isInteger(turnos) && turnos >= 1 && turnos <= TURNOS_DO_PRAZO_MAX) return turnos
  const dentro = Number.isFinite(turnos) ? Math.min(TURNOS_DO_PRAZO_MAX, Math.max(1, Math.round(turnos))) : TURNOS_DO_PRAZO_MAX
  montagem.confira.push(`O prazo de ${turnos} turnos não cabe na condição (de 1 a ${TURNOS_DO_PRAZO_MAX}): ficou ${dentro}. Confira.`)
  return dentro
}

/** A duração do selo como prazo: N turnos, até tirarem ou até o próximo golpe (a redoma), renovando como hoje. */
function prazoDaDuracao(montagem: Montagem, duracao: DuracaoDoSelo): PrazoDaCondicao {
  if (duracao === 'ateTirar') return { modo: 'ateTirar', deNovo: 'renova' }
  if (duracao === 'proximoGolpe') return { modo: 'proximoGolpe', deNovo: 'renova' }
  return { modo: 'turnos', n: turnosNoTeto(montagem, duracao), deNovo: 'renova' }
}

/** A duração da peça do item como prazo: N turnos, ou a batalha toda ("até o fim da batalha"). */
function prazoDaPeca(montagem: Montagem, duracao: DuracaoDaPeca): PrazoDaCondicao {
  return duracao === 'fim' ? { modo: 'batalha', deNovo: 'renova' } : { modo: 'turnos', n: turnosNoTeto(montagem, duracao), deNovo: 'renova' }
}

/**
 * O `n` de antes da peça do item e da condição posta na ficha: o que ele faz vem da regra da condição
 * que o lugar nomeia, como o editor do item e a ficha decidem hoje (`editorDoItem.ts`, `naFicha.ts`):
 * `vida` = tira N de vida no começo, direto; `cura` = corta N% da cura. O 0 também vale (a ficha que só
 * marcava, `conversao.ts`): vira a peça com 0, que no "Virar condição nova" apaga o efeito da condição.
 */
function pecaDoNumeroDeAntes(montagem: Montagem, n: number, regra: RegraDaCondicao | null, nome: string): void {
  if (!Number.isInteger(n) || n < 0) {
    montagem.confira.push(`O número ${n} de ${nome}: a condição guarda só número inteiro. Confira.`)
    return
  }
  if (regra === 'vida') {
    montagem.pecas.push({ tipo: 'vez', quando: 'comeco', faz: 'tira', v: noTeto(montagem, n, VALOR_DA_VEZ_MAX, 'Perde vida por vez'), conta: 'fixo', recurso: 'vida', direto: true })
    return
  }
  if (regra === 'cura') {
    // `0 - n`, e não `-n`: o corte 0 sai 0, e não −0 (o mesmo cuidado de `montadaDaAntiga.ts`).
    montagem.pecas.push({ tipo: 'danoCura', curaV: 0 - noTeto(montagem, n, PORCENTO_MAX, 'Cura cortada %') })
    return
  }
  montagem.confira.push(`O número ${n} de ${nome} não diz o que faz (a condição só narra). Confira.`)
}

function pecaDoGatilho(gatilho: GatilhoDaCondicao): PecaDaCondicao {
  return { tipo: 'gatilho', gatilho }
}

// ─── Cada lugar ────────────────────────────────────────────────────────────

/** O selo traz número próprio (o que a tela chama "Regra própria (de antes)")? A duração, a natureza, o teste e o "em quem" são de quem põe, e não contam. */
export function temRegraPropriaNoSelo(selo: SeloDosEfeitos): boolean {
  return (selo.mods !== undefined && selo.mods.length > 0) || selo.regra !== undefined || selo.porTurno !== undefined || selo.alcance !== undefined || selo.gatilho !== undefined
}

/** O selo da técnica (v1 a v4) e do item: os números próprios em peças, a duração como prazo e a natureza como tipo. `null` = sem número próprio. */
export function legadoDoSelo(selo: SeloDosEfeitos): LegadoDaCondicao | null {
  if (!temRegraPropriaNoSelo(selo)) return null
  const montagem = novaMontagem()
  if (selo.porTurno !== undefined) pecaDoPorTurno(montagem, selo.porTurno)
  if (selo.mods !== undefined) pecasDosMods(montagem, selo.mods)
  if (selo.alcance !== undefined) pecaDoAlcance(montagem, selo.alcance)
  if (selo.regra !== undefined) pecasDaRegraDoSelo(montagem, selo.regra)
  if (selo.gatilho !== undefined) montagem.pecas.push(pecaDoGatilho(selo.gatilho))
  const legado: LegadoDaCondicao = { pecas: montagem.pecas, prazo: prazoDaDuracao(montagem, selo.duracao), confira: montagem.confira }
  if (selo.natureza !== undefined) legado.tipo = selo.natureza === 'buff' ? 'positiva' : 'negativa'
  return legado
}

/**
 * A peça Condição do item: o `n` (pela regra da condição que ela nomeia, `regra`; `null` = condição que
 * o catálogo não tem) e o gatilho dela. `null` = sem número próprio. O tipo fica com a condição que ela
 * nomeia: a peça do item não diz se é positiva (o "Ao usar" pode pôr o Fortalecido em quem usa).
 */
export function legadoDaPecaDoItem(peca: PecaDoItemQuePoe, regra: RegraDaCondicao | null): LegadoDaCondicao | null {
  if (peca.n === undefined && peca.gatilho === undefined) return null
  const montagem = novaMontagem()
  if (peca.n !== undefined) pecaDoNumeroDeAntes(montagem, peca.n, regra, peca.nome)
  if (peca.gatilho !== undefined) montagem.pecas.push(pecaDoGatilho(peca.gatilho))
  return { pecas: montagem.pecas, prazo: prazoDaPeca(montagem, peca.duracao), confira: montagem.confira }
}

/**
 * A condição posta na ficha: o `n` próprio (pela `regra` da condição do catálogo; `null` = apagada) e o
 * gatilho da peça que a pôs. O prazo dela é o que falta, de quem pôs: não vira prazo. `null` = sem número próprio.
 */
export function legadoDaCondicaoNaFicha(posta: CondicaoNaFicha, regra: RegraDaCondicao | null, nome: string): LegadoDaCondicao | null {
  if (posta.n === undefined && posta.gatilho === undefined) return null
  const montagem = novaMontagem()
  if (posta.n !== undefined) pecaDoNumeroDeAntes(montagem, posta.n, regra, nome)
  if (posta.gatilho !== undefined) montagem.pecas.push(pecaDoGatilho(posta.gatilho))
  return { pecas: montagem.pecas, confira: montagem.confira }
}

/** O que a Fadiga da forma tira, em peças (o negativo tira, o positivo soma). */
function pecasDaFadiga(montagem: Montagem, mods: readonly ModDaForma[]): void {
  for (const mod of mods) porNumeroDeAtributo(montagem, mod.atributo, mod.valor)
}

/** Duas listas de peças iguais campo a campo (as peças se montam sempre na mesma ordem de chaves). */
function mesmasPecas(a: readonly PecaDaCondicao[], b: readonly PecaDaCondicao[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * A Fadiga da forma (`fadigaMods`, `fadigaTurnos`): em peças, com o prazo dos turnos e "nada muda" se
 * ganhar de novo, como a de fábrica. `null` = forma sem Fadiga, ou com os mesmos números da de fábrica
 * (aí não há regra própria: os turnos são só de quem põe).
 */
export function legadoDaFadiga(forma: Pick<PecaTransformacao, 'fadiga' | 'fadigaTurnos' | 'fadigaMods'>): LegadoDaCondicao | null {
  if (!forma.fadiga) return null
  const montagem = novaMontagem()
  pecasDaFadiga(montagem, forma.fadigaMods)
  const deFabrica = condicaoDaFabrica('fadiga')
  if (deFabrica !== null && montagem.confira.length === 0 && mesmasPecas(montagem.pecas, deFabrica.pecas)) return null
  return { pecas: montagem.pecas, prazo: { modo: 'turnos', n: turnosNoTeto(montagem, forma.fadigaTurnos), deNovo: 'nada' }, tipo: 'negativa', confira: montagem.confira }
}

/** A criada de antes das peças (`regra`, `n`, `gatilho`): as peças que `montadaDaAntiga` monta. `null` = já tem peças, ou só narra. */
export function legadoDaCriada(propria: CondicaoPropria): LegadoDaCondicao | null {
  if (propria.pecas !== undefined) return null
  const pecas = pecasDaRegraDeAntes(propria)
  return pecas.length === 0 ? null : { pecas, confira: [] }
}

// ─── "Usar só a condição" ──────────────────────────────────────────────────

/** O selo sem os números próprios (fica o nome, a duração, a natureza, o teste e o "em quem"). Sem número próprio: o MESMO selo. */
export function seloSoComACondicao(selo: SeloDosEfeitos): SeloDosEfeitos {
  if (!temRegraPropriaNoSelo(selo)) return selo
  const { mods: _mods, regra: _regra, porTurno: _porTurno, alcance: _alcance, gatilho: _gatilho, ...soDeQuemPoe } = selo
  return soDeQuemPoe
}

/** A peça do item sem o `n` e o gatilho próprios. Sem eles: a MESMA peça. */
export function pecaDoItemSoComACondicao(peca: PecaDoItemQuePoe): PecaDoItemQuePoe {
  if (peca.n === undefined && peca.gatilho === undefined) return peca
  const { n: _n, gatilho: _gatilho, ...soDeQuemPoe } = peca
  return soDeQuemPoe
}

/** A condição na ficha sem o `n` e o gatilho próprios (e a conta do gatilho, que vai junto). Sem eles: a MESMA. */
export function condicaoNaFichaSoComACondicao(posta: CondicaoNaFicha): CondicaoNaFicha {
  if (posta.n === undefined && posta.gatilho === undefined && posta.gatilhoConta === undefined && posta.gatilhoFeito === undefined) return posta
  const { n: _n, gatilho: _gatilho, gatilhoConta: _conta, gatilhoFeito: _feito, ...soDeQuemPos } = posta
  return soDeQuemPos
}

// ─── "Virar condição nova" ─────────────────────────────────────────────────

/** A vaga de uma peça: o próprio vence a da condição na mesma vaga (um campo do selo: o por vez, o mod de um atributo, o alcance, o gatilho). */
function vagaDaPeca(peca: PecaDaCondicao): string | null {
  if (peca.tipo === 'vez') return `vez:${peca.quando}:${peca.recurso}:${peca.faz}`
  if (peca.tipo === 'atributo') {
    if (peca.atr === ATRIBUTO_DO_ALCANCE) return 'alcance'
    return peca.faz === 'tira' || peca.faz === 'soma' ? `mod:${peca.atr}` : null
  }
  return peca.tipo === 'gatilho' ? 'gatilho' : null
}

type CampoDoDanoCura = 'recV' | 'cauV' | 'curaV' | 'cddV'
const CAMPOS_DO_DANO_CURA: readonly CampoDoDanoCura[] = ['recV', 'cauV', 'curaV', 'cddV']

/** O campo do Dano e cura vale para qualquer dano? O `recV` de um tipo só (o Congelado: Impacto +50) é outro campo. */
function campoDeQualquerTipo(peca: PecaDaCondicaoDa<'danoCura'>, campo: CampoDoDanoCura): boolean {
  return campo !== 'recV' || peca.recTipo === undefined || peca.recTipo === 'qualquer'
}

/** A peça Dano e cura sem os campos que o próprio troca; `null` = não sobrou nada. */
function danoCuraSemOsCampos(peca: PecaDaCondicaoDa<'danoCura'>, trocados: ReadonlySet<CampoDoDanoCura>): PecaDaCondicaoDa<'danoCura'> | null {
  const sobra: PecaDaCondicaoDa<'danoCura'> = { tipo: 'danoCura' }
  for (const campo of CAMPOS_DO_DANO_CURA) {
    const valor = peca[campo]
    if (valor === undefined || (trocados.has(campo) && campoDeQualquerTipo(peca, campo))) continue
    sobra[campo] = valor
  }
  if (sobra.recV !== undefined && peca.recTipo !== undefined) sobra.recTipo = peca.recTipo
  return CAMPOS_DO_DANO_CURA.some((campo) => sobra[campo] !== undefined) ? sobra : null
}

/** A peça própria que não faz nada (o 0 de antes): troca o campo da condição, mas não entra na lista. */
function semEfeito(peca: PecaDaCondicao): boolean {
  if (peca.tipo === 'vez') return peca.v === 0
  if (peca.tipo === 'danoCura') return CAMPOS_DO_DANO_CURA.every((campo) => peca[campo] === undefined || peca[campo] === 0)
  return false
}

/** As peças juntas, e o que não coube nos tetos da condição. */
export interface PecasComOProprio {
  pecas: PecaDaCondicao[]
  confira: string[]
}

/**
 * As peças da condição com o número de antes por cima, campo a campo (D4: "o próprio vence o da
 * condição e o resto vem dela"; a Fadiga da forma não soma duas vezes): a peça própria troca a da
 * condição na mesma vaga; no Dano e cura, troca só os campos que traz; os bloqueios se somam; o resto
 * da condição fica. O 0 próprio apaga o campo da condição. No teto de 10 peças e 4 atributos.
 */
export function pecasComOProprio(daCondicao: readonly PecaDaCondicao[], proprias: readonly PecaDaCondicao[]): PecasComOProprio {
  const vagasProprias = new Set<string>()
  const camposProprios = new Set<CampoDoDanoCura>()
  const bloqueiosProprios: Partial<Record<BloqueioDaCondicao, true>> = {}
  for (const peca of proprias) {
    const vaga = vagaDaPeca(peca)
    if (vaga !== null) vagasProprias.add(vaga)
    if (peca.tipo === 'danoCura') for (const campo of CAMPOS_DO_DANO_CURA) if (peca[campo] !== undefined && campoDeQualquerTipo(peca, campo)) camposProprios.add(campo)
    if (peca.tipo === 'bloqueio') Object.assign(bloqueiosProprios, peca.itens)
  }
  const juntas: PecaDaCondicao[] = []
  let bloqueioJunto = false
  for (const peca of daCondicao) {
    const vaga = vagaDaPeca(peca)
    if (vaga !== null && vagasProprias.has(vaga)) continue
    if (peca.tipo === 'danoCura') {
      const sobra = danoCuraSemOsCampos(peca, camposProprios)
      if (sobra !== null) juntas.push(sobra)
      continue
    }
    if (peca.tipo === 'bloqueio' && !bloqueioJunto) {
      bloqueioJunto = true
      juntas.push({ tipo: 'bloqueio', itens: { ...peca.itens, ...bloqueiosProprios } })
      continue
    }
    juntas.push(peca)
  }
  for (const peca of proprias) {
    if (semEfeito(peca) || (peca.tipo === 'bloqueio' && bloqueioJunto)) continue
    juntas.push(peca)
  }
  return noTetoDasPecas(juntas)
}

/** As peças no teto da condição (10, e 4 Muda atributo): a que passa sai, com "Confira". */
function noTetoDasPecas(pecas: readonly PecaDaCondicao[]): PecasComOProprio {
  const cabem: PecaDaCondicao[] = []
  const confira: string[] = []
  let atributos = 0
  for (const peca of pecas) {
    if (peca.tipo === 'atributo' && atributos >= ATRIBUTOS_DA_CONDICAO_MAX) {
      confira.push(`${rotuloDoAlvo(peca.atr)}: a condição guarda até ${ATRIBUTOS_DA_CONDICAO_MAX} números de atributo, e este ficou de fora. Confira.`)
      continue
    }
    if (cabem.length >= PECAS_DA_CONDICAO_MAX) {
      confira.push(`A condição guarda até ${PECAS_DA_CONDICAO_MAX} peças: uma ficou de fora. Confira.`)
      continue
    }
    if (peca.tipo === 'atributo') atributos += 1
    cabem.push(peca)
  }
  return { pecas: cabem, confira }
}

/**
 * Os nomes que uma condição nova não pode ter (o aviso que impede salvar, `avisosDe` em
 * `frasesDaCondicao.ts`): as criadas da lista (menos `menosId`) e as 10 de fábrica de hoje.
 */
export function nomesQueImpedem(criadas: readonly CondicaoPropria[], menosId?: string): string[] {
  const deHoje = IDS_DE_HOJE.flatMap((id) => {
    const condicao = condicaoDaFabrica(id)
    return condicao === null ? [] : [condicao.nome]
  })
  return [...criadas.filter((propria) => propria.id !== menosId).map((propria) => propria.nome), ...deHoje]
}

/** O nome no teto que não bate com nenhum dos `ocupados` (pela chave): o próprio, ou com " 2", " 3"... no fim. */
function nomeLivre(nome: string, ocupados: readonly string[]): string {
  const chaves = new Set(ocupados.map(chaveDaCondicao))
  const limpo = limparNomeDeCondicao(nome)
  if (limpo !== '' && !chaves.has(chaveDaCondicao(limpo))) return limpo
  const letras = Array.from(limpo === '' ? 'Condição nova' : limpo)
  for (let numero = 2; numero < 100; numero += 1) {
    const sufixo = ` ${numero}`
    const candidato = limparNomeDeCondicao(`${letras.slice(0, CONDICAO_NOME_MAX - sufixo.length).join('').trimEnd()}${sufixo}`)
    if (!chaves.has(chaveDaCondicao(candidato))) return candidato
  }
  return limpo
}

/** A pastilha de partida: a da condição que o lugar nomeia, ou a primeira cor e o primeiro desenho da biblioteca. */
function pastilhaDe(base: CondicaoDoCatalogo | null): Pick<RascunhoDeCondicao, 'cor' | 'simbolo' | 'texto' | 'desenho'> {
  const propria = base === null ? null : base.pastilha.tipo === 'propria' ? base.pastilha.condicao : condicaoDaFabrica(base.id)
  if (propria === null) return { cor: CORES_DE_CONDICAO[0].valor, simbolo: SIMBOLO_ORDEM[0] }
  return {
    cor: propria.cor,
    simbolo: propria.simbolo,
    ...(propria.texto === undefined ? {} : { texto: propria.texto }),
    ...(propria.desenho === undefined ? {} : { desenho: propria.desenho }),
  }
}

/** O rascunho para o editor, e o que o mestre precisa conferir (o que não coube em peça). */
export interface RascunhoDoLegado {
  rascunho: RascunhoDeCondicao
  confira: string[]
}

/**
 * "Virar condição nova" (D4): o rascunho do editor já preenchido com a condição que o lugar nomeia
 * (`base`: a pastilha, o tipo, as peças, o prazo e as saídas dela; `null` = nome que o catálogo não tem)
 * e o número de antes por cima, campo a campo. O nome sugerido é `nome` (o do lugar) se estiver livre;
 * senão, com um número no fim (`ocupados`: `nomesQueImpedem`). Nada grava: quem salva é o editor.
 */
export function rascunhoDoLegado(legado: LegadoDaCondicao, base: CondicaoDoCatalogo | null, nome: string, ocupados: readonly string[]): RascunhoDoLegado {
  const juntas = pecasComOProprio(base === null ? [] : base.montada.pecas, legado.pecas)
  const prazo = legado.prazo ?? (base === null ? PRAZO_PADRAO : base.montada.prazo)
  const rascunho: RascunhoDeCondicao = {
    nome: nomeLivre(nome, ocupados),
    ...pastilhaDe(base),
    tipo: legado.tipo ?? (base === null ? TIPO_PADRAO_DA_CONDICAO : base.montada.tipo),
    pecas: juntas.pecas,
    prazo,
    saidas: base === null ? [] : [...base.montada.saidas],
  }
  return { rascunho, confira: [...legado.confira, ...juntas.confira] }
}
