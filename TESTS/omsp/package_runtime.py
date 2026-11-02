"""Bundle the runner's matching OpenSSL pair, licenses and hashes beside zOMSp."""
import argparse
import ctypes.util
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess


def package(output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    if os.name == 'nt':
        git = Path(shutil.which('git')).resolve()
        roots = [git.parent.parent, Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / 'Git']
        root = next(p for p in roots if (p / 'mingw64/bin').is_dir())
        directory = root / 'mingw64/bin'
        ssl = next((directory / name for name in ['libssl-3-x64.dll', 'libssl-1_1-x64.dll'] if (directory / name).exists()), None)
        if not ssl:
            raise RuntimeError('Git OpenSSL DLL not found')
        crypto = ssl.with_name(ssl.name.replace('libssl-', 'libcrypto-'))
        sources = [ssl, crypto]
        license_source = root / 'mingw64/share/licenses/openssl'
        shutil.copytree(license_source, output / 'openssl-license', dirs_exist_ok=True)
    else:
        result = subprocess.check_output(['ldconfig', '-p'], text=True)
        def resolve(name):
            soname = ctypes.util.find_library(name)
            for line in result.splitlines():
                fields = line.strip().split()
                if fields and fields[0] == soname and '=>' in fields:
                    return Path(fields[-1])
            raise RuntimeError('cannot locate ' + name)
        sources = [resolve('ssl'), resolve('crypto')]
        license_source = next((p for p in [Path('/usr/share/doc/libssl3t64/copyright'), Path('/usr/share/doc/libssl3/copyright'), Path('/usr/share/licenses/openssl-libs/LICENSE.txt')] if p.exists()), None)
        if not license_source:
            raise RuntimeError('OpenSSL package copyright not found')
        shutil.copy2(license_source, output / 'openssl-copyright')
    manifest = {'platform': platform.platform(), 'libraries': []}
    for source in sources:
        target = output / source.name
        shutil.copy2(source.resolve(strict=True), target)
        manifest['libraries'].append({'name': target.name, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    (output / 'openssl-manifest.json').write_text(json.dumps(manifest, indent=2))
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('output')
    print(json.dumps(package(parser.parse_args().output), indent=2))
