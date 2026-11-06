import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { NOME_DA_CONTA_MAX, PIN_MAX_DIGITOS, PIN_MIN_DIGITOS, pinValido, type ContaDeJogador } from '../../lib/contasDosJogadores'
import type { PastaDeMapas, RpgDaPasta } from '../../lib/pastasDeMapas'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import type { CampanhaPublicada } from '../../net/nuvem/estadoNoDisco'
import { useContasStore } from '../../stores/contasStore'
import { useNuvemStore, type CampanhaNoApp } from '../../stores/nuvemStore'
import { useToastStore } from '../../stores/toastStore'
import { ContaNaNuvem, type EstadoDaConta } from './ContaNaNuvem'
import { problemaDoEmail, reenviarContasAtuais, trocarEmailDaConta } from './contasNoLobby'
import { IndicadorDoLobby } from './IndicadorDoLobby'
import { MudancasParaDecidir } from './MudancasParaDecidir'
import { bloqueioDoDragonBall, dragonBallNaPasta, fichasComOBloco, fichasQueSobem, publicarPasta, type EnvioDosMembros, type Publicacao } from './ponteDoLobby'
import { contaComOMesmoEmail, emailRepetidoParado, iniciais, listaDeNomes, recadoDeConvite } from './textosDoLobby'
import { SEM_DONO, useArrastoDaFicha } from './useArrastoDaFicha'
import { usePastaPublicada } from './usePastaPublicada'
import './lobby.css'

/**
 * "JOGADORES DO LOBBY", a aba nova do Configurar pasta (docs/planos/lobby-jogadores-2026-11-05.md
 * §8.1 A6 e a última linha da §12; protótipo aprovado em
 * docs/design/lobby/prototipo-mestre.html, vista "No app"): publicar a pasta,
 * quem entra no site (a conta do app com o e-mail Google) e de quem é cada
 * ficha. "Sem dono": só o mestre edita, os colegas veem (12.6).
 *
 * Como no protótipo: a ficha vai ao jogador pelo "Dono" do cartão ou
 * arrastada até a linha dele (`useArrastoDaFicha`); trocar o dono e tirar do
 * Lobby avisam com Desfazer, e o Ctrl+Z da aba volta a última dessas duas.
 * Desvio até a W4: a linha diz "Convite feito, aguardando o primeiro acesso"
 * (sem o "Convidado/Convidada" do protótipo, porque a conta do app não guarda
 * o gênero), e o app ainda não sabe quem já entrou; o e-mail só deixa entrar
 * depois que o mestre o põe também no grupo do Access.
 */

/** Quantas mudanças o Ctrl+Z da aba ainda volta. */
const PILHA_DO_DESFAZER_MAX = 20
/** Quanto a ficha que acabou de trocar de dono fica marcada para entrar com movimento na lista nova. */
const CHEGADA_MS = 400

interface EntradaDoDesfazer {
  desfazer: () => void
  /** O aviso com o botão Desfazer: sai da tela quando o Ctrl+Z desfaz por ele. */
  avisoId: string | null
}

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

export interface JogadoresDoLobbyProps {
  pasta: PastaDeMapas
  rpg: RpgDaPasta
  sistema: SistemaDeRpg | undefined
  /** A mudança no RPG da pasta pelo funil de sempre (`editarRpgDaPasta`): o dono que muda vira op do mestre. */
  onMudar: (mudar: (rpg: RpgDaPasta) => RpgDaPasta) => Promise<void>
}

type Envio = { t: 'enviando' } | { t: 'falhou'; mensagem: string }

/** O que a linha do jogador diz: a pastilha mostra o estado, o texto ao lado diz o porquê. */
type Situacao = 'sem-email' | 'repetido' | 'enviando' | 'falhou' | 'convidado' | 'guardado'

// Nenhum texto promete a entrada: até a W4, quem libera o e-mail no Access é o mestre, à mão.
const TEXTO_DA_SITUACAO: Readonly<Record<Situacao, { marca: string; mais: string | null }>> = {
  'sem-email': { marca: 'Sem e-mail', mais: 'não entra no site' },
  repetido: { marca: 'E-mail repetido', mais: 'não entra até trocar' },
  enviando: { marca: 'Enviando ao Lobby…', mais: null },
  falhou: { marca: 'Não deu: tente de novo', mais: null },
  convidado: { marca: 'Convite feito', mais: 'aguardando o primeiro acesso' },
  guardado: { marca: 'E-mail guardado', mais: 'vai junto quando a pasta for publicada' },
}

function comDono(ficha: Personagem, contaId: string | null): Personagem {
  if (contaId !== null) return { ...ficha, dono: contaId }
  const copia = { ...ficha }
  delete copia.dono
  return copia
}

function soDigitos(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, PIN_MAX_DIGITOS)
}

/** "Bia Souza" a partir de "bia.souza@example.com": só sugestão, o mestre troca. */
function nomeDoEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase() + parte.slice(1))
    .join(' ')
    .slice(0, NOME_DA_CONTA_MAX)
}

