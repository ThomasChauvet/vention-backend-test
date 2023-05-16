const router = require('express').Router();

const MaterialService = require('../services/materialService.js');

router.get('/:id/maxQuantity', async (req, res) => {
  try {
    const weaponQty = await MaterialService().getMaterialMaxQuantity(
      req.params.id
    );
    res.status(200).json(weaponQty);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const material = await MaterialService().getMaterial(req.params.id);
    res.status(200).json(material);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const material = await MaterialService().updateMaterial(
      req.params.id,
      req.body
    );
    res.status(200).json(material);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

module.exports = router;
