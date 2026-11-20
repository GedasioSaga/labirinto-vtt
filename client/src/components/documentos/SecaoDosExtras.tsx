import { useId } from 'react'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoCor } from '../grimorio/CampoCor'
import { CampoLiga } from '../grimorio/CampoLiga'
import { CampoSeg, type OpcaoDoSeg } from '../grimorio/CampoSeg'
import { CampoTexto } from '../grimorio/CampoTexto'
import { Nota } from '../grimorio/Nota'
import { useImagemDaMesa } from '../ImagemDaMesa'
import { ARTES, CORES_DA_CERA, CORES_DO_CARIMBO, CORES_DO_PAPEL, NOMES_DAS_LETRAS, NOMES_DAS_MANCHAS, TINTAS, type CorComNome } from '../../documentos/desenhoDoPapel'
import { DesenhoDaArte } from '../../documentos/Papel'
import {
  ARTES_DO_DOCUMENTO,
  ASSINATURA_MAX,
  LETRAS_DO_DOCUMENTO,
  MANCHAS_DO_PAPEL,
  TEXTO_DO_CARIMBO_MAX,
  TINTAS_DO_DOCUMENTO,
  type ArteDoDocumento,
  type BrasaoDoDocumento,
  type DesgasteDoPapel,
  type ExtrasDoDocumento,
  type LetraDoDocumento,
  type SeloDoDocumento,
} from '../../documentos/tipos'
import { escolherImagemDoDocumento } from './imagemDoDocumento'

/**
 * OS EXTRAS NA FICHA DO DOCUMENTO (fase D5; protótipo dos extras aprovado,
 * `htmlFicha`): "Letra e tinta", "Desgaste do papel" e "Selo, assinatura e
 * brasão". Tudo muda na hora e a prévia acompanha ("deixe bem editável").
 */

export interface PropsDosExtras {
  extras: ExtrasDoDocumento
  /** A mudança recebe os extras de AGORA (o rascunho grava atrás). */
  mudar: (mudanca: (extras: ExtrasDoDocumento) => ExtrasDoDocumento) => void
  onErro: (erro: unknown) => void
}

function opcoesDeCor(lista: readonly CorComNome[]) {
  return lista.map((cor) => ({ valor: cor.valor, nome: cor.nome }))
}

/** A escolha de um desenho (selo, carimbo, brasão): rádios nativos com o desenho, como a escolha do papel. */
function EscolhaDaArte({ arte, rotulo, onChange }: { arte: ArteDoDocumento; rotulo: string; onChange: (arte: ArteDoDocumento) => void }) {
  const nome = useId()
  return (
    <div className="gr-campo">
      <span className="gr-campo__rot">
        {rotulo} <b>{ARTES[arte].nome}</b>
      </span>
      <div className="doc-artes" role="radiogroup" aria-label={rotulo}>
        {ARTES_DO_DOCUMENTO.map((opcao) => (
          <label key={opcao} className="doc-arte-op" title={ARTES[opcao].nome}>
            <input type="radio" name={nome} value={opcao} checked={arte === opcao} onChange={() => onChange(opcao)} aria-label={ARTES[opcao].nome} />
            <DesenhoDaArte arte={opcao} />
          </label>
        ))}
      </div>
    </div>
  )
}

export function SecaoLetraETinta({ extras, mudar }: PropsDosExtras) {
  const nome = useId()
  const tintas: OpcaoDoSeg<(typeof TINTAS_DO_DOCUMENTO)[number]>[] = TINTAS_DO_DOCUMENTO.map((tinta) => ({
    valor: tinta,
    rotulo: TINTAS[tinta].nome,
    icone: <span className="doc-ponto" style={{ background: TINTAS[tinta].cor }} aria-hidden="true" />,
  }))
  return (
    <section className="doc-secao" aria-label="Letra e tinta">
      <h3 className="mg-secao">Letra e tinta</h3>
      <div className="doc-papeis" role="radiogroup" aria-label="Letra">
        {LETRAS_DO_DOCUMENTO.map((letra: LetraDoDocumento) => (
          <label key={letra} className="doc-papel-op">
            <input type="radio" name={nome} value={letra} checked={extras.letra === letra} onChange={() => mudar((atual) => ({ ...atual, letra }))} />
            <span className={`doc-letra-aa doc-letra-aa--${letra}`} aria-hidden="true">
              Aa
            </span>
            <span>{NOMES_DAS_LETRAS[letra]}</span>
          </label>
        ))}
      </div>
      {/* Quatro nomes não cabem numa linha da coluna do livro: duas por linha. */}
      <div className="doc-seg-em-duas">
        <CampoSeg rotulo="Tinta" opcoes={tintas} valor={extras.tinta} onChange={(tinta) => mudar((atual) => ({ ...atual, tinta }))} />
      </div>
    </section>
  )
}

