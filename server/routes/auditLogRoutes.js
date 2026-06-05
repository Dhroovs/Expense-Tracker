const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, auditLogController.getAuditLogs);

module.exports = router;
