//! A CÓPIA E O RESTAURAR: o disco de `<appData>/preparo/` de um lado, o Drive do outro,
//! a lógica de `plano.rs` no meio.
//!
//! - Copiar lê preparo/ (a mídia `midia/<sha256>.<ext>` nem é lida quando o Drive já tem
//!   o objeto), sobe os objetos que faltam e, por último, o manifesto. Um arquivo que
//!   muda no meio entra na rodada seguinte; o manifesto só cita objeto que está no Drive.
//! - Restaurar monta a data escolhida numa pasta à parte (`preludio-copia/restaurando`)
//!   e só no fim troca: o Prelúdio de antes vai inteiro para
//!   `preludio-copia/antes-de-restaurar/<carimbo>/preparo`, nunca é apagado. Falhou no
//!   meio, preparo/ fica como estava.
//! - O que é da cópia mora em `<appData>/preludio-copia/`, fora de preparo/, para a
//!   cópia não copiar a si mesma.

use std::collections::{HashMap, HashSet};
use std::io::Read as _;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sha2::{Digest as _, Sha256};

use super::drive::{self, CopiaNoDrive, Drive, ObjetoNoDrive, Pastas, ResumoNoDrive};
use super::plano::{self, ArquivoLocal, Manifesto};
use super::{erro_disco, erro_interrompido, ErroPreludio};

/// `<appData>/preparo/` (client/src/lib/preparo/disco.ts).
const PASTA_DO_PREPARO: &str = "preparo";
const PASTA_DA_COPIA: &str = "preludio-copia";
const ARQUIVO_DA_ULTIMA: &str = "ultima.json";
const PASTA_RESTAURANDO: &str = "restaurando";
const PASTA_ANTES_DE_RESTAURAR: &str = "antes-de-restaurar";
const AVISOS_MAX: usize = 20;
/// O manifesto de 200 mil arquivos tem uns 30 MiB.
const MANIFESTO_MAX: usize = 64 * 1024 * 1024;
/// Rodadas de envio: um arquivo que muda durante a cópia entra na rodada seguinte.
const RODADAS_MAX: usize = 3;
const PEDACO_DE_LEITURA: usize = 64 * 1024;
/// Esperas antes de tentar de novo uma troca de pasta (antivírus e indexador seguram
/// arquivos por instantes).
const ESPERAS_DA_TROCA_MS: [u64; 3] = [50, 150, 400];
const APP: &str = concat!("labirinto-vtt ", env!("CARGO_PKG_VERSION"));

/// O andamento, no evento `preludio:copia`.
#[derive(Debug, Clone, Serialize)]
pub struct Progresso {
    pub fase: &'static str,
    pub feitos: usize,
    pub total: usize,
}

impl Progresso {
    fn de(fase: &'static str, feitos: usize, total: usize) -> Self {
        Self { fase, feitos, total }
    }

    /// Terminou (deu certo ou não): a tela que só acompanhava uma cópia aberta por
    /// outra (o mestre saiu e voltou ao Prelúdio no meio) relê a última cópia.
    pub fn fim() -> Self {
        Self::de("fim", 0, 0)
    }
}

/// A última cópia feita neste PC (`preludio-copia/ultima.json`): só para a tela mostrar
/// sem internet. A verdade sobre as cópias é a lista do Drive.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UltimaCopia {
    pub quando: u64,
    pub nome: String,
    pub arquivos: u64,
    pub bytes: u64,
    pub enviados: u64,
    pub nada_mudou: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumoDaCopia {
    #[serde(flatten)]
    pub ultima: UltimaCopia,
    pub bytes_enviados: u64,
    pub avisos: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumoDaRestauracao {
    pub nome: String,
    pub arquivos: u64,
    pub baixados: u64,
    pub do_disco: u64,
    /// Onde ficou o Prelúdio de antes, relativo à pasta de dados do app.
    pub guardado_em: Option<String>,
}

/// Avisos com teto: do 21º em diante, só a contagem.
#[derive(Default)]
struct Avisos {
    lista: Vec<String>,
    a_mais: usize,
}

impl Avisos {
    fn anotar(&mut self, aviso: String) {
        if self.lista.len() < AVISOS_MAX {
            self.lista.push(aviso);
        } else {
            self.a_mais += 1;
        }
    }

    fn fechar(mut self) -> Vec<String> {
        if self.a_mais > 0 {
            self.lista.push(format!("E mais {} avisos.", self.a_mais));
        }
        self.lista
    }
}

#[derive(Default)]
struct Leitura {
    arquivos: Vec<ArquivoLocal>,
    avisos: Avisos,
}

fn agora_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |desde| u64::try_from(desde.as_millis()).unwrap_or(u64::MAX))
}

