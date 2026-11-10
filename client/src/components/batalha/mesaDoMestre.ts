import type { InvocadoNaBatalha } from '../../lib/batalha/combate'
import { equipeDe, ladoNaBatalha, type Equipe } from '../../lib/batalha/equipes'
import { acoesDoInvocado, comunsQueSaem, membrosDoBando } from '../../lib/batalha/invocacao'
import type { BatalhaEmTurnos } from '../../lib/batalha/ponte'
import { reducoesDoDano } from '../../lib/batalha/reducaoDoDano'
import { bonusDaBatalha } from '../../lib/batalha/selos'
import { aparenciaDaForma } from '../../lib/batalha/transformacao'
import { tokensCaidos, type CartaDaOrdem, type TurnosDaCena } from '../../lib/batalha/turnos'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { recursosDaCarta } from './dadosDaFaixa'
import { nomeDoBando } from './dadosDaInvocacao'
import type { AlvoDoDano } from './DarDanoDialog'
import { MOTIVO_SEM_PERSONAGEM, alvoDaMira, alvosNaOrdemDaMira, golpesDeAtaque, golpesDeHabilidade, vidaNaMira, type AlvoNaMira } from './dadosDoMenu'
import type { MembroNaVez, PendenciaNaTela } from './InvocacoesDoMestre'

/**
 * A MESA COMO O MESTRE A LÊ (U4 do plano de unificação do combate,
 * 10/11/2026): o que a aba Batalha do mapa e a Arena de testes leem para
 * montar a tela de quem opera tudo (a mira do mestre, a vez do bando, o Dar
 * dano, as invocações esperando). Antes morava só em `BatalhaDoMestre.tsx`,
 * preso às stores do mapa, e a Arena não tinha como mostrar o bando.
 *
 * Só leitura, sem store: quem monta (`useMesa` no mapa, a sessão na Arena)
 * passa as fichas, os personagens e as equipes de agora.
 */
export interface MesaDoMestre {
  cena: Pick<BatalhaEmTurnos, 'turnos'> | undefined
  /** Construtor C3: `size` e `rotation` para a área montada marcar pela grade (o token grande, a frente). */
  fichas: readonly { id: string; name: string; imageData?: string | null; x?: number; y?: number; size?: number; rotation?: number }[]
  /** C4: o lado da casa (px), para a ordem dos alvos por distância. */
  tamanhoDaCasa?: number
  personagens: readonly Personagem[]
  equipes: readonly Equipe[] | undefined
  sistema: SistemaDeRpg | null
  /** Achado 4: o nome de cada ficha com o número dos repetidos ("Urso 1", "Urso 2"), pela ordem do mapa. */
  rotulos: ReadonlyMap<string, string>
}

const SEM_INVOCADOS: readonly InvocadoNaBatalha[] = []

/** O nome da ficha no mapa, com o número quando o nome repete (achado 4); ficha sem nome usa o da carta. */
export function nomeDaFicha(mesa: MesaDoMestre, tokenId: string, carta?: CartaDaOrdem): string {
  const noMapa = mesa.fichas.find((ficha) => ficha.id === tokenId)?.name.trim()
  return (noMapa ? mesa.rotulos.get(tokenId) : undefined) || noMapa || carta?.nome?.trim() || 'Ficha'
}

/**
 * O lado de um personagem na mira do mestre: a equipe dele (o invocado conta
 * como o dono). Sem equipe cadastrada, os jogadores de um lado e os NPCs do
 * outro; sem isso, tudo era "outro" e o aliado do lobo ou do NPC da vez vinha
 * no meio dos inimigos. Construtor C3 (revisão): é a mesma regra que o host
 * confere na área "aliados" da técnica montada (`ladoNaBatalha`).
 */
function ladoDoPersonagem(mesa: MesaDoMestre, personagemId: string | null): string | null {
  return ladoNaBatalha(personagemId, { equipes: mesa.equipes, personagens: mesa.personagens, invocados: mesa.cena?.turnos.invocados ?? SEM_INVOCADOS })
}

/** O HP de um invocado (a ficha temporária dele); sem ficha ou sem vida, `null`. */
function vidaDoInvocado(mesa: MesaDoMestre, invocado: InvocadoNaBatalha): { atual: number; maximo: number } | null {
  const personagem = mesa.personagens.find((candidato) => candidato.id === invocado.personagemId)
  const vida = personagem === undefined ? undefined : recursosDaCarta(personagem, mesa.sistema).find((recurso) => recurso.tom === 'vida')
  return vida === undefined ? null : { atual: vida.atual, maximo: vida.maximo }
}

