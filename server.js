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
// --- API DASHBOARD THỐNG KÊ ---
app.get('/api/dashboard', async (req, res) => {
    try {
        // Mở kết nối giống hệt cách làm ở API Login
        const connection = await mysql.createConnection(dbConfig);

        // 1. Số ca đang điều trị (F0 hiện tại)
        const qDangDieuTri = `
            SELECT COUNT(*) AS count 
            FROM GHINHANTRANGTHAI g1 
            WHERE MaTrangThai = 4 
              AND NgayCapNhat = (SELECT MAX(NgayCapNhat) FROM GHINHANTRANGTHAI g2 WHERE g1.MaNguoiDung = g2.MaNguoiDung)
        `;

        // 2. Số ca đã hồi phục
        const qDaHoiPhuc = `
            SELECT COUNT(*) AS count 
            FROM GHINHANTRANGTHAI g1 
            WHERE MaTrangThai = 5 
              AND NgayCapNhat = (SELECT MAX(NgayCapNhat) FROM GHINHANTRANGTHAI g2 WHERE g1.MaNguoiDung = g2.MaNguoiDung)
        `;

        // 3. Tổng ca bệnh
        const qTongCa = `
            SELECT COUNT(DISTINCT MaNguoiDung) AS count 
            FROM GHINHANTRANGTHAI 
            WHERE MaTrangThai = (4, 5)
        `;

        // 4. Số vùng dịch đang hoạt động
        const qVungDich = `
            SELECT COUNT(DISTINCT MaKhuVuc) AS count 
            FROM GHINHANVUNGDICH 
            WHERE MaVungDich IN (2, 3, 4) 
              AND (ThoiGianKetThuc IS NULL OR ThoiGianKetThuc >= NOW())
        `;

        // Chạy 4 câu truy vấn SQL cùng lúc để tối ưu thời gian phản hồi
        const [
            [resDangDieuTri], 
            [resDaHoiPhuc], 
            [resTongCa], 
            [resVungDich]
        ] = await Promise.all([
            connection.query(qDangDieuTri),
            connection.query(qDaHoiPhuc),
            connection.query(qTongCa),
            connection.query(qVungDich)
        ]);

        // Nhớ đóng kết nối Aiven
        await connection.end();

        // Trả dữ liệu JSON về cho ứng dụng Android
        res.status(200).json({
            success: true,
            data: {
                tongCaBenh: resTongCa[0].count,
                daHoiPhuc: resDaHoiPhuc[0].count,
                dangDieuTri: resDangDieuTri[0].count,
                vungDich: resVungDich[0].count
            }
        });

    } catch (error) {
        console.error('Lỗi DB khi lấy thống kê:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi tải dữ liệu Dashboard' });
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});