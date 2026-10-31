import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motivoDoConcentrar } from '../../lib/batalha/acoes'
import { chaveDaVez, type PedidoDeAcao, type PedidoDeReacao } from '../../lib/batalha/combate'
import { armasDe } from '../../lib/batalha/leituraDaFicha'
import type { VezEsperada } from '../../lib/batalha/ponte'
import { formasNoMenu } from '../../lib/batalha/transformacao'
import { ATACANTE_FORA_DA_VISTA, type EfeitoParaJogador, type EstadoParaJogador } from '../../lib/batalha/vistaDoJogador'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { BotaoDeReacao } from './BotaoDeReacao'
import { CaixaDeReacao, type ReacaoNaCaixa } from './CaixaDeReacao'
import { MOTIVO_SEM_PERSONAGEM, armasNaBatalha, combateDoJogador, golpesDeAtaque, golpesDeHabilidade, type AlvoNaMira } from './dadosDoMenu'
import { EfeitosDaBatalha, type PalcoDosEfeitos } from './EfeitosDaBatalha'
import { EscolhaDeArmas } from './EscolhaDeArmas'
import { MenuDaVez, type ContraNoMenu } from './MenuDaVez'
import type { ConsultaDaFicha } from './MiraDoGolpe'
import './batalha.css'
import './combate.css'

/**
 * A BATALHA DO JOGADOR sobre o mapa (S3): os efeitos (com a faixa da vez e o
 * tremor), o menu da vez (e o contra-ataque guardado, fora da vez), o botão
 * REAÇÃO sempre à vista, a caixa REAÇÃO (abre sozinha quando chega golpe
 * novo) e a escolha de armas no começo (limite da ficha e ainda não
 * escolheu). Tudo lê o recorte do host (`batalhaEstado`, `batalhaEfeitos`) e
 * pede pela conexão; o resultado volta no próximo estado.
 *
 * Enquanto o corte do golpe ou a faixa da vez passam (o palco dos efeitos), o
 * menu, o véu e a caixa somem e voltam depois; na SUA VEZ o menu novo só entra
 * quando a faixa sai.
 */

export interface ConexaoDaBatalha {
  agir: (vez: VezEsperada | null, pedido: PedidoDeAcao) => boolean
  reagir: (pedido: PedidoDeReacao) => boolean
  escolherArmas: (personagemId: string, armas: readonly string[]) => boolean
  passarVez: (cartaId: string, rodada: number) => boolean
  /** "Zerar" a concentração do personagem dele. Ausente = sem o botão. */
  zerarCarga?: (personagemId: string) => boolean
}

export interface FichaDoJogador {
  id: string
  name: string
  imageData?: string | null
}

export interface BatalhaDoJogadorProps {
  estado: EstadoParaJogador
  efeitos: readonly EfeitoParaJogador[] | undefined
  /** Os personagens dele (`state.personagens`). */
  meus: readonly Personagem[] | undefined
  fichas: readonly FichaDoJogador[]
  sistema: SistemaDeRpg | null
  conexao: ConexaoDaBatalha
  /** S4: a posição da ficha na tela (estável). */
  consulta: ConsultaDaFicha
  /** S4: a ficha tocada enquanto mira. */
  alvoDoMapa: { tokenId: string; seq: number } | null
  onMirando: (mirando: boolean) => void
  onTremor: () => void
}

/** A classe que o PlayerView dá à `FaixaDoJogador` (player/main.tsx). */
const CLASSE_DA_FAIXA = 'pp-batalha-faixa'
const SEM_EFEITOS: readonly EfeitoParaJogador[] = []
const NINGUEM: readonly Personagem[] = []

