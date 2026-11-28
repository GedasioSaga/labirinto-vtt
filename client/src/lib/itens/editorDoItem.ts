import type { ItemDoCatalogo } from '../acervoDeItens'
import { formaDoAlcanceGuardada } from '../batalha/alcanceDoCartao'
import { descreverAlcance, type FormaDoAlcance } from '../batalha/alcance/forma'
import { CURA_REDUZIDA_PADRAO, DANO_DO_SANGRAMENTO, NOME_DA_CURA_REDUZIDA } from '../batalha/condicoes'
import { lerMecanica, VERSAO_GRAVADA, type Efeito, type MecanicaV1 } from '../batalha/mecanica/modelo'
import { guardarMecanica } from '../batalha/mecanica/modelos'
import { pecasDoEfeito } from '../leituraDoItem'
import type { PecasDoEfeito, ValorDasPecas } from '../../types/map'
import { balaDoDano, falaDeCuraReduzida } from './conversao/acervo'
import { normalizado, primeiroNumero, tipoPelaCategoria } from './conversao/comum'
import { fraseDoGatilho } from '../condicoes/fraseDoGatilho'
import { CASAS_DO_ITEM_MAX, danoExtraDobra, ehRegistro, inteiro, NUMERO_DO_ITEM_MAX, pecaDoEfeitoGuardado, pecasDoItemLidas, type DuracaoNoEditor, type PecaDoItem } from './pecasDoItem'
import {
  ROTULO_DO_TIPO,
  rotuloDaDuracao,
  TIPOS_QUE_EMPILHAM,
  TURNOS_DA_PECA,
  type AlcanceNoItem,
  type AtaqueDoItem,
  type BalaDoItem,
  type BlocosDoItem,
  type BonusDoEquipamento,
  type ParteDoEquipamento,
  type RecargaDoItem,
  type TipoDoItem,
} from './modelo'

/**
 * O EDITOR DO ITEM (docs/design/itens-rework/PLANO.md, etapa E2): a parte pura da tela. Os campos
 * pelo tipo, as peças do "Ao acertar" e do "Ao usar" (as mesmas das técnicas, guardadas como a
 * mecânica que `lerMecanica` lê), a frase "O que acontece" e a ponte para os campos antigos, que a
 * batalha e a mochila de hoje ainda leem até a E6 (`categoria`, `municoes`, `tiro`, `efeito`).
 *
 * Trocar o tipo ESCONDE os blocos que não servem e nunca os apaga (`comOTipo`): voltando ao tipo de
 * antes, os números estão lá. Sem store, sem disco.
 */

// ─── As escolhas da tela ────────────────────────────────────────────────────

// A leitura das peças mora em `pecasDoItem.ts` (E6c: sem ciclo de import); quem importa daqui continua igual.
export { CASAS_DO_ITEM_MAX, danoExtraDobra, NUMERO_DO_ITEM_MAX, pecasDoItemLidas, type DuracaoNoEditor, type PecaDoItem }

/** As ações, como o campo Ação do cartão as escreve (o protótipo aprovado). */
export const ACOES_DO_ITEM: readonly string[] = ['Ação Simples', 'Ação Completa', 'Ação Livre']
/** A ação da recarga também pode ser a Reação. */
export const ACOES_DA_RECARGA: readonly string[] = ['Ação Simples', 'Ação Completa', 'Ação Livre', 'Reação']
export const TEMPOS_DA_RECARGA: readonly { rodadas: RecargaDoItem['rodadas']; rotulo: string }[] = [
  { rodadas: 0, rotulo: 'Na hora' },
  { rodadas: 1, rotulo: '1 rodada' },
  { rodadas: 2, rotulo: '2 rodadas' },
]
export const ROTULO_DA_PARTE: Readonly<Record<ParteDoEquipamento, string>> = { corpo: 'Corpo', cabeca: 'Cabeça', maos: 'Mãos', pes: 'Pés', acessorio: 'Acessório' }
const LUGAR_DA_PARTE: Readonly<Record<ParteDoEquipamento, string>> = { corpo: 'no corpo', cabeca: 'na cabeça', maos: 'nas mãos', pes: 'nos pés', acessorio: 'como acessório' }
export const ROTULO_DO_BONUS: Readonly<Record<Exclude<BonusDoEquipamento['campo'], 'atributo'>, string>> = { ca: 'CA', escudo: 'Escudo', vantagem: 'Vantagem', desvantagem: 'Desvantagem' }

