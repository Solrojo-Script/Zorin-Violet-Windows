#!/usr/bin/env python3
"""Install the optional Violet Windows greeter theme."""
import argparse
import os
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

LINK = Path('/usr/share/gnome-shell/gdm-theme.gresource')
TARGET = Path('/usr/local/share/gnome-shell/theme/VioletWindows-GDM/gnome-shell-theme.gresource')
CSS = '/org/gnome/shell/theme/gdm.css'
MARKER = b'/* Violet Windows GDM overlay */'


def extract(resource, name):
    return subprocess.check_output(['gresource', 'extract', resource, name])


def build(base, overlay, directory):
    paths = subprocess.check_output(['gresource', 'list', base], text=True).splitlines()
    if CSS not in paths:
        raise SystemExit('The selected GDM theme does not contain gdm.css.')

    manifest = ET.Element('gresources')
    group = ET.SubElement(manifest, 'gresource')
    for index, name in enumerate(paths):
        filename = str(index)
        ET.SubElement(group, 'file', alias=name.lstrip('/')).text = filename
        data = extract(base, name)
        if name == CSS:
            data = data.split(MARKER, 1)[0].rstrip() + b'\n\n' + MARKER + b'\n' + overlay
        (directory / filename).write_bytes(data)

    xml = directory / 'resources.xml'
    ET.ElementTree(manifest).write(xml, encoding='utf-8', xml_declaration=True)
    resource = directory / 'theme.gresource'
    subprocess.run(['glib-compile-resources', xml, '--sourcedir', directory,
                    '--target', resource], check=True)
    for index, name in enumerate(paths):
        if extract(resource, name) != (directory / str(index)).read_bytes():
            raise SystemExit(f'Could not verify the generated resource: {name}')
    return resource


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='build and verify without installing')
    args = parser.parse_args()
    if not args.check and os.geteuid() != 0:
        parser.exit(1, 'Run this installer with sudo.\n')
    if not LINK.is_symlink():
        parser.exit(1, 'This installer requires a Zorin GDM theme managed by update-alternatives.\n')

    base = LINK.resolve(strict=True)
    overlay = Path(__file__).with_name('gdm').joinpath('gdm.css').read_bytes()
    with tempfile.TemporaryDirectory() as directory:
        resource = build(base, overlay, Path(directory))
        if args.check:
            print('GDM theme built and verified.')
            return

        TARGET.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=TARGET.parent, delete=False) as temporary:
            staged = Path(temporary.name)
        try:
            shutil.copyfile(resource, staged)
            staged.chmod(0o644)
            staged.replace(TARGET)
        finally:
            staged.unlink(missing_ok=True)

    alternatives = ['update-alternatives']
    subprocess.run([*alternatives, '--install', LINK, LINK.name, TARGET, '10'], check=True)
    subprocess.run([*alternatives, '--set', LINK.name, TARGET], check=True)
    print(f'Previous theme: {base}')
    print('The new theme will load the next time GDM opens the login screen.')


if __name__ == '__main__':
    main()
