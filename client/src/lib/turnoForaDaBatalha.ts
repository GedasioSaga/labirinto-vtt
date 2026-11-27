import type { CondicaoPropria, MapData, PrazoDeCondicao, Token } from '../types/map'
import { NOME_DO_MESTRE, aplicarAjustes } from './ajusteDaFicha'
import { chaveDaCondicao } from './condicaoPorNome'
import { condicaoDoCatalogo } from './condicoes/catalogo'
import { fimDaVezComGatilhos, gatilhoDe, temGatilhoQueConta, textoDoDisparo, type DisparoDoGatilho } from './condicoes/gatilho'
import { condicoesDe, danoDosPendentes, duracaoDe, pendentesDoComecoDaVez, type PendenteDaVez } from './condicoes/naFicha'
import type { CondicaoNaFicha } from './itens/modelo'
import { condicoesPropriasOf, simboloDaCondicaoPropria } from './condicoesProprias'
import type { Personagem } from './personagem'
import { passarTurnoNoMapa, prazosDaFicha } from './prazoDaCondicao'
import type { SistemaDeRpg } from './sistemaDeRpg'
import { TOKEN_CONDITION_LABELS, TOKEN_CONDITION_ORDER, TOKEN_CONDITION_SYMBOLS, tokenConditionsOf, type ConditionSymbol } from './tokenConditions'
import { recursoDeVida, vidaDoPersonagem } from './vidaDaFicha'

/**
 * O "PASSAR TURNO" DO MESTRE FORA DA BATALHA (Fase C, item 4, 15/11/2026;
 * regra em `tmp/fase-3-condicoes/REGRA.md`). O botão mora no topo do Grupo
 * (`components/TurnoForaDaBatalha.tsx`) e conta, de uma vez, o turno de toda
 * ficha da cena com prazo: a vida do começo e o desconto do fim
 * (`passarTurnoNoMapa`). Aqui mora a conta inteira, sem store:
 *  - o mapa novo e, por ficha que mudou, as condições de antes e de depois
 *    (o Desfazer volta exatamente as de antes);
 *  - a vida que cada personagem perde, no recurso de vida do sistema
 *    (`recursoDeVida`), com o de-para para gravar e para desfazer;
 *  - a frase do resumo ("Brann perdeu 4 PV (Envenenado, faltam 2)").
 *
 * Puro: quem chama dá o mapa, os personagens e o sistema, e grava.
 */

/** Os campos da ficha que o turno mexe: a pastilha de fábrica, as criadas e o prazo. */
export type CondicoesDaFicha = Pick<Token, 'conditions' | 'condicoesProprias' | 'prazosDasCondicoes'>

/** Cópia rasa dos três campos; o ausente fica ausente (o Desfazer o apaga de novo). */
export function condicoesDaFicha(token: Token): CondicoesDaFicha {
  const campos: CondicoesDaFicha = {}
  if (token.conditions !== undefined) campos.conditions = token.conditions
  if (token.condicoesProprias !== undefined) campos.condicoesProprias = token.condicoesProprias
  if (token.prazosDasCondicoes !== undefined) campos.prazosDasCondicoes = token.prazosDasCondicoes
  return campos
}

function mesmasCondicoes(token: Token, campos: CondicoesDaFicha): boolean {
  return token.conditions === campos.conditions && token.condicoesProprias === campos.condicoesProprias && token.prazosDasCondicoes === campos.prazosDasCondicoes
}

/** A ficha com EXATAMENTE estes três campos (o que falta em `campos` sai da ficha). O resto da ficha (onde está, o nome) fica. */
export function comCondicoes(token: Token, campos: CondicoesDaFicha): Token {
  const { conditions: _fabrica, condicoesProprias: _criadas, prazosDasCondicoes: _prazos, ...resto } = token
  return { ...resto, ...campos }
}

/**
 * Troca as condições das fichas `porToken` e só elas; ficha que sumiu do mapa
 * fica de fora. Nada mudou = o MESMO mapa (o contrato de `applyPlayerChange`,
 * que reaplica isto em cada passo guardado do Ctrl+Z).
 */
