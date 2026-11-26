import type { ItemDoCatalogo } from '../../acervoDeItens'
import { pecasGuardadas } from '../leitura'
import type { BalaDoItem, BlocosDoItem, ConfiraDoItem, TipoDoItem, UsoDoItem } from '../modelo'
import { comConfira, ehNomeDeArremesso, ehNomeQueVolta, normalizado, tipoPelaCategoria } from './comum'

/**
 * CONVERSÃO DO ITEM DO ACERVO (PLANO §2.2): o item de antes ganha o `tipo` e os blocos que os campos
 * dele já dizem. Idempotente pelo estado: o item que já tem `tipo` volta o MESMO objeto. Os campos
 * antigos ficam (as telas de hoje e a batalha ainda os leem até a E7).
 */

/** A origem do "Confira" do tipo que saiu de um palpite: a regra da arma (o cartão ligado) pode corrigi-lo depois. */
export const ORIGEM_DO_PALPITE_DO_TIPO = 'conversão: tipo pelo palpite'
const ORIGEM_DO_TIRO = 'conversão: o tiro da munição'

/** A recarga do arremesso de antes: o próximo já está na mão (Ação Livre, na hora). */
const RECARGA_NA_HORA = { acao: 'Ação Livre', rodadas: 0 } as const

/**
 * O dano da bala de antes (`TiroDaMunicao.dano`): "+15" soma; "40" troca; "+Percepção / 2" conta
 * pelo atributo. `undefined` = vazio (a bala usa o dano da arma); `null` = não casa com nenhum dos três.
 */
export function balaDoDano(dano: string): BalaDoItem | null | undefined {
  const texto = dano.trim()
  if (texto === '') return undefined
  const soma = /^\+\s*(\d{1,7})$/.exec(texto)
  if (soma !== null) return { modo: 'soma', valor: Number.parseInt(soma[1], 10) }
  const troca = /^(\d{1,7})$/.exec(texto)
  if (troca !== null) return { modo: 'troca', valor: Number.parseInt(troca[1], 10) }
  const atributo = /^\+?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{0,30}?)\s*(?:\/\s*(\d{1,2}))?$/.exec(texto)
  // Pelo atributo só com o "+" na frente ou a divisão ("Percepção / 2", como a Bala de Prata do Acervo): palavra solta não é dano.
  if (atributo !== null && (texto.startsWith('+') || atributo[2] !== undefined)) {
    const divisor = atributo[2] === undefined ? undefined : Number.parseInt(atributo[2], 10)
    return { modo: 'atributo', valor: 0, atributo: atributo[1].trim(), ...(divisor === undefined || divisor < 1 ? {} : { divisor }) }
  }
  return null
}

/** O texto da bala fala de prata ou de cura cortada: vira Cura reduzida 50% no alvo (PLANO §2.2). */
export function falaDeCuraReduzida(texto: string): boolean {
  return /\b(prata|cura reduzida|cura pela metade|metade da cura)\b/.test(normalizado(texto))
}

interface Convertido {
  tipo: TipoDoItem
  blocos: BlocosDoItem
  confira: ConfiraDoItem[]
  categoriaAntiga?: string
}

function daMunicao(item: ItemDoCatalogo): Convertido {
  const confira: ConfiraDoItem[] = []
  const blocos: BlocosDoItem = {}
  if (item.tiro !== undefined) {
    const bala = balaDoDano(item.tiro.dano)
    if (bala === null) confira.push({ texto: 'O dano da bala não virou número: confira a bala', antes: item.tiro.dano, origem: ORIGEM_DO_TIRO })
    else if (bala !== undefined) blocos.bala = bala
    // A peça montada nasce no editor do item (E2); até lá a batalha segue o texto do tiro, que fica no item.
    if (falaDeCuraReduzida(item.tiro.efeito)) confira.push({ texto: 'Ao acertar: Cura reduzida 50% até o fim da batalha', antes: item.tiro.efeito, origem: ORIGEM_DO_TIRO })
    else if (item.tiro.efeito.trim() !== '') confira.push({ texto: 'O efeito da bala ficou só em texto: confira o Ao acertar', antes: item.tiro.efeito, origem: ORIGEM_DO_TIRO })
  }
  return { tipo: 'municao', blocos, confira }
}

