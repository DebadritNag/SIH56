"""Start the actual web entrypoint and verify HTTP without a live worker."""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen


def main():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1',0))
        port = listener.getsockname()[1]
    env = {**os.environ,'PORT':str(port),'LIVE_WORKER_ENABLED':'false','MEMORY_CONSTRAINED':'true'}
    with tempfile.TemporaryFile(mode='w+') as output:
        process = subprocess.Popen([sys.executable,'-m','scripts.start_server'],env=env,stdout=output,stderr=output)
        started = time.monotonic()
        try:
            while time.monotonic()-started < 25:
                if process.poll() is not None:
                    raise RuntimeError(f'Server exited with code {process.returncode}')
                try:
                    with urlopen(f'http://127.0.0.1:{port}/api/v1/health',timeout=1) as response:
                        body = json.load(response)
                    assert body['success'] and body['data']['status']=='healthy'
                    print(f'PASS: real HTTP health response on configured PORT in {time.monotonic()-started:.1f}s')
                    return
                except OSError:
                    time.sleep(0.1)
            raise TimeoutError('HTTP port did not become available within 25 seconds')
        finally:
            process.terminate()
            process.wait(timeout=10)


if __name__=='__main__':
    main()
