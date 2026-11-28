/**
 * REWORK DAS CONDIÇÕES, D9 (PENDENCIAS nº 1): a peça AURA age. Quem está a até N casas do portador (a
 * distância do xadrez da batalha, `distanciaEntreFichas`, de borda a borda) e do lado que a peça escolhe
 * (aliados, inimigos ou todos, pelo lado da luta) ganha a condição da aura; perde quando a distância passa
 * ou quando o portador perde a condição. Puro: a store (`stores/batalha/nucleo.ts`, `comAurasEmDia`) põe e
 * tira os selos e escreve a linha; o mapa do mestre desenha o raio (`pixi/drawAuras.ts`).
 *
 * As regras:
 *  - o portador é o selo com aura (`regras.auras`, ou a de fábrica pelo nome) que NÃO veio de aura (`daAura`
 *    ausente): a pega não irradia, a não ser pela aura que "passa adiante" (`espalha`), que vale a partir de
 *    cada ficha que pegou, sem laço (cada ficha pega uma vez e a pega aponta o portador de origem);
 *  - quem já tem a condição por conta própria (o selo direto, o espelho da ficha) não ganha outra;
 *  - a pega dura enquanto valer (sem turnos) e sai sozinha quando deixa de valer.
 */
import { distanciaEntreFichas, type PegadaNaGrade } from './area'
import type { AuraDoSelo, SeloDaBatalha } from './combate'
import { nomeDaCondicaoDoSelo, regrasDoSelo } from './condicoes'
import type { TurnosDaCena } from './turnos'
import { chaveDaCondicao } from '../condicoes/modelo'

/** Uma ficha da batalha com lugar na grade (a que não tem lugar fica fora da aura: D9, só a batalha com mapa). */
export interface FichaNaAura {
  tokenId: string
  personagemId: string | null
  pegada: PegadaNaGrade
}

/** Uma ficha que passa a ter a condição `nome` pela aura do selo `fonte` (o portador de origem), irradiada da ficha `portadorTokenId`. */
export interface PegaDaAura {
  tokenId: string
  nome: string
  fonte: SeloDaBatalha
  portadorTokenId: string
}

/** O que muda nas auras: as pegas novas e os selos de aura que saem. Nada a mudar = as duas listas vazias. */
export interface MudancaDasAuras {
  entram: readonly PegaDaAura[]
  saem: readonly SeloDaBatalha[]
}

/** Um raio para o mapa: em volta de `tokenId`, `casas` casas, da condição do selo `seloId`. */
export interface RaioDaAura {
  seloId: string
  tokenId: string
  casas: number
  /** O id da condição do catálogo que irradia (a cor do raio); ausente = o selo sem regra congelada. */
  condId?: string
  positiva: boolean
}

/** "Aliados", "inimigos" ou "todos", pelo lado da luta (`mesmoLadoNaBatalha`). */
export type MesmoLadoNaLuta = (deQuem: string | null, outro: string | null) => boolean

const SEM_MUDANCA: MudancaDasAuras = { entram: [], saem: [] }

/** A chave da condição de um nome de selo ("Atordoado 2" = a do Atordoado), sem acento nem caixa. */
function chaveDoNome(nome: string): string {
  return chaveDaCondicao(nomeDaCondicaoDoSelo({ nome }))
}

function chaveNaFicha(tokenId: string, nome: string): string {
  return `${tokenId}|${chaveDoNome(nome)}`
}

/** As auras do selo portador; a pega (o selo com `daAura`) não irradia por conta própria. */
function aurasDoPortador(selo: SeloDaBatalha): readonly AuraDoSelo[] {
  return selo.daAura === undefined ? (regrasDoSelo(selo)?.auras ?? []) : []
}

/** Algum selo da cena tem a ver com aura (o portador ou a pega)? O atalho de quem chama a cada gravação. */
export function temAura(selos: readonly SeloDaBatalha[] | undefined): boolean {
  return (selos ?? []).some((selo) => selo.daAura !== undefined || aurasDoPortador(selo).length > 0)
}

/** A ficha `alvo` está do lado que a aura pega, visto do portador `de`. */
function ladoQuePega(quem: AuraDoSelo['quem'], de: FichaNaAura, alvo: FichaNaAura, mesmoLado: MesmoLadoNaLuta): boolean {
  if (quem === 'todos') return true
  const aliado = mesmoLado(de.personagemId, alvo.personagemId)
  return quem === 'aliados' ? aliado : !aliado
}

