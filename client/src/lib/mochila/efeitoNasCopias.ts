import type { CarriedItem } from '../../types/map'
import { efeitoParaDar, itemParaDar, requisitosParaDar, type ItemDoCatalogo } from '../acervoDeItens'
import type { Personagem } from '../personagem'

/**
 * O EFEITO DO ITEM NUMA FONTE SÓ (F6 de docs/design/habilidades/ARMAS-FONTE-UNICA.md,
 * a mesma regra das armas): o "O que ele faz" da coisa do Acervo é a verdade;
 * a vaga da mochila dada dela (mesmo `itemId`) é cópia. A cópia não tem editor
 * próprio, então a que já leva efeito e diverge é sempre uma versão velha da
 * fonte: segue sozinha (`segue`). A divergência que pode ser escolha (a vaga
 * dada antes de o item ter efeito, ou com efeito que o Acervo não tem mais)
 * nunca é decidida aqui: vai à lista que o mestre confirma. Puro.
 */

/**
 * A vaga com o efeito do item de agora; o item sem efeito tira o da vaga. Igual = a mesma referência.
 * REQUISITOS (fase B2, REQUISITOS.md §3.2): o bloco anda junto com o efeito, pela mesma regra (a fonte manda).
 */
export function vagaComOEfeitoDoItem(vaga: CarriedItem, item: ItemFonte): CarriedItem {
  if (vaga.itemId !== item.id) return vaga
  const { efeito: _antes, efeitoResumo: _fraseDeAntes, requisitos: _requisitosDeAntes, ...semEfeito } = vaga
  const nova: CarriedItem = { ...semEfeito, ...efeitoParaDar(item), ...requisitosParaDar(item) }
  return JSON.stringify(nova) === JSON.stringify(vaga) ? vaga : nova
}

/** A ficha com as vagas do item atualizadas; nada a mudar = a mesma referência. */
export function fichaComOEfeitoDoItem(personagem: Personagem, item: ItemFonte): Personagem {
  return fichaComAsVagas(personagem, (vaga) => vagaComOEfeitoDoItem(vaga, item))
}

/**
 * Como a cópia difere da fonte:
 * - `segue`: as duas têm efeito (ou nenhuma), a cópia é de uma versão velha: a fonte ganha sem perguntar;
 * - `semEfeitoNaCopia`: dada antes de o item ter efeito (o caso do antigo "Atualizar as cópias");
 * - `semEfeitoNaFonte`: a cópia tem um efeito que a coisa do Acervo não tem mais.
 */
export type CasoDaCopia = 'segue' | 'semEfeitoNaCopia' | 'semEfeitoNaFonte'

export interface CopiaDoItem {
  personagemId: string
  personagemNome: string
  vagaId: string
  itemId: string
  caso: CasoDaCopia
}

/** O que o mestre escolhe para as cópias em conflito: seguir o Acervo, ou separar (a vaga deixa de ser cópia, fica como está). */
export type EscolhaDaCopia = 'acervo' | 'separar'

type ItemFonte = Pick<ItemDoCatalogo, 'id' | 'efeito' | 'requisitos'>

function casoDa(vaga: CarriedItem, item: ItemFonte): CasoDaCopia {
  if (item.efeito !== undefined) return vaga.efeito === undefined ? 'semEfeitoNaCopia' : 'segue'
  return vaga.efeito === undefined ? 'segue' : 'semEfeitoNaFonte'
}

/** O ENSAIO: toda vaga ligada a uma coisa que existe e que difere dela. A vaga solta (sem `itemId`) ou de coisa apagada fica fora. */
export function ensaiarCopias(personagens: readonly Personagem[], acervo: readonly ItemFonte[]): CopiaDoItem[] {
  const porId = new Map(acervo.map((item) => [item.id, item]))
  return personagens.flatMap((personagem) =>
    (personagem.mochila ?? []).flatMap((vaga): CopiaDoItem[] => {
      const item = vaga.itemId === undefined ? undefined : porId.get(vaga.itemId)
      if (item === undefined || vagaComOEfeitoDoItem(vaga, item) === vaga) return []
      return [{ personagemId: personagem.id, personagemNome: personagem.nome, vagaId: vaga.id, itemId: item.id, caso: casoDa(vaga, item) }]
    }),
  )
}

function fichaComAsVagas(personagem: Personagem, mudar: (vaga: CarriedItem) => CarriedItem): Personagem {
  const mochila = personagem.mochila
  if (mochila === undefined) return personagem
  const nova = mochila.map(mudar)
  return nova.every((vaga, indice) => vaga === mochila[indice]) ? personagem : { ...personagem, mochila: nova }
}

