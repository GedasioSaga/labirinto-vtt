import { aplicarAjustes, type Ajuste } from '../lib/ajusteDaFicha'
import { fichaComAMochilaDoBoneco } from '../lib/batalha/municaoDaFicha'
import { fichasQueRecebem, resolverUsoFora, textoDoUsoFora, type FichaQueRecebe } from '../lib/mochila/usarItemFora'
import { fichaComMochila } from '../lib/mochila/juncao'
import { mochilaSemAMudanca } from '../lib/mochila/editarVaga'
import { numeroDaFicha, type Personagem } from '../lib/personagem'
import { moedasDe } from '../lib/troca'
import type { CarriedItem, Token } from '../types/map'
import { mesaDaAventura } from './mesaDaAventura'

/**
 * O "USAR" FORA DA BATALHA NA MESA DO MESTRE (SISTEMA.md §5.2, Fase 8): lê a
 * cópia do mestre (a ficha, a mochila de agora, o token na cena), resolve
 * (`lib/mochila/usarItemFora.ts`) e grava: o gasto pela mochila (a da ficha,
 * ou a do boneco na aventura que não migrou), a cura pelo funil da ficha, as
 * condições pelo token. O mesmo para o "Usar" do mestre e para o pedido do
 * jogador, que o host confere antes (a ficha é dele) e manda para cá.
 */

export interface PedidoDeUsoFora {
  sceneKey: string
  /** O token de quem usa (o dono da mochila na aventura que não migrou). */
  tokenId: string
  personagemId: string
  vagaId: string
  alvoPersonagemId: string
  /** Quem aparece no histórico da ficha ("Mestre", o nome do jogador). */
  quem: string
}

export type FeitoDoUsoFora = { ok: true; texto: string; desfazer: () => boolean } | { ok: false; motivo: string }

/** Os ajustes de recurso que levam `antes` a `depois`, com o `de` (o número de partida) para não pisar em mudança do meio. */
function ajustesEntre(antes: Personagem, depois: Personagem): Ajuste[] {
  const chaves = new Set([...Object.keys(antes.recursos), ...Object.keys(depois.recursos)])
  return [...chaves].flatMap((chave): Ajuste[] => {
    const de = numeroDaFicha(antes.recursos, chave)
    const valor = numeroDaFicha(depois.recursos, chave)
    return de === valor ? [] : [{ parte: 'recurso', chave, valor, de }]
  })
}

/** O inverso: volta ao número de antes (pela diferença, se outra mudança entrou no meio). */
function inversos(ajustes: readonly Ajuste[]): Ajuste[] {
  return ajustes.map((ajuste) => ({ parte: ajuste.parte, chave: ajuste.chave, valor: ajuste.de ?? ajuste.valor, de: ajuste.valor }))
}

/** As condições do token (pastilhas e prazos), para o Desfazer devolver. */
function condicoesDo(token: Token): Pick<Token, 'conditions' | 'condicoesProprias' | 'prazosDasCondicoes'> {
  return { conditions: token.conditions, condicoesProprias: token.condicoesProprias, prazosDasCondicoes: token.prazosDasCondicoes }
}

/** As fichas da cena que podem receber o item de `personagemId`, quem usa primeiro. */
export function candidatosAoUsoFora(sceneKey: string, personagemId: string): FichaQueRecebe[] {
  const personagens = mesaDaAventura.personagens()
  const quemUsa = personagens.find((candidato) => candidato.id === personagemId)
  return quemUsa === undefined ? [] : fichasQueRecebem(quemUsa, mesaDaAventura.fichasDaCena?.(sceneKey) ?? [], personagens)
}

export function usarItemForaNaMesa(pedido: PedidoDeUsoFora): FeitoDoUsoFora {
  const mesa = mesaDaAventura
  const sistema = mesa.sistema()
  const ficha = mesa.personagens().find((candidato) => candidato.id === pedido.personagemId)
  if (sistema === null || ficha === undefined) return { ok: false, motivo: 'Ficha sem personagem não tem mochila' }
  // A aventura que não migrou a mochila: a dona é a do boneco (como no tiro com munição).
  const doBoneco = mesa.mochilaDoBoneco?.(pedido.sceneKey, pedido.tokenId) ?? null
  const quemUsa = doBoneco === null ? ficha : fichaComAMochilaDoBoneco(ficha, doBoneco)
  const tokens = mesa.fichasDaCena?.(pedido.sceneKey) ?? []
  const alvo = fichasQueRecebem(quemUsa, tokens, mesa.personagens()).find((candidata) => candidata.personagem.id === pedido.alvoPersonagemId)
  if (alvo === undefined) return { ok: false, motivo: 'Quem recebe precisa ser você ou uma ficha de jogador nesta cena' }
  const uso = resolverUsoFora(quemUsa, pedido.vagaId, alvo, sistema, pedido.quem, Date.now())
  if (typeof uso === 'string') return { ok: false, motivo: uso }
  const vagaAntes: CarriedItem = uso.vaga
  const mochilaDepois = uso.quemUsa.mochila ?? []
  const gravarMochila = (mochila: CarriedItem[]): boolean =>
    doBoneco === null ? mesa.ajustarPersonagem(ficha.id, (atual) => fichaComMochila(atual, mochila, moedasDe(atual))) : mesa.gravarMochilaDoBoneco?.(pedido.sceneKey, pedido.tokenId, mochila) === true
  const mochilaDeAgora = (): readonly CarriedItem[] => (doBoneco === null ? (mesa.personagens().find((candidato) => candidato.id === ficha.id)?.mochila ?? []) : (mesa.mochilaDoBoneco?.(pedido.sceneKey, pedido.tokenId) ?? []))
  if (!gravarMochila(mochilaDepois)) return { ok: false, motivo: 'A mesa não gravou a mochila' }
  // A cura pelo funil da ficha, com o número de partida (`de`): o que mudou no meio não é pisado.
  const curas: { personagemId: string; ajustes: Ajuste[] }[] = [{ personagemId: ficha.id, ajustes: ajustesEntre(quemUsa, uso.quemUsa) }]
  if (uso.alvo !== null) curas.push({ personagemId: uso.alvo.id, ajustes: ajustesEntre(alvo.personagem, uso.alvo) })
  for (const cura of curas) if (cura.ajustes.length > 0) mesa.ajustarPersonagem(cura.personagemId, (atual) => aplicarAjustes(atual, sistema, cura.ajustes, pedido.quem, Date.now()))
  const tokenAntes = alvo.token
  const tokenDepois = uso.tokenDoAlvo
  if (tokenAntes !== null && tokenDepois !== null) mesa.mudarFichaDaCena?.(pedido.sceneKey, tokenAntes.id, (atual) => ({ ...atual, ...condicoesDo(tokenDepois) }))
  const texto = textoDoUsoFora(quemUsa.nome, uso.vaga.nome, uso.alvo === null ? null : uso.alvo.nome, uso)
  const desfazer = (): boolean => {
    if (!gravarMochila(mochilaSemAMudanca(mochilaDeAgora(), vagaAntes.id, vagaAntes))) return false
    for (const cura of curas) if (cura.ajustes.length > 0) mesa.ajustarPersonagem(cura.personagemId, (atual) => aplicarAjustes(atual, sistema, inversos(cura.ajustes), pedido.quem, Date.now()))
    if (tokenAntes !== null && tokenDepois !== null) mesa.mudarFichaDaCena?.(pedido.sceneKey, tokenAntes.id, (atual) => ({ ...atual, ...condicoesDo(tokenAntes) }))
    return true
  }
  return { ok: true, texto, desfazer }
}
