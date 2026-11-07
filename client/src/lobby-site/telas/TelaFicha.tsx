import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from 'react'
import { aplicarAjuste, comAjustes, type Ajuste } from '../../lib/ajusteDaFicha'
import { alvoDoCaminho, quemEscreveAMudanca } from '../../lib/nuvem/caminho'
import { diferencas } from '../../lib/nuvem/diferencas'
import type { Json } from '../../lib/nuvem/json'
import type { Mudanca } from '../../lib/nuvem/tipos'
import type { Personagem } from '../../lib/personagem'
import type { TokenDoPersonagem } from '../../net/protocoloDoPersonagem'
import { PlayerFicha, type InventarioDoJogador } from '../../player/PlayerFicha'
import type { AjustePendente, EnvioDePersonagem, SalvarPersonagem } from '../../player/playerConnection'
import type { FichaDoSite, EstadoDaCampanha } from '../dados/sessaoDaCampanha'
import { enderecoDaRota, type AbaDaFicha, type Rota } from '../dados/rotas'
import { aoClicarNoLink, fonteDaDemo, useDoSite, useSistemaDoLobby, useSite } from './contexto'
import { Decisoes, DecisoesSemFicha } from './Decisoes'
import { enviarMudancas, revDeAgora, textoDaFalha } from './enviar'
import { AvisoDaPagina, Carregando } from './Estados'
import { Icone } from './Icone'
import { PainelHistorico } from './PainelHistorico'
import { PainelMochila } from './PainelMochila'

/**
 * A FICHA (protótipo, tela 4, com 5, 6 e 7 dentro): a cabeça da ficha, os
 * avisos que pedem decisão, as abas (Ficha, Mochila, Histórico) e o painel.
 * A aba Ficha é a MESMA ficha do jogador no app (`PlayerFicha`): o "Salvar"
 * vira as mudanças da S2, só leitura na ficha de um colega.
 */

type RotaDaFicha = Extract<Rota, { tela: 'ficha' }>

const SEM_TOKENS: readonly TokenDoPersonagem[] = []
const ABAS: readonly { id: AbaDaFicha; nome: string }[] = [
  { id: 'ficha', nome: 'Ficha' },
  { id: 'mochila', nome: 'Mochila' },
  { id: 'historico', nome: 'Histórico' },
]
const SEM_IMAGEM_PELO_LOBBY = 'Trocar a imagem pelo Lobby ainda não dá: peça ao mestre para trocar no app.'
const IMAGEM_FICOU_DE_FORA = 'A imagem nova não foi enviada: trocar a imagem pelo Lobby ainda não dá (peça ao mestre para trocar no app). O resto foi salvo.'

/** O cartão (e os subcartões dele) sem a imagem. */
function cartaoSemImagem(valor: Json | undefined): Json | undefined {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return valor
  const { imagem: _imagem, ...resto } = valor
  const subcartoes = resto.subcartoes
  return Array.isArray(subcartoes) ? { ...resto, subcartoes: subcartoes.map((sub) => cartaoSemImagem(sub) ?? null) } : resto
}

/**
 * Troca de imagem pelo Lobby fica para depois (pergunta 12.4): o retrato e a
 * imagem de cartão colados ou tirados na edição não viram mudança (o servidor
 * as recusaria), e o cartão novo vai sem a imagem. `tirou` = havia alguma.
 * Para o jogador o `diferencas` já faz isso calado; aqui vale também para o
 * mestre no site, e o `tirou` vira o aviso na tela.
 */
function semImagens(mudancas: readonly Mudanca[]): { mudancas: Mudanca[]; tirou: boolean } {
  let tirou = false
  const restantes: Mudanca[] = []
  for (const mudanca of mudancas) {
    const regra = alvoDoCaminho(mudanca.caminho)?.regra
    if (regra === 'retrato' || regra === 'imagemDoCartao') {
      tirou = true
    } else if (regra === 'cartao' && mudanca.acao === 'criar' && quemEscreveAMudanca(mudanca) === 'mestre') {
      tirou = true
      restantes.push({ ...mudanca, valor: cartaoSemImagem(mudanca.valor) })
    } else {
      restantes.push(mudanca)
    }
  }
  return { mudancas: restantes, tirou }
}

