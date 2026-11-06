import { useId, useState, type ReactNode } from 'react'
import type { CargaDoEu } from '../dados/lobbyStore'
import { Carregando } from './Estados'
import { Icone } from './Icone'

/**
 * A ENTRADA (protótipo, tela 1): quem ainda não entrou, quem entrou com um
 * e-mail que nenhum mestre convidou, e o Lobby fora do ar. O login em si é do
 * Cloudflare Access (Google): recarregar a página leva a ele.
 */

const SAIR_DO_ACCESS = '/cdn-cgi/access/logout'
const COPIADO_MS = 2_000

export function TelaAcesso({ carga }: { carga: CargaDoEu }) {
  if (carga.t === 'carregando') return <Carregando texto="Carregando suas mesas…" />
  if (carga.t === 'pronto') return <SemConvite email={carga.eu.email} />
  if (carga.tipo === 'sem-login') {
    return (
      <Entrada titulo="Entrar" texto="Só entra quem o mestre convidou. Use o e-mail que você passou para ele.">
        <button type="button" className="lo-btn lo-btn--primario lo-btn--grande" onClick={() => window.location.reload()}>
          <Icone nome="entrar" /> Entrar com Google
        </button>
        <p className="lo-porta__miuda">O Lobby guarda só o seu e-mail, para saber quais fichas são suas.</p>
      </Entrada>
    )
  }
  const titulo = carga.tipo === 'rede' ? 'Sem conexão com o Lobby' : 'O Lobby não respondeu direito'
  const texto = carga.tipo === 'rede' ? 'Confira a internet e tente de novo. Nada do que você mudou se perdeu.' : `${carga.detalhe} Tente de novo em instantes.`
  return (
    <Entrada titulo={titulo} texto={texto}>
      <button type="button" className="lo-btn lo-btn--primario" onClick={() => window.location.reload()}>
        Tentar de novo
      </button>
    </Entrada>
  )
}

function Entrada({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  const id = useId()
  return (
    <div className="lo-entrada">
      <div className="lo-entrada__marca">
        <p className="lo-entrada__lobby">Labirinto</p>
        <h1 className="lo-entrada__titulo">Lobby da mesa</h1>
        <p className="lo-entrada__texto">
          As fichas da sua campanha, abertas entre uma sessão e outra. Veja a sua e a dos colegas, ajuste o HP, arrume a mochila. O mestre vê na hora.
        </p>
      </div>
      <section className="lo-porta" aria-labelledby={id}>
        <h2 id={id}>{titulo}</h2>
        <p>{texto}</p>
        {children}
      </section>
    </div>
  )
}

function SemConvite({ email }: { email: string }) {
  const [copiado, setCopiado] = useState<'sim' | 'falhou' | null>(null)
  function copiar() {
    navigator.clipboard.writeText(email).then(
      () => {
        setCopiado('sim')
        setTimeout(() => setCopiado(null), COPIADO_MS)
      },
      () => setCopiado('falhou'),
    )
  }
  return (
    <Entrada titulo="Este e-mail ainda não está em nenhuma mesa" texto="Peça ao mestre para te convidar com este e-mail. Depois é só entrar de novo.">
      <p>
        Você entrou como <strong>{email}</strong>.
      </p>
      <div className="lo-porta__acoes">
        <button type="button" className="lo-btn lo-btn--primario" onClick={copiar}>
          <Icone nome={copiado === 'sim' ? 'visto' : 'copiar'} /> {copiado === 'sim' ? 'Copiado' : 'Copiar meu e-mail'}
        </button>
        <a className="lo-btn" href={SAIR_DO_ACCESS}>
          Entrar com outra conta
        </a>
      </div>
      <p className="lo-motivo" role="status">
        {copiado === 'falhou' ? 'O navegador não deixou copiar: selecione o e-mail acima e copie à mão.' : ''}
      </p>
    </Entrada>
  )
}