/** As fichas com as cópias listadas trocadas por `mudar`; nada a mudar = a mesma referência em cada ficha. */
function comAsCopias(personagens: readonly Personagem[], copias: readonly CopiaDoItem[], mudar: (vaga: CarriedItem, copia: CopiaDoItem) => CarriedItem): Personagem[] {
  const porFicha = new Map<string, Map<string, CopiaDoItem>>()
  for (const copia of copias) porFicha.set(copia.personagemId, (porFicha.get(copia.personagemId) ?? new Map<string, CopiaDoItem>()).set(copia.vagaId, copia))
  return personagens.map((personagem) => {
    const daFicha = porFicha.get(personagem.id)
    if (daFicha === undefined) return personagem
    return fichaComAsVagas(personagem, (vaga) => {
      const copia = daFicha.get(vaga.id)
      return copia === undefined ? vaga : mudar(vaga, copia)
    })
  })
}

/** ABRIR A PASTA: só as cópias `segue` voltam ao que a fonte diz; as em conflito ficam como estão, esperando o mestre. */
export function comAsCopiasQueSeguem(personagens: readonly Personagem[], acervo: readonly ItemFonte[]): Personagem[] {
  const porId = new Map(acervo.map((item) => [item.id, item]))
  const seguem = ensaiarCopias(personagens, acervo).filter((copia) => copia.caso === 'segue')
  return comAsCopias(personagens, seguem, (vaga, copia) => {
    const item = porId.get(copia.itemId)
    return item === undefined ? vaga : vagaComOEfeitoDoItem(vaga, item)
  })
}

/** A ESCOLHA do mestre para as cópias em conflito de UM item: seguir o Acervo, ou separar (tira só o `itemId`). */
export function comAEscolhaDasCopias(personagens: readonly Personagem[], item: ItemFonte, escolha: EscolhaDaCopia): Personagem[] {
  const conflitos = ensaiarCopias(personagens, [item]).filter((copia) => copia.caso !== 'segue')
  return comAsCopias(personagens, conflitos, (vaga) => {
    if (escolha === 'acervo') return vagaComOEfeitoDoItem(vaga, item)
    const { itemId: _ligacao, ...solta } = vaga
    return solta
  })
}

// ── Os dados da coisa (achado 11 do levantamento de 25/11/2026) ─────────────

/**
 * OS DADOS DA COISA NUMA FONTE SÓ: além do efeito e dos requisitos, a vaga
 * dada segue o Acervo na foto, na descrição, no preço, na luz e nas munições
 * (o nome não: o "Editar" o troca de propósito e o Atacar já casa pelo nome de
 * agora, f3f8536e). Duas regras, porque o "Editar" do mestre muda a descrição
 * e o preço de UMA vaga (`lib/mochila/editarVaga.ts`) e essa escolha não pode
 * se perder:
 *  - SALVAR A COISA: a vaga que ainda tinha o valor de antes (cópia intacta)
 *    recebe o novo, também quando o Acervo tira o campo; a editada fica;
 *  - SEMPRE (salvar, abrir a pasta, começar a batalha): foto, luz e munições,
 *    que a vaga não edita, seguem o que o Acervo tem. Campo que o Acervo não
 *    tem fica na vaga: ausência na fonte não apaga nada.
 */
const DADOS_QUE_SEGUEM = ['imagem', 'descricao', 'preco', 'luz', 'municoes'] as const
type DadoQueSegue = (typeof DADOS_QUE_SEGUEM)[number]
/** Os que só o Acervo muda: a vaga não tem editor para eles. */
const SEM_EDITOR_NA_VAGA: ReadonlySet<DadoQueSegue> = new Set<DadoQueSegue>(['imagem', 'luz', 'municoes'])

export type DadosDaCoisa = Pick<CarriedItem, DadoQueSegue>

/** Uma coisa do Acervo cujos dados mudaram nesta gravação: como a vaga os levava antes e como leva agora. */
export interface DadosMudados {
  itemId: string
  antes: DadosDaCoisa
  depois: DadosDaCoisa
}

const mesmoValor = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Os dados como a vaga os recebe ao ser dada (`itemParaDar`: o nome de cada munição sai do Acervo de então). */
function dadosDaCoisa(item: ItemDoCatalogo, acervo: readonly ItemDoCatalogo[]): DadosDaCoisa {
  const dada = itemParaDar(item, acervo)
  return { imagem: dada.imagem, descricao: dada.descricao, preco: dada.preco, luz: dada.luz, municoes: dada.municoes }
}

/** O valor que a fonte manda e a vaga não tem, num campo que só o Acervo muda. */
function segueSempre(vaga: CarriedItem, campo: DadoQueSegue, fonte: DadosDaCoisa): boolean {
  return SEM_EDITOR_NA_VAGA.has(campo) && fonte[campo] !== undefined && !mesmoValor(vaga[campo], fonte[campo])
}

