import { ehCategoriaDeMunicao, type ItemDoCatalogo as ItemDoAcervo } from '../../acervoDeItens'
import { CAMPO_DA_CATEGORIA, CAMPO_DA_CAPACIDADE, CAMPO_DA_QUANTIDADE, lerCategoria } from '../../batalha/leituraDaFicha'
import { chaveDoNomeDaEntrada, type ItemDoCatalogo as EntradaDoCatalogo } from '../../livros/catalogo'
import { nomesDeMunicaoIguais } from '../../mochila/municao'
import { novoCartao, type CartaoDaFicha } from '../../personagem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import { itemComOsCamposAntigos } from '../editorDoItem'
import { pecasGuardadas } from '../leitura'
import { ROTULO_DO_TIPO, TIPOS_DE_ARMA, TIPOS_QUE_EMPILHAM, type BlocosDoItem, type ConfiraDoItem, type TipoDoItem } from '../modelo'
import { ORIGEM_DO_PALPITE_DO_TIPO } from './acervo'
import { comConfira, idDoItemConvertido, primeiroNumero, tipoPelaCategoria } from './comum'
import { blocosDaArma, descricaoDoCartao, tipoDaArma } from './ficha'

/**
 * CONVERSÃO DO CATÁLOGO (PLANO §2.2, linhas "entrada `arma` ou `item` do catálogo"): UMA COISA, UM
 * LUGAR. Cada arma e item do livro passa a ter a sua coisa no Acervo, e só o editor do item a edita:
 *
 * - já ligada (`acervoId`) e a coisa existe: nada muda;
 * - ligada, mas a coisa saiu do Acervo: a coisa volta com o MESMO id (os cartões ligados a acham);
 * - solta, e o Acervo tem UMA coisa de mesmo nome e do mesmo jeito (arma com arma, item com item)
 *   e os números batem: liga, e a coisa ganha o que só o livro dizia (alcance, ação, soma, pente);
 * - solta, e nada no Acervo tem esse nome: item novo, id `item_conv_<hash(catalogo:<id>)>`;
 * - solta, e o nome existe mas há duas candidatas, ou os números divergem, ou o jeito é outro: não
 *   liga sozinha; a coisa do Acervo ganha um "Confira" com os dois lados. Se o mestre abre essa
 *   entrada para editar (`abrir`), ela ganha uma coisa própria, "Nome (do livro)", e nada se perde.
 *
 * Nada sai do catálogo: a regra continua lá e a batalha a lê pelo `acervoId`, como antes. Puro e
 * idempotente pelo estado (o id do item novo é determinístico; a ligada não se mexe de novo).
 */

/** O que a ligação fez. */
export interface LigacaoDoCatalogo {
  /** O `acervoId` que cada entrada ganhou, pelo id da entrada. */
  ligacoes: ReadonlyMap<string, string>
  /** As coisas do Acervo novas ou completadas, na ordem (vão para `juntarItens`). */
  itens: ItemDoAcervo[]
  /** Os nomes das entradas que ligaram a uma coisa que já estava no Acervo. */
  ligadas: string[]
  /** Os nomes das entradas que viraram item novo no Acervo. */
  criadas: string[]
  /** Os nomes das entradas que ficaram soltas, com "Confira" na coisa de mesmo nome. */
  confira: string[]
}

export interface OpcoesDaLigacao {
  /** O id da entrada que o mestre abriu para editar: nunca fica solta. */
  abrir?: string
}

const NOME_MAX = 60
const SUFIXO_DO_LIVRO = ' (do livro)'

function campo(entrada: EntradaDoCatalogo, id: string): string {
  return (entrada.campos[id] ?? '').trim()
}

function origemDa(entrada: EntradaDoCatalogo): string {
  return `livro: ${entrada.nome}`.slice(0, 120)
}

function nomeDoAtributoNo(sistema: SistemaDeRpg): (id: string) => string {
  const porId = new Map(sistema.atributos.map((atributo) => [atributo.id, atributo.nome]))
  return (id) => porId.get(id) ?? id
}