/** O exemplo curto de cada tipo, no cartão da escolha do tipo. */
export const EXEMPLO_DO_TIPO: Readonly<Record<TipoDoItem, string>> = {
  corpo: 'Espada, clava, soco-inglês',
  fogo: 'Pistola, rifle, canhão',
  hibrida: 'Lâmina que também atira',
  municao: 'Balas que a arma gasta',
  arremesso: 'Granada, faca, boomerang',
  consumivel: 'Poção, kit, comida',
  equipamento: 'Roupa, armadura, anel',
  outros: 'Chave, mapa, tesouro',
}

/** Os tipos que atacam (têm o bloco `ataque`). */
export const TIPOS_QUE_ATACAM: ReadonlySet<TipoDoItem> = new Set<TipoDoItem>(['corpo', 'fogo', 'hibrida', 'arremesso'])

/** Teto do pente: 99 balas. */
export const PENTE_MAX = 99

// ─── As peças do "Ao acertar" e do "Ao usar" ───────────────────────────────

/** O "Quanto tempo dura" do item e do gatilho: o fim da batalha e de 1 a 10 turnos (antes de 27/11/2026, até 3). */
export const DURACOES_NO_EDITOR: readonly { duracao: DuracaoNoEditor; rotulo: string }[] = (['fim', ...TURNOS_DA_PECA] satisfies DuracaoNoEditor[]).map((duracao) => ({ duracao, rotulo: rotuloDaDuracao(duracao) }))

export type OndeDaPeca = 'acerto' | 'uso'

export const PECAS_DE: Readonly<Record<OndeDaPeca, readonly PecaDoItem['tipo'][]>> = {
  acerto: ['condicao', 'dano', 'empurrar'],
  uso: ['curar', 'tirar', 'condicao'],
}

export const ROTULO_DA_PECA: Readonly<Record<PecaDoItem['tipo'], string>> = {
  condicao: 'Condição (sangrar, queimar...)',
  dano: 'Dano extra',
  empurrar: 'Empurrar',
  curar: 'Curar',
  tirar: 'Tirar condição',
}

/** Teto de peças por bloco (o mesmo dos efeitos da técnica). */
export const PECAS_POR_BLOCO_MAX = 6

/** O que a condição faz, pelo nome (até o catálogo de condições da E4a trazer a `regra`): tira vida, corta a cura ou só se narra. */
export type RegraDaCondicao = 'vida' | 'cura' | 'narra'

const VIDA_DE_PARTIDA = 3

export function regraDaCondicaoPeloNome(nome: string): RegraDaCondicao {
  const chave = normalizado(nome)
  if (chave === normalizado(NOME_DA_CURA_REDUZIDA)) return 'cura'
  if (/^(sangrando|queimando|envenenad[oa])/.test(chave)) return 'vida'
  return 'narra'
}

/** O número de partida da condição: a vida por vez (o Sangrando tira 10) ou o corte da cura em %. */
export function nDePartida(nome: string): number | undefined {
  const regra = regraDaCondicaoPeloNome(nome)
  if (regra === 'cura') return CURA_REDUZIDA_PADRAO
  if (regra === 'vida') return /^sangrando/.test(normalizado(nome)) ? DANO_DO_SANGRAMENTO : VIDA_DE_PARTIDA
  return undefined
}

export function pecaDePartida(tipo: PecaDoItem['tipo'], condicoes: readonly string[]): PecaDoItem {
  switch (tipo) {
    case 'condicao': {
      const nome = condicoes[0] ?? NOME_DA_CURA_REDUZIDA
      const n = nDePartida(nome)
      return { tipo, nome, duracao: 'fim', ...(n === undefined ? {} : { n }) }
    }
    case 'dano':
      return { tipo, valor: 5 }
    case 'empurrar':
      return { tipo, casas: 1 }
    case 'curar':
      return { tipo, fixo: 20 }
    case 'tirar':
      return { tipo, nome: null }
  }
}

function efeitoDaPeca(peca: Exclude<PecaDoItem, { tipo: 'dano' } | { tipo: 'empurrar' }>): Efeito {
  switch (peca.tipo) {
    case 'condicao': {
      const regra = regraDaCondicaoPeloNome(peca.nome)
      const duracao = peca.duracao === 'fim' ? 'ateTirar' : peca.duracao
      // Pedido de 26/11: o "depois de X turnos" vai no selo, depois das outras chaves (sem ele, o selo de antes byte a byte).
      const base: Extract<Efeito, { tipo: 'selo' }> = { tipo: 'selo', nome: peca.nome, duracao, natureza: 'debuff', ...(peca.gatilho === undefined ? {} : { gatilho: peca.gatilho }) }
      if (regra === 'cura' && peca.n !== undefined) return { ...base, regra: { curaRecebida: -Math.min(100, Math.max(1, peca.n)) } }
      if (regra === 'vida' && peca.n !== undefined) return { ...base, porTurno: { recurso: 'hp', quanto: { fixo: peca.n }, direto: true } }
      return base
    }
    case 'curar':
      return { tipo: 'cura', recurso: 'hp', quanto: { fixo: peca.fixo }, emQuem: 'alvo' }
    case 'tirar':
      return { tipo: 'tirarSelos', quais: peca.nome === null ? 'negativos' : { nomes: [peca.nome] } }
  }
}

