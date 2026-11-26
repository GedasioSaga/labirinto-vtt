import { fraseDoLimite } from '../lib/mochila/armaNaMochila'
import { ROTULO_DO_TIPO, TIPOS_COM_PENTE, TIPOS_DE_ARMA, TIPOS_QUE_EQUIPAM } from '../lib/itens/modelo'
import type { InventoryCharacter, InventorySlot } from './inventario'

/**
 * AS AÇÕES DA VAGA NA TELA DO JOGADOR (sistema de itens refeito, PLANO §3 E5a, protótipo aprovado
 * "Tela do jogador"): o que o jogador pode fazer com cada vaga, pelo TIPO do item, e por que um
 * botão está desligado. Puras: sem DOM e sem rede. Quem confere de verdade é o host (E5b): aqui só
 * se evita oferecer o que ele recusaria com certeza.
 *
 * Pode: equipar e guardar (respeitando as "Armas por batalha"), recarregar, jogar, usar em si ou num
 * colega, acender e apagar, dar com a quantidade, largar no chão e ver o cartão inteiro. Só o mestre:
 * criar e editar itens, tirar da mochila sem largar, mexer em vida, Escudo e condições.
 */

export type AcaoDaVaga = 'equipar' | 'guardar' | 'recarregar' | 'jogar' | 'usar' | 'acender' | 'apagar'

/** Uma ação do tipo da vaga: o rótulo do botão e, desligada, o motivo que o jogador lê ao lado. */
export interface OpcaoDaVaga {
  acao: AcaoDaVaga
  rotulo: string
  motivo: string | null
  /** A ação do Enter (a primeira principal sem motivo). */
  principal: boolean
}

/** A frase de quem não tem regra: o mestre narra (decisão 12). */
export const SEM_REGRA = 'Sem regra no Acervo: diga ao mestre o que quer fazer com ele.'

/** O nome do tipo, para o cartão ("De fogo", "Consumível"); vaga de antes da conversão não diz. */
export function rotuloDoTipo(slot: Pick<InventorySlot, 'tipo'>): string | null {
  return slot.tipo === undefined ? null : ROTULO_DO_TIPO[slot.tipo]
}

/** A vaga é arma que conta no "Armas por batalha" (a roupa não conta, decisão 5). */
function ehArma(slot: Pick<InventorySlot, 'tipo'>): boolean {
  return slot.tipo !== undefined && TIPOS_DE_ARMA.has(slot.tipo)
}

/** Quantas armas a ficha tem equipadas agora (a pilha de granadas conta 1). */
export function armasEquipadasNaTela(slots: readonly InventorySlot[]): number {
  return slots.filter((slot) => slot.equipado && ehArma(slot)).length
}

/** As vagas de munição que a arma aceita, na ordem da grade: as opções do Recarregar. */
export function balasParaAArma(arma: InventorySlot, slots: readonly InventorySlot[]): InventorySlot[] {
  const aceitas = new Set(arma.aceita.map((m) => m.itemId))
  return slots.filter((slot) => slot.kind === 'item' && slot.tipo === 'municao' && slot.acervoId !== undefined && (aceitas.size === 0 || aceitas.has(slot.acervoId)))
}

/** O pente para ler: "3 de 6 Bala de Prata", "3 Bala de Prata" (sem a regra na vaga), "vazio". */
export function textoDoPente(slot: Pick<InventorySlot, 'pente' | 'capacidade'>): string {
  const pente = slot.pente
  const cabe = slot.capacidade === undefined ? '' : ` de ${slot.capacidade}`
  if (pente === undefined || pente.n < 1) return slot.capacidade === undefined ? 'Pente vazio' : `Pente vazio (cabem ${slot.capacidade})`
  return `Pente: ${pente.n}${cabe}${pente.bala === null ? '' : ` ${pente.bala}`}`
}

/** O pente está cheio — só dá para saber quando a vaga traz a capacidade. */
function penteCheio(slot: Pick<InventorySlot, 'pente' | 'capacidade'>): boolean {
  return slot.capacidade !== undefined && slot.pente !== undefined && slot.pente.n >= slot.capacidade
}

function motivoDoEquipar(slot: InventorySlot, character: Pick<InventoryCharacter, 'name' | 'slots' | 'limiteDeArmas'>): string | null {
  if (slot.equipado || !ehArma(slot) || character.limiteDeArmas === null) return null
  return armasEquipadasNaTela(character.slots) >= character.limiteDeArmas ? fraseDoLimite(character.name, character.limiteDeArmas, slot.nome) : null
}

