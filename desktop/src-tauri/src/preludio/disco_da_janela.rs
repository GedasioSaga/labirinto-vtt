//! O DISCO DA JANELA DO PRELÚDIO (`crate::janela_preludio`).
//!
//! A janela do Prelúdio não recebe o plugin `fs`: o escopo `$APPDATA/**` da
//! `main` é global no Tauri 2 (vale para toda janela que tenha um comando do
//! plugin), e as pastas que a `main` libera em tempo de execução
//! (`grant_fs_access`) também. Com o plugin, a janela gravaria em `maps/` e em
//! qualquer pasta que o mestre já escolheu num diálogo. Aqui, cada verbo resolve
//! o caminho sozinho e recusa o que sair do lugar dele:
//! - LER: `<appData>/preparo/`, `<appData>/maps/` e `<appData>/pastas/` (o
//!   catálogo da mesa: mapas, cenas, pinos e as pastas/campanhas dos mapas);
//! - GRAVAR, CRIAR PASTA, APAGAR e RENOMEAR: só `<appData>/preparo/`.
//!
//! Todo comando daqui recusa janela que não seja a do Prelúdio: a `main` usa o
//! plugin `fs` com a capability dela, como sempre.
//!
//! CONTRATO COM O TYPESCRIPT (`client/src/lib/fsDaJanela.ts`). Caminho absoluto,
//! como o `appDataDir()` + `join` do front monta. Erro: `{codigo, mensagem}`.
//!
//! | comando | argumentos | devolve |
//! |---|---|---|
//! | `preludio_disco_existe` | `caminho` | `bool` |
//! | `preludio_disco_ler` | `caminho` | os bytes do arquivo (resposta crua) |
//! | `preludio_disco_listar` | `caminho` | `[{name, isDirectory, isFile, isSymlink}]` |
//! | `preludio_disco_info` | `caminho` | `{isFile, isDirectory, isSymlink, size, mtime}` (`mtime` em ms ou `null`) |
//! | `preludio_disco_gravar_texto` | `caminho`, `texto` | `null` |
//! | `preludio_disco_gravar_bytes` | corpo cru; cabeçalho `caminho` em hex (UTF-8) | `null` |
//! | `preludio_disco_criar_pasta` | `caminho` | `null` (cria as de cima também) |
//! | `preludio_disco_apagar` | `caminho` | `null` (arquivo, ou pasta VAZIA) |
//! | `preludio_disco_renomear` | `de`, `para` | `null` (troca o destino, se existir) |
//! | `preludio_exportar_imagem` | corpo cru; cabeçalhos `formato` (`png`/`svg`) e `nome` em hex | onde gravou, ou `null` se o mestre cancelou |
//!
//! O `preludio_exportar_imagem` é o "Exportar" do quadro: o mestre escolhe o
//! destino na janela de salvar do sistema, aberta AQUI. O front nunca diz o
//! caminho; ele só manda os bytes e a sugestão de nome.

use std::ffi::OsStr;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager as _, WebviewWindow};
use tauri_plugin_dialog::DialogExt as _;

use super::{erro_disco, erro_interrompido, ErroPreludio};
use crate::janela_preludio::ROTULO as ROTULO_DA_JANELA;

/// O que o comando faz com o caminho: decide as pastas aceitas.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Acesso {
    Ler,
    Gravar,
}

const RAIZES_DE_LEITURA: &[&str] = &["preparo", "maps", "pastas"];
const RAIZES_DE_GRAVACAO: &[&str] = &["preparo"];

/// Teto de uma gravação (texto ou bytes). A maior coisa do Prelúdio é a foto
/// de um quadro grande com imagem embutida; isto é folga, não meta.
const BYTES_MAX: usize = 256 * 1024 * 1024;
/// Teto do nome sugerido na exportação, em caracteres.
const NOME_SUGERIDO_MAX: usize = 120;
/// Caracteres que o Windows não aceita num nome (os de controle são vistos à parte).
const PROIBIDOS_NO_NOME: &[char] = &['<', '>', ':', '"', '/', '\\', '|', '?', '*'];

const RECUSA: &str = "A janela do Prelúdio só grava em preparo/ e só lê o preparo e o catálogo dos mapas.";

