import type { CarriedItem } from '../../types/map'
import { cabeAcao, gastarAcao } from '../../lib/batalha/acoes'
import { combateVazio, type AcaoDaTecnica } from '../../lib/batalha/combate'
import { acoesDaCarta } from '../../lib/batalha/golpe'
import { armasDe, type ArmaDaFicha } from '../../lib/batalha/leituraDaFicha'
import type { MesaDaBatalha } from '../../lib/batalha/mesa'
import { fichaComAMochilaDoBoneco } from '../../lib/batalha/municaoDaFicha'
import { acaoDaRecarga, mochilaComBalasNoPente, mochilaComTiroDoPente, recargaDoPente, textoDoGastoDaRecarga } from '../../lib/batalha/penteNaBatalha'
import type { RegrasDaBatalha } from '../../lib/batalha/regrasDoCampo'
import type { Reversao } from '../../lib/batalha/registro'
import type { CartaDaOrdem, GastoDaVez, TurnosDaCena } from '../../lib/batalha/turnos'
import { mochilaDesfeita } from '../../lib/mochila/armaNaMochila'
import { fichaComMochila } from '../../lib/mochila/juncao'
import { moedasDe } from '../../lib/troca'

/**
 * O PENTE NA MESA DA BATALHA (docs/design/itens-rework/PLANO.md, etapa E6a; decisões 2, 3 e 11): o
 * tiro gasta do pente, o pente zerado recarrega sozinho da mochila (agora, se a ação da recarga ainda
 * cabe na vez; senão no começo da próxima vez de quem tem a arma, gastando a ação daquela vez) e a
 * espera do "Tempo de recarga" mora em `combate.recargas` da arma (desce no começo de cada vez dele).
 * A mochila é a da ficha, ou a do boneco na aventura que ainda não migrou (`mochilaDoBoneco`).
 */

const GASTO_ZERO: GastoDaVez = { simples: 0, movimento: 0, bonus: 0, blocos: 0 }

/** A mochila que a mesa mudou, para a reversão: como estava, como ficou e, na aventura não migrada, o boneco dono. */
interface MochilaMudada {
  antes: readonly CarriedItem[]
  depois: readonly CarriedItem[]
  tokenId?: string
}

/** A mochila da FICHA, pela mesa. `mudar` devolve `null` = nada a mudar; `'recusada'` = a mesa não gravou. */
function mudarDaFicha(mesa: MesaDaBatalha, personagemId: string, mudar: (mochila: readonly CarriedItem[]) => CarriedItem[] | null): MochilaMudada | null | 'recusada' {
  // Num objeto: o que o callback da mesa escreve, lido depois dele (um `let` o TS estreitaria para `null`).
  const feito: { mudada: MochilaMudada | null } = { mudada: null }
  const ok = mesa.ajustarPersonagem(personagemId, (atual) => {
    const antes = atual.mochila ?? []
    const depois = mudar(antes)
    if (depois === null) return atual
    feito.mudada = { antes, depois }
    return fichaComMochila(atual, depois, moedasDe(atual))
  })
  const { mudada } = feito
  if (mudada === null) return null
  return ok ? mudada : 'recusada'
}

/** Muda a mochila dona pela mesa: a do boneco (aventura não migrada), senão a da ficha. */
function mudarMochilaNaMesa(mesa: MesaDaBatalha, sceneKey: string, tokenId: string, personagemId: string, mudar: (mochila: readonly CarriedItem[]) => CarriedItem[] | null): MochilaMudada | null | 'recusada' {
  const doBoneco = mesa.mochilaDoBoneco?.(sceneKey, tokenId) ?? null
  if (doBoneco === null) return mudarDaFicha(mesa, personagemId, mudar)
  const depois = mudar(doBoneco)
  if (depois === null) return null
  if (mesa.gravarMochilaDoBoneco?.(sceneKey, tokenId, depois) !== true) return 'recusada'
  return { antes: doBoneco, depois, tokenId }
}

/** A arma `armaId` como a batalha a lê agora, com a mochila dona (a do boneco, na aventura não migrada). */
export function armaNaMesa(mesa: MesaDaBatalha, sceneKey: string, tokenId: string, personagemId: string, armaId: string): ArmaDaFicha | undefined {
  const ficha = mesa.personagens().find((candidato) => candidato.id === personagemId)
  if (ficha === undefined) return undefined
  const doBoneco = mesa.mochilaDoBoneco?.(sceneKey, tokenId) ?? null
  return armasDe(fichaComAMochilaDoBoneco(ficha, doBoneco)).find((arma) => arma.id === armaId)
}