fn como_u64(valor: usize) -> u64 {
    u64::try_from(valor).unwrap_or(u64::MAX)
}

/// Disco é chamada bloqueante: sai do worker async.
async fn em_segundo_plano<T, F>(fazer: F) -> Result<T, ErroPreludio>
where
    T: Send + 'static,
    F: FnOnce() -> T + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(fazer)
        .await
        .map_err(|_| erro_interrompido())
}

/// Um caminho de preparo/ (já conferido por `plano::caminho_seguro`) no disco.
fn no_disco(raiz: &Path, caminho: &str) -> PathBuf {
    caminho.split('/').fold(raiz.to_path_buf(), |pasta, parte| pasta.join(parte))
}

fn hash_do_arquivo(caminho: &Path) -> std::io::Result<String> {
    let mut arquivo = std::fs::File::open(caminho)?;
    let mut hasher = Sha256::new();
    let mut pedaco = vec![0_u8; PEDACO_DE_LEITURA];
    loop {
        let lidos = arquivo.read(&mut pedaco)?;
        let Some(parte) = pedaco.get(..lidos).filter(|parte| !parte.is_empty()) else {
            break;
        };
        hasher.update(parte);
    }
    Ok(plano::hex(&hasher.finalize()))
}

// ---------------------------------------------------------------------------
// Leitura de preparo/
// ---------------------------------------------------------------------------

/// Lê preparo/ inteira: caminho, hash e tamanho de cada arquivo, em ordem de caminho.
/// Atalhos, nomes que não voltariam inteiros e arquivos acima do teto ficam de fora
/// com aviso; arquivos de serviço (`.anterior`, `.tmp`), em silêncio.
fn ler_preparo(raiz: &Path) -> Result<Leitura, ErroPreludio> {
    let mut leitura = Leitura::default();
    if !raiz.is_dir() {
        return Ok(leitura);
    }
    let mut pendentes: Vec<(PathBuf, String, usize)> = vec![(raiz.to_path_buf(), String::new(), 1)];
    while let Some((pasta, prefixo, fundura)) = pendentes.pop() {
        let rotulo = if prefixo.is_empty() { PASTA_DO_PREPARO.to_owned() } else { format!("{PASTA_DO_PREPARO}/{prefixo}") };
        let entradas = std::fs::read_dir(&pasta).map_err(|_| erro_disco(format!("Não deu para ler a pasta {rotulo}.")))?;
        for entrada in entradas {
            let Ok(entrada) = entrada else {
                leitura.avisos.anotar(format!("Um item de {rotulo} não deu para ler e ficou de fora."));
                continue;
            };
            let Some(nome) = entrada.file_name().to_str().map(str::to_owned) else {
                leitura.avisos.anotar(format!("Um nome em {rotulo} não é texto válido e ficou de fora."));
                continue;
            };
            let caminho = if prefixo.is_empty() { nome.clone() } else { format!("{prefixo}/{nome}") };
            let Ok(tipo) = entrada.file_type() else {
                leitura.avisos.anotar(format!("{PASTA_DO_PREPARO}/{caminho} não deu para ler e ficou de fora."));
                continue;
            };
            if tipo.is_symlink() {
                leitura.avisos.anotar(format!("{PASTA_DO_PREPARO}/{caminho} é um atalho e ficou de fora."));
                continue;
            }
            if tipo.is_dir() {
                if fundura < plano::FUNDURA_MAX && plano::segmento_seguro(&nome) {
                    pendentes.push((entrada.path(), caminho, fundura + 1));
                } else {
                    leitura.avisos.anotar(format!("A pasta {PASTA_DO_PREPARO}/{caminho} ficou de fora (nome ou fundura)."));
                }
                continue;
            }
            if !tipo.is_file() || plano::fica_de_fora(&nome) {
                continue;
            }
            if let Some(arquivo) = ler_um(&entrada, caminho, &mut leitura.avisos) {
                if leitura.arquivos.len() >= plano::ARQUIVOS_MAX {
                    return Err(erro_disco(format!(
                        "O Prelúdio passa de {} arquivos; a cópia não leva tanto.",
                        plano::ARQUIVOS_MAX
                    )));
                }
                leitura.arquivos.push(arquivo);
            }
        }
    }
    leitura.arquivos.sort_by(|a, b| a.caminho.cmp(&b.caminho));
    Ok(leitura)
}

