const db = require('../config/dbConfig.js');

const {
  materials_compositions,
  materials,
  weapons,
  weapons_compositions
} = require('../database/tables');

// Id field is not editable, and deletion timestamp should only be updated via a dedicated "delete" method
const updatableFields = ['name', 'base_power', 'qty'];

class Material {
  constructor(payload) {
    this.id = payload.id;
    this.name = payload.name;
    this.base_power = payload.base_power;
    this.qty = payload.qty;
    this.deleted_at = payload.deleted_at;
  }

  static getUpdatableFields() {
    return updatableFields;
  }

  static async find(id) {
    const material = await db(materials).where('id', id).first();
    if (!material) return null;
    return new Material(material);
  }

  /**
   * Calculates the material's overall power level, based on its base power and sub-components materials
   * @param {Set[]} ancestors Set of material ids encountered in the current material ancestry
   * @returns {number}
   */
  async getPowerLevel(ancestors) {
    // Base power
    let powerLevel = this.base_power || 0;

    // Any sub-materials?
    const compositions = await db
      .select(
        `${materials}.id`,
        `${materials}.name`,
        `${materials}.base_power`,
        `${materials}.deleted_at`,
        // Get composition quantity rather than current inventory for later reference
        `${materials_compositions}.qty`
      )
      .table(materials_compositions)
      .join(
        materials,
        `${materials}.id`,
        `${materials_compositions}.material_id`
      )
      .where('parent_id', this.id);

    await Promise.all(
      (compositions || []).map((rawSubMaterial) => {
        const subMaterial = new Material(rawSubMaterial);

        // Check for circular references to avoid infinite loop
        if ((ancestors || new Set()).has(rawSubMaterial.id))
          throw new Error(
            `Looks like you are messing with the universe entropy...`
          );

        // Get sub material power level trhough a recursive call, and then compute the current material level given the quantity of component material involved
        return subMaterial
          .getPowerLevel(new Set([...(ancestors || []), rawSubMaterial.id]))
          .then((subMaterialPowerLevel) => {
            powerLevel = powerLevel + subMaterial.qty * subMaterialPowerLevel;
          });
      })
    );

    return powerLevel;
  }

  /**
   * Returns an array of weapons that use the material in their composition
   * @returns {Weapon[]}
   */
  async getAssociatedWeapons() {
    // Using a map of Weapon Id / Weapon to store all results to be able to quickly get a list of all weapons without duplicates at the end
    const associatedWeapons = {};

    await Promise.all([
      // Directly associated
      db
        .select(`${weapons}.*`)
        .table(weapons_compositions)
        .join(weapons, `${weapons_compositions}.parent_id`, `${weapons}.id`)
        .where(`${weapons_compositions}.material_id`, this.id)
        .then((weaponCompositions) => {
          (weaponCompositions || []).forEach((weapon) => {
            // Store weapon in result map
            associatedWeapons[weapon.id] = new Weapon(weapon);
          });
        }),
      // Via a composition
      db
        .select(`${materials}.*`)
        .table(materials_compositions)
        .join(
          materials,
          `${materials_compositions}.parent_id`,
          `${materials}.id`
        )
        .where(`${materials_compositions}.material_id`, this.id)
        .then((materialCompositions) =>
          Promise.all(
            (materialCompositions || []).map((material) =>
              // Get parent material associated weapons through a recursive call
              new Material(material)
                .getAssociatedWeapons()
                .then((compositionWeapons) => {
                  // Store weapons in result map
                  (compositionWeapons || []).forEach((weapon) => {
                    associatedWeapons[weapon.id] = weapon;
                  });
                })
            )
          )
        )
    ]);

    // Return an array of weapon objects with no duplicates
    return Object.values(associatedWeapons);
  }

  /**
   * Forces the recalculation of the power level for all weapons using the material
   */
  async updateAssociatedWeapons() {
    // Get associated weapons and force power level recalculation
    return this.getAssociatedWeapons().then((associatedWeapons) =>
      Promise.all(
        (associatedWeapons || []).map((associatedWeapon) =>
          associatedWeapon
            ? associatedWeapon.updatePowerLevel()
            : Promise.resolve()
        )
      )
    );
  }

  /**
   * Updates the material database entry and updates the associate weapons stored power level if the material's base power level chenged
   */
  async update() {
    // Weapons power level updated is more costly than a simple fetch, so it is worth checking if the base power changed or not before triggering it
    const currentValues = await Material.find(this.id);
    // Update main entity, using white listed fields list
    await db(materials)
      .where('id', this.id)
      .update(
        updatableFields.reduce(
          (updatedValues, fieldName) => ({
            ...updatedValues,
            [fieldName]: this[fieldName]
          }),
          {}
        )
      );

    // If the base power value changed, we need to recalculate the power level for all weapons using that material
    // This has to wait for the main material entry to be updated and cannot be ran in parallel
    if (this.base_power !== currentValues.base_power) {
      await this.updateAssociatedWeapons();
    }
  }

  /**
   * Calculates the potentially available quantity for the material, based on its current actual stock and what could be manufactured from subcomponents
   * @param {Set[]} ancestors Set of material ids encountered in the current material ancestry
   * @returns {number}
   */
  async getPossibleQuantity(ancestors) {
    // Can be manufactured from sub-materials?
    // Using a map of Material Id / Manufacturable Quantity to store the potential subcomponents available quantities
    const manufacturableQuantities = {};

    const compositions = await db
      .select(
        `${materials}.id`,
        `${materials}.name`,
        `${materials}.base_power`,
        `${materials}.deleted_at`,
        // Needs to keep tabs on both the required quantity and the current stock
        `${materials}.qty`,
        `${materials_compositions}.qty as required_qty`
      )
      .table(materials_compositions)
      .join(
        materials,
        `${materials}.id`,
        `${materials_compositions}.material_id`
      )
      .where('parent_id', this.id);

    await Promise.all(
      (compositions || []).map((rawSubMaterial) => {
        const subMaterial = new Material(rawSubMaterial);

        // Check for circular references to avoid infinite loop
        if ((ancestors || new Set()).has(subMaterial.id))
          throw new Error(
            `Looks like you are messing with the universe entropy...`
          );

        // Get sub-material available quantity through a recursive call
        return subMaterial
          .getPossibleQuantity(new Set([...(ancestors || []), subMaterial.id]))
          .then((subMaterialQuantity) => {
            // We store the quantity of material that could be manufactured from this subcomponent available quantity
            manufacturableQuantities[subMaterial.id] = Math.floor(
              subMaterialQuantity / rawSubMaterial.required_qty
            );
          });
      })
    );

    // Total = existing stock + manufacturable quantity
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

module.exports = Material;

// Declaration Moved at the end to deal with circular dependencies between the 2 classes
const Weapon = require('./weapon');
