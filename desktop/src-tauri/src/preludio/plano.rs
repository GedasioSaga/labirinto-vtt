//! A LÓGICA PURA DA CÓPIA NO GOOGLE DRIVE: sem rede e sem disco (os testes moram aqui).
//!
//! O desenho é o de conteúdo endereçado, o mesmo do git e do restic:
//! - no Drive, cada CONTEÚDO mora uma vez só, em `objetos/<sha256>`. Dois arquivos
//!   iguais, ou o mesmo arquivo em dois dias, são um objeto só: é isso que faz a cópia
//!   subir só o que mudou e cada imagem uma vez;
//! - cada cópia é um manifesto `copias/<AAAA-MM-DDTHH-MM-SSZ>.json` com caminho, sha256
//!   e tamanho de cada arquivo de `<appData>/preparo/` naquele momento. Restaurar uma
//!   data é baixar o manifesto e, para cada caminho, o objeto do hash;
//! - o manifesto sobe por último, depois de todos os objetos: uma cópia nunca cita um
//!   objeto que não está no Drive;
//! - o manifesto que volta do Drive é entrada não confiável: [`ler_manifesto`] confere
//!   cada caminho antes de o restaurar gravar qualquer coisa no disco.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use sha2::{Digest as _, Sha256};

/// Versão do manifesto. Um mais novo (de um Labirinto mais novo) não é restaurado.
pub const FORMATO_DO_MANIFESTO: u32 = 1;
/// O maior arquivo que a cópia leva. Passou disso, fica de fora com aviso.
pub const TAMANHO_MAX: u64 = 200 * 1024 * 1024;
/// Arquivos numa cópia (o Prelúdio real tem uns 2.000).
pub const ARQUIVOS_MAX: usize = 200_000;
/// Pastas dentro de pastas em preparo/, contando o nome do arquivo.
pub const FUNDURA_MAX: usize = 16;
const CAMINHO_MAX: usize = 1024;
/// Letras por nome de pasta ou arquivo (o Windows aceita 255; folga para o caminho inteiro).
const SEGMENTO_MAX: usize = 200;
const LETRAS_DO_HASH: usize = 64;
const EXTENSAO_DE_MIDIA_MAX: usize = 10;
/// `midia/<sha256>.<ext>` (docs/planos/preludio-2026-11-08.md §2).
const PASTA_DE_MIDIA: &str = "midia/";
const SUFIXO_DA_COPIA: &str = "Z.json";

const SEGUNDOS_POR_DIA: u64 = 86_400;
const SEGUNDOS_POR_HORA: u64 = 3_600;
const SEGUNDOS_POR_MINUTO: u64 = 60;
const MS_POR_SEGUNDO: u64 = 1_000;

/// Nomes que o Windows reserva para aparelhos, com ou sem extensão (`con.json` não grava).
const NOMES_RESERVADOS: [&str; 22] = [
    "con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8",
    "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
];

/// Um arquivo de preparo/ como a leitura do disco o viu.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArquivoLocal {
    /// Relativo a preparo/, separado por `/` (passa em [`caminho_seguro`]).
    pub caminho: String,
    pub sha256: String,
    pub tamanho: u64,
    /// O hash veio do nome (`midia/<sha256>.<ext>`) e o conteúdo ainda não foi lido.
    pub pelo_nome: bool,
}

/// Uma linha do manifesto.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EntradaDaCopia {
    pub caminho: String,
    pub sha256: String,
    pub tamanho: u64,
}

/// O manifesto de uma cópia: o que `<appData>/preparo/` tinha naquele momento.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Manifesto {
    pub formato: u32,
    /// Milissegundos desde 1970, em UTC.
    pub quando: u64,
    /// Quem fez ("labirinto-vtt 0.5.36"): só para quem abrir o arquivo no Drive.
    pub app: String,
    pub arquivos: Vec<EntradaDaCopia>,
}