/// Um arquivo de preparo/, ou `None` (com aviso) quando ele fica de fora.
fn ler_um(entrada: &std::fs::DirEntry, caminho: String, avisos: &mut Avisos) -> Option<ArquivoLocal> {
    if !plano::caminho_seguro(&caminho) {
        avisos.anotar(format!("{PASTA_DO_PREPARO}/{caminho} tem um nome que não voltaria inteiro e ficou de fora."));
        return None;
    }
    let Ok(tamanho) = entrada.metadata().map(|info| info.len()) else {
        avisos.anotar(format!("{PASTA_DO_PREPARO}/{caminho} não deu para ler e ficou de fora."));
        return None;
    };
    if tamanho > plano::TAMANHO_MAX {
        avisos.anotar(format!("{PASTA_DO_PREPARO}/{caminho} passa de 200 MiB e ficou de fora."));
        return None;
    }
    let (sha256, pelo_nome) = match plano::hash_do_nome_de_midia(&caminho) {
        Some(hash) => (hash.to_owned(), true),
        None => match hash_do_arquivo(&entrada.path()) {
            Ok(hash) => (hash, false),
            Err(_) => {
                avisos.anotar(format!("{PASTA_DO_PREPARO}/{caminho} não deu para ler e ficou de fora."));
                return None;
            }
        },
    };
    Some(ArquivoLocal { caminho, sha256, tamanho, pelo_nome })
}

// ---------------------------------------------------------------------------
// Copiar
// ---------------------------------------------------------------------------

/// O resultado das rodadas de envio.
#[derive(Default)]
struct Envio {
    objetos: u64,
    bytes: u64,
}

