import type { CartaoDaFicha, Personagem } from './personagem'

/**
 * HABILIDADE OCULTA (construtor de mecânicas, fatia C7; pedido do mestre de
 * 07/11: "habilidades ocultas que ficam como ??? até eu por na batalha ou na
 * ficha que eles podem ver").
 *
 * O cartão do mestre guarda `oculta: true` e continua inteiro no disco dele.
 * O que vai ao jogador (sala LAN pelo `paraOFio`, Lobby pelo emissor) é a
 * ficha SEM o cartão: o segredo (nome, texto, números, mecânica) nunca sai do
 * app do mestre, nem para o servidor do Lobby. No lugar fica só a contagem por
 * aba (`Personagem.ocultas`), que a ficha do jogador mostra como "???".
 *
 * Tirar o cartão (em vez de mandar um cartão "???" vazio) deixa a batalha do
 * jogador, o treino e o duelo do site sem nada a filtrar: o cartão nem existe
 * lá. O custo é a volta: quem recebe a edição do jogador (a aba inteira) põe os
 * cartões ocultos de volta (`comOcultasDe`), e quem recebe op do Lobby não deixa
 * nenhuma tocar num cartão oculto (`caminhoTocaOculta`).
 *
 * Puro: nada de store, nada de rede.
 */

/** O que o jogador vê no lugar do nome, do texto e dos números. */
export const NOME_DO_OCULTO = '???'

/** Teto da contagem por aba que a leitura aceita: mais que isso não é contagem de cartões. */
export const OCULTAS_POR_ABA_MAX = 1000

/** Os ids de todos os cartões dentro de algum cartão oculto (ele e os subcartões dele), em todas as abas. */
export function idsOcultos(personagem: Pick<Personagem, 'abas'>): Set<string> {
  const ids = new Set<string>()
  const juntarTudo = (cartao: CartaoDaFicha): void => {
    ids.add(cartao.id)
    cartao.subcartoes.forEach(juntarTudo)
  }
  const visitar = (cartao: CartaoDaFicha): void => {
    if (cartao.oculta === true) juntarTudo(cartao)
    else cartao.subcartoes.forEach(visitar)
  }
  for (const cartoes of Object.values(personagem.abas)) cartoes.forEach(visitar)
  return ids
}

/** A ficha tem ao menos um cartão oculto, em qualquer aba e nível. */
export function temOculta(personagem: Pick<Personagem, 'abas'>): boolean {
  const algum = (cartao: CartaoDaFicha): boolean => cartao.oculta === true || cartao.subcartoes.some(algum)
  return Object.values(personagem.abas).some((cartoes) => cartoes.some(algum))
}

/** O cartão `cartaoId` está oculto: ele mesmo ou algum cartão de cima dele. */
export function cartaoEstaOculto(personagem: Pick<Personagem, 'abas'>, cartaoId: string): boolean {
  return idsOcultos(personagem).has(cartaoId)
}

interface ListaSemOcultos {
  cartoes: CartaoDaFicha[]
  /**
   * Quantos cartões ocultos saíram DESTE nível. O subcartão oculto de um
   * cartão visível (técnica da forma, bala da arma) sai sem contar: o "???"
   * da aba fica no fim da lista de cima, e lá ele seria um cartão solto, fora
   * do cartão dono (revisão da fatia C7).
   */
  tirados: number
}

/** A lista sem os cartões ocultos, em qualquer nível. A MESMA lista quando nada sai. */
function listaSemOcultos(cartoes: CartaoDaFicha[]): ListaSemOcultos {
  let tirados = 0
  let mudou = false
  const ficam: CartaoDaFicha[] = []
  for (const cartao of cartoes) {
    if (cartao.oculta === true) {
      tirados += 1
      mudou = true
      continue
    }
    const subs = listaSemOcultos(cartao.subcartoes)
    if (subs.cartoes === cartao.subcartoes) ficam.push(cartao)
    else {
      mudou = true
      ficam.push({ ...cartao, subcartoes: subs.cartoes })
    }
  }
  return { cartoes: mudou ? ficam : cartoes, tirados }
}

/**
 * A ficha como o JOGADOR a recebe: sem nenhum cartão oculto (nem os
 * subcartões dele), sem os ids deles nos cartões ligados e com a contagem por
 * aba em `ocultas` (ausente = nenhum). Sem cartão oculto e sem `ocultas`
 * devolve a MESMA referência: o host compara por referência para não reenviar.
 */
