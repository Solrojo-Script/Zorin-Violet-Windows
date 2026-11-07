#!/usr/bin/env python3
"""Enable wallpaper synchronization for the existing Zorin Violet GDM background."""
import os
import pwd
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

BACKGROUND = Path('/usr/local/share/backgrounds/ZorinViolet/login.png')
HELPER = Path('/usr/local/libexec/violet-wallpaper-sync.py')
AUTOSTART = Path('/etc/xdg/autostart/violet-wallpaper-sync.desktop')
GDM_STYLE = Path('/usr/local/share/gnome-shell/extensions/violet-gdm-background@solrojo/style.css')


def main():
    if os.geteuid() != 0 or not os.environ.get('SUDO_USER'):
        raise SystemExit('Run this installer with sudo from your regular desktop account.')
    account = pwd.getpwnam(os.environ['SUDO_USER'])
    if account.pw_uid == 0:
        raise SystemExit('A regular desktop user is required.')
    if not GDM_STYLE.is_file() or str(BACKGROUND) not in GDM_STYLE.read_text():
        raise SystemExit('The existing Zorin Violet per-monitor GDM background is required.')

    directory = Path('/var/lib/violet-windows/wallpapers') / str(account.pw_uid)
    directory.mkdir(parents=True, exist_ok=True)
    directory.chmod(0o755)
    os.chown(directory, account.pw_uid, account.pw_gid)
    HELPER.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(Path(__file__).with_name('sync.py'), HELPER)
    HELPER.chmod(0o644)

    env = {
        'HOME': account.pw_dir,
        'USER': account.pw_name,
        'LOGNAME': account.pw_name,
        'PATH': '/usr/local/bin:/usr/bin:/bin',
        'XDG_RUNTIME_DIR': f'/run/user/{account.pw_uid}',
        'DBUS_SESSION_BUS_ADDRESS': f'unix:path=/run/user/{account.pw_uid}/bus',
    }
    identity = {
        'user': account.pw_uid,
        'group': account.pw_gid,
        'extra_groups': os.getgrouplist(account.pw_name, account.pw_gid),
        'env': env,
    }
    command = ['/usr/bin/python3', '-I', str(HELPER)]
    subprocess.run([*command, '--once'], check=True, **identity)
    if BACKGROUND.exists() and not BACKGROUND.is_symlink():
        backup = Path('/var/backups') / f'violet-login-wallpaper-{datetime.now():%Y%m%d-%H%M%S}.png'
        shutil.copy2(BACKGROUND, backup)
        print(f'Wallpaper backup: {backup}')

    with tempfile.TemporaryDirectory(dir=BACKGROUND.parent) as temporary:
        link = Path(temporary) / 'login.png'
        link.symlink_to(directory / 'login.png')
        link.replace(BACKGROUND)

    AUTOSTART.write_text(
        '[Desktop Entry]\nType=Application\nName=Violet Wallpaper Sync\n'
        f'Exec=/usr/bin/python3 -I {HELPER}\n'
        'OnlyShowIn=GNOME;\nX-GNOME-Autostart-enabled=true\n'
    )
    AUTOSTART.chmod(0o644)
    subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL, start_new_session=True, **identity)
    print('Wallpaper sync enabled. GDM will use the new image next time its login screen opens.')


if __name__ == '__main__':
    main()
