import type { Equipe } from '../../../lib/batalha/equipes'
import { LADO_DOS_JOGADORES, LADO_DOS_NPCS } from '../../../lib/dbt/batalha/inicio'
import type { NivelDeVoo, NucleoDBT, SituacaoDeMorte } from '../../../lib/dbt/batalha/tipos'
import type { CartaDBT as CartaDaVistaDBT, VistaDBT } from '../../../lib/dbt/batalha/vista'
import type { Personagem } from '../../../lib/personagem'
import type { CartaDBT } from './dadosDaBatalhaDBT'

/**
 * O QUE A FAIXA DA ORDEM DBT MOSTRA (seção 19, `FaixaDoMestreDBT` e
 * `FaixaDoJogadorDBT`): as cartas na ordem, a vez, a próxima, "Rodada R ·
 * Turno N/M" e o "Depois", já recortados para quem olha. Puro: o mestre parte
 * das cartas do painel (`cartasDaBatalha`), o jogador da `VistaDBT` que o
 * host recortou. Carta "outro" do jogador nunca traz PV nem Ki.
 */

export interface RecursoNaFaixaDBT {
  atual: number
  max: number
}

/** `numeros`: PV e Ki com os pontos. `oculta`: quem olha não vê (NPC ou outro lado, no jogador). `manual`: sem ficha DBT, o mestre resolve à mão. */
export type VidaNaFaixaDBT = 'numeros' | 'oculta' | 'manual'

export interface CartaNaFaixaDBT {
  /** O id do combatente, que é o do token. */
  id: string
  nome: string
  /** Foto pequena do token ou retrato da ficha; `null` = iniciais. */
  imagem: string | null
  /** Cor da equipe (`--lado`); `null` = lado sem equipe. */
  cor: string | null
  /** Só o mestre: o nome do lado ("Jogadores", "NPCs" ou a equipe). */
  lado: string | null
  iniciativa: number | null
  vida: VidaNaFaixaDBT
  pv: RecursoNaFaixaDBT | null
  pk: RecursoNaFaixaDBT | null
  transformacao: string | null
  voo: NivelDeVoo
  condicoes: readonly { id: string; nome: string }[]
  agarrado: boolean
  situacao: SituacaoDeMorte
  /** Só o mestre: o motivo de perder o próximo Turno de Ação. */
  perdeTurno: string | null
  /** Abre o perfil; `null` = a carta não abre nada para quem olha. */
  personagemId: string | null
  /** A carta é de quem olha (jogador). */
  minha: boolean
  npc: boolean
}

export interface DadosDaFaixaDBT {
  fase: 'iniciativa' | 'combate'
  cartas: readonly CartaNaFaixaDBT[]
  vez: string | null
  proxima: string | null
  rodada: number
  turno: { n: number; m: number }
  minhaVez: boolean
  /** Jogador: a vez é de uma ficha que a tela dele não tem. */
  vezForaDaVista: boolean
  /** "Depois: Bulma" (mestre) ou "Você joga em 2 turnos" (jogador); `null` = nada a dizer. */
  depois: string | null
}

/** O pedaço do token que a faixa lê. */
export interface FichaNaFaixaDBT {
  id: string
  name: string
  imageData?: string | null
}

const NOME_DO_LADO_PADRAO: Readonly<Record<string, string>> = { [LADO_DOS_JOGADORES]: 'Jogadores', [LADO_DOS_NPCS]: 'NPCs' }

/** "Jogadores", "NPCs" ou o nome da equipe; lado desconhecido fica com o próprio id. */
export function nomeDoLadoDBT(lado: string, equipes: readonly Equipe[]): string {
  return equipes.find((equipe) => equipe.id === lado)?.nome ?? NOME_DO_LADO_PADRAO[lado] ?? lado
}

/** A próxima carta de pé depois da vez (dá a volta na ordem); morto não joga. */
function proximaDe(cartas: readonly { id: string; situacao: SituacaoDeMorte }[], vez: string | null): string | null {
  if (vez === null) return null
  const indice = cartas.findIndex((carta) => carta.id === vez)
  if (indice < 0) return null
  for (let passo = 1; passo < cartas.length; passo += 1) {
    const carta = cartas[(indice + passo) % cartas.length]
    if (carta !== undefined && carta.situacao !== 'morto') return carta.id
  }
  return null
}

interface EntradaDoMestreDBT {
  nucleo: NucleoDBT
  /** `cartasDaBatalha(cena, fichas)`: o mesmo recorte do painel. */
  cartas: readonly CartaDBT[]
  fichas: readonly FichaNaFaixaDBT[]
  personagens: readonly Personagem[]
  equipes: readonly Equipe[]
  personagemDe: (id: string) => string | null
}

