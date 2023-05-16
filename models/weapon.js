const db = require('../config/dbConfig.js');
const {
  weapons,
  weapons_compositions,
  materials
} = require('../database/tables');

class Weapon {
  constructor(payload) {
    this.id = payload.id;
    this.name = payload.name;
    this.power_level = payload.power_level;
    this.qty = payload.qty;
    this.deleted_at = payload.deleted_at;
  }

  static async find(id) {
    const rawWeapon = await db(weapons).where('id', id).first();
    if (!rawWeapon) return null;
    const weapon = new Weapon(rawWeapon);

    // Make sure the power level is initialized
    weapon.power_level = await weapon.getPowerLevel();

    return weapon;
  }

  /**
   * Calculates the weapon's overall power level, based on its sub-components materials
   * @returns {number}
   */
  async computePowerLevel() {
    // Base power
    let powerLevel = 0;

    // Get weapon's composition
    const composition = await db
      .select(
        `${materials}.id`,
        `${materials}.name`,
        `${materials}.base_power`,
        `${materials}.deleted_at`,
        // Get composition quantity rather than current inventory for later reference
        `${weapons_compositions}.qty`
      )
      .table(weapons_compositions)
      .join(materials, `${materials}.id`, `${weapons_compositions}.material_id`)
      .where(`${weapons_compositions}.parent_id`, this.id);

    await Promise.all(
      (composition || []).map((rawMaterial) =>
        // Get material power level and add to weapon's power level using the involved quantity
        new Material(rawMaterial).getPowerLevel().then((materialPowerLevel) => {
          powerLevel = powerLevel + rawMaterial.qty * materialPowerLevel;
        })
      )
    );

    return powerLevel;
  }

  /**
   * Forces the weapon's power level recalculation and database update
   * @returns {number}
   */
  async updatePowerLevel() {
    // Recalculate the power level
    let recalculatedPowerLevel;

    try {
      recalculatedPowerLevel = await this.computePowerLevel();
    } catch (error) {
      // Reset value to null if one of the components is problematic
      recalculatedPowerLevel = null;
    }

    // Update the stored value in the database if different form the current one
    if (recalculatedPowerLevel !== this.power_level) {
      await db(weapons)
        .where('id', this.id)
        .update('power_level', recalculatedPowerLevel);
    }

    return recalculatedPowerLevel;
  }

  /**
   * Returns the weapon's power level, with lazy initialization if it has not been calculated yet
   * @returns {number}
   */
  async getPowerLevel() {
    // Computed value available? Then let's assume that it is up to date if we did our job properly
    // Need to test for actual null value since power_level might actually be already computed to 0
    if (this?.power_level !== null) return this.power_level;

    // The actual value was not calculated yet, so let's do it on the fly and store the value in the database
    return this.updatePowerLevel();
  }

  /**
   * Calculates the potentially available quantity for the weapon, based on its current actual stock and what could be manufactured from subcomponents
   * @returns {number}
   */
  async getPossibleQuantity() {
    // Can be manufactured from sub-materials?
    // Using a map of Material Id / Manufacturable Quantity to store the potential subcomponents available quantities
    const manufacturableQuantities = {};

    // Get weapon's composition
    const composition = await db
      .select(
        `${materials}.id`,
        `${materials}.name`,
        `${materials}.base_power`,
        `${materials}.deleted_at`,
        // Needs to keep tabs on both the required quantity and the current stock
        `${materials}.qty`,
        `${weapons_compositions}.qty as required_qty`
      )
      .table(weapons_compositions)
      .join(materials, `${materials}.id`, `${weapons_compositions}.material_id`)
      .where(`${weapons_compositions}.parent_id`, this.id);

    await Promise.all(
      (composition || []).map((rawMaterial) =>
        new Material(rawMaterial)
          .getPossibleQuantity()
          .then((materialPossibleQuantity) => {
            // We store the quantity of material that could be manufactured from this subcomponent available quantity
            manufacturableQuantities[rawMaterial.id] = Math.floor(
              materialPossibleQuantity / rawMaterial.required_qty
            );
          })
      )
    );

    // Total = existing stock + minimum manufacturable quantity
    return (
      // Existing stock
      (this.qty || 0) +
      // Manufacturable quantity (if any) = minimum common quantity between all subcomponents
      (Object.values(manufacturableQuantities).length
        ? Math.min(...Object.values(manufacturableQuantities))
        : 0)
    );
  }
}

module.exports = Weapon;

// Declaration Moved at the end to deal with circular dependencies between the 2 classes
const Material = require('./material');