/** O tipo que a entrada diz: a arma pela categoria (sem ela, pelas balas: palpite); o item pela 1ª palavra do nome (palpite) ou Outros. */
function tipoDaEntrada(entrada: EntradaDoCatalogo): { tipo: TipoDoItem; palpite: boolean } {
  if (entrada.tipo === 'arma') return tipoDaArma(lerCategoria(campo(entrada, CAMPO_DA_CATEGORIA)), (entrada.balas?.length ?? 0) > 0)
  const pelaPrimeira = tipoPelaCategoria(entrada.nome.trim().split(/\s+/)[0] ?? '')
  return pelaPrimeira === null || pelaPrimeira === 'arma' ? { tipo: 'outros', palpite: false } : { tipo: pelaPrimeira, palpite: true }
}

/** A entrada como um cartão da ficha, para usar a MESMA conversão dos cartões (dano, ação, soma, pente, Descrição). */
function cartaoDaEntrada(entrada: EntradaDoCatalogo): CartaoDaFicha {
  return {
    ...novoCartao(entrada.nome),
    campos: { ...entrada.campos, descricao: entrada.texto },
    ...(entrada.alcance === undefined ? {} : { alcance: entrada.alcance }),
    ...(entrada.mecanica === undefined ? {} : { mecanica: entrada.mecanica }),
  }
}

/** Os tipos de bala da arma do livro -> as munições do Acervo de mesmo nome; a que não existe vira "Confira" (fica no livro). */
function municoesDasBalas(entrada: EntradaDoCatalogo, acervo: readonly ItemDoAcervo[]): { ids: string[]; confira: ConfiraDoItem[] } {
  const ids: string[] = []
  const confira: ConfiraDoItem[] = []
  for (const bala of entrada.balas ?? []) {
    const achada = acervo.find((item) => (item.tipo === 'municao' || ehCategoriaDeMunicao(item.categoria)) && nomesDeMunicaoIguais(item.nome, bala.nome))
    const doLivro = Object.entries(bala.campos).map(([chave, valor]) => `${chave} ${valor}`).join(', ')
    if (achada === undefined) confira.push({ texto: `O tipo de bala "${bala.nome}" do livro não tem munição no Acervo: crie e marque no pente`, ...(doLivro === '' ? {} : { antes: doLivro }), origem: origemDa(entrada) })
    else if (!ids.includes(achada.id)) ids.push(achada.id)
  }
  return { ids, confira }
}

function ehCoisaDeArma(coisa: ItemDoAcervo): boolean {
  return coisa.tipo !== undefined ? TIPOS_DE_ARMA.has(coisa.tipo) : tipoPelaCategoria(coisa.categoria) === 'arma'
}

function temPalpiteDoTipo(coisa: ItemDoAcervo): boolean {
  return coisa.confira?.some((aviso) => aviso.origem === ORIGEM_DO_PALPITE_DO_TIPO) === true
}

/** A coisa é a mesma da entrada? Mesmo nome (sem acento nem caixa) e do mesmo jeito: arma com arma, item com item. */
function mesmoJeito(coisa: ItemDoAcervo, entrada: EntradaDoCatalogo): boolean {
  return ehCoisaDeArma(coisa) === (entrada.tipo === 'arma')
}

/** Os números em que o livro e a coisa discordam (o tipo, o dano, a capacidade do pente). Vazio = batem. */
function divergencias(coisa: ItemDoAcervo, entrada: EntradaDoCatalogo): { livro: string[]; acervo: string[] } {
  const livro: string[] = []
  const acervo: string[] = []
  if (entrada.tipo !== 'arma') return { livro, acervo }
  const doLivro = tipoDaEntrada(entrada)
  if (!doLivro.palpite && coisa.tipo !== undefined && coisa.tipo !== doLivro.tipo && !temPalpiteDoTipo(coisa)) {
    livro.push(ROTULO_DO_TIPO[doLivro.tipo])
    acervo.push(ROTULO_DO_TIPO[coisa.tipo])
  }
  const dano = campo(entrada, 'dano')
  if (/^\d{1,7}$/.test(dano) && coisa.ataque !== undefined && coisa.ataque.dano !== Number.parseInt(dano, 10)) {
    livro.push(`dano ${dano}`)
    acervo.push(`dano ${coisa.ataque.dano}`)
  }
  const capacidade = primeiroNumero(campo(entrada, CAMPO_DA_CAPACIDADE))
  if (capacidade !== null && coisa.pente !== undefined && coisa.pente.capacidade !== capacidade) {
    livro.push(`pente ${capacidade}`)
    acervo.push(`pente ${coisa.pente.capacidade}`)
  }
  return { livro, acervo }
}

