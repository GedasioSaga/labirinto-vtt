import type { AberturaDoObjeto, ArmadilhaDoObjeto, ConteudoDoObjeto, ItemNoConteudo, Prop, TipoDeArmadilha, TipoMobilia } from '../types/map'
import { ITEM_QUANTIDADE_MAX, readPinItem, type ItemParaDar } from './items'
import { pegadaDePartidaEmCasas } from './mobilia'

/**
 * CONTEÚDO DE BAÚ, CAIXA E BARRIL (Fase C do pedido de 15/11/2026). O mestre
 * põe itens do Acervo, moedas e uma armadilha; o jogador encosta, joga o
 * minigame do tipo do objeto na tela dele e, ao vencer, leva o que há dentro.
 * O baú fica no mapa, aberto; a caixa e o barril viram destroços: o barril, o
 * barril quebrado, e a caixa, a caixa quebrada (o mesmo objeto arrebentado,
 * 16/11/2026), no mesmo centro, com os mesmos materiais e o tamanho na
 * proporção do catálogo.
 *
 * Regras daqui (puras, sem store nem rede):
 * - O mestre liga o minigame por objeto ("Minigame para o jogador", 16/11/2026,
 *   substitui o "todo baú, caixa e barril se abre" de antes): desligado, o toque
 *   do jogador não abre nada. O objeto novo nasce desligado; o de antes do
 *   interruptor, com algo dentro, vem ligado (`minigameLigado`).
 * - O conteúdo NUNCA vai ao jogador: o recorte leva só `abrivel`
 *   (`abrivelParaJogador`), e o desfecho só depois da vitória.
 * - Os itens são a cópia do item do Acervo do momento em que o mestre os pôs
 *   (`itemParaDar`, com o `itemId`): o mapa não depende do Acervo deste
 *   computador para entregar, e a mochila recebe pela porta da Fase 1.
 */

/** Os móveis que guardam conteúdo; o minigame vem do tipo. */
export type MobiliaComConteudo = 'bau' | 'caixa' | 'barril'
export const MOBILIAS_COM_CONTEUDO: readonly MobiliaComConteudo[] = ['bau', 'caixa', 'barril']
/** O que se quebra no minigame (o baú só se abre). */
type MobiliaQueQuebra = Exclude<MobiliaComConteudo, 'bau'>
/** Em que móvel do catálogo cada um vira quando quebra. */
export const DESTROCOS_DO_OBJETO: Readonly<Record<MobiliaQueQuebra, TipoMobilia>> = { caixa: 'caixaQuebrada', barril: 'barrilQuebrado' }
/**
 * Os móveis que podem ser destroços de um objeto com conteúdo: os de hoje e os destroços de madeira, em que
 * a caixa e o barril viravam antes de 16/11/2026 (o mapa antigo repõe pelo `quebradoDe`, como sempre).
 */
const MOBILIAS_DOS_DESTROCOS: readonly TipoMobilia[] = ['destrocosDeMadeira', 'barrilQuebrado', 'caixaQuebrada']
/** Os tamanhos dos destroços em px de mundo, em centésimos (sem a sujeira de 35 / 0,7 = 50,00000000000001). */
const CENTESIMOS = 100

/** Tetos dos números do mestre (a tela e a leitura do disco usam os mesmos). */
export const MOEDAS_NO_CONTEUDO_MAX = 999_999
export const ITENS_NO_CONTEUDO_MAX = 40
export const DANO_DA_ARMADILHA_MAX = 999
export const TURNOS_DA_ARMADILHA_MAX = 20
export const POR_VEZ_DA_ARMADILHA_MAX = 99

export const NOME_DO_OBJETO: Readonly<Record<MobiliaComConteudo, string>> = { bau: 'Baú', caixa: 'Caixa', barril: 'Barril' }
export const NOME_DA_ARMADILHA: Readonly<Record<TipoDeArmadilha, string>> = { cobra: 'Cobra', aranha: 'Aranha' }
/** O nome do minigame de cada objeto, como a ficha diz ("Minigame: Abrir o baú."). */
export const MINIGAME_DO_OBJETO: Readonly<Record<MobiliaComConteudo, string>> = { bau: 'Abrir o baú', caixa: 'Arrombar a caixa', barril: 'Quebrar o barril' }

