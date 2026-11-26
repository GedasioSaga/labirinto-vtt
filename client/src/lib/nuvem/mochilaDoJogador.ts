import type { CarriedItem } from '../../types/map'
import { limiteDeArmas } from '../batalha/leituraDaFicha'
import { quantidadeDe } from '../items'
import { TIPOS_DE_ARMA } from '../itens/modelo'
import {
  armasEquipadas,
  ehRecusa,
  equiparNaMochila,
  fraseDoLimite,
  guardarNaMochila,
  mochilaComOPenteDevolvido,
  penteDaArma,
  recarregarForaDaBatalha,
  seEquipa,
  tipoDaVaga,
  type AcervoDaMochila,
  type Recusa,
} from '../mochila/armaNaMochila'
import type { Personagem } from '../personagem'
import { quemEscreveAMudanca } from './caminho'
import { diferencas } from './diferencas'
import { jsonIgual } from './json'
import { permissaoNaFichaDoDono } from './permissao'
import type { Mudanca, Papel } from './tipos'

/**
 * A MOCHILA PELO LOBBY (sistema de itens refeito, PLANO §2.3, etapa E5b; A6): o dono equipa, guarda e
 * recarrega fora da batalha pelo site, com as MESMAS regras puras da mochila do mestre
 * (`lib/mochila/armaNaMochila.ts`). Quem não tem o Acervo (o site e o Worker) lê o tipo e o pente da
 * própria vaga (`tipo` e `regra.pente`, que só o mestre grava).
 *
 * Duas pontas:
 * - no SITE, cada pedido vira as mudanças por campo de sempre (`diferencas`), tudo ou nada (`atomico`)
 *   quando são mais de uma: o Recarregar é "pilha desce" + "pente sobe" no mesmo grupo;
 * - no SERVIDOR (`processarLote`, também no Worker), o grupo inteiro do jogador passa por
 *   `recusaNaMochilaDoJogador` antes de gravar: o limite "Armas por batalha", a capacidade e as balas que
 *   a arma aceita, e nenhuma bala nascendo nem sumindo no pente.
 */

/** O Acervo de quem não o tem: o tipo e o pente saem da cópia que o mestre gravou na vaga. */
export const ACERVO_DA_VAGA: AcervoDaMochila = { item: () => undefined, paraDar: () => undefined }

const BALA_SEM_ORIGEM = 'As balas do pente saem da mochila e voltam para ela: nenhuma pode sumir nem aparecer.'
const SEM_PILHA_DO_ACERVO = 'As balas do pente não têm mais pilha na mochila para voltar: faça isso na mesa ou peça ao mestre.'

function ehArma(vaga: CarriedItem): boolean {
  const tipo = tipoDaVaga(vaga, ACERVO_DA_VAGA)
  return tipo !== undefined && TIPOS_DE_ARMA.has(tipo)
}

/** Por bala: as da pilha (vagas com esse `itemId`) mais as dos pentes carregados com ela. */
function totalDaBala(mochila: readonly CarriedItem[], balaId: string): number {
  return mochila.reduce((soma, vaga) => soma + (vaga.itemId === balaId ? quantidadeDe(vaga) : 0) + (vaga.pente?.balaId === balaId ? vaga.pente.n : 0), 0)
}

/**
 * O que o GRUPO de mudanças do jogador fez na mochila da ficha (`antes` -> `depois`) e que o servidor
 * não aceita; `null` = pode. Só olha o que mudou no `equipado` e no `pente`: pôr, tirar e gastar seguem a
 * tabela de sempre (tirar uma arma carregada do site antigo continua valendo, as balas vão junto).
 */
export function recusaNaMochilaDoJogador(antes: Personagem | null, depois: Personagem | null): string | null {
  if (depois === null) return null
  const mochilaAntes = antes?.mochila ?? []
  const mochila = depois.mochila ?? []
  const porIdAntes = new Map(mochilaAntes.map((vaga): [string, CarriedItem] => [vaga.id, vaga]))
  // O limite é o de antes do grupo: mudar o "Armas por batalha" e equipar no mesmo grupo não passa por cima dele.
  return recusaNoEquipar(antes ?? depois, mochilaAntes, porIdAntes, mochila) ?? recusaNoPente(mochilaAntes, porIdAntes, mochila)
}

/**
 * Equipar (decisão 5): só arma, arremesso e equipamento, e as armas param no "Armas por batalha" de
 * `ficha`. A que já estava acima (o mestre baixou o limite) pode trocar uma pela outra, nunca equipar mais.
 */
function recusaNoEquipar(ficha: Personagem, mochilaAntes: readonly CarriedItem[], porIdAntes: ReadonlyMap<string, CarriedItem>, mochila: readonly CarriedItem[]): string | null {
  const novas = mochila.filter((vaga) => vaga.equipado === true && porIdAntes.get(vaga.id)?.equipado !== true)
  const naoSeEquipa = novas.find((vaga) => !seEquipa(vaga, ACERVO_DA_VAGA))
  if (naoSeEquipa !== undefined) return `${naoSeEquipa.nome} não se equipa: só arma, arremesso e equipamento.`
  const arma = novas.find(ehArma)
  const limite = limiteDeArmas(ficha)
  if (arma === undefined || limite === null) return null
  const agora = armasEquipadas(mochila, ACERVO_DA_VAGA)
  return agora > limite && agora > armasEquipadas(mochilaAntes, ACERVO_DA_VAGA) ? fraseDoLimite(ficha.nome, limite, arma.nome) : null
}