export function BatalhaDoJogador({ estado, efeitos = SEM_EFEITOS, meus = NINGUEM, fichas, sistema, conexao, consulta, alvoDoMapa, onMirando, onTremor }: BatalhaDoJogadorProps) {
  const [caixaAberta, setCaixaAberta] = useState(false)
  const [livre, setLivre] = useState(false)
  const [armasDe_, setArmasDe] = useState<string | null>(null)
  const [palco, setPalco] = useState<PalcoDosEfeitos>(null)
  const dispensadas = useRef(new Set<string>())

  const nomeDe = useMemo(() => {
    const porToken = new Map<string, string>()
    for (const ficha of fichas) porToken.set(ficha.id, ficha.name.trim())
    for (const carta of estado.cartas) if (carta.nome.trim() !== '') porToken.set(carta.tokenId, carta.nome.trim())
    return (tokenId: string) => porToken.get(tokenId) || 'Ficha'
  }, [fichas, estado.cartas])
  // F3: a imagem da forma (o host manda só a de cartão ligado) vence a foto no corte e na transformação.
  const aparencias = estado.aparencias
  const imagemDe = useMemo(() => {
    const porToken = new Map(fichas.map((ficha) => [ficha.id, ficha.imageData ?? null] as const))
    const daForma = (tokenId: string) => (aparencias !== undefined && Object.hasOwn(aparencias, tokenId) ? aparencias[tokenId] : undefined)
    return (tokenId: string) => daForma(tokenId) ?? porToken.get(tokenId) ?? null
  }, [fichas, aparencias])

  // ---- a vez e o contra-ataque
  const vez = estado.vez
  const cartaDaVez = vez === null ? undefined : estado.cartas.find((carta) => carta.id === vez)
  const contras = estado.contras ?? []
  const tokenQueAge = estado.minhaVez ? cartaDaVez?.tokenId : contras[0]?.tokenId
  const cartaQueAge = tokenQueAge === undefined ? undefined : (estado.minhaVez ? cartaDaVez : estado.cartas.find((carta) => carta.tokenId === tokenQueAge && carta.lado === 'eu'))
  const personagemId = cartaQueAge?.personagemId
  const personagem = personagemId === undefined ? null : (meus.find((candidato) => candidato.id === personagemId) ?? null)
  const meuCombate = personagemId === undefined ? undefined : estado.meus?.find((combate) => combate.personagemId === personagemId)
  const chave = estado.minhaVez && vez !== null ? chaveDaVez(estado.rodada, vez) : null
  const combate = useMemo(() => combateDoJogador(meuCombate, chave), [meuCombate, chave])
  const acoes = estado.minhaVez ? (estado.acoes ?? null) : null
  const { zerarCarga } = conexao

  const menu = useMemo(() => {
    if (cartaQueAge === undefined) return null
    const arma = armasNaBatalha(personagem, combate)[0] ?? null
    const habilidades = (comAcoes: typeof acoes) => (personagem !== null && sistema !== null ? golpesDeHabilidade(personagem, sistema, combate, comAcoes, arma) : [])
    const vistos = new Set<string>()
    const alvos: AlvoNaMira[] = []
    for (const carta of estado.cartas) {
      if (vistos.has(carta.tokenId)) continue
      vistos.add(carta.tokenId)
      alvos.push({
        tokenId: carta.tokenId,
        nome: carta.nome.trim() || nomeDe(carta.tokenId),
        lado: carta.lado,
        caiu: carta.caiu === true,
        // A carta "outro" não diz se tem personagem: o host confere.
        motivo: carta.lado !== 'outro' && carta.personagemId === undefined ? MOTIVO_SEM_PERSONAGEM : null,
      })
    }
    return {
      armas: golpesDeAtaque(personagem, sistema, combate, acoes),
      habilidades: habilidades(acoes),
      contra: { armas: golpesDeAtaque(personagem, sistema, combate, null), habilidades: habilidades(null) },
      alvos,
      // F3: a tira Transformação (com a prévia dos números da ficha dele).
      formas: personagem !== null && sistema !== null ? formasNoMenu(personagem, sistema, acoes) : [],
    }
  }, [cartaQueAge, personagem, sistema, combate, acoes, estado.cartas, nomeDe])

  const contrasNoMenu = useMemo<ContraNoMenu[]>(
    () =>
      contras.map((contra) => ({
        golpeId: contra.golpeId,
        rotulo: contra.atacanteTokenId === null ? 'contra alguém fora da vista' : `contra ${nomeDe(contra.atacanteTokenId)}`,
      })),
    [contras, nomeDe],
  )

  // ---- a reação
  const reacoes = useMemo<ReacaoNaCaixa[]>(() => {
    const variasFichas = new Set((estado.reacoes ?? []).map((reacao) => reacao.tokenId)).size > 1
    return (estado.reacoes ?? []).map((reacao) => {
      const item: ReacaoNaCaixa = { golpeId: reacao.golpeId, tokenId: reacao.tokenId, atacante: reacao.atacante === ATACANTE_FORA_DA_VISTA ? 'Alguém fora da sua vista' : reacao.atacante, nome: reacao.nome, dano: reacao.dano }
      if (variasFichas) item.alvo = nomeDe(reacao.tokenId)
      if (reacao.perfurante) item.perfurante = true
      if (reacao.rolagem !== undefined) item.rolagem = reacao.rolagem
      return item
    })
  }, [estado.reacoes, nomeDe])

  // Golpe novo esperando: a caixa abre sozinha (uma vez por golpe).
  const vistosGolpes = useRef(new Set<string>())
  useEffect(() => {
    let novo = false
    for (const reacao of reacoes) {
      const chaveDoGolpe = `${reacao.golpeId}:${reacao.tokenId}`
      if (!vistosGolpes.current.has(chaveDoGolpe)) {
        vistosGolpes.current.add(chaveDoGolpe)
        novo = true
      }
    }
    if (novo) {
      setLivre(false)
      setCaixaAberta(true)
    }
    if (reacoes.length === 0 && !livre) setCaixaAberta(false)
  }, [reacoes, livre])

  const minhaFicha = estado.cartas.find((carta) => carta.lado === 'eu' && carta.caiu !== true) ?? estado.cartas.find((carta) => carta.lado === 'eu')
  const reacoesNaCaixa: ReacaoNaCaixa[] =
    reacoes.length > 0 ? reacoes : livre && minhaFicha !== undefined ? [{ golpeId: null, tokenId: minhaFicha.tokenId, atacante: '', nome: '', dano: null }] : []

  // ---- as armas: no começo, com limite e sem escolha, a janela abre (uma vez; Cancelar não reabre)
  const semEscolha = (estado.meus ?? []).find((meu) => meu.limiteDeArmas !== null && meu.armas === null && !dispensadas.current.has(meu.personagemId))
  useEffect(() => {
    if (semEscolha !== undefined && armasDe_ === null) setArmasDe(semEscolha.personagemId)
  }, [semEscolha, armasDe_])
  const personagemDasArmas = armasDe_ === null ? null : (meus.find((candidato) => candidato.id === armasDe_) ?? null)
  const combateDasArmas = armasDe_ === null ? undefined : estado.meus?.find((meu) => meu.personagemId === armasDe_)

  // Na SUA VEZ o menu novo espera a faixa sair (tocando ou ainda na fila); nos outros palcos ele só some e volta.
  const mostrarMenu = cartaQueAge !== undefined && menu !== null && (estado.minhaVez || contras.length > 0) && palco !== 'suaVez'
  const noPalco = palco === null ? undefined : 'sim'

  // O menu mora à esquerda, centrado na altura, mas começa abaixo da faixa da
  // ordem (`.pp-batalha-faixa`, montada pelo PlayerView): a altura dela muda com
  // as cartas, então é medida e vai para `--pp-faixa-alto` no lugar do menu.
  const lugarDoMenu = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const lugar = lugarDoMenu.current
    const faixa = document.querySelector<HTMLElement>(`.${CLASSE_DA_FAIXA}`)
    if (lugar === null || faixa === null) return
    const medir = () => lugar.style.setProperty('--pp-faixa-alto', `${faixa.offsetHeight}px`)
    medir()
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    observador?.observe(faixa)
    return () => observador?.disconnect()
  }, [mostrarMenu])

  return (
    <>
      <EfeitosDaBatalha
        className="pp-batalha-efeitos"
        efeitos={efeitos}
        consulta={consulta}
        nomeDe={nomeDe}
        imagemDe={imagemDe}
        vez={vez === null || cartaDaVez === undefined ? null : { chave: `${vez}:${estado.rodada}`, nome: cartaDaVez.nome.trim() || nomeDe(cartaDaVez.tokenId), minha: estado.minhaVez }}
        onTremor={onTremor}
        onPalco={setPalco}
      />
      {mostrarMenu && <div className="pp-batalha-veu" aria-hidden="true" data-palco={noPalco} />}
      {mostrarMenu && (
        <div ref={lugarDoMenu} className="pp-batalha-menu" data-palco={noPalco}>
          <MenuDaVez
            key={estado.minhaVez ? `${vez}:${estado.rodada}` : 'contra'}
            quem={cartaQueAge.nome.trim() || 'Você'}
            acoes={acoes}
            carga={combate?.carga ?? 0}
            motivoDoConcentrar={acoes === null ? 'Fora da vez' : motivoDoConcentrar(combate, acoes, chave ?? '')}
            armas={menu.armas}
            habilidades={menu.habilidades}
            golpesDoContra={menu.contra}
            alvos={menu.alvos}
            contras={contrasNoMenu}
            escolhaDeArmas={
              personagemId === undefined || meuCombate === undefined || meuCombate.limiteDeArmas === null
                ? undefined
                : { pendente: meuCombate.armas === null, onAbrir: () => setArmasDe(personagemId) }
            }
            onAgir={(pedido) => conexao.agir(pedido.tipo !== 'concentrar' && pedido.contraDe !== undefined ? null : vez === null ? null : { cartaId: vez, rodada: estado.rodada }, pedido)}
            onZerarCarga={zerarCarga === undefined || personagemId === undefined ? undefined : () => zerarCarga(personagemId)}
            onEncerrar={estado.minhaVez && vez !== null ? () => conexao.passarVez(vez, estado.rodada) : undefined}
            alvoDoMapa={alvoDoMapa}
            onMirando={onMirando}
            consulta={consulta}
            formas={menu.formas}
            personagemId={personagemId ?? null}
          />
        </div>
      )}
      <div className="pp-batalha-reacao-botao">
        <BotaoDeReacao
          esperando={reacoes.length}
          aberta={caixaAberta}
          onAbrir={() => {
            if (caixaAberta) {
              setCaixaAberta(false)
              setLivre(false)
              return
            }
            setLivre(reacoes.length === 0)
            setCaixaAberta(true)
          }}
        />
      </div>
      {caixaAberta && reacoesNaCaixa.length > 0 && (
        <div className="pp-batalha-reacao" data-palco={noPalco}>
          <CaixaDeReacao
            reacoes={reacoesNaCaixa}
            onPedir={(pedido) => {
              const saiu = conexao.reagir(pedido)
              // A reação livre vira efeito sobre a ficha: a caixa sai.
              if (saiu && pedido.tipo === 'rolar' && pedido.golpeId === null) {
                setLivre(false)
                setCaixaAberta(false)
              }
              return saiu
            }}
            onFechar={() => {
              setCaixaAberta(false)
              setLivre(false)
            }}
          />
        </div>
      )}
      {personagemDasArmas !== null && combateDasArmas !== undefined && armasDe_ !== null && (
        <EscolhaDeArmas
          quem={personagemDasArmas.nome}
          armas={armasDe(personagemDasArmas).map((arma) => ({ id: arma.id, nome: arma.nome.trim() || 'Arma sem nome', detalhe: arma.campos.dano ? `Dano ${arma.campos.dano}` : undefined }))}
          limite={combateDasArmas.limiteDeArmas}
          escolhidas={combateDasArmas.armas}
          onConfirmar={(armas) => conexao.escolherArmas(armasDe_, armas)}
          onFechar={() => {
            dispensadas.current.add(armasDe_)
            setArmasDe(null)
          }}
        />
      )}
    </>
  )
}