/**
 * Os padrões aprovados pelo mestre (15/11/2026): a cobra tira 8 PV na hora e
 * põe Envenenado por 3 turnos, 4 PV em cada; a aranha tira 5 PV e põe Lento
 * por 2 turnos (anda metade do passo).
 */
export const ARMADILHA_PADRAO: Readonly<Record<TipoDeArmadilha, Readonly<ArmadilhaDoObjeto>>> = {
  cobra: { tipo: 'cobra', dano: 8, efeito: 'Envenenado', turnos: 3, porVez: 4 },
  aranha: { tipo: 'aranha', dano: 5, efeito: 'Lento', turnos: 2, porVez: 0 },
}

/** Cópia nova do padrão (nunca a constante). */
export function armadilhaPadrao(tipo: TipoDeArmadilha): ArmadilhaDoObjeto {
  return { ...ARMADILHA_PADRAO[tipo] }
}

/** A armadilha difere do padrão do tipo dela (o "Voltar ao padrão" aparece). */
export function armadilhaMudouDoPadrao(armadilha: ArmadilhaDoObjeto): boolean {
  const padrao = ARMADILHA_PADRAO[armadilha.tipo]
  return armadilha.dano !== padrao.dano || armadilha.turnos !== padrao.turnos || armadilha.porVez !== padrao.porVez || armadilha.efeito !== padrao.efeito
}

export function conteudoVazio(): ConteudoDoObjeto {
  return { itens: [], moedas: 0, armadilha: null }
}

export function ehMobiliaComConteudo(tipo: unknown): tipo is MobiliaComConteudo {
  return tipo === 'bau' || tipo === 'caixa' || tipo === 'barril'
}

/** Os destroços em que a caixa ou o barril podem ter virado (os de hoje e os de antes). */
function ehMobiliaDeDestrocos(tipo: Prop['mobilia']): boolean {
  return MOBILIAS_DOS_DESTROCOS.some((destrocos) => destrocos === tipo)
}

/**
 * O tipo do objeto que guarda conteúdo: o baú, a caixa e o barril, e os
 * destroços que ERAM caixa ou barril (o tipo de antes). `null` = não guarda.
 */
export function mobiliaDoConteudo(prop: Pick<Prop, 'mobilia' | 'conteudo'>): MobiliaComConteudo | null {
  if (ehMobiliaComConteudo(prop.mobilia)) return prop.mobilia
  const quebradoDe = prop.conteudo?.aberto?.quebradoDe
  return ehMobiliaDeDestrocos(prop.mobilia) && quebradoDe !== undefined ? quebradoDe : null
}

/** O conteúdo do objeto; ausente = vazio. Objeto que não guarda: `null`. */
export function conteudoDe(prop: Pick<Prop, 'mobilia' | 'conteudo'>): ConteudoDoObjeto | null {
  if (mobiliaDoConteudo(prop) === null) return null
  return prop.conteudo ?? conteudoVazio()
}

/** Há algo dentro: item, moeda ou armadilha. */
function temAlgoDentro(conteudo: ConteudoDoObjeto): boolean {
  return conteudo.itens.length > 0 || conteudo.moedas > 0 || conteudo.armadilha !== null
}

/**
 * MINIGAME PARA O JOGADOR (16/11/2026): gravado, vale o do mestre. Ausente, o
 * objeto é de antes do interruptor: com algo dentro, ligado (quem já preparou
 * não perde o jogo); vazio ou sem conteúdo, desligado (o objeto novo nasce
 * assim). Encher um objeto novo sem tocar no interruptor também o liga (o
 * interruptor da ficha mostra na hora); desligado de propósito, fica gravado.
 */