/** O pente carregado da vaga cabe nela: arma com pente, até a capacidade, bala que ela aceita. */
function recusaNoPenteDaVaga(vaga: CarriedItem): string | null {
  const carregado = vaga.pente
  if (carregado === undefined) return null
  const pente = penteDaArma(vaga, ACERVO_DA_VAGA)
  if (pente === null) return `${vaga.nome} não tem pente.`
  if (carregado.n > pente.capacidade) return `O pente de ${vaga.nome} leva no máximo ${pente.capacidade}.`
  if (pente.aceita.length > 0 && !pente.aceita.includes(carregado.balaId)) return `${vaga.nome} não aceita essa munição.`
  return null
}

/**
 * O pente (decisão 2 e A8): cada vaga que ficou com o pente mudado cabe nele, e por bala envolvida a
 * soma das pilhas com a dos pentes é a mesma antes e depois. Recarregar = a pilha desce o que o pente
 * sobe; trocar de bala = as de antes voltam à pilha delas. Mandado sozinho (sem a pilha junto), o pente
 * cheio faria bala nascer, e é recusado.
 */
function recusaNoPente(mochilaAntes: readonly CarriedItem[], porIdAntes: ReadonlyMap<string, CarriedItem>, mochila: readonly CarriedItem[]): string | null {
  const mudaram = mochila.filter((vaga) => !jsonIgual(vaga.pente, porIdAntes.get(vaga.id)?.pente))
  for (const vaga of mudaram) {
    const recusa = recusaNoPenteDaVaga(vaga)
    if (recusa !== null) return recusa
  }
  const balas = new Set(mudaram.flatMap((vaga) => [vaga.pente?.balaId, porIdAntes.get(vaga.id)?.pente?.balaId]).filter((balaId): balaId is string => balaId !== undefined))
  for (const balaId of balas) {
    if (totalDaBala(mochilaAntes, balaId) !== totalDaBala(mochila, balaId)) return BALA_SEM_ORIGEM
  }
  return null
}

// ── O pedido do dono no site: as mudanças, ou a frase de por que não dá ──────

/** As mudanças do pedido (tudo ou nada quando são várias), ou a recusa que o servidor daria. */
export type PedidoNaMochila = { mudancas: Mudanca[] } | Recusa

/**
 * A ficha com a mochila nova vira as mudanças por campo (`diferencas`). Cada uma passa ANTES pela
 * permissão do dono que o servidor confere (a vaga nova ligada ao Acervo, a pilha com efeito que sobe):
 * o site mostra a frase em vez de mandar um grupo que voltaria recusado. O mestre no site escreve em tudo.
 */
function pedidoDaMochila(ficha: Personagem, papel: Papel, nova: readonly CarriedItem[]): PedidoNaMochila {
  const mudancas = diferencas(ficha, { ...ficha, mochila: [...nova] })
  if (papel !== 'mestre' && mudancas.some((mudanca) => quemEscreveAMudanca(mudanca) === 'mestre')) return { recusa: SEM_PILHA_DO_ACERVO }
  for (const mudanca of papel === 'mestre' ? [] : mudancas) {
    const veredito = permissaoNaFichaDoDono(ficha, mudanca)
    if (!veredito.ok) return { recusa: veredito.detalhe }
  }
  return { mudancas: mudancas.length > 1 ? mudancas.map((mudanca): Mudanca => ({ ...mudanca, atomico: true })) : mudancas }
}

/** Equipar a vaga, no limite "Armas por batalha" da ficha. */
export function pedidoDeEquipar(ficha: Personagem, papel: Papel, vagaId: string): PedidoNaMochila {
  const nova = equiparNaMochila(ficha.mochila ?? [], vagaId, limiteDeArmas(ficha), ficha.nome, ACERVO_DA_VAGA)
  return ehRecusa(nova) ? nova : pedidoDaMochila(ficha, papel, nova)
}

/** Guardar a vaga: deixa de estar em uso; o pente fica. */
export function pedidoDeGuardar(ficha: Personagem, papel: Papel, vagaId: string): PedidoNaMochila {
  const nova = guardarNaMochila(ficha.mochila ?? [], vagaId)
  return ehRecusa(nova) ? nova : pedidoDaMochila(ficha, papel, nova)
}

/** Recarregar fora da batalha com a pilha `balaVagaId`; `vagaNova` = o id da pilha que as balas de antes ganhariam. */
export function pedidoDeRecarregar(ficha: Personagem, papel: Papel, armaVagaId: string, balaVagaId: string, vagaNova: string): PedidoNaMochila {
  const feita = recarregarForaDaBatalha(ficha.mochila ?? [], armaVagaId, balaVagaId, ACERVO_DA_VAGA, vagaNova)
  return ehRecusa(feita) ? feita : pedidoDaMochila(ficha, papel, feita.mochila)
}

/** Tirar a vaga da mochila; a arma devolve antes as balas do pente à pilha delas (A8). */
export function pedidoDeTirar(ficha: Personagem, papel: Papel, vagaId: string, vagaNova: string): PedidoNaMochila {
  const devolvido = mochilaComOPenteDevolvido(ficha.mochila ?? [], vagaId, ACERVO_DA_VAGA, vagaNova)
  return pedidoDaMochila(ficha, papel, devolvido.mochila.filter((vaga) => vaga.id !== vagaId))
}