/// Sobe o que falta, em até [`RODADAS_MAX`] rodadas. No fim, todo arquivo que sobra em
/// `arquivos` tem o objeto no Drive: o que não deu para ler ou não parou de mudar sai
/// da lista com aviso (fica para a próxima cópia).
async fn enviar_o_que_falta(
    raiz: &Path,
    drive: &Drive<'_>,
    pastas: &Pastas,
    arquivos: &mut Vec<ArquivoLocal>,
    no_drive: &mut HashSet<String>,
    avisos: &mut Avisos,
    avisar: &(dyn Fn(Progresso) + Sync),
) -> Result<Envio, ErroPreludio> {
    let mut envio = Envio::default();
    for _ in 0..RODADAS_MAX {
        let faltam: Vec<String> = plano::a_enviar(arquivos, no_drive)
            .into_iter()
            .map(|arquivo| arquivo.caminho.clone())
            .collect();
        if faltam.is_empty() {
            return Ok(envio);
        }
        let indice: HashMap<String, usize> = arquivos
            .iter()
            .enumerate()
            .map(|(i, arquivo)| (arquivo.caminho.clone(), i))
            .collect();
        let mut fora: HashSet<String> = HashSet::new();
        for (feitos, caminho) in faltam.iter().enumerate() {
            avisar(Progresso::de("enviando", feitos, faltam.len()));
            let Some(arquivo) = indice.get(caminho).and_then(|&i| arquivos.get_mut(i)) else {
                continue;
            };
            let origem = no_disco(raiz, caminho);
            let Ok(conteudo) = em_segundo_plano(move || std::fs::read(origem)).await? else {
                avisos.anotar(format!("{PASTA_DO_PREPARO}/{caminho} não deu para ler e ficou fora desta cópia."));
                fora.insert(caminho.clone());
                continue;
            };
            let real = plano::hex(&Sha256::digest(&conteudo));
            if real != arquivo.sha256 && arquivo.pelo_nome {
                avisos.anotar(format!(
                    "{PASTA_DO_PREPARO}/{caminho} não confere com o nome (arquivo danificado?); foi copiado como está."
                ));
            }
            // A cópia leva o que estava no disco na hora de subir.
            arquivo.sha256.clone_from(&real);
            arquivo.tamanho = como_u64(conteudo.len());
            arquivo.pelo_nome = false;
            if no_drive.contains(&real) {
                continue;
            }
            let tamanho = arquivo.tamanho;
            drive.enviar_objeto(pastas, &real, conteudo).await?;
            no_drive.insert(real);
            envio.objetos += 1;
            envio.bytes = envio.bytes.saturating_add(tamanho);
        }
        arquivos.retain(|arquivo| !fora.contains(&arquivo.caminho));
    }
    // Ainda falta objeto: um arquivo que não parou de mudar. Fora desta cópia.
    let teimosos: HashSet<String> = plano::a_enviar(arquivos, no_drive)
        .into_iter()
        .map(|arquivo| arquivo.caminho.clone())
        .collect();
    for caminho in &teimosos {
        avisos.anotar(format!("{PASTA_DO_PREPARO}/{caminho} mudou durante a cópia e fica para a próxima."));
    }
    arquivos.retain(|arquivo| no_drive.contains(&arquivo.sha256));
    Ok(envio)
}

/// Copia preparo/ para o Drive: sobe o que falta e, se o conteúdo mudou desde a última
/// cópia, um manifesto novo com a data de agora.
pub async fn fazer(dados: &Path, drive: &Drive<'_>, avisar: &(dyn Fn(Progresso) + Sync)) -> Result<ResumoDaCopia, ErroPreludio> {
    avisar(Progresso::de("lendo", 0, 0));
    let raiz = dados.join(PASTA_DO_PREPARO);
    let leitura = {
        let raiz = raiz.clone();
        em_segundo_plano(move || ler_preparo(&raiz)).await??
    };
    let Leitura { mut arquivos, mut avisos } = leitura;
    if arquivos.is_empty() {
        return Err(ErroPreludio::novo("vazio", "O Prelúdio ainda não tem nada para copiar."));
    }

    avisar(Progresso::de("conferindo", 0, 0));
    let pastas = drive.garantir_pastas().await?;
    let objetos = drive.objetos(&pastas).await?;
    let mut no_drive: HashSet<String> = objetos.keys().cloned().collect();
    let envio = enviar_o_que_falta(&raiz, drive, &pastas, &mut arquivos, &mut no_drive, &mut avisos, avisar).await?;
    if arquivos.is_empty() {
        return Err(ErroPreludio::novo("vazio", "Nenhum arquivo do Prelúdio deu para copiar. Veja os avisos e tente de novo."));
    }
    // A mídia que nem foi lida leva o tamanho do objeto do Drive: o par hash e tamanho do
    // manifesto descreve sempre o objeto, e um arquivo estragado no PC não estraga a cópia.
    for arquivo in arquivos.iter_mut().filter(|arquivo| arquivo.pelo_nome) {
        if let Some(tamanho) = objetos.get(&arquivo.sha256).and_then(|objeto| objeto.tamanho) {
            arquivo.tamanho = tamanho;
        }
    }

    let quando = agora_ms();
    let manifesto: Manifesto = plano::manifesto(&arquivos, quando, APP);
    let assinatura = plano::assinatura(&manifesto.arquivos);
    let total = manifesto.arquivos.iter().fold(0_u64, |soma, entrada| soma.saturating_add(entrada.tamanho));
    let quantos = como_u64(manifesto.arquivos.len());
    let anterior = drive.copias(&pastas).await?.into_iter().next();
    let nada_mudou = anterior.as_ref().is_some_and(|copia| copia.assinatura == assinatura);
    let nome = match anterior {
        Some(copia) if nada_mudou => copia.nome,
        _ => {
            let nome = plano::nome_da_copia(quando);
            let texto = serde_json::to_vec(&manifesto)
                .map_err(|_| ErroPreludio::novo("disco", "Não deu para montar a lista da cópia."))?;
            let resumo = ResumoNoDrive { quando, arquivos: quantos, bytes: total, assinatura: &assinatura };
            drive.enviar_copia(&pastas, &nome, texto, &resumo).await?;
            nome
        }
    };
    let ultima = UltimaCopia {
        quando,
        nome,
        arquivos: quantos,
        bytes: total,
        enviados: envio.objetos,
        nada_mudou,
    };
    gravar_ultima(dados, &ultima).await;
    Ok(ResumoDaCopia {
        ultima,
        bytes_enviados: envio.bytes,
        avisos: avisos.fechar(),
    })
}

