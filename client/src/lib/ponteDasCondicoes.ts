import type { CondicaoPropria, MapData, PrazoDeCondicao, Token } from '../types/map'
import type { SeloDaBatalha, SeloDoGolpe } from './batalha/combate'
import { comportamentoDoSelo, danoPorVezDoSelo } from './batalha/condicoes'
import { comSeloNovo, criarSelo, ehNomeDeSelo } from './batalha/selos'
import { acenderPeloNome, apagarPeloNome, chaveDaCondicao } from './condicaoPorNome'
import { condicoesPropriasOf } from './condicoesProprias'
import type { CondicaoAtiva } from './dbt/batalha/tipos'
import { lerPrazo, prazoDaCondicao, prazosDaFicha } from './prazoDaCondicao'
import { TOKEN_CONDITION_LABELS, tokenConditionsOf } from './tokenConditions'
import { condicaoDoCatalogo } from './condicoes/catalogo'
import { condicoesDe } from './condicoes/naFicha'
import type { Personagem } from './personagem'

/**
 * A PONTE DA BATALHA PARA A PASTILHA (Fase 3 do plano de melhoria,
 * 15/11/2026; regra em `tmp/fase-3-condicoes/REGRA.md`). A volta (a pastilha
 * vale como selo, `espelhosDasPastilhas`) está no fim do arquivo. Ida: quando um
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

/**
 * One Piece: os nomes que os selos da cena seguram, por ficha. O espelho de
 * uma pastilha (`daPastilha`) não segura nada: a pastilha é do mestre, e a
 * batalha que acaba (ou o prazo que chega a 0) não depende dele.
 */
export function chavesDosSelos(selos: readonly Pick<SeloDaBatalha, 'tokenId' | 'nome' | 'daPastilha'>[] | undefined): Map<string, Set<string>> {
  const porFicha = new Map<string, Set<string>>()
  for (const selo of selos ?? []) if (selo.daPastilha !== true) juntar(porFicha, selo.tokenId, chaveDoSelo(selo.nome))
  return porFicha
}

// ───────────────────────────────────────────────────────────────────────────
// A volta da ponte: a pastilha vale como o selo
// ───────────────────────────────────────────────────────────────────────────

/** A origem que a pílula do espelho mostra. */
const ORIGEM_DO_ESPELHO = 'Pastilha da ficha'

/** As pastilhas acesas na ficha pelo nome da tela (as de fábrica pelo rótulo), uma por chave de selo. */
function pastilhasAcesas(token: Token): string[] {
  const nomes = [...tokenConditionsOf(token).map((condicao) => TOKEN_CONDITION_LABELS[condicao]), ...condicoesPropriasOf(token).map((propria) => propria.nome)]
  const vistas = new Set<string>()
  return nomes.filter((nome) => {
    const chave = chaveDoSelo(nome)
    if (chave === '' || vistas.has(chave)) return false
    vistas.add(chave)
    return true
  })
}

/**
 * O espelho que a pastilha pede agora: o nome, os turnos e a vida por turno
 * do prazo. Só a pastilha com regra na tabela (Atordoado trava, Sangrando tira
 * por vez) ou com prazo (o veneno da armadilha); nome que não cabe num selo
 * fica de fora. `null` = a pastilha não vale como selo.
 */
function pedidoDoEspelho(nome: string, prazo: PrazoDeCondicao | null): SeloDoGolpe | null {
  if (!ehNomeDeSelo(nome) || (prazo === null && comportamentoDoSelo(nome) === null)) return null
  const pedido: SeloDoGolpe = { nome, turnos: prazo?.turnos ?? null }
  if (prazo?.porVez !== undefined) pedido.porVez = prazo.porVez
  return pedido
}

/** O espelho já está como a pastilha pede (os turnos, a vida por turno e o corte da cura)? */
function espelhoEmDia(espelho: SeloDaBatalha, pedido: SeloDoGolpe): boolean {
  return espelho.turnos === pedido.turnos && espelho.porVez === pedido.porVez && espelho.regra?.curaRecebida === pedido.regra?.curaRecebida
}

/** O espelho com os turnos, a vida por turno e o corte da cura de agora (o prazo andou, a condição renovou). */
function espelhoAtualizado(espelho: SeloDaBatalha, pedido: SeloDoGolpe): SeloDaBatalha {
  const { porVez: _antes, regra: _regraAntes, ...sem } = espelho
  const depois: SeloDaBatalha = { ...sem, turnos: pedido.turnos, total: pedido.turnos === null ? null : Math.max(espelho.total ?? 0, pedido.turnos) }
  if (pedido.porVez !== undefined) depois.porVez = pedido.porVez
  if (pedido.regra !== undefined) depois.regra = pedido.regra
  return depois
}

/** Por ficha da cena (o token), os espelhos que as condições da FICHA DE PERSONAGEM dela pedem, por chave do nome. */
export type CondicoesDasFichas = (ficha: Token) => ReadonlyMap<string, SeloDoGolpe>

/**
 * ITENS REFEITOS, E6c (PLANO §1.5: a condição mora na ficha, e a batalha a lê): o espelho que cada
 * condição posta em `Personagem.condicoes` pede, pelo nome do catálogo. A de regra `vida` tira o número
 * dela por vez (o "Aplicar / pular" do mestre, como o Sangrando de sempre); a de regra `cura` corta a cura
 * recebida no % dela; a `narra` vale pelo nome (Atordoado trava). O prazo é da ficha: o espelho não desconta
 * (`daPastilha`), quem desconta é o fim da vez (`contarFimDaVez`). A criada que o mestre apagou não espelha.
 */