export function semOcultas(personagem: Personagem): Personagem {
  const ocultos = idsOcultos(personagem)
  if (ocultos.size === 0) {
    if (personagem.ocultas === undefined) return personagem
    const { ocultas: _velha, ...semContagem } = personagem
    return semContagem
  }
  const contagem: Record<string, number> = {}
  const abas: Record<string, CartaoDaFicha[]> = {}
  for (const [abaId, cartoes] of Object.entries(personagem.abas)) {
    const { cartoes: ficam, tirados } = listaSemOcultos(cartoes)
    abas[abaId] = ficam
    if (tirados > 0) contagem[abaId] = Math.min(tirados, OCULTAS_POR_ABA_MAX)
  }
  const { ocultas: _velha, ...resto } = personagem
  const semOsOcultos: Personagem = { ...resto, abas, cartoesAtivos: personagem.cartoesAtivos.filter((id) => !ocultos.has(id)) }
  // Só subcartão oculto (nenhum "???" solto na aba): sem a contagem, como a ficha que não tem oculto.
  return Object.keys(contagem).length === 0 ? semOsOcultos : { ...semOsOcultos, ocultas: contagem }
}

/** Os cartões ocultos de uma lista (só os do nível dela), cada um com o id do cartão visível que vinha antes dele (`null` = o primeiro da lista). */
function ocultosComVizinho(cartoes: readonly CartaoDaFicha[]): { cartao: CartaoDaFicha; depoisDe: string | null }[] {
  const saida: { cartao: CartaoDaFicha; depoisDe: string | null }[] = []
  let anterior: string | null = null
  for (const cartao of cartoes) {
    if (cartao.oculta === true) saida.push({ cartao, depoisDe: anterior })
    else anterior = cartao.id
  }
  return saida
}

/** O cartão sem as duas marcas que só o mestre grava. */
function semMarcaDeOculta(cartao: CartaoDaFicha): CartaoDaFicha {
  if (cartao.oculta === undefined && cartao.revelaAoUsar === undefined) return cartao
  const { oculta: _oculta, revelaAoUsar: _revela, ...resto } = cartao
  return resto
}

/**
 * A lista que veio do JOGADOR (sem os ocultos, porque ele nunca os viu) com
 * os cartões ocultos de `fonte` (a lista do host) de volta, cada um logo depois
 * do cartão visível que vinha antes dele; o que perdeu o vizinho vai para o
 * fim. Vale em todo nível: o subcartão oculto volta para dentro do cartão
 * visível de mesmo id. O cartão do jogador nunca traz a marca de oculta (só o
 * mestre grava), e o que repete o id de um oculto sai: nem apagar, nem trocar,
 * nem forjar um cartão oculto pela edição do jogador.
 */
export function comOcultasDe(fonte: readonly CartaoDaFicha[], recebidos: readonly CartaoDaFicha[]): CartaoDaFicha[] {
  const ocultos = ocultosComVizinho(fonte)
  const idsDosOcultos = new Set(ocultos.map(({ cartao }) => cartao.id))
  const fontePorId = new Map(fonte.map((cartao): [string, CartaoDaFicha] => [cartao.id, cartao]))
  const visiveis = recebidos
    .filter((cartao) => !idsDosOcultos.has(cartao.id))
    .map((cartao) => {
      const limpo = semMarcaDeOculta(cartao)
      const daFonte = fontePorId.get(cartao.id)
      if (daFonte === undefined || !temOculta({ abas: { _: daFonte.subcartoes } })) return limpo
      const subcartoes = comOcultasDe(daFonte.subcartoes, limpo.subcartoes)
      return mesmaListaPorReferencia(subcartoes, limpo.subcartoes) ? limpo : { ...limpo, subcartoes }
    })
  if (ocultos.length === 0) return visiveis
  const idsVisiveis = new Set(visiveis.map((cartao) => cartao.id))
  const noComeco = ocultos.filter(({ depoisDe }) => depoisDe === null).map(({ cartao }) => cartao)
  const noFim = ocultos.filter(({ depoisDe }) => depoisDe !== null && !idsVisiveis.has(depoisDe)).map(({ cartao }) => cartao)
  const saida: CartaoDaFicha[] = [...noComeco]
  for (const cartao of visiveis) {
    saida.push(cartao)
    for (const oculto of ocultos) if (oculto.depoisDe === cartao.id) saida.push(oculto.cartao)
  }
  return [...saida, ...noFim]
}

