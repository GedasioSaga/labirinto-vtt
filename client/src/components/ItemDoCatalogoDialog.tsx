import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ehCategoriaDeMunicao, ITEM_SEM_NOME, MUNICOES_POR_ARMA_MAX, type ItemDoCatalogo } from '../lib/acervoDeItens'
import { useAcervoDeItensStore } from '../stores/acervoDeItensStore'
import { regraDaCoisa } from '../lib/livros/catalogo'
import { gravarRegraDaArma } from '../stores/armasNaFonte'
import { useCatalogoStore } from '../stores/catalogoStore'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import { mochilaMoraNaFicha, sistemaAtivo, useAdventureStore } from '../stores/adventureStore'
import { useCondicoesPropriasStore } from '../stores/condicoesPropriasStore'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { cleanItemName, ITEM_DESCRICAO_MAX, ITEM_NAME_MAX_LENGTH, ITEM_PRECO_MAX, ITEM_QUANTIDADE_MAX } from '../lib/items'
import type { AlvoDoAcervo } from '../lib/party'
import { ALCANCE_DA_LUZ_DO_ITEM_MAX, ALCANCE_DA_LUZ_DO_ITEM_MIN, CORES_SUGERIDAS_DA_LUZ_DO_ITEM, FORCA_DA_LUZ_DO_ITEM_MAX, FORCA_DA_LUZ_DO_ITEM_MIN, LUZ_DO_ITEM_PADRAO } from '../lib/luzDoItem'
import type { LuzDoItem, PecasDoEfeito } from '../types/map'
import { NOME_DA_CURA_REDUZIDA } from '../lib/batalha/condicoes'
import { resumoDoEfeitoDoItem } from '../lib/batalha/mecanica/resumoDoItem'
import { testeNoBoneco } from '../lib/batalha/aoAcertarDoItem'
import { novoPersonagem } from '../lib/personagem'
import { fraseCurta, prazoCurto } from '../lib/condicoes/frasesDaCondicao'
import { legadoDaPecaDoItem, pecaDoItemSoComACondicao, type PecaDoItemQuePoe } from '../lib/condicoes/legado'
import type { PrazoDaCondicao } from '../lib/condicoes/modelo'
// Rework das condições (E7): registra as criadas da pasta nos seletores; só o app abre este editor.
import './batalha/editor/pecas/condicoesDoApp'
import { condicaoDoSeletor, turnosDaCondicao, useCatalogoDoSeletor, type CatalogoDoSeletor } from './batalha/editor/pecas/condicoesNoSeletor'
import { OpcoesDeCondicao } from './batalha/editor/pecas/controlesDaPeca'
import { avisoDaPeca, MolduraDaPeca } from './batalha/editor/pecas/MolduraDaPeca'
import { RegraDeAntes } from './batalha/editor/pecas/RegraDeAntes'
import { entradaDaPeca } from './batalha/editor/pecas/registro'
import type { MecanicaV1 } from '../lib/batalha/mecanica/modelo'
import { DURACAO_DA_PECA_MAX, duracaoDoTexto, ROTULO_DO_TIPO, TIPOS_DO_ITEM, TIPOS_QUE_EMPILHAM, TURNOS_DA_PECA, PARTES_DO_EQUIPAMENTO, type AtaqueDoItem, type BalaDoItem, type BonusDoEquipamento, type ConfiraDoItem, type TipoDoItem } from '../lib/itens/modelo'
import {
  ACOES_DA_RECARGA,
  ACOES_DO_ITEM,
  alcanceGuardado,
  alcanceLido,
  CASAS_DO_ITEM_MAX,
  comOTipo,
  danoExtraDobra,
  DURACOES_NO_EDITOR,
  EXEMPLO_DO_TIPO,
  frasesDoItem,
  itemComOsCamposAntigos,
  itemParaOEditor,
  mecanicaDoBloco,
  motivoDasPecasDeAtributo,
  NUMERO_DO_ITEM_MAX,
  pecaNovaDoItem,
  PECAS_DE,
  PECAS_POR_BLOCO_MAX,
  pecasCabemNaTela,
  pecasDoItemGuardadas,
  pecasDoItemLidas,
  PENTE_MAX,
  ROTULO_DA_PARTE,
  ROTULO_DA_PECA,
  ROTULO_DO_BONUS,
  TEMPOS_DA_RECARGA,
  TIPOS_QUE_ATACAM,
  type DuracaoNoEditor,
  type OndeDaPeca,
  type PecaDeAtributo,
  type PecaDoItem,
} from '../lib/itens/editorDoItem'
import { primeiroNumero } from '../lib/itens/conversao/comum'
import { CampoDoAlcance } from './batalha/alcance/CampoDoAlcance'
import { CampoInteiro, Marcar } from './batalha/blocos/controles'
import { ImagemOuIniciais } from './FichaPecas'
import { CloseIcon } from './icons'
import { PinImageDrop } from './PinImageDrop'
import { DarAFichas } from './DarAFichas'
import './ItemDoCatalogoDialog.css'

/**
 * O EDITOR DO ITEM (docs/design/itens-rework/PLANO.md, etapa E2; protótipo aprovado
 * docs/design/itens-rework/prototipo.html). Primeiro o mestre diz o que o item É (o tipo); só
 * aparecem os campos daquele tipo, uma vez cada: dano, ação e alcance do ataque; o golpe da
 * híbrida; o pente e a recarga; o dano da bala; o uso do consumível; o que a roupa dá; e o "Ao
 * acertar" ou "Ao usar", com as mesmas peças das técnicas. Trocar de tipo esconde o que não serve
 * e não apaga: voltando, os números estão lá. "O que acontece" é a frase do item, ao vivo.
 *
 * O Acervo é a fonte: salvar aqui atualiza as cópias nas mochilas sozinho (`stores/itensNaFonte.ts`).
 * Até a batalha passar a ler os blocos (E6), o Salvar também põe em dia os campos de antes
 * (`itemComOsCamposAntigos`) e o dano na regra do livro ligada, para a mesa não divergir.
 *
 * A imagem chega pelos três caminhos da do token (colar, soltar, escolher), até 2 MB.
 */

export interface ItemDoCatalogoDialogProps {
  item: ItemDoCatalogo
  /** Item que ainda não está no acervo: sem "Apagar" nem "Dar", e o Salvar cria. */
  novo: boolean
  categorias: readonly string[]
  alvos: readonly AlvoDoAcervo[]
  onSalvar: (item: ItemDoCatalogo) => Promise<void>
  onApagar: () => Promise<void>
  /**
   * `false` = não deu (o token saiu da cena). Sem ele a janela não mostra o
   * "Dar a…": a página Itens do livro já põe na mochila pelo "Pôr em".
   */
  onDar?: (alvo: AlvoDoAcervo, quantidade: number) => boolean
  onClose: () => void
  /** Colar ou soltar: grava a imagem e devolve a referência. */
  imagemDoBlob: (fonte: Blob) => Promise<string>
  /** "Escolher imagem…": `null` = cancelou. */
  escolherImagem: () => Promise<string | null>
}

const FOCAVEIS = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** O preço digitado: vazio = sem preço; o resto, inteiro dentro do teto ou `undefined` (inválido). */
function precoDoTexto(texto: string): number | null | undefined {
  const limpo = texto.trim()
  if (limpo === '') return null
  if (!/^\d+$/.test(limpo)) return undefined
  const valor = Number(limpo)
  return Number.isSafeInteger(valor) && valor <= ITEM_PRECO_MAX ? valor : undefined
}

/** O item com a luz; `undefined` tira o campo (ausente = não ilumina). */
function comLuz(item: ItemDoCatalogo, luz: LuzDoItem | undefined): ItemDoCatalogo {
  const { luz: _antes, ...semLuz } = item
  return luz === undefined ? semLuz : { ...semLuz, luz }
}

/** O item com as peças de um bloco; `undefined` tira o bloco. */
function comPecas(item: ItemDoCatalogo, onde: OndeDaPeca, pecas: PecasDoEfeito | undefined): ItemDoCatalogo {
  if (onde === 'uso') {
    // Tirar o último efeito do consumível tira também o efeito de antes, que o Usar de hoje ainda roda (senão ele seguiria curando).
    const { aoUsar: _antes, efeito: _efeitoAntes, ...sem } = item
    return pecas === undefined ? sem : { ...sem, aoUsar: pecas }
  }
  const { aoAcertar: _antes, ...sem } = item
  return pecas === undefined ? sem : { ...sem, aoAcertar: pecas }
}

