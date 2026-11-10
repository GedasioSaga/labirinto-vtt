import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { equipesDaArena, vistaDaArena, AUTOR_DA_ARENA } from '../../lib/arena/estadoDaArena'
import { CASA_DA_ARENA, GRADES_DA_ARENA } from '../../lib/arena/grade'
import { CENA_DA_ARENA, type ContaDoPlacar, type SessaoDaArena } from '../../lib/arena/tipos'
import type { FormaPendente } from '../../lib/batalha/combate'
import { contadorNoMenu } from '../../lib/batalha/contadorNoMenu'
import type { Equipe } from '../../lib/batalha/equipes'
import { armasDe, limiteDeArmas, recursoDoEscudo } from '../../lib/batalha/leituraDaFicha'
import type { BatalhaEmTurnos } from '../../lib/batalha/ponte'
import { alvosDeMod, selosDoToken } from '../../lib/batalha/selos'
import { aparenciaDaForma } from '../../lib/batalha/transformacao'
import { cartaDaVez } from '../../lib/batalha/turnos'
import type { ResolverDeImagem } from '../../lib/midia'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import type { Token } from '../../types/map'
import { recursoDeVida, vidasDaCena } from '../../lib/vidaDaFicha'
import type { FotosDaForma, SelosNasFichas } from '../../pixi/tokenPhotoSprite'
import { ultimoGestoDoJudge } from '../../pixi/judgeDoMapa'
import { batalhaDaArena, colocarInvocadoNaArena, useArenaStore, usePlacarDaArena } from '../../stores/arenaStore'
import { efeitosDaCena } from '../../stores/batalhaStore'
import { useMundoDoLivroStore, usePersonagensDoMundo } from '../../stores/mundoDoLivroStore'
import { useToastStore } from '../../stores/toastStore'
import { AcoesExtrasDialog } from '../batalha/AcoesExtrasDialog'
import { AjustarDialog } from '../batalha/AjustarDialog'
import { BatalhaDoJogador } from '../batalha/BatalhaDoJogador'
import { PassivasDaFicha, alvosDaOrdemParaPassiva, passivasNaCena } from '../batalha/PassivasDaBatalha'
import { useColocacaoDoMestre } from '../batalha/colocacaoDoMestre'
import { DarDanoDialog } from '../batalha/DarDanoDialog'
import { faixaDoMestre, linhasDoMestre, type DadosDaCarta } from '../batalha/dadosDaFaixa'
import { RECUSA_SEM_MOTIVO } from '../batalha/dadosDoMenu'
import { tremer } from '../batalha/EfeitosDaBatalha'
import { EscolhaDeArmas } from '../batalha/EscolhaDeArmas'
import { FaixaDaOrdem } from '../batalha/FaixaDaOrdem'
import { FormasPendentes } from '../batalha/FormasDoMestre'
import { InvocacoesPendentes, PainelDoBando } from '../batalha/InvocacoesDoMestre'
import { fotosDaFormaDoMestre, selosNasFichasDoMestre, useFotosEstaveis, useSelosEstaveis } from '../batalha/marcasNoMapa'
import type { ItemDoMenuDaCarta } from '../batalha/MenuDaCarta'
import { alvosDoDarDano, pendenciasDeInvocacaoNaTela, vezDoBandoNaTela, type MesaDoMestre } from '../batalha/mesaDoMestre'
import { nomesNumerados } from '../batalha/nomesNumerados'
import { pedidosDaVez } from '../batalha/pedidosDaVez'
import type { ConsultaDaFicha } from '../batalha/MiraDoGolpe'
import { PerfilDaCarta } from '../batalha/PerfilDaCarta'
import { SeloDialog } from '../batalha/SeloDialog'
import { useImagemDaMesa } from '../ImagemDaMesa'
import { IconeDoMundo } from '../livros/icones'
import { PalcoDaArena } from './PalcoDaArena'
import { PlacarDoBoneco } from './PlacarDoBoneco'
import './arena.css'