/**
 * O TIRO da arma de pente: tira 1 do pente pela mesa. `null` = a arma não é de pente ou o pente está
 * vazio (o `podeAgir` já recusou); `'recusada'` = a mesa não gravou, e o tiro não sai.
 */
export function gastarDoPenteNaMesa(mesa: MesaDaBatalha, sceneKey: string, tokenId: string, personagemId: string, armaId: string): Reversao | null | 'recusada' {
  const pente = armaNaMesa(mesa, sceneKey, tokenId, personagemId, armaId)?.pente
  if (pente === undefined) return null
  const tiro: { balaId: string | null } = { balaId: null }
  const mudada = mudarMochilaNaMesa(mesa, sceneKey, tokenId, personagemId, (mochila) => {
    const feito = mochilaComTiroDoPente(mochila, pente.vagaId)
    tiro.balaId = feito?.balaId ?? null
    return feito?.mochila ?? null
  })
  if (mudada === 'recusada') return 'recusada'
  if (mudada === null || tiro.balaId === null) return null
  return { tipo: 'pente', personagemId, armaVagaId: pente.vagaId, balaId: tiro.balaId, n: 1, ...(mudada.tokenId === undefined ? {} : { tokenId: mudada.tokenId }) }
}

/** O DESFAZER do tiro do pente: as balas voltam ao pente, sobre a mochila de agora. `false` = não deu (a mesa recusou ou o pente mudou de bala). */
export function devolverAoPenteNaMesa(mesa: MesaDaBatalha, sceneKey: string, reversao: Extract<Reversao, { tipo: 'pente' }>): boolean {
  const { personagemId, armaVagaId, balaId, n, tokenId } = reversao
  const mudar = (mochila: readonly CarriedItem[]) => mochilaComBalasNoPente(mochila, armaVagaId, balaId, n)
  const feito = tokenId === undefined ? mudarDaFicha(mesa, personagemId, mudar) : mudarMochilaNaMesa(mesa, sceneKey, tokenId, personagemId, mudar)
  return feito !== null && feito !== 'recusada'
}

/** O DESFAZER da recarga: cada vaga que ela mudou volta à de antes, sobre a mochila de agora. */
export function desfazerMochilaNaMesa(mesa: MesaDaBatalha, sceneKey: string, reversao: Extract<Reversao, { tipo: 'mochila' }>): boolean {
  const { personagemId, antes, depois, tokenId } = reversao
  const mudar = (mochila: readonly CarriedItem[]) => mochilaDesfeita(mochila, antes, depois)
  const feito = tokenId === undefined ? mudarDaFicha(mesa, personagemId, mudar) : mudarMochilaNaMesa(mesa, sceneKey, tokenId, personagemId, mudar)
  return feito !== null && feito !== 'recusada'
}

/** O que a recarga da mesa fez: os turnos com a ação gasta e a espera, as reversões e a frase do registro. */
export interface RecargaNaMesa {
  turnos: TurnosDaCena
  partes: Reversao[]
  texto: string | null
}

/** O que a recarga precisa saber da vez de quem tem a arma. */
export interface VezDaRecarga {
  carta: CartaDaOrdem
  /** A chave do gasto da vez (a carta, ou o invocado do bando). */
  chaveDoGasto: string
  regras: RegrasDaBatalha | null
}

/** A ação `acao` cabe no que sobrou da vez de quem tem a arma (a Livre cabe sempre)? */
export function cabeNaVez(mesa: MesaDaBatalha, vez: VezDaRecarga, turnos: TurnosDaCena, acao: AcaoDaTecnica): boolean {
  const { carta, chaveDoGasto, regras } = vez
  const personagemId = carta.personagemId
  const ficha = personagemId === null ? undefined : mesa.personagens().find((candidato) => candidato.id === personagemId)
  if (ficha === undefined) return false
  const gasto = turnos.gastos[chaveDoGasto]
  const acoes = acoesDaCarta({ turnos: { ...turnos, gastos: { ...turnos.gastos, [carta.id]: gasto ?? GASTO_ZERO } }, carta, personagem: ficha, sistema: mesa.sistema(), regras })
  return cabeAcao(acoes, acao)
}

/** A ação `acao` gasta na vez (`chaveDoGasto`): os turnos e a parte do Desfazer. A Livre não gasta nada. */
export function gastarNaVez(turnos: TurnosDaCena, chaveDoGasto: string, acao: AcaoDaTecnica): { turnos: TurnosDaCena; partes: Reversao[] } {
  if (acao === 'livre') return { turnos, partes: [] }
  const gasto = turnos.gastos[chaveDoGasto]
  return { turnos: { ...turnos, gastos: { ...turnos.gastos, [chaveDoGasto]: gastarAcao(gasto ?? GASTO_ZERO, acao) } }, partes: [{ tipo: 'gasto', cartaId: chaveDoGasto, antes: gasto ?? null }] }
}

