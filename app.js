/**
 * LNY Insurance Advisor - Core Engine & Interactive UI
 */

let termData = null;
let payLifeData = null;
let currentSlideIndex = 0;
let slideInterval = null;
let healthCiHeroRates = null;

// ข้อมูลจำลองสำหรับการค้นหาและดักจับความต้องการ (Search Intent)
const searchDatabase = [
    { keywords: ['รถ', 'รถยนต์', 'เก๋ง', 'กระบะ', 'พ.ร.บ.', 'พรบ', 'ต่อภาษี', 'anc', 'gettgo'], target: 'popup-motor', label: '🚗 ประกันรถยนต์ & ต่อ พ.ร.บ. ออนไลน์' },
    { keywords: ['เดินทาง', 'เที่ยว', 'ต่างประเทศ', 'ตั๋ว', 'วีซ่า', 'เชงเก้น', 'msig travel', 'บิน'], target: 'popup-travel', label: '✈️ ประกันการเดินทางต่างประเทศ' },
    { keywords: ['บ้าน', 'อัคคีภัย', 'ไฟไหม้', 'น้ำท่วม', 'คอนโด', 'รีไฟแนนซ์', 'refinance', 'บ้านแทนรัก', 'lh bank'], target: 'popup-home', label: '🏠 ประกันอัคคีภัยบ้าน & สินเชื่อรีไฟแนนซ์' },
    { keywords: ['มะเร็ง', 'โรคร้าย', 'สุขภาพ', 'อุบัติเหตุ', 'pa', 'รักษา', 'วิริยะ', 'scb protect'], target: 'popup-health', label: '🩺 ประกันมะเร็ง & โรคร้ายแรง' },
    { keywords: ['aia', 'คำนวณเบี้ย', '20pay', 'term', 'ตลอดชีพ', 'ลดหย่อนภาษี', 'wp'], target: 'popup-aia-plans', label: '🏢 ระบบคำนวณเบี้ยประกันชีวิต AIA' },
    { keywords: ['ตัวแทน', 'บรรจง', 'ทหารเรือ', 'คปภ', 'ปรึกษา', 'เบอร์โทร', 'ไลน์'], target: 'popup-contact', label: '🛡️ ติดต่อตัวแทนฝ่ายขาย AIA' },
    { keywords: ['ผัง', 'แบบประกัน', 'สารบัญ', 'สัญญาหลัก', 'สัญญาเพิ่มเติม'], target: 'popup-aia-catalog', label: '📑 ผังโครงสร้างแบบประกัน AIA' }
];

document.addEventListener('DOMContentLoaded', () => {
    // 1. โหลดข้อมูลคำนวณเบี้ยประกัน AIA
    Promise.all([
        fetch('data/aia-term-rates.json').then(r => r.json()).catch(() => fetch('aia-term-rates.json').then(r => r.json())),
        fetch('data/aia-paylife-rates.json').then(r => r.json()).catch(() => fetch('aia-paylife-rates.json').then(r => r.json()))
    ]).then(([termRes, payLifeRes]) => {
        termData = termRes;
        payLifeData = payLifeRes;
        initAiaCalculator();
    }).catch(err => {
        console.error("ไม่สามารถโหลดไฟล์อัตราเบี้ยได้:", err);
    });

    // 2. เริ่มการทำงานของ Slider วนลูป
    initHeroSlider();

    // 3. เริ่มการทำงานของระบบค้นหา 2-in-1
    initSmartSearch();

    // 4. ตรวจจับ URL Parameter (?open=xxx) ดักเปิดจาก Google
    const urlParams = new URLSearchParams(window.location.search);
    const target = urlParams.get('open');
    if (target) {
        const popupMap = {
            'motor': 'popup-motor',
            'travel': 'popup-travel',
            'home': 'popup-home',
            'health': 'popup-health',
            'contact': 'popup-contact',
            'aia': 'popup-aia-plans'
        };
        if (popupMap[target]) openPopup(popupMap[target]);
    }
});

/* ========================================================
   1. ระบบ SLIDER วนลูปอัตโนมัติ (Hero Carousel)
   ======================================================== */
function initHeroSlider() {
    startSlideAutoPlay();

    const sliderStage = document.querySelector('.slider-stage-75');
    if (sliderStage) {
        sliderStage.addEventListener('mouseenter', () => clearInterval(slideInterval));
        sliderStage.addEventListener('mouseleave', () => startSlideAutoPlay());
    }
}

function showSlide(index) {
    const slides = document.querySelectorAll('.slide-card');
    const dots = document.querySelectorAll('.dot');
    if (slides.length === 0) return;

    if (index >= slides.length) currentSlideIndex = 0;
    else if (index < 0) currentSlideIndex = slides.length - 1;
    else currentSlideIndex = index;

    slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === currentSlideIndex);
    });

    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlideIndex);
    });
}

function nextSlide() {
    showSlide(currentSlideIndex + 1);
}

function prevSlide() {
    showSlide(currentSlideIndex - 1);
}

function goToSlide(index) {
    showSlide(index);
}

function startSlideAutoPlay() {
    clearInterval(slideInterval);
    slideInterval = setInterval(() => {
        nextSlide();
    }, 4500); // เลื่อนทุก 4.5 วินาที
}

/* ========================================================
   2. ระบบค้นหาอัจฉริยะ (Smart Search Capsule)
   ======================================================== */
function initSmartSearch() {
    const searchInput = document.getElementById('main-search-input');
    const suggestBox = document.getElementById('search-suggest-box');
    const clearBtn = document.getElementById('search-clear-btn');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (query.length > 0) {
            clearBtn.style.display = 'block';
            const matches = searchDatabase.filter(item => 
                item.keywords.some(k => k.includes(query)) || item.label.toLowerCase().includes(query)
            );
            renderSuggestions(matches);
        } else {
            clearBtn.style.display = 'none';
            suggestBox.style.display = 'none';
        }
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim().toLowerCase();
            const match = searchDatabase.find(item => 
                item.keywords.some(k => k.includes(query)) || item.label.toLowerCase().includes(query)
            );
            if (match) {
                openPopup(match.target);
                clearMainSearch();
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.smart-search-capsule')) {
            if (suggestBox) suggestBox.style.display = 'none';
        }
    });
}

