import type { Personagem } from '../personagem'
import { COR_DA_EQUIPE_DOS_JOGADORES, corDaEquipe, equipeDe, equipesNaLeitura, ladoDoNpc, type Equipe } from './equipes'
import { cartaDaVez, contrasQueSeguramAVez, type TurnosDaCena } from './turnos'
import type { EstadoParaJogador } from './vistaDoJogador'

/**
 * CAMPO DE BATALHA (protótipo aprovado em 19/11/2026,
 * docs/design/campo-de-batalha/prototipo.html): o que cada ficha leva no mapa
 * durante a batalha, igual no mestre (`pixi/tokensRenderer.ts`) e no jogador
 * (`player/PlayerView.tsx`). O mapa fala por três marcas, cada uma com uma
 * forma só:
 *
 *   ANEL de latão  = quem age agora (tracejado = a vez é dele, mas espera o contra-ataque);
 *   CANTOS na casa = o alvo (brasa depois que o golpe saiu, piscando enquanto ele decide a reação);
 *   LADO           = anel fino na cor do time, com o ponto (lado dos jogadores) ou o losango (o outro) no nome.
 *
 * Mais os fios: do atacante ao alvo enquanto o golpe espera a reação, e de quem
 * contra-ataca até quem tem a vez. Puro: sem store, sem Pixi.
 */

/** O lado da ficha: a cor do time e a forma que diz o lado sem depender da cor. */
export interface LadoNoCampo {
  /** `#rrggbb`. */
  cor: string
  /** Ponto = lado dos jogadores; losango = o outro lado. */
  forma: 'ponto' | 'losango'
}

export type AnelNoCampo = 'age' | 'espera'
export type AlvoNoCampo = 'golpe' | 'reagindo'

export interface MarcaDaFichaNoCampo {
  lado: LadoNoCampo | null
  /** Anel solto por fora: cheio em quem age, tracejado em quem espera. `null` = nenhum. */
  anel: AnelNoCampo | null
  alvo: AlvoNoCampo | null
}

/** `voo`: o golpe saiu e espera a reação do alvo. `contra`: de quem contra-ataca até quem tem a vez. */
export interface FioNoCampo {
  de: string
  para: string
  tipo: 'voo' | 'contra'
}

export interface CampoDaBatalha {
  fichas: ReadonlyMap<string, MarcaDaFichaNoCampo>
  /** Quem age agora (o anel cheio e o pulso de chegada): quem contra-ataca, senão a ficha da vez. */
  quemAge: string | null
  fios: readonly FioNoCampo[]
}

/** O lado "contra" sem equipe própria: a brasa do tema, a cor que o app já usa para o perigo. */
export const COR_DO_OUTRO_LADO = '#e2645a'

export const CAMPO_VAZIO: CampoDaBatalha = { fichas: new Map(), quemAge: null, fios: [] }

function marcaDe(fichas: Map<string, MarcaDaFichaNoCampo>, tokenId: string): MarcaDaFichaNoCampo {
  const marca = fichas.get(tokenId) ?? { lado: null, anel: null, alvo: null }
  fichas.set(tokenId, marca)
  return marca
}

/** Duas leituras do mesmo campo dão o mesmo desenho? (o mapa de marcas é refeito a cada mudança da store) */
export function mesmaMarca(a: MarcaDaFichaNoCampo | null, b: MarcaDaFichaNoCampo | null): boolean {
  if (a === null || b === null) return a === b
  return a.anel === b.anel && a.alvo === b.alvo && a.lado?.cor === b.lado?.cor && a.lado?.forma === b.lado?.forma
}

export interface MesaDoCampo {
  turnos: TurnosDaCena | null
  /** tokenId → personagemId (`Token.characterId`) das fichas do mapa. */
  personagemDaFicha: ReadonlyMap<string, string | null>
  equipes: readonly Equipe[] | undefined
  personagens: readonly Personagem[]
}

/** O lado de um personagem na tela do mestre: a cor da equipe; sem equipe, o lado (jogadores ou contra). */
function ladoNoMestre(personagemId: string | null, mesa: MesaDoCampo): LadoNoCampo | null {
  if (personagemId === null) return null
  const personagem = mesa.personagens.find((p) => p.id === personagemId)
  if (personagem === undefined) return null
  const equipes = mesa.equipes === undefined ? undefined : equipesNaLeitura(mesa.equipes, mesa.personagens)
  const equipe = equipeDe(personagemId, equipes)
  const dosJogadores = personagem.tipo === 'jogador' || ladoDoNpc(personagemId, mesa.equipes, mesa.personagens) === 'jogadores'
  const cor = equipe !== null ? corDaEquipe(equipe.cor) : dosJogadores ? COR_DA_EQUIPE_DOS_JOGADORES : COR_DO_OUTRO_LADO
  return { cor, forma: dosJogadores ? 'ponto' : 'losango' }
}