/**
 * A ficha que voltou de fora (edição do jogador aplicada, op do Lobby, ficha
 * trocada inteira) com os cartões ocultos de `local` de volta: nas abas e nos
 * cartões ligados (a forma oculta ligada continua ligada), e sem a contagem
 * `ocultas`, que é só da projeção. A MESMA referência quando já estava certa.
 */
export function comOcultasDoLocal(local: Personagem, recebida: Personagem): Personagem {
  const ocultosDoLocal = idsOcultos(local)
  if (ocultosDoLocal.size === 0) {
    if (recebida.ocultas === undefined) return recebida
    const { ocultas: _projecao, ...semContagem } = recebida
    return semContagem
  }
  const { ocultas: _projecao, ...semContagem } = recebida
  const abas: Record<string, CartaoDaFicha[]> = { ...recebida.abas }
  for (const [abaId, cartoes] of Object.entries(local.abas)) {
    if (!temOculta({ abas: { [abaId]: cartoes } })) continue
    abas[abaId] = comOcultasDe(cartoes, recebida.abas[abaId] ?? [])
  }
  const ligadosOcultos = local.cartoesAtivos.filter((id) => ocultosDoLocal.has(id))
  const cartoesAtivos = [...recebida.cartoesAtivos.filter((id) => !ocultosDoLocal.has(id)), ...ligadosOcultos]
  const mesmasAbas = Object.keys(abas).every((abaId) => mesmaListaPorReferencia(abas[abaId] ?? [], recebida.abas[abaId] ?? []))
  if (mesmasAbas && recebida.ocultas === undefined && mesmaListaPorReferencia(cartoesAtivos, recebida.cartoesAtivos)) return recebida
  return { ...semContagem, abas, cartoesAtivos }
}

/** As duas listas com os mesmos itens (por referência), na mesma ordem. */
function mesmaListaPorReferencia<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, indice) => item === b[indice])
}

/**
 * A op do Lobby toca num cartão oculto da ficha local: o caminho passa por um
 * id oculto (o cartão, um subcartão, o ligado) ou é a contagem `ocultas`, que
 * é só da projeção. Quem recebe a op a deixa de fora: o cartão oculto só muda
 * no app do mestre.
 */
export function caminhoTocaOculta(local: Pick<Personagem, 'abas'>, caminho: readonly string[]): boolean {
  if (caminho[0] === 'ocultas') return true
  if (caminho[0] !== 'abas' && caminho[0] !== 'cartoesAtivos') return false
  const ocultos = idsOcultos(local)
  return ocultos.size > 0 && caminho.some((segmento) => ocultos.has(segmento))
}

/** O cartão com a marca trocada, em qualquer aba e nível; `null` = nenhum cartão mudou. */
function comCartaoMarcado(personagem: Personagem, cartaoId: string, mudar: (cartao: CartaoDaFicha) => CartaoDaFicha): Personagem | null {
  let achou = false
  const naLista = (cartoes: CartaoDaFicha[]): CartaoDaFicha[] => {
    let mudou = false
    const novos = cartoes.map((cartao) => {
      if (cartao.id === cartaoId) {
        const novo = mudar(cartao)
        if (novo !== cartao) {
          achou = true
          mudou = true
        }
        return novo
      }
      const subs = naLista(cartao.subcartoes)
      if (subs === cartao.subcartoes) return cartao
      mudou = true
      return { ...cartao, subcartoes: subs }
    })
    return mudou ? novos : cartoes
  }
  const abas = Object.fromEntries(Object.entries(personagem.abas).map(([abaId, cartoes]): [string, CartaoDaFicha[]] => [abaId, naLista(cartoes)]))
  return achou ? { ...personagem, abas } : null
}

/**
 * `cartao` com as marcas de oculta de `de` (o cartão de agora). O Desfazer
 * que volta os números de um cartão (a decisão da forma) não volta o que o
 * mestre revelou ou escondeu depois, nem o que o uso revelou. O MESMO cartão
 * quando as marcas já batem.
 */
export function comAsMarcasDeOcultaDe(cartao: CartaoDaFicha, de: Pick<CartaoDaFicha, 'oculta' | 'revelaAoUsar'>): CartaoDaFicha {
  if (cartao.oculta === de.oculta && cartao.revelaAoUsar === de.revelaAoUsar) return cartao
  const visivel = semMarcaDeOculta(cartao)
  if (de.oculta !== true) return visivel
  return de.revelaAoUsar === true ? { ...visivel, oculta: true, revelaAoUsar: true } : { ...visivel, oculta: true }
}