function renderSuggestions(matches) {
    const suggestBox = document.getElementById('search-suggest-box');
    if (matches.length === 0) {
        suggestBox.innerHTML = `<div class="suggest-empty">ไม่พบข้อมูล ลองค้นหา: รถยนต์, มะเร็ง, เดินทาง</div>`;
        suggestBox.style.display = 'block';
        return;
    }

    suggestBox.innerHTML = matches.map(m => `
        <div class="suggest-item" onclick="selectSearchTarget('${m.target}')">
            ${m.label}
        </div>
    `).join('');
    suggestBox.style.display = 'block';
}

function selectSearchTarget(targetModal) {
    openPopup(targetModal);
    clearMainSearch();
}

function clearMainSearch() {
    const searchInput = document.getElementById('main-search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    const suggestBox = document.getElementById('search-suggest-box');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    if (suggestBox) suggestBox.style.display = 'none';
}

/* ========================================================
   3. ฟังก์ชันคำนวณเบี้ยประกัน AIA
   ======================================================== */
function calculatePayLifePremium(gender, age, sumInsured) {
    if (!payLifeData) return { error: "กำลังโหลดข้อมูลตารางเบี้ย..." };
    if (age < payLifeData.min_age || age > payLifeData.max_age) {
        return { error: `รับประกันอายุ ${payLifeData.min_age} - ${payLifeData.max_age} ปี` };
    }
    if (sumInsured < payLifeData.min_sum_insured) {
        return { error: `ทุนประกันขั้นต่ำ ${payLifeData.min_sum_insured.toLocaleString()} บาท` };
    }

    let baseRate = payLifeData.rates[gender][age.toString()];
    if (!baseRate) return { error: "ไม่พบอัตราเบี้ยสำหรับอายุนี้" };

    let discount = 0;
    if (sumInsured >= 600000) discount = 2.00;
    else if (sumInsured >= 250000) discount = 1.00;

    let netRate = Math.max(0, baseRate - discount);
    let annualPremium = (sumInsured / 1000) * netRate;

    return {
        discount: discount,
        netRate: netRate,
        annualPremium: Math.round(annualPremium)
    };
}

function calculateTermPremium(planKey, gender, age, sumInsured) {
    if (!termData) return { error: "กำลังโหลดข้อมูลตารางเบี้ย..." };
    const plan = termData.plans[planKey];
    if (!plan) return { error: "ไม่พบข้อมูลแผนประกันที่เลือก" };

    if (age < plan.min_age || age > plan.max_age) {
        return { error: `แผน ${plan.name} รับประกันอายุ ${plan.min_age} - ${plan.max_age} ปี` };
    }
    if (sumInsured < termData.min_sum_insured) {
        return { error: `ทุนประกันขั้นต่ำ ${termData.min_sum_insured.toLocaleString()} บาท` };
    }

    let baseRate = plan.rates[gender] ? plan.rates[gender][age.toString()] : null;
    if (!baseRate) return { error: "ไม่พบอัตราเบี้ยสำหรับอายุนี้" };

    let discount = 0;
    if (sumInsured >= 1000000) discount = 1.00;
    else if (sumInsured >= 500000) discount = 0.50;

    let netRate = Math.max(0, baseRate - discount);
    let annualPremium = (sumInsured / 1000) * netRate;

    return {
        discount: discount,
        netRate: netRate,
        annualPremium: Math.round(annualPremium)
    };
}

function syncAiaPlanView(planKey) {
    const viewPayLife = document.getElementById('view-paylife');
    const viewTerm = document.getElementById('view-term');
    if (!viewPayLife || !viewTerm) return;

    if (planKey === 'pay_life_20') {
        viewPayLife.style.display = 'block';
        viewTerm.style.display = 'none';
    } else {
        viewPayLife.style.display = 'none';
        viewTerm.style.display = 'block';
    }
}

function initAiaCalculator() {
    const planSelect = document.getElementById('aia-plan-select');
    const genderSelect = document.getElementById('aia-gender-select');
    const ageInput = document.getElementById('aia-age-input');
    const sumInput = document.getElementById('aia-sum-input');
    const priceDisplay = document.getElementById('aia-premium-result');
    const noteDisplay = document.getElementById('aia-rate-note');

    if (!planSelect || !ageInput || !priceDisplay) return;

    function runCalculation() {
        const planKey = planSelect.value;
        const gender = genderSelect ? genderSelect.value : 'M';
        const age = parseInt(ageInput.value) || 0;
        const sum = parseFloat(sumInput.value) || 0;

        syncAiaPlanView(planKey);

        let result = (planKey === 'pay_life_20') 
            ? calculatePayLifePremium(gender, age, sum) 
            : calculateTermPremium(planKey, gender, age, sum);

        if (result.error) {
            priceDisplay.textContent = result.error;
            priceDisplay.style.fontSize = '0.85rem';
            priceDisplay.style.color = '#ef4444';
            if (noteDisplay) noteDisplay.textContent = '';
        } else {
            priceDisplay.textContent = result.annualPremium.toLocaleString('th-TH') + ' บ./ปี';
            priceDisplay.style.fontSize = '1.35rem';
            priceDisplay.style.color = '#15803d';
            if (noteDisplay) {
                noteDisplay.textContent = `เรต ${result.netRate.toFixed(2)} บ./พัน (ลด ${result.discount.toFixed(2)})`;
            }
        }
    }

    [planSelect, genderSelect, ageInput, sumInput].forEach(el => {
        if (el) el.addEventListener('input', runCalculation);
    });

    runCalculation();
}

/* ========================================================
   4. ควบคุมการเปิด-ปิด POPUP MODALS
   ======================================================== */
function openPopup(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closePopup(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = 'auto';
    }
});
/* ========================================================
   5. ระบบเปิด-ปิด โบรชัวร์แบบประกัน (PDF Viewer)
   ======================================================== */
   function openBrochurePdf(pdfPath, title) {
       const frame = document.getElementById('pdf-frame');
       const titleEl = document.getElementById('pdf-viewer-title');
       const externalLink = document.getElementById('pdf-open-external');

       if (titleEl) {
           titleEl.textContent = title || '📄 โบรชัวร์แบบประกัน AIA';
       }

       if (externalLink) {
           externalLink.href = pdfPath;
       }

       if (frame) {
           // เติม #toolbar=1&navpanes=0&view=FitH เพื่อ:
           // 1. navpanes=0 -> สั่งปิดแถบ Thumbnail/แถบข้างซ้ายทิ้ง ไม่ให้มาแย่งพื้นที่
           // 2. view=FitH   -> สั่งยืดหน้าเอกสารให้กว้างเต็มกรอบ (Fit Width) พอดีจอทันที
           frame.src = pdfPath + '#toolbar=1&navpanes=0&view=FitH';
       }

       openPopup('popup-pdf-viewer');
   }

   function closePdfViewer() {
       const frame = document.getElementById('pdf-frame');
       if (frame) {
           frame.src = ''; // ล้างค่าเพื่อคืน Memory ให้เบราว์เซอร์
       }
       closePopup('popup-pdf-viewer');
   }