/** A espera de `rodadas` na arma `armaId` de `personagemId` (desce no começo de cada vez dele): os turnos e a parte do Desfazer. */
export function esperaNaArma(turnos: TurnosDaCena, personagemId: string, armaId: string, rodadas: number): { turnos: TurnosDaCena; partes: Reversao[] } {
  if (rodadas < 1) return { turnos, partes: [] }
  const antes = turnos.combate?.[personagemId] ?? null
  const depois = { ...(antes ?? combateVazio()), recargas: { ...(antes?.recargas ?? {}), [armaId]: rodadas } }
  return { turnos: { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: depois } }, partes: [{ tipo: 'combate', personagemId, antes, depois }] }
}

/**
 * Recarrega a arma `armaId` agora, se a ação da recarga cabe no que sobrou da vez dela: a bala sai da
 * mochila, o pente enche, a ação é gasta e a espera do "Tempo de recarga" começa. `null` = não coube
 * (ou não havia o que recarregar); `'recusada'` = a mesa não gravou.
 */
function recarregarSeCouber(mesa: MesaDaBatalha, sceneKey: string, vez: VezDaRecarga, turnos: TurnosDaCena, arma: ArmaDaFicha): RecargaNaMesa | null | 'recusada' {
  const { carta, chaveDoGasto } = vez
  const pente = arma.pente
  const personagemId = carta.personagemId
  const ficha = personagemId === null ? undefined : mesa.personagens().find((candidato) => candidato.id === personagemId)
  if (pente === undefined || personagemId === null || ficha === undefined) return null
  const acao = acaoDaRecarga(pente.recarga)
  const gasto = turnos.gastos[chaveDoGasto]
  if (!cabeNaVez(mesa, vez, turnos, acao)) return null
  const feita: { recarga: ReturnType<typeof recargaDoPente> } = { recarga: null }
  const mudada = mudarMochilaNaMesa(mesa, sceneKey, carta.tokenId, personagemId, (mochila) => {
    feita.recarga = recargaDoPente(mochila, pente.vagaId, pente.balaId, `vaga_${crypto.randomUUID()}`)
    return feita.recarga?.mochila ?? null
  })
  const { recarga } = feita
  if (mudada === 'recusada') return 'recusada'
  if (mudada === null || recarga === null) return null
  const partes: Reversao[] = [{ tipo: 'mochila', personagemId, antes: mudada.antes, depois: mudada.depois, ...(mudada.tokenId === undefined ? {} : { tokenId: mudada.tokenId }) }]
  let novos = turnos
  if (acao !== 'livre') {
    partes.push({ tipo: 'gasto', cartaId: chaveDoGasto, antes: gasto ?? null })
    novos = { ...novos, gastos: { ...novos.gastos, [chaveDoGasto]: gastarAcao(gasto ?? GASTO_ZERO, acao) } }
  }
  const rodadas = pente.recarga.rodadas
  if (rodadas > 0) {
    const antes = novos.combate?.[personagemId] ?? null
    const depois = { ...(antes ?? combateVazio()), recargas: { ...(antes?.recargas ?? {}), [arma.id]: rodadas } }
    partes.push({ tipo: 'combate', personagemId, antes, depois })
    novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: depois } }
  }
  const espera = rodadas === 0 ? '' : `; pronta em ${rodadas} ${rodadas === 1 ? 'rodada' : 'rodadas'}`
  const texto = `a mesa recarregou ${arma.nome}: ${recarga.entraram} ${recarga.nome} da mochila para o pente (mochila ${recarga.antes} → ${recarga.depois}; pente ${recarga.entraram} de ${pente.capacidade}; ${textoDoGastoDaRecarga(pente.recarga)}${espera})`
  return { turnos: novos, partes, texto }
}

/**
 * DEPOIS DO TIRO (decisão 3): o pente da arma `armaId` zerou? A mesa recarrega da mochila até onde
 * der, agora se a ação da recarga cabe na vez de quem atirou; senão fica para o começo da próxima vez
 * dele (`recargasNoComecoDaVez`). Pente com bala, ou arma sem pente: nada.
 */