fn recusa() -> ErroPreludio {
    ErroPreludio::novo("caminho", RECUSA)
}

fn pedido_invalido(motivo: &str) -> ErroPreludio {
    ErroPreludio::novo("pedido_invalido", motivo)
}

fn erro_de_io(acao: &str, erro: &std::io::Error) -> ErroPreludio {
    erro_disco(format!("Não deu para {acao}: {erro}"))
}

/// `CON`, `NUL`, `COM1`… viram dispositivo no Windows, até com extensão
/// (`nul.json`): nome assim nunca é arquivo do Prelúdio.
fn nome_de_dispositivo(nome: &str) -> bool {
    let tronco = nome.split('.').next().unwrap_or(nome).trim_end_matches(' ');
    let maiusculo = tronco.to_ascii_uppercase();
    if matches!(maiusculo.as_str(), "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$") {
        return true;
    }
    let mut letras = maiusculo.chars();
    let prefixo: String = letras.by_ref().take(3).collect();
    let resto: Vec<char> = letras.collect();
    (prefixo == "COM" || prefixo == "LPT")
        && resto.len() == 1
        && resto
            .first()
            .is_some_and(|c| c.is_ascii_digit() || matches!(c, '¹' | '²' | '³'))
}

/// Um pedaço do caminho que o Prelúdio poderia ter criado: texto, sem `:`
/// (fluxo alternativo do NTFS), sem caractere proibido, sem ponto ou espaço no
/// fim (o Windows corta e dois nomes viram o mesmo) e sem nome de dispositivo.
fn nome_valido(nome: &OsStr) -> bool {
    let Some(nome) = nome.to_str() else {
        return false;
    };
    !nome.is_empty()
        && !nome.ends_with('.')
        && !nome.ends_with(' ')
        && !nome
            .chars()
            .any(|c| c.is_control() || PROIBIDOS_NO_NOME.contains(&c))
        && !nome_de_dispositivo(nome)
}

/// O coração da guarda, sem Tauri (os testes chamam direto). `pedido` precisa
/// começar EXATAMENTE pela pasta de dados do app; depois dela, só pedaços
/// normais (nada de `..`, raiz ou prefixo), e o primeiro é uma das raízes do
/// `acesso`. O caminho devolvido é remontado pedaço a pedaço sobre `base`.
fn caminho_no_app(base: &Path, pedido: &str, acesso: Acesso) -> Result<PathBuf, ErroPreludio> {
    let resto = Path::new(pedido).strip_prefix(base).map_err(|_| recusa())?;
    let raizes = match acesso {
        Acesso::Ler => RAIZES_DE_LEITURA,
        Acesso::Gravar => RAIZES_DE_GRAVACAO,
    };
    let mut partes = resto.components();
    let mut caminho = base.to_path_buf();
    match partes.next() {
        Some(Component::Normal(raiz)) if raizes.iter().any(|r| raiz == OsStr::new(r)) => {
            caminho.push(raiz);
        }
        _ => return Err(recusa()),
    }
    for parte in partes {
        match parte {
            Component::Normal(nome) if nome_valido(nome) => caminho.push(nome),
            _ => return Err(recusa()),
        }
    }
    Ok(caminho)
}

fn exigir_janela(window: &WebviewWindow) -> Result<(), ErroPreludio> {
    if window.label() == ROTULO_DA_JANELA {
        Ok(())
    } else {
        Err(ErroPreludio::novo(
            "janela",
            "Este comando é só da janela do Prelúdio.",
        ))
    }
}

fn resolver(
    app: &AppHandle,
    window: &WebviewWindow,
    caminho: &str,
    acesso: Acesso,
) -> Result<PathBuf, ErroPreludio> {
    exigir_janela(window)?;
    let base = app
        .path()
        .app_data_dir()
        .map_err(|_| erro_disco("Não deu para achar a pasta de dados do app."))?;
    caminho_no_app(&base, caminho, acesso)
}

fn de_hex(texto: &str) -> Option<Vec<u8>> {
    if !texto.len().is_multiple_of(2) {
        return None;
    }
    texto
        .as_bytes()
        .chunks(2)
        .map(|par| {
            let alto = char::from(par[0]).to_digit(16)?;
            let baixo = char::from(par[1]).to_digit(16)?;
            u8::try_from(alto * 16 + baixo).ok()
        })
        .collect()
}

