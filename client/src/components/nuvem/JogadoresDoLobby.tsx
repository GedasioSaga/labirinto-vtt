import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { NOME_DA_CONTA_MAX, PIN_MAX_DIGITOS, PIN_MIN_DIGITOS, pinValido, type ContaDeJogador } from '../../lib/contasDosJogadores'
import type { PastaDeMapas, RpgDaPasta } from '../../lib/pastasDeMapas'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import type { CampanhaPublicada } from '../../net/nuvem/estadoNoDisco'
import { useContasStore } from '../../stores/contasStore'
import { useNuvemStore, type CampanhaNoApp } from '../../stores/nuvemStore'
import { ContaNaNuvem, type EstadoDaConta } from './ContaNaNuvem'
import { problemaDoEmail, reenviarContasAtuais, trocarEmailDaConta } from './contasNoLobby'
import { IndicadorDoLobby } from './IndicadorDoLobby'
import { MudancasParaDecidir } from './MudancasParaDecidir'
import { bloqueioDoDragonBall, dragonBallNaPasta, fichasComOBloco, fichasQueSobem, publicarPasta, type EnvioDosMembros, type Publicacao } from './ponteDoLobby'
import { contaComOMesmoEmail, emailRepetidoParado, iniciais, listaDeNomes, recadoDeConvite } from './textosDoLobby'
import { usePastaPublicada } from './usePastaPublicada'
import './lobby.css'

/**
 * "JOGADORES DO LOBBY", a aba nova do Configurar pasta (docs/planos/lobby-jogadores-2026-11-05.md
 * §8.1 A6 e a última linha da §12; protótipo aprovado em
 * docs/design/lobby/prototipo-mestre.html, vista "No app"): publicar a pasta,
 * quem entra no site (a conta do app com o e-mail Google) e de quem é cada
 * ficha. "Sem dono": só o mestre edita, os colegas veem (12.6).
 */

export interface JogadoresDoLobbyProps {
  pasta: PastaDeMapas
  rpg: RpgDaPasta
  sistema: SistemaDeRpg | undefined
  /** A mudança no RPG da pasta pelo funil de sempre (`editarRpgDaPasta`): o dono que muda vira op do mestre. */
  onMudar: (mudar: (rpg: RpgDaPasta) => RpgDaPasta) => Promise<void>
}

type Envio = { t: 'enviando' } | { t: 'falhou'; mensagem: string }

/** O que a linha do jogador diz: a pastilha mostra o estado, o texto ao lado diz o porquê. */
type Situacao = 'sem-email' | 'repetido' | 'enviando' | 'falhou' | 'liberado' | 'guardado'

