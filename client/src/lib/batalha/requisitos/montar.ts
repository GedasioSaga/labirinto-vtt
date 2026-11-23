import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../../personagem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import { recursoDeVida, vidaDoPersonagem } from '../../vidaDaFicha'
import { acumuladoresDoPersonagem, nivelDoAcumulador } from '../acumuladorNaBatalha'
import { distanciaEntreFichas, type PegadaNaGrade } from '../area'
import { chaveDaVez, type CombateDoPersonagem } from '../combate'
import { armasDe, recursoDoCusto } from '../leituraDaFicha'
import { marcaDoToken } from '../marca'
import { formaDaFicha } from '../transformacao'
import type { TurnosDaCena } from '../turnos'
import type { AlvoNoContexto, ContextoDosRequisitos, LigadaNoContexto, QuemUsaNoContexto, RastroNoContexto, VizinhoNoContexto } from './contexto'
import { lerMarcas } from './ler'
import type { Referencia } from './modelo'

/**
 * REQUISITOS, fase C: o MONTADOR do retrato (`ContextoDosRequisitos`) a partir do estado de verdade da
 * batalha. Um só, com a `visao`:
 * - `tudo` (o host e o mestre): todas as fichas; o que existe é sabido;
 * - `jogador` (o menu do jogador, pelo recorte): só as fichas que ele recebe (a dele e as dos aliados
 *   da equipe, com marcas e SP); o resto fica de fora e o requisito dele sai `naoSei` ("o mestre
 *   confere"), nunca "ok".
 *
 * As casas andadas na vez são o `GastoDaVez.blocos` da carta (a fase B3 conferiu: zera por vez).
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

export interface EntradaDoMontador {
  /** Quem usa (a ficha com o cartão do item, no item). */
  personagem: Personagem
  sistema: SistemaDeRpg
  tokenId: string
  /** A carta de quem usa (as casas da vez estão no gasto dela). */
  cartaId: string
  turnos: TurnosDaCena
  /** As fichas que quem lê conhece (o host: todas; o jogador: a dele e as dos aliados). */
  personagens: readonly Personagem[]
  /** tokenId → personagemId das cartas da cena. */
  personagemDoToken: (tokenId: string) => string | null | undefined
  /** Os ids de personagem aliados de quem usa (`aliadosNaLuta`), sem ele. Ausente = não sei quem é aliado (os requisitos de aliado e de inimigo saem "não sei"). */
  aliados?: ReadonlySet<string>
  /** A pegada na grade (as distâncias); ausente = a mesa sem mapa (as distâncias ficam "não sei"). */
  pegadaDoToken?: (tokenId: string) => PegadaNaGrade | null
  visao: 'tudo' | 'jogador'
  /** Os alvos escolhidos (tokenIds); ausente = o menu, antes da mira. */
  alvos?: readonly string[]
  /** O custo normal em SP (o A1 que gasta precisa do dele além deste). */
  custoEmSp?: number
  naReacao?: boolean
  noTreino?: boolean
  autorEhMestre?: boolean
  /**
   * E5: a ficha está na luz, medido por quem tem o mapa (o host, `MesaDaBatalha.naLuz`). Ausente ou
   * `null` = não sei (o requisito de luz sai "o mestre confere").
   */
  naLuz?: (tokenId: string) => boolean | null
}

function todosOsCartoes(personagem: Pick<Personagem, 'abas'>): CartaoDaFicha[] {
  const lista: CartaoDaFicha[] = []
  const juntar = (cartao: CartaoDaFicha): void => {
    lista.push(cartao)
    cartao.subcartoes.forEach(juntar)
  }
  for (const cartoes of Object.values(personagem.abas)) cartoes.forEach(juntar)
  return lista
}

/** As marcas de todos os cartões da ficha ("Fogo"), sem repetir. */
export function marcasDaFicha(personagem: Pick<Personagem, 'abas'>): string[] {
  const marcas = new Set<string>()
  for (const cartao of todosOsCartoes(personagem)) for (const marca of lerMarcas(cartao.marcas)) marcas.add(marca)
  return [...marcas]
}

