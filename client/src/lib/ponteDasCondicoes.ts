import type { CondicaoPropria, MapData } from '../types/map'
import type { SeloDaBatalha } from './batalha/combate'
import { comportamentoDoSelo } from './batalha/condicoes'
import { acenderPeloNome, apagarPeloNome, chaveDaCondicao } from './condicaoPorNome'
import type { CondicaoAtiva } from './dbt/batalha/tipos'
import { prazosDaFicha } from './prazoDaCondicao'

/**
 * A PONTE DA BATALHA PARA A PASTILHA (Fase 3 do plano de melhoria,
 * 15/11/2026; regra em `tmp/fase-3-condicoes/REGRA.md`). Mão única: quando um
 * selo do One Piece ou uma condição do Dragon Ball ENTRA numa ficha, a
 * pastilha de mesmo nome acende nela; quando SAI (acabou, foi tirado,
 * desfeito, a batalha acabou), apaga. A regra continua na batalha: a pastilha
 * é só o espelho dela. Nada muda no formato da batalha nem do mapa.
 *
 * O nome casa sem acento e sem caixa (`chaveDaCondicao`) com as pastilhas de
 * fábrica e com as criadas pelo mestre (`marcaDoNome`). No One Piece o nome do
 * selo passa antes pela tabela dele ("Atordoada" e "Atordoado 2" são o
 * "Atordoado"; `comportamentoDoSelo`).
 *
 * A ponte trabalha por DIFERENÇA entre duas fotos da batalha:
 *  - nome que entrou acende (já aceso, à mão: fica como está);
 *  - nome que saiu apaga, a não ser que a ficha tenha PRAZO com esse nome (a
 *    armadilha pôs "Envenenado 3 turnos": o prazo segura a pastilha);
 *  - a batalha que acabou de aparecer (começou, ou voltou do disco) é a foto
 *    de base e não acende nada: batalha salva antes desta ponte abre como
 *    estava, sem sujar o mapa;
 *  - a batalha que sumiu (acabou) apaga tudo o que ela segurava.
 *
 * O mestre que apaga à mão a pastilha de um selo ainda ativo manda: a ponte só
 * volta a mexer quando aquele selo mudar de novo.
 *
 * Puro: sem store, sem rede, sem Pixi. Quem liga é `stores/ponteDasCondicoes.ts`.
 */

/** Por ficha (tokenId), as chaves dos nomes que a batalha segura nela. */
export type ChavesPorFicha = ReadonlyMap<string, ReadonlySet<string>>

/** One Piece: a chave do nome do selo, pelo nome da tabela quando ela o conhece. */
export function chaveDoSelo(nome: string): string {
  return chaveDaCondicao(comportamentoDoSelo(nome)?.nome ?? nome)
}

function juntar(mapa: Map<string, Set<string>>, tokenId: string, chave: string): void {
  if (chave === '') return
  const chaves = mapa.get(tokenId)
  if (chaves === undefined) mapa.set(tokenId, new Set([chave]))
  else chaves.add(chave)
}

/** One Piece: os nomes que os selos da cena seguram, por ficha. */
export function chavesDosSelos(selos: readonly Pick<SeloDaBatalha, 'tokenId' | 'nome'>[] | undefined): Map<string, Set<string>> {
  const porFicha = new Map<string, Set<string>>()
  for (const selo of selos ?? []) juntar(porFicha, selo.tokenId, chaveDoSelo(selo.nome))
  return porFicha
}

/**
 * Dragon Ball: os nomes das condições de cada combatente (o id do combatente
 * é o id do token). A suprimida (Sangrando segurado no teste) continua sendo
 * dele: a pastilha fica.
 */
export function chavesDoDragonBall(combatentes: Readonly<Record<string, { id: string; condicoes: readonly Pick<CondicaoAtiva, 'nome'>[] }>>): Map<string, Set<string>> {
  const porFicha = new Map<string, Set<string>>()
  for (const combatente of Object.values(combatentes)) for (const ativa of combatente.condicoes) juntar(porFicha, combatente.id, chaveDaCondicao(ativa.nome))
  return porFicha
}

/** O que a ponte faz numa ficha: chaves a acender e a apagar. */
export interface MudancaDaPonte {
  tokenId: string
  acender: readonly string[]
  apagar: readonly string[]
}

/** As diferenças entre duas fotos da mesma cena. Nada mudou = lista vazia. */
export function mudancasDaPonte(antes: ChavesPorFicha, depois: ChavesPorFicha): MudancaDaPonte[] {
  const mudancas: MudancaDaPonte[] = []
  const fichas = new Set([...antes.keys(), ...depois.keys()])
  for (const tokenId of fichas) {
    const eram = antes.get(tokenId) ?? new Set<string>()
    const sao = depois.get(tokenId) ?? new Set<string>()
    const acender = [...sao].filter((chave) => !eram.has(chave))
    const apagar = [...eram].filter((chave) => !sao.has(chave))
    if (acender.length > 0 || apagar.length > 0) mudancas.push({ tokenId, acender, apagar })
  }
  return mudancas
}

/**
 * Aplica as mudanças da ponte no mapa da cena. Pura e idempotente, e vale para
 * qualquer versão do mapa (a mesa a reaplica em cada passo do Ctrl+Z, como a
 * mudança de um jogador). Ficha que não está no mapa fica de fora. Nada mudou
 * = o MESMO mapa.
 */
export function espelharNoMapa(map: MapData, mudancas: readonly MudancaDaPonte[], catalogo: readonly CondicaoPropria[]): MapData {
  const porFicha = new Map(mudancas.map((mudanca) => [mudanca.tokenId, mudanca]))
  let mudou = false
  const tokens = map.tokens.map((token) => {
    const mudanca = porFicha.get(token.id)
    if (mudanca === undefined) return token
    let ficha = token
    const comPrazo = new Set(prazosDaFicha(ficha).map((prazo) => chaveDaCondicao(prazo.nome)))
    for (const chave of mudanca.apagar) if (!comPrazo.has(chave)) ficha = apagarPeloNome(ficha, chave)
    for (const chave of mudanca.acender) ficha = acenderPeloNome(ficha, chave, catalogo)
    if (ficha !== token) mudou = true
    return ficha
  })
  return mudou ? { ...map, tokens } : map
}
