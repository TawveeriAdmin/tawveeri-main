# Same 24-query set

Historical baseline responses retain their original oracle verdicts. Its oracle predates the final quarantine/condition requirements; do not compare its PASS count as a like-for-like quality score. UNCLASSIFIED means the old response omitted condition, not proof of NEW. All raw responses and Top 3 offers are retained in the JSON artifacts.

## Before

| Query | Results | Top 1 device identity | Condition | SAR | Stores | Observation UTC | Result |
| --- | ---: | --- | --- | ---: | ---: | --- | --- |
| آيفون 18 برو | 3 | apple\|iPhone\|18\|Pro\|512 | UNCLASSIFIED | 6699 | 2 | 2026-10-05T02:46:51.235+00:00 | PASS |
| iPhone 18 Pro | 3 | apple\|iPhone\|18\|Pro\|512 | UNCLASSIFIED | 6699 | 2 | 2026-10-05T02:46:51.235+00:00 | PASS |
| آيفون 17e | 0 | No eligible result | — | — | — | — | missing honest-zero message |
| iPhone 17e | 0 | No eligible result | — | — | — | — | missing honest-zero message |
| آيفون 16 برو | 1 | apple\|iPhone\|16\|Pro\|256 | UNCLASSIFIED | 4799 | 3 | 2026-10-07T07:11:54.626+00:00 | PASS |
| iphone 16 pro | 3 | e8d3afa9-c827-4d04-b8c7-182f0b214a2e | UNCLASSIFIED | 88.74 | 1 | 2026-07-05T17:11:43.187+00:00 | accessory; model mismatch |
| سامسونج S26 | 20 | samsung\|MODEL:SM-S741BZVVMEA | UNCLASSIFIED | 2799 | 3 | 2026-10-05T04:17:09.037+00:00 | model mismatch; eligible model missing Top3 |
| Galaxy S26+ | 16 | samsung\|MODEL:SM-S947BLBIMEA | UNCLASSIFIED | 3139.01 | 3 | 2026-10-05T02:46:51.235+00:00 | model mismatch |
| Galaxy S26 Plus | 1 | c77a2c23-db30-40db-bf1c-5d46ada02287 | UNCLASSIFIED | 3528 | 1 | 2026-09-23T18:12:38.89+00:00 | PASS |
| Galaxy S26 Ultra | 20 | samsung\|MODEL:SM-S948BZWOMEA | UNCLASSIFIED | 4649 | 3 | 2026-10-06T06:04:12.124406+00:00 | PASS |
| سامسونج S25 | 20 | samsung\|MODEL:SM-S938BZBIMEA | UNCLASSIFIED | 2699 | 6 | 2026-10-02T00:55:21.278+00:00 | model mismatch; eligible model missing Top3 |
| Samsung S24 | 20 | samsung\|Galaxy S\|S24\|Ultra\|512 | UNCLASSIFIED | 5899 | 2 | 2026-10-07T07:11:55.747+00:00 | accessory; model mismatch |
| Galaxy S24 Ultra | 2 | 6f446fc0-62d1-4b8b-aa1a-0cbc6e503b00 | UNCLASSIFIED | 69.74 | 1 | 2026-07-05T17:11:53.504+00:00 | accessory; model mismatch |
| جالكسي A56 | 2 | samsung\|Galaxy A\|A56\|Standard\|128 | UNCLASSIFIED | 1399 | 3 | 2026-10-06T18:04:43.611043+00:00 | PASS |
| Pixel 11 | 20 | c307209f-d978-43a1-8e4f-d31ac1a47aa5 | UNCLASSIFIED | 178.997501 | 1 | — | model mismatch |
| بكسل 11 | 4 | 847a605a-c265-441b-b094-0148337bc963 | UNCLASSIFIED | 149.99 | 1 | 2026-07-05T17:09:06.296+00:00 | model mismatch |
| Pixel 9 | 4 | 66e2a2b9-5d0a-463a-9cc9-4bf6b356da26 | UNCLASSIFIED | 29 | 1 | 2026-07-05T17:11:08.352+00:00 | accessory; model mismatch |
| بكسل 9 | 8 | 5346c972-6827-48ad-aa3e-bd75d7056e11 | UNCLASSIFIED | 953.78 | 1 | 2026-07-30T05:06:08.724+00:00 | model mismatch |
| Redmi Note 15 | 10 | xiaomi\|Redmi Note\|15\|Standard\|256 | UNCLASSIFIED | 969 | 5 | 2026-09-30T09:08:18.458+00:00 | model mismatch |
| Redmi Note 14 5G | 5 | 669ee29b-03bf-4dd3-a3e3-a5b72e9a208a | UNCLASSIFIED | 1512 | 3 | 2026-08-06T20:17:13.187+00:00 | model mismatch |
| جوال سامسونج | 20 | samsung\|MODEL:SM-A276BZBIMEA | UNCLASSIFIED | 959 | 4 | 2026-10-05T02:46:51.235+00:00 | PASS |
| هاتف آيفون | 20 | apple\|iPhone\|15\|Standard\|128 | UNCLASSIFIED | 2279 | 4 | 2026-10-06T18:04:43.611043+00:00 | PASS |
| جوال رخيص تحت 1000 | 20 | samsung\|Galaxy A\|A07\|Standard\|64 | UNCLASSIFIED | 286 | 4 | 2026-10-06T18:04:43.611043+00:00 | PASS |
| سامسونج تحت 1500 | 20 | samsung\|Galaxy A\|A36\|Standard\|256 | UNCLASSIFIED | 1049 | 5 | 2026-10-06T18:04:43.611043+00:00 | budget |