/// A última cópia feita neste PC, ou `None` (nunca houve, ou o arquivo não serve).
pub async fn ler_ultima(dados: &Path) -> Option<UltimaCopia> {
    let texto = tokio::fs::read(dados.join(PASTA_DA_COPIA).join(ARQUIVO_DA_ULTIMA)).await.ok()?;
    serde_json::from_slice(&texto).ok()
}

/// Melhor esforço: sem este arquivo a tela só não mostra a data sem internet.
async fn gravar_ultima(dados: &Path, ultima: &UltimaCopia) {
    let pasta = dados.join(PASTA_DA_COPIA);
    let Ok(texto) = serde_json::to_vec_pretty(ultima) else {
        return;
    };
    if tokio::fs::create_dir_all(&pasta).await.is_err() {
        return;
    }
    let temporario = pasta.join(format!("{ARQUIVO_DA_ULTIMA}.tmp"));
    if tokio::fs::write(&temporario, texto).await.is_ok() {
        let _ = tokio::fs::rename(&temporario, pasta.join(ARQUIVO_DA_ULTIMA)).await;
    }
}

/// As cópias no Drive (vazio se esta conta nunca copiou).
pub async fn listar(drive: &Drive<'_>) -> Result<Vec<CopiaNoDrive>, ErroPreludio> {
    match drive.pastas_existentes().await? {
        Some(pastas) => drive.copias(&pastas).await,
        None => Ok(Vec::new()),
    }
}

// ---------------------------------------------------------------------------
// Restaurar
// ---------------------------------------------------------------------------

fn criar_mae(destino: &Path) -> Result<(), ErroPreludio> {
    match destino.parent() {
        Some(mae) => std::fs::create_dir_all(mae)
            .map_err(|_| erro_disco("Não deu para criar uma pasta na restauração (disco cheio?).")),
        None => Ok(()),
    }
}

/// Põe em `destino` o arquivo do PC que tem este conteúdo: ligação (hard link) para a
/// mídia, que nunca é regravada no lugar, e cópia para o resto. Confere o hash DEPOIS de
/// pôr: `false` = o do PC não confere (mudou ou estragou) e o conteúdo vem do Drive.
fn trazer_do_pc(origem: &Path, destino: &Path, hash: &str, ligar: bool) -> Result<bool, ErroPreludio> {
    criar_mae(destino)?;
    let posto = (ligar && std::fs::hard_link(origem, destino).is_ok()) || std::fs::copy(origem, destino).is_ok();
    if !posto {
        return Ok(false);
    }
    if hash_do_arquivo(destino).is_ok_and(|real| real == hash) {
        return Ok(true);
    }
    // Apagar a ligação ou a cópia que não confere não toca no arquivo do PC.
    std::fs::remove_file(destino).map_err(|_| erro_disco("Não deu para limpar um arquivo da restauração."))?;
    Ok(false)
}

