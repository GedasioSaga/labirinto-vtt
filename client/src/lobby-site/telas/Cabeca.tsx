import { useEffect, useRef, useState } from 'react'
import type { EstadoDaCampanha } from '../dados/sessaoDaCampanha'
import type { Rota } from '../dados/rotas'
import { aoClicarNoLink, useDoSite, useSite } from './contexto'
import { mudancasACaminho } from './enviar'
import { pedirFocoNoAviso } from './foco'
import { Icone } from './Icone'
import { tomDe } from './textos'
import { enderecoDaRota } from '../dados/rotas'

/**
 * A CABEÇA FIXA (protótipo, "cabeça fixa e faixa"): a marca, onde a pessoa
 * está, quem está na mesa agora e a conta; embaixo, a FAIXA DE ESTADO, em toda
 * tela de campanha. "Salvo" só aparece quando o servidor confirmou tudo.
 */

/** Sair do Access (Cloudflare Zero Trust): apaga a sessão do login e volta à porta do Google. */
const SAIR_DO_ACCESS = '/cdn-cgi/access/logout'

export function Cabeca() {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const eu = useDoSite((estado) => estado.eu)
  const rota = useDoSite((estado) => estado.rota)
  const campanha = useDoSite((estado) => estado.campanha)
  const email = eu.t === 'pronto' ? eu.eu.email : null
  const nomeDaMesa = eu.t === 'pronto' && campanha !== null ? (eu.eu.campanhas.find((linha) => linha.campanhaId === campanha.campanhaId)?.nomeDaCampanha ?? null) : null
  const ficha = rota.tela === 'ficha' && campanha !== null ? campanha.fichas.find((candidata) => candidata.doc.id === rota.fichaId) : undefined
  const euNaMesa = campanha?.eu ?? null
  const nomeDaConta = euNaMesa?.nome ?? email ?? 'Você'
  const naMesa = campanha?.naMesa ?? []
  const nomesNaMesa = naMesa.map((pessoa) => (pessoa.papel === 'mestre' ? `${pessoa.nome} (mestre)` : pessoa.nome)).join(', ')

  const link = (alvo: Rota, texto: string) => (
    <a href={enderecoDaRota(alvo, demo)} onClick={aoClicarNoLink(site, alvo)}>
      {texto}
    </a>
  )

  return (
    <header className="lo-cabeca">
      <div className="lo-topo">
        <a className="lo-marca" href={enderecoDaRota({ tela: 'campanhas' }, demo)} onClick={aoClicarNoLink(site, { tela: 'campanhas' })} aria-label="Labirinto Lobby, suas mesas">
          <span className="lo-marca__nome">Labirinto</span>
          <span className="lo-marca__lobby">Lobby</span>
        </a>
        <nav className="lo-trilha" aria-label="Onde você está">
          <ol>
            <li>{rota.tela === 'campanhas' ? <span aria-current="page">Suas mesas</span> : link({ tela: 'campanhas' }, 'Suas mesas')}</li>
            {campanha !== null && nomeDaMesa !== null && (
              <li>{ficha === undefined ? <span aria-current="page">{nomeDaMesa}</span> : link({ tela: 'campanha', campanhaId: campanha.campanhaId }, nomeDaMesa)}</li>
            )}
            {ficha !== undefined && (
              <li>
                <span aria-current="page">{ficha.doc.nome}</span>
              </li>
            )}
          </ol>
        </nav>
        <div className="lo-topo__direita">
          {naMesa.length > 0 && (
            <div className="lo-agora-mini" title={`Na mesa agora: ${nomesNaMesa}`}>
              <div className="lo-agora-mini__rostos" aria-hidden="true">
                {naMesa.map((pessoa) => (
                  <span key={pessoa.contaId} className="lo-av" data-tom={tomDe(pessoa.contaId)}>
                    {pessoa.nome.slice(0, 1)}
                  </span>
                ))}
              </div>
              <span>
                <span className="lo-sr">Na mesa agora: {nomesNaMesa}. </span>
                <span aria-hidden="true">{naMesa.length} na mesa</span>
              </span>
            </div>
          )}
          {email !== null && (
            <>
              <button type="button" className="lo-conta" popoverTarget="lo-menu-conta" aria-label={`Conta de ${nomeDaConta} (${email})`}>
                <span className="lo-av" data-tom={tomDe(euNaMesa?.contaId ?? email)} aria-hidden="true">
                  {nomeDaConta.slice(0, 1).toUpperCase()}
                </span>
                <span className="lo-conta__nome">{nomeDaConta}</span>
              </button>
              <div className="lo-menu" id="lo-menu-conta" popover="auto">
                <div className="lo-menu__quem">
                  <span className="lo-av" data-tom={tomDe(euNaMesa?.contaId ?? email)} aria-hidden="true">
                    {nomeDaConta.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p>{nomeDaConta}</p>
                    <p className="lo-menu__email">{email}</p>
                  </div>
                </div>
                {demo ? (
                  <p className="lo-motivo lo-menu__nota">Demonstração: dados inventados, sem login. Nada sai deste navegador.</p>
                ) : (
                  <a className="lo-btn lo-btn--fantasma" href={SAIR_DO_ACCESS}>
                    <Icone nome="sair" /> Sair
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {campanha !== null && <Faixa campanha={campanha} />}
    </header>
  )
}

type NomeDoEstado = 'decisao' | 'erro' | 'offline' | 'conectando' | 'enviando' | 'salvo'

function estadoDaFaixa(campanha: EstadoDaCampanha): NomeDoEstado {
  if (campanha.conexao === 'versao' || campanha.conexao === 'sem-acesso' || campanha.erroLocal !== null) return 'erro'
  if (campanha.paraDecidir.length > 0) return 'decisao'
  if (campanha.conexao === 'sem-rede') return 'offline'
  if (campanha.conexao === 'conectando' || !campanha.carregada) return 'conectando'
  return mudancasACaminho(campanha) > 0 ? 'enviando' : 'salvo'
}

function Faixa({ campanha }: { campanha: EstadoDaCampanha }) {
  const site = useSite()
  const estado = estadoDaFaixa(campanha)
  const anterior = useRef<NomeDoEstado>(estado)
  // O visto assenta uma vez, quando o servidor acabou de confirmar (enviando -> salvo).
  const [recem, setRecem] = useState(false)
  useEffect(() => {
    setRecem(anterior.current === 'enviando' && estado === 'salvo')
    anterior.current = estado
  }, [estado])

  const n = mudancasACaminho(campanha)
  const nd = campanha.paraDecidir.length
  const primeira = campanha.paraDecidir.at(0)

  function verDecisao() {
    if (primeira === undefined) return
    pedirFocoNoAviso(primeira.op.opId)
    site.irPara({ tela: 'ficha', campanhaId: campanha.campanhaId, fichaId: primeira.op.fichaId, aba: 'ficha' })
  }

  let principal
  let extra = null
  switch (estado) {
    case 'erro':
      principal = (
        <>
          <Icone nome="alerta" />
          <span>{campanha.conexao === 'versao' ? 'O Lobby foi atualizado' : campanha.conexao === 'sem-acesso' ? 'Você não está mais nesta mesa' : 'Não deu para guardar neste navegador'}</span>
        </>
      )
      extra =
        campanha.conexao === 'versao' ? (
          <button type="button" className="lo-btn lo-faixa__acao" onClick={() => window.location.reload()}>
            Recarregar a página
          </button>
        ) : (
          <span className="lo-faixa__extra">
            {campanha.conexao === 'sem-acesso'
              ? 'Peça ao mestre para te convidar de novo com este e-mail.'
              : `${campanha.erroLocal ?? ''} A última mudança não foi feita; libere espaço ou feche outras abas e tente de novo.`}
          </span>
        )
      break
    case 'decisao':
      principal = (
        <>
          <Icone nome="alerta" />
          <span>{nd === 1 ? '1 precisa da sua decisão' : `${nd} precisam da sua decisão`}</span>
        </>
      )
      extra = (
        <>
          <button type="button" className="lo-btn lo-faixa__acao" onClick={verDecisao}>
            Ver
          </button>
          {n > 0 && <span className="lo-faixa__extra">{campanha.conexao === 'sem-rede' ? `Sem internet: ${n} esperando` : `Enviando ${n}`}</span>}
        </>
      )
      break
    case 'offline':
      principal = (
        <>
          <Icone nome="sem-rede" />
          <span>{n > 0 ? `Sem internet: ${n} esperando` : 'Sem internet'}</span>
        </>
      )
      extra = (
        <span className="lo-faixa__extra">
          {n > 0 ? `${n === 1 ? 'Ela vai sozinha' : 'Elas vão sozinhas'} quando a conexão voltar. Mudanças novas ficam pausadas até lá.` : 'Mudanças novas ficam pausadas até a conexão voltar.'}
        </span>
      )
      break
    case 'conectando':
      principal = (
        <>
          <span className="lo-giro" aria-hidden="true" />
          <span>Conectando à mesa…</span>
        </>
      )
      break
    case 'enviando':
      principal = (
        <>
          <span className="lo-giro" aria-hidden="true" />
          <span>Enviando {n}</span>
        </>
      )
      break
    case 'salvo':
      principal = (
        <>
          <Icone nome="visto" />
          <span>Salvo</span>
        </>
      )
      extra = <span className="lo-faixa__extra">Tudo o que você mudou está no servidor.</span>
      break
  }

  return (
    <div className="lo-faixa" data-estado={estado === 'erro' ? 'decisao' : estado} data-recem={recem ? '1' : undefined} role="status" aria-live="polite">
      <div className="lo-faixa__dentro">
        <p className="lo-faixa__principal">{principal}</p>
        {extra}
      </div>
    </div>
  )
}
