const express = require('express');
const { upload, handleUploadError } = require('../utils/imageUpload');
const auth = require('../middlewares/auth');

const router = express.Router();

// 上传单个图片
router.post('/single', auth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      status: 'fail',
      message: 'No file uploaded'
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      filename: req.file.filename,
      path: `/uploads/${req.file.filename}`
    }
  });
});

// 上传多个图片
router.post('/multiple', auth, upload.array('images', 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      status: 'fail',
      message: 'No files uploaded'
    });
  }

  const files = req.files.map(file => ({
    filename: file.filename,
    path: `/uploads/${file.filename}`
  }));

  res.status(200).json({
    status: 'success',
    data: { files }
  });
});

// 错误处理
router.use(handleUploadError);

module.exports = router; 