/** O mestre revela: o cartão volta a ir ao jogador inteiro. A MESMA ficha quando ele não estava oculto (ou não existe). */
export function revelarCartao(personagem: Personagem, cartaoId: string): Personagem {
  return comCartaoMarcado(personagem, cartaoId, semMarcaDeOculta) ?? personagem
}

/** O mestre esconde (ou ajusta "revela sozinha ao usar"). A MESMA ficha quando nada muda. */
export function ocultarCartao(personagem: Personagem, cartaoId: string, revelaAoUsar: boolean): Personagem {
  return (
    comCartaoMarcado(personagem, cartaoId, (cartao) => {
      if (cartao.oculta === true && (cartao.revelaAoUsar === true) === revelaAoUsar) return cartao
      const { revelaAoUsar: _velho, ...resto } = cartao
      return revelaAoUsar ? { ...resto, oculta: true, revelaAoUsar: true } : { ...resto, oculta: true }
    }) ?? personagem
  )
}

/** O cartão de id `cartaoId` em qualquer aba e nível; `null` = não existe. */
export function cartaoPorId(personagem: Pick<Personagem, 'abas'>, cartaoId: string): CartaoDaFicha | null {
  const naLista = (cartoes: readonly CartaoDaFicha[]): CartaoDaFicha | null => {
    for (const cartao of cartoes) {
      if (cartao.id === cartaoId) return cartao
      const sub = naLista(cartao.subcartoes)
      if (sub !== null) return sub
    }
    return null
  }
  for (const cartoes of Object.values(personagem.abas)) {
    const achado = naLista(cartoes)
    if (achado !== null) return achado
  }
  return null
}

/** Quantos "???" a aba mostra ao jogador (a contagem da projeção). */
export function ocultasDaAba(personagem: Pick<Personagem, 'ocultas'>, abaId: string): number {
  const quantos = personagem.ocultas?.[abaId] ?? 0
  return Number.isSafeInteger(quantos) && quantos > 0 ? Math.min(quantos, OCULTAS_POR_ABA_MAX) : 0
}

/**
 * O nome que a BATALHA mostra a todos (registro, selo, efeito, caixa de
 * reação): "???" enquanto o cartão está oculto, a não ser que ele revele ao
 * usar (aí o uso já o revela, `revelacaoAoUsar`). O mestre sabe o que usou;
 * a linha é a mesma para ele e para o jogador.
 */
export function nomeNaBatalha(personagem: Pick<Personagem, 'abas'> | null, cartao: CartaoDaFicha, padrao: string): string {
  return ocultoNaBatalha(personagem, cartao) ? NOME_DO_OCULTO : cartao.nome.trim() || padrao
}

/**
 * O cartão sai como "???" na batalha (`nomeNaBatalha`): oculto (ele ou um de
 * cima) e sem "revela ao usar". Aí também os números e a opção escolhida ficam
 * fora das linhas e dos efeitos que todos veem.
 */
export function ocultoNaBatalha(personagem: Pick<Personagem, 'abas'> | null, cartao: Pick<CartaoDaFicha, 'id' | 'revelaAoUsar'>): boolean {
  return personagem !== null && cartao.revelaAoUsar !== true && cartaoEstaOculto(personagem, cartao.id)
}

/** O mestre usou na batalha um cartão oculto que revela ao usar: a ficha com ele revelado; `null` = nada a revelar. */
export function revelacaoAoUsar(personagem: Personagem, cartaoId: string): Personagem | null {
  const cartao = cartaoPorId(personagem, cartaoId)
  if (cartao === null || cartao.oculta !== true || cartao.revelaAoUsar !== true) return null
  return revelarCartao(personagem, cartaoId)
}

/** O pedido do JOGADOR para usar um cartão oculto (que ele nem vê): recusado. `null` = pode seguir. */
export function motivoDoOcultoParaJogador(personagem: Pick<Personagem, 'abas'> | null, cartaoId: string | undefined): string | null {
  if (personagem === null || cartaoId === undefined) return null
  return cartaoEstaOculto(personagem, cartaoId) ? 'Essa habilidade está oculta: só o mestre usa' : null
}
