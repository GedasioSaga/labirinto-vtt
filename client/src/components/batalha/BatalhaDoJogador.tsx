import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motivoDoConcentrar } from '../../lib/batalha/acoes'
import { ALVO_DA_REACAO, chaveDaVez, partesDoBonus, type PedidoDeAcao, type PedidoDePassiva, type PedidoDeReacao } from '../../lib/batalha/combate'
import { armasDe } from '../../lib/batalha/leituraDaFicha'
import { reacoesParaOAlvo } from '../../lib/batalha/reacaoComTecnica'
import type { VezEsperada } from '../../lib/batalha/ponte'
import { bonusDaBatalha, bonusDaReacao, type SeloQueSoma } from '../../lib/batalha/selos'
import { formasNoMenu } from '../../lib/batalha/transformacao'
import { ATACANTE_FORA_DA_VISTA, selosParaOBonus, type EfeitoParaJogador, type EstadoParaJogador } from '../../lib/batalha/vistaDoJogador'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { BotaoDeReacao } from './BotaoDeReacao'
import { CaixaDeReacao, type BonusDaReacaoNaTela, type ReacaoNaCaixa } from './CaixaDeReacao'
import { MOTIVO_SEM_PERSONAGEM, armasNaBatalha, combateDoJogador, golpesDeAtaque, golpesDeHabilidade, type AlvoNaMira } from './dadosDoMenu'
import { EfeitosDaBatalha, type PalcoDosEfeitos } from './EfeitosDaBatalha'
import { EscolhaDeArmas } from './EscolhaDeArmas'
import { MenuDaVez, type ContraNoMenu } from './MenuDaVez'
import type { ConsultaDaFicha } from './MiraDoGolpe'
import { LembretesDaPassiva, lembretesNaTela, passivasNoRecorte, type LembreteNaTela } from './PassivasDaBatalha'
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
 *
 * Tipos de habilidade F3: os lembretes das passivas dele numa faixa pequena
 * no alto da coluna do menu, logo abaixo da faixa da ordem; o menu desce a
 * altura deles (nada da vez fica por baixo; o botão REAÇÃO segue embaixo), e
 * a tira Passivas no menu da vez.
 */

export interface ConexaoDaBatalha {
  agir: (vez: VezEsperada | null, pedido: PedidoDeAcao) => boolean
  reagir: (pedido: PedidoDeReacao) => boolean
  escolherArmas: (personagemId: string, armas: readonly string[]) => boolean
  passarVez: (cartaId: string, rodada: number) => boolean
  /** "Zerar" a concentração do personagem dele. Ausente = sem o botão. */
  zerarCarga?: (personagemId: string) => boolean
  /** Tipos de habilidade F3: Ativar/Desligar a passiva e responder o lembrete. Ausente = sem a tira Passivas nem os lembretes. */
  passiva?: (pedido: PedidoDePassiva) => boolean
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
  /**
   * A faixa da troca de vez: "suaVez" (o jogador, padrão) ou "vezDe" ("Vez de
   * Lia"), para a Arena de testes, onde o mestre joga por todas as fichas e
   * toda vez seria "SUA VEZ". Com "vezDe" o menu novo entra sob a faixa (fica
   * escondido pelo palco) em vez de esperar ela sair.
   */
  textoDaVez?: 'suaVez' | 'vezDe'
}

/** A classe que o PlayerView dá à `FaixaDoJogador` (player/main.tsx). */
const CLASSE_DA_FAIXA = 'pp-batalha-faixa'
/** O vão entre os lembretes das passivas e o menu da vez, embaixo deles. */
const VAO_DOS_LEMBRETES = 10
const SEM_EFEITOS: readonly EfeitoParaJogador[] = []
const NINGUEM: readonly Personagem[] = []

/** Tipos de habilidade F2: o "+3 na reação" dos selos de quem reage, como a caixa o mostra; nenhum = ausente. */
function bonusDaReacaoDe(selos: readonly SeloQueSoma[], tokenId: string): BonusDaReacaoNaTela | undefined {
  const bonus = bonusDaBatalha(selos, tokenId)
  const partes = partesDoBonus(bonus, ALVO_DA_REACAO)
  return partes.length === 0 ? undefined : { total: bonusDaReacao(bonus), partes }
}

