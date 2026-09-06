"""Container web entrypoint. Log before importing the application."""
import os
import subprocess
import sys
import time
from pathlib import Path


def start_display():
    """Keep virtual-display startup bounded and visible in container logs."""
    if sys.platform != 'linux' or os.environ.get('DISPLAY'):
        return None
    os.environ['DISPLAY'] = ':99'
    print('AirPulse starting Xvfb on :99', flush=True)
    process = subprocess.Popen([
        'Xvfb', ':99', '-screen', '0', '1280x720x24', '-nolisten', 'tcp',
    ])
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f'Xvfb exited with code {process.returncode}')
        if Path('/tmp/.X11-unix/X99').exists():
            return process
        time.sleep(0.05)
    process.terminate()
    process.wait(timeout=5)
    raise RuntimeError('Xvfb did not create its display socket within 5 seconds')


def main():
    print('AirPulse container entrypoint v2 reached', flush=True)
    port = int(os.environ.get('PORT', '10000'))
    if not 1 <= port <= 65535:
        raise ValueError('PORT must be between 1 and 65535')
    display = None
    try:
        display = start_display()
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as exc:
        # Collection reports browser failures separately; HTTP must remain usable.
        print(f'AirPulse display startup failed: {exc}', flush=True)
    try:
        print(f'AirPulse starting HTTP on 0.0.0.0:{port}; DISPLAY={os.environ.get("DISPLAY", "unset")}',flush=True)
        import uvicorn
        uvicorn.run('app.main:app',host='0.0.0.0',port=port,workers=1,log_level='info')
    finally:
        if display is not None and display.poll() is None:
            display.terminate()
            display.wait(timeout=5)


if __name__=='__main__':
    main()