function recursoDe(personagem: Personagem, sistema: SistemaDeRpg, id: 'sp' | 'escudo'): number | undefined {
  const recurso = id === 'sp' ? recursoDoCusto(sistema, 'sp') : (sistema.recursos.find((candidato) => candidato.id === 'escudo') ?? null)
  return recurso === null ? undefined : numeroDaFicha(personagem.recursos, recurso.id)
}

function vidaDe(personagem: Personagem, sistema: SistemaDeRpg): { atual: number; max: number } | undefined {
  const recurso = recursoDeVida(sistema)
  const vida = recurso === null ? null : vidaDoPersonagem(personagem, recurso)
  return vida === null ? undefined : { atual: vida.atual, max: vida.maximo }
}

/** Um aliado que a tela tem a ficha: o token dele na ordem e a ficha inteira (a do recorte). */
export interface AliadoDaTela {
  tokenId: string
  personagem: Personagem
}

/**
 * REQUISITOS E (G1, G2): os aliados que ESTA tela enxerga, no formato do avaliador, para listar a quem
 * pedir ajuda. `completa: false` = pode haver aliado que ela não vê (quem decide é o host).
 */
export function vizinhosDaTela(aliados: readonly AliadoDaTela[], sistema: SistemaDeRpg): { lista: VizinhoNoContexto[]; completa: boolean } {
  const lista = aliados.map(({ tokenId, personagem }): VizinhoNoContexto => {
    const vida = vidaDe(personagem, sistema)
    const vizinho: VizinhoNoContexto = { tokenId, nome: personagem.nome.trim() || 'Ficha', dePe: vida === undefined ? true : vida.atual > 0, npc: personagem.tipo === 'npc', marcas: marcasDaFicha(personagem) }
    const sp = recursoDe(personagem, sistema, 'sp')
    if (sp !== undefined) vizinho.sp = sp
    const escudo = recursoDe(personagem, sistema, 'escudo')
    if (escudo !== undefined) vizinho.escudo = escudo
    if (vida !== undefined) vizinho.hp = vida.atual
    return vizinho
  })
  return { lista, completa: false }
}

/** REQUISITOS E: o cartão que o pedido usa (técnica, arma), com o bloco; nenhum = `undefined`. */
export function cartaoDoPedido(personagem: Pick<Personagem, 'abas'>, cartaoId: string): CartaoDaFicha | undefined {
  return todosOsCartoes(personagem).find((cartao) => cartao.id === cartaoId)
}

/** B1: as ligadas = os selos que ele pôs com um cartão (a Melodia, na opção escolhida), as formas e passivas ativas e as mantidas. */
function ligadasDe(personagem: Personagem, combate: CombateDoPersonagem | undefined, turnos: TurnosDaCena, nomeDoCartao: (id: string) => string | undefined): LigadaNoContexto[] {
  const ligadas: LigadaNoContexto[] = []
  for (const selo of turnos.selos ?? []) {
    if (selo.donoId !== personagem.id || selo.cartaoId === undefined) continue
    const ligada: LigadaNoContexto = { id: selo.cartaoId, nome: nomeDoCartao(selo.cartaoId) ?? selo.nome }
    if (selo.opcao !== undefined) ligada.opcao = selo.opcao
    ligadas.push(ligada)
  }
  for (const id of [...personagem.cartoesAtivos, ...(combate?.mantidas ?? [])]) ligadas.push({ id, nome: nomeDoCartao(id) ?? '' })
  return ligadas
}