function closePdfViewer() {
    const modal = document.getElementById('popup-pdf-viewer');
    const frame = document.getElementById('pdf-frame');
    if (modal && frame) {
        frame.src = ""; // เคลียร์ไฟล์ออกจากหน้าจอเมื่อปิด
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}
function switchCatalogTab(pillarNumber, clickedBtn) {
    // ซ่อนเนื้อหาทุกหมวด
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`pillar-content-${i}`);
        if (el) el.style.display = 'none';
    }
    // นำคลาส active ออกจากทุกปุ่มแคปซูล
    document.querySelectorAll('.pillar-tab').forEach(btn => btn.classList.remove('active'));

    // แสดงเฉพาะหมวดที่เลือก
    const activeEl = document.getElementById(`pillar-content-${pillarNumber}`);
    if (activeEl) activeEl.style.display = 'block';
    if (clickedBtn) clickedBtn.classList.add('active');
}
// ฟังก์ชันคำนวณเบี้ยกลางตัวเดียว รองรับทุกแผนประกันในระบบ
async function calculatePremium() {
    const planSelect = document.getElementById('aia-plan-select');
    const resultEl = document.getElementById('calculated-premium');
    if (!planSelect) return;

    // 1. ดึงข้อมูลแผนที่เลือก
    const selectedOpt = planSelect.selectedOptions[0];
    if (!selectedOpt) return;

    let rateFile = selectedOpt.dataset.rateFile;
    const rateKey = selectedOpt.dataset.rateKey;

    if (!rateFile) {
        if (resultEl) resultEl.textContent = 'ไม่มีข้อมูลเบี้ย';
        return;
    }

    // 2. ดึงค่า เพศ, อายุ, และทุนประกัน
    const genderSelect = document.getElementById('aia-gender-select');
    const ageInput = document.getElementById('aia-age-input');
    const sumInput = document.getElementById('aia-sum-input');

    if (!genderSelect || !ageInput || !sumInput) return;

    const gender = genderSelect.value; // "M" หรือ "F"
    const age = parseInt(ageInput.value, 10);
    const sumAssured = parseFloat(sumInput.value);

    if (isNaN(age) || isNaN(sumAssured)) {
        if (resultEl) resultEl.textContent = '...';
        return;
    }

    // 3. ปรับ Path ป้องกัน /data/ ซ้อน
    const fetchPath = rateFile.startsWith('/') ? rateFile : ('/data/' + rateFile);

    try {
        const response = await fetch(fetchPath);
        if (!response.ok) {
            console.error("หาไฟล์เรทเบี้ยไม่เจอ:", fetchPath);
            if (resultEl) resultEl.textContent = 'ไม่พบตารางเบี้ย';
            return;
        }

        const rateData = await response.json();
		// ========================================================
		        // [แทรกตรงนี้] 1. ตรวจสอบกรณีเป็นแผนอุบัติเหตุ (คิดตามขั้นอาชีพ)
		        // ========================================================
		        if (rateData.by_occ_class || rateData.rates_by_class || rateData.rate_type === 'occupation') {
		            const occSelect = document.getElementById('aia-occ-class');
		            const occClass = occSelect ? occSelect.value : '1';

		            const ratesTable = rateData.rates_by_class || (rateData.rates && rateData.rates.by_class) || rateData.rates;
		            
		            if (ratesTable && ratesTable[occClass] !== undefined) {
		                const ratePerUnit = parseFloat(ratesTable[occClass]);
		                
		                // ตรวจสอบกรณีขั้นอาชีพที่ไม่รับประกัน (เช่น ขั้น 4 เรตเป็น 0 หรือไม่รับ)
		                if (ratePerUnit <= 0) {
		                    if (resultEl) resultEl.textContent = 'ไม่รับประกันอาชีพนี้';
		                    return;
		                }

		                const rateUnit = rateData.rate_unit || 1000;
		                const finalPrem = (sumAssured / rateUnit) * ratePerUnit;

		                if (resultEl) {
		                    resultEl.textContent = Number(finalPrem).toLocaleString('th-TH') + " บาท";
		                }
		                return; // คำนวณแผนอุบัติเหตุเสร็จแล้ว จบฟังก์ชันทันที ไม่ต้องลงไปตรวจเพศ/อายุ
		            } else {
		                console.error("ไม่พบเรตสำหรับขั้นอาชีพ:", occClass);
		                if (resultEl) resultEl.textContent = 'ไม่พบข้อมูลอาชีพ';
		                return;
		            }
		        }

        // แกะชั้นข้อมูล: รองรับทั้ง rateData.plans, rateData.rates หรือ rateData ตรงๆ
        let activeGroup = rateData;
        if (rateKey) {
            if (rateData.plans && rateData.plans[rateKey]) {
                activeGroup = rateData.plans[rateKey].rates || rateData.plans[rateKey];
            } else if (rateData.rates && rateData.rates[rateKey]) {
                activeGroup = rateData.rates[rateKey];
            } else if (rateData[rateKey]) {
                activeGroup = rateData[rateKey].rates || rateData[rateKey];
            }
        } else {
            activeGroup = rateData.rates || rateData;
        }

        // ค้นหาตารางตามเพศ (รองรับ M, F, male, female, ชาย, หญิง)
        let genderTable = null;
        if (gender === 'M' || gender === 'ชาย') {
            genderTable = activeGroup['M'] || activeGroup['male'] || activeGroup['ชาย'];
        } else {
            genderTable = activeGroup['F'] || activeGroup['female'] || activeGroup['หญิง'];
        }

        if (!genderTable) {
            console.error("ไม่พบคีย์เพศในไฟล์ JSON:", gender);
            if (resultEl) resultEl.textContent = 'ข้อมูลเพศไม่ถูกต้อง';
            return;
        }

        // ค้นหาอัตราเบี้ยตามอายุ (รองรับทั้ง key ตัวเลขและข้อความ)
        const ratePer1000 = genderTable[age] !== undefined ? genderTable[age] : genderTable[String(age)];

        if (ratePer1000 === undefined) {
            if (resultEl) resultEl.textContent = 'ไม่อยู่ในเกณฑ์อายุ';
            return;
        }
		
		// [แทรกตรงนี้] ตรวจสอบโครงสร้างเบี้ยแบบช่วงอายุ (เช่น AIA Health CI Hero)
		        if (rateData.age_brackets && rateData.rates) {
		            const bracket = rateData.age_brackets.find(b => age >= b.range[0] && age <= b.range[1]);
		            if (!bracket) {
		                if (resultEl) resultEl.textContent = 'ไม่อยู่ในเกณฑ์อายุรับประกัน';
		                return;
		            }

		            // ตัดสินกลุ่ม Begin หรือ Balanced (ดึงจาก rateKey หรือชื่อแผน)
		            let variantKey = rateKey || (opt.value && opt.value.includes('balanced') ? 'balanced' : 'begin');
		            let planTier = '2M';
		            if (sumAssured >= 12000000) planTier = '12M';
		            else if (sumAssured >= 6000000) planTier = '6M';
		            else planTier = '2M';

		            const genderCode = (gender === 'M' || gender === 'ชาย') ? 'M' : 'F';
		            const premTable = rateData.rates[variantKey] || rateData.rates['begin'];
		            
		            if (premTable && premTable[genderCode] && premTable[genderCode][planTier]) {
		                const finalPrem = premTable[genderCode][planTier][bracket.key];
		                if (finalPrem !== undefined) {
		                    if (resultEl) resultEl.textContent = Number(finalPrem).toLocaleString('th-TH') + " บาท";
		                    return; // จบการคำนวณของ Health CI Hero ทันที
		                }
		            }
		        }

        // 4. คำนวณเบี้ยพื้นฐาน: (ทุนประกัน / 1000) * อัตราเบี้ย
		// ตรวจสอบหน่วยฐานคำนวณ: ถ้าเป็น HB หรือไฟล์ระบุ rate_unit ให้ใช้ค่านั้น (ถ้าไม่มีให้ใช้ 1000)
		// ถ้าเป็นสัญญาเพิ่มเติมสุขภาพ (เหมาจ่าย) เบี้ยคือค่าตามตารางตรงๆ ไม่ต้องคูณทุน
		// ตรวจสอบหน่วยฐานคำนวณ:
				let premium = 0;
				const currentPlanVal = planSelect.value || '';
				const isMedicalGroup = (typeof selectedSubCategory !== 'undefined' && selectedSubCategory === 'medical');

				// เฉพาะกลุ่มเหมาจ่ายสุขภาพ (Medical) เท่านั้นที่ไม่ต้องคูณทุน
				if (isMedicalGroup && rateData && rateData.rate_unit === 1) {
				    premium = ratePer1000;
				} else {
				    // แผนอื่นๆ รวมถึง Health Cancer คิดตามสูตร: (จำนวนหน่วยหรือทุน / rateUnit) * อัตราเบี้ย
				    const rateUnit = (rateData && rateData.rate_unit) ? rateData.rate_unit : 1000;
				    premium = (sumAssured / rateUnit) * ratePer1000;
				}

        // ตรวจสอบส่วนลดทุนประกันสูง (discount_rules แบบ Array หรือ discount_rule เดี่ยว)
        if (rateData.discount_rules && Array.isArray(rateData.discount_rules)) {
            const sortedRules = [...rateData.discount_rules].sort((a, b) => b.min_sum - a.min_sum);
            for (const rule of sortedRules) {
                if (sumAssured >= rule.min_sum) {
                    premium -= (sumAssured / 1000) * rule.discount_per_1000;
                    break;
                }
            }
        } else if (rateData.discount_rule && sumAssured >= rateData.discount_rule.min_sum) {
            premium -= (sumAssured / 1000) * rateData.discount_rule.discount_per_1000;
        }

        // 5. แสดงผลลัพธ์บนหน้าจอ
        const finalAmount = Math.round(premium);
        if (resultEl) {
            resultEl.textContent = finalAmount.toLocaleString('th-TH') + " บาท";
        }

		// 6. ควบคุมการแสดงปุ่มดูผลประโยชน์สะสมทรัพย์ (โผล่เฉพาะหมวด savings เท่านั้น หมวดอื่นซ่อนทั้งหมด)
		// ควบคุมการแสดงปุ่มดูผลประโยชน์ (เปิดอัตโนมัติเมื่อเป็นกลุ่มสะสมทรัพย์ ปลอดภัย ไม่ Error)
		        const savingsArea = document.getElementById('savingsBenefitArea');
		        if (savingsArea && planSelect) {
		            const currentPlanId = planSelect.value || '';
		            const selectedText = (planSelect.selectedOptions && planSelect.selectedOptions[0]) 
		                ? planSelect.selectedOptions[0].textContent 
		                : '';

		            // ตรวจจับจาก ID, หมวดหมู่ หรือข้อความชื่อแผน
		            const isSavings = currentPlanId === '5pay10' ||
		                              currentPlanId === '15pay25' ||
		                              currentPlanId === 'excellent' ||
		                              currentPlanId === 'lifetime_income' ||
		                              currentPlanId === 'saving_sure' ||
		                              currentPlanId === 'aia_savings_endowment' ||
		                              currentPlanId.toLowerCase().includes('saving') ||
		                              currentPlanId.toLowerCase().includes('endowment') ||
		                              selectedText.includes('สะสมทรัพย์') ||
		                              selectedText.includes('ออมทรัพย์') ||
		                              (typeof currentCategory !== 'undefined' && currentCategory === 'savings');

		            savingsArea.style.display = isSavings ? 'block' : 'none';
		        }
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการคำนวณเบี้ย:", error);
        if (resultEl) resultEl.textContent = 'คำนวณไม่สำเร็จ';
    }
}
// ============================================================
// ระบบตัวกรอง 2 ชั้น (Two-Step Filter Engine)
// ============================================================
let allInsurancePlans = [];      // เก็บแผนทั้งหมดจาก JSON
let selectedMainType = 'main';    // ค่าเริ่มต้น: 'main' (สัญญาหลัก) หรือ 'rider' (สัญญาเพิ่มเติม)
let selectedSubCategory = 'protection'; // ค่าเริ่มต้นหมวดย่อย

