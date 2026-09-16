import json
import os
import datetime

# 1. 기존 데이터 불러오기 (경로 주의: data 폴더 내부)
file_path = 'data/companies.json'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
except FileNotFoundError:
    data = [ ]

# 2. 크롤링 로직 (여기서는 예시 데이터를 생성합니다)
# 실제 적용 시에는 BeautifulSoup이나 requests를 이용해 채용 사이트 데이터를 가져옵니다.
today = datetime.datetime.now().strftime("%Y-%m-%d")
new_job = {
    "id": f"job_{today}",
    "company_name": "글로벌 반도체 기업 (업데이트 테스트)",
    "role": "회로 설계 및 신호 처리 엔지니어",
    "dday": "2026-10-31",
    "news": "차세대 시스템 반도체 공정 라인 증설",
    "updated_at": today
}

# 기존 데이터 맨 앞에 새로운 공고 추가
if isinstance(data, dict) and "companies" in data:
    data["companies"].insert(0, new_job)
elif isinstance(data, list):
    data.insert(0, new_job)
else:
    data = [new_job]

# 3. JSON 파일 업데이트
with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)

print(f"[{today}] 채용 공고 업데이트 완료!")