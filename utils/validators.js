// 邮箱验证
exports.validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// 手机号验证（中国大陆手机号）
exports.validatePhone = (phone) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
};

// 密码强度验证
exports.validatePassword = (password) => {
    // 密码至少8位，包含大小写字母、数字和特殊字符
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
};

// 用户名验证
exports.validateUsername = (username) => {
    // 用户名4-20位，只能包含字母、数字、下划线
    const usernameRegex = /^[a-zA-Z0-9_]{4,20}$/;
    return usernameRegex.test(username);
};

// 中文姓名验证
exports.validateChineseName = (name) => {
    const nameRegex = /^[\u4e00-\u9fa5]{2,20}$/;
    return nameRegex.test(name);
};

// URL验证
exports.validateUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
};

// 日期验证
exports.validateDate = (date) => {
    const dateObj = new Date(date);
    return dateObj instanceof Date && !isNaN(dateObj);
};

// 身份证号验证
exports.validateIdCard = (idCard) => {
    const idCardRegex = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
    return idCardRegex.test(idCard);
};

// 金额验证
exports.validateAmount = (amount) => {
    const amountRegex = /^\d+(\.\d{1,2})?$/;
    return amountRegex.test(amount);
};

// 邮政编码验证
exports.validatePostalCode = (code) => {
    const postalCodeRegex = /^[1-9]\d{5}$/;
    return postalCodeRegex.test(code);
};

// IP地址验证
exports.validateIP = (ip) => {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;
    const parts = ip.split('.');
    return parts.every(part => parseInt(part) >= 0 && parseInt(part) <= 255);
};

// 对象ID验证（用于MongoDB）
exports.validateObjectId = (id) => {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    return objectIdRegex.test(id);
};

// 文件扩展名验证
exports.validateFileExtension = (filename, allowedExtensions) => {
    const ext = filename.split('.').pop().toLowerCase();
    return allowedExtensions.includes(ext);
};

// 文件大小验证
exports.validateFileSize = (size, maxSize) => {
    return size <= maxSize;
};

// 字符串长度验证
exports.validateLength = (str, min, max) => {
    return str.length >= min && str.length <= max;
};

// 数值范围验证
exports.validateRange = (num, min, max) => {
    return num >= min && num <= max;
};

// 特殊字符过滤
exports.filterSpecialChars = (str) => {
    return str.replace(/[<>'"]/g, '');
};

// XSS防护
exports.escapeHtml = (str) => {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, m => map[m]);
};

// SQL注入防护
exports.escapeSql = (str) => {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, char => {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\" + char;
            default:
                return char;
        }
    });
};

const validateRegistration = (req, res, next) => {
    const { username, email, password } = req.body;

    if (!username || username.length < 3) {
        return res.status(400).json({ message: '用户名至少需要3个字符' });
    }

    if (!email || !email.includes('@')) {
        return res.status(400).json({ message: '请提供有效的邮箱地址' });
    }

    if (!password || password.length < 6) {
        return res.status(400).json({ message: '密码至少需要6个字符' });
    }

    next();
};

const validateLogin = (req, res, next) => {
    const { username, password } = req.body;

    if (!username) {
        return res.status(400).json({ message: '请提供用户名' });
    }

    if (!password) {
        return res.status(400).json({ message: '请提供密码' });
    }

    next();
};

module.exports = {
    validateRegistration,
    validateLogin
}; 