// 1. โหลดข้อมูลแผนประกันทั้งหมดมาเก็บไว้ในหน่วยความจำ
async function loadInsurancePlans() {
    const select = document.getElementById('aia-plan-select');
    if (!select) return;

    try {
        const response = await fetch('/data/aia_plans.json');
        if (!response.ok) throw new Error('โหลดไฟล์แผนประกันไม่สำเร็จ');
        
        allInsurancePlans = await response.json();
        
        // สั่งกรองและแสดงผลตามค่าเริ่มต้นทันที
        renderFilteredPlans();

    } catch (err) {
        console.error('Error loading plans:', err);
        select.innerHTML = '<option value="">โหลดข้อมูลแผนประกันไม่สำเร็จ</option>';
    }
}

// 2. ฟังก์ชันเมื่อกดคลิกแท็บใหญ่ (สัญญาหลัก vs สัญญาเพิ่มเติม)
function onTypeTabClick(type) {
    selectedMainType = type;

    const btnMain = document.getElementById('btn-type-main');
    const btnRider = document.getElementById('btn-type-rider');
    const subMainGroup = document.getElementById('subcat-main-group');
    const subRiderGroup = document.getElementById('subcat-rider-group');

    if (type === 'main') {
        // ไฮไลต์ปุ่มสัญญาหลัก
        btnMain.style.background = '#d32f2f';
        btnMain.style.color = '#ffffff';
        btnMain.style.boxShadow = '0 2px 5px rgba(211,47,47,0.3)';

        btnRider.style.background = 'transparent';
        btnRider.style.color = '#495057';
        btnRider.style.boxShadow = 'none';

        // สลับแถบชิปย่อย
        subMainGroup.style.display = 'flex';
        subRiderGroup.style.display = 'none';

        // รีเซ็ตเลือกชิปแรกของฝั่งสัญญาหลัก
        selectedSubCategory = 'protection';
        resetChipStyles(subMainGroup, 0);

    } else {
        // ไฮไลต์ปุ่มสัญญาเพิ่มเติม
        btnRider.style.background = '#d32f2f';
        btnRider.style.color = '#ffffff';
        btnRider.style.boxShadow = '0 2px 5px rgba(211,47,47,0.3)';

        btnMain.style.background = 'transparent';
        btnMain.style.color = '#495057';
        btnMain.style.boxShadow = 'none';

        // สลับแถบชิปย่อย
        subMainGroup.style.display = 'none';
        subRiderGroup.style.display = 'flex';

        // รีเซ็ตเลือกชิปแรกของฝั่งสัญญาเพิ่มเติม (สุขภาพ)
        selectedSubCategory = 'medical';
        resetChipStyles(subRiderGroup, 0);
    }

    renderFilteredPlans();
}