function motivoDoRecarregar(slot: InventorySlot, slots: readonly InventorySlot[]): string | null {
  if (penteCheio(slot)) return 'O pente está cheio'
  if (balasParaAArma(slot, slots).length === 0) return 'Nenhuma bala que ela aceita na mochila'
  return null
}

/** O item tem regra para o "Usar": a frase do efeito que viaja com a vaga (decisão C8). */
export function temEfeito(slot: Pick<InventorySlot, 'efeitoResumo'>): boolean {
  return slot.efeitoResumo !== undefined && slot.efeitoResumo.trim() !== ''
}

/**
 * As ações do TIPO da vaga, na ordem do protótipo (Equipar, Recarregar, Jogar, Usar, Acender). Dar e
 * Largar valem para todo item e ficam fora daqui (a tela os desenha sempre). Bolsa: nenhuma.
 */
export function opcoesDaVaga(slot: InventorySlot, character: Pick<InventoryCharacter, 'name' | 'slots' | 'limiteDeArmas'>): OpcaoDaVaga[] {
  if (slot.kind === 'moedas') return []
  const tipo = slot.tipo
  const opcoes: OpcaoDaVaga[] = []
  if (tipo !== undefined && TIPOS_QUE_EQUIPAM.has(tipo)) {
    opcoes.push(slot.equipado ? { acao: 'guardar', rotulo: 'Guardar', motivo: null, principal: true } : { acao: 'equipar', rotulo: 'Equipar', motivo: motivoDoEquipar(slot, character), principal: true })
  }
  if (tipo !== undefined && TIPOS_COM_PENTE.has(tipo)) {
    opcoes.push({ acao: 'recarregar', rotulo: 'Recarregar', motivo: motivoDoRecarregar(slot, character.slots), principal: false })
  }
  if (tipo === 'arremesso') opcoes.push({ acao: 'jogar', rotulo: `Jogar ${slot.nome}`, motivo: 'Só na batalha, pelo Atacar', principal: false })
  // Consumível com regra, ou item de antes com efeito (o "Usar" da Fase 8 já valia para ele).
  if ((tipo === 'consumivel' || tipo === undefined) && temEfeito(slot)) opcoes.push({ acao: 'usar', rotulo: 'Usar em mim ou num colega', motivo: null, principal: true })
  if (slot.luz !== undefined) {
    const acesa = slot.luz.acesa
    opcoes.push({ acao: acesa ? 'apagar' : 'acender', rotulo: acesa ? 'Apagar' : 'Acender', motivo: null, principal: opcoes.length === 0 })
  }
  return opcoes
}

/** O item não tem o que fazer pela regra: a tela diz "diga ao mestre" (só em item sem regra). */
export function semRegra(slot: InventorySlot): boolean {
  if (slot.kind === 'moedas') return false
  // O pego de pino de antes (sem tipo) já tem a linha do que fazer no texto do cartão (`slotFallbackLine`).
  if (slot.tipo === 'consumivel') return !temEfeito(slot)
  return slot.tipo === 'outros' && slot.luz === undefined
}

/** O que o cartão diz do estado da vaga: "Equipado. Pente: 3 de 6 Bala de Prata. Aceso." */
export function estadoDaVaga(slot: InventorySlot): string {
  const partes: string[] = []
  if (slot.equipado) partes.push(slot.tipo === 'equipamento' ? 'Vestido' : 'Equipado')
  if (slot.tipo !== undefined && TIPOS_COM_PENTE.has(slot.tipo)) partes.push(textoDoPente(slot))
  if (slot.luz?.acesa === true) partes.push('Aceso')
  return partes.length === 0 ? '' : `${partes.join('. ')}.`
}

/** A frase do que deu certo, para a linha de status (o mapa novo traz a mochila mudada). */
export function fraseDoFeito(acao: 'equipar' | 'guardar' | 'recarregar' | 'largar', nome: string, quantidade = 1): string {
  switch (acao) {
    case 'equipar':
      return `${nome}: equipado.`
    case 'guardar':
      return `${nome}: guardado.`
    case 'recarregar':
      return `${nome}: recarregada.`
    case 'largar':
      return quantidade > 1 ? `Você largou ${quantidade} ${nome} no chão.` : `Você largou ${nome} no chão.`
  }
}
