import { contadorNoMenu } from '../../lib/batalha/contadorNoMenu'
import { equipeDe, ladoDoNpc, type Equipe } from '../../lib/batalha/equipes'
import type { TurnosDaCena } from '../../lib/batalha/turnos'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { useBatalhaStore } from '../../stores/batalhaStore'
import { useRpgStore } from '../../stores/rpgStore'
import { abrirPelaCarta } from './abertoPelaCarta'
import type { DadosDaCarta, DadosDaFaixa } from './dadosDaFaixa'
import { ROTULO_DO_LADO, porNpcNoLado } from './ladoDoNpcNaTela'
import type { ItemDoMenuDaCarta } from './MenuDaCarta'

/**
 * O MENU DA CARTA do mestre no One Piece: dar a vez, carta extra, dano,
 * ajustar, ações extras, armas, forma, selos, contador, concentração, lado,
 * equipe e tirar da batalha. Um lugar só para a regra: a faixa do alto
 * (`FaixaDoMestre`) e a mesa da batalha (doca e janela à parte, pelo espelho,
 * `batalhaJanela/espelhoOP.ts`) montam o menu daqui. As janelas que ele abre
 * vão para `abertoPelaCarta` e a faixa da cena desenha.
 */

export interface ContextoDaCartaDoMestre {
  sceneKey: string
  dados: DadosDaFaixa
  turnos: TurnosDaCena
  personagens: readonly Personagem[]
  equipes: readonly Equipe[]
  sistema: SistemaDeRpg | null
}

const MESTRE = { tipo: 'mestre' } as const

