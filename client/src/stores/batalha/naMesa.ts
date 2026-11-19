/**
 * O que a batalha One Piece grava pela mesa (`lib/batalha/mesa.ts`): a ficha (com a recusa da pasta
 * publicada), a munição da mochila, a equipe e o invocado que sai do mapa. Cada gravação devolve a parte
 * que o Desfazer precisa.
 */
import { type InvocadoNaBatalha, type MudancaDoAjuste, DANO_MAX as DELTA_DO_AJUSTE_MAX } from '../../lib/batalha/combate'
import { recursoDeVida, vidaDoPersonagem } from '../../lib/vidaDaFicha'
import type { CarriedItem, Token } from '../../types/map'
import {
  EQUIPES_MAX,
  ID_DA_EQUIPE_DOS_JOGADORES,
  NOME_DA_EQUIPE_DOS_JOGADORES,
  ehEquipeAutomatica,
  equipeAutomatica,
  semEquipeAutomaticaVazia,
  type Equipe,
} from '../../lib/batalha/equipes'
import { recursoDoCusto } from '../../lib/batalha/leituraDaFicha'
import { comABalaLigada, fichaComAMochilaDoBoneco, gastarMunicaoDaFicha, type MunicaoGasta } from '../../lib/batalha/municaoDaFicha'
import type { MesaDaBatalha } from '../../lib/batalha/mesa'
import { partesDoAjuste, type ParteDaFicha, type Reversao } from '../../lib/batalha/registro'
import type { TurnosDaCena } from '../../lib/batalha/turnos'
import { aplicarAjustes, NUMERO_DA_FICHA_MAX, type Ajuste } from '../../lib/ajusteDaFicha'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'

/**
 * Troca a equipe pela mesa (segunda auditoria, 09/11/2026, achado 2). A equipe
 * automática dos jogadores nasce quando alguém entra nela (o primeiro NPC "do
 * lado dos jogadores", ou o Desfazer de quem saiu) e some quando o último NPC
 * sai; as feitas pelo mestre só trocam de membro, como antes. `false` = não deu.
 */
export function trocarEquipeNaMesa(mesa: MesaDaBatalha, personagemId: string, equipeId: string | null): boolean {
  const antes = mesa.equipes()
  if (equipeId === ID_DA_EQUIPE_DOS_JOGADORES && !antes.some(ehEquipeAutomatica)) {
    if (antes.length >= EQUIPES_MAX || mesa.salvarEquipes?.([...antes, equipeAutomatica(mesa.personagens())]) !== true) return false
  }
  const trocou = mesa.trocarEquipe(personagemId, equipeId)
  // Trocou ou não, a automática sem NPC não fica na pasta: a que o último NPC deixou, ou a que nasceu agora e a troca recusou.
  const depois = mesa.equipes()
  const limpas = semEquipeAutomaticaVazia(depois, mesa.personagens())
  if (limpas !== depois) mesa.salvarEquipes?.(limpas)
  return trocou
}

/**
 * A linha do registro da troca de equipe. O NPC que entra na equipe automática
 * ou sai dela para equipe nenhuma trocou de LADO, e a linha diz isso (o mestre
 * escolheu um lado, não uma equipe); o resto é a linha de sempre.
 */
export function textoDaTrocaDeEquipe(personagem: Personagem | undefined, antes: Equipe | null, depois: Equipe | null, paraAAutomatica: boolean): string {
  const nome = personagem?.nome ?? 'Personagem'
  if (personagem?.tipo === 'npc' && paraAAutomatica) return `${nome} passou para o lado dos jogadores`
  if (personagem?.tipo === 'npc' && antes !== null && ehEquipeAutomatica(antes) && depois === null) return `${nome} passou a lutar contra os jogadores`
  return `${nome}: ${antes?.nome ?? 'sem equipe'} → ${depois?.nome ?? (paraAAutomatica ? NOME_DA_EQUIPE_DOS_JOGADORES : 'sem equipe')}`
}

/**
 * Invocação: tira o invocado do mapa (token e personagem temporário pela
 * mesa) e da lista; a parte "invocadoSaiu" guarda como estavam, para o
 * Desfazer. A carta do bando sem ninguém sai depois, por `comBandosEmDia`.
 */
export function tirarDoMapa(mesa: MesaDaBatalha, sceneKey: string, turnos: TurnosDaCena, invocado: InvocadoNaBatalha): { turnos: TurnosDaCena; parte: Reversao } {
  const tirado = mesa.tirarInvocado?.(sceneKey, invocado.personagemId, invocado.tokenId) ?? { personagem: null, token: null }
  const invocados = (turnos.invocados ?? []).filter((candidato) => candidato.tokenId !== invocado.tokenId)
  return { turnos: { ...turnos, invocados }, parte: { tipo: 'invocadoSaiu', invocado, personagem: tirado.personagem, token: tirado.token } }
}