/**
 * A LUTA DA ARENA DE TESTES em tela cheia, por cima do mundo do livro
 * (docs/planos/batalha-arena-de-testes-plano.md §4.4; decisão 3 do usuário):
 *
 * - a barra do alto: "Arena de testes", a rodada, Recomeçar (sem confirmação,
 *   decisão 6), Voltar à montagem (as escolhas ficam) e Sair da arena (esquece
 *   a sessão e volta ao mundo);
 * - o palco (`PalcoDaArena`, do Pixi próprio da arena);
 * - a faixa da ordem do MESTRE (arrastar a ordem, menu da carta, registro com
 *   Desfazer) e os diálogos dele (dar dano, ações extras, armas, selos);
 * - o menu da vez, a caixa REAÇÃO, os efeitos e as armas do jogador
 *   (`BatalhaDoJogador`), operados pelo mestre para QUALQUER lado: a vista da
 *   arena é "tudo meu", e a faixa da troca diz "Vez de Lia", nunca "SUA VEZ";
 * - no modo boneco, o placar do Judge com os ajustes.
 *
 * Toda ação vai direto à `batalhaDaArena` com o autor mestre; a batalha da
 * arena só grava nas cópias. Esc aqui não sai da arena (perderia a luta):
 * cada janela trata o dela, e nenhuma tecla vaza para o mundo atrás.
 */

export interface TelaDaArenaProps {
  sistema: SistemaDeRpg
}

/** O que o mestre abriu pelo menu da carta. `seloId` null = pôr um selo novo. */
type DialogoDaArena =
  | { tipo: 'dano'; tokenId: string }
  | { tipo: 'extras'; cartaId: string }
  | { tipo: 'armas'; personagemId: string }
  | { tipo: 'selo'; tokenId: string; seloId: string | null }
  // U4: o "Ajustar..." da carta, como no mapa (HP, SP, Escudo e um modificador de atributo na cópia).
  | { tipo: 'ajustar'; tokenId: string; personagemId: string }

const SEM_SELOS: SelosNasFichas = new Map()
const SEM_FOTOS: FotosDaForma = new Map()
const PLACAR_VAZIO: ContaDoPlacar = { golpes: [], total: 0, rodadas: 0, mediaPorRodada: 0 }
const SEM_FORMAS_PENDENTES: readonly FormaPendente[] = []

/**
 * U4: TODOS os pedidos da arena saem da função única (`pedidosDaVez`), com o
 * mestre de autor: a mesma lista do mestre no mapa, nenhum desligado. O menu
 * da vez, a caixa REAÇÃO, o menu da carta, as janelas e a vez do bando pedem
 * por aqui; só a ordem das cartas (dar a vez, carta extra, tirar da batalha)
 * segue direto na store, como a faixa do mestre faz.
 */
const PEDIDOS = pedidosDaVez(batalhaDaArena, CENA_DA_ARENA, AUTOR_DA_ARENA)

/**
 * U4: o contador da ficha no menu da carta (a Polaridade do Vagn). A conta e
 * os textos moram em `contadorNoMenu` (lib/batalha), a leitura única para o
 * mapa e a Arena; aqui só o que fazer ao escolher.
 */
function itensDoContador(tokenId: string, personagem: Personagem, sistema: SistemaDeRpg, turnos: BatalhaEmTurnos['turnos']): ItemDoMenuDaCarta[] {
  const contador = contadorNoMenu(tokenId, personagem, sistema, turnos)
  if (contador === null) return []
  const { pedido, ganhar, zerar } = contador
  const itens: ItemDoMenuDaCarta[] = [{ id: 'contador-ganhar', ...ganhar, onEscolher: () => PEDIDOS.contador({ tipo: 'ganhar', ...pedido }) }]
  if (zerar !== null) itens.push({ id: 'contador-zerar', ...zerar, onEscolher: () => PEDIDOS.contador({ tipo: 'zerar', ...pedido }) })
  return itens
}

/**
 * A foto de cada ficha no palco: a forma ligada vence; sem ela, o retrato da
 * cópia pelo mesmo resolvedor da ficha no mundo (`useImagemDaMesa`), o que
 * cobre o retrato de mídia (`midia:`, da pasta) que a montagem deixa de fora.
 * O retrato embutido já vem no token (`imageData`) e segue por lá. A moldura
 * fica na cor do lado (`Token.color`), como no mapa.
 */
function fotosDoPalco(formas: FotosDaForma | null, tokens: readonly Token[], copias: readonly Personagem[], resolver: ResolverDeImagem): FotosDaForma | null {
  const fotos = new Map(formas ?? SEM_FOTOS)
  for (const token of tokens) {
    if (fotos.has(token.id) || (token.imageData ?? null) !== null || token.characterId === null) continue
    const src = resolver(copias.find((copia) => copia.id === token.characterId)?.retrato)
    if (src !== null) fotos.set(token.id, src)
  }
  return fotos.size === 0 ? null : fotos
}