/** Força em porcentagem inteira, para o controle e para ler ("80%"). */
function porcento(forca: number): number {
  return Math.round(forca * 100)
}

/** "2,5 casas", "1 casa". */
function textoDoAlcance(casas: number): string {
  return `${String(casas).replace('.', ',')} ${casas === 1 ? 'casa' : 'casas'}`
}

/**
 * ITEM QUE ILUMINA (pedido de 18/11/2026): liga a luz do item e escolhe o
 * tom, o alcance, a força e o "crepita como fogo". Desligar e ligar de novo
 * volta com a luz de antes (a da janela aberta), não com a padrão.
 */
function LuzDoItemCampos({ idBase, luz, onMudar }: { idBase: string; luz: LuzDoItem | undefined; onMudar: (luz: LuzDoItem | undefined) => void }) {
  const ultima = useRef<LuzDoItem>(luz ?? LUZ_DO_ITEM_PADRAO)
  if (luz !== undefined) ultima.current = luz
  const mudar = (parte: Partial<LuzDoItem>) => {
    if (luz === undefined) return
    // `crepita` só existe ligado: desmarcar tira o campo.
    const crepita = 'crepita' in parte ? parte.crepita === true : luz.crepita === true
    const { crepita: _crepita, ...base } = { ...luz, ...parte }
    onMudar(crepita ? { ...base, crepita: true } : base)
  }
  return (
    <fieldset className="lb-item-janela__luz">
      <legend className="lb-label">Luz</legend>
      <label className="lb-item-janela__marca">
        <input type="checkbox" checked={luz !== undefined} onChange={(event) => onMudar(event.target.checked ? ultima.current : undefined)} />
        <span>Ilumina: aceso, clareia em volta de quem carrega. Qualquer tipo pode ter.</span>
      </label>
      {luz !== undefined && (
        <>
          {/* Botões que ficam apertados (não `radio`): o Tab passa por cada tom, sem o teclado de setas que o radio promete. */}
          <div className="lb-item-janela__cores" role="group" aria-label="Cor da luz">
            {CORES_SUGERIDAS_DA_LUZ_DO_ITEM.map((sugerida) => (
              <button
                key={sugerida.cor}
                type="button"
                aria-pressed={luz.cor === sugerida.cor}
                className="lb-item-janela__cor"
                title={sugerida.nome}
                aria-label={sugerida.nome}
                style={{ background: sugerida.cor }}
                onClick={() => mudar({ cor: sugerida.cor })}
              />
            ))}
            <label className="lb-item-janela__cor-livre" title="Outra cor">
              <input type="color" aria-label="Outra cor da luz" value={luz.cor} onChange={(event) => mudar({ cor: event.target.value.toLowerCase() })} />
            </label>
          </div>
          <div className="lb-item-janela__linha">
            <label className="lb-field" htmlFor={`${idBase}-alcance`}>
              <span className="lb-label">
                Alcance <output htmlFor={`${idBase}-alcance`}>{textoDoAlcance(luz.alcanceEmCasas)}</output>
              </span>
              <input
                id={`${idBase}-alcance`}
                type="range"
                min={ALCANCE_DA_LUZ_DO_ITEM_MIN}
                max={ALCANCE_DA_LUZ_DO_ITEM_MAX}
                step={0.5}
                value={luz.alcanceEmCasas}
                onChange={(event) => mudar({ alcanceEmCasas: Number(event.target.value) })}
              />
            </label>
            <label className="lb-field" htmlFor={`${idBase}-forca`}>
              <span className="lb-label">
                Força <output htmlFor={`${idBase}-forca`}>{porcento(luz.forca)}%</output>
              </span>
              <input
                id={`${idBase}-forca`}
                type="range"
                min={porcento(FORCA_DA_LUZ_DO_ITEM_MIN)}
                max={porcento(FORCA_DA_LUZ_DO_ITEM_MAX)}
                step={5}
                value={porcento(luz.forca)}
                onChange={(event) => mudar({ forca: Number(event.target.value) / 100 })}
              />
            </label>
          </div>
          <label className="lb-item-janela__marca">
            <input type="checkbox" checked={luz.crepita === true} onChange={(event) => mudar({ crepita: event.target.checked ? true : undefined })} />
            <span>Crepita como fogo: o claro treme</span>
          </label>
          <p className="lb-field__hint">Tons claros iluminam melhor: cor forte escurece o chão em volta.</p>
        </>
      )}
    </fieldset>
  )
}

function chaveDoAlvo(alvo: Pick<AlvoDoAcervo, 'tokenId' | 'sceneId'>): string {
  return `${alvo.sceneId ?? ''}|${alvo.tokenId}`
}

/** Uma seção do editor: título, frase curta e os campos. */
function Secao({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section className="lb-edi-secao" aria-labelledby={id}>
      <div className="lb-edi-secao__cab">
        <h3 id={id} className="lb-edi-secao__tit">
          {titulo}
        </h3>
        {sub !== undefined && <p className="lb-edi-secao__sub">{sub}</p>}
      </div>
      {children}
    </section>
  )
}

