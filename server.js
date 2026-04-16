require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Cấu hình kết nối MySQL (Aiven bắt buộc dùng SSL)
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false } // Bắt buộc cho Aiven
};

// --- API LOGIN ---
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Thiếu tài khoản hoặc mật khẩu' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Truy vấn kiểm tra thông tin đăng nhập
        const [rows] = await connection.execute(
            'SELECT MaTaiKhoan, TenDangNhap, MaNguoiDung, MaVaiTro FROM TAIKHOAN WHERE TenDangNhap = ? AND MatKhau = ?',
            [username, password]
        );

        await connection.end();

        if (rows.length > 0) {
            const user = rows[0];
            res.status(200).json({
                success: true,
                message: 'Đăng nhập thành công',
                data: {
                    accountId: user.MaTaiKhoan,
                    username: user.TenDangNhap,
                    userId: user.MaNguoiDung,
                    roleId: user.MaVaiTro 
                }
            });
        } else {
            res.status(401).json({ success: false, message: 'Sai tài khoản hoặc mật khẩu' });
        }
    } catch (error) {
        console.error('Lỗi DB:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// Chạy Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});