export function pedidosDasCondicoesDaFicha(personagem: Pick<Personagem, 'condicoes'> | null | undefined, criadas: readonly CondicaoPropria[]): Map<string, SeloDoGolpe> {
  const pedidos = new Map<string, SeloDoGolpe>()
  if (personagem === null || personagem === undefined) return pedidos
  for (const condicao of condicoesDe(personagem)) {
    const doCatalogo = condicaoDoCatalogo(condicao.condId, criadas)
    if (doCatalogo === null || !ehNomeDeSelo(doCatalogo.nome)) continue
    const chave = chaveDoSelo(doCatalogo.nome)
    if (chave === '' || pedidos.has(chave)) continue
    const pedido: SeloDoGolpe = { nome: doCatalogo.nome, turnos: condicao.turnos }
    const n = condicao.n ?? doCatalogo.n
    if (doCatalogo.regra === 'vida' && n > 0) pedido.porVez = n
    if (doCatalogo.regra === 'cura' && n > 0) pedido.regra = { curaRecebida: -n }
    pedidos.set(chave, pedido)
  }
  return pedidos
}

/**
 * Os espelhos que a ficha pede, por chave: fora os nomes que um selo da batalha já segura nela.
 * E6c: primeiro as condições da ficha de personagem (`daFicha`); a pastilha antiga gravada no próprio
 * token só entra com nome que a ficha não tem.
 */
function pedidosDaFicha(selos: readonly SeloDaBatalha[], ficha: Token, daFicha?: CondicoesDasFichas): Map<string, SeloDoGolpe> {
  const daBatalha = new Set(selos.filter((selo) => selo.tokenId === ficha.id && selo.daPastilha !== true).map((selo) => chaveDoSelo(selo.nome)))
  const pedidos = new Map<string, SeloDoGolpe>()
  for (const [chave, pedido] of daFicha?.(ficha) ?? []) if (!daBatalha.has(chave)) pedidos.set(chave, pedido)
  for (const nome of pastilhasAcesas(ficha)) {
    const chave = chaveDoSelo(nome)
    const pedido = daBatalha.has(chave) || pedidos.has(chave) ? null : pedidoDoEspelho(nome, prazoDaCondicao(ficha, nome))
    if (pedido !== null) pedidos.set(chave, pedido)
  }
  return pedidos
}

/**
 * A VOLTA DA PONTE (levantamento das mecânicas duplicadas, Nº 3; a fonte é o
 * selo): a pastilha acesa numa ficha da batalha One Piece vale como o selo de
 * mesmo nome. Cada pastilha com regra ou com prazo ganha um selo ESPELHO
 * (`daPastilha`) com os turnos e a vida por turno do prazo, e daí a batalha a
 * trata como trata o selo: Atordoado trava a vez e a reação, Sangrando e
 * Queimando pedem "Aplicar / pular" ao mestre. O espelho cuja pastilha apagou
 * sai; o que o prazo mudou acompanha. A pastilha que um selo da batalha já
 * segura não ganha espelho (o selo dela já vale). Nada muda na ficha do mapa.
 *
 * `fichas` = as fichas do mapa com carta na ordem (o espelho das outras fica
 * como está); `novoId` dá o id do espelho novo; `rodada` = a de agora. Ficha
 * no teto de selos fica sem o espelho. Nada mudou = `null`.
 */
export function espelhosDasPastilhas(selos: readonly SeloDaBatalha[] | undefined, fichas: readonly Token[], rodada: number, novoId: () => string, daFicha?: CondicoesDasFichas): SeloDaBatalha[] | null {
  let lista: SeloDaBatalha[] = [...(selos ?? [])]
  let mudou = false
  for (const ficha of fichas) {
    const pedidos = pedidosDaFicha(lista, ficha, daFicha)
    lista = lista.flatMap((selo) => {
      if (selo.tokenId !== ficha.id || selo.daPastilha !== true) return [selo]
      const chave = chaveDoSelo(selo.nome)
      const pedido = pedidos.get(chave)
      pedidos.delete(chave)
      if (pedido !== undefined && espelhoEmDia(selo, pedido)) return [selo]
      mudou = true
      return pedido === undefined ? [] : [espelhoAtualizado(selo, pedido)]
    })
    for (const pedido of pedidos.values()) {
      const espelho: SeloDaBatalha = { ...criarSelo(ficha.id, pedido, { id: novoId(), rodada, tokenDaVez: null, origem: ORIGEM_DO_ESPELHO }), daPastilha: true }
      const comEle = comSeloNovo(lista, espelho)
      if (comEle === null) continue
      lista = comEle
      mudou = true
    }
  }
  return mudou ? lista : null
}

/**
 * Nº 3 do levantamento: a ficha sem os prazos cuja vida por turno um selo de
 * mesmo nome já pede ("Aplicar / pular", o espelho ou o selo da batalha): o
 * prazo não tira sozinho por cima. O prazo continua na ficha de verdade (o
 * desconto do fim da vez é dele); esta cópia só serve para ler a vida do
 * começo da vez. Nenhum a tirar = a MESMA ficha.
 */
export function semAVidaQueOSeloPede(token: Token, selos: readonly SeloDaBatalha[] | undefined): Token {
  const pedem = new Set((selos ?? []).filter((selo) => selo.tokenId === token.id && danoPorVezDoSelo(selo) !== null).map((selo) => chaveDoSelo(selo.nome)))
  const prazos = token.prazosDasCondicoes
  if (pedem.size === 0 || !Array.isArray(prazos)) return token
  const ficam = prazos.filter((prazo) => !pedem.has(chaveDoSelo(lerPrazo(prazo)?.nome ?? '')))
  return ficam.length === prazos.length ? token : { ...token, prazosDasCondicoes: ficam }
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
