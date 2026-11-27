import type { PecasDoEfeito } from '../../types/map'
import {
  PARTES_DO_EQUIPAMENTO,
  TIPOS_DO_ITEM,
  type AlcanceNoItem,
  type ArremessoDoItem,
  type AtaqueDoItem,
  type BalaDoItem,
  type BlocosDoItem,
  type BonusDoEquipamento,
  type CondicaoNaFicha,
  type ConfiraDoItem,
  type EquipamentoDoItem,
  type GolpeDoItem,
  type PenteDaVaga,
  type PenteDoItem,
  type RecargaDoItem,
  type TipoDoItem,
  type UsoDoItem,
} from './modelo'
import { gatilhoLido, TURNOS_DO_GATILHO_MAX } from './pecasDoItem'

/**
 * Os LEITORES do modelo novo do item (PLANO §1.3: são o juiz do disco, do fio e do Worker). Cada um
 * devolve só o que está bom; o torto sai sozinho e o resto do item fica. Nenhum INVENTA campo: o
 * Worker recusa o que o leitor não devolve igual (`jsonIgual`), então quem preenche o que falta é a
 * conversão (`lib/itens/conversao/`), nunca o leitor. Puro, sem importar o leitor da vaga (sem ciclo).
 */

/** Teto das peças guardadas (Ao acertar, Ao usar, o alcance), em letras de JSON: o mesmo da mecânica do cartão. */
const PECAS_MAX = 16_000
const TEXTO_CURTO_MAX = 40
const CONFIRA_TEXTO_MAX = 300
const CONFIRA_ORIGEM_MAX = 120
export const CONFIRA_MAX = 20
export const NOTA_DA_VAGA_MAX = 2000
const NUMERO_MAX = 1_000_000
const ALVOS_MAX = 50
const CAPACIDADE_MAX = 1000
const DIVISOR_MAX = 100
const BONUS_MAX = 12
const ACEITA_MAX = 20
export const CONDICOES_NA_FICHA_MAX = 40
const TURNOS_MAX = 999
const ID_DE_ITEM = /^[A-Za-z0-9_-]{1,80}$/
const ID_CURTO = /^[A-Za-z0-9_:.-]{1,80}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cortado(valor: string, max: number): string {
  if (valor.length <= max) return valor
  const ultima = valor.charCodeAt(max - 1)
  return valor.slice(0, ultima >= 0xd800 && ultima <= 0xdbff ? max - 1 : max)
}

function inteiroEntre(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max ? value : null
}

function textoCurto(value: unknown): string | null {
  return typeof value === 'string' ? cortado(value.trim(), TEXTO_CURTO_MAX) : null
}

/** Um objeto JSON guardado como veio (opaco), no teto; `undefined` = não é objeto, ou passa do teto. */
export function pecasGuardadas(value: unknown): PecasDoEfeito | undefined {
  if (!isRecord(value)) return undefined
  let texto: string
  try {
    texto = JSON.stringify(value)
  } catch {
    return undefined
  }
  if (texto.length > PECAS_MAX) return undefined
  const copia: unknown = JSON.parse(texto)
  return isRecord(copia) ? (copia as PecasDoEfeito) : undefined // saiu de JSON.stringify: todo valor de dentro já é JSON, por construção
}

function alcanceLido(value: unknown): { alcance?: AlcanceNoItem } {
  const alcance = isRecord(value) && typeof value.tipo === 'string' ? pecasGuardadas(value) : undefined
  return alcance === undefined ? {} : { alcance }
}

export function tipoDoItemLido(value: unknown): TipoDoItem | undefined {
  return TIPOS_DO_ITEM.find((tipo) => tipo === value)
}

function recargaLida(value: unknown): RecargaDoItem | undefined {
  if (!isRecord(value)) return undefined
  const acao = textoCurto(value.acao)
  const rodadas = value.rodadas === 0 || value.rodadas === 1 || value.rodadas === 2 ? value.rodadas : null
  return acao === null || rodadas === null ? undefined : { acao, rodadas }
}

function ataqueLido(value: unknown): AtaqueDoItem | undefined {
  if (!isRecord(value)) return undefined
  const dano = inteiroEntre(value.dano, 0, NUMERO_MAX)
  const soma = textoCurto(value.soma)
  const acao = textoCurto(value.acao)
  const alvos = inteiroEntre(value.alvos, 1, ALVOS_MAX)
  if (dano === null || soma === null || acao === null || alvos === null) return undefined
  return { dano, soma, acao, alvos, ...alcanceLido(value.alcance) }
}

