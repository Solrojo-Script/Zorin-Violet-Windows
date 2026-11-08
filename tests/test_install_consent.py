"""Installer cancellation and GDM consent tests; all writes use temporary folders."""
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('wallpaper_installer', ROOT / 'wallpaper/install.py')
wallpaper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wallpaper)
spec = importlib.util.spec_from_file_location('gdm_installer', ROOT / 'install-gdm.py')
gdm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gdm)


class ConsentTests(unittest.TestCase):
    def test_normal_install_rejects_no_empty_and_eof_before_creating_files(self):
        for answer in ('n\n', '\n', ''):
            with self.subTest(answer=answer), tempfile.TemporaryDirectory() as directory:
                data = Path(directory) / 'data'
                result = subprocess.run(['sh', str(ROOT / 'install.sh')], input=answer,
                                        text=True, capture_output=True,
                                        env={**os.environ, 'XDG_DATA_HOME': str(data)})
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertFalse(data.exists())
                self.assertIn('Cancelled', result.stdout)

    def test_dry_run_even_with_yes_never_creates_files(self):
        with tempfile.TemporaryDirectory() as directory:
            data = Path(directory) / 'data'
            result = subprocess.run(['sh', str(ROOT / 'install.sh'), '--yes', '--dry-run'],
                                    text=True, capture_output=True,
                                    env={**os.environ, 'XDG_DATA_HOME': str(data)})
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertFalse(data.exists())

    def test_explicit_yes_installs_only_violet_without_activation(self):
        with tempfile.TemporaryDirectory() as directory:
            data = Path(directory) / 'data'
            result = subprocess.run(['sh', str(ROOT / 'install.sh'), '--yes'],
                                    text=True, capture_output=True,
                                    env={**os.environ, 'XDG_DATA_HOME': str(data)})
            self.assertEqual(result.returncode, 0, result.stderr)
            extensions = data / 'gnome-shell/extensions'
            self.assertEqual([p.name for p in extensions.iterdir()], ['violet-windows@solrojo'])
            self.assertTrue((extensions / 'violet-windows@solrojo/wallpaperConsent.js').is_file())

    def test_gdm_empty_no_eof_and_interrupt_cancel(self):
        for answer in ('', 'n', 'no', EOFError(), KeyboardInterrupt()):
            def ask(_prompt):
                if isinstance(answer, BaseException):
                    raise answer
                return answer
            self.assertFalse(wallpaper.confirm_extension_installation(ask=ask, output=lambda _: None))

    def test_gdm_lists_extension_even_for_explicit_yes(self):
        messages = []
        self.assertTrue(wallpaper.confirm_extension_installation(True, output=messages.append))
        self.assertIn('violet-gdm-background@solrojo', '\n'.join(messages))

    def test_gdm_cancel_before_any_dependency_command_or_system_write(self):
        with patch.object(wallpaper.os, 'geteuid', return_value=0), \
             patch.object(wallpaper, 'confirm_extension_installation', return_value=False), \
             patch.object(wallpaper.subprocess, 'run') as run, \
             patch.object(wallpaper.shutil, 'copyfile') as copy, \
             patch.object(wallpaper.pwd, 'getpwnam') as lookup:
            wallpaper.main([])
        run.assert_not_called()
        copy.assert_not_called()
        lookup.assert_not_called()

    def test_gdm_wrapper_requires_helper_consent_unless_explicitly_approved(self):
        for approved in (False, True):
            arguments = ['install-gdm.py', '--sync-wallpaper'] + (['--yes'] if approved else [])
            with self.subTest(approved=approved), patch.object(gdm.os, 'geteuid', return_value=0), \
                 patch('sys.argv', arguments), patch.object(gdm.subprocess, 'run') as run:
                gdm.main()
            self.assertEqual('--yes' in run.call_args.args[0], approved)

    def test_gdm_yes_flag_cannot_silently_apply_the_theme(self):
        with patch('sys.argv', ['install-gdm.py', '--yes']), patch.object(gdm.subprocess, 'run') as run:
            with self.assertRaises(SystemExit):
                gdm.main()
        run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
