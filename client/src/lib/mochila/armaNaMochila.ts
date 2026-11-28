import type { CarriedItem } from '../../types/map'
import { TIPOS_COM_PENTE, TIPOS_DE_ARMA, TIPOS_QUE_EQUIPAM, type BalaNoPente, type PenteDaVaga, type TipoDoItem } from '../itens/modelo'
import { mochilaComItemDoAcervo, quantidadeDe, type ItemParaDar } from '../items'

/**
 * EQUIPAR, GUARDAR E O PENTE FORA DA BATALHA (docs/design/itens-rework/PLANO.md, etapa E3; decisões
 * 2, 5 e 16 e a A8). A vaga diz quem tem, quantos, se está equipada e o que tem no pente; o item do
 * Acervo diz o tipo e quantas balas cabem. Puras: sem store, sem disco. Quem chama grava a mochila.
 *
 * - Equipar só arma, arremesso e equipamento; as armas equipadas param no "Armas por batalha" da
 *   ficha (uma pilha de granadas conta 1; a roupa não conta).
 * - Recarregar fora da batalha é na hora e não gasta nada: tira da vaga da bala e põe no pente. O
 *   pente tem um tipo de bala por vez: trocar de bala devolve as do pente à mochila antes.
 * - Dar, vender, largar ou tirar a arma devolve antes as balas do pente à mochila de quem tinha (A8):
 *   a arma vai vazia e guardada.
 */

/** O que a mochila precisa saber do item do Acervo da vaga. `undefined` = o item saiu do Acervo. */
export interface ItemDaArma {
  tipo?: TipoDoItem
  pente?: { capacidade: number; aceita: readonly string[] }
}

/** Acha o item do Acervo pelo id: o tipo e o pente (`ItemDaArma`) e como ele vai para a mochila (`ItemParaDar`). */
export interface AcervoDaMochila {
  item: (itemId: string) => ItemDaArma | undefined
  paraDar: (itemId: string) => ItemParaDar | undefined
}

/** Não deu: a frase que o mestre lê no aviso. */
export interface Recusa {
  recusa: string
}

export function ehRecusa<T extends object>(resultado: T | Recusa): resultado is Recusa {
  return 'recusa' in resultado
}

const SAIU_DA_MOCHILA = 'O item já não está na mochila.'

/** O tipo da vaga: o do Acervo de agora vence a cópia de exibição da vaga. */
export function tipoDaVaga(vaga: Pick<CarriedItem, 'itemId' | 'tipo'>, acervo: Pick<AcervoDaMochila, 'item'>): TipoDoItem | undefined {
  const doAcervo = vaga.itemId === undefined ? undefined : acervo.item(vaga.itemId)?.tipo
  return doAcervo ?? vaga.tipo
}

/** O pente que a arma da vaga tem: o do Acervo de agora, senão o instantâneo da regra. `null` = a arma não tem pente. */
export function penteDaArma(vaga: Pick<CarriedItem, 'itemId' | 'tipo' | 'regra'>, acervo: Pick<AcervoDaMochila, 'item'>): { capacidade: number; aceita: readonly string[] } | null {
  const tipo = tipoDaVaga(vaga, acervo)
  if (tipo === undefined || !TIPOS_COM_PENTE.has(tipo)) return null
  const doAcervo = vaga.itemId === undefined ? undefined : acervo.item(vaga.itemId)?.pente
  const pente = doAcervo ?? vaga.regra?.pente
  return pente === undefined || pente.capacidade < 1 ? null : pente
}

/** A vaga é uma arma que conta no "Armas por batalha" (a roupa equipada não conta, decisão 5). */
function contaNoLimite(vaga: CarriedItem, acervo: Pick<AcervoDaMochila, 'item'>): boolean {
  const tipo = tipoDaVaga(vaga, acervo)
  return tipo !== undefined && TIPOS_DE_ARMA.has(tipo)
}

/** Quantas armas estão equipadas agora (cada vaga conta 1, a pilha de granadas também). */
export function armasEquipadas(mochila: readonly CarriedItem[], acervo: Pick<AcervoDaMochila, 'item'>): number {
  return mochila.filter((vaga) => vaga.equipado === true && contaNoLimite(vaga, acervo)).length
}