export function recargaDepoisDoTiro(mesa: MesaDaBatalha, sceneKey: string, vez: VezDaRecarga, turnos: TurnosDaCena, armaId: string): RecargaNaMesa | 'recusada' {
  const { carta } = vez
  const nada: RecargaNaMesa = { turnos, partes: [], texto: null }
  if (carta.personagemId === null) return nada
  const arma = armaNaMesa(mesa, sceneKey, carta.tokenId, carta.personagemId, armaId)
  const pente = arma?.pente
  if (arma === undefined || pente === undefined || pente.n > 0) return nada
  if (pente.naMochila < 1) return { ...nada, texto: `pente de ${arma.nome} vazio e nenhuma bala que ela aceita na mochila` }
  // Fora da própria vez (o contra-ataque, a reação) a recarga espera a vez dele.
  const naVez = turnos.vez === carta.id ? recarregarSeCouber(mesa, sceneKey, vez, turnos, arma) : null
  if (naVez !== null) return naVez
  return { ...nada, texto: `pente de ${arma.nome} vazio: a mesa recarrega no começo da próxima vez (${pente.recarga.acao})` }
}

/**
 * NO COMEÇO DA VEZ (decisão 3): cada arma equipada de quem entra com o pente vazio, bala que sirva na
 * mochila e fora da espera recarrega sozinha, gastando a ação da recarga desta vez. A que não cabe
 * (Ação Bônus sem bônus) fica de pente vazio, com o motivo no Atacar.
 */
export function recargasNoComecoDaVez(mesa: MesaDaBatalha, sceneKey: string, vez: VezDaRecarga, turnos: TurnosDaCena): RecargaNaMesa | 'recusada' {
  return recarregarAsVazias(mesa, sceneKey, vez, turnos, () => true, () => null)
}

/**
 * DAR NA BATALHA (itens refeitos, E6b; decisão 9): chegou bala na mochila de quem tem a carta. Cada arma
 * equipada dele com o pente vazio, bala que sirva e fora da espera recarrega agora se a ação da recarga
 * cabe (a Livre a qualquer hora; as outras só na vez dele). A que não cabe fica para o começo da
 * próxima vez dele (`recargasNoComecoDaVez`); `comAEspera` = a frase diz isso.
 */
export function recargaAoReceber(mesa: MesaDaBatalha, sceneKey: string, vez: VezDaRecarga, turnos: TurnosDaCena, comAEspera: boolean): RecargaNaMesa | 'recusada' {
  return recarregarAsVazias(
    mesa,
    sceneKey,
    vez,
    turnos,
    (arma) => turnos.vez === vez.carta.id || (arma.pente !== undefined && acaoDaRecarga(arma.pente.recarga) === 'livre'),
    (arma) => (comAEspera && arma.pente !== undefined ? `pente de ${arma.nome} vazio: a mesa recarrega no começo da próxima vez (${arma.pente.recarga.acao})` : null),
  )
}

/**
 * O miolo das duas: cada arma equipada de quem tem a carta com o pente vazio, bala que sirva na mochila
 * e fora da espera recarrega se `agora` deixa e a ação cabe; a que não recarrega diz `senao`.
 */
function recarregarAsVazias(mesa: MesaDaBatalha, sceneKey: string, vez: VezDaRecarga, turnos: TurnosDaCena, agora: (arma: ArmaDaFicha) => boolean, senao: (arma: ArmaDaFicha) => string | null): RecargaNaMesa | 'recusada' {
  const { carta } = vez
  const personagemId = carta.personagemId
  const nada: RecargaNaMesa = { turnos, partes: [], texto: null }
  if (personagemId === null || carta.bando !== undefined) return nada
  const ficha = mesa.personagens().find((candidato) => candidato.id === personagemId)
  if (ficha === undefined) return nada
  const vazias = armasDe(fichaComAMochilaDoBoneco(ficha, mesa.mochilaDoBoneco?.(sceneKey, carta.tokenId) ?? null)).filter(
    (arma) => arma.pente !== undefined && arma.pente.n === 0 && arma.pente.naMochila > 0 && (turnos.combate?.[personagemId]?.recargas[arma.id] ?? 0) === 0,
  )
  let atual = nada
  const textos: string[] = []
  for (const vazia of vazias) {
    // A arma lida de novo: a recarga de antes pode ter levado a bala que esta também aceita.
    const arma = armaNaMesa(mesa, sceneKey, carta.tokenId, personagemId, vazia.id)
    if (arma?.pente === undefined || arma.pente.naMochila < 1) continue
    const feita = agora(arma) ? recarregarSeCouber(mesa, sceneKey, vez, atual.turnos, arma) : null
    if (feita === 'recusada') return 'recusada'
    if (feita === null) {
      const frase = senao(arma)
      if (frase !== null) textos.push(frase)
      continue
    }
    atual = { turnos: feita.turnos, partes: [...atual.partes, ...feita.partes], texto: null }
    if (feita.texto !== null) textos.push(feita.texto)
  }
  return { ...atual, texto: textos.length === 0 ? null : textos.join(' · ') }
}
