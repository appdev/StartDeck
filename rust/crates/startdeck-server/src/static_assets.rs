use std::path::PathBuf;

use startdeck_core::RuntimeConfig;

pub(crate) fn public_subdir(config: &RuntimeConfig, name: &str) -> PathBuf {
    let public_path = config.public_dir.join(name);
    if public_path.exists() {
        public_path
    } else {
        config.server_resource_dir.join("public").join(name)
    }
}