function rastroDe(combate: CombateDoPersonagem | undefined, turnos: TurnosDaCena, cartaId: string, nomeDoCartao: (id: string) => string | undefined): RastroNoContexto {
  const rastro = combate?.rastro
  const daVez = turnos.vez === null ? null : chaveDaVez(turnos.rodada, turnos.vez)
  const vez = rastro?.vez !== undefined && rastro.vez.chave === daVez ? rastro.vez : undefined
  const ultima = rastro?.ultimaAcao
  return {
    // A vez dele: o gasto da carta conta as casas e zera por vez. Fora da vez dele (reação), 0.
    casasAndadas: turnos.vez === cartaId ? (turnos.gastos[cartaId]?.blocos ?? 0) : 0,
    danoDesdeAVez: rastro?.danoDesdeAVez ?? 0,
    acertouNaVez: vez?.acertou === true,
    ultimoAtaque: rastro?.ultimoAtaque ?? null,
    ultimaAcao: ultima === undefined ? null : ultima.tipo === 'cartao' ? { tipo: 'cartao', cartao: { id: ultima.cartaoId, nome: ultima.nome } } : { tipo: ultima.tipo },
    usadas: Object.keys(rastro?.usadas ?? {}).map((id) => ({ id, nome: nomeDoCartao(id) ?? '' })),
    acoesNaVez: vez?.acoes ?? 0,
  }
}

function quemUsaDe(entrada: EntradaDoMontador, combate: CombateDoPersonagem | undefined, nomeDoCartao: (id: string) => string | undefined): QuemUsaNoContexto {
  const { personagem, sistema, turnos, tokenId } = entrada
  const quem: QuemUsaNoContexto = {
    tokenId,
    nome: personagem.nome.trim() || 'A ficha',
    acumuladores: acumuladoresDoPersonagem(personagem).map((def) => ({ id: def.id, nome: def.nome, nivel: nivelDoAcumulador(combate, def.id) })),
    carga: combate?.carga ?? 0,
    reacaoLivre: combate?.semReacao !== true,
    ligadas: ligadasDe(personagem, combate, turnos, nomeDoCartao),
    selos: (turnos.selos ?? []).filter((selo) => selo.tokenId === tokenId).map((selo) => selo.nome),
    formas: personagem.cartoesAtivos.filter((id) => formaDaFicha(personagem, sistema, id) !== null).map((id) => ({ id, nome: nomeDoCartao(id) ?? '' })),
    mochila: (personagem.mochila ?? []).map((vaga) => ({ id: vaga.itemId ?? vaga.id, nome: vaga.nome, quantidade: vaga.quantidade ?? 1 })),
    armasNaMao: armasDe(personagem)
      .filter((arma) => combate?.armas === null || combate?.armas === undefined || combate.armas.includes(arma.id))
      .map((arma) => (arma.categoria === null ? { id: arma.id, nome: arma.nome } : { id: arma.id, nome: arma.nome, categoria: arma.categoria })),
    rastro: rastroDe(combate, turnos, entrada.cartaId, nomeDoCartao),
  }
  const sp = recursoDe(personagem, sistema, 'sp')
  if (sp !== undefined) quem.sp = sp
  const escudo = recursoDe(personagem, sistema, 'escudo')
  if (escudo !== undefined) quem.escudo = escudo
  const vida = vidaDe(personagem, sistema)
  if (vida !== undefined) quem.vida = vida
  return quem
}

/**
 * REQUISITOS C: o retrato do MENU do jogador, só com o que o recorte dá a ele: a ficha dele (SP,
 * Escudo, vida, formas, mochila, armas) e o combate dele (acumuladores, carga, reação). O que depende
 * da ordem e dos outros (ligadas, selos, rastro, aliados, alvos) fica de fora: o avaliador dá "não
 * sei" e o item segue clicável; o host confere tudo de novo.
 */