/** As fichas da batalha (as cartas e os invocados, uma vez cada) com o lugar delas na grade; sem lugar = fora. */
export function fichasNaAura(turnos: Pick<TurnosDaCena, 'cartas' | 'invocados'>, pegadaDe: (tokenId: string) => PegadaNaGrade | null): FichaNaAura[] {
  const vistas = new Set<string>()
  const fichas: FichaNaAura[] = []
  const somar = (tokenId: string, personagemId: string | null): void => {
    if (vistas.has(tokenId)) return
    vistas.add(tokenId)
    const pegada = pegadaDe(tokenId)
    if (pegada !== null) fichas.push({ tokenId, personagemId, pegada })
  }
  for (const carta of turnos.cartas) somar(carta.tokenId, carta.personagemId)
  for (const invocado of turnos.invocados ?? []) somar(invocado.tokenId, invocado.personagemId)
  return fichas
}

/** Uma fonte na fila: o portador de origem e a ficha de onde a aura sai agora (a dele, ou a de quem pegou e passa adiante). */
interface FonteNaFila {
  selo: SeloDaBatalha
  tokenId: string
  auras: readonly AuraDoSelo[]
}

/**
 * As auras em dia: as pegas que devem valer agora, contra as que valem. Cada pega é uma ficha e uma
 * condição (pela chave do nome); a que já vale continua com o mesmo selo (nada se refaz à toa), a que
 * deixou de valer sai e a que falta entra. Duas pegas da mesma condição na mesma ficha: fica uma.
 */
export function mudancaDasAuras(selos: readonly SeloDaBatalha[] | undefined, fichas: readonly FichaNaAura[], mesmoLado: MesmoLadoNaLuta): MudancaDasAuras {
  const lista = selos ?? []
  if (!temAura(lista)) return SEM_MUDANCA
  const porToken = new Map(fichas.map((ficha) => [ficha.tokenId, ficha]))
  const proprias = new Set(lista.filter((selo) => selo.daAura === undefined).map((selo) => chaveNaFicha(selo.tokenId, selo.nome)))
  const devem = new Map<string, PegaDaAura>()
  const fila: FonteNaFila[] = lista.flatMap((selo) => {
    const auras = aurasDoPortador(selo)
    return auras.length === 0 ? [] : [{ selo, tokenId: selo.tokenId, auras }]
  })
  // A fila cresce com quem passa adiante; cada ficha pega uma vez (`devem`), e assim a fila acaba.
  for (let i = 0; i < fila.length; i += 1) {
    const fonte = fila[i]
    const de = porToken.get(fonte.tokenId)
    if (de === undefined) continue
    for (const aura of fonte.auras) {
      for (const alvo of fichas) {
        if (alvo.tokenId === fonte.tokenId || distanciaEntreFichas(de.pegada, alvo.pegada) > aura.casas || !ladoQuePega(aura.quem, de, alvo, mesmoLado)) continue
        const chave = chaveNaFicha(alvo.tokenId, aura.nome)
        if (proprias.has(chave) || devem.has(chave)) continue
        devem.set(chave, { tokenId: alvo.tokenId, nome: aura.nome, fonte: fonte.selo, portadorTokenId: fonte.tokenId })
        if (aura.espalha === true) fila.push({ selo: fonte.selo, tokenId: alvo.tokenId, auras: [aura] })
      }
    }
  }
  const ficam = new Set<string>()
  const saem: SeloDaBatalha[] = []
  for (const selo of lista) {
    if (selo.daAura === undefined) continue
    const chave = chaveNaFicha(selo.tokenId, selo.nome)
    if (devem.has(chave) && !ficam.has(chave)) ficam.add(chave)
    else saem.push(selo)
  }
  const entram = [...devem].filter(([chave]) => !ficam.has(chave)).map(([, pega]) => pega)
  return entram.length === 0 && saem.length === 0 ? SEM_MUDANCA : { entram, saem }
}

/**
 * Os raios para o mapa do mestre: cada portador, e cada pega que passa adiante, com as casas da aura. A
 * pega que não passa adiante não tem raio (ela não irradia).
 */
export function raiosDasAuras(selos: readonly SeloDaBatalha[] | undefined): RaioDaAura[] {
  const lista = selos ?? []
  const porId = new Map(lista.map((selo) => [selo.id, selo]))
  const raios: RaioDaAura[] = []
  const somar = (selo: SeloDaBatalha, de: SeloDaBatalha, aura: AuraDoSelo): void => {
    const regras = regrasDoSelo(de)
    const raio: RaioDaAura = { seloId: selo.id, tokenId: selo.tokenId, casas: aura.casas, positiva: regras?.tipo === 'positiva' }
    if (regras !== null) raio.condId = regras.condId
    raios.push(raio)
  }
  for (const selo of lista) {
    if (selo.daAura === undefined) {
      for (const aura of aurasDoPortador(selo)) somar(selo, selo, aura)
      continue
    }
    const origem = porId.get(selo.daAura)
    const chave = chaveDoNome(selo.nome)
    const passa = origem === undefined ? undefined : aurasDoPortador(origem).find((aura) => aura.espalha === true && chaveDoNome(aura.nome) === chave)
    if (origem !== undefined && passa !== undefined) somar(selo, origem, passa)
  }
  return raios
}
