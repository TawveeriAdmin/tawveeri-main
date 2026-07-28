مبني على System B (الطبقة التي تخدم العميل فعليًا وفق ADR-125).

# TARGET_LIST — قائمة رفع المقارنة (≥2 متجر)

> **المقياس الحاكم لهذه المرحلة:** عدد العائلات القابلة للمقارنة (≥2 متجر معتمد). كل ما يلي مُرتّب بـ(مقارنات جديدة متوقعة ÷ جهد).
> **مصدر كل رقم:** مقيس اليوم 2026-07-28 على قاعدة الإنتاج (قراءة-فقط، pg pooler) — `canonical_products` + `price_history` (طبقة A، حيث التقاطع محلول) و`product_stores` (طبقة B، المخدومة). لا ذاكرة، لا افتراض، إلا حيث يُذكر صراحةً.

---

## 0. خط الأساس المقاس اليوم (قِسه قبل/بعد كل دفعة)

| المقياس | القيمة | المصدر |
|---|---|---|
| عائلات قابلة للمقارنة ≥2 متجر (بين الخمسة الأساسية) | **428** | مقيس اليوم (price_history × canonical) |
| منها بـ3 متاجر فأكثر | **74** | مقيس اليوم |
| **مقارنة دائمة مرئية في System B (`product_stores` ≥2 متجر)** | **0 من 5,543** | مقيس اليوم — كل صف `products` مربوط بمتجر واحد |
| المقارنة التي يراها العميل فعلًا | فقط عبر **تجميع Algolia اللحظي وقت البحث** (`groupSearchProducts`) — هشّ، يعتمد تطابق الأسماء | ADR-125 + مقيس اليوم |

### الاكتشاف الحاسم (يعيد ترتيب الأولويات)
1. **B لا يُنتج أي مقارنة دائمة** (0/5,543). System A يحمل **428 مقارنة محلولة جاهزة** لكنها **محجوبة عن واجهة العميل** (A معزول عن البحث — ADR-125).
2. **الرافعة رقم 1 ليست الاقتناء — بل وصل System A بالبحث.** ذلك يُظهر 428 مقارنة فورًا بصفر عملية سحب. أي اقتناء قبل الوصل = مقارنات تُدفن في A ولا يراها أحد.
3. **صمّام السحب مفتوح لأربعة** (المنيع 8,104 / أمازون 5,698 / إكسترا 5,298 / جرير 3,191 روابط متمايزة) و**نون ضعيف فعلًا (809)**. لكن **التقاطع بينها ضئيل (428)** لأن كل متجر يحمل كتالوجًا مختلفًا قليل التداخل → الاقتناء لرفع المقارنة يجب أن يستهدف **العائلات المتقاطعة**، لا الحجم.
4. أكثر أزواج المتاجر تقاطعًا (مقيس اليوم): إكسترا+المنيع **236**، أمازون+إكسترا 72، إكسترا+جرير 54، أمازون+المنيع 50، المنيع+جرير 45، إكسترا+نون 40، أمازون+جرير 39، أمازون+نون 25.

### قاعدة العمود الأخير ("B مباشرة أم يحتاج A موصولًا؟")
بما أن B فيه **0 مقارنة دائمة**، فإن **كل عائلة في الجزء 1 تحتاج System A موصولًا** لظهور مقارنتها بشكل مضمون (صفحة المنتج/المقارنة تعتمد canonical/A). تجميع البحث اللحظي قد يُظهر بعضها هشًّا إن تطابقت الأسماء في فهرس `products`، لكنه غير مضمون ولا يغطّي صفحة المقارنة. لذلك العمود = **"A"** لكل عائلات الجزء 1.

---

## الجزء 1 — أعلى ~190 عائلة قابلة للمقارنة الآن (المقارنة جاهزة في A، محجوبة)