export function contextoDoMenuDoJogador(personagem: Personagem, sistema: SistemaDeRpg, tokenId: string, combate: CombateDoPersonagem | undefined): ContextoDosRequisitos {
  const nomes = new Map<string, string>()
  for (const cartao of todosOsCartoes(personagem)) if (!nomes.has(cartao.id)) nomes.set(cartao.id, cartao.nome)
  const quem: QuemUsaNoContexto = {
    tokenId,
    nome: personagem.nome.trim() || 'A ficha',
    acumuladores: acumuladoresDoPersonagem(personagem).map((def) => ({ id: def.id, nome: def.nome, nivel: nivelDoAcumulador(combate, def.id) })),
    carga: combate?.carga ?? 0,
    reacaoLivre: combate?.semReacao !== true,
    formas: personagem.cartoesAtivos.filter((id) => formaDaFicha(personagem, sistema, id) !== null).map((id) => ({ id, nome: nomes.get(id) ?? '' })),
    mochila: (personagem.mochila ?? []).map((vaga) => ({ id: vaga.itemId ?? vaga.id, nome: vaga.nome, quantidade: vaga.quantidade ?? 1 })),
  }
  const sp = recursoDe(personagem, sistema, 'sp')
  if (sp !== undefined) quem.sp = sp
  const escudo = recursoDe(personagem, sistema, 'escudo')
  if (escudo !== undefined) quem.escudo = escudo
  const vida = vidaDe(personagem, sistema)
  if (vida !== undefined) quem.vida = vida
  return { quemUsa: quem }
}

/** A ordem da rodada: quem está antes da vez de agora já agiu (D6). */
function jaAgiuNaRodada(turnos: TurnosDaCena, tokenId: string): boolean {
  const daVez = turnos.cartas.findIndex((carta) => carta.id === turnos.vez)
  if (daVez < 0) return false
  return turnos.cartas.some((carta, indice) => indice < daVez && carta.tokenId === tokenId)
}

/**
 * O retrato dos requisitos a partir do estado da batalha. O que a `visao` não conhece fica de fora
 * (o avaliador dá `naoSei`).
 */
