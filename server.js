require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise'); // Dùng promise để viết async/await cho gọn
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json()); // Để đọc được data dạng JSON từ Android gửi lên

// Cấu hình kết nối Database
// Chú ý: Vì bạn dùng Cloud Database nên cần có block ssl
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false // Tuỳ vào cert, thường set false là chạy mượt
    }
});

// API Đăng ký
app.post('/api/register', async (req, res) => {
    const { cccd, password } = req.body;

    try {
        // 1. Kiểm tra xem CCCD đã tồn tại trong bảng users chưa
        // (Giả sử bảng của bạn tên là 'users' và có 2 cột 'cccd', 'password')
        const [rows] = await pool.execute('SELECT * FROM users WHERE cccd = ?', [cccd]);
        
        if (rows.length > 0) {
            // Nếu có kết quả trả về -> CCCD đã tồn tại
            return res.status(400).json({ success: false, message: 'CCCD này đã được đăng ký' });
        }

        // 2. Nếu chưa tồn tại, tiến hành lưu vào Database
        // Hiện tại tạm lưu thẳng password như bạn yêu cầu cho nhanh gọn
        await pool.execute('INSERT INTO users (cccd, password) VALUES (?, ?)', [cccd, password]);
        
        // Trả về thành công
        res.status(201).json({ success: true, message: 'Đăng ký thành công!' });

    } catch (error) {
        console.error('Lỗi Database:', error);
        res.status(500).json({ success: false, message: 'Lỗi server, vui lòng thử lại sau.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy tại cổng ${PORT}`);
});