/** A coisa nova feita da entrada do livro, pela mesma conversão dos cartões da ficha. */
function itemNovoDaEntrada(entrada: EntradaDoCatalogo, acervo: readonly ItemDoAcervo[], sistema: SistemaDeRpg, id: string, nome: string, extras: readonly ConfiraDoItem[]): ItemDoAcervo {
  const origem = origemDa(entrada)
  const cartao = cartaoDaEntrada(entrada)
  const { tipo, palpite } = tipoDaEntrada(entrada)
  const ehArma = entrada.tipo === 'arma'
  const { descricao, sobrou } = descricaoDoCartao(cartao)
  const balas = ehArma ? municoesDasBalas(entrada, acervo) : { ids: [], confira: [] }
  const { blocos, confira } = ehArma ? blocosDaArma(cartao, tipo, balas.ids, origem) : { blocos: {}, confira: [] }
  const quantidade = ehArma ? 1 : (primeiroNumero(campo(entrada, CAMPO_DA_QUANTIDADE)) ?? 1)
  const requisitos = entrada.requisitos === undefined ? undefined : pecasGuardadas(entrada.requisitos)
  const avisos: ConfiraDoItem[] = [
    { texto: `Item novo, feito da ${ehArma ? 'arma' : 'entrada'} do livro`, origem },
    ...(palpite ? [{ texto: ehArma ? 'Sem a categoria da arma: o tipo é um palpite' : 'O tipo saiu do nome: confira', origem: ORIGEM_DO_PALPITE_DO_TIPO }] : []),
    ...(sobrou ? [{ texto: 'O texto do livro que não virou campo foi para a Descrição', origem }] : []),
    ...balas.confira,
    ...confira,
    ...extras,
  ]
  const avisosDoItem = comConfira(undefined, avisos)
  const item: ItemDoAcervo = {
    id,
    nome,
    imagem: null,
    descricao,
    categoria: ehArma ? 'Arma' : '',
    preco: null,
    empilhavel: TIPOS_QUE_EMPILHAM.has(tipo) || quantidade > 1,
    ...blocos,
    tipo,
    ...(requisitos === undefined ? {} : { requisitos }),
    ...(avisosDoItem === undefined ? {} : { confira: avisosDoItem }),
  }
  return itemComOsCamposAntigos(item, nomeDoAtributoNo(sistema))
}

/** Os avisos que ainda não estão na coisa (mesmo texto e mesma origem = já está). */
function avisosNovos(coisa: ItemDoAcervo, avisos: readonly ConfiraDoItem[]): ConfiraDoItem[] {
  return avisos.filter((aviso) => !(coisa.confira ?? []).some((atual) => atual.texto === aviso.texto && atual.origem === aviso.origem))
}

/**
 * A coisa que a entrada ligada completa: o tipo que era palpite passa a ser o do livro; o ataque, o
 * golpe, o pente e o arremesso que faltam vêm do livro; dentro do ataque, o alcance, a ação e a
 * soma que faltam. A mecânica montada ("O que ela faz") não vira "Ao acertar" (o dano dobraria):
 * fica no livro, que a batalha lê, e a coisa ganha um "Confira". Nada a completar: a MESMA coisa.
 */