export function trocarCondicoesNoMapa(map: MapData, porToken: ReadonlyMap<string, CondicoesDaFicha>): MapData {
  let mudou = false
  const tokens = map.tokens.map((token) => {
    const campos = porToken.get(token.id)
    if (campos === undefined || mesmasCondicoes(token, campos)) return token
    mudou = true
    return comCondicoes(token, campos)
  })
  return mudou ? { ...map, tokens } : map
}

/** A vida que um personagem perdeu no turno, no recurso de vida do sistema: `de` → `para`. */
export interface PerdaDeVida {
  personagemId: string
  recursoId: string
  de: number
  para: number
}

/** As condições de uma ficha de personagem antes e depois do turno (E4a): o Desfazer volta as de antes. */
export interface CondicoesDoPersonagemNoTurno {
  personagemId: string
  antes: readonly CondicaoNaFicha[]
  depois: readonly CondicaoNaFicha[]
}

/** Um turno passado: o mapa novo, as condições de antes e de depois de cada ficha que mudou, a vida perdida e o resumo. */
export interface TurnoPassado {
  map: MapData
  antes: ReadonlyMap<string, CondicoesDaFicha>
  depois: ReadonlyMap<string, CondicoesDaFicha>
  /** CONDIÇÕES NA FICHA (E4a): as fichas de personagem da cena cujas condições contaram o turno. */
  personagens: CondicoesDoPersonagemNoTurno[]
  perdas: PerdaDeVida[]
  /** Uma frase por ficha com prazo, na ordem do mapa ("Tomás: Lento faltam 1"). */
  partes: string[]
}

/** O turno de uma ficha de personagem: as condições de antes e de depois, o que tirou vida e quanto. */
interface TiqueDoPersonagem extends CondicoesDoPersonagemNoTurno {
  personagem: Personagem
  /** O nome no resumo (o do primeiro token dela na cena). */
  nome: string
  pendentes: PendenteDaVez[]
  dano: number
  /** Pedido de 26/11: os gatilhos que dispararam neste turno e a cura que deram (o dano deles já está em `dano`). */
  disparos: DisparoDoGatilho[]
  cura: number
}

/** A ficha de personagem tem condição que conta turno (por N turnos) ou que tira vida no começo da vez. */
function fichaContaTurno(personagem: Personagem, criadas: readonly CondicaoPropria[]): boolean {
  return condicoesDe(personagem).some((condicao) => condicao.turnos !== null) || pendentesDoComecoDaVez(personagem, criadas).length > 0 || temGatilhoQueConta(personagem, criadas)
}

/** As fichas de personagem ligadas aos tokens da cena, uma vez cada (dois tokens da mesma ficha de jogador contam um turno só), na ordem do mapa. */
function fichasDaCena(tokens: readonly Token[], personagens: readonly Personagem[]): { personagem: Personagem; token: Token }[] {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const vistas = new Set<string>()
  const fichas: { personagem: Personagem; token: Token }[] = []
  for (const token of tokens) {
    if (token.characterId === null || vistas.has(token.characterId)) continue
    const personagem = porId.get(token.characterId)
    if (personagem === undefined) continue
    vistas.add(personagem.id)
    fichas.push({ personagem, token })
  }
  return fichas
}

/**
 * CONDIÇÕES NA FICHA (E4a): o turno de cada ficha de personagem da cena, pelas regras de
 * `lib/condicoes/naFicha.ts`: a vida do começo da vez (fora da batalha, todas aplicadas) e o
 * desconto do fim. Ficha sem nada que conte não entra.
 */
function tiquesDasFichas(tokens: readonly Token[], personagens: readonly Personagem[], criadas: readonly CondicaoPropria[]): TiqueDoPersonagem[] {
  return fichasDaCena(tokens, personagens).flatMap(({ personagem, token }) => {
    if (!fichaContaTurno(personagem, criadas)) return []
    const pendentes = pendentesDoComecoDaVez(personagem, criadas)
    // Pedido de 26/11: o desconto do fim com os gatilhos ("depois de X turnos"), a mesma conta da batalha.
    const fim = fimDaVezComGatilhos(personagem, criadas)
    return [
      {
        personagemId: personagem.id,
        personagem,
        nome: nomeNoResumo(token, personagens),
        antes: condicoesDe(personagem),
        depois: condicoesDe(fim.personagem),
        pendentes,
        dano: danoDosPendentes(pendentes) + fim.dano,
        disparos: fim.disparos,
        cura: fim.cura,
      },
    ]
  })
}