const OPCOES_DAS_MANCHAS: OpcaoDoSeg<string>[] = MANCHAS_DO_PAPEL.map((nivel) => ({ valor: String(nivel), rotulo: NOMES_DAS_MANCHAS[nivel] }))

export function SecaoDesgaste({ extras, mudar }: PropsDosExtras) {
  const { desgaste } = extras
  const mudarDesgaste = (mudanca: Partial<DesgasteDoPapel>) => mudar((atual) => ({ ...atual, desgaste: { ...atual.desgaste, ...mudanca } }))
  const corEscolhida = CORES_DO_PAPEL.find((cor) => cor.valor === desgaste.cor)
  return (
    <section className="doc-secao" aria-label="Desgaste do papel">
      <h3 className="mg-secao">Desgaste do papel</h3>
      <CampoCor
        rotulo={`Cor: ${corEscolhida === undefined ? 'a do papel' : corEscolhida.nome.toLocaleLowerCase('pt-BR')}`}
        opcoes={opcoesDeCor(CORES_DO_PAPEL)}
        valor={desgaste.cor ?? ''}
        onChange={(cor) => mudarDesgaste({ cor })}
        onPadrao={() => mudarDesgaste({ cor: null })}
      />
      <div className="doc-seg-em-duas">
        <CampoSeg
          rotulo="Manchas"
          opcoes={OPCOES_DAS_MANCHAS}
          valor={String(desgaste.manchas)}
          onChange={(valor) => {
            const manchas = MANCHAS_DO_PAPEL.find((nivel) => String(nivel) === valor)
            if (manchas !== undefined) mudarDesgaste({ manchas })
          }}
        />
      </div>
      <CampoLiga rotulo="Borda queimada" ligado={desgaste.bordaQueimada} onChange={(bordaQueimada) => mudarDesgaste({ bordaQueimada })} />
      <CampoLiga rotulo="Dobras" ligado={desgaste.dobras} onChange={(dobras) => mudarDesgaste({ dobras })} />
      <CampoLiga rotulo="Rasgos" ajuda="Um canto e um lado rasgados" ligado={desgaste.rasgos} onChange={(rasgos) => mudarDesgaste({ rasgos })} />
      <Nota>Trecho de tinta borrada que ninguém lê: selecione o texto na página e use Borrar.</Nota>
    </section>
  )
}

type TipoDoSelo = 'nada' | SeloDoDocumento['tipo']
const OPCOES_DO_SELO: OpcaoDoSeg<TipoDoSelo>[] = [
  { valor: 'nada', rotulo: 'Nada' },
  { valor: 'cera', rotulo: 'Selo' },
  { valor: 'carimbo', rotulo: 'Carimbo' },
]
type TipoDoBrasao = 'nenhum' | 'desenho' | 'imagem'
const OPCOES_DO_BRASAO: OpcaoDoSeg<TipoDoBrasao>[] = [
  { valor: 'nenhum', rotulo: 'Nenhum' },
  { valor: 'desenho', rotulo: 'Desenho' },
  { valor: 'imagem', rotulo: 'Imagem' },
]
/** Os desenhos de um selo novo (os do protótipo): a rosa na cera, a torre no carimbo e no brasão. */
const ARTE_DA_CERA: ArteDoDocumento = 'rosa'
const ARTE_DO_CARIMBO: ArteDoDocumento = 'torre'
/** As cores de um selo novo: a primeira cera e a primeira tinta de carimbo (as mesmas do leitor do disco). */
const COR_DA_CERA_NOVA = '#8e2a22'
const COR_DO_CARIMBO_NOVO = '#33508f'

/** O selo do tipo pedido, guardando o desenho do de antes (trocar de cera para carimbo não perde a escolha). */
function seloDoTipo(tipo: TipoDoSelo, antes: SeloDoDocumento | null): SeloDoDocumento | null {
  if (tipo === 'nada') return null
  if (antes?.tipo === tipo) return antes
  if (tipo === 'cera') return { tipo: 'cera', cor: COR_DA_CERA_NOVA, arte: antes?.arte ?? ARTE_DA_CERA }
  return { tipo: 'carimbo', cor: COR_DO_CARIMBO_NOVO, arte: antes?.arte ?? ARTE_DO_CARIMBO, texto: '' }
}

