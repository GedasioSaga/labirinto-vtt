'use strict'
/**
 * CONSERTO DAS FICHAS, FASE F0 (docs/planos/conserto-fichas-2026-11-08.md): corrige os DADOS das
 * 11 fichas da pasta One Piece, sem mexer no código do app.
 *
 *   node scripts/conserto-fichas-f0.cjs                  SIMULAÇÃO: só lê e mostra, ficha por ficha, o que mudaria
 *   node scripts/conserto-fichas-f0.cjs --aplicar        grava (app fechado, cópia antes)
 *   ... --pasta <caminho>                                outra pasta com rpg.json (padrão: a "One Piece" do índice do app)
 *   ... --ignorar-versao-do-app                          SÓ para cópia de teste: não confere a versão do app instalado
 *
 * Pasta ligada ao Lobby (nuvem/campanhas.json): o --aplicar também deixa nuvem/<campanha>/mudadas-no-disco.json
 * com a ficha de ANTES de cada ficha mudada (F0b). O app 0.5.36+ (net/nuvem/mudadasNoDisco.ts), ao iniciar, põe a
 * diferença na fila do Lobby como mudança do mestre ANTES de acertar o rpg.json com a nuvem: a mudança fica e sobe.
 * O app 0.5.35 não lê esse arquivo e desfaria tudo; por isso o --aplicar recusa com app instalado abaixo de 0.5.36.
 *
 * De onde vem cada mudança: as respostas do grilling (docs/auditoria-fichas/respostas-do-grilling.md, que
 * valem como decisão do mestre), os relatórios por personagem da mesma pasta e o `migracao-da-mochila.json`
 * ao lado do rpg.json (os itens que o bug B1 apagou). Os nomes de campo são os que o app já usa
 * (`client/src/lib/personagem.ts`, `lib/sistemaOnePiece.ts`, `lib/batalha/leituraDaFicha.ts`).
 *
 * F0c (mesmo plano, seção F0c): os dados que a F2 achou faltando. Harvey com 1 Kit Médico na mochila; Saga com os
 * atributos do Judge padrão e o HP e o SP atuais iguais ao máximo; o texto do Arrombamento do Siegfried só com
 * Força. O que ainda não dá para gravar sai em "Fica para depois".
 *
 * F0c, A Caçada Começa do Alexei (respostas-do-grilling.md: "é FORMA, Overload do tipo transformação"): o cartão sai
 * de Habilidades e vai para Transformações com o MESMO id (a batalha acha a duração e o "todo golpe é Overload" pelo
 * id, `client/src/lib/batalha/mecanicasAMao.ts`), com Custo "200 SP", Duração e Ataques extras "1". O molde de
 * Transformações só mostra Custo, Efeito e Duração a partir do app 0.5.37: abaixo disso a ficha esconderia os 200 SP e
 * o texto, e o --aplicar com esta mudança recusa (com ou sem Lobby).
 *
 * Toda troca confere o valor de antes: se a ficha já tem outro valor (o mestre mexeu), não mexe e avisa.
 * Rodar duas vezes não muda nada na segunda.
 *
 * Com --aplicar:
 *  1. recusa se o Labirinto estiver aberto (labirinto.exe no tasklist) ou se não der para conferir;
 *  2. copia o rpg.json para rpg.json.antes-do-conserto-20261108 (nunca por cima de uma cópia que já existe:
 *     a seguinte ganha -2, -3...);
 *  3. grava num temporário ao lado e renomeia por cima do rpg.json;
 *  4. relê, confere que o JSON abre, que é o previsto e que só os caminhos previstos mudaram; se não,
 *     volta a cópia.
 */
const { spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const RAIZ_DO_REPO = path.resolve(__dirname, '..')
const RESPOSTAS_DO_GRILLING = path.join(RAIZ_DO_REPO, 'docs', 'auditoria-fichas', 'respostas-do-grilling.md')
const NOME_DA_PASTA = 'One Piece'
const ARQUIVO_DAS_FICHAS = 'rpg.json'
const RELATORIO_DA_MOCHILA = 'migracao-da-mochila.json'
const NOME_DA_COPIA = 'rpg.json.antes-do-conserto-20261108'
const ARQUIVO_TEMPORARIO = 'rpg.json.conserto-tmp'
/** O Cargo.toml chama o pacote de "labirinto" e o tauri.conf.json não troca o nome do binário: o app instalado e o `tauri dev` rodam como labirinto.exe. */
const PROCESSO_DO_APP = 'labirinto.exe'
/** Onde o instalador põe o app (por usuário). */
const EXE_INSTALADO = path.join(process.env.LOCALAPPDATA ?? '', 'Labirinto', PROCESSO_DO_APP)
/** A primeira versão que lê as mudadas no disco (net/nuvem/mudadasNoDisco.ts). */
const VERSAO_QUE_LE_AS_MUDADAS = [0, 5, 36]
/** A primeira versão com Custo, Efeito e Duração no molde de Transformações (lib/sistemaOnePiece.ts) e que lê a Duração. */
const VERSAO_DA_FORMA_COM_CUSTO = [0, 5, 37]
const ARQUIVO_DAS_MUDADAS = 'mudadas-no-disco.json'
const ORIGEM_DAS_MUDADAS = 'conserto-fichas-f0'
/** O app grava o rpg.json assim (`JSON.stringify(rpg, null, 2)`, sem quebra no fim): o arquivo sem mudança sai igual, byte a byte. */
const RECUO_DO_JSON = 2
/** Quanto de um texto longo aparece na linha "antes -> depois". */
const TEXTO_NA_LINHA_MAX = 90

// ── Os números e textos das decisões ───────────────────────────────────────

/** Bug 4 / P7 do grilling: os máximos de HP e SP de verdade. Só grava onde falta; o atual não muda. */
const MAXIMOS = {
  Saga: { hp: 700, sp: 60 },
  'Jimboy Segundo': { hp: 1000, sp: 60 },
  'May D. Ark': { hp: 700, sp: 60 },
  Aira: { hp: 900 },
  'Vagn Kane': { hp: 1000, sp: 120 },
  'Ryoko D. Violet': { hp: 700, sp: 240 },
  'Harvey Solferino': { hp: 700, sp: 60 },
  Siegfried: { hp: 900, sp: 140 },
}

/** Os campos de um item da mochila (`CarriedItem`, client/src/types/map.ts): o resto do relatório não entra na ficha. */
const CAMPOS_DO_ITEM = ['id', 'nome', 'itemId', 'imagem', 'descricao', 'categoria', 'preco', 'quantidade', 'empilhavel']

/** Vincent: "precisão" = Percepção, SOMA ao tiro (55 + 17 = 72); a cura pela metade fica como lembrete (F2). */
const BALA_DE_PRATA = {
  nome: 'Bala de Prata',
  // "+X" soma ao dano da arma (lib/batalha/formula.ts, danoDaArma); o fim da conta arredonda para baixo.
  dano: '+Percepção / 2',
  efeito:
    'Cura pela metade: lembrete. Inimigos feridos pela bala de prata terão a cura recebida reduzida pela metade (o mestre corta à mão).',
}

/** Vincent: o Boomerang vai para a aba Armas como Arremesso; o efeito com usos por combate ainda não existe (F3). */
const BOOMERANG = {
  nome: 'Boomerang',
  categoria: 'Arremesso',
  dano: '0',
  efeito: 'Não dá dano: ao acertar, atordoa o alvo. 3 usos por combate (à mão até o app ter efeito de arma com usos).',
}

/** Vagn: fica 21 anos, Ferreiro; sai o bloco de 25 anos, Gatuno. */
const BLOCO_VELHO_DO_VAGN = 'Idade: 25 \nRaça: Lunariano (Sem asas) \nOfício: Gatuno\n\n'

// ── F0c: os dados que a F2 achou faltando ──────────────────────────────────

/** Harvey: "Kit Médico: ele tem 1 AGORA" e "GASTA POR USO". A Medicina conta os kits pelo nome (`mecanicasAMao.ts` `gastaItem`). */
const KIT_MEDICO = {
  nome: 'Kit Médico',
  categoria: 'Consumível',
  descricao: 'Cada Medicina gasta 1. Na luta o app conta os usos; o mestre tira o kit da mochila depois.',
}

/**
 * Saga: "atributos = os do Judge padrão" (respostas de 08/11). O Judge padrão é o boneco da Arena
 * (lib/treino/juiz.ts `fichaDoJuiz` sem base -> lib/arena/boneco.ts `fichaDoBoneco` -> lib/personagem.ts
 * `novoPersonagem`): no One Piece todo atributo nasce 0 e `ajustesPadraoDoJuiz().atributos` é vazio.
 * Este .cjs não importa o TypeScript do app: se o boneco mudar, mude aqui também.
 */
const ATRIBUTOS_DO_JUDGE_PADRAO = { forca: 0, agilidade: 0, percepcao: 0, resistencia: 0, intuicao: 0, espirito: 0, carisma: 0, determinacao: 0 }

/** Saga: o HP e o SP atuais vão ao máximo que o F0 gravou (700/60), só onde o atual é 0. */
const RECURSOS_CHEIOS_DA_SAGA = ['hp', 'sp']

/** Siegfried: "Arrombamento usa FORÇA". O F0 já trocou o atributo; o texto do cartão ainda falava dos dois. */
const ARROMBAMENTO_DE = '(Força e/ou Percepção)'
const ARROMBAMENTO_PARA = '(Força)'

/**
 * Alexei: A Caçada Começa vira forma. A Ação "OVERLOAD | TRANSFORMAÇÃO" fica (a forma lê Completa e Overload dela:
 * `acaoDaForma`, `ehOverload`); a Descrição é o texto do mestre; o Efeito da ficha fica.
 */
const CACADA = {
  /** A chave da Caçada na tabela da batalha (mecanicasAMao.ts): outro id, a batalha não a acha. */
  id: 'cart_64453d92-4278-4aeb-afed-483ab4ed972c',
  nome: 'A Caçada Começa',
  custoDe: '200 Sp',
  /** "custo 200 SP com máximo 120 fica bloqueada mostrando o motivo, regra do Jimboy". */
  custo: '200 SP',
  /** "5 turnos" = 5 VEZES DO ALEXEI DEPOIS da vez em que ativou. O app lê o 1º número (`duracaoDaForma`). */
  duracao: '5 turnos (5 vezes dele depois da vez em que ativou)',
  /** "o Alexei pode atacar 2 vezes": 1 ataque a mais por rodada ao usar Atacar (`ataquesExtrasDaForma`). */
  ataquesExtras: '1',
}

/** O que este script não faz, com o motivo: precisa de campo ou regra que o app ainda não tem. */
const FICA_PARA_DEPOIS = [
  'F0c Alexei: "A Caçada Começa" vai para Transformações, mas na batalha fica bloqueada ("Precisa de 200 SP (o máximo é 120)") até o mestre mudar o custo ou o SP máximo. Forma com Custo que cabe no máximo liga sem cobrar o SP (só o custo "por turno" é cobrado, no lembrete de cada vez).',
  'F0c Siegfried: arma padrão (a ficha não tem o campo; vale a 1ª arma levada).',
  'F0c Saga: o Judge padrão tem os 8 atributos em 0, e a Saga já está assim. A "build média, faixa dos jogadores" do 1º grilling pede os números ao mestre.',
  'F3.4 Vincent: Boomerang sem dano, atordoa, 3 usos por combate. Até lá o Atacar com ele sugere Força + 0 = 10: o mestre zera e põe Atordoado à mão.',
  'F2 Vincent: selo "Ferido por prata" (a cura pela metade); a bala já soma +Percepção/2 no tiro.',
  'Harvey: o número da Infâmia não existe em lugar nenhum da ficha; o mestre diz o número (campo próprio = F3).',
  'Harvey: o Kit Médico não sai da mochila durante a luta (o app conta os usos contra os kits que ele tem); o mestre tira à mão depois.',
  'Harvey: Golpe Baixo (dano 0, só cega) e Medicina (cura) não ganham + Dano da Arma: não são golpes de dano.',
  'F3.5 Aira (Lovecats) e Alexei (lobos, Planta Carnívora): companions. A frase de abertura do Alexei ("assim como a Aira ele também tem Companion...") não é de nenhuma técnica e não foi gravada.',
  'F1/F2 Aira: a Bênção pergunta os turnos ao usar; Electro quando quiser; Concentração da dança.',
  'Não pedido na F0, só nos relatórios (não gravei): Ryoko B3 (Ação e extra OVERLOAD nas Partes 2 e 3), B4 (Dano "-" nas 3 Fúrias) e os 6 modificadores 0 da Parte 3.',
]

// ── Leitura dos argumentos e dos arquivos ──────────────────────────────────

function lerArgumentos(argv) {
  const opcoes = { aplicar: false, pasta: null, ignorarVersaoDoApp: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--aplicar') opcoes.aplicar = true
    else if (arg === '--ignorar-versao-do-app') opcoes.ignorarVersaoDoApp = true
    else if (arg === '--pasta') {
      const valor = argv[i + 1]
      if (valor === undefined) throw new Error('--pasta pede o caminho da pasta que tem o rpg.json')
      opcoes.pasta = path.resolve(valor)
      i += 1
    } else throw new Error(`opção desconhecida: ${arg}`)
  }
  return opcoes
}

function lerJson(arquivo) {
  return JSON.parse(fs.readFileSync(arquivo, 'utf8'))
}

/** A pasta "One Piece" do índice do app (%APPDATA%/com.labirinto.app/pastas/indice.json). */
function pastaPadrao() {
  const appData = process.env.APPDATA
  if (appData === undefined || appData === '') throw new Error('APPDATA não está definido: passe --pasta <caminho>')
  const pastas = path.join(appData, 'com.labirinto.app', 'pastas')
  const indice = lerJson(path.join(pastas, 'indice.json'))
  const achadas = (Array.isArray(indice.pastas) ? indice.pastas : []).filter((pasta) => pasta && pasta.nome === NOME_DA_PASTA)
  if (achadas.length !== 1) throw new Error(`esperava 1 pasta "${NOME_DA_PASTA}" no índice, achei ${achadas.length}`)
  return path.join(pastas, achadas[0].id)
}

/** A campanha do Lobby ligada a esta pasta (nuvem/campanhas.json, ao lado de pastas/); `null` = nenhuma. */
function campanhaDoLobby(pasta) {
  const arquivo = path.join(path.dirname(path.dirname(pasta)), 'nuvem', 'campanhas.json')
  if (!fs.existsSync(arquivo)) return null
  const campanhas = lerJson(arquivo).campanhas
  const ligada = (Array.isArray(campanhas) ? campanhas : []).find((campanha) => campanha && campanha.pastaId === path.basename(pasta))
  return ligada === undefined ? null : ligada.campanhaId
}

// ── Os textos literais do mestre (respostas-do-grilling.md) ────────────────

function entreAspas(linha, ateAUltima) {
  const inicio = linha.indexOf('"')
  const fim = ateAUltima ? linha.lastIndexOf('"') : linha.indexOf('"', inicio + 1)
  return inicio === -1 || fim <= inicio ? null : linha.slice(inicio + 1, fim)
}

/** Lidos do arquivo, para gravar o texto do mestre como está. Cada um `null` = a linha não está mais lá. */
function textosDoMestre() {
  const textos = { bencao: null, nuvens: null, nuvensEsclarecido: null, luz: null, armadilhar: null, chamado: null, cacada: null }
  if (!fs.existsSync(RESPOSTAS_DO_GRILLING)) return textos
  const linhas = fs.readFileSync(RESPOSTAS_DO_GRILLING, 'utf8').split(/\r?\n/)
  const linhaQueComeca = (comeco) => linhas.find((linha) => linha.startsWith(comeco)) ?? null

  const bencao = linhaQueComeca('- BÊNÇÃO DE UMA RAPOSA (texto novo do mestre, literal): "')
  if (bencao !== null) textos.bencao = entreAspas(bencao, true)
  const nuvens = linhaQueComeca('- EM MEIO ÀS ALEGRES NUVENS (literal): "')
  if (nuvens !== null) {
    textos.nuvens = entreAspas(nuvens, false)
    const marca = 'Esclarecido: '
    const esclarecido = nuvens.indexOf(marca)
    if (esclarecido !== -1) textos.nuvensEsclarecido = `${nuvens.slice(esclarecido + marca.length).replace(/[.\s]+$/u, '')}.`
  }
  const luz = linhaQueComeca('- A LUZ DO SOL BRILHA SOBRE TODOS (literal): "')
  if (luz !== null) textos.luz = entreAspas(luz, true)

  // O texto do Alexei ocupa várias linhas, cada uma recuada em 2 espaços (continuação da lista do markdown).
  const inicio = linhas.findIndex((linha) => linha.startsWith('- Texto do mestre (literal): "Alexei assim'))
  if (inicio !== -1) {
    const corpo = []
    for (let i = inicio + 1; i < linhas.length && linhas[i].startsWith('  '); i += 1) corpo.push(linhas[i].slice(2))
    const armadilhar = corpo.findIndex((linha) => linha.startsWith('Armadilhar:'))
    const chamado = corpo.findIndex((linha) => linha.startsWith('Chamado do Lobo:'))
    const cacada = corpo.findIndex((linha) => linha.startsWith('A Caçada Começa:'))
    if (armadilhar !== -1 && chamado > armadilhar) textos.armadilhar = corpo.slice(armadilhar, chamado).join('\n')
    if (chamado !== -1) textos.chamado = corpo[chamado]
    if (cacada !== -1) textos.cacada = corpo[cacada].replace(/"$/u, '')
  }
  return textos
}

// ── O registro do que muda ─────────────────────────────────────────────────

function curto(valor) {
  if (valor === undefined) return '(sem)'
  const texto = typeof valor === 'string' ? valor : JSON.stringify(valor)
  const umaLinha = texto.replace(/\r?\n/g, '⏎')
  const corpo = umaLinha.length <= TEXTO_NA_LINHA_MAX ? umaLinha : `${umaLinha.slice(0, TEXTO_NA_LINHA_MAX - 1)}… (${texto.length} car.)`
  return typeof valor === 'string' ? `"${corpo}"` : corpo
}

/** O que acontece com uma ficha: as mudanças (com o caminho no rpg.json), os avisos e a versão do app que elas pedem. */
function novoRegistro(ficha) {
  return { nome: ficha.nome, id: ficha.id, mudancas: [], avisos: [], exige: [] }
}

/** A mudança só vale com o app `versao` ou mais (abaixo, `motivo`): o --aplicar recusa antes de gravar. */
function exigirVersao(registro, versao, motivo) {
  if (!registro.exige.some((exigida) => exigida.motivo === motivo)) registro.exige.push({ versao, motivo })
}

function mudou(registro, caminho, rotulo, antes, depois) {
  registro.mudancas.push({ caminho: ['personagens', registro.id, ...caminho], rotulo, antes, depois })
}

function avisar(registro, texto) {
  registro.avisos.push(texto)
}

// ── As trocas, cada uma conferindo o valor de antes ────────────────────────

function ehObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
}

function cartoes(ficha, aba) {
  return ehObjeto(ficha.abas) && Array.isArray(ficha.abas[aba]) ? ficha.abas[aba] : []
}

function acharCartao(registro, ficha, aba, nomes) {
  const lista = Array.isArray(nomes) ? nomes : [nomes]
  const achado = cartoes(ficha, aba).find((cartao) => lista.includes(cartao.nome))
  if (achado === undefined) avisar(registro, `não achei "${lista[0]}" em ${aba}: não mexi`)
  return achado ?? null
}

/** `de` = o valor esperado hoje (`undefined` = o campo não existe; `null` = aceita qualquer um). */
function trocarCampo(registro, ficha, aba, cartao, campo, de, para) {
  if (cartao === null) return
  if (!ehObjeto(cartao.campos)) {
    avisar(registro, `${aba}[${cartao.nome}] sem campos: não mexi`)
    return
  }
  const atual = cartao.campos[campo]
  if (atual === para) return
  if (de !== null && atual !== de) {
    avisar(registro, `${aba}[${cartao.nome}].${campo}: esperava ${curto(de)}, achei ${curto(atual)}: não mexi`)
    return
  }
  cartao.campos[campo] = para
  mudou(registro, ['abas', aba, cartao.id, 'campos', campo], `${aba}[${cartao.nome}].${campo}`, atual, para)
}

function renomearCartao(registro, aba, cartao, de, para) {
  if (cartao === null || cartao.nome === para) return
  if (cartao.nome !== de) {
    avisar(registro, `${aba}: esperava o nome "${de}", achei "${cartao.nome}": não mexi`)
    return
  }
  const antes = cartao.nome
  cartao.nome = para
  mudou(registro, ['abas', aba, cartao.id, 'nome'], `${aba}[${antes}].nome`, antes, para)
}

/** Troca todo `trecho` por `novo` num texto do cartão (campo ou extra); sem o trecho, nada. */
function trocarTrecho(registro, aba, cartao, onde, trecho, novo) {
  if (cartao === null) return
  if (onde.campo !== undefined) {
    const atual = ehObjeto(cartao.campos) ? cartao.campos[onde.campo] : undefined
    if (typeof atual !== 'string' || !atual.includes(trecho)) return
    const depois = atual.split(trecho).join(novo)
    cartao.campos[onde.campo] = depois
    mudou(registro, ['abas', aba, cartao.id, 'campos', onde.campo], `${aba}[${cartao.nome}].${onde.campo} ("${trecho}" -> "${novo}")`, atual, depois)
    return
  }
  if (!Array.isArray(cartao.extras)) return
  cartao.extras.forEach((extra, indice) => {
    if (!ehObjeto(extra) || typeof extra.valor !== 'string' || !extra.valor.includes(trecho)) return
    const antes = extra.valor
    extra.valor = antes.split(trecho).join(novo)
    mudou(registro, ['abas', aba, cartao.id, 'extras', indice, 'valor'], `${aba}[${cartao.nome}].extras["${extra.nome.trim()}"] ("${trecho}" -> "${novo}")`, antes, extra.valor)
  })
}

function cartaoNovo(nome, campos, imagem) {
  return { id: `cart_${crypto.randomUUID()}`, nome, campos, extras: [], atributos: [], imagem, modificadores: [], subcartoes: [] }
}

function gravarMaximos(registro, ficha, valores) {
  if (!ehObjeto(ficha.maximos)) {
    avisar(registro, 'a ficha não tem "maximos": não mexi (o app sempre grava; ficha torta?)')
    return
  }
  for (const [recurso, valor] of Object.entries(valores)) {
    const atual = ficha.maximos[recurso]
    if (atual === valor) continue
    if (atual !== undefined) {
      avisar(registro, `maximos.${recurso} já é ${atual} (a decisão diz ${valor}): não mexi`)
      continue
    }
    ficha.maximos[recurso] = valor
    const atualDoRecurso = ehObjeto(ficha.recursos) ? (ficha.recursos[recurso] ?? 0) : 0
    mudou(registro, ['maximos', recurso], `maximos.${recurso} (atual ${atualDoRecurso} fica)`, undefined, valor)
  }
}

function itemDaMochila(item) {
  const limpo = {}
  for (const campo of CAMPOS_DO_ITEM) if (item[campo] !== undefined) limpo[campo] = item[campo]
  return limpo
}

function mesmoItem(a, b) {
  return a.id === b.id || (a.nome === b.nome && (a.itemId ?? null) === (b.itemId ?? null))
}

/** Devolve os itens do relatório da migração (B1) que a ficha não tem; o que já está lá não entra de novo. */
function devolverMochila(registro, ficha, doRelatorio) {
  const antes = Array.isArray(ficha.mochila) ? ficha.mochila : []
  const faltam = doRelatorio.mochila.filter((item) => !antes.some((tem) => mesmoItem(tem, item)))
  const jaTinha = doRelatorio.mochila.length - faltam.length
  if (jaTinha > 0) avisar(registro, `mochila: ${jaTinha} item(ns) do relatório já estavam na ficha`)
  if (faltam.length > 0) {
    const depois = [...antes, ...faltam.map(itemDaMochila)]
    ficha.mochila = depois
    const nomes = faltam.map((item) => (item.quantidade > 1 ? `${item.nome} x${item.quantidade}` : item.nome)).join(', ')
    mudou(registro, ['mochila'], `mochila += ${nomes}`, antes.length === 0 ? undefined : `${antes.length} item(ns)`, `${depois.length} item(ns)`)
  }
  const moedas = Number.isSafeInteger(doRelatorio.moedas) ? doRelatorio.moedas : 0
  if (moedas > 0 && (ficha.moedas ?? 0) === 0) {
    ficha.moedas = moedas
    mudou(registro, ['moedas'], 'moedas', undefined, moedas)
  }
}

// ── As correções, ficha por ficha ──────────────────────────────────────────

function corrigirVincent(registro, ficha, mochilaDoRelatorio) {
  // Duas "Acrobacia" iguais em Perícias (já na cópia de 31/10): fica a primeira.
  const acrobacias = cartoes(ficha, 'pericias').filter((cartao) => cartao.nome === 'Acrobacia')
  const [primeira, ...repetidas] = acrobacias
  for (const repetida of repetidas) {
    const igual = JSON.stringify([repetida.campos, repetida.atributos, repetida.extras]) === JSON.stringify([primeira.campos, primeira.atributos, primeira.extras])
    if (!igual) {
      avisar(registro, 'pericias: a segunda Acrobacia não é igual à primeira: não apaguei')
      continue
    }
    ficha.abas.pericias = cartoes(ficha, 'pericias').filter((cartao) => cartao.id !== repetida.id)
    mudou(registro, ['abas', 'pericias', repetida.id], 'pericias -= Acrobacia (a repetida)', repetida.id, undefined)
  }

  const rosa = acharCartao(registro, ficha, 'armas', 'Rosa Fúnebre')
  if (rosa !== null && !Array.isArray(rosa.subcartoes)) avisar(registro, 'armas[Rosa Fúnebre] sem subcartoes: não pus a Bala de Prata')
  else if (rosa !== null && !rosa.subcartoes.some((bala) => bala.nome === BALA_DE_PRATA.nome)) {
    const bala = cartaoNovo(BALA_DE_PRATA.nome, { dano: BALA_DE_PRATA.dano, efeito: BALA_DE_PRATA.efeito }, null)
    rosa.subcartoes.push(bala)
    mudou(registro, ['abas', 'armas', rosa.id, 'subcartoes', bala.id], 'armas[Rosa Fúnebre].Tipos de bala += Bala de Prata', undefined, `dano ${BALA_DE_PRATA.dano}`)
  }

  if (!ehObjeto(ficha.abas)) avisar(registro, 'a ficha não tem "abas": não pus o Boomerang')
  else if (!cartoes(ficha, 'armas').some((arma) => arma.nome === BOOMERANG.nome)) {
    // A imagem do item que estava na mochila (mesma mídia), se o relatório a tiver.
    const doItem = (mochilaDoRelatorio?.mochila ?? []).find((item) => item.nome === BOOMERANG.nome)
    const imagem = doItem !== undefined && typeof doItem.imagem === 'string' && doItem.imagem.startsWith('midia:') ? doItem.imagem : null
    const arma = cartaoNovo(BOOMERANG.nome, { categoria: BOOMERANG.categoria, dano: BOOMERANG.dano, efeito: BOOMERANG.efeito }, imagem)
    // Ficha sem a aba Armas: a aba inteira é a mudança (a conferência vê a chave nova, não o cartão).
    const abaNova = !Array.isArray(ficha.abas.armas)
    ficha.abas.armas = [...cartoes(ficha, 'armas'), arma]
    mudou(registro, abaNova ? ['abas', 'armas'] : ['abas', 'armas', arma.id], 'armas += Boomerang', undefined, `${BOOMERANG.categoria}, dano ${BOOMERANG.dano}`)
  }
}

function corrigirAlexei(registro, ficha, textos) {
  const arma = acharCartao(registro, ficha, 'armas', ['Arma', 'Rifle'])
  renomearCartao(registro, 'armas', arma, 'Arma', 'Rifle')
  trocarCampo(registro, ficha, 'armas', arma, 'dano', '10', '20')
  gravarTextoDoMestre(registro, ficha, 'Armadilhar', textos.armadilhar)
  gravarTextoDoMestre(registro, ficha, 'Chamado do Lobo', textos.chamado)
  const antes = registro.mudancas.length
  moverACacadaParaFormas(registro, ficha, textos.cacada)
  if (registro.mudancas.length > antes) {
    exigirVersao(registro, VERSAO_DA_FORMA_COM_CUSTO, 'o molde de Transformações dele não tem Custo, Efeito nem Duração: a ficha esconderia os 200 SP e o texto da Caçada')
  }
}

/**
 * F0c, Alexei: A Caçada Começa de Habilidades para Transformações, MESMO cartão (id, nome, imagem, extras), com a
 * Descrição do mestre, Custo, Duração e Ataques extras. Já em Transformações (rodada anterior, ou o mestre moveu): só
 * confere os campos, então rodar de novo não muda nada.
 */
function moverACacadaParaFormas(registro, ficha, texto) {
  if (!ehObjeto(ficha.abas)) {
    avisar(registro, `a ficha não tem "abas": não movi "${CACADA.nome}"`)
    return
  }
  const naHabilidade = cartoes(ficha, 'habilidades').filter((cartao) => cartao.nome === CACADA.nome)
  const naForma = cartoes(ficha, 'transformacoes').filter((cartao) => cartao.nome === CACADA.nome)
  const [cartao] = [...naHabilidade, ...naForma]
  if (cartao === undefined || naHabilidade.length + naForma.length > 1) {
    avisar(registro, `esperava 1 "${CACADA.nome}" em habilidades ou transformacoes, achei ${naHabilidade.length} + ${naForma.length}: não mexi`)
    return
  }
  if (cartao.id !== CACADA.id) {
    avisar(registro, `"${CACADA.nome}" tem o id ${cartao.id} e a batalha a acha por ${CACADA.id}: não mexi`)
    return
  }
  if (!ehObjeto(cartao.campos)) {
    avisar(registro, `${CACADA.nome} sem campos: não mexi`)
    return
  }
  if (naHabilidade.length === 1) {
    ficha.abas.habilidades = cartoes(ficha, 'habilidades').filter((outro) => outro.id !== cartao.id)
    mudou(registro, ['abas', 'habilidades', cartao.id], `habilidades -= ${CACADA.nome} (vai para Transformações, mesmo id)`, cartao.id, undefined)
    // Ficha sem a aba Transformações: a aba inteira é a mudança (a conferência vê a chave nova, não o cartão).
    const abaNova = !Array.isArray(ficha.abas.transformacoes)
    ficha.abas.transformacoes = [...cartoes(ficha, 'transformacoes'), cartao]
    mudou(registro, abaNova ? ['abas', 'transformacoes'] : ['abas', 'transformacoes', cartao.id], `transformacoes += ${CACADA.nome}`, undefined, cartao.id)
  }
  if (texto === null) avisar(registro, `o texto do mestre para "${CACADA.nome}" não está mais em respostas-do-grilling.md: não mexi na Descrição`)
  else trocarCampo(registro, ficha, 'transformacoes', cartao, 'descricao', null, texto)
  trocarCampo(registro, ficha, 'transformacoes', cartao, 'custo', CACADA.custoDe, CACADA.custo)
  trocarCampo(registro, ficha, 'transformacoes', cartao, 'duracao', undefined, CACADA.duracao)
  trocarCampo(registro, ficha, 'transformacoes', cartao, 'ataquesExtras', undefined, CACADA.ataquesExtras)
}

function corrigirAira(registro, ficha, textos) {
  gravarTextoDoMestre(registro, ficha, 'A Virtude Traz Benção', textos.bencao)
  const nuvens = textos.nuvens === null ? null : textos.nuvensEsclarecido === null ? textos.nuvens : `${textos.nuvens}\n\nEsclarecido no grilling: ${textos.nuvensEsclarecido}`
  gravarTextoDoMestre(registro, ficha, 'Em Meio às Alegres Nuvens', nuvens)
  gravarTextoDoMestre(registro, ficha, 'A Luz do Sol Brilha Sobre Todos', textos.luz)
}

function gravarTextoDoMestre(registro, ficha, nomeDaTecnica, texto) {
  if (texto === null) {
    avisar(registro, `o texto do mestre para "${nomeDaTecnica}" não está mais em respostas-do-grilling.md: não mexi`)
    return
  }
  trocarCampo(registro, ficha, 'habilidades', acharCartao(registro, ficha, 'habilidades', nomeDaTecnica), 'descricao', null, texto)
}

function corrigirGuilherme(registro, ficha) {
  const arma = acharCartao(registro, ficha, 'armas', ['Arma do Guilherme', 'Lança'])
  renomearCartao(registro, 'armas', arma, 'Arma do Guilherme', 'Lança')
  trocarCampo(registro, ficha, 'armas', arma, 'dano', '0', '20')
  trocarCampo(registro, ficha, 'armas', arma, 'categoria', undefined, 'Branca')
}

function corrigirHarvey(registro, ficha) {
  trocarCampo(registro, ficha, 'armas', acharCartao(registro, ficha, 'armas', 'Pá'), 'dano', '10 Força', '10')
  // "Todos os golpes do Harvey são feitos usando uma pá": os de dano somam a arma.
  const giro = acharCartao(registro, ficha, 'habilidades', 'Giro de Pá')
  trocarCampo(registro, ficha, 'habilidades', giro, 'dano', 'Força + Agilidade + 30 de dano.', 'Força + Agilidade + 30 + Dano da Arma')
  const pazada = acharCartao(registro, ficha, 'habilidades', 'Pazada [+1]')
  trocarCampo(registro, ficha, 'habilidades', pazada, 'dano', 'Força + 45 de dano', 'Força + 45 + Dano da Arma')

  const medicina = acharCartao(registro, ficha, 'habilidades', 'Medicina')
  trocarTrecho(registro, 'habilidades', medicina, { campo: 'descricao' }, 'Cirugia', 'Cirurgia')
  trocarTrecho(registro, 'habilidades', medicina, { extras: true }, 'Cirugia', 'Cirurgia')
  // "Medicina: cura 100" (o Efeito já diz 100; só a Descrição dizia 50).
  trocarTrecho(registro, 'habilidades', medicina, { campo: 'descricao' }, 'Recupera 50 de vida', 'Recupera 100 de vida')

  const maldicao = acharCartao(registro, ficha, 'desvantagens', ['Amaldiçoado', 'Amaldiçoado: Infâmia'])
  renomearCartao(registro, 'desvantagens', maldicao, 'Amaldiçoado', 'Amaldiçoado: Infâmia')
  darKitMedico(registro, ficha)
}

/** Sem acento, sem caixa e sem espaço nas pontas: "Kit médico " acha o "Kit Médico". */
function semAcento(texto) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

/** F0c, Harvey: 1 Kit Médico na mochila, se ainda não houver nenhum (o mestre pode já ter dado). */
function darKitMedico(registro, ficha) {
  const antes = Array.isArray(ficha.mochila) ? ficha.mochila : []
  const procurado = semAcento(KIT_MEDICO.nome)
  if (antes.some((item) => ehObjeto(item) && typeof item.nome === 'string' && semAcento(item.nome) === procurado)) return
  // Sem `itemId`: o acervo da pasta não tem Kit Médico. Sem `quantidade`: ausente = 1.
  ficha.mochila = [...antes, { id: crypto.randomUUID(), ...KIT_MEDICO }]
  mudou(registro, ['mochila'], `mochila += ${KIT_MEDICO.nome}`, antes.length === 0 ? undefined : `${antes.length} item(ns)`, `${ficha.mochila.length} item(ns)`)
}

/** F0c, Saga: "igual ao Judge, ajustável". Atributo que o mestre já mudou fica; HP e SP atuais vão ao máximo onde estão em 0. */
function corrigirSaga(registro, ficha) {
  if (!ehObjeto(ficha.atributos)) avisar(registro, 'a ficha não tem "atributos": não mexi nos atributos')
  else {
    for (const [atributo, doJudge] of Object.entries(ATRIBUTOS_DO_JUDGE_PADRAO)) {
      const atual = ficha.atributos[atributo]
      if (atual === doJudge) continue
      if (atual !== undefined) {
        avisar(registro, `atributos.${atributo} é ${curto(atual)} (o Judge padrão tem ${doJudge}): não mexi, o mestre ajustou`)
        continue
      }
      ficha.atributos[atributo] = doJudge
      mudou(registro, ['atributos', atributo], `atributos.${atributo} (o do Judge padrão)`, undefined, doJudge)
    }
  }
  encherOsRecursos(registro, ficha, RECURSOS_CHEIOS_DA_SAGA)
}

/** O atual vira o máximo gravado, só onde o atual é 0 ou falta. Atual acima de 0 é do mestre: fica. */
function encherOsRecursos(registro, ficha, recursos) {
  if (!ehObjeto(ficha.recursos) || !ehObjeto(ficha.maximos)) {
    avisar(registro, 'a ficha não tem "recursos" ou "maximos": não enchi o HP e o SP')
    return
  }
  for (const recurso of recursos) {
    const maximo = ficha.maximos[recurso]
    const atual = ficha.recursos[recurso]
    if (atual !== undefined && atual !== 0) continue
    if (!Number.isSafeInteger(maximo) || maximo <= 0) {
      avisar(registro, `maximos.${recurso} não está gravado: o atual fica ${curto(atual)}`)
      continue
    }
    ficha.recursos[recurso] = maximo
    mudou(registro, ['recursos', recurso], `recursos.${recurso} (atual = máximo)`, atual, maximo)
  }
}

function corrigirVagn(registro, ficha) {
  if (typeof ficha.descricao !== 'string' || !ficha.descricao.includes(BLOCO_VELHO_DO_VAGN)) {
    if (/Idade:\s*25/u.test(ficha.descricao ?? '')) avisar(registro, 'descricao: o bloco de 25 anos/Gatuno mudou de forma: não mexi')
    return
  }
  const antes = ficha.descricao
  ficha.descricao = antes.replace(BLOCO_VELHO_DO_VAGN, '')
  mudou(registro, ['descricao'], 'descricao (sai o bloco 25 anos/Gatuno; fica 21 anos/Ferreiro)', antes, ficha.descricao)
}

function corrigirJimboy(registro, ficha) {
  // "Full, anda +2: +2 casas em cada movimento (como a Ignição)": o app lê o campo Deslocamento.
  const full = acharCartao(registro, ficha, 'transformacoes', 'NEKO NEKO NO MI Full')
  trocarCampo(registro, ficha, 'transformacoes', full, 'deslocamento', undefined, '+2')
}

function corrigirSiegfried(registro, ficha) {
  // "Armas Destruídas": só título; "Armas por batalha: 3" (a opção da lista do sistema é "3 armas").
  const atual = ehObjeto(ficha.escolhas) ? ficha.escolhas.armasPorBatalha : null
  if (atual === null) avisar(registro, 'a ficha não tem "escolhas": não pus Armas por batalha')
  else if (atual === undefined) {
    ficha.escolhas.armasPorBatalha = '3 armas'
    mudou(registro, ['escolhas', 'armasPorBatalha'], 'escolhas.armasPorBatalha', undefined, '3 armas')
  } else if (atual !== '3 armas') avisar(registro, `escolhas.armasPorBatalha já é "${atual}": não mexi`)

  const arrombamento = acharCartao(registro, ficha, 'pericias', 'Arrombamento')
  if (arrombamento !== null && JSON.stringify(arrombamento.atributos ?? null) !== JSON.stringify(['forca'])) {
    if (JSON.stringify(arrombamento.atributos) === JSON.stringify(['percepcao'])) {
      const antes = arrombamento.atributos
      arrombamento.atributos = ['forca']
      mudou(registro, ['abas', 'pericias', arrombamento.id, 'atributos'], 'pericias[Arrombamento].atributos', antes, ['forca'])
    } else avisar(registro, `pericias[Arrombamento].atributos é ${JSON.stringify(arrombamento.atributos)}: não mexi`)
  }
  trocarTrecho(registro, 'pericias', arrombamento, { campo: 'descricao' }, ARROMBAMENTO_DE, ARROMBAMENTO_PARA)
  trocarTrecho(registro, 'desvantagens', acharCartao(registro, ficha, 'desvantagens', 'Amnésia'), { campo: 'efeito' }, 'Testes de Inteligência', 'Testes de Intuição')
}

/** Todas as correções numa cópia do rpg.json. Devolve a cópia e o registro de cada ficha. */
function corrigir(rpg, mochilas, textos) {
  const depois = structuredClone(rpg)
  const registros = []
  const porNome = new Map(depois.personagens.map((ficha) => [ficha.nome, ficha]))
  const mochilaPorId = new Map(mochilas.map((ficha) => [ficha.fichaId, ficha]))
  for (const ficha of depois.personagens) {
    const registro = novoRegistro(ficha)
    registros.push(registro)
    const maximos = MAXIMOS[ficha.nome]
    if (maximos !== undefined) gravarMaximos(registro, ficha, maximos)
    const daMochila = mochilaPorId.get(ficha.id)
    if (daMochila !== undefined && Array.isArray(daMochila.mochila) && daMochila.mochila.length > 0) devolverMochila(registro, ficha, daMochila)
    if (ficha.nome === 'Vincent G.') corrigirVincent(registro, ficha, daMochila)
    else if (ficha.nome === 'Alexei') corrigirAlexei(registro, ficha, textos)
    else if (ficha.nome === 'Aira') corrigirAira(registro, ficha, textos)
    else if (ficha.nome === 'Guilherme') corrigirGuilherme(registro, ficha)
    else if (ficha.nome === 'Harvey Solferino') corrigirHarvey(registro, ficha)
    else if (ficha.nome === 'Vagn Kane') corrigirVagn(registro, ficha)
    else if (ficha.nome === 'Jimboy Segundo') corrigirJimboy(registro, ficha)
    else if (ficha.nome === 'Siegfried') corrigirSiegfried(registro, ficha)
    else if (ficha.nome === 'Saga') corrigirSaga(registro, ficha)
  }
  for (const nome of Object.keys(MAXIMOS)) if (!porNome.has(nome)) registros.push({ nome, id: '?', mudancas: [], avisos: ['ficha não encontrada no rpg.json'], exige: [] })
  return { depois, registros }
}

// ── A conferência: só os caminhos previstos mudaram ────────────────────────

function ehRegistro(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
}

/** Lista de objetos todos com `id` único: compara por id (apagar um não "muda" os seguintes). */
function porId(lista) {
  if (!lista.every((item) => ehRegistro(item) && typeof item.id === 'string')) return null
  const mapa = new Map(lista.map((item) => [item.id, item]))
  return mapa.size === lista.length ? mapa : null
}

/** Os caminhos (com id no lugar do índice nas listas de objetos com id) em que `a` e `b` diferem. */
function caminhosQueMudaram(a, b, caminho = [], saida = []) {
  if (Array.isArray(a) && Array.isArray(b)) {
    const mapaA = porId(a)
    const mapaB = porId(b)
    if (mapaA !== null && mapaB !== null) {
      for (const id of new Set([...mapaA.keys(), ...mapaB.keys()])) {
        if (!mapaA.has(id) || !mapaB.has(id)) saida.push([...caminho, id])
        else caminhosQueMudaram(mapaA.get(id), mapaB.get(id), [...caminho, id], saida)
      }
      const ordemA = a.map((item) => item.id).filter((id) => mapaB.has(id))
      const ordemB = b.map((item) => item.id).filter((id) => mapaA.has(id))
      if (ordemA.join('\n') !== ordemB.join('\n')) saida.push([...caminho, '(ordem)'])
      return saida
    }
    if (a.length !== b.length) saida.push(caminho)
    else a.forEach((item, indice) => caminhosQueMudaram(item, b[indice], [...caminho, indice], saida))
    return saida
  }
  if (ehRegistro(a) && ehRegistro(b)) {
    for (const chave of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(chave in a) || !(chave in b)) saida.push([...caminho, chave])
      else caminhosQueMudaram(a[chave], b[chave], [...caminho, chave], saida)
    }
    return saida
  }
  if (a !== b) saida.push(caminho)
  return saida
}