/// Os arquivos que precisam subir: um por conteúdo que o Drive ainda não tem, na ordem
/// dos caminhos. Quando dois caminhos têm o mesmo conteúdo, o primeiro é o que se lê.
pub fn a_enviar<'a>(locais: &'a [ArquivoLocal], no_drive: &HashSet<String>) -> Vec<&'a ArquivoLocal> {
    let mut vistos: HashSet<&str> = HashSet::new();
    locais
        .iter()
        .filter(|arquivo| !no_drive.contains(&arquivo.sha256) && vistos.insert(arquivo.sha256.as_str()))
        .collect()
}

/// O manifesto dos `locais`, com os caminhos em ordem (o mesmo conteúdo dá o mesmo texto).
pub fn manifesto(locais: &[ArquivoLocal], quando: u64, app: &str) -> Manifesto {
    let mut arquivos: Vec<EntradaDaCopia> = locais
        .iter()
        .map(|arquivo| EntradaDaCopia {
            caminho: arquivo.caminho.clone(),
            sha256: arquivo.sha256.clone(),
            tamanho: arquivo.tamanho,
        })
        .collect();
    arquivos.sort_by(|a, b| a.caminho.cmp(&b.caminho));
    Manifesto {
        formato: FORMATO_DO_MANIFESTO,
        quando,
        app: app.to_owned(),
        arquivos,
    }
}

/// O "rosto" do conteúdo de uma cópia: igual quando os mesmos caminhos têm os mesmos
/// conteúdos, seja qual for a ordem ou a hora. A cópia seguinte com a mesma assinatura
/// não sobe manifesto novo ("nada mudou").
pub fn assinatura(arquivos: &[EntradaDaCopia]) -> String {
    let mut ordem: Vec<&EntradaDaCopia> = arquivos.iter().collect();
    ordem.sort_by(|a, b| a.caminho.cmp(&b.caminho));
    let mut hasher = Sha256::new();
    for entrada in ordem {
        // `\0` e `\n` não aparecem num caminho seguro nem num hash: a junção não é ambígua.
        hasher.update(entrada.caminho.as_bytes());
        hasher.update(b"\0");
        hasher.update(entrada.sha256.as_bytes());
        hasher.update(b"\0");
        hasher.update(entrada.tamanho.to_string().as_bytes());
        hasher.update(b"\n");
    }
    hex(&hasher.finalize())
}