/** Os alvos da mira do mestre: uma por ficha na ordem, do ponto de vista de quem age. A carta do bando vira os invocados dela. */
export function alvosDaOrdem(mesa: MesaDoMestre, cartas: readonly CartaDaOrdem[], quemAge: CartaDaOrdem): AlvoNaMira[] {
  const caidos = tokensCaidos(cartas, mesa.personagens, mesa.sistema)
  const ladoDeQuem = ladoDoPersonagem(mesa, quemAge.personagemId)
  const invocados = mesa.cena?.turnos.invocados ?? SEM_INVOCADOS
  const vistos = new Set<string>()
  const alvos: AlvoNaMira[] = []
  for (const carta of cartas) {
    if (carta.bando !== undefined) {
      // Invocação: o invocado não tem carta; é alvo como qualquer ficha, da equipe do dono.
      for (const invocado of membrosDoBando({ invocados }, carta)) {
        if (vistos.has(invocado.tokenId)) continue
        vistos.add(invocado.tokenId)
        const equipeDoDono = equipeDe(invocado.donoPersonagemId, mesa.equipes)
        const ficha = mesa.fichas.find((candidata) => candidata.id === invocado.tokenId)
        alvos.push(
          alvoDaMira({
            tokenId: invocado.tokenId,
            nome: ficha?.name.trim() || invocado.nome,
            lado: invocado.tokenId === quemAge.tokenId ? 'eu' : ladoDeQuem !== null && ladoDoPersonagem(mesa, invocado.donoPersonagemId) === ladoDeQuem ? 'aliado' : 'outro',
            imagem: ficha?.imageData ?? null,
            cor: equipeDoDono?.cor ?? null,
            // U1: o mestre vê a vida de todos, o invocado também (o caído sai dela).
            vida: vidaDoInvocado(mesa, invocado) ?? undefined,
          }),
        )
      }
      continue
    }
    if (vistos.has(carta.tokenId)) continue
    vistos.add(carta.tokenId)
    const equipeDaCarta = carta.personagemId === null ? null : (equipeDe(carta.personagemId, mesa.equipes) ?? null)
    const personagem = carta.personagemId === null ? undefined : mesa.personagens.find((candidato) => candidato.id === carta.personagemId)
    const forma = carta.personagemId === null ? undefined : mesa.cena?.turnos.formas?.[carta.personagemId]
    // U1: a mesma montagem de toda entrada (`alvoDaMira`): o lado na luta, a vida, o ferido e o caído.
    alvos.push(
      alvoDaMira({
        tokenId: carta.tokenId,
        nome: nomeDaFicha(mesa, carta.tokenId, carta),
        lado: carta.tokenId === quemAge.tokenId ? 'eu' : ladoDeQuem !== null && ladoDoPersonagem(mesa, carta.personagemId) === ladoDeQuem ? 'aliado' : 'outro',
        caiu: caidos.has(carta.tokenId),
        motivo: carta.personagemId === null ? MOTIVO_SEM_PERSONAGEM : null,
        // A mesma imagem da carta na faixa (`faixaDoMestre`): a forma vence a foto do token, que vence o retrato.
        imagem: aparenciaDaForma(forma, personagem) ?? mesa.fichas.find((ficha) => ficha.id === carta.tokenId)?.imageData ?? personagem?.retrato ?? null,
        cor: equipeDaCarta?.cor ?? null,
        // Pedido de 09/11 (a Bolha): a vida de cada um, para a mira da cura abrir nos feridos (lida como a regra da cura a lê).
        vida: vidaNaMira(personagem, mesa.sistema),
      }),
    )
  }
  return alvosNaOrdemDaMira(alvos, mesa.fichas, quemAge.tokenId, mesa.tamanhoDaCasa)
}

/**
 * Invocação F3: um invocado na vez do bando, com a economia dele e os golpes
 * da ficha temporária (o "Golpe" com o dano dele; sem técnica, o Atacar).
 */
function membroNaVez(mesa: MesaDoMestre, turnos: TurnosDaCena, bando: CartaDaOrdem, invocado: InvocadoNaBatalha): MembroNaVez {
  const personagem = mesa.personagens.find((candidato) => candidato.id === invocado.personagemId) ?? null
  const acoes = acoesDoInvocado(turnos, bando.id, invocado)
  const combate = turnos.combate?.[invocado.personagemId]
  const bonus = bonusDaBatalha(turnos.selos, invocado.tokenId)
  const habilidades = personagem !== null && mesa.sistema !== null ? golpesDeHabilidade(personagem, mesa.sistema, combate, acoes, null, bonus) : []
  const ficha = mesa.fichas.find((candidata) => candidata.id === invocado.tokenId)
  const quemAge: CartaDaOrdem = { id: bando.id, tokenId: invocado.tokenId, personagemId: invocado.personagemId, nome: invocado.nome }
  return {
    tokenId: invocado.tokenId,
    nome: ficha?.name.trim() || invocado.nome,
    imagem: ficha?.imageData ?? null,
    vida: vidaDoInvocado(mesa, invocado),
    acoes,
    golpes: habilidades.length > 0 ? habilidades : golpesDeAtaque(personagem, mesa.sistema, combate, acoes, bonus),
    alvos: alvosDaOrdem(mesa, turnos.cartas, quemAge),
  }
}