function comecaCom(caminho, prefixo) {
  return prefixo.length <= caminho.length && prefixo.every((parte, indice) => String(parte) === String(caminho[indice]))
}

/** Erros da conferência: caminho que mudou sem estar previsto, e previsto que não mudou. Vazio = ok. */
function conferirMudancas(antes, depois, previstos) {
  const erros = []
  const mudaram = caminhosQueMudaram(antes, depois)
  for (const caminho of mudaram) if (!previstos.some((previsto) => comecaCom(caminho, previsto))) erros.push(`mudou sem estar previsto: ${caminho.join('.')}`)
  for (const previsto of previstos) if (!mudaram.some((caminho) => comecaCom(caminho, previsto) || comecaCom(previsto, caminho))) erros.push(`previsto e não mudou: ${previsto.join('.')}`)
  return erros
}

// ── Gravar ─────────────────────────────────────────────────────────────────

/** O Labirinto aberto (labirinto.exe). Lança se o tasklist não responde: na dúvida, não grava. */
function appAberto() {
  const r = spawnSync('tasklist', ['/FI', `IMAGENAME eq ${PROCESSO_DO_APP}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true })
  if (r.error !== undefined || r.status !== 0) throw new Error(`não consegui conferir se o Labirinto está aberto (tasklist: ${r.error?.message ?? `saiu ${r.status}`})`)
  return r.stdout.split(/\r?\n/).some((linha) => linha.toLowerCase().startsWith(`"${PROCESSO_DO_APP}"`))
}

/** O primeiro nome de cópia livre: rpg.json.antes-do-conserto-20261108, depois -2, -3... */
function nomeDaCopiaLivre(pasta) {
  for (let n = 1; ; n += 1) {
    const nome = n === 1 ? NOME_DA_COPIA : `${NOME_DA_COPIA}-${n}`
    if (!fs.existsSync(path.join(pasta, nome))) return path.join(pasta, nome)
  }
}

function gravarComRenomear(pasta, destino, texto) {
  const temporario = path.join(pasta, ARQUIVO_TEMPORARIO)
  // Sobra de uma rodada que caiu no meio: é deste script, não do app.
  if (fs.existsSync(temporario)) fs.unlinkSync(temporario)
  const fd = fs.openSync(temporario, 'wx')
  try {
    fs.writeFileSync(fd, texto, 'utf8')
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
  fs.renameSync(temporario, destino)
}

// ── F0b: as fichas mudadas no disco, para o app mandar ao Lobby ───────────

/** A versão do labirinto.exe instalado ("0.5.35"); `null` = não achei ou não deu para ler. */
function versaoDoAppInstalado() {
  if (!fs.existsSync(EXE_INSTALADO)) return null
  const comando = `(Get-Item -LiteralPath '${EXE_INSTALADO.replace(/'/g, "''")}').VersionInfo.ProductVersion`
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', comando], { encoding: 'utf8', windowsHide: true })
  if (r.error !== undefined || r.status !== 0) return null
  const versao = r.stdout.trim()
  return /^\d+\.\d+\.\d+/.test(versao) ? versao : null
}

function versaoAoMenos(versao, minima) {
  const partes = versao.split('.').map((parte) => Number.parseInt(parte, 10))
  for (let i = 0; i < minima.length; i += 1) {
    const parte = partes[i] ?? 0
    if (parte !== minima[i]) return parte > minima[i]
  }
  return true
}

/** O que esta rodada pede do app instalado: a de cada mudança e, com Lobby, a que lê as mudadas no disco. */
function versoesExigidas(registros, comLobby) {
  const exigidas = registros.flatMap((registro) => (registro.mudancas.length > 0 ? registro.exige : []))
  if (comLobby) exigidas.unshift({ versao: VERSAO_QUE_LE_AS_MUDADAS, motivo: 'ele desfaria estas mudanças ao iniciar' })
  return exigidas.filter((exigida, indice) => exigidas.findIndex((outra) => outra.motivo === exigida.motivo) === indice)
}

/** A maior versão entre as exigidas ([0, 0, 0] = nenhuma). */
function maiorVersao(exigidas) {
  return exigidas.reduce((atual, exigida) => (versaoAoMenos(exigida.versao.join('.'), atual) ? exigida.versao : atual), [0, 0, 0])
}

/** O app instalado atende a cada exigência; senão lança (o 0.5.35 desfaria tudo ao iniciar; o 0.5.36 esconderia o Custo da Caçada). */
function conferirVersaoDoApp(exigidas) {
  if (exigidas.length === 0) return
  const versao = versaoDoAppInstalado()
  const maior = maiorVersao(exigidas).join('.')
  if (versao === null) throw new Error(`não consegui ler a versão do app em ${EXE_INSTALADO}: atualize para ${maior} ou mais e rode de novo. Nada foi gravado.`)
  for (const exigida of exigidas) {
    if (!versaoAoMenos(versao, exigida.versao)) throw new Error(`o app instalado é ${versao}: ${exigida.motivo}. Atualize para ${exigida.versao.join('.')} ou mais (com o app fechado depois) e rode de novo. Nada foi gravado.`)
  }
  console.log(`app instalado: ${versao} (${maior} ou mais, como estas mudanças pedem)`)
}

/** Uma linha para a simulação: a versão que o --aplicar vai pedir e a instalada agora. */
function situacaoDaVersao(exigidas) {
  const maior = maiorVersao(exigidas)
  const versao = versaoDoAppInstalado()
  const motivos = exigidas.map((exigida) => `${exigida.versao.join('.')}, porque abaixo ${exigida.motivo}`).join('; ')
  const agora = versao === null ? 'Não consegui ler a instalada' : `Instalado agora: ${versao}${versaoAoMenos(versao, maior) ? '' : ', o --aplicar recusaria'}`
  return `Versão do app: o --aplicar pede ${maior.join('.')} ou mais (${motivos}). ${agora}.`
}

/** A pasta da campanha (nuvem/<campanhaId>/, ao lado de pastas/). */
function pastaDaCampanha(pasta, campanhaId) {
  return path.join(path.dirname(path.dirname(pasta)), 'nuvem', campanhaId)
}

/** O mudadas-no-disco.json que já existe, conferido; `null` = não existe. Fora do formato lança (não grava por cima). */
function mudadasExistentes(arquivo) {
  if (!fs.existsSync(arquivo)) return null
  let existente
  try {
    existente = JSON.parse(fs.readFileSync(arquivo, 'utf8'))
  } catch (erro) {
    throw new Error(`${arquivo} não abre como JSON (${erro.message}): não gravo por cima. Nada foi gravado.`)
  }
  if (!ehRegistro(existente) || existente.versao !== 1 || !Array.isArray(existente.fichas)) throw new Error(`${arquivo} está fora do formato: não gravo por cima. Nada foi gravado.`)
  return existente
}

/**
 * O mudadas-no-disco.json com a ficha de ANTES de cada ficha mudada. Um que o app ainda não leu (sem `feito`) é
 * juntado: a ficha que já estava nele guarda a de antes da PRIMEIRA gravação (é dela que a diferença sai). Assim o
 * F0c rodado com o F0 ainda pendente manda F0 + F0c; com o F0 já lido (`feito`), sai um arquivo novo com a ficha de
 * agora como a de antes.
 */
function mudadasNovas(arquivo, antes, ids) {
  const existente = mudadasExistentes(arquivo)
  const pendente = existente !== null && existente.feito === undefined ? existente : null
  // O app grava o `loteId` de cada ficha antes de pôr a mudança na fila e só depois o `feito`. Ficha com lote e sem
  // `feito` = o app começou e parou no meio: a mudança dela já pode estar na fila sem esta rodada, e a ficha seria pulada.
  const comLote = pendente === null ? [] : pendente.fichas.filter((ficha) => ehRegistro(ficha) && ids.includes(ficha.id) && ficha.loteId !== undefined)
  if (comLote.length > 0) {
    throw new Error(`${arquivo}: o app começou a mandar ao Lobby ${comLote.length} destas fichas e parou no meio. Abra o Labirinto uma vez (ele termina), feche e rode de novo. Nada foi gravado.`)
  }
  const fichas = pendente === null ? [] : [...pendente.fichas]
  const jaTem = new Set(fichas.map((ficha) => ficha.id))
  const porIdAntes = new Map(antes.personagens.map((ficha) => [ficha.id, ficha]))
  for (const id of ids) if (!jaTem.has(id) && porIdAntes.has(id)) fichas.push({ id, antes: porIdAntes.get(id) })
  return { versao: 1, id: pendente === null ? crypto.randomUUID() : pendente.id, origem: ORIGEM_DAS_MUDADAS, quando: Date.now(), fichas }
}

function gravarMudadas(pasta, campanhaId, antes, ids) {
  const dir = pastaDaCampanha(pasta, campanhaId)
  if (!fs.existsSync(path.join(dir, 'estado.json'))) throw new Error(`a campanha ${campanhaId} não tem ${path.join(dir, 'estado.json')}: o app nunca ligou o Lobby nesta pasta? Nada foi gravado.`)
  const arquivo = path.join(dir, ARQUIVO_DAS_MUDADAS)
  const mudadas = mudadasNovas(arquivo, antes, ids)
  const temporario = `${arquivo}.conserto-tmp`
  if (fs.existsSync(temporario)) fs.unlinkSync(temporario)
  fs.writeFileSync(temporario, JSON.stringify(mudadas, null, RECUO_DO_JSON), { encoding: 'utf8', flag: 'wx' })
  fs.renameSync(temporario, arquivo)
  console.log(`para o Lobby: ${arquivo} (${mudadas.fichas.length} ficha(s); o app manda ao iniciar)`)
}

/** Uma linha: o que o --aplicar fará com o mudadas-no-disco.json desta campanha. */
function situacaoDasMudadas(pasta, campanhaId) {
  const arquivo = path.join(pastaDaCampanha(pasta, campanhaId), ARQUIVO_DAS_MUDADAS)
  const existente = mudadasExistentes(arquivo)
  if (existente === null) return `Ainda não há ${ARQUIVO_DAS_MUDADAS}: o --aplicar cria um, com a ficha de agora como a de antes.`
  const quando = typeof existente.quando === 'number' ? new Date(existente.quando).toLocaleString('pt-BR') : '?'
  if (existente.feito === undefined) {
    return `O ${ARQUIVO_DAS_MUDADAS} de ${quando} ainda não foi lido pelo app (${existente.fichas.length} ficha(s)): o --aplicar junta neste, cada ficha que já está nele guarda a de antes daquela gravação, e a diferença enviada inclui as duas rodadas.`
  }
  return `O ${ARQUIVO_DAS_MUDADAS} de ${quando} já foi lido pelo app: o --aplicar grava um novo, com a ficha de agora como a de antes.`
}

function aplicar(pasta, textoDeAntes, antes, depois, previstos, campanha, idsMudados) {
  const arquivo = path.join(pasta, ARQUIVO_DAS_FICHAS)
  if (appAberto()) throw new Error('o Labirinto está aberto: feche o app e rode de novo')
  // Antes do rpg.json: se a gravação dele falhar e a cópia voltar, a ficha de antes é igual à do disco e o app não manda nada.
  if (campanha !== null) gravarMudadas(pasta, campanha, antes, idsMudados)

  const copia = nomeDaCopiaLivre(pasta)
  fs.copyFileSync(arquivo, copia, fs.constants.COPYFILE_EXCL)
  if (fs.readFileSync(copia, 'utf8') !== textoDeAntes) throw new Error(`a cópia ${path.basename(copia)} não saiu igual ao rpg.json: nada foi gravado`)
  console.log(`cópia: ${copia}`)

  const texto = JSON.stringify(depois, null, RECUO_DO_JSON)
  if (fs.readFileSync(arquivo, 'utf8') !== textoDeAntes) throw new Error('o rpg.json mudou enquanto o script rodava: nada foi gravado')
  gravarComRenomear(pasta, arquivo, texto)

  const relido = fs.readFileSync(arquivo, 'utf8')
  let erros
  try {
    const objeto = JSON.parse(relido)
    erros = relido === texto ? conferirMudancas(antes, objeto, previstos) : ['o rpg.json relido não é o que foi gravado']
  } catch (erro) {
    erros = [`o rpg.json relido não abre como JSON: ${erro.message}`]
  }
  if (erros.length > 0) {
    gravarComRenomear(pasta, arquivo, textoDeAntes)
    throw new Error(`conferência falhou, voltei a cópia:\n  ${erros.join('\n  ')}`)
  }
  console.log(`gravado e conferido: ${arquivo} (${previstos.length} mudança(s), só nos caminhos previstos)`)
}

// ── Mostrar ────────────────────────────────────────────────────────────────

function mostrar(registros) {
  for (const registro of registros) {
    console.log(`\n== ${registro.nome} ==`)
    if (registro.mudancas.length === 0 && registro.avisos.length === 0) console.log('  nada a mudar')
    for (const mudanca of registro.mudancas) console.log(`  ${mudanca.rotulo}: ${curto(mudanca.antes)} -> ${curto(mudanca.depois)}`)
    for (const aviso of registro.avisos) console.log(`  aviso: ${aviso}`)
  }
}

function principal() {
  const opcoes = lerArgumentos(process.argv.slice(2))
  const pasta = opcoes.pasta ?? pastaPadrao()
  const arquivo = path.join(pasta, ARQUIVO_DAS_FICHAS)
  const textoDeAntes = fs.readFileSync(arquivo, 'utf8')
  const antes = JSON.parse(textoDeAntes)
  if (!Array.isArray(antes.personagens)) throw new Error(`${arquivo} não tem a lista "personagens"`)

  const relatorio = path.join(pasta, RELATORIO_DA_MOCHILA)
  const mochilas = fs.existsSync(relatorio) ? lerJson(relatorio).fichas : []
  if (!fs.existsSync(relatorio)) console.log(`aviso: sem ${RELATORIO_DA_MOCHILA} na pasta: as mochilas ficam como estão`)

  const { depois, registros } = corrigir(antes, Array.isArray(mochilas) ? mochilas : [], textosDoMestre())
  console.log(`${opcoes.aplicar ? 'APLICAR' : 'SIMULAÇÃO (nada é gravado)'}: ${arquivo}`)
  mostrar(registros)

  const previstos = registros.flatMap((registro) => registro.mudancas.map((mudanca) => mudanca.caminho))
  const comMudanca = registros.filter((registro) => registro.mudancas.length > 0).length
  console.log(`\nTotal: ${previstos.length} mudança(s) em ${comMudanca} ficha(s).`)
  // Mesma conferência do --aplicar, já na simulação: o que o script mudaria em memória bate com o que ele diz que muda.
  const erros = conferirMudancas(antes, depois, previstos)
  if (erros.length > 0) throw new Error(`a conta interna não fecha:\n  ${erros.join('\n  ')}`)

  console.log('\nFica para depois (precisa de campo ou regra que o app ainda não tem):')
  for (const item of FICA_PARA_DEPOIS) console.log(`  - ${item}`)

  const campanha = campanhaDoLobby(pasta)
  if (campanha !== null) {
    console.log(
      [
        '',
        `Lobby: esta pasta está ligada à campanha ${campanha} (nuvem/campanhas.json).`,
        `O --aplicar também grava nuvem/${campanha}/${ARQUIVO_DAS_MUDADAS} com a ficha de antes de cada ficha mudada.`,
        'Ao iniciar, o app (0.5.36 ou mais) põe a diferença na fila do Lobby como mudança do mestre ANTES de acertar o',
        'rpg.json com a nuvem: a mudança fica e sobe ao site. O que um jogador mudou no site no mesmo campo depois da',
        'última sincronia aparece em "Mudanças para decidir". Com o app abaixo de 0.5.36 o --aplicar recusa (ele desfaria tudo).',
        situacaoDasMudadas(pasta, campanha),
      ].join('\n'),
    )
  }
  const exigidas = previstos.length === 0 ? [] : versoesExigidas(registros, campanha !== null)
  if (exigidas.length > 0) console.log(`\n${situacaoDaVersao(exigidas)}`)

  if (!opcoes.aplicar) {
    console.log('\nPara gravar: feche o Labirinto e rode com --aplicar.')
    return
  }
  if (previstos.length === 0) {
    console.log('\nNada a gravar.')
    return
  }
  if (!opcoes.ignorarVersaoDoApp) conferirVersaoDoApp(exigidas)
  const idsMudados = registros.filter((registro) => registro.mudancas.length > 0).map((registro) => registro.id)
  aplicar(pasta, textoDeAntes, antes, depois, previstos, campanha, idsMudados)
}

try {
  principal()
} catch (erro) {
  console.error(`\nERRO: ${erro.message}`)
  process.exitCode = 1
}