function completadaPeloLivro(coisa: ItemDoAcervo, entrada: EntradaDoCatalogo, acervo: readonly ItemDoAcervo[], sistema: SistemaDeRpg): ItemDoAcervo {
  if (entrada.tipo !== 'arma') return coisa
  const origem = origemDa(entrada)
  const doLivro = tipoDaEntrada(entrada)
  const tipo = coisa.tipo === undefined || (temPalpiteDoTipo(coisa) && !doLivro.palpite) ? doLivro.tipo : coisa.tipo
  if (!TIPOS_DE_ARMA.has(tipo)) return coisa
  const balas = municoesDasBalas(entrada, acervo)
  const { blocos } = blocosDaArma(cartaoDaEntrada(entrada), tipo, balas.ids, origem)
  const faltam: BlocosDoItem = {}
  const ataqueDoLivro = blocos.ataque
  if (coisa.ataque === undefined) {
    // Sem dano escrito no livro (a Granada: o dano mora na mecânica), não nasce um ataque de 0.
    if (ataqueDoLivro !== undefined && campo(entrada, 'dano') !== '') faltam.ataque = ataqueDoLivro
  } else if (ataqueDoLivro !== undefined) {
    const atual = coisa.ataque
    const alcance = atual.alcance ?? ataqueDoLivro.alcance
    const acao = atual.acao.trim() === '' ? ataqueDoLivro.acao : atual.acao
    const soma = atual.soma === '' ? ataqueDoLivro.soma : atual.soma
    if (alcance !== atual.alcance || acao !== atual.acao || soma !== atual.soma) faltam.ataque = { ...atual, acao, soma, ...(alcance === undefined ? {} : { alcance }) }
  }
  if (coisa.golpe === undefined && blocos.golpe !== undefined) faltam.golpe = blocos.golpe
  if (coisa.pente === undefined && blocos.pente !== undefined) faltam.pente = blocos.pente
  // As balas do livro que o pente da coisa ainda não aceita passam a ser aceitas.
  const pente = coisa.pente
  const aceitaMais = pente === undefined ? [] : balas.ids.filter((id) => !pente.aceita.includes(id))
  if (pente !== undefined && aceitaMais.length > 0) faltam.pente = { ...pente, aceita: [...pente.aceita, ...aceitaMais] }
  const semPente = (entrada.balas?.length ?? 0) > 0 && coisa.pente === undefined && faltam.pente === undefined
  if (coisa.arremesso === undefined && blocos.arremesso !== undefined) faltam.arremesso = blocos.arremesso
  const avisos = avisosNovos(coisa, [
    ...(Object.keys(faltam).length > 0 ? [{ texto: 'O que só o livro dizia (alcance, ação, pente) veio para cá: confira', origem }] : []),
    ...(entrada.mecanica !== undefined && coisa.aoAcertar === undefined ? [{ texto: 'O livro tem "O que ela faz" montado: a batalha segue o livro; confira o Ao acertar (o dano não pode dobrar)', origem }] : []),
    ...balas.confira,
    ...(semPente ? [{ texto: `O livro diz as balas dela (${(entrada.balas ?? []).map((bala) => bala.nome).join(', ')}), mas não quantas cabem: diga a capacidade do pente`, origem }] : []),
  ])
  if (tipo === coisa.tipo && Object.keys(faltam).length === 0 && avisos.length === 0) return coisa
  const semPalpite = tipo === coisa.tipo ? coisa.confira : coisa.confira?.filter((aviso) => aviso.origem !== ORIGEM_DO_PALPITE_DO_TIPO)
  const confira = comConfira(semPalpite, avisos)
  const { confira: _antes, ...semConfira } = coisa
  return itemComOsCamposAntigos({ ...semConfira, ...faltam, tipo, ...(confira === undefined ? {} : { confira }) }, nomeDoAtributoNo(sistema))
}