/// Monta o conteúdo do manifesto em `pasta`. Devolve (baixados do Drive, trazidos do PC).
async fn montar(
    drive: &Drive<'_>,
    manifesto: &Manifesto,
    objetos: &HashMap<String, ObjetoNoDrive>,
    no_pc: &HashMap<String, PathBuf>,
    pasta: &Path,
    avisar: &(dyn Fn(Progresso) + Sync),
) -> Result<(u64, u64), ErroPreludio> {
    let (mut baixados, mut do_pc) = (0_u64, 0_u64);
    let total = manifesto.arquivos.len();
    for (feitos, entrada) in manifesto.arquivos.iter().enumerate() {
        avisar(Progresso::de("baixando", feitos, total));
        let destino = no_disco(pasta, &entrada.caminho);
        if let Some(origem) = no_pc.get(&entrada.sha256) {
            let (origem, para, hash) = (origem.clone(), destino.clone(), entrada.sha256.clone());
            let ligar = plano::hash_do_nome_de_midia(&entrada.caminho).is_some();
            if em_segundo_plano(move || trazer_do_pc(&origem, &para, &hash, ligar)).await?? {
                do_pc += 1;
                continue;
            }
        }
        let objeto = objetos.get(&entrada.sha256).ok_or_else(|| {
            ErroPreludio::novo("copia_incompleta", "Um arquivo dessa cópia sumiu do Google Drive no meio. Nada foi mexido.")
        })?;
        let teto = usize::try_from(entrada.tamanho).unwrap_or(usize::MAX);
        let conteudo = drive.baixar(&objeto.id, teto).await?;
        if como_u64(conteudo.len()) != entrada.tamanho || plano::hex(&Sha256::digest(&conteudo)) != entrada.sha256 {
            return Err(ErroPreludio::novo(
                "copia_invalida",
                format!("{PASTA_DO_PREPARO}/{} veio diferente do Google Drive. Nada foi mexido.", entrada.caminho),
            ));
        }
        em_segundo_plano(move || {
            criar_mae(&destino)?;
            std::fs::write(&destino, conteudo)
                .map_err(|_| erro_disco("Não deu para gravar um arquivo da restauração (disco cheio?)."))
        })
        .await??;
        baixados += 1;
    }
    Ok((baixados, do_pc))
}

fn renomear(de: &Path, para: &Path) -> std::io::Result<()> {
    let mut resultado = std::fs::rename(de, para);
    for espera in ESPERAS_DA_TROCA_MS {
        if resultado.is_ok() {
            break;
        }
        std::thread::sleep(Duration::from_millis(espera));
        resultado = std::fs::rename(de, para);
    }
    resultado
}

/// Troca preparo/ pela pasta montada. O Prelúdio de antes vai para
/// `preludio-copia/antes-de-restaurar/<carimbo>/preparo`. Devolve esse lugar (relativo
/// à pasta de dados), ou `None` quando não havia Prelúdio antes.
fn trocar(dados: &Path, montada: &Path, carimbo: &str) -> Result<Option<String>, ErroPreludio> {
    let atual = dados.join(PASTA_DO_PREPARO);
    let guardado = if atual.exists() {
        let mae = dados.join(PASTA_DA_COPIA).join(PASTA_ANTES_DE_RESTAURAR).join(carimbo);
        std::fs::create_dir_all(&mae)
            .map_err(|_| erro_disco("Não deu para criar a pasta que guarda o Prelúdio de antes. Nada foi trocado."))?;
        let alvo = mae.join(PASTA_DO_PREPARO);
        renomear(&atual, &alvo).map_err(|_| {
            erro_disco("Não deu para pôr de lado o Prelúdio atual (algum arquivo dele está aberto?). Nada foi trocado.")
        })?;
        Some(alvo)
    } else {
        None
    };
    if renomear(montada, &atual).is_err() {
        let voltou = guardado.as_ref().is_none_or(|alvo| renomear(alvo, &atual).is_ok());
        return Err(erro_disco(if voltou {
            "Não deu para pôr a cópia no lugar; o Prelúdio continua como estava."
        } else {
            "Não deu para pôr a cópia no lugar, e o Prelúdio de antes ficou em preludio-copia/antes-de-restaurar."
        }));
    }
    Ok(guardado.map(|_| format!("{PASTA_DA_COPIA}/{PASTA_ANTES_DE_RESTAURAR}/{carimbo}/{PASTA_DO_PREPARO}")))
}