/** A vaga se equipa? Só arma, arremesso e equipamento (`TIPOS_QUE_EQUIPAM`). */
export function seEquipa(vaga: Pick<CarriedItem, 'itemId' | 'tipo'>, acervo: Pick<AcervoDaMochila, 'item'>): boolean {
  const tipo = tipoDaVaga(vaga, acervo)
  return tipo !== undefined && TIPOS_QUE_EQUIPAM.has(tipo)
}

/** "1 arma" ou "2 armas": o limite como o mestre o escolheu na ficha. */
function armasNoTexto(n: number): string {
  return n === 1 ? '1 arma' : `${n} armas`
}

/** A frase do limite (decisão 5): o que o Equipar recusado diz. */
export function fraseDoLimite(dono: string, limite: number, nome: string): string {
  return `${dono} já tem ${armasNoTexto(limite)} equipada${limite === 1 ? '' : 's'}, o limite de "Armas por batalha". Guarde uma antes de equipar ${nome}.`
}

/**
 * EQUIPAR a vaga `vagaId`. `limite` = o "Armas por batalha" da ficha (`limiteDeArmas`); `null` = sem
 * limite. Já equipada: a MESMA mochila.
 */
export function equiparNaMochila(mochila: readonly CarriedItem[], vagaId: string, limite: number | null, dono: string, acervo: Pick<AcervoDaMochila, 'item'>): CarriedItem[] | Recusa {
  const vaga = mochila.find((item) => item.id === vagaId)
  if (vaga === undefined) return { recusa: SAIU_DA_MOCHILA }
  if (!seEquipa(vaga, acervo)) return { recusa: `${vaga.nome} não se equipa: só arma, arremesso e equipamento.` }
  if (vaga.equipado === true) return [...mochila]
  if (limite !== null && contaNoLimite(vaga, acervo) && armasEquipadas(mochila, acervo) >= limite) return { recusa: fraseDoLimite(dono, limite, vaga.nome) }
  return mochila.map((item) => (item === vaga ? { ...item, equipado: true as const } : item))
}

/** A vaga sem o `equipado` (ausente = guardada, como no disco). */
function guardada(vaga: CarriedItem): CarriedItem {
  const { equipado: _equipado, ...resto } = vaga
  return resto
}

/** GUARDAR a vaga `vagaId`: deixa de estar em uso; o pente fica como está. */
export function guardarNaMochila(mochila: readonly CarriedItem[], vagaId: string): CarriedItem[] | Recusa {
  const vaga = mochila.find((item) => item.id === vagaId)
  if (vaga === undefined) return { recusa: SAIU_DA_MOCHILA }
  return mochila.map((item) => (item === vaga ? guardada(item) : item))
}

/** Como a bala do pente volta para a mochila quando o item dela saiu do Acervo: uma pilha de Munição com o id dela. */
function balaSemAcervo(balaId: string): ItemParaDar {
  return { nome: 'Munição do pente', itemId: balaId, tipo: 'municao', empilhavel: true }
}

/** A mochila com `n` balas `balaId` de volta (a pilha da mesma bala soma; sem ela, vaga nova `freshId`). */
export function mochilaComBalasDeVolta(mochila: readonly CarriedItem[], balaId: string, n: number, acervo: Pick<AcervoDaMochila, 'paraDar'>, freshId: string): CarriedItem[] {
  const bala = acervo.paraDar(balaId) ?? balaSemAcervo(balaId)
  // Munição sempre empilha: as balas do pente voltam numa vaga só, mesmo se o Acervo esqueceu a pilha.
  const recebeu = mochilaComItemDoAcervo(mochila, { ...bala, empilhavel: true }, n, freshId)
  return recebeu === null ? [...mochila] : recebeu.mochila
}

/** A vaga sem o pente (ausente = vazio, como no disco). */
function semPente(vaga: CarriedItem): CarriedItem {
  const { pente: _pente, ...resto } = vaga
  return resto
}

/** A mochila depois de devolver as balas do pente da arma `armaVagaId` (`devolvidas` = quantas). */
export interface PenteDevolvido {
  mochila: CarriedItem[]
  devolvidas: number
}

/**
 * A8: as balas do pente da arma voltam para a mochila de quem tinha, e a arma fica vazia. Sem pente
 * (ou a vaga já saiu): a mesma mochila, 0 devolvidas.
 */