/** O campo na tela do mestre: tudo da cena aberta. */
export function campoDoMestre(mesa: MesaDoCampo): CampoDaBatalha {
  const { turnos } = mesa
  if (turnos === null) return CAMPO_VAZIO
  const fichas = new Map<string, MarcaDaFichaNoCampo>()
  for (const carta of turnos.cartas) {
    if (!mesa.personagemDaFicha.has(carta.tokenId)) continue
    marcaDe(fichas, carta.tokenId).lado = ladoNoMestre(carta.personagemId ?? mesa.personagemDaFicha.get(carta.tokenId) ?? null, mesa)
  }
  const fios: FioNoCampo[] = []
  const daVez = cartaDaVez(turnos)?.tokenId ?? null
  const contra = contrasQueSeguramAVez(turnos)[0] ?? null
  const quemAge = contra !== null && mesa.personagemDaFicha.has(contra.tokenId) ? contra.tokenId : daVez
  if (quemAge !== null) marcaDe(fichas, quemAge).anel = 'age'
  if (daVez !== null && quemAge !== daVez) {
    marcaDe(fichas, daVez).anel = 'espera'
    if (quemAge !== null) fios.push({ de: quemAge, para: daVez, tipo: 'contra' })
  }
  for (const golpe of turnos.golpes ?? []) {
    for (const alvo of golpe.alvos) {
      if (!mesa.personagemDaFicha.has(alvo.tokenId)) continue
      const esperando = alvo.danoFinal === undefined
      const marca = marcaDe(fichas, alvo.tokenId)
      // Um alvo que ainda decide vence o que já foi resolvido (dois golpes no mesmo alvo).
      if (marca.alvo !== 'reagindo') marca.alvo = esperando ? 'reagindo' : 'golpe'
      if (esperando && golpe.atacanteTokenId !== alvo.tokenId && mesa.personagemDaFicha.has(golpe.atacanteTokenId)) fios.push({ de: golpe.atacanteTokenId, para: alvo.tokenId, tipo: 'voo' })
    }
  }
  return { fichas, quemAge, fios }
}

/**
 * O campo na tela do jogador: só o que o recorte dele leva. O lado vem da
 * carta (a equipe, se tem; senão "eu" e "aliado" são o lado dos jogadores).
 */
export function campoDoJogador(estado: EstadoParaJogador | undefined): CampoDaBatalha {
  if (estado === undefined) return CAMPO_VAZIO
  const fichas = new Map<string, MarcaDaFichaNoCampo>()
  for (const carta of estado.cartas) {
    if (carta.bando !== undefined) continue
    const dosJogadores = carta.lado !== 'outro'
    const cor = carta.equipe !== undefined ? carta.equipe.cor : dosJogadores ? COR_DA_EQUIPE_DOS_JOGADORES : COR_DO_OUTRO_LADO
    marcaDe(fichas, carta.tokenId).lado = { cor, forma: dosJogadores ? 'ponto' : 'losango' }
  }
  const fios: FioNoCampo[] = []
  const daVez = estado.vez === null ? null : (estado.cartas.find((carta) => carta.id === estado.vez)?.tokenId ?? null)
  const contra = estado.esperaContra?.tokenId ?? null
  const quemAge = contra ?? daVez
  if (quemAge !== null) marcaDe(fichas, quemAge).anel = 'age'
  if (daVez !== null && quemAge !== daVez) {
    marcaDe(fichas, daVez).anel = 'espera'
    if (quemAge !== null) fios.push({ de: quemAge, para: daVez, tipo: 'contra' })
  }
  for (const golpe of estado.golpes ?? []) {
    for (const alvo of golpe.alvos) {
      const esperando = alvo.saida === undefined
      const marca = marcaDe(fichas, alvo.tokenId)
      if (marca.alvo !== 'reagindo') marca.alvo = esperando ? 'reagindo' : 'golpe'
      if (esperando && golpe.atacanteTokenId !== alvo.tokenId) fios.push({ de: golpe.atacanteTokenId, para: alvo.tokenId, tipo: 'voo' })
    }
  }
  // A ficha DELE que precisa reagir (o golpe pode ter vindo de fora da vista dele).
  for (const reacao of estado.reacoes ?? []) marcaDe(fichas, reacao.tokenId).alvo = 'reagindo'
  return { fichas, quemAge, fios }
}