/** Um seletor com as opções e, se o valor guardado for outro ("Ação Padrão"), ele também (nada some). */
function CampoEscolha({ rotulo, valor, opcoes, onMudar, ajuda }: { rotulo: string; valor: string; opcoes: readonly { valor: string; rotulo: string }[]; onMudar: (valor: string) => void; ajuda?: string }) {
  const id = useId()
  const todas = opcoes.some((opcao) => opcao.valor === valor) ? opcoes : [{ valor, rotulo: valor === '' ? 'Nenhuma' : valor }, ...opcoes]
  return (
    <label className="lb-field" htmlFor={id}>
      <span className="lb-label">{rotulo}</span>
      <select id={id} className="lb-input" value={valor} onChange={(event) => onMudar(event.target.value)}>
        {todas.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
      {ajuda !== undefined && <span className="lb-field__hint">{ajuda}</span>}
    </label>
  )
}

const comoOpcoes = (lista: readonly string[]) => lista.map((valor) => ({ valor, rotulo: valor }))

const MODOS_DA_BALA: readonly { modo: BalaDoItem['modo']; rotulo: string }[] = [
  { modo: 'soma', rotulo: 'Soma ao dano da arma' },
  { modo: 'troca', rotulo: 'Troca o dano da arma' },
  { modo: 'atributo', rotulo: 'Soma um atributo' },
]

const CAMPOS_FIXOS_DO_BONUS: readonly Exclude<BonusDoEquipamento['campo'], 'atributo'>[] = ['ca', 'escudo', 'vantagem', 'desvantagem']

/** "O que é este item?": os 8 tipos, um grupo de rádio (setas andam, Espaço escolhe). */
function EscolhaDoTipo({ tipo, onEscolher }: { tipo: TipoDoItem | undefined; onEscolher: (tipo: TipoDoItem) => void }) {
  const grupoRef = useRef<HTMLDivElement>(null)
  const tecla = (event: KeyboardEvent<HTMLDivElement>) => {
    const passo = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (passo === 0) return
    event.preventDefault()
    const atual = tipo === undefined ? -1 : TIPOS_DO_ITEM.indexOf(tipo)
    const proximo = TIPOS_DO_ITEM[(atual + passo + TIPOS_DO_ITEM.length) % TIPOS_DO_ITEM.length]
    onEscolher(proximo)
    requestAnimationFrame(() => grupoRef.current?.querySelector<HTMLElement>(`[data-tipo="${proximo}"]`)?.focus())
  }
  return (
    <Secao titulo="O que é este item?" sub={tipo === undefined ? 'Escolha um tipo para ver os campos.' : 'O tipo decide os campos. Trocar de tipo esconde o que não serve, sem apagar.'}>
      <div ref={grupoRef} className="lb-edi-tipos" role="radiogroup" aria-label="Tipo do item" onKeyDown={tecla}>
        {TIPOS_DO_ITEM.map((opcao) => (
          <button
            key={opcao}
            type="button"
            role="radio"
            data-tipo={opcao}
            className="lb-edi-tipo"
            aria-checked={tipo === opcao}
            tabIndex={tipo === opcao || (tipo === undefined && opcao === 'corpo') ? 0 : -1}
            onClick={() => onEscolher(opcao)}
          >
            <span className="lb-edi-tipo__nome">{ROTULO_DO_TIPO[opcao]}</span>
            <span className="lb-edi-tipo__ex">{EXEMPLO_DO_TIPO[opcao]}</span>
          </button>
        ))}
      </div>
    </Secao>
  )
}

/** O ataque (Corpo a corpo, De fogo, o tiro da Híbrida, Arremesso): dano, soma, ação, alvos e alcance, uma vez. */
function CamposDoAtaque({ tipo, ataque, atributos, onMudar }: { tipo: TipoDoItem; ataque: AtaqueDoItem; atributos: readonly { valor: string; rotulo: string }[]; onMudar: (ataque: AtaqueDoItem) => void }) {
  const titulo = tipo === 'arremesso' ? 'Como é jogado' : tipo === 'hibrida' ? 'Como atira' : tipo === 'fogo' ? 'Como atira' : 'Como ataca'
  const sub = tipo === 'hibrida' ? 'O tiro da híbrida. O golpe fica à parte, logo abaixo.' : 'Dano, ação, alvos e alcance ficam só aqui, uma vez.'
  const forma = alcanceLido(ataque.alcance)
  return (
    <Secao titulo={titulo} sub={sub}>
      <div className="lb-edi-grade">
        <CampoInteiro rotulo="Dano" valor={ataque.dano} minimo={0} maximo={NUMERO_DO_ITEM_MAX} onChange={(dano) => onMudar({ ...ataque, dano })} />
        <CampoEscolha rotulo="Soma no ataque" valor={ataque.soma} opcoes={[{ valor: '', rotulo: 'Nada' }, ...atributos]} onMudar={(soma) => onMudar({ ...ataque, soma })} />
        <CampoEscolha rotulo="Ação" valor={ataque.acao} opcoes={comoOpcoes(ACOES_DO_ITEM)} onMudar={(acao) => onMudar({ ...ataque, acao })} />
        <CampoInteiro rotulo="Alvos" valor={ataque.alvos} minimo={1} maximo={6} onChange={(alvos) => onMudar({ ...ataque, alvos })} />
      </div>
      <CampoDoAlcance
        valor={forma}
        torto={forma === null && ataque.alcance !== undefined}
        cor="azul"
        onChange={(nova) => {
          const { alcance: _antes, ...sem } = ataque
          onMudar(nova === null ? sem : { ...sem, alcance: alcanceGuardado(nova) })
        }}
      />
    </Secao>
  )
}

const OPCOES_DO_TEMPO = TEMPOS_DA_RECARGA.map((tempo) => ({ valor: String(tempo.rodadas), rotulo: tempo.rotulo }))

function rodadasDoTexto(texto: string): 0 | 1 | 2 {
  return texto === '1' ? 1 : texto === '2' ? 2 : 0
}

/** As munições do Acervo (pelo tipo, ou pela categoria do item ainda não convertido), menos a própria arma. */
function useMunicoesDoAcervo(armaId: string): ItemDoCatalogo[] {
  const itens = useAcervoDeItensStore((state) => state.itens)
  return useMemo(() => itens.filter((candidato) => candidato.id !== armaId && (candidato.tipo === 'municao' || (candidato.tipo === undefined && ehCategoriaDeMunicao(candidato.categoria)))), [itens, armaId])
}

/** Quanto custa ter o próximo na mão: a ação da recarga e o tempo. */
function CamposDaRecarga({ recarga, ajudaDoTempo, onMudar }: { recarga: { acao: string; rodadas: 0 | 1 | 2 } | undefined; ajudaDoTempo: string; onMudar: (recarga: { acao: string; rodadas: 0 | 1 | 2 }) => void }) {
  const atual = recarga ?? { acao: 'Ação Simples', rodadas: 0 }
  return (
    <>
      <CampoEscolha rotulo="Tipo de recarga" valor={atual.acao} opcoes={comoOpcoes(ACOES_DA_RECARGA)} onMudar={(acao) => onMudar({ ...atual, acao })} ajuda="A ação que a recarga gasta na batalha." />
      <CampoEscolha rotulo="Tempo de recarga" valor={String(atual.rodadas)} opcoes={OPCOES_DO_TEMPO} onMudar={(texto) => onMudar({ ...atual, rodadas: rodadasDoTexto(texto) })} ajuda={ajudaDoTempo} />
    </>
  )
}

/** As peças de um bloco ("Ao acertar" ou "Ao usar"), a mesma linguagem das técnicas. */
function PecasDoBloco({
  onde,
  guardadas,
  item,
  condicoes,
  sistema,
  onMudar,
}: {
  onde: OndeDaPeca
  guardadas: PecasDoEfeito | undefined
  item: ItemDoCatalogo
  condicoes: readonly string[]
  sistema: SistemaDeRpg
  onMudar: (pecas: PecasDoEfeito | undefined) => void
}) {
  const titulo = onde === 'uso' ? 'Ao usar' : 'Ao acertar'
  const sub = onde === 'uso' ? 'O que acontece com quem recebe.' : 'As mesmas peças das técnicas: condição com duração, dano extra, empurrão, atributos. Dano, ação e alcance não se repetem aqui.'
  const cabe = pecasCabemNaTela(guardadas)
  const pecas = pecasDoItemLidas(guardadas)
  const mecanica = mecanicaDoBloco(guardadas, onde)
  const motivoDoMotor = motivoDasPecasDeAtributo(guardadas, onde)
  const trocar = (lista: readonly PecaDoItem[]) => onMudar(pecasDoItemGuardadas(lista, onde, guardadas))
  const mudarUma = (indice: number, peca: PecaDoItem) => trocar(pecas.map((atual, i) => (i === indice ? peca : atual)))
  if (!cabe && guardadas !== undefined) {
    return (
      <Secao titulo={titulo} sub={sub}>
        <p className="lb-edi-nota">{resumoDoEfeitoDoItem({ mecanica: guardadas, gasta: 'um', onde: 'sempre' }, sistema)}</p>
        <p className="lb-field__hint">Este efeito tem peças que esta tela ainda não mostra. Para não perder nada, ele fica como está.</p>
      </Secao>
    )
  }
  const opcoesDeCondicao = (nome: string) => (condicoes.includes(nome) ? condicoes : [nome, ...condicoes]).map((valor) => ({ valor, rotulo: valor }))
  const catalogo = useCatalogoDoSeletor()
  return (
    <Secao titulo={titulo} sub={sub}>
      {pecas.length === 0 ? (
        <p className="lb-edi-nota">{onde === 'uso' ? 'Nenhum efeito: usar não gasta, e o mestre narra o que acontece.' : 'Nenhum efeito extra. O dano já está em cima.'}</p>
      ) : (
        <ul className="lb-edi-pecas">
          {pecas.map((peca, indice) => {
            if (peca.tipo === 'status' || peca.tipo === 'diminui') {
              return (
                <li key={indice}>
                  <PecaDeAtributoDoItem peca={peca} mecanica={mecanica} onMudar={(nova) => mudarUma(indice, nova)} onTirar={() => trocar(pecas.filter((_, i) => i !== indice))} />
                </li>
              )
            }
            const dobra = danoExtraDobra(item, peca)
            return (
              <li key={indice} className="lb-edi-peca" data-erro={dobra ? '' : undefined}>
                <div className="lb-edi-peca__campos">
                  {peca.tipo === 'condicao' && <PecaCondicaoDoItem peca={peca} onde={onde} catalogo={catalogo} onMudar={(nova) => mudarUma(indice, nova)} />}
                  {peca.tipo === 'dano' && <CampoInteiro rotulo="Mais dano extra" valor={peca.valor} minimo={1} maximo={NUMERO_DO_ITEM_MAX} onChange={(valor) => mudarUma(indice, { tipo: 'dano', valor })} />}
                  {peca.tipo === 'empurrar' && <CampoInteiro rotulo="O alvo é empurrado" valor={peca.casas} minimo={1} maximo={CASAS_DO_ITEM_MAX} depois={peca.casas === 1 ? 'casa para trás' : 'casas para trás'} onChange={(casas) => mudarUma(indice, { tipo: 'empurrar', casas })} />}
                  {peca.tipo === 'curar' && <CampoInteiro rotulo="Cura" valor={peca.fixo} minimo={1} maximo={NUMERO_DO_ITEM_MAX} depois="de vida" onChange={(fixo) => mudarUma(indice, { tipo: 'curar', fixo })} />}
                  {peca.tipo === 'tirar' && (
                    <CampoEscolha
                      rotulo="Tira"
                      valor={peca.nome ?? ''}
                      opcoes={[{ valor: '', rotulo: 'as condições ruins' }, ...opcoesDeCondicao(peca.nome ?? condicoes[0] ?? NOME_DA_CURA_REDUZIDA)]}
                      onMudar={(nome) => mudarUma(indice, { tipo: 'tirar', nome: nome === '' ? null : nome })}
                    />
                  )}
                </div>
                <button type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label={`Tirar ${ROTULO_DA_PECA[peca.tipo]}`} onClick={() => trocar(pecas.filter((_, i) => i !== indice))}>
                  <CloseIcon size={14} />
                </button>
                {dobra && (
                  <p className="lb-edi-peca__erro" role="alert">
                    Repete o dano de cima ({peca.tipo === 'dano' ? peca.valor : ''}). Assim o dano contaria duas vezes, então esta peça fica fora até você mudar o número.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="lb-edi-mais" role="group" aria-label="Pôr efeito">
        <span className="lb-label">+ Efeito:</span>
        {PECAS_DE[onde].map((tipo) => {
          // As peças das técnicas entram uma vez só no mesmo bloco (a mesma regra do leitor delas).
          const jaTem = (tipo === 'status' || tipo === 'diminui') && pecas.some((peca) => peca.tipo === tipo)
          return (
            <button key={tipo} type="button" className="lb-btn lb-btn--compact" disabled={pecas.length >= PECAS_POR_BLOCO_MAX || jaTem} onClick={() => trocar([...pecas, pecaNovaDoItem(tipo, condicoes)])}>
              {tipo === 'status' || tipo === 'diminui' ? entradaDaPeca(tipo).nome : ROTULO_DA_PECA[tipo]}
            </button>
          )
        })}
      </div>
      {motivoDoMotor !== null && (
        <p className="lb-field__error" role="alert">
          Assim a batalha não aplica o Muda atributo e o Diminui atributo ({motivoDoMotor}). Ajuste as peças antes de salvar.
        </p>
      )}
      {onde === 'acerto' && pecas.some((peca) => peca.tipo === 'empurrar') && <p className="lb-field__hint">O empurrão fica guardado; a mesa passa a mover o token quando a batalha ler os itens novos.</p>}
    </Secao>
  )
}

/** Os "Confira" da conversão: o que não virou campo com certeza, com os números lado a lado. O mestre apaga ao conferir. */
function PainelConfira({ lista, onConferido }: { lista: readonly ConfiraDoItem[]; onConferido: (indice: number) => void }) {
  return (
    <section className="lb-edi-confira" aria-label="Confira">
      <h3 className="lb-edi-confira__tit">Confira</h3>
      <ul>
        {lista.map((aviso, indice) => (
          <li key={`${aviso.texto}-${indice}`}>
            <span>
              {aviso.texto}
              {(aviso.antes !== undefined || aviso.depois !== undefined) && (
                <span className="lb-edi-confira__nums">
                  {aviso.antes !== undefined && <span>Antes: {aviso.antes}</span>}
                  {aviso.depois !== undefined && <span>Agora: {aviso.depois}</span>}
                </span>
              )}
            </span>
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => onConferido(indice)}>
              Conferido
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** O sistema das fichas: o do livro aberto, senão o da aventura, senão o One Piece (os atributos da soma e do bônus). */
function useSistemaDoEditor(): SistemaDeRpg {
  const doLivro = useCatalogoStore((state) => state.sistemaId)
  const daAventura = useAdventureStore(sistemaAtivo)
  return useRpgStore((state) => sistemaPorId(state.biblioteca, doLivro ?? daAventura) ?? sistemaPorId(state.biblioteca, daAventura)) ?? SISTEMA_ONE_PIECE
}

/** As condições que as peças do item oferecem: as do catálogo (de fábrica e as criadas), a mesma lista das técnicas (rework das condições, E7). */
function useNomesDasCondicoes(): string[] {
  const catalogo = useCatalogoDoSeletor()
  return useMemo(() => catalogo.opcoes.map((opcao) => opcao.nome), [catalogo])
}

/** O prazo da condição no "Quanto tempo dura" do item (D6: o padrão é o dela); o item guarda até 10 turnos (`TURNOS_DA_PECA`) ou o fim da batalha. */
function duracaoDoItem(prazo: PrazoDaCondicao, antes: DuracaoNoEditor): DuracaoNoEditor {
  if (prazo.modo === 'ateTirar' || prazo.modo === 'batalha') return 'fim'
  const turnos = turnosDaCondicao(prazo, DURACAO_DA_PECA_MAX)
  return TURNOS_DA_PECA.find((opcao) => opcao === turnos) ?? antes
}

/** As peças de atributo não mexem no que mora fora delas (os usos por batalha, a reação): a mecânica do item fica como está. */
function semMudarAMecanica(): void {}

/**
 * Pedido de 27/11/2026 ("os itens eles conseguem dar e diminuir status?"): o Muda atributo e o Diminui
 * atributo no item com a MESMA moldura, o mesmo corpo (o componente do registro das técnicas) e o mesmo
 * aviso (`avisoDaPeca`) do editor de habilidades. `mecanica` = a do bloco, como a técnica passa a dela.
 */
function PecaDeAtributoDoItem({ peca, mecanica, onMudar, onTirar }: { peca: PecaDeAtributo; mecanica: MecanicaV1; onMudar: (peca: PecaDeAtributo) => void; onTirar: () => void }) {
  const aviso = avisoDaPeca(peca, mecanica)
  if (peca.tipo === 'status') {
    const entrada = entradaDaPeca('status')
    const Corpo = entrada.Componente
    return (
      <MolduraDaPeca entrada={entrada} aviso={aviso} onTirar={onTirar}>
        <Corpo peca={peca} mecanica={mecanica} aoMudar={onMudar} aoMudarAMecanica={semMudarAMecanica} />
      </MolduraDaPeca>
    )
  }
  const entrada = entradaDaPeca('diminui')
  const Corpo = entrada.Componente
  return (
    <MolduraDaPeca entrada={entrada} aviso={aviso} onTirar={onTirar}>
      <Corpo peca={peca} mecanica={mecanica} aoMudar={onMudar} aoMudarAMecanica={semMudarAMecanica} />
    </MolduraDaPeca>
  )
}

/**
 * A peça Condição do item (rework das condições, E7, D4 e D6): escolhe QUAL condição, do catálogo, e por
 * quanto tempo; a regra é da condição, com a frase curta dela. O `n` e o gatilho próprios de antes
 * continuam valendo e ficam à vista em "Regra própria (de antes)"; número novo se põe na condição.
 */
function PecaCondicaoDoItem({ peca, onde, catalogo, onMudar }: { peca: PecaDoItemQuePoe; onde: OndeDaPeca; catalogo: CatalogoDoSeletor; onMudar: (peca: PecaDoItemQuePoe) => void }) {
  const id = useId()
  const condicao = peca.nome.trim() === '' ? null : condicaoDoSeletor(catalogo, peca.nome)
  const frase = condicao === null ? '' : fraseCurta(condicao.montada, catalogo.contexto)
  const legado = legadoDaPecaDoItem(peca, condicao === null ? null : condicao.regra)
  const naLista = catalogo.opcoes.some((opcao) => opcao.nome === peca.nome)
  return (
    <>
      <label className="lb-field" htmlFor={id}>
        <span className="lb-label">{onde === 'uso' ? 'Quem recebe fica' : 'Quem é atingido fica'}</span>
        <select
          id={id}
          className="lb-input"
          value={peca.nome}
          onChange={(evento) => {
            const opcao = catalogo.opcoes.find((candidata) => candidata.nome === evento.target.value)
            if (opcao === undefined) return
            // A condição nova traz o prazo dela; o número de antes era da outra condição e sai; o gatilho de antes fica.
            onMudar({ tipo: 'condicao', nome: opcao.nome, duracao: duracaoDoItem(opcao.condicao.montada.prazo, peca.duracao), ...(peca.gatilho === undefined ? {} : { gatilho: peca.gatilho }) })
          }}
        >
          {!naLista && <option value={peca.nome}>{peca.nome === '' ? 'Nenhuma' : peca.nome}</option>}
          <OpcoesDeCondicao catalogo={catalogo} />
        </select>
      </label>
      <CampoEscolha
        rotulo="Quanto tempo dura"
        valor={String(peca.duracao)}
        opcoes={DURACOES_NO_EDITOR.map((opcao) => ({ valor: String(opcao.duracao), rotulo: opcao.rotulo }))}
        onMudar={(texto) => {
          // De 1 a 10 turnos (as opções de `DURACOES_NO_EDITOR`): o "4 turnos" não pode virar "até o fim da batalha".
          onMudar({ ...peca, duracao: duracaoDoTexto(texto) })
        }}
      />
      <span className="lb-field__hint">
        {condicao === null ? 'Fora do catálogo: o mestre narra.' : `${frase === '' ? 'Sem peça: o mestre narra' : frase}. O prazo dela: ${prazoCurto(condicao.montada.prazo)}.`}
      </span>
      {legado !== null && (
        <RegraDeAntes legado={legado} nome={peca.nome} catalogo={catalogo} onUsarSoACondicao={() => onMudar(pecaDoItemSoComACondicao(peca))} onVirou={(nome) => onMudar({ ...pecaDoItemSoComACondicao(peca), nome })} />
      )}
    </>
  )
}

export function ItemDoCatalogoDialog({ item, novo, alvos, onSalvar, onApagar, onDar, onClose, imagemDoBlob, escolherImagem }: ItemDoCatalogoDialogProps) {
  const tituloId = useId()
  const idBase = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const apertouNoFundo = useRef(false)
  const sistema = useSistemaDoEditor()
  const livroAberto = useCatalogoStore((state) => (state.podeGravar ? state.sistemaId : null))
  const entradasDoLivro = useCatalogoStore((state) => state.itens)
  const regraDoLivro = useMemo(() => {
    const entrada = regraDaCoisa(entradasDoLivro, item.id)
    return entrada !== undefined && entrada.tipo === 'arma' ? entrada : undefined
  }, [entradasDoLivro, item.id])
  const [aberto] = useState(() => itemParaOEditor(item, regraDoLivro))
  const [rascunho, setRascunho] = useState(aberto.item)
  /** ITENS REFEITOS, E6c: o último "Testar no boneco", preso ao rascunho que testou (mexeu no item, o resultado some). */
  const [teste, setTeste] = useState<{ de: typeof rascunho; linhas: string[] } | null>(null)
  const criadas = useCondicoesPropriasStore((state) => state.catalogo)
  /** O item como está gravado (o de abrir, completado; depois, o último salvo): "mudou" compara com ele. */
  const [gravado, setGravado] = useState(aberto.item)
  /** O editor montou peças do texto de antes (a bala de prata): há o que salvar mesmo sem o mestre mexer. */
  const [montouAoAbrir, setMontouAoAbrir] = useState(aberto.avisos.length > 0)
  const [precoTexto, setPrecoTexto] = useState(item.preco === null ? '' : String(item.preco))
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmarApagar, setConfirmarApagar] = useState(false)
  // Itens refeitos (E3): a ficha recebe pelo "Dar a…" das fichas (`DarAFichas`); aqui ficam só os tokens SEM ficha (A3).
  // Antes da migração (a mochila ainda mora no boneco), a ficha não é a dona: tudo vai pelo token, como antes.
  const mochilaNaFicha = useAdventureStore(mochilaMoraNaFicha)
  const semFicha = useMemo(() => (mochilaNaFicha ? alvos.filter((alvo) => alvo.personagemId === undefined) : alvos), [alvos, mochilaNaFicha])
  const [alvoEscolhido, setAlvoEscolhido] = useState(semFicha[0] === undefined ? '' : chaveDoAlvo(semFicha[0]))
  const [quantidade, setQuantidade] = useState(1)
  const [resultadoDoDar, setResultadoDoDar] = useState<string | null>(null)
  const condicoes = useNomesDasCondicoes()
  const acervo = useAcervoDeItensStore((state) => state.itens)
  const municoes = useMunicoesDoAcervo(rascunho.id)
  const atributos = useMemo(() => sistema.atributos.map((atributo) => ({ valor: atributo.id, rotulo: atributo.nome })), [sistema])
  const nomeDoAtributo = useMemo(() => {
    const porId = new Map(sistema.atributos.map((atributo) => [atributo.id, atributo.nome]))
    return (id: string) => porId.get(id) ?? id
  }, [sistema])

  const preco = precoDoTexto(precoTexto)
  // O que o editor só completou ao abrir (os blocos de partida do tipo) não conta como mudança; o que ele montou do texto de antes, sim.
  const mudou = novo || rascunho !== gravado || montouAoAbrir || preco !== gravado.preco
  const tipo = rascunho.tipo

  useEffect(() => {
    const quemAbriu = document.activeElement
    dialogRef.current?.focus()
    return () => {
      if (quemAbriu instanceof HTMLElement && quemAbriu !== document.body && quemAbriu.isConnected) quemAbriu.focus()
    }
  }, [])

  /**
   * O botão apertado fica desligado enquanto grava (e o Salvar continua
   * desligado depois, sem mudança) e o foco cai no corpo da página. Ali o Esc
   * não chega à janela: no mundo do livro ele fechava o livro inteiro. Acabou
   * de gravar e o foco está num botão desligado ou no corpo: volta para a janela.
   */
  useEffect(() => {
    if (ocupado) return
    const ativo = document.activeElement
    if (ativo === null || ativo === document.body || ativo.matches(':disabled')) dialogRef.current?.focus()
  }, [ocupado])

  const frases = useMemo(
    () =>
      frasesDoItem(rascunho, {
        nomeDoItem: (id) => acervo.find((candidato) => candidato.id === id)?.nome ?? null,
        nomeDoAtributo,
        armasQueAceitam: (municaoId) => acervo.filter((arma) => arma.id !== rascunho.id && (arma.pente?.aceita ?? arma.municoes ?? []).includes(municaoId)).map((arma) => arma.nome),
      }),
    [rascunho, acervo, nomeDoAtributo],
  )

  const trocarImagem = async (pegar: () => Promise<string | null>) => {
    setErro(null)
    setOcupado(true)
    try {
      const imagem = await pegar()
      if (imagem !== null) setRascunho((atual) => ({ ...atual, imagem }))
    } catch (falha) {
      setErro(mensagemDe(falha))
    } finally {
      setOcupado(false)
    }
  }

  /** O dano da arma na regra do livro ligada, quando ela guarda só um número (a fórmula escrita à mão fica). */
  const levarODanoAoLivro = async (salvo: ItemDoCatalogo) => {
    if (regraDoLivro === undefined || livroAberto === null || salvo.ataque === undefined || salvo.tipo === undefined || !TIPOS_QUE_ATACAM.has(salvo.tipo)) return
    const sistemaDoLivro = sistemaPorId(useRpgStore.getState().biblioteca, livroAberto)
    if (sistemaDoLivro === undefined) return
    const danoAntes = (regraDoLivro.campos.dano ?? '').trim()
    if (danoAntes !== '' && !/^\d+$/.test(danoAntes)) return
    if (primeiroNumero(danoAntes) === salvo.ataque.dano) return
    await gravarRegraDaArma({ ...regraDoLivro, campos: { ...regraDoLivro.campos, dano: String(salvo.ataque.dano) } }, sistemaDoLivro)
  }

  const salvar = async () => {
    if (preco === undefined) {
      setErro('O preço é um número inteiro de berries (ou vazio, sem preço).')
      return
    }
    if (tipo === undefined) {
      setErro('Escolha o que o item é (o tipo) para salvar.')
      return
    }
    setErro(null)
    setOcupado(true)
    try {
      const salvo = itemComOsCamposAntigos({ ...rascunho, nome: cleanItemName(rascunho.nome) || ITEM_SEM_NOME, preco }, nomeDoAtributo)
      await onSalvar(salvo)
      await levarODanoAoLivro(salvo)
      // Com o salvo como base, "nada mudou" volta a valer e o "Dar" libera.
      setRascunho(salvo)
      setGravado(salvo)
      setMontouAoAbrir(false)
      if (novo) onClose()
    } catch (falha) {
      setErro(mensagemDe(falha))
    } finally {
      setOcupado(false)
    }
  }

  const apagar = async () => {
    setOcupado(true)
    try {
      await onApagar()
      onClose()
    } catch (falha) {
      setErro(mensagemDe(falha))
      setOcupado(false)
    }
  }

  const dar = () => {
    const alvo = semFicha.find((candidato) => chaveDoAlvo(candidato) === alvoEscolhido)
    if (alvo === undefined || onDar === undefined) return
    const quantos = item.empilhavel ? quantidade : 1
    const deu = onDar(alvo, quantos)
    setResultadoDoDar(deu ? `Dado a ${alvo.nome}${quantos > 1 ? ` (×${quantos})` : ''}.` : `Não deu: ${alvo.nome} não está mais na cena.`)
  }

  const tecla = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focaveis = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? [])
    const primeiro = focaveis[0]
    const ultimo = focaveis[focaveis.length - 1]
    if (primeiro === undefined || ultimo === undefined) return
    if (event.shiftKey && (document.activeElement === primeiro || document.activeElement === dialogRef.current)) {
      event.preventDefault()
      ultimo.focus()
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault()
      primeiro.focus()
    }
  }

  const cliqueNoFundo = (event: MouseEvent<HTMLDivElement>) => {
    if (apertouNoFundo.current && event.target === event.currentTarget) onClose()
    apertouNoFundo.current = false
  }

  const mudarAtaque = (ataque: AtaqueDoItem) => setRascunho((atual) => ({ ...atual, ataque }))
  const empilhaSozinho = tipo !== undefined && TIPOS_QUE_EMPILHAM.has(tipo)
  const blocoDasPecas: OndeDaPeca | null = tipo === 'consumivel' ? 'uso' : tipo !== undefined && tipo !== 'equipamento' && tipo !== 'outros' ? 'acerto' : null
  const marcarMunicao = (id: string, marcada: boolean) =>
    setRascunho((atual) => {
      if (atual.pente === undefined) return atual
      const aceita = marcada ? [...atual.pente.aceita, id].slice(0, MUNICOES_POR_ARMA_MAX) : atual.pente.aceita.filter((escolhida) => escolhida !== id)
      return { ...atual, pente: { ...atual.pente, aceita } }
    })
  const mudarBonus = (indice: number, bonus: BonusDoEquipamento) =>
    setRascunho((atual) => (atual.equipamento === undefined ? atual : { ...atual, equipamento: { ...atual.equipamento, bonus: atual.equipamento.bonus.map((antes, i) => (i === indice ? bonus : antes)) } }))
  const confira = rascunho.confira ?? []

  return createPortal(
    <div className="lb-dialog-backdrop" onMouseDown={(event) => (apertouNoFundo.current = event.target === event.currentTarget)} onClick={cliqueNoFundo}>
      <div ref={dialogRef} className="lb-panel lb-dialog lb-item-janela lb-edi" role="dialog" aria-modal="true" aria-labelledby={tituloId} tabIndex={-1} onKeyDown={tecla}>
        <header className="lb-dialog__head lb-item-janela__topo">
          <h2 id={tituloId} className="lb-dialog__title">
            {novo ? 'Item novo' : `Editar ${item.nome}`}
          </h2>
          <button type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label="Fechar" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </header>
        <div className="lb-dialog__body lb-scroll lb-item-janela__corpo">
          {confira.length > 0 && (
            <PainelConfira
              lista={confira}
              onConferido={(indice) =>
                setRascunho((atual) => {
                  const resto = (atual.confira ?? []).filter((_, i) => i !== indice)
                  const { confira: _antes, ...sem } = atual
                  return resto.length === 0 ? sem : { ...sem, confira: resto }
                })
              }
            />
          )}
          {montouAoAbrir && aberto.avisos.map((aviso) => (
            <p key={aviso} className="lb-edi-aviso" role="status">
              {aviso}
            </p>
          ))}
          <EscolhaDoTipo tipo={tipo} onEscolher={(novoTipo) => setRascunho((atual) => (atual.tipo === novoTipo ? atual : comOTipo(atual, novoTipo)))} />

          <Secao titulo="Nome, imagem e preço">
            <div className="lb-item-janela__imagem-linha">
              <div className="lb-item-janela__imagem">
                <ImagemOuIniciais imagem={rascunho.imagem} nome={rascunho.nome} alt={`Imagem de ${rascunho.nome}`} />
              </div>
              <div className="lb-item-janela__imagem-acoes">
                <PinImageDrop rotulo="Colar ou soltar imagem do item" onImage={(fonte) => void trocarImagem(() => imagemDoBlob(fonte))} />
                <div className="lb-item-janela__botoes">
                  <button type="button" className="lb-btn lb-btn--compact" disabled={ocupado} onClick={() => void trocarImagem(escolherImagem)}>
                    {rascunho.imagem === null ? 'Escolher imagem…' : 'Trocar imagem…'}
                  </button>
                  {rascunho.imagem !== null && (
                    <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => setRascunho({ ...rascunho, imagem: null })}>
                      Tirar imagem
                    </button>
                  )}
                </div>
                <p className="lb-field__hint">PNG, JPG, WEBP ou GIF, até 2 MB.</p>
              </div>
            </div>
            <div className="lb-item-janela__linha">
              <label className="lb-field" htmlFor={`${idBase}-nome`}>
                <span className="lb-label">Nome</span>
                <input id={`${idBase}-nome`} className="lb-input" value={rascunho.nome} maxLength={ITEM_NAME_MAX_LENGTH} placeholder="Ex.: Bala de Prata" onChange={(event) => setRascunho({ ...rascunho, nome: event.target.value })} />
              </label>
              <label className="lb-field" htmlFor={`${idBase}-preco`}>
                <span className="lb-label">Preço (berries)</span>
                <input id={`${idBase}-preco`} className="lb-input" inputMode="numeric" placeholder="Sem preço" value={precoTexto} aria-invalid={preco === undefined} onChange={(event) => setPrecoTexto(event.target.value)} />
              </label>
            </div>
          </Secao>

          {tipo === 'hibrida' && rascunho.golpe !== undefined && (
            <Secao titulo="Como golpeia" sub="O golpe corpo a corpo da híbrida. Não gasta bala.">
              <div className="lb-edi-grade">
                <CampoInteiro rotulo="Dano do golpe" valor={rascunho.golpe.dano} minimo={0} maximo={NUMERO_DO_ITEM_MAX} onChange={(dano) => setRascunho((atual) => (atual.golpe === undefined ? atual : { ...atual, golpe: { ...atual.golpe, dano } }))} />
                <CampoEscolha rotulo="Soma no golpe" valor={rascunho.golpe.soma} opcoes={[{ valor: '', rotulo: 'Nada' }, ...atributos]} onMudar={(soma) => setRascunho((atual) => (atual.golpe === undefined ? atual : { ...atual, golpe: { ...atual.golpe, soma } }))} />
                <CampoEscolha rotulo="Ação" valor={rascunho.golpe.acao} opcoes={comoOpcoes(ACOES_DO_ITEM)} onMudar={(acao) => setRascunho((atual) => (atual.golpe === undefined ? atual : { ...atual, golpe: { ...atual.golpe, acao } }))} />
              </div>
              <CampoDoAlcance
                valor={alcanceLido(rascunho.golpe.alcance)}
                cor="azul"
                onChange={(nova) =>
                  setRascunho((atual) => {
                    if (atual.golpe === undefined) return atual
                    const { alcance: _antes, ...sem } = atual.golpe
                    return { ...atual, golpe: nova === null ? sem : { ...sem, alcance: alcanceGuardado(nova) } }
                  })
                }
              />
            </Secao>
          )}

          {tipo !== undefined && TIPOS_QUE_ATACAM.has(tipo) && rascunho.ataque !== undefined && <CamposDoAtaque tipo={tipo} ataque={rascunho.ataque} atributos={atributos} onMudar={mudarAtaque} />}

          {(tipo === 'fogo' || tipo === 'hibrida') && rascunho.pente !== undefined && (
            <Secao titulo="Munição e recarga" sub="A arma só diz quais balas servem e quantas cabem no pente. As balas moram na mochila e vão para o pente na recarga.">
              <div className="lb-edi-grade">
                <CampoInteiro rotulo="Capacidade do pente" valor={rascunho.pente.capacidade} minimo={1} maximo={PENTE_MAX} onChange={(capacidade) => setRascunho((atual) => (atual.pente === undefined ? atual : { ...atual, pente: { ...atual.pente, capacidade } }))} />
                <CamposDaRecarga recarga={rascunho.pente.recarga} ajudaDoTempo="Até a arma poder atirar de novo." onMudar={(recarga) => setRascunho((atual) => (atual.pente === undefined ? atual : { ...atual, pente: { ...atual.pente, recarga } }))} />
              </div>
              <fieldset className="lb-item-janela__municoes">
                <legend className="lb-label">Munições que aceita</legend>
                {municoes.length === 0 ? (
                  <p className="lb-field__hint">Nenhuma munição no Acervo ainda. Crie uma com Novo item, tipo Munição.</p>
                ) : (
                  municoes.map((municao) => (
                    <label key={municao.id} className="lb-item-janela__marca">
                      <input type="checkbox" checked={rascunho.pente?.aceita.includes(municao.id) === true} onChange={(event) => marcarMunicao(municao.id, event.target.checked)} />
                      <span>{municao.nome}</span>
                    </label>
                  ))
                )}
              </fieldset>
            </Secao>
          )}

          {tipo === 'arremesso' && (
            <Secao titulo="Recarga" sub="Quanto custa ter o próximo na mão. Fora da batalha é na hora.">
              <div className="lb-edi-grade">
                <CamposDaRecarga
                  recarga={rascunho.arremesso?.recarga}
                  ajudaDoTempo={rascunho.arremesso?.volta === true ? 'Quando volta para a mão.' : 'Até o próximo ir para a mão.'}
                  onMudar={(recarga) => setRascunho((atual) => ({ ...atual, arremesso: { ...atual.arremesso, recarga } }))}
                />
              </div>
              <Marcar
                rotulo={rascunho.arremesso?.volta === true ? 'Volta para a mão: como um boomerang, não sai da mochila' : 'Volta para a mão (desligado: cada um que é jogado sai da mochila)'}
                marcado={rascunho.arremesso?.volta === true}
                onChange={(volta) =>
                  setRascunho((atual) => {
                    const { volta: _antes, ...sem } = atual.arremesso ?? {}
                    return { ...atual, arremesso: volta ? { ...sem, volta: true } : sem }
                  })
                }
              />
            </Secao>
          )}

          {tipo === 'municao' && rascunho.bala !== undefined && (
            <Secao titulo="Dano da bala" sub="Ação, alvos e alcance vêm da arma que atira. Aqui fica só o que a bala muda.">
              <div className="lb-edi-seg" role="radiogroup" aria-label="Como a bala mexe no dano">
                {MODOS_DA_BALA.map(({ modo, rotulo }) => (
                  <button key={modo} type="button" role="radio" aria-checked={rascunho.bala?.modo === modo} onClick={() => setRascunho((atual) => (atual.bala === undefined ? atual : { ...atual, bala: { ...atual.bala, modo } }))}>
                    {rotulo}
                  </button>
                ))}
              </div>
              <div className="lb-edi-grade">
                {rascunho.bala.modo !== 'atributo' ? (
                  <CampoInteiro rotulo={rascunho.bala.modo === 'soma' ? 'Quanto soma' : 'Dano novo'} valor={rascunho.bala.valor} minimo={0} maximo={NUMERO_DO_ITEM_MAX} onChange={(valor) => setRascunho((atual) => (atual.bala === undefined ? atual : { ...atual, bala: { ...atual.bala, valor } }))} />
                ) : (
                  <>
                    <CampoEscolha rotulo="Atributo" valor={rascunho.bala.atributo ?? ''} opcoes={atributos} onMudar={(atributo) => setRascunho((atual) => (atual.bala === undefined ? atual : { ...atual, bala: { ...atual.bala, atributo } }))} />
                    <CampoInteiro rotulo="Dividido por" valor={rascunho.bala.divisor ?? 1} minimo={1} maximo={10} onChange={(divisor) => setRascunho((atual) => (atual.bala === undefined ? atual : { ...atual, bala: { ...atual.bala, divisor } }))} />
                  </>
                )}
              </div>
              <Marcar
                rotulo="Perfurante: o tiro vai direto no HP, sem gastar o Escudo"
                marcado={rascunho.bala.perfurante === true}
                onChange={(marcado) =>
                  setRascunho((atual) => {
                    if (atual.bala === undefined) return atual
                    const { perfurante: _antes, ...semPerfurar } = atual.bala
                    return { ...atual, bala: marcado ? { ...semPerfurar, perfurante: true } : semPerfurar }
                  })
                }
              />
              <p className="lb-field__hint">Para uma arma aceitar esta bala, marque-a na arma, em Munição e recarga.</p>
            </Secao>
          )}

          {tipo === 'consumivel' && rascunho.uso !== undefined && (
            <Secao titulo="Como usa" sub="Ação e alcance ficam só aqui. O que ele faz vai em Ao usar, logo abaixo. Sem efeito, usar não gasta e o mestre narra.">
              <div className="lb-edi-grade">
                <CampoEscolha rotulo="Ação na batalha" valor={rascunho.uso.acao} opcoes={comoOpcoes(ACOES_DO_ITEM)} onMudar={(acao) => setRascunho((atual) => (atual.uso === undefined ? atual : { ...atual, uso: { ...atual.uso, acao } }))} />
                <div className="lb-field">
                  <span className="lb-label">Onde dá para usar</span>
                  <Marcar rotulo="Na batalha" marcado={rascunho.uso.onde.batalha} onChange={(batalha) => setRascunho((atual) => (atual.uso === undefined ? atual : { ...atual, uso: { ...atual.uso, onde: { ...atual.uso.onde, batalha } } }))} />
                  <Marcar rotulo="Fora da batalha" marcado={rascunho.uso.onde.fora} onChange={(fora) => setRascunho((atual) => (atual.uso === undefined ? atual : { ...atual, uso: { ...atual.uso, onde: { ...atual.uso.onde, fora } } }))} />
                </div>
              </div>
              <CampoDoAlcance
                valor={alcanceLido(rascunho.uso.alcance)}
                cor="verde"
                onChange={(nova) =>
                  setRascunho((atual) => {
                    if (atual.uso === undefined) return atual
                    const { alcance: _antes, ...sem } = atual.uso
                    return { ...atual, uso: nova === null ? sem : { ...sem, alcance: alcanceGuardado(nova) } }
                  })
                }
              />
            </Secao>
          )}

          {tipo === 'equipamento' && rascunho.equipamento !== undefined && (
            <Secao titulo="Como veste" sub="Sem regra inventada: a roupa dá só o que você escrever aqui, nos campos que a ficha já tem (CA, Escudo, Vantagem, atributos).">
              <CampoEscolha
                rotulo="Onde veste"
                valor={rascunho.equipamento.parte}
                opcoes={PARTES_DO_EQUIPAMENTO.map((parte) => ({ valor: parte, rotulo: ROTULO_DA_PARTE[parte] }))}
                onMudar={(texto) => {
                  const parte = PARTES_DO_EQUIPAMENTO.find((candidata) => candidata === texto)
                  if (parte !== undefined) setRascunho((atual) => (atual.equipamento === undefined ? atual : { ...atual, equipamento: { ...atual.equipamento, parte } }))
                }}
              />
              {rascunho.equipamento.bonus.length === 0 ? (
                <p className="lb-edi-nota">Nenhum bônus ainda: vestida, não muda nada na ficha.</p>
              ) : (
                <ul className="lb-edi-pecas">
                  {rascunho.equipamento.bonus.map((bonus, indice) => (
                    <li key={indice} className="lb-edi-peca">
                      <div className="lb-edi-peca__campos">
                        <CampoEscolha
                          rotulo="Enquanto vestido, dá"
                          valor={bonus.campo === 'atributo' ? `atributo:${bonus.em ?? ''}` : bonus.campo}
                          opcoes={[...CAMPOS_FIXOS_DO_BONUS.map((campo) => ({ valor: campo, rotulo: ROTULO_DO_BONUS[campo] })), ...atributos.map((atributo) => ({ valor: `atributo:${atributo.valor}`, rotulo: atributo.rotulo }))]}
                          onMudar={(texto) => {
                            const campo = CAMPOS_FIXOS_DO_BONUS.find((candidato) => candidato === texto)
                            mudarBonus(indice, campo !== undefined ? { campo, n: bonus.n } : { campo: 'atributo', n: bonus.n, em: texto.replace(/^atributo:/, '') })
                          }}
                        />
                        {bonus.campo === 'vantagem' || bonus.campo === 'desvantagem' ? (
                          <label className="lb-field">
                            <span className="lb-label">Em</span>
                            <input className="lb-input" maxLength={30} value={bonus.em ?? ''} placeholder="Ex.: Furtividade" onChange={(event) => mudarBonus(indice, { ...bonus, em: event.target.value })} />
                          </label>
                        ) : (
                          <CampoInteiro rotulo="Quanto" valor={bonus.n} minimo={-20} maximo={99} onChange={(n) => mudarBonus(indice, { ...bonus, n })} />
                        )}
                      </div>
                      <button
                        type="button"
                        className="lb-iconbtn lb-iconbtn--sm"
                        aria-label="Tirar este bônus"
                        onClick={() => setRascunho((atual) => (atual.equipamento === undefined ? atual : { ...atual, equipamento: { ...atual.equipamento, bonus: atual.equipamento.bonus.filter((_, i) => i !== indice) } }))}
                      >
                        <CloseIcon size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="lb-edi-mais">
                <button
                  type="button"
                  className="lb-btn lb-btn--compact"
                  disabled={rascunho.equipamento.bonus.length >= PECAS_POR_BLOCO_MAX}
                  onClick={() => setRascunho((atual) => (atual.equipamento === undefined ? atual : { ...atual, equipamento: { ...atual.equipamento, bonus: [...atual.equipamento.bonus, { campo: 'ca', n: 1 }] } }))}
                >
                  + Bônus
                </button>
              </div>
            </Secao>
          )}

          {blocoDasPecas !== null && (
            <PecasDoBloco
              onde={blocoDasPecas}
              guardadas={blocoDasPecas === 'uso' ? rascunho.aoUsar : rascunho.aoAcertar}
              item={rascunho}
              condicoes={condicoes}
              sistema={sistema}
              onMudar={(pecas) => setRascunho((atual) => comPecas(atual, blocoDasPecas, pecas))}
            />
          )}

          {tipo !== undefined && (
            <Secao titulo="Opções">
              <LuzDoItemCampos idBase={idBase} luz={rascunho.luz} onMudar={(luz) => setRascunho((atual) => comLuz(atual, luz))} />
              <Marcar
                rotulo="Empilha na mochila: vários ocupam uma vaga só, com o número"
                marcado={rascunho.empilhavel}
                bloqueio={empilhaSozinho ? 'Liga sozinho neste tipo.' : null}
                onChange={(empilhavel) => setRascunho((atual) => ({ ...atual, empilhavel }))}
              />
            </Secao>
          )}

          <Secao titulo="Descrição" sub={tipo === 'outros' ? 'Para Outros, é o que vale. Escreva como o item é.' : 'Opcional. Só para ambientar: as regras já estão nos campos.'}>
            <label className="lb-field" htmlFor={`${idBase}-descricao`}>
              <span className="lb-label lb-edi-sr">Descrição</span>
              <textarea id={`${idBase}-descricao`} className="lb-input lb-textarea" value={rascunho.descricao} maxLength={ITEM_DESCRICAO_MAX} placeholder="Ex.: Pau com pano embebido em óleo." onChange={(event) => setRascunho({ ...rascunho, descricao: event.target.value })} />
            </label>
          </Secao>

          {tipo !== undefined && (
            <section className="lb-edi-frase" aria-label="O que acontece">
              <p className="lb-label">O que acontece</p>
              <p aria-live="polite">{frases.join(' ')}</p>
              <button
                type="button"
                className="lb-btn lb-btn--compact"
                disabled={blocoDasPecas !== 'acerto'}
                aria-describedby={`${idBase}-testar`}
                onClick={() => setTeste({ de: rascunho, linhas: testeNoBoneco(novoPersonagem(sistema, 'npc', 'Boneco de treino'), rascunho.nome, rascunho, criadas).linhas })}
              >
                Testar no boneco de treino
              </button>
              <span id={`${idBase}-testar`} className="lb-field__hint">
                {blocoDasPecas === 'acerto' ? 'O boneco tem 100 de vida e não reage: o acerto passa pelas mesmas regras da batalha.' : 'O teste no boneco é para o que acerta: armas, arremesso e munição.'}
              </span>
              {teste !== null && teste.de === rascunho && (
                <ul className="lb-edi-teste" role="status" aria-label="Resultado do teste">
                  {teste.linhas.map((linha) => (
                    <li key={linha}>{linha}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {erro !== null && (
            <p className="lb-field__error" role="alert">
              {erro}
            </p>
          )}
          <div className="lb-item-janela__salvar">
            {!novo &&
              (confirmarApagar ? (
                <span className="lb-item-janela__confirma" role="group" aria-label="Confirmar apagar">
                  <span>Apagar do acervo? Quem já tem o item continua com ele.</span>
                  <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => setConfirmarApagar(false)}>
                    Manter
                  </button>
                  <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" disabled={ocupado} onClick={() => void apagar()}>
                    Apagar
                  </button>
                </span>
              ) : (
                <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => setConfirmarApagar(true)}>
                  Apagar…
                </button>
              ))}
            <button type="button" className="lb-btn lb-btn--primary" disabled={ocupado || !mudou} onClick={() => void salvar()}>
              {novo ? 'Criar item' : 'Salvar'}
            </button>
          </div>
          {!novo && mochilaNaFicha && <DarAFichas item={acervo.find((salvo) => salvo.id === item.id) ?? item} bloqueado={mudou ? 'Salve antes de dar: a ficha recebe o item como ele está no acervo.' : null} />}
          {!novo && onDar !== undefined && semFicha.length > 0 && (
            <section className="lb-item-janela__dar" aria-labelledby={`${idBase}-dar`}>
              <h3 id={`${idBase}-dar`} className="lb-item-janela__subtitulo">
                {mochilaNaFicha ? 'Dar a um token sem ficha' : 'Dar a…'}
              </h3>
              <div className="lb-item-janela__linha">
                <select
                  className="lb-input"
                  aria-label="Personagem que recebe o item"
                  value={alvoEscolhido}
                  onChange={(event) => {
                    setAlvoEscolhido(event.target.value)
                    setResultadoDoDar(null)
                  }}
                >
                  {semFicha.map((alvo) => (
                    <option key={chaveDoAlvo(alvo)} value={chaveDoAlvo(alvo)}>
                      {alvo.nome} · {alvo.cena}
                    </option>
                  ))}
                </select>
                {item.empilhavel && (
                  <input
                    className="lb-input lb-item-janela__qtd"
                    type="number"
                    min={1}
                    max={ITEM_QUANTIDADE_MAX}
                    aria-label="Quantidade"
                    value={quantidade}
                    onChange={(event) => setQuantidade(Math.min(Math.max(Math.trunc(Number(event.target.value)) || 1, 1), ITEM_QUANTIDADE_MAX))}
                  />
                )}
                <button type="button" className="lb-btn" disabled={mudou} title={mudou ? 'Salve antes de dar.' : undefined} onClick={dar}>
                  Dar
                </button>
              </div>
              {mudou && <p className="lb-item-janela__dica">Salve antes de dar: o token recebe o item como ele está no acervo.</p>}
              <p className="lb-item-janela__resultado" aria-live="polite">
                {resultadoDoDar}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