/** O nome da ficha no palco (o do token). */
function nomeDoToken(sessao: SessaoDaArena, tokenId: string): string {
  return sessao.tokens.find((token) => token.id === tokenId)?.name.trim() || 'Ficha'
}

/** "Lado A", "Lado B" ou "Judge-boneco": de onde é a cópia, para o perfil. */
function quemNoPerfil(sessao: SessaoDaArena, equipes: readonly Equipe[], personagemId: string): string | null {
  const token = sessao.tokens.find((candidato) => candidato.characterId === personagemId)
  if (token !== undefined && sessao.ladoDe[token.id] === 'boneco') return 'Judge-boneco'
  return equipes.find((equipe) => equipe.membros.includes(personagemId))?.nome ?? null
}

/** Recomeça com as fichas reais de agora; o aviso diz o que aconteceu. */
function recomecar(fichas: readonly Personagem[]) {
  const toasts = useToastStore.getState()
  if (useArenaStore.getState().recomecar(fichas)) toasts.push('info', 'Recomeçado: fichas cheias de novo, nas posições do início, e o placar zerado.')
  else toasts.push('error', 'Não deu para recomeçar: as fichas escolhidas não estão mais na pasta. Volte à montagem e escolha de novo.')
}

/** U4: a invocação que não nasceu na arena (a regra recusou, ou não há casa livre perto de quem invocou). */
const NAO_NASCEU_NA_ARENA = 'Não nasceu: a invocação já foi posta ou cancelada, os números estão fora do limite ou não há casa livre no palco.'

interface DialogoNaArenaProps {
  dialogo: DialogoDaArena
  cena: BatalhaEmTurnos
  sessao: SessaoDaArena
  /** U4: a mesa como o mestre a lê (a mesma leitura do mapa): o Dar dano abre os invocados da carta do bando. */
  mesa: MesaDoMestre
  /** Tipos de habilidade F2: as linhas de modificador do "Pôr selo..." vêm dos atributos do sistema. */
  sistema: SistemaDeRpg
  onFechar: () => void
}

/** Os diálogos do mestre, sobre a batalha da arena (o hospedeiro da mesa lê a aventura e o mapa: não serve aqui). */
function DialogoNaArena({ dialogo, cena, sessao, mesa, sistema, onFechar }: DialogoNaArenaProps) {
  const { turnos } = cena

  if (dialogo.tipo === 'dano') {
    // U4: a carta do bando vira os invocados dela (a store recusa dano na carta), como no mapa.
    const { alvos, inicial } = alvosDoDarDano(mesa, turnos, dialogo.tokenId)
    return <DarDanoDialog alvos={alvos} alvoInicial={inicial} onConfirmar={PEDIDOS.darDano} onFechar={onFechar} />
  }
  if (dialogo.tipo === 'selo') {
    const { tokenId, seloId } = dialogo
    const selo = seloId === null ? null : (selosDoToken(turnos.selos, tokenId).find((candidato) => candidato.id === seloId) ?? null)
    // O selo saiu (desfeito, acabou) com a janela aberta: ela fecha.
    if (seloId !== null && selo === null) return null
    return (
      <SeloDialog
        quem={nomeDoToken(sessao, tokenId)}
        selo={selo === null ? null : { nome: selo.nome, turnos: selo.turnos, ...(selo.mods === undefined ? {} : { mods: selo.mods }) }}
        alvosDeMod={alvosDeMod(sistema)}
        corFixa={selo?.cartaoId === undefined ? undefined : (selo.natureza ?? 'condicao')}
        onConfirmar={(pedido) => (seloId === null ? PEDIDOS.porSelo(tokenId, pedido) : PEDIDOS.editarSelo(seloId, pedido))}
        onTirar={seloId === null ? undefined : () => PEDIDOS.tirarSelo(seloId)}
        onFechar={onFechar}
      />
    )
  }
  if (dialogo.tipo === 'extras') {
    const carta = turnos.cartas.find((candidata) => candidata.id === dialogo.cartaId)
    if (carta === undefined) return null
    return (
      <AcoesExtrasDialog
        quem={nomeDoToken(sessao, carta.tokenId)}
        inicial={turnos.extras[carta.id] ?? null}
        onConfirmar={(extras) => PEDIDOS.darAcoesExtras(carta.id, extras)}
        onFechar={onFechar}
      />
    )
  }
  const personagem = sessao.copias.find((candidato) => candidato.id === dialogo.personagemId)
  if (personagem === undefined) return null
  if (dialogo.tipo === 'ajustar') {
    return (
      <AjustarDialog
        quem={nomeDoToken(sessao, dialogo.tokenId)}
        tokenId={dialogo.tokenId}
        personagem={personagem}
        sistema={sistema}
        onConfirmar={PEDIDOS.ajustar}
        onFechar={onFechar}
      />
    )
  }
  return (
    <EscolhaDeArmas
      quem={personagem.nome}
      armas={armasDe(personagem).map((arma) => ({ id: arma.id, nome: arma.nome.trim() || 'Arma sem nome', detalhe: arma.campos.dano ? `Dano ${arma.campos.dano}` : undefined }))}
      limite={limiteDeArmas(personagem)}
      escolhidas={turnos.combate?.[personagem.id]?.armas ?? null}
      onConfirmar={(armas) => PEDIDOS.escolherArmas(personagem.id, armas)}
      onFechar={onFechar}
    />
  )
}