export function faixaDoMestreDBT({ nucleo, cartas, fichas, personagens, equipes, personagemDe }: EntradaDoMestreDBT): DadosDaFaixaDBT {
  const tokenPorId = new Map(fichas.map((ficha) => [ficha.id, ficha]))
  const personagemPorId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const naFaixa = cartas.map((carta): CartaNaFaixaDBT => {
    const token = tokenPorId.get(carta.id)
    const personagemId = personagemDe(carta.id)
    const personagem = personagemId === null ? undefined : personagemPorId.get(personagemId)
    return {
      id: carta.id,
      nome: token?.name.trim() || carta.nome,
      imagem: token?.imageData || personagem?.retrato || null,
      cor: equipes.find((equipe) => equipe.id === carta.lado)?.cor ?? null,
      lado: nomeDoLadoDBT(carta.lado, equipes),
      iniciativa: carta.iniciativa,
      vida: carta.manual ? 'manual' : 'numeros',
      pv: carta.pv,
      pk: carta.pk,
      transformacao: carta.transformacao,
      voo: carta.voo,
      condicoes: carta.condicoes.map((condicao) => ({ id: condicao.id, nome: condicao.nome })),
      agarrado: carta.agarradoPor !== null,
      situacao: carta.situacao,
      perdeTurno: carta.perdeTurno,
      personagemId,
      minha: false,
      npc: carta.npc,
    }
  })
  const vez = nucleo.fase === 'combate' ? nucleo.ordem.vez : null
  const proxima = proximaDe(naFaixa, vez)
  const nomeDaProxima = naFaixa.find((carta) => carta.id === proxima)?.nome
  const n = vez === null ? 0 : naFaixa.findIndex((carta) => carta.id === vez) + 1
  return {
    fase: nucleo.fase,
    cartas: naFaixa,
    vez,
    proxima,
    rodada: nucleo.ordem.rodada,
    turno: { n, m: naFaixa.length },
    minhaVez: false,
    vezForaDaVista: false,
    depois: nomeDaProxima === undefined ? null : `Depois: ${nomeDaProxima}`,
  }
}

/** O personagem da carta: o host só o manda em "eu" e "aliado" (nunca no inimigo). */
function personagemDaCartaDaVista(carta: CartaDaVistaDBT): string | null {
  return carta.personagemId === undefined || carta.personagemId === '' ? null : carta.personagemId
}

function fraseDoDepois(passos: number): string {
  return passos === 1 ? 'Você joga a seguir' : `Você joga em ${passos} turnos`
}

/** "Você joga a seguir" ou "Você joga em N turnos": a distância da vez até a próxima carta dele (só com a ordem inteira na vista). */
function depoisDoJogador(cartas: readonly CartaNaFaixaDBT[], vez: string | null): string | null {
  if (vez === null) return null
  const indice = cartas.findIndex((carta) => carta.id === vez)
  if (indice < 0) return null
  for (let passo = 1; passo <= cartas.length; passo += 1) {
    const carta = cartas[(indice + passo) % cartas.length]
    if (carta === undefined || !carta.minha) continue
    if (carta.situacao === 'morto') continue
    return fraseDoDepois(passo)
  }
  return null
}

/**
 * O "Depois" do jogador. O host conta pela ordem inteira (`turno.ateMinhaVez`,
 * com quem está fora da vista); sem o campo, só dá para contar com a ordem
 * inteira na vista (senão a conta mentiria).
 */
function depoisDaVista(vista: VistaDBT, cartas: readonly CartaNaFaixaDBT[], vez: string | null, ordemInteira: boolean): string | null {
  if (vista.minhaVez) return null
  const { ateMinhaVez } = vista.turno
  if (ateMinhaVez !== undefined) return vista.fase !== 'combate' || ateMinhaVez === null ? null : fraseDoDepois(ateMinhaVez)
  return ordemInteira ? depoisDoJogador(cartas, vez) : null
}

interface EntradaDoJogadorDBT {
  vista: VistaDBT
  /** As fichas do mapa dele (só a foto pequena atravessa o recorte). */
  fichas: readonly FichaNaFaixaDBT[]
  /** Os personagens dele, para o retrato quando o token não tem foto. */
  meus: readonly Personagem[]
}

export function faixaDoJogadorDBT({ vista, fichas, meus }: EntradaDoJogadorDBT): DadosDaFaixaDBT {
  const tokenPorId = new Map(fichas.map((ficha) => [ficha.id, ficha]))
  const meuPorToken = new Map(vista.meus.map((meu) => [meu.tokenId, meu.personagemId]))
  const retratoDe = (personagemId: string | null) => (personagemId === null ? null : (meus.find((personagem) => personagem.id === personagemId)?.retrato ?? null))
  const naFaixa = vista.cartas.map((carta): CartaNaFaixaDBT => {
    const personagemId = meuPorToken.get(carta.tokenId) ?? personagemDaCartaDaVista(carta)
    const numeros = carta.pv !== null && carta.pk !== null
    return {
      id: carta.tokenId,
      nome: carta.nome,
      imagem: tokenPorId.get(carta.tokenId)?.imageData || retratoDe(personagemId) || null,
      cor: null,
      lado: null,
      iniciativa: carta.iniciativa,
      vida: numeros ? 'numeros' : 'oculta',
      pv: carta.pv,
      pk: carta.pk,
      transformacao: carta.transformacao,
      voo: carta.voo,
      condicoes: carta.condicoes.map((condicao) => ({ id: condicao.id, nome: condicao.nome })),
      agarrado: carta.agarrado,
      situacao: carta.situacao,
      perdeTurno: null,
      personagemId,
      minha: carta.lado === 'eu',
      npc: carta.lado === 'outro',
    }
  })
  const vez = vista.fase === 'combate' ? vista.vez : null
  // Com gente fora da vista na ordem (`turno.m` conta todos), a carta "A SEGUIR"
  // mentiria; o "Você joga em N turnos" vem contado pelo host (`ateMinhaVez`).
  const ordemInteira = naFaixa.length >= vista.turno.m
  return {
    fase: vista.fase,
    cartas: naFaixa,
    vez,
    proxima: ordemInteira ? proximaDe(naFaixa, vez) : null,
    rodada: vista.rodada,
    turno: vista.turno,
    minhaVez: vista.minhaVez,
    // `turno.n` é 0 quando ninguém tem a vez (o mestre tirou quem estava nela): aí não é "fora da vista".
    vezForaDaVista: vista.fase === 'combate' && vista.vez === null && vista.turno.n > 0,
    depois: depoisDaVista(vista, naFaixa, vez, ordemInteira),
  }
}