export function TelaFicha({ rota }: { rota: RotaDaFicha }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const sistema = useSistemaDoLobby()
  const campanha = useDoSite((estado) => estado.campanha)
  const erroDaCampanha = useDoSite((estado) => estado.erroDaCampanha)
  const voltar = { tela: 'campanha', campanhaId: rota.campanhaId } as const

  if (erroDaCampanha !== null) return <AvisoDaPagina titulo="Não deu para abrir a mesa">{<p>{erroDaCampanha}</p>}</AvisoDaPagina>
  if (campanha?.conexao === 'sem-acesso') {
    return (
      <AvisoDaPagina
        titulo="Você não está nesta mesa"
        acoes={
          <a className="lo-btn" href={enderecoDaRota({ tela: 'campanhas' }, demo)} onClick={aoClicarNoLink(site, { tela: 'campanhas' })}>
            Ver suas mesas
          </a>
        }
      >
        <p>Peça ao mestre para te convidar de novo com este e-mail.</p>
      </AvisoDaPagina>
    )
  }
  if (campanha === null || campanha.campanhaId !== rota.campanhaId || !campanha.carregada) return <Carregando texto="Abrindo a ficha…" />
  const ficha = campanha.fichas.find((candidata) => candidata.doc.id === rota.fichaId)
  if (ficha === undefined) {
    return (
      <AvisoDaPagina
        titulo="Esta ficha não está aqui"
        acoes={
          <a className="lo-btn lo-btn--primario" href={enderecoDaRota(voltar, demo)} onClick={aoClicarNoLink(site, voltar)}>
            Voltar à mesa
          </a>
        }
        depois={<DecisoesSemFicha campanha={campanha} sistema={sistema} fichaId={rota.fichaId} />}
      >
        <p>O mestre pode ter apagado a ficha, ou ela é só dele. As outras fichas da mesa continuam lá.</p>
      </AvisoDaPagina>
    )
  }
  return <FichaAberta key={ficha.doc.id} rota={rota} campanha={campanha} ficha={ficha} />
}

