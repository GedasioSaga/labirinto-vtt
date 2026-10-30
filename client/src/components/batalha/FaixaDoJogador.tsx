import { useEffect, useMemo, useState } from 'react'
import type { EstadoParaJogador } from '../../lib/batalha/vistaDoJogador'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { faixaDoJogador, linhasDoJogador, type DadosDaCarta, type FichaNaFaixa } from './dadosDaFaixa'
import { FaixaDaOrdem } from './FaixaDaOrdem'
import { PerfilDaCarta } from './PerfilDaCarta'

/**
 * A FAIXA DA ORDEM na tela do JOGADOR: o `batalha.estado` que o host recortou
 * para ele, com a vida dele e a dos aliados (`batalha.aliados`). "Passar a
 * vez" só aparece na vez dele; o Desfazer, só nas linhas dele durante a vez
 * dele (o host decide com `podeDesfazer`). Clicar na carta de aliado abre o
 * perfil, só leitura; na própria, a ficha de sempre; na de NPC ou de outra
 * equipe, nada.
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
  className?: string
}

/** Sem resposta do host neste prazo, o botão volta (o pedido foi recusado ou se perdeu). */
const PRAZO_DO_PEDIDO_MS = 4000
const NINGUEM: readonly Personagem[] = []

export function FaixaDoJogador({ estado, meus = NINGUEM, aliados = NINGUEM, fichas, sistema, onPassarVez, onDesfazer, onAbrirMinhaFicha, className }: FaixaDoJogadorProps) {
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

  const vez = estado.vez
  const daCarta = perfil === undefined ? undefined : dados.cartas.find((carta) => carta.personagemId === perfil.id)

  return (
    <>
      <FaixaDaOrdem
        papel="jogador"
        className={className}
        dados={dados}
        onAbrirPerfil={abrir}
        abrePerfil={abre}
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
          onFechar={() => setPerfilId(null)}
        />
      )}
    </>
  )
}
