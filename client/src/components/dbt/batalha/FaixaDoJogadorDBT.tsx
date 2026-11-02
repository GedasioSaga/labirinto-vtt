import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { VistaDBT } from '../../../lib/dbt/batalha/vista'
import type { Personagem } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { PerfilDaCarta } from '../../batalha/PerfilDaCarta'
import type { EnvioDaBatalhaDBT, RespostaDoEnvioDBT } from './BatalhaDoJogadorDBT'
import { faixaDoJogadorDBT, type CartaNaFaixaDBT, type FichaNaFaixaDBT } from './dadosDaFaixaDBT'
import { FaixaDaOrdemDBT } from './FaixaDaOrdemDBT'
import { linhasDoJogadorDBT } from './RegistroDBT'

/**
 * A FAIXA DA ORDEM DBT na tela do JOGADOR (seção 18, `player/main.tsx:1698`):
 * o recorte do host (`batalhaDBT.estado`), com PV e Ki só dele e dos aliados;
 * NPC e outro lado mostram "PV e Ki ocultos". "Passar a vez" só na vez dele;
 * o Desfazer, só na linha que o host deixa (`podeDesfazer`). Clicar na carta
 * dele abre o perfil só leitura (`quemOlha="jogador"`); a de aliado abre
 * quando o recorte trouxer o personagem dela.
 *
 * Os pedidos vão ao host com o mesmo `enviar` da `BatalhaDoJogadorDBT`;
 * enquanto a resposta não chega, o botão diz "Passando…" e o Desfazer,
 * "Desfazendo…" (com prazo, para um pedido perdido não prender o botão).
 */

export interface FaixaDoJogadorDBTProps {
  /** O recorte do host; desmonte quando ele vira null. */
  vista: VistaDBT
  /** O mesmo envio da `BatalhaDoJogadorDBT` (só `passar` e `desfazer` são usados aqui). */
  enviar: Pick<EnvioDaBatalhaDBT, 'passar' | 'desfazer'>
  /** Os personagens dele (`state.personagens?.personagens`): o perfil e o retrato da carta dele. */
  meus?: readonly Personagem[]
  /** As fichas do mapa dele (só a foto pequena atravessa o recorte). */
  fichas: readonly FichaNaFaixaDBT[]
  sistema: SistemaDeRpg | null
  /** A última recusa do host, quando o envio não devolve resposta. */
  recusa?: string | null
  /** `pp-batalha-faixa` no jogador: o lugar no alto da tela (player.css). */
  className?: string
}

/** Sem resposta do host neste prazo, o botão volta (o pedido foi recusado ou se perdeu). */
const PRAZO_DO_PEDIDO_MS = 4000
const NINGUEM: readonly Personagem[] = []
/** A variável que diz quanto o canto da direita do jogador come do alto da tela (player.css). */
const CANTO_OCUPA_VAR = '--pp-canto-ocupa'

/**
 * O canto da direita do jogador (`.pp-canto`) só come o alto da tela até a
 * peça mais larga NA ALTURA DA FAIXA; as rolagens moram no pé e não contam.
 * Mede essa largura e põe na raiz, como a faixa do One Piece faz: sem isso a
 * reserva fixa de 288 px deixa a 4ª carta rolando com o painel aberto.
 */
