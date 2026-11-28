/**
 * AS CONDIÇÕES DA FICHA NA BATALHA (sistema de itens refeito, PLANO §1.5 e §3 E6c; decisões 10 e 11): a
 * condição de alguém mora em `Personagem.condicoes` (o jogador: a ficha; o NPC: a cópia daquele token).
 * Aqui a store da batalha as lê e grava pela mesa, com o Desfazer de cada linha:
 *  - o acerto do item as PÕE (`porCondicoesDoAcerto`), e o espelho entra na hora (a cura logo depois já
 *    vem cortada);
 *  - a batalha as LÊ pelo espelho (`daFichaNaMesa`, que a ponte das pastilhas usa): Atordoado trava, a de
 *    regra `vida` pede "Aplicar / pular" no começo da vez, a de regra `cura` corta a cura;
 *  - o FIM DA VEZ de quem está com ela desconta (`contarFimDaVezNaMesa`);
 *  - o FIM DA BATALHA tira as que têm duração e deixa as "até alguém tirar" (`tirarNoFimDaBatalhaNaMesa`).
 *
 * Só na mesa que guarda as condições na ficha (`mesa.condicoesCriadas`); no treino do Lobby e na Arena nada
 * daqui roda (A10: o treino não deixa marca).
 */
import type { SeloDaBatalha } from '../../lib/batalha/combate'
import { fichaComAsCondicoesDoAcerto, type AoAcertarDoGolpe } from '../../lib/batalha/aoAcertarDoItem'
import type { MesaDaBatalha } from '../../lib/batalha/mesa'
import type { Reversao } from '../../lib/batalha/registro'
import type { CartaDaOrdem } from '../../lib/batalha/turnos'
import { novoIdDeSelo } from '../../lib/batalha/selos'
import { condicaoDoCatalogo } from '../../lib/condicoes/catalogo'
import { fimDaVezComGatilhos, type DisparoDoGatilho, type FimDaVezComGatilhos } from '../../lib/condicoes/gatilho'
import { comCondicoesNaFicha, condicoesDe, tirarNoFimDaBatalha, type CondicoesQueAcabaram } from '../../lib/condicoes/naFicha'
import type { CondicaoNaFicha } from '../../lib/itens/modelo'
import type { Personagem } from '../../lib/personagem'
import type { CondicaoPropria } from '../../types/map'
import { chaveDoSelo, espelhosDasPastilhas, pedidosDasCondicoesDaFicha, type CondicoesDasFichas } from '../../lib/ponteDasCondicoes'