/** A vaga com os campos que `segue` escolhe trocados pelos da fonte (ausente tira a chave; a luz que sai leva o aceso). Nada mudando, a MESMA vaga. */
function vagaComOsDados(vaga: CarriedItem, fonte: DadosDaCoisa, segue: (campo: DadoQueSegue) => boolean): CarriedItem {
  if (!DADOS_QUE_SEGUEM.some(segue)) return vaga
  const { imagem, descricao, preco, luz, municoes, acesa, ...resto } = vaga
  const novos: DadosDaCoisa = {
    imagem: segue('imagem') ? fonte.imagem : imagem,
    descricao: segue('descricao') ? fonte.descricao : descricao,
    preco: segue('preco') ? fonte.preco : preco,
    luz: segue('luz') ? fonte.luz : luz,
    municoes: segue('municoes') ? fonte.municoes : municoes,
  }
  if (DADOS_QUE_SEGUEM.every((campo) => mesmoValor(vaga[campo], novos[campo]))) return vaga
  return {
    ...resto,
    ...(novos.imagem === undefined ? {} : { imagem: novos.imagem }),
    ...(novos.descricao === undefined ? {} : { descricao: novos.descricao }),
    ...(novos.preco === undefined ? {} : { preco: novos.preco }),
    ...(novos.luz === undefined ? {} : { luz: { ...novos.luz } }),
    ...(novos.municoes === undefined ? {} : { municoes: novos.municoes.map((municao) => ({ ...municao })) }),
    // O Lampião continua aceso se continua iluminando; o que o Acervo apagou de vez não fica "aceso" sem luz.
    ...(acesa === true && novos.luz !== undefined ? { acesa: true as const } : {}),
  }
}

/** SALVAR A COISA: as que existiam antes e cujos dados (como a vaga os leva) mudaram nesta gravação, a munição renomeada inclusive. */
export function itensComOsDadosMudados(antes: readonly ItemDoCatalogo[], depois: readonly ItemDoCatalogo[]): DadosMudados[] {
  const deAntes = new Map(antes.map((item) => [item.id, item]))
  return depois.flatMap((item): DadosMudados[] => {
    const velho = deAntes.get(item.id)
    if (velho === undefined) return []
    const dadosAntes = dadosDaCoisa(velho, antes)
    const dadosDepois = dadosDaCoisa(item, depois)
    return mesmoValor(dadosAntes, dadosDepois) ? [] : [{ itemId: item.id, antes: dadosAntes, depois: dadosDepois }]
  })
}

/** SALVAR A COISA: a ficha com as vagas das coisas que mudaram em dia (a cópia intacta segue; a editada guarda descrição e preço). */
export function fichaComOsDadosMudados(personagem: Personagem, mudados: readonly DadosMudados[]): Personagem {
  if (mudados.length === 0) return personagem
  const porId = new Map(mudados.map((mudado) => [mudado.itemId, mudado]))
  return fichaComAsVagas(personagem, (vaga) => {
    const mudado = vaga.itemId === undefined ? undefined : porId.get(vaga.itemId)
    if (mudado === undefined) return vaga
    const intacta = (campo: DadoQueSegue): boolean => mesmoValor(vaga[campo], mudado.antes[campo]) && !mesmoValor(mudado.antes[campo], mudado.depois[campo])
    return vagaComOsDados(vaga, mudado.depois, (campo) => intacta(campo) || segueSempre(vaga, campo, mudado.depois))
  })
}

/** ABRIR A PASTA e COMEÇAR A BATALHA: as cópias com o efeito (`comAsCopiasQueSeguem`) e com foto, luz e munições do Acervo de agora. */
export function comAsCopiasEmDia(personagens: readonly Personagem[], acervo: readonly ItemDoCatalogo[]): Personagem[] {
  const porId = new Map(acervo.map((item) => [item.id, item]))
  const dados = new Map<string, DadosDaCoisa>()
  const dadosDe = (item: ItemDoCatalogo): DadosDaCoisa => {
    const lembrado = dados.get(item.id) ?? dadosDaCoisa(item, acervo)
    dados.set(item.id, lembrado)
    return lembrado
  }
  return comAsCopiasQueSeguem(personagens, acervo).map((personagem) =>
    fichaComAsVagas(personagem, (vaga) => {
      const item = vaga.itemId === undefined ? undefined : porId.get(vaga.itemId)
      if (item === undefined) return vaga
      const fonte = dadosDe(item)
      return vagaComOsDados(vaga, fonte, (campo) => segueSempre(vaga, campo, fonte))
    }),
  )
}

/** SALVAR A COISA: as que existiam antes e cujo efeito (ou bloco de requisitos, fase B2) mudou nesta gravação (as cópias delas seguem, todas). */
export function itensComOEfeitoMudado<T extends ItemFonte>(antes: readonly T[], depois: readonly T[]): T[] {
  const deAntes = new Map(antes.map((item) => [item.id, item]))
  return depois.filter((item) => {
    const velho = deAntes.get(item.id)
    return velho !== undefined && velho !== item && (JSON.stringify(velho.efeito) !== JSON.stringify(item.efeito) || JSON.stringify(velho.requisitos) !== JSON.stringify(item.requisitos))
  })
}