export function minigameLigado(conteudo: ConteudoDoObjeto | undefined): boolean {
  if (conteudo === undefined) return false
  return conteudo.minigame ?? temAlgoDentro(conteudo)
}

/** Quantos itens, somando as quantidades. */
export function totalDeItens(conteudo: Pick<ConteudoDoObjeto, 'itens'>): number {
  return conteudo.itens.reduce((soma, { quantidade }) => soma + quantidade, 0)
}

/** O resumo da ficha e da lista ("3 itens, 35 moedas, Cobra"; "Vazio"). */
export function resumoDoConteudo(conteudo: ConteudoDoObjeto): string {
  const partes: string[] = []
  const itens = totalDeItens(conteudo)
  if (itens > 0) partes.push(itens === 1 ? '1 item' : `${itens} itens`)
  if (conteudo.moedas > 0) partes.push(conteudo.moedas === 1 ? '1 moeda' : `${conteudo.moedas} moedas`)
  if (conteudo.armadilha !== null) partes.push(NOME_DA_ARMADILHA[conteudo.armadilha.tipo])
  const resumo = partes.length === 0 ? 'Vazio' : partes.join(', ')
  return conteudo.aberto === undefined ? resumo : `Aberto · ${resumo}`
}

/** O que a pessoa leva, numa frase ("Poção de cura ×2, Antídoto e 35 moedas"); `''` = nada. */
export function oQueLevou(conteudo: Pick<ConteudoDoObjeto, 'itens' | 'moedas'>): string {
  const partes = conteudo.itens.map(({ item, quantidade }) => (quantidade > 1 ? `${item.nome} ×${quantidade}` : item.nome))
  if (conteudo.moedas > 0) partes.push(conteudo.moedas === 1 ? '1 moeda' : `${conteudo.moedas} moedas`)
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
}

/** A linha da armadilha, igual para o mestre e para o jogador ("A cobra picou: -8 PV. Envenenado por 3 turnos."). */
export function fraseDaArmadilha(armadilha: ArmadilhaDoObjeto): string {
  const bicho = armadilha.tipo === 'cobra' ? 'A cobra' : 'A aranha'
  const turnos = armadilha.turnos === 1 ? '1 turno' : `${armadilha.turnos} turnos`
  const efeito = armadilha.turnos > 0 && armadilha.efeito !== '' ? ` ${armadilha.efeito} por ${turnos}.` : ''
  return `${bicho} picou: -${armadilha.dano} PV.${efeito}`
}

// ------------------------------------------------------------------ leitura do disco

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function inteiroEntre(valor: unknown, min: number, max: number, padrao: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return padrao
  return Math.min(max, Math.max(min, Math.round(valor)))
}

function lerArmadilha(valor: unknown): ArmadilhaDoObjeto | null {
  if (!isRecord(valor) || (valor.tipo !== 'cobra' && valor.tipo !== 'aranha')) return null
  const padrao = ARMADILHA_PADRAO[valor.tipo]
  const efeito = typeof valor.efeito === 'string' && valor.efeito.trim() !== '' ? valor.efeito.trim().slice(0, 40) : padrao.efeito
  return {
    tipo: valor.tipo,
    dano: inteiroEntre(valor.dano, 0, DANO_DA_ARMADILHA_MAX, padrao.dano),
    efeito,
    turnos: inteiroEntre(valor.turnos, 0, TURNOS_DA_ARMADILHA_MAX, padrao.turnos),
    porVez: inteiroEntre(valor.porVez, 0, POR_VEZ_DA_ARMADILHA_MAX, padrao.porVez),
  }
}

/** O item do Acervo como fica no conteúdo: a mesma porta do item no chão (`readPinItem`), sem o "Pega direto". */
function lerItemNoConteudo(valor: unknown): ItemNoConteudo | null {
  if (!isRecord(valor)) return null
  const lido = readPinItem(valor.item)
  if (lido === undefined) return null
  const { livre: _soDoChao, quantidade: _daVaga, ...item } = lido
  return { item, quantidade: inteiroEntre(valor.quantidade, 1, ITEM_QUANTIDADE_MAX, 1) }
}