/** Liga cada arma e item do livro à sua coisa do Acervo (ver o topo). Nada a fazer: `itens` vazio e `ligacoes` vazio. */
export function ligarCatalogoAoAcervo(catalogo: readonly EntradaDoCatalogo[], acervo: readonly ItemDoAcervo[], sistema: SistemaDeRpg, opcoes: OpcoesDaLigacao = {}): LigacaoDoCatalogo {
  const mexidas = new Map<string, ItemDoAcervo>()
  const todas = (): ItemDoAcervo[] => [...acervo.map((coisa) => mexidas.get(coisa.id) ?? coisa), ...[...mexidas.values()].filter((coisa) => !acervo.some((antes) => antes.id === coisa.id))]
  const pelaId = (id: string): ItemDoAcervo | undefined => mexidas.get(id) ?? acervo.find((coisa) => coisa.id === id)
  const guardar = (coisa: ItemDoAcervo) => {
    if (coisa !== pelaId(coisa.id)) mexidas.set(coisa.id, coisa)
  }
  const usadas = new Set(catalogo.flatMap((entrada) => (entrada.acervoId === undefined ? [] : [entrada.acervoId])))
  const ligacoes = new Map<string, string>()
  const resultado: Omit<LigacaoDoCatalogo, 'ligacoes' | 'itens'> = { ligadas: [], criadas: [], confira: [] }
  const ligar = (entrada: EntradaDoCatalogo, id: string) => {
    usadas.add(id)
    ligacoes.set(entrada.id, id)
  }

  for (const entrada of catalogo) {
    if (entrada.tipo !== 'arma' && entrada.tipo !== 'item') continue
    if (entrada.acervoId !== undefined) {
      if (pelaId(entrada.acervoId) !== undefined) continue
      guardar(itemNovoDaEntrada(entrada, todas(), sistema, entrada.acervoId, entrada.nome.slice(0, NOME_MAX), []))
      resultado.criadas.push(entrada.nome)
      continue
    }
    // Feita antes (a ligação se perdeu na gravação do livro): a mesma coisa, sem outra.
    const idProprio = idDoItemConvertido(`catalogo:${entrada.id}`)
    if (pelaId(idProprio) !== undefined) {
      ligar(entrada, idProprio)
      resultado.ligadas.push(entrada.nome)
      continue
    }
    const chave = chaveDoNomeDaEntrada(entrada.nome)
    const mesmoNome = todas().filter((coisa) => chaveDoNomeDaEntrada(coisa.nome) === chave)
    const candidatas = mesmoNome.filter((coisa) => !usadas.has(coisa.id) && mesmoJeito(coisa, entrada))
    const unica = candidatas.length === 1 ? candidatas[0] : undefined
    const diverge = unica === undefined ? undefined : divergencias(unica, entrada)
    if (unica !== undefined && diverge !== undefined && diverge.livro.length === 0) {
      guardar(completadaPeloLivro(unica, entrada, todas(), sistema))
      ligar(entrada, unica.id)
      resultado.ligadas.push(entrada.nome)
      continue
    }
    if (mesmoNome.length === 0) {
      guardar(itemNovoDaEntrada(entrada, todas(), sistema, idProprio, entrada.nome.slice(0, NOME_MAX), []))
      ligar(entrada, idProprio)
      resultado.criadas.push(entrada.nome)
      continue
    }
    const origem = origemDa(entrada)
    const motivo: ConfiraDoItem =
      diverge !== undefined
        ? { texto: `O livro tem "${entrada.nome}" com outros números: não liguei sozinho. Abra a do livro para escolher`, antes: `livro: ${diverge.livro.join(', ')}`, depois: `Acervo: ${diverge.acervo.join(', ')}`, origem }
        : candidatas.length > 1
          ? { texto: `O livro tem "${entrada.nome}" e o Acervo tem ${candidatas.length} com este nome: não liguei sozinho`, origem }
          : { texto: `O livro tem "${entrada.nome}" como ${entrada.tipo === 'arma' ? 'arma' : 'item'}, e aqui é outra coisa (ou já é de outra entrada): não liguei sozinho`, origem }
    if (opcoes.abrir === entrada.id) {
      // O mestre abriu esta para editar: ela ganha a coisa dela, com tudo o que o livro diz, e o aviso do porquê.
      guardar(itemNovoDaEntrada(entrada, todas(), sistema, idProprio, `${entrada.nome.slice(0, NOME_MAX - SUFIXO_DO_LIVRO.length)}${SUFIXO_DO_LIVRO}`, [{ ...motivo, texto: `O Acervo já tinha "${entrada.nome}": esta é a do livro, à parte` }]))
      ligar(entrada, idProprio)
      resultado.criadas.push(entrada.nome)
      continue
    }
    for (const coisa of candidatas.length > 0 ? candidatas : mesmoNome) {
      const avisos = avisosNovos(coisa, [motivo])
      const confira = comConfira(coisa.confira, avisos)
      if (avisos.length > 0 && confira !== undefined) guardar({ ...coisa, confira })
    }
    resultado.confira.push(entrada.nome)
  }
  return { ...resultado, ligacoes, itens: [...mexidas.values()] }
}