export function mochilaComOPenteDevolvido(mochila: readonly CarriedItem[], armaVagaId: string, acervo: Pick<AcervoDaMochila, 'paraDar'>, freshId: string): PenteDevolvido {
  const arma = mochila.find((item) => item.id === armaVagaId)
  if (arma?.pente === undefined) return { mochila: [...mochila], devolvidas: 0 }
  const vazia = mochila.map((item) => (item === arma ? semPente(item) : item))
  if (arma.pente.n < 1) return { mochila: vazia, devolvidas: 0 }
  return { mochila: mochilaComBalasDeVolta(vazia, arma.pente.balaId, arma.pente.n, acervo, freshId), devolvidas: arma.pente.n }
}

/** A arma como ela SAI da mochila (dada, vendida, largada): vazia e guardada. A outra vaga, igual. */
export function vagaQueSai(vaga: CarriedItem): CarriedItem {
  return vaga.pente === undefined && vaga.equipado !== true ? vaga : semPente(guardada(vaga))
}

/** O Recarregar que deu: quantas entraram no pente e quantas da bala de antes voltaram à mochila. */
export interface Recarregada {
  mochila: CarriedItem[]
  entraram: number
  /** Trocar de bala: as do pente de antes, de volta à mochila (0 = mesma bala ou pente vazio). */
  devolvidas: number
}

/**
 * RECARREGAR FORA DA BATALHA: na hora, sem gastar ação nem rodada. Tira da vaga da bala `balaVagaId`
 * quantas cabem no pente da arma `armaVagaId` (até a capacidade do Acervo) e põe no pente. Bala de
 * outro tipo no pente: volta inteira para a mochila antes (decisão 2: um tipo de bala por vez).
 * `freshId` = a vaga nova, se a bala de antes não tem mais pilha.
 */
export function recarregarForaDaBatalha(mochila: readonly CarriedItem[], armaVagaId: string, balaVagaId: string, acervo: AcervoDaMochila, freshId: string): Recarregada | Recusa {
  const arma = mochila.find((item) => item.id === armaVagaId)
  const bala = mochila.find((item) => item.id === balaVagaId)
  if (arma === undefined || bala === undefined) return { recusa: SAIU_DA_MOCHILA }
  const pente = penteDaArma(arma, acervo)
  if (pente === null) return { recusa: `${arma.nome} não tem pente: diga no Acervo quantas balas cabem.` }
  const balaId = bala.itemId
  if (balaId === undefined || tipoDaVaga(bala, acervo) !== 'municao') return { recusa: `${bala.nome} não é munição.` }
  if (pente.aceita.length > 0 && !pente.aceita.includes(balaId)) return { recusa: `${arma.nome} não aceita ${bala.nome}.` }
  const atual = arma.pente
  const mesmaBala = atual !== undefined && atual.balaId === balaId
  const noPente = mesmaBala ? atual.n : 0
  const espaco = pente.capacidade - noPente
  if (espaco < 1) return { recusa: `O pente de ${arma.nome} já está cheio (${noPente} de ${pente.capacidade}).` }
  const entram = Math.min(espaco, quantidadeDe(bala))
  // 1º devolve a bala de outro tipo (pode somar na pilha dela, nunca na da bala que entra: ids diferentes).
  const trocada = !mesmaBala && atual !== undefined ? mochilaComOPenteDevolvido(mochila, armaVagaId, acervo, freshId) : { mochila: [...mochila], devolvidas: 0 }
  const resta = quantidadeDe(bala) - entram
  // Rodada 3 (28/11/2026): a regra da bala vai junto para o pente; a vaga dela some quando entram todas, e sem o
  // Acervo (o Worker do Lobby, o jogador) o tiro só a acha aqui. A da vaga é a cópia mais nova; sem ela, a que o pente já tinha.
  const regra = bala.regra ?? (mesmaBala ? atual.regra : undefined)
  const novoPente: PenteDaVaga = { balaId, n: noPente + entram, ...(regra === undefined ? {} : { regra }), nome: bala.nome }
  const recarregada = trocada.mochila.flatMap((item): CarriedItem[] => {
    if (item.id === armaVagaId) return [{ ...item, pente: novoPente }]
    if (item.id !== balaVagaId) return [item]
    if (resta < 1) return []
    const { quantidade: _antes, ...semQuantidade } = item
    return [resta > 1 ? { ...semQuantidade, quantidade: resta } : semQuantidade]
  })
  return { mochila: recarregada, entraram: entram, devolvidas: trocada.devolvidas }
}