function golpeLido(value: unknown): GolpeDoItem | undefined {
  if (!isRecord(value)) return undefined
  const dano = inteiroEntre(value.dano, 0, NUMERO_MAX)
  const soma = textoCurto(value.soma)
  const acao = textoCurto(value.acao)
  if (dano === null || soma === null || acao === null) return undefined
  return { dano, soma, acao, ...alcanceLido(value.alcance) }
}

function penteLido(value: unknown): PenteDoItem | undefined {
  if (!isRecord(value) || !Array.isArray(value.aceita)) return undefined
  const capacidade = inteiroEntre(value.capacidade, 1, CAPACIDADE_MAX)
  if (capacidade === null) return undefined
  const aceita = [...new Set(value.aceita.filter((id): id is string => typeof id === 'string' && ID_DE_ITEM.test(id)))].slice(0, ACEITA_MAX)
  const recarga = recargaLida(value.recarga)
  return { capacidade, aceita, ...(recarga === undefined ? {} : { recarga }) }
}

function arremessoLido(value: unknown): ArremessoDoItem | undefined {
  if (!isRecord(value)) return undefined
  const recarga = recargaLida(value.recarga)
  return { ...(recarga === undefined ? {} : { recarga }), ...(value.volta === true ? { volta: true as const } : {}) }
}

function balaLida(value: unknown): BalaDoItem | undefined {
  if (!isRecord(value)) return undefined
  const modo = value.modo === 'soma' || value.modo === 'troca' || value.modo === 'atributo' ? value.modo : null
  const valor = inteiroEntre(value.valor, -NUMERO_MAX, NUMERO_MAX)
  if (modo === null || valor === null) return undefined
  const atributo = textoCurto(value.atributo)
  const divisor = inteiroEntre(value.divisor, 1, DIVISOR_MAX)
  return { modo, valor, ...(atributo === null || atributo === '' ? {} : { atributo }), ...(divisor === null ? {} : { divisor }), ...(value.perfurante === true ? { perfurante: true as const } : {}) }
}

function usoLido(value: unknown): UsoDoItem | undefined {
  if (!isRecord(value) || !isRecord(value.onde)) return undefined
  const acao = textoCurto(value.acao)
  const { batalha, fora } = value.onde
  if (acao === null || typeof batalha !== 'boolean' || typeof fora !== 'boolean') return undefined
  return { acao, ...alcanceLido(value.alcance), onde: { batalha, fora } }
}

function bonusLido(value: unknown): BonusDoEquipamento | null {
  if (!isRecord(value)) return null
  const campo = value.campo === 'ca' || value.campo === 'escudo' || value.campo === 'vantagem' || value.campo === 'desvantagem' || value.campo === 'atributo' ? value.campo : null
  const n = inteiroEntre(value.n, -NUMERO_MAX, NUMERO_MAX)
  if (campo === null || n === null) return null
  const em = textoCurto(value.em)
  return { campo, n, ...(em === null || em === '' ? {} : { em }) }
}

function equipamentoLido(value: unknown): EquipamentoDoItem | undefined {
  if (!isRecord(value) || !Array.isArray(value.bonus)) return undefined
  const parte = PARTES_DO_EQUIPAMENTO.find((opcao) => opcao === value.parte)
  if (parte === undefined) return undefined
  const bonus = value.bonus.flatMap((bruto) => {
    const lido = bonusLido(bruto)
    return lido === null ? [] : [lido]
  })
  return { parte, bonus: bonus.slice(0, BONUS_MAX) }
}

/** Os blocos de regra do item (ou da `regra` da vaga), cada um só se estiver bom. */
export function blocosDoItemLidos(value: Record<string, unknown>): BlocosDoItem {
  const blocos: BlocosDoItem = {}
  const ataque = ataqueLido(value.ataque)
  if (ataque !== undefined) blocos.ataque = ataque
  const golpe = golpeLido(value.golpe)
  if (golpe !== undefined) blocos.golpe = golpe
  const pente = penteLido(value.pente)
  if (pente !== undefined) blocos.pente = pente
  const arremesso = arremessoLido(value.arremesso)
  if (arremesso !== undefined) blocos.arremesso = arremesso
  const bala = balaLida(value.bala)
  if (bala !== undefined) blocos.bala = bala
  const uso = usoLido(value.uso)
  if (uso !== undefined) blocos.uso = uso
  const equipamento = equipamentoLido(value.equipamento)
  if (equipamento !== undefined) blocos.equipamento = equipamento
  const aoAcertar = pecasGuardadas(value.aoAcertar)
  if (aoAcertar !== undefined) blocos.aoAcertar = aoAcertar
  const aoUsar = pecasGuardadas(value.aoUsar)
  if (aoUsar !== undefined) blocos.aoUsar = aoUsar
  return blocos
}