export function BatalhaDoJogador({ estado, efeitos = SEM_EFEITOS, meus = NINGUEM, fichas, sistema, conexao, consulta, alvoDoMapa, onMirando, onTremor, textoDaVez = 'suaVez' }: BatalhaDoJogadorProps) {
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
  // Tipos de habilidade F2: os selos do recorte (a carta extra repete os do token: conta uma vez), na forma que `bonusDaBatalha` lê.
  const selosQueSomam = useMemo(() => selosParaOBonus(estado.cartas), [estado.cartas])

  // As fichas da ordem do ponto de vista dele: os alvos da mira e o oponente da passiva.
  const alvos = useMemo(() => {
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
        // A imagem da carta na faixa: a forma, a foto do token e o retrato. O retrato só vem de
        // personagem que ele já tem (`meus`): a carta "outro" da mesa não traz `personagemId`, e na
        // Arena, onde o mestre vê tudo, o lado de lá também ganha o retrato.
        imagem: imagemDe(carta.tokenId) ?? meus.find((candidato) => candidato.id === carta.personagemId)?.retrato ?? null,
        cor: carta.equipe?.cor ?? null,
      })
    }
    return alvos
  }, [estado.cartas, nomeDe, imagemDe, meus])

  const menu = useMemo(() => {
    if (cartaQueAge === undefined) return null
    const arma = armasNaBatalha(personagem, combate)[0] ?? null
    const bonus = bonusDaBatalha(selosQueSomam, cartaQueAge.tokenId)
    const habilidades = (comAcoes: typeof acoes) => (personagem !== null && sistema !== null ? golpesDeHabilidade(personagem, sistema, combate, comAcoes, arma, bonus) : [])
    const selosDoDono = estado.cartas.find((carta) => carta.tokenId === cartaQueAge.tokenId)?.selos?.length ?? 0
    return {
      armas: golpesDeAtaque(personagem, sistema, combate, acoes, bonus),
      habilidades: habilidades(acoes),
      contra: { armas: golpesDeAtaque(personagem, sistema, combate, null, bonus), habilidades: habilidades(null) },
      alvos,
      // F3: a tira Transformação (com a prévia dos números da ficha dele).
      formas: personagem !== null && sistema !== null ? formasNoMenu(personagem, sistema, acoes) : [],
      // Tipos de habilidade F3: a tira Passivas (as ligadas vêm do recorte, `passivasAtivas`).
      passivas: passivasNoRecorte(personagem, sistema, estado.rodada, meuCombate, selosDoDono),
    }
  }, [cartaQueAge, personagem, sistema, combate, acoes, estado.cartas, estado.rodada, meuCombate, alvos, selosQueSomam])

  const contrasNoMenu = useMemo<ContraNoMenu[]>(
    () =>
      contras.map((contra) => ({
        golpeId: contra.golpeId,
        rotulo: contra.atacanteTokenId === null ? 'contra alguém fora da vista' : `contra ${nomeDe(contra.atacanteTokenId)}`,
      })),
    [contras, nomeDe],
  )

  // ---- os lembretes das passivas (Tipos de habilidade F3): os de todas as fichas dele, com o nome quando ele tem mais de uma
  const comPassiva = conexao.passiva !== undefined
  const lembretes = useMemo<LembreteNaTela[]>(() => {
    if (!comPassiva) return []
    const varios = (estado.meus?.length ?? 0) > 1
    const itens: LembreteNaTela[] = []
    for (const meu of estado.meus ?? []) {
      const primeiro = meu.lembretes?.[0]
      if (primeiro === undefined) continue
      const dele = meus.find((candidato) => candidato.id === meu.personagemId)
      const selosDoDono = estado.cartas.find((carta) => carta.tokenId === primeiro.tokenId)?.selos?.length ?? 0
      const passivas = passivasNoRecorte(dele, sistema, estado.rodada, meu, selosDoDono)
      itens.push(...lembretesNaTela(meu.lembretes, passivas, alvos, varios ? nomeDe(primeiro.tokenId) : undefined))
    }
    return itens
  }, [comPassiva, estado.meus, estado.rodada, estado.cartas, meus, sistema, alvos, nomeDe])
  // Na Arena o mestre opera tudo ("Vez de Lia"): aplica o "a cada turno" quando quiser, como na aba Batalha.
  const operaComoMestre = textoDaVez === 'vezDe'

  // ---- a reação
  const reacoes = useMemo<ReacaoNaCaixa[]>(() => {
    const variasFichas = new Set((estado.reacoes ?? []).map((reacao) => reacao.tokenId)).size > 1
    return (estado.reacoes ?? []).map((reacao) => {
      const item: ReacaoNaCaixa = { golpeId: reacao.golpeId, tokenId: reacao.tokenId, atacante: reacao.atacante === ATACANTE_FORA_DA_VISTA ? 'Alguém fora da sua vista' : reacao.atacante, nome: reacao.nome, dano: reacao.dano }
      if (variasFichas) item.alvo = nomeDe(reacao.tokenId)
      if (reacao.perfurante) item.perfurante = true
      if (reacao.perfurante && reacao.perfuracao !== undefined) item.perfuracao = reacao.perfuracao
      if (reacao.rolagem !== undefined) item.rolagem = reacao.rolagem
      const bonus = bonusDaReacaoDe(selosQueSomam, reacao.tokenId)
      if (bonus !== undefined) item.bonus = bonus
      // Tipos de habilidade F1: as técnicas de reação da ficha dele que reage (o recorte só traz alvo que reage).
      const personagemDoAlvo = estado.cartas.find((carta) => carta.tokenId === reacao.tokenId && carta.lado === 'eu')?.personagemId
      const dele = personagemDoAlvo === undefined ? undefined : meus.find((candidato) => candidato.id === personagemDoAlvo)
      if (dele !== undefined && sistema !== null) {
        const combateDele = combateDoJogador(estado.meus?.find((meu) => meu.personagemId === dele.id), null)
        item.tecnicas = reacoesParaOAlvo({ podeReagir: true, rolagem: reacao.rolagem }, dele, sistema, combateDele)
      }
      return item
    })
  }, [estado.reacoes, estado.cartas, estado.meus, meus, sistema, nomeDe, selosQueSomam])

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
  const bonusDaLivre = minhaFicha === undefined ? undefined : bonusDaReacaoDe(selosQueSomam, minhaFicha.tokenId)
  const reacoesNaCaixa: ReacaoNaCaixa[] =
    reacoes.length > 0
      ? reacoes
      : livre && minhaFicha !== undefined
        ? [{ golpeId: null, tokenId: minhaFicha.tokenId, atacante: '', nome: '', dano: null, ...(bonusDaLivre === undefined ? {} : { bonus: bonusDaLivre }) }]
        : []

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
  // Os lembretes das passivas usam a mesma medida: moram logo abaixo da faixa.
  const lugarDoMenu = useRef<HTMLDivElement>(null)
  const lugarDosLembretes = useRef<HTMLDivElement>(null)
  const comLembretes = lembretes.length > 0
  useLayoutEffect(() => {
    const menuNaTela = lugarDoMenu.current
    const avisos = lugarDosLembretes.current
    const faixa = document.querySelector<HTMLElement>(`.${CLASSE_DA_FAIXA}`)
    if ((menuNaTela === null && avisos === null) || faixa === null) return
    const medir = () => {
      const alto = `${faixa.offsetHeight}px`
      menuNaTela?.style.setProperty('--pp-faixa-alto', alto)
      avisos?.style.setProperty('--pp-faixa-alto', alto)
      // Com lembrete, o menu começa abaixo dele (e do vão): nenhum botão da vez fica por baixo.
      menuNaTela?.style.setProperty('--pp-lembretes-alto', avisos === null ? '0px' : `${avisos.offsetHeight + VAO_DOS_LEMBRETES}px`)
    }
    medir()
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    observador?.observe(faixa)
    if (avisos !== null) observador?.observe(avisos)
    return () => observador?.disconnect()
  }, [mostrarMenu, comLembretes])

  return (
    <>
      <EfeitosDaBatalha
        className="pp-batalha-efeitos"
        efeitos={efeitos}
        consulta={consulta}
        nomeDe={nomeDe}
        imagemDe={imagemDe}
        vez={
          vez === null || cartaDaVez === undefined
            ? null
            : { chave: `${vez}:${estado.rodada}`, nome: cartaDaVez.nome.trim() || nomeDe(cartaDaVez.tokenId), minha: estado.minhaVez && textoDaVez === 'suaVez' }
        }
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
            passivas={conexao.passiva === undefined || menu.passivas.length === 0 ? undefined : { itens: menu.passivas, tokenId: cartaQueAge.tokenId, sistema, onPedir: conexao.passiva }}
          />
        </div>
      )}
      {comLembretes && conexao.passiva !== undefined && (
        <div ref={lugarDosLembretes} className="pp-batalha-lembretes" data-palco={noPalco}>
          <LembretesDaPassiva itens={lembretes} sistema={sistema} aplicarLivre={operaComoMestre} onPedir={conexao.passiva} />
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
