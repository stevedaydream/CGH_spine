"""
衛教 QA 批次匯入腳本
將 health_edu_qa.json 的資料透過 GAS API 寫入 Google Sheets 分頁11

用法：
  python import_health_edu.py
"""

import json
import time
import urllib.request
import urllib.parse

# ==== 設定 ====
GAS_URL = "https://script.google.com/macros/s/AKfycbxRZHwOH8LNA-SgYJUiDcG62cWfcdALQrH8fJYyFcbfR42T6u-up_xlPfsutZnUKam8Ng/exec"
QA_FILE  = "health_edu_qa.json"
API_KEY  = "spine2026cgh"
DELAY    = 0.8   # 每筆請求間隔（秒），避免觸發 GAS quota


def save_qa(item: dict) -> dict:
    """呼叫 GAS saveHealthEdu API（GET）寫入一筆 QA"""
    params = {
        "action":       "saveHealthEdu",
        "key":          API_KEY,
        "category":     item.get("category", ""),
        "question":     item.get("question", ""),
        "answer":       item.get("answer", ""),
        "videoUrl":     item.get("video_url", ""),
        "active":       "true" if item.get("active", True) else "false",
        "displayOrder": str(item.get("display_order", 99)),
        "daysFrom":     str(item.get("days_from", "")),
        "daysTo":       str(item.get("days_to", "")),
        "pdfUrl":       item.get("pdf_url", ""),
    }

    url = GAS_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url)

    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body)


def main():
    with open(QA_FILE, encoding="utf-8") as f:
        items = json.load(f)

    total   = len(items)
    success = 0
    failed  = []

    print(f"準備匯入 {total} 筆衛教 QA…\n")

    for idx, item in enumerate(items, 1):
        q_preview = item.get("question", "")[:30]
        print(f"[{idx:02d}/{total}] {item.get('category', '')} — {q_preview}…", end=" ", flush=True)

        try:
            result = save_qa(item)
            if result.get("success") or result.get("status") == "ok":
                print("✅")
                success += 1
            else:
                print(f"❌  回傳：{result}")
                failed.append((idx, q_preview, result))
        except Exception as e:
            print(f"❌  例外：{e}")
            failed.append((idx, q_preview, str(e)))

        time.sleep(DELAY)

    print(f"\n完成！成功 {success} / {total} 筆")

    if failed:
        print(f"\n失敗清單（共 {len(failed)} 筆）：")
        for no, q, err in failed:
            print(f"  [{no:02d}] {q}  →  {err}")


if __name__ == "__main__":
    main()
