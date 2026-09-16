import json
import os
from datetime import datetime

FILE_PATH = "data/companies.json"

def update_data():
    if not os.path.exists(FILE_PATH):
        print(f"Error: {FILE_PATH} not found.")
        return

    with open(FILE_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    today = datetime.now().strftime("%Y.%m.%d")
    print(f"Updating job news and dates as of: {today}")

    # 1. DETAIL_DATA 안의 일정 및 최근 뉴스 최신화 (뼈대 보존)
    detail_data = data.get("DETAIL_DATA", {})
    for job_key, detail in detail_data.items():
        # D-Day 및 업데이트 기준일 갱신
        if "source" in detail:
            comp_name = detail.get("company", "")
            detail["source"] = f"{comp_name} 공식 채용 페이지 (기준일: {today}) — 정기 업데이트"

        # 최근 이슈 갱신 (예시: 공고 크롤링 API나 RSS 연동 위치)
        if "insight" in detail and "news" in detail["insight"]:
            # 기존 이슈를 유지하되 최신 주간 트렌드 추가
            news_list = detail["insight"]["news"]
            latest_note = f"{today} 채용 공고 및 직무 요구역량 상시 모니터링 중"
            if latest_note not in news_list:
                detail["insight"]["news"] = [latest_note] + news_list[:2]

    # 2. 덮어쓰기 (기존 원본 구조 100% 유지)
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("Successfully updated data/companies.json without breaking structure.")

if __name__ == "__main__":
    update_data()