## Local release candidate

| Query | Results | Top 1 device identity | Condition | SAR | Stores | Observation UTC | Result |
| --- | ---: | --- | --- | ---: | ---: | --- | --- |
| آيفون 18 برو | 4 | apple\|iPhone\|18\|Pro\|256 | UNKNOWN | 5699 | 2 | 2026-10-05T13:50:18.702+00:00 | PASS |
| iPhone 18 Pro | 4 | apple\|iPhone\|18\|Pro\|256 | UNKNOWN | 5699 | 2 | 2026-10-05T13:50:18.702+00:00 | PASS |
| آيفون 17e | 1 | apple\|iPhone\|17e\|Standard\|256 | UNKNOWN | 3299 | 1 | 2026-10-07T11:57:00.153+00:00 | PASS |
| iPhone 17e | 1 | apple\|iPhone\|17e\|Standard\|256 | UNKNOWN | 3299 | 1 | 2026-10-07T11:57:00.153+00:00 | PASS |
| آيفون 16 برو | 1 | apple\|iPhone\|16\|Pro\|256 | RENEWED | 4799 | 1 | 2026-10-07T07:11:54.626+00:00 | PASS |
| iphone 16 pro | 1 | apple\|iPhone\|16\|Pro\|256 | RENEWED | 4799 | 1 | 2026-10-07T07:11:54.626+00:00 | PASS |
| سامسونج S26 | 12 | samsung\|MODEL:SM-S942BZVPMEA | UNKNOWN | 3949 | 2 | 2026-10-05T04:17:09.037+00:00 | PASS |
| Galaxy S26+ | 11 | samsung\|MODEL:SM-S947BZVOMEA | UNKNOWN | 4199 | 2 | 2026-10-05T04:17:09.037+00:00 | PASS |
| Galaxy S26 Plus | 11 | samsung\|MODEL:SM-S947BZVOMEA | UNKNOWN | 4199 | 2 | 2026-10-05T04:17:09.037+00:00 | PASS |
| Galaxy S26 Ultra | 15 | samsung\|MODEL:SM-S948BLBIMEA | UNKNOWN | 4199 | 2 | 2026-10-05T13:50:18.702+00:00 | PASS |
| سامسونج S25 | 4 | samsung\|MODEL:SM-S931BLGOMEA | UNKNOWN | 2299 | 1 | 2026-10-07T06:44:43.138+00:00 | PASS |
| Samsung S24 | 0 | No eligible result | — | — | — | — | PASS |
| Galaxy S24 Ultra | 1 | samsung\|Galaxy S\|S24\|Ultra\|512 | RENEWED | 5899 | 1 | 2026-10-07T07:11:55.747+00:00 | PASS |
| جالكسي A56 | 1 | samsung\|Galaxy A\|A56\|Standard\|256 | UNKNOWN | 1479 | 1 | 2026-10-07T00:30:52.52+00:00 | PASS |
| Pixel 11 | 0 | No eligible result | — | — | — | — | PASS |
| بكسل 11 | 0 | No eligible result | — | — | — | — | PASS |
| Pixel 9 | 0 | No eligible result | — | — | — | — | PASS |
| بكسل 9 | 0 | No eligible result | — | — | — | — | PASS |
| Redmi Note 15 | 2 | xiaomi\|Redmi Note\|15\|Standard\|256 | UNKNOWN | 999 | 2 | 2026-10-04T18:08:05.754623+00:00 | PASS |
| Redmi Note 14 5G | 0 | No eligible result | — | — | — | — | PASS |
| جوال سامسونج | 20 | samsung\|MODEL:SM-A276BZBIMEA | UNKNOWN | 959 | 2 | 2026-10-05T13:50:18.702+00:00 | PASS |
| هاتف آيفون | 20 | apple\|iPhone\|16\|Standard\|128 | UNKNOWN | 3005.7 | 3 | 2026-10-06T18:32:45.806+00:00 | PASS |
| جوال رخيص تحت 1000 | 20 | samsung\|Galaxy A\|A16\|Standard\|128 | UNKNOWN | 589 | 2 | 2026-10-06T05:51:47.015+00:00 | PASS |
| سامسونج تحت 1500 | 20 | samsung\|Galaxy A\|A16\|Standard\|128 | UNKNOWN | 589 | 2 | 2026-10-06T05:51:47.015+00:00 | PASS |

