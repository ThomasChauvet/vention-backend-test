# ⚔️ VENTION QUEST ⚔️

**QUESTS**:

1. Design and create a **Weapon** object in the database and a model class and seed weapons.

   > ./models/weapon.js
   >
   > ./database/migrations/20230515094218_weapons_table_migration.js
   >
   > ./database/seeds/003_weapons.js
   >
   > ./database/seeds/004_weapons_compoisitions.js

2. Implement method on the Weapon class to compute total power level of a weapon based on its composition(s).

   > **computePowerLevel** function in ./models/weapon.js
   >
   > GET /api/weapon/:id will allow to view the result easily

3. API endpoint to update material power level and making sure the weapon(s) that uses it is also updated.

   > PUT /api/material/:id - will accept any payload but will only allow to update _name_, _base_power_ and _qty_ fields. Returns the updated material entry

4. Update method for **Material** class.

   > **update** function in ./models/material.js

5. API endpoint to fetch the maximum quantity of a single **Weapon** that we can build.

   > GET /api/weapon/:id/maxQuantity
   > **getPossibleQuantity** function in ./models/weapon.js

**AVAILABLE API ROUTES**

- Materials
  - GET /api/material/:id
  - GET /api/material/:id/maxQuantity
  - PUT /api/material/:id
- Weapons
  - GET /api/weapon/:id
  - GET /api/weapon/:id/maxQuantity