/// Cabeçalho em hex de UTF-8: o caminho tem acento (nome de usuário do Windows)
/// e cabeçalho HTTP só leva ASCII.
fn cabecalho_em_hex(request: &Request<'_>, nome: &str) -> Result<String, ErroPreludio> {
    let valor = request
        .headers()
        .get(nome)
        .and_then(|valor| valor.to_str().ok())
        .ok_or_else(|| pedido_invalido("Faltou um cabeçalho do pedido."))?;
    let bytes = de_hex(valor).ok_or_else(|| pedido_invalido("Cabeçalho torto."))?;
    String::from_utf8(bytes).map_err(|_| pedido_invalido("Cabeçalho torto."))
}

fn corpo_cru<'a>(request: &'a Request<'_>) -> Result<&'a [u8], ErroPreludio> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(pedido_invalido("O pedido não trouxe os bytes."));
    };
    if bytes.len() > BYTES_MAX {
        return Err(pedido_invalido("Arquivo grande demais para gravar."));
    }
    Ok(bytes.as_slice())
}

/// Uma linha de `readDir`, no formato do `DirEntry` do plugin `fs`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntradaDaPasta {
    name: String,
    is_directory: bool,
    is_file: bool,
    is_symlink: bool,
}

/// O pedaço do `FileInfo` do plugin `fs` que o front usa.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InfoDoArquivo {
    is_file: bool,
    is_directory: bool,
    is_symlink: bool,
    size: u64,
    /// Milissegundos desde a época; `None` quando o sistema não diz.
    mtime: Option<u64>,
}

#[tauri::command]
pub async fn preludio_disco_existe(
    app: AppHandle,
    window: WebviewWindow,
    caminho: String,
) -> Result<bool, ErroPreludio> {
    let caminho = resolver(&app, &window, &caminho, Acesso::Ler)?;
    tokio::fs::try_exists(&caminho)
        .await
        .map_err(|e| erro_de_io("conferir o arquivo", &e))
}

/// Resposta crua, como o `readTextFile` do plugin: o front decodifica o UTF-8.
#[tauri::command]
pub async fn preludio_disco_ler(
    app: AppHandle,
    window: WebviewWindow,
    caminho: String,
) -> Result<Response, ErroPreludio> {
    let caminho = resolver(&app, &window, &caminho, Acesso::Ler)?;
    let bytes = tokio::fs::read(&caminho)
        .await
        .map_err(|e| erro_de_io("ler o arquivo", &e))?;
    Ok(Response::new(bytes))
}

#[tauri::command]
pub async fn preludio_disco_listar(
    app: AppHandle,
    window: WebviewWindow,
    caminho: String,
) -> Result<Vec<EntradaDaPasta>, ErroPreludio> {
    let caminho = resolver(&app, &window, &caminho, Acesso::Ler)?;
    let mut leitor = tokio::fs::read_dir(&caminho)
        .await
        .map_err(|e| erro_de_io("ler a pasta", &e))?;
    let mut entradas = Vec::new();
    while let Some(entrada) = leitor
        .next_entry()
        .await
        .map_err(|e| erro_de_io("ler a pasta", &e))?
    {
        let tipo = entrada
            .file_type()
            .await
            .map_err(|e| erro_de_io("ler a pasta", &e))?;
        entradas.push(EntradaDaPasta {
            name: entrada.file_name().to_string_lossy().into_owned(),
            is_directory: tipo.is_dir(),
            is_file: tipo.is_file(),
            is_symlink: tipo.is_symlink(),
        });
    }
    Ok(entradas)
}