/**
 * Invocação F3: a vez da carta do bando como o `PainelDoBando` a mostra: o
 * nome ("Lobos de Ryoko"), a cor da equipe do dono e cada invocado em campo.
 */
export function vezDoBandoNaTela(mesa: MesaDoMestre, turnos: TurnosDaCena, carta: CartaDaOrdem, donoTokenId: string): { nome: string; cor: string | null; membros: MembroNaVez[] } {
  const cartaDoDono = turnos.cartas.find((candidata) => candidata.tokenId === donoTokenId && candidata.bando === undefined)
  const equipeDoDono = cartaDoDono === undefined || cartaDoDono.personagemId === null ? null : equipeDe(cartaDoDono.personagemId, mesa.equipes)
  const membros = membrosDoBando(turnos, carta)
  return {
    nome: nomeDoBando(membros, nomeDaFicha(mesa, donoTokenId, cartaDoDono), carta.nome ?? 'Bando'),
    cor: equipeDoDono?.cor ?? null,
    membros: membros.map((invocado) => membroNaVez(mesa, turnos, carta, invocado)),
  }
}

/** Invocação F3: as pendências que esperam o mestre pôr no mapa ("Ryoko invocou 1 Lobo"), como a lista as mostra. */
export function pendenciasDeInvocacaoNaTela(mesa: MesaDoMestre, turnos: TurnosDaCena): PendenciaNaTela[] {
  return (turnos.invocacoes ?? []).map((pendente) => {
    const saem = comunsQueSaem(turnos, pendente)
    return {
      id: pendente.id,
      dono: nomeDaFicha(mesa, pendente.donoTokenId),
      nome: pendente.nome,
      rotulo: pendente.rotulo,
      ultra: pendente.ultra,
      numeros: pendente.numeros,
      sugeridos: pendente.sugeridos,
      imagem: pendente.imagem,
      saem: saem.length,
      nomeDosQueSaem: saem[0]?.nome ?? null,
    }
  })
}

/**
 * Os alvos do "Dar dano" do mestre: uma ficha por carta. A carta do bando não
 * é ficha (a store recusa): o dano vai em cada invocado dele, pelo nome do
 * token. `aberto` = a ficha de onde a janela abriu; pela carta do bando, ela
 * começa no primeiro invocado dele.
 */
export function alvosDoDarDano(mesa: MesaDoMestre, turnos: TurnosDaCena, aberto: string | null): { alvos: AlvoDoDano[]; inicial: string | null } {
  const vistos = new Set<string>()
  const invocados = turnos.invocados ?? SEM_INVOCADOS
  // Conserto das fichas F1 (S4): Resiliente e Determinação de quem leva o dano, no aviso da janela.
  const reducoesDaCarta = (carta: CartaDaOrdem) => {
    const personagem = carta.personagemId === null ? undefined : mesa.personagens.find((candidato) => candidato.id === carta.personagemId)
    return personagem === undefined || mesa.sistema === null ? [] : reducoesDoDano(personagem, mesa.sistema)
  }
  const doBando = (carta: CartaDaOrdem): AlvoDoDano[] => membrosDoBando({ invocados }, carta).map((invocado) => ({ tokenId: invocado.tokenId, nome: mesa.fichas.find((ficha) => ficha.id === invocado.tokenId)?.name.trim() || invocado.nome }))
  const alvos = turnos.cartas
    .flatMap((carta): AlvoDoDano[] => (carta.bando === undefined ? [{ tokenId: carta.tokenId, nome: nomeDaFicha(mesa, carta.tokenId, carta), reducoes: reducoesDaCarta(carta) }] : doBando(carta)))
    .filter((alvo) => !vistos.has(alvo.tokenId) && vistos.add(alvo.tokenId))
  const cartaDoBando = turnos.cartas.find((carta) => carta.bando !== undefined && carta.tokenId === aberto)
  return { alvos, inicial: cartaDoBando === undefined ? aberto : (doBando(cartaDoBando)[0]?.tokenId ?? null) }
}
