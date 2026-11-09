import { useId, useRef, useState } from 'react'
import type { RespostaDoBilhete, SalaDaMesa } from '../../dados/fonte'
import { enderecoDeEntrada, enderecoDoBotao } from '../../dados/rotas'
import type { EstadoDaCampanha } from '../../dados/sessaoDaCampanha'
import { useDoSite, useSite } from '../contexto'
import { Icone } from '../Icone'
import { motivoDaSoLeitura, useSoLeitura } from '../VerComo'

/**
 * "ENTRAR NA MESA AGORA" (pedido de 06/11/2026, fatia B6): quando o mestre
 * abre a sala no app, o lobby mostra a mesa acesa e o botão. Um clique abre a
 * tela do jogador já com o código e o nome da conta, sem digitar nem PIN.
 *
 * O caminho do clique, nesta ordem:
 * 1. a aba nova abre NO PRÓPRIO clique (depois de um `await` o navegador a
 *    barraria como pop-up) e perde o `opener` na hora: a tela do jogador não
 *    alcança o Lobby por ela;
 * 2. o site pede o convite (`POST /api/c/:id/bilhete`), que vale 2 minutos;
 * 3. a aba vai para `<endereço>/player#entrar=<convite>`: o convite só no
 *    fragmento (`enderecoDeEntrada`), que não vai ao servidor nem ao Referer.
 *    O site não mostra, não copia e não guarda o convite.
 * Recusado, a aba fecha e a recusa aparece embaixo do botão, que volta a valer.
 *
 * O botão abre o túnel quando há (plano B do Local Network Access, que pode
 * barrar um site da internet abrindo o IP da rede local); o endereço da rede
 * local aparece como texto, para quem está ao lado do mestre.
 */

type Passo =
  | { t: 'parado' }
  | { t: 'abrindo' }
  | { t: 'aberta' }
  | { t: 'erro'; texto: string }

/**
 * Sala sem link público: o Lobby só tem o endereço da rede local do mestre
 * (`http://10.x`/`192.168.x`), que ninguém de fora da rede dele alcança (relato
 * de 09/11/2026: jogador de longe, `10.81.0.5`, a aba esgotou o tempo).
 */
function soNaRedeLocal(sala: SalaDaMesa): boolean {
  return enderecoDoBotao(sala)?.tipo === 'lan'
}

const AVISO_AO_MESTRE =
  'Sua mesa está só na rede local: jogador de longe não entra por aqui. No app, em Convidar, clique em Tornar pública; quando o link público ficar pronto, o botão dos jogadores passa a usá-lo sozinho.'

/** O relógio do Lobby e o daqui podem divergir: a espera mostrada fica entre 1 s e 1 min. */
const ESPERA_MIN_S = 1
const ESPERA_MAX_S = 60

function textoDaRecusa(resposta: Exclude<RespostaDoBilhete, { ok: true }>, sala: SalaDaMesa): string {
  switch (resposta.motivo) {
    case 'sem-login':
      return 'Sua entrada no Lobby venceu. Recarregue a página e clique de novo.'
    case 'sem-sala':
      return 'A mesa acabou de fechar no app. Quando o mestre abrir de novo, o botão volta.'
    case 'sem-convite':
      return `Sua conta não recebe convite. Entre pela tela do jogador com o código ${sala.codigo}.`
    case 'fora-da-mesa':
      return 'O convite é só para quem joga nesta mesa.'
    case 'ritmo': {
      const segundos = Math.min(ESPERA_MAX_S, Math.max(ESPERA_MIN_S, Math.ceil((resposta.tentarDepoisDe - Date.now()) / 1000)))
      return `Convites demais em pouco tempo. Tente de novo em ${segundos} s.`
    }
    case 'rede':
      return 'O convite não chegou: sem conexão com o Lobby. Tente de novo.'
    case 'servidor':
      return 'O Lobby não deu o convite agora. Tente de novo em instantes.'
  }
}

/**
 * Enquanto o convite não chega, a aba em branco diz o que está acontecendo, nas
 * cores do site (lidas dos tokens daqui: a aba nova não tem a folha de estilo).
 * A aba nasce da mesma origem (`about:blank`), então dá para escrever nela.
 */
