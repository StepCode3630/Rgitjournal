fn main() {
    let args: Vec<_> = std::env::args_os().collect();
    let result = gitjournal_core::project::load(std::path::Path::new(&args[2]))
        .and_then(|p| gitjournal_core::journal::collect_local(std::path::Path::new(&args[1]), &p));
    match result {
        Ok(data) => println!("{}", data),
        Err(error) => {
            eprintln!("{}", error);
            std::process::exit(1);
        }
    }
}