/** Quantas fichas da cena passam turno: as de prazo aceso no token e as de personagem com condição que conta (o botão "Passar turno"). */
export function contarQuemPassaTurno(tokens: readonly Token[], personagens: readonly Personagem[], criadas: readonly CondicaoPropria[]): number {
  const noToken = tokens.reduce((soma, token) => (prazosDaFicha(token).length > 0 ? soma + 1 : soma), 0)
  return noToken + fichasDaCena(tokens, personagens).filter(({ personagem }) => fichaContaTurno(personagem, criadas)).length
}

/** "faltam 2", "acabou", ou a duração que não conta, pela condição de mesmo id DEPOIS do turno. */
function estadoDaCondicaoDepois(condicao: CondicaoNaFicha, depois: readonly CondicaoNaFicha[]): string {
  const ficou = depois.find((candidata) => candidata.id === condicao.id)
  if (ficou === undefined) return 'acabou'
  const duracao = duracaoDe(ficou)
  if (typeof duracao === 'number') return `faltam ${duracao}`
  return duracao === 'fim' ? 'até o fim da batalha' : 'até alguém tirar'
}

/**
 * A frase de uma ficha de personagem, no molde de `fraseDaFicha`: "Vincent perdeu 3 PV
 * (Envenenado, faltam 1), Lento acabou". `perdeu` = PV que saíram de verdade; `null` = a ficha não
 * tem onde a vida cair (sistema sem vida): só as condições.
 */
export function fraseDasCondicoesDaFicha(
  nome: string,
  antes: readonly CondicaoNaFicha[],
  depois: readonly CondicaoNaFicha[],
  pendentes: readonly PendenteDaVez[],
  perdeu: number | null,
  criadas: readonly CondicaoPropria[],
): string {
  // A criada que o mestre apagou do catálogo fica na ficha sem nome de catálogo.
  const nomeDe = (condicao: CondicaoNaFicha): string => condicaoDoCatalogo(condicao.condId, criadas)?.nome ?? 'Condição apagada'
  const tiram = new Set(pendentes.map((pendente) => pendente.condicaoId))
  const contam = antes.filter((condicao) => condicao.turnos !== null || tiram.has(condicao.id) || (condicao.gatilhoFeito !== true && gatilhoDe(condicao, criadas) !== null))
  const parte = (condicao: CondicaoNaFicha, separador: string): string => `${nomeDe(condicao)}${separador}${estadoDaCondicaoDepois(condicao, depois)}`
  if (perdeu === null || tiram.size === 0) return `${nome}: ${contam.map((condicao) => parte(condicao, ' ')).join(', ')}`
  const cabeca = `${nome} perdeu ${perdeu} PV (${contam.filter((condicao) => tiram.has(condicao.id)).map((condicao) => parte(condicao, ', ')).join('; ')})`
  const outros = contam.filter((condicao) => !tiram.has(condicao.id)).map((condicao) => parte(condicao, ' '))
  return outros.length === 0 ? cabeca : `${cabeca}, ${outros.join(', ')}`
}

/** O nome da ficha no resumo: o do token, ou o do personagem ligado. */
function nomeNoResumo(token: Token, personagens: readonly Personagem[]): string {
  const doToken = token.name.trim()
  if (doToken !== '') return doToken
  return personagens.find((personagem) => personagem.id === token.characterId)?.nome.trim() || 'Ficha sem nome'
}

/** "faltam 2" ou "acabou", pelo prazo do mesmo nome na ficha DEPOIS do turno. */
function estadoDepois(prazo: PrazoDeCondicao, depois: readonly PrazoDeCondicao[]): string {
  const chave = chaveDaCondicao(prazo.nome)
  const ficou = depois.find((candidato) => chaveDaCondicao(candidato.nome) === chave)
  return ficou === undefined ? 'acabou' : `faltam ${ficou.turnos}`
}

