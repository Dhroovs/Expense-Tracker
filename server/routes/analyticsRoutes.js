const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/summary', analyticsController.getSummary);
router.get('/category-breakdown', analyticsController.getCategoryBreakdown);
router.get('/monthly-comparison', analyticsController.getMonthlyComparison);
router.get('/spending-trend', analyticsController.getSpendingTrend);
router.get('/spending-distribution', analyticsController.getSpendingDistribution);

module.exports = router;