// 3. ฟังก์ชันเมื่อคลิกชิปหมวดย่อย
function onSubCategoryClick(category, element) {
    selectedSubCategory = category;

    // เปลี่ยนสีไฮไลต์ชิปที่ถูกกด
    const parent = element.parentElement;
    const chips = parent.querySelectorAll('.subcat-chip');
    chips.forEach(chip => {
        chip.style.background = '#ffffff';
        chip.style.borderColor = '#ced4da';
        chip.style.color = '#495057';
    });

    element.style.background = '#ffebee';
    element.style.borderColor = '#d32f2f';
    element.style.color = '#d32f2f';

    renderFilteredPlans();
}

// ฟังก์ชันช่วยรีเซ็ตสีของชิป
function resetChipStyles(groupEl, activeIndex) {
    const chips = groupEl.querySelectorAll('.subcat-chip');
    chips.forEach((chip, idx) => {
        if (idx === activeIndex) {
            chip.style.background = '#ffebee';
            chip.style.borderColor = '#d32f2f';
            chip.style.color = '#d32f2f';
        } else {
            chip.style.background = '#ffffff';
            chip.style.borderColor = '#ced4da';
            chip.style.color = '#495057';
        }
    });
}

// 4. กรองและเรนเดอร์รายชื่อแผนลงใน Dropdown ให้ตรงกับหมวดที่เลือก
function renderFilteredPlans() {
    const select = document.getElementById('aia-plan-select');
    if (!select) return;

    select.innerHTML = '';

    // กรองเฉพาะแผนที่ตรงกับ type และ category ที่กำลังเลือกอยู่
    const filtered = allInsurancePlans.filter(p => {
        const matchType = (p.type === selectedMainType);
        const matchCat = (p.category === selectedSubCategory);
        return matchType && matchCat;
    });

    if (filtered.length === 0) {
        select.innerHTML = '<option value="">-- ยังไม่มีแผนในหมวดหมู่นี้ --</option>';
        const resultEl = document.getElementById('calculated-premium');
        if (resultEl) resultEl.textContent = '...';
        return;
    }

    filtered.forEach((plan, index) => {
        const opt = document.createElement('option');
        opt.value = plan.id;
        opt.textContent = plan.name;
        opt.dataset.rateFile = plan.rate_file || '';
        opt.dataset.rateKey = plan.rate_key || '';
        opt.dataset.minAge = plan.min_age !== undefined ? plan.min_age : 0;
        opt.dataset.maxAge = plan.max_age || 65;
        opt.dataset.minSum = plan.min_sum || 100000;
        opt.dataset.desc = plan.desc || '';
		opt.dataset.category = plan.category || '';
	    opt.dataset.byOccClass = plan.by_occ_class ? 'true' : 'false';

        if (index === 0) opt.selected = true;
        select.appendChild(opt);
    });

    onPlanChanged();
    if (typeof calculatePremium === 'function') {
        calculatePremium();
    }
}