## Production after deployment

| Query | Results | Top 1 device identity | Condition | SAR | Stores | Observation UTC | Result |
| --- | ---: | --- | --- | ---: | ---: | --- | --- |
| آيفون 18 برو | 4 | apple\|iPhone\|18\|Pro\|256 | UNKNOWN | 5699 | 2 | 2026-10-05T13:50:18.702+00:00 | PASS |
| iPhone 18 Pro | 4 | apple\|iPhone\|18\|Pro\|256 | UNKNOWN | 5699 | 2 | 2026-10-05T13:50:18.702+00:00 | PASS |
| آيفون 17e | 1 | apple\|iPhone\|17e\|Standard\|256 | UNKNOWN | 3299 | 1 | 2026-10-07T11:57:00.153+00:00 | PASS |
| iPhone 17e | 1 | apple\|iPhone\|17e\|Standard\|256 | UNKNOWN | 3299 | 1 | 2026-10-07T11:57:00.153+00:00 | PASS |
| آيفون 16 برو | 1 | apple\|iPhone\|16\|Pro\|256 | RENEWED | 4799 | 1 | 2026-10-07T07:11:54.626+00:00 | PASS |
| iphone 16 pro | 1 | apple\|iPhone\|16\|Pro\|256 | RENEWED | 4799 | 1 | 2026-10-07T07:11:54.626+00:00 | PASS |
| سامسونج S26 | 12 | samsung\|MODEL:SM-S942BZVPMEA | UNKNOWN | 3949 | 2 | 2026-10-05T04:17:09.037+00:00 | PASS |
| Galaxy S26+ | 11 | samsung\|MODEL:SM-S947BZVOMEA | UNKNOWN | 4199 | 2 | 2026-10-05T04:17:09.037+00:00 | PASS |
| Galaxy S26 Plus | 11 | samsung\|MODEL:SM-S947BZVOMEA | UNKNOWN | 4199 | 2 | 2026-10-05T04:17:09.037+00:00 | PASS |
| Galaxy S26 Ultra | 15 | samsung\|MODEL:SM-S948BLBIMEA | UNKNOWN | 4199 | 2 | 2026-10-05T13:50:18.702+00:00 | PASS |
| سامسونج S25 | 4 | samsung\|MODEL:SM-S931BLGOMEA | UNKNOWN | 2299 | 1 | 2026-10-07T06:44:43.138+00:00 | PASS |
| Samsung S24 | 0 | No eligible result | — | — | — | — | PASS |
| Galaxy S24 Ultra | 1 | samsung\|Galaxy S\|S24\|Ultra\|512 | RENEWED | 5899 | 1 | 2026-10-07T07:11:55.747+00:00 | PASS |
| جالكسي A56 | 1 | samsung\|Galaxy A\|A56\|Standard\|256 | UNKNOWN | 1479 | 1 | 2026-10-07T00:30:52.52+00:00 | PASS |
| Pixel 11 | 0 | No eligible result | — | — | — | — | PASS |
| بكسل 11 | 0 | No eligible result | — | — | — | — | PASS |
| Pixel 9 | 0 | No eligible result | — | — | — | — | PASS |
| بكسل 9 | 0 | No eligible result | — | — | — | — | PASS |
| Redmi Note 15 | 2 | xiaomi\|Redmi Note\|15\|Standard\|256 | UNKNOWN | 999 | 2 | 2026-10-04T18:08:05.754623+00:00 | PASS |
| Redmi Note 14 5G | 0 | No eligible result | — | — | — | — | PASS |
| جوال سامسونج | 20 | samsung\|MODEL:SM-A276BZBIMEA | UNKNOWN | 959 | 2 | 2026-10-05T13:50:18.702+00:00 | PASS |
| هاتف آيفون | 20 | apple\|iPhone\|16\|Standard\|128 | UNKNOWN | 3005.7 | 3 | 2026-10-06T18:32:45.806+00:00 | PASS |
| جوال رخيص تحت 1000 | 20 | samsung\|Galaxy A\|A16\|Standard\|128 | UNKNOWN | 589 | 2 | 2026-10-06T05:51:47.015+00:00 | PASS |
| سامسونج تحت 1500 | 20 | samsung\|Galaxy A\|A16\|Standard\|128 | UNKNOWN | 589 | 2 | 2026-10-06T05:51:47.015+00:00 | PASS |