#[tauri::command]
pub async fn preludio_disco_info(
    app: AppHandle,
    window: WebviewWindow,
    caminho: String,
) -> Result<InfoDoArquivo, ErroPreludio> {
    let caminho = resolver(&app, &window, &caminho, Acesso::Ler)?;
    let meta = tokio::fs::metadata(&caminho)
        .await
        .map_err(|e| erro_de_io("ler o arquivo", &e))?;
    let is_symlink = tokio::fs::symlink_metadata(&caminho)
        .await
        .is_ok_and(|m| m.file_type().is_symlink());
    let mtime = meta
        .modified()
        .ok()
        .and_then(|quando| quando.duration_since(UNIX_EPOCH).ok())
        .and_then(|desde| u64::try_from(desde.as_millis()).ok());
    Ok(InfoDoArquivo {
        is_file: meta.is_file(),
        is_directory: meta.is_dir(),
        is_symlink,
        size: meta.len(),
        mtime,
    })
}

#[tauri::command]
pub async fn preludio_disco_gravar_texto(
    app: AppHandle,
    window: WebviewWindow,
    caminho: String,
    texto: String,
) -> Result<(), ErroPreludio> {
    let caminho = resolver(&app, &window, &caminho, Acesso::Gravar)?;
    if texto.len() > BYTES_MAX {
        return Err(pedido_invalido("Texto grande demais para gravar."));
    }
    tokio::fs::write(&caminho, texto)
        .await
        .map_err(|e| erro_de_io("gravar o arquivo", &e))
}

#[tauri::command]
pub async fn preludio_disco_gravar_bytes(
    app: AppHandle,
    window: WebviewWindow,
    request: Request<'_>,
) -> Result<(), ErroPreludio> {
    let pedido = cabecalho_em_hex(&request, "caminho")?;
    let caminho = resolver(&app, &window, &pedido, Acesso::Gravar)?;
    let bytes = corpo_cru(&request)?;
    tokio::fs::write(&caminho, bytes)
        .await
        .map_err(|e| erro_de_io("gravar o arquivo", &e))
}

#[tauri::command]
pub async fn preludio_disco_criar_pasta(
    app: AppHandle,
    window: WebviewWindow,
    caminho: String,
) -> Result<(), ErroPreludio> {
    let caminho = resolver(&app, &window, &caminho, Acesso::Gravar)?;
    tokio::fs::create_dir_all(&caminho)
        .await
        .map_err(|e| erro_de_io("criar a pasta", &e))
}

/// Arquivo, ou pasta vazia. Nunca apaga uma pasta com conteúdo.
#[tauri::command]
pub async fn preludio_disco_apagar(
    app: AppHandle,
    window: WebviewWindow,
    caminho: String,
) -> Result<(), ErroPreludio> {
    let caminho = resolver(&app, &window, &caminho, Acesso::Gravar)?;
    let meta = tokio::fs::symlink_metadata(&caminho)
        .await
        .map_err(|e| erro_de_io("apagar", &e))?;
    let feito = if meta.is_dir() {
        tokio::fs::remove_dir(&caminho).await
    } else {
        tokio::fs::remove_file(&caminho).await
    };
    feito.map_err(|e| erro_de_io("apagar", &e))
}

#[tauri::command]
pub async fn preludio_disco_renomear(
    app: AppHandle,
    window: WebviewWindow,
    de: String,
    para: String,
) -> Result<(), ErroPreludio> {
    let de = resolver(&app, &window, &de, Acesso::Gravar)?;
    let para = resolver(&app, &window, &para, Acesso::Gravar)?;
    tokio::fs::rename(&de, &para)
        .await
        .map_err(|e| erro_de_io("renomear o arquivo", &e))
}

/// O nome sugerido na janela de salvar: sem o que o Windows recusa, curto,
/// nunca vazio, sempre com a extensão do formato.
fn nome_sugerido(bruto: &str, extensao: &str) -> String {
    let limpo: String = bruto
        .chars()
        .map(|c| {
            if c.is_control() || PROIBIDOS_NO_NOME.contains(&c) {
                ' '
            } else {
                c
            }
        })
        .take(NOME_SUGERIDO_MAX)
        .collect();
    let limpo = limpo.split_whitespace().collect::<Vec<_>>().join(" ");
    let limpo = limpo.trim_end_matches(['.', ' ']);
    let tronco = if limpo.is_empty() { "Quadro" } else { limpo };
    let ponto_extensao = format!(".{extensao}");
    if tronco.to_lowercase().ends_with(&ponto_extensao) {
        tronco.to_owned()
    } else {
        format!("{tronco}{ponto_extensao}")
    }
}