function FichaAberta({ rota, campanha, ficha }: { rota: RotaDaFicha; campanha: EstadoDaCampanha; ficha: FichaDoSite }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const sistema = useSistemaDoLobby()
  const nomeDaMesa = useDoSite((estado) => (estado.eu.t === 'pronto' ? (estado.eu.eu.campanhas.find((linha) => linha.campanhaId === campanha.campanhaId)?.nomeDaCampanha ?? 'A mesa') : 'A mesa'))
  const voltar: Rota = { tela: 'campanha', campanhaId: campanha.campanhaId }
  const pode = ficha.ehMinha
  const offline = campanha.conexao !== 'em-dia'
  const bandaRef = useRef<HTMLDivElement>(null)
  const alto = useAlturaAcima(bandaRef, rota.aba === 'ficha')

  const rotaDaAba = (aba: AbaDaFicha): Rota => ({ tela: 'ficha', campanhaId: campanha.campanhaId, fichaId: ficha.doc.id, aba })
  const listaDeAbas = useRef<HTMLDivElement>(null)
  // Setas e Home/End andam entre as abas (padrão de abas do WAI-ARIA), e a aba nova já abre.
  function teclaNasAbas(evento: KeyboardEvent<HTMLDivElement>) {
    const atual = ABAS.findIndex((aba) => aba.id === rota.aba)
    const destino =
      evento.key === 'ArrowRight' ? (atual + 1) % ABAS.length : evento.key === 'ArrowLeft' ? (atual - 1 + ABAS.length) % ABAS.length : evento.key === 'Home' ? 0 : evento.key === 'End' ? ABAS.length - 1 : null
    if (destino === null) return
    evento.preventDefault()
    site.irPara(rotaDaAba(ABAS[destino].id))
    requestAnimationFrame(() => listaDeAbas.current?.querySelector<HTMLElement>(`#aba-${ABAS[destino].id}`)?.focus())
  }

  const quantidadeNaMochila = ficha.doc.mochila?.length ?? 0
  const dono = ficha.nomeDoDono

  return (
    <div className="lo-pagina lo-pagina--ficha" data-aba={rota.aba}>
      <div className="lo-banda" ref={bandaRef}>
        <header className="lo-cab-ficha">
          <a className="lo-voltar" href={enderecoDaRota(voltar, demo)} onClick={aoClicarNoLink(site, voltar)}>
            <Icone nome="voltar" /> {nomeDaMesa}
          </a>
          <div className="lo-cab-ficha__linha">
            <h1 className="lo-titulo">{ficha.doc.nome}</h1>
            {pode ? (
              <span className="lo-tag lo-tag--sua">Sua ficha</span>
            ) : (
              <span className="lo-tag">
                <Icone nome="olho" /> Só ver
              </span>
            )}
            {ficha.naoAceita && <span className="lo-tag lo-tag--brasa">não aceito pelo servidor</span>}
          </div>
        </header>
        {!pode && (
          <div className="lo-linha-aviso">
            <Icone nome="olho" />
            <p>
              {dono === null ? (
                'Esta ficha não tem dono no Lobby. Você vê tudo, mas só o mestre muda.'
              ) : (
                <>
                  Ficha de <b>{dono}</b>. Você vê tudo, mas só {dono} e o mestre mudam.
                </>
              )}
            </p>
          </div>
        )}
        {pode && offline && (
          <div className="lo-linha-aviso" data-tom="mare">
            <Icone nome="sem-rede" />
            <p>
              <b>Sem internet.</b> Dá para ver tudo, mas mudanças novas ficam pausadas até a conexão voltar. As que já estavam a caminho estão guardadas neste navegador.
            </p>
          </div>
        )}
        <Decisoes campanha={campanha} fichaId={ficha.doc.id} nome={ficha.doc.nome} doc={ficha.doc} sistema={sistema} />
        {demo && pode && <DemoDoMestre campanha={campanha} ficha={ficha.doc} />}
        <div className="lo-abas" role="tablist" aria-label="Partes da ficha" ref={listaDeAbas} onKeyDown={teclaNasAbas}>
          {ABAS.map((aba) => (
            <a
              key={aba.id}
              role="tab"
              className="lo-aba"
              id={`aba-${aba.id}`}
              href={enderecoDaRota(rotaDaAba(aba.id), demo)}
              onClick={aoClicarNoLink(site, rotaDaAba(aba.id))}
              aria-selected={rota.aba === aba.id}
              aria-controls="painel-da-ficha"
              tabIndex={rota.aba === aba.id ? 0 : -1}
            >
              {aba.nome}
              {aba.id === 'mochila' && <span className="lo-aba__conta">{quantidadeNaMochila}</span>}
            </a>
          ))}
        </div>
      </div>
      <div className="lo-painel" role="tabpanel" id="painel-da-ficha" aria-labelledby={`aba-${rota.aba}`}>
        {rota.aba === 'ficha' && (
          <div className="lo-casca-da-ficha" style={{ '--pp-alarm-space': `${alto}px` } as CSSProperties}>
            <FichaNoPlayer campanha={campanha} ficha={ficha} aoFechar={() => site.irPara(voltar)} />
          </div>
        )}
        {rota.aba === 'mochila' && <PainelMochila campanha={campanha} ficha={ficha} />}
        {rota.aba === 'historico' && <PainelHistorico campanha={campanha} ficha={ficha} />}
      </div>
    </div>
  )
}

/**
 * Até onde vai o que fica ACIMA da ficha (a cabeça do site, a da ficha, os
 * avisos e as abas): a ficha do app é uma tela fixa, e começa logo abaixo.
 *
 * A faixa de avisos do mestre (`FaixaDeAvisos`) mora no `<main>`, ANTES da
 * página: entrar, sair ou encolher empurra a banda sem mudar o tamanho dela, e
 * só observar a banda deixava a medida velha (a ficha cobria as abas quando o
 * aviso chegava depois; sobrava um vão quando ele era lido). Por isso cada
 * filho do `<main>` também é observado, e um filho que entra ou sai mede de novo.
 */