function escreverNaAba(aba: Window, titulo: string, texto: string): void {
  try {
    const tokens = getComputedStyle(document.documentElement)
    const doc = aba.document
    doc.title = titulo
    doc.documentElement.style.colorScheme = 'dark'
    doc.body.style.margin = '0'
    doc.body.style.minHeight = '100vh'
    doc.body.style.display = 'grid'
    doc.body.style.placeItems = 'center'
    doc.body.style.padding = tokens.getPropertyValue('--lb-space-6')
    doc.body.style.background = tokens.getPropertyValue('--lb-color-ink')
    doc.body.style.color = tokens.getPropertyValue('--lb-color-parchment')
    doc.body.style.fontFamily = tokens.getPropertyValue('--lb-font-sans')
    doc.body.style.fontSize = tokens.getPropertyValue('--lb-font-size-lg')
    const paragrafo = doc.createElement('p')
    paragrafo.style.maxWidth = '60ch'
    paragrafo.style.margin = '0'
    paragrafo.style.lineHeight = '1.5'
    paragrafo.textContent = texto
    doc.body.replaceChildren(paragrafo)
  } catch {
    // A aba já saiu desta origem ou fechou: não há o que escrever.
  }
}

export function EntrarNaMesa({ campanha }: { campanha: EstadoDaCampanha }) {
  const sala = campanha.sala
  // Quem já via a mesa aberta ao chegar no lobby vê o cartão parado; só a abertura com a página aberta entra com movimento.
  const jaEstava = useRef<boolean | null>(null)
  if (jaEstava.current === null) jaEstava.current = sala !== null
  if (sala === null) {
    jaEstava.current = false
    return null
  }
  const entra = !jaEstava.current
  return campanha.eu?.papel === 'mestre' ? <SalaDoMestre sala={sala} entra={entra} /> : <ConviteDoJogador campanha={campanha} sala={sala} entra={entra} />
}

/** O mestre não leva convite (entra pelo app): vê que os jogadores já têm o botão. */
function SalaDoMestre({ sala, entra }: { sala: SalaDaMesa; entra: boolean }) {
  const tituloId = useId()
  return (
    <section className="lo-entrar" data-entra={entra ? '1' : undefined} aria-labelledby={tituloId}>
      <div className="lo-entrar__texto">
        <p className="lo-entrar__agora">
          <span className="lo-ponto" aria-hidden="true" /> Aberta agora no seu app
        </p>
        <h2 className="lo-entrar__titulo" id={tituloId}>
          Sua mesa está aberta
        </h2>
        <p className="lo-entrar__sub">
          Os jogadores veem aqui o botão Entrar na mesa agora e entram com a conta deles, sem código nem PIN. Código da sala: <b className="lo-entrar__codigo">{sala.codigo}</b>.
        </p>
      </div>
      {soNaRedeLocal(sala) && <p className="lo-entrar__rede">{AVISO_AO_MESTRE}</p>}
    </section>
  )
}