/// O caminho escolhido no diálogo, com a extensão do formato no fim.
fn com_extensao(escolhido: PathBuf, extensao: &str) -> PathBuf {
    let tem = escolhido
        .extension()
        .and_then(OsStr::to_str)
        .is_some_and(|atual| atual.eq_ignore_ascii_case(extensao));
    if tem {
        return escolhido;
    }
    let mut texto = escolhido.into_os_string();
    texto.push(".");
    texto.push(extensao);
    PathBuf::from(texto)
}

#[tauri::command]
pub async fn preludio_exportar_imagem(
    app: AppHandle,
    window: WebviewWindow,
    request: Request<'_>,
) -> Result<Option<String>, ErroPreludio> {
    exigir_janela(&window)?;
    let formato = request
        .headers()
        .get("formato")
        .and_then(|valor| valor.to_str().ok())
        .unwrap_or_default();
    let (filtro, extensao) = match formato {
        "png" => ("Imagem PNG", "png"),
        "svg" => ("Imagem SVG", "svg"),
        _ => return Err(pedido_invalido("Formato de exportação desconhecido.")),
    };
    let sugerido = nome_sugerido(&cabecalho_em_hex(&request, "nome")?, extensao);
    let bytes = corpo_cru(&request)?;
    let (enviar, receber) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_parent(&window)
        .set_title(format!("Exportar {}", extensao.to_uppercase()))
        .set_file_name(sugerido)
        .add_filter(filtro, &[extensao])
        .save_file(move |escolhido| {
            let _ = enviar.send(escolhido);
        });
    let Some(escolhido) = receber.await.map_err(|_| erro_interrompido())? else {
        return Ok(None);
    };
    let caminho = escolhido
        .into_path()
        .map_err(|_| erro_disco("A janela de salvar devolveu um lugar que não é pasta do computador."))?;
    let caminho = com_extensao(caminho, extensao);
    tokio::fs::write(&caminho, bytes)
        .await
        .map_err(|e| erro_de_io("gravar a imagem", &e))?;
    Ok(Some(caminho.to_string_lossy().into_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> PathBuf {
        PathBuf::from(if cfg!(windows) {
            r"C:\Users\mestre\AppData\Roaming\com.labirinto.app"
        } else {
            "/home/mestre/.local/share/com.labirinto.app"
        })
    }

    fn dentro(resto: &str) -> String {
        format!("{}{}{resto}", base().display(), std::path::MAIN_SEPARATOR)
    }

    fn aceita(resto: &str, acesso: Acesso) -> bool {
        caminho_no_app(&base(), &dentro(resto), acesso).is_ok()
    }

    #[test]
    fn grava_e_le_dentro_do_preparo() {
        assert!(aceita("preparo", Acesso::Gravar));
        assert!(aceita("preparo/verbetes/3f2b9c1e.json", Acesso::Gravar));
        assert!(aceita("preparo/quadros/q1/quadro.json.tmp", Acesso::Gravar));
        assert!(aceita("preparo/revelado/c1.json.anterior", Acesso::Ler));
        assert_eq!(
            caminho_no_app(&base(), &dentro("preparo/./verbetes/a.json"), Acesso::Gravar).ok(),
            Some(base().join("preparo").join("verbetes").join("a.json"))
        );
    }

    #[test]
    fn mapas_e_pastas_so_para_ler() {
        assert!(aceita("maps", Acesso::Ler));
        assert!(aceita("maps/map_1/map.json", Acesso::Ler));
        assert!(aceita("pastas/indice.json", Acesso::Ler));
        assert!(!aceita("maps/map_1/map.json", Acesso::Gravar));
        assert!(!aceita("maps", Acesso::Gravar));
        assert!(!aceita("pastas/indice.json", Acesso::Gravar));
    }

    #[test]
    fn recusa_o_resto_da_pasta_do_app() {
        assert!(!aceita("ia/chaves.json", Acesso::Ler));
        assert!(!aceita("nuvem/estado.json", Acesso::Ler));
        assert!(!aceita("preparo-falso/a.json", Acesso::Gravar));
        assert!(!aceita("PREPARO/a.json", Acesso::Gravar));
        // A própria pasta do app, sem raiz nenhuma.
        assert!(caminho_no_app(&base(), &base().display().to_string(), Acesso::Ler).is_err());
    }

    #[test]
    fn recusa_fuga_por_ponto_ponto_e_caminho_de_fora() {
        assert!(!aceita("preparo/../maps/map_1/map.json", Acesso::Gravar));
        assert!(!aceita("preparo/verbetes/../../ia/x", Acesso::Ler));
        assert!(!aceita("../outro/preparo/a.json", Acesso::Gravar));
        assert!(caminho_no_app(&base(), "preparo/a.json", Acesso::Gravar).is_err());
        assert!(caminho_no_app(&base(), "", Acesso::Ler).is_err());
        let fora = if cfg!(windows) { r"C:\Windows\preparo\a.json" } else { "/etc/preparo/a.json" };
        assert!(caminho_no_app(&base(), fora, Acesso::Gravar).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn recusa_truques_do_windows() {
        // Fluxo alternativo do NTFS, nome de dispositivo, ponto e espaço no fim.
        assert!(!aceita("preparo/a.json:segredo", Acesso::Gravar));
        assert!(!aceita("preparo/NUL", Acesso::Gravar));
        assert!(!aceita("preparo/verbetes/con.json", Acesso::Gravar));
        assert!(!aceita("preparo/COM1.txt", Acesso::Gravar));
        assert!(!aceita("preparo/lpt9", Acesso::Ler));
        assert!(!aceita("preparo/a.json.", Acesso::Gravar));
        assert!(!aceita("preparo/a.json ", Acesso::Gravar));
        // Prefixo literal (\\?\) e outro disco não começam pela pasta do app.
        let literal = format!(r"\\?\{}", dentro("preparo/a.json"));
        assert!(caminho_no_app(&base(), &literal, Acesso::Gravar).is_err());
        assert!(caminho_no_app(&base(), r"D:\Users\mestre\AppData\Roaming\com.labirinto.app\preparo\a.json", Acesso::Gravar).is_err());
        // Barra normal também separa: o front às vezes monta com `/`.
        let misturado = format!("{}/preparo/verbetes/a.json", base().display());
        assert!(caminho_no_app(&base(), &misturado, Acesso::Gravar).is_ok());
    }

    #[test]
    fn nomes_comuns_passam() {
        for nome in ["consulta.json", "com10", "lpt", "nulo.txt", "a b.json", "Ação.json", ".anterior"] {
            assert!(nome_valido(OsStr::new(nome)), "{nome}");
        }
        for nome in ["", "a<b", "a|b", "a\u{7}b", "aux", "Aux.png", "COM²", "conin$"] {
            assert!(!nome_valido(OsStr::new(nome)), "{nome}");
        }
    }

    #[test]
    fn hex_ida_e_volta() {
        assert_eq!(de_hex("4361c3a7"), Some("Caç".as_bytes().to_vec()));
        assert_eq!(de_hex(""), Some(Vec::new()));
        assert_eq!(de_hex("4"), None);
        assert_eq!(de_hex("zz"), None);
    }

    #[test]
    fn nome_sugerido_limpo_e_com_extensao() {
        assert_eq!(nome_sugerido("Mapa mental: a vila", "png"), "Mapa mental a vila.png");
        assert_eq!(nome_sugerido("..", "svg"), "Quadro.svg");
        assert_eq!(nome_sugerido("Quadro.PNG", "png"), "Quadro.PNG");
        assert_eq!(nome_sugerido("a\\b/c", "png"), "a b c.png");
        assert_eq!(nome_sugerido(&"x".repeat(500), "png").chars().count(), NOME_SUGERIDO_MAX + 4);
    }

    #[test]
    fn extensao_entra_so_quando_falta() {
        assert_eq!(com_extensao(PathBuf::from("quadro"), "png"), PathBuf::from("quadro.png"));
        assert_eq!(com_extensao(PathBuf::from("quadro.PNG"), "png"), PathBuf::from("quadro.PNG"));
        assert_eq!(com_extensao(PathBuf::from("quadro.svg"), "png"), PathBuf::from("quadro.svg.png"));
    }
}
