const multer = require('multer');
const path = require('path');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

const templateStorage = multer.diskStorage({
  destination: path.join(uploadsDir, 'templates'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const cvStorage = multer.diskStorage({
  destination: path.join(uploadsDir, 'cv-temp'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const docScanStorage = multer.diskStorage({
  destination: path.join(uploadsDir, 'doc-scan'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const knowledgeBaseStorage = multer.diskStorage({
  destination: path.join(uploadsDir, 'knowledge-base'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const generalStorage = multer.memoryStorage();

module.exports = {
  uploadTemplate: multer({ storage: templateStorage }),
  uploadCV: multer({ storage: cvStorage }),
  uploadDocScan: multer({ storage: docScanStorage }),
  uploadKnowledgeBase: multer({ storage: knowledgeBaseStorage }),
  uploadGeneral: multer({ storage: generalStorage }),
  uploadsDir,
};
