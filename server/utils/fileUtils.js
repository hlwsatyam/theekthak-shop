const fs = require('fs').promises;
const path = require('path');

// Delete file from uploads directory
const deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    // File doesn't exist or permission error
    console.error('Error deleting file:', error);
    return false;
  }
};

// Delete multiple files
const deleteFiles = async (filePaths) => {
  try {
    const deletePromises = filePaths.map(filePath => deleteFile(filePath));
    await Promise.all(deletePromises);
    return true;
  } catch (error) {
    console.error('Error deleting files:', error);
    return false;
  }
};

// Get file extension
const getFileExtension = (filename) => {
  return path.extname(filename).toLowerCase();
};

// Check if file is an image
const isImageFile = (filename) => {
  const ext = getFileExtension(filename);
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
};

// Generate unique filename
const generateUniqueFilename = (originalname) => {
  const ext = getFileExtension(originalname);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}${ext}`;
};

// Create directory if it doesn't exist
const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error('Error creating directory:', error);
    return false;
  }
};

// Get file size in MB
const getFileSizeMB = (sizeInBytes) => {
  return (sizeInBytes / (1024 * 1024)).toFixed(2);
};

module.exports = {
  deleteFile,
  deleteFiles,
  getFileExtension,
  isImageFile,
  generateUniqueFilename,
  ensureDirectoryExists,
  getFileSizeMB
};