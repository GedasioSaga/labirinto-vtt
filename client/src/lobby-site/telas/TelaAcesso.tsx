import { useId, useState, type ReactNode } from 'react'
import type { CargaDoEu } from '../dados/lobbyStore'
import { useSite } from './contexto'
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
  return <SemResposta carga={carga} />
}

type FalhaDoEu = Extract<CargaDoEu, { t: 'erro' }>

/** A partir de quantas falhas (a da abertura conta) a tela diz o que fazer além de tentar. */
const FALHAS_ATE_O_CONSELHO = 2

/** O que fazer quando tentar de novo não resolve. */
function conselhoDepoisDeFalhar(tipo: FalhaDoEu['tipo']): string {
  if (tipo === 'rede') return 'Ainda sem conexão. Se outros sites abrem normalmente, o Lobby pode estar fora do ar: avise o mestre. O que você mudou continua guardado neste navegador.'
  if (tipo === 'formato') return 'Continua igual. Recarregue a página para trazer a versão nova do site; se não resolver, avise o mestre.'
  return 'Continua sem resposta. Avise o mestre: o servidor do Lobby pode estar fora do ar.'
}

/**
 * O Lobby não respondeu (ou respondeu torto). "Tentar de novo" pede a lista
 * de mesas outra vez SEM recarregar a página (recarregar piscava a tela e
 * voltava ao mesmo erro sem sinal de que tentou); o botão mostra que está
 * tentando, e depois da segunda falha a tela diz o que fazer.
 */
function SemResposta({ carga }: { carga: FalhaDoEu }) {
  const site = useSite()
  const [tentando, setTentando] = useState(false)
  // A abertura do site já foi a primeira falha.
  const [falhas, setFalhas] = useState(1)

  function tentar() {
    setTentando(true)
    void site.tentarOEuDeNovo().then(() => {
      setTentando(false)
      setFalhas((antes) => antes + 1)
    })
  }

  const rede = carga.tipo === 'rede'
  const titulo = rede ? 'Sem conexão com o Lobby' : 'O Lobby não respondeu direito'
  const texto = rede ? 'Confira a internet e tente de novo. Nada do que você mudou se perdeu.' : `${carga.detalhe} Tente de novo daqui a pouco.`
  const aconselhar = !tentando && falhas >= FALHAS_ATE_O_CONSELHO
  return (
    <Entrada titulo={titulo} texto={texto}>
      <div className="lo-porta__acoes">
        <button type="button" className="lo-btn lo-btn--primario" disabled={tentando} aria-busy={tentando} onClick={tentar}>
          {tentando ? 'Tentando…' : 'Tentar de novo'}
        </button>
        {aconselhar && carga.tipo === 'formato' && (
          <button type="button" className="lo-btn" onClick={() => window.location.reload()}>
            Recarregar a página
          </button>
        )}
      </div>
      <p className="lo-motivo" role="status">
        {aconselhar ? conselhoDepoisDeFalhar(carga.tipo) : ''}
      </p>
      {/* No servidor de teste (vite, porta 1430) não existe o `/api/eu`: tentar nunca resolve. Só aparece no dev. */}
      {import.meta.env.DEV && !rede && (
        <p className="lo-porta__miuda">
          Servidor de teste: aqui não existe o Lobby de verdade. Rode com <code>wrangler pages dev</code> ou abra a <a href="?demo=1">demonstração</a>.
        </p>
      )}
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
