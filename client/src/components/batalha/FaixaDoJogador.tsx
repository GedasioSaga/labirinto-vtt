import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { PedidoDePassiva } from '../../lib/batalha/combate'
import type { EstadoParaJogador } from '../../lib/batalha/vistaDoJogador'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { faixaDoJogador, linhasDoJogador, type DadosDaCarta, type FichaNaFaixa } from './dadosDaFaixa'
import { DarDanoDialog } from './DarDanoDialog'
import { FaixaDaOrdem } from './FaixaDaOrdem'
import { JanelaDaBatalha } from './JanelaDaBatalha'
import type { ItemDoMenuDaCarta } from './MenuDaCarta'
import { PassivasDaFicha, passivasNoRecorte, type AlvoDaPassiva } from './PassivasDaBatalha'
import { PerfilDaCarta } from './PerfilDaCarta'

/**
 * A FAIXA DA ORDEM na tela do JOGADOR: o `batalha.estado` que o host recortou
 * para ele, com a vida dele e a dos aliados (`batalha.aliados`). "Passar a
 * vez" só aparece na vez dele; o Desfazer, só nas linhas dele durante a vez
 * dele (o host decide com `podeDesfazer`). Clicar na carta de aliado abre o
 * perfil, só leitura; na própria, a ficha de sempre; na de NPC ou de outra
 * equipe, nada.
 *
 * Tipos de habilidade F3: na carta dele, "Passivas (N)…" abre a lista das
 * passivas dele (Ativar/Desligar a qualquer hora, fora da vez, sem gastar
 * ação); o menu da vez só existe na vez dele.
 *
 * Os pedidos vão ao host; o resultado chega no próximo `batalha.estado`.
 * Enquanto não chega, o botão diz "Passando…" e o Desfazer, "Desfazendo…"
 * (com prazo, para um pedido recusado não prender o botão).
 */

export interface FaixaDoJogadorProps {
  estado: EstadoParaJogador
  /** Os personagens dele (`state.personagens`); ausente = a sala não serve fichas. */
  meus?: readonly Personagem[]
  /** Os personagens dos aliados (`state.aliados`); ausente = ainda não chegaram (ou sem equipe). */
  aliados?: readonly Personagem[]
  /** As fichas do mapa dele (só a foto pequena atravessa o recorte). */
  fichas: readonly FichaNaFaixa[]
  sistema: SistemaDeRpg | null
  /** `false` = o pedido não saiu (sem conexão, teto de pedidos). */
  onPassarVez: (cartaId: string, rodada: number) => boolean
  onDesfazer: (linhaId: string) => boolean
  /** A carta dele abre a ficha de sempre (o botão "Ficha"); ausente = a sala não serve fichas e a carta dele não abre nada. */
  onAbrirMinhaFicha?: () => void
  /** F2: "Me dar dano" na carta dele (dano livre, vai ao registro). `false` = não saiu. Ausente = sem o item. */
  onMeDarDano?: (tokenId: string, valor: number) => boolean
  /** "Zerar a concentração" na carta dele, a qualquer hora (só com carga). `false` = não saiu. Ausente = sem o item. */
  onZerarMinhaCarga?: (personagemId: string) => boolean
  /** Tipos de habilidade F3: Ativar/Desligar a passiva da ficha dele. `false` = não saiu. Ausente = sem o item "Passivas". */
  onPassiva?: (pedido: PedidoDePassiva) => boolean
  className?: string
}

/** A variável que diz quanto o canto da direita do jogador come do alto da tela (player.css). */
const CANTO_OCUPA_VAR = '--pp-canto-ocupa'

/**
 * O canto da direita do jogador (`.pp-canto`: abas de andar, "Onde estou",
 * "Tela acesa") só come o alto da tela até a peça mais larga NA ALTURA DA
 * FAIXA; as rolagens moram no pé e não contam. Mede essa largura e põe na
 * raiz (`--pp-canto-ocupa`), para a faixa da ordem usar o vão de verdade: a
 * reserva fixa de 300 px deixava a 4ª carta rolando com o painel aberto.
 */