/**
 * A frase de uma ficha. `perdeu` = PV que saíram de verdade (o piso 0 corta);
 * `null` = a ficha não tem onde a vida cair (sem personagem, sistema sem vida):
 * só os prazos. "Brann perdeu 4 PV (Envenenado, faltam 2), Lento faltam 1".
 */
export function fraseDaFicha(nome: string, antes: readonly PrazoDeCondicao[], depois: readonly PrazoDeCondicao[], perdeu: number | null): string {
  const tiram = antes.filter((prazo) => prazo.porVez !== undefined)
  if (perdeu === null || tiram.length === 0) return `${nome}: ${antes.map((prazo) => `${prazo.nome} ${estadoDepois(prazo, depois)}`).join(', ')}`
  const cabeca = `${nome} perdeu ${perdeu} PV (${tiram.map((prazo) => `${prazo.nome}, ${estadoDepois(prazo, depois)}`).join('; ')})`
  const outros = antes.filter((prazo) => prazo.porVez === undefined).map((prazo) => `${prazo.nome} ${estadoDepois(prazo, depois)}`)
  return outros.length === 0 ? cabeca : `${cabeca}, ${outros.join(', ')}`
}

/**
 * O turno inteiro fora da batalha. `null` = ninguém na cena tem prazo (nada
 * a passar). A vida sai em ordem de ficha: dois tokens do mesmo personagem
 * somam, e o piso 0 vale para a soma. `seguradas`: as chaves que uma batalha
 * ainda segura acesas na ficha (`chavesDaFichaNaBatalha`).
 *
 * CONDIÇÕES NA FICHA (E4a): além do prazo gravado no token (a passagem até a
 * E7), conta o turno das condições da ficha de personagem de cada token da
 * cena (`Personagem.condicoes`), uma vez por ficha. `criadas`: as condições
 * que o mestre criou (o nome e a regra delas).
 */
export function passarTurnoForaDaBatalha(
  map: MapData,
  personagens: readonly Personagem[],
  sistema: SistemaDeRpg | null,
  seguradas?: (tokenId: string) => ReadonlySet<string>,
  criadas: readonly CondicaoPropria[] = [],
): TurnoPassado | null {
  const { map: novo, fichas } = passarTurnoNoMapa(map, seguradas)
  const tiques = tiquesDasFichas(map.tokens, personagens, criadas)
  if (novo === map && tiques.length === 0) return null
  const recurso = recursoDeVida(sistema)
  const danoPorToken = new Map(fichas.map((ficha) => [ficha.tokenId, ficha.dano]))
  const depoisPorId = new Map(novo.tokens.map((token) => [token.id, token]))
  const atualPorPersonagem = new Map<string, { de: number; para: number }>()
  const antes = new Map<string, CondicoesDaFicha>()
  const depois = new Map<string, CondicoesDaFicha>()
  const partes: string[] = []
  for (const token of map.tokens) {
    const tokenDepois = depoisPorId.get(token.id)
    if (tokenDepois === undefined || tokenDepois === token) continue
    antes.set(token.id, condicoesDaFicha(token))
    depois.set(token.id, condicoesDaFicha(tokenDepois))
    const prazosAntes = prazosDaFicha(token)
    // A ficha que só perdeu um prazo órfão (a pastilha já apagada à mão) muda, mas não é notícia.
    if (prazosAntes.length === 0) continue
    const dano = danoPorToken.get(token.id) ?? 0
    const personagem = token.characterId === null ? undefined : personagens.find((candidato) => candidato.id === token.characterId)
    const vida = personagem === undefined || recurso === null ? null : vidaDoPersonagem(personagem, recurso)
    let perdeu: number | null = null
    if (personagem !== undefined && vida !== null) {
      const conta = atualPorPersonagem.get(personagem.id) ?? { de: vida.atual, para: vida.atual }
      const para = Math.max(0, conta.para - dano)
      perdeu = conta.para - para
      atualPorPersonagem.set(personagem.id, { de: conta.de, para })
    }
    partes.push(fraseDaFicha(nomeNoResumo(token, personagens), prazosAntes, prazosDaFicha(tokenDepois), perdeu))
  }
  for (const tique of tiques) {
    const vida = recurso === null ? null : vidaDoPersonagem(tique.personagem, recurso)
    let perdeu: number | null = null
    if (vida !== null) {
      const conta = atualPorPersonagem.get(tique.personagemId) ?? { de: vida.atual, para: vida.atual }
      const semCura = Math.max(0, conta.para - tique.dano)
      perdeu = conta.para - semCura
      // A cura do gatilho vem depois do dano e para no máximo da vida.
      const para = Math.min(vida.maximo, semCura + tique.cura)
      atualPorPersonagem.set(tique.personagemId, { de: conta.de, para })
    }
    const frase = fraseDasCondicoesDaFicha(tique.nome, tique.antes, tique.depois, tique.pendentes, perdeu, criadas)
    partes.push(tique.disparos.length === 0 ? frase : [frase, ...tique.disparos.map((disparo) => textoDoDisparo(disparo, tique.nome))].join('; '))
  }
  const perdas: PerdaDeVida[] =
    recurso === null ? [] : [...atualPorPersonagem].flatMap(([personagemId, { de, para }]) => (de === para ? [] : [{ personagemId, recursoId: recurso.id, de, para }]))
  const personagensDoTurno = tiques.map(({ personagemId, antes: antesDaFicha, depois: depoisDaFicha }) => ({ personagemId, antes: antesDaFicha, depois: depoisDaFicha }))
  return { map: novo, antes, depois, personagens: personagensDoTurno, perdas, partes }
}