export function contextoDosRequisitos(entrada: EntradaDoMontador): ContextoDosRequisitos {
  const { personagem, sistema, turnos, tokenId, visao } = entrada
  const nomes = new Map<string, string>()
  for (const cartao of todosOsCartoes(personagem)) if (!nomes.has(cartao.id)) nomes.set(cartao.id, cartao.nome)
  const nomeDoCartao = (id: string): string | undefined => nomes.get(id)
  const combate = turnos.combate?.[personagem.id]
  const fichaDe = (personagemId: string | null | undefined): Personagem | undefined => (personagemId === null || personagemId === undefined ? undefined : entrada.personagens.find((candidato) => candidato.id === personagemId))
  const minhaPegada = entrada.pegadaDoToken?.(tokenId) ?? null
  const distancia = (outro: string): number | undefined => {
    const pegada = entrada.pegadaDoToken?.(outro) ?? null
    return minhaPegada === null || pegada === null ? undefined : distanciaEntreFichas(minhaPegada, pegada)
  }
  const aliados: VizinhoNoContexto[] = []
  const inimigos: VizinhoNoContexto[] = []
  let aliadosCompletos = true
  const vistos = new Set<string>([tokenId])
  for (const carta of turnos.cartas) {
    if (vistos.has(carta.tokenId)) continue
    vistos.add(carta.tokenId)
    const personagemId = entrada.personagemDoToken(carta.tokenId)
    const ficha = fichaDe(personagemId)
    const ehAliado = typeof personagemId === 'string' && entrada.aliados !== undefined && entrada.aliados.has(personagemId)
    const vida = ficha === undefined ? undefined : vidaDe(ficha, sistema)
    const vizinho: VizinhoNoContexto = { tokenId: carta.tokenId, nome: ficha?.nome.trim() || 'Ficha', dePe: vida === undefined ? true : vida.atual > 0, npc: ficha?.tipo === 'npc' }
    const casas = distancia(carta.tokenId)
    if (casas !== undefined) vizinho.distancia = casas
    if (ehAliado) {
      if (ficha === undefined) aliadosCompletos = false
      else {
        // G1 e G2: as marcas das técnicas dele e o que ele tem para pagar (a ficha do aliado chega ao jogador pelo recorte).
        vizinho.marcas = marcasDaFicha(ficha)
        const sp = recursoDe(ficha, sistema, 'sp')
        if (sp !== undefined) vizinho.sp = sp
        const escudo = recursoDe(ficha, sistema, 'escudo')
        if (escudo !== undefined) vizinho.escudo = escudo
        if (vida !== undefined) vizinho.hp = vida.atual
      }
      aliados.push(vizinho)
    } else inimigos.push(vizinho)
  }
  const ctx: ContextoDosRequisitos = {
    quemUsa: quemUsaDe(entrada, combate, nomeDoCartao),
    aliados: { lista: aliados, completa: visao === 'tudo' || aliadosCompletos },
    // O jogador não sabe se há inimigo escondido (no escuro, fora da visão).
    inimigos: { lista: inimigos, completa: visao === 'tudo' },
    rodada: turnos.rodada,
    usadasPorAliadosNaRodada: aliados.flatMap((aliado) => {
      const personagemId = entrada.personagemDoToken(aliado.tokenId)
      const naRodada = typeof personagemId === 'string' ? turnos.combate?.[personagemId]?.rastro?.naRodada : undefined
      if (naRodada === undefined || naRodada.rodada !== turnos.rodada) return []
      const ficha = fichaDe(personagemId)
      return Object.keys(naRodada.usadas).map((id): Referencia => ({ id, nome: ficha === undefined ? '' : (todosOsCartoes(ficha).find((cartao) => cartao.id === id)?.nome ?? '') }))
    }),
    aliadoCaiuNaBatalha: aliados.some((aliado) => (turnos.jaCairam ?? []).includes(aliado.tokenId)) || aliados.some((aliado) => !aliado.dePe),
  }
  // Sem saber quem é aliado, ninguém é classificado: os requisitos de aliado e de inimigo ficam "não sei".
  if (entrada.aliados === undefined) {
    delete ctx.aliados
    delete ctx.inimigos
    delete ctx.usadasPorAliadosNaRodada
    delete ctx.aliadoCaiuNaBatalha
  }
  if (entrada.custoEmSp !== undefined) ctx.custoEmSp = entrada.custoEmSp
  if (entrada.naReacao === true) ctx.naReacao = true
  if (entrada.noTreino === true) ctx.noTreino = true
  if (entrada.autorEhMestre === true) ctx.autorEhMestre = true
  const luz = entrada.naLuz?.(tokenId) ?? null
  if (luz !== null) ctx.naLuz = luz
  if (entrada.alvos !== undefined) {
    ctx.alvos = entrada.alvos.map((alvoTokenId): AlvoNoContexto => {
      const personagemId = entrada.personagemDoToken(alvoTokenId)
      const ficha = fichaDe(personagemId)
      const aliadoOuJogador = ficha?.tipo === 'jogador' || (typeof personagemId === 'string' && entrada.aliados !== undefined && entrada.aliados.has(personagemId))
      const alvo: AlvoNoContexto = {
        tokenId: alvoTokenId,
        nome: ficha?.nome.trim() || 'Ficha',
        // O motivo de vida do alvo só sai para quem já vê a barra dele (o mestre vê tudo).
        barraVisivel: entrada.autorEhMestre === true || aliadoOuJogador || alvoTokenId === tokenId,
        selos: (turnos.selos ?? []).filter((selo) => selo.tokenId === alvoTokenId).map((selo) => selo.nome),
        marcadoPorQuemUsa: marcaDoToken(turnos.selos, alvoTokenId)?.donoId === personagem.id,
        jaAgiuNaRodada: jaAgiuNaRodada(turnos, alvoTokenId),
      }
      const vida = ficha === undefined ? undefined : vidaDe(ficha, sistema)
      if (vida !== undefined) alvo.vida = vida
      const invocado = (turnos.invocados ?? []).some((candidato) => candidato.tokenId === alvoTokenId)
      if (invocado) alvo.tipo = 'invocacao'
      else if (ficha !== undefined) alvo.tipo = ficha.tipo === 'npc' ? 'npc' : 'jogador'
      return alvo
    })
  }
  return ctx
}