function useCantoOcupa(className: string | undefined) {
  useLayoutEffect(() => {
    const canto = document.querySelector<HTMLElement>('.pp-canto')
    if (canto === null || className === undefined) return
    const raiz = document.documentElement
    // A caixa das rolagens estica até o alto da coluna, mas a lista mora no pé dela e
    // cresce para cima: conta a lista (quando sobe até a faixa), não a caixa.
    const pecas = () => Array.from(canto.children).flatMap((peca) => (peca.classList.contains('pp-rolagens') ? Array.from(peca.querySelectorAll('.pp-dice-feed')) : [peca]))
    const medir = () => {
      const faixa = document.querySelector<HTMLElement>(`.${className.split(' ')[0]}`)
      const fundo = faixa === null ? Number.POSITIVE_INFINITY : faixa.getBoundingClientRect().bottom
      let esquerda = window.innerWidth
      for (const peca of pecas()) {
        const caixa = peca.getBoundingClientRect()
        if (caixa.width > 0 && caixa.height > 0 && caixa.top < fundo) esquerda = Math.min(esquerda, caixa.left)
      }
      raiz.style.setProperty(CANTO_OCUPA_VAR, `${Math.ceil(window.innerWidth - esquerda)}px`)
    }
    const tamanho = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    const vigiar = () => {
      tamanho?.disconnect()
      tamanho?.observe(canto)
      for (const peca of pecas()) tamanho?.observe(peca)
      medir()
    }
    // Aba de andar que chega ou sai, a lista de rolagens que nasce: vigia a peça nova.
    const filhos = typeof MutationObserver === 'undefined' ? null : new MutationObserver(vigiar)
    filhos?.observe(canto, { childList: true, subtree: true })
    window.addEventListener('resize', medir)
    vigiar()
    return () => {
      tamanho?.disconnect()
      filhos?.disconnect()
      window.removeEventListener('resize', medir)
      raiz.style.removeProperty(CANTO_OCUPA_VAR)
    }
  }, [className])
}

/** Sem resposta do host neste prazo, o botão volta (o pedido foi recusado ou se perdeu). */
const PRAZO_DO_PEDIDO_MS = 4000
const NINGUEM: readonly Personagem[] = []

