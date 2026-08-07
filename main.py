"""
학급 자리배치 프로그램
제작: KYUNGMINAI

pywebview + PyInstaller 단일 exe 빌드용
"""

import sys
import os
import webview

# ── HTML 파일 경로 해결 ────────────────────────────────────────────────────────
def resource_path(relative):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative)

# ── pywebview API (JS ↔ Python 브릿지) ────────────────────────────────────────
class Api:
    def load_data_file(self):
        result = webview.windows[0].create_file_dialog(
            webview.OPEN_DIALOG,
            directory=os.path.expanduser('~\\Desktop'),
            file_types=('RSB 자리배치 파일 (*.rsb)', 'All files (*.*)')
        )
        if not result:
            return {'ok': False}
        file_path = result if isinstance(result, str) else result[0]
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return {'ok': True, 'content': content}
        except Exception as e:
            return {'ok': False, 'error': str(e)}

    def save_file(self, filename: str, data_url: str):
        import base64
        result = webview.windows[0].create_file_dialog(
            webview.SAVE_DIALOG,
            directory=os.path.expanduser('~\\Desktop'),
            save_filename=filename,
            file_types=('PNG Image (*.png)', 'All files (*.*)')
        )
        if not result:
            return {'ok': False}
        save_path = result if isinstance(result, str) else result[0]
        try:
            header, encoded = data_url.split(',', 1)
            img_bytes = base64.b64decode(encoded)
            with open(save_path, 'wb') as f:
                f.write(img_bytes)
            return {'ok': True, 'path': save_path}
        except Exception as e:
            return {'ok': False, 'error': str(e)}

    def save_data_file(self, filename: str, content: str):
        result = webview.windows[0].create_file_dialog(
            webview.SAVE_DIALOG,
            directory=os.path.expanduser('~\\Desktop'),
            save_filename=filename,
            file_types=('RSB 자리배치 파일 (*.rsb)', 'All files (*.*)')
        )
        if not result:
            return {'ok': False}
        save_path = result if isinstance(result, str) else result[0]
        try:
            with open(save_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return {'ok': True, 'path': save_path}
        except Exception as e:
            return {'ok': False, 'error': str(e)}

    def save_excel_file(self, filename: str, content: str):
        result = webview.windows[0].create_file_dialog(
            webview.SAVE_DIALOG,
            directory=os.path.expanduser('~\\Desktop'),
            save_filename=filename,
            file_types=('Excel File (*.xls)', 'All files (*.*)')
        )
        if not result:
            return {'ok': False}
        save_path = result if isinstance(result, str) else result[0]
        try:
            with open(save_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return {'ok': True, 'path': save_path}
        except Exception as e:
            return {'ok': False, 'error': str(e)}


# ── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    html_path = resource_path('seat.html')
    api = Api()

    window = webview.create_window(
        title='학급 자리배치 프로그램 — KYUNGMINAI',
        url=f'file:///{html_path.replace(os.sep, "/")}',
        js_api=api,
        width=1280,
        height=820,
        min_size=(900, 600),
        resizable=True
    )
    
    webview.start(
        debug=False,
        private_mode=False,
        storage_path=os.path.join(os.path.expanduser('~'), '.kyungminai_seat'),
    )

if __name__ == '__main__':
    main()