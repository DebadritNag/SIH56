"""Container web entrypoint. Log before importing the application."""
import os
import uvicorn


def main():
    port = int(os.environ.get('PORT', '10000'))
    if not 1 <= port <= 65535:
        raise ValueError('PORT must be between 1 and 65535')
    print(f'AirPulse starting HTTP on 0.0.0.0:{port}; DISPLAY={os.environ.get("DISPLAY", "unset")}',flush=True)
    uvicorn.run('app.main:app',host='0.0.0.0',port=port,workers=1,log_level='info')


if __name__=='__main__':
    main()