> **لكل عائلات هذا الجزء:** جهد السحب = **parser جاهز** (مسحوبة ومحلولة أصلًا في price_history) · الظهور = **يحتاج A موصولًا**. النوع: `جديد` = تقاطع 2 (تظهر مقارنة عند الوصل) · `عميق` = تقاطع 3+.
> رموز المتاجر: Am=أمازون · Jr=جرير · Ex=إكسترا · Mn=المنيع · No=نون. "مفقود" = بقية الخمسة (هدف تعميق لاحق).
> ترتيب الفئات = حجم التقاطع. ترتيب الصفوف داخل الفئة = التقاطع ثم الوفّر.

### 1) الجوّالات — mobile (77 قابلة للمقارنة · 26 بثلاثة+)
| العائلة | تقاطع | حاملة الآن | مفقود | وفّر SAR | نوع |
|---|---|---|---|---|---|
| Apple iPhone 16 128GB | 4 | Am/Ex/Mn/Jr | No | 1900 | عميق |
| Apple iPhone 17 256GB | 4 | Am/Ex/Mn/Jr | No | 1250 | عميق |
| Samsung Galaxy A57 128GB | 4 | Am/Ex/Mn/No | Jr | 369 | عميق |
| Samsung Galaxy S25 Ultra 256GB | 3 | Ex/Mn/Jr | Am/No | 2700 | عميق |
| Apple iPhone 16 Pro Max 256GB | 3 | Ex/Mn/Jr | Am/No | 2100 | عميق |
| Samsung Galaxy Z Fold 7 512GB | 3 | Ex/Mn/Jr | Am/No | 2100 | عميق |
| Samsung Galaxy S26 Ultra 256GB | 3 | Ex/Mn/Jr | Am/No | 1700 | عميق |
| Samsung Galaxy Z Fold 7 256GB | 3 | Ex/Mn/Jr | Am/No | 1600 | عميق |
| Apple iPhone 16 Plus 256GB | 3 | Ex/Mn/Jr | Am/No | 1600 | عميق |
| Apple iPhone Air 1024GB | 3 | Ex/Mn/Jr | Am/No | 1450 | عميق |
| Apple iPhone 17 Pro Max 512GB | 3 | Ex/Mn/Jr | Am/No | 1300 | عميق |
| Apple iPhone 16 256GB | 3 | Am/Ex/Mn | Jr/No | 900 | عميق |
| Apple iPhone 15 128GB | 3 | Am/Ex/Mn | Jr/No | 849 | عميق |
| Apple iPhone 17 Pro Max 256GB | 3 | Am/Mn/Jr | Ex/No | 700 | عميق |
| Samsung Galaxy A56 256GB | 3 | Am/Ex/No | Jr/Mn | 296 | عميق |
| Apple iPhone 12 128GB | 3 | Am/Ex/Jr | Mn/No | 259 | عميق |
| Samsung Galaxy S26 Ultra 512GB | 3 | Ex/Mn/Jr | Am/No | 700 | عميق |
> ملاحظة mobile: **نون مفقود في ~16/17** — أكبر فرصة تعميق مفردة في المنصّة.