/**
 * Mexe na ficha pela mesa (na aventura, o histórico dela cresce em nome de
 * `quem` e a mudança chega ao jogador pelo `syncPersonagens` de sempre).
 * `ajustes` recebe o personagem de AGORA (o Escudo de agora, o SP de agora).
 * Devolve as partes que mudaram (vazio = nada), `null` (personagem ou
 * sistema não existe) ou `'recusada'` (ver `Recusada`).
 */
export function mexerNaFicha(mesa: MesaDaBatalha, personagemId: string, ajustes: (atual: Personagem, sistema: SistemaDeRpg) => readonly Ajuste[], quem: string): ParteDaFicha[] | null | Recusada {
  const sistema = mesa.sistema()
  if (sistema === null) return null
  return gravarNaFicha(mesa, personagemId, sistema, (atual) => {
    const lista = ajustes(atual, sistema)
    return lista.length === 0 ? atual : aplicarAjustes(atual, sistema, lista, quem, Date.now())
  })
}

/**
 * Conserto das fichas F1 (bug 11): a mesa calculou a ficha nova e RECUSOU
 * gravá-la (a pasta publicada que o Lobby não aceitaria; o aviso já saiu). Não
 * é o `null` de "nada mudou": a ação que cobra custo ou dá dano para ali, sem
 * linha, e devolve `false` (o jogador vê a recusa). O que ela já tinha gravado
 * em outra ficha volta (`devolverFichasDaAcao`).
 */
export type Recusada = 'recusada'

/** A cura pelo item num alvo, lida antes de gravar (`curaDoItemNoAlvo`): a ficha do mapa antes e depois, e os nomes que saíram. */
export interface CuraDoItemNoAlvo {
  tokenId: string
  antes: Token
  depois: Token
  curou: string[]
}

/** O miolo de `mexerNaFicha` e `trocarFicha`: `mudar` devolve `null` = não deu (a ficha fica). */
export function gravarNaFicha(mesa: MesaDaBatalha, personagemId: string, sistema: SistemaDeRpg, mudar: (atual: Personagem) => Personagem | null): ParteDaFicha[] | null | Recusada {
  // Num objeto: a atribuição dentro do callback não estreita a variável de fora (o TS a daria como sempre `null`).
  const feito: { partes: ParteDaFicha[] | null } = { partes: null }
  const gravou = mesa.ajustarPersonagem(personagemId, (atual) => {
    const depois = mudar(atual)
    if (depois === null) return atual
    feito.partes = partesDoAjuste(atual, depois, sistema)
    return depois
  })
  if (gravou) return feito.partes
  // Ficha que não existe (o callback nem rodou) ou sem nada a mudar: `null`, como antes.
  return feito.partes === null || feito.partes.length === 0 ? null : 'recusada'
}

/**
 * MUNIÇÃO: tira 1 da bala ligada da mochila da ficha, pela mesa. `null` =
 * nada a tirar (a bala deixou de estar ligada no meio); `'recusada'` = a mesa
 * não gravou (a pasta publicada recusou), e o tiro não sai.
 */
export function gastarMunicaoNaMesa(mesa: MesaDaBatalha, sceneKey: string, tokenId: string, personagemId: string, armaId: string, balaId: string): Reversao | null | 'recusada' {
  const doBoneco = mesa.mochilaDoBoneco?.(sceneKey, tokenId) ?? null
  if (doBoneco !== null) return gastarMunicaoDoBoneco(mesa, sceneKey, tokenId, personagemId, armaId, balaId, doBoneco)
  // Num objeto: o que o callback da mesa escreve, lido depois dele (um `let` o TS estreitaria para `null`).
  const feito: { gasta: MunicaoGasta | null } = { gasta: null }
  const ok = mesa.ajustarPersonagem(personagemId, (atual) => {
    feito.gasta = gastarMunicaoDaFicha(atual, armaId, balaId)
    return feito.gasta === null ? atual : feito.gasta.personagem
  })
  const { gasta } = feito
  if (gasta === null) return null
  if (!ok) return 'recusada'
  return { tipo: 'municao', personagemId, vaga: gasta.vaga, indice: gasta.indice }
}

/**
 * MUNIÇÃO na aventura que não migrou a mochila (a dona é a do boneco
 * `tokenId`): o tiro tira 1 dela pelo caminho dos itens do mapa, e a ficha
 * só recebe a ligação da bala pelo nome (o `itemId` no subcartão), nunca a
 * mochila. Mesmo contrato de `gastarMunicaoNaMesa`.
 */