export function FaixaDoJogador({ estado, meus = NINGUEM, aliados = NINGUEM, fichas, sistema, onPassarVez, onDesfazer, onAbrirMinhaFicha, onMeDarDano, onZerarMinhaCarga, onPassiva, className }: FaixaDoJogadorProps) {
  const [danoEm, setDanoEm] = useState<DadosDaCarta | null>(null)
  const [passivasEm, setPassivasEm] = useState<DadosDaCarta | null>(null)
  const personagens = useMemo(() => [...meus, ...aliados], [meus, aliados])
  const dados = useMemo(() => faixaDoJogador({ estado, fichas, personagens, sistema }), [estado, fichas, personagens, sistema])
  const registro = useMemo(() => linhasDoJogador(estado.registro), [estado.registro])
  const [perfilId, setPerfilId] = useState<string | null>(null)

  // "Passar a vez" pedido para ESTA vez: some sozinho quando a vez anda (ou no prazo).
  const chaveDaVez = `${estado.vez ?? ''}:${estado.rodada}`
  const [passouEm, setPassouEm] = useState<string | null>(null)
  useEffect(() => {
    if (passouEm === null) return
    const prazo = window.setTimeout(() => setPassouEm(null), PRAZO_DO_PEDIDO_MS)
    return () => window.clearTimeout(prazo)
  }, [passouEm])
  const passando = passouEm === chaveDaVez

  const [pendentes, setPendentes] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    if (pendentes.size === 0) return
    const prazo = window.setTimeout(() => setPendentes(new Set()), PRAZO_DO_PEDIDO_MS)
    return () => window.clearTimeout(prazo)
  }, [pendentes])
  // A linha que chegou riscada sai dos pendentes.
  const pendentesValendo = useMemo(() => new Set([...pendentes].filter((id) => registro.some((linha) => linha.id === id && linha.desfeitaPor === null))), [pendentes, registro])

  // O perfil aberto de quem deixou de ser aliado (o mestre trocou de equipe) fecha.
  const perfil = perfilId === null ? undefined : aliados.find((personagem) => personagem.id === perfilId)
  useEffect(() => {
    if (perfilId !== null && perfil === undefined) setPerfilId(null)
  }, [perfilId, perfil])

  // A própria abre a ficha (se a sala serve fichas); a de aliado, o perfil só se o personagem dele chegou.
  const abre = (carta: DadosDaCarta) => (carta.minha ? onAbrirMinhaFicha !== undefined : aliados.some((personagem) => personagem.id === carta.personagemId))
  const abrir = (carta: DadosDaCarta) => {
    if (carta.minha) onAbrirMinhaFicha?.()
    else if (carta.personagemId !== null) setPerfilId(carta.personagemId)
  }

  useCantoOcupa(className)

  const vez = estado.vez
  const daCarta = perfil === undefined ? undefined : dados.cartas.find((carta) => carta.personagemId === perfil.id)

  // Tipos de habilidade F3: as passivas da ficha dele, pelo recorte (as ligadas em `passivasAtivas`).
  const passivasDaCarta = (carta: DadosDaCarta) => {
    const personagem = carta.personagemId === null ? undefined : meus.find((candidato) => candidato.id === carta.personagemId)
    const combate = estado.meus?.find((meu) => meu.personagemId === carta.personagemId)
    return passivasNoRecorte(personagem, sistema, estado.rodada, combate, carta.selos?.length ?? 0)
  }
  const alvosDasPassivas = useMemo(() => {
    const vistos = new Set<string>()
    const alvos: AlvoDaPassiva[] = []
    for (const carta of estado.cartas) {
      if (vistos.has(carta.tokenId)) continue
      vistos.add(carta.tokenId)
      alvos.push({ tokenId: carta.tokenId, nome: carta.nome.trim() || fichas.find((ficha) => ficha.id === carta.tokenId)?.name.trim() || 'Ficha', lado: carta.lado })
    }
    return alvos
  }, [estado.cartas, fichas])
  const cartaDasPassivas = passivasEm === null ? undefined : dados.cartas.find((carta) => carta.tokenId === passivasEm.tokenId && carta.minha)
  const passivasAbertas = cartaDasPassivas === undefined ? [] : passivasDaCarta(cartaDasPassivas)

  return (
    <>
      <FaixaDaOrdem
        papel="jogador"
        className={className}
        dados={dados}
        onAbrirPerfil={abrir}
        abrePerfil={abre}
        menuDaCarta={
          onMeDarDano === undefined && onPassiva === undefined
            ? undefined
            : (carta): ItemDoMenuDaCarta[] => {
                if (!carta.minha) return []
                const itens: ItemDoMenuDaCarta[] = []
                if (onAbrirMinhaFicha !== undefined) itens.push({ id: 'ficha', rotulo: 'Abrir a minha ficha', onEscolher: onAbrirMinhaFicha })
                // Tipos de habilidade F3: só com passiva na ficha.
                const passivas = onPassiva === undefined ? [] : passivasDaCarta(carta)
                if (passivas.length > 0) {
                  const ativas = passivas.filter((passiva) => passiva.estado === 'ativa').length
                  itens.push({
                    id: 'passivas',
                    rotulo: `Passivas (${passivas.length})…`,
                    detalhe: ativas > 0 ? `${ativas === 1 ? '1 ativa' : `${ativas} ativas`} · ativar e desligar sem gastar ação` : 'Ativar e desligar a qualquer hora, sem gastar ação',
                    onEscolher: () => setPassivasEm(carta),
                  })
                }
                if (onMeDarDano !== undefined) itens.push({ id: 'dano', rotulo: 'Me dar dano…', detalhe: 'Dano livre na sua ficha; vai ao registro', onEscolher: () => setDanoEm(carta) })
                const { personagemId } = carta
                // Fora da vez também: ele perde a concentração ao tomar o golpe.
                if (onZerarMinhaCarga !== undefined && personagemId !== null && (carta.carga ?? 0) > 0)
                  itens.push({
                    id: 'zerar-carga',
                    rotulo: `Zerar a concentração (carga ${carta.carga ?? 0})`,
                    detalhe: 'Volta a 0; a ação gasta não volta. Vai ao registro',
                    onEscolher: () => onZerarMinhaCarga(personagemId),
                  })
                return itens
              }
        }
        onPassarVez={
          estado.minhaVez && vez !== null
            ? () => {
                if (passando) return
                if (onPassarVez(vez, estado.rodada)) setPassouEm(chaveDaVez)
              }
            : undefined
        }
        passandoVez={passando}
        regras={estado.regras}
        registro={registro}
        onDesfazer={(linhaId) => {
          if (pendentesValendo.has(linhaId)) return
          if (onDesfazer(linhaId)) setPendentes((antes) => new Set([...antes, linhaId]))
        }}
        pendentes={pendentesValendo}
      />
      {perfil !== undefined && (
        <PerfilDaCarta
          personagem={perfil}
          sistema={sistema}
          descricao={[daCarta?.equipe, 'aliado', 'só leitura'].filter(Boolean).join(' · ')}
          imagemDaForma={daCarta === undefined ? null : (estado.aparencias?.[daCarta.tokenId] ?? null)}
          onFechar={() => setPerfilId(null)}
        />
      )}
      {cartaDasPassivas !== undefined && onPassiva !== undefined && (
        <JanelaDaBatalha titulo={`Passivas de ${cartaDasPassivas.nome || 'você'}`} descricao="Fora da vez, sem gastar ação. Desfazer na linha do registro volta tudo." onFechar={() => setPassivasEm(null)}>
          <PassivasDaFicha passivas={passivasAbertas} tokenId={cartaDasPassivas.tokenId} alvos={alvosDasPassivas} sistema={sistema} onPedir={onPassiva} mostrarVazio />
        </JanelaDaBatalha>
      )}
      {danoEm !== null && onMeDarDano !== undefined && (
        <DarDanoDialog titulo="Me dar dano" alvos={[{ tokenId: danoEm.tokenId, nome: danoEm.nome }]} onConfirmar={onMeDarDano} onFechar={() => setDanoEm(null)} />
      )}
    </>
  )
}