/// O hash em hex minúsculo (a forma dos nomes em `midia/` e do `sha256Checksum` do Drive).
pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// 64 letras de hex minúsculo.
pub fn eh_hash(texto: &str) -> bool {
    texto.len() == LETRAS_DO_HASH && texto.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// `midia/<sha256>.<ext>` → o hash. A mídia do Prelúdio tem o conteúdo no nome: quando
/// o Drive já tem esse objeto, o arquivo nem precisa ser lido.
pub fn hash_do_nome_de_midia(caminho: &str) -> Option<&str> {
    let nome = caminho.strip_prefix(PASTA_DE_MIDIA)?;
    let (hash, extensao) = nome.split_once('.')?;
    let extensao_ok = (1..=EXTENSAO_DE_MIDIA_MAX).contains(&extensao.len())
        && extensao.bytes().all(|b| b.is_ascii_alphanumeric());
    (eh_hash(hash) && extensao_ok).then_some(hash)
}

/// Arquivos de serviço que ficam fora: a cópia `.anterior` de cada gravação (as datas no
/// Drive já fazem esse papel), o `.tmp` de uma gravação no meio e os que o Windows cria.
pub fn fica_de_fora(nome: &str) -> bool {
    let minusculo = nome.to_ascii_lowercase();
    minusculo.ends_with(".anterior")
        || minusculo.ends_with(".tmp")
        || minusculo == "desktop.ini"
        || minusculo == "thumbs.db"
}

/// Um nome de pasta ou arquivo que o Windows grava do jeito que está escrito: sem `.`
/// nem `..`, sem `<>:"/\|?*` nem controle, sem ponto ou espaço no fim, sem nome de aparelho.
pub fn segmento_seguro(segmento: &str) -> bool {
    let letras = segmento.chars().count();
    if letras == 0 || letras > SEGMENTO_MAX || segmento == "." || segmento == ".." {
        return false;
    }
    if segmento.ends_with('.') || segmento.ends_with(' ') {
        return false;
    }
    let proibida = |c: char| c.is_control() || matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*');
    if segmento.chars().any(proibida) {
        return false;
    }
    let base = segmento.split('.').next().unwrap_or(segmento).trim_end().to_ascii_lowercase();
    !NOMES_RESERVADOS.contains(&base.as_str())
}

/// Caminho relativo a preparo/, com `/`, que não sai dela: sem barra no começo nem no
/// fim, sem letra de disco, sem `..`, sem `\`.
pub fn caminho_seguro(caminho: &str) -> bool {
    if caminho.is_empty() || caminho.len() > CAMINHO_MAX {
        return false;
    }
    let segmentos: Vec<&str> = caminho.split('/').collect();
    segmentos.len() <= FUNDURA_MAX && segmentos.iter().all(|segmento| segmento_seguro(segmento))
}

/// Até 80 letras de um texto que veio de fora, para caber num aviso.
fn trecho(texto: &str) -> String {
    texto.chars().take(80).collect()
}

/// Lê e confere o manifesto baixado do Drive. Recusa (com o motivo) o que não puder ser
/// restaurado inteiro e dentro de preparo/: caminho que sai da pasta, hash torto, tamanho
/// acima do teto, dois caminhos que no Windows são o mesmo, arquivo e pasta com o mesmo nome.
pub fn ler_manifesto(bytes: &[u8]) -> Result<Manifesto, String> {
    let bruto: serde_json::Value =
        serde_json::from_slice(bytes).map_err(|_| "o arquivo da cópia não é um JSON".to_owned())?;
    let formato = bruto
        .get("formato")
        .and_then(serde_json::Value::as_u64)
        .ok_or_else(|| "o arquivo da cópia não diz o formato".to_owned())?;
    if formato > u64::from(FORMATO_DO_MANIFESTO) {
        return Err(format!(
            "a cópia é de um Labirinto mais novo (formato {formato}); atualize o app para restaurá-la"
        ));
    }
    let manifesto: Manifesto = serde_json::from_value(bruto)
        .map_err(|_| "o arquivo da cópia tem campos que esta versão não entende".to_owned())?;
    if manifesto.formato != FORMATO_DO_MANIFESTO {
        return Err(format!("formato {} desconhecido", manifesto.formato));
    }
    if manifesto.arquivos.len() > ARQUIVOS_MAX {
        return Err(format!("a cópia passa de {ARQUIVOS_MAX} arquivos"));
    }
    let mut vistos: HashSet<String> = HashSet::with_capacity(manifesto.arquivos.len());
    for entrada in &manifesto.arquivos {
        if !caminho_seguro(&entrada.caminho) {
            return Err(format!("caminho recusado na cópia: {}", trecho(&entrada.caminho)));
        }
        if !eh_hash(&entrada.sha256) {
            return Err(format!("hash torto na cópia: {}", trecho(&entrada.caminho)));
        }
        if entrada.tamanho > TAMANHO_MAX {
            return Err(format!("arquivo grande demais na cópia: {}", trecho(&entrada.caminho)));
        }
        // O Windows não separa maiúscula de minúscula: `A.json` e `a.json` são um arquivo só.
        if !vistos.insert(entrada.caminho.to_lowercase()) {
            return Err(format!("caminho repetido na cópia: {}", trecho(&entrada.caminho)));
        }
    }
    for entrada in &manifesto.arquivos {
        let minusculo = entrada.caminho.to_lowercase();
        let pasta_com_nome_de_arquivo = minusculo
            .match_indices('/')
            .any(|(fim, _)| vistos.contains(&minusculo[..fim]));
        if pasta_com_nome_de_arquivo {
            return Err(format!("arquivo e pasta com o mesmo nome na cópia: {}", trecho(&entrada.caminho)));
        }
    }
    Ok(manifesto)
}

/// O nome da cópia no Drive: a data em UTC, que ordena igual à hora (`2026-11-08T21-30-05Z.json`).
pub fn nome_da_copia(quando_ms: u64) -> String {
    format!("{}.json", carimbo(quando_ms))
}

/// `2026-11-08T21-30-05Z`: serve de nome de arquivo no Windows (sem `:`).
pub fn carimbo(quando_ms: u64) -> String {
    let segundos = quando_ms / MS_POR_SEGUNDO;
    let (ano, mes, dia) = data_civil(segundos / SEGUNDOS_POR_DIA);
    let resto = segundos % SEGUNDOS_POR_DIA;
    format!(
        "{ano:04}-{mes:02}-{dia:02}T{:02}-{:02}-{:02}Z",
        resto / SEGUNDOS_POR_HORA,
        resto % SEGUNDOS_POR_HORA / SEGUNDOS_POR_MINUTO,
        resto % SEGUNDOS_POR_MINUTO
    )
}

/// Tem a forma que [`nome_da_copia`] produz.
pub fn eh_nome_de_copia(nome: &str) -> bool {
    let Some(data) = nome.strip_suffix(SUFIXO_DA_COPIA) else {
        return false;
    };
    let bytes = data.as_bytes();
    bytes.len() == "AAAA-MM-DDTHH-MM-SS".len()
        && bytes.iter().enumerate().all(|(i, b)| match i {
            4 | 7 | 13 | 16 => *b == b'-',
            10 => *b == b'T',
            _ => b.is_ascii_digit(),
        })
}

/// Dias desde 1970-01-01 → (ano, mês, dia), pelo `civil_from_days` de Howard Hinnant
/// (calendário gregoriano proléptico; aqui só datas depois de 1970).
fn data_civil(dias: u64) -> (u64, u64, u64) {
    let z = dias + 719_468;
    let era = z / 146_097;
    let dia_da_era = z - era * 146_097;
    let ano_da_era = (dia_da_era - dia_da_era / 1_460 + dia_da_era / 36_524 - dia_da_era / 146_096) / 365;
    let dia_do_ano = dia_da_era - (365 * ano_da_era + ano_da_era / 4 - ano_da_era / 100);
    let mes_desde_marco = (5 * dia_do_ano + 2) / 153;
    let dia = dia_do_ano - (153 * mes_desde_marco + 2) / 5 + 1;
    let mes = if mes_desde_marco < 10 { mes_desde_marco + 3 } else { mes_desde_marco - 9 };
    let ano = ano_da_era + era * 400 + u64::from(mes <= 2);
    (ano, mes, dia)
}

// ---------------------------------------------------------------------------
// Testes (dados inventados; sem rede e sem disco)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod testes {
    use super::*;

    /// Um arquivo inventado cujo conteúdo é "a letra repetida" (o hash é só a letra 64 vezes).
    fn arquivo(caminho: &str, conteudo: char, tamanho: u64) -> ArquivoLocal {
        ArquivoLocal {
            caminho: caminho.to_owned(),
            sha256: conteudo.to_string().repeat(LETRAS_DO_HASH),
            tamanho,
            pelo_nome: hash_do_nome_de_midia(caminho).is_some(),
        }
    }

    /// Um Prelúdio inventado, na ordem que a leitura do disco entrega (por caminho).
    fn preludio_inventado() -> Vec<ArquivoLocal> {
        vec![
            arquivo(&format!("midia/{}.png", "d".repeat(LETRAS_DO_HASH)), 'd', 40_000),
            arquivo("preparo.json", 'a', 120),
            arquivo("quadros/quadro-teste.json", 'b', 900),
            arquivo("verbetes/capitao-inventado.json", 'c', 300),
            arquivo("verbetes/copia-do-capitao.json", 'c', 300),
        ]
    }

    fn caminhos<'a>(lista: &[&'a ArquivoLocal]) -> Vec<&'a str> {
        lista.iter().map(|arquivo| arquivo.caminho.as_str()).collect()
    }

    #[test]
    fn a_primeira_copia_sobe_cada_conteudo_uma_vez() {
        let locais = preludio_inventado();
        let sobem = a_enviar(&locais, &HashSet::new());
        // 5 arquivos, 4 conteúdos: o verbete repetido não sobe de novo.
        assert_eq!(
            caminhos(&sobem),
            [
                format!("midia/{}.png", "d".repeat(LETRAS_DO_HASH)).as_str(),
                "preparo.json",
                "quadros/quadro-teste.json",
                "verbetes/capitao-inventado.json",
            ]
        );
        assert!(sobem[0].pelo_nome, "a mídia tem o hash no nome");
    }

    #[test]
    fn a_copia_seguinte_sobe_so_o_que_mudou_e_sem_mudanca_a_assinatura_fica() {
        let antes = preludio_inventado();
        let no_drive: HashSet<String> = antes.iter().map(|arquivo| arquivo.sha256.clone()).collect();
        assert!(a_enviar(&antes, &no_drive).is_empty(), "nada mudou: nada sobe");

        // A ordem e a hora não mudam a assinatura; o conteúdo, sim.
        let mut ao_contrario = antes.clone();
        ao_contrario.reverse();
        let assinatura_antes = assinatura(&manifesto(&antes, 1, "teste").arquivos);
        assert_eq!(assinatura_antes, assinatura(&manifesto(&ao_contrario, 999, "outro").arquivos));

        // O mestre edita um verbete e põe uma imagem nova (que entra no fim da lista).
        let mut depois = antes.clone();
        depois[3].sha256 = "e".repeat(LETRAS_DO_HASH);
        depois.push(arquivo(&format!("midia/{}.webp", "f".repeat(LETRAS_DO_HASH)), 'f', 70_000));
        let sobem = a_enviar(&depois, &no_drive);
        assert_eq!(
            caminhos(&sobem),
            [
                "verbetes/capitao-inventado.json",
                format!("midia/{}.webp", "f".repeat(LETRAS_DO_HASH)).as_str(),
            ]
        );
        assert_ne!(assinatura_antes, assinatura(&manifesto(&depois, 2, "teste").arquivos));
    }

    fn manifesto_com(caminho: &str) -> String {
        serde_json::json!({
            "formato": 1,
            "quando": 1,
            "app": "teste",
            "arquivos": [{ "caminho": caminho, "sha256": "a".repeat(LETRAS_DO_HASH), "tamanho": 10 }],
        })
        .to_string()
    }

    #[test]
    fn restaurar_recusa_caminho_que_sai_do_preparo_e_aceita_nome_com_acento() {
        let recusados = [
            "../fora.json",
            "verbetes/../../fora.json",
            "verbetes\\fora.json",
            "C:/Windows/fora.json",
            "/raiz.json",
            "verbetes//vazio.json",
            "verbetes/./ponto.json",
            "verbetes/con.json",
            "verbetes/termina-com-ponto.",
        ];
        for caminho in recusados {
            assert!(ler_manifesto(manifesto_com(caminho).as_bytes()).is_err(), "devia recusar {caminho}");
        }
        assert!(ler_manifesto(manifesto_com("verbetes/São Tomé (2).json").as_bytes()).is_ok());

        let mais_novo = serde_json::json!({ "formato": 2, "quando": 1, "app": "futuro", "arquivos": [] }).to_string();
        assert!(ler_manifesto(mais_novo.as_bytes()).is_err_and(|motivo| motivo.contains("mais novo")));

        let repetido = serde_json::json!({
            "formato": 1, "quando": 1, "app": "teste",
            "arquivos": [
                { "caminho": "Verbetes/A.json", "sha256": "a".repeat(LETRAS_DO_HASH), "tamanho": 1 },
                { "caminho": "verbetes/a.json", "sha256": "b".repeat(LETRAS_DO_HASH), "tamanho": 1 },
            ],
        })
        .to_string();
        assert!(ler_manifesto(repetido.as_bytes()).is_err(), "no Windows os dois são o mesmo arquivo");
    }

    #[test]
    fn o_nome_da_copia_e_a_data_em_utc() {
        // Conferido com o `Date#toISOString` do Node: 2025-11-08T22:13:25.123Z e 2028-02-29T23:59:59Z.
        assert_eq!(nome_da_copia(1_762_640_005_123), "2025-11-08T22-13-25Z.json");
        assert_eq!(nome_da_copia(1_835_481_599_000), "2028-02-29T23-59-59Z.json");
        assert!(eh_nome_de_copia(&nome_da_copia(0)));
        assert!(!eh_nome_de_copia("2025-11-08T22-13-25Z.json.anterior"));
    }
}