export function gastarMunicaoDoBoneco(mesa: MesaDaBatalha, sceneKey: string, tokenId: string, personagemId: string, armaId: string, balaId: string, doBoneco: readonly CarriedItem[]): Reversao | null | 'recusada' {
  const ficha = mesa.personagens().find((candidato) => candidato.id === personagemId)
  const gasta = ficha === undefined ? null : gastarMunicaoDaFicha(fichaComAMochilaDoBoneco(ficha, doBoneco), armaId, balaId)
  if (gasta === null) return null
  if (mesa.gravarMochilaDoBoneco?.(sceneKey, tokenId, gasta.personagem.mochila ?? []) !== true) return 'recusada'
  // A ligação só evita que a bala ligada pelo nome se solte quando a última unidade sai; se a ficha não gravar, o tiro já valeu.
  mesa.ajustarPersonagem(personagemId, (atual) => comABalaLigada(atual, armaId, balaId, gasta.vaga.itemId))
  return { tipo: 'municao', personagemId, vaga: gasta.vaga, indice: gasta.indice, tokenId }
}

/**
 * Invocação (decisão 9): os invocados com a vida em 0 saem do mapa e do
 * bando. Lê a ficha de AGORA (depois do dano pela mesa). As partes
 * "invocadoSaiu" vão na linha do dano; os nomes, no texto dela.
 */
export function semOsCaidos(mesa: MesaDaBatalha, sceneKey: string, turnos: TurnosDaCena): { turnos: TurnosDaCena; partes: Reversao[]; nomes: string[] } {
  const recurso = recursoDeVida(mesa.sistema())
  if (recurso === null || (turnos.invocados ?? []).length === 0) return { turnos, partes: [], nomes: [] }
  const personagens = mesa.personagens()
  let novos = turnos
  const partes: Reversao[] = []
  const nomes: string[] = []
  for (const invocado of turnos.invocados ?? []) {
    const personagem = personagens.find((candidato) => candidato.id === invocado.personagemId)
    const vida = personagem === undefined ? null : vidaDoPersonagem(personagem, recurso)
    if (vida === null || vida.atual > 0) continue
    const tirado = tirarDoMapa(mesa, sceneKey, novos, invocado)
    novos = tirado.turnos
    partes.push(tirado.parte)
    nomes.push(invocado.nome)
  }
  return { turnos: novos, partes, nomes }
}

/** " · Lobo saiu do mapa" para o texto da linha; ninguém saiu = vazio. */
export function textoDosQueSairam(nomes: readonly string[]): string {
  return nomes.length === 0 ? '' : ` · ${nomes.join(', ')} ${nomes.length === 1 ? 'saiu' : 'saíram'} do mapa`
}

/** A reversão de uma ficha mexida; nada mudou = nenhuma. */
/** Conserto das fichas F1 (+10 SP por vez): as partes gravadas tiraram SP (o recurso de custo "sp" do sistema). */
export function tirouSp(partes: readonly ParteDaFicha[] | null, sistema: SistemaDeRpg): boolean {
  const sp = recursoDoCusto(sistema, 'sp')
  return sp !== null && (partes ?? []).some((parte) => parte.parte === 'recurso' && parte.chave === sp.id && parte.para < parte.de)
}

export function reversaoDaFicha(personagemId: string, partes: readonly ParteDaFicha[] | null): Reversao[] {
  return partes === null || partes.length === 0 ? [] : [{ tipo: 'ficha', personagemId, partes }]
}

/** R4: a mudança do "Ajustar..." dentro do sistema e dos tetos (o fio já cortou o tamanho). */
export function mudancaValida(sistema: SistemaDeRpg, mudanca: MudancaDoAjuste): boolean {
  if (mudanca.tipo === 'atributo') {
    return sistema.atributos.some((atributo) => atributo.id === mudanca.atributoId) && Number.isInteger(mudanca.delta) && mudanca.delta !== 0 && Math.abs(mudanca.delta) <= DELTA_DO_AJUSTE_MAX
  }
  return sistema.recursos.some((recurso) => recurso.id === mudanca.recursoId) && Number.isInteger(mudanca.valor) && mudanca.valor >= 0 && mudanca.valor <= NUMERO_DA_FICHA_MAX
}

// ───────────────────────────────────────────────────────────────────────────
// F3 (fatia T): forma e selos
// ───────────────────────────────────────────────────────────────────────────

/**
 * Como `mexerNaFicha`, mas com o personagem novo pronto (a forma passa pelo
 * `aplicarAjustes` em `transformacao.ts`). `mudar` devolve `null` = não deu:
 * a ficha fica e volta `null`. Gravação recusada = `'recusada'` (bug 11).
 */
export function trocarFicha(mesa: MesaDaBatalha, personagemId: string, mudar: (atual: Personagem, sistema: SistemaDeRpg) => Personagem | null): ParteDaFicha[] | null | Recusada {
  const sistema = mesa.sistema()
  if (sistema === null) return null
  return gravarNaFicha(mesa, personagemId, sistema, (atual) => mudar(atual, sistema))
}
