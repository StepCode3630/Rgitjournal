"""Check packaged launchers with Qt and, optionally, the native Wayland app ID.

Usage: python3 scripts/test-linux-icons.py EXTRACTED_PACKAGE_ROOT [BINARY]
Requires PySide6; the optional native test requires a running Wayland session.
All test preferences and icon themes are isolated in a temporary directory.
"""

import configparser
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time

os.environ["QT_QPA_PLATFORM"] = "offscreen"
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import QApplication


def entry(path):
    config = configparser.ConfigParser(interpolation=None)
    config.optionxform = str
    config.read(path)
    return config["Desktop Entry"]


root = Path(sys.argv[1]).resolve()
config = json.loads(Path("src-tauri/tauri.conf.json").read_text())
app_id = config["identifier"]
assert config["app"]["enableGTKAppId"]
launcher = root / "usr/share/applications" / (app_id + ".desktop")
desktop = entry(launcher)
assert desktop["Name"] == "RGitJournal"
assert desktop.get("NoDisplay", "false") == "false"
assert desktop["Exec"] == "gitjournal-desktop %U"
assert "application/x-gitjournal;" in desktop["MimeType"]
assert entry(root / "usr/share/applications/RGitJournal.desktop")["NoDisplay"] == "true"
subprocess.run(["desktop-file-validate", str(launcher)], check=True)

application = QApplication([])
with tempfile.TemporaryDirectory(prefix="gitjournal-linux-icons-") as directory:
    temporary = Path(directory)
    # Use the host's actual hicolor index: merely storing a PNG under an
    # unregistered size (e.g. 1024x1024) must not make this test pass.
    theme = temporary / "icons/hicolor"
    shutil.copytree(root / "usr/share/icons/hicolor", theme)
    shutil.copy("/usr/share/icons/hicolor/index.theme", theme / "index.theme")
    QIcon.setThemeSearchPaths([str(theme.parent)])
    QIcon.setThemeName("hicolor")
    icon = QIcon.fromTheme(desktop["Icon"])
    assert not icon.isNull(), "Qt cannot resolve the launcher's icon"
    available = {size.width() for size in icon.availableSizes()}
    for size in [32, 48, 128, 256, 512]:
        assert size in available, f"Missing packaged icon size: {size}"
        assert not icon.pixmap(size, size).isNull()
    print("Packaged launcher and Qt icon lookup: OK (32, 48, 128, 256, 512 px)")

    if len(sys.argv) > 2:
        binary = Path(sys.argv[2]).resolve()
        env = {
            **os.environ,
            "GDK_BACKEND": "wayland",
            "WAYLAND_DEBUG": "client",
            "XDG_CONFIG_HOME": str(temporary / "config"),
            "XDG_DATA_HOME": str(temporary / "data"),
        }
        trace = temporary / "wayland.log"
        with trace.open("w") as output:
            process = subprocess.Popen(
                ["dbus-run-session", "--", str(binary)], env=env,
                stdout=subprocess.DEVNULL, stderr=output, start_new_session=True,
            )
            try:
                deadline = time.monotonic() + 20
                while time.monotonic() < deadline:
                    if f'set_app_id("{app_id}")' in trace.read_text(errors="replace"):
                        print(f"Native Wayland app_id matches {launcher.name}: OK")
                        break
                    if process.poll() is not None:
                        raise AssertionError("Application exited before announcing its Wayland app_id")
                    time.sleep(0.2)
                else:
                    lines = trace.read_text(errors="replace").splitlines()
                    print("\n".join(line for line in lines if any(
                        key in line for key in ["app_id", "WARNING", "ERROR", "failed", "Failed"]
                    ))[-4000:])
                    print("\n".join(lines[-10:]))
                    raise AssertionError("Expected Wayland app_id was not announced")
            finally:
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait()
