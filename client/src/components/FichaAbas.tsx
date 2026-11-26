import { lazy, Suspense, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { quantidadeDe } from '../lib/items'
import { ABA_DOS_ITENS, passarAbaItensParaMochila, vagaDoCartaoAntigo } from '../lib/livros/coisaERegra'
import { InventarioDaFicha } from './InventarioDaFicha'
import { camposVisiveis, cartoesDaAba, NOME_DO_TEXTO_DE_ANTES, novoCartao, paragrafosDoCartao, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { abaTemCatalogo, cartaoDoCatalogo, itensDaAba, type ItemEscolhivel } from '../lib/livroDeRegras'
import { abaDoSistema, type AbaDoSistema, type CampoDoCartao, type SistemaDeRpg } from '../lib/sistemaDeRpg'
import type { Ajuste } from '../lib/ajusteDaFicha'
import { EXTRAS_DA_EVOLUCAO, nomeDaNovaOpcao, sugestaoDeEvolucao, temExtrasDaEvolucao } from '../lib/batalha/escolhaEEvolucao'
import { CAMPO_DO_ATRIBUTO_DO_ATAQUE, CAMPO_DO_DANO } from '../lib/batalha/formula'
import { ABA_DAS_ARMAS, ABA_DAS_BALAS, ABA_DAS_TECNICAS, CAMPO_DA_ACAO, CAMPO_DA_CAPACIDADE, CAMPO_DA_CATEGORIA, CAMPO_DO_CUSTO, CAMPO_DO_EFEITO, CAMPO_DO_TEMPO } from '../lib/batalha/leituraDaFicha'
import { cartaoMontado, pecasDoCartao } from '../lib/batalha/mecanica/leitura'
import { perdeuARegraAoSerTrazida } from '../lib/batalha/mecanicasAMao'
import { CampoDeDano } from './CampoDeDano'
import { avisoDoAtributoDoAtaque, avisoDoQueFicaGuardado, categoriaSemTiro, escolhaDoCampo, opcoesDoCampo, rotuloDaCategoria, rotuloDoVazio, valorDaEscolha } from './escolhaDeCampo'
import { EscolherDoLivro, type EstadoDaEscolha, type LivroDaFicha } from './EscolherDoLivro'
import { TrazerDeOutraFicha } from './TrazerDeOutraFicha'
import { CampoQueColaImagem } from './CampoQueColaImagem'
import { CampoNumero, ImagemOuIniciais } from './FichaPecas'
import { MecanicaLida, type QuemEditaAMecanica } from './batalha/MecanicaDaTecnica'
import { HabilidadeNaFicha } from './batalha/editor/HabilidadeNaFicha'
import { cartaoNovoNoEditor } from './batalha/editor/emBranco'
import { camposGeradosDaAba } from '../lib/batalha/mecanica/textoGerado'
import { AlcanceDoCartaoDeTexto } from './batalha/alcance/AlcanceDoCartaoDeTexto'
import { FonteDaArmaContexto, SeloDaFonteDaArma } from './fonteDaArma'
import type { CarriedItem } from '../types/map'
import { PecaDoMestreNaForma } from './batalha/FormasDoMestre'
import { CartoesOcultos, OcultaNoCartao, SeloDeOculta } from './batalha/HabilidadeOculta'
import { ocultasDaAba } from '../lib/habilidadeOculta'
import { AcumuladoresNaFicha } from './batalha/acumulador/AcumuladoresNaFicha'
import { MexerNaFicha, type FichaQueSeMexe } from './batalha/acumulador/mexerNaFicha'

/** Fase 3: o Testar pesa o motor da batalha inteiro; só carrega quando alguém abre. */
const PainelDeEnsaio = lazy(() => import('./ensaio/PainelDeEnsaio').then((modulo) => ({ default: modulo.PainelDeEnsaio })))

/**
 * As abas da ficha de personagem (Habilidades, Perícias...): os cartões de
 * cada uma, lidos ou editados. Tudo vem do molde da aba no sistema
 * (`AbaDoSistema`): esta tela não sabe o que é uma "habilidade".
 */

export interface FichaAbasProps {
  personagem: Personagem
  sistema: SistemaDeRpg
  editando: boolean
  onChange: (personagem: Personagem) => void
  escolherImagem: () => Promise<string | null>
  /** O livro que vem à parte (o jogador pede ao mestre); ausente = os catálogos vêm no próprio `sistema`. */
  livro?: LivroDaFicha
  /** Fora da edição: o "Ativar" da transformação liga e desliga na hora. Ausente = só lê. */
  onAjustar?: (ajuste: Ajuste) => void
  /**
   * Construtor de mecânicas C2 (decisão 1 do mestre): o mestre grava a mecânica
   * da técnica; o dono da ficha monta uma proposta que o mestre aceita. Padrão: mestre.
   */
  quemEditaAMecanica?: QuemEditaAMecanica
  /** Fatia C7: só o mestre revela um cartão oculto, com um clique fora da edição. Ausente = sem o botão. */
  onRevelar?: (cartaoId: string) => void
  /**
   * As fichas da mesma pasta (jogadores e NPCs), para o "Trazer de outra ficha"
   * das Habilidades em edição. Só o app do mestre passa: ele é quem tem todas.
   * Ausente = sem o botão.
   */
  outrasFichas?: readonly Personagem[]
  /**
   * Fase 5: o INVENTÁRIO de quem olha (a mochila com as ações do mestre ou do
   * jogador), mostrado DENTRO da aba Itens. Ausente = a mochila da ficha, só leitura.
   */
  inventario?: ReactNode
  /**
   * A mochila do BONECO quando ele é o dono dela (a aventura ainda não passou a
   * mochila para a ficha: `mochilaMigrada` ausente). A aba conta esta, e a
   * edição não troca o `inventario` pelo rascunho: a cópia da ficha não vale
   * (mostrava "Inventário 0" com as Balas de prata no token), e o "+ Adicionar"
   * e o "Usar" seguem indo ao boneco. Ausente = a ficha é a dona.
   */
  mochilaDoBoneco?: readonly CarriedItem[]
  /**
   * Na edição: o que o Salvar vai deixar na mochila do dono (`mochilaDoSalvar`:
   * a de agora mais as vagas que esta edição pôs). A aba conta esta e a grade a
   * mostra, só para ler, com o aviso de salvar. Ausente = a do rascunho com a
   * ficha dona; com o boneco dono, a grade dele, viva.
   */
  mochilaDaEdicao?: readonly CarriedItem[]
  /**
   * O "Passar para a mochila" dos cartões antigos. `false` na sala LAN do
   * jogador: o Salvar dele não leva mochila (`partesMudadas`), e os cartões
   * sairiam da aba sem chegar a lugar nenhum. Padrão: com.
   */
  podePassarParaAMochila?: boolean
}

/** Quantos itens a mochila tem, somando as pilhas. */
function totalDaMochila(mochila: readonly CarriedItem[] | undefined): number {
  return (mochila ?? []).reduce((soma, item) => soma + quantidadeDe(item), 0)
}

/**
 * O número da aba Itens: a mochila do dono, mais os cartões antigos (e os "???") que ainda não estão
 * nela. O cartão cuja vaga já entrou na mochila (`vagaDoCartaoAntigo`: a passagem para o boneco dono,
 * esperando o Salvar) não conta de novo (frente A, 25/11/2026: o contador somava os dois).
 */
function itensNaAba(personagem: Personagem, mochila: readonly CarriedItem[] | undefined): number {
  const vagas = new Set((mochila ?? []).map((item) => item.id))
  const cartoes = cartoesDaAba(personagem, ABA_DOS_ITENS).filter((cartao) => !vagas.has(vagaDoCartaoAntigo(cartao.id)))
  return cartoes.length + ocultasDaAba(personagem, ABA_DOS_ITENS) + totalDaMochila(mochila)
}

/**
 * UM INVENTÁRIO SÓ (Fase 5, decisão 2 do mestre de 15/11): a aba Itens é a
 * LEITURA DA MOCHILA. Mostra o inventário de quem olha (`inventario`, com as
 * ações do mestre ou do jogador) ou, sem ele, a mochila da ficha só para ler.
 * Os cartões antigos da aba continuam embaixo, intactos, até o "Passar para a
 * mochila" (na edição; o Cancelar e o Desfazer devolvem tudo).
 */
function MochilaNaAbaItens({
  personagem,
  aba,
  inventario,
  editando,
  donoEhOBoneco,
  mochilaDaEdicao,
  podePassar,
  cartoesAntigos,
  onChange,
}: {
  personagem: Personagem
  aba: AbaDoSistema
  inventario: ReactNode | undefined
  editando: boolean
  /** O boneco é o dono da mochila: na edição a grade continua o `inventario`, até haver vaga esperando o Salvar. */
  donoEhOBoneco: boolean
  /** Na edição, o que o Salvar vai deixar na mochila do dono; ausente = a do rascunho (ou, com o boneco dono, a dele). */
  mochilaDaEdicao: readonly CarriedItem[] | undefined
  podePassar: boolean
  cartoesAntigos: number
  onChange: (personagem: Personagem) => void
}) {
  // A ficha de antes da passagem: o Desfazer volta a ela (só nesta edição; o Cancelar também desfaz).
  const [antes, setAntes] = useState<Personagem | null>(null)
  const passar = () => {
    const passagem = passarAbaItensParaMochila(personagem, aba)
    if (passagem.passados === 0) return
    setAntes(personagem)
    onChange(passagem.personagem)
  }
  const desfazer = () => {
    if (antes === null) return
    onChange(antes)
    setAntes(null)
  }
  // Na edição, com a FICHA dona da mochila, a grade é a do RASCUNHO, a mesma que a aba conta: depois do "Passar para a
  // mochila" a aba dizia "Itens 10" e a grade (a mochila gravada, com as ações) mostrava 1 cartão até o Salvar (pedido de
  // 16/11/2026). Com o BONECO dono, o rascunho é a cópia da ficha, que não vale: a grade continua a dele, com as ações —
  // até o "Passar para a mochila" deixar vagas esperando o Salvar, que as leva a ele: aí ela mostra o que o Salvar deixa.
  // A grade da edição é o que o Salvar vai deixar (`mochilaDaEdicao`): o item que chegou com a janela aberta aparece já.
  const daEdicao = editando ? mochilaDaEdicao : undefined
  const rascunhoNaGrade = editando && (daEdicao !== undefined || !donoEhOBoneco)
  const grade = rascunhoNaGrade ? (
    <InventarioDaFicha itens={daEdicao ?? personagem.mochila ?? []} vazio="Nada na mochila. O mestre dá itens pelo Acervo ou pelo livro." />
  ) : (
    (inventario ?? <InventarioDaFicha itens={personagem.mochila ?? []} vazio="Nada na mochila. O mestre dá itens pelo Acervo ou pelo livro." />)
  )
  return (
    <div className="lb-ficha__mochila-na-aba">
      {grade}
      {rascunhoNaGrade && inventario !== undefined && <p className="lb-ficha__vazio">Salve a ficha para usar, editar ou tirar itens da mochila.</p>}
      {cartoesAntigos > 0 && (
        <p className="lb-ficha__vazio">
          {cartoesAntigos === 1 ? '1 cartão antigo desta aba ainda não está na mochila.' : `${cartoesAntigos} cartões antigos desta aba ainda não estão na mochila.`}{' '}
          {!podePassar ? (
            'O mestre passa os cartões para a mochila.'
          ) : editando ? (
            <button type="button" className="lb-btn lb-btn--compact" onClick={passar}>
              Passar para a mochila
            </button>
          ) : (
            'Edite a ficha para passá-los.'
          )}
        </p>
      )}
      {editando && antes !== null && (
        <p className="lb-ficha__vazio" role="status">
          Os cartões foram para a mochila.{' '}
          <button type="button" className="lb-btn lb-btn--compact" onClick={desfazer}>
            Desfazer
          </button>
        </p>
      )}
    </div>
  )
}

export function FichaAbas({
  personagem,
  sistema,
  editando,
  onChange,
  escolherImagem,
  livro,
  onAjustar,
  quemEditaAMecanica = 'mestre',
  onRevelar,
  outrasFichas,
  inventario,
  mochilaDoBoneco,
  mochilaDaEdicao,
  podePassarParaAMochila = true,
}: FichaAbasProps) {
  const idBase = useId()
  // As balas moram dentro do cartão da arma ("Tipos de bala"): a aba só aparece na barra se alguma bala ficou solta nela.
  const abas = sistema.abas.filter((aba) => aba.id !== ABA_DAS_BALAS || cartoesDaAba(personagem, aba.id).length > 0)
  const [ativaId, setAtivaId] = useState(abas[0]?.id ?? '')
  const refs = useRef(new Map<string, HTMLButtonElement>())
  // ED6: o mestre editando: o "+N <acumulador>" do editor da técnica grava no cartão do acumulador, outro cartão.
  const mestreEditando = editando && quemEditaAMecanica === 'mestre'
  const fichaQueSeMexe = useMemo<FichaQueSeMexe | null>(() => (mestreEditando ? { personagem, mudar: onChange } : null), [mestreEditando, personagem, onChange])
  const ativa = abas.find((aba) => aba.id === ativaId) ?? abas[0]
  if (ativa === undefined) return <p className="lb-ficha__vazio">Este sistema não tem abas.</p>

  // Setas andam entre as abas, Home/End vão às pontas: o padrão de abas da WAI-ARIA.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const ids = abas.map((aba) => aba.id)
    const at = ids.indexOf(ativaId)
    const alvo =
      event.key === 'ArrowRight' ? ids[(at + 1) % ids.length] : event.key === 'ArrowLeft' ? ids[(at - 1 + ids.length) % ids.length] : event.key === 'Home' ? ids[0] : event.key === 'End' ? ids[ids.length - 1] : undefined
    if (alvo === undefined) return
    event.preventDefault()
    setAtivaId(alvo)
    refs.current.get(alvo)?.focus()
  }

  const cartoes = cartoesDaAba(personagem, ativa.id)
  const ocultas = ocultasDaAba(personagem, ativa.id)
  const trocarCartoes = (novos: CartaoDaFicha[]) => onChange({ ...personagem, abas: { ...personagem.abas, [ativa.id]: novos } })
  // A mochila que a aba Itens conta é a mesma que a grade mostra: a do Salvar na edição, senão a do dono.
  const mochilaContada = editando && mochilaDaEdicao !== undefined ? mochilaDaEdicao : (mochilaDoBoneco ?? personagem.mochila)
  // SISTEMA DE ITENS REFEITO (docs/design/itens-rework/PLANO.md, E1): os cartões das abas Armas e Itens ficam só para ler até a
  // E4 (a conversão ao abrir já os levou para a mochila); editar aqui faria duas fontes divergirem.
  const moraNaMochila = ativa.id === ABA_DAS_ARMAS || ativa.id === ABA_DOS_ITENS

  return (
    <div className="lb-ficha__abas">
      <div className="lb-ficha__abas-lista" role="tablist" aria-label={`Abas da ficha de ${personagem.nome}`} onKeyDown={onKeyDown}>
        {abas.map((aba) => {
          // Fatia C7: o "???" que o mestre escondeu conta na aba do jogador, como um cartão.
          // Fase 5: a aba Itens conta também a mochila (ela é a leitura da mochila) — a do dono, a mesma que a grade mostra.
          const quantos = aba.id === ABA_DOS_ITENS ? itensNaAba(personagem, mochilaContada) : cartoesDaAba(personagem, aba.id).length + ocultasDaAba(personagem, aba.id)
          return (
            <button
              key={aba.id}
              ref={(el) => {
                if (el === null) refs.current.delete(aba.id)
                else refs.current.set(aba.id, el)
              }}
              type="button"
              role="tab"
              id={`${idBase}-aba-${aba.id}`}
              className="lb-ficha__aba"
              aria-selected={aba.id === ativa.id}
              aria-controls={`${idBase}-painel`}
              tabIndex={aba.id === ativa.id ? 0 : -1}
              onClick={() => setAtivaId(aba.id)}
            >
              {aba.nome}
              {quantos > 0 && <span className="lb-ficha__aba-conta">{quantos}</span>}
            </button>
          )
        })}
      </div>
      <MexerNaFicha.Provider value={fichaQueSeMexe}>
      <div id={`${idBase}-painel`} className="lb-ficha__painel" role="tabpanel" aria-labelledby={`${idBase}-aba-${ativa.id}`}>
        {mestreEditando && ativa.id === ABA_DAS_TECNICAS && <AcumuladoresNaFicha personagem={personagem} sistema={sistema} onChange={onChange} />}
        {ativa.id === ABA_DOS_ITENS && (
          <MochilaNaAbaItens
            personagem={personagem}
            aba={ativa}
            inventario={inventario}
            editando={editando}
            donoEhOBoneco={mochilaDoBoneco !== undefined}
            mochilaDaEdicao={mochilaDaEdicao}
            podePassar={podePassarParaAMochila && cartoes.some((cartao) => cartao.naMochila !== true)}
            cartoesAntigos={cartoes.length}
            onChange={onChange}
          />
        )}
        {moraNaMochila && cartoes.length > 0 && <p className="lb-ficha__vazio">Agora mora na mochila: estes cartões ficam só para ler, e o item se muda pela mochila.</p>}
        {ativa.id === ABA_DOS_ITENS && cartoes.length === 0 && ocultas === 0 ? null : editando && !moraNaMochila ? (
          <ListaEditavel
            key={ativa.id}
            aba={ativa}
            sistema={sistema}
            personagem={personagem}
            cartoes={cartoes}
            onChange={trocarCartoes}
            escolherImagem={escolherImagem}
            livro={livro}
            quemEditaAMecanica={quemEditaAMecanica}
            podeOcultar={quemEditaAMecanica === 'mestre' && onRevelar !== undefined}
            outrasFichas={outrasFichas}
          />
        ) : cartoes.length === 0 && ocultas === 0 ? (
          <p className="lb-ficha__vazio">{ativa.vazio}</p>
        ) : (
          <ul className="lb-ficha__cartoes">
            {cartoes.map((cartao) => (
              <CartaoLido
                key={cartao.id}
                cartao={cartao}
                aba={ativa}
                sistema={sistema}
                personagem={personagem}
                ativo={personagem.cartoesAtivos.includes(cartao.id)}
                onLigar={
                  onAjustar === undefined || ativa.modificadores !== true ? undefined : (ligar) => onAjustar({ parte: 'cartao', chave: cartao.id, valor: ligar ? 1 : 0 })
                }
                onRevelar={onRevelar}
              />
            ))}
            <CartoesOcultos quantos={ocultas} />
          </ul>
        )}
      </div>
      </MexerNaFicha.Provider>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura
// ───────────────────────────────────────────────────────────────────────────

function abreviacao(sistema: SistemaDeRpg, atributoId: string): string {
  return sistema.atributos.find((atributo) => atributo.id === atributoId)?.abreviacao ?? atributoId.slice(0, 3).toUpperCase()
}

/**
 * A arma tem categoria que não atira (Branca, Arremesso, Natural)? Então a
 * Capacidade e os tipos de bala saem da tela; o dado fica guardado e volta se
 * a categoria voltar a De fogo ou Híbrida. Sem categoria (arma antiga, ou
 * texto fora da lista) mostra tudo, como antes.
 */
function armaQueNaoAtira(aba: AbaDoSistema, cartao: CartaoDaFicha): boolean {
  return aba.id === ABA_DAS_ARMAS && categoriaSemTiro(cartao.campos)
}

/** "Rótulo: valor" com o rótulo em destaque, como o dono da mesa lê a técnica no Discord. */
function LinhasDoCartao({ linhas, denso }: { linhas: { rotulo: string; valor: string }[]; denso?: boolean }) {
  if (linhas.length === 0) return null
  return (
    <dl className={`lb-cartao__linhas${denso === true ? ' lb-cartao__linhas--denso' : ''}`}>
      {linhas.map((linha, i) => (
        <div key={`${linha.rotulo}-${i}`} className="lb-cartao__linha">
          <dt>{linha.rotulo.length > 0 ? `${linha.rotulo}:` : '—'}</dt>
          <dd>{linha.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Os campos de texto que a técnica montada troca pelas peças (o Efeito fica: descreve o golpe). */
const CAMPOS_TROCADOS_PELAS_PECAS: ReadonlySet<string> = new Set([CAMPO_DA_ACAO, CAMPO_DO_CUSTO, CAMPO_DO_TEMPO, CAMPO_DO_DANO])

interface CartaoLidoProps {
  cartao: CartaoDaFicha
  aba: AbaDoSistema
  sistema: SistemaDeRpg
  /** A ficha: a prévia do número no resumo da mecânica lê os atributos dela. */
  personagem: Personagem
  /** A transformação está ligada: os modificadores dela entram nos totais da ficha. */
  ativo: boolean
  /** Liga ou desliga na hora; ausente = o cartão não liga (aba sem modificadores, ou ficha só de leitura). */
  onLigar?: (ligar: boolean) => void
  /** Fatia C7: o mestre revela o cartão oculto com um clique; ausente = sem o botão. */
  onRevelar?: (cartaoId: string) => void
}

/** Fase 3: o Testar do cartão lido (o boneco numa cópia da ficha; nada muda nela). */
function BotaoDeTestar({ testando, nome, onTrocar }: { testando: boolean; nome: string; onTrocar: () => void }) {
  return (
    <button type="button" className="lb-cartao__ligar" aria-pressed={testando} aria-label={`Testar ${nome} no boneco`} onClick={onTrocar}>
      {testando ? 'Fechar teste' : 'Testar'}
    </button>
  )
}

function CartaoLido({ cartao, aba, sistema, personagem, ativo, onLigar, onRevelar }: CartaoLidoProps) {
  const [testando, setTestando] = useState(false)
  const fecharTeste = useCallback(() => setTestando(false), [])
  const ehArma = aba.id === ABA_DAS_ARMAS
  const semTiro = armaQueNaoAtira(aba, cartao)
  const sub = aba.subcartoes === undefined || semTiro ? undefined : abaDoSistema(sistema, aba.subcartoes.aba)
  const atributos = aba.atributos === true ? cartao.atributos.map((id) => abreviacao(sistema, id)) : []
  // Na arma, a Categoria sobe para o selo ao lado do nome; a Capacidade some quando a arma não atira.
  const categoria = ehArma ? rotuloDaCategoria(cartao.campos) : null
  // Técnica montada (construtor C2): o resumo das peças vale; Ação, Custo, Tempo e Dano em texto sairiam com outro número.
  const montada = aba.id === ABA_DAS_TECNICAS && pecasDoCartao(cartao) !== null
  // Arma montada: o resumo da mecânica (MecanicaLida) diz o que ela faz; o Efeito em texto ao lado poderia dizer outra coisa.
  const armaMontada = ehArma && pecasDoCartao(cartao) !== null
  const abaLida = ehArma
    ? { ...aba, campos: aba.campos.filter((campo) => campo.id !== CAMPO_DA_CATEGORIA && !(semTiro && campo.id === CAMPO_DA_CAPACIDADE) && !(armaMontada && campo.id === CAMPO_DO_EFEITO)) }
    : montada
      ? { ...aba, campos: aba.campos.filter((campo) => !CAMPOS_TROCADOS_PELAS_PECAS.has(campo.id)) }
      : aba
  const tecnica = aba.id === ABA_DAS_TECNICAS
  // ARMAS-FONTE-UNICA §6: a arma ligada ao livro diz de onde vem (só na janela do mestre, que dá o contexto).
  const fonteDe = useContext(FonteDaArmaContexto)
  const fonte = ehArma && fonteDe !== null ? fonteDe(cartao.itemId) : null
  return (
    <li className="lb-cartao" data-ativo={ativo && aba.modificadores === true ? '' : undefined}>
      <div className="lb-cartao__corpo">
        {aba.imagem === true && (
          <div className="lb-cartao__imagem"><ImagemOuIniciais imagem={cartao.imagem} nome={cartao.nome} /></div>
        )}
        <div className="lb-cartao__texto">
          <div className="lb-cartao__topo">
            <h4 className="lb-cartao__nome">{cartao.nome}</h4>
            {ehArma && cartao.armaPadrao === true && <span className="lb-ficha__chip lb-ficha__chip--padrao">Padrão</span>}
            {categoria !== null && <span className="lb-ficha__chip lb-ficha__chip--categoria">{categoria}</span>}
            {atributos.length > 0 && <span className="lb-ficha__chip lb-ficha__chip--atributos">{atributos.join(' · ')}</span>}
            <SeloDeOculta cartao={cartao} onRevelar={onRevelar} />
            {fonte?.tipo === 'livro' && <SeloDaFonteDaArma fonte={fonte} />}
            {onLigar !== undefined && (
              // Nome fixo e o estado no aria-pressed: o leitor de tela diz "Ativar Forma Híbrida, pressionado".
              <button type="button" className="lb-cartao__ligar" aria-pressed={ativo} aria-label={`Ativar ${cartao.nome}`} onClick={() => onLigar(!ativo)}>
                {ativo ? 'Ativa' : 'Ativar'}
              </button>
            )}
            {onLigar === undefined && ativo && aba.modificadores === true && <span className="lb-cartao__ativa">Ativa</span>}
            {tecnica && <BotaoDeTestar testando={testando} nome={cartao.nome} onTrocar={() => setTestando((antes) => !antes)} />}
          </div>
          {paragrafosDoCartao(abaLida, cartao).map((paragrafo, i) => (
            <p key={i} className="lb-cartao__paragrafo">
              {paragrafo}
            </p>
          ))}
          {aba.modificadores === true && cartao.modificadores.length > 0 && (
            <div className="lb-cartao__mods">
              {cartao.modificadores.map((mod, i) => (
                <span key={`${mod.atributo}-${i}`} className="lb-cartao__mod" data-sinal={mod.delta >= 0 ? 'mais' : 'menos'}>
                  {abreviacao(sistema, mod.atributo)} {mod.delta >= 0 ? '+' : ''}
                  {mod.delta}
                </span>
              ))}
            </div>
          )}
          <LinhasDoCartao linhas={camposVisiveis(abaLida, cartao, 'linha')} />
          {camposVisiveis(abaLida, cartao, 'destaque').map((campo, i) => (
            <p key={`${campo.rotulo}-${i}`} className="lb-cartao__destaque">
              <span className="lb-cartao__destaque-rotulo">{campo.rotulo}: </span>
              {campo.valor}
            </p>
          ))}
          {(aba.id === ABA_DAS_TECNICAS || ehArma) && <MecanicaLida cartao={cartao} ficha={{ personagem, sistema }} />}
          {tecnica && testando && (
            <Suspense fallback={null}>
              <PainelDeEnsaio cartao={cartao} quemUsa={personagem} sistema={sistema} onFechar={fecharTeste} embutido />
            </Suspense>
          )}
        </div>
      </div>
      {sub !== undefined && cartao.subcartoes.length > 0 && (
        <div className="lb-cartao__subs">
          {ehArma && aba.subcartoes !== undefined && <span className="lb-cartao__subs-rotulo">{aba.subcartoes.rotulo}</span>}
          {cartao.subcartoes.map((subcartao) => (
            <div key={subcartao.id} className="lb-cartao__sub">
              <span className="lb-cartao__sub-nome">{subcartao.nome}</span>
              <SeloDeOculta cartao={subcartao} onRevelar={onRevelar} />
              {paragrafosDoCartao(sub, subcartao).map((paragrafo, i) => (
                <span key={i} className="lb-cartao__sub-texto">
                  {' — '}
                  {paragrafo}
                </span>
              ))}
              <LinhasDoCartao linhas={camposVisiveis(sub, subcartao, 'linha')} denso />
              {sub.id === ABA_DAS_TECNICAS && <MecanicaLida cartao={subcartao} ficha={{ personagem, sistema }} />}
            </div>
          ))}
        </div>
      )}
    </li>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Edição
// ───────────────────────────────────────────────────────────────────────────

interface ListaEditavelProps {
  aba: AbaDoSistema
  sistema: SistemaDeRpg
  /** A ficha em edição: a prévia do Dano lê os atributos dela. */
  personagem: Personagem
  cartoes: CartaoDaFicha[]
  onChange: (cartoes: CartaoDaFicha[]) => void
  escolherImagem: () => Promise<string | null>
  /** Dentro de outro cartão (técnicas da transformação): botões menores, e sem "Escolher do livro". */
  aninhada?: boolean
  /** Dentro de uma arma (as balas): o Dano delas não oferece "Dano da Arma". */
  daArma?: boolean
  livro?: LivroDaFicha
  quemEditaAMecanica: QuemEditaAMecanica
  /** Fatia C7: o app do mestre esconde cartões dos jogadores (o site, não: lá o segredo subiria ao Lobby). */
  podeOcultar: boolean
  /** As fichas da pasta, para o "Trazer de outra ficha" (só na lista de cima das Habilidades). Ausente = sem o botão. */
  outrasFichas?: readonly Personagem[]
}

/** B22: quantos dos que vieram estão ocultos (o jogador vê "???" até o mestre revelar), com subcartões. */
function quantasOcultas(cartoes: readonly CartaoDaFicha[]): number {
  return cartoes.reduce((soma, cartao) => soma + (cartao.oculta === true ? 1 : 0) + quantasOcultas(cartao.subcartoes), 0)
}

/** O aviso que fica na aba depois de trazer: o que veio, de quem, que é cópia e (B22) se veio oculta. */
function avisoDoQueVeio(aba: AbaDoSistema, novos: readonly CartaoDaFicha[], deQuem: string): string {
  const ocultas = quantasOcultas(novos)
  const oculta = ocultas === 0 ? '' : ocultas === 1 && novos.length === 1 ? ' Veio oculta: o jogador vê "???" até você revelar.' : ` ${ocultas} vieram ocultas: o jogador vê "???" até você revelar.`
  if (novos.length === 1) return `${novos[0].nome} veio de ${deQuem}. É uma cópia: mudar aqui não muda a ficha de ${deQuem}.${oculta}`
  return `${novos.length} ${aba.nome.toLocaleLowerCase('pt-BR')} vieram de ${deQuem}. São cópias: mudar aqui não muda a ficha de ${deQuem}.${oculta}`
}

/** B15: o cartão que o Remover acabou de tirar, e onde ele estava, para o Desfazer devolver no mesmo lugar. */
interface CartaoRemovido {
  cartao: CartaoDaFicha
  indice: number
}

/** O nome do cartão para frase e leitor de tela; o sem nome (B14) não vira "Remover " vazio. */
function nomeParaFrase(cartao: CartaoDaFicha): string {
  const nome = cartao.nome.trim()
  return nome === '' ? 'o cartão sem nome' : nome
}

function ListaEditavel({ aba, sistema, personagem, cartoes, onChange, escolherImagem, aninhada = false, daArma = false, livro, quemEditaAMecanica, podeOcultar, outrasFichas }: ListaEditavelProps) {
  // O cartão que acabou de nascer abre aberto; os outros ficam fechados numa linha cada. B20: todos os que nasceram
  // nesta edição seguem abertos (com um id só, criar o segundo fechava o primeiro no meio do preenchimento).
  const [recemCriados, setRecemCriados] = useState<ReadonlySet<string>>(() => new Set())
  const [removido, setRemovido] = useState<CartaoRemovido | null>(null)
  const nasceu = (id: string) => setRecemCriados((antes) => new Set(antes).add(id))
  // A habilidade nova do "+ Habilidade" nasce montada em branco e abre direto no editor (o protótipo aprovado).
  const [noEditor, setNoEditor] = useState<string | null>(null)
  const remover = (indice: number) => {
    const cartao = cartoes[indice]
    if (cartao === undefined) return
    setRemovido({ cartao, indice })
    onChange(cartoes.filter((_, j) => j !== indice))
  }
  const desfazerRemocao = () => {
    if (removido === null) return
    const novos = [...cartoes]
    novos.splice(Math.min(removido.indice, novos.length), 0, removido.cartao)
    onChange(novos)
    setRemovido(null)
  }
  const [escolhendo, setEscolhendo] = useState(false)
  const botaoDoLivro = useRef<HTMLButtonElement>(null)
  // "Trazer de outra ficha": os golpes que outra ficha da pasta já tem (pedido do mestre, 09/11/2026).
  const ofereceTrazer = !aninhada && outrasFichas !== undefined && aba.id === ABA_DAS_TECNICAS
  const [trazendo, setTrazendo] = useState(false)
  const [veio, setVeio] = useState<string | null>(null)
  const botaoDeTrazer = useRef<HTMLButtonElement>(null)
  const fecharTrazer = () => {
    setTrazendo(false)
    botaoDeTrazer.current?.focus()
  }
  const trazer = (novos: CartaoDaFicha[], deQuem: string) => {
    // Entram fechados, uma linha cada: já vêm prontos, e o aviso do que veio fica à vista logo abaixo.
    onChange([...cartoes, ...novos])
    setVeio(avisoDoQueVeio(aba, novos, deQuem))
    fecharTrazer()
  }
  // Os itens do catálogo da aba: no sistema (mestre, ou o livro do jogador que já chegou) ou ainda no mestre.
  const itens = itensDaAba(sistema.catalogos, aba.id)
  const noMestre = livro !== undefined && itens.length === 0 && abaTemCatalogo(livro.resumo, aba.id)
  const ofereceLivro = !aninhada && (itens.length > 0 || noMestre)
  const estadoDaEscolha: EstadoDaEscolha = !noMestre || livro.estado === 'pronto' ? 'pronto' : livro.estado === 'falhou' ? 'falhou' : 'chegando'
  const pedirLivro = () => {
    if (noMestre && (livro.estado === 'ausente' || livro.estado === 'falhou')) livro.pedir()
  }
  const fecharEscolha = () => {
    setEscolhendo(false)
    botaoDoLivro.current?.focus()
  }
  const escolher = (item: ItemEscolhivel) => {
    const cartao = cartaoDoCatalogo(aba, sistema, item)
    nasceu(cartao.id)
    onChange([...cartoes, cartao])
    fecharEscolha()
  }
  const trocar = (id: string, cartao: CartaoDaFicha) => onChange(cartoes.map((atual) => (atual.id === id ? cartao : atual)))
  // Construtor C8: só uma arma é a padrão; marcar uma desmarca as outras.
  const marcarPadrao = (id: string, marcar: boolean) =>
    onChange(
      cartoes.map((atual) => {
        const { armaPadrao: _antes, ...semPadrao } = atual
        return marcar && atual.id === id ? { ...semPadrao, armaPadrao: true } : semPadrao
      }),
    )
  const mover = (indice: number, delta: -1 | 1) => {
    const alvo = indice + delta
    if (alvo < 0 || alvo >= cartoes.length) return
    const novos = [...cartoes]
    novos[indice] = cartoes[alvo]
    novos[alvo] = cartoes[indice]
    onChange(novos)
  }
  const adicionar = () => {
    const vazio = novoCartao(aba.item)
    // Sem quem edite a mecânica (o site do Lobby), a habilidade nova segue no texto, como sempre.
    const cartao = aba.id === ABA_DAS_TECNICAS && quemEditaAMecanica !== 'ninguem' ? cartaoNovoNoEditor(vazio, quemEditaAMecanica, { personagem, sistema }) : vazio
    nasceu(cartao.id)
    if (cartao !== vazio) setNoEditor(cartao.id)
    onChange([...cartoes, cartao])
  }
  return (
    <div className={`lb-cartoes-edit${aninhada ? ' lb-cartoes-edit--aninhada' : ''}`}>
      {cartoes.length === 0 && <p className="lb-ficha__vazio">{aba.vazio}</p>}
      {cartoes.map((cartao, indice) => (
        <CartaoEditavel
          key={cartao.id}
          cartao={cartao}
          aba={aba}
          sistema={sistema}
          personagem={personagem}
          daArma={daArma}
          aberto={recemCriados.has(cartao.id)}
          abrirNoEditor={noEditor === cartao.id}
          onChange={(novo) => trocar(cartao.id, novo)}
          onMarcarPadrao={!daArma && aba.id === ABA_DAS_ARMAS ? (marcar) => marcarPadrao(cartao.id, marcar) : undefined}
          onRemover={() => remover(indice)}
          onSubir={indice > 0 ? () => mover(indice, -1) : undefined}
          onDescer={indice < cartoes.length - 1 ? () => mover(indice, 1) : undefined}
          escolherImagem={escolherImagem}
          quemEditaAMecanica={quemEditaAMecanica}
          podeOcultar={podeOcultar}
        />
      ))}
      <div className="lb-cartoes-edit__botoes">
        <button type="button" className={`lb-btn${aninhada ? ' lb-btn--compact' : ''} lb-cartoes-edit__mais`} onClick={adicionar}>
          + {aba.item}
        </button>
        {ofereceLivro && (
          <button
            ref={botaoDoLivro}
            type="button"
            className="lb-btn lb-btn--ghost"
            aria-expanded={escolhendo}
            onClick={() => {
              if (escolhendo) {
                setEscolhendo(false)
                return
              }
              // Uma caixa de cada vez embaixo dos botões.
              setTrazendo(false)
              setEscolhendo(true)
              pedirLivro()
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
              setVeio(null)
              setTrazendo(!trazendo)
            }}
          >
            Trazer de outra ficha
          </button>
        )}
      </div>
      {removido !== null && (
        <p className="lb-field__hint" role="status">
          {removido.cartao.nome.trim() === '' ? 'O cartão sem nome saiu da ficha.' : `${removido.cartao.nome} saiu da ficha.`}{' '}
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={desfazerRemocao}>
            Desfazer
          </button>
        </p>
      )}
      {veio !== null && !trazendo && (
        <p className="lb-trazer__veio" role="status">
          {veio}
        </p>
      )}
      {ofereceTrazer && trazendo && (
        <TrazerDeOutraFicha
          aba={aba}
          sistema={sistema}
          personagem={personagem}
          fichas={outrasFichas}
          nomesNaFicha={new Set(cartoes.map((cartao) => cartao.nome.trim().toLocaleLowerCase('pt-BR')))}
          onTrazer={trazer}
          onFechar={fecharTrazer}
        />
      )}
      {ofereceLivro && escolhendo && (
        <EscolherDoLivro
          aba={aba}
          sistema={sistema}
          itens={itens}
          estado={estadoDaEscolha}
          nomesNaFicha={new Set(cartoes.map((cartao) => cartao.nome.toLocaleLowerCase('pt-BR')))}
          onTentarDeNovo={pedirLivro}
          onEscolher={escolher}
          onFechar={fecharEscolha}
        />
      )}
    </div>
  )
}

/**
 * Tipos de habilidade F4: todas as técnicas da ficha (Habilidades e as de
 * dentro das transformações, ligadas ou não), para o "+ Evolução" sugerir o
 * "Evolui para" pelo nome.
 */
function tecnicasDaFicha(personagem: Personagem, sistema: SistemaDeRpg): CartaoDaFicha[] {
  const tecnicas = [...cartoesDaAba(personagem, ABA_DAS_TECNICAS)]
  for (const aba of sistema.abas) {
    if (aba.subcartoes?.aba !== ABA_DAS_TECNICAS) continue
    for (const cartao of cartoesDaAba(personagem, aba.id)) tecnicas.push(...cartao.subcartoes)
  }
  return tecnicas
}

interface CartaoEditavelProps {
  cartao: CartaoDaFicha
  aba: AbaDoSistema
  sistema: SistemaDeRpg
  personagem: Personagem
  /** Cartão de dentro de uma arma (bala). */
  daArma: boolean
  aberto: boolean
  /** A habilidade que acabou de nascer em branco: o editor abre sozinho. */
  abrirNoEditor: boolean
  onChange: (cartao: CartaoDaFicha) => void
  /** Construtor C8: na arma, marca esta como a padrão (e desmarca as outras). */
  onMarcarPadrao?: (marcar: boolean) => void
  onRemover: () => void
  onSubir: (() => void) | undefined
  onDescer: (() => void) | undefined
  escolherImagem: () => Promise<string | null>
  quemEditaAMecanica: QuemEditaAMecanica
  /** Fatia C7: o app do mestre esconde cartões dos jogadores (o site, não: lá o segredo subiria ao Lobby). */
  podeOcultar: boolean
}

function CartaoEditavel({ cartao, aba, sistema, personagem, daArma, aberto, abrirNoEditor, onChange, onMarcarPadrao, onRemover, onSubir, onDescer, escolherImagem, quemEditaAMecanica, podeOcultar }: CartaoEditavelProps) {
  const ehArma = !daArma && aba.id === ABA_DAS_ARMAS
  const semTiro = ehArma && armaQueNaoAtira(aba, cartao)
  // ARMAS-FONTE-UNICA §6: ligada ao livro, o Salvar da ficha leva a regra ao livro e às outras fichas; livro fechado, a mecânica só se lê.
  const fonteDe = useContext(FonteDaArmaContexto)
  const fonte = ehArma && fonteDe !== null && quemEditaAMecanica === 'mestre' ? fonteDe(cartao.itemId) : null
  const [erroDaImagem, setErroDaImagem] = useState<string | null>(null)
  const sub = aba.subcartoes === undefined ? undefined : abaDoSistema(sistema, aba.subcartoes.aba)
  const capacidadeGuardada = (cartao.campos[CAMPO_DA_CAPACIDADE] ?? '').trim().length > 0
  const guardadoSemTiro = semTiro ? avisoDoQueFicaGuardado(capacidadeGuardada, cartao.subcartoes.length) : null
  const trocarCampo = (campoId: string, valor: string) => onChange({ ...cartao, campos: { ...cartao.campos, [campoId]: valor } })
  const nomeId = useId()
  const semNome = cartao.nome.trim() === ''
  // B15: o cartão com mecânica (ou proposta) pede confirmação antes de sair; o Desfazer da lista devolve qualquer um.
  const [confirmando, setConfirmando] = useState(false)
  const temMecanica = cartao.mecanica !== undefined || cartao.mecanicaProposta !== undefined
  const pedirRemover = () => (temMecanica ? setConfirmando(true) : onRemover())
  // ED5: na técnica montada, os campos que a mecânica escreve (Ação, Tipo, Efeito, Custo, Tempo, Dano) só se leem aqui; quem muda é o editor.
  const montada = aba.id === ABA_DAS_TECNICAS && cartaoMontado(cartao)
  const gerados: ReadonlySet<string> = montada ? new Set(camposGeradosDaAba(sistema)) : new Set()
  const camposDaFrente = aba.campos.filter((campo) => !gerados.has(campo.id))
  const camposGerados = aba.campos.filter((campo) => gerados.has(campo.id))
  // A técnica sem mecânica abre pelo editor novo: no topo, o papel e o "Montar no editor" (ou a proposta do dono); o texto
  // antigo fica embaixo, recolhido e editável. Sem quem edite a mecânica (o site do Lobby), o cartão segue como sempre.
  const textoEmBaixo = aba.id === ABA_DAS_TECNICAS && quemEditaAMecanica !== 'ninguem' && !montada
  // Sem nome a ficha não salva: o texto já abre, com o erro à vista. Decidido uma vez, ao aparecer (senão fecharia no meio da digitação).
  const [textoAbertoDeInicio] = useState(semNome)
  // Tipos de habilidade F4: "+ Evolução" e "+ Opção" só nas técnicas; criam os extras com o nome que a batalha lê.
  const ehTecnica = aba.id === ABA_DAS_TECNICAS && aba.extras === true
  const jaEvolui = ehTecnica && temExtrasDaEvolucao(cartao)
  const [avisoDoExtra, setAvisoDoExtra] = useState<string | null>(null)
  const valoresDosExtras = useRef<(HTMLInputElement | null)[]>([])
  const focarNoExtra = useRef<number | null>(null)
  useEffect(() => {
    if (focarNoExtra.current === null) return
    valoresDosExtras.current[focarNoExtra.current]?.focus()
    focarNoExtra.current = null
  })
  const acrescentarEvolucao = () => {
    const sugestao = sugestaoDeEvolucao(cartao, tecnicasDaFicha(personagem, sistema))
    const para = sugestao?.nome.trim() ?? ''
    focarNoExtra.current = cartao.extras.length
    onChange({
      ...cartao,
      extras: [...cartao.extras, { nome: EXTRAS_DA_EVOLUCAO.texto, valor: '' }, { nome: EXTRAS_DA_EVOLUCAO.condicoes, valor: '' }, { nome: EXTRAS_DA_EVOLUCAO.para, valor: para }],
    })
    setAvisoDoExtra(
      para === ''
        ? 'Evolução: o texto do efeito evoluído. "Evolui para": o nome da técnica evoluída; vazio, evoluir troca o efeito por este texto. Vale só na batalha em que evoluir.'
        : `"Evolui para" sugerido pelo nome: ${para}. Na batalha ela fica apagada até alguém Evoluir esta; apague o valor se não for ela.`,
    )
  }
  const acrescentarOpcao = () => {
    const nome = nomeDaNovaOpcao(cartao)
    focarNoExtra.current = cartao.extras.length
    onChange({ ...cartao, extras: [...cartao.extras, { nome, valor: '' }] })
    setAvisoDoExtra(`${nome}: escreva o que ela faz (a opção 1 é o Efeito). Na batalha a mira pede uma ou outra, e o registro diz qual.`)
  }
  const pedirImagem = async () => {
    setErroDaImagem(null)
    try {
      const imagem = await escolherImagem()
      if (imagem !== null) onChange({ ...cartao, imagem })
    } catch (erro) {
      setErroDaImagem(erro instanceof Error ? erro.message : String(erro))
    }
  }

  const campoNaTela = (campo: CampoDoCartao): ReactNode =>
          semTiro && campo.id === CAMPO_DA_CAPACIDADE ? null : opcoesDoCampo(campo, sistema) !== undefined ? (
            <CampoDeEscolha
              key={campo.id}
              campo={campo}
              sistema={sistema}
              valor={cartao.campos[campo.id] ?? ''}
              casarComCategoria={ehArma && campo.id === CAMPO_DA_CATEGORIA}
              vazio={rotuloDoVazio(campo.id, cartao.campos)}
              aviso={campo.id === CAMPO_DA_CATEGORIA ? guardadoSemTiro : campo.id === CAMPO_DO_ATRIBUTO_DO_ATAQUE ? avisoDoAtributoDoAtaque(cartao.campos[campo.id] ?? '', sistema) : null}
              onChange={(valor) => trocarCampo(campo.id, valor)}
            />
          ) : campo.id === CAMPO_DO_DANO ? (
            <CampoDeDano
              key={campo.id}
              rotulo={campo.rotulo}
              campoId={campo.id}
              cartao={cartao}
              personagem={personagem}
              sistema={sistema}
              semDanoDaArma={ehArma || daArma}
              ehArma={ehArma}
              onChange={onChange}
            />
          ) : (
            <label key={campo.id} className="lb-field">
              <span className="lb-label">{campo.rotulo}</span>
              {campo.forma === 'linha' ? (
                <input className="lb-input" value={cartao.campos[campo.id] ?? ''} onChange={(event) => trocarCampo(campo.id, event.target.value)} />
              ) : (
                <textarea className="lb-input lb-textarea" value={cartao.campos[campo.id] ?? ''} onChange={(event) => trocarCampo(campo.id, event.target.value)} />
              )}
            </label>
          )

  const campoDoNome = (
    <div className="lb-field">
      <label className="lb-label" htmlFor={nomeId}>
        Nome
      </label>
      <input
        id={nomeId}
        className="lb-input"
        value={cartao.nome}
        aria-invalid={semNome || undefined}
        aria-describedby={semNome ? `${nomeId}-erro` : undefined}
        onChange={(event) => onChange({ ...cartao, nome: event.target.value })}
      />
      {semNome && (
        <span className="lb-field__error" id={`${nomeId}-erro`}>
          Dê um nome: sem ele a ficha não salva.
        </span>
      )}
    </div>
  )
  // A arma e a técnica de texto guardam o alcance no campo delas; na técnica de texto, ele fica com o resto do texto.
  const alcanceDeTexto = (aba.id === ABA_DAS_TECNICAS || ehArma) && cartao.mecanica === undefined && (
    <AlcanceDoCartaoDeTexto
      cartao={cartao}
      personagem={personagem}
      sistema={sistema}
      naArma={ehArma}
      podeMudar={quemEditaAMecanica !== 'ninguem' && fonte?.tipo !== 'livro' && fonte?.tipo !== 'semLivro'}
      {...(fonte?.tipo === 'livro' || fonte?.tipo === 'semLivro' ? { nota: 'Arma do livro: o alcance muda no livro (Biblioteca, página Itens).' } : {})}
      onChange={onChange}
    />
  )

  return (
    <details className="lb-cartao lb-cartao--edit" open={aberto}>
      <summary className="lb-cartao__resumo">
        <span className="lb-cartao__nome" data-sem-nome={semNome ? '' : undefined}>
          {semNome ? 'Sem nome ainda' : cartao.nome}
        </span>
        <SeloDeOculta cartao={cartao} />
        {fonte !== null && <SeloDaFonteDaArma fonte={fonte} />}
      </summary>
      <div className="lb-cartao__form">
        {!textoEmBaixo && campoDoNome}
        {!textoEmBaixo && camposDaFrente.map(campoNaTela)}
        {!textoEmBaixo && camposGerados.length > 0 && (
          <details className="lb-cartao__grupo lb-cartao__texto-antigo">
            <summary className="lb-label">Texto do cartão (sai da mecânica)</summary>
            <p className="lb-field__hint">Com a mecânica montada, estes campos saem dela: para mudar, abra o editor. O Desmontar devolve o texto de antes.</p>
            <dl className="lb-cartao__gerados">
              {camposGerados.map((campo) => (
                <div key={campo.id}>
                  <dt className="lb-label">{campo.rotulo}</dt>
                  <dd>{(cartao.campos[campo.id] ?? '').trim() || '—'}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
        {aba.id === ABA_DAS_TECNICAS && quemEditaAMecanica === 'mestre' && perdeuARegraAoSerTrazida(cartao) && (
          <p className="lb-field__hint" role="note">
            Esta técnica perdeu a regra programada ao ser trazida de outra ficha: na batalha ela vale só pelo texto. Traga de novo pelo "Trazer de outra ficha" para a regra voltar.
          </p>
        )}
        {aba.id === ABA_DAS_TECNICAS &&
          (quemEditaAMecanica === 'ninguem' ? (
            <MecanicaLida cartao={cartao} ficha={{ personagem, sistema }} />
          ) : (
            <HabilidadeNaFicha cartao={cartao} ficha={{ personagem, sistema }} quemEdita={quemEditaAMecanica} tecnicas={tecnicasDaFicha(personagem, sistema)} podeOcultar={podeOcultar} onChange={onChange} abrirAoNascer={abrirNoEditor} />
          ))}
        {textoEmBaixo && (
          <details className="lb-cartao__grupo lb-cartao__texto-antigo" open={textoAbertoDeInicio}>
            <summary className="lb-label">Editar como texto</summary>
            <p className="lb-field__hint">O nome e os campos escritos à mão. A batalha lê este texto até a habilidade ser montada.</p>
            {campoDoNome}
            {camposDaFrente.map(campoNaTela)}
            {alcanceDeTexto}
          </details>
        )}
        {ehArma && onMarcarPadrao !== undefined && (
          <div className="lb-field">
            <label className="lb-mec__marcar">
              <input type="checkbox" checked={cartao.armaPadrao === true} onChange={(event) => onMarcarPadrao(event.target.checked)} />
              <span>Arma padrão</span>
            </label>
            <span className="lb-field__hint">A técnica com Dano da Arma usa esta. Só uma arma da ficha é a padrão.</span>
          </div>
        )}
        {ehArma && fonte?.tipo === 'livro' && (
          <p className="lb-field__hint" role="note">
            Arma do livro: o que ela faz (mecânica, dano, efeito e balas) vale igual no livro, no Acervo e nas fichas ligadas. Salvar a ficha muda todos.
          </p>
        )}
        {ehArma &&
          (quemEditaAMecanica === 'ninguem' || fonte?.tipo === 'semLivro' ? (
            <>
              <MecanicaLida cartao={cartao} ficha={{ personagem, sistema }} />
              {fonte?.tipo === 'semLivro' && (
                <p className="lb-field__hint" role="note">
                  Arma ligada ao Acervo: o que ela faz vem do livro do sistema. Abra o livro (Biblioteca, página Itens) para mudar; mudar aqui voltaria ao que o livro diz.
                </p>
              )}
            </>
          ) : (
            // ED7: o editor novo, no modo arma (o Efeito em texto segue a mecânica dentro dele, pelo ponto único do texto gerado).
            <HabilidadeNaFicha cartao={cartao} ficha={{ personagem, sistema }} quemEdita={quemEditaAMecanica} tecnicas={tecnicasDaFicha(personagem, sistema)} podeOcultar={false} onChange={onChange} doQue="arma" />
          ))}
        {/* Fase F do alcance: o cartão sem mecânica montada (técnica de texto, arma só com o dano) guarda o alcance no campo dele. */}
        {!textoEmBaixo && alcanceDeTexto}
        {aba.modificadores === true && <PecaDoMestreNaForma cartao={cartao} podeMudar={quemEditaAMecanica === 'mestre'} onChange={onChange} />}
        {podeOcultar && <OcultaNoCartao cartao={cartao} onChange={onChange} />}
        {aba.atributos === true && <EscolhaDeAtributos sistema={sistema} escolhidos={cartao.atributos} onChange={(atributos) => onChange({ ...cartao, atributos })} />}
        {aba.imagem === true && (
          <div className="lb-field">
            <span className="lb-label">Imagem</span>
            <CampoQueColaImagem
              className="lb-cartao__imagem-edit"
              rotulo={`Imagem de ${cartao.nome}: clique e cole com Ctrl+V`}
              onImagem={(imagem) => onChange({ ...cartao, imagem })}
              onAviso={setErroDaImagem}
            >
              <div className="lb-cartao__imagem"><ImagemOuIniciais imagem={cartao.imagem} nome={cartao.nome} /></div>
              <button type="button" className="lb-btn lb-btn--compact" onClick={() => void pedirImagem()}>
                {cartao.imagem === null ? 'Escolher imagem…' : 'Trocar imagem…'}
              </button>
              {cartao.imagem !== null && (
                <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => onChange({ ...cartao, imagem: null })}>
                  Tirar
                </button>
              )}
            </CampoQueColaImagem>
            {erroDaImagem !== null && (
              <p className="lb-field__error" role="alert">
                {erroDaImagem}
              </p>
            )}
          </div>
        )}
        {aba.modificadores === true && (
          <fieldset className="lb-cartao__grupo">
            <legend className="lb-label">Modificadores</legend>
            {cartao.modificadores.map((mod, i) => (
              <div key={i} className="lb-cartao__par">
                <select
                  className="lb-input"
                  aria-label={`Atributo do modificador ${i + 1}`}
                  value={mod.atributo}
                  onChange={(event) => onChange({ ...cartao, modificadores: cartao.modificadores.map((atual, j) => (j === i ? { ...atual, atributo: event.target.value } : atual)) })}
                >
                  {opcoesDeAtributo(alvosDeModificador(sistema), mod.atributo).map((atributo) => (
                    <option key={atributo.id} value={atributo.id}>
                      {atributo.nome}
                    </option>
                  ))}
                </select>
                <CampoNumero
                  rotulo={`Pontos do modificador ${i + 1}`}
                  valor={mod.delta}
                  onChange={(delta) => onChange({ ...cartao, modificadores: cartao.modificadores.map((atual, j) => (j === i ? { ...atual, delta } : atual)) })}
                />
                <button
                  type="button"
                  className="lb-btn lb-btn--ghost lb-btn--compact"
                  aria-label={`Tirar o modificador ${i + 1}`}
                  onClick={() => onChange({ ...cartao, modificadores: cartao.modificadores.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="lb-btn lb-btn--compact lb-cartao__acrescentar"
              disabled={sistema.atributos.length === 0}
              onClick={() => onChange({ ...cartao, modificadores: [...cartao.modificadores, { atributo: sistema.atributos[0]?.id ?? '', delta: 0 }] })}
            >
              + Modificador
            </button>
          </fieldset>
        )}
        {aba.extras === true && (
          <fieldset className="lb-cartao__grupo">
            <legend className="lb-label">Campos extras</legend>
            {/* O "Texto de antes" é o guardado do Desmontar: não é campo para ler nem para mexer à mão (a volta deixaria de achá-lo). */}
            {cartao.extras.map((extra, i) => extra.nome === NOME_DO_TEXTO_DE_ANTES ? null : (
              <div key={i} className="lb-cartao__par">
                <input
                  className="lb-input"
                  aria-label={`Nome do campo extra ${i + 1}`}
                  placeholder="Nome"
                  value={extra.nome}
                  onChange={(event) => onChange({ ...cartao, extras: cartao.extras.map((atual, j) => (j === i ? { ...atual, nome: event.target.value } : atual)) })}
                />
                <input
                  ref={(elemento) => {
                    valoresDosExtras.current[i] = elemento
                  }}
                  className="lb-input"
                  aria-label={extra.nome.trim() === '' ? `Valor do campo extra ${i + 1}` : `Valor de ${extra.nome.trim()}`}
                  placeholder="Valor"
                  value={extra.valor}
                  onChange={(event) => onChange({ ...cartao, extras: cartao.extras.map((atual, j) => (j === i ? { ...atual, valor: event.target.value } : atual)) })}
                />
                <button
                  type="button"
                  className="lb-btn lb-btn--ghost lb-btn--compact"
                  aria-label={`Tirar o campo extra ${i + 1}`}
                  onClick={() => onChange({ ...cartao, extras: cartao.extras.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </div>
            ))}
            <div className="lb-cartao__acrescentar-linha">
              <button type="button" className="lb-btn lb-btn--compact lb-cartao__acrescentar" onClick={() => onChange({ ...cartao, extras: [...cartao.extras, { nome: '', valor: '' }] })}>
                + Campo
              </button>
              {ehTecnica && (
                <>
                  <button
                    type="button"
                    className="lb-btn lb-btn--ghost lb-btn--compact"
                    disabled={jaEvolui}
                    title={jaEvolui ? 'Já tem os campos da evolução' : 'Cria "Evolução", "Condições da evolução" e "Evolui para"'}
                    onClick={acrescentarEvolucao}
                  >
                    + Evolução
                  </button>
                  <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" title={`Cria "${nomeDaNovaOpcao(cartao)}": um ou outro na batalha`} onClick={acrescentarOpcao}>
                    + Opção
                  </button>
                </>
              )}
            </div>
            {/* B09 (SISTEMA.md §8): na técnica montada a opção e a evolução não mexem nas peças; o aviso não promete o que não faz. */}
            {ehTecnica && cartao.mecanica !== undefined && (
              <p className="lb-field__hint">Na técnica montada, "+ Opção" e "+ Evolução" só mudam o texto do registro: o golpe segue as peças da mecânica.</p>
            )}
            {avisoDoExtra !== null && (
              <p className="lb-field__hint" role="status">
                {avisoDoExtra}
              </p>
            )}
          </fieldset>
        )}
        {sub !== undefined && aba.subcartoes !== undefined && !semTiro && (
          <fieldset className="lb-cartao__grupo">
            <legend className="lb-label">{aba.subcartoes.rotulo}</legend>
            <ListaEditavel
              aba={sub}
              sistema={sistema}
              personagem={personagem}
              cartoes={cartao.subcartoes}
              onChange={(subcartoes) => onChange({ ...cartao, subcartoes })}
              escolherImagem={escolherImagem}
              aninhada
              daArma={ehArma}
              quemEditaAMecanica={quemEditaAMecanica}
              podeOcultar={podeOcultar}
            />
          </fieldset>
        )}
        <div className="lb-cartao__acoes">
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" disabled={onSubir === undefined} onClick={onSubir}>
            Subir
          </button>
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" disabled={onDescer === undefined} onClick={onDescer}>
            Descer
          </button>
          {!confirmando && (
            <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" aria-label={`Remover ${nomeParaFrase(cartao)}`} onClick={pedirRemover}>
              Remover
            </button>
          )}
        </div>
        {confirmando && (
          <div className="lb-cartao__acoes" role="group" aria-label={`Confirmar remover ${nomeParaFrase(cartao)}`}>
            <span className="lb-field__hint">Remover {semNome ? 'este cartão' : cartao.nome} e a mecânica montada nele?</span>
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => setConfirmando(false)}>
              Cancelar
            </button>
            <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={onRemover}>
              Remover
            </button>
          </div>
        )}
      </div>
    </details>
  )
}

interface CampoDeEscolhaProps {
  campo: CampoDoCartao
  /** O sistema da ficha: o "Soma no ataque" lista os atributos dele. */
  sistema: SistemaDeRpg
  valor: string
  /** A Categoria da arma: "arma de fogo" casa com De fogo, como a batalha lê. */
  casarComCategoria: boolean
  /** O texto da opção vazia ("—"; no Tipo da habilidade, o que a Ação deduz). */
  vazio: string
  /** Frase embaixo da caixa (o que ficou guardado fora da tela); `null` = nenhuma. */
  aviso: string | null
  onChange: (valor: string) => void
}

/** Campo com lista fechada (`opcoesDoCampo`): caixa de escolha com "—" para vazio, que guarda o texto da opção. */
function CampoDeEscolha({ campo, sistema, valor, casarComCategoria, vazio, aviso, onChange }: CampoDeEscolhaProps) {
  const caixaId = useId()
  const avisoId = useId()
  const escolha = escolhaDoCampo(opcoesDoCampo(campo, sistema) ?? [], valorDaEscolha(campo.id, valor, sistema), casarComCategoria, vazio)
  // Rótulo por `htmlFor`, não envolvendo: o aviso fica fora do nome da caixa e entra só como descrição.
  return (
    <div className="lb-field">
      <label className="lb-label" htmlFor={caixaId}>
        {campo.rotulo}
      </label>
      <select id={caixaId} className="lb-input" value={escolha.selecionada} aria-describedby={aviso === null ? undefined : avisoId} onChange={(event) => onChange(event.target.value)}>
        {escolha.opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
      {aviso !== null && (
        <p className="lb-field__hint" id={avisoId}>
          {aviso}
        </p>
      )}
    </div>
  )
}

/**
 * O que um modificador de transformação pode mexer: os atributos e o MÁXIMO
 * dos recursos de atual e máximo ("HP máximo +100" na forma híbrida).
 */
function alvosDeModificador(sistema: SistemaDeRpg): { id: string; nome: string }[] {
  return [
    ...sistema.atributos.map((atributo) => ({ id: atributo.id, nome: atributo.nome })),
    ...sistema.recursos.filter((recurso) => recurso.atualEMaximo === true).map((recurso) => ({ id: recurso.id, nome: `${recurso.nome} máximo` })),
  ]
}

/** Os alvos conhecidos e, se for o caso, o do arquivo que o sistema não conhece — o `select` não troca o valor sozinho. */
function opcoesDeAtributo(conhecidos: readonly { id: string; nome: string }[], atual: string): { id: string; nome: string }[] {
  return conhecidos.some((alvo) => alvo.id === atual) ? [...conhecidos] : [...conhecidos, { id: atual, nome: atual }]
}

function EscolhaDeAtributos({ sistema, escolhidos, onChange }: { sistema: SistemaDeRpg; escolhidos: string[]; onChange: (atributos: string[]) => void }) {
  return (
    <fieldset className="lb-cartao__grupo">
      <legend className="lb-label">Atributos</legend>
      <div className="lb-cartao__atributos">
        {sistema.atributos.map((atributo) => {
          const marcado = escolhidos.includes(atributo.id)
          return (
            <button
              key={atributo.id}
              type="button"
              className="lb-ficha__chip lb-ficha__chip--botao"
              aria-pressed={marcado}
              title={atributo.nome}
              onClick={() => onChange(marcado ? escolhidos.filter((id) => id !== atributo.id) : [...escolhidos, atributo.id])}
            >
              {atributo.abreviacao}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