function mesmas(a: readonly CondicaoNaFicha[], b: readonly CondicaoNaFicha[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** O que mudou nas condições de uma ficha: a parte do Desfazer e os nomes do que acabou. */
export interface CondicoesMudadas {
  parte: Extract<Reversao, { tipo: 'condicoes' }>
  acabaram: string[]
}

/** Grava `mudar` nas condições da ficha `personagemId` e devolve o Desfazer. `null` = nada mudou, ou a mesa não gravou. */
function mudarCondicoes(mesa: MesaDaBatalha, personagemId: string, mudar: (atual: Personagem) => CondicoesQueAcabaram): CondicoesMudadas | null {
  let antes: readonly CondicaoNaFicha[] = []
  let depois: readonly CondicaoNaFicha[] = []
  let acabaram: CondicaoNaFicha[] = []
  const gravou = mesa.ajustarPersonagem(personagemId, (atual) => {
    const feito = mudar(atual)
    antes = condicoesDe(atual)
    depois = condicoesDe(feito.personagem)
    acabaram = feito.acabaram
    return feito.personagem
  })
  if (!gravou || mesmas(antes, depois)) return null
  const criadas = mesa.condicoesCriadas?.() ?? []
  const nomes = acabaram.map((condicao) => condicaoDoCatalogo(condicao.condId, criadas)?.nome ?? 'Condição')
  return { parte: { tipo: 'condicoes', personagemId, antes, depois }, acabaram: nomes }
}

/** A mesa guarda as condições na ficha? (a da aventura sim; o treino do Lobby e a Arena não). */
export function condicoesNaFicha(mesa: MesaDaBatalha): boolean {
  return mesa.condicoesCriadas !== undefined
}

/**
 * Para a ponte das pastilhas: os espelhos que a ficha de personagem de cada token pede (a cópia, no NPC).
 * A ficha é a da carta do token na ordem (a mesma que o golpe lê); sem carta, a ligada ao token.
 */
export function daFichaNaMesa(mesa: MesaDaBatalha, cartas: readonly Pick<CartaDaOrdem, 'tokenId' | 'personagemId'>[] = []): CondicoesDasFichas | undefined {
  const lerCriadas = mesa.condicoesCriadas
  if (lerCriadas === undefined) return undefined
  const criadas = lerCriadas()
  const personagens = mesa.personagens()
  return (ficha) => {
    const personagemId = cartas.find((carta) => carta.tokenId === ficha.id)?.personagemId ?? ficha.characterId
    return pedidosDasCondicoesDaFicha(personagemId === null ? null : personagens.find((personagem) => personagem.id === personagemId), criadas)
  }
}

/** O Desfazer de cada selo que o espelho mudou (pôs, renovou ou tirou), como as outras linhas o guardam. */
function partesDosEspelhos(antes: readonly SeloDaBatalha[], depois: readonly SeloDaBatalha[]): Reversao[] {
  const porId = new Map(antes.map((selo) => [selo.id, selo]))
  const ficaram = new Set(depois.map((selo) => selo.id))
  const partes: Reversao[] = []
  for (const selo of depois) {
    const velho = porId.get(selo.id)
    if (velho === undefined) partes.push({ tipo: 'selo', seloId: selo.id, antes: null })
    else if (velho !== selo) partes.push({ tipo: 'selo', seloId: selo.id, antes: velho, editado: true })
  }
  for (const selo of antes) if (!ficaram.has(selo.id)) partes.push({ tipo: 'selo', seloId: selo.id, antes: selo })
  return partes
}

/** O espelho da ficha `tokenId` em dia agora (depois de a linha mexer nas condições dela). `null` = nada mudou, ou a mesa sem mapa. */
export function espelhoNaHora(mesa: MesaDaBatalha, sceneKey: string, selos: readonly SeloDaBatalha[], tokenId: string, personagemId: string, rodada: number): { selos: SeloDaBatalha[]; partes: Reversao[] } | null {
  const ficha = mesa.fichaDaCena?.(sceneKey, tokenId) ?? null
  const daFicha = daFichaNaMesa(mesa, [{ tokenId, personagemId }])
  if (ficha === null || daFicha === undefined) return null
  const novos = espelhosDasPastilhas(selos, [ficha], rodada, novoIdDeSelo, daFicha)
  return novos === null ? null : { selos: novos, partes: partesDosEspelhos(selos, novos) }
}

/** O ACERTO do item põe as condições dele na ficha do alvo. `null` = a mesa não guarda condição na ficha, ou nada entrou. */
export function porCondicoesDoAcerto(mesa: MesaDaBatalha, personagemId: string, aoAcertar: Pick<AoAcertarDoGolpe, 'condicoes' | 'origem'>): CondicoesMudadas | null {
  const lerCriadas = mesa.condicoesCriadas
  if (lerCriadas === undefined || aoAcertar.condicoes.length === 0) return null
  const criadas = lerCriadas()
  return mudarCondicoes(mesa, personagemId, (atual) => ({ personagem: fichaComAsCondicoesDoAcerto(atual, aoAcertar, criadas), acabaram: [] }))
}

/** O fim da vez na mesa: o que mudou nas condições e o que os gatilhos dispararam (o dano e a cura vão para a vida por quem chama). */
export interface FimDaVezNaMesa extends CondicoesMudadas {
  disparos: DisparoDoGatilho[]
  dano: number
  cura: number
}

/**
 * FIM DA VEZ de quem tem a ficha: a "por N turnos" desconta 1 e sai ao chegar a 0, e cada gatilho
 * ("depois de X turnos", pedido de 26/11) conta 1 e dispara ao chegar a X (`fimDaVezComGatilhos`).
 * `null` = nada a contar, ou a mesa sem condição na ficha.
 */
export function contarFimDaVezNaMesa(mesa: MesaDaBatalha, personagemId: string): FimDaVezNaMesa | null {
  const lerCriadas = mesa.condicoesCriadas
  if (lerCriadas === undefined) return null
  const criadas = lerCriadas()
  // A conta é feita dentro da gravação da mesa (sobre a ficha de agora); a caixa a traz para fora.
  const caixa: { antes?: readonly CondicaoNaFicha[]; feito?: FimDaVezComGatilhos } = {}
  const gravou = mesa.ajustarPersonagem(personagemId, (atual) => {
    const feito = fimDaVezComGatilhos(atual, criadas)
    caixa.antes = condicoesDe(atual)
    caixa.feito = feito
    return feito.personagem
  })
  const { antes, feito } = caixa
  if (!gravou || antes === undefined || feito === undefined) return null
  const depois = condicoesDe(feito.personagem)
  // "A cada 1 turno, continua": a lista fica igual, mas o disparo vale (o dano e a cura da vez).
  if (mesmas(antes, depois) && feito.disparos.length === 0) return null
  return { parte: { tipo: 'condicoes', personagemId, antes, depois }, acabaram: nomesDasQueAcabaram(feito, criadas), disparos: feito.disparos, dano: feito.dano, cura: feito.cura }
}

function nomesDasQueAcabaram(feito: FimDaVezComGatilhos, criadas: readonly CondicaoPropria[]): string[] {
  return feito.acabaram.map((condicao) => condicaoDoCatalogo(condicao.condId, criadas)?.nome ?? 'Condição')
}

/**
 * Bugs da batalha, rodada 2 (28/11/2026): os nomes das condições da ficha que o fim da vez dela apaga agora,
 * SEM gravar. O "Recupera por turno" de quem entra é lido antes de o prazo andar (`contarFimDaVezNaMesa`):
 * com isto ele já não é cortado pela Cura reduzida que acaba nesta mesma virada.
 */
export function condicoesQueAcabamNoFimDaVez(mesa: MesaDaBatalha, personagemId: string): string[] {
  const lerCriadas = mesa.condicoesCriadas
  const ficha = mesa.personagens().find((candidato) => candidato.id === personagemId)
  if (lerCriadas === undefined || ficha === undefined) return []
  const criadas = lerCriadas()
  return nomesDasQueAcabaram(fimDaVezComGatilhos(ficha, criadas), criadas)
}

/** FIM DA BATALHA (decisão 11): em cada ficha dela, saem as com duração e as "até o fim da batalha"; a "até alguém tirar" fica. */
export function tirarNoFimDaBatalhaNaMesa(mesa: MesaDaBatalha, personagemIds: Iterable<string>): void {
  if (!condicoesNaFicha(mesa)) return
  for (const personagemId of personagemIds) mudarCondicoes(mesa, personagemId, tirarNoFimDaBatalha)
}

/**
 * O mestre TIROU o espelho de uma condição da ficha (a pílula da batalha): sai da ficha também, senão o
 * espelho voltaria na próxima vez. `null` = o nome não é condição posta nesta ficha.
 */
export function tirarDaFichaPeloEspelho(mesa: MesaDaBatalha, personagemId: string, nomeDoSelo: string): CondicoesMudadas | null {
  const lerCriadas = mesa.condicoesCriadas
  if (lerCriadas === undefined) return null
  const criadas = lerCriadas()
  const chave = chaveDoSelo(nomeDoSelo)
  return mudarCondicoes(mesa, personagemId, (atual) => {
    const atuais = condicoesDe(atual)
    const saem = atuais.filter((condicao) => {
      const nome = condicaoDoCatalogo(condicao.condId, criadas)?.nome
      return nome !== undefined && chaveDoSelo(nome) === chave
    })
    if (saem.length === 0) return { personagem: atual, acabaram: [] }
    return { personagem: comCondicoesNaFicha(atual, atuais.filter((condicao) => !saem.includes(condicao))), acabaram: saem }
  })
}