function useAlturaAcima(bandaRef: RefObject<HTMLDivElement | null>, ligado: boolean): number {
  const [alto, setAlto] = useState(0)
  useLayoutEffect(() => {
    const banda = bandaRef.current
    if (!ligado || banda === null) return
    const medir = () => setAlto(Math.max(0, Math.ceil(banda.getBoundingClientRect().bottom)))
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(banda)
    const cabeca = document.querySelector('.lo-cabeca')
    if (cabeca !== null) observador.observe(cabeca)
    const principal = banda.closest('.lo-principal')
    const filhos = new MutationObserver(observarOsFilhos)
    function observarOsFilhos() {
      if (principal === null) return
      for (const filho of principal.children) observador.observe(filho)
      medir()
    }
    if (principal !== null) {
      observarOsFilhos()
      filhos.observe(principal, { childList: true })
    }
    window.addEventListener('resize', medir)
    return () => {
      observador.disconnect()
      filhos.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [bandaRef, ligado])
  return alto
}

/** A ficha do app dentro do site: o "Salvar" e o −/+ viram mudanças na fila da S2. */
function FichaNoPlayer({ campanha, ficha, aoFechar }: { campanha: EstadoDaCampanha; ficha: FichaDoSite; aoFechar: () => void }) {
  const site = useSite()
  const sistema = useSistemaDoLobby()
  const [envio, setEnvio] = useState<EnvioDePersonagem | undefined>(undefined)
  const [pendentes, setPendentes] = useState<readonly AjustePendente[]>([])
  const [erro, setErro] = useState<string | null>(null)
  // Só o −/+ recusado volta a ficha ao que o servidor tem (o aviso "ajuste não confirmado" da ficha do app).
  const [ajusteFalhou, setAjusteFalhou] = useState(false)
  const contador = useRef(0)
  // A rev de quando a edição abriu: a base das mudanças do "Salvar" (o servidor vê o que mudou depois dela).
  const revDaEdicao = useRef<number | null>(null)
  const papel = campanha.eu?.papel ?? 'jogador'
  const emDia = campanha.conexao === 'em-dia'
  const personagens = useMemo(() => [ficha.doc], [ficha.doc])
  const inventario = useMemo((): InventarioDoJogador => ({ itens: ficha.doc.mochila ?? [], colegas: [] }), [ficha.doc.mochila])

  const aoAbrirEdicao = useCallback(() => {
    revDaEdicao.current = revDeAgora(site)
  }, [site])

  /** "Livro" e "Escolher do livro": pede o livro pelo canal da campanha. Sem sessão aberta, não saiu. */
  function pedirLivro(): boolean {
    const sessao = site.sessao()
    return sessao !== null && sessao.pedirLivro()
  }

  function salvar(base: Personagem, rascunho: Personagem): SalvarPersonagem {
    if (!emDia) return { ok: false, erro: 'Sem internet: a edição fica pausada até a conexão voltar. O que você escreveu continua aqui.' }
    // Como o mestre, a diferença inclui a imagem: é por ela que a tela sabe se a imagem ficou de fora.
    const doMestre = semImagens(diferencas(base, rascunho, { papel: 'mestre' }))
    const mudancas = papel === 'mestre' ? doMestre.mudancas : diferencas(base, rascunho, { papel })
    setErro(doMestre.tirou ? IMAGEM_FICOU_DE_FORA : null)
    if (mudancas.length === 0) return { ok: true, nada: true }
    const baseRev = revDaEdicao.current ?? campanha.rev
    contador.current += 1
    const id = contador.current
    setEnvio({ id, tipo: 'salvar', personagemId: base.id, pendentes: ['fila'], falhou: false })
    void enviarMudancas(site, mudancas, baseRev).then((resultado) => {
      if (!resultado.ok) setErro(textoDaFalha(resultado))
      setEnvio({ id, tipo: 'salvar', personagemId: base.id, pendentes: [], falhou: !resultado.ok })
    })
    return { ok: true, nada: false }
  }

  function ajustar(personagemId: string, ajuste: Ajuste): boolean {
    if (!emDia) return false
    const baseRev = revDeAgora(site)
    if (baseRev === null) return false
    // O valor do ajuste é absoluto: parte da ficha como ela aparece (com os cliques que ainda vão).
    const atual = comAjustes(ficha.doc, sistema, pendentes.filter((pendente) => pendente.personagemId === personagemId))
    const mudancas = diferencas(atual, aplicarAjuste(atual, sistema, ajuste), { papel })
    if (mudancas.length === 0) return true
    const pendente: AjustePendente = { ...ajuste, personagemId }
    setErro(null)
    setAjusteFalhou(false)
    setPendentes((lista) => [...lista, pendente])
    void enviarMudancas(site, mudancas, baseRev).then((resultado) => {
      setPendentes((lista) => lista.filter((outro) => outro !== pendente))
      if (resultado.ok) return
      setErro(textoDaFalha(resultado))
      setAjusteFalhou(true)
    })
    return true
  }

  return (
    <>
      {erro !== null && (
        <p className="lo-erro-campo lo-erro-da-ficha" role="alert">
          {erro}
        </p>
      )}
      <PlayerFicha
        sistema={sistema}
        personagens={personagens}
        tokens={SEM_TOKENS}
        envio={envio}
        onCriar={() => false}
        onSalvar={salvar}
        onAjustar={ajustar}
        ajustesPendentes={pendentes}
        ajusteFalhou={ajusteFalhou && pendentes.length === 0}
        onClose={aoFechar}
        escolherImagem={() => Promise.reject(new Error(SEM_IMAGEM_PELO_LOBBY))}
        inventarioDe={() => inventario}
        somenteLeitura={!ficha.ehMinha}
        aoAbrirEdicao={aoAbrirEdicao}
        // O livro do sistema publicado (F1): o resumo veio no `estado` e o livro vem sob pedido, como na sala LAN.
        // Sem resumo (`null`), sem "Livro"; o sistema de recuo (One Piece embutido) já traz o livro dentro.
        resumoDoLivro={campanha.livro === null ? undefined : campanha.livro}
        livroDeRegras={campanha.livroDeRegras}
        onPedirLivro={pedirLivro}
      />
    </>
  )
}

/**
 * SÓ NA DEMONSTRAÇÃO: o conflito do protótipo (tela 5) sem precisar de dois
 * aparelhos. O mestre grava um HP no servidor e, um instante depois, chega a
 * sua mudança no mesmo HP, feita sobre a ficha de antes.
 */
function DemoDoMestre({ campanha, ficha }: { campanha: EstadoDaCampanha; ficha: Personagem }) {
  const site = useSite()
  const [nota, setNota] = useState<string | null>(null)
  const fonte = fonteDaDemo(site)
  if (fonte === null) return null
  const emDia = campanha.conexao === 'em-dia'

  function simular() {
    if (fonte === null) return
    const baseRev = revDeAgora(site)
    if (baseRev === null) return
    const atual = ficha.recursos.hp ?? 0
    const doMestre = atual === 25 ? 26 : 25
    const minha = atual === 22 ? 21 : 22
    if (!fonte.simularMudancaDoMestre(campanha.campanhaId, ficha.id, ['recursos', 'hp'], doMestre)) {
      setNota('O servidor da demonstração não aceitou a mudança do mestre.')
      return
    }
    setNota(null)
    void enviarMudancas(site, [{ fichaId: ficha.id, caminho: ['recursos', 'hp'], acao: 'definir', valor: minha }], baseRev).then((resultado) => {
      if (!resultado.ok) setNota(textoDaFalha(resultado))
    })
  }

  return (
    <aside className="lo-demo" aria-label="Demonstração (não existe no site de verdade)">
      <span className="lo-demo__selo">Demonstração</span>
      <button type="button" className="lo-btn lo-btn--fantasma" onClick={simular} disabled={!emDia}>
        Simular: o mestre muda o HP junto com você
      </button>
      {!emDia && <span className="lo-motivo">Precisa da conexão (o conflito chega pelo servidor).</span>}
      {nota !== null && <span className="lo-motivo">{nota}</span>}
    </aside>
  )
}