/** "Imagem" escolhida sem imagem ainda é `{ arte: null, imagem: null }` (como o leitor do disco aceita). */
function tipoDoBrasao(brasao: BrasaoDoDocumento | null): TipoDoBrasao {
  if (brasao === null) return 'nenhum'
  return brasao.imagem !== null || brasao.arte === null ? 'imagem' : 'desenho'
}

function brasaoDoTipo(tipo: TipoDoBrasao, antes: BrasaoDoDocumento | null): BrasaoDoDocumento | null {
  if (tipo === 'nenhum') return null
  if (tipo === 'desenho') return { arte: antes?.arte ?? ARTE_DO_CARIMBO, imagem: null }
  return { arte: null, imagem: antes?.imagem ?? null }
}

export function SecaoSeloAssinaturaBrasao({ extras, mudar, onErro }: PropsDosExtras) {
  const resolver = useImagemDaMesa()
  const { selo, brasao } = extras
  const tipoB = tipoDoBrasao(brasao)
  const imagemDoBrasao = brasao === null ? null : resolver(brasao.imagem)
  const mudarSelo = (mudanca: (selo: SeloDoDocumento) => SeloDoDocumento) => mudar((atual) => (atual.selo === null ? atual : { ...atual, selo: mudanca(atual.selo) }))
  const escolherBrasao = () => {
    escolherImagemDoDocumento()
      .then((imagem) => {
        if (imagem !== null) mudar((atual) => ({ ...atual, brasao: { arte: null, imagem } }))
      })
      .catch(onErro)
  }
  return (
    <section className="doc-secao" aria-label="Selo, assinatura e brasão">
      <h3 className="mg-secao">Selo, assinatura e brasão</h3>
      <CampoSeg rotulo="No fim da última página" opcoes={OPCOES_DO_SELO} valor={selo === null ? 'nada' : selo.tipo} onChange={(tipo) => mudar((atual) => ({ ...atual, selo: seloDoTipo(tipo, atual.selo) }))} />
      {selo !== null && (
        <>
          <CampoCor
            rotulo={selo.tipo === 'cera' ? 'Cor da cera' : 'Tinta do carimbo'}
            opcoes={opcoesDeCor(selo.tipo === 'cera' ? CORES_DA_CERA : CORES_DO_CARIMBO)}
            valor={selo.cor}
            onChange={(cor) => mudarSelo((atual) => ({ ...atual, cor }))}
          />
          <EscolhaDaArte arte={selo.arte} rotulo={selo.tipo === 'cera' ? 'Desenho do selo' : 'Desenho do carimbo'} onChange={(arte) => mudarSelo((atual) => ({ ...atual, arte }))} />
          {selo.tipo === 'carimbo' && (
            <CampoTexto
              rotulo={`Texto em volta (até ${TEXTO_DO_CARIMBO_MAX} letras)`}
              valor={selo.texto}
              maxLength={TEXTO_DO_CARIMBO_MAX}
              placeholder="Ex.: Guarda da Vila do Brejo"
              onChange={(texto) => mudarSelo((atual) => (atual.tipo === 'carimbo' ? { ...atual, texto } : atual))}
            />
          )}
        </>
      )}
      <CampoTexto
        rotulo="Assinatura (vazio: sem assinatura)"
        valor={extras.assinatura ?? ''}
        maxLength={ASSINATURA_MAX}
        placeholder="Ex.: Cap. Aurélio Mendes"
        onChange={(assinatura) => mudar((atual) => ({ ...atual, assinatura: assinatura === '' ? null : assinatura }))}
      />
      <CampoSeg rotulo="Brasão no cabeçalho" opcoes={OPCOES_DO_BRASAO} valor={tipoB} onChange={(tipo) => mudar((atual) => ({ ...atual, brasao: brasaoDoTipo(tipo, atual.brasao) }))} />
      {brasao !== null && tipoB === 'desenho' && brasao.arte !== null && (
        <EscolhaDaArte arte={brasao.arte} rotulo="Desenho do brasão" onChange={(arte) => mudar((atual) => ({ ...atual, brasao: { arte, imagem: null } }))} />
      )}
      {tipoB === 'imagem' && (
        <>
          <div className="doc-imagem-mini">
            {imagemDoBrasao !== null && <img src={imagemDoBrasao} alt="O brasão escolhido" />}
            <Acoes>
              <Botao variante="latao" tamanho="p" onClick={escolherBrasao}>
                {imagemDoBrasao === null ? 'Escolher a imagem' : 'Trocar a imagem'}
              </Botao>
            </Acoes>
          </div>
          {imagemDoBrasao === null && <Nota>Até escolher a imagem, o cabeçalho fica sem brasão.</Nota>}
        </>
      )}
    </section>
  )
}