// 5. เมื่อเปลี่ยนแผนใน Dropdown (รองรับทั้ง สัญญาหลัก, HB ชดเชยรายวัน, ค่ารักษาพยาบาล/CI Hero และ อุบัติเหตุ)
function onPlanChanged() {
    const select = document.getElementById('aia-plan-select');
    if (!select || !select.selectedOptions.length) return;

    const opt = select.selectedOptions[0];
    const descEl = document.getElementById('plan-description');
    const titleEl = document.getElementById('plan-display-name');

    if (titleEl) titleEl.textContent = opt.textContent;
    if (descEl && opt.dataset.desc) descEl.textContent = opt.dataset.desc;

    const sumInput = document.getElementById('aia-sum-input');
    const sumLabel = document.querySelector('label[for="aia-sum-input"]') || 
                     document.getElementById('lbl-sum-insured');

					 const planVal = (opt.value || '').toLowerCase();
					     const rateType = (opt.dataset && opt.dataset.rateType) ? opt.dataset.rateType.toLowerCase() : '';

					     // 1. เช็กเฉพาะแผนที่คำนวณตามขั้นอาชีพจริงๆ
					     const isOccupationBased = (rateType === 'occupation') || 
					                               (opt.dataset && opt.dataset.byOccClass === 'true') ||
					                               (planVal === 'aia_adb' || planVal === 'aia_add' || planVal === 'aia_ai');

					     // 2. สลับการแสดงผลระหว่างช่องอายุ กับ ขั้นอาชีพ
					     const ageGroup = document.getElementById("ageGroup");
					     const occGroup = document.getElementById("occClassGroup");

					     if (isOccupationBased) {
					         if (ageGroup) ageGroup.style.display = "none";  // ซ่อนช่องอายุ
					         if (occGroup) occGroup.style.display = "block"; // แสดงช่องขั้นอาชีพ
					     } else {
					         if (ageGroup) ageGroup.style.display = "block"; // แสดงช่องอายุตามเดิม (รวมถึง AIA TPD)
					         if (occGroup) occGroup.style.display = "none";  // ซ่อนช่องขั้นอาชีพ
					     }

					     // 3. กำหนดตัวแปรสำหรับตั้งค่าช่องทุนประกันด้านล่าง
					     const isAccident = isOccupationBased;
					     const isTPD = planVal === 'aia_tpd' || planVal.includes('tpd');
						 const isWPCI = planVal === 'aia_wpci' || planVal.includes('wpci');
					     const isCITopUp = planVal === 'aia_ci_top_up' || planVal.includes('top_up');
					     const isCancer = planVal === 'aia_health_cancer' || planVal.includes('cancer');
					     const isHB = (typeof selectedSubCategory !== 'undefined' && selectedSubCategory === 'hb') ||
					                  planVal.includes('hb');
                 
    const isMedical = (typeof selectedSubCategory !== 'undefined' && selectedSubCategory === 'medical') ||
                      planVal.includes('hero') || planVal.includes('happy') ||
                      planVal.includes('saver') || planVal.includes('starter') ||
                      planVal.includes('infinite') || planVal.includes('health');

    if (isCITopUp) {
        alert("⚠️ เงื่อนไขสำคัญ:\nAIA CI Top Up เป็นบันทึกสลักหลัง ต้องทำแนบท้ายสัญญาเพิ่มเติม AIA CI Plus เสมอ โดยจะได้รับความคุ้มครอง 40% ของทุนประกัน AIA CI Plus");

        if (sumLabel) sumLabel.innerText = "ทุนความคุ้มครอง Top Up (หมายเหตุ: ต้องทำคู่กับ CI Plus):";
        if (sumInput) {
            sumInput.readOnly = false;
            sumInput.style.backgroundColor = '#fff3cd';
            sumInput.min = "40000";
            sumInput.max = "5000000";
            sumInput.step = "10000";
            if (parseFloat(sumInput.value) > 5000000 || parseFloat(sumInput.value) < 40000) {
                sumInput.value = 400000;
            }
        }
    } else if (isCancer) {
        // AIA Health Cancer คิดเป็น "หน่วย"
        if (sumLabel) sumLabel.innerText = "จำนวนหน่วยความคุ้มครอง (1 หน่วย = ชีวิต 1 แสน + ชดเชย 1,000 บ./วัน):";
        if (sumInput) {
            sumInput.readOnly = false;
            sumInput.style.backgroundColor = '#ffffff';
            sumInput.min = "1";
            sumInput.max = "30";
            sumInput.step = "1";
            if (parseFloat(sumInput.value) > 30 || parseFloat(sumInput.value) < 1) {
                sumInput.value = 10;
            }
        }
		} else if (isWPCI) {
		        if (sumLabel) sumLabel.innerText = "เบี้ยประกันสัญญาหลักต่อปี (บาท):";
		        if (sumInput) {
		            sumInput.readOnly = false;
		            sumInput.style.backgroundColor = '#ffffff';
		            sumInput.min = "1000";
		            sumInput.max = "1000000";
		            sumInput.step = "500";
		            // กำหนดค่าเริ่มต้นเป็น 10,000 บาท
		            if (parseFloat(sumInput.value) > 1000000 || parseFloat(sumInput.value) < 1000) {
		                sumInput.value = 10000;
		            }
		        }
    } else if (isAccident) {
        // แผนอุบัติเหตุ (ADB, ADD, AI) กำหนดทุนประกัน
        if (sumLabel) sumLabel.innerText = "ทุนประกันอุบัติเหตุที่ต้องการ (บาท):";
        if (sumInput) {
            sumInput.readOnly = false;
            sumInput.style.backgroundColor = '#ffffff';
            sumInput.min = "100000";
            sumInput.max = "10000000";
            sumInput.step = "50000";
            if (parseFloat(sumInput.value) > 10000000 || parseFloat(sumInput.value) < 100000) {
                sumInput.value = 1000000;
            }
        }
    } else if (isHB) {
        if (sumLabel) sumLabel.innerText = "ค่าชดเชยรายวัน (บาท/วัน):";
        if (sumInput) {
            sumInput.min = "100";
            sumInput.max = "10000";
            sumInput.step = "100";
            sumInput.readOnly = false;
            sumInput.style.backgroundColor = '#ffffff';
            if (parseFloat(sumInput.value) > 10000 || parseFloat(sumInput.value) < 100) {
                sumInput.value = 1000;
            }
        }
    } else if (isMedical) {
        if (sumLabel) sumLabel.innerText = "แผนความคุ้มครอง (บาท):";
        if (sumInput) {
            const planSum = opt.dataset.minSum ? parseInt(opt.dataset.minSum, 10) : 5000000;
            sumInput.value = planSum;
            sumInput.readOnly = true;
            sumInput.style.backgroundColor = '#f8f9fa';
        }
    } else {
        // สัญญาหลัก และ CI Plus ปกติ
        if (sumLabel) sumLabel.innerText = "ทุนประกันที่ต้องการ (บาท):";
        if (sumInput) {
            sumInput.readOnly = false;
            sumInput.style.backgroundColor = '#ffffff';
            sumInput.min = "50000";
            sumInput.max = "100000000";
            sumInput.step = "10000";
            if (parseFloat(sumInput.value) > 10000000 || parseFloat(sumInput.value) < 50000) {
                sumInput.value = 350000;
            }
        }
    }

    if (typeof calculatePremium === 'function') {
        calculatePremium();
    }
}
// 6. รันเมื่อหน้าเว็บโหลดเสร็จ
document.addEventListener('DOMContentLoaded', () => {
    loadInsurancePlans();
});
// ฟังก์ชันคำนวณและแสดงผลประโยชน์เงินคืนสะสมทรัพย์แบบไดนามิก
function openSavingsModal() {
    try {
        // --- 1. สกัดและ Sanitized ข้อมูลอินพุต (Strict & Secure Parsing) ---
        const planSelect = document.getElementById('aia-plan-select');
        const sumInput = document.getElementById('aia-sum-input');
        const premDisplay = document.getElementById('calculated-premium');

        const selectedPlanId = (planSelect && typeof planSelect.value === 'string') 
            ? planSelect.value.trim() 
            : '';
        const sum = Math.max(0, parseFloat(sumInput ? sumInput.value : 0) || 0);

        // ดึงเฉพาะตัวเลขจากเบี้ยรายปี ป้องกันอักขระแปลกปลอม
        const rawPrem = premDisplay ? premDisplay.innerText.replace(/[^0-9.]/g, '') : '';
        const annualPrem = Math.max(0, parseFloat(rawPrem) || 0);

        // --- 2. ค้นหาแผนจาก allPlans ด้วย Smart Dynamic Matcher (3 ชั้น) ---
        let plan = null;
        if (typeof allPlans !== 'undefined' && Array.isArray(allPlans) && selectedPlanId) {
            // ชั้นที่ 1: ตรวจสอบ Exact Match จาก ID
            plan = allPlans.find(p => p && p.id === selectedPlanId);

            // ชั้นที่ 2: ตรวจจับคู่แบบ Normalized ID (ตัด/เติม Prefix และเทียบกับ rate_file)
            if (!plan) {
                const cleanId = selectedPlanId.replace(/^aia_/, '').toLowerCase();
                plan = allPlans.find(p => {
                    if (!p || !p.id) return false;
                    const pCleanId = p.id.replace(/^aia_/, '').toLowerCase();
                    return pCleanId === cleanId || 
                           (p.rate_file && p.rate_file.toLowerCase().includes(cleanId));
                });
            }

            // ชั้นที่ 3: จับคู่จาก Option Text ในกรณี ID ไม่ตรงแต่เป็นแผนเดียวกัน
            if (!plan && planSelect && planSelect.selectedOptions.length > 0) {
                const selectedText = planSelect.selectedOptions[0].text.toLowerCase();
                plan = allPlans.find(p => p && p.name && (
                    selectedText.includes(p.name.toLowerCase()) || 
                    p.name.toLowerCase().includes(selectedText)
                ));
            }
        }

        // --- 3. ดึงข้อมูลและกำหนดค่าตัวแปรแบบ Type-Safe ---
        let payYears = (plan && !isNaN(plan.pay_years)) ? Math.max(1, parseInt(plan.pay_years, 10)) : 0;
        let returnPct = (plan && !isNaN(plan.total_return_pct)) ? Math.max(0, parseFloat(plan.total_return_pct)) : 0;
        let cashbackDesc = (plan && typeof plan.cashback_desc === 'string') ? plan.cashback_desc.trim() : '';
        let maturityDesc = (plan && typeof plan.maturity_desc === 'string') ? plan.maturity_desc.trim() : '';

        // --- 4. Smart Regex Extractor (กู้คืนข้อมูลกรณี JSON แผนเดิมยังไม่ได้ระบุ pay_years) ---
        const planName = plan ? plan.name : (planSelect && planSelect.selectedOptions.length > 0 ? planSelect.selectedOptions[0].text : '');
        
        if (payYears === 0) {
            const matchPay = planName.match(/ชำระ(?:เบี้ย)?\s*(\d+)\s*ปี/) || planName.match(/(\d+)Pay/i);
            payYears = matchPay ? parseInt(matchPay[1], 10) : 1;
        }

        // Fallback ค่า % คืน และคำอธิบายตามโครงสร้างแผนที่ระบบรู้จัก หากใน JSON ยังไม่ได้ระบุ
        if (returnPct === 0) {
            const normCheck = (selectedPlanId + ' ' + planName).toLowerCase();
            if (normCheck.includes('15_25') || normCheck.includes('15pay25') || normCheck.includes('15/25')) {
                payYears = 15;
                returnPct = 145;
                if (!cashbackDesc) cashbackDesc = '• เงินคืน 1% ทุกสิ้นปีกรมธรรม์ที่ 1–24 (รวม 24%)';
                if (!maturityDesc) maturityDesc = '• เงินครบกำหนดสัญญาปีที่ 25 รับ 121%';
            } else if (normCheck.includes('sure')) {
                payYears = 10;
                returnPct = 820;
                if (!cashbackDesc) cashbackDesc = '• รับเงินคืนรายงวดตั้งแต่อายุ 60 - 98 ปี รวม 720%';
                if (!maturityDesc) maturityDesc = '• รับเงินก้อนเมื่อครบกำหนดสัญญา ณ อายุ 99 ปี อีก 100%';
            } else if (normCheck.includes('5pay10') || normCheck.includes('5_10') || normCheck.includes('endowment')) {
                payYears = 5;
                returnPct = 500;
                if (!cashbackDesc) cashbackDesc = '• เงินคืน 4% ทุกสิ้นปีกรมธรรม์ที่ 2–9 (รับ 8 ครั้ง รวม 32%)';
                if (!maturityDesc) maturityDesc = '• เงินครบกำหนดสัญญาปีที่ 10 รับ 468%';
            } else if (normCheck.includes('excellent')) {
                payYears = 20;
                returnPct = 340;
                if (!cashbackDesc) cashbackDesc = '• เงินคืน 10% ทุกสิ้นปีกรมธรรม์ที่ 4, 8, 12, 16 (รวม 40%)';
                if (!maturityDesc) maturityDesc = '• เงินครบกำหนดสัญญาปีที่ 20 รับ 300%';
            } else if (normCheck.includes('lifetime')) {
                payYears = 9;
                returnPct = 900;
                if (!cashbackDesc) cashbackDesc = '• รับเงินคืน 1% (ปีที่ 2-10) และ 2% (ปีที่ 11 ถึงอายุ 98 ปี) + สิทธิรับเงินปันผล';
                if (!maturityDesc) maturityDesc = '• รับเงินก้อนการันตีครบสัญญา ณ อายุ 99 ปี สูงสุด 900% + ปันผลเมื่อครบสัญญา';
            }
        }

        // --- 5. คำนวณผลประโยชน์ทางการเงิน (Financial Calculations) ---
        const totalPaid = annualPrem * payYears;
        const totalReturn = (sum * returnPct) / 100;
        const profit = totalReturn - totalPaid;
        const taxDeductible = Math.min(annualPrem, 100000);

        // --- 6. ส่งค่าและอัปเดต UI (DOM Insertion with Safety Checks) ---

        // ชื่อแบบประกัน
        const titleDesc = document.querySelector('#popup-savings-benefit p');
        if (titleDesc) {
            titleDesc.innerText = planName || 'แบบประกันสะสมทรัพย์ AIA';
        }

        // ทุนประกันที่เลือก
        const elSum = document.getElementById('modalSumAssured');
        if (elSum) elSum.innerText = sum.toLocaleString('th-TH');

        // เบี้ยประกันรายปี
        const elAnnual = document.getElementById('modalAnnualPaid');
        if (elAnnual) elAnnual.innerText = annualPrem.toLocaleString('th-TH');

        // รวมเบี้ยชำระตลอดสัญญา
        const elTotalPaid = document.getElementById('modalTotalPaid');
        if (elTotalPaid) {
            elTotalPaid.innerText = `${totalPaid.toLocaleString('th-TH')} บาท (${payYears} ปี)`;
        }

        // เปอร์เซ็นต์ผลตอบแทนรวมตรงหัวข้อ
        const elReturnPct = document.getElementById('modalReturnPct');
        if (elReturnPct) elReturnPct.innerText = returnPct;

        // คำอธิบายเงินคืนระหว่างสัญญา
        const elCashback = document.getElementById('modalCashback');
        if (elCashback) {
            elCashback.innerText = cashbackDesc || 'ตามเงื่อนไขกรมธรรม์';
        }

        // คำอธิบายเงินครบกำหนดสัญญา
        const elMaturity = document.getElementById('modalMaturity');
        if (elMaturity) {
            elMaturity.innerText = maturityDesc || 'ตามเงื่อนไขกรมธรรม์';
        }

        // ยอดรับผลประโยชน์คืนรวมทั้งสิ้น
        const elTotalReturn = document.getElementById('modalTotalReturn');
        if (elTotalReturn) {
            elTotalReturn.innerText = `${totalReturn.toLocaleString('th-TH')} บาท (${returnPct}%)`;
        }

        // ผลประโยชน์เงินคืนมากกว่าเบี้ยที่จ่าย (กำไร)
        const elProfit = document.getElementById('modalProfit');
        if (elProfit) {
            elProfit.innerText = (profit >= 0 ? '+' : '') + profit.toLocaleString('th-TH');
            if (elProfit.parentElement) elProfit.parentElement.style.display = 'block';
        }

        // สิทธิลดหย่อนภาษีต่อปี (ตามเบี้ยจริง เพดาน 100,000 บ.)
        const elTaxAmount = document.getElementById('modalTaxAmount');
        if (elTaxAmount) elTaxAmount.innerText = taxDeductible.toLocaleString('th-TH');

        // จำนวนปีที่ใช้สิทธิลดหย่อนภาษี
        const elTaxYears = document.getElementById('modalTaxYears');
        if (elTaxYears) elTaxYears.innerText = payYears;

        // --- 7. คำสั่งเปิด Popup ---
        if (typeof openPopup === 'function') {
            openPopup('popup-savings-benefit');
        } else {
            const modal = document.getElementById('popup-savings-benefit');
            if (modal) modal.classList.add('active');
        }

    } catch (err) {
        console.error("Critical Error in openSavingsModal:", err);
    }
}

   /* ========================================================
      6. ระบบจัดการและเปิดลิงก์พันธมิตร (Affiliate Product Hub)
      ======================================================== */
   let affiliateProductList = [];

   // 1. โหลดข้อมูลสินค้าพันธมิตรจาก JSON (เพิ่ม Path /web/data/ และตัว Fallback ครบทุกมิติ)
   async function loadAffiliateProducts() {
       const pathsToTry = [
           'data/affiliate_products.json',
           '/data/affiliate_products.json',
           'affiliate_products.json',
           '/web/data/affiliate_products.json'
       ];

       for (const p of pathsToTry) {
           try {
               const res = await fetch(p);
               if (res.ok) {
                   affiliateProductList = await res.json();
                   console.log(`✅ โหลดข้อมูลสำเร็จจาก Path: ${p} (พบ ${affiliateProductList.length} รายการ)`);
                   return; // โหลดเจอแล้ว ออกจากฟังก์ชันทันที
               }
           } catch (e) {
               // ลอง path ถัดไป
           }
       }
       console.error("❌ หาไฟล์ affiliate_products.json ไม่พบในทุก Path");
   }

   // 2. ฟังก์ชันเปิดลิงก์ปลอดภัย (พร้อมแสดง Alert แจ้งเตือนหากหาไอดีไม่เจอ จะได้รู้จุดผิดพลาดทันที)
   function openAffiliateProduct(productId) {
       if (!affiliateProductList || affiliateProductList.length === 0) {
           alert("กำลังโหลดข้อมูลลิงก์พันธมิตร กรุณารอสักครู่แล้วลองใหม่อีกครั้ง");
           loadAffiliateProducts();
           return;
       }

       // ค้นหาสินค้าจาก id
       const product = affiliateProductList.find(item => item && item.id === productId);

       if (product) {
           // หากมีลิงก์และไม่ใช่ '#' ให้เปิดลิงก์จริง
           if (product.link && product.link.trim() !== '' && product.link !== '#') {
               window.open(product.link, '_blank');
           } 
           // หากลิงก์ว่างหรือยังเป็น '#' ให้สลับไปเปิด Fallback URL ทันที
           else if (product.fallback && product.fallback.trim() !== '') {
               window.open(product.fallback, '_blank');
           } else {
               alert(`ขออภัย แคมเปญ "${product.title || productId}" กำลังอยู่ระหว่างการปรับปรุงลิงก์`);
           }
       } else {
           // ถ้าขึ้นเตือนข้อความนี้ แสดงว่าชื่อ id ในปุ่ม ไม่ตรงกับ id ในไฟล์ JSON
           alert(`ไม่พบรหัสสินค้า: "${productId}" ในระบบ กรุณาตรวจสอบ id ใน affiliate_products.json`);
           console.warn("รายการ ID ที่มีอยู่ในระบบขณะนี้:", affiliateProductList.map(x => x.id));
       }
   }

   // สั่งโหลดข้อมูลทันที
   loadAffiliateProducts();