/**
 * Grava a perda no personagem de AGORA (`ajustarPersonagem` da aventura):
 * o valor `para`, dito a partir de `de`. Se outra coisa mexeu na vida no meio
 * (um golpe), vale a diferença (`ajusteSobreOAtual`). O Desfazer chama com
 * `de` e `para` trocados.
 */
export function personagemComAPerda(atual: Personagem, sistema: SistemaDeRpg, perda: Pick<PerdaDeVida, 'recursoId' | 'de' | 'para'>, quando: number): Personagem {
  return aplicarAjustes(atual, sistema, [{ parte: 'recurso', chave: perda.recursoId, valor: perda.para, de: perda.de }], NOME_DO_MESTRE, quando)
}

// ───────────────────────────────────────────────────────────────────────────
// As pastilhas acesas, com o prazo (a lista do Grupo e o editor da ficha)
// ───────────────────────────────────────────────────────────────────────────

/** Uma pastilha acesa na ficha, com os turnos que faltam (`null` = sem prazo, fica até alguém tirar). */
export interface PastilhaAcesa {
  chave: string
  nome: string
  symbol: ConditionSymbol
  prazo: PrazoDeCondicao | null
}

/** As pastilhas acesas: primeiro as de fábrica, na ordem do painel; depois as criadas pelo mestre. */
export function pastilhasAcesas(token: Token): PastilhaAcesa[] {
  const prazos = prazosDaFicha(token)
  const prazoDe = (nome: string): PrazoDeCondicao | null => {
    const chave = chaveDaCondicao(nome)
    return prazos.find((prazo) => chaveDaCondicao(prazo.nome) === chave) ?? null
  }
  const acesas = tokenConditionsOf(token)
  const deFabrica = TOKEN_CONDITION_ORDER.filter((condicao) => acesas.includes(condicao)).map((condicao) => {
    const nome = TOKEN_CONDITION_LABELS[condicao]
    return { chave: chaveDaCondicao(nome), nome, symbol: TOKEN_CONDITION_SYMBOLS[condicao], prazo: prazoDe(nome) }
  })
  const vistas = new Set(deFabrica.map((pastilha) => pastilha.chave))
  const criadas: PastilhaAcesa[] = []
  for (const propria of condicoesPropriasOf(token)) {
    const chave = chaveDaCondicao(propria.nome)
    if (vistas.has(chave)) continue
    vistas.add(chave)
    criadas.push({ chave, nome: propria.nome, symbol: simboloDaCondicaoPropria(propria), prazo: prazoDe(propria.nome) })
  }
  return [...deFabrica, ...criadas]
}
