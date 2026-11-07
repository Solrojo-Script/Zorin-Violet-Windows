#!/usr/bin/env python3
"""Install the per-monitor GDM background and automatic wallpaper synchronization."""
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
GDM_EXTENSION = Path('/usr/local/share/gnome-shell/extensions/violet-gdm-background@solrojo')
WALLPAPERS = Path('/var/lib/violet-windows/wallpapers')
BACKUPS = Path('/var/backups')


def main():
    if os.geteuid() != 0:
        raise SystemExit('Run this installer with sudo from your regular desktop account.')
    if os.environ.get('PKEXEC_UID'):
        account = pwd.getpwuid(int(os.environ['PKEXEC_UID']))
    elif os.environ.get('SUDO_USER'):
        account = pwd.getpwnam(os.environ['SUDO_USER'])
    else:
        raise SystemExit('The desktop account could not be identified. Use sudo or Violet Windows preferences.')
    if account.pw_uid == 0:
        raise SystemExit('A regular desktop user is required.')
    greeter = None
    for name in ('gdm', 'Debian-gdm'):
        try:
            greeter = pwd.getpwnam(name)
            break
        except KeyError:
            continue
    if greeter is None:
        raise SystemExit('A GDM greeter account was not found.')
    packages = []
    for tool, package in (('runuser', 'util-linux'), ('dbus-run-session', 'dbus')):
        if not shutil.which(tool):
            packages.append(package)
    probe = subprocess.run(['/usr/bin/python3', '-c',
        'import gi; gi.require_version("GdkPixbuf", "2.0"); from gi.repository import GdkPixbuf'],
        capture_output=True)
    if probe.returncode:
        packages.extend(['python3-gi', 'gir1.2-gdkpixbuf-2.0'])
    if packages:
        subprocess.run(['apt-get', 'install', '-y', *packages], check=True)

    directory = WALLPAPERS / str(account.pw_uid)
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
    backup = BACKUPS / f'violet-wallpaper-sync-{datetime.now():%Y%m%d-%H%M%S-%f}'
    backup.mkdir(mode=0o700)
    if GDM_EXTENSION.is_dir():
        shutil.copytree(GDM_EXTENSION, backup / 'gdm-background')
    GDM_EXTENSION.mkdir(parents=True, exist_ok=True)
    for name in ('extension.js', 'metadata.json', 'style.css'):
        target = GDM_EXTENSION / name
        shutil.copyfile(Path(__file__).with_name('gdm-background') / name, target)
        target.chmod(0o644)
    GDM_EXTENSION.chmod(0o755)
    if BACKGROUND.exists() and not BACKGROUND.is_symlink():
        shutil.copy2(BACKGROUND, backup / 'login.png')
    elif BACKGROUND.is_symlink():
        (backup / 'previous-wallpaper-link').write_text(os.readlink(BACKGROUND))

    BACKGROUND.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=BACKGROUND.parent) as temporary:
        link = Path(temporary) / 'login.png'
        link.symlink_to(directory / 'login.png')
        link.replace(BACKGROUND)

    # GDM has its own settings database and session, separate from the desktop.
    configure = '''from gi.repository import Gio
import json
s = Gio.Settings.new('org.gnome.shell')
keys = ['enabled-extensions', 'disabled-extensions', 'disable-user-extensions']
print(json.dumps({key: s.get_value(key).print_(True) for key in keys}))
uuid = 'violet-gdm-background@solrojo'
enabled = s.get_strv('enabled-extensions')
if uuid not in enabled:
    enabled.append(uuid)
s.set_strv('enabled-extensions', enabled)
s.set_strv('disabled-extensions', [item for item in s.get_strv('disabled-extensions') if item != uuid])
s.set_boolean('disable-user-extensions', False)
Gio.Settings.sync()
assert uuid in s.get_strv('enabled-extensions')
assert uuid not in s.get_strv('disabled-extensions')
assert not s.get_boolean('disable-user-extensions')
'''
    previous = subprocess.check_output([
        'runuser', '-u', greeter.pw_name, '--', 'env',
        '-u', 'XDG_CONFIG_HOME', '-u', 'XDG_DATA_HOME', '-u', 'XDG_RUNTIME_DIR',
        '-u', 'DBUS_SESSION_BUS_ADDRESS', 'HOME=' + greeter.pw_dir,
        'dbus-run-session', '--', '/usr/bin/python3', '-c', configure], text=True)
    (backup / 'gdm-settings.json').write_text(previous)

    AUTOSTART.write_text(
        '[Desktop Entry]\nType=Application\nName=Violet Wallpaper Sync\n'
        f'Exec=/usr/bin/python3 -I {HELPER}\n'
        'OnlyShowIn=GNOME;\nX-GNOME-Autostart-enabled=true\n'
    )
    AUTOSTART.chmod(0o644)
    subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL, start_new_session=True, **identity)
    print('Wallpaper sync enabled. GDM will use the new image next time its login screen opens.')
    print(f'Backup directory: {backup}')


if __name__ == '__main__':
    main()