const TEXTO_DA_SITUACAO: Readonly<Record<Situacao, { marca: string; mais: string | null }>> = {
  'sem-email': { marca: 'Sem e-mail', mais: 'não entra no site' },
  repetido: { marca: 'E-mail repetido', mais: 'não entra até trocar' },
  enviando: { marca: 'Enviando ao Lobby…', mais: null },
  falhou: { marca: 'Não deu: tente de novo', mais: null },
  liberado: { marca: 'Liberado', mais: 'entra no site com este e-mail' },
  guardado: { marca: 'E-mail guardado', mais: 'entra quando a pasta for publicada' },
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

/** "Bia Souza" a partir de "bia.souza@gmail.com": só sugestão, o mestre troca. */
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

  useEffect(() => {
    void useContasStore.getState().carregar()
  }, [])

  const fichas = fichasQueSobem(rpg.personagens)
  const idsDasContas = new Set(contas.map((candidata) => candidata.id))
  const semDono = fichas.filter((ficha) => ficha.dono === undefined || !idsDasContas.has(ficha.dono))

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
    return publicada ? 'liberado' : 'guardado'
  }

  const trocarDono = async (fichaId: string, contaId: string | null) => {
    setErroDoDono(null)
    try {
      await onMudar((atual) => ({ ...atual, personagens: atual.personagens.map((ficha) => (ficha.id === fichaId ? comDono(ficha, contaId) : ficha)) }))
    } catch (erro) {
      setErroDoDono(erro instanceof Error ? erro.message : String(erro))
    }
  }

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
    <div className="jl">
      <div className="jl-topo">
        <p className="jl-intro">Quem entra no site desta campanha e de quem é cada ficha. Escolha o dono no cartão da ficha.</p>
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
                  onAbrirEmail={(aberto) => setEmailAberto(aberto ? alvo.id : null)}
                  onTrocarEmail={(email) => comEnvio([alvo.id], () => trocarEmailDaConta(alvo.id, email))}
                  onReenviar={() => void comEnvio([alvo.id], reenviarContasAtuais).catch(() => undefined)}
                  onTrocarDono={trocarDono}
                />
              ))}
            </ul>
          )}
          <ConviteDeJogador contas={contas} podeGravar={podeGravarContas} onConvidar={(contaId, email) => comEnvio([contaId], () => trocarEmailDaConta(contaId, email))} />
        </section>
        <section className="jl-sem-dono" aria-labelledby={`jl-sd-${pasta.id}`}>
          <div className="jl-cab">
            <h4 className="jl-cab__t" id={`jl-sd-${pasta.id}`}>
              Sem dono
            </h4>
            <span className="jl-cab__n">{semDono.length}</span>
          </div>
          <p className="lby-dica">Só você edita. Os colegas veem.</p>
          <ul className="jl-fichas" aria-label="Fichas sem dono">
            {semDono.length === 0 ? (
              <li className="jl-fichas__vazio">{fichas.length === 0 ? 'Nenhuma ficha de jogador nesta pasta. Crie em Sistema e personagens.' : 'Toda ficha tem dono.'}</li>
            ) : (
              semDono.map((ficha) => <FichaNoQuadro key={ficha.id} ficha={ficha} contas={contas} onTrocarDono={trocarDono} />)
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
 * pelo Publicar (o sistema trocado pela grade de sistemas de um mapa, ou um
 * `rpg.json` mexido à mão). As mudanças continuam subindo: o aviso diz o que é
 * e o que evitar até o bloco ser detalhado campo a campo.
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
  onAbrirEmail: (aberto: boolean) => void
  onTrocarEmail: (email: string | null) => Promise<void>
  onReenviar: () => void
  onTrocarDono: (fichaId: string, contaId: string | null) => Promise<void>
}

const COPIADO_MS = 2000

function LinhaDoJogador(props: LinhaDoJogadorProps) {
  const { conta, contas, situacao, envio, podeGravar, publicada, fichas, emailAberto, onAbrirEmail, onTrocarEmail, onReenviar, onTrocarDono } = props
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
    try {
      await onTrocarEmail(null)
      setTirando(false)
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : String(causa))
    }
  }

  const aparelhos = conta.aparelhos.length
  return (
    <li className="jl-jog" aria-labelledby={`${id}-nome`}>
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
            <li className="jl-fichas__vazio">Nenhuma ficha. Escolha {conta.nome} no Dono de uma ficha sem dono.</li>
          ) : (
            fichas.map((ficha) => <FichaNoQuadro key={ficha.id} ficha={ficha} contas={contas} onTrocarDono={onTrocarDono} />)
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
          placeholder="nome@gmail.com"
          value={valor}
          aria-invalid={erro !== null}
          aria-describedby={erro !== null ? `${id}-erro` : temAntes && publicada ? `${id}-dica` : undefined}
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
      {temAntes && publicada && erro === null && (
        <p className="lby-dica" id={`${id}-dica`}>
          O e-mail antigo deixa de entrar; o novo entra assim que estiver no grupo do Access.
        </p>
      )}
    </form>
  )
}

// ── A ficha no quadro ───────────────────────────────────────────────────────

function FichaNoQuadro({ ficha, contas, onTrocarDono }: { ficha: Personagem; contas: readonly ContaDeJogador[]; onTrocarDono: (fichaId: string, contaId: string | null) => Promise<void> }) {
  const id = useId()
  const [trocando, setTrocando] = useState(false)
  const atual = ficha.dono !== undefined && contas.some((conta) => conta.id === ficha.dono) ? ficha.dono : ''
  const nota = atual === '' && ficha.nomeDoJogador !== undefined && ficha.nomeDoJogador !== '' ? `Na ficha: ${ficha.nomeDoJogador}, sem conta` : null
  return (
    <li className="jl-ficha" data-trocando={trocando || undefined}>
      <span className="jl-ficha__ret" aria-hidden="true">
        {iniciais(ficha.nome)}
      </span>
      <span className="jl-ficha__nome" title={ficha.nome}>
        {ficha.nome}
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
            placeholder="nome@gmail.com"
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