function lerAbertura(valor: unknown): AberturaDoObjeto | undefined {
  if (!isRecord(valor)) return undefined
  const por = typeof valor.por === 'string' ? valor.por.trim().slice(0, 64) : ''
  const em = typeof valor.em === 'number' && Number.isFinite(valor.em) ? valor.em : 0
  const abertura: AberturaDoObjeto = { por, em }
  if (valor.quebradoDe !== 'caixa' && valor.quebradoDe !== 'barril') return abertura
  abertura.quebradoDe = valor.quebradoDe
  const pegada = valor.pegadaDeAntes
  if (isRecord(pegada) && ehTamanho(pegada.width) && ehTamanho(pegada.height)) abertura.pegadaDeAntes = { width: pegada.width, height: pegada.height }
  return abertura
}

function ehTamanho(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0
}

/**
 * `Prop.conteudo` como vem do disco, já sabendo o tipo do objeto. Torto cai
 * campo a campo no vazio; objeto que não guarda conteúdo (ou os destroços sem
 * o tipo de antes) perde o campo. `undefined` = sem conteúdo.
 */
export function lerConteudoDoArquivo(valor: unknown, mobilia: Prop['mobilia']): ConteudoDoObjeto | undefined {
  if (!isRecord(valor)) return undefined
  const aberto = lerAbertura(valor.aberto)
  const tipo = mobiliaDoConteudo({ mobilia, conteudo: aberto === undefined ? undefined : { ...conteudoVazio(), aberto } })
  if (tipo === null) return undefined
  // A caixa que ainda é caixa não está quebrada: o "quebradoDe" (e o tamanho de antes) só vale nos destroços.
  if (aberto !== undefined && ehMobiliaComConteudo(mobilia)) {
    delete aberto.quebradoDe
    delete aberto.pegadaDeAntes
  }
  const itens = Array.isArray(valor.itens) ? valor.itens.flatMap((item) => lerItemNoConteudo(item) ?? []).slice(0, ITENS_NO_CONTEUDO_MAX) : []
  const conteudo: ConteudoDoObjeto = {
    itens,
    moedas: inteiroEntre(valor.moedas, 0, MOEDAS_NO_CONTEUDO_MAX, 0),
    armadilha: lerArmadilha(valor.armadilha),
  }
  if (aberto !== undefined) conteudo.aberto = aberto
  // O interruptor só entra gravado (booleano); ausente segue a regra do de antes (`minigameLigado`).
  if (typeof valor.minigame === 'boolean') conteudo.minigame = valor.minigame
  return conteudo
}

/**
 * O objeto lido do disco: `abrivel` (campo de fio) sai sempre, e o
 * `conteudo` passa por `lerConteudoDoArquivo`. Objeto sem os dois volta o mesmo.
 */
export function propComConteudoDoArquivo(prop: Prop): Prop {
  if (!('conteudo' in prop) && !('abrivel' in prop)) return prop
  const conteudo = lerConteudoDoArquivo(prop.conteudo, prop.mobilia)
  const lido: Prop = { ...prop }
  delete lido.conteudo
  delete lido.abrivel
  if (conteudo !== undefined) lido.conteudo = conteudo
  return lido
}

// ------------------------------------------------------------------ mesa

/**
 * O que o recorte do jogador leva do objeto: `'fechado'` (minigame ligado e ainda por abrir), `'aberto'`
 * (já aberto ou quebrado, o que todos veem no mapa) ou nada (desligado e fechado: nem o interruptor vai).
 */
export function abrivelParaJogador(prop: Pick<Prop, 'mobilia' | 'conteudo'>): 'fechado' | 'aberto' | undefined {
  const tipo = mobiliaDoConteudo(prop)
  if (tipo === null) return undefined
  if (prop.conteudo?.aberto !== undefined) return 'aberto'
  return minigameLigado(prop.conteudo) ? 'fechado' : undefined
}