interface LutaProps {
  sessao: SessaoDaArena
  cena: BatalhaEmTurnos
  sistema: SistemaDeRpg
}

/** A luta ligada: tudo o que a tela cheia mostra. */
function Luta({ sessao, cena, sistema }: LutaProps) {
  const tituloId = useId()
  const efeitos = batalhaDaArena((state) => efeitosDaCena(state, CENA_DA_ARENA))
  const placar = usePlacarDaArena()
  const fichasReais = usePersonagensDoMundo()
  const resolver = useImagemDaMesa()
  const palcoRef = useRef<HTMLDivElement>(null)
  const consultaAtual = useRef<ConsultaDaFicha | null>(null)
  const [alvoDoMapa, setAlvoDoMapa] = useState<{ tokenId: string; seq: number } | null>(null)
  const [mirando, setMirando] = useState(false)
  const [dialogo, setDialogo] = useState<DialogoDaArena | null>(null)
  const [perfilId, setPerfilId] = useState<string | null>(null)
  const [ajustesAbertos, setAjustesAbertos] = useState(false)

  const { turnos } = cena
  const boneco = sessao.boneco
  const equipes = useMemo(() => equipesDaArena(sessao), [sessao])
  // U1: o recorte da arena fica "tudo meu" (a reação, o contra-ataque e os lembretes de qualquer lado são do mestre). O lado
  // de cada alvo na mira sai da equipe da carta (Lado A, Lado B), em relação a quem age: `alvosDoRecorte`, a montagem de toda entrada.
  const estado = useMemo(() => vistaDaArena(cena, sessao, sistema), [cena, sessao, sistema])
  const dados = useMemo(() => faixaDoMestre({ turnos, fichas: sessao.tokens, personagens: sessao.copias, equipes, sistema }), [turnos, sessao, equipes, sistema])
  const registro = useMemo(() => linhasDoMestre(cena.registro), [cena.registro])
  // U4: a mesa como o mestre a lê (`MesaDoMestre`, a mesma do mapa): a vez do bando, as invocações esperando e o Dar dano saem dela.
  const mesa = useMemo<MesaDoMestre>(
    () => ({ cena, fichas: sessao.tokens, tamanhoDaCasa: CASA_DA_ARENA, personagens: sessao.copias, equipes, sistema, rotulos: nomesNumerados(sessao.tokens.map((token) => ({ id: token.id, nome: token.name }))) }),
    [cena, sessao, equipes, sistema],
  )
  const pendenciasDeInvocacao = useMemo(() => pendenciasDeInvocacaoNaTela(mesa, turnos), [mesa, turnos])
  // U4: o "Escolher no mapa" da invocação. No mapa o mestre clica na casa; o palco da arena não tem esse clique, então o
  // invocado nasce na casa livre mais perto de quem invocou (`colocarInvocadoNaArena`) e o mestre arrasta depois.
  const colocacao = useColocacaoDoMestre((state) => state.armada)
  useEffect(() => {
    if (colocacao === null || colocacao.sceneKey !== CENA_DA_ARENA) return
    const nasceu = colocarInvocadoNaArena(colocacao.invocacaoId, colocacao.ajuste) !== null
    useColocacaoDoMestre.setState({ armada: null, erro: nasceu ? null : { invocacaoId: colocacao.invocacaoId, texto: NAO_NASCEU_NA_ARENA } })
  }, [colocacao])
  const vidas = useMemo(() => vidasDaCena(sessao.tokens, sessao.copias, sistema), [sessao, sistema])
  const selos = useSelosEstaveis(selosNasFichasDoMestre(turnos)) ?? SEM_SELOS
  const fotoDaForma = useFotosEstaveis(fotosDoPalco(fotosDaFormaDoMestre(turnos, sessao.copias, resolver), sessao.tokens, sessao.copias, resolver)) ?? SEM_FOTOS
  const gestoDoJudge = ultimoGestoDoJudge(efeitos)

  const daVez = cartaDaVez(turnos)
  const vezTokenId = daVez?.tokenId ?? null
  // U4: a vez da carta do bando (os invocados): o mestre escolhe quem age, como na aba Batalha do mapa.
  const vezDoBando = daVez === null || daVez.bando === undefined ? null : { carta: daVez, ...vezDoBandoNaTela(mesa, turnos, daVez, daVez.bando.donoTokenId) }
  const tokenDaVez = vezTokenId === null ? undefined : sessao.tokens.find((token) => token.id === vezTokenId)
  const tokenDoBoneco = boneco === null ? undefined : sessao.tokens.find((token) => token.id === boneco.tokenId)
  // O árbitro (modo lados) ou o corpo do boneco: a store da arena o leva junto quando a ficha do boneco anda.
  const judge = cena.judge ?? null
  const judgeAlvo = tokenDaVez === undefined || tokenDaVez.id === tokenDoBoneco?.id ? null : { x: tokenDaVez.x, y: tokenDaVez.y }

  // A posição de cada ficha na tela: o palco publica, a mira e os efeitos leem sempre a de agora.
  const consulta = useCallback<ConsultaDaFicha>((tokenId) => consultaAtual.current?.(tokenId) ?? null, [])

  const menuDaCarta = useCallback(
    (carta: DadosDaCarta): readonly ItemDoMenuDaCarta[] => {
      const loja = batalhaDaArena.getState()
      const indice = dados.cartas.findIndex((candidata) => candidata.id === carta.id)
      const itens: ItemDoMenuDaCarta[] = []
      const personagemId = carta.personagemId
      if (personagemId !== null) itens.push({ id: 'perfil', rotulo: 'Ver perfil', detalhe: 'A cópia da ficha, só para ler', onEscolher: () => setPerfilId(personagemId) })
      if (boneco !== null && carta.tokenId === boneco.tokenId)
        itens.push({ id: 'ajustar-judge', rotulo: 'Ajustar o Judge…', detalhe: 'HP, Escudo e a reação; não entra no registro', onEscolher: () => setAjustesAbertos(true) })
      const jaEaVez = carta.id === dados.vez
      itens.push({
        id: 'vez',
        secao: 'Vez',
        rotulo: 'Dar a vez',
        detalhe: jaEaVez ? 'Já é a vez desta carta' : carta.caiu ? 'Caiu, mas pode jogar se você der a vez' : undefined,
        desabilitado: jaEaVez,
        onEscolher: () => loja.darVez(CENA_DA_ARENA, carta.id),
      })
      itens.push({
        id: 'extra-rodada',
        rotulo: 'Agir de novo nesta rodada',
        detalhe: 'Carta extra logo depois; some na próxima rodada',
        onEscolher: () => loja.adicionarCartaExtra(CENA_DA_ARENA, carta.tokenId, indice + 1, 'rodada'),
      })
      itens.push({
        id: 'extra-sempre',
        rotulo: 'Agir de novo em todas as rodadas',
        detalhe: 'Carta extra logo depois; fica até você tirar',
        onEscolher: () => loja.adicionarCartaExtra(CENA_DA_ARENA, carta.tokenId, indice + 1, 'sempre'),
      })
      if (carta.extra !== null) itens.push({ id: 'tirar-extra', rotulo: 'Tirar esta carta extra', onEscolher: () => loja.removerCarta(CENA_DA_ARENA, carta.id) })
      itens.push({ id: 'dano', secao: 'Combate', rotulo: 'Dar dano…', detalhe: 'Gasta o Escudo primeiro; entra no registro', onEscolher: () => setDialogo({ tipo: 'dano', tokenId: carta.tokenId }) })
      itens.push({ id: 'acoes-extras', rotulo: 'Ações extras…', detalhe: 'Simples, Bônus e Movimento a mais na vez desta carta', onEscolher: () => setDialogo({ tipo: 'extras', cartaId: carta.id }) })
      if (personagemId !== null)
        itens.push({ id: 'armas', rotulo: 'Armas desta batalha…', detalhe: 'Trocar as armas levadas, dentro do limite da ficha', onEscolher: () => setDialogo({ tipo: 'armas', personagemId }) })
      const forma = personagemId === null ? undefined : turnos.formas?.[personagemId]
      if (forma !== undefined && carta.forma) {
        itens.push({
          id: 'desfazer-forma',
          rotulo: `Desfazer a forma (${carta.forma})`,
          detalhe: jaEaVez ? 'Ação livre; entra no registro, o Desfazer volta' : 'Só na vez desta carta',
          desabilitado: !jaEaVez,
          onEscolher: () => PEDIDOS.agir({ cartaId: carta.id, rodada: turnos.rodada }, { tipo: 'destransformar', cartaoId: forma.cartaoId }),
        })
      }
      itens.push({ id: 'por-selo', secao: 'Selos', rotulo: 'Pôr selo…', detalhe: 'Atordoado, Cego… com turnos ou até tirar', onEscolher: () => setDialogo({ tipo: 'selo', tokenId: carta.tokenId, seloId: null }) })
      for (const selo of carta.selos ?? []) {
        const seloId = selo.id
        if (seloId === null) continue
        itens.push({ id: `selo-${seloId}`, rotulo: `${selo.texto}…`, detalhe: 'Editar ou tirar', onEscolher: () => setDialogo({ tipo: 'selo', tokenId: carta.tokenId, seloId }) })
      }
      // U4: os pedidos do mapa que faltavam na arena: o "Ajustar..." da carta e o contador da ficha (a Polaridade do Vagn).
      if (personagemId !== null && carta.bando === undefined && carta.tokenId !== boneco?.tokenId)
        itens.push({ id: 'ajustar', rotulo: 'Ajustar…', detalhe: 'HP, SP, Escudo e um modificador de atributo na cópia; entra no registro', onEscolher: () => setDialogo({ tipo: 'ajustar', tokenId: carta.tokenId, personagemId }) })
      const copiaDaCarta = personagemId === null || carta.bando !== undefined ? undefined : sessao.copias.find((copia) => copia.id === personagemId)
      if (copiaDaCarta !== undefined) itens.push(...itensDoContador(carta.tokenId, copiaDaCarta, sistema, turnos))
      if (personagemId !== null && (carta.carga ?? 0) > 0)
        itens.push({
          id: 'zerar-carga',
          rotulo: `Zerar a concentração (carga ${carta.carga ?? 0})`,
          detalhe: 'Volta a 0; a ação gasta não volta. Entra no registro',
          onEscolher: () => PEDIDOS.zerarCarga(personagemId),
        })
      // Invocação (pedido de 01/11): a carta do bando não tem "Tirar da batalha" (a store recusa).
      if (carta.bando === undefined)
        itens.push({
          id: 'tirar',
          secao: 'Batalha',
          rotulo: 'Tirar da batalha',
          detalhe: 'Sai da ordem com as cartas extras; o Desfazer do registro volta',
          perigo: true,
          onEscolher: () => loja.tirarCombatente(CENA_DA_ARENA, carta.tokenId),
        })
      return itens
    },
    [dados, boneco, turnos, sessao.copias, sistema],
  )

  const perfil = perfilId === null ? undefined : sessao.copias.find((personagem) => personagem.id === perfilId)
  // Tipos de habilidade F3: as passivas da cópia no perfil (o mestre ativa e desliga as de qualquer lado).
  const cartaDoPerfil = perfil === undefined ? undefined : turnos.cartas.find((carta) => carta.personagemId === perfil.id)
  const passivasDoPerfil = perfil === undefined || cartaDoPerfil === undefined ? [] : passivasNaCena(perfil, sistema, turnos, cartaDoPerfil.tokenId)
  // A ficha só se lê; as passivas, quando há, ligam e desligam ali.
  const leituraDoPerfil = passivasDoPerfil.length > 0 ? 'ficha só para ler, passivas ativam aqui' : 'só leitura'
  const descricaoDoPerfil = perfil === undefined ? '' : [quemNoPerfil(sessao, equipes, perfil.id), 'cópia da arena', leituraDoPerfil].filter(Boolean).join(' · ')
  const equipeDoPerfil = perfil === undefined ? undefined : equipes.find((equipe) => equipe.membros.includes(perfil.id))
  const nomeNaArena = (tokenId: string) => sessao.tokens.find((token) => token.id === tokenId)?.name.trim() || 'Ficha'
  const modo = sessao.montagem.modo === 'boneco' ? 'Contra o Judge-boneco' : 'Dois lados'

  return (
    <>
      <header className="ar-barra">
        <span className="ar-barra__med" aria-hidden="true">
          <IconeDoMundo nome="boneco" />
        </span>
        <div className="ar-barra__txt">
          <h1 className="ar-barra__tit" id={tituloId} tabIndex={-1}>
            Arena de testes
          </h1>
          <p className="ar-barra__sub">
            <span className="ar-barra__rodada">Rodada {turnos.rodada}</span>
            <span>{modo}</span>
            <span>{GRADES_DA_ARENA[sessao.montagem.grade].colunas} × {GRADES_DA_ARENA[sessao.montagem.grade].linhas}</span>
          </p>
        </div>
        <p className="ar-barra__aviso">
          <IconeDoMundo nome="copia" />
          <span>Cópias: nada mexe nas fichas de verdade</span>
        </p>
        <div className="ar-barra__acoes">
          <button type="button" className="mu-bt mu-bt--latao" title="Fichas cheias de novo, posições do início, placar zerado" onClick={() => recomecar(fichasReais ?? [])}>
            Recomeçar
          </button>
          <button type="button" className="mu-bt" onClick={() => useArenaStore.getState().voltarAMontagem()}>
            Voltar à montagem
          </button>
          <button
            type="button"
            className="mu-bt mu-bt--fantasma"
            onClick={() => {
              useArenaStore.getState().sair()
              useMundoDoLivroStore.getState().trocarAba('jogadores')
            }}
          >
            <IconeDoMundo nome="voltar" />
            <span>Sair da arena</span>
          </button>
        </div>
      </header>

      <div ref={palcoRef} className="ar-palco" data-mirando={mirando ? 'sim' : undefined}>
        <PalcoDaArena
          tokens={sessao.tokens}
          grade={GRADES_DA_ARENA[sessao.montagem.grade]}
          vezTokenId={vezTokenId}
          vidas={vidas}
          selos={selos}
          fotoDaForma={fotoDaForma}
          judge={judge}
          judgeAlvo={judgeAlvo}
          gestoDoJudge={gestoDoJudge}
          bonecoTokenId={boneco?.tokenId ?? null}
          onMover={(tokenId, x, y) => {
            useArenaStore.getState().moverFicha(tokenId, x, y)
          }}
          onTocarFicha={(tokenId) => setAlvoDoMapa((antes) => ({ tokenId, seq: (antes?.seq ?? 0) + 1 }))}
          onConsulta={(nova) => {
            consultaAtual.current = nova
          }}
        />
      </div>

      {/* U4: a forma "o mestre decide" pedida na arena: a janela abre sozinha e a lista fica até decidir ou recusar, como na aba Batalha do mapa. */}
      <div className="ar-pendencias">
        <FormasPendentes
          itens={turnos.formasPendentes ?? SEM_FORMAS_PENDENTES}
          personagens={sessao.copias}
          sistema={sistema}
          turnos={turnos}
          registro={cena.registro}
          nomeDoToken={nomeNaArena}
          onDecidir={PEDIDOS.decidirForma}
          onRecusar={PEDIDOS.cancelarForma}
        />
        {/* U4: as invocações esperando (Colocar e Cancelar) e a vez do bando, as mesmas peças da aba Batalha do mapa. */}
        <InvocacoesPendentes sceneKey={CENA_DA_ARENA} itens={pendenciasDeInvocacao} onCancelar={PEDIDOS.cancelarInvocacao} />
        {vezDoBando !== null && (
          <section className="bt-secao" aria-label={`Vez de ${vezDoBando.nome}`}>
            <PainelDoBando
              key={`${vezDoBando.carta.id}:${turnos.rodada}`}
              nome={vezDoBando.nome}
              cor={vezDoBando.cor}
              membros={vezDoBando.membros}
              onAgir={(tokenId, pedido) => PEDIDOS.agirComInvocado({ cartaId: vezDoBando.carta.id, rodada: turnos.rodada }, tokenId, pedido)}
              onEncerrar={() => PEDIDOS.passarVez(vezDoBando.carta.id, turnos.rodada)}
              onDarDano={() => setDialogo({ tipo: 'dano', tokenId: vezDoBando.carta.tokenId })}
              consulta={consulta}
              alvoDoMapa={alvoDoMapa}
              mapa={{ ligado: mirando, onTrocar: setMirando }}
            />
          </section>
        )}
      </div>

      <FaixaDaOrdem
        papel="mestre"
        className="pp-batalha-faixa"
        dados={dados}
        onMover={(cartaId, indice) => batalhaDaArena.getState().moverCarta(CENA_DA_ARENA, cartaId, indice)}
        menuDaCarta={menuDaCarta}
        onPassarVez={dados.cartas.length === 0 ? undefined : () => PEDIDOS.passarVez()}
        regras={cena.regras}
        registro={registro}
        onDesfazer={PEDIDOS.desfazer}
        onSelo={(carta, seloId) => setDialogo({ tipo: 'selo', tokenId: carta.tokenId, seloId })}
      />

      <BatalhaDoJogador
        estado={estado}
        efeitos={efeitos}
        meus={sessao.copias}
        fichas={sessao.tokens}
        sistema={sistema}
        conexao={PEDIDOS}
        consulta={consulta}
        alvoDoMapa={alvoDoMapa}
        onMirando={setMirando}
        onTremor={() => tremer(palcoRef.current)}
        textoDaVez="vezDe"
        // U4: a arena tem grade: a área da técnica marca pelas casas, como no mapa.
        tamanhoDaCasa={CASA_DA_ARENA}
        // U2: a regra roda aqui mesmo: a recusa diz o motivo dela, como na vez do NPC no mapa (nunca "sem conexão com o mestre").
        motivoDaRecusa={PEDIDOS.motivoDoAgir}
        avisoDaRecusa={RECUSA_SEM_MOTIVO}
      />

      {boneco !== null && (
        <div className="ar-placar-lugar">
          <PlacarDoBoneco
            conta={placar ?? PLACAR_VAZIO}
            boneco={boneco}
            onAjustar={(ajuste) => useArenaStore.getState().ajustarBoneco(ajuste)}
            comEscudo={recursoDoEscudo(sistema) !== null}
            comVida={recursoDeVida(sistema) !== null}
            ajustesAbertos={ajustesAbertos}
            onAjustesAbertos={setAjustesAbertos}
          />
        </div>
      )}

      {perfil !== undefined && (
        <PerfilDaCarta
          personagem={perfil}
          sistema={sistema}
          descricao={descricaoDoPerfil}
          imagemDaForma={aparenciaDaForma(turnos.formas?.[perfil.id], perfil)}
          quemOlha="mestre"
          passivas={
            cartaDoPerfil === undefined || passivasDoPerfil.length === 0 ? undefined : (
              <PassivasDaFicha
                passivas={passivasDoPerfil}
                tokenId={cartaDoPerfil.tokenId}
                alvos={alvosDaOrdemParaPassiva(turnos.cartas, nomeNaArena, cartaDoPerfil.tokenId, (personagemId) => personagemId !== null && equipeDoPerfil?.membros.includes(personagemId) === true)}
                sistema={sistema}
                aplicarLivre
                onPedir={PEDIDOS.passiva}
              />
            )
          }
          onFechar={() => setPerfilId(null)}
        />
      )}
      {dialogo !== null && <DialogoNaArena dialogo={dialogo} cena={cena} sessao={sessao} mesa={mesa} sistema={sistema} onFechar={() => setDialogo(null)} />}
    </>
  )
}