### 2) التلفزيونات — tv (63 · 6 بثلاثة+)
| العائلة | تقاطع | حاملة الآن | مفقود | وفّر SAR | نوع |
|---|---|---|---|---|---|
| Samsung 65" 4K OLED 120Hz | 3 | Ex/Mn/Jr | Am/No | 1700 | عميق |
| TCL 75" 4K QLED 60Hz | 3 | Ex/Jr/No | Am/Mn | 1000 | عميق |
| TCL 75" 4K Mini-LED 144Hz | 3 | Am/Ex/No | Jr/Mn | 563 | عميق |
| TCL 65" 4K QLED 60Hz | 3 | Ex/Jr/No | Am/Mn | 450 | عميق |
| TCL 55" 4K QLED 60Hz | 3 | Ex/Jr/No | Am/Mn | 300 | عميق |
| Samsung QA77S90H (77" OLED) | 3 | Am/Ex/Mn | Jr/No | 300 | عميق |
| Samsung 75" Neo-QLED 120Hz | 2 | Am/Ex | Jr/Mn/No | 3900 | جديد |
| Samsung 77" 4K OLED 120Hz | 2 | Am/Ex | Jr/Mn/No | 2500 | جديد |
| Samsung MRA85R85H (85") | 2 | Ex/Mn | Am/Jr/No | 2500 | جديد |
| Samsung MRA75R85H (75") | 2 | Ex/Mn | Am/Jr/No | 2500 | جديد |
| LG 86" 4K QNED 144Hz | 2 | Am/Ex | Jr/Mn/No | 1900 | جديد |
| Samsung QA75QN80H | 2 | Ex/Mn | Am/Jr/No | 1700 | جديد |
| Samsung QA65QN80H | 2 | Ex/Mn | Am/Jr/No | 1400 | جديد |
| TCL 85" 4K QLED 60Hz | 2 | Ex/No | Am/Jr/Mn | 1200 | جديد |
| LG OLED65B56LA | 2 | Ex/Mn | Am/Jr/No | 1000 | جديد |

### 3) الأجهزة اللوحية — tablet (53 · 7 بثلاثة+)
| العائلة | تقاطع | حاملة الآن | مفقود | وفّر SAR | نوع |
|---|---|---|---|---|---|
| Samsung Tab SM-X620 | 3 | Ex/Mn/No | Am/Jr | 375 | عميق |
| Honor Pad 10 12.1" 256GB | 3 | Am/Ex/Jr | Mn/No | 234 | عميق |
| Samsung Tab SM-X236 | 3 | Ex/Mn/No | Am/Jr | 219 | عميق |
| Samsung Tab SM-X230 (999) | 3 | Ex/Mn/No | Am/Jr | 200 | عميق |
| Samsung Tab SM-X230 (1199) | 3 | Ex/Mn/No | Am/Jr | 184 | عميق |
| Huawei MatePad 256GB Wi-Fi | 3 | Am/Ex/No | Jr/Mn | 71 | عميق |
| Samsung Tab SM-X133 | 3 | Am/Ex/Mn | Jr/No | 51 | عميق |
| Apple iPad ME7X4AB/A | 2 | Ex/Mn | Am/Jr/No | 1000 | جديد |
| Apple iPad ME7W4AB/A | 2 | Ex/Mn | Am/Jr/No | 1000 | جديد |
| Apple iPad Air M3 11" 128GB | 2 | Am/Ex | Jr/Mn/No | 634 | جديد |
| Samsung Tab SM-X930 (رمادي) | 2 | Ex/Mn | Am/Jr/No | 550 | جديد |
| Samsung Tab SM-X930 (فضي) | 2 | Ex/Mn | Am/Jr/No | 550 | جديد |
| Huawei MatePad 11.5 + Keyboard | 2 | Ex/Jr | Am/Mn/No | 499 | جديد |
| Samsung Galaxy Tab S11 128GB 5G | 2 | Ex/No | Am/Jr/Mn | 486 | جديد |
| Apple iPad Mini Gen7 128GB | 2 | Am/Ex | Jr/Mn/No | 485 | جديد |

### 4) الغسّالات — washing_machine (48 · 11 بثلاثة+)
| العائلة | تقاطع | حاملة الآن | مفقود | وفّر SAR | نوع |
|---|---|---|---|---|---|
| Toshiba top-load 15kg | 3 | Am/Ex/Mn | Jr/No | 1909 | عميق |
| LG front-load 9kg | 3 | Am/Ex/Mn | Jr/No | 1309 | عميق |
| LG top-load 24kg | 3 | Am/Ex/Mn | Jr/No | 1300 | عميق |
| Toshiba top-load 10kg | 3 | Am/Ex/Mn | Jr/No | 1209 | عميق |
| Samsung top-load 16kg | 3 | Am/Ex/Mn | Jr/No | 1190 | عميق |
| Toshiba top-load 7kg | 3 | Am/Ex/Mn | Jr/No | 999 | عميق |
| LG front-load 7kg | 3 | Am/Ex/Mn | Jr/No | 899 | عميق |
| Samsung top-load 13kg | 3 | Am/Ex/Mn | Jr/No | 875 | عميق |
| Samsung front-load washer/dryer 9kg | 3 | Am/Ex/Mn | Jr/No | 800 | عميق |
| Samsung front-load 21kg | 3 | Am/Ex/Mn | Jr/No | 600 | عميق |
| Hisense front-load 8kg | 3 | Am/Ex/Mn | Jr/No | 102 | عميق |
| LG front-load washer/dryer 13kg | 2 | Ex/Mn | Am/Jr/No | 4099 | جديد |
| LG front-load washer/dryer 21kg | 2 | Ex/Mn | Am/Jr/No | 4000 | جديد |
| Samsung top-load 18kg | 2 | Ex/Mn | Am/Jr/No | 1246 | جديد |
| LG top-load 19kg | 2 | Ex/Mn | Am/Jr/No | 980 | جديد |

### 5) المكيّفات — air_conditioner (34 · 3 بثلاثة+)
| العائلة | تقاطع | حاملة الآن | مفقود | وفّر SAR | نوع |
|---|---|---|---|---|---|
| LG Split 18000 Inverter cool | 3 | Ex/Mn/No | Am/Jr | 2549 | عميق |
| LG Split 18000 Standard cool | 3 | Ex/Mn/No | Am/Jr | 2040 | عميق |
| Gree Window 21800 Standard cool | 3 | Ex/Mn/No | Am/Jr | 440 | عميق |
| Samsung WindFree Split 20500 Inv h/c | 2 | Ex/Mn | Am/Jr/No | 4459 | جديد |
| LG Split 18000 Inverter h/c | 2 | Ex/No | Am/Jr/Mn | 3630 | جديد |
| Gree Split 18000 Inverter cool | 2 | Ex/Mn | Am/Jr/No | 3515 | جديد |
| Samsung WindFree Split 17500 Inv h/c | 2 | Ex/Mn | Am/Jr/No | 2163 | جديد |
| LG Split 22100 Inverter cool | 2 | Ex/Mn | Am/Jr/No | 1970 | جديد |
| Gree Split 18000 Inverter h/c | 2 | Ex/Mn | Am/Jr/No | 1384 | جديد |
| Gree Split 12000 Inverter h/c | 2 | Ex/Mn | Am/Jr/No | 1279 | جديد |
| LG FreshDV Split 18000 Inv cool | 2 | Ex/Mn | Am/Jr/No | 1220 | جديد |
| LG FreshDV Split 21000 Inv h/c | 2 | Ex/Mn | Am/Jr/No | 1213 | جديد |
| Gree Window 18000 Inverter cool | 2 | Ex/No | Am/Jr/Mn | 1200 | جديد |
| Midea Window 18000 Inverter cool | 2 | Ex/No | Am/Jr/Mn | 820 | جديد |
| White Westinghouse Window 21800 | 2 | Ex/Mn | Am/Jr/No | 802 | جديد |
> ملاحظة AC: التقاطع كله **إكسترا/المنيع/نون**؛ أمازون وجرير لا يظهران في أي مكيّف مسحوب → تعميق المكيّفات عبرهما غير مجدٍ (على الأرجح لا يبيعانها بكثافة). الفئة شبه مشبعة بين الثلاثة.

### 6) الشاشات — monitor (33 · 4 بثلاثة+)
| العائلة | تقاطع | حاملة الآن | مفقود | وفّر SAR | نوع |
|---|---|---|---|---|---|
| LG 24" FHD 100Hz | 4 | Am/Mn/Jr/No | Ex | 138 | عميق |
| Samsung 27" FHD 180Hz | 4 | Am/Ex/Jr/No | Mn | 80 | عميق |
| LG 27" FHD 180Hz | 3 | Am/Mn/Jr | Ex/No | 281 | عميق |
| LG 27" FHD 100Hz | 3 | Am/Ex/Mn | Jr/No | 150 | عميق |
| LG UltraGear QHD 27" 240Hz | 2 | Ex/Mn | Am/Jr/No | 1000 | جديد |
| Samsung G3 FHD 32" 180Hz | 2 | Ex/Mn | Am/Jr/No | 750 | جديد |
| LG 32" QHD 180Hz | 2 | Ex/Mn | Am/Jr/No | 600 | جديد |
| Samsung Odyssey G5 180Hz | 2 | Ex/Mn | Am/Jr/No | 480 | جديد |
| LG UltraWide 29" WFHD | 2 | Ex/Mn | Am/Jr/No | 250 | جديد |
| Samsung 27" FHD 100Hz IPS | 2 | Am/No | Ex/Jr/Mn | 196 | جديد |
| BenQ 27" QHD 100Hz IPS | 2 | Am/No | Ex/Jr/Mn | 121 | جديد |
| Samsung 24" FHD 100Hz IPS | 2 | Am/No | Ex/Jr/Mn | 109 | جديد |
| LG 32" QHD 180Hz IPS | 2 | Ex/No | Am/Jr/Mn | 100 | جديد |
| Samsung 24" FHD 180Hz | 2 | Ex/Jr | Am/Mn/No | 80 | جديد |
| Dell 24" FHD 100Hz IPS | 2 | Am/No | Ex/Jr/Mn | 79 | جديد |

### 7) الصوت — audio (29 · 8 بثلاثة+)
| العائلة | تقاطع | حاملة الآن | مفقود | وفّر SAR | نوع |
|---|---|---|---|---|---|
| Apple AirPods Pro 3 | 3 | Am/Mn/Jr | Ex/No | 224 | عميق |
| Apple AirPods 4 ANC | 3 | Am/Mn/Jr | Ex/No | 150 | عميق |
| Apple AirPods 4 | 3 | Am/Mn/Jr | Ex/No | 144 | عميق |
| Huawei FreeBuds SE 3 | 3 | Am/Mn/Jr | Ex/No | 81 | عميق |
| JBL Tune 730 | 3 | Mn/Jr/No | Am/Ex | 56 | عميق |
| JBL Go 4 | 3 | Am/Mn/Jr | Ex/No | 46 | عميق |
| Huawei FreeBuds SE 2 | 3 | Am/Mn/Jr | Ex/No | 17 | عميق |
| JBL Clip 5 | 3 | Am/Mn/Jr | Ex/No | 10 | عميق |
| JBL Live 770 | 2 | Mn/No | Am/Ex/Jr | 210 | جديد |
| Huawei FreeClip 2 | 2 | Mn/Jr | Am/Ex/No | 100 | جديد |
| JBL Tune 780 | 2 | Mn/No | Am/Ex/Jr | 80 | جديد |
| Huawei FreeBuds SE 4 | 2 | Mn/Jr | Am/Ex/No | 70 | جديد |
| Huawei FreeClip | 2 | Am/Jr | Ex/Mn/No | 62 | جديد |
| JBL Tune 770 | 2 | Mn/No | Am/Ex/Jr | 56 | جديد |
| JBL Tune 760 | 2 | Mn/No | Am/Ex/Jr | 46 | جديد |

### 8) اللابتوبات — laptop (28 · 1 بثلاثة+)
| العائلة | تقاطع | حاملة الآن | مفقود | وفّر SAR | نوع |
|---|---|---|---|---|---|
| Asus VivoBook Core9 16/512 16" | 3 | Ex/Jr/No | Am/Mn | 500 | عميق |
| HP EliteBook i5-8 8/256 | 2 | Am/No | Ex/Jr/Mn | 1600 | جديد |
| Asus VivoBook Core7 16/512 15.6" | 2 | Jr/No | Am/Ex/Mn | 1550 | جديد |
| Lenovo Yoga 7 2-in-1 U7 16GB | 2 | Ex/Mn | Am/Jr/No | 1100 | جديد |
| HP Core5 16/512 14" | 2 | Jr/No | Am/Ex/Mn | 1000 | جديد |
| Lenovo IdeaPad 3 Ultra7 16/1TB | 2 | Jr/No | Am/Ex/Mn | 700 | جديد |
| Lenovo IdeaPad 3 Ryzen7 8/512 | 2 | Ex/No | Am/Jr/Mn | 650 | جديد |
| HP Core5 8/512 15.6" | 2 | Ex/No | Am/Jr/Mn | 600 | جديد |
| Asus UX8406CA (OLED) | 2 | Ex/Mn | Am/Jr/No | 600 | جديد |
| Lenovo LOQ Ryzen 16/512 RTX3050 | 2 | Am/No | Ex/Jr/Mn | 500 | جديد |
| Dell Core3 8/512 15.6" | 2 | Ex/No | Am/Jr/Mn | 419 | جديد |
| Dell i5-13 8/512 15.6" | 2 | Ex/No | Am/Jr/Mn | 400 | جديد |
| Asus VivoBook Core5 16/512 15.6" | 2 | Jr/No | Am/Ex/Mn | 400 | جديد |
| Lenovo i5-13 8/512 15.6" | 2 | Ex/No | Am/Jr/Mn | 400 | جديد |
> ملاحظة laptop: **نون طرف في ~11/14** من تقاطعات اللابتوب — تعميق نون هنا يخلق مقارنات مباشرة.

### 9) الساعات الذكية — smartwatch (27 · 6 بثلاثة+)
| العائلة | تقاطع | حاملة الآن | مفقود | وفّر SAR | نوع |
|---|---|---|---|---|---|
| Huawei Watch GT 6 46mm | 4 | Am/Ex/Mn/Jr | No | 150 | عميق |
| Samsung Galaxy Watch 8 Classic 46mm | 3 | Ex/Mn/Jr | Am/No | 500 | عميق |
| Huawei Watch 5 42mm | 3 | Ex/Mn/Jr | Am/No | 500 | عميق |
| Samsung Galaxy Watch 8 40mm | 3 | Am/Ex/Jr | Mn/No | 230 | عميق |
| Apple Watch 11 46mm | 3 | Am/Mn/Jr | Ex/No | 130 | عميق |
| Samsung Galaxy Watch 8 44mm | 3 | Am/Ex/Jr | Mn/No | 120 | عميق |
| Huawei Watch 5 Standard 42mm | 2 | Ex/Mn | Am/Jr/No | 800 | جديد |
| Samsung Galaxy Watch 8 Ultra 2025 | 2 | Ex/Mn | Am/Jr/No | 700 | جديد |
| Apple Watch Ultra 49mm Cellular | 2 | Am/Ex | Jr/Mn/No | 379 | جديد |
| Huawei Watch Fit 4 Pro | 2 | Ex/Mn | Am/Jr/No | 350 | جديد |
| Samsung Galaxy Watch 3 41mm | 2 | Am/Ex | Jr/Mn/No | 213 | جديد |
| Apple Watch Ultra 3 GPS+Cellular 49mm | 2 | Ex/Mn | Am/Jr/No | 150 | جديد |
| Huawei Watch GT 6 Pro 46mm | 2 | Ex/Mn | Am/Jr/No | 120 | جديد |
> ملاحظة smartwatch (تصحيح لملاحظة سابقة): جرير وإكسترا **يظهران بكثافة** في ساعات Samsung/Huawei/Apple. ما كان ضعيفًا هو **Apple Watch تحديدًا** (أجسام أمازون فقط)؛ لكن الفئة ككل متقاطعة جيدًا.

### 10) الطابعات — printer (12 · 2 بثلاثة+)
| العائلة | تقاطع | حاملة الآن | مفقود | وفّر SAR | نوع |
|---|---|---|---|---|---|
| HP LaserJet M141w | 3 | Am/Mn/Jr | Ex/No | 220 | عميق |
| Canon PIXMA G3410 | 3 | Am/Mn/Jr | Ex/No | 80 | عميق |
| Epson EcoTank L3252 | 2 | Am/Jr | Ex/Mn/No | 90 | جديد |
| Canon PIXMA TS5340a | 2 | Am/Mn | Ex/Jr/No | 84 | جديد |
| HP Smart Tank 725 | 2 | Am/Jr | Ex/Mn/No | 76 | جديد |
| HP DeskJet 2320 | 2 | Am/Mn | Ex/Jr/No | 70 | جديد |
| HP OfficeJet 9730 | 2 | Mn/Jr | Am/Ex/No | 50 | جديد |
| HP LaserJet M111w | 2 | Am/Jr | Ex/Mn/No | 30 | جديد |
| HP DeskJet 5127 | 2 | Mn/Jr | Am/Ex/No | 30 | جديد |
| Canon PIXMA TS3640 | 2 | Mn/Jr | Am/Ex/No | 20 | جديد |

### 11) الثلاجات — refrigerator (11 · 0 بثلاثة+)
| العائلة | تقاطع | حاملة الآن | مفقود | وفّر SAR | نوع |
|---|---|---|---|---|---|
| LG Side-by-Side 510L Inverter | 2 | Ex/Mn | Am/Jr/No | 7200 | جديد |
| Samsung Single-Door 380L Inverter | 2 | Ex/Mn | Am/Jr/No | 1050 | جديد |
| LG Top-Mount 400L Inverter | 2 | Am/Mn | Ex/Jr/No | 435 | جديد |
| Samsung Top-Mount 460L | 2 | Am/Mn | Ex/Jr/No | 356 | جديد |
| Samsung Top-Mount 390L | 2 | Am/Mn | Ex/Jr/No | 350 | جديد |
| Hisense Side-by-Side 530L Inverter | 2 | Am/Mn | Ex/Jr/No | 200 | جديد |
| Samsung Top-Mount 620L Inverter | 2 | Am/Mn | Ex/Jr/No | 195 | جديد |
| Hisense Top-Mount 250L Inverter | 2 | Ex/Mn | Am/Jr/No | 160 | جديد |
| Hisense Single-Door 600L Inverter | 2 | Ex/Mn | Am/Jr/No | 100 | جديد |
| LG Single-Door 380L Inverter | 2 | Ex/Mn | Am/Jr/No | 100 | جديد |
| Midea Side-by-Side 510L Inverter | 2 | Am/Ex | Jr/Mn/No | 65 | جديد |

### 12) غسّالات الصحون — dishwasher (5 · 0 بثلاثة+)
| العائلة | تقاطع | حاملة الآن | مفقود | وفّر SAR | نوع |
|---|---|---|---|---|---|
| LG Built-in 14 place-settings | 2 | Ex/Mn | Am/Jr/No | 1000 | جديد |
| Toshiba 14 place-settings | 2 | Ex/Mn | Am/Jr/No | 900 | جديد |
| Toshiba 16 place-settings | 2 | Ex/Mn | Am/Jr/No | 410 | جديد |
| LG 14 place-settings | 2 | Ex/Mn | Am/Jr/No | 250 | جديد |
| Samsung 14 place-settings | 2 | Ex/Mn | Am/Jr/No | 100 | جديد |

> بقية الـ428 (خارج أعلى ~190 المعروضة): vacuum 3، camera 3، kettle 1، microwave 1 — قابلة للمقارنة لكن حجمها ضئيل؛ تُوصل ضمن نفس دفعة وصل A دون جهد إضافي.

---

## الجزء 2 — فرص الاقتناء (توسيع ما بعد الـ428)

> هذه رافعة **ثانية بعد وصل A**. ترتيبها بـ(مقارنات جديدة متوقعة ÷ جهد). كلها parser جاهز (المتجر مُسحب أصلًا)، فالجهد = تعميق تغطية السحب لا بناء جديد.

| الفرصة | لماذا (مقيس اليوم) | مقارنات جديدة متوقعة | الجهد |
|---|---|---|---|
| **تعميق سحب نون** | نون = 809 URL فقط (أضعف الخمسة) رغم أنه ثاني أكبر متجر سعودي؛ وهو **المفقود الأغلب** في mobile (~16/17) و laptop (~11/14). كل عائلة نتقاطع معها بنون = مقارنة جديدة أو تعميق. | عالية — الجوّالات واللابتوبات والشاشات تحديدًا | parser نون جاهز؛ يحتاج توسيع نطاق/فئات السحب فقط |
| **تعميق أمازون/جرير في mobile + tv** | الجوّالات الرائدة (S25/S26 Ultra، iPhone Pro Max) متقاطعة Ex/Mn/Jr لكن **أمازون مفقود** فيها؛ والتلفزيونات كثير منها Ex فقط + متجر. | متوسطة-عالية | parser جاهز؛ توسيع تغطية الفئة |
| **Apple Watch تحديدًا** | أجسام Apple Watch مسعّرة من **أمازون فقط** (بقية الساعات متقاطعة جيدًا). سحب جرير/إكسترا لأجسام Apple Watch = مقارنات مباشرة. | منخفضة-متوسطة (فئة ضيقة) | parser جاهز |
| لولو / شرف دي جي | يظهران في price_history لكن بحجم/تقاطع ضئيل؛ **لا يُبنى عليهما أولوية** (توجيه المؤسس). يُذكران فقط عند ظهور تقاطع. | منخفضة | — |

> **قيد حاكم (مقيس):** المكيّفات والثلاجات وغسّالات الصحون متقاطعة أساسًا بين **إكسترا/المنيع** فقط؛ أمازون/جرير/نون قلّما يحملونها مسحوبة → الاقتناء فيها لن يرفع المقارنة كثيرًا (الفئة مشبعة أو المتاجر لا تبيعها بكثافة). **لا تصرف جهد اقتناء عليها.**

---

## الجزء 3 — مؤجّل (لا تقاطع)

~**5,113 عائلة أحادية المتجر** (canonical بمتجر أساسي واحد فقط: 5,541 − 428). مهما كان طلبها، سحب متجر واحد إضافي لا يخلق مقارنة **إلا** إن تقاطع مع متجر آخر يحمل نفس الهوية. لا تُصرف عليها أولوية اقتناء الآن. تُعاد تقييمها فقط إذا كشف probe تقاطعًا جديدًا.

---

## الخلاصة التنفيذية (المقياس الحاكم)

1. **الرافعة #1 (صفر اقتناء): وصل System A بالبحث** → يرفع المقارنة المرئية من **≈0 دائمة → 428 فورًا**. هذا يسبق أي سحب.
2. **الرافعة #2 (اقتناء موجّه): تعميق نون** (mobile/laptop/monitor) ثم أمازون في mobile/tv الرائدة.
3. **لا تصرف اقتناء على:** المكيّفات/الثلاجات/غسّالات الصحون (مشبعة Ex/Mn)، ولا على العائلات أحادية المتجر.
4. **قِس بعد كل دفعة:** عدد canonical بـ≥2 متجر أساسي (اليوم = 428) + عدد `product_stores`/عرض البحث الذي يظهر فعلًا للعميل.

> **تنبيه أمانة:** كل الأرقام أعلاه **مقيسة اليوم** على الإنتاج. بعض صفوف canonical قد تكون تنويعات هوية دقيقة (ظهر تكرار طفيف مثل Galaxy S26 Ultra 512GB مرتين) — لا يغيّر ترتيب الأولويات. لم أنشر شيئًا على الإنتاج ولم أغيّر منطق تصنيف. "وصل System A" و"تعميق السحب" كلاهما يتطلب موافقتك وADR قبل التنفيذ.