/** A `regra` da vaga: os blocos; sem nenhum bom, `undefined` (a vaga fica sem o campo). */
export function regraDaVagaLida(value: unknown): BlocosDoItem | undefined {
  if (!isRecord(value)) return undefined
  const blocos = blocosDoItemLidos(value)
  return Object.keys(blocos).length === 0 ? undefined : blocos
}

/** O pente da vaga: id de item e de 1 até a capacidade máxima. Vazio (0) = sem o campo. */
export function penteDaVagaLido(value: unknown): PenteDaVaga | undefined {
  if (!isRecord(value) || typeof value.balaId !== 'string' || !ID_DE_ITEM.test(value.balaId)) return undefined
  const n = inteiroEntre(value.n, 1, CAPACIDADE_MAX)
  return n === null ? undefined : { balaId: value.balaId, n }
}

/** A nota da vaga (o texto que o mestre editou só nela, A4): aparada, no teto; vazia = sem o campo. */
export function notaDaVagaLida(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  return cortado(value, NOTA_DA_VAGA_MAX)
}

/** Os "Confira" do item: texto não vazio, no teto. Lista vazia = sem o campo. */
export function confiraLido(value: unknown): ConfiraDoItem[] | undefined {
  if (!Array.isArray(value)) return undefined
  const lidos: ConfiraDoItem[] = []
  for (const bruto of value) {
    if (!isRecord(bruto) || typeof bruto.texto !== 'string' || bruto.texto.trim() === '') continue
    const confira: ConfiraDoItem = { texto: cortado(bruto.texto.trim(), CONFIRA_TEXTO_MAX) }
    if (typeof bruto.antes === 'string') confira.antes = cortado(bruto.antes, CONFIRA_TEXTO_MAX)
    if (typeof bruto.depois === 'string') confira.depois = cortado(bruto.depois, CONFIRA_TEXTO_MAX)
    if (typeof bruto.origem === 'string' && bruto.origem.trim() !== '') confira.origem = cortado(bruto.origem.trim(), CONFIRA_ORIGEM_MAX)
    lidos.push(confira)
    if (lidos.length >= CONFIRA_MAX) break
  }
  return lidos.length === 0 ? undefined : lidos
}

/** As condições da ficha: id e condId curtos, sem repetir o id, turnos inteiros ou `null`. Lista vazia = sem o campo. */
export function condicoesDaFichaLidas(value: unknown): CondicaoNaFicha[] | undefined {
  if (!Array.isArray(value)) return undefined
  const vistas = new Set<string>()
  const lidas: CondicaoNaFicha[] = []
  for (const bruta of value) {
    if (!isRecord(bruta) || typeof bruta.id !== 'string' || !ID_CURTO.test(bruta.id) || typeof bruta.condId !== 'string' || !ID_CURTO.test(bruta.condId)) continue
    if (vistas.has(bruta.id)) continue
    const turnos = bruta.turnos === null ? null : inteiroEntre(bruta.turnos, 0, TURNOS_MAX)
    if (turnos === null && bruta.turnos !== null) continue
    const condicao: CondicaoNaFicha = { id: bruta.id, condId: bruta.condId, turnos }
    const n = inteiroEntre(bruta.n, -NUMERO_MAX, NUMERO_MAX)
    if (n !== null) condicao.n = n
    if (typeof bruta.origem === 'string' && bruta.origem.trim() !== '') condicao.origem = cortado(bruta.origem.trim(), CONFIRA_ORIGEM_MAX)
    if (bruta.contadoNaCarta === true) condicao.contadoNaCarta = true
    // "Até o fim da batalha" só existe sem turnos contados: com número, vale o número.
    if (bruta.ateOFimDaBatalha === true && turnos === null) condicao.ateOFimDaBatalha = true
    // Pedido de 26/11: o gatilho da peça que a pôs e a conta dele. Sem o campo = sem gatilho próprio.
    const gatilho = gatilhoLido(bruta.gatilho)
    if (gatilho !== undefined) condicao.gatilho = gatilho
    const conta = inteiroEntre(bruta.gatilhoConta, 1, TURNOS_DO_GATILHO_MAX)
    if (conta !== null) condicao.gatilhoConta = conta
    if (bruta.gatilhoFeito === true) condicao.gatilhoFeito = true
    vistas.add(bruta.id)
    lidas.push(condicao)
    if (lidas.length >= CONDICOES_NA_FICHA_MAX) break
  }
  return lidas.length === 0 ? undefined : lidas
}