export function TelaDaArena({ sistema }: TelaDaArenaProps) {
  const sessao = useArenaStore((state) => state.sessao)
  const cena = batalhaDaArena((state) => (Object.hasOwn(state.cenas, CENA_DA_ARENA) ? state.cenas[CENA_DA_ARENA] : undefined))
  const raiz = useRef<HTMLElement>(null)

  // Ao abrir, o foco entra na arena (o título); ao fechar, volta para quem a abriu, se ainda estiver na tela.
  useEffect(() => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
    raiz.current?.querySelector<HTMLElement>('.ar-barra__tit')?.focus()
    return () => {
      if (antes !== null && antes.isConnected && !antes.matches(':disabled')) antes.focus()
    }
  }, [])

  if (sessao === null || sessao.fase !== 'lutando') return null

  return createPortal(
    <section
      ref={raiz}
      className="ar-tela"
      aria-label="Arena de testes"
      // Nenhuma tecla daqui vale como atalho do mundo nem do editor atrás (Esc do mundo fecharia o livro).
      onKeyDown={(evento) => evento.stopPropagation()}
    >
      {cena === undefined ? (
        <p className="ar-ligando" aria-busy="true">
          Ligando a batalha da arena…
        </p>
      ) : (
        <Luta sessao={sessao} cena={cena} sistema={sistema} />
      )}
    </section>,
    document.body,
  )
}
