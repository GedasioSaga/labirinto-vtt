import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { ABA_DAS_TECNICAS } from '../../lib/batalha/leituraDaFicha'
import { temConfira } from '../../lib/batalha/mecanica/conversao/comum'
import { converterFicha } from '../../lib/batalha/mecanica/conversao/ficha'
import { formaDecididaPeloMestre } from '../../lib/batalha/mecanica/formaDoMestre'
import type { FichaDaPrevia } from '../../lib/batalha/mecanica/resumo'
import { perdeuARegraAoSerTrazida } from '../../lib/batalha/mecanicasAMao'
import { temPonteDoApp } from '../../lib/foraDoApp'
import { abaTemCatalogo, cartaoDoCatalogo, itensDaAba, type ItemEscolhivel } from '../../lib/livroDeRegras'
import { cartoesDaAba, novoCartao, type CartaoDaFicha, type Personagem } from '../../lib/personagem'
import type { AbaDoSistema, SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { AcumuladoresNaFicha } from '../batalha/acumulador/AcumuladoresNaFicha'
import type { AoAbrirOEditor } from '../batalha/editor/EditorDaHabilidade'
import { cartaoNovoNoEditor } from '../batalha/editor/emBranco'
import type { QuemEditaNoEditor } from '../batalha/editor/gravarNoCartao'
import { PecaDoMestreNaForma } from '../batalha/FormasDoMestre'
import { SeloDeOculta } from '../batalha/HabilidadeOculta'
import type { QuemEditaAMecanica } from '../batalha/MecanicaDaTecnica'
import { EscolherDoLivro, type EstadoDaEscolha, type LivroDaFicha } from '../EscolherDoLivro'
import { ImagemOuIniciais } from '../FichaPecas'
import { TrazerDeOutraFicha } from '../TrazerDeOutraFicha'
import {
  abaDoCartaoNovo,
  abasDaLista,
  cartaoNoLugar,
  comCartoesNovos,
  comOCartaoDeVolta,
  comOCartaoGravado,
  comOCartaoMovido,
  ehForma,
  formaNova,
  linhasDaLista,
  lugarDoCartao,
  resumoDaLinha,
  semOCartao,
  tecnicasDaFicha,
  type CartaoTirado,
  type FiltroDaLista,
  type LinhaDaLista,
} from './listaDaFicha'
import { guardarNoCatalogoRegistrado } from './ponteDoCatalogo'
import './habilidades.css'

const EditorDaHabilidade = lazy(() => import('../batalha/editor/EditorDaHabilidade').then((modulo) => ({ default: modulo.EditorDaHabilidade })))
const PainelDeEnsaio = lazy(() => import('../ensaio/PainelDeEnsaio').then((modulo) => ({ default: modulo.PainelDeEnsaio })))

export interface ListaDeHabilidadesProps {
  /** Habilidades (tudo) ou Transformações (o filtro das formas). */
  filtro: FiltroDaLista
  /** A ficha em edição (o rascunho): toda mudança volta inteira por `onChange`; quem grava em disco é o Salvar da ficha. */
  personagem: Personagem
  sistema: SistemaDeRpg
  onChange: (personagem: Personagem) => void
  /** O mestre grava a mecânica; o dono, a proposta; `ninguem` só lê a lista (o editor não abre). */
  quemEdita: QuemEditaAMecanica
  /** O app do mestre esconde cartões dos jogadores (o site, não). */
  podeOcultar: boolean
  /** As fichas da pasta, para o "Trazer de outra ficha"; ausente = sem o botão. */
  outrasFichas?: readonly Personagem[]
  /** O livro que vem à parte (o jogador pede ao mestre). */
  livro?: LivroDaFicha
}

/** O cartão aberto no editor: o id e o que o editor faz ao abrir (o nome em foco, na habilidade que acabou de nascer). */
interface Aberto {
  id: string
  aoAbrir?: AoAbrirOEditor
}

function nomeParaFrase(cartao: CartaoDaFicha): string {
  const nome = cartao.nome.trim()
  return nome === '' ? 'a habilidade sem nome' : nome
}

function avisoDoQueVeio(novos: readonly CartaoDaFicha[], deQuem: string): string {
  if (novos.length === 1) return `${nomeParaFrase(novos[0])} veio de ${deQuem}. É uma cópia: mudar aqui não muda a ficha de ${deQuem}.`
  return `${novos.length} vieram de ${deQuem}. São cópias: mudar aqui não muda a ficha de ${deQuem}.`
}

/**
 * A LISTA DE HABILIDADES DA FICHA EM EDIÇÃO (rework das habilidades, E7; protótipo aprovado,
 * `telaFicha`, decisões 15 e 16): a aba Habilidades só lista. "+ Habilidade", tocar numa linha e
 * "Trazer de outra ficha" abrem o MESMO editor da página Habilidades da Biblioteca. A aba
 * Transformações é o filtro das formas ("+ Transformação" abre o editor já com a peça). A faixa
 * Acumuladores só mostra; tocar abre a habilidade dona. Não há campo solto de Ação, Efeito, Custo,
 * Tempo ou Dano: tudo isso mora no editor (uma coisa, um lugar).
 *
 * Para o mestre, a lista mostra a ficha já convertida na leitura (D11): a técnica antiga aparece
 * montada, com a etiqueta "Convertida: confira" enquanto a Descrição tiver linha "Confira". Nada é
 * gravado por isso; o cartão convertido só entra no rascunho quando o editor o grava.
 */
export function ListaDeHabilidades({ filtro, personagem, sistema, onChange, quemEdita, podeOcultar, outrasFichas, livro }: ListaDeHabilidadesProps) {
  const abas = abasDaLista(sistema)
  const editor: QuemEditaNoEditor | null = quemEdita === 'ninguem' ? null : quemEdita
  // A ficha como a lista e o editor a mostram: a do mestre convertida na leitura (pura, sem gravar); a do dono como está (a dele vai ao mestre como proposta).
  const convertida = useMemo(() => (quemEdita === 'mestre' ? converterFicha(personagem, sistema) : null), [personagem, sistema, quemEdita])
  const vista = convertida === null ? personagem : convertida.personagem
  const fichaDaPrevia = useMemo<FichaDaPrevia>(() => ({ personagem: vista, sistema }), [vista, sistema])
  const tecnicas = useMemo(() => tecnicasDaFicha(vista, sistema), [vista, sistema])
  const linhas = linhasDaLista(vista, filtro)

  const [aberto, setAberto] = useState<Aberto | null>(null)
  const [tirado, setTirado] = useState<CartaoTirado | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [testando, setTestando] = useState<string | null>(null)
  const [novas, setNovas] = useState<ReadonlySet<string>>(() => new Set())
  const [aviso, setAviso] = useState<string | null>(null)
  const [trazendo, setTrazendo] = useState(false)
  const [escolhendo, setEscolhendo] = useState(false)
  const botaoDeTrazer = useRef<HTMLButtonElement>(null)
  const botaoDoLivro = useRef<HTMLButtonElement>(null)
  // A ficha mais nova que esta lista mandou (ou recebeu): as gravações seguidas do editor somam, não se sobrescrevem.
  const ultimaFicha = useRef(personagem)
  ultimaFicha.current = personagem

  if (abas === null) return null
  const abaDoFiltro: AbaDoSistema = filtro === 'formas' ? abas.formas : abas.habilidades

  const lugarAberto = aberto === null ? null : lugarDoCartao(vista, aberto.id)
  const cartaoAberto = aberto === null || lugarAberto === null ? null : cartaoNoLugar(vista, lugarAberto, aberto.id)

  const abrir = (id: string, aoAbrir?: AoAbrirOEditor) => {
    if (editor === null) return
    setAviso(null)
    setAberto(aoAbrir === undefined ? { id } : { id, aoAbrir })
  }
  const fechar = () => setAberto(null)
  const nasceram = (ids: readonly string[]) => setNovas(new Set(ids))

  /**
   * O editor gravou: o cartão entra no rascunho no lugar dele (a forma nova muda de aba, D5). Serve
   * também ao "outro cartão" das ligações (D8: o requisito B3 da técnica da forma, o A4 da que o
   * acumulador libera), que mora nas mesmas duas abas.
   */
  const gravar = (novo: CartaoDaFicha) => {
    // O editor pode gravar este cartão e o outro na mesma vez: cada um parte do que o anterior deixou, não da ficha do último desenho.
    const base = ultimaFicha.current
    const lugar = lugarDoCartao(base, novo.id)
    if (lugar === null) return
    const proxima = comOCartaoGravado(base, lugar, novo)
    ultimaFicha.current = proxima
    onChange(proxima)
  }

  // "Guardar também no catálogo do livro" (D14): só no app do mestre, onde o catálogo mora no disco.
  // Quem grava vem registrado pela entrada do app (`ponteDoCatalogo.ts`): o site não pode importá-lo.
  const guardarRegistrado = guardarNoCatalogoRegistrado()
  const guardarNoCatalogo =
    quemEdita === 'mestre' && temPonteDoApp() && guardarRegistrado !== null
      ? (cartao: CartaoDaFicha) => {
          guardarRegistrado(cartao, sistema).then(setAviso, (erro: unknown) => setAviso(erro instanceof Error ? erro.message : String(erro)))
        }
      : undefined
  const relatorioDoAberto = aberto === null || convertida === null ? [] : convertida.relatorio.cartoes.filter((linha) => linha.cartaoId === aberto.id)

  const tirar = (id: string) => {
    const lugar = lugarDoCartao(personagem, id)
    const feito = lugar === null ? null : semOCartao(personagem, lugar, id)
    setConfirmando(null)
    if (feito === null) return
    if (aberto?.id === id) setAberto(null)
    if (testando === id) setTestando(null)
    setTirado(feito.tirado)
    onChange(feito.personagem)
  }
  const pedirTirar = (cartao: CartaoDaFicha) => (cartao.mecanica !== undefined || cartao.mecanicaProposta !== undefined ? setConfirmando(cartao.id) : tirar(cartao.id))
  const desfazer = () => {
    if (tirado === null) return
    onChange(comOCartaoDeVolta(personagem, tirado))
    setTirado(null)
  }

  const adicionar = () => {
    let cartao: CartaoDaFicha
    if (filtro === 'formas') cartao = formaNova(abas.formas.item, editor ?? 'mestre')
    else {
      const vazio = novoCartao(abas.habilidades.item)
      cartao = editor === null ? vazio : cartaoNovoNoEditor(vazio, editor, fichaDaPrevia)
    }
    nasceram([cartao.id])
    onChange(comCartoesNovos(personagem, abaDoFiltro.id, [cartao]))
    abrir(cartao.id, 'nome')
  }

  // "Escolher do livro": as habilidades do catálogo do sistema (ou ainda no mestre), como na lista de antes.
  const itens = itensDaAba(sistema.catalogos, abaDoFiltro.id)
  const noMestre = livro !== undefined && itens.length === 0 && abaTemCatalogo(livro.resumo, abaDoFiltro.id)
  const ofereceLivro = editor !== null && (itens.length > 0 || noMestre)
  const estadoDaEscolha: EstadoDaEscolha = !noMestre || livro.estado === 'pronto' ? 'pronto' : livro.estado === 'falhou' ? 'falhou' : 'chegando'
  const pedirLivro = () => {
    if (noMestre && (livro.estado === 'ausente' || livro.estado === 'falhou')) livro.pedir()
  }
  const fecharEscolha = () => {
    setEscolhendo(false)
    botaoDoLivro.current?.focus()
  }
  const escolher = (item: ItemEscolhivel) => {
    const cartao = cartaoDoCatalogo(abaDoFiltro, sistema, item)
    nasceram([cartao.id])
    onChange(comCartoesNovos(personagem, abaDoCartaoNovo(cartao, abaDoFiltro.id), [cartao]))
    setEscolhendo(false)
    abrir(cartao.id)
  }

  const ofereceTrazer = editor !== null && outrasFichas !== undefined
  const fecharTrazer = () => {
    setTrazendo(false)
    botaoDeTrazer.current?.focus()
  }
  /** As cópias entram no rascunho; uma só abre no editor (protótipo: "ela abre no editor e entra na ficha quando você salvar"). */
  const trazer = (novos: CartaoDaFicha[], deQuem: string) => {
    let proximo = personagem
    for (const cartao of novos) proximo = comCartoesNovos(proximo, abaDoCartaoNovo(cartao, abaDoFiltro.id), [cartao])
    onChange(proximo)
    nasceram(novos.map((cartao) => cartao.id))
    setTrazendo(false)
    setAviso(avisoDoQueVeio(novos, deQuem))
    const unico = novos.length === 1 ? novos[0] : undefined
    if (unico !== undefined) abrir(unico.id)
    else botaoDeTrazer.current?.focus()
  }
  const nomesDaAba = new Set(cartoesDaAba(personagem, abaDoFiltro.id).map((cartao) => cartao.nome.trim().toLocaleLowerCase('pt-BR')))

  return (
    <div className="lb-habs">
      {filtro === 'todas' ? (
        <AcumuladoresNaFicha personagem={vista} podeAbrir={(id) => editor !== null && lugarDoCartao(vista, id) !== null} onAbrirDona={(id) => abrir(id)} />
      ) : (
        <p className="lb-field__hint lb-habs__nota">Transformação é uma habilidade com a peça Transformação, montada no mesmo editor. Ela segue nesta aba, como sempre.</p>
      )}
      <div className="lb-habs__botoes">
        {editor !== null && (
          <button type="button" className="lb-btn lb-habs__mais" onClick={adicionar}>
            + {abaDoFiltro.item}
          </button>
        )}
        {ofereceLivro && (
          <button
            ref={botaoDoLivro}
            type="button"
            className="lb-btn lb-btn--ghost"
            aria-expanded={escolhendo}
            onClick={() => {
              setTrazendo(false)
              setEscolhendo(!escolhendo)
              if (!escolhendo) pedirLivro()
            }}
          >
            Escolher do livro
          </button>
        )}
        {ofereceTrazer && (
          <button
            ref={botaoDeTrazer}
            type="button"
            className="lb-btn lb-btn--ghost"
            aria-expanded={trazendo}
            onClick={() => {
              setEscolhendo(false)
              setAviso(null)
              setTrazendo(!trazendo)
            }}
          >
            Trazer de outra ficha
          </button>
        )}
      </div>
      {ofereceTrazer && trazendo && (
        <TrazerDeOutraFicha aba={abaDoFiltro} sistema={sistema} personagem={personagem} fichas={outrasFichas} nomesNaFicha={nomesDaAba} onTrazer={trazer} onFechar={fecharTrazer} />
      )}
      {ofereceLivro && escolhendo && (
        <EscolherDoLivro aba={abaDoFiltro} sistema={sistema} itens={itens} estado={estadoDaEscolha} nomesNaFicha={nomesDaAba} onTentarDeNovo={pedirLivro} onEscolher={escolher} onFechar={fecharEscolha} />
      )}
      {aviso !== null && (
        <p className="lb-trazer__veio" role="status">
          {aviso}
        </p>
      )}
      {tirado !== null && (
        <p className="lb-field__hint" role="status">
          {tirado.cartao.nome.trim() === '' ? 'A habilidade sem nome saiu da ficha.' : `${tirado.cartao.nome} saiu da ficha.`}{' '}
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={desfazer}>
            Desfazer
          </button>
        </p>
      )}
      {linhas.length === 0 ? (
        <p className="lb-ficha__vazio">{abaDoFiltro.vazio}</p>
      ) : (
        <ul className="lb-habs__lista">
          {linhas.map((linha) => (
            <LinhaDaHabilidade
              key={linha.cartao.id}
              linha={linha}
              cru={cartaoNoLugar(personagem, { abaId: linha.abaId, paiId: null }, linha.cartao.id)}
              personagem={personagem}
              vista={vista}
              sistema={sistema}
              ficha={fichaDaPrevia}
              aba={linha.abaId === abas.formas.id ? abas.formas : abas.habilidades}
              filtro={filtro}
              quemEdita={quemEdita}
              nova={novas.has(linha.cartao.id)}
              testando={testando === linha.cartao.id}
              confirmando={confirmando === linha.cartao.id}
              onAbrir={editor === null ? undefined : abrir}
              onTestar={() => setTestando(testando === linha.cartao.id ? null : linha.cartao.id)}
              onSubir={() => onChange(comOCartaoMovido(personagem, linha.abaId, linha.cartao.id, -1))}
              onDescer={() => onChange(comOCartaoMovido(personagem, linha.abaId, linha.cartao.id, 1))}
              onPedirTirar={editor === null ? undefined : pedirTirar}
              onTirar={tirar}
              onCancelarTirar={() => setConfirmando(null)}
              onGravar={gravar}
            />
          ))}
        </ul>
      )}
      {editor !== null && aberto !== null && cartaoAberto !== null && (
        <Suspense fallback={null}>
          <EditorDaHabilidade
            key={aberto.id}
            cartao={cartaoAberto}
            ficha={fichaDaPrevia}
            quemEdita={editor}
            tecnicas={tecnicas}
            podeOcultar={podeOcultar}
            onChange={gravar}
            onFechar={fechar}
            // O subcartão é técnica de dentro da forma: converte e grava como habilidade.
            abaDoCartao={lugarAberto === null || lugarAberto.paiId !== null ? ABA_DAS_TECNICAS : lugarAberto.abaId}
            relatorio={relatorioDoAberto}
            aoMudarOutroCartao={gravar}
            {...(aberto.aoAbrir === undefined ? {} : { aoAbrir: aberto.aoAbrir })}
            {...(guardarNoCatalogo === undefined ? {} : { guardarNoCatalogo })}
          />
        </Suspense>
      )}
    </div>
  )
}

interface LinhaDaHabilidadeProps {
  linha: LinhaDaLista
  /** O cartão como está no rascunho (a linha mostra o da vista, que pode estar convertido). */
  cru: CartaoDaFicha | null
  personagem: Personagem
  vista: Personagem
  sistema: SistemaDeRpg
  ficha: FichaDaPrevia
  aba: AbaDoSistema
  filtro: FiltroDaLista
  quemEdita: QuemEditaAMecanica
  nova: boolean
  testando: boolean
  confirmando: boolean
  /** Ausente = a lista só lê (sem editor). */
  onAbrir?: (id: string) => void
  onTestar: () => void
  onSubir: () => void
  onDescer: () => void
  onPedirTirar?: (cartao: CartaoDaFicha) => void
  onTirar: (id: string) => void
  onCancelarTirar: () => void
  onGravar: (cartao: CartaoDaFicha) => void
}

/** Uma linha: o nome, a ação, o custo e a frase (tocar abre o editor), mais Testar, Subir, Descer e Remover. */
function LinhaDaHabilidade({ linha, cru, personagem, vista, sistema, ficha, aba, filtro, quemEdita, nova, testando, confirmando, onAbrir, onTestar, onSubir, onDescer, onPedirTirar, onTirar, onCancelarTirar, onGravar }: LinhaDaHabilidadeProps) {
  const { cartao, abaId } = linha
  const resumo = resumoDaLinha(cartao, ficha)
  const semNome = cartao.nome.trim() === ''
  const nome = semNome ? 'Sem nome ainda' : cartao.nome
  const naAba = cartoesDaAba(personagem, abaId)
  const indice = naAba.findIndex((atual) => atual.id === cartao.id)
  const forma = ehForma(linha)
  const tecnica = abaId === ABA_DAS_TECNICAS
  // O "o mestre decide os números" da forma de texto (C6) mora na `mecanica` dela: só aparece enquanto a forma não tem peças.
  const comPecaDoMestre = forma && cru !== null && (cru.mecanica === undefined || formaDecididaPeloMestre(cru))
  return (
    <li className="lb-habs__linha" data-nova={nova ? '' : undefined}>
      <div className="lb-habs__topo">
        <button type="button" className="lb-habs__abrir" disabled={onAbrir === undefined} aria-label={onAbrir === undefined ? undefined : `Abrir ${semNome ? 'a habilidade sem nome' : cartao.nome} no editor`} onClick={() => onAbrir?.(cartao.id)}>
          {aba.imagem === true && (
            <span className="lb-habs__imagem">
              <ImagemOuIniciais imagem={cartao.imagem} nome={cartao.nome} />
            </span>
          )}
          <span className="lb-habs__texto">
            <span className="lb-habs__nome">
              <strong data-sem-nome={semNome ? '' : undefined}>{nome}</strong>
              {resumo.acao !== null && <span className="lb-ficha__chip">{resumo.acao}</span>}
              {resumo.custo !== null && <span className="lb-ficha__chip lb-ficha__chip--etiqueta">{resumo.custo}</span>}
              {filtro === 'todas' && forma && <span className="lb-ficha__chip lb-habs__chip-forma">Transformação</span>}
              {quemEdita === 'mestre' && temConfira(cartao) && <span className="lb-ficha__chip lb-habs__chip-confira">Convertida: confira</span>}
              {cartao.mecanicaProposta !== undefined && <span className="lb-ficha__chip lb-ficha__chip--etiqueta">{quemEdita === 'mestre' ? 'Proposta do dono' : 'Proposta esperando o mestre'}</span>}
            </span>
            <span className="lb-habs__resumo">{resumo.frase}</span>
          </span>
        </button>
        <SeloDeOculta cartao={cartao} />
        <span className="lb-habs__acoes">
          {onAbrir !== undefined && (
            <button type="button" className="lb-btn lb-btn--compact" onClick={() => onAbrir(cartao.id)}>
              Editar
            </button>
          )}
          {tecnica && (
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" aria-pressed={testando} aria-label={`Testar ${nomeParaFrase(cartao)} no boneco`} onClick={onTestar}>
              {testando ? 'Fechar teste' : 'Testar'}
            </button>
          )}
          {onPedirTirar !== undefined && (
            <>
              <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" disabled={indice <= 0} aria-label={`Subir ${nomeParaFrase(cartao)}`} onClick={onSubir}>
                Subir
              </button>
              <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" disabled={indice < 0 || indice >= naAba.length - 1} aria-label={`Descer ${nomeParaFrase(cartao)}`} onClick={onDescer}>
                Descer
              </button>
              {!confirmando && (
                <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" aria-label={`Remover ${nomeParaFrase(cartao)}`} onClick={() => onPedirTirar(cartao)}>
                  Remover
                </button>
              )}
            </>
          )}
        </span>
      </div>
      {semNome && <p className="lb-field__error">Dê um nome no editor: sem ele a ficha não salva.</p>}
      {resumo.aviso !== null && (
        <p className="lb-mec__aviso" role="note">
          {resumo.aviso}
        </p>
      )}
      {tecnica && quemEdita === 'mestre' && perdeuARegraAoSerTrazida(cartao) && (
        <p className="lb-field__hint" role="note">
          Esta técnica perdeu a regra programada ao ser trazida de outra ficha: na batalha ela vale só pelo texto. Traga de novo pelo "Trazer de outra ficha" para a regra voltar.
        </p>
      )}
      {confirmando && (
        <div className="lb-habs__confirma" role="group" aria-label={`Confirmar remover ${nomeParaFrase(cartao)}`}>
          <span className="lb-field__hint">Remover {semNome ? 'esta habilidade' : cartao.nome} e a mecânica montada nela?</span>
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={onCancelarTirar}>
            Cancelar
          </button>
          <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={() => onTirar(cartao.id)}>
            Remover
          </button>
        </div>
      )}
      {cartao.subcartoes.length > 0 && (
        <div className="lb-habs__subs" role="group" aria-label={`${aba.subcartoes?.rotulo ?? 'Técnicas'} de ${nomeParaFrase(cartao)}`}>
          <span className="lb-habs__subs-rotulo">{aba.subcartoes?.rotulo ?? 'Técnicas'}</span>
          {cartao.subcartoes.map((sub) => (
            <span key={sub.id} className="lb-habs__sub">
              <button type="button" className="lb-habs__sub-abrir" disabled={onAbrir === undefined} onClick={() => onAbrir?.(sub.id)}>
                {sub.nome.trim() === '' ? 'Sem nome' : sub.nome}
              </button>
              {onPedirTirar !== undefined && (
                <button type="button" className="lb-habs__sub-tirar" aria-label={`Tirar ${nomeParaFrase(sub)} de ${nomeParaFrase(cartao)}`} onClick={() => onTirar(sub.id)}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {comPecaDoMestre && cru !== null && <PecaDoMestreNaForma cartao={cru} podeMudar={quemEdita === 'mestre'} onChange={onGravar} />}
      {tecnica && testando && (
        <Suspense fallback={null}>
          <PainelDeEnsaio cartao={cartao} quemUsa={vista} sistema={sistema} onFechar={onTestar} embutido />
        </Suspense>
      )}
    </li>
  )
}
