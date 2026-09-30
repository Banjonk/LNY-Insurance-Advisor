const fs = require('fs');
const path = require('path');
const https = require('https');

// 1. อ่านไฟล์ข้อมูล affiliate_products.json
const jsonPath = path.join(__dirname, '../web/data/affiliate_products.json');
let products = [];

try {
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    products = JSON.parse(rawData);
} catch (err) {
    console.error('❌ ไม่พบหรืออ่านไฟล์ JSON ไม่สำเร็จ:', err.message);
    process.exit(1);
}

// 2. ฟังก์ชันตรวจสอบสถานะของ URL (เช็กทั้ง Status Code และ URL ปลายทางหลัง Redirect)
function checkUrl(url) {
    return new Promise((resolve) => {
        if (!url || url === '#' || !url.startsWith('http')) {
            return resolve({ status: 0, finalUrl: url, isDead: true, reason: 'URL ไม่ถูกต้องหรือเป็นค่าว่าง' });
        }

        const client = url.startsWith('https') ? https : require('http');
        const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
            const statusCode = res.statusCode;
            const redirectUrl = res.headers.location || '';

            // ถ้าเป็น 404, 410 หรือ 5xx ถือว่าลิงก์เสีย
            if (statusCode >= 400) {
                return resolve({ status: statusCode, finalUrl: redirectUrl || url, isDead: true, reason: `HTTP ${statusCode}` });
            }

            // ถ้าโดน Redirect ไปหน้าปิดแคมเปญ หรือหน้าหลักที่ไม่ใช่ปลายทางเดิม
            const lowerRedirect = redirectUrl.toLowerCase();
            if (lowerRedirect.includes('campaign_ended') || lowerRedirect.includes('closed') || lowerRedirect.includes('expired')) {
                return resolve({ status: statusCode, finalUrl: redirectUrl, isDead: true, reason: 'แคมเปญหมดอายุ (Redirected)' });
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
async function sendLineAlert(deadItems) {
    const channelToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const userId = process.env.LINE_USER_ID;

    if (!channelToken || !userId) {
        console.warn('⚠️ ข้ามการส่ง LINE: ไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_USER_ID ใน Secrets');
        return;
    }

    let messageText = `⚠️ แจ้งเตือน: พบลิงก์ Affiliate มีปัญหา (${deadItems.length} รายการ)\n\n`;
    deadItems.forEach((item, index) => {
        messageText += `${index + 1}. ${item.title}\n`;
        messageText += `• ลิงก์: ${item.link}\n`;
        messageText += `• ปัญหา: ${item.reason}\n\n`;
    });
    messageText += `💡 เข้า Accesstrade เพื่อขอรับลิงก์ใหม่ และนำมาอัปเดตใน affiliate_products.json ได้เลยครับ`;

    const postData = JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: messageText }]
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
            console.log(`📡 ส่งแจ้งเตือน LINE แล้ว สถานะ: ${res.statusCode}`);
            resolve();
        });
        req.on('error', (e) => {
            console.error('❌ ส่ง LINE ไม่สำเร็จ:', e.message);
            resolve();
        });
        req.write(postData);
        req.end();
    });
}

// 4. เริ่มประมวลผลสแกนทุกลิงก์
async function run() {
    console.log(`🔍 เริ่มตรวจสอบลิงก์ Affiliate ทั้งหมด ${products.length} รายการ...`);
    const deadItems = [];

    for (const prod of products) {
        const res = await checkUrl(prod.link);
        if (res.isDead) {
            console.log(`❌ พบปัญหา: [${prod.title}] -> ${res.reason}`);
            deadItems.push({ title: prod.title, link: prod.link, reason: res.reason });
        } else {
            console.log(`✅ ปกติ: [${prod.title}]`);
        }
    }

    if (deadItems.length > 0) {
        console.log(`\n🚨 สรุป: มีลิงก์เสียทั้งหมด ${deadItems.length} รายการ กำลังส่ง LINE...`);
        await sendLineAlert(deadItems);
    } else {
        console.log('\n🎉 เยี่ยมมาก! ลิงก์ทุกตัวยังใช้งานได้ปกติ ไม่มีแคมเปญใดถูกปิด');
    }
}

run();