/**
 * O PENTE À MÃO (correção de mesa, só o mestre): o pente da arma `armaVagaId` fica com `n` balas, de 0
 * à capacidade, sem tirar nem pôr nada na mochila. A bala é a que o pente já tem; vazio, a primeira que
 * a arma aceita (sem lista, a primeira munição da mochila). 0 = sem o campo, como o último tiro deixa.
 */
export function mochilaComPenteAjustado(mochila: readonly CarriedItem[], armaVagaId: string, n: number, acervo: Pick<AcervoDaMochila, 'item'>): CarriedItem[] | Recusa {
  const arma = mochila.find((item) => item.id === armaVagaId)
  if (arma === undefined) return { recusa: SAIU_DA_MOCHILA }
  const pente = penteDaArma(arma, acervo)
  if (pente === null) return { recusa: `${arma.nome} não tem pente: diga no Acervo quantas balas cabem.` }
  if (!Number.isInteger(n) || n < 0 || n > pente.capacidade) return { recusa: `O pente de ${arma.nome} vai de 0 a ${pente.capacidade}.` }
  if (n === 0) return mochila.map((item) => (item === arma ? semPente(item) : item))
  const balaId = arma.pente?.balaId ?? pente.aceita[0] ?? balasParaOPente(mochila, armaVagaId, acervo)[0]?.itemId
  if (balaId === undefined) return { recusa: `Diga no Acervo que bala ${arma.nome} aceita: sem ela, o pente não sabe o que leva.` }
  // Rodada 3: a regra da bala segue no pente (a que ele já tinha; vazio, a da vaga da bala), para quem joga sem o Acervo.
  const daMochila = mochila.find((item) => item.itemId === balaId)
  const copia: BalaNoPente = arma.pente?.balaId === balaId ? { regra: arma.pente.regra, nome: arma.pente.nome } : { regra: daMochila?.regra, nome: daMochila?.nome }
  const ajustado: PenteDaVaga = { balaId, n, ...(copia.regra === undefined ? {} : { regra: copia.regra }), ...(copia.nome === undefined ? {} : { nome: copia.nome }) }
  return mochila.map((item) => (item === arma ? { ...item, pente: ajustado } : item))
}

/**
 * O DESFAZER de uma mudança que mexeu em várias vagas (Recarregar, Equipar, Dar): cada vaga que
 * mudou entre `antes` e `depois` volta a ser a de `antes`, sobre a mochila de AGORA (o resto do que
 * mudou depois fica). Vaga que nasceu na mudança sai; a que sumiu volta no fim.
 */
export function mochilaDesfeita(agora: readonly CarriedItem[], antes: readonly CarriedItem[], depois: readonly CarriedItem[]): CarriedItem[] {
  const porIdAntes = new Map(antes.map((vaga) => [vaga.id, vaga]))
  const porIdDepois = new Map(depois.map((vaga) => [vaga.id, vaga]))
  const mudaram = new Set([...antes, ...depois].map((vaga) => vaga.id).filter((id) => porIdAntes.get(id) !== porIdDepois.get(id)))
  let mochila = [...agora]
  for (const id of mudaram) {
    const deAntes = porIdAntes.get(id)
    const existe = mochila.some((vaga) => vaga.id === id)
    if (deAntes === undefined) mochila = mochila.filter((vaga) => vaga.id !== id)
    else mochila = existe ? mochila.map((vaga) => (vaga.id === id ? deAntes : vaga)) : [...mochila, deAntes]
  }
  return mochila
}

/** As vagas de munição que a arma aceita, na ordem da mochila: as opções do Recarregar. */
export function balasParaOPente(mochila: readonly CarriedItem[], armaVagaId: string, acervo: Pick<AcervoDaMochila, 'item'>): CarriedItem[] {
  const arma = mochila.find((item) => item.id === armaVagaId)
  const pente = arma === undefined ? null : penteDaArma(arma, acervo)
  if (pente === null) return []
  return mochila.filter((vaga) => vaga.itemId !== undefined && tipoDaVaga(vaga, acervo) === 'municao' && (pente.aceita.length === 0 || pente.aceita.includes(vaga.itemId)))
}