export function itensDaCartaDoMestre(carta: DadosDaCarta, { sceneKey, dados, turnos, personagens, equipes, sistema }: ContextoDaCartaDoMestre): ItemDoMenuDaCarta[] {
  const store = useBatalhaStore.getState()
  const indice = dados.cartas.findIndex((candidata) => candidata.id === carta.id)
  const itens: ItemDoMenuDaCarta[] = []
  const personagemId = carta.personagemId
  if (personagemId !== null) {
    itens.push({ id: 'perfil', rotulo: 'Ver perfil', detalhe: 'A ficha só para ler', abreNoApp: true, onEscolher: () => abrirPelaCarta(sceneKey, { tipo: 'perfil', personagemId }) })
    itens.push({ id: 'ficha', rotulo: 'Abrir a ficha', detalhe: 'A ficha inteira, para editar', abreNoApp: true, onEscolher: () => useRpgStore.getState().abrirFicha(personagemId) })
  }
  const jaEaVez = carta.id === dados.vez
  itens.push({
    id: 'vez',
    secao: 'Vez',
    rotulo: 'Dar a vez',
    detalhe: jaEaVez ? 'Já é a vez desta carta' : carta.caiu ? 'Caiu, mas pode jogar se você der a vez' : undefined,
    desabilitado: jaEaVez,
    onEscolher: () => store.darVez(sceneKey, carta.id),
  })
  itens.push({
    id: 'extra-rodada',
    rotulo: 'Agir de novo nesta rodada',
    detalhe: 'Carta extra logo depois; some na próxima rodada',
    onEscolher: () => store.adicionarCartaExtra(sceneKey, carta.tokenId, indice + 1, 'rodada'),
  })
  itens.push({
    id: 'extra-sempre',
    rotulo: 'Agir de novo em todas as rodadas',
    detalhe: 'Carta extra logo depois; fica até você tirar',
    onEscolher: () => store.adicionarCartaExtra(sceneKey, carta.tokenId, indice + 1, 'sempre'),
  })
  if (carta.extra !== null) itens.push({ id: 'tirar-extra', rotulo: 'Tirar esta carta extra', onEscolher: () => store.removerCarta(sceneKey, carta.id) })
  // F2: o golpe à mão do mestre e as ações a mais.
  itens.push({
    id: 'dano',
    secao: 'Combate',
    rotulo: 'Dar dano…',
    detalhe: 'Gasta o Escudo primeiro; entra no registro',
    abreNoApp: true,
    onEscolher: () => abrirPelaCarta(sceneKey, { tipo: 'dialogo', dialogo: { tipo: 'dano', tokenId: carta.tokenId } }),
  })
  // R4 (lote de 01/11): HP, SP, Escudo e um atributo à mão, em qualquer carta com ficha.
  if (personagemId !== null && carta.bando === undefined && sistema !== null)
    itens.push({
      id: 'ajustar',
      rotulo: 'Ajustar…',
      detalhe: 'HP, SP e Escudo (atual e máximo) e um atributo; entra no registro',
      abreNoApp: true,
      onEscolher: () => abrirPelaCarta(sceneKey, { tipo: 'dialogo', dialogo: { tipo: 'ajustar', tokenId: carta.tokenId, personagemId } }),
    })
  itens.push({
    id: 'acoes-extras',
    rotulo: 'Ações extras…',
    detalhe: 'Simples, Bônus e Movimento a mais na vez desta carta',
    abreNoApp: true,
    onEscolher: () => abrirPelaCarta(sceneKey, { tipo: 'dialogo', dialogo: { tipo: 'extras', cartaId: carta.id } }),
  })
  // ITENS REFEITOS, E6a: "Armas desta batalha…" saiu: o Atacar mostra as equipadas na mochila (equipar não gasta ação).
  // F3: a forma ativada pelo menu. Desfazer é ação livre, mas só na vez da carta (a store confere a vez).
  const forma = personagemId === null ? undefined : turnos.formas?.[personagemId]
  if (forma !== undefined && carta.forma) {
    itens.push({
      id: 'desfazer-forma',
      rotulo: `Desfazer a forma (${carta.forma})`,
      detalhe: jaEaVez ? 'Ação livre; entra no registro, o Desfazer volta' : 'Fora da vez: desligue pela ficha',
      desabilitado: !jaEaVez,
      onEscolher: () => store.agir(sceneKey, MESTRE, { cartaId: carta.id, rodada: turnos.rodada }, { tipo: 'destransformar', cartaoId: forma.cartaoId }),
    })
  }
  // F3: os selos da ficha (por token: a carta extra mostra os mesmos).
  itens.push({
    id: 'por-selo',
    secao: 'Selos',
    rotulo: 'Pôr selo…',
    detalhe: 'Atordoado, Cego… turnos e modificadores',
    abreNoApp: true,
    onEscolher: () => abrirPelaCarta(sceneKey, { tipo: 'dialogo', dialogo: { tipo: 'selo', tokenId: carta.tokenId, seloId: null } }),
  })
  for (const selo of carta.selos ?? []) {
    const seloId = selo.id
    if (seloId === null) continue
    itens.push({
      id: `selo-${seloId}`,
      rotulo: `${selo.texto}…`,
      detalhe: selo.mods === '' ? 'Editar ou tirar' : `${selo.mods} · editar ou tirar`,
      abreNoApp: true,
      onEscolher: () => abrirPelaCarta(sceneKey, { tipo: 'dialogo', dialogo: { tipo: 'selo', tokenId: carta.tokenId, seloId } }),
    })
  }
  // R5 (lote de 01/11): o contador da ficha (a Polaridade do Vagn): carregar gasta a reação; zerar é só do mestre.
  // A conta do contador mora num lugar só (`contadorNoMenu`, a mesma da Arena).
  const personagemDaCarta = personagemId === null ? undefined : personagens.find((candidato) => candidato.id === personagemId)
  const contador = personagemDaCarta === undefined || sistema === null || carta.bando !== undefined ? null : contadorNoMenu(carta.tokenId, personagemDaCarta, sistema, turnos)
  if (contador !== null) {
    itens.push({ id: 'contador-ganhar', ...contador.ganhar, onEscolher: () => store.contador(sceneKey, MESTRE, { tipo: 'ganhar', ...contador.pedido }) })
    if (contador.zerar !== null) itens.push({ id: 'contador-zerar', ...contador.zerar, onEscolher: () => store.contador(sceneKey, MESTRE, { tipo: 'zerar', ...contador.pedido }) })
  }
  if (personagemId !== null && (carta.carga ?? 0) > 0)
    itens.push({
      id: 'zerar-carga',
      rotulo: `Zerar a concentração (carga ${carta.carga ?? 0})`,
      detalhe: 'Volta a 0; a ação gasta não volta. Entra no registro',
      onEscolher: () => store.zerarCarga(sceneKey, MESTRE, personagemId),
    })
  // Conserto de 09/11 (a Bolha do Tree): de que lado o NPC luta, pela equipe de sempre (entra no registro quando a equipe já existe).
  if (personagemId !== null && carta.bando === undefined && personagemDaCarta?.tipo === 'npc') {
    const lado = ladoDoNpc(personagemId, equipes, personagens)
    itens.push({ id: 'lado-jogadores', secao: 'Lado', rotulo: ROTULO_DO_LADO.jogadores, detalhe: 'Aliado dos jogadores: cura e Buff dele valem neles', marcado: lado === 'jogadores', onEscolher: () => porNpcNoLado(personagemId, 'jogadores') })
    itens.push({ id: 'lado-contra', rotulo: ROTULO_DO_LADO.contra, detalhe: 'Luta junto dos outros NPCs', marcado: lado === 'contra', onEscolher: () => porNpcNoLado(personagemId, 'contra') })
  }
  if (personagemId !== null) {
    if (equipes.length === 0) {
      itens.push({ id: 'equipe-nenhuma', secao: 'Equipe', rotulo: 'Sem equipes', detalhe: 'Crie equipes no painel da batalha, no livro da mesa', desabilitado: true, onEscolher: () => {} })
    } else {
      const atual = equipeDe(personagemId, equipes)?.id ?? null
      equipes.forEach((equipe, i) =>
        itens.push({
          id: `equipe-${equipe.id}`,
          secao: i === 0 ? 'Equipe' : undefined,
          rotulo: equipe.nome,
          cor: equipe.cor,
          marcado: atual === equipe.id,
          onEscolher: () => store.trocarEquipe(personagemId, equipe.id),
        }),
      )
      itens.push({ id: 'equipe-sem', rotulo: 'Sem equipe', marcado: atual === null, onEscolher: () => store.trocarEquipe(personagemId, null) })
    }
  }
  // Invocação (pedido de 01/11): a carta do bando não tem "Tirar da batalha".
  if (carta.bando === undefined)
    itens.push({
      id: 'tirar',
      secao: 'Batalha',
      rotulo: 'Tirar da batalha',
      detalhe: 'Sai da ordem com as cartas extras; o Desfazer do registro volta',
      perigo: true,
      onEscolher: () => store.tirarCombatente(sceneKey, carta.tokenId),
    })
  return itens
}
