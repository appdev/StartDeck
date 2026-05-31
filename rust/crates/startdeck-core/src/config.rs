use std::env;
use std::path::{Path, PathBuf};

const DEFAULT_TENCENT_MAP_KEY: &str = "SFOBZ-WFFCB-GUWU7-JP6EC-GCMRT-7KBSQ";

#[derive(Clone, Debug)]
pub struct RuntimeConfig {
    pub base_dir: PathBuf,
    pub data_dir: PathBuf,
    pub users_dir: PathBuf,
    pub sqlite_file: PathBuf,
    pub public_dir: PathBuf,
    pub server_resource_dir: PathBuf,
    pub backgrounds_dir: PathBuf,
    pub mobile_backgrounds_dir: PathBuf,
    pub icon_cache_dir: PathBuf,
    pub meta_server_data_dir: PathBuf,
    pub meta_server_resource_dir: PathBuf,
    pub default_template_file: PathBuf,
    pub qweather_api_host: String,
    pub qweather_project_id: String,
    pub qweather_credential_id: String,
    pub qweather_private_key_file: PathBuf,
    pub tencent_map_api_host: String,
    pub tencent_map_key: String,
    pub host: String,
    pub port: u16,
    pub admin_password: String,
}

impl RuntimeConfig {
    pub fn from_env() -> Self {
        let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let base_dir = env::var_os("BASE_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| infer_base_dir(&cwd));
        Self::from_base_dir(base_dir)
    }

    pub fn from_base_dir(base_dir: PathBuf) -> Self {
        let server_resource_dir = env_path(&["STARTDECK_SERVER_RESOURCE_DIR"])
            .unwrap_or_else(|| default_server_resource_dir(&base_dir));
        let data_dir = env_path(&["STARTDECK_DATA_DIR", "DATA_DIR"])
            .unwrap_or_else(|| base_dir.join("Data").join("data"));
        let public_dir = env_path(&["STARTDECK_PUBLIC_DIR", "PUBLIC_DIR"])
            .unwrap_or_else(|| base_dir.join("Data").join("public"));
        let default_template_file =
            env_path(&["STARTDECK_DEFAULT_TEMPLATE_FILE", "DEFAULT_TEMPLATE_FILE"]).unwrap_or_else(
                || {
                    first_existing_path([
                        server_resource_dir.join("data").join("default.json"),
                        data_dir.join("default.json"),
                    ])
                },
            );
        let port = env::var("PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(9001);
        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let admin_password =
            env::var("STARTDECK_ADMIN_PASSWORD").unwrap_or_else(|_| "admin".to_string());
        let meta_server_data_dir = env_path(&["META_SERVER_DATA_DIR"])
            .unwrap_or_else(|| default_meta_server_data_dir(&base_dir));
        let meta_server_resource_dir = env_path(&["META_SERVER_RESOURCE_DIR"])
            .or_else(|| default_meta_server_resource_dir(&base_dir))
            .unwrap_or_else(|| meta_server_data_dir.clone());
        let qweather_api_host = env::var("QWEATHER_API_HOST")
            .or_else(|_| env::var("QWEATHER_GEO_API_HOST"))
            .unwrap_or_default()
            .trim_end_matches('/')
            .to_string();
        let qweather_project_id = env::var("QWEATHER_PROJECT_ID").unwrap_or_default();
        let qweather_credential_id = env::var("QWEATHER_CREDENTIAL_ID").unwrap_or_default();
        let qweather_private_key_file =
            env_path(&["QWEATHER_PRIVATE_KEY_FILE", "QWEATHER_PRIVATE_KEY_PATH"])
                .unwrap_or_default();
        let tencent_map_api_host = env_string(&["TENCENT_MAP_API_HOST"])
            .unwrap_or_else(|| "https://apis.map.qq.com".to_string())
            .trim_end_matches('/')
            .to_string();
        let tencent_map_key = env_string(&["TENCENT_MAP_KEY", "TENCENT_MAP_API_KEY"])
            .unwrap_or_else(|| DEFAULT_TENCENT_MAP_KEY.to_string());
        Self {
            users_dir: data_dir.join("users"),
            sqlite_file: data_dir.join("startdeck.sqlite3"),
            public_dir,
            server_resource_dir,
            backgrounds_dir: env_path(&["STARTDECK_PC_DIR", "PC_DIR"])
                .unwrap_or_else(|| base_dir.join("Data").join("PC")),
            mobile_backgrounds_dir: env_path(&["STARTDECK_APP_DIR", "APP_DIR"])
                .unwrap_or_else(|| base_dir.join("Data").join("APP")),
            icon_cache_dir: data_dir.join("icon-cache"),
            meta_server_data_dir,
            meta_server_resource_dir,
            default_template_file,
            qweather_api_host,
            qweather_project_id,
            qweather_credential_id,
            qweather_private_key_file,
            tencent_map_api_host,
            tencent_map_key,
            data_dir,
            base_dir,
            host,
            port,
            admin_password,
        }
    }

    pub fn ensure_dirs(&self) -> std::io::Result<()> {
        for dir in [
            &self.data_dir,
            &self.users_dir,
            &self.public_dir,
            &self.backgrounds_dir,
            &self.mobile_backgrounds_dir,
            &self.icon_cache_dir,
            &self.meta_server_data_dir,
        ] {
            std::fs::create_dir_all(dir)?;
        }
        Ok(())
    }

    pub fn qweather_enabled(&self) -> bool {
        !self.qweather_api_host.trim().is_empty()
            && !self.qweather_project_id.trim().is_empty()
            && !self.qweather_credential_id.trim().is_empty()
            && self.qweather_private_key_file.is_file()
    }
}

fn infer_base_dir(cwd: &Path) -> PathBuf {
    if let Some(root) = workspace_root_from(cwd) {
        return root;
    }
    match cwd.file_name().and_then(|value| value.to_str()) {
        Some("backend")
        | Some("frontend")
        | Some("meta-service")
        | Some("startdeck-server")
        | Some("startdeck-metaserver") => cwd
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| cwd.to_path_buf()),
        _ => cwd.to_path_buf(),
    }
}

fn env_string(keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        env::var(key)
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
    })
}

fn env_path(keys: &[&str]) -> Option<PathBuf> {
    keys.iter().find_map(|key| {
        env::var(key)
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
    })
}

fn default_server_resource_dir(base_dir: &Path) -> PathBuf {
    let rust_resources = base_dir
        .join("rust")
        .join("crates")
        .join("startdeck-server")
        .join("resources");
    if rust_resources.exists() {
        rust_resources
    } else {
        base_dir.join("Data")
    }
}

fn default_meta_server_data_dir(base_dir: &Path) -> PathBuf {
    base_dir.join("Data").join("meta-service")
}

fn default_meta_server_resource_dir(base_dir: &Path) -> Option<PathBuf> {
    let rust_resources = base_dir
        .join("rust")
        .join("crates")
        .join("startdeck-metaserver")
        .join("resources")
        .join("data");
    rust_resources.exists().then_some(rust_resources)
}

fn first_existing_path<const N: usize>(paths: [PathBuf; N]) -> PathBuf {
    paths
        .iter()
        .find(|path| path.exists())
        .cloned()
        .unwrap_or_else(|| paths[0].clone())
}

fn workspace_root_from(cwd: &Path) -> Option<PathBuf> {
    cwd.ancestors().find_map(|candidate| {
        if candidate.join("Cargo.toml").is_file()
            && candidate
                .join("rust")
                .join("crates")
                .join("startdeck-core")
                .is_dir()
        {
            Some(candidate.to_path_buf())
        } else {
            None
        }
    })
}