/** A mecânica de partida do bloco: ação Livre (a ação é a do ataque ou do uso), sem custo, sem teste (o ataque já acertou), num alvo só. */
function mecanicaDePartida(onde: OndeDaPeca): MecanicaV1 {
  return {
    versao: VERSAO_GRAVADA,
    acao: 'livre',
    custos: [],
    limite: {},
    alvo: { quem: onde === 'uso' ? 'escolha' : 'inimigos', forma: { tipo: 'um' } },
    teste: { tipo: 'naoErra' },
    efeitos: [],
  }
}

/** As peças guardadas sem o Empurrar cru (que `lerMecanica` ainda recusa: a mesa só move na E6c). */
function semEmpurroes(guardadas: PecasDoEfeito): PecasDoEfeito {
  const efeitos = guardadas.efeitos
  if (!Array.isArray(efeitos)) return guardadas
  return { ...guardadas, efeitos: efeitos.filter((efeito) => !(ehRegistro(efeito) && efeito.tipo === 'mover')) }
}

/** JSON com as chaves em ordem: dois objetos com o mesmo conteúdo dão o mesmo texto. */
function jsonEstavel(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonEstavel).join(',')}]`
  if (ehRegistro(valor)) {
    return `{${Object.keys(valor)
      .sort()
      .filter((chave) => valor[chave] !== undefined)
      .map((chave) => `${JSON.stringify(chave)}:${jsonEstavel(valor[chave])}`)
      .join(',')}}`
  }
  return JSON.stringify(valor) ?? 'null'
}

function mesmaPeca(guardada: unknown, peca: PecaDoItem): boolean {
  if (peca.tipo === 'dano') return false
  const refeita: unknown = peca.tipo === 'empurrar' ? { tipo: 'mover', modo: 'empurrar', casas: peca.casas } : efeitoDaPeca(peca)
  return jsonEstavel(guardada) === jsonEstavel(refeita)
}

/**
 * DADO SALVO NUNCA SE PERDE: as peças guardadas cabem nesta tela (cada efeito vira uma peça dela e
 * volta igual, e o dano é só o Dano extra)? Senão a tela as mostra só para ler, e o Salvar as deixa
 * como estão (a mecânica de antes de um consumível pode ter peças que este editor não conhece).
 */
export function pecasCabemNaTela(guardadas: PecasDoEfeito | undefined): boolean {
  if (guardadas === undefined) return true
  const dano = guardadas.dano
  if (dano !== undefined) {
    const so = ehRegistro(dano) && ehRegistro(dano.base) && inteiro(dano.base.fixo, 1, NUMERO_DO_ITEM_MAX) !== null
    const resto = { ...(ehRegistro(dano) ? dano : {}), base: undefined }
    if (!so || jsonEstavel(resto) !== jsonEstavel({ multiplicadores: { concentracao: false, surpresa: false } })) return false
  }
  const efeitos = guardadas.efeitos
  if (efeitos === undefined) return true
  if (!Array.isArray(efeitos)) return false
  return efeitos.every((efeito) => {
    const peca = pecaDoEfeitoGuardado(efeito)
    return peca !== null && mesmaPeca(efeito, peca)
  })
}

/**
 * As peças da tela guardadas como a mecânica das técnicas (a que `lerMecanica` lê): a ação Livre
 * (a ação é a do ataque ou do uso), sem custo, sem teste (o ataque já acertou), num alvo só; o
 * Dano extra vai na soma de dano. O Empurrar entra cru, depois das outras peças: a mesa ainda não o
 * executa (E6c). Vazia = `undefined` (o bloco sai).
 */
export function pecasDoItemGuardadas(pecas: readonly PecaDoItem[], onde: OndeDaPeca, antes?: PecasDoEfeito): PecasDoEfeito | undefined {
  if (pecas.length === 0) return undefined
  const efeitos: Efeito[] = []
  const empurroes: { [chave: string]: ValorDasPecas }[] = []
  let danoExtra: number | undefined
  for (const peca of pecas) {
    if (peca.tipo === 'dano') danoExtra = (danoExtra ?? 0) + peca.valor
    else if (peca.tipo === 'empurrar') empurroes.push({ tipo: 'mover', modo: 'empurrar', casas: peca.casas })
    else efeitos.push(efeitoDaPeca(peca))
  }
  // O que a tela não edita (a ação, o alvo, o custo, o "onde vale" da mecânica de antes) fica como estava.
  const lida = antes === undefined ? null : lerMecanica(semEmpurroes(antes))
  const { dano: _danoAntes, ...partida }: MecanicaV1 = lida !== null && lida.tipo === 'pecas' ? lida.mecanica : mecanicaDePartida(onde)
  const mecanica: MecanicaV1 = {
    ...partida,
    ...(danoExtra === undefined ? {} : { dano: { base: { fixo: danoExtra }, multiplicadores: { concentracao: false, surpresa: false } } }),
    efeitos,
  }
  const guardadas = pecasDoEfeito(guardarMecanica(mecanica))
  if (guardadas === null) return undefined
  if (empurroes.length === 0) return guardadas
  const efeitosMontados = Array.isArray(guardadas.efeitos) ? guardadas.efeitos : []
  return { ...guardadas, efeitos: [...efeitosMontados, ...empurroes] }
}

// ─── O alcance ──────────────────────────────────────────────────────────────

/** A forma do alcance como o item a guarda (JSON puro, sem chave vazia). */
export function alcanceGuardado(forma: FormaDoAlcance): AlcanceNoItem {
  switch (forma.tipo) {
    case 'si':
      return { tipo: 'si' }
    case 'frente':
      return { tipo: 'frente', lado: forma.lado }
    case 'alvo':
      return forma.de === undefined ? { tipo: 'alvo', ate: forma.ate } : { tipo: 'alvo', ate: forma.ate, de: forma.de }
    case 'ponto':
    case 'ficha':
      return forma.raio !== undefined ? { tipo: forma.tipo, ate: forma.ate, raio: forma.raio } : { tipo: forma.tipo, ate: forma.ate, lado: forma.lado }
    default:
      return { tipo: forma.tipo, ate: forma.ate }
  }
}

export function alcanceLido(alcance: AlcanceNoItem | undefined): FormaDoAlcance | null {
  return alcance === undefined ? null : formaDoAlcanceGuardada(alcance)
}

// ─── O tipo e os blocos de partida ──────────────────────────────────────────

const ALCANCE_COLADO: AlcanceNoItem = { tipo: 'alvo', ate: 1 }
const ALCANCE_DO_TIRO: AlcanceNoItem = { tipo: 'alvo', ate: 6 }
const ALCANCE_DO_ARREMESSO: AlcanceNoItem = { tipo: 'ponto', ate: 5, raio: 1 }

function ataqueDePartida(tipo: TipoDoItem): AtaqueDoItem {
  if (tipo === 'arremesso') return { dano: 20, soma: '', acao: 'Ação Simples', alvos: 1, alcance: ALCANCE_DO_ARREMESSO }
  if (tipo === 'fogo' || tipo === 'hibrida') return { dano: 20, soma: '', acao: 'Ação Simples', alvos: 1, alcance: ALCANCE_DO_TIRO }
  return { dano: 15, soma: '', acao: 'Ação Simples', alvos: 1, alcance: ALCANCE_COLADO }
}

/** Os blocos que o tipo pede e o item ainda não tem (os que ele já tem ficam como estão). */
function blocosQueFaltam(item: BlocosDoItem & Pick<ItemDoCatalogo, 'municoes'>, tipo: TipoDoItem): BlocosDoItem {
  const faltam: BlocosDoItem = {}
  if (TIPOS_QUE_ATACAM.has(tipo) && item.ataque === undefined) faltam.ataque = ataqueDePartida(tipo)
  if (tipo === 'hibrida' && item.golpe === undefined) faltam.golpe = { dano: 15, soma: '', acao: 'Ação Simples', alcance: ALCANCE_COLADO }
  if ((tipo === 'fogo' || tipo === 'hibrida') && item.pente === undefined) faltam.pente = { capacidade: 6, aceita: [...(item.municoes ?? [])], recarga: { acao: 'Ação Simples', rodadas: 0 } }
  if (tipo === 'arremesso' && item.arremesso === undefined) faltam.arremesso = { recarga: { acao: 'Ação Livre', rodadas: 0 } }
  if (tipo === 'municao' && item.bala === undefined) faltam.bala = { modo: 'soma', valor: 0 }
  if (tipo === 'consumivel' && item.uso === undefined) faltam.uso = { acao: 'Ação Simples', alcance: { tipo: 'si' }, onde: { batalha: true, fora: true } }
  if (tipo === 'equipamento' && item.equipamento === undefined) faltam.equipamento = { parte: 'corpo', bonus: [] }
  return faltam
}

/**
 * O item com outro tipo: os blocos que faltam nascem com valores de partida; os que não servem
 * ficam guardados (só não aparecem). Munição, Arremesso e Consumível empilham sozinhos; saindo
 * deles para um tipo que não empilha, a pilha desliga.
 */
export function comOTipo(item: ItemDoCatalogo, tipo: TipoDoItem): ItemDoCatalogo {
  const antes = item.tipo
  const empilhavel = TIPOS_QUE_EMPILHAM.has(tipo) ? true : antes !== undefined && TIPOS_QUE_EMPILHAM.has(antes) ? false : item.empilhavel
  return { ...item, ...blocosQueFaltam(item, tipo), tipo, empilhavel }
}

// ─── O rascunho ao abrir (o que o item de antes já dizia em texto) ──────────

/** O que o editor preencheu sozinho ao abrir, para a tela dizer de onde veio. */
export interface PreenchidoAoAbrir {
  item: ItemDoCatalogo
  avisos: string[]
}

/** A regra do livro ligada à arma (a entrada `arma` do catálogo com o `acervoId`): só o que o editor lê dela. */
export interface RegraDoLivroLida {
  campos: Readonly<Record<string, string>>
}

/**
 * O rascunho da tela: o item com os blocos do tipo e, quando o item de antes só dizia em texto, as
 * peças montadas. A Bala de Prata que falava de prata ganha "Ao acertar: Cura reduzida 50% até o fim
 * da batalha" (PLANO §2.2); a arma sem `ataque` ganha o dano e a ação da regra do livro. Nada se
 * grava até o Salvar.
 */
export function itemParaOEditor(item: ItemDoCatalogo, regraDoLivro: RegraDoLivroLida | undefined): PreenchidoAoAbrir {
  const avisos: string[] = []
  // O item novo criado dentro de uma categoria ("Munição") já abre com o tipo dela; a "Arma" espera o mestre dizer qual.
  const tipoDeAntes = item.tipo ?? tipoPelaCategoria(item.categoria)
  let rascunho = tipoDeAntes === null || tipoDeAntes === 'arma' ? item : comOTipo(item, tipoDeAntes)
  if (rascunho.tipo === 'municao' && rascunho.aoAcertar === undefined && rascunho.tiro !== undefined && falaDeCuraReduzida(rascunho.tiro.efeito)) {
    const aoAcertar = pecasDoItemGuardadas([{ tipo: 'condicao', nome: NOME_DA_CURA_REDUZIDA, duracao: 'fim', n: CURA_REDUZIDA_PADRAO }], 'acerto')
    if (aoAcertar !== undefined) {
      rascunho = { ...rascunho, aoAcertar }
      avisos.push('O "Ao acertar" veio do texto da bala. Salve para guardar.')
    }
  }
  if (item.tipo !== undefined && TIPOS_QUE_ATACAM.has(item.tipo) && item.ataque === undefined && rascunho.ataque !== undefined) {
    const dano = regraDoLivro === undefined ? null : primeiroNumero(regraDoLivro.campos.dano ?? '')
    const acao = regraDoLivro === undefined ? '' : (regraDoLivro.campos.acao ?? '').trim()
    if (dano !== null || acao !== '') {
      rascunho = { ...rascunho, ataque: { ...rascunho.ataque, ...(dano === null ? {} : { dano }), ...(acao === '' ? {} : { acao }) } }
      avisos.push('O dano e a ação vieram da regra do livro. Confira e salve.')
    } else {
      avisos.push('O dano e o alcance ainda não estavam no item: os números são de partida. Confira e salve.')
    }
  }
  return { item: rascunho, avisos }
}

// ─── A ponte para os campos antigos ────────────────────────────────────────

const CATEGORIA_DO_TIPO: Readonly<Record<Exclude<TipoDoItem, 'outros'>, string>> = {
  corpo: 'Arma',
  fogo: 'Arma',
  hibrida: 'Arma',
  arremesso: 'Arma',
  municao: 'Munição',
  consumivel: 'Consumível',
  equipamento: 'Armadura',
}

/** O dano da bala como o subcartão "Tipos de bala" o escrevia ("+15", "40", "+Percepção / 2"). */
export function danoDaBalaEmTexto(bala: BalaDoItem, nomeDoAtributo: (id: string) => string): string {
  if (bala.modo === 'soma') return bala.valor === 0 ? '' : `+${bala.valor}`
  if (bala.modo === 'troca') return String(bala.valor)
  const atributo = bala.atributo === undefined ? '' : nomeDoAtributo(bala.atributo)
  if (atributo === '') return ''
  return bala.divisor === undefined || bala.divisor === 1 ? `+${atributo}` : `+${atributo} / ${bala.divisor}`
}

/**
 * O item com os campos de antes em dia com os blocos, porque a batalha, a loja e a mochila de hoje
 * ainda os leem (até a E6 e a E7): a categoria pelo tipo (Outros guarda a dele), as munições do
 * pente, o dano da bala e, no consumível com "Ao usar", o efeito que o Usar de hoje roda. O que o
 * mestre escreveu à mão no efeito da bala fica.
 */
export function itemComOsCamposAntigos(item: ItemDoCatalogo, nomeDoAtributo: (id: string) => string): ItemDoCatalogo {
  const tipo = item.tipo
  if (tipo === undefined) return item
  let novo: ItemDoCatalogo = { ...item, categoria: tipo === 'outros' ? (item.categoriaAntiga ?? (ehCategoriaDeUmTipo(item.categoria) ? '' : item.categoria)) : CATEGORIA_DO_TIPO[tipo] }
  if ((tipo === 'fogo' || tipo === 'hibrida') && novo.pente !== undefined) {
    const { municoes: _antes, ...sem } = novo
    novo = novo.pente.aceita.length === 0 ? sem : { ...sem, municoes: [...novo.pente.aceita] }
  }
  if (tipo === 'municao' && novo.bala !== undefined) {
    const doBloco = danoDaBalaEmTexto(novo.bala, nomeDoAtributo)
    const antes = novo.tiro?.dano ?? ''
    // O dano de antes que não virou número ("2d6") fica, enquanto a bala está na partida: o Confira pede para o mestre olhar.
    const dano = doBloco === '' && balaDoDano(antes) === null ? antes : doBloco
    const efeito = novo.tiro?.efeito ?? ''
    const { tiro: _antes, ...sem } = novo
    novo = dano === '' && efeito.trim() === '' ? sem : { ...sem, tiro: { dano, efeito } }
  }
  if (tipo === 'consumivel' && novo.aoUsar !== undefined) {
    const onde = novo.uso === undefined || (novo.uso.onde.batalha && novo.uso.onde.fora) ? 'sempre' : novo.uso.onde.batalha ? 'soNaBatalha' : 'soFora'
    novo = { ...novo, efeito: { mecanica: novo.aoUsar, gasta: novo.efeito?.gasta ?? 'um', onde } }
  }
  return novo
}

/** A categoria de antes é uma das que o tipo já diz (não é "Fruta" nem "Tesouro"). */
function ehCategoriaDeUmTipo(categoria: string): boolean {
  const chave = normalizado(categoria)
  return Object.values(CATEGORIA_DO_TIPO).some((rotulo) => normalizado(rotulo) === chave) || /^(armas|municoes|balas?|consumiveis|armaduras)$/.test(chave)
}

// ─── A frase "O que acontece" ───────────────────────────────────────────────

export interface ContextoDaFrase {
  nomeDoItem: (id: string) => string | null
  nomeDoAtributo: (id: string) => string
  /** As armas do Acervo cujo pente aceita esta munição. */
  armasQueAceitam: (municaoId: string) => readonly string[]
}

function juntar(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes.join('')
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

function ondeAcerta(alcance: AlcanceNoItem | undefined): string {
  const forma = alcanceLido(alcance)
  return forma === null ? 'sem alcance definido' : descreverAlcance(forma).replace(/^./, (letra) => letra.toLowerCase())
}

function textoDaRecarga(recarga: RecargaDoItem | undefined): string {
  if (recarga === undefined) return 'na hora'
  const tempo = recarga.rodadas === 0 ? 'na hora' : recarga.rodadas === 1 ? 'em 1 rodada' : `em ${recarga.rodadas} rodadas`
  return `${recarga.acao}, ${tempo}`
}

function danoComSoma(dano: number, soma: string, ctx: ContextoDaFrase): string {
  return soma === '' ? String(dano) : `${dano} + ${ctx.nomeDoAtributo(soma)}`
}

function fraseDaPeca(peca: PecaDoItem, onde: OndeDaPeca): string {
  const quem = onde === 'uso' ? 'Quem recebe' : 'Quem é atingido'
  switch (peca.tipo) {
    case 'condicao': {
      const duracao = rotuloDaDuracao(peca.duracao)
      const regra = regraDaCondicaoPeloNome(peca.nome)
      // Pedido de 26/11: o "depois de X turnos" da peça entra na mesma frase.
      const depois = peca.gatilho === undefined ? '' : ` Na vez dele, ${fraseDoGatilho(peca.gatilho)}.`
      if (regra === 'cura') return `${quem} fica com ${peca.nome}${peca.n === undefined ? '' : ` ${peca.n}%`} ${duracao}: toda cura nele vem cortada.${depois}`
      if (regra === 'vida') return `${quem} fica ${peca.nome} ${duracao}${peca.n === undefined ? '' : `, perdendo ${peca.n} de vida no começo de cada vez`}.${depois}`
      return `${quem} fica ${peca.nome} ${duracao} (o mestre narra).${depois}`
    }
    case 'dano':
      return `Mais ${peca.valor} de dano extra.`
    case 'empurrar':
      return `O alvo é empurrado ${peca.casas} ${peca.casas === 1 ? 'casa' : 'casas'} para trás.`
    case 'curar':
      return `Cura ${peca.fixo} de vida.`
    case 'tirar':
      return peca.nome === null ? 'Tira as condições ruins.' : `Tira ${peca.nome}.`
  }
}

/**
 * O que as frases leem do item: o nome, o tipo, a luz e os blocos. O item do Acervo serve; a vaga da
 * mochila com a regra em instantâneo também (o cartão inteiro que o jogador vê, decisão 18).
 */
export type ItemDaFrase = Pick<ItemDoCatalogo, 'id' | 'nome' | 'tipo' | 'luz'> & BlocosDoItem

/** A frase da munição que nenhuma arma do Acervo aceita (quem não vê o Acervo, o jogador, a tira). */
export const SEM_ARMA_QUE_ACEITA = 'Nenhuma arma do Acervo aceita esta munição ainda.'

function frasesDasPecas(item: ItemDaFrase, onde: OndeDaPeca): string[] {
  const pecas = pecasDoItemLidas(onde === 'uso' ? item.aoUsar : item.aoAcertar)
  return pecas.filter((peca) => !danoExtraDobra(item, peca)).map((peca) => fraseDaPeca(peca, onde))
}

/** "O que acontece": o item em frases curtas, pelo tipo, como o cartão de papel do protótipo. */
export function frasesDoItem(item: ItemDaFrase, ctx: ContextoDaFrase): string[] {
  const f: string[] = []
  const nome = item.nome.trim() || 'este item'
  const tiro = () => {
    const { ataque, pente } = item
    if (ataque === undefined) return
    f.push(`${item.tipo === 'hibrida' ? 'Ou atira' : 'Atira'}: ${ondeAcerta(ataque.alcance)} (${ataque.acao}). Dano ${danoComSoma(ataque.dano, ataque.soma, ctx)}.`)
    if (pente !== undefined) {
      const balas = pente.aceita.map(ctx.nomeDoItem).filter((atual): atual is string => atual !== null)
      f.push(`Cada tiro gasta 1 bala do pente (cabem ${pente.capacidade}): ${balas.length > 0 ? `aceita ${juntar(balas)}, e o efeito da bala vale junto` : 'nenhuma munição marcada ainda'}.`)
      f.push(`Quando o pente zera, recarrega com as balas da mochila (${textoDaRecarga(pente.recarga)}).`)
    }
  }
  switch (item.tipo) {
    case 'corpo':
      if (item.ataque !== undefined) f.push(`Ataca: ${ondeAcerta(item.ataque.alcance)} (${item.ataque.acao}). Dano ${danoComSoma(item.ataque.dano, item.ataque.soma, ctx)}${item.ataque.alvos > 1 ? `, em até ${item.ataque.alvos} alvos` : ''}.`)
      f.push(...frasesDasPecas(item, 'acerto'))
      break
    case 'fogo':
      tiro()
      f.push(...frasesDasPecas(item, 'acerto'))
      break
    case 'hibrida':
      if (item.golpe !== undefined) f.push(`Golpeia: ${ondeAcerta(item.golpe.alcance)} (${item.golpe.acao}). Dano ${danoComSoma(item.golpe.dano, item.golpe.soma, ctx)}, sem gastar bala.`)
      tiro()
      f.push(...frasesDasPecas(item, 'acerto'))
      break
    case 'arremesso':
      if (item.ataque !== undefined) f.push(`É jogado: ${ondeAcerta(item.ataque.alcance)} (${item.ataque.acao}). Dano ${danoComSoma(item.ataque.dano, item.ataque.soma, ctx)}.`)
      if (item.arremesso?.volta === true) f.push(`Volta para a mão (${textoDaRecarga(item.arremesso.recarga)}): não se gasta.`)
      else f.push(`Gasta 1 ${nome} da mochila a cada vez; o próximo vai para a mão com ${textoDaRecarga(item.arremesso?.recarga)}.`)
      f.push(...frasesDasPecas(item, 'acerto'))
      break
    case 'municao': {
      f.push(`Cada tiro gasta 1 ${nome} do pente.`)
      const bala = item.bala
      if (bala !== undefined) {
        if (bala.modo === 'soma') f.push(bala.valor === 0 ? 'Usa o dano da arma.' : `Soma ${bala.valor} ao dano da arma.`)
        else if (bala.modo === 'troca') f.push(`Troca o dano da arma por ${bala.valor}.`)
        else f.push(`Soma ${bala.atributo === undefined ? 'um atributo' : ctx.nomeDoAtributo(bala.atributo)}${bala.divisor !== undefined && bala.divisor > 1 ? ` / ${bala.divisor}` : ''} ao dano da arma.`)
        if (bala.perfurante === true) f.push('O tiro é perfurante: vai direto no HP, sem gastar o Escudo.')
      }
      f.push(...frasesDasPecas(item, 'acerto'))
      const armas = ctx.armasQueAceitam(item.id)
      f.push(armas.length > 0 ? `Serve em: ${juntar(armas)}.` : SEM_ARMA_QUE_ACEITA)
      break
    }
    case 'consumivel': {
      const efeitos = frasesDasPecas(item, 'uso')
      if (efeitos.length === 0) {
        f.push('Sem efeito: usar não gasta, e o mestre narra o que acontece.')
        break
      }
      if (item.uso !== undefined) f.push(`Usa-se: ${ondeAcerta(item.uso.alcance)} (${item.uso.acao}).`)
      f.push(...efeitos, `Gasta 1 ${nome}.`)
      const onde = item.uso?.onde
      if (onde !== undefined) f.push(onde.batalha && onde.fora ? 'Dá para usar dentro e fora da batalha.' : onde.batalha ? 'Só dá para usar na batalha.' : onde.fora ? 'Só dá para usar fora da batalha.' : 'Marque onde dá para usar.')
      break
    }
    case 'equipamento': {
      const equipamento = item.equipamento
      const lugar = LUGAR_DA_PARTE[equipamento?.parte ?? 'corpo']
      const bonus = (equipamento?.bonus ?? []).map((atual) => textoDoBonus(atual, ctx))
      f.push(bonus.length > 0 ? `Vestido ${lugar}, dá ${juntar(bonus)} enquanto está vestido.` : `Vestido ${lugar}. Ainda não dá bônus: escreva em Como veste o que ele dá.`)
      break
    }
    case 'outros':
    case undefined:
      if (item.luz === undefined) f.push('Sem regra: para usar, diga ao mestre o que quer fazer com ele.')
      break
  }
  if (item.luz !== undefined) f.push(`Aceso, ilumina ${String(item.luz.alcanceEmCasas).replace('.', ',')} ${item.luz.alcanceEmCasas === 1 ? 'casa' : 'casas'} em volta de quem carrega.`)
  return f
}

export function textoDoBonus(bonus: BonusDoEquipamento, ctx: Pick<ContextoDaFrase, 'nomeDoAtributo'>): string {
  if (bonus.campo === 'vantagem' || bonus.campo === 'desvantagem') return `${ROTULO_DO_BONUS[bonus.campo]}${bonus.em === undefined || bonus.em === '' ? '' : ` em ${bonus.em}`}`
  const rotulo = bonus.campo === 'atributo' ? ctx.nomeDoAtributo(bonus.em ?? '') : ROTULO_DO_BONUS[bonus.campo]
  return `${rotulo} ${bonus.n >= 0 ? '+' : ''}${bonus.n}`
}

/** O rótulo curto do tipo para a linha e o cartão ("Híbrida", "Munição"); sem tipo, "Item". */
export function rotuloDoTipoDoItem(tipo: TipoDoItem | undefined): string {
  return tipo === undefined ? 'Item' : ROTULO_DO_TIPO[tipo]
}