/** O tipo do objeto ainda fechado, ligado ou não. `null` = aberto, quebrado ou não guarda. */
function tipoDoObjetoFechado(prop: Pick<Prop, 'mobilia' | 'conteudo'>): MobiliaComConteudo | null {
  return ehMobiliaComConteudo(prop.mobilia) && prop.conteudo?.aberto === undefined ? prop.mobilia : null
}

/**
 * O minigame que o objeto pede AGORA: o do tipo, enquanto fechado e com o minigame ligado pelo mestre.
 * `null` = desligado, aberto, quebrado ou não guarda. É a regra do host para o `objeto.abrir` e o `objeto.venceu`.
 */
export function jogoDoObjetoFechado(prop: Pick<Prop, 'mobilia' | 'conteudo'>): MobiliaComConteudo | null {
  return minigameLigado(prop.conteudo) ? tipoDoObjetoFechado(prop) : null
}

/**
 * O tamanho dos destroços: o do objeto na proporção das pegadas de partida (o barril de 0,7 casa vira o
 * barril quebrado de 1 casa; a caixa de 0,8, a caixa quebrada de 1,2; o objeto esticado pelo mestre, os
 * destroços esticados igual). `x`/`y` são o centro do objeto, então o centro fica onde estava.
 */
function pegadaDosDestrocos(prop: Pick<Prop, 'width' | 'height'>, tipo: MobiliaQueQuebra, destrocos: TipoMobilia): Pick<Prop, 'width' | 'height'> {
  const inteiro = pegadaDePartidaEmCasas(tipo)
  const quebrado = pegadaDePartidaEmCasas(destrocos)
  const medir = (lado: number, de: number, para: number): number => Math.round(((lado * para) / de) * CENTESIMOS) / CENTESIMOS
  return { width: medir(prop.width, inteiro.largura, quebrado.largura), height: medir(prop.height, inteiro.altura, quebrado.altura) }
}

/**
 * O objeto depois de aberto: marca quem e quando; a caixa e o barril viram destroços (`DESTROCOS_DO_OBJETO`),
 * no mesmo centro, com o mesmo giro e as mesmas cores (os materiais: os lugares são os mesmos). O tamanho de
 * antes fica guardado para o "Fechar e repor".
 */
export function objetoAberto(prop: Prop, por: string, em: number): Prop {
  // Sem o interruptor aqui: o host já conferiu a vitória (`jogoDoObjetoFechado`); a abertura só registra.
  const tipo = tipoDoObjetoFechado(prop)
  if (tipo === null) return prop
  const aberto: AberturaDoObjeto = { por, em }
  const conteudo: ConteudoDoObjeto = { ...(prop.conteudo ?? conteudoVazio()), aberto }
  if (tipo === 'bau') return { ...prop, conteudo }
  const destrocos = DESTROCOS_DO_OBJETO[tipo]
  aberto.quebradoDe = tipo
  aberto.pegadaDeAntes = { width: prop.width, height: prop.height }
  return { ...prop, mobilia: destrocos, ...pegadaDosDestrocos(prop, tipo, destrocos), conteudo }
}

/**
 * "Fechar e repor": o mesmo conteúdo de novo, fechado; os destroços voltam a ser a caixa ou o barril, com o
 * tamanho de antes (os destroços de antes de 16/11/2026 não o guardam: já tinham o tamanho do objeto).
 */
export function objetoReposto(prop: Prop): Prop {
  const conteudo = prop.conteudo
  if (conteudo?.aberto === undefined) return prop
  const { aberto, ...fechado } = conteudo
  if (aberto.quebradoDe === undefined) return { ...prop, conteudo: fechado }
  const pegada = aberto.pegadaDeAntes === undefined ? {} : { width: aberto.pegadaDeAntes.width, height: aberto.pegadaDeAntes.height }
  return { ...prop, mobilia: aberto.quebradoDe, ...pegada, conteudo: fechado }
}

/** O item do conteúdo pronto para a mochila (`darNaFicha`). */
export function itemParaAMochila(item: ItemNoConteudo['item']): ItemParaDar {
  return { ...item }
}