/// Restaura a cópia `copia_id` (uma da lista do Drive) em `<appData>/preparo/`.
pub async fn restaurar(
    dados: &Path,
    drive: &Drive<'_>,
    copia_id: &str,
    avisar: &(dyn Fn(Progresso) + Sync),
) -> Result<ResumoDaRestauracao, ErroPreludio> {
    if !drive::id_valido(copia_id) {
        return Err(ErroPreludio::novo("pedido_invalido", "O id da cópia não tem a forma esperada."));
    }
    avisar(Progresso::de("conferindo", 0, 0));
    let sumiu = || ErroPreludio::novo("copia_invalida", "Essa cópia não está mais no Google Drive. Atualize a lista.");
    let pastas = drive.pastas_existentes().await?.ok_or_else(sumiu)?;
    // Só uma cópia que está na pasta das cópias: a webview não aponta outro arquivo do Drive.
    let copia = drive
        .copias(&pastas)
        .await?
        .into_iter()
        .find(|copia| copia.id == copia_id)
        .ok_or_else(sumiu)?;
    let bruto = drive.baixar(&copia.id, MANIFESTO_MAX).await?;
    let manifesto = plano::ler_manifesto(&bruto).map_err(|motivo| {
        ErroPreludio::novo("copia_invalida", format!("A cópia {} não pode ser restaurada: {motivo}.", copia.nome))
    })?;
    let objetos = drive.objetos(&pastas).await?;
    let faltam = manifesto.arquivos.iter().filter(|entrada| !objetos.contains_key(&entrada.sha256)).count();
    if faltam > 0 {
        return Err(ErroPreludio::novo(
            "copia_incompleta",
            format!("Faltam {faltam} arquivos dessa cópia no Google Drive; ela não volta inteira. Nada foi mexido."),
        ));
    }

    // O que já está no PC não vem da rede (a mídia, quase sempre).
    let raiz = dados.join(PASTA_DO_PREPARO);
    let no_pc: HashMap<String, PathBuf> = {
        let raiz_lida = raiz.clone();
        let leitura = em_segundo_plano(move || ler_preparo(&raiz_lida)).await??;
        let mut mapa = HashMap::with_capacity(leitura.arquivos.len());
        for arquivo in leitura.arquivos {
            let caminho = no_disco(&raiz, &arquivo.caminho);
            mapa.entry(arquivo.sha256).or_insert(caminho);
        }
        mapa
    };

    let montada = dados.join(PASTA_DA_COPIA).join(PASTA_RESTAURANDO);
    {
        // Sobra de uma restauração que caiu no meio: a pasta é só da cópia.
        let montada = montada.clone();
        em_segundo_plano(move || {
            if montada.exists() {
                std::fs::remove_dir_all(&montada)
                    .map_err(|_| erro_disco("Não deu para limpar a restauração anterior que ficou pela metade."))?;
            }
            std::fs::create_dir_all(&montada).map_err(|_| erro_disco("Não deu para criar a pasta da restauração."))
        })
        .await??;
    }
    let (baixados, do_disco) = match montar(drive, &manifesto, &objetos, &no_pc, &montada, avisar).await {
        Ok(contas) => contas,
        Err(erro) => {
            let _ = tokio::fs::remove_dir_all(&montada).await;
            return Err(erro);
        }
    };

    avisar(Progresso::de("trocando", 0, 0));
    let carimbo = plano::carimbo(agora_ms());
    let dados_da_troca = dados.to_path_buf();
    let guardado_em = em_segundo_plano(move || trocar(&dados_da_troca, &montada, &carimbo)).await??;
    Ok(ResumoDaRestauracao {
        nome: copia.nome,
        arquivos: como_u64(manifesto.arquivos.len()),
        baixados,
        do_disco,
        guardado_em,
    })
}
