"""Regression coverage for both Git for Windows OpenSSL layouts."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('package_runtime', Path(__file__).with_name('package_runtime.py'))
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class WindowsPackaging(unittest.TestCase):
    def test_git_layouts(self):
        for layout, version in (('mingw64', '1_1-x64'), ('usr', '3')):
            with self.subTest(layout=layout), tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / 'Git'
                binaries = root / layout / 'bin'
                licenses = root / layout / 'share/licenses/openssl'
                binaries.mkdir(parents=True)
                licenses.mkdir(parents=True)
                (licenses / 'LICENSE').write_text('test license')
                for prefix in ('libssl-', 'libcrypto-'):
                    (binaries / (prefix + version + '.dll')).write_bytes(prefix.encode())
                output = Path(directory) / 'out'
                with patch.object(runtime.os, 'name', 'nt'), \
                     patch.object(runtime.shutil, 'which', return_value=str(root / 'cmd/git.exe')), \
                     patch.object(runtime.subprocess, 'check_output', return_value=str(root / layout / 'libexec/git-core')):
                    result = runtime.package(output)
                self.assertEqual(len(result['libraries']), 2)
                self.assertTrue((output / 'openssl-license/LICENSE').is_file())
                self.assertTrue((output / 'openssl-manifest.json').is_file())


if __name__ == '__main__':
    unittest.main()
