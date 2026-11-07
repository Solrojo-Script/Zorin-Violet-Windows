#!/usr/bin/env python3
"""Keep GDM's readable PNG copy in sync with the active GNOME wallpaper."""
import argparse
import fcntl
import os
import sys
import tempfile
from pathlib import Path

import gi
gi.require_version('GdkPixbuf', '2.0')
from gi.repository import GdkPixbuf, Gio, GLib


class WallpaperSync:
    def __init__(self, directory):
        self.directory = directory
        self.background = Gio.Settings.new('org.gnome.desktop.background')
        self.interface = Gio.Settings.new('org.gnome.desktop.interface')
        self.pending = 0
        self.monitor = None
        self.source = None
        self.success = False

    def synchronize(self):
        self.pending = 0
        self.success = False
        key = 'picture-uri-dark' if self.interface.get_string('color-scheme') == 'prefer-dark' else 'picture-uri'
        uri = self.background.get_string(key) or self.background.get_string('picture-uri')
        source = Gio.File.new_for_uri(uri)
        path = source.get_path()
        if not path:
            print('Wallpaper sync requires a local image.', file=sys.stderr)
            return GLib.SOURCE_REMOVE

        if path != self.source:
            if self.monitor:
                self.monitor.cancel()
            self.source = path
            # Watch the parent so atomic replacements of the image are detected.
            self.monitor = source.get_parent().monitor_directory(Gio.FileMonitorFlags.NONE, None)
            self.monitor.connect('changed', self.source_changed)

        staged = None
        try:
            image = GdkPixbuf.Pixbuf.new_from_file(path)
            with tempfile.NamedTemporaryFile(dir=self.directory, delete=False) as file:
                staged = Path(file.name)
            image.savev(str(staged), 'png', [], [])
            staged.chmod(0o644)
            staged.replace(self.directory / 'login.png')
            self.success = True
        except (GLib.Error, OSError) as error:
            print(f'Wallpaper sync: {error}', file=sys.stderr)
        finally:
            if staged:
                staged.unlink(missing_ok=True)
        return GLib.SOURCE_REMOVE

    def source_changed(self, _monitor, file, other, _event):
        if any(candidate and candidate.get_path() == self.source for candidate in (file, other)):
            self.queue()

    def queue(self, *_args):
        if self.pending:
            GLib.source_remove(self.pending)
        self.pending = GLib.timeout_add(500, self.synchronize)

    def run(self):
        self.background.connect('changed::picture-uri', self.queue)
        self.background.connect('changed::picture-uri-dark', self.queue)
        self.interface.connect('changed::color-scheme', self.queue)
        self.synchronize()
        GLib.MainLoop().run()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    directory = Path('/var/lib/violet-windows/wallpapers') / str(os.getuid())
    if not directory.is_dir() or directory.stat().st_uid != os.getuid():
        return 0

    sync = WallpaperSync(directory)
    if args.once:
        sync.synchronize()
        return int(not sync.success)

    with (directory / '.sync.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 0
        sync.run()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