export function JogadoresDoLobby({ pasta, rpg, sistema, onMudar }: JogadoresDoLobbyProps) {
  const contas = useContasStore((state) => state.arquivo.contas)
  const podeGravarContas = useContasStore((state) => state.podeGravar)
  const avisoDasContas = useContasStore((state) => state.aviso)
  const contasLidas = useContasStore((state) => state.lidas)
  const { publicada, campanhaLigada, marcarPublicada } = usePastaPublicada(pasta.id)
  const falhaAoLigar = useNuvemStore((state) => state.falhaAoLigar)
  const [conta, setConta] = useState<EstadoDaConta>({ t: 'carregando' })
  const [envios, setEnvios] = useState<Readonly<Record<string, Envio>>>({})
  const [emailAberto, setEmailAberto] = useState<string | null>(null)
  const [erroDoDono, setErroDoDono] = useState<string | null>(null)
  const [chegou, setChegou] = useState<string | null>(null)
  const raiz = useRef<HTMLDivElement>(null)
  const pilha = useRef<EntradaDoDesfazer[]>([])

  useEffect(() => {
    void useContasStore.getState().carregar()
  }, [])

  useEffect(() => {
    if (chegou === null) return
    const espera = setTimeout(() => setChegou(null), CHEGADA_MS)
    return () => clearTimeout(espera)
  }, [chegou])

  const fichas = fichasQueSobem(rpg.personagens)
  const idsDasContas = new Set(contas.map((candidata) => candidata.id))
  const donoDe = (ficha: Personagem): string | null => (ficha.dono !== undefined && idsDasContas.has(ficha.dono) ? ficha.dono : null)
  const semDono = fichas.filter((ficha) => donoDe(ficha) === null)
  const nomeDaConta = (contaId: string): string => contas.find((candidata) => candidata.id === contaId)?.nome ?? 'outro jogador'

  // ── Desfazer: o botão do aviso e o Ctrl+Z da aba voltam a mesma entrada, uma vez só ──

  const rodarDesfazer = (entrada: EntradaDoDesfazer) => {
    const indice = pilha.current.indexOf(entrada)
    if (indice < 0) return
    pilha.current = pilha.current.filter((outra) => outra !== entrada)
    if (entrada.avisoId !== null) useToastStore.getState().dismiss(entrada.avisoId)
    entrada.desfazer()
  }

  const avisarComDesfazer = (texto: string, desfazer: () => void) => {
    const entrada: EntradaDoDesfazer = { desfazer, avisoId: null }
    pilha.current = [...pilha.current, entrada].slice(-PILHA_DO_DESFAZER_MAX)
    entrada.avisoId = useToastStore.getState().push('info', texto, undefined, { actions: [{ label: 'Desfazer', run: () => rodarDesfazer(entrada) }] })
  }

  const desfazerPeloTeclado = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return
    // No campo de texto, o Ctrl+Z é da digitação.
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    const ultima = pilha.current[pilha.current.length - 1]
    if (ultima === undefined) return
    event.preventDefault()
    rodarDesfazer(ultima)
  }

  /**
   * Muda o dono só se a ficha ainda estiver com `esperado` (a ficha pode ter
   * mudado por outro caminho entre o clique e a gravação, ou entre a troca e
   * o Desfazer); `false` = não estava, e nada mudou.
   */
  const mudarDono = async (fichaId: string, contaId: string | null, esperado: string | null): Promise<boolean> => {
    const visto: { confere: boolean | null } = { confere: null }
    await onMudar((atual) => {
      const ids = new Set(useContasStore.getState().arquivo.contas.map((candidata) => candidata.id))
      const ficha = atual.personagens.find((candidata) => candidata.id === fichaId)
      const agora = ficha?.dono !== undefined && ids.has(ficha.dono) ? ficha.dono : null
      const confere = ficha !== undefined && agora === esperado
      // O funil chama a mudança mais de uma vez (o disco, a prévia, a cópia aberta): vale o que a primeira, a do disco, viu.
      if (visto.confere === null) visto.confere = confere
      return confere ? { ...atual, personagens: atual.personagens.map((candidata) => (candidata.id === fichaId ? comDono(candidata, contaId) : candidata)) } : atual
    })
    return visto.confere === true
  }

  const desfazerDono = async (nome: string, fichaId: string, depois: string | null, antes: string | null, nomeAntes: string | null) => {
    const toasts = useToastStore.getState()
    try {
      if (!(await mudarDono(fichaId, antes, depois))) {
        toasts.push('error', `Não deu para desfazer: o dono de ${nome} mudou depois.`)
        return
      }
    } catch (erro) {
      toasts.push('error', `Não deu para desfazer: ${mensagemDe(erro)}`)
      return
    }
    setChegou(fichaId)
    toasts.push('info', `Desfeito: ${nome} voltou ${nomeAntes === null ? 'para Sem dono' : `para ${nomeAntes}`}.`)
  }

  const desfazerTirar = async (contaId: string, nome: string, email: string) => {
    const toasts = useToastStore.getState()
    const agora = useContasStore.getState().arquivo.contas
    const alvo = agora.find((candidata) => candidata.id === contaId)
    if (alvo === undefined || alvo.email !== undefined) {
      toasts.push('error', `Não deu para desfazer: a conta de ${nome} mudou depois.`)
      return
    }
    const problema = problemaDoEmail(agora, contaId, email)
    if (problema !== null) {
      toasts.push('error', `Não deu para desfazer: ${problema}`)
      return
    }
    try {
      await comEnvio([contaId], () => trocarEmailDaConta(contaId, email))
    } catch (erro) {
      toasts.push('error', `Não deu para desfazer: ${mensagemDe(erro)}`)
      return
    }
    toasts.push('info', `Desfeito: ${nome} voltou ao Lobby.`)
  }

  const aoTirar = (alvo: ContaDeJogador, email: string) => {
    const dele = fichas.filter((ficha) => ficha.dono === alvo.id).map((ficha) => ficha.nome)
    const resto = dele.length === 0 ? '' : ` ${listaDeNomes(dele)} ${dele.length === 1 ? 'fica' : 'ficam'} sem quem edite pelo site.`
    avisarComDesfazer(`${alvo.nome} saiu do Lobby.${resto}`, () => void desfazerTirar(alvo.id, alvo.nome, email))
  }

  /** Roda o envio da lista de jogadores e marca as linhas tocadas enquanto ele vai. */
  const comEnvio = async (contaIds: readonly string[], enviar: () => Promise<EnvioDosMembros>) => {
    setEnvios((antes) => ({ ...antes, ...Object.fromEntries(contaIds.map((contaId): [string, Envio] => [contaId, { t: 'enviando' }])) }))
    let resultado: EnvioDosMembros
    try {
      resultado = await enviar()
    } catch (erro) {
      setEnvios((antes) => {
        const resto = { ...antes }
        for (const contaId of contaIds) delete resto[contaId]
        return resto
      })
      throw erro
    }
    const { falha } = resultado
    setEnvios((antes) => {
      const resto = { ...antes }
      for (const contaId of contaIds) {
        if (falha === null) delete resto[contaId]
        else resto[contaId] = { t: 'falhou', mensagem: falha.mensagem }
      }
      return resto
    })
  }

  const situacaoDe = (alvo: ContaDeJogador): Situacao => {
    const envio = envios[alvo.id]
    if (envio !== undefined) return envio.t
    if (alvo.email === undefined) return 'sem-email'
    if (emailRepetidoParado(contas, alvo)) return 'repetido'
    return publicada ? 'convidado' : 'guardado'
  }

  /** O "Dono" do cartão e o arrasto chegam aqui: troca, marca a chegada e avisa com Desfazer. */
  const trocarDono = async (fichaId: string, contaId: string | null) => {
    setErroDoDono(null)
    const ficha = rpg.personagens.find((candidata) => candidata.id === fichaId)
    if (ficha === undefined) return
    const antes = donoDe(ficha)
    if (antes === contaId) return
    try {
      if (!(await mudarDono(fichaId, contaId, antes))) {
        setErroDoDono(`O dono de ${ficha.nome} mudou enquanto você escolhia. Confira o quadro e escolha de novo.`)
        return
      }
    } catch (erro) {
      setErroDoDono(mensagemDe(erro))
      return
    }
    setChegou(fichaId)
    const nomeAntes = antes === null ? null : nomeDaConta(antes)
    avisarComDesfazer(contaId === null ? `${ficha.nome} ficou sem dono: só você edita.` : `${ficha.nome} agora é de ${nomeDaConta(contaId)}.`, () => void desfazerDono(ficha.nome, fichaId, contaId, antes, nomeAntes))
  }

  const arrasto = useArrastoDaFicha(
    raiz,
    (fichaId) => {
      const ficha = fichas.find((candidata) => candidata.id === fichaId)
      return (ficha === undefined ? null : donoDe(ficha)) ?? SEM_DONO
    },
    (fichaId, alvo) => trocarDono(fichaId, alvo === SEM_DONO ? null : alvo),
  )

  /** O que a vaga diz, na pausa antes de soltar, onde o papel vai cair. */
  const vagaEm = (alvo: string): string | null => {
    const { sobre } = arrasto
    if (sobre === null || sobre.alvo !== alvo) return null
    const ficha = fichas.find((candidata) => candidata.id === sobre.fichaId)
    if (ficha === undefined) return null
    return alvo === SEM_DONO ? `Soltar: ${ficha.nome} fica sem dono` : `Soltar: ${ficha.nome} passa a ser de ${nomeDaConta(alvo)}`
  }
  const vagaSemDono = vagaEm(SEM_DONO)

  const avisos = contas.flatMap((alvo) => {
    const situacao = situacaoDe(alvo)
    if (situacao === 'repetido') {
      const primeira = contaComOMesmoEmail(contas, alvo)
      return [{ tom: 'brasa', contaId: alvo.id, texto: `${primeira?.nome ?? 'Outra conta'} e ${alvo.nome} estão com o mesmo e-mail. Cada e-mail vale para um jogador só: troque o de ${alvo.nome}.`, botao: 'Trocar o e-mail', rotulo: `Trocar o e-mail de ${alvo.nome}` }]
    }
    if (situacao === 'sem-email') {
      const dele = fichas.filter((ficha) => ficha.dono === alvo.id).map((ficha) => ficha.nome)
      const resto = dele.length > 0 ? ` ${listaDeNomes(dele)} ${dele.length === 1 ? 'continua' : 'continuam'} de ${alvo.nome} na mesa.` : ''
      return [{ tom: 'latao', contaId: alvo.id, texto: `${alvo.nome} não tem e-mail: não entra no site.${resto}`, botao: 'Adicionar e-mail', rotulo: `Adicionar o e-mail de ${alvo.nome}` }]
    }
    return []
  })

  return (
    <div className="jl" ref={raiz} onPointerDown={arrasto.onPointerDown} onKeyDown={desfazerPeloTeclado}>
      <div className="jl-topo">
        <p className="jl-intro">Quem entra no site desta campanha e de quem é cada ficha. Escolha o dono no cartão da ficha, ou arraste a ficha até o jogador.</p>
        {campanhaLigada !== undefined && <IndicadorDoLobby campanha={campanhaLigada} />}
      </div>

      <PublicarNoLobby pasta={pasta} rpg={rpg} sistema={sistema} contas={contas} conta={conta} publicada={publicada} campanhaLigada={campanhaLigada} falhaAoLigar={falhaAoLigar} onPublicada={marcarPublicada} />

      {campanhaLigada !== undefined && <MudancasParaDecidir campanha={campanhaLigada} fichas={rpg.personagens} sistema={sistema} />}

      {avisoDasContas !== null && (
        <p className="lb-field__error" role="alert">
          {avisoDasContas}
        </p>
      )}
      {avisos.length > 0 && (
        <ul className="jl-avisos" aria-label="Avisos">
          {avisos.map((aviso) => (
            <li key={aviso.contaId} className="jl-aviso" data-tom={aviso.tom}>
              <p>{aviso.texto}</p>
              <button type="button" className="lb-btn lb-btn--compact" aria-label={aviso.rotulo} onClick={() => setEmailAberto(aviso.contaId)}>
                {aviso.botao}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="jl-quadro">
        <section aria-labelledby={`jl-t-${pasta.id}`}>
          <div className="jl-cab">
            <h4 className="jl-cab__t" id={`jl-t-${pasta.id}`}>
              Jogadores
            </h4>
            <span className="jl-cab__n">{contas.length}</span>
          </div>
          {/* Sem disco (fora do app) os botões das contas ficam desligados: o porquê fica à vista. */}
          {contasLidas && !podeGravarContas && avisoDasContas === null && (
            <p className="lby-dica">Convidar, trocar e-mail e tirar do Lobby só funcionam no app instalado do Labirinto, que guarda as contas no computador.</p>
          )}
          {contas.length === 0 ? (
            <div className="jl-vazio">
              <p className="jl-vazio__t">Ninguém no Lobby ainda</p>
              <p>Convide cada jogador pelo e-mail Google, logo abaixo. As fichas ficam sem dono até você dizer de quem são.</p>
            </div>
          ) : (
            <ul className="jl-jogadores" aria-labelledby={`jl-t-${pasta.id}`}>
              {contas.map((alvo) => (
                <LinhaDoJogador
                  key={alvo.id}
                  conta={alvo}
                  contas={contas}
                  nomeDaCampanha={pasta.nome}
                  situacao={situacaoDe(alvo)}
                  envio={envios[alvo.id]}
                  podeGravar={podeGravarContas}
                  publicada={publicada}
                  fichas={fichas.filter((ficha) => ficha.dono === alvo.id)}
                  emailAberto={emailAberto === alvo.id}
                  vaga={vagaEm(alvo.id)}
                  chegou={chegou}
                  onAbrirEmail={(aberto) => setEmailAberto(aberto ? alvo.id : null)}
                  onTrocarEmail={(email) => comEnvio([alvo.id], () => trocarEmailDaConta(alvo.id, email))}
                  onTirado={(email) => aoTirar(alvo, email)}
                  onReenviar={() => void comEnvio([alvo.id], reenviarContasAtuais).catch(() => undefined)}
                  onTrocarDono={trocarDono}
                />
              ))}
            </ul>
          )}
          <ConviteDeJogador contas={contas} podeGravar={podeGravarContas} onConvidar={(contaId, email) => comEnvio([contaId], () => trocarEmailDaConta(contaId, email))} />
        </section>
        <section className="jl-sem-dono" data-alvo={SEM_DONO} data-sobre={vagaSemDono !== null || undefined} aria-labelledby={`jl-sd-${pasta.id}`}>
          <div className="jl-cab">
            <h4 className="jl-cab__t" id={`jl-sd-${pasta.id}`}>
              Sem dono
            </h4>
            <span className="jl-cab__n">{semDono.length}</span>
          </div>
          <p className="lby-dica">Só você edita. Os colegas veem.</p>
          <ul className="jl-fichas" aria-label="Fichas sem dono">
            {semDono.length === 0 ? (
              <li className="jl-fichas__vazio">{fichas.length === 0 ? 'Nenhuma ficha de jogador nesta pasta. Crie em Sistema e personagens.' : 'Toda ficha tem dono. Solte uma aqui para ela ficar sem dono.'}</li>
            ) : (
              semDono.map((ficha) => <FichaNoQuadro key={ficha.id} ficha={ficha} contas={contas} chegou={chegou === ficha.id} onTrocarDono={trocarDono} />)
            )}
            {vagaSemDono !== null && (
              <li className="jl-vaga" aria-hidden="true">
                {vagaSemDono}
              </li>
            )}
          </ul>
        </section>
      </div>
      {erroDoDono !== null && (
        <p className="lb-field__error" role="alert">
          {erroDoDono}
        </p>
      )}

      <ContaNaNuvem onEstado={setConta} />
    </div>
  )
}

// ── Publicar ────────────────────────────────────────────────────────────────

interface PublicarNoLobbyProps {
  pasta: PastaDeMapas
  rpg: RpgDaPasta
  sistema: SistemaDeRpg | undefined
  contas: readonly ContaDeJogador[]
  conta: EstadoDaConta
  publicada: boolean
  campanhaLigada: CampanhaNoApp | undefined
  falhaAoLigar: string | null
  onPublicada: (campanha: CampanhaPublicada) => void
}

type Publicando = { t: 'parado' } | { t: 'publicando' } | { t: 'feito'; relatorio: Publicacao } | { t: 'falhou'; mensagem: string }

/** Por que o botão Publicar não pode agir agora; `null` = pode. */
function bloqueioDaPublicacao(sistema: SistemaDeRpg | undefined, personagens: readonly Personagem[], conta: EstadoDaConta): string | null {
  if (sistema === undefined) return 'Escolha o sistema universal na aba Sistema e personagens: pasta sem sistema não vai ao Lobby.'
  // O sistema e as fichas que sobem: ficha que guardou o bloco do Dragon Ball também fica fora (12.21).
  const dragonBall = bloqueioDoDragonBall(sistema, personagens)
  if (dragonBall !== null) return dragonBall
  if (conta.t === 'carregando') return 'Conferindo a Conta na nuvem…'
  if (conta.t === 'indisponivel') return conta.falha.mensagem
  if (!conta.guardada) return 'Cole o token do app em Conta na nuvem, no fim desta aba, para publicar.'
  if (fichasQueSobem(personagens).length === 0) return 'Nenhuma ficha de jogador nesta pasta ainda: importe ou copie os jogadores na aba Sistema e personagens.'
  return null
}

/**
 * A pasta já está no Lobby e ganhou Dragon Ball por um caminho que não passa
 * pelo app (um `rpg.json` mexido à mão: o Configurar pasta e a grade de
 * sistemas do mapa recusam trocar o sistema da pasta publicada). As mudanças
 * continuam subindo: o aviso diz o que é e o que evitar até o bloco ser
 * detalhado campo a campo.
 */
function avisoDoDragonBallPublicado(sistema: SistemaDeRpg | undefined, personagens: readonly Personagem[]): string | null {
  const achado = dragonBallNaPasta(sistema, personagens)
  if (achado === null) return null
  const oQue = achado.t === 'sistema' ? 'o sistema dela agora é Dragon Ball' : `${fichasComOBloco(achado.fichas)} o bloco do Dragon Ball`
  return `Esta pasta já está no Lobby, mas ${oQue}, que ainda não vai ao Lobby. As mudanças nos blocos do Dragon Ball sobem do mesmo jeito e podem brigar no site: não mexa neles até o bloco ser detalhado campo a campo.`
}

function PublicarNoLobby({ pasta, rpg, sistema, contas, conta, publicada, campanhaLigada, falhaAoLigar, onPublicada }: PublicarNoLobbyProps) {
  const id = useId()
  const [publicando, setPublicando] = useState<Publicando>({ t: 'parado' })
  const fichas = fichasQueSobem(rpg.personagens)
  const npcs = rpg.personagens.length - fichas.length

  const publicar = async () => {
    if (sistema === undefined) return
    setPublicando({ t: 'publicando' })
    try {
      const resultado = await publicarPasta({ pastaId: pasta.id, nome: pasta.nome, sistema, personagens: rpg.personagens, contas })
      if (!resultado.ok) {
        setPublicando({ t: 'falhou', mensagem: resultado.falha.mensagem })
        return
      }
      setPublicando({ t: 'feito', relatorio: resultado.valor })
      onPublicada(resultado.valor.campanha)
    } catch (erro) {
      setPublicando({ t: 'falhou', mensagem: `Não deu para publicar: ${erro instanceof Error ? erro.message : String(erro)}` })
    }
  }

  const relatorio = publicando.t === 'feito' ? <RelatorioDaPublicacao relatorio={publicando.relatorio} /> : null

  if (publicada) {
    const dragonBall = avisoDoDragonBallPublicado(sistema, rpg.personagens)
    return (
      <section className="lby-publicar" data-estado="publicada" aria-labelledby={`${id}-t`}>
        <h4 className="lby-cab__t" id={`${id}-t`}>
          Publicada no Lobby
        </h4>
        <p className="lby-dica">Os jogadores com e-mail veem as fichas no site. Cada mudança, daqui ou de lá, sobe sozinha; ficha nova de jogador entra no Lobby assim que nasce na pasta.</p>
        {dragonBall !== null && (
          <p className="lby-aviso" role="alert">
            {dragonBall}
          </p>
        )}
        {campanhaLigada === undefined && falhaAoLigar !== null && (
          <p className="lb-field__error" role="alert">
            {falhaAoLigar}
          </p>
        )}
        {relatorio}
      </section>
    )
  }

  const bloqueio = bloqueioDaPublicacao(sistema, rpg.personagens, conta)
  const ocupado = publicando.t === 'publicando'
  return (
    <section className="lby-publicar" aria-labelledby={`${id}-t`}>
      <h4 className="lby-cab__t" id={`${id}-t`}>
        Publicar no Lobby
      </h4>
      <p className="lby-dica" id={`${id}-dica`}>
        {fichas.length === 0 ? 'Sobem as fichas de jogador' : fichas.length === 1 ? 'Sobe 1 ficha de jogador' : `Sobem ${fichas.length} fichas de jogador`}
        {npcs > 0 ? ` (${npcs === 1 ? 'o NPC fica' : `os ${npcs} NPCs ficam`} só no app)` : ''} e a lista de jogadores com e-mail. Depois disso, cada mudança sobe sozinha.
      </p>
      {bloqueio !== null && (
        <p className="lby-aviso" data-tom="latao" id={`${id}-bloqueio`}>
          {bloqueio}
        </p>
      )}
      <div className="lby-linha">
        <button
          type="button"
          className="lb-btn lb-btn--primary lb-btn--compact"
          disabled={bloqueio !== null || ocupado}
          aria-describedby={bloqueio !== null ? `${id}-bloqueio` : `${id}-dica`}
          onClick={() => void publicar()}
        >
          {ocupado ? 'Publicando…' : 'Publicar no Lobby'}
        </button>
      </div>
      {publicando.t === 'falhou' && (
        <p className="lb-field__error" role="alert">
          {publicando.mensagem}
        </p>
      )}
      {relatorio}
    </section>
  )
}

function RelatorioDaPublicacao({ relatorio }: { relatorio: Publicacao }) {
  const noLobby = relatorio.fichas.filter((ficha) => ficha.situacao === 'publicada' || ficha.situacao === 'ja-publicada')
  const fora = relatorio.fichas.filter((ficha) => ficha.situacao === 'recusada' || ficha.situacao === 'adiada')
  const { imagens } = relatorio
  return (
    <div className="lby-relatorio" role="status">
      <p className="lby-ok">{noLobby.length === 1 ? '1 ficha está no Lobby.' : `${noLobby.length} fichas estão no Lobby.`}</p>
      {fora.length > 0 && (
        <ul className="lby-relatorio__fora" aria-label="Fichas que não subiram">
          {fora.map((ficha) => (
            <li key={ficha.fichaId}>
              <b>{ficha.nome}</b>: {ficha.motivo ?? 'não subiu'}
            </li>
          ))}
        </ul>
      )}
      {imagens.falharam > 0 && (
        <p className="lby-aviso" data-tom="latao">
          {imagens.falharam === 1 ? '1 imagem não subiu' : `${imagens.falharam} imagens não subiram`}
          {imagens.falha !== null ? ` (${imagens.falha.mensagem})` : ''}. As fichas estão lá; falta só a imagem no site.
        </p>
      )}
      {relatorio.embutidasDeFora > 0 && (
        <p className="lby-dica">
          {relatorio.embutidasDeFora === 1 ? '1 foto antiga ainda não virou mídia e ficou' : `${relatorio.embutidasDeFora} fotos antigas ainda não viraram mídia e ficaram`} só no app.
        </p>
      )}
      {!relatorio.ligou && (
        <p className="lb-field__error" role="alert">
          A campanha foi criada, mas o Lobby desta pasta não ligou no app: as mudanças ainda não sobem. Feche e abra o app.
        </p>
      )}
    </div>
  )
}

// ── A linha do jogador ──────────────────────────────────────────────────────

interface LinhaDoJogadorProps {
  conta: ContaDeJogador
  contas: readonly ContaDeJogador[]
  nomeDaCampanha: string
  situacao: Situacao
  envio: Envio | undefined
  podeGravar: boolean
  publicada: boolean
  fichas: readonly Personagem[]
  emailAberto: boolean
  /** O arrasto parou sobre esta linha: o texto da vaga (o que acontece ao soltar); `null` = não está. */
  vaga: string | null
  /** A ficha que acabou de trocar de dono (entra com movimento). */
  chegou: string | null
  onAbrirEmail: (aberto: boolean) => void
  onTrocarEmail: (email: string | null) => Promise<void>
  /** Saiu do Lobby: o quadro avisa com Desfazer, que devolve `email` à conta. */
  onTirado: (email: string) => void
  onReenviar: () => void
  onTrocarDono: (fichaId: string, contaId: string | null) => Promise<void>
}

const COPIADO_MS = 2000

function LinhaDoJogador(props: LinhaDoJogadorProps) {
  const { conta, contas, situacao, envio, podeGravar, publicada, fichas, emailAberto, vaga, chegou, onAbrirEmail, onTrocarEmail, onTirado, onReenviar, onTrocarDono } = props
  const id = useId()
  const [tirando, setTirando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const outra = contaComOMesmoEmail(contas, conta)
  const formAberto = emailAberto || conta.email === undefined
  const texto = TEXTO_DA_SITUACAO[situacao]

  useEffect(() => {
    if (!copiado) return
    const espera = setTimeout(() => setCopiado(false), COPIADO_MS)
    return () => clearTimeout(espera)
  }, [copiado])

  const copiar = async () => {
    setErro(null)
    try {
      await navigator.clipboard.writeText(recadoDeConvite(conta, props.nomeDaCampanha))
      setCopiado(true)
    } catch {
      setErro('Não deu para copiar o recado: o sistema recusou a área de transferência.')
    }
  }

  const tirar = async () => {
    setErro(null)
    const email = conta.email
    try {
      await onTrocarEmail(null)
      setTirando(false)
      if (email !== undefined) onTirado(email)
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : String(causa))
    }
  }

  const aparelhos = conta.aparelhos.length
  return (
    <li className="jl-jog" data-alvo={conta.id} data-sobre={vaga !== null || undefined} aria-labelledby={`${id}-nome`}>
      <span className="jl-av" aria-hidden="true">
        {iniciais(conta.nome).slice(0, 1)}
      </span>
      <div className="jl-jog__corpo">
        <div className="jl-jog__cab">
          <h5 className="jl-jog__nome" id={`${id}-nome`}>
            {conta.nome}
          </h5>
          <span className="jl-sit" data-sit={situacao}>
            <span className="jl-sit__marca">
              {situacao === 'enviando' && <span className="lby-giro" aria-hidden="true" />}
              {texto.marca}
            </span>
            {situacao === 'falhou' && envio?.t === 'falhou' ? <span className="jl-sit__mais">{envio.mensagem}</span> : texto.mais !== null && <span className="jl-sit__mais">{texto.mais}</span>}
          </span>
        </div>
        {formAberto ? (
          <FormDoEmail conta={conta} contas={contas} podeGravar={podeGravar} publicada={publicada} focar={emailAberto} onSalvar={onTrocarEmail} onFechar={() => onAbrirEmail(false)} />
        ) : (
          <>
            <p className="jl-jog__email">
              <span className="jl-email">{conta.email}</span>
              <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" disabled={situacao === 'enviando'} aria-label={`Trocar o e-mail de ${conta.nome}`} onClick={() => onAbrirEmail(true)}>
                Trocar
              </button>
            </p>
            {outra !== null && <p className="jl-alerta">Mesmo e-mail de {outra.nome}.</p>}
          </>
        )}
        <p className="jl-jog__conta">
          Conta do app: {conta.nome}, com PIN{aparelhos > 0 ? ` e ${aparelhos} ${aparelhos === 1 ? 'aparelho lembrado' : 'aparelhos lembrados'}` : ''}
        </p>
      </div>
      <div className="jl-jog__acoes">
        {situacao === 'falhou' && (
          <button type="button" className="lb-btn lb-btn--compact" onClick={onReenviar}>
            Enviar de novo
          </button>
        )}
        {conta.email !== undefined && !formAberto && (
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" aria-label={`Copiar o recado de convite para ${conta.nome}`} onClick={() => void copiar()}>
            {copiado ? 'Copiado' : 'Copiar recado'}
          </button>
        )}
        {conta.email !== undefined && !tirando && (
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" disabled={!podeGravar || situacao === 'enviando'} aria-label={`Tirar ${conta.nome} do Lobby`} onClick={() => setTirando(true)}>
            Tirar do Lobby
          </button>
        )}
      </div>
      {tirando && <ConfirmarTirar conta={conta} fichas={fichas} onConfirmar={() => void tirar()} onCancelar={() => setTirando(false)} />}
      {erro !== null && (
        <p className="lb-field__error jl-jog__erro" role="alert">
          {erro}
        </p>
      )}
      <div className="jl-fichas-area">
        <ul className="jl-fichas" aria-label={`Fichas de ${conta.nome}`}>
          {fichas.length === 0 ? (
            <li className="jl-fichas__vazio">Nenhuma ficha. Arraste uma até aqui, ou escolha {conta.nome} no Dono dela.</li>
          ) : (
            fichas.map((ficha) => <FichaNoQuadro key={ficha.id} ficha={ficha} contas={contas} chegou={chegou === ficha.id} onTrocarDono={onTrocarDono} />)
          )}
          {vaga !== null && (
            <li className="jl-vaga" aria-hidden="true">
              {vaga}
            </li>
          )}
        </ul>
      </div>
    </li>
  )
}

function ConfirmarTirar({ conta, fichas, onConfirmar, onCancelar }: { conta: ContaDeJogador; fichas: readonly Personagem[]; onConfirmar: () => void; onCancelar: () => void }) {
  const id = useId()
  const nomes = fichas.map((ficha) => ficha.nome)
  let dasFichas = `Nenhuma ficha é de ${conta.nome}.`
  if (nomes.length === 1) dasFichas = `${nomes[0]} fica sem quem edite pelo site: só você edita, e os colegas continuam vendo.`
  if (nomes.length > 1) dasFichas = `${listaDeNomes(nomes)} ficam sem quem edite pelo site: só você edita, e os colegas continuam vendo.`
  return (
    <div
      className="jl-confirma"
      role="alertdialog"
      aria-modal="false"
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancelar()
      }}
    >
      <p className="jl-confirma__titulo" id={`${id}-t`}>
        Tirar {conta.nome} do Lobby?
      </p>
      <p id={`${id}-d`}>
        O e-mail sai da conta, e {conta.nome} deixa de entrar no site em todas as pastas publicadas. {dasFichas} Nada é apagado, e a conta do app de {conta.nome} continua valendo na mesa.
      </p>
      <div className="lby-linha">
        <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={onConfirmar}>
          Tirar {conta.nome}
        </button>
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" autoFocus onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

interface FormDoEmailProps {
  conta: ContaDeJogador
  contas: readonly ContaDeJogador[]
  podeGravar: boolean
  publicada: boolean
  focar: boolean
  onSalvar: (email: string) => Promise<void>
  onFechar: () => void
}

function FormDoEmail({ conta, contas, podeGravar, publicada, focar, onSalvar, onFechar }: FormDoEmailProps) {
  const id = useId()
  const [valor, setValor] = useState(conta.email ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const campo = useRef<HTMLInputElement>(null)
  const temAntes = conta.email !== undefined

  useEffect(() => {
    if (focar) campo.current?.focus()
  }, [focar])

  const salvar = async (event: FormEvent) => {
    event.preventDefault()
    const problema = problemaDoEmail(contas, conta.id, valor)
    if (problema !== null) {
      setErro(problema)
      campo.current?.focus()
      return
    }
    setErro(null)
    setSalvando(true)
    try {
      await onSalvar(valor)
      onFechar()
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : String(causa))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form
      className="jl-email-form"
      noValidate
      onSubmit={(event) => void salvar(event)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && temAntes) onFechar()
      }}
    >
      <label className="lby-rot" htmlFor={`${id}-email`}>
        E-mail Google de {conta.nome}
      </label>
      <div className="lby-linha">
        <input
          ref={campo}
          id={`${id}-email`}
          className="lby-input"
          type="text"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="nome@example.com"
          value={valor}
          aria-invalid={erro !== null}
          aria-describedby={erro !== null ? `${id}-erro` : publicada ? `${id}-dica` : undefined}
          onChange={(event) => {
            setValor(event.target.value)
            if (erro !== null && problemaDoEmail(contas, conta.id, event.target.value) === null) setErro(null)
          }}
        />
        <button type="submit" className="lb-btn lb-btn--primary lb-btn--compact" disabled={!podeGravar || salvando}>
          {salvando ? 'Salvando…' : temAntes ? 'Salvar' : 'Adicionar'}
        </button>
        {temAntes && (
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={onFechar}>
            Cancelar
          </button>
        )}
      </div>
      {erro !== null && (
        <p className="lby-erro" id={`${id}-erro`} role="alert">
          {erro}
        </p>
      )}
      {publicada && erro === null && (
        <p className="lby-dica" id={`${id}-dica`}>
          {temAntes
            ? 'O e-mail antigo deixa de entrar; o novo entra assim que estiver no grupo do Access.'
            : 'Ponha este e-mail também no grupo do Access, no painel Zero Trust da Cloudflare: sem isso o site não deixa entrar.'}
        </p>
      )}
    </form>
  )
}

// ── A ficha no quadro ───────────────────────────────────────────────────────

interface FichaNoQuadroProps {
  ficha: Personagem
  contas: readonly ContaDeJogador[]
  /** Acabou de trocar de dono: entra na lista nova com movimento. */
  chegou: boolean
  onTrocarDono: (fichaId: string, contaId: string | null) => Promise<void>
}

/** O cartão: `data-ficha` é por onde o arrasto o acha; a alça é o único ponto que levanta o papel no toque. */
function FichaNoQuadro({ ficha, contas, chegou, onTrocarDono }: FichaNoQuadroProps) {
  const id = useId()
  const [trocando, setTrocando] = useState(false)
  const atual = ficha.dono !== undefined && contas.some((conta) => conta.id === ficha.dono) ? ficha.dono : ''
  const nota = atual === '' && ficha.nomeDoJogador !== undefined && ficha.nomeDoJogador !== '' ? `Na ficha: ${ficha.nomeDoJogador}, sem conta` : null
  return (
    <li className="jl-ficha" data-ficha={ficha.id} data-trocando={trocando || undefined} data-chegou={chegou || undefined}>
      <span className="jl-ficha__ret" aria-hidden="true">
        {iniciais(ficha.nome)}
      </span>
      <span className="jl-ficha__nome" title={ficha.nome}>
        {ficha.nome}
      </span>
      <span className="jl-alca" aria-hidden="true" title="Arraste até um jogador">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />
        </svg>
      </span>
      <span className="jl-ficha__dono">
        <label className="jl-ficha__rot" htmlFor={`${id}-dono`}>
          Dono<span className="lby-sr"> de {ficha.nome}</span>
        </label>
        <select
          id={`${id}-dono`}
          className="jl-dono"
          value={atual}
          disabled={trocando}
          onChange={(event) => {
            const contaId = event.target.value === '' ? null : event.target.value
            setTrocando(true)
            void onTrocarDono(ficha.id, contaId).finally(() => setTrocando(false))
          }}
        >
          <option value="">Sem dono</option>
          {contas.map((conta) => (
            <option key={conta.id} value={conta.id}>
              {conta.nome}
            </option>
          ))}
        </select>
      </span>
      {nota !== null && <span className="jl-ficha__nota">{nota}</span>}
    </li>
  )
}

// ── Convidar ────────────────────────────────────────────────────────────────

interface ConviteDeJogadorProps {
  contas: readonly ContaDeJogador[]
  podeGravar: boolean
  onConvidar: (contaId: string, email: string) => Promise<void>
}

/**
 * Convidar = criar a conta do app (nome e PIN, para a mesa) já com o e-mail
 * Google (para o site). Desvio do protótipo, que criava a conta sem PIN: a
 * conta do app de hoje exige o PIN (`contasDosJogadores.ts`).
 */
function ConviteDeJogador({ contas, podeGravar, onConvidar }: ConviteDeJogadorProps) {
  const id = useId()
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [nomeTocado, setNomeTocado] = useState(false)
  const [pin, setPin] = useState('')
  const [erros, setErros] = useState<{ email?: string; nome?: string; pin?: string; geral?: string }>({})
  const [convidando, setConvidando] = useState(false)
  const [feito, setFeito] = useState<string | null>(null)
  const refs = { email: useRef<HTMLInputElement>(null), nome: useRef<HTMLInputElement>(null), pin: useRef<HTMLInputElement>(null) }

  const convidar = async (event: FormEvent) => {
    event.preventDefault()
    setFeito(null)
    const novos: typeof erros = {}
    const problema = problemaDoEmail(contas, null, email)
    if (problema !== null) novos.email = problema
    if (nome.trim() === '') novos.nome = 'Escreva o nome do jogador na mesa.'
    if (!pinValido(pin)) novos.pin = `O PIN tem de ${PIN_MIN_DIGITOS} a ${PIN_MAX_DIGITOS} números.`
    setErros(novos)
    const primeiro = (['email', 'nome', 'pin'] as const).find((campo) => novos[campo] !== undefined)
    if (primeiro !== undefined) {
      refs[primeiro].current?.focus()
      return
    }
    setConvidando(true)
    const antes = new Set(useContasStore.getState().arquivo.contas.map((conta) => conta.id))
    try {
      await useContasStore.getState().criarConta(nome, pin)
      const nova = useContasStore.getState().arquivo.contas.find((conta) => !antes.has(conta.id))
      if (nova === undefined) throw new Error('A conta não apareceu na lista depois de criada.')
      await onConvidar(nova.id, email)
      setFeito(`${nova.nome} entrou. Diga o nome e o PIN para a mesa, e mande o recado do site.`)
      setEmail('')
      setNome('')
      setNomeTocado(false)
      setPin('')
    } catch (causa) {
      setErros({ geral: causa instanceof Error ? causa.message : String(causa) })
    } finally {
      setConvidando(false)
    }
  }

  return (
    <form className="jl-convite" noValidate onSubmit={(event) => void convidar(event)} aria-labelledby={`${id}-t`}>
      <p className="jl-convite__rot" id={`${id}-t`}>
        Convidar pelo e-mail Google
      </p>
      <div className="jl-convite__campos">
        <div className="lby-campo jl-convite__email">
          <label className="lby-rot" htmlFor={`${id}-email`}>
            E-mail Google
          </label>
          <input
            ref={refs.email}
            id={`${id}-email`}
            className="lby-input"
            type="text"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="nome@example.com"
            value={email}
            aria-invalid={erros.email !== undefined}
            aria-describedby={erros.email !== undefined ? `${id}-email-erro` : undefined}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => {
              if (!nomeTocado && nome === '' && email.includes('@')) setNome(nomeDoEmail(email.trim().toLowerCase()))
            }}
          />
          {erros.email !== undefined && (
            <p className="lby-erro" id={`${id}-email-erro`}>
              {erros.email}
            </p>
          )}
        </div>
        <div className="lby-campo">
          <label className="lby-rot" htmlFor={`${id}-nome`}>
            Nome na mesa
          </label>
          <input
            ref={refs.nome}
            id={`${id}-nome`}
            className="lby-input"
            value={nome}
            maxLength={NOME_DA_CONTA_MAX}
            autoComplete="off"
            aria-invalid={erros.nome !== undefined}
            aria-describedby={erros.nome !== undefined ? `${id}-nome-erro` : undefined}
            onChange={(event) => {
              setNomeTocado(true)
              setNome(event.target.value)
            }}
          />
          {erros.nome !== undefined && (
            <p className="lby-erro" id={`${id}-nome-erro`}>
              {erros.nome}
            </p>
          )}
        </div>
        <div className="lby-campo jl-convite__pin">
          <label className="lby-rot" htmlFor={`${id}-pin`}>
            PIN
          </label>
          <input
            ref={refs.pin}
            id={`${id}-pin`}
            className="lby-input"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            aria-invalid={erros.pin !== undefined}
            aria-describedby={erros.pin !== undefined ? `${id}-pin-erro` : undefined}
            onChange={(event) => setPin(soDigitos(event.target.value))}
          />
          {erros.pin !== undefined && (
            <p className="lby-erro" id={`${id}-pin-erro`}>
              {erros.pin}
            </p>
          )}
        </div>
        <button type="submit" className="lb-btn lb-btn--primary lb-btn--compact jl-convite__enviar" disabled={!podeGravar || convidando}>
          {convidando ? 'Convidando…' : 'Convidar'}
        </button>
      </div>
      {erros.geral !== undefined && (
        <p className="lb-field__error" role="alert">
          {erros.geral}
        </p>
      )}
      {feito !== null && (
        <p className="lby-ok" role="status">
          {feito}
        </p>
      )}
      <p className="lby-dica">
        O jogador ganha a conta do app (nome e PIN, para a mesa) com este e-mail (para o site). Até o convite automático chegar, ponha o mesmo e-mail também no grupo do Access, no painel Zero Trust da Cloudflare: sem isso o site não deixa entrar.
      </p>
    </form>
  )
}
