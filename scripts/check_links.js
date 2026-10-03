const fs = require('fs');
const path = require('path');
const https = require('https');

// 1. อ่านไฟล์ข้อมูลของ Insurance Advisor โดยเฉพาะ
const jsonPath = path.join(__dirname, '../web/data/affiliate_products.json');
let products = [];

try {
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    products = JSON.parse(rawData);
} catch (err) {
    console.error('❌ ไม่พบหรืออ่านไฟล์ JSON ประกันไม่สำเร็จ:', err.message);
    process.exit(1); // ส่งสัญญาณ Error ให้ GitHub ยิงอีเมลแจ้งเตือน
}

// 2. ฟังก์ชันตรวจสอบสถานะของ URL แผนประกัน
function checkUrl(url) {
    return new Promise((resolve) => {
        if (!url || url === '#' || !url.startsWith('http')) {
            return resolve({ status: 0, finalUrl: url, isDead: true, reason: 'URL ไม่ถูกต้องหรือเป็นค่าว่าง' });
        }

        const client = url.startsWith('https') ? https : require('http');
        const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
            const statusCode = res.statusCode;
            const redirectUrl = res.headers.location || '';

            // ถ้า HTTP 400 ขึ้นไปถือว่าลิงก์เสีย
            if (statusCode >= 400) {
                return resolve({ status: statusCode, finalUrl: redirectUrl || url, isDead: true, reason: `HTTP ${statusCode}` });
            }

            // ดักจับหน้าแคมเปญประกันที่หมดอายุหรือถูกปิด
            const lowerRedirect = redirectUrl.toLowerCase();
            if (lowerRedirect.includes('campaign_ended') || lowerRedirect.includes('closed') || lowerRedirect.includes('expired')) {
                return resolve({ status: statusCode, finalUrl: redirectUrl, isDead: true, reason: 'แคมเปญประกันหมดอายุ (Redirected)' });
            }

            resolve({ status: statusCode, finalUrl: redirectUrl || url, isDead: false });
        });

        req.on('error', (e) => {
            resolve({ status: 0, finalUrl: url, isDead: true, reason: e.message });
        });

        req.setTimeout(10000, () => {
            req.abort();
            resolve({ status: 408, finalUrl: url, isDead: true, reason: 'Request Timeout (เซิร์ฟเวอร์ไม่ตอบสนอง)' });
        });
    });
}

// 3. ฟังก์ชันยิงแจ้งเตือนผ่าน LINE Messaging API
function pushLineMessage(textMessage) {
    const channelToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const userId = process.env.LINE_USER_ID;

    if (!channelToken || !userId) {
        console.warn('⚠️ ข้ามการส่ง LINE: ไม่ได้ตั้งค่า Secrets ใน GitHub');
        return Promise.resolve();
    }

    const postData = JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: textMessage }]
    });

    const options = {
        hostname: 'api.line.me',
        path: '/v2/bot/message/push',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${channelToken}`,
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            console.log(`📡 ส่ง LINE สำเร็จ สถานะ: ${res.statusCode}`);
            resolve();
        });
        req.on('error', (e) => {
            console.error('❌ ส่ง LINE ล้มเหลว:', e.message);
            resolve();
        });
        req.write(postData);
        req.end();
    });
}

// 4. สแกนและสรุปผล
async function run() {
    console.log(`🔍 [LNY Insurance] เริ่มตรวจสอบแผนประกันทั้งหมด ${products.length} รายการ...`);
    const deadItems = [];

    for (const prod of products) {
        const title = prod.title || prod.id || 'แผนประกัน';
        const res = await checkUrl(prod.link);

        if (res.isDead) {
            console.log(`❌ พบปัญหา: [${title}] -> ${res.reason}`);
            deadItems.push({ title: title, link: prod.link, reason: res.reason });
        } else {
            console.log(`✅ ปกติ: [${title}]`);
        }
    }

    if (deadItems.length > 0) {
        let msg = `⚠️ [LNY Insurance Advisor] พบลิงก์มีปัญหา (${deadItems.length} รายการ)\n\n`;
        deadItems.forEach((item, index) => {
            msg += `${index + 1}. ${item.title}\n`;
            msg += `• ลิงก์: ${item.link}\n`;
            msg += `• ปัญหา: ${item.reason}\n\n`;
        });
        msg += `💡 นำลิงก์ใหม่มาอัปเดตใน affiliate_products.json ได้เลยครับ`;
        await pushLineMessage(msg);
    } else {
        const heartbeatMsg = `🟢 [LNY Insurance Advisor]\n📅 รายงานเช้าวันจันทร์: สแกนครบ ${products.length} รายการ\n✨ ลิงก์สมบูรณ์พร้อมรับเงินครับ!`;
        await pushLineMessage(heartbeatMsg);
    }
}

run();
