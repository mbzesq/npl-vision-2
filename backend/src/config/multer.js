const multer = require('multer');
const path = require('path');

// Configure multer for memory storage (no file persistence)
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.xlsx', '.xls', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not supported. Allowed types: ${allowedExtensions.join(', ')}`), false);
  }
};

// Create multer instance with configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: process.env.MAX_FILE_SIZE || 52428800, // 50MB default
    files: 10 // Max 10 files per request
  }
});

module.exports = upload;