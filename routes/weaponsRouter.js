const router = require('express').Router();

const WeaponService = require('../services/weaponService.js');

router.get('/:id/maxQuantity', async (req, res) => {
  try {
    const weaponQty = await WeaponService().getWeaponMaxQuantity(req.params.id);
    res.status(200).json(weaponQty);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const weapon = await WeaponService().getWeapon(req.params.id);
    res.status(200).json(weapon);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

module.exports = router;
