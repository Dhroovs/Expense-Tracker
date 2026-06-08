const express = require('express');
const router = express.Router();
const recurringController = require('../controllers/recurringController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', recurringController.getRecurringTransactions);
router.post('/', recurringController.createRecurringTransaction);
router.put('/:id', recurringController.updateRecurringTransaction);
router.delete('/:id', recurringController.deleteRecurringTransaction);
router.put('/:id/toggle', recurringController.toggleRecurringActive);

module.exports = router;
