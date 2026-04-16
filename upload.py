import json
import requests

# 替換為你的 Channel Access Token
CHANNEL_ACCESS_TOKEN = 'YOUR_CHANNEL_ACCESS_TOKEN_HERE'

# 檔案設定
JSON_FILE_PATH = './rich_menu.json'
IMAGE_FILE_PATH = './rich_menu_image.jpg' # 請替換為你的圖片檔名 (支援 jpg/png)

HEADERS = {
    'Authorization': f'Bearer {CHANNEL_ACCESS_TOKEN}',
    'Content-Type': 'application/json'
}

def main():
    # ==========================================
    # 步驟 1：上傳 JSON 建立 Rich Menu 並取得 ID
    # ==========================================
    print("1. 正在建立 Rich Menu...")
    with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
        rich_menu_data = json.load(f)

    response = requests.post(
        'https://api.line.me/v2/bot/richmenu',
        headers=HEADERS,
        json=rich_menu_data
    )
    
    if response.status_code != 200:
        print("建立失敗:", response.text)
        return

    rich_menu_id = response.json().get('richMenuId')
    print(f"✅ 建立成功！取得 Rich Menu ID: {rich_menu_id}")

    # ==========================================
    # 步驟 2：上傳 Rich Menu 背景圖片
    # ==========================================
    print("2. 正在上傳背景圖片...")
    with open(IMAGE_FILE_PATH, 'rb') as f:
        image_data = f.read()

    # 根據附檔名決定 Content-Type
    content_type = 'image/jpeg' if IMAGE_FILE_PATH.lower().endswith('.jpg') else 'image/png'
    image_headers = {
        'Authorization': f'Bearer {CHANNEL_ACCESS_TOKEN}',
        'Content-Type': content_type
    }

    img_response = requests.post(
        f'https://api-data.line.me/v2/bot/richmenu/{rich_menu_id}/content',
        headers=image_headers,
        data=image_data
    )

    if img_response.status_code != 200:
        print("圖片上傳失敗:", img_response.text)
        return
    print("✅ 圖片上傳成功！")

    # ==========================================
    # 步驟 3：將此 Rich Menu 設定為所有使用者的預設選單
    # ==========================================
    print("3. 正在設定為預設選單...")
    default_response = requests.post(
        f'https://api.line.me/v2/bot/user/all/richmenu/{rich_menu_id}',
        headers={'Authorization': f'Bearer {CHANNEL_ACCESS_TOKEN}'}
    )

    if default_response.status_code == 200:
        print("✅ 設定預設選單成功！請打開 LINE App 確認。")
    else:
        print("設定預設失敗:", default_response.text)

if __name__ == "__main__":
    main()