function ConviteDoJogador({ campanha, sala, entra }: { campanha: EstadoDaCampanha; sala: SalaDaMesa; entra: boolean }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const tituloId = useId()
  const avisoId = useId()
  const motivoId = useId()
  // "Ver como": o convite sairia para a conta do mestre, não para a do jogador. O botão fica, desligado, com o porquê.
  const soLeitura = useSoLeitura()
  const [passo, setPasso] = useState<Passo>({ t: 'parado' })
  /** O clique já em voo: um segundo clique (ou Enter repetido) não abre outra aba nem pede outro convite. */
  const emVoo = useRef(false)
  const doBotao = enderecoDoBotao(sala)
  const daRede = sala.enderecos.find((endereco) => endereco.tipo === 'lan')
  const mestre = campanha.membros.find((membro) => membro.papel === 'mestre')
  const nome = campanha.eu?.nome ?? 'você'

  async function entrar(): Promise<void> {
    if (emVoo.current || soLeitura !== null) return
    // No próprio clique, antes de qualquer `await`: depois dele o navegador barraria a aba como pop-up.
    const aba = window.open('', '_blank')
    if (aba === null) {
      setPasso({ t: 'erro', texto: 'O navegador barrou a aba nova. Permita pop-ups deste site e clique de novo.' })
      return
    }
    aba.opener = null
    emVoo.current = true
    escreverNaAba(aba, 'Entrando na mesa…', `Abrindo a mesa como ${nome}…`)
    setPasso({ t: 'abrindo' })
    try {
      const resposta = await site.fonte.pedirBilhete(campanha.campanhaId)
      // A pessoa fechou a aba antes do convite chegar: não abre outra sozinho.
      if (aba.closed) {
        setPasso({ t: 'parado' })
        return
      }
      if (!resposta.ok) {
        aba.close()
        setPasso({ t: 'erro', texto: textoDaRecusa(resposta, sala) })
        return
      }
      const endereco = enderecoDoBotao(resposta.sala)
      const url = endereco === null ? null : enderecoDeEntrada(endereco, resposta.bilhete)
      if (endereco === null || url === null) {
        aba.close()
        setPasso({ t: 'erro', texto: `O Lobby mandou um endereço que o site não abre. Entre pela tela do jogador com o código ${resposta.sala.codigo}.` })
        return
      }
      if (demo) {
        // A demo não sai do navegador: a aba conta o que a de verdade abriria, sem o convite.
        escreverNaAba(aba, 'Entrar na mesa (demo)', `Na mesa de verdade, esta aba abriria ${endereco.url} já entrando como ${nome}, sem código nem PIN. Na demo nada sai do navegador.`)
      } else {
        aba.location.replace(url)
      }
      setPasso({ t: 'aberta' })
    } finally {
      emVoo.current = false
    }
  }

  const abrindo = passo.t === 'abrindo'
  return (
    <section className="lo-entrar" data-entra={entra ? '1' : undefined} aria-labelledby={tituloId}>
      <div className="lo-entrar__texto">
        <p className="lo-entrar__agora">
          <span className="lo-ponto" aria-hidden="true" /> {mestre !== undefined ? `Aberta agora no app de ${mestre.nome}` : 'Aberta agora no app do mestre'}
        </p>
        <h2 className="lo-entrar__titulo" id={tituloId}>
          A mesa está aberta
        </h2>
        <p className="lo-entrar__sub">Entre com a sua conta, sem código nem PIN. A mesa abre em outra aba.</p>
      </div>
      <div className="lo-entrar__acao">
        <button
          type="button"
          className="lo-btn lo-btn--primario lo-btn--grande lo-entrar__botao"
          disabled={soLeitura !== null}
          aria-disabled={abrindo ? 'true' : undefined}
          aria-describedby={soLeitura !== null ? motivoId : passo.t === 'erro' ? avisoId : undefined}
          onClick={() => void entrar()}
        >
          {abrindo ? <span className="lo-giro lo-entrar__giro" aria-hidden="true" /> : <Icone nome="entrar" />}
          {abrindo ? 'Abrindo a mesa…' : 'Entrar na mesa agora'}
        </button>
        {soLeitura !== null && (
          <p className="lo-motivo lo-entrar__aviso" id={motivoId}>
            {motivoDaSoLeitura(soLeitura.nome)} O convite entraria com a sua conta, não com a de {soLeitura.nome}.
          </p>
        )}
        {passo.t === 'erro' && (
          <p className="lo-erro-campo lo-entrar__aviso" id={avisoId} role="alert">
            {passo.texto}
          </p>
        )}
        {passo.t === 'aberta' && (
          <p className="lo-entrar__feito" role="status">
            <Icone nome="visto" /> {demo ? 'A aba nova mostra o que a mesa de verdade abriria.' : `A mesa abriu em outra aba, com você entrando como ${nome}.`}
          </p>
        )}
      </div>
      {doBotao?.tipo === 'tunel' && daRede !== undefined && (
        <p className="lo-entrar__rede">
          Na mesma rede do mestre? A tela do jogador também abre em <span className="lo-entrar__url">{daRede.url}</span>, com o código <b className="lo-entrar__codigo">{sala.codigo}</b>.
        </p>
      )}
      {doBotao?.tipo === 'lan' && (
        <p className="lo-entrar__rede">
          <b>Esta mesa está aberta só na rede local do mestre.</b> O botão só funciona para quem está na mesma rede que o computador dele (o mesmo Wi-Fi
          ou cabo); de longe, a aba fica carregando até dar erro. Está longe? Peça {mestre !== undefined ? `a ${mestre.nome}` : 'ao mestre'} para clicar
          em Tornar pública no app (Convidar) e volte aqui. Na mesma rede, se o navegador perguntar se este site pode acessar a rede local, permita.
        </p>
      )}
    </section>
  )
}