function useCantoOcupa(className: string | undefined) {
  useLayoutEffect(() => {
    const canto = document.querySelector<HTMLElement>('.pp-canto')
    if (canto === null || className === undefined) return
    const raiz = document.documentElement
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

/** Espera a resposta do host; `null` = saiu sem recusa (sem resposta conta como saiu). */
async function recusaDe(fazer: () => RespostaDoEnvioDBT | Promise<RespostaDoEnvioDBT>): Promise<string | null> {
  try {
    const resposta = await fazer()
    return resposta !== undefined && !resposta.ok ? (resposta.motivo ?? 'O mestre recusou o pedido.') : null
  } catch {
    return 'Sem conexão com o mestre. Tente de novo.'
  }
}

export function FaixaDoJogadorDBT({ vista, enviar, meus = NINGUEM, fichas, sistema, recusa = null, className }: FaixaDoJogadorDBTProps) {
  // Só abre o que ele tem: o host manda o personagem só nas cartas "eu" e "aliado"; a do aliado abre quando a ficha dele está em `meus`.
  const dados = useMemo(() => {
    const base = faixaDoJogadorDBT({ vista, fichas, meus })
    const temPerfil = (personagemId: string | null) => personagemId !== null && meus.some((personagem) => personagem.id === personagemId)
    return { ...base, cartas: base.cartas.map((carta) => (temPerfil(carta.personagemId) ? carta : { ...carta, personagemId: null })) }
  }, [vista, fichas, meus])
  const registro = useMemo(() => linhasDoJogadorDBT(vista.registro), [vista.registro])
  const [perfilId, setPerfilId] = useState<string | null>(null)
  const [minhaRecusa, setMinhaRecusa] = useState<string | null>(null)

  // "Passar a vez" pedido para ESTA vez: some sozinho quando a vez anda (ou no prazo).
  const chaveDaVez = `${vista.vez ?? ''}:${vista.rodada}:${vista.turno.n}`
  const [passouEm, setPassouEm] = useState<string | null>(null)
  useEffect(() => {
    if (passouEm === null) return
    const prazo = window.setTimeout(() => setPassouEm(null), PRAZO_DO_PEDIDO_MS)
    return () => window.clearTimeout(prazo)
  }, [passouEm])
  const passando = passouEm === chaveDaVez

  // O Desfazer pedido: some quando a linha chega riscada (ou no prazo).
  const [desfazendo, setDesfazendo] = useState<string | null>(null)
  useEffect(() => {
    if (desfazendo === null) return
    const prazo = window.setTimeout(() => setDesfazendo(null), PRAZO_DO_PEDIDO_MS)
    return () => window.clearTimeout(prazo)
  }, [desfazendo])
  const desfazendoValendo = desfazendo !== null && registro.some((linha) => linha.id === desfazendo && !linha.desfeita) ? desfazendo : null

  // A recusa dele some quando a vez anda.
  useEffect(() => setMinhaRecusa(null), [chaveDaVez])

  // O perfil de quem saiu do recorte fecha.
  const perfil = perfilId === null ? undefined : meus.find((personagem) => personagem.id === perfilId)
  useEffect(() => {
    if (perfilId !== null && perfil === undefined) setPerfilId(null)
  }, [perfilId, perfil])

  useCantoOcupa(className)

  const daVez = vista.minhaVez ? vista.meus.find((meu) => meu.tokenId === vista.vez && meu.vez !== null) : undefined
  const passar = () => {
    if (daVez === undefined || daVez.vez === null || passando) return
    const pedido = { combatenteId: daVez.tokenId, rodada: daVez.vez.rodada, turno: daVez.vez.turno }
    setPassouEm(chaveDaVez)
    void recusaDe(() => enviar.passar(pedido)).then((motivo) => {
      if (motivo === null) return
      setMinhaRecusa(motivo)
      setPassouEm(null)
    })
  }
  const desfazer = (linhaId: string) => {
    if (desfazendoValendo !== null) return
    setDesfazendo(linhaId)
    void recusaDe(() => enviar.desfazer(linhaId)).then((motivo) => {
      if (motivo === null) return
      setMinhaRecusa(motivo)
      setDesfazendo(null)
    })
  }
  const abrirPerfil = (carta: CartaNaFaixaDBT) => {
    if (carta.personagemId !== null) setPerfilId(carta.personagemId)
  }
  const cartaDoPerfil = perfil === undefined ? undefined : dados.cartas.find((carta) => carta.personagemId === perfil.id)

  return (
    <>
      <FaixaDaOrdemDBT
        papel="jogador"
        className={className}
        dados={dados}
        onAbrirPerfil={abrirPerfil}
        onPassarVez={daVez === undefined ? undefined : passar}
        passandoVez={passando}
        registro={registro}
        onDesfazer={desfazer}
        desfazendo={desfazendoValendo}
        aviso={minhaRecusa ?? recusa}
      />
      {perfil !== undefined && (
        <PerfilDaCarta
          personagem={perfil}
          sistema={sistema}
          descricao={[cartaDoPerfil?.transformacao ?? undefined, cartaDoPerfil?.minha === false ? 'aliado' : 'você', 'só leitura'].filter(Boolean).join(' · ')}
          quemOlha="jogador"
          onFechar={() => setPerfilId(null)}
        />
      )}
    </>
  )
}
