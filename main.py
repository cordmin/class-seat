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
        except Exception as e:
            return {'ok': False, 'error': str(e)}

    def download_template(self):
        import shutil
        result = webview.windows[0].create_file_dialog(
            webview.SAVE_DIALOG,
            directory=os.path.expanduser('~\\Desktop'),
            save_filename='자리배치명단(양식).xlsx',
            file_types=('Excel File (*.xlsx)', 'All files (*.*)')
        )
        if not result:
            return {'ok': False}
        save_path = result if isinstance(result, str) else result[0]
        try:
            template_path = resource_path('자리배치명단(양식).xlsx')
            shutil.copy(template_path, save_path)
            return {'ok': True, 'path': save_path}
        except Exception as e:
            return {'ok': False, 'error': str(e)}

    def load_excel(self):
        import openpyxl
        result = webview.windows[0].create_file_dialog(
            webview.OPEN_DIALOG,
            directory=os.path.expanduser('~\\Desktop'),
            file_types=('Excel File (*.xlsx)', 'All files (*.*)')
        )
        if not result:
            return {'ok': False}
        file_path = result if isinstance(result, str) else result[0]
        try:
            wb = openpyxl.load_workbook(file_path, data_only=True)
            ws = wb.active
            students = []
            for row in ws.iter_rows(min_row=2, values_only=True):
                if not row or (row[0] is None and row[1] is None):
                    continue
                num = str(row[0]).strip() if row[0] is not None else ""
                name = str(row[1]).strip() if len(row) > 1 and row[1] is not None else ""
                gender = str(row[2]).strip() if len(row) > 2 and row[2] is not None else ""
                
                if gender.startswith('남') or gender.upper() == 'M': gender = '남'
                elif gender.startswith('여') or gender.upper() == 'F': gender = '여'
                else: gender = ''
                
                if name:
                    students.append({
                        'id': num,
                        'name': name,
                        'gender': gender
                    })
            return {'ok': True, 'students': students}
        except Exception as e:
            return {'ok': False, 'error': str(e)}

    def open_url(self, url: str):
        import webbrowser
        try:
            webbrowser.open(url)
            return {'ok': True}
        except Exception as e:
            return {'ok': False, 'error': str(e)}


# ── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    html_path = resource_path('seat.html')
    api = Api()

    window = webview.create_window(
        title='학급 자리배치 프로그램',
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