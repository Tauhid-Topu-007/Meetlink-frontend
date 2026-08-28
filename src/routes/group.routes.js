const express = require('express');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/group.controller');

const router = express.Router();

router.use(protect);
router.get('/', ctrl.listMine);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/schedule', ctrl.scheduleMeeting);

module.exports = router;
