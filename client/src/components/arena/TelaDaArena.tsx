import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { equipesDaArena, vistaDaArena, AUTOR_DA_ARENA } from '../../lib/arena/estadoDaArena'
import { CENA_DA_ARENA, GRADES_DA_ARENA, type ContaDoPlacar, type LadoDaArena, type SessaoDaArena } from '../../lib/arena/tipos'
import type { PedidoDeAcao, PedidoDeReacao } from '../../lib/batalha/combate'
import type { Equipe } from '../../lib/batalha/equipes'
import { armasDe, limiteDeArmas, recursoDoEscudo } from '../../lib/batalha/leituraDaFicha'
import type { BatalhaEmTurnos, VezEsperada } from '../../lib/batalha/ponte'
import { alvosDeMod, selosDoToken } from '../../lib/batalha/selos'
import { aparenciaDaForma } from '../../lib/batalha/transformacao'
import { cartaDaVez } from '../../lib/batalha/turnos'
import type { EstadoParaJogador, LadoNaCarta } from '../../lib/batalha/vistaDoJogador'
import type { ResolverDeImagem } from '../../lib/midia'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import type { Token } from '../../types/map'
import { recursoDeVida, vidasDaCena } from '../../lib/vidaDaFicha'
import type { FotosDaForma, SelosNasFichas } from '../../pixi/tokenPhotoSprite'
import { ultimoGestoDoJudge } from '../../pixi/judgeDoMapa'
import { batalhaDaArena, useArenaStore, usePlacarDaArena } from '../../stores/arenaStore'
import { efeitosDaCena } from '../../stores/batalhaStore'
import { useMundoDoLivroStore, usePersonagensDoMundo } from '../../stores/mundoDoLivroStore'
import { useToastStore } from '../../stores/toastStore'
import { AcoesExtrasDialog } from '../batalha/AcoesExtrasDialog'
import { BatalhaDoJogador, type ConexaoDaBatalha } from '../batalha/BatalhaDoJogador'
import { DarDanoDialog } from '../batalha/DarDanoDialog'
import { faixaDoMestre, linhasDoMestre, type DadosDaCarta } from '../batalha/dadosDaFaixa'
import { tremer } from '../batalha/EfeitosDaBatalha'
import { EscolhaDeArmas } from '../batalha/EscolhaDeArmas'
import { FaixaDaOrdem } from '../batalha/FaixaDaOrdem'
import { fotosDaFormaDoMestre, selosNasFichasDoMestre, useFotosEstaveis, useSelosEstaveis } from '../batalha/marcasNoMapa'
import type { ItemDoMenuDaCarta } from '../batalha/MenuDaCarta'
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

const SEM_SELOS: SelosNasFichas = new Map()
const SEM_FOTOS: FotosDaForma = new Map()
const PLACAR_VAZIO: ContaDoPlacar = { golpes: [], total: 0, rodadas: 0, mediaPorRodada: 0 }

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

/** O lado do token na arena (o boneco joga no Lado B). */
function ladoDoToken(sessao: SessaoDaArena, tokenId: string): LadoDaArena | null {
  const lado = sessao.ladoDe[tokenId]
  if (lado === undefined) return null
  return lado === 'boneco' ? 'b' : lado
}

/**
 * A vista da arena é "tudo meu" (todas as cartas "eu"). Na vez de uma ficha,
 * o menu dela lê os lados de verdade: ela é "eu", o lado dela é "aliado" e o
 * outro é "outro" — assim a mira já começa num inimigo e a lista de alvos não
 * diz "você" para todo mundo. Fora da vez fica como veio (o contra-ataque
 * guardado procura a ficha "eu").
 */