function doConsumivel(item: ItemDoCatalogo): Convertido {
  const blocos: BlocosDoItem = {}
  if (item.efeito !== undefined) {
    const onde: UsoDoItem['onde'] = { batalha: item.efeito.onde !== 'soFora', fora: item.efeito.onde !== 'soNaBatalha' }
    blocos.uso = { acao: '', onde }
    const pecas = pecasGuardadas(item.efeito.mecanica)
    if (pecas !== undefined) blocos.aoUsar = pecas
  }
  return { tipo: 'consumivel', blocos, confira: [] }
}

function daArmadura(item: ItemDoCatalogo): Convertido {
  const defesa = /\bdefesa\s*\+?\s*(\d{1,4})\b/.exec(normalizado(item.descricao))
  const n = defesa === null ? null : Number.parseInt(defesa[1], 10)
  return {
    tipo: 'equipamento',
    blocos: { equipamento: { parte: 'corpo', bonus: n === null ? [] : [{ campo: 'ca', n }] } },
    confira: [n === null ? { texto: 'Armadura sem "Defesa" escrita: diga o bônus da roupa', origem: 'conversão: armadura' } : { texto: `"Defesa ${n}" virou o bônus sugerido CA +${n}: confira`, antes: `Defesa ${n}`, depois: `CA +${n}`, origem: 'conversão: armadura' }],
  }
}

/** A arma do Acervo sem a regra à mão: pelo nome (explosivo, boomerang) e pelas munições; o resto é palpite. */
function daArma(item: ItemDoCatalogo): Convertido {
  if (ehNomeDeArremesso(item.nome)) {
    return { tipo: 'arremesso', blocos: { arremesso: { recarga: { ...RECARGA_NA_HORA }, ...(ehNomeQueVolta(item.nome) ? { volta: true as const } : {}) } }, confira: [] }
  }
  if (item.municoes !== undefined) {
    return {
      tipo: 'fogo',
      blocos: {},
      confira: [{ texto: 'Arma que aceita munição virou De fogo: diga quantas balas cabem no pente', origem: ORIGEM_DO_PALPITE_DO_TIPO }],
    }
  }
  return { tipo: 'corpo', blocos: {}, confira: [{ texto: 'Sem a categoria da arma: ficou Corpo a corpo', origem: ORIGEM_DO_PALPITE_DO_TIPO }] }
}

function convertido(item: ItemDoCatalogo): Convertido {
  switch (tipoPelaCategoria(item.categoria)) {
    case 'municao':
      return daMunicao(item)
    case 'consumivel':
      return doConsumivel(item)
    case 'equipamento':
      return daArmadura(item)
    case 'arma':
      return daArma(item)
    case null:
    default: {
      const antiga = item.categoria.trim()
      return { tipo: 'outros', blocos: {}, confira: [], ...(antiga === '' ? {} : { categoriaAntiga: antiga }) }
    }
  }
}

/** O item de antes no modelo novo. Já convertido (`tipo` presente): o MESMO objeto. */
export function converterItemDoAcervo(item: ItemDoCatalogo): ItemDoCatalogo {
  if (item.tipo !== undefined) return item
  const novo = convertido(item)
  const confira = comConfira(item.confira, novo.confira)
  return {
    ...item,
    ...novo.blocos,
    tipo: novo.tipo,
    ...(confira === undefined ? {} : { confira }),
    ...(novo.categoriaAntiga === undefined || item.categoriaAntiga !== undefined ? {} : { categoriaAntiga: novo.categoriaAntiga }),
  }
}

/** Os itens do Acervo no modelo novo. Nenhum mudou: a MESMA lista. */
export function converterItensDoAcervo(itens: ItemDoCatalogo[]): ItemDoCatalogo[] {
  let mudou = false
  const novos = itens.map((item) => {
    const novo = converterItemDoAcervo(item)
    if (novo !== item) mudou = true
    return novo
  })
  return mudou ? novos : itens
}