function comLadosDaVez(estado: EstadoParaJogador, sessao: SessaoDaArena): EstadoParaJogador {
  if (!estado.minhaVez || estado.vez === null) return estado
  const daVez = estado.cartas.find((carta) => carta.id === estado.vez)
  if (daVez === undefined) return estado
  const ladoDaVez = ladoDoToken(sessao, daVez.tokenId)
  let mudou = false
  const cartas = estado.cartas.map((carta) => {
    const lado: LadoNaCarta = carta.tokenId === daVez.tokenId ? 'eu' : ladoDoToken(sessao, carta.tokenId) === ladoDaVez ? 'aliado' : 'outro'
    if (carta.lado === lado) return carta
    mudou = true
    return { ...carta, lado }
  })
  return mudou ? { ...estado, cartas } : estado
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

interface DialogoNaArenaProps {
  dialogo: DialogoDaArena
  cena: BatalhaEmTurnos
  sessao: SessaoDaArena
  /** Tipos de habilidade F2: as linhas de modificador do "Pôr selo..." vêm dos atributos do sistema. */
  sistema: SistemaDeRpg
  onFechar: () => void
}

/** Os diálogos do mestre, sobre a batalha da arena (o hospedeiro da mesa lê a aventura e o mapa: não serve aqui). */
function DialogoNaArena({ dialogo, cena, sessao, sistema, onFechar }: DialogoNaArenaProps) {
  const { turnos } = cena
  const loja = batalhaDaArena.getState()

  if (dialogo.tipo === 'dano') {
    const vistos = new Set<string>()
    const alvos = turnos.cartas.filter((carta) => !vistos.has(carta.tokenId) && vistos.add(carta.tokenId)).map((carta) => ({ tokenId: carta.tokenId, nome: nomeDoToken(sessao, carta.tokenId) }))
    return <DarDanoDialog alvos={alvos} alvoInicial={dialogo.tokenId} onConfirmar={(tokenId, valor) => loja.darDano(CENA_DA_ARENA, AUTOR_DA_ARENA, tokenId, valor)} onFechar={onFechar} />
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
        onConfirmar={(pedido) => (seloId === null ? loja.porSelo(CENA_DA_ARENA, tokenId, pedido) : loja.editarSelo(CENA_DA_ARENA, seloId, pedido))}
        onTirar={seloId === null ? undefined : () => loja.tirarSelo(CENA_DA_ARENA, seloId)}
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
        onConfirmar={(extras) => loja.darAcoesExtras(CENA_DA_ARENA, carta.id, extras)}
        onFechar={onFechar}
      />
    )
  }
  const personagem = sessao.copias.find((candidato) => candidato.id === dialogo.personagemId)
  if (personagem === undefined) return null
  return (
    <EscolhaDeArmas
      quem={personagem.nome}
      armas={armasDe(personagem).map((arma) => ({ id: arma.id, nome: arma.nome.trim() || 'Arma sem nome', detalhe: arma.campos.dano ? `Dano ${arma.campos.dano}` : undefined }))}
      limite={limiteDeArmas(personagem)}
      escolhidas={turnos.combate?.[personagem.id]?.armas ?? null}
      onConfirmar={(armas) => loja.escolherArmas(CENA_DA_ARENA, AUTOR_DA_ARENA, personagem.id, armas)}
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
  const estado = useMemo(() => comLadosDaVez(vistaDaArena(cena, sessao, sistema), sessao), [cena, sessao, sistema])
  const dados = useMemo(() => faixaDoMestre({ turnos, fichas: sessao.tokens, personagens: sessao.copias, equipes, sistema }), [turnos, sessao, equipes, sistema])
  const registro = useMemo(() => linhasDoMestre(cena.registro), [cena.registro])
  const vidas = useMemo(() => vidasDaCena(sessao.tokens, sessao.copias, sistema), [sessao, sistema])
  const selos = useSelosEstaveis(selosNasFichasDoMestre(turnos)) ?? SEM_SELOS
  const fotoDaForma = useFotosEstaveis(fotosDoPalco(fotosDaFormaDoMestre(turnos, sessao.copias, resolver), sessao.tokens, sessao.copias, resolver)) ?? SEM_FOTOS
  const gestoDoJudge = ultimoGestoDoJudge(efeitos)

  const vezTokenId = cartaDaVez(turnos)?.tokenId ?? null
  const tokenDaVez = vezTokenId === null ? undefined : sessao.tokens.find((token) => token.id === vezTokenId)
  const tokenDoBoneco = boneco === null ? undefined : sessao.tokens.find((token) => token.id === boneco.tokenId)
  // O árbitro (modo lados) ou o corpo do boneco: a store da arena o leva junto quando a ficha do boneco anda.
  const judge = cena.judge ?? null
  const judgeAlvo = tokenDaVez === undefined || tokenDaVez.id === tokenDoBoneco?.id ? null : { x: tokenDaVez.x, y: tokenDaVez.y }

  // A posição de cada ficha na tela: o palco publica, a mira e os efeitos leem sempre a de agora.
  const consulta = useCallback<ConsultaDaFicha>((tokenId) => consultaAtual.current?.(tokenId) ?? null, [])

  const conexao = useMemo<ConexaoDaBatalha>(
    () => ({
      agir: (vez: VezEsperada | null, pedido: PedidoDeAcao) => batalhaDaArena.getState().agir(CENA_DA_ARENA, AUTOR_DA_ARENA, vez, pedido),
      reagir: (pedido: PedidoDeReacao) => batalhaDaArena.getState().reagir(CENA_DA_ARENA, AUTOR_DA_ARENA, pedido),
      escolherArmas: (personagemId, armas) => batalhaDaArena.getState().escolherArmas(CENA_DA_ARENA, AUTOR_DA_ARENA, personagemId, armas),
      passarVez: (cartaId, rodada) => batalhaDaArena.getState().passarVez(CENA_DA_ARENA, AUTOR_DA_ARENA, { cartaId, rodada }),
      zerarCarga: (personagemId) => batalhaDaArena.getState().zerarCarga(CENA_DA_ARENA, AUTOR_DA_ARENA, personagemId),
    }),
    [],
  )

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
          onEscolher: () => loja.agir(CENA_DA_ARENA, AUTOR_DA_ARENA, { cartaId: carta.id, rodada: turnos.rodada }, { tipo: 'destransformar', cartaoId: forma.cartaoId }),
        })
      }
      itens.push({ id: 'por-selo', secao: 'Selos', rotulo: 'Pôr selo…', detalhe: 'Atordoado, Cego… com turnos ou até tirar', onEscolher: () => setDialogo({ tipo: 'selo', tokenId: carta.tokenId, seloId: null }) })
      for (const selo of carta.selos ?? []) {
        const seloId = selo.id
        if (seloId === null) continue
        itens.push({ id: `selo-${seloId}`, rotulo: `${selo.texto}…`, detalhe: 'Editar ou tirar', onEscolher: () => setDialogo({ tipo: 'selo', tokenId: carta.tokenId, seloId }) })
      }
      if (personagemId !== null && (carta.carga ?? 0) > 0)
        itens.push({
          id: 'zerar-carga',
          rotulo: `Zerar a concentração (carga ${carta.carga ?? 0})`,
          detalhe: 'Volta a 0; a ação gasta não volta. Entra no registro',
          onEscolher: () => loja.zerarCarga(CENA_DA_ARENA, AUTOR_DA_ARENA, personagemId),
        })
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
    [dados, boneco, turnos],
  )

  const perfil = perfilId === null ? undefined : sessao.copias.find((personagem) => personagem.id === perfilId)
  const descricaoDoPerfil = perfil === undefined ? '' : [quemNoPerfil(sessao, equipes, perfil.id), 'cópia da arena', 'só leitura'].filter(Boolean).join(' · ')
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

      <FaixaDaOrdem
        papel="mestre"
        className="pp-batalha-faixa"
        dados={dados}
        onMover={(cartaId, indice) => batalhaDaArena.getState().moverCarta(CENA_DA_ARENA, cartaId, indice)}
        menuDaCarta={menuDaCarta}
        onPassarVez={dados.cartas.length === 0 ? undefined : () => batalhaDaArena.getState().passarVez(CENA_DA_ARENA, AUTOR_DA_ARENA)}
        regras={cena.regras}
        registro={registro}
        onDesfazer={(linhaId) => batalhaDaArena.getState().desfazer(CENA_DA_ARENA, linhaId, AUTOR_DA_ARENA)}
        onSelo={(carta, seloId) => setDialogo({ tipo: 'selo', tokenId: carta.tokenId, seloId })}
      />

      <BatalhaDoJogador
        estado={estado}
        efeitos={efeitos}
        meus={sessao.copias}
        fichas={sessao.tokens}
        sistema={sistema}
        conexao={conexao}
        consulta={consulta}
        alvoDoMapa={alvoDoMapa}
        onMirando={setMirando}
        onTremor={() => tremer(palcoRef.current)}
        textoDaVez="vezDe"
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
        <PerfilDaCarta personagem={perfil} sistema={sistema} descricao={descricaoDoPerfil} imagemDaForma={aparenciaDaForma(turnos.formas?.[perfil.id], perfil)} onFechar={() => setPerfilId(null)} />
      )}
      {dialogo !== null && <DialogoNaArena dialogo={dialogo} cena={cena} sessao={sessao} sistema={sistema} onFechar={() => setDialogo(null)